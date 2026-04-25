# Context Integrity — ctxops

This repository uses ctxops for AI context integrity management.

## Rules

1. Before modifying code, check context: `npx ctxops doctor --base main --format json`
2. After modifying code, verify no drift: `npx ctxops doctor --base main`
3. If documents show "drifted", update them in the same commit
4. To get relevant context for a file, check `npx ctxops link --list --format json` and read linked docs
5. When creating new context docs in `docs/ai/`, run `npx ctxops link --auto`

## Context Documents

AI context documents are in `docs/ai/`. Each document is linked to code paths.
The `doctor` command detects when code changes but linked documents don't.
Always keep documents synchronized with code changes.
