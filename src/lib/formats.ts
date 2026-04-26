import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Known AI context file formats and their locations.
 * ctxops can detect and track all of these as linkable documents.
 */
export interface ContextFormat {
  /** Human-readable name */
  name: string;
  /** Relative path patterns to check */
  paths: string[];
  /** Which AI tools use this format */
  tools: string[];
}

export const KNOWN_FORMATS: ContextFormat[] = [
  {
    name: 'AGENTS.md',
    paths: ['AGENTS.md'],
    tools: ['Codex', 'Gemini CLI', 'OpenCode', 'Cline'],
  },
  {
    name: 'CLAUDE.md',
    paths: ['CLAUDE.md'],
    tools: ['Claude Code'],
  },
  {
    name: 'Claude Code Skill',
    paths: ['.claude/skills/*/SKILL.md'],
    tools: ['Claude Code'],
  },
  {
    name: 'GEMINI.md',
    paths: ['GEMINI.md'],
    tools: ['Gemini CLI'],
  },
  {
    name: 'Copilot Instructions',
    paths: [
      '.github/copilot-instructions.md',
      '.github/instructions/*.instructions.md',
    ],
    tools: ['GitHub Copilot'],
  },
  {
    name: 'Cursor Rules',
    paths: ['.cursor/rules/*.mdc', '.cursorrules'],
    tools: ['Cursor'],
  },
  {
    name: 'Cline Rules',
    paths: ['.clinerules'],
    tools: ['Cline'],
  },
  {
    name: 'Aider Convention',
    paths: ['CONVENTIONS.md', '.aider.conf.yml'],
    tools: ['Aider'],
  },
  {
    name: 'Windsurf Rules',
    paths: ['.windsurfrules'],
    tools: ['Windsurf'],
  },
];

/**
 * Scan a repo root for all known context files.
 * Returns a list of discovered files with their format info.
 */
export function detectContextFiles(root: string): Array<{
  path: string;
  format: ContextFormat;
}> {
  const results: Array<{ path: string; format: ContextFormat }> = [];

  for (const format of KNOWN_FORMATS) {
    for (const pattern of format.paths) {
      if (pattern.includes('*')) {
        // Simple glob expansion for common patterns
        const expanded = expandSimpleGlob(root, pattern);
        for (const file of expanded) {
          const relPath = path.relative(root, file);
          results.push({ path: relPath, format });
        }
      } else {
        const fullPath = path.join(root, pattern);
        if (existsSync(fullPath)) {
          results.push({ path: pattern, format });
        }
      }
    }
  }

  return results;
}

/**
 * Expand simple glob patterns like `.github/instructions/*.instructions.md`
 */
function expandSimpleGlob(root: string, pattern: string): string[] {
  const parts = pattern.split('/');
  const results: string[] = [];
  expandGlobRecursive(root, parts, 0, results);
  return results;
}

function expandGlobRecursive(
  currentPath: string,
  parts: string[],
  index: number,
  results: string[],
): void {
  if (index >= parts.length) {
    if (existsSync(currentPath)) {
      results.push(currentPath);
    }
    return;
  }

  const part = parts[index]!;

  if (part.includes('*')) {
    // Read directory and match
    const dir = currentPath;
    try {
      const { readdirSync } = require('node:fs');
      const entries = readdirSync(dir, { withFileTypes: true }) as Array<{ name: string; isFile(): boolean; isDirectory(): boolean }>;
      const regex = new RegExp('^' + part.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');

      for (const entry of entries) {
        if (regex.test(entry.name)) {
          const next = path.join(dir, entry.name);
          if (index === parts.length - 1) {
            // Last part — should be a file
            if (entry.isFile()) {
              results.push(next);
            }
          } else {
            // Not last — should be a directory
            if (entry.isDirectory()) {
              expandGlobRecursive(next, parts, index + 1, results);
            }
          }
        }
      }
    } catch {
      // Directory doesn't exist
    }
  } else {
    expandGlobRecursive(path.join(currentPath, part), parts, index + 1, results);
  }
}

/**
 * Get a summary of context formats found in the repo.
 */
export function getContextSummary(root: string): string {
  const files = detectContextFiles(root);
  if (files.length === 0) {
    return 'No AI context files detected.';
  }

  const lines = ['Detected AI context files:'];
  for (const f of files) {
    lines.push(`  ${f.format.name}: ${f.path} (${f.format.tools.join(', ')})`);
  }
  return lines.join('\n');
}
