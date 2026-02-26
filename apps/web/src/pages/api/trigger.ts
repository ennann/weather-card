export const prerender = false;

/**
 * POST /api/trigger?city=杭州
 *
 * Proxies the request to the Worker's /trigger endpoint.
 * Requires `?key=<TRIGGER_TOKEN>` for authentication (used by the /create page).
 */

import type { APIContext } from 'astro';

export async function POST(context: APIContext) {
  const { env } = context.locals.runtime;
  const token: string = env.TRIGGER_TOKEN ?? '';
  const workerUrl: string = env.WORKER_URL ?? '';

  if (!token || !workerUrl) {
    return new Response('Not configured', { status: 503 });
  }

  // Validate the key from query string
  const url = new URL(context.request.url);
  const key = url.searchParams.get('key') ?? '';
  if (key !== token) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Forward city param to Worker
  const city = url.searchParams.get('city') ?? '';
  const target = new URL('/trigger', workerUrl);
  if (city) target.searchParams.set('city', city);

  const resp = await fetch(target.toString(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await resp.text();
  return new Response(body, {
    status: resp.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
