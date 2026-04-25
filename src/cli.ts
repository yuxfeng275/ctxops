#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { linkCommand } from './commands/link.js';
import { doctorCommand } from './commands/doctor.js';

const program = new Command();

program
  .name('ctx')
  .description('ctxops — The Context Integrity Engine for AI Coding Teams')
  .version('0.1.0');

// ── ctx init ────────────────────────────────────────────────────
program
  .command('init')
  .description('Initialize ctxops in the current git repository')
  .option('--force', 'Overwrite existing .ctxops/ directory')
  .option('--template <name>', 'Template to use (default, spring, monorepo)', 'default')
  .action(async (options) => {
    await initCommand(options);
  });

// ── ctx link ────────────────────────────────────────────────────
program
  .command('link')
  .description('Create or manage document-code associations')
  .argument('[paths...]', 'Document path followed by code paths')
  .option('--auto', 'Auto-discover links from docs (zero config)')
  .option('--remove', 'Remove the link for the specified document')
  .option('--list', 'List all links')
  .option('--format <format>', 'Output format: text or json', 'text')
  .action(async (paths: string[], options) => {
    await linkCommand(paths, options);
  });

// ── ctx doctor ──────────────────────────────────────────────────
program
  .command('doctor')
  .description('Check context integrity against a base branch')
  .requiredOption('--base <branch>', 'Base branch to compare against')
  .option('--format <format>', 'Output format: text, json, or sarif', 'text')
  .option('--mode <mode>', 'Check mode: warn or strict')
  .option('--ci', 'CI mode: output GitHub Actions annotations')
  .action(async (options) => {
    await doctorCommand(options);
  });

program.parse();
