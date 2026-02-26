// Weather Card Worker — card generation engine
import { GenerateCardWorkflow } from './workflow';

interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  GENERATE_CARD: Workflow;
  GEMINI_API_KEY: string;
  TRIGGER_TOKEN: string;
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext) {
    const runId = `run-${Date.now()}`;
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
      if (!auth || auth !== `Bearer ${env.TRIGGER_TOKEN}`) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const city = url.searchParams.get('city') || undefined;
      const runId = `manual-${Date.now()}`;
      const instance = await env.GENERATE_CARD.create({
        id: runId,
        params: { runId, city },
      });
      return Response.json({ ok: true, instanceId: instance.id, runId, city });
    }

    return new Response('Weather Card Worker', { status: 200 });
  },
};

export { GenerateCardWorkflow };
