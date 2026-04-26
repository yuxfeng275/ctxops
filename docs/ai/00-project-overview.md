<!-- ctxops: scope=project, paths=src/** -->

# ctxops 项目概览

## 定位

面向 AI 编码团队的上下文完整性引擎。核心价值：在 PR 阶段检测文档与代码的漂移，确保 AI 不会基于过期上下文工作。

## 技术栈

- **语言**: TypeScript (ESM)
- **运行时**: Node.js 18+
- **依赖**: chalk (终端着色), commander (CLI), minimatch (glob)
- **构建**: tsc → dist/
- **测试**: vitest (E2E)
- **零云端、零 LLM、零 MCP**: 所有逻辑本地运行，仅依赖 git

## 项目结构

```
src/cli.ts                    → CLI 入口 (commander)
src/commands/init.ts           → ctx init (脚手架 + Agent 文件)
src/commands/link.ts           → ctx link (手动 + --auto 自动关联)
src/commands/doctor.ts         → ctx doctor (PR 级漂移检测，核心)
src/commands/status.ts         → ctx status (健康概览)
src/commands/hook.ts           → ctx hook (pre-commit 钩子)
src/lib/auto-linker.ts         → 多层自动关联引擎
src/lib/smart-linker.ts        → git co-change + 语义匹配
src/lib/git.ts                 → git 操作封装
src/lib/links.ts               → .ctxops/links.json 管理
src/lib/config.ts              → .ctxops/config.json 管理
src/lib/glob.ts                → glob 匹配
src/lib/inference.ts           → 元数据推断
src/lib/output.ts              → 输出格式化 (text/json/sarif)
```

## 核心数据模型

- `.ctxops/config.json` — 配置（阈值、默认模式、上下文目录）
- `.ctxops/links.json` — 文档-代码血缘表（核心资产）
- `docs/ai/` — 上下文文档目录

## 开发约定

- 每次修改后同步更新 README.md (EN) + README.zh-CN.md (CN)
- 使用 `npm run build` 验证编译
- 使用 `npm test` 运行测试
- 使用 `node dist/cli.js doctor --base main` 自检
