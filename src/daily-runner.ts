import { config as loadEnv } from 'dotenv';
import cron from 'node-cron';
import { runGeneration } from './generate-weather-card.js';

loadEnv();

const cronExpr = process.env.DAILY_CRON ?? '0 8 * * *';
const timezone = process.env.TIMEZONE ?? 'Asia/Shanghai';
const runOnStart = process.env.RUN_ON_START === 'true';

async function runTask(): Promise<void> {
  const start = new Date();
  console.log(`[daily] 开始执行: ${start.toISOString()}`);
  try {
    const result = await runGeneration();
    console.log(`[daily] 完成: ${result.outputImagePath}`);
    console.log(`[daily] runId: ${result.runId}`);
    console.log(`[daily] SQLite: ${result.databasePath}`);
  } catch (error) {
    console.error('[daily] 失败:', error);
  }
}

console.log(`[daily] cron: ${cronExpr}`);
console.log(`[daily] timezone: ${timezone}`);
console.log(`[daily] runOnStart: ${runOnStart}`);

cron.schedule(
  cronExpr,
  () => {
    runTask().catch((error) => {
      console.error('[daily] 未处理异常:', error);
    });
  },
  { timezone }
);

if (runOnStart) {
  runTask().catch((error) => {
    console.error('[daily] 启动执行失败:', error);
  });
}
