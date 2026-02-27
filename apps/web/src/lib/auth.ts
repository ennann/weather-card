/**
 * Shared auth helpers for cookie-based authentication.
 *
 * Cookie: `auth_token` — HttpOnly, Secure, SameSite=Strict, 48h max-age.
 * The value is the ACCESS_CODE itself.
 */

const COOKIE_NAME = 'auth_token';
const MAX_AGE = 48 * 60 * 60; // 48 hours in seconds

export function getTokenFromCookie(request: Request): string {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

export function getTokenFromRequest(request: Request): string {
  // 1. Authorization header (for API callers)
  const auth = request.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  // 2. Cookie (for browser sessions)
  return getTokenFromCookie(request);
}

export function setAuthCookie(token: string): string {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}`;
}

export function clearAuthCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}
