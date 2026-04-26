import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Check if the current directory is inside a git repository.
 */
export function isGitRepo(cwd: string): boolean {
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the root directory of the git repository.
 */
export function getGitRoot(cwd: string): string {
  return execSync('git rev-parse --show-toplevel', { cwd, stdio: 'pipe' })
    .toString()
    .trim();
}

/**
 * Safely escape a git ref name to prevent shell injection.
 */
function safeRef(ref: string): string {
  // Only allow alphanumeric, /, -, _, .
  if (!/^[a-zA-Z0-9/_.\-]+$/.test(ref)) {
    throw new Error(`Invalid git ref: "${ref}"`);
  }
  return ref;
}

/**
 * Check if a git ref (branch/tag) exists.
 */
export function refExists(ref: string, cwd: string): boolean {
  try {
    execSync(`git rev-parse --verify ${safeRef(ref)}`, { cwd, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the list of files changed between base branch and HEAD.
 * Throws an error if the base branch doesn't exist or git comparison fails.
 */
export function getChangedFiles(base: string, cwd: string): string[] {
  const safe = safeRef(base);

  if (!refExists(safe, cwd)) {
    throw new Error(
      `Base branch "${base}" does not exist. ` +
      `Make sure you have fetched it (git fetch origin ${base}) or use a valid branch name.`
    );
  }

  const output = execSync(`git diff --name-only ${safe}..HEAD`, {
    cwd,
    stdio: 'pipe',
  })
    .toString()
    .trim();
  if (!output) return [];
  return output.split('\n').filter(Boolean);
}

/**
 * Get the list of staged files (for pre-commit hook).
 */
export function getStagedFiles(cwd: string): string[] {
  try {
    const output = execSync('git diff --cached --name-only', {
      cwd,
      stdio: 'pipe',
    })
      .toString()
      .trim();
    if (!output) return [];
    return output.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Get diff stat for a specific file between base and HEAD.
 */
export function getFileDiffStat(
  base: string,
  filePath: string,
  cwd: string,
): { additions: number; deletions: number } {
  try {
    const safe = safeRef(base);
    const output = execSync(
      `git diff --numstat ${safe}..HEAD -- "${filePath}"`,
      { cwd, stdio: 'pipe' },
    )
      .toString()
      .trim();
    if (!output) return { additions: 0, deletions: 0 };
    const parts = output.split('\t');
    return {
      additions: parseInt(parts[0] ?? '0', 10) || 0,
      deletions: parseInt(parts[1] ?? '0', 10) || 0,
    };
  } catch {
    return { additions: 0, deletions: 0 };
  }
}

/**
 * Get the last modification date of a file from git history.
 */
export function getLastModifiedDate(filePath: string, cwd: string): Date | null {
  try {
    const output = execSync(
      `git log -1 --format=%cI -- "${filePath}"`,
      { cwd, stdio: 'pipe' },
    )
      .toString()
      .trim();
    if (!output) return null;
    return new Date(output);
  } catch {
    return null;
  }
}

/**
 * Calculate the number of days between a date and now.
 */
export function daysSince(date: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Check if a file is in the changed files list (i.e., modified in the current PR).
 */
export function isFileInChangedList(
  filePath: string,
  changedFiles: string[],
): boolean {
  return changedFiles.includes(filePath);
}

/**
 * Get the current branch name.
 */
export function getCurrentBranch(cwd: string): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd, stdio: 'pipe' })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}
