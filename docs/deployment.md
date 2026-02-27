# Weather Card 部署手册（Cloudflare）

本文档用于部署 `WeatherCardXHS` 到 Cloudflare，覆盖 `Worker + Pages + D1 + R2 + Workflows` 全链路。

- 架构与关系说明请先看: [architecture.md](./architecture.md)

## 1. 前置条件

1. 已安装 Node.js 20+、npm、Wrangler。
2. 已登录 Cloudflare:

```bash
npx wrangler login
```

3. 项目依赖已安装:

```bash
npm install
```

## 2. 创建 Cloudflare 资源

如果资源已存在，可跳过对应步骤。

### 2.1 创建 D1

```bash
npx wrangler d1 create weather-card-db
```

把返回的 `database_id` 写入以下两个文件的 `d1_databases[0].database_id`:

- `apps/worker/wrangler.jsonc`
- `apps/web/wrangler.jsonc`

### 2.2 创建 R2 Bucket

```bash
npx wrangler r2 bucket create weather-card-images
```

确保以下两个文件中的 bucket 名称一致:

- `apps/worker/wrangler.jsonc` -> `r2_buckets[0].bucket_name`
- `apps/web/wrangler.jsonc` -> `r2_buckets[0].bucket_name`

### 2.3 创建 Pages 项目

```bash
npx wrangler pages project create weather-card --production-branch main
```

### 2.4（可选但建议）创建 Pages Session KV

当前 `astro` Cloudflare 适配器会启用 session，建议提前创建并绑定 `SESSION`，避免运行时报 binding 错误。

```bash
npx wrangler kv namespace create SESSION
```

然后把返回的 `id` 添加到 `apps/web/wrangler.jsonc`:

```json
"kv_namespaces": [
  { "binding": "SESSION", "id": "<KV_NAMESPACE_ID>" }
]
```

## 3. 配置环境变量与密钥

### 3.1 Worker（`apps/worker`）

必需密钥:

```bash
cd apps/worker
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put TRIGGER_TOKEN
cd ../..
```

说明:

- `GEMINI_MODEL` 已在 `apps/worker/wrangler.jsonc` 中通过 `vars` 提供默认值。
- `TRIGGER_TOKEN` 会被 Pages 侧 `/create` 和 `/api/trigger` 复用，建议使用高强度随机字符串。

### 3.2 Pages（`weather-card-page` 项目）

建议作为 secret 注入（即使不是严格机密，也可统一管理）:

```bash
npx wrangler pages secret put TRIGGER_TOKEN --project-name weather-card
npx wrangler pages secret put WORKER_URL --project-name weather-card
npx wrangler pages secret put INTERNAL_API_KEY --project-name weather-card
```

变量含义:

- `TRIGGER_TOKEN`: 校验 `/create?token=` 与 `/api/trigger`。
- `WORKER_URL`: Worker 对外地址，例如 `https://weather-card-worker.<subdomain>.workers.dev`。
- `INTERNAL_API_KEY`: 保护 `/api/internal/cards`；若不需要内部接口可不配置。

## 4. 执行数据库迁移

从仓库根目录执行远端迁移:

```bash
npm run db:migrate:remote
```

迁移文件位于 `migrations/0001_create_generation_runs.sql`。

## 5. 部署 Worker

```bash
npm run worker:deploy
```

部署成功后，记录 Worker URL（后续填入 Pages 的 `WORKER_URL`）。

## 6. 部署 Pages

先构建：

```bash
npm run build
```

再发布：

```bash
cd apps/web
npx wrangler pages deploy dist --project-name weather-card
cd ../..
```

## 7. 验证部署

将 `<PAGES_URL>` 替换为你的线上地址，`<TOKEN>` 替换为 `TRIGGER_TOKEN`。

1. 验证页面可访问:

```bash
curl -I <PAGES_URL>/
```

2. 验证卡片 API:

```bash
curl <PAGES_URL>/api/cards?page=1&limit=5
```

3. 验证日志 API:

```bash
curl <PAGES_URL>/api/logs?page=1&limit=5
```

4. 验证手动触发:

```bash
curl -X POST "<PAGES_URL>/api/trigger?token=<TOKEN>&city=杭州"
```

5. 验证内部接口（若启用）:

```bash
curl -H "Authorization: Bearer <INTERNAL_API_KEY>" "<PAGES_URL>/api/internal/cards?limit=10"
```

## 8. 运维与排错建议

1. Cron 时区: `apps/worker/wrangler.jsonc` 的 `0 1 * * *` 是 UTC，每天 `01:00 UTC` 触发。
2. 若 `POST /api/trigger` 返回 502，优先检查 `WORKER_URL`、Worker 发布状态与 `TRIGGER_TOKEN` 是否一致。
3. 若图片 404，优先检查 D1 中 `image_r2_key` 与 R2 对象是否存在。
4. 若 `/api/internal/cards` 返回 404，表示未配置 `INTERNAL_API_KEY`（该接口会被主动关闭）。
5. 先读架构再排错更高效: [architecture.md](./architecture.md)
