import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { getCtxopsDir } from './config.js';

export interface LinkMetadata {
  scope: string;
  taskTypes: string[];
  inferredFrom: string;
  overrides: Record<string, string>;
}

export interface LinkEntry {
  document: string;
  codePaths: string[];
  metadata: LinkMetadata;
  lastLinked: string;
}

export interface LinksFile {
  version: string;
  links: LinkEntry[];
}

const EMPTY_LINKS: LinksFile = {
  version: '0.1.0',
  links: [],
};

/**
 * Get the path to links.json.
 */
export function getLinksPath(root: string): string {
  return path.join(getCtxopsDir(root), 'links.json');
}

/**
 * Read the links file.
 */
export function readLinks(root: string): LinksFile {
  const linksPath = getLinksPath(root);
  if (!existsSync(linksPath)) {
    return { ...EMPTY_LINKS, links: [] };
  }
  const raw = readFileSync(linksPath, 'utf-8');
  return JSON.parse(raw) as LinksFile;
}

/**
 * Write the links file.
 */
export function writeLinks(root: string, links: LinksFile): void {
  const linksPath = getLinksPath(root);
  // Sort by document path for deterministic output (reduces git merge conflicts)
  const sorted = { ...links, links: [...links.links].sort((a, b) => a.document.localeCompare(b.document)) };
  writeFileSync(linksPath, JSON.stringify(sorted, null, 2) + '\n');
}

/**
 * Initialize an empty links file.
 */
export function initLinks(root: string): void {
  writeLinks(root, { ...EMPTY_LINKS, links: [] });
}

/**
 * Add or update a link entry.
 */
export function upsertLink(
  root: string,
  document: string,
  codePaths: string[],
  metadata: LinkMetadata,
): LinkEntry {
  const linksFile = readLinks(root);
  const existingIndex = linksFile.links.findIndex((l) => l.document === document);

  const entry: LinkEntry = {
    document,
    codePaths,
    metadata,
    lastLinked: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    linksFile.links[existingIndex] = entry;
  } else {
    linksFile.links.push(entry);
  }

  writeLinks(root, linksFile);
  return entry;
}

/**
 * Remove a link entry by document path.
 */
export function removeLink(root: string, document: string): boolean {
  const linksFile = readLinks(root);
  const initialLength = linksFile.links.length;
  linksFile.links = linksFile.links.filter((l) => l.document !== document);

  if (linksFile.links.length < initialLength) {
    writeLinks(root, linksFile);
    return true;
  }
  return false;
}
