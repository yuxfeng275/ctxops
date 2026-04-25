# ctxops Roadmap

## M1 — MVP ✅ (Done)

Core CLI with init, link, and doctor commands.

- `ctx init` — scaffold .ctxops/ + docs/ai/ templates
- `ctx link` — document-to-code associations with metadata inference
- `ctx doctor --base` — PR-level drift detection (text/json/sarif)
- Convention-first metadata (no frontmatter required)
- CI-native: `--mode strict` + SARIF output
- 16/16 acceptance tests passing

## M1.5 — Smart Auto-Link + Agent Integration ✅ (Done)

Zero-config operation and AI agent ecosystem integration.

### Auto-Link
- `ctx link --auto` — zero-config auto-discovery
- 5-layer inference engine:
  1. `<!-- ctxops: paths=... -->` comments
  2. Directory name convention matching
  3. Content scanning (code path references)
  4. Git co-change analysis (statistical association)
  5. Semantic identifier matching (class/function name grep)
- `ctx doctor` auto-discovers links when none exist

### Agent Integration
- `ctx init` auto-generates:
  - `AGENTS.md` — Codex, Gemini CLI, OpenCode instructions
  - `.claude/skills/ctxops/SKILL.md` — Claude Code skill
- Pre-code / post-code agent workflow
- Zero config, zero dependencies, zero protocol overhead

### Multilingual
- README.md (English) + README.zh-CN.md (Chinese)
- Language toggle in both files

## M2 — Compose & Render (Planned)

Context assembly for AI consumption.

- `ctx compose` — assemble context fragments into a single document
- `ctx render` — output optimized for LLM token windows
- Priority ordering by relevance to current task
- Token budget management

## M3 — Ecosystem (Planned)

- GitHub Action (published to Marketplace)
- npm publish automation
- VS Code extension (inline drift indicators)
- Dashboard / web UI for context health metrics
