# ctxops MVP 验收标准与验证计划

版本：v0.1.0
日期：2026-04-25
关联：12-usage-spec.md（使用规格说明书）

---

## 一、验证方法论

### 原则

每个验收测试用例都是**可执行的**：给定一个初始状态（Given），执行一个操作（When），验证一个结果（Then）。实现完成后，逐一运行这些用例，全部通过 = MVP 完成。

### 验证工具

- **自动化测试**：单元测试 + 集成测试（vitest）
- **E2E 验证**：在 demo repo 中手动/脚本运行完整流程
- **CI 验证**：GitHub Actions 中运行 doctor 并检查输出

---

## 二、`ctx init` 验收用例

### T-INIT-01：正常初始化

```
Given: 一个 git 仓库，不存在 .ctxops/ 目录
When:  执行 `ctx init`
Then:
  ✅ 退出码 = 0
  ✅ 创建 .ctxops/config.json（内容符合 spec §2.1）
  ✅ 创建 .ctxops/links.json（links 为空数组）
  ✅ 创建 docs/ai/ 目录结构
  ✅ 创建 docs/ai/modules/_example.md（含引导注释）
  ✅ 终端输出包含 "Initialized ctxops" 和 "Next steps"
```

### T-INIT-02：非 git 仓库报错

```
Given: 一个不含 .git/ 的普通目录
When:  执行 `ctx init`
Then:
  ✅ 退出码 = 1
  ✅ 终端输出包含错误信息："not a git repository"
  ✅ 不创建任何文件
```

### T-INIT-03：重复初始化拒绝

```
Given: 已执行过 `ctx init` 的 git 仓库
When:  再次执行 `ctx init`
Then:
  ✅ 退出码 = 2
  ✅ 终端输出包含："already initialized"
  ✅ 不覆盖现有文件
```

### T-INIT-04：--force 覆盖

```
Given: 已执行过 `ctx init` 的 git 仓库
When:  执行 `ctx init --force`
Then:
  ✅ 退出码 = 0
  ✅ .ctxops/config.json 被重新生成
  ✅ .ctxops/links.json 被重置为空
  ✅ docs/ai/ 中已有文件不被删除（只补充缺失文件）
```

---

## 三、`ctx link` 验收用例

### T-LINK-01：正常关联

```
Given: 已 init 的仓库，存在 docs/ai/modules/order.md 和 services/order/ 目录
When:  执行 `ctx link docs/ai/modules/order.md services/order/**`
Then:
  ✅ 退出码 = 0
  ✅ .ctxops/links.json 中新增一条 link 记录
  ✅ link.document = "docs/ai/modules/order.md"
  ✅ link.codePaths 包含 "services/order/**"
  ✅ link.metadata.scope = "module"（从路径推断）
  ✅ link.metadata.inferredFrom = "path"
  ✅ 终端输出 "Linked:" + 文档路径 + 代码路径
```

### T-LINK-02：多路径关联

```
Given: 已 init 的仓库
When:  执行 `ctx link docs/ai/modules/order.md services/order/** shared/models/order.ts`
Then:
  ✅ links.json 中该 link 的 codePaths 包含 2 个路径
  ✅ 终端输出显示两个代码路径
```

### T-LINK-03：显式覆盖解析

```
Given: docs/ai/modules/order.md 文件顶部包含：
       <!-- ctxops: scope=module, paths=services/order/** -->
When:  执行 `ctx link docs/ai/modules/order.md services/order/**`
Then:
  ✅ link.metadata.overrides.paths = "services/order/**"
  ✅ 显式覆盖的 scope 优先于路径推断
```

### T-LINK-04：文档不存在报错

```
Given: 已 init 的仓库
When:  执行 `ctx link docs/ai/nonexistent.md services/order/**`
Then:
  ✅ 退出码 = 2
  ✅ 终端输出："document not found: docs/ai/nonexistent.md"
```

### T-LINK-05：更新已有关联

```
Given: docs/ai/modules/order.md 已关联到 services/order/**
When:  执行 `ctx link docs/ai/modules/order.md services/order/** services/payment/**`
Then:
  ✅ links.json 中该 document 的 codePaths 更新为新值
  ✅ 不产生重复记录
```

### T-LINK-06：移除关联

```
Given: docs/ai/modules/order.md 已有关联
When:  执行 `ctx link --remove docs/ai/modules/order.md`
Then:
  ✅ 退出码 = 0
  ✅ links.json 中不再包含该 document
```

### T-LINK-07：列出关联

```
Given: 有 3 个 document 已关联
When:  执行 `ctx link --list`
Then:
  ✅ 终端输出表格，包含 DOCUMENT / CODE PATHS / SCOPE / FRESHNESS 列
  ✅ 显示所有 3 个关联
```

### T-LINK-08：列出关联（JSON 格式）

```
Given: 有关联存在
When:  执行 `ctx link --list --format json`
Then:
  ✅ 输出有效 JSON
  ✅ JSON 结构匹配 links.json 的 links 数组
```

### T-LINK-09：Freshness 推断

```
Given: docs/ai/modules/order.md 上次 git commit 是 15 天前
When:  执行 `ctx link docs/ai/modules/order.md services/order/**`
Then:
  ✅ 终端输出 "Freshness: 15 days (from git blame)"
```

---

## 四、`ctx doctor --base` 验收用例

### T-DOC-01：检测到漂移（DRIFTED）

```
Given: 
  - docs/ai/modules/order.md 关联到 services/order/**
  - docs/ai/modules/order.md 最后修改 5 天前（未超 30 天阈值）
  - 当前分支相对 main 有 services/order/handler.ts 的变更
  - docs/ai/modules/order.md 未在当前 PR 中被修改
When:  执行 `ctx doctor --base main`
Then:
  ✅ 退出码 = 0（warn 模式）
  ✅ 输出包含 "🟡 DRIFTED" + "docs/ai/modules/order.md"
  ✅ 输出包含受影响的代码文件名
  ✅ summary 中 drifted = 1
```

### T-DOC-02：检测到过期+漂移（STALE + DRIFTED）

```
Given:
  - docs/ai/modules/order.md 关联到 services/order/**
  - docs/ai/modules/order.md 最后修改 45 天前（超过 30 天阈值）
  - 当前分支有 services/order/ 下文件变更
  - docs/ai/modules/order.md 未在 PR 中修改
When:  执行 `ctx doctor --base main`
Then:
  ✅ 输出包含 "🔴 STALE + DRIFTED"
  ✅ 输出包含 "45 days ago (threshold: 30 days)"
  ✅ summary 中 stale = 1
```

### T-DOC-03：文档已同步（SYNCED）

```
Given:
  - docs/ai/modules/order.md 关联到 services/order/**
  - 当前分支同时修改了 services/order/handler.ts 和 docs/ai/modules/order.md
When:  执行 `ctx doctor --base main`
Then:
  ✅ 输出包含 "✔ SYNCED" + "docs/ai/modules/order.md"
  ✅ 输出包含 "Updated in this PR"
  ✅ summary 中 synced = 1
```

### T-DOC-04：无影响（UNAFFECTED）

```
Given:
  - docs/ai/modules/order.md 关联到 services/order/**
  - 当前分支只修改了 services/payment/ 下的文件
When:  执行 `ctx doctor --base main`
Then:
  ✅ order.md 不出现在输出中（或标记为 UNAFFECTED）
  ✅ summary 中 unaffected >= 1
```

### T-DOC-05：strict 模式阻止

```
Given: 有至少 1 个 DRIFTED 或 STALE + DRIFTED 的文档
When:  执行 `ctx doctor --base main --mode strict`
Then:
  ✅ 退出码 = 1
  ✅ 输出包含 "Context integrity check failed (strict mode)"
```

### T-DOC-06：strict 模式全部通过

```
Given: 所有受影响文档都在 PR 中被修改（全部 SYNCED）
When:  执行 `ctx doctor --base main --mode strict`
Then:
  ✅ 退出码 = 0
  ✅ 输出不包含 "failed"
```

### T-DOC-07：JSON 输出格式

```
Given: 有漂移的文档
When:  执行 `ctx doctor --base main --format json`
Then:
  ✅ 输出是有效 JSON
  ✅ JSON 包含 base, head, changedFiles, results, summary 字段
  ✅ results 中每个元素包含 document, status, severity, lastUpdated, affectedBy 字段
```

### T-DOC-08：SARIF 输出格式

```
Given: 有漂移的文档
When:  执行 `ctx doctor --base main --format sarif`
Then:
  ✅ 输出符合 SARIF v2.1.0 schema
  ✅ 包含 tool.driver.name = "ctxops"
  ✅ 每个漂移文档对应一个 result
  ✅ severity 正确映射（STALE → error, DRIFTED → warning）
```

### T-DOC-09：无 link 时的行为

```
Given: 已 init 但 links.json 为空
When:  执行 `ctx doctor --base main`
Then:
  ✅ 退出码 = 0
  ✅ 输出提示："No links found. Run 'ctx link' to create document-code associations."
```

### T-DOC-10：多文档多路径的综合场景

```
Given:
  - order.md 关联 services/order/**（45 天前修改）
  - inventory.md 关联 services/inventory/**（5 天前修改）
  - architecture.md 关联 services/**（3 天前修改）
  - 当前 PR 修改了 services/order/handler.ts 和 services/inventory/stock.ts
  - 当前 PR 同时修改了 docs/ai/modules/inventory.md
When:  执行 `ctx doctor --base main`
Then:
  ✅ order.md → 🔴 STALE + DRIFTED（45天 > 30天阈值）
  ✅ inventory.md → ✔ SYNCED（在 PR 中被修改）
  ✅ architecture.md → 🟡 DRIFTED（代码变了，文档没更新，但未超阈值）
  ✅ summary: stale=1, drifted=1, synced=1
```

---

## 五、端到端验证场景

### E2E-01：完整 Demo 流程

这是最重要的验证场景，模拟真实用户的完整使用链路。

#### 准备 Demo Repo

```bash
# 创建 demo 仓库
mkdir demo-spring && cd demo-spring && git init

# 创建代码结构
mkdir -p services/order services/inventory services/payment shared/models
echo "export class OrderHandler {}" > services/order/handler.ts
echo "export class OrderModel {}" > shared/models/order.ts
echo "export class InventoryService {}" > services/inventory/service.ts
git add . && git commit -m "initial commit"
```

#### 执行验证

```bash
# Step 1: Init
npx ctxops init
# 验证：.ctxops/ 和 docs/ai/ 被创建

# Step 2: 创建文档
cat > docs/ai/modules/order.md << 'EOF'
<!-- ctxops: scope=module -->
# 订单模块
订单处理的核心模块，负责创建、支付、取消。
- 状态机：CREATED → PAID → SHIPPED → COMPLETED
- 库存扣减在 PAID 时触发
EOF

# Step 3: Link
npx ctxops link docs/ai/modules/order.md "services/order/**" "shared/models/order.ts"
# 验证：links.json 有 1 条记录

# Step 4: 提交并创建 feature branch
git add . && git commit -m "add ctxops context"
git checkout -b feature/update-order

# Step 5: 修改代码（不修改文档）
echo "export class OrderHandler { async cancel() {} }" > services/order/handler.ts
git add . && git commit -m "add cancel method"

# Step 6: 运行 doctor
npx ctxops doctor --base main
# 验证：输出 🟡 DRIFTED for order.md

# Step 7: 更新文档后再运行
echo "# 订单模块（已更新）" >> docs/ai/modules/order.md
git add . && git commit -m "update order docs"
npx ctxops doctor --base main
# 验证：输出 ✔ SYNCED for order.md
```

#### 验证检查表

| # | 检查项 | 预期结果 |
|---|---|---|
| 1 | init 创建正确的目录结构 | .ctxops/ + docs/ai/ |
| 2 | link 写入正确的关联数据 | links.json 包含 order.md → services/order/** |
| 3 | doctor 在代码变更后检测到漂移 | 🟡 DRIFTED |
| 4 | doctor 在文档更新后显示已同步 | ✔ SYNCED |
| 5 | doctor --mode strict 在漂移时返回非零退出码 | exit 1 |
| 6 | doctor --format json 输出有效 JSON | 可解析 |
| 7 | 45 天后 doctor 检测到 STALE + DRIFTED | 🔴 |

### E2E-02：Show HN Demo 验证

验证 demo 视频的核心叙事链条：**代码改了 → doctor 发现漂移 → 更新文档 → AI 输出改善**。

```
Step 1: 展示 demo repo 的正常状态（doctor 全绿）
Step 2: 修改 services/order/handler.ts（加入新的业务逻辑）
Step 3: 运行 ctx doctor --base main → 显示 🟡 DRIFTED
Step 4: 不更新文档，让 AI 基于旧文档回答问题 → AI 输出过时/错误
Step 5: 更新 docs/ai/modules/order.md
Step 6: 运行 ctx doctor --base main → 显示 ✔ SYNCED
Step 7: 让 AI 基于新文档回答问题 → AI 输出准确
```

验证标准：**观众能在 90 秒内理解因果关系**。

---

## 六、非功能性验收标准

### 性能

| 指标 | 阈值 | 验证方法 |
|---|---|---|
| `ctx init` 执行时间 | < 1 秒 | 计时 |
| `ctx link` 执行时间 | < 500ms | 计时 |
| `ctx doctor` 在 100 个 link 的仓库中 | < 3 秒 | 计时 |
| `ctx doctor` 在 1000 个变更文件的 PR 中 | < 10 秒 | 计时 |

### 兼容性

| 环境 | 要求 |
|---|---|
| Node.js | >= 22 |
| 操作系统 | macOS / Linux / Windows (WSL) |
| Git | >= 2.30 |

### 错误处理

| 场景 | 预期行为 |
|---|---|
| 无效的 glob 表达式 | 清晰的错误信息 + 非零退出码 |
| 损坏的 links.json | 报错并建议 `ctx init --force` |
| git 不可用 | 报错："git is required" |
| 无权限写入 .ctxops/ | 报错 + 退出码 |

---

## 七、实现完成定义（Definition of Done）

当且仅当以下全部满足时，MVP 视为完成：

- [ ] **T-INIT-01 到 T-INIT-04**：全部通过
- [ ] **T-LINK-01 到 T-LINK-09**：全部通过
- [ ] **T-DOC-01 到 T-DOC-10**：全部通过
- [ ] **E2E-01**：完整 demo 流程跑通
- [ ] **E2E-02**：Show HN demo 脚本可执行
- [ ] **性能**：全部在阈值内
- [ ] **README**：安装和快速开始指南可用
- [ ] **npm 包**：`npx ctxops` 可正常运行
- [ ] **单元测试覆盖率** >= 80%
