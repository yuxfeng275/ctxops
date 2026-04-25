# Context Integrity — ctxops

This repository uses **ctxops** to maintain context integrity between AI documentation and code.

## For AI Agents

### Mandatory: Pre-code Check

Before modifying any code file, run:

```bash
npx ctxops doctor --base main --format json 2>/dev/null
```

If any document shows `"status": "drifted"`, read it but verify against actual code — the doc may be outdated.

### Mandatory: Post-code Check

After modifying code files, run:

```bash
npx ctxops doctor --base main
```

If documents are drifted, update them in the same commit. This ensures context stays synchronized.

### Getting Context for a Code Path

To understand the context for code you're about to modify:

1. Check links: `npx ctxops link --list --format json`
2. Find documents linked to your target path
3. Read those documents for architectural constraints and business rules

### Auto-fix Workflow

```bash
# 1. Check integrity
npx ctxops doctor --base main --format json

# 2. If drifted, read the doc and the diff
git diff main -- services/order/

# 3. Update the doc to match code reality

# 4. Verify fix
npx ctxops doctor --base main
# Should show "synced"
```

## For Humans

```bash
# Initialize
npx ctxops init

# Auto-discover document-code links
npx ctxops link --auto

# Check integrity before merge
npx ctxops doctor --base main --mode strict
```
