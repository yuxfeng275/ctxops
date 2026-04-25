# README 首页草案

```md
# ctxops

The Context Integrity Engine for AI Coding Teams.

Your AI coding tools are only as good as the context they consume. `ctxops` detects when documentation drifts from code — right in your PR — so your AI never acts on stale context.

## The Problem

AI coding tools are getting smarter, but team-level development still breaks on stale context:

- Architecture rules live in Wiki, Slack, and tribal knowledge — AI can't reach them
- Documentation rots silently — and consistently misleads AI output (verified by Chroma Research)
- `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, Copilot instructions drift apart
- Nobody knows which docs are affected when code changes

**The result**: AI generates code faster, but incident rates go up 23.5% (Cortex 2026 Benchmark).

## What ctxops Does

**Detect** context drift at PR time — not after AI produces wrong output.

```bash
# Link docs to code paths
ctx link docs/ai/modules/order.md services/order/**

# Detect drift in your PR
ctx doctor --base main
# ⚠ docs/ai/modules/order.md is stale
#   Last updated: 42 days ago
#   Affected by: services/order/handler.ts (+15 -3)
#   Impact: 2 AI context entry points reference this doc

# Assemble only changed context (Phase 1)
ctx compose --changed

# Render to tool-specific entry files (Phase 1)
ctx render --target agents,claude
```

## How It Works

1. **Link** documents to code paths — convention-based by default, explicit when needed.
2. **Detect** which docs are affected when code changes (PR-level drift detection).
3. **Compose** minimal, relevant context from linked documents.
4. **Render** to tool-specific entry files (AGENTS.md, CLAUDE.md, etc.).

## What It Is Not

- Not a coding agent — it's the layer coding agents depend on.
- Not a cloud platform — it's CLI-first, repo-local.
- Not a documentation generator — it's a context integrity checker.

> Not related to Packmind's ContextOps platform — ctxops is the open-source CLI for context integrity.

## Supported Targets

- `AGENTS.md` (OpenAI / Codex)
- `CLAUDE.md` (Anthropic / Claude Code)
- More targets in Phase 1

## Project Status

Early stage. Doctor-first MVP in progress.

## Roadmap

- **MVP**: `ctx init` + `ctx link` + `ctx doctor --base` (context drift detection)
- **Phase 1**: `ctx compose` + `ctx render` + CI integration
- **Phase 2**: Context health score + cross-repo integrity + plugin ecosystem

## Who It's For

- Maintainers of medium-to-large repositories
- Platform teams standardizing AI development workflows
- Open-source projects reducing contributor onboarding friction

## Philosophy

Don't build another coding agent.
Build the context integrity layer that every coding agent depends on.

## License

Apache-2.0
```
