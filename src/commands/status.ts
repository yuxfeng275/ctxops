import chalk from 'chalk';
import path from 'node:path';
import { isGitRepo, getGitRoot, getLastModifiedDate, daysSince } from '../lib/git.js';
import { isInitialized, readConfig } from '../lib/config.js';
import { readLinks } from '../lib/links.js';
import { findMarkdownFiles, autoDiscoverLinks } from '../lib/auto-linker.js';
import { buildMetadata } from '../lib/inference.js';
import { upsertLink } from '../lib/links.js';

interface StatusOptions {
  format?: 'text' | 'json';
}

export async function statusCommand(options: StatusOptions): Promise<void> {
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

  const config = readConfig(root);
  let linksFile = readLinks(root);

  // Auto-discover if no links
  if (linksFile.links.length === 0) {
    const contextDir = path.join(root, config.contextDir);
    const mdFiles = findMarkdownFiles(contextDir);
    for (const mdFile of mdFiles) {
      if (path.basename(mdFile).startsWith('_')) continue;
      const relPath = path.relative(root, mdFile);
      const { codePaths } = autoDiscoverLinks(mdFile, root);
      if (codePaths.length > 0) {
        const metadata = buildMetadata(relPath, root);
        upsertLink(root, relPath, codePaths, metadata);
      }
    }
    linksFile = readLinks(root);
  }

  const threshold = config.doctor.freshnessThresholdDays;

  // Analyze each document
  const docs: Array<{
    document: string;
    codePaths: number;
    daysSinceUpdate: number | null;
    health: 'fresh' | 'aging' | 'stale';
  }> = [];

  for (const link of linksFile.links) {
    const lastMod = getLastModifiedDate(link.document, root);
    const days = lastMod ? daysSince(lastMod) : null;

    let health: 'fresh' | 'aging' | 'stale' = 'fresh';
    if (days != null) {
      if (days > threshold) health = 'stale';
      else if (days > threshold * 0.7) health = 'aging';
    }

    docs.push({
      document: link.document,
      codePaths: link.codePaths.length,
      daysSinceUpdate: days,
      health,
    });
  }

  const fresh = docs.filter(d => d.health === 'fresh').length;
  const aging = docs.filter(d => d.health === 'aging').length;
  const stale = docs.filter(d => d.health === 'stale').length;
  const total = docs.length;

  if (options.format === 'json') {
    console.log(JSON.stringify({ total, fresh, aging, stale, threshold, documents: docs }, null, 2));
    return;
  }

  // Text output
  console.log(chalk.bold('ctxops status\n'));

  if (total === 0) {
    console.log(chalk.yellow('No linked documents found.'));
    console.log('Run "ctx link --auto" to discover links.');
    return;
  }

  // Health bar
  const barWidth = 30;
  const freshBar = Math.round((fresh / total) * barWidth);
  const agingBar = Math.round((aging / total) * barWidth);
  const staleBar = barWidth - freshBar - agingBar;

  const bar = chalk.green('█'.repeat(freshBar)) +
    chalk.yellow('█'.repeat(agingBar)) +
    chalk.red('█'.repeat(Math.max(0, staleBar)));

  const pct = Math.round((fresh / total) * 100);
  console.log(`  Context Health: ${bar} ${pct}%`);
  console.log('');
  console.log(`  ${chalk.green('●')} Fresh: ${fresh}    ${chalk.yellow('●')} Aging: ${aging}    ${chalk.red('●')} Stale: ${stale}    Total: ${total}`);
  console.log(`  Freshness threshold: ${threshold} days`);
  console.log('');

  // Document list
  const statusIcon = (h: string) => h === 'fresh' ? chalk.green('✔') : h === 'aging' ? chalk.yellow('◐') : chalk.red('✖');

  for (const doc of docs) {
    const days = doc.daysSinceUpdate != null ? `${doc.daysSinceUpdate}d ago` : 'unknown';
    console.log(`  ${statusIcon(doc.health)}  ${doc.document}  ${chalk.dim(days)}  ${chalk.dim(`(${doc.codePaths} paths)`)}`);
  }
}
