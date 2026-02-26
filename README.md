# Weather Card

AI 驱动的天气卡片生成器。每天自动为全球城市生成精美的 3D 等距风格天气卡片。

## 功能

- 每日定时自动生成天气卡片（Cron 01:00 CST）
- 支持 200+ 全球城市（中国主要城市 + 海外热门城市）
- Gemini + Google Search Grounding 实时搜索天气并生成卡片
- 在线画廊展示 + 生成日志查看
- 支持手动触发，可指定城市

## 本地开发

```bash
npm install
npm run db:migrate:local
npm run dev
```

## 致谢

感谢 [宝玉](https://x.com/dotey) 的 Prompt 启发。

## License

MIT
