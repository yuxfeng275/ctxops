# 第一批 GitHub Issues

按 doctor-first 优先级重排（ADR-0002）。

## 标签建议

- `kind:feature`、`kind:bug`、`kind:docs`、`kind:infra`
- `priority:p0`、`priority:p1`
- `area:link`、`area:doctor`、`area:composer`、`area:renderer`、`area:example`
- `good-first-issue`

## P0 Issue 清单（MVP：doctor-first 闭环）

### P0-01 Bootstrap monorepo

- 目标：初始化 `apps/cli`、`packages/*`、构建脚本和测试脚本
- 验收：`pnpm build`、`pnpm test` 可以跑通

### P0-02 Implement `ctx init`

- 目标：生成脚手架（空片段 + 引导注释）
- 验收：执行后生成 `docs/ai/` 目录结构和示例片段

### P0-03 Implement `ctx link`

- 目标：文档-代码关联数据模型，支持显式绑定文档到代码路径
- 验收：`ctx link docs/ai/modules/order.md services/order/**` 可写入关联数据

### P0-04 Implement convention-based metadata inference

- 目标：从路径结构、文件名、git 历史自动推断 scope/task_types/freshness
- 验收：无需手写 frontmatter 即可获得正确元数据

### P0-05 Implement `ctx doctor --base`

- 目标：PR 级上下文漂移检测（**核心差异化**）
- 验收：在 demo repo 提交 PR 后，doctor 输出受影响片段和过期天数

### P0-06 Implement explicit override parsing

- 目标：解析 `<!-- ctxops: ... -->` 注释，显式声明优先于推断值
- 验收：覆盖规则生效

### P0-07 Create demo repo

- 目标：Java Spring demo，含故意过期文档
- 验收：doctor 可检测出过期文档

### P0-08 Write landing README + Record demo

- 目标：Context Integrity 叙事 + ≤90 秒 demo 视频
- 验收：新用户 3 分钟内看懂价值

## P1 Issue 清单（Phase 1：compose + render）

### P1-01 `ctx compose --changed`

- 基于 link 关联装配受变更影响的上下文

### P1-02 `AGENTS.md` renderer

### P1-03 `CLAUDE.md` renderer

### P1-04 `ctx validate`（schema 校验）

### P1-05 Secret scanning

### P1-06 GitHub Actions integration（PR 自动 doctor）

### P1-07 Release `v0.1.0-alpha`
