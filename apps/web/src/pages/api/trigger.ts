export const prerender = false;

/**
 * POST /api/trigger?city=杭州
 *
 * Proxies the request to the Worker's /trigger endpoint.
 * Requires `?token=<ACCESS_CODE>` for authentication (used by the /create page).
 */

import type { APIContext } from 'astro';
import { getTokenFromRequest } from '../../lib/auth';

export async function POST(context: APIContext) {
  const { env } = context.locals.runtime;
  const token: string = env.ACCESS_CODE ?? '';
  const workerUrl: string = env.WORKER_URL ?? '';

  if (!token || !workerUrl) {
    return new Response('Not configured', { status: 503 });
  }

  // Validate token from cookie or Authorization header
  const provided = getTokenFromRequest(context.request);
  if (provided !== token) {
    return Response.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Forward city param to Worker
  const url = new URL(context.request.url);
  const city = url.searchParams.get('city') ?? '';
  const target = new URL('/trigger', workerUrl);
  if (city) target.searchParams.set('city', city);

  try {
    const resp = await fetch(target.toString(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    const body = await resp.text();
    return new Response(body, {
      status: resp.status,
      headers: { 'Content-Type': resp.headers.get('Content-Type') || 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: `Worker unreachable: ${msg}` }, { status: 502 });
  }
}
