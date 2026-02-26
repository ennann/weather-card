# Cloudflare Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate WeatherCardXHS from a local Node.js CLI tool to a fully deployed Cloudflare stack: Astro Pages (frontend) + Worker (background jobs) + D1 (metadata) + R2 (images) + Workflow (async generation).

**Architecture:** Astro on Cloudflare Pages serves a React-powered image gallery and logs page, reading from D1 and R2 via API routes. A companion Worker runs a Cron-triggered Workflow that picks a city, fetches weather, calls Gemini to generate a card image, uploads to R2, and records the run in D1.

**Tech Stack:** Astro 5 + React 19 + Tailwind CSS 4 + @astrojs/cloudflare, Cloudflare Workers + Workflows + D1 + R2, TypeScript, @google/genai

---

## Project Structure (Target)

```
WeatherCardXHS/
├── src/                              # Astro frontend
│   ├── pages/
│   │   ├── index.astro               # Gallery page (image wall)
│   │   ├── logs.astro                # Logs page
│   │   └── api/
│   │       ├── cards.ts              # GET /api/cards - list cards
│   │       ├── images/[key].ts       # GET /api/images/:key - proxy R2 image
│   │       └── logs.ts              # GET /api/logs - generation logs
│   ├── components/
│   │   ├── Gallery.tsx               # React: masonry image grid
│   │   ├── LogsTable.tsx             # React: logs data table
│   │   └── Nav.tsx                   # React: navigation bar
│   ├── layouts/
│   │   └── Base.astro                # Base HTML layout
│   ├── lib/
│   │   └── types.ts                  # Shared TypeScript types
│   └── env.d.ts                      # Cloudflare binding types
├── worker/
│   ├── src/
│   │   ├── index.ts                  # Worker entry: scheduled handler
│   │   ├── workflow.ts               # GenerateCardWorkflow class
│   │   ├── weather.ts                # Weather fetching (ported)
│   │   ├── prompt.ts                 # Gemini prompt (ported)
│   │   └── cities.ts                 # City selection logic
│   ├── wrangler.jsonc                # Worker bindings config
│   └── tsconfig.json
├── migrations/
│   └── 0001_create_generation_runs.sql
├── data/
│   └── cities.json                   # 203 cities
├── wrangler.jsonc                    # Pages bindings config
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
└── package.json
```

---

## Task 1: Initialize Astro Project with Cloudflare Adapter

**Files:**
- Create: `astro.config.mjs`
- Create: `tailwind.config.mjs`
- Modify: `package.json`
- Modify: `tsconfig.json`
- Create: `src/env.d.ts`

**Step 1: Install dependencies**

```bash
# Remove old deps
yarn remove better-sqlite3 @types/better-sqlite3 node-cron @types/node-cron dotenv mime

# Install Astro + Cloudflare + React + Tailwind
yarn add astro @astrojs/cloudflare @astrojs/react @astrojs/tailwind react react-dom @google/genai
yarn add -D wrangler @cloudflare/workers-types @types/react @types/react-dom tailwindcss typescript
```

**Step 2: Write astro.config.mjs**

```javascript
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
      configPath: 'wrangler.jsonc',
    },
  }),
  integrations: [react(), tailwind()],
});
```

**Step 3: Write tailwind.config.mjs**

```javascript
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
};
```

**Step 4: Write src/env.d.ts**

```typescript
/// <reference path="../.astro/types.d.ts" />

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  GEMINI_API_KEY: string;
}

declare namespace App {
  interface Locals extends Runtime {}
}
```

**Step 5: Update package.json scripts**

Replace existing scripts with:
```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "astro": "astro",
    "db:migrate:local": "wrangler d1 migrations apply weather-cards-db --local",
    "db:migrate:remote": "wrangler d1 migrations apply weather-cards-db --remote",
    "worker:dev": "cd worker && wrangler dev",
    "worker:deploy": "cd worker && wrangler deploy"
  }
}
```

**Step 6: Update tsconfig.json**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "jsx": "react-jsx",
    "types": ["@cloudflare/workers-types/2023-07-01"]
  }
}
```

**Step 7: Remove old source files**

Delete: `src/generate-weather-card.ts`, `src/weather.ts`, `src/prompt.ts`, `src/storage.ts`, `src/daily-runner.ts`, `src/city-list.ts`

(Their logic will be ported to `worker/src/` and `src/lib/` in later tasks.)

**Step 8: Commit**

```bash
git add -A && git commit -m "feat: initialize Astro project with Cloudflare adapter, React, Tailwind"
```

---

## Task 2: Cloudflare Configs and D1 Migration

**Files:**
- Create: `wrangler.jsonc` (Pages)
- Create: `worker/wrangler.jsonc` (Worker)
- Create: `worker/tsconfig.json`
- Create: `migrations/0001_create_generation_runs.sql`

**Step 1: Write wrangler.jsonc (Pages)**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "weather-card-xhs",
  "pages_build_output_dir": "./dist",
  "compatibility_date": "2026-02-25",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "weather-cards-db",
      "database_id": "<REPLACE_AFTER_D1_CREATE>",
      "migrations_dir": "migrations"
    }
  ],
  "r2_buckets": [
    {
      "binding": "BUCKET",
      "bucket_name": "weather-card-images"
    }
  ],
  "vars": {
    "GEMINI_API_KEY": ""
  }
}
```

**Step 2: Write worker/wrangler.jsonc**

```jsonc
{
  "$schema": "../node_modules/wrangler/config-schema.json",
  "name": "weather-card-worker",
  "main": "src/index.ts",
  "compatibility_date": "2026-02-25",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "weather-cards-db",
      "database_id": "<REPLACE_AFTER_D1_CREATE>",
      "migrations_dir": "../migrations"
    }
  ],
  "r2_buckets": [
    {
      "binding": "BUCKET",
      "bucket_name": "weather-card-images"
    }
  ],
  "workflows": [
    {
      "name": "generate-card-workflow",
      "binding": "GENERATE_CARD",
      "class_name": "GenerateCardWorkflow"
    }
  ],
  "triggers": {
    "crons": ["0 1 * * *"]
  },
  "vars": {
    "GEMINI_API_KEY": "",
    "GEMINI_MODEL": "gemini-2.5-flash-preview-04-17"
  }
}
```

**Step 3: Write worker/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ESNext"],
    "types": ["@cloudflare/workers-types/2023-07-01"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

**Step 4: Write D1 migration**

`migrations/0001_create_generation_runs.sql`:

```sql
CREATE TABLE IF NOT EXISTS generation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  resolved_city_name TEXT,
  weather_date TEXT NOT NULL,
  weather_condition TEXT,
  weather_icon TEXT,
  temp_min REAL,
  temp_max REAL,
  current_temp REAL,
  model TEXT,
  image_r2_key TEXT,
  status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running', 'succeeded', 'failed')),
  error_message TEXT,
  duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_runs_city ON generation_runs(city);
CREATE INDEX idx_runs_date ON generation_runs(weather_date);
CREATE INDEX idx_runs_status ON generation_runs(status);
CREATE INDEX idx_runs_created ON generation_runs(created_at);
```

**Step 5: Apply migration locally**

```bash
wrangler d1 migrations apply weather-cards-db --local
```

Note: For remote, run `wrangler d1 create weather-cards-db` first to get the database_id, then update both wrangler.jsonc files, then `wrangler d1 migrations apply weather-cards-db --remote`.

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add wrangler configs and D1 migration schema"
```

---

## Task 3: Worker — Weather + Prompt + Cities (Port Existing Logic)

**Files:**
- Create: `worker/src/weather.ts`
- Create: `worker/src/prompt.ts`
- Create: `worker/src/cities.ts`

**Step 1: Write worker/src/cities.ts**

Port the city selection logic. Reads from embedded city list (no filesystem in Workers).

```typescript
import citiesData from '../../data/cities.json';

export function pickRandomCity(): string {
  const cities = citiesData.cities;
  return cities[Math.floor(Math.random() * cities.length)];
}
```

Note: cities.json will be bundled by wrangler at build time. If import doesn't work with JSON, inline the list or use a different approach.

**Step 2: Write worker/src/weather.ts**

Port from existing `src/weather.ts`. Remove Node.js-specific code, use standard `fetch()`. Keep the same interfaces: `WeatherInfo`, `resolveCity()`, `fetchWeather()`, `getCurrentWeather()`, `mapWeatherCodeToText()`.

Key changes from original:
- Remove `dotenv` dependency
- All `fetch()` calls are native (Workers have built-in fetch)
- Keep same return types

**Step 3: Write worker/src/prompt.ts**

Port from existing `src/prompt.ts`. No changes needed — it's pure string template with no Node.js dependencies.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: port weather, prompt, cities logic to worker"
```

---

## Task 4: Worker — Workflow + Scheduled Handler

**Files:**
- Create: `worker/src/workflow.ts`
- Create: `worker/src/index.ts`

**Step 1: Write worker/src/workflow.ts**

```typescript
import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { GoogleGenAI } from '@google/genai';
import { getCurrentWeather, WeatherInfo } from './weather';
import { buildPrompt } from './prompt';
import { pickRandomCity } from './cities';

interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  GEMINI_API_KEY: string;
  GEMINI_MODEL: string;
}

interface GenerateParams {
  city?: string;
}

export class GenerateCardWorkflow extends WorkflowEntrypoint<Env, GenerateParams> {
  async run(event: WorkflowEvent<GenerateParams>, step: WorkflowStep) {
    const runId = event.id;
    const startTime = Date.now();
    const city = event.payload.city || pickRandomCity();

    // Step 1: Record run start
    await step.do('record-start', async () => {
      await this.env.DB.prepare(
        `INSERT INTO generation_runs (run_id, city, weather_date, status, created_at, updated_at)
         VALUES (?, ?, date('now'), 'running', datetime('now'), datetime('now'))`
      ).bind(runId, city).run();
    });

    // Step 2: Fetch weather
    const weather = await step.do('fetch-weather', {
      retries: { limit: 2, delay: '5 seconds', backoff: 'linear' },
    }, async () => {
      return await getCurrentWeather(city);
    });

    // Step 3: Update weather data in DB
    await step.do('update-weather', async () => {
      await this.env.DB.prepare(
        `UPDATE generation_runs SET
           resolved_city_name = ?, weather_condition = ?, weather_icon = ?,
           temp_min = ?, temp_max = ?, current_temp = ?, updated_at = datetime('now')
         WHERE run_id = ?`
      ).bind(
        weather.resolvedCityName, weather.conditionText, weather.conditionIcon,
        weather.tempMin, weather.tempMax, weather.currentTemp, runId
      ).run();
    });

    // Step 4: Generate image with Gemini
    const imageData = await step.do('generate-image', {
      retries: { limit: 1, delay: '10 seconds', backoff: 'linear' },
    }, async () => {
      const model = this.env.GEMINI_MODEL || 'gemini-2.5-flash-preview-04-17';
      const prompt = buildPrompt(city, weather);
      const ai = new GoogleGenAI({ apiKey: this.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseModalities: ['IMAGE', 'TEXT'],
          responseMimeType: 'image/png',
        },
      });
      // Extract image bytes from response
      const part = response.candidates?.[0]?.content?.parts?.find(
        (p: any) => p.inlineData
      );
      if (!part?.inlineData?.data) throw new Error('No image in Gemini response');
      return {
        base64: part.inlineData.data,
        mimeType: part.inlineData.mimeType || 'image/png',
        model,
      };
    });

    // Step 5: Upload to R2
    const r2Key = await step.do('upload-r2', async () => {
      const date = new Date().toISOString().split('T')[0];
      const key = `cards/${date}/${runId}.png`;
      const bytes = Uint8Array.from(atob(imageData.base64), c => c.charCodeAt(0));
      await this.env.BUCKET.put(key, bytes, {
        httpMetadata: { contentType: imageData.mimeType },
      });
      return key;
    });

    // Step 6: Mark success
    const durationMs = Date.now() - startTime;
    await step.do('record-success', async () => {
      await this.env.DB.prepare(
        `UPDATE generation_runs SET
           image_r2_key = ?, model = ?, status = 'succeeded',
           duration_ms = ?, updated_at = datetime('now')
         WHERE run_id = ?`
      ).bind(r2Key, imageData.model, durationMs, runId).run();
    });
  }
}
```

**Step 2: Write worker/src/index.ts**

```typescript
import { GenerateCardWorkflow } from './workflow';

interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  GENERATE_CARD: Workflow;
  GEMINI_API_KEY: string;
}

export default {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    const instance = await env.GENERATE_CARD.create({
      id: `cron-${Date.now()}`,
      params: {},
    });
    console.log(`Workflow started: ${instance.id}`);
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Manual trigger: POST /trigger?city=杭州
    if (url.pathname === '/trigger' && request.method === 'POST') {
      const city = url.searchParams.get('city') || undefined;
      const instance = await env.GENERATE_CARD.create({
        id: `manual-${Date.now()}`,
        params: { city },
      });
      return Response.json({ id: instance.id, status: 'started' });
    }

    return new Response('Weather Card Worker', { status: 200 });
  },
};

export { GenerateCardWorkflow };
```

**Step 3: Verify worker builds**

```bash
cd worker && npx wrangler dev --test-scheduled
```

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add Workflow and scheduled handler for card generation"
```

---

## Task 5: Shared Types + Astro API Routes

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/pages/api/cards.ts`
- Create: `src/pages/api/images/[key].ts`
- Create: `src/pages/api/logs.ts`

**Step 1: Write src/lib/types.ts**

```typescript
export interface GenerationRun {
  id: number;
  run_id: string;
  city: string;
  resolved_city_name: string | null;
  weather_date: string;
  weather_condition: string | null;
  weather_icon: string | null;
  temp_min: number | null;
  temp_max: number | null;
  current_temp: number | null;
  model: string | null;
  image_r2_key: string | null;
  status: 'running' | 'succeeded' | 'failed';
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
}
```

**Step 2: Write src/pages/api/cards.ts**

```typescript
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
```

**Step 3: Write src/pages/api/images/[key].ts**

```typescript
export const prerender = false;

import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const { env } = context.locals.runtime;
  const key = context.params.key;

  if (!key) return new Response('Missing key', { status: 400 });

  // key comes URL-encoded, decode it: "cards/2026-02-26/cron-123.png"
  const r2Key = decodeURIComponent(key);
  const object = await env.BUCKET.get(r2Key);

  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { headers });
}
```

**Step 4: Write src/pages/api/logs.ts**

```typescript
export const prerender = false;

import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const { env } = context.locals.runtime;
  const url = new URL(context.request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '30'), 100);
  const offset = (page - 1) * limit;
  const status = url.searchParams.get('status'); // filter by status

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
```

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add API routes for cards, images, and logs"
```

---

## Task 6: Base Layout + Navigation Component

**Files:**
- Create: `src/layouts/Base.astro`
- Create: `src/components/Nav.tsx`

**Step 1: Write src/layouts/Base.astro**

```astro
---
interface Props {
  title?: string;
}
const { title = 'Weather Cards' } = Astro.props;
---
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title}</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body class="min-h-screen bg-neutral-950 text-neutral-100">
    <nav class="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <a href="/" class="text-lg font-semibold tracking-tight">Weather Cards</a>
        <div class="flex gap-6 text-sm text-neutral-400">
          <a href="/" class="hover:text-neutral-100 transition-colors">Gallery</a>
          <a href="/logs" class="hover:text-neutral-100 transition-colors">Logs</a>
        </div>
      </div>
    </nav>
    <main class="mx-auto max-w-7xl px-4 py-8">
      <slot />
    </main>
  </body>
</html>
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: add base layout with navigation"
```

---

## Task 7: Gallery Page + React Component

**Files:**
- Create: `src/components/Gallery.tsx`
- Create: `src/pages/index.astro`

**Step 1: Write src/components/Gallery.tsx**

React island for the masonry image grid with infinite scroll.

Key features:
- Fetches `/api/cards?page=N` on mount and scroll
- Displays cards in a responsive masonry-style CSS columns layout
- Each card shows: image, city name, weather icon, temp, date
- Click card to view full image
- Loading skeleton while fetching

Implementation: ~120 lines of React. Uses `useState`, `useEffect`, `useCallback` for pagination. CSS columns for masonry layout. IntersectionObserver for infinite scroll.

**Step 2: Write src/pages/index.astro**

```astro
---
export const prerender = false;
import Base from '../layouts/Base.astro';
import Gallery from '../components/Gallery';
---
<Base title="Weather Cards - Gallery">
  <Gallery client:load />
</Base>
```

**Step 3: Verify locally**

```bash
yarn dev
# Open http://localhost:4321
```

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add gallery page with masonry image grid"
```

---

## Task 8: Logs Page + React Component

**Files:**
- Create: `src/components/LogsTable.tsx`
- Create: `src/pages/logs.astro`

**Step 1: Write src/components/LogsTable.tsx**

React island for the logs data table.

Key features:
- Fetches `/api/logs?page=N&status=X`
- Table columns: time, city, weather, temp, status (badge), duration, image thumbnail
- Status filter tabs: All / Succeeded / Failed / Running
- Pagination controls
- Status badges: green=succeeded, red=failed, yellow=running
- Click row to see error message (if failed)
- Duration formatted as "12.3s"

Implementation: ~150 lines of React.

**Step 2: Write src/pages/logs.astro**

```astro
---
export const prerender = false;
import Base from '../layouts/Base.astro';
import LogsTable from '../components/LogsTable';
---
<Base title="Weather Cards - Logs">
  <h1 class="mb-6 text-2xl font-semibold">Generation Logs</h1>
  <LogsTable client:load />
</Base>
```

**Step 3: Verify locally**

```bash
yarn dev
# Open http://localhost:4321/logs
```

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add logs page with filterable data table"
```

---

## Task 9: Cleanup + Tailwind Global Styles + Static Assets

**Files:**
- Create: `src/styles/global.css`
- Create: `public/favicon.svg`
- Remove: `src/generate-weather-card.ts`, `src/weather.ts`, `src/prompt.ts`, `src/storage.ts`, `src/daily-runner.ts`, `src/city-list.ts` (if not already removed in Task 1)
- Modify: `.env.example`

**Step 1: Write src/styles/global.css**

```css
@import 'tailwindcss';
```

Import this in `Base.astro`.

**Step 2: Update .env.example**

```
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash-preview-04-17
```

**Step 3: Clean up old files**

Remove any remaining old source files that haven't been removed yet.

**Step 4: Commit**

```bash
git add -A && git commit -m "chore: cleanup old CLI files, add global styles"
```

---

## Task 10: Local Dev Setup + launch.json + Verify End-to-End

**Files:**
- Create: `.claude/launch.json`
- Modify: `wrangler.jsonc` (set local D1 database_id if needed)

**Step 1: Write .claude/launch.json**

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "astro-dev",
      "runtimeExecutable": "yarn",
      "runtimeArgs": ["dev"],
      "port": 4321
    }
  ]
}
```

**Step 2: Apply D1 migration locally**

```bash
npx wrangler d1 migrations apply weather-cards-db --local
```

**Step 3: Verify full flow**

1. Start Astro dev server
2. Open http://localhost:4321 — gallery page loads (empty, no cards yet)
3. Open http://localhost:4321/logs — logs page loads (empty)
4. Hit API: `curl http://localhost:4321/api/cards` — returns `{"cards":[],"total":0,...}`
5. Hit API: `curl http://localhost:4321/api/logs` — returns `{"logs":[],"total":0,...}`

**Step 4: Commit**

```bash
git add -A && git commit -m "chore: add launch.json, verify local dev setup"
```

---

## Task 11: First Remote Deploy

This task is manual guidance, not automated steps.

**Step 1: Create Cloudflare resources**

```bash
# Create D1 database
npx wrangler d1 create weather-cards-db
# → Copy the database_id to both wrangler.jsonc files

# Create R2 bucket
npx wrangler r2 bucket create weather-card-images
```

**Step 2: Set secrets**

```bash
# For Pages
npx wrangler pages secret put GEMINI_API_KEY

# For Worker
cd worker && npx wrangler secret put GEMINI_API_KEY
cd worker && npx wrangler secret put GEMINI_MODEL
```

**Step 3: Apply migration remotely**

```bash
npx wrangler d1 migrations apply weather-cards-db --remote
```

**Step 4: Deploy Pages**

```bash
yarn build && npx wrangler pages deploy dist
```

**Step 5: Deploy Worker**

```bash
cd worker && npx wrangler deploy
```

**Step 6: Test Cron manually**

```bash
curl -X POST https://weather-card-worker.<account>.workers.dev/trigger
```

**Step 7: Commit config updates**

```bash
git add -A && git commit -m "chore: update database_id for production D1"
```

---

## Execution Order Summary

| # | Task | Depends On |
|---|------|------------|
| 1 | Initialize Astro project | — |
| 2 | Wrangler configs + D1 migration | 1 |
| 3 | Worker: weather + prompt + cities | 2 |
| 4 | Worker: Workflow + scheduled handler | 3 |
| 5 | Shared types + API routes | 2 |
| 6 | Base layout + navigation | 1 |
| 7 | Gallery page + component | 5, 6 |
| 8 | Logs page + component | 5, 6 |
| 9 | Cleanup + styles | 1 |
| 10 | Local dev verify | 1–9 |
| 11 | Remote deploy | 10 |

Tasks 3–4 (Worker) and Tasks 5–8 (Frontend) can be parallelized.
