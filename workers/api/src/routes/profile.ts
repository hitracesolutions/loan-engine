import { auditStatement } from '../lib/audit.ts';
import { requireActor } from '../lib/auth.ts';
import { encryptNationalId } from '../lib/encryption.ts';
import { badRequest, forbidden, HttpError, jsonResponse, notFound, readJsonObject } from '../lib/http.ts';
import { ulid } from '../lib/ids.ts';
import { optionalString } from '../lib/validation.ts';
import type { RouteContext } from '../router.ts';

const VALID_ID_TYPES = ['GHANA_CARD', 'PASSPORT', 'VOTER_ID', 'DRIVERS_LICENSE'] as const;
type IdType = (typeof VALID_ID_TYPES)[number];

interface BorrowerProfileRow {
  id: string;
  agency_id: string;
  user_id: string;
  date_of_birth: string | null;
  id_type: string | null;
  id_number: string | null; // legacy plaintext (if any)
  id_number_ciphertext: string | null;
  id_number_iv: string | null;
  id_number_tag: string | null;
  id_number_key_version: number | null;
  id_number_masked: string | null;
  employer: string | null;
  monthly_salary_pesewas: number | null;
  city: string | null;
  created_at: number;
  updated_at: number;
}

interface UserRow {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
}

export function maskIdNumber(idNumber: string | null): string | null {
  if (!idNumber) return null;
  const trimmed = idNumber.trim();
  if (trimmed.length <= 4) return '****';
  return `${trimmed.slice(0, 2)}****${trimmed.slice(-2)}`;
}

/**
 * GET /borrower/profile
 * Retrieves the profile of the authenticated borrower.
 * Borrowers may only retrieve their own profile.
 * Plaintext ID numbers are never serialized in API responses.
 */
export async function getBorrowerProfile({ request, env, requestId }: RouteContext): Promise<Response> {
  const actor = await requireActor(request, env.JWT_SIGNING_KEY);
  if (actor.role !== 'borrower') {
    throw forbidden('Only a borrower may access this profile endpoint');
  }

  const user = await env.DB.prepare(
    'SELECT id, email, phone, full_name FROM users WHERE agency_id = ? AND id = ?',
  )
    .bind(actor.agencyId, actor.userId)
    .first<UserRow>();

  if (!user) {
    throw notFound('User record not found');
  }

  const profile = await env.DB.prepare(
    'SELECT * FROM borrower_profiles WHERE agency_id = ? AND user_id = ?',
  )
    .bind(actor.agencyId, actor.userId)
    .first<BorrowerProfileRow>();

  const maskedId = profile
    ? profile.id_number_masked ?? maskIdNumber(profile.id_number)
    : null;

  const profileObj = profile
    ? {
        id: profile.id,
        userId: user.id,
        dateOfBirth: profile.date_of_birth,
        idType: profile.id_type,
        nationalIdType: profile.id_type,
        nationalIdNumber: maskedId,
        national_id_number: maskedId,
        idNumberMasked: maskedId,
        employer: profile.employer,
        employerName: profile.employer,
        monthlySalaryPesewas: profile.monthly_salary_pesewas,
        monthly_salary_pesewas: profile.monthly_salary_pesewas,
        employer_name: profile.employer,
        city: profile.city,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      }
    : null;

  return jsonResponse(
    {
      userId: user.id,
      email: user.email,
      fullName: user.full_name,
      phone: user.phone,
      dateOfBirth: profile?.date_of_birth ?? null,
      idType: profile?.id_type ?? null,
      idNumberMasked: maskedId,
      nationalIdNumber: maskedId,
      employer: profile?.employer ?? null,
      monthlySalaryPesewas: profile?.monthly_salary_pesewas ?? null,
      city: profile?.city ?? null,
      createdAt: profile?.created_at ?? null,
      updatedAt: profile?.updated_at ?? null,
      profile: profileObj,
    },
    requestId,
  );
}

/**
 * PUT /borrower/profile
 * Creates or updates borrower profile details with AES-256-GCM encryption at rest for National IDs.
 * Enforces ownership: borrowers can only update their own profile.
 * Plaintext National ID is NEVER stored or serialized in response payloads.
 */
export async function updateBorrowerProfile({ request, env, requestId }: RouteContext): Promise<Response> {
  const actor = await requireActor(request, env.JWT_SIGNING_KEY);
  if (actor.role !== 'borrower') {
    throw forbidden('Only a borrower may update their profile');
  }

  const body = await readJsonObject(request);

  // Validate optional fields with aliases
  const fullName = optionalString(body, 'fullName', 120);
  const phone = optionalString(body, 'phone', 32);
  const dateOfBirth = optionalString(body, 'dateOfBirth', 10);
  const idTypeRaw = optionalString(body, 'idType', 32) || optionalString(body, 'nationalIdType', 32);
  const idNumber = optionalString(body, 'idNumber', 64) || optionalString(body, 'nationalIdNumber', 64);
  const employer = optionalString(body, 'employer', 100) || optionalString(body, 'employerName', 100);
  const city = optionalString(body, 'city', 100) || optionalString(body, 'residentialAddress', 100);

  // Validate ID Type if provided
  let idType: IdType | null = null;
  if (idTypeRaw) {
    const normalized = idTypeRaw.toUpperCase();
    if (!VALID_ID_TYPES.includes(normalized as IdType)) {
      throw badRequest('INVALID_ID_TYPE', `idType must be one of: ${VALID_ID_TYPES.join(', ')}`);
    }
    idType = normalized as IdType;
  }

  // Validate Date of Birth format (YYYY-MM-DD) if provided
  if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    throw badRequest('INVALID_DATE_FORMAT', 'dateOfBirth must be in YYYY-MM-DD format');
  }

  // Validate monthlySalaryPesewas if provided
  let monthlySalaryPesewas: number | null = null;
  if (body.monthlySalaryPesewas !== undefined && body.monthlySalaryPesewas !== null) {
    const val = body.monthlySalaryPesewas;
    if (typeof val !== 'number' || !Number.isInteger(val) || val < 0) {
      throw badRequest('INVALID_SALARY', 'monthlySalaryPesewas must be a non-negative integer');
    }
    if (val > 100_000_000_00) { // GH₵ 100,000,000.00
      throw badRequest('SALARY_TOO_LARGE', 'monthlySalaryPesewas exceeds the permitted ceiling');
    }
    monthlySalaryPesewas = val;
  }

  // Authenticated encryption of National ID at rest (AES-256-GCM)
  let encryptedCiphertext: string | null = null;
  let encryptedIv: string | null = null;
  let encryptedTag: string | null = null;
  let keyVersion: number | null = null;
  let maskedId: string | null = null;

  if (idNumber) {
    if (!env.ID_ENCRYPTION_KEY) {
      throw new HttpError(500, 'SECURITY_CONFIGURATION_ERROR', 'Encryption service unavailable');
    }
    try {
      const encrypted = await encryptNationalId(idNumber, env.ID_ENCRYPTION_KEY);
      encryptedCiphertext = encrypted.ciphertext;
      encryptedIv = encrypted.iv;
      encryptedTag = encrypted.tag;
      keyVersion = encrypted.keyVersion;
      maskedId = maskIdNumber(idNumber);
    } catch (err) {
      throw new HttpError(500, 'ENCRYPTION_FAILED', 'Failed to securely encrypt sensitive identity data');
    }
  }

  const now = Date.now();
  const profileId = ulid(now);

  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO borrower_profiles
         (id, agency_id, user_id, date_of_birth, id_type, id_number,
          id_number_ciphertext, id_number_iv, id_number_tag, id_number_key_version, id_number_masked,
          employer, monthly_salary_pesewas, city, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (agency_id, user_id) DO UPDATE SET
         date_of_birth = coalesce(excluded.date_of_birth, borrower_profiles.date_of_birth),
         id_type = coalesce(excluded.id_type, borrower_profiles.id_type),
         id_number = NULL, -- ensure plaintext is cleared
         id_number_ciphertext = coalesce(excluded.id_number_ciphertext, borrower_profiles.id_number_ciphertext),
         id_number_iv = coalesce(excluded.id_number_iv, borrower_profiles.id_number_iv),
         id_number_tag = coalesce(excluded.id_number_tag, borrower_profiles.id_number_tag),
         id_number_key_version = coalesce(excluded.id_number_key_version, borrower_profiles.id_number_key_version),
         id_number_masked = coalesce(excluded.id_number_masked, borrower_profiles.id_number_masked),
         employer = coalesce(excluded.employer, borrower_profiles.employer),
         monthly_salary_pesewas = coalesce(excluded.monthly_salary_pesewas, borrower_profiles.monthly_salary_pesewas),
         city = coalesce(excluded.city, borrower_profiles.city),
         updated_at = excluded.updated_at`,
    ).bind(
      profileId,
      actor.agencyId,
      actor.userId,
      dateOfBirth,
      idType,
      encryptedCiphertext,
      encryptedIv,
      encryptedTag,
      keyVersion,
      maskedId,
      employer,
      monthlySalaryPesewas,
      city,
      now,
      now,
    ),
  ];

  // If user metadata updated, sync users table
  if (fullName || phone) {
    statements.push(
      env.DB.prepare(
        `UPDATE users SET
           full_name = coalesce(?, full_name),
           phone = coalesce(?, phone),
           updated_at = ?
         WHERE agency_id = ? AND id = ?`,
      ).bind(fullName, phone, now, actor.agencyId, actor.userId),
    );
  }

  // Audit event (strictly sanitized: NEVER log plain national ID or salary)
  statements.push(
    auditStatement(env.DB, {
      agencyId: actor.agencyId,
      actorId: actor.userId,
      action: 'BORROWER_PROFILE_UPDATED',
      resourceType: 'borrower_profile',
      resourceId: actor.userId,
      details: {
        hasDob: Boolean(dateOfBirth),
        idType,
        hasEncryptedId: Boolean(encryptedCiphertext),
        hasSalary: monthlySalaryPesewas !== null,
        city,
      },
    }),
  );

  await env.DB.batch(statements);

  // Fetch updated profile and user record
  const updatedUser = await env.DB.prepare(
    'SELECT id, email, phone, full_name FROM users WHERE agency_id = ? AND id = ?',
  )
    .bind(actor.agencyId, actor.userId)
    .first<UserRow>();

  const updatedProfile = await env.DB.prepare(
    'SELECT * FROM borrower_profiles WHERE agency_id = ? AND user_id = ?',
  )
    .bind(actor.agencyId, actor.userId)
    .first<BorrowerProfileRow>();

  const finalMaskedId = updatedProfile
    ? updatedProfile.id_number_masked ?? maskIdNumber(updatedProfile.id_number)
    : null;

  const profileObj = updatedProfile
    ? {
        id: updatedProfile.id,
        userId: actor.userId,
        dateOfBirth: updatedProfile.date_of_birth,
        idType: updatedProfile.id_type,
        nationalIdType: updatedProfile.id_type,
        nationalIdNumber: finalMaskedId,
        national_id_number: finalMaskedId,
        idNumberMasked: finalMaskedId,
        employer: updatedProfile.employer,
        employerName: updatedProfile.employer,
        monthlySalaryPesewas: updatedProfile.monthly_salary_pesewas,
        monthly_salary_pesewas: updatedProfile.monthly_salary_pesewas,
        employer_name: updatedProfile.employer,
        city: updatedProfile.city,
        createdAt: updatedProfile.created_at,
        updatedAt: updatedProfile.updated_at,
      }
    : null;

  return jsonResponse(
    {
      userId: updatedUser?.id ?? actor.userId,
      email: updatedUser?.email,
      fullName: updatedUser?.full_name,
      phone: updatedUser?.phone,
      dateOfBirth: updatedProfile?.date_of_birth ?? null,
      idType: updatedProfile?.id_type ?? null,
      idNumberMasked: finalMaskedId,
      nationalIdNumber: finalMaskedId,
      employer: updatedProfile?.employer ?? null,
      monthlySalaryPesewas: updatedProfile?.monthly_salary_pesewas ?? null,
      city: updatedProfile?.city ?? null,
      createdAt: updatedProfile?.created_at ?? now,
      updatedAt: updatedProfile?.updated_at ?? now,
      profile: profileObj,
    },
    requestId,
  );
}
