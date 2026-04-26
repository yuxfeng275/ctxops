# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository status

This is an active TypeScript CLI project at **v0.2.0**. The source code is in `src/`, tests in `tests/`, and it builds with `npm run build` (tsc). Run `npm test` to execute the test suite.

## What ctxops is

A **CLI-first Context Integrity Engine** for AI coding tools. Core thesis: **don't build another coding agent — build the context integrity layer coding agents depend on.**

The product is **doctor-first**: the core differentiator is `ctx doctor` (PR-level context drift detection). It detects when documentation drifts from code — right in your PR — so AI never acts on stale context.

## Commands

```bash
ctx init                          # Scaffold .ctxops/, docs/ai/, AGENTS.md, Claude skill
ctx link --auto                   # 5-layer auto-discovery of document-code links
ctx link <doc> "<glob>"           # Manual link
ctx doctor --base main            # PR-level drift detection
ctx doctor --base main --deep     # Include semantic analysis (Layer 5)
ctx status                        # Context health overview
ctx hook install                  # Pre-commit hook
```

## Project structure

```
src/
  cli.ts                          # CLI entry point (commander)
  commands/
    init.ts                       # ctx init
    link.ts                       # ctx link (--auto, --list, --remove)
    doctor.ts                     # ctx doctor (--base, --format, --mode, --explain)
    status.ts                     # ctx status (--coverage)
    hook.ts                       # ctx hook install/remove
  lib/
    auto-linker.ts                # 5-layer auto-discovery engine
    smart-linker.ts               # Layer 4 (git co-change) + Layer 5 (semantic grep)
    git.ts                        # Git operations wrapper
    links.ts                      # .ctxops/links.json read/write
    config.ts                     # .ctxops/config.json read/write
    glob.ts                       # Glob matching
    inference.ts                  # Metadata inference from paths
    output.ts                     # Output formatting (text/json/sarif)
tests/
  e2e.test.ts                    # End-to-end tests with temp git repos
```

## Tech stack

- TypeScript + Node.js 18+ (ESM)
- Dependencies: chalk, commander, minimatch (zero LLM, zero cloud)
- Build: tsc
- Test: vitest

## When working in this repo

- **Docs are kept in sync with code.** After any code change, update both `README.md` (EN) and `README.zh-CN.md` (CN).
- Run `npm run build` to verify TypeScript compilation.
- Run `npm test` to run the E2E test suite.
- The project uses its own tool for self-checking: `node dist/cli.js doctor --base main`.