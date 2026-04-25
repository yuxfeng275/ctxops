import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { analyzeCoChanges, coChangesToGlobs, analyzeSemanticLinks } from './smart-linker.js';

/**
 * Recursively find all markdown files in a directory.
 */
export function findMarkdownFiles(dir: string): string[] {
  const results: string[] = [];

  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
    return results;
  }

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findMarkdownFiles(fullPath));
    } else if (entry.isFile() && /\.md$/i.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Infer code paths from a document's directory name.
 *
 * Convention: docs/ai/modules/order.md → services/order/**
 *
 * Scans the repo root for directories that match the document's basename
 * (minus extension), then generates glob patterns.
 */
export function inferCodePathsFromConvention(
  documentPath: string,
  root: string,
): string[] {
  const basename = path.basename(documentPath, '.md').toLowerCase();

  // Skip template/example files
  if (basename.startsWith('_') || basename.startsWith('00-') || basename.startsWith('01-') || basename.startsWith('02-')) {
    return [];
  }

  const candidates: string[] = [];

  // Strategy 1: Look for matching directories in common code locations
  const codeDirs = ['services', 'src', 'lib', 'packages', 'apps', 'modules', 'components'];
  for (const codeDir of codeDirs) {
    const candidate = path.join(root, codeDir, basename);
    if (statSync(candidate, { throwIfNoEntry: false })?.isDirectory()) {
      candidates.push(`${codeDir}/${basename}/**`);
    }
  }

  // Strategy 2: Look for matching directories at any depth (services/order-service → order)
  for (const codeDir of codeDirs) {
    const codeDirPath = path.join(root, codeDir);
    if (!statSync(codeDirPath, { throwIfNoEntry: false })?.isDirectory()) continue;

    try {
      const entries = readdirSync(codeDirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const dirName = entry.name.toLowerCase();
        // Match: order.md ↔ order-service, order_module, etc.
        if (dirName === basename || dirName.startsWith(basename + '-') || dirName.startsWith(basename + '_')) {
          candidates.push(`${codeDir}/${entry.name}/**`);
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  // Strategy 3: Look for shared/models matching
  const sharedDirs = ['shared', 'common', 'core'];
  for (const sharedDir of sharedDirs) {
    const sharedPath = path.join(root, sharedDir);
    if (!statSync(sharedPath, { throwIfNoEntry: false })?.isDirectory()) continue;

    // Look for files containing the basename
    try {
      const files = findFilesContaining(sharedPath, basename);
      for (const file of files) {
        candidates.push(path.relative(root, file));
      }
    } catch {
      // Skip
    }
  }

  return [...new Set(candidates)];
}

/**
 * Find files in a directory whose name contains the given term.
 */
function findFilesContaining(dir: string, term: string): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findFilesContaining(fullPath, term));
      } else if (entry.name.toLowerCase().includes(term)) {
        results.push(fullPath);
      }
    }
  } catch {
    // Skip unreadable
  }
  return results;
}

/**
 * Extract code path references from markdown content.
 *
 * Scans for patterns like:
 *   - `services/order/handler.ts`
 *   - services/order/**
 *   - file paths in backticks or code blocks
 */
export function extractCodePathsFromContent(
  documentPath: string,
  root: string,
): string[] {
  try {
    const content = readFileSync(documentPath, 'utf-8');
    const paths: string[] = [];

    // Pattern 1: Paths in backticks like `services/order/handler.ts`
    const backtickPaths = content.matchAll(/`([a-zA-Z0-9_\-./]+(?:\/[a-zA-Z0-9_\-.*]+)+)`/g);
    for (const match of backtickPaths) {
      const p = match[1]!;
      // Filter: must look like a code path (has / and common extensions or **)
      if (isLikelyCodePath(p, root)) {
        paths.push(p);
      }
    }

    // Pattern 2: Bare paths that look like directory references (e.g., services/order/)
    const barePaths = content.matchAll(/(?:^|\s)((?:services|src|lib|packages|apps|modules|components|shared|common)\/[a-zA-Z0-9_\-./]+)/gm);
    for (const match of barePaths) {
      const p = match[1]!.replace(/[,;:)}\]]+$/, ''); // Strip trailing punctuation
      if (isLikelyCodePath(p, root)) {
        paths.push(p);
      }
    }

    // Deduplicate and convert file paths to directory globs
    const normalized = new Set<string>();
    for (const p of paths) {
      if (p.includes('**')) {
        normalized.add(p);
      } else if (p.includes('.')) {
        // It's a file reference — add the directory glob
        const dir = path.dirname(p);
        normalized.add(dir + '/**');
        // Also keep the exact file
        normalized.add(p);
      } else if (p.endsWith('/')) {
        normalized.add(p + '**');
      } else {
        normalized.add(p + '/**');
      }
    }

    return [...normalized];
  } catch {
    return [];
  }
}

/**
 * Check if a string looks like a real code path in the repo.
 */
function isLikelyCodePath(p: string, root: string): boolean {
  // Must have at least one /
  if (!p.includes('/')) return false;

  // Skip obvious non-code paths
  if (p.startsWith('http') || p.startsWith('//') || p.startsWith('#')) return false;
  if (p.includes('ctxops:')) return false; // It's a ctxops directive

  // Check if the base directory exists
  const firstSegment = p.split('/')[0]!;
  const fullPath = path.join(root, firstSegment);

  return !!statSync(fullPath, { throwIfNoEntry: false })?.isDirectory();
}

/**
 * Parse <!-- ctxops: paths=... --> comments from a document.
 */
export function extractPathsFromCtxopsComment(documentPath: string): string[] {
  try {
    const content = readFileSync(documentPath, 'utf-8');
    const match = content.match(/<!--\s*ctxops:\s*(.+?)\s*-->/);
    if (!match?.[1]) return [];

    const pairs = match[1].split(',').map((p) => p.trim());
    for (const pair of pairs) {
      const eqIndex = pair.indexOf('=');
      if (eqIndex > 0) {
        const key = pair.substring(0, eqIndex).trim();
        const value = pair.substring(eqIndex + 1).trim();
        if (key === 'paths') {
          return value.split(/\s+/);
        }
      }
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Auto-discover all links for a document using the five-layer strategy:
 *   1. Explicit: <!-- ctxops: paths=... -->
 *   2. Convention: directory name matching
 *   3. Content: code path references in the markdown
 *   4. Git co-change: files frequently modified together in git history
 *   5. Semantic: technical identifiers (class/function names) grep-matched to code
 */
export function autoDiscoverLinks(
  documentPath: string,
  root: string,
): { codePaths: string[]; sources: string[] } {
  const codePaths: string[] = [];
  const sources: string[] = [];

  const addPaths = (paths: string[], source: string) => {
    for (const cp of paths) {
      if (!codePaths.includes(cp)) {
        codePaths.push(cp);
        if (!sources.includes(source)) sources.push(source);
      }
    }
  };

  // Layer 1: Explicit ctxops comment
  addPaths(extractPathsFromCtxopsComment(documentPath), 'ctxops-comment');

  // Layer 2: Convention-based
  addPaths(inferCodePathsFromConvention(documentPath, root), 'convention');

  // Layer 3: Content scanning
  addPaths(extractCodePathsFromContent(documentPath, root), 'content-scan');

  // Layer 4: Git co-change analysis
  const relPath = path.relative(root, documentPath);
  const coChanges = analyzeCoChanges(relPath, root);
  const coChangeGlobs = coChangesToGlobs(coChanges);
  addPaths(coChangeGlobs, 'git-cochange');

  // Layer 5: Semantic identifier matching
  const semanticPaths = analyzeSemanticLinks(documentPath, root);
  addPaths(semanticPaths, 'semantic');

  return { codePaths, sources };
}

