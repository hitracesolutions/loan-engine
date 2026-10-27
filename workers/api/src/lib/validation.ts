import { badRequest } from './http.ts';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 200;
const MAX_NAME_LENGTH = 120;

export function requireString(
  body: Record<string, unknown>,
  field: string,
  { maxLength = 200, minLength = 1 }: { maxLength?: number; minLength?: number } = {},
): string {
  const value = body[field];
  if (typeof value !== 'string') {
    throw badRequest('MISSING_FIELD', `${field} is required`);
  }
  const trimmed = value.trim();
  if (trimmed.length < minLength || trimmed.length > maxLength) {
    throw badRequest('INVALID_FIELD', `${field} must be between ${minLength} and ${maxLength} characters`);
  }
  return trimmed;
}

export function optionalString(
  body: Record<string, unknown>,
  field: string,
  maxLength = 200,
): string | null {
  const value = body[field];
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw badRequest('INVALID_FIELD', `${field} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw badRequest('INVALID_FIELD', `${field} must be at most ${maxLength} characters`);
  }
  return trimmed.length === 0 ? null : trimmed;
}

export function requireEmail(body: Record<string, unknown>, field = 'email'): string {
  const value = requireString(body, field, { maxLength: 254 }).toLowerCase();
  if (!EMAIL_PATTERN.test(value)) {
    throw badRequest('INVALID_EMAIL', `${field} is not a valid email address`);
  }
  return value;
}

export function requirePassword(body: Record<string, unknown>, field = 'password'): string {
  const value = body[field];
  if (typeof value !== 'string') {
    throw badRequest('MISSING_FIELD', `${field} is required`);
  }
  if (value.length < MIN_PASSWORD_LENGTH || value.length > MAX_PASSWORD_LENGTH) {
    throw badRequest(
      'WEAK_PASSWORD',
      `${field} must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters`,
    );
  }
  return value;
}

export function requirePersonName(body: Record<string, unknown>, field = 'fullName'): string {
  return requireString(body, field, { maxLength: MAX_NAME_LENGTH, minLength: 2 });
}
