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
