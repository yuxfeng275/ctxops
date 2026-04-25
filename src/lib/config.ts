import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export interface CtxopsConfig {
  version: string;
  contextDir: string;
  linksFile: string;
  doctor: {
    freshnessThresholdDays: number;
    defaultMode: 'warn' | 'strict';
  };
  inference: {
    scopeFromPath: boolean;
    taskTypeFromFilename: boolean;
    freshnessFromGit: boolean;
  };
}

const DEFAULT_CONFIG: CtxopsConfig = {
  version: '0.1.0',
  contextDir: 'docs/ai',
  linksFile: '.ctxops/links.json',
  doctor: {
    freshnessThresholdDays: 30,
    defaultMode: 'warn',
  },
  inference: {
    scopeFromPath: true,
    taskTypeFromFilename: true,
    freshnessFromGit: true,
  },
};

/**
 * Get the path to the .ctxops directory.
 */
export function getCtxopsDir(root: string): string {
  return path.join(root, '.ctxops');
}

/**
 * Get the path to config.json.
 */
export function getConfigPath(root: string): string {
  return path.join(getCtxopsDir(root), 'config.json');
}

/**
 * Check if ctxops is initialized in the given root.
 */
export function isInitialized(root: string): boolean {
  return existsSync(getCtxopsDir(root)) && existsSync(getConfigPath(root));
}

/**
 * Read the ctxops config.
 */
export function readConfig(root: string): CtxopsConfig {
  const configPath = getConfigPath(root);
  if (!existsSync(configPath)) {
    throw new Error('ctxops is not initialized. Run "ctx init" first.');
  }
  const raw = readFileSync(configPath, 'utf-8');
  return JSON.parse(raw) as CtxopsConfig;
}

/**
 * Write the ctxops config.
 */
export function writeConfig(root: string, config?: CtxopsConfig): void {
  const ctxopsDir = getCtxopsDir(root);
  if (!existsSync(ctxopsDir)) {
    mkdirSync(ctxopsDir, { recursive: true });
  }
  const configPath = getConfigPath(root);
  writeFileSync(configPath, JSON.stringify(config ?? DEFAULT_CONFIG, null, 2) + '\n');
}

/**
 * Get the default config.
 */
export function getDefaultConfig(): CtxopsConfig {
  return { ...DEFAULT_CONFIG };
}
