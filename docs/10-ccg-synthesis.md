# CCG 三角评审综合报告：最终合成

日期：2026-04-25
评审来源：Codex（技术架构）× Gemini（产品叙事）× Claude（综合仲裁）
覆盖文档：09-final-synthesis.md + 4 份调研 + 评审 A/B + Codex + Gemini

---

## 一、Codex 与 Gemini 的一致结论

在 6 个评审维度中，两个外部 agent 独立得出了以下完全一致的判断：

### 一致结论 1：产品定位从「compose-first」转向「doctor-first」是正确方向

**Codex 原话**：报告已识别"维护激励"是生死问题，但实现建议仍在围绕 compose 打转。这是战略不一致。

**Gemini 原话**：Demo 脚本（ctx doctor 发现过期）太像 Linter，应该展示"上下文依赖图"——但这恰恰是 doctor 的能力，不是 compose 的。

两者都指向同一结论：项目的核心差异化不是"上下文装配"，而是"文档与代码的实时血缘关系检测"。Doctor 是入口，compose 是后续能力。

### 一致结论 2：「自动推断 metadata」是必要但不充分的设计

**Codex 原话**：「自动推断 metadata」只能作为默认启发式，不能作为产品承诺。必须允许轻量显式覆盖。报告从"不要用户写 YAML"跳到"完全自动推断"，中间缺了一个工程上最现实的层：convention first, explicit override always。

**Gemini 的呼应**：想做"全家桶适配"太琐碎，ctxops 应该成为"上下文领域的 Makefile"——Makefile 的成功不是因为自动推断依赖，而是因为定义了清晰的依赖声明。

两者共同给出一个修正方案：推断作为默认值，显式声明作为可选项，两者共同构成 manifest。

### 一致结论 3：Show HN 标题太软

- 报告原标题：`ctxops — context engineering infrastructure for AI coding teams`（Gemini 评分：6/10）
- Codex 的技术评审同样隐含这一批评：demo 视频如果是"ctx doctor 发现问题"这种 lint 式输出，在 HN 上无法引发共鸣
- **修正**：需要展示因果关系（代码变 → 文档过期 → AI 输出错误），而不只是状态检测

---

## 二、Codex 与 Gemini 的分歧

### 分歧 1：叙事基调的「统治感」

**Gemini 的核心批评**：新叙事（"上下文新鲜度守护者"）缺乏进攻性，听起来卑微。"守护者"不是"定义者"。ctxops 应该成为"AI 上下文的事实来源标准"，而不是"确保 AI 不吃坏东西的清洁工"。

**Codex 无直接评论但隐含支持**：Codex 的 doctor-first 转向也是一种"守护"叙事，但更强调"低噪声 CI 工具"而非"标准制定者"。

**仲裁结论**：Gemini 的批评有道理，但"定义者"叙事需要 6-12 个月社区建设才能成立。MVP 阶段用"守护"叙事（低摩擦），等社区规模建立后再升级为"标准"叙事。**分阶段叙事**：MVP 用"PR 级上下文漂移检测器"，M2+ 升级为"Context Integrity 标准"。

### 分歧 2：品牌词汇选择

**Gemini 弃用 "context hygiene"**：这个词在中文语境像打扫卫生，在欧洲像 maintenance，开发者讨厌 maintenance。推荐：Context Integrity（上下文完整性）或 Context Fidelity（上下文保真度）。

**Codex 未直接评论**。

**仲裁结论**：采纳 Gemini 的建议，弃用 hygiene。**最终品牌词汇**：`Context Integrity`（完整性）。理由：架构级感知强，中英文皆可理解，与 AI 输出的"幻觉"问题直接挂钩。

### 分歧 3：死法概率评估

**Gemini 的新死法**：大模型长文本窗口暴力碾压（Infinite Context Death）。如果 2027 年上下文窗口达 100M，用户直接塞全库，ctxops 的价值主张会被冲击。

**Codex 未直接讨论**。

**仲裁结论**：Infinite Context Death 是真实的长期风险，但 2027 年前不会成为问题。**在报告中增加为第 4 种死法，概率 20%（中长期），M3 验证后重新评估**。

---

## 三、三方共识：最终修订后的产品定位

### 叙事升级（采纳 Gemini，修正 Codex）

> **ctxops — The Context Integrity Engine for AI Coding Teams.**
> 让你的 AI 只吃到经过校验的、最新的、与代码同步的上下文。在 PR 中自动检测上下文漂移，一行命令同步到所有 AI 入口。

### 核心能力重排（采纳 Codex 的 doctor-first）

| 能力 | 阶段 | 定位 |
|---|---|---|
| `ctx doctor --base main` | MVP（第 1 周） | **核心差异化**：PR diff → 漂移片段检测 |
| `ctx link <doc> <paths...>` | MVP（第 1 周） | **数据模型**：显式文档-代码关联 |
| `ctx compose --changed` | Phase 1 | compose 只基于 link 关联装配 |
| `ctx render --target agents\|claude` | Phase 1 | 输出到 AGENTS.md / CLAUDE.md |
| `ctx init` | MVP（第 0 天） | 脚手架 + 引导注释 |
| `ctx validate` | Phase 1 | schema 校验 |

### Metadata 设计修正（采纳 Codex 的 convention first）

- **推断作为默认值**：`docs/ai/modules/order.md` → scope=module（从路径推断）
- **显式声明作为可选项**：`docs/ai/modules/order.md` 中的 `<!-- ctxops: scope=module, paths=services/order/** -->` 覆盖推断
- **禁止强制 metadata**：用户只需要写 Markdown 内容，不需要写任何 YAML/JSON/Frontmatter

---

## 四、三方共识：M0 验证重新设计

### Codex 发现的方法论漏洞

原始 M0 验证有 3 个缺陷：
1. 访谈 5 人太少，`>60%` 在 5 样本下无统计意义
2. "对比 AI 错误率"实验没有固定任务集和 blind review，容易变成演示
3. "植入过期文档等外部 PR"样本太稀疏，不可行

### 修正后的 M0 验证（2 周，不是 1 周）

**实验 A（核心假设）：compose 的实际使用者是 CI 还是人工？**
- 方法：访谈 10-15 个维护者（按开源/公司平台/AI-heavy 分层）
- 问：「你现在怎么给你的 AI 工具提供上下文？」
- 成功标准：>60% 表示「PR 时自动触发」→ doctor-first；>60% 表示「人工手动编辑」→ compose-first

**实验 B（doctor 价值验证，替代"AI 错误率对比"）：**
- 方法：在 demo repo 的真实 PR 里运行 `ctx doctor --base main`，输出结果
- 问 5 个维护者：「这个输出有没有发现你不知道的问题？」
- 成功标准：≥2 个维护者说「发现了我没注意到的文档过期」

**实验 C（维护激励，替代"等外部 PR"）：**
- 方法：在 demo repo 的 PR 模板里加一行「ctx doctor 检测到本次 PR 影响了以下上下文片段」，观察维护者是否接受
- 成功标准：≥3 个 PR 中维护者没有抱怨这个提示，且有 ≥1 个 PR 包含文档更新

---

## 五、三方共识：MVP 工期修正

**原始估算**：14-21 天，5 个命令
**Codex 修正**：4-6 周单人全职才能做出"可发布 MVP"
**仲裁结论**：Codex 更接近现实。修正估算：4-6 周，包含：

| 命令 | 估计工期 | 说明 |
|---|---|---|
| `ctx init` | 3-4 天 | 骨架 + 引导注释 |
| `ctx link` | 5-7 天 | 显式关联数据模型 |
| `ctx doctor --base` | 5-7 天 | PR 级漂移检测（核心） |
| `ctx compose --changed` | 5-7 天 | 基于 link 关联的最小装配 |
| `ctx render` | 3-5 天 | AGENTS.md + CLAUDE.md |

总工期：21-30 天（3-4.5 周）。原 14-21 天估算只够做一个技术预览版。

---

## 六、被两份评审共同加强的新增风险

### 风险 F（新增）：大模型无限上下文窗口（Gemini 提出）

- 如果 2027 年 Claude/Gemini 支持 10M+ token，上下文工程的价值主张会被"直接塞全库"逻辑冲击
- **对策**：必须从一开始就建立**可量化的价值证明**（"ctxops 输出的 10k tokens 比全库 500k tokens 产生的 AI 错误少 X%"）。如果没有这个数据，Infinite Context Death 来临时项目无护城河。
- **概率评估**：短期（1-2年）10%，中长期（3年）40%

### 风险 G（新增）：IDE 原生集成（Gemini 提出，Codex 隐含）

- 如果 Cursor/Copilot 下个版本原生支持上下文 freshness 检测，ctxops 的核心价值主张直接被吞掉
- **对策**：差异化必须建立在"跨工具的上下文完整性"而非"单工具的 lint"。ctxops 的护城河是：跨 AGENTS.md + CLAUDE.md + Copilot + Continue 的统一 integrity 视图，任何单一 IDE 都无法复制这个能力。

---

## 七、最终行动清单（按优先级）

### D0：拍板决策（M0 开始前必须完成）

- [ ] **D1**：叙事词定为 `Context Integrity`，弃用 "ContextOps" 和 "context hygiene"
- [ ] **D2**：产品定位为 doctor-first（`ctx doctor` 是核心），compose-first 降为 Phase 1
- [ ] **D3**：Metadata 策略改为 convention-first + explicit-override（不是纯推断，也不是强制 YAML）
- [ ] **D4**：MVP 工期修正为 4-6 周（不是 14-21 天），告知所有利益相关者
- [ ] **D5**：增加死法 #4：Infinite Context Death（20% 中长期概率）

### M0（第 1-2 周）：验证核心假设

- [ ] **V1**：访谈 10-15 个维护者，确认 compose 主要用户是 CI 还是人工
- [ ] **V2**：在 demo repo 做 doctor 输出验证，≥2 个维护者发现未知问题
- [ ] **V3**：在 PR 模板里加 doctor 输出，观察维护者接受度

### M1（第 3-6 周）：MVP 发布

- [ ] 实现 `ctx init` + `ctx link` + `ctx doctor --base` 闭环
- [ ] 录制 Show HN demo：展示代码变 → 漂移检测 → AI 输出改善的完整链条
- [ ] 发布 GitHub repo + README（用 Context Integrity 叙事）
- [ ] Show HN + dev.to 文章

### M2（第 7-12 周）：.compose + .render + 外部用户

- [ ] 实现 `ctx compose --changed`（基于 link 关联）
- [ ] 实现 `ctx render`（AGENTS.md + CLAUDE.md）
- [ ] 第一个外部仓库接入（真实用户，不只是 demo）
- [ ] 第一个外部 PR 合并

---

## 八、一句话最终结论（供你做决策用）

> **这件事值得做，但核心产品形态需要从「Compose-first」翻转为「doctor-first」。**
>
> 修订后的 ctxops = **PR 级上下文完整性检测引擎**。它不是在 AI 提问时给它装配上下文，而是在代码变更时主动发现上下文漂移并在 PR 中示警。这个方向同时满足了 Codex 的「战略一致性」要求和 Gemini 的「进攻性叙事」要求，而且目前市场上没有任何开源工具在做这件事。
>
> **立刻要做的 2 件事（不等 M0 结果）：**
> 1. 把产品定位改成「Context Integrity Engine」，更新 PRD
> 2. 把 MVP 的第一个命令从 `ctx compose` 改成 `ctx link` + `ctx doctor --base`，这才是真正差异化的起点
