/// <reference path="../.astro/types.d.ts" />

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  GEMINI_API_KEY: string;
  /** HMAC secret for signed image tokens. Set via `wrangler secret put IMAGE_SECRET`. */
  IMAGE_SECRET?: string;
}

declare namespace App {
  interface Locals extends Runtime {}
}
