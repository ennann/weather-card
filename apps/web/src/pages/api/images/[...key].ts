export const prerender = false;

import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const { env } = context.locals.runtime;
  const key = context.params.key;

  if (!key) return new Response('Missing key', { status: 400 });

  const object = await env.BUCKET.get(key);

  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { headers });
}
