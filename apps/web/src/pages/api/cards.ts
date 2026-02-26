export const prerender = false;

import type { APIContext } from 'astro';
import { createToken } from '../../lib/imageToken';

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

  // Attach a signed, time-limited token to each image key so the image
  // endpoint can verify that the URL was issued by this server.
  const secret: string = env.IMAGE_SECRET ?? '';
  const cards = await Promise.all(
    (results as any[]).map(async (row) => {
      if (row.image_r2_key && secret) {
        return { ...row, image_token: await createToken(row.image_r2_key, secret) };
      }
      return row;
    }),
  );

  return Response.json({
    cards,
    total: (countResult[0] as any).total,
    page,
    limit,
  });
}
