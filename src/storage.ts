import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import type { WeatherInfo } from './weather.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DB_PATH = path.join(ROOT_DIR, 'data', 'weather-cards.sqlite');

let dbInstance: Database.Database | null = null;

export interface RunContext {
  runId: string;
  city: string;
  model: string;
}

export interface RunSuccessPayload {
  runId: string;
  weather: WeatherInfo;
  prompt: string;
  imagePath: string;
  textPath: string;
  metaPath: string;
}

function resolveDbPath(): string {
  const envPath = process.env.SQLITE_PATH?.trim();
  if (!envPath) return DEFAULT_DB_PATH;
  if (path.isAbsolute(envPath)) return envPath;
  return path.join(ROOT_DIR, envPath);
}

function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dbPath = resolveDbPath();
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.exec(`
    CREATE TABLE IF NOT EXISTS generation_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL UNIQUE,
      city TEXT NOT NULL,
      resolved_city_name TEXT,
      weather_date TEXT,
      weather_condition TEXT,
      temp_min INTEGER,
      temp_max INTEGER,
      current_temp INTEGER,
      model TEXT NOT NULL,
      prompt TEXT,
      image_path TEXT,
      text_path TEXT,
      meta_path TEXT,
      status TEXT NOT NULL,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_generation_runs_city ON generation_runs(city);
    CREATE INDEX IF NOT EXISTS idx_generation_runs_weather_date ON generation_runs(weather_date);
    CREATE INDEX IF NOT EXISTS idx_generation_runs_status ON generation_runs(status);
    CREATE INDEX IF NOT EXISTS idx_generation_runs_created_at ON generation_runs(created_at);
  `);

  dbInstance = db;
  return dbInstance;
}

export function getDatabasePath(): string {
  return resolveDbPath();
}

export function startRun(context: RunContext): void {
  const now = new Date().toISOString();
  const db = getDb();
  db.prepare(
    `
      INSERT INTO generation_runs (
        run_id, city, model, status, created_at, updated_at
      ) VALUES (
        @runId, @city, @model, 'running', @now, @now
      )
    `
  ).run({
    runId: context.runId,
    city: context.city,
    model: context.model,
    now
  });
}

export function markRunSuccess(payload: RunSuccessPayload): void {
  const now = new Date().toISOString();
  const db = getDb();
  db.prepare(
    `
      UPDATE generation_runs
      SET
        resolved_city_name = @resolvedCityName,
        weather_date = @weatherDate,
        weather_condition = @weatherCondition,
        temp_min = @tempMin,
        temp_max = @tempMax,
        current_temp = @currentTemp,
        prompt = @prompt,
        image_path = @imagePath,
        text_path = @textPath,
        meta_path = @metaPath,
        status = 'succeeded',
        error_message = NULL,
        updated_at = @now
      WHERE run_id = @runId
    `
  ).run({
    runId: payload.runId,
    resolvedCityName: payload.weather.resolvedCityName,
    weatherDate: payload.weather.date,
    weatherCondition: payload.weather.conditionText,
    tempMin: payload.weather.tempMin,
    tempMax: payload.weather.tempMax,
    currentTemp: payload.weather.currentTemp,
    prompt: payload.prompt,
    imagePath: payload.imagePath,
    textPath: payload.textPath,
    metaPath: payload.metaPath,
    now
  });
}

export function markRunFailed(runId: string, errorMessage: string): void {
  const now = new Date().toISOString();
  const db = getDb();
  db.prepare(
    `
      UPDATE generation_runs
      SET
        status = 'failed',
        error_message = @errorMessage,
        updated_at = @now
      WHERE run_id = @runId
    `
  ).run({
    runId,
    errorMessage,
    now
  });
}
