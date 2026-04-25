import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Infer the scope from a document path.
 * docs/ai/modules/ → module
 * docs/ai/playbooks/ → playbook
 * docs/ai/ root → project
 */
export function inferScope(documentPath: string): string {
  const normalized = documentPath.replace(/\\/g, '/');
  if (normalized.includes('/modules/')) return 'module';
  if (normalized.includes('/playbooks/')) return 'playbook';
  return 'project';
}

/**
 * Infer task types from a filename.
 * bugfix.md → ["bugfix"]
 * feature.md → ["feature"]
 * review.md → ["review"]
 */
export function inferTaskTypes(documentPath: string): string[] {
  const basename = path.basename(documentPath, path.extname(documentPath)).toLowerCase();
  const knownTypes = ['bugfix', 'feature', 'review', 'refactor', 'migration', 'onboarding'];
  const matches = knownTypes.filter((t) => basename.includes(t));
  return matches.length > 0 ? matches : [];
}

/**
 * Parse ctxops override comments from a Markdown file.
 * Looks for: <!-- ctxops: key=value, key=value -->
 */
export function parseOverrides(filePath: string): Record<string, string> {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const match = content.match(/<!--\s*ctxops:\s*(.+?)\s*-->/);
    if (!match?.[1]) return {};

    const overrides: Record<string, string> = {};
    const pairs = match[1].split(',').map((p) => p.trim());
    for (const pair of pairs) {
      const eqIndex = pair.indexOf('=');
      if (eqIndex > 0) {
        const key = pair.substring(0, eqIndex).trim();
        const value = pair.substring(eqIndex + 1).trim();
        overrides[key] = value;
      }
    }
    return overrides;
  } catch {
    return {};
  }
}

/**
 * Build complete metadata by combining inference and overrides.
 */
export function buildMetadata(
  documentPath: string,
  root: string,
): { scope: string; taskTypes: string[]; inferredFrom: string; overrides: Record<string, string> } {
  const fullPath = path.join(root, documentPath);
  const overrides = parseOverrides(fullPath);

  const inferredScope = inferScope(documentPath);
  const inferredTaskTypes = inferTaskTypes(documentPath);

  return {
    scope: overrides['scope'] ?? inferredScope,
    taskTypes: inferredTaskTypes,
    inferredFrom: overrides['scope'] ? 'explicit' : 'path',
    overrides,
  };
}
