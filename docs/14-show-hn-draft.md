# Show HN Post Draft

## Title

Show HN: ctxops – Detect when your AI coding context drifts from code, right in your PR

## URL

https://github.com/ctxops/ctxops

## Text

Hi HN,

I built ctxops, an open-source CLI that detects when your AI context files (AGENTS.md, CLAUDE.md, etc.) drift from your actual code — at PR time, before AI acts on stale information.

**The problem:** Teams maintain markdown files to guide AI coding tools (AGENTS.md for Codex, CLAUDE.md for Claude, etc.). These files rot. Code changes, docs don't. AI then confidently generates code based on outdated architectural rules. Cortex's 2026 benchmark found that AI-assisted teams ship 20% more PRs but have 23.5% more incidents — largely because of stale context.

**What ctxops does:**

```
# Link docs to code paths
ctx link docs/ai/modules/order.md services/order/**

# PR-level drift detection
ctx doctor --base main
# 🟡 DRIFTED  docs/ai/modules/order.md
#   Affected by: services/order/handler.ts (+25 -8)
```

The key insight: it's not a linter that checks if files exist (ctxlint does that). It's a **change impact analyzer** — when code in `services/order/` changes, it finds which context docs are linked to that path and flags them. No other open-source tool does this at the PR diff level.

**Design decisions:**

- **Convention-first metadata**: No YAML frontmatter. Scope is inferred from path structure. You write Markdown, nothing else.
- **Doctor-first, not compose-first**: We started by trying to build a context assembler, but realized the real value is catching drift before AI acts on it.
- **CI-native**: Outputs text/JSON/SARIF. Drop it into a GitHub Action and block PRs with stale context (`--mode strict`).

**What it is NOT:**

- Not a coding agent (enough of those)
- Not a cloud service (CLI-first, repo-local)
- Not a documentation generator (it checks integrity, not content)

Built with TypeScript + Node 22. Apache-2.0. Try it: `npx ctxops init && npx ctxops doctor --base main`

Curious what HN thinks about the "context integrity" problem space — is this pain real for your team?
