import { defineMiddleware } from 'astro:middleware';

/**
 * Per-IP rate limiting for all /api/* routes.
 *
 * Uses a module-level Map so the counter is shared within a single Worker
 * isolate.  Each Cloudflare isolate handles requests for ~30 s before being
 * recycled, which is enough to stop naive burst scrapers.
 *
 * Limits (requests per 60-second window):
 *   /api/cards  — 30   (≈ 600 cards/min; plenty for normal browsing)
 *   /api/images — 200  (images are fetched in batches on scroll)
 *   other /api/ — 60
 */

const WINDOW_MS = 60_000;

const ROUTE_LIMITS: Array<[string, number]> = [
  ['/api/cards', 30],
  ['/api/images', 200],
];
const DEFAULT_LIMIT = 60;

// ip:route-prefix → { count, resetAt }
const counters = new Map<string, { count: number; resetAt: number }>();

function getLimit(pathname: string): number {
  for (const [prefix, limit] of ROUTE_LIMITS) {
    if (pathname.startsWith(prefix)) return limit;
  }
  return DEFAULT_LIMIT;
}

function allowed(ip: string, pathname: string): boolean {
  // Bucket key: ip + the first two path segments (e.g. /api/cards)
  const bucket = pathname.split('/').slice(0, 3).join('/');
  const key = `${ip}|${bucket}`;
  const now = Date.now();
  const entry = counters.get(key);

  if (!entry || now > entry.resetAt) {
    counters.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= getLimit(pathname)) return false;
  entry.count++;
  return true;
}

// Periodically prune expired entries so the Map doesn't grow unbounded.
// Runs at most once per minute across the isolate lifetime.
let lastPrune = 0;
function maybePrune() {
  const now = Date.now();
  if (now - lastPrune < WINDOW_MS) return;
  lastPrune = now;
  for (const [key, entry] of counters) {
    if (now > entry.resetAt) counters.delete(key);
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = new URL(context.request.url);
  if (!pathname.startsWith('/api/')) return next();

  maybePrune();

  // Cloudflare sets CF-Connecting-IP; fall back to X-Forwarded-For for local dev.
  const ip =
    context.request.headers.get('cf-connecting-ip') ??
    context.request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    'local';

  if (!allowed(ip, pathname)) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': '60', 'Content-Type': 'text/plain' },
    });
  }

  return next();
});
