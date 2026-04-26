import chalk from 'chalk';
import { existsSync, writeFileSync, mkdirSync, chmodSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { isGitRepo, getGitRoot } from '../lib/git.js';
import { isInitialized } from '../lib/config.js';

interface HookOptions {
  remove?: boolean;
}

const HOOK_CONTENT = `#!/bin/sh
# ctxops pre-commit hook
# Checks context integrity before committing.
# Install: ctx hook install
# Remove:  ctx hook remove

# Only run if ctxops is initialized
if [ ! -f ".ctxops/config.json" ]; then
  exit 0
fi

# Use --staged mode to check files being committed (not PR diff)
npx --yes ctxops doctor --base HEAD --staged --mode warn 2>/dev/null

# To make this blocking, change --mode warn to --mode strict
`;

export async function hookCommand(
  action: string,
  options: HookOptions,
): Promise<void> {
  const cwd = process.cwd();

  if (!isGitRepo(cwd)) {
    console.error(chalk.red('Error: not a git repository.'));
    process.exit(1);
  }

  const root = getGitRoot(cwd);

  if (!isInitialized(root)) {
    console.error(chalk.red('Error: ctxops is not initialized. Run "ctx init" first.'));
    process.exit(1);
  }

  const hooksDir = path.join(root, '.git', 'hooks');
  const hookPath = path.join(hooksDir, 'pre-commit');

  if (action === 'remove' || options.remove) {
    if (existsSync(hookPath)) {
      const content = readFileSync(hookPath, 'utf-8');
      if (content.includes('ctxops')) {
        writeFileSync(hookPath, '#!/bin/sh\n');
        console.log(chalk.green('✔') + ' Removed ctxops pre-commit hook');
      } else {
        console.log(chalk.yellow('Pre-commit hook exists but is not a ctxops hook. Skipped.'));
      }
    } else {
      console.log(chalk.dim('No pre-commit hook found.'));
    }
    return;
  }

  if (action === 'install') {
    // Check if hook already exists
    if (existsSync(hookPath)) {
      const existing = readFileSync(hookPath, 'utf-8');
      if (existing.includes('ctxops')) {
        console.log(chalk.yellow('ctxops pre-commit hook is already installed.'));
        return;
      }
      // Append to existing hook
      writeFileSync(hookPath, existing + '\n' + HOOK_CONTENT);
      console.log(chalk.green('✔') + ' Appended ctxops check to existing pre-commit hook');
    } else {
      mkdirSync(hooksDir, { recursive: true });
      writeFileSync(hookPath, HOOK_CONTENT);
      console.log(chalk.green('✔') + ' Installed ctxops pre-commit hook');
    }

    chmodSync(hookPath, '755');
    console.log('');
    console.log(chalk.dim('  Hook uses --staged mode (checks files being committed).'));
    console.log(chalk.dim('  Edit .git/hooks/pre-commit to switch to --mode strict.'));
    return;
  }

  // Default: show status
  if (existsSync(hookPath)) {
    const content = readFileSync(hookPath, 'utf-8');
    if (content.includes('ctxops')) {
      console.log(chalk.green('✔') + ' ctxops pre-commit hook is installed');
    } else {
      console.log(chalk.dim('Pre-commit hook exists but does not include ctxops.'));
      console.log(chalk.dim('Run "ctx hook install" to add ctxops checking.'));
    }
  } else {
    console.log(chalk.dim('No pre-commit hook installed.'));
    console.log(chalk.dim('Run "ctx hook install" to add ctxops checking.'));
  }
}
