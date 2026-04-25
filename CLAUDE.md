# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository status

This repo is **docs-only** right now — no source code, no build system, no tests. It contains the planning artifacts for a product called `ctxops` that has not started implementation yet. There is no `pnpm`, `npm`, `make`, or test command to run; do not invent one.

If asked to "build" or "run tests," stop and clarify — the commands in the docs (`ctx link`, `ctx doctor`, `ctx compose`, `ctx render`) describe the *future* CLI, not anything executable today.

## What `ctxops` is

A planned **CLI-first Context Integrity Engine** for AI coding tools. The core thesis (see `docs/adr/ADR-0001-ctxops-direction.md` and `docs/adr/ADR-0002-doctor-first-pivot.md`): **do not build another coding agent**. Build the context integrity layer coding agents depend on — PR-level drift detection, document-code linkage, multi-tool rendering, freshness checks.

The product is **doctor-first** (ADR-0002): the core differentiator is `ctx doctor` (PR-level context drift detection), not `ctx compose` (context assembly). The key value proposition: detect when documentation drifts from code — right in your PR — so AI never acts on stale context.

The capability priority that defines the product scope:

1. **Link** — explicit document-to-code associations (`ctx link`).
2. **Doctor** — PR-level drift detection against base branch (`ctx doctor --base main`). This is the **core differentiator**.
3. **Compose** — assemble minimal context from linked documents given a change scope (`ctx compose --changed`). Phase 1.
4. **Render** — emit tool-specific entry files (`AGENTS.md`, `CLAUDE.md`). Phase 1.

**Metadata strategy** (ADR-0002 D3): convention-first + explicit-override. Metadata is inferred from paths, filenames, and git history by default. Users can optionally override with `<!-- ctxops: ... -->` comments. No mandatory YAML/frontmatter.

Anything outside these capabilities is **out of scope** per the PRD: no code-gen model, no cloud platform, no autonomous agent runtime, no IDE suite.

## Document map

All substantive content lives in `docs/`. The documents form a chain — later docs assume earlier ones:

- `01-context-engineering-research.md` — why "Context Engineering as Code" and why not a mega-doc or Wiki platform.
- `02-open-source-landscape.md` — positions `ctxops` against agents (codex, aider, cline, OpenHands), packagers (repomix, gitingest), and rule standards (agents.md, continuedev/rules). Identifies the Context Integrity gap.
- `03-product-prd.md` — **canonical spec**: problem, users, boundaries, C4 architecture, data model, v0.1 scope, STRIDE. When PRD conflicts with other docs, PRD wins.
- `04-readme-homepage-draft.md` — public README draft. Treat as marketing copy, not spec.
- `05-roadmap.md` — M0 (validation) → M1 (MVP: link + doctor + init) → M2 (compose + render + CI) → M3 (ecosystem).
- `06-demo-repo-plan.md` — first demo is a Java Spring monolith with `order`/`inventory`/`payment` modules and deliberately planted stale docs.
- `07-github-issues.md` — P0 issue backlog for bootstrap (doctor-first priority).
- `08-needs-analysis.md` — deep needs analysis with cross-validation.
- `09-final-synthesis.md` — comprehensive feasibility report synthesizing all research.
- `10-ccg-synthesis.md` — CCG triangular review (Codex × Gemini × Claude) final synthesis.
- `11-m0-validation-report.md` — M0 validation via web research (CI-first confirmed, doctor value validated, maintenance incentive verified).
- `12-usage-spec.md` — **MVP implementation baseline**: exact CLI behavior, data models, output formats, usage scenarios. Implementation must match this spec.
- `13-acceptance-criteria.md` — **verification baseline**: 23 test cases + 2 E2E scenarios + performance benchmarks. All must pass for MVP completion.
- `adr/ADR-0001-ctxops-direction.md` — the "not a coding agent" decision.
- `adr/ADR-0002-doctor-first-pivot.md` — doctor-first pivot + Context Integrity branding + 5 key decisions.

## When working in this repo

- **Docs are the product right now.** Editing a doc is a real change, not a draft — preserve the existing voice (concise Chinese, short sections, bullets > prose, no emoji).
- **Cross-reference, don't duplicate.** The docs deliberately don't repeat each other. If you find yourself restating content from another doc, link instead.
- **STRIDE and ADR blocks are a convention.** Most docs end with a STRIDE threat model and/or a mini-ADR (背景 / 决策 / 后果 / 备选方案). Match this shape when adding new planning docs.
- **Planned stack is TypeScript + Node 22** (PRD §技术栈). Go and Rust were considered and rejected for Phase 0. If implementation starts, assume a pnpm monorepo with `apps/cli` + `packages/*` + `adapters/*` + `examples/*` as laid out in the PRD.
- **`.omc/` and `.omx/`** are OMC harness state directories — not project artifacts. Ignore them.