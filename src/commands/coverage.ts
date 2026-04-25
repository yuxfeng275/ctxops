import chalk from 'chalk';
import path from 'node:path';
import { readdirSync, statSync } from 'node:fs';
import { isGitRepo, getGitRoot } from '../lib/git.js';
import { isInitialized, readConfig } from '../lib/config.js';
import { readLinks } from '../lib/links.js';
import { findMatchingChangedFiles } from '../lib/glob.js';

interface CoverageOptions {
  format?: 'text' | 'json';
}

/**
 * Recursively find all code directories at depth 2.
 * e.g., services/order, services/inventory, src/lib
 */
function findCodeDirectories(root: string): string[] {
  const topLevelDirs = ['services', 'src', 'lib', 'packages', 'apps', 'modules', 'components', 'api', 'internal', 'cmd'];
  const results: string[] = [];

  for (const topDir of topLevelDirs) {
    const fullPath = path.join(root, topDir);
    if (!statSync(fullPath, { throwIfNoEntry: false })?.isDirectory()) continue;

    try {
      const entries = readdirSync(fullPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          results.push(`${topDir}/${entry.name}`);
        }
      }
      // Also include the top-level dir itself if it has code files directly
      const hasFiles = entries.some(e => e.isFile() && /\.(ts|js|java|py|go|rs|rb|kt|swift|cs|cpp|c|h)$/i.test(e.name));
      if (hasFiles) {
        results.push(topDir);
      }
    } catch {
      // Skip unreadable
    }
  }

  return results.sort();
}

export async function coverageCommand(options: CoverageOptions): Promise<void> {
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

  const linksFile = readLinks(root);
  const codeDirs = findCodeDirectories(root);

  if (codeDirs.length === 0) {
    console.log('No code directories found.');
    return;
  }

  // Check which code directories are covered by at least one link
  const covered: string[] = [];
  const uncovered: string[] = [];

  for (const codeDir of codeDirs) {
    const pattern = codeDir + '/**';
    let isCovered = false;

    for (const link of linksFile.links) {
      for (const codePath of link.codePaths) {
        // Check if any link's code path covers this directory
        if (codePath === pattern || codePath.startsWith(codeDir + '/') || codePath === codeDir + '/**') {
          isCovered = true;
          break;
        }
        // Check glob overlap: if codePath is "services/**", it covers "services/order"
        const codePathDir = codePath.replace(/\/\*\*$/, '');
        if (codeDir.startsWith(codePathDir + '/') || codeDir === codePathDir) {
          isCovered = true;
          break;
        }
      }
      if (isCovered) break;
    }

    if (isCovered) {
      covered.push(codeDir);
    } else {
      uncovered.push(codeDir);
    }
  }

  const total = codeDirs.length;
  const coveredCount = covered.length;
  const pct = total > 0 ? Math.round((coveredCount / total) * 100) : 0;

  if (options.format === 'json') {
    console.log(JSON.stringify({
      coverage: pct,
      total,
      covered: coveredCount,
      uncovered: uncovered.length,
      coveredPaths: covered,
      uncoveredPaths: uncovered,
    }, null, 2));
    return;
  }

  // Text output
  console.log(chalk.bold('ctxops coverage\n'));

  // Coverage bar
  const barWidth = 30;
  const filledBar = Math.round((pct / 100) * barWidth);
  const emptyBar = barWidth - filledBar;
  const color = pct >= 80 ? chalk.green : pct >= 50 ? chalk.yellow : chalk.red;
  const bar = color('█'.repeat(filledBar)) + chalk.dim('░'.repeat(emptyBar));

  console.log(`  Context Coverage: ${bar} ${pct}%`);
  console.log(`  ${coveredCount}/${total} code directories have linked context docs`);
  console.log('');

  if (covered.length > 0) {
    console.log(chalk.green('  Covered:'));
    for (const dir of covered) {
      console.log(chalk.green(`    ✔ ${dir}`));
    }
  }

  if (uncovered.length > 0) {
    console.log('');
    console.log(chalk.red('  Uncovered:'));
    for (const dir of uncovered) {
      console.log(chalk.red(`    ✖ ${dir}`) + chalk.dim('  ← needs context doc'));
    }
    console.log('');
    console.log(chalk.dim('  To cover a directory, create a doc and link it:'));
    console.log(chalk.dim(`    echo "# Module" > docs/ai/modules/${path.basename(uncovered[0]!)}.md`));
    console.log(chalk.dim(`    ctx link docs/ai/modules/${path.basename(uncovered[0]!)}.md "${uncovered[0]!}/**"`));
  }
}
