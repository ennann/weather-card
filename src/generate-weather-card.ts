import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import mime from 'mime';
import { GoogleGenAI } from '@google/genai';
import { loadCityList } from './city-list.js';
import { buildWeatherPrompt } from './prompt.js';
import { getDatabasePath, markRunFailed, markRunSuccess, startRun } from './storage.js';
import { getCurrentWeather } from './weather.js';

loadEnv();

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'outputs');

export interface GenerateResult {
  runId: string;
  city: string;
  outputImagePath: string;
  outputTextPath: string;
  outputMetaPath: string;
  databasePath: string;
}

function pickRandomCity(cities: string[]): string {
  if (cities.length === 0) {
    throw new Error('城市列表为空');
  }
  const index = crypto.randomInt(0, cities.length);
  return cities[index];
}

function cleanFileName(value: string): string {
  return value.replace(/[^\p{Letter}\p{Number}]+/gu, '_').replace(/^_+|_+$/g, '');
}

export async function runGeneration(targetCity?: string): Promise<GenerateResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('缺少 GEMINI_API_KEY，请先在 .env 中配置');
  }

  const cities = await loadCityList();
  const city = targetCity ?? pickRandomCity(cities);
  const model = process.env.GEMINI_MODEL ?? 'gemini-3-pro-image-preview';
  const runId = crypto.randomUUID();
  startRun({ runId, city, model });

  try {
    const weather = await getCurrentWeather(city);
    const prompt = buildWeatherPrompt(weather);

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContentStream({
      model,
      config: {
        responseModalities: ['IMAGE', 'TEXT'],
        imageConfig: {
          aspectRatio: '9:16',
          imageSize: '4K'
        },
        tools: [{ googleSearch: {} }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ]
    });

    const dayFolder = weather.date;
    const now = new Date();
    const timeStamp = now.toISOString().replace(/[:.]/g, '-');
    const safeCity = cleanFileName(city);
    const outputDir = path.join(OUTPUT_DIR, dayFolder);
    await mkdir(outputDir, { recursive: true });

    let imagePath = '';
    let imageIndex = 0;
    const textParts: string[] = [];

    for await (const chunk of response) {
      if (chunk.text) {
        textParts.push(chunk.text);
      }

      const parts = chunk.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        const inline = part.inlineData;
        if (!inline?.data) continue;

        const extension = mime.getExtension(inline.mimeType ?? '') || 'png';
        const fileBase = `${timeStamp}_${safeCity}_${imageIndex}`;
        const filePath = path.join(outputDir, `${fileBase}.${extension}`);
        const buffer = Buffer.from(inline.data, 'base64');
        await writeFile(filePath, buffer);
        imagePath = filePath;
        imageIndex += 1;
      }
    }

    if (!imagePath) {
      throw new Error('Gemini 响应中未拿到图片数据');
    }

    const baseName = path.basename(imagePath, path.extname(imagePath));
    const textPath = path.join(outputDir, `${baseName}.txt`);
    const metaPath = path.join(outputDir, `${baseName}.json`);

    await writeFile(textPath, textParts.join('\n').trim(), 'utf8');
    await writeFile(
      metaPath,
      JSON.stringify(
        {
          runId,
          city,
          weather,
          model,
          generatedAt: now.toISOString(),
          prompt,
          imagePath,
          textPath
        },
        null,
        2
      ),
      'utf8'
    );

    markRunSuccess({
      runId,
      weather,
      prompt,
      imagePath,
      textPath,
      metaPath
    });

    return {
      runId,
      city,
      outputImagePath: imagePath,
      outputTextPath: textPath,
      outputMetaPath: metaPath,
      databasePath: getDatabasePath()
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    try {
      markRunFailed(runId, errorMessage);
    } catch (dbError) {
      console.error('[storage] 写入失败状态失败:', dbError);
    }
    throw error;
  }
}

async function main(): Promise<void> {
  const cityArg = process.argv.find((arg) => arg.startsWith('--city='));
  const explicitCity = cityArg ? cityArg.slice('--city='.length) : undefined;
  const result = await runGeneration(explicitCity);
  console.log(`[done] runId: ${result.runId}`);
  console.log(`[done] 城市: ${result.city}`);
  console.log(`[done] 图片: ${result.outputImagePath}`);
  console.log(`[done] 文本: ${result.outputTextPath}`);
  console.log(`[done] 元数据: ${result.outputMetaPath}`);
  console.log(`[done] SQLite: ${result.databasePath}`);
}

const shouldRunDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (shouldRunDirectly) {
  main().catch((error: unknown) => {
    console.error('[generate] 执行失败:', error);
    process.exitCode = 1;
  });
}
