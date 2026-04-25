import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
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

  // Write template files (don't overwrite existing)
  const templates: Array<[string, string]> = [
    [path.join(contextDir, '00-project-overview.md'), PROJECT_OVERVIEW],
    [path.join(contextDir, '01-architecture.md'), ARCHITECTURE],
    [path.join(modulesDir, '_example.md'), EXAMPLE_MODULE],
    [path.join(playbooksDir, '_example-bugfix.md'), EXAMPLE_BUGFIX],
  ];

  const created: string[] = [];
  for (const [filePath, content] of templates) {
    if (!existsSync(filePath) || options.force) {
      writeFileSync(filePath, content);
      created.push(path.relative(root, filePath));
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
  console.log('');
  console.log('Next steps:');
  console.log('  1. Edit docs/ai/00-project-overview.md with your project info');
  console.log(
    '  2. Run: ' + chalk.bold('ctx link docs/ai/modules/order.md services/order/**'),
  );
  console.log('  3. Run: ' + chalk.bold('ctx doctor --base main'));
}
