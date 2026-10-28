/**
 * Auth Handler — Login & Registration
 */

import type { CloudflareEnv, AuthRequest, AuthResponse } from "../types";
import { success, badRequest, unauthorized, created } from "../utils/response";
import { createToken, hashPassword, verifyPassword } from "../utils/auth";
import { generateId } from "../utils/id";

/**
 * POST /auth/register — Register a new borrower
 */
export async function register(
  request: Request,
  env: CloudflareEnv
): Promise<Response> {
  try {
    const body = (await request.json()) as any;
    const { email, password, first_name, last_name } = body;

    if (!email || !password) {
      return badRequest("Email and password required");
    }

    // Check if borrower exists
    const stmt = env.DB.prepare("SELECT id FROM borrowers WHERE email = ?");
    const existing = await stmt.bind(email).first();

    if (existing) {
      return badRequest("Email already registered");
    }

    // Hash password and create borrower
    const passwordHash = await hashPassword(password);
    const borrowerId = generateId("borrower");

    const insertStmt = env.DB.prepare(`
      INSERT INTO borrowers (id, email, password_hash, first_name, last_name, status, credit_score)
      VALUES (?, ?, ?, ?, ?, 'ACTIVE', 600)
    `);

    await insertStmt.bind(borrowerId, email, passwordHash, first_name || null, last_name || null).run();

    // Create token
    const token = await createToken(
      { sub: borrowerId, role: "BORROWER", email },
      env
    );

    const response: AuthResponse = {
      token,
      user: { id: borrowerId, email, first_name, last_name },
      expires_in: 7 * 24 * 60 * 60, // 7 days
    };

    return created(response);
  } catch (error) {
    console.error("[AUTH] Register error:", error);
    return badRequest("Registration failed");
  }
}

/**
 * POST /auth/login — Login borrower or staff
 */
export async function login(
  request: Request,
  env: CloudflareEnv
): Promise<Response> {
  try {
    const body = (await request.json()) as AuthRequest;
    const { email, password } = body;

    if (!email || !password) {
      return badRequest("Email and password required");
    }

    // Try borrower first
    let stmt = env.DB.prepare("SELECT id, password_hash, email FROM borrowers WHERE email = ?");
    let user = (await stmt.bind(email).first()) as any;
    let role = "BORROWER";

    // Try staff if not found
    if (!user) {
      stmt = env.DB.prepare("SELECT id, password_hash, email, role FROM staff_users WHERE email = ?");
      user = (await stmt.bind(email).first()) as any;
      role = user?.role || "STAFF";
    }

    if (!user) {
      return unauthorized("Invalid email or password");
    }

    // Verify password
    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      return unauthorized("Invalid email or password");
    }

    // Create token
    const token = await createToken(
      { sub: user.id, role, email: user.email },
      env
    );

    const response: AuthResponse = {
      token,
      user: { id: user.id, email: user.email },
      expires_in: 7 * 24 * 60 * 60, // 7 days
    };

    return success(response);
  } catch (error) {
    console.error("[AUTH] Login error:", error);
    return badRequest("Login failed");
  }
}
