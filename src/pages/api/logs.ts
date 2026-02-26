export const prerender = false;

import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const { env } = context.locals.runtime;
  const url = new URL(context.request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '30'), 100);
  const offset = (page - 1) * limit;
  const status = url.searchParams.get('status');

  let query = `SELECT * FROM generation_runs`;
  const binds: any[] = [];

  if (status) {
    query += ` WHERE status = ?`;
    binds.push(status);
  }

  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  binds.push(limit, offset);

  const { results } = await env.DB.prepare(query).bind(...binds).all();

  let countQuery = `SELECT COUNT(*) as total FROM generation_runs`;
  const countBinds: any[] = [];
  if (status) {
    countQuery += ` WHERE status = ?`;
    countBinds.push(status);
  }
  const { results: countResult } = await env.DB.prepare(countQuery).bind(...countBinds).all();

  return Response.json({
    logs: results,
    total: (countResult[0] as any).total,
    page,
    limit,
  });
}
