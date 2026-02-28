export const prerender = false;

/**
 * GET /api/logs
 *
 * Protected endpoint — requires Authorization: Bearer <ACCESS_CODE>.
 * Returns generation run history for the admin/logs page.
 */

import type { APIContext } from 'astro';
import { getTokenFromRequest } from '../../lib/auth';

export async function GET(context: APIContext) {
  const { env } = context.locals.runtime;

  // ── Authentication ───────────────────────────────────────────────────────
  const token: string = env.ACCESS_CODE ?? '';
  if (!token) {
    return new Response('Not configured', { status: 503 });
  }

  const provided = getTokenFromRequest(context.request);
  if (provided !== token) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Query parameters ─────────────────────────────────────────────────────
  const url = new URL(context.request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1') || 1);
  const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '30') || 30), 100);
  const offset = (page - 1) * limit;
  const status = url.searchParams.get('status');

  const FIELDS = `run_id, city, resolved_city_name, weather_date, weather_condition,
                  weather_icon, temp_min, temp_max, current_temp, model, image_r2_key,
                  status, error_message, duration_ms, created_at, updated_at`;

  let query = `SELECT ${FIELDS} FROM generation_runs`;
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

/**
 * DELETE /api/logs?run_id=...
 * Deletes a single generation run record.
 */
export async function DELETE(context: APIContext) {
  const { env } = context.locals.runtime;

  const token: string = env.ACCESS_CODE ?? '';
  if (!token) {
    return new Response('Not configured', { status: 503 });
  }

  const provided = getTokenFromRequest(context.request);
  if (provided !== token) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(context.request.url);
  const runId = url.searchParams.get('run_id');
  if (!runId) {
    return Response.json({ error: 'Missing run_id' }, { status: 400 });
  }

  await env.DB.prepare(`DELETE FROM generation_runs WHERE run_id = ?`).bind(runId).run();

  return Response.json({ ok: true });
}
