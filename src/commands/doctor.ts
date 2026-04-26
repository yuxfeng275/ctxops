import chalk from 'chalk';
import path from 'node:path';
import { isGitRepo, getGitRoot, getChangedFiles, getStagedFiles, getFileDiffStat, getLastModifiedDate, daysSince, getCurrentBranch, isFileInChangedList } from '../lib/git.js';
import { isInitialized, readConfig } from '../lib/config.js';
import { readLinks, upsertLink } from '../lib/links.js';
import { findMatchingChangedFiles } from '../lib/glob.js';
import { findMarkdownFiles, autoDiscoverLinks } from '../lib/auto-linker.js';
import { buildMetadata } from '../lib/inference.js';
import {
  formatDoctorReportJson,
  formatDoctorReportSarif,
  formatStrictFailure,
  type DoctorResult,
  type DoctorReport,
  type DoctorStatus,
} from '../lib/output.js';
import {
  extractChangedIdentifiers,
  getChangeSummary,
  verifyDocSync,
  findDocReferences,
  detectStructuralChanges,
} from '../lib/drift-analyzer.js';

interface DoctorOptions {
  base: string;
  format?: 'text' | 'json' | 'sarif';
  mode?: 'warn' | 'strict';
  ci?: boolean;
  explain?: boolean;
  staged?: boolean;
}

export async function doctorCommand(options: DoctorOptions): Promise<void> {
  const cwd = process.cwd();

  if (!isGitRepo(cwd)) {
    console.error(chalk.red('Error: not a git repository.'));
    process.exit(1);
  }

  const root = getGitRoot(cwd);

  if (!isInitialized(root)) {
    console.error(chalk.red('Error: ctxops is not initialized. Run "ctx init" first.'));
    process.exit(2);
  }

  const config = readConfig(root);
  let linksFile = readLinks(root);

  // Auto-discover links if none exist
  if (linksFile.links.length === 0) {
    const contextDir = path.join(root, config.contextDir);
    const mdFiles = findMarkdownFiles(contextDir);

    if (mdFiles.length === 0) {
      console.log('No links found and no docs in ' + config.contextDir + '.');
      console.log('Run "ctx link --auto" or create docs in docs/ai/.');
      process.exit(0);
    }

    let autoLinked = 0;
    for (const mdFile of mdFiles) {
      if (path.basename(mdFile).startsWith('_')) continue;
      const relPath = path.relative(root, mdFile);
      const { codePaths } = autoDiscoverLinks(mdFile, root);
      if (codePaths.length > 0) {
        const metadata = buildMetadata(relPath, root);
        upsertLink(root, relPath, codePaths, metadata);
        autoLinked++;
      }
    }

    if (autoLinked > 0) {
      console.log(chalk.dim(`Auto-discovered ${autoLinked} link(s) from docs.\n`));
      linksFile = readLinks(root);
    } else {
      console.log('No links found. Run "ctx link --auto" to create document-code associations.');
      process.exit(0);
    }
  }

  const mode = options.mode ?? config.doctor.defaultMode;
  const format = options.format ?? 'text';
  const threshold = config.doctor.freshnessThresholdDays;

  // Get changed files
  let changedFiles: string[];
  try {
    if (options.staged) {
      changedFiles = getStagedFiles(root);
    } else {
      changedFiles = getChangedFiles(options.base, root);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`Error: ${message}`));
    process.exit(1);
  }

  const head = getCurrentBranch(root);
  const baseRef = options.staged ? 'HEAD' : options.base;

  // Analyze each linked document
  const results: DoctorResult[] = [];

  for (const link of linksFile.links) {
    const matchingFiles = findMatchingChangedFiles(changedFiles, link.codePaths);

    if (matchingFiles.length === 0) {
      results.push({
        document: link.document,
        status: 'unaffected',
        severity: 'none',
        lastUpdated: null,
        daysSinceUpdate: null,
        freshnessThreshold: threshold,
        affectedBy: [],
      });
      continue;
    }

    // Collect changed identifiers from ALL affected code files
    const allIdentifiers: string[] = [];
    const changeSummaries: string[] = [];
    for (const f of matchingFiles) {
      const ids = extractChangedIdentifiers(baseRef, f, root);
      allIdentifiers.push(...ids);
      const summaries = getChangeSummary(baseRef, f, root);
      changeSummaries.push(...summaries);
    }
    const uniqueIdentifiers = [...new Set(allIdentifiers)];

    // Detect structural changes
    const structural = detectStructuralChanges(baseRef, changedFiles, link.codePaths, root);

    // Check if document was also updated
    const docUpdatedInPR = isFileInChangedList(link.document, changedFiles);

    if (docUpdatedInPR) {
      // KEY FIX: Don't blindly say "synced". Verify the doc actually addresses changes.
      const verification = verifyDocSync(baseRef, link.document, uniqueIdentifiers, root);

      let status: DoctorStatus;
      let severity: 'error' | 'warning' | 'info' | 'none';

      switch (verification.verdict) {
        case 'truly_synced':
          status = 'synced';
          severity = 'none';
          break;
        case 'touched_only':
          // Doc was touched but diff is trivial (whitespace only)
          status = 'drifted';
          severity = 'warning';
          break;
        case 'unverified':
        default:
          // Can't determine — give benefit of the doubt but mark as unverified
          status = 'synced';
          severity = 'none';
          break;
      }

      results.push({
        document: link.document,
        status,
        severity,
        syncVerdict: verification.verdict,
        lastUpdated: new Date().toISOString(),
        daysSinceUpdate: 0,
        freshnessThreshold: threshold,
        affectedBy: matchingFiles.map((f) => ({
          file: f,
          ...getFileDiffStat(baseRef, f, root),
        })),
        changedIdentifiers: uniqueIdentifiers,
        changeSummaries,
      } as DoctorResult);
      continue;
    }

    // Document NOT updated but code changed
    const lastMod = getLastModifiedDate(link.document, root);
    const days = lastMod ? daysSince(lastMod) : null;
    const isStale = days != null && days > threshold;

    // For project-scope docs with broad globs, only alert on structural changes
    const isBroadScope = link.codePaths.some(p => {
      const depth = p.replace(/\/\*\*$/, '').split('/').length;
      return depth <= 1; // e.g. "src/**" (depth 1)
    });

    if (isBroadScope && !structural.hasStructural && matchingFiles.length > 0) {
      // Broad scope doc, only modifications (no new/deleted files) → demote to info
      results.push({
        document: link.document,
        status: 'drifted',
        severity: 'info',
        lastUpdated: lastMod?.toISOString() ?? null,
        daysSinceUpdate: days,
        freshnessThreshold: threshold,
        affectedBy: matchingFiles.map((f) => ({
          file: f,
          ...getFileDiffStat(baseRef, f, root),
        })),
        changedIdentifiers: uniqueIdentifiers,
        changeSummaries,
        broadScopeDemoted: true,
      } as DoctorResult);
      continue;
    }

    const status: DoctorStatus = isStale ? 'stale_drifted' : 'drifted';
    const severity = isStale ? 'error' : 'warning';

    results.push({
      document: link.document,
      status,
      severity: severity as 'error' | 'warning',
      lastUpdated: lastMod?.toISOString() ?? null,
      daysSinceUpdate: days,
      freshnessThreshold: threshold,
      affectedBy: matchingFiles.map((f) => ({
        file: f,
        ...getFileDiffStat(baseRef, f, root),
      })),
      changedIdentifiers: uniqueIdentifiers,
      changeSummaries,
      newFiles: structural.newFiles,
      deletedFiles: structural.deletedFiles,
    } as DoctorResult);
  }

  // Build summary
  const summary = {
    stale: results.filter((r) => r.status === 'stale_drifted').length,
    drifted: results.filter((r) => r.status === 'drifted').length,
    synced: results.filter((r) => r.status === 'synced').length,
    unaffected: results.filter((r) => r.status === 'unaffected').length,
  };

  const report: DoctorReport = {
    base: options.staged ? '(staged)' : options.base,
    head,
    changedFiles: changedFiles.length,
    linkedDocuments: linksFile.links.length,
    results,
    summary,
  };

  // Output
  switch (format) {
    case 'json':
      console.log(formatDoctorReportJson(report));
      break;
    case 'sarif':
      console.log(formatDoctorReportSarif(report));
      break;
    default:
      console.log(formatDoctorReportText(report));
      break;
  }

  // Explain mode
  if (options.explain && format === 'text') {
    printExplanation(report, linksFile, root, baseRef);
  }

  // Strict mode: exit 1 if real issues found (not info-demoted)
  const realIssues = results.filter(r =>
    (r.status === 'stale_drifted' || r.status === 'drifted') &&
    r.severity !== 'info'
  );
  if (mode === 'strict' && realIssues.length > 0) {
    if (format === 'text') {
      console.log(formatStrictFailure(report));
    }
    process.exit(1);
  }
}

// ── Enhanced text formatter ──

function formatDoctorReportText(report: DoctorReport): string {
  const lines: string[] = [];

  lines.push(chalk.bold(`ctx doctor: checking context integrity against ${report.base}...`));
  lines.push('');
  lines.push(`Changed files: ${report.changedFiles}`);
  lines.push(`Linked documents: ${report.linkedDocuments}`);

  const affected = report.results.filter((r) => r.status !== 'unaffected');
  lines.push(`Affected documents: ${affected.length}`);
  lines.push('');

  for (const result of report.results) {
    if (result.status === 'unaffected') continue;

    const r = result as any;

    if (result.status === 'stale_drifted') {
      lines.push(
        chalk.red.bold('🔴 STALE + DRIFTED') + '  ' + chalk.white(result.document),
      );
      lines.push(
        `   Last updated: ${result.daysSinceUpdate} days ago ${chalk.dim(`(threshold: ${result.freshnessThreshold} days)`)}`,
      );
    } else if (result.status === 'drifted') {
      if (r.broadScopeDemoted) {
        lines.push(
          chalk.dim('ℹ  MINOR DRIFT') + '       ' + chalk.white(result.document),
        );
        lines.push(chalk.dim('   Broad-scope doc, only code modifications (no new/deleted files)'));
      } else if (r.syncVerdict === 'touched_only') {
        lines.push(
          chalk.yellow.bold('🟡 TOUCHED ONLY') + '     ' + chalk.white(result.document),
        );
        lines.push(chalk.yellow('   Doc was modified but change appears trivial (whitespace/formatting only)'));
      } else {
        lines.push(
          chalk.yellow.bold('🟡 DRIFTED') + '          ' + chalk.white(result.document),
        );
        lines.push(`   Last updated: ${result.daysSinceUpdate ?? '?'} days ago`);
      }
    } else if (result.status === 'synced') {
      const syncLabel = r.syncVerdict === 'truly_synced'
        ? chalk.green.bold('✔  SYNCED (verified)')
        : chalk.green('✔  SYNCED');
      lines.push(syncLabel + '   ' + chalk.white(result.document));
      lines.push(chalk.dim('   Updated in this PR'));
    }

    // Show changed identifiers
    if (r.changedIdentifiers?.length > 0 && result.status !== 'synced') {
      lines.push(`   Code changes: ${chalk.cyan(r.changedIdentifiers.slice(0, 5).join(', '))}${r.changedIdentifiers.length > 5 ? ` +${r.changedIdentifiers.length - 5} more` : ''}`);
    }

    // Show structural changes
    if (r.newFiles?.length > 0) {
      lines.push(`   New files: ${chalk.green(r.newFiles.join(', '))}`);
    }
    if (r.deletedFiles?.length > 0) {
      lines.push(`   Deleted files: ${chalk.red(r.deletedFiles.join(', '))}`);
    }

    if (result.affectedBy.length > 0 && result.status !== 'synced' && !r.broadScopeDemoted) {
      lines.push('   Affected by:');
      for (const af of result.affectedBy.slice(0, 5)) {
        lines.push(
          `     ${af.file}  ${chalk.green(`+${af.additions}`)} ${chalk.red(`-${af.deletions}`)}`,
        );
      }
      if (result.affectedBy.length > 5) {
        lines.push(chalk.dim(`     ... +${result.affectedBy.length - 5} more files`));
      }
    }

    lines.push('');
  }

  const { stale, drifted, synced, unaffected } = report.summary;
  lines.push(
    `Summary: ${stale} stale, ${drifted} drifted, ${synced} synced, ${unaffected} unaffected`,
  );

  return lines.join('\n');
}

// ── Explain mode ──

function printExplanation(
  report: DoctorReport,
  linksFile: { links: Array<{ document: string; codePaths: string[]; metadata: { inferredFrom: string } }> },
  root: string,
  baseRef: string,
): void {
  const flagged = report.results.filter(r =>
    r.status === 'drifted' || r.status === 'stale_drifted'
  );
  if (flagged.length === 0) return;

  console.log(chalk.bold('\n── Explain ──\n'));

  for (const r of flagged) {
    const link = linksFile.links.find(l => l.document === r.document);
    const result = r as any;

    console.log(chalk.yellow(`  ${r.document}`));
    console.log(chalk.dim(`    Linked to: ${link?.codePaths.join(', ')}`));
    console.log(chalk.dim(`    Source: ${link?.metadata.inferredFrom ?? 'manual'}`));

    // Show affected files with change summaries
    for (const af of r.affectedBy.slice(0, 5)) {
      console.log(chalk.dim(`    Changed: ${af.file}  +${af.additions} -${af.deletions}`));
    }

    // Show changed identifiers
    if (result.changedIdentifiers?.length > 0) {
      console.log(chalk.cyan(`    Changed code: ${result.changedIdentifiers.join(', ')}`));

      // Find references in doc content
      const refs = findDocReferences(r.document, result.changedIdentifiers, root);
      if (refs.length > 0) {
        console.log(chalk.yellow('    ⚠ Doc references that may need update:'));
        for (const ref of refs) {
          console.log(chalk.yellow(`      L${ref.line}: "${ref.text.substring(0, 60)}${ref.text.length > 60 ? '...' : ''}" → mentions ${chalk.bold(ref.identifier)}`));
        }
      }
    }

    console.log('');
  }
}
