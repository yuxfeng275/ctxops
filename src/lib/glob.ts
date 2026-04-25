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
