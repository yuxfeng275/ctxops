---
name: ctxops-integrity-check
description: Context Integrity Engine — automatically check and maintain AI context document freshness when modifying code. Run before and after code changes to detect stale documentation.
---

# ctxops — Context Integrity Skill

## When to activate

Activate this skill when ANY of these conditions are met:

1. **Before modifying code**: Check if relevant context docs exist and are up-to-date
2. **After modifying code**: Detect if your changes caused context drift
3. **When the user asks about documentation, context, or "docs"**
4. **When starting work on a new feature branch**

## Setup check

First, check if ctxops is initialized:

```bash
ls .ctxops/config.json 2>/dev/null && echo "INITIALIZED" || echo "NOT_INITIALIZED"
```

If NOT_INITIALIZED, run:
```bash
npx ctxops init
npx ctxops link --auto
```

## Pre-code workflow

**Before writing or modifying code**, check context integrity:

```bash
npx ctxops doctor --base main --format json
```

Parse the JSON output. For each result:
- `"status": "stale_drifted"` or `"status": "drifted"` → Read the document, note it may be outdated. Cross-reference with actual code before relying on it.
- `"status": "synced"` → Safe to use as accurate context.
- `"status": "unaffected"` → Not relevant to current changes.

**To get context for a specific code path**, find linked documents:

```bash
npx ctxops link --list --format json
```

Then read the relevant document files directly.

## Post-code workflow

**After modifying code files**, check if context documents need updating:

```bash
npx ctxops doctor --base main --format json
```

If any documents show `"drifted"` or `"stale_drifted"`:

1. Read the drifted document
2. Read the code diff that caused the drift: `git diff main -- <affected-files>`
3. Determine if the document content is actually outdated
4. If yes, update the document to reflect the code changes
5. Run `npx ctxops doctor --base main` again to confirm status is now `"synced"`

## Auto-linking new documents

When you create a new context document in `docs/ai/`:

```bash
npx ctxops link --auto
```

Or manually link:
```bash
npx ctxops link <document-path> "<code-glob-pattern>"
```

## Key rules

1. **Never ignore drifted documents** — always check if they need updating
2. **Update docs in the same commit as code changes** — this is what makes doctor report "synced"
3. **Use `<!-- ctxops: paths=services/order/** -->` in docs** for explicit linking when auto-detection isn't sufficient
4. **Prefer JSON output** (`--format json`) for programmatic parsing
5. **In strict mode** (`--mode strict`), exit code 1 means context integrity check failed

## Document conventions

Context documents live in `docs/ai/` with this structure:
```
docs/ai/
  00-project-overview.md    → Project-level context
  01-architecture.md        → Architecture decisions
  modules/
    order.md                → Order module context (auto-links to services/order/**)
    inventory.md            → Inventory module context
  playbooks/
    bugfix.md               → Bug-fixing playbook
```

File names map to code directories by convention. `modules/order.md` automatically associates with `services/order/**`.
