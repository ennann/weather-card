export const prerender = false;

/**
 * Internal API — trusted access for first-party workflows.
 *
 * GET /api/internal/cards
 *
 * Authentication (required):
 *   Authorization: Bearer <INTERNAL_API_KEY>
 *
 * Query parameters:
 *   date   — filter by weather_date, format YYYY-MM-DD (optional)
 *   limit  — max results, default 100, max 500 (optional)
 *
 * Response:
 *   {
 *     date:  string | null,
 *     total: number,
 *     cards: Array<{
 *       run_id, city, resolved_city_name, weather_date,
 *       weather_condition, weather_icon, temp_min, temp_max,
 *       current_temp, image_r2_key, created_at,
 *       image_url: string,  // absolute Worker URL ready to download
 *     }>
 *   }
 */

import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const { env } = context.locals.runtime;

  // ── Authentication ───────────────────────────────────────────────────────
  const apiKey: string = env.INTERNAL_API_KEY ?? '';
  if (!apiKey) {
    // If no key is configured the endpoint is disabled entirely.
    return new Response('Not Found', { status: 404 });
  }

  const auth = context.request.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${apiKey}`) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Bearer realm="weather-card-internal"' },
    });
  }

  // ── Query parameters ─────────────────────────────────────────────────────
  const url = new URL(context.request.url);
  const date = url.searchParams.get('date') ?? null;           // YYYY-MM-DD
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10), 500);

  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response('Invalid date format, expected YYYY-MM-DD', { status: 400 });
  }

  // ── Database query ───────────────────────────────────────────────────────
  const baseQuery = `
    SELECT run_id, city, resolved_city_name, weather_date, weather_condition,
           weather_icon, temp_min, temp_max, current_temp, image_r2_key, created_at
    FROM generation_runs
    WHERE status = 'succeeded' AND image_r2_key IS NOT NULL
  `;

  const { results } = date
    ? await env.DB.prepare(`${baseQuery} AND weather_date = ? ORDER BY created_at DESC LIMIT ?`)
        .bind(date, limit)
        .all()
    : await env.DB.prepare(`${baseQuery} ORDER BY created_at DESC LIMIT ?`)
        .bind(limit)
        .all();

  // ── Build response ────────────────────────────────────────────────────────
  const origin = url.origin;
  const cards = (results as any[]).map((row) => ({
    ...row,
    image_url: `${origin}/api/images/${row.image_r2_key}`,
  }));

  return Response.json({ date, total: cards.length, cards });
}
