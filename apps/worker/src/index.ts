// Weather Card Worker — card generation engine
import { GenerateCardWorkflow } from './workflow';

interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  GENERATE_CARD: Workflow;
  GEMINI_API_KEY: string;
  ACCESS_CODE: string;
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext) {
    const runId = String(Date.now());
    const instance = await env.GENERATE_CARD.create({
      id: runId,
      params: { runId },
    });
    console.log(`Workflow started: ${instance.id}`);
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Manual trigger: POST /trigger?city=杭州
    if (url.pathname === '/trigger' && request.method === 'POST') {
      const auth = request.headers.get('Authorization');
      if (!auth || auth !== `Bearer ${env.ACCESS_CODE}`) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      try {
        const city = url.searchParams.get('city') || undefined;
        const runId = String(Date.now());
        const instance = await env.GENERATE_CARD.create({
          id: runId,
          params: { runId, city },
        });
        return Response.json({ ok: true, instanceId: instance.id, runId, city });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return Response.json({ error: msg }, { status: 500 });
      }
    }

    return new Response(null, { status: 404 });
  },
};

export { GenerateCardWorkflow };
