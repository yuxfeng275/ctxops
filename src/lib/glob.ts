import { minimatch } from 'minimatch';

/**
 * Check if a file path matches a glob pattern.
 */
export function matchesGlob(filePath: string, pattern: string): boolean {
  return minimatch(filePath, pattern, { matchBase: false });
}

/**
 * Check if a file path matches any of the given glob patterns.
 */
export function matchesAnyGlob(filePath: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchesGlob(filePath, pattern));
}

/**
 * Find all changed files that match any of the given code path patterns.
 */
export function findMatchingChangedFiles(
  changedFiles: string[],
  codePaths: string[],
): string[] {
  return changedFiles.filter((file) => matchesAnyGlob(file, codePaths));
}

/**
 * Remove redundant glob patterns where one pattern contains another.
 *
 * Examples:
 *   [src/**, src/cli.ts, src/commands/**] → [src/**]
 *   [services/order/**, services/inventory/**] → unchanged (no containment)
 *   [src/lib/**, src/lib/git.ts] → [src/lib/**]
 *
 * This prevents alert fatigue: a doc linked to `src/**` + 20 sub-paths
 * would trigger on any change, making every PR noisy.
 */
export function deduplicateGlobs(patterns: string[]): string[] {
  if (patterns.length <= 1) return patterns;

  // Separate glob patterns (ending with /**) from exact paths
  const globs = patterns.filter(p => p.endsWith('/**'));
  const exact = patterns.filter(p => !p.endsWith('/**'));

  // Sort globs by specificity (shorter = broader)
  const sortedGlobs = [...globs].sort((a, b) => a.length - b.length);

  // Remove globs that are subsets of broader globs
  const keptGlobs: string[] = [];
  for (const glob of sortedGlobs) {
    const globDir = glob.replace(/\/\*\*$/, '');
    const isContained = keptGlobs.some(kept => {
      const keptDir = kept.replace(/\/\*\*$/, '');
      // "src/**" contains "src/commands/**" because "src/commands" starts with "src/"
      return globDir.startsWith(keptDir + '/') || globDir === keptDir;
    });
    if (!isContained) {
      keptGlobs.push(glob);
    }
  }

  // Remove exact paths that are covered by kept globs
  const keptExact = exact.filter(p => {
    return !keptGlobs.some(glob => minimatch(p, glob, { matchBase: false }));
  });

  return [...keptGlobs, ...keptExact];
}
