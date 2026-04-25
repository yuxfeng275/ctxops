# Demo 仓库方案

## 推荐结论

先做 Java Spring 单体 demo，再补一个 TypeScript monorepo demo。

## 备选方案

### 方案 A：Java Spring 单体仓库

- 模块：`order`、`inventory`、`payment`、`common`
- 最贴近最初的问题场景
- 最能体现团队级上下文工程价值

推荐作为第一个 demo。

### 方案 B：TypeScript monorepo

- 更容易被部分开发者理解
- 但容易把叙事带偏到 monorepo tooling

适合作为第二个 demo。

### 方案 C：极小 toy repo

- 做起来最快
- 说服力最弱

不推荐。

## 建议结构

```text
examples/java-spring-monolith/
  AGENTS.md
  CLAUDE.md
  docs/ai/
    00-project-overview.md
    01-architecture.md
    02-domain-glossary.md
    playbooks/
      bugfix.md
      feature.md
      review.md
    modules/
      order.md
      inventory.md
      payment.md
  services/
    order/
    inventory/
    payment/
  .ctxops/
    config.yaml
```

## 推荐演示故事线

1. 先埋一个真实的订单到库存链路 Bug。
2. 展示没有 `ctxops` 时，AI 输出泛化且不稳定。
3. 执行 `ctx compose --task bugfix --path services/order`。
4. 再展示渲染后的 `AGENTS.md` 与更聚焦的 AI 输出。

## 成功标准

- 新人能快速理解问题链路
- AI 输出在有上下文后明显收敛
- 项目规则清晰可见且可审计

## ADR

### 背景

第一个 demo 必须能打动真实团队，而不是只打动工具玩家。

### 决策

第一个 demo 选择 Java Spring 单体仓库。

### 后果

- 与原始场景高度一致
- 搭建成本高于 toy repo

### 备选方案

- TypeScript monorepo first：被拒绝
- toy repo：被拒绝
