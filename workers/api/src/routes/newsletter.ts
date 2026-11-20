import { jsonResponse, errorResponse, badRequest } from '../lib/http.ts';
import type { RouteContext } from '../router.ts';

export async function subscribeNewsletter({ request, env, requestId }: RouteContext): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(badRequest('INVALID_JSON', 'Request body must be valid JSON'), requestId);
  }

  if (typeof body !== 'object' || body === null || !('email' in body)) {
    return errorResponse(badRequest('INVALID_EMAIL', 'Email address is required'), requestId);
  }

  const rawEmail = String((body as { email?: unknown }).email ?? '').trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!rawEmail || !emailRegex.test(rawEmail) || rawEmail.length > 254) {
    return errorResponse(badRequest('INVALID_EMAIL', 'Please provide a valid email address'), requestId);
  }

  const id = crypto.randomUUID();
  const source = 'landing_banner';

  try {
    await env.DB.prepare(
      `INSERT INTO newsletter_subscribers (id, email, source, status, created_at)
       VALUES (?, ?, ?, 'SUBSCRIBED', CURRENT_TIMESTAMP)
       ON CONFLICT(email) DO UPDATE SET status = 'SUBSCRIBED'`
    ).bind(id, rawEmail, source).run();

    return jsonResponse(
      {
        success: true,
        message: 'Successfully subscribed to Gidfine updates',
        email: rawEmail,
      },
      requestId,
      200,
    );
  } catch (error) {
    console.error('[NEWSLETTER] Subscription database error:', error);
    return jsonResponse(
      {
        success: true,
        message: 'Subscription received',
        email: rawEmail,
      },
      requestId,
      200,
    );
  }
}
