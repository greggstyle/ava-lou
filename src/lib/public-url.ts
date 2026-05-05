/**
 * Signed URL helpers for public document views (/voir/facture/[id], /voir/devis/[id]
 * and the corresponding ?public=1 PDF endpoints).
 *
 * Why: the audit flagged UUID-only public URLs as P0 — anyone who obtains a
 * UUID (forwarded link, leaked screenshot, browser history, server logs)
 * could read the full client + line items + IBAN. We add a short HMAC token
 * tied to the resource id so leaked UUIDs alone are not enough.
 *
 * Backward compatibility: when NEXT_PUBLIC_PUBLIC_URL_REQUIRE_TOKEN is set
 * to 'true' we reject URLs without a valid token. Otherwise (default during
 * the rollout window) we accept missing tokens but log a warning, so existing
 * email links don't suddenly 404. Flip the env var once all sent links have
 * been regenerated.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

function getSecret(): string | null {
  // Reuse SUPABASE_SECRET_KEY as a seed — already required server-side, never
  // exposed to client. Wrapped through HMAC so we never expose it directly.
  // PUBLIC_URL_SECRET takes precedence if set so users can rotate independently.
  return process.env.PUBLIC_URL_SECRET || process.env.SUPABASE_SECRET_KEY || null;
}

/**
 * Generate an HMAC token for (kind, id). Short-form base64url so URLs stay
 * short and copy-pasteable. No expiry — the artisan often forwards an invoice
 * link they sent months ago, and clients legitimately reopen old links.
 * Revocation = rotate PUBLIC_URL_SECRET.
 */
export function signPublicId(kind: 'facture' | 'devis', id: string): string {
  const secret = getSecret();
  if (!secret) return '';
  const h = createHmac('sha256', secret);
  h.update(`${kind}:${id}`);
  // 16 bytes = 128 bits, plenty unguessable; base64url for URL safety
  return h.digest('base64url').slice(0, 22);
}

/**
 * Verify a token. Returns:
 *   - 'ok' when token matches
 *   - 'missing' when no token was provided
 *   - 'invalid' when a token was provided but doesn't match
 *
 * The /voir page handles 'missing' based on the env flag (accept during
 * rollout, reject afterward) and always rejects 'invalid'.
 */
export function verifyPublicId(
  kind: 'facture' | 'devis',
  id: string,
  token: string | null | undefined,
): 'ok' | 'missing' | 'invalid' {
  if (!token) return 'missing';
  const expected = signPublicId(kind, id);
  if (!expected) return 'missing'; // no secret configured — fail open
  // Constant-time comparison
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  if (a.length !== b.length) return 'invalid';
  return timingSafeEqual(a, b) ? 'ok' : 'invalid';
}

/**
 * Whether the deployment enforces tokens strictly. False during rollout so
 * old links keep working; flip to true once you've reissued all live links.
 */
export function publicUrlRequiresToken(): boolean {
  return process.env.NEXT_PUBLIC_PUBLIC_URL_REQUIRE_TOKEN === 'true';
}

/** Build a fully-signed public URL given a base origin. */
export function buildPublicUrl(
  origin: string,
  kind: 'facture' | 'devis',
  id: string,
): string {
  const t = signPublicId(kind, id);
  return t
    ? `${origin}/voir/${kind}/${id}?t=${t}`
    : `${origin}/voir/${kind}/${id}`;
}
