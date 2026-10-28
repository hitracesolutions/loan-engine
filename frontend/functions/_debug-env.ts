export function onRequest({ env }: { env: Record<string, unknown> }): Response {
  const valueLength = (value: unknown) => (typeof value === 'string' ? value.length : null);
  return Response.json({
    jwtSigningKeyLength: valueLength(env.JWT_SIGNING_KEY),
    adminEmailLength: valueLength(env.ADMIN_EMAIL),
    adminPasswordLength: valueLength(env.ADMIN_PASSWORD),
  });
}
