import { GenerateCardWorkflow } from './workflow';

interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  GENERATE_CARD: Workflow;
  GEMINI_API_KEY: string;
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext) {
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
