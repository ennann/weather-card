export const prerender = false;

import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const { env } = context.locals.runtime;
  const key = context.params.key;
  const url = new URL(context.request.url);

  if (!key) return new Response('Missing key', { status: 400 });

  // Trusted callers with INTERNAL_API_KEY bypass Referer checks.
  const internalKey: string = env.INTERNAL_API_KEY ?? '';
  const auth = context.request.headers.get('authorization') ?? '';
  const isTrusted = !!(internalKey && auth === `Bearer ${internalKey}`);

  if (!isTrusted) {
    // Hotlink protection: require a same-origin Referer header.
    // Requests without Referer (direct URL visits, curl, etc.) are blocked
    // to prevent enumeration and unauthorized downloads.
    const referer = context.request.headers.get('referer');
    if (!referer) {
      return new Response('Forbidden', { status: 403 });
    }
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
