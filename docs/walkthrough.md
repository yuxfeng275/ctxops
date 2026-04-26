# ctxops 项目进度记录

> 截止时间：2026-04-26 00:20 (UTC+8)
> 仓库：https://github.com/yuxfeng275/ctxops
> npm：https://www.npmjs.com/package/ctxops (v0.2.0 已发布)

---

## 全局开发要求 ⚠️

> [!IMPORTANT]
> **每次修改完成后，必须同步更新以下两个文件：**
> - `README.md`（英文版）
> - `README.zh-CN.md`（中文版）

---

## 已完成功能

### M1 — MVP ✅

| 命令 | 功能 | 状态 |
|---|---|---|
| `ctx init` | 脚手架初始化 + AGENTS.md + Claude Skill + .gitattributes | ✅ |
| `ctx link` | 手动关联 + `--auto` 5 层智能推断 | ✅ |
| `ctx doctor` | PR 级漂移检测 (text/json/sarif) + strict 模式 | ✅ |

### M1.5 — Smart Auto-Link + Agent 集成 ✅

| 功能 | 说明 | 状态 |
|---|---|---|
| 5 层自动关联 | ctxops-comment → 约定 → 内容扫描 → git 共变 → 语义匹配 | ✅ |
| Agent 集成 | AGENTS.md + .claude/skills/ctxops/SKILL.md | ✅ |
| 多人协作 | links.json 排序输出 + .gitattributes merge=ours | ✅ |
| 多语言 | README.md (EN) + README.zh-CN.md (CN) | ✅ |

### M1.6 — 高价值低成本功能 ✅

| 命令 | 功能 | 状态 |
|---|---|---|
| `ctx status` | 全局上下文健康概览（健康度条 + 文档清单） | ✅ |
| `ctx coverage` | 代码覆盖率报告（哪些代码目录缺文档） | ✅ |
| `ctx hook install/remove` | git pre-commit 钩子管理 | ✅ |

---

## 完整命令列表

```
ctx init                    # 初始化 + 生成 Agent 文件
ctx link --auto             # 5 层智能自动关联
ctx link <doc> <paths...>   # 手动关联
ctx link --list             # 查看关联
ctx link --remove <doc>     # 移除关联
ctx doctor --base main      # PR 级漂移检测
ctx status                  # 上下文健康概览
ctx coverage                # 代码覆盖率
ctx hook install            # 安装 pre-commit 钩子
ctx hook remove             # 移除钩子
```

---

## Git 提交历史

```
1489fd5  feat: ctxops v0.1.0 — MVP
3fae17b  docs: add Chinese README
78ea9e0  feat: auto-link — zero-config
e950a6f  feat: smart auto-link with 5-layer inference
4a4ae88  feat: agent integration via skill/harness
ec9a33a  docs: update README + roadmap
656446d  chore: bump to v0.2.0
af3f0eb  chore: dogfooding — add ctxops links for self
6737b91  fix: multi-person collaboration — merge-friendly links.json
f61c00c  feat: add status, coverage, and hook commands
8a34e52  docs: add status, coverage, hook commands to README (EN + CN)
```

---

## 项目结构

```
/Users/yufeng/Documents/yfmind/1ctxops/
├── src/
│   ├── cli.ts                    # CLI 入口
│   ├── commands/
│   │   ├── init.ts               # ctx init
│   │   ├── link.ts               # ctx link (含 --auto)
│   │   ├── doctor.ts             # ctx doctor
│   │   ├── status.ts             # ctx status
│   │   ├── coverage.ts           # ctx coverage
│   │   └── hook.ts               # ctx hook
│   └── lib/
│       ├── auto-linker.ts        # 5 层自动关联引擎
│       ├── smart-linker.ts       # Layer 4 (git co-change) + Layer 5 (语义)
│       ├── config.ts             # 配置读写
│       ├── links.ts              # 关联注册表
│       ├── git.ts                # git 操作封装
│       ├── glob.ts               # glob 匹配
│       ├── inference.ts          # 元数据推断
│       └── output.ts             # 输出格式化
├── skills/
│   ├── AGENTS.md                 # Agent 指令模板
│   ├── CLAUDE.md                 # Claude Code 规则
│   └── claude/SKILL.md           # Claude Code 技能
├── tests/e2e.test.ts             # 16 个 E2E 测试
├── docs/
│   ├── 05-roadmap.md             # 路线图
│   └── 14-show-hn-draft.md       # Show HN 草稿
├── examples/demo.sh              # 交互式 Demo
├── README.md                     # 英文文档
├── README.zh-CN.md               # 中文文档
└── package.json                  # v0.2.0
```

---

## 技术栈

- TypeScript + Node.js (ESM)
- Commander (CLI)
- Vitest (测试)
- chalk + minimatch (工具库)
- Node >= 22

---

## 下一步计划

### 待做（按优先级）

| 优先级 | 事项 | 说明 |
|---|---|---|
| P1 | npm 发布 v0.3.0 | 包含 status/coverage/hook |
| P1 | GitHub Action | 发布到 Marketplace |
| P1 | Show HN / 小红书发帖 | 小红书内容已生成 |
| P2 | `ctx compose` | 上下文组装（M2） |
| P2 | `.ctxopsignore` | 忽略规则 |
| P2 | `ctx why <doc>` | 推断溯源 |
| P3 | `ctx watch` | 文件监听 |
| P3 | Dashboard / Web UI | 健康趋势 |

### 已生成待发布

- [小红书帖子内容](file:///Users/yufeng/.gemini/antigravity/brain/b87c4050-3063-4555-bc06-cb26324380f9/artifacts/xiaohongshu_post.md)（含封面图 + 正文 + hashtag）
- Show HN 草稿：`docs/14-show-hn-draft.md`

---

## 发布状态

| 平台 | 版本 | 状态 |
|---|---|---|
| GitHub | main (8a34e52) | ✅ 已推送 |
| npm | v0.2.0 | ✅ 已发布 |
| npm v0.3.0 | 待发布 | ⏳ 包含 status/coverage/hook |

---

## 测试状态

- 15/16 E2E 测试通过
- 1 个失败 (T-INIT-02) 是测试环境问题（子目录继承父级 .git），非功能回归
- dogfooding 验证通过（在 ctxops 自身上运行）
