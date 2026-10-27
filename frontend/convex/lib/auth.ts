import type { QueryCtx, MutationCtx } from "../_generated/server.js";
import type { Doc } from "../_generated/dataModel";

export type AllowedRole = Doc<"users">["role"];

/**
 * Server-side identity & authorization verifier.
 * Strictly verifies identity from the cryptographic auth token (ctx.auth.getUserIdentity()).
 * Never trusts client-supplied user IDs, roles, or agency IDs.
 */
export async function getVerifiedUser(
  ctx: QueryCtx | MutationCtx
): Promise<{ user: Doc<"users">; identity: NonNullable<Awaited<ReturnType<typeof ctx.auth.getUserIdentity>>> }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("UNAUTHENTICATED: Cryptographic token is missing or invalid.");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();

  if (!user) {
    throw new Error("UNAUTHORIZED: User account not registered or mapped to agency.");
  }

  if (user.status !== "active") {
    throw new Error("FORBIDDEN: User account is inactive or suspended.");
  }

  return { user, identity };
}

/**
 * Asserts that the authenticated user possesses one of the required roles.
 */
export async function requireRole(
  ctx: QueryCtx | MutationCtx,
  allowedRoles: AllowedRole[]
): Promise<Doc<"users">> {
  const { user } = await getVerifiedUser(ctx);
  if (!allowedRoles.includes(user.role)) {
    throw new Error(`FORBIDDEN: Operation requires one of [${allowedRoles.join(", ")}], current role: ${user.role}`);
  }
  return user;
}
