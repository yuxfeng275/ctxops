import { existsSync } from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { isGitRepo, getGitRoot, getLastModifiedDate, daysSince } from '../lib/git.js';
import { isInitialized, readConfig } from '../lib/config.js';
import { readLinks, upsertLink, removeLink, type CodePathEntry } from '../lib/links.js';
import { buildMetadata } from '../lib/inference.js';
import { formatLinkListText, formatLinkListJson } from '../lib/output.js';
import { findMarkdownFiles, autoDiscoverLinks } from '../lib/auto-linker.js';
import { detectContextFiles } from '../lib/formats.js';

interface LinkOptions {
  remove?: boolean;
  list?: boolean;
  auto?: boolean;
  deep?: boolean;
  format?: 'text' | 'json';
}

export async function linkCommand(
  args: string[],
  options: LinkOptions,
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

  // ── Auto mode ──────────────────────────────────────
  if (options.auto) {
    await autoLinkMode(root, options.deep);
    return;
  }

  // ── List mode ───────────────────────────────────────
  if (options.list) {
    const linksFile = readLinks(root);

    if (options.format === 'json') {
      console.log(formatLinkListJson(linksFile.links));
      return;
    }

    // Calculate freshness for each link
    const freshnessDays = new Map<string, number | null>();
    for (const link of linksFile.links) {
      const lastMod = getLastModifiedDate(link.document, root);
      freshnessDays.set(link.document, lastMod ? daysSince(lastMod) : null);
    }

    console.log(formatLinkListText(linksFile.links, freshnessDays));
    return;
  }

  // ── Remove mode ─────────────────────────────────────
  if (options.remove) {
    const document = args[0];
    if (!document) {
      console.error(chalk.red('Error: document path required for --remove.'));
      process.exit(1);
    }

    const removed = removeLink(root, document);
    if (removed) {
      console.log(chalk.green('✔') + ` Removed link for ${document}`);
    } else {
      console.error(chalk.yellow(`No link found for ${document}`));
    }
    return;
  }

  // ── Link mode ───────────────────────────────────────
  if (args.length < 2) {
    console.error(chalk.red('Error: requires <document> and at least one <code-path>.'));
    console.error('Usage: ctx link <document> <code-paths...>');
    console.error('   or: ctx link --auto');
    process.exit(1);
  }

  const document = args[0]!;
  const codePaths = args.slice(1);

  // Validate document exists
  const docFullPath = path.join(root, document);
  if (!existsSync(docFullPath)) {
    console.error(chalk.red(`Error: document not found: ${document}`));
    process.exit(2);
  }

  // Validate at least one code path has matches (or could match)
  // For globs we just validate format, actual matching happens at doctor time
  if (codePaths.length === 0) {
    console.error(chalk.red('Error: at least one code path is required.'));
    process.exit(3);
  }

  // Build metadata (inference + overrides)
  const metadata = buildMetadata(document, root);

  // Upsert link
  const entry = upsertLink(root, document, codePaths, metadata);

  // Get freshness
  const lastMod = getLastModifiedDate(document, root);
  const days = lastMod ? daysSince(lastMod) : null;

  // Output
  console.log(chalk.green('✔') + ` Linked: ${document}`);
  for (const cp of codePaths) {
    console.log(`  → ${cp}`);
  }
  console.log(`  Scope: ${metadata.scope} (${metadata.inferredFrom === 'explicit' ? 'explicit override' : 'inferred from path'})`);
  if (days != null) {
    console.log(`  Freshness: ${days} days (from git blame)`);
  }
}

// ── Auto-link implementation ─────────────────────────

async function autoLinkMode(root: string, deep?: boolean): Promise<void> {
  const config = readConfig(root);
  const contextDir = path.join(root, config.contextDir);

  console.log(chalk.bold('ctx link --auto: scanning for document-code associations...\n'));

  // Phase 1: Detect known context files
  const contextFiles = detectContextFiles(root);
  if (contextFiles.length > 0) {
    console.log(chalk.dim('  Detected context files:'));
    for (const cf of contextFiles) {
      console.log(chalk.dim(`    ${cf.format.name}: ${cf.path} (${cf.format.tools.join(', ')})`));
    }
    console.log('');
  }

  const mdFiles = findMarkdownFiles(contextDir);

  // Also include detected context files that are not in contextDir
  const allDocs = [...mdFiles];
  for (const cf of contextFiles) {
    const fullPath = path.join(root, cf.path);
    if (!allDocs.includes(fullPath) && cf.path.endsWith('.md')) {
      allDocs.push(fullPath);
    }
  }

  if (allDocs.length === 0) {
    console.log(chalk.yellow('No markdown files found in ' + config.contextDir));
    return;
  }

  let linked = 0;
  let skipped = 0;

  for (const mdFile of allDocs) {
    const relPath = path.relative(root, mdFile);

    // Skip template files
    if (path.basename(mdFile).startsWith('_')) {
      skipped++;
      continue;
    }

    const { codePaths, sources, details } = autoDiscoverLinks(mdFile, root, { deep });

    if (codePaths.length === 0) {
      console.log(chalk.dim(`  ○ ${relPath} — no code paths found, skipped`));
      skipped++;
      continue;
    }

    // Build metadata and upsert with confidence details
    const metadata = buildMetadata(relPath, root);
    const codePathDetails: CodePathEntry[] = details.map(d => ({
      path: d.path,
      confidence: d.confidence,
      source: d.source,
    }));
    upsertLink(root, relPath, codePaths, metadata, codePathDetails);
    linked++;

    console.log(chalk.green('  ✔') + ` ${relPath}`);
    for (const d of details) {
      const confColor = d.confidence >= 0.7 ? chalk.green : d.confidence >= 0.5 ? chalk.yellow : chalk.dim;
      const confStr = confColor(`[${(d.confidence * 100).toFixed(0)}%]`);
      console.log(`    → ${d.path}  ${confStr}  ${chalk.dim(d.source)}`);
    }
  }

  console.log('');
  console.log(chalk.bold(`Done: ${linked} linked, ${skipped} skipped`));

  if (linked > 0) {
    console.log(chalk.dim('\nRun "ctx link --list" to review, or "ctx doctor --base main" to check integrity.'));
  }
}
