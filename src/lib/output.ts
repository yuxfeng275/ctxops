import chalk from 'chalk';
import type { LinkEntry } from './links.js';

export type DoctorStatus = 'synced' | 'drifted' | 'stale_drifted' | 'unaffected';

export interface DoctorResult {
  document: string;
  status: DoctorStatus;
  severity: 'error' | 'warning' | 'info' | 'none';
  lastUpdated: string | null;
  daysSinceUpdate: number | null;
  freshnessThreshold: number;
  affectedBy: Array<{ file: string; additions: number; deletions: number }>;
}

export interface DoctorReport {
  base: string;
  head: string;
  changedFiles: number;
  linkedDocuments: number;
  results: DoctorResult[];
  summary: {
    stale: number;
    drifted: number;
    synced: number;
    unaffected: number;
  };
}

// ── Text formatter ──────────────────────────────────────────────

export function formatDoctorReportText(report: DoctorReport): string {
  const lines: string[] = [];

  lines.push(
    chalk.bold(`ctx doctor: checking context integrity against ${report.base}...`),
  );
  lines.push('');
  lines.push(`Changed files: ${report.changedFiles}`);
  lines.push(`Linked documents: ${report.linkedDocuments}`);

  // Count affected (non-unaffected)
  const affected = report.results.filter((r) => r.status !== 'unaffected');
  lines.push(`Affected documents: ${affected.length}`);
  lines.push('');

  for (const result of report.results) {
    if (result.status === 'unaffected') continue;

    if (result.status === 'stale_drifted') {
      lines.push(
        chalk.red.bold('🔴 STALE + DRIFTED') +
          '  ' +
          chalk.white(result.document),
      );
      lines.push(
        `   Last updated: ${result.daysSinceUpdate} days ago ${chalk.dim(`(threshold: ${result.freshnessThreshold} days)`)}`,
      );
    } else if (result.status === 'drifted') {
      lines.push(
        chalk.yellow.bold('🟡 DRIFTED') +
          '          ' +
          chalk.white(result.document),
      );
      lines.push(`   Last updated: ${result.daysSinceUpdate} days ago`);
    } else if (result.status === 'synced') {
      lines.push(
        chalk.green.bold('✔  SYNCED') +
          '           ' +
          chalk.white(result.document),
      );
      lines.push(chalk.dim('   Updated in this PR'));
    }

    if (result.affectedBy.length > 0 && result.status !== 'synced') {
      lines.push('   Affected by:');
      for (const af of result.affectedBy) {
        lines.push(
          `     ${af.file}  ${chalk.green(`+${af.additions}`)} ${chalk.red(`-${af.deletions}`)}`,
        );
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

// ── JSON formatter ──────────────────────────────────────────────

export function formatDoctorReportJson(report: DoctorReport): string {
  return JSON.stringify(report, null, 2);
}

// ── SARIF formatter ─────────────────────────────────────────────

export function formatDoctorReportSarif(report: DoctorReport): string {
  const results = report.results
    .filter((r) => r.status !== 'unaffected' && r.status !== 'synced')
    .map((r) => ({
      ruleId: r.status === 'stale_drifted' ? 'ctxops/stale-drift' : 'ctxops/drift',
      level: r.severity === 'error' ? 'error' : 'warning',
      message: {
        text:
          r.status === 'stale_drifted'
            ? `Document "${r.document}" is stale (${r.daysSinceUpdate} days) and affected by code changes.`
            : `Document "${r.document}" may need updating due to code changes.`,
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: r.document },
          },
        },
      ],
    }));

  const sarif = {
    version: '2.1.0',
    $schema:
      'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json',
    runs: [
      {
        tool: {
          driver: {
            name: 'ctxops',
            version: '0.1.0',
            informationUri: 'https://github.com/ctxops/ctxops',
            rules: [
              {
                id: 'ctxops/stale-drift',
                shortDescription: {
                  text: 'Stale document affected by code changes',
                },
                defaultConfiguration: { level: 'error' },
              },
              {
                id: 'ctxops/drift',
                shortDescription: {
                  text: 'Document potentially affected by code changes',
                },
                defaultConfiguration: { level: 'warning' },
              },
            ],
          },
        },
        results,
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}

// ── Link list formatters ────────────────────────────────────────

export function formatLinkListText(
  links: LinkEntry[],
  freshnessDays: Map<string, number | null>,
): string {
  if (links.length === 0) {
    return 'No links found. Run "ctx link <document> <code-paths...>" to create associations.';
  }

  const lines: string[] = [];
  const header = `${'DOCUMENT'.padEnd(38)}${'CODE PATHS'.padEnd(30)}${'SCOPE'.padEnd(12)}FRESHNESS`;
  lines.push(chalk.bold(header));

  for (const link of links) {
    const days = freshnessDays.get(link.document);
    const freshnessStr =
      days != null
        ? days > 30
          ? chalk.red(`${days} days ⚠`)
          : `${days} days`
        : 'unknown';

    for (let i = 0; i < link.codePaths.length; i++) {
      if (i === 0) {
        lines.push(
          `${link.document.padEnd(38)}${link.codePaths[i]!.padEnd(30)}${link.metadata.scope.padEnd(12)}${freshnessStr}`,
        );
      } else {
        lines.push(`${''.padEnd(38)}${link.codePaths[i]!.padEnd(30)}`);
      }
    }
  }

  return lines.join('\n');
}

export function formatLinkListJson(links: LinkEntry[]): string {
  return JSON.stringify(links, null, 2);
}

// ── Strict mode failure message ─────────────────────────────────

export function formatStrictFailure(report: DoctorReport): string {
  const issues = report.summary.stale + report.summary.drifted;
  return chalk.red.bold(
    `\n❌ Context integrity check failed (strict mode).\n   ${issues} document(s) require attention before merge.`,
  );
}
