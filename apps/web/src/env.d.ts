/// <reference path="../.astro/types.d.ts" />

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  GEMINI_API_KEY: string;
  /** Token for manual trigger & logs access. Set via `wrangler pages secret put TRIGGER_TOKEN`. */
  TRIGGER_TOKEN?: string;
  /** Worker URL for proxying trigger requests. Set via `wrangler pages secret put WORKER_URL`. */
  WORKER_URL?: string;
  /** API key for trusted internal workflows. Set via `wrangler pages secret put INTERNAL_API_KEY`. */
  INTERNAL_API_KEY?: string;
}

declare namespace App {
  interface Locals extends Runtime {}
}
