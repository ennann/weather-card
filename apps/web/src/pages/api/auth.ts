export const prerender = false;

/**
 * POST /api/auth   — verify password, set auth cookie (48h)
 * DELETE /api/auth  — clear auth cookie (logout)
 */

import type { APIContext } from 'astro';
import { setAuthCookie, clearAuthCookie } from '../../lib/auth';

export async function POST(context: APIContext) {
  const token: string = context.locals.runtime.env.ACCESS_CODE ?? '';
  if (!token) return new Response('Not configured', { status: 503 });

  const body = await context.request.json().catch(() => null) as Record<string, unknown> | null;
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!password || password !== token) {
    return Response.json({ error: '密码错误' }, { status: 401 });
  }

  return Response.json({ ok: true }, {
    headers: { 'Set-Cookie': setAuthCookie(token) },
  });
}

export async function DELETE(_context: APIContext) {
  return Response.json({ ok: true }, {
    headers: { 'Set-Cookie': clearAuthCookie() },
  });
}
