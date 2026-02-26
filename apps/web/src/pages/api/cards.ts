export const prerender = false;

import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const { env } = context.locals.runtime;
  const url = new URL(context.request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
  const offset = (page - 1) * limit;

  const { results } = await env.DB.prepare(
    `SELECT run_id, city, resolved_city_name, weather_date, weather_condition,
            weather_icon, temp_min, temp_max, current_temp, image_r2_key, created_at
     FROM generation_runs
     WHERE status = 'succeeded' AND image_r2_key IS NOT NULL
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();

  const { results: countResult } = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM generation_runs WHERE status = 'succeeded' AND image_r2_key IS NOT NULL`
  ).all();

  return Response.json({
    cards: results,
    total: (countResult[0] as any).total,
    page,
    limit,
  });
}
