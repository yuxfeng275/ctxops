# 路线图

开发模式：纯 AI 开发（AI agent 并行实现）

## M0：验证（第 1-2 周）

目标：验证核心假设，为 MVP 方向提供数据支撑

- 访谈 10-15 个维护者，确认 compose 主要用户是 CI 还是人工
- 在 demo repo 做 doctor 输出验证
- 在 PR 模板里加 doctor 输出，观察维护者接受度

## M1：MVP（第 3-5 周）

目标：交付 doctor-first 最小闭环

核心命令（按优先级）：

1. `ctx init` — 脚手架 + 引导注释
2. `ctx link <doc> <paths...>` — 文档-代码关联数据模型
3. `ctx doctor --base main` — PR 级上下文漂移检测（**核心差异化**）

交付物：

- GitHub repo + README（Context Integrity 叙事）
- demo repo（含故意过期文档 + doctor 检测对比）
- Show HN demo 视频：展示代码变 → 漂移检测 → AI 输出改善的完整链条
- Show HN + dev.to 文章

## M2：装配 + 渲染（第 6-8 周）

目标：补全 compose 和 render 能力

- `ctx compose --changed` — 基于 link 关联装配最小上下文
- `ctx render --target agents|claude` — 渲染到 AGENTS.md + CLAUDE.md
- `ctx validate` — schema 校验
- PR workflow 集成（doctor 在 PR 评论里输出）
- GitHub Actions Marketplace 集成
- 第一个外部仓库接入

## M3：生态（第 9-12 周）

目标：证明外部价值

- 更多 renderer（GEMINI.md、Copilot、Continue）
- Context health score（跨仓库对比）
- 第一个外部贡献者 PR
- 评估 AAIF（Linux Foundation）参与

## 发布原则

先证明闭环，再做扩展：

1. 关联文档与代码（link）
2. 检测漂移（doctor）
3. 装配上下文（compose）
4. 渲染上下文（render）

只有 doctor 闭环被验证后，才继续做装配和渲染能力。
