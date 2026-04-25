# ADR-0002：Doctor-first 转向与 Context Integrity 品牌决策

日期：2026-04-25
状态：已决定
决策者：项目发起人，经 CCG 三角评审（Codex × Gemini × Claude）仲裁后确认

## 背景

ADR-0001 确立了 ctxops 的方向（CLI-first ContextOps 工具链，不做 coding agent）。在此基础上，项目完成了 4 份专项调研、2 份交叉评审、1 份综合报告和 1 份 CCG 三角仲裁。评审过程中发现原始 PRD 存在多处战略不一致，需要在实现前修正。

本 ADR 记录 5 个关键决策的正式拍板结果。

## 决策 1：品牌叙事从 ContextOps / context hygiene 转为 Context Integrity

- **弃用**：ContextOps（与 Packmind 品牌冲突）、context hygiene（中文语境像打扫卫生，开发者排斥 maintenance 感）
- **采纳**：Context Integrity（上下文完整性）
- **理由**：架构级感知强，中英文皆可理解，与 AI 输出的「幻觉」问题直接挂钩
- **Hero 句**：`ctxops — The Context Integrity Engine for AI Coding Teams.`
- **来源**：Gemini 提出，Codex 无异议，Claude 仲裁采纳

## 决策 2：产品定位从 compose-first 翻转为 doctor-first

- **弃用**：以 `ctx compose` 作为核心入口
- **采纳**：以 `ctx doctor --base main` 作为核心差异化
- **理由**：Codex 和 Gemini 独立得出一致结论——项目的核心差异化不是「上下文装配」，而是「文档与代码的实时血缘关系检测」。市场上没有任何开源工具在 PR 级别做上下文漂移检测。
- **能力重排**：

| 优先级 | 命令 | 阶段 |
|---|---|---|
| 1 | `ctx doctor --base main` | MVP |
| 2 | `ctx link <doc> <paths...>` | MVP |
| 3 | `ctx init` | MVP（脚手架） |
| 4 | `ctx compose --changed` | Phase 1 |
| 5 | `ctx render --target agents\|claude` | Phase 1 |

- **来源**：Codex 提出 doctor-first，Gemini 隐含支持，Claude 仲裁确认

## 决策 3：Metadata 策略改为 convention-first + explicit-override

- **弃用**：纯自动推断（不可靠）、强制 frontmatter/YAML（codebase-context-spec 死因）
- **采纳**：推断作为默认值 + 显式声明作为可选覆盖
- **公式**：
  - 推断默认：`docs/ai/modules/order.md` → scope=module（从路径推断）
  - 显式覆盖：`<!-- ctxops: scope=module, paths=services/order/** -->` 在 Markdown 中
  - 禁止：任何强制的 YAML/JSON/Frontmatter
- **理由**：Codex 提出 convention first, explicit override always 是工程上最现实的方案；Gemini 以 Makefile 类比支持
- **来源**：Codex 提出，Gemini 呼应，Claude 仲裁采纳

## 决策 4：MVP 工期修正（纯 AI 开发）

- **原估算**：14-21 天（PRD 原始）
- **Codex 修正**：4-6 周（单人全职）
- **最终决策**：项目将使用纯 AI 开发模式，预期工期短于 Codex 估算的 4-6 周
- **说明**：Codex 的 4-6 周估算基于传统单人全职开发假设，纯 AI 开发（AI agent 并行实现）可显著压缩工期

## 决策 5：新增风险 #4 — Infinite Context Death

- **风险描述**：如果大模型上下文窗口达 100M+，用户直接塞全库，ctxops 的价值主张被冲击
- **概率**：短期（1-2 年）10%，中长期（3 年）40%
- **对策**：从一开始建立可量化的价值证明（「ctxops 输出的 10k tokens 比全库 500k tokens 产生的 AI 错误少 X%」）
- **来源**：Gemini 提出，Claude 仲裁纳入

## 后果

正向影响：

- 产品定位更聚焦、差异化更清晰
- MVP 范围更小、验证链路更短
- 品牌叙事更有进攻性

负向影响：

- compose 能力推迟到 Phase 1，可能影响「全链路装配」叙事
- 需要同步更新 PRD、README、Roadmap 等 6 份文档

## 备选方案

### 备选 1：维持 compose-first

被拒绝。Codex 和 Gemini 均指出 compose 的使用行为假设未被验证，战略不一致。

### 备选 2：使用 context hygiene 作为品牌词

被拒绝。Gemini 指出该词在中文语境像打扫卫生，缺乏进攻性。

### 备选 3：强制 frontmatter metadata

被拒绝。codebase-context-spec 的死因证明「让用户写 YAML 规范」走不通。
