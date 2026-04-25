import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Layer 4: Git co-change analysis.
 *
 * Analyzes git history to find code files that were frequently
 * modified in the same commits as a given document.
 *
 * Logic: If docs/ai/modules/order.md and services/order/handler.ts
 * were changed together in 5 commits, they are strongly associated.
 */
export function analyzeCoChanges(
  documentPath: string,
  root: string,
  maxCommits: number = 200,
): Array<{ codePath: string; coChangeCount: number }> {
  try {
    // Get commits that touched this document
    const logOutput = execSync(
      `git log --pretty=format:"%H" -n ${maxCommits} -- "${documentPath}"`,
      { cwd: root, stdio: 'pipe' },
    )
      .toString()
      .trim();

    if (!logOutput) return [];

    const commitHashes = logOutput.split('\n').filter(Boolean);

    // For each commit, find other files that were changed
    const coChangeMap = new Map<string, number>();

    for (const hash of commitHashes) {
      const filesOutput = execSync(
        `git diff-tree --no-commit-id --name-only -r ${hash}`,
        { cwd: root, stdio: 'pipe' },
      )
        .toString()
        .trim();

      if (!filesOutput) continue;

      const files = filesOutput.split('\n').filter(Boolean);
      for (const file of files) {
        // Skip the document itself
        if (file === documentPath) continue;
        // Skip other docs — we want code files
        if (file.startsWith('docs/') || file.startsWith('.ctxops/')) continue;
        // Skip non-code files
        if (file.endsWith('.md') || file.endsWith('.json') || file.endsWith('.yaml') || file.endsWith('.yml')) continue;
        if (file.endsWith('.lock') || file.endsWith('.gitignore')) continue;

        coChangeMap.set(file, (coChangeMap.get(file) ?? 0) + 1);
      }
    }

    // Convert to array and sort by frequency
    const results = [...coChangeMap.entries()]
      .map(([codePath, coChangeCount]) => ({ codePath, coChangeCount }))
      .filter((r) => r.coChangeCount >= 1) // At least 1 co-change
      .sort((a, b) => b.coChangeCount - a.coChangeCount);

    return results;
  } catch {
    return [];
  }
}

/**
 * Convert co-change results to glob patterns.
 *
 * Groups individual files into directory globs when multiple files
 * from the same directory appear.
 */
export function coChangesToGlobs(
  coChanges: Array<{ codePath: string; coChangeCount: number }>,
  minCount: number = 1,
): string[] {
  // Group by directory
  const dirCounts = new Map<string, number>();

  for (const { codePath, coChangeCount } of coChanges) {
    if (coChangeCount < minCount) continue;
    const dir = path.dirname(codePath);
    dirCounts.set(dir, (dirCounts.get(dir) ?? 0) + coChangeCount);
  }

  // Sort directories by total co-change count
  const sortedDirs = [...dirCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10); // Top 10 directories

  return sortedDirs.map(([dir]) => dir + '/**');
}

/**
 * Layer 5: Semantic identifier matching.
 *
 * Extracts technical identifiers from markdown content
 * (class names, function names, module names) and searches
 * the codebase for files that define or contain those identifiers.
 *
 * No LLM required — uses pattern extraction + grep.
 */
export function analyzeSemanticLinks(
  documentPath: string,
  root: string,
): string[] {
  try {
    const content = readFileSync(documentPath, 'utf-8');
    const identifiers = extractIdentifiers(content);

    if (identifiers.length === 0) return [];

    // Search codebase for files containing these identifiers
    const matchedDirs = new Set<string>();

    for (const identifier of identifiers) {
      const matchingFiles = grepCodebase(identifier, root);
      for (const file of matchingFiles) {
        const dir = path.dirname(file);
        matchedDirs.add(dir + '/**');
      }
    }

    return [...matchedDirs].slice(0, 10); // Limit results
  } catch {
    return [];
  }
}

/**
 * Extract technical identifiers from markdown content.
 *
 * Targets:
 * - CamelCase: OrderHandler, InventoryService, PaymentGateway
 * - snake_case: order_handler, inventory_service
 * - Class/function references: OrderStateMachine, createOrder
 * - Technical terms in backticks: `OrderStatus`, `checkStock`
 */
export function extractIdentifiers(content: string): string[] {
  const identifiers = new Set<string>();

  // 1. CamelCase identifiers (2+ words) — e.g., OrderHandler, PaymentGateway
  const camelCase = content.matchAll(/\b([A-Z][a-z]+(?:[A-Z][a-z]+)+)\b/g);
  for (const match of camelCase) {
    const id = match[1]!;
    // Filter out common non-code words
    if (!isCommonWord(id) && id.length >= 6) {
      identifiers.add(id);
    }
  }

  // 2. Method/function names in backticks — e.g., `createOrder()`, `checkStock`
  const backtickIds = content.matchAll(/`([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)*(?:\(\))?)`/g);
  for (const match of backtickIds) {
    const id = match[1]!.replace(/\(\)$/, '');
    if (id.length >= 4 && !id.includes('/') && !id.includes(' ')) {
      identifiers.add(id);
    }
  }

  // 3. snake_case identifiers — e.g., order_handler, payment_gateway
  const snakeCase = content.matchAll(/\b([a-z][a-z0-9]*(?:_[a-z][a-z0-9]*)+)\b/g);
  for (const match of snakeCase) {
    const id = match[1]!;
    if (id.length >= 6 && !isCommonSnakeCase(id)) {
      identifiers.add(id);
    }
  }

  return [...identifiers].slice(0, 20); // Limit to avoid excessive grepping
}

/**
 * Search the codebase for files containing a given identifier.
 * Uses git grep for speed.
 */
function grepCodebase(identifier: string, root: string): string[] {
  try {
    const output = execSync(
      `git grep -l --fixed-strings "${identifier}" -- "*.ts" "*.js" "*.java" "*.py" "*.go" "*.rs" "*.rb" "*.kt" "*.swift" "*.cs" "*.cpp" "*.c" "*.h"`,
      { cwd: root, stdio: 'pipe', timeout: 5000 },
    )
      .toString()
      .trim();

    if (!output) return [];

    return output
      .split('\n')
      .filter(Boolean)
      .filter((f) => !f.startsWith('docs/') && !f.startsWith('node_modules/'))
      .slice(0, 20);
  } catch {
    return [];
  }
}

/**
 * Common English words that look like CamelCase but aren't code identifiers.
 */
function isCommonWord(word: string): boolean {
  const commons = new Set([
    'JavaScript', 'TypeScript', 'GitHub', 'README', 'TODO',
    'Overview', 'Module', 'Service', 'Handler', 'Context',
    'Markdown', 'Docker', 'Kubernetes', 'Linux', 'Windows',
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
    'Saturday', 'Sunday', 'January', 'February',
  ]);
  return commons.has(word);
}

/**
 * Common snake_case patterns that aren't meaningful identifiers.
 */
function isCommonSnakeCase(word: string): boolean {
  const commons = new Set([
    'snake_case', 'camel_case', 'kebab_case',
    'created_at', 'updated_at', 'deleted_at',
    'first_name', 'last_name', 'user_name',
  ]);
  return commons.has(word);
}
