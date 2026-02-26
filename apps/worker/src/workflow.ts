import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { GoogleGenAI } from '@google/genai';
import { getCurrentWeather } from './weather';
import { buildPrompt } from './prompt';
import { pickRandomCity, getCitySlug } from './cities';

interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  GEMINI_API_KEY: string;
  GEMINI_MODEL: string;
}

interface GenerateParams {
  runId: string;
  city?: string;
}

export class GenerateCardWorkflow extends WorkflowEntrypoint<Env, GenerateParams> {
  async run(event: WorkflowEvent<GenerateParams>, step: WorkflowStep) {
    const runId = event.payload.runId;
    const startTime = Date.now();
    const city = event.payload.city || pickRandomCity();

    // Step 1: Record run start
    await step.do('record-start', async () => {
      await this.env.DB.prepare(
        `INSERT INTO generation_runs (run_id, city, weather_date, status, created_at, updated_at)
         VALUES (?, ?, date('now'), 'running', datetime('now'), datetime('now'))`
      ).bind(runId, city).run();
    });

    try {
      // Step 2: Fetch weather (best-effort)
      const weather = await step.do('fetch-weather', async () => {
        try {
          return await getCurrentWeather(city);
        } catch (e) {
          console.log(`Weather fetch failed for ${city}: ${e}`);
          return null;
        }
      });

      // Step 3: Update weather data if available
      if (weather) {
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
      }

      // Step 4: Generate image with Gemini + Google Search
      const imageResult = await step.do('generate-image', {
        retries: { limit: 1, delay: '10 seconds', backoff: 'linear' },
      }, async () => {
        const model = this.env.GEMINI_MODEL || 'gemini-3-pro-image-preview';
        const prompt = buildPrompt(city);
        const ai = new GoogleGenAI({ apiKey: this.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            responseModalities: ['IMAGE', 'TEXT'],
            tools: [{ googleSearch: {} }],
          },
        });

        const parts = response.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find((p: any) => p.inlineData);
        if (!imagePart?.inlineData?.data) throw new Error('No image in Gemini response');

        return {
          base64: imagePart.inlineData.data,
          mimeType: imagePart.inlineData.mimeType || 'image/png',
          model,
        };
      });

      // Step 5: Upload to R2
      const r2Key = await step.do('upload-r2', async () => {
        const date = new Date().toISOString().split('T')[0];
        const slug = getCitySlug(city);
        const key = `cards/${date}-${slug}-${runId}.png`;
        const bytes = Uint8Array.from(atob(imageResult.base64), (c) => c.charCodeAt(0));
        await this.env.BUCKET.put(key, bytes, {
          httpMetadata: { contentType: imageResult.mimeType },
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
        ).bind(r2Key, imageResult.model, durationMs, runId).run();
      });
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      await step.do('record-failure', async () => {
        await this.env.DB.prepare(
          `UPDATE generation_runs SET
             status = 'failed', error_message = ?,
             duration_ms = ?, updated_at = datetime('now')
           WHERE run_id = ?`
        ).bind(errorMessage, durationMs, runId).run();
      });
      throw error;
    }
  }
}
