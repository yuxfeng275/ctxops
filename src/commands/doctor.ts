import chalk from 'chalk';
import path from 'node:path';
import { isGitRepo, getGitRoot, getChangedFiles, getFileDiffStat, getLastModifiedDate, daysSince, getCurrentBranch, isFileInChangedList } from '../lib/git.js';
import { isInitialized, readConfig } from '../lib/config.js';
import { readLinks, upsertLink } from '../lib/links.js';
import { findMatchingChangedFiles } from '../lib/glob.js';
import { findMarkdownFiles, autoDiscoverLinks } from '../lib/auto-linker.js';
import { buildMetadata } from '../lib/inference.js';
import {
  formatDoctorReportText,
  formatDoctorReportJson,
  formatDoctorReportSarif,
  formatStrictFailure,
  type DoctorResult,
  type DoctorReport,
  type DoctorStatus,
} from '../lib/output.js';

interface DoctorOptions {
  base: string;
  format?: 'text' | 'json' | 'sarif';
  mode?: 'warn' | 'strict';
  ci?: boolean;
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

    // Auto-discover and persist
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
  const changedFiles = getChangedFiles(options.base, root);
  const head = getCurrentBranch(root);

  // Analyze each linked document
  const results: DoctorResult[] = [];

  for (const link of linksFile.links) {
    // Find which changed files match this link's code paths
    const matchingFiles = findMatchingChangedFiles(changedFiles, link.codePaths);

    if (matchingFiles.length === 0) {
      // Document's code paths not affected
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

    // Code paths were changed — check if document was also updated
    const docUpdatedInPR = isFileInChangedList(link.document, changedFiles);

    if (docUpdatedInPR) {
      results.push({
        document: link.document,
        status: 'synced',
        severity: 'none',
        lastUpdated: new Date().toISOString(),
        daysSinceUpdate: 0,
        freshnessThreshold: threshold,
        affectedBy: matchingFiles.map((f) => ({
          file: f,
          ...getFileDiffStat(options.base, f, root),
        })),
      });
      continue;
    }

    // Document NOT updated but code changed
    const lastMod = getLastModifiedDate(link.document, root);
    const days = lastMod ? daysSince(lastMod) : null;
    const isStale = days != null && days > threshold;

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
        ...getFileDiffStat(options.base, f, root),
      })),
    });
  }

  // Build summary
  const summary = {
    stale: results.filter((r) => r.status === 'stale_drifted').length,
    drifted: results.filter((r) => r.status === 'drifted').length,
    synced: results.filter((r) => r.status === 'synced').length,
    unaffected: results.filter((r) => r.status === 'unaffected').length,
  };

  const report: DoctorReport = {
    base: options.base,
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

  // Strict mode: exit 1 if issues found
  if (mode === 'strict' && (summary.stale > 0 || summary.drifted > 0)) {
    if (format === 'text') {
      console.log(formatStrictFailure(report));
    }
    process.exit(1);
  }
}
