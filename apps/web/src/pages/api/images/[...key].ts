export const prerender = false;

import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const { env } = context.locals.runtime;
  const key = context.params.key;
  const url = new URL(context.request.url);

  if (!key) return new Response('Missing key', { status: 400 });

  // Hotlink / Referer protection: if a Referer header is present it must come
  // from the same host. This stops other websites from embedding our images.
  const referer = context.request.headers.get('referer');
  if (referer) {
    try {
      if (new URL(referer).host !== url.host) {
        return new Response('Forbidden', { status: 403 });
      }
    } catch {
      return new Response('Forbidden', { status: 403 });
    }
  }

  const object = await env.BUCKET.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { headers });
}
