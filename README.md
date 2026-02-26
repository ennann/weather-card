# WeatherCardXHS 自动化工作流

这个项目会完成以下流程：

1. 本地维护城市列表（`data/cities.json`，可包含中国和海外城市；优先远程同步中国行政区增量，失败自动回退种子列表）。
2. 每次执行随机选一个城市。
3. 查询该城市当前天气（Open-Meteo）。
4. 自动拼接生成天气卡片 Prompt。
5. 调用 Gemini 生成图片并保存到本地 `outputs/`。
6. 同步写入 SQLite 运行记录（默认 `data/weather-cards.sqlite`）。
7. 可通过 cron 每天自动执行一次。

## 1) 安装依赖

```bash
npm install
```

## 2) 配置环境变量

```bash
cp .env.example .env
```

至少配置：

- `GEMINI_API_KEY`

可选配置：

- `GEMINI_MODEL` 默认 `gemini-3-pro-image-preview`
- `DAILY_CRON` 默认 `0 8 * * *`（每天 08:00）
- `TIMEZONE` 默认 `Asia/Shanghai`
- `RUN_ON_START` 默认 `false`
- `SQLITE_PATH` 默认 `data/weather-cards.sqlite`

## 3) 同步城市列表（可选）

```bash
npm run cities:sync
```

说明：

- 默认会尝试从 `https://unpkg.com/china-division/dist/pca-code.json` 同步全量城市并写入 `data/cities.json`。
- 如果网络失败，会自动使用内置种子列表，流程仍可运行。

## 4) 生成一次天气卡片

随机城市：

```bash
npm run generate:once
```

指定城市（例如杭州）：

```bash
npm run generate:once -- --city=杭州
```

输出文件位置：

- 图片：`outputs/YYYY-MM-DD/*.png`
- 文本：`outputs/YYYY-MM-DD/*.txt`
- 元数据：`outputs/YYYY-MM-DD/*.json`
- 数据库：`data/weather-cards.sqlite`（可通过 `SQLITE_PATH` 改路径）

SQLite 表：`generation_runs`

- `run_id`：一次生成任务唯一 ID
- `city`：抽中的城市
- `weather_date` / `weather_condition` / `temp_min` / `temp_max`
- `image_path` / `text_path` / `meta_path`
- `status`：`running`、`succeeded`、`failed`
- `error_message`：失败原因

## 5) 每天自动运行

```bash
npm run generate:daily
```

这会启动一个常驻进程，按 `DAILY_CRON` 执行。

如果你希望系统层面定时（即使进程重启也自动恢复），建议再配一层系统 cron / pm2 / launchd 来托管这个命令。
