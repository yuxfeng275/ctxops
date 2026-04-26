<!-- ctxops: scope=project, paths=src/lib/** src/commands/** -->

# ctxops 架构说明

## 系统边界

ctxops 是一个 CLI 工具，输入是 git 仓库状态，输出是漂移检测报告。

```
输入: git diff (base..HEAD) + .ctxops/links.json
  ↓
处理: 匹配受影响文档 → 判定状态
  ↓
输出: text / json / sarif 报告
```

## 核心组件

### 命令层 (src/commands/)

| 命令 | 职责 |
|---|---|
| `init` | 脚手架：创建 .ctxops/、docs/ai/、AGENTS.md、Claude Skill、.gitattributes |
| `link` | 关联管理：手动 link/remove/list + `--auto` 自动发现 |
| `doctor` | **核心**：PR 级漂移检测，4 种状态判定 |
| `status` | 健康概览：freshness 统计 + 覆盖率 |
| `hook` | git pre-commit 钩子管理 |

### 库层 (src/lib/)

| 模块 | 职责 |
|---|---|
| `auto-linker` | 多层自动关联调度中心 |
| `smart-linker` | Layer 4 (git co-change) + Layer 5 (语义匹配) |
| `git` | 封装 git rev-parse/diff/log/grep |
| `links` | .ctxops/links.json CRUD |
| `config` | .ctxops/config.json 读写 |
| `glob` | minimatch 封装 |
| `inference` | 从文件路径推断 scope/taskTypes |
| `output` | 格式化输出 (text/json/sarif) |

## 数据流

```
ctx doctor --base main
  │
  ├─ git.getChangedFiles(base, root)     → 获取 PR 变更文件
  ├─ links.readLinks(root)                → 读取血缘表
  │
  ├─ 对每个 link:
  │   ├─ glob.findMatchingChangedFiles()  → 匹配受影响的代码文件
  │   ├─ 判定状态:
  │   │   ├─ 无匹配 → unaffected
  │   │   ├─ 有匹配 + 文档也改了 → synced
  │   │   ├─ 有匹配 + 文档没改 → drifted
  │   │   └─ 有匹配 + 文档没改 + 超过阈值 → stale_drifted
  │   └─ 收集 diff stat
  │
  └─ output.format(report)               → 输出报告
```

## 自动关联策略

`ctx link --auto` 使用分层推断，默认启用 Layer 1-4，Layer 5 需 `--deep` 开启：

1. **Layer 1 (Explicit)**: 解析 `<!-- ctxops: paths=... -->` 注释
2. **Layer 2 (Convention)**: 目录名匹配 (order.md → services/order/**)
3. **Layer 3 (Content)**: 扫描 Markdown 中引用的代码路径
4. **Layer 4 (Git Co-change)**: 分析 git 历史中的共变文件
5. **Layer 5 (Semantic)**: grep 类名/函数名（默认关闭，误报风险高）

## 设计决策

- **Convention-first**: 不要求 YAML/frontmatter，从路径和目录推断
- **Git-native**: 所有检测基于 git diff，无额外依赖
- **Zero-cloud**: 不上传任何数据，纯本地运行
- **CI-first**: `--mode strict` + SARIF 输出，原生适配 CI 流水线
