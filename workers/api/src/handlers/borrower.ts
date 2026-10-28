/**
 * Borrower Handler — Profile & Application Management
 */

import type { CloudflareEnv, CreateApplicationRequest } from "../types";
import { success, badRequest, notFound, unauthorized } from "../utils/response";
import { requireAuth } from "../utils/auth";
import { ids } from "../utils/id";

/**
 * GET /borrower/profile — Get borrower profile
 */
export async function getProfile(
  request: Request,
  env: CloudflareEnv
): Promise<Response> {
  try {
    const user = await requireAuth(request, env);
    if (!user || user.role !== "BORROWER") {
      return unauthorized();
    }

    const stmt = env.DB.prepare("SELECT * FROM borrowers WHERE id = ?");
    const borrower = await stmt.bind(user.sub).first();

    if (!borrower) {
      return notFound("Borrower not found");
    }

    return success(borrower);
  } catch (error) {
    console.error("[BORROWER] Get profile error:", error);
    return badRequest("Failed to fetch profile");
  }
}

/**
 * PUT /borrower/profile — Update borrower profile
 */
export async function updateProfile(
  request: Request,
  env: CloudflareEnv
): Promise<Response> {
  try {
    const user = await requireAuth(request, env);
    if (!user || user.role !== "BORROWER") {
      return unauthorized();
    }

    const body = (await request.json()) as any;
    const { first_name, last_name, employer, monthly_salary_pesewas } = body;

    const stmt = env.DB.prepare(`
      UPDATE borrowers
      SET first_name = ?, last_name = ?, employer = ?, monthly_salary_pesewas = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    await stmt.bind(first_name, last_name, employer, monthly_salary_pesewas, user.sub).run();

    return success({ message: "Profile updated" });
  } catch (error) {
    console.error("[BORROWER] Update profile error:", error);
    return badRequest("Failed to update profile");
  }
}

/**
 * GET /borrower/applications — List borrower applications
 */
export async function listApplications(
  request: Request,
  env: CloudflareEnv
): Promise<Response> {
  try {
    const user = await requireAuth(request, env);
    if (!user || user.role !== "BORROWER") {
      return unauthorized();
    }

    const stmt = env.DB.prepare(`
      SELECT id, amount_requested_pesewas, tenure_months, status, created_at, submitted_at
      FROM applications
      WHERE borrower_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `);

    const applications = await stmt.bind(user.sub).all();

    return success(applications.results || []);
  } catch (error) {
    console.error("[BORROWER] List applications error:", error);
    return badRequest("Failed to fetch applications");
  }
}

/**
 * POST /borrower/applications — Create new application
 */
export async function createApplication(
  request: Request,
  env: CloudflareEnv
): Promise<Response> {
  try {
    const user = await requireAuth(request, env);
    if (!user || user.role !== "BORROWER") {
      return unauthorized();
    }

    const body = (await request.json()) as CreateApplicationRequest;
    const { amount_requested_pesewas, tenure_months, purpose } = body;

    if (!amount_requested_pesewas || !tenure_months || !purpose) {
      return badRequest("Missing required fields");
    }

    const applicationId = ids.application();
    const stmt = env.DB.prepare(`
      INSERT INTO applications (id, borrower_id, amount_requested_pesewas, tenure_months, purpose, status)
      VALUES (?, ?, ?, ?, ?, 'DRAFT')
    `);

    await stmt.bind(applicationId, user.sub, amount_requested_pesewas, tenure_months, purpose).run();

    return success({ id: applicationId, status: "DRAFT" }, 201);
  } catch (error) {
    console.error("[BORROWER] Create application error:", error);
    return badRequest("Failed to create application");
  }
}

/**
 * POST /borrower/applications/:id/submit — Submit application
 */
export async function submitApplication(
  request: Request,
  env: CloudflareEnv,
  applicationId: string
): Promise<Response> {
  try {
    const user = await requireAuth(request, env);
    if (!user || user.role !== "BORROWER") {
      return unauthorized();
    }

    // Verify ownership
    const app = await env.DB.prepare("SELECT id FROM applications WHERE id = ? AND borrower_id = ?")
      .bind(applicationId, user.sub)
      .first();

    if (!app) {
      return notFound("Application not found");
    }

    const stmt = env.DB.prepare(`
      UPDATE applications
      SET status = 'SUBMITTED', submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    await stmt.bind(applicationId).run();

    return success({ message: "Application submitted" });
  } catch (error) {
    console.error("[BORROWER] Submit application error:", error);
    return badRequest("Failed to submit application");
  }
}
