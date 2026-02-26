/**
 * HMAC-SHA256 signed image tokens.
 *
 * Tokens are of the form: `{expiry}.{hex-hmac}`
 * where expiry is a Unix timestamp (seconds) and the HMAC covers `${key}:${expiry}`.
 *
 * The secret is read from the IMAGE_SECRET environment variable.
 * When IMAGE_SECRET is not configured the helpers return a no-op result so that
 * local development still works without protection enabled.
 */

const DEFAULT_EXPIRY_SECONDS = 86_400; // 24 hours (public API)

/** Create a time-limited signed token for an R2 image key. */
export async function createToken(
  key: string,
  secret: string,
  expirySeconds = DEFAULT_EXPIRY_SECONDS,
): Promise<string> {
  const expiry = Math.floor(Date.now() / 1000) + expirySeconds;
  const sig = await hmacSign(`${key}:${expiry}`, secret);
  return `${expiry}.${sig}`;
}

/** Verify a signed token against an R2 image key. */
export async function verifyToken(
  key: string,
  token: string,
  secret: string,
): Promise<boolean> {
  try {
    const dot = token.indexOf('.');
    if (dot < 0) return false;

    const expiry = parseInt(token.slice(0, dot), 10);
    const sig = token.slice(dot + 1);

    if (!expiry || Date.now() / 1000 > expiry) return false;

    const expected = await hmacSign(`${key}:${expiry}`, secret);
    return timingSafeEqual(sig, expected);
  } catch {
    return false;
  }
}

async function hmacSign(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const buf = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Constant-time string comparison to prevent timing-based attacks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
