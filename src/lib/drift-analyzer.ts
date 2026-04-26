import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Drift analysis result for a single document.
 * Goes beyond "was file touched" to answer "is the doc truly synced".
 */
export interface DriftAnalysis {
  /** Identifiers changed in code (function names, class names, interfaces, etc.) */
  changedIdentifiers: string[];
  /** Lines in the doc that reference changed identifiers */
  docReferencesHit: Array<{ line: number; text: string; identifier: string }>;
  /** Whether the doc diff actually addresses the code changes */
  syncVerdict: 'truly_synced' | 'touched_only' | 'unverified';
  /** Human-readable summary of what changed in code */
  changeSummary: string[];
  /** Whether code changes include structural changes (new/deleted files) */
  hasStructuralChanges: boolean;
  /** New files added in the affected paths */
  newFiles: string[];
  /** Deleted files in the affected paths */
  deletedFiles: string[];
}

/**
 * Extract changed identifiers from a git diff.
 *
 * Parses diff hunks to find function/class/interface/type definitions
 * that were added or removed.
 */
export function extractChangedIdentifiers(
  base: string,
  filePath: string,
  cwd: string,
): string[] {
  try {
    const output = execSync(
      `git diff ${base}..HEAD -- "${filePath}"`,
      { cwd, stdio: 'pipe', timeout: 5000 },
    )
      .toString();

    if (!output) return [];

    const identifiers = new Set<string>();

    // Only look at changed lines (+ or -)
    const changedLines = output
      .split('\n')
      .filter(line => line.startsWith('+') || line.startsWith('-'))
      .filter(line => !line.startsWith('+++') && !line.startsWith('---'));

    for (const line of changedLines) {
      const content = line.substring(1); // Remove + or -

      // TypeScript/JavaScript patterns
      // function name(
      const fnMatch = content.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
      if (fnMatch) identifiers.add(fnMatch[1]!);

      // class Name
      const classMatch = content.match(/(?:export\s+)?class\s+(\w+)/);
      if (classMatch) identifiers.add(classMatch[1]!);

      // interface Name / type Name
      const typeMatch = content.match(/(?:export\s+)?(?:interface|type)\s+(\w+)/);
      if (typeMatch) identifiers.add(typeMatch[1]!);

      // const/let/var name = (for exported constants)
      const constMatch = content.match(/(?:export\s+)?(?:const|let|var)\s+(\w+)/);
      if (constMatch && constMatch[1]!.length > 3) identifiers.add(constMatch[1]!);

      // Method definitions: name( or name<T>(
      const methodMatch = content.match(/^\s+(?:async\s+)?(\w+)\s*[<(]/);
      if (methodMatch && methodMatch[1] !== 'if' && methodMatch[1] !== 'for' && methodMatch[1] !== 'while' && methodMatch[1] !== 'return' && methodMatch[1] !== 'new') {
        identifiers.add(methodMatch[1]!);
      }

      // Python: def name(  /  class Name:
      const pyFnMatch = content.match(/def\s+(\w+)\s*\(/);
      if (pyFnMatch) identifiers.add(pyFnMatch[1]!);
      const pyClassMatch = content.match(/class\s+(\w+)\s*[:(]/);
      if (pyClassMatch) identifiers.add(pyClassMatch[1]!);

      // Java/Go: func/public/private/protected method definitions
      const javaMatch = content.match(/(?:public|private|protected|static|final)\s+\w+\s+(\w+)\s*\(/);
      if (javaMatch) identifiers.add(javaMatch[1]!);
      const goMatch = content.match(/func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/);
      if (goMatch) identifiers.add(goMatch[1]!);
    }

    return [...identifiers];
  } catch {
    return [];
  }
}

/**
 * Get a human-readable summary of code changes in a file.
 * Returns function/class-level change descriptions.
 */
export function getChangeSummary(
  base: string,
  filePath: string,
  cwd: string,
): string[] {
  try {
    // Use git diff with function context
    const output = execSync(
      `git diff --stat ${base}..HEAD -- "${filePath}" 2>/dev/null && git diff -U0 --no-color ${base}..HEAD -- "${filePath}" 2>/dev/null | head -50`,
      { cwd, stdio: 'pipe', timeout: 5000 },
    )
      .toString()
      .trim();

    if (!output) return [];

    const summaries: string[] = [];
    const identifiers = extractChangedIdentifiers(base, filePath, cwd);

    if (identifiers.length > 0) {
      summaries.push(`Changed: ${identifiers.join(', ')}`);
    }

    return summaries;
  } catch {
    return [];
  }
}

/**
 * Check if a doc diff actually addresses the code changes.
 *
 * Compares identifiers changed in code against what the doc diff touches.
 * This is the core fix for the "touch = synced" problem.
 */
export function verifyDocSync(
  base: string,
  docPath: string,
  codeIdentifiers: string[],
  cwd: string,
): { verdict: 'truly_synced' | 'touched_only' | 'unverified'; hits: Array<{ identifier: string; inDocDiff: boolean }> } {
  if (codeIdentifiers.length === 0) {
    // Can't extract identifiers — no way to verify
    return { verdict: 'unverified', hits: [] };
  }

  try {
    // Get the doc diff
    const docDiff = execSync(
      `git diff ${base}..HEAD -- "${docPath}"`,
      { cwd, stdio: 'pipe', timeout: 5000 },
    )
      .toString();

    if (!docDiff) {
      return { verdict: 'unverified', hits: [] };
    }

    // Check if the doc diff is substantive (not just whitespace)
    const addedLines = docDiff
      .split('\n')
      .filter(l => l.startsWith('+') && !l.startsWith('+++'))
      .map(l => l.substring(1).trim())
      .filter(l => l.length > 0);

    const removedLines = docDiff
      .split('\n')
      .filter(l => l.startsWith('-') && !l.startsWith('---'))
      .map(l => l.substring(1).trim())
      .filter(l => l.length > 0);

    // If only whitespace/empty line changes
    if (addedLines.length === 0 && removedLines.length === 0) {
      return { verdict: 'touched_only', hits: [] };
    }

    // Check each code identifier against the doc diff
    const fullDiffText = [...addedLines, ...removedLines].join(' ');
    const hits = codeIdentifiers.map(id => ({
      identifier: id,
      inDocDiff: fullDiffText.includes(id),
    }));

    const matchCount = hits.filter(h => h.inDocDiff).length;

    if (matchCount > 0) {
      return { verdict: 'truly_synced', hits };
    }

    // Doc was changed but doesn't mention any of the changed code identifiers.
    // Could be a legitimate update to a different section, so "unverified" not "touched_only"
    if (addedLines.length + removedLines.length >= 3) {
      return { verdict: 'unverified', hits };
    }

    return { verdict: 'touched_only', hits };
  } catch {
    return { verdict: 'unverified', hits: [] };
  }
}

/**
 * Check document content (not diff) for references to changed identifiers.
 * Tells user "line 23 mentions OrderConfig — may need update".
 */
export function findDocReferences(
  docPath: string,
  identifiers: string[],
  cwd: string,
): Array<{ line: number; text: string; identifier: string }> {
  if (identifiers.length === 0) return [];

  try {
    const fullPath = path.join(cwd, docPath);
    const content = readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');
    const refs: Array<{ line: number; text: string; identifier: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      for (const id of identifiers) {
        if (line.includes(id)) {
          refs.push({ line: i + 1, text: line.trim(), identifier: id });
          break; // One ref per line is enough
        }
      }
    }

    return refs.slice(0, 10); // Limit output
  } catch {
    return [];
  }
}

/**
 * Detect structural changes (new/deleted files) in the affected paths.
 */
export function detectStructuralChanges(
  base: string,
  changedFiles: string[],
  codePaths: string[],
  cwd: string,
): { newFiles: string[]; deletedFiles: string[]; hasStructural: boolean } {
  try {
    const output = execSync(
      `git diff --diff-filter=AD --name-only ${base}..HEAD`,
      { cwd, stdio: 'pipe', timeout: 5000 },
    )
      .toString()
      .trim();

    if (!output) return { newFiles: [], deletedFiles: [], hasStructural: false };

    const addedOutput = execSync(
      `git diff --diff-filter=A --name-only ${base}..HEAD`,
      { cwd, stdio: 'pipe', timeout: 5000 },
    ).toString().trim();

    const deletedOutput = execSync(
      `git diff --diff-filter=D --name-only ${base}..HEAD`,
      { cwd, stdio: 'pipe', timeout: 5000 },
    ).toString().trim();

    const added = addedOutput ? addedOutput.split('\n').filter(Boolean) : [];
    const deleted = deletedOutput ? deletedOutput.split('\n').filter(Boolean) : [];

    // Filter to only files in affected code paths
    const { minimatch } = require('minimatch');
    const matchesAny = (f: string) => codePaths.some((p: string) => minimatch(f, p, { matchBase: false }));

    const newFiles = added.filter(matchesAny);
    const deletedFiles = deleted.filter(matchesAny);

    return {
      newFiles,
      deletedFiles,
      hasStructural: newFiles.length > 0 || deletedFiles.length > 0,
    };
  } catch {
    return { newFiles: [], deletedFiles: [], hasStructural: false };
  }
}
