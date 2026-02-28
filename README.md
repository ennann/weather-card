# Weather Card


![Weather Card](docs/weather-card.png)


AI 驱动的天气卡片生成器。每天自动为全球 200+ 城市生成精美的 3D 等距风格天气卡片。

## 它能做什么？

- 每天凌晨自动生成全球城市的天气卡片
- Gemini + Google Search 实时获取天气数据，生成 3D 风格卡片
- 在线画廊浏览，支持按城市、日期筛选
- 支持手动触发，想看哪个城市就生成哪个

## 快速开始

打开终端，启动 Claude Code CLI，然后告诉它：
```
帮我 clone https://github.com/ennann/weather-card 这个项目，安装依赖并启动本地开发服务
```

Claude 会自动帮你完成 clone、安装依赖、数据库迁移、启动开发服务器。

当然，你也可以手动来：
>
```bash
git clone https://github.com/ennann/weather-card.git
cd weather-card
npm install
npm run db:migrate:local
npm run dev
```

## 致谢

感谢 [宝玉](https://x.com/dotey) 的 Prompt 启发。

## License

MIT
