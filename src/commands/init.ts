import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { isGitRepo, getGitRoot } from '../lib/git.js';
import { isInitialized, writeConfig, getCtxopsDir } from '../lib/config.js';
import { initLinks } from '../lib/links.js';

interface InitOptions {
  force?: boolean;
  template?: string;
}

const EXAMPLE_MODULE = `<!-- ctxops: scope=module, paths=services/example/** -->

# 示例模块上下文

> 这是一个 ctxops 上下文片段示例。
> 删除本文件并创建你自己的模块文档。

## 模块职责

（描述本模块的核心职责和边界）

## 关键接口

（列出其他模块可能依赖的关键接口）

## 常见陷阱

（AI 容易犯的错误，或模块特有的约束）
`;

const PROJECT_OVERVIEW = `# 项目概览

> 在此描述你的项目。这个文件会被 ctxops 识别为 project scope 的上下文片段。

## 技术栈

（列出主要技术栈和框架）

## 项目结构

（概述代码目录结构和各模块职责）

## 开发约定

（团队的编码规范和架构约束）
`;

const ARCHITECTURE = `# 架构说明

> 在此描述系统的整体架构。

## 系统边界

（描述系统的输入和输出）

## 核心组件

（列出主要组件及其交互方式）

## 数据流

（描述关键的数据流转路径）
`;

const EXAMPLE_BUGFIX = `<!-- ctxops: scope=playbook -->

# Bugfix 剧本

> 当 AI 协助修复 Bug 时，应参考以下上下文。

## 排查步骤

1. 确认问题复现路径
2. 检查相关模块的状态机约束
3. 检查跨模块调用的接口契约
4. 编写回归测试

## 常见根因

（列出项目中常见的 Bug 类型和根因模式）
`;

const AGENTS_MD = `# Context Integrity — ctxops

This repository uses **ctxops** to maintain context integrity between AI documentation and code.

## For AI Agents

### Mandatory: Pre-code Check

Before modifying any code file, run:

\`\`\`bash
npx ctxops doctor --base main --format json 2>/dev/null
\`\`\`

If any document shows \`"status": "drifted"\`, read it but verify against actual code — the doc may be outdated.

### Mandatory: Post-code Check

After modifying code files, run:

\`\`\`bash
npx ctxops doctor --base main
\`\`\`

If documents are drifted, update them in the same commit.

### Getting Context

\`\`\`bash
npx ctxops link --list --format json
\`\`\`

Find documents linked to your target code path, then read those documents.

## For Humans

\`\`\`bash
npx ctxops init           # Initialize
npx ctxops link --auto     # Auto-discover links
npx ctxops doctor --base main --mode strict  # CI check
\`\`\`
`;

const CLAUDE_SKILL = `---
name: ctxops-integrity-check
description: Context Integrity Engine — check and maintain AI context document freshness when modifying code.
---

# ctxops — Context Integrity Skill

## When to activate

Activate this skill when:
1. Before modifying code — check if relevant context docs are up-to-date
2. After modifying code — detect if changes caused context drift
3. When the user asks about documentation or context

## Pre-code workflow

\`\`\`bash
npx ctxops doctor --base main --format json
\`\`\`

Parse JSON output. For \`"drifted"\` docs, cross-reference with actual code before relying on them.

## Post-code workflow

\`\`\`bash
npx ctxops doctor --base main --format json
\`\`\`

If documents are drifted:
1. Read the drifted document
2. Read the code diff: \`git diff main -- <affected-files>\`
3. Update the document to reflect code changes
4. Verify: \`npx ctxops doctor --base main\` shows "synced"

## Auto-linking

\`\`\`bash
npx ctxops link --auto
\`\`\`

## Key rules

- Never ignore drifted documents
- Update docs in the same commit as code changes
- Use \`--format json\` for programmatic parsing
- Document conventions: docs live in \`docs/ai/\`, file names map to code directories
`;

export async function initCommand(options: InitOptions): Promise<void> {
  const cwd = process.cwd();

  // Check git repo
  if (!isGitRepo(cwd)) {
    console.error(chalk.red('Error: not a git repository.'));
    console.error('ctxops requires a git repository. Run "git init" first.');
    process.exit(1);
  }

  const root = getGitRoot(cwd);

  // Check already initialized
  if (isInitialized(root) && !options.force) {
    console.error(chalk.red('Error: ctxops is already initialized.'));
    console.error('Use "ctx init --force" to re-initialize.');
    process.exit(2);
  }

  // Create .ctxops/
  const ctxopsDir = getCtxopsDir(root);
  mkdirSync(ctxopsDir, { recursive: true });

  // Write config.json
  writeConfig(root);

  // Write links.json
  initLinks(root);

  // Create docs/ai/ structure
  const contextDir = path.join(root, 'docs', 'ai');
  const modulesDir = path.join(contextDir, 'modules');
  const playbooksDir = path.join(contextDir, 'playbooks');

  mkdirSync(modulesDir, { recursive: true });
  mkdirSync(playbooksDir, { recursive: true });

  // Create agent skill directories
  const claudeSkillDir = path.join(root, '.claude', 'skills', 'ctxops');
  mkdirSync(claudeSkillDir, { recursive: true });

  // Write template files (don't overwrite existing)
  const templates: Array<[string, string]> = [
    [path.join(contextDir, '00-project-overview.md'), PROJECT_OVERVIEW],
    [path.join(contextDir, '01-architecture.md'), ARCHITECTURE],
    [path.join(modulesDir, '_example.md'), EXAMPLE_MODULE],
    [path.join(playbooksDir, '_example-bugfix.md'), EXAMPLE_BUGFIX],
    [path.join(root, 'AGENTS.md'), AGENTS_MD],
    [path.join(claudeSkillDir, 'SKILL.md'), CLAUDE_SKILL],
  ];

  const created: string[] = [];
  for (const [filePath, content] of templates) {
    if (!existsSync(filePath) || options.force) {
      writeFileSync(filePath, content);
      created.push(path.relative(root, filePath));
    }
  }

  // Write .gitattributes if not exists (merge strategy for links.json)
  const gitattributes = path.join(root, '.gitattributes');
  const gitattrsContent = '# ctxops: links.json is auto-regenerable, use ours on conflict\n.ctxops/links.json merge=ours\n';
  if (!existsSync(gitattributes)) {
    writeFileSync(gitattributes, gitattrsContent);
    created.push('.gitattributes');
  } else {
    const existing = readFileSync(gitattributes, 'utf-8');
    if (!existing.includes('.ctxops/links.json')) {
      writeFileSync(gitattributes, existing + '\n' + gitattrsContent);
    }
  }

  // Output
  console.log(chalk.green('✔') + ` Initialized ctxops in ${root}`);
  console.log('');
  console.log('Created:');
  console.log(`  ${chalk.cyan('.ctxops/config.json')}      — configuration`);
  console.log(`  ${chalk.cyan('.ctxops/links.json')}       — link registry (empty)`);
  console.log(`  ${chalk.cyan('docs/ai/')}                 — context fragments directory`);
  for (const file of created) {
    if (file.startsWith('docs/ai/')) {
      console.log(`  ${chalk.cyan(file)}`);
    }
  }
  if (created.includes('AGENTS.md')) {
    console.log(`  ${chalk.cyan('AGENTS.md')}               — agent instructions (Codex, Gemini, etc.)`);
  }
  if (created.some(f => f.includes('SKILL.md'))) {
    console.log(`  ${chalk.cyan('.claude/skills/ctxops/')}   — Claude Code skill`);
  }
  console.log('');
  console.log(chalk.dim('Note: Run "ctx init" once per project, then commit.'));
  console.log(chalk.dim('      Other team members just pull — no need to re-init.'));
  console.log(chalk.dim('      If links.json conflicts, run "ctx link --auto" to regenerate.'));
  console.log('');
  console.log('Next steps:');
  console.log('  1. Edit docs/ai/00-project-overview.md with your project info');
  console.log(
    '  2. Run: ' + chalk.bold('ctx link --auto') + ' (auto-discover links)',
  );
  console.log('  3. Commit and push — teammates just pull, no extra setup');
}
