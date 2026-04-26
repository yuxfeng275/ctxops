import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const CLI = path.resolve(__dirname, '../dist/cli.js');
const TEST_DIR = path.resolve(__dirname, '../_test_workspace');

function run(cmd: string, cwd: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(`node ${CLI} ${cmd}`, { cwd, stdio: 'pipe' }).toString();
    return { stdout, exitCode: 0 };
  } catch (e: any) {
    const stdout = (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '');
    return { stdout, exitCode: e.status ?? 1 };
  }
}

function setupGitRepo(name: string): string {
  const dir = path.join(TEST_DIR, name);
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
  // Create initial structure
  mkdirSync(path.join(dir, 'services/order'), { recursive: true });
  mkdirSync(path.join(dir, 'services/inventory'), { recursive: true });
  mkdirSync(path.join(dir, 'shared/models'), { recursive: true });
  execSync('echo "handler" > services/order/handler.ts', { cwd: dir, stdio: 'pipe' });
  execSync('echo "model" > shared/models/order.ts', { cwd: dir, stdio: 'pipe' });
  execSync('echo "inv" > services/inventory/service.ts', { cwd: dir, stdio: 'pipe' });
  execSync('git add . && git commit -m "init"', { cwd: dir, stdio: 'pipe' });
  return dir;
}

beforeEach(() => {
  if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
});

// ── T-INIT tests ─────────────────────────────────────────

describe('ctx init', () => {
  it('T-INIT-01: normal initialization', () => {
    const dir = setupGitRepo('init-01');
    const { stdout, exitCode } = run('init', dir);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Initialized ctxops');
    expect(existsSync(path.join(dir, '.ctxops/config.json'))).toBe(true);
    expect(existsSync(path.join(dir, '.ctxops/links.json'))).toBe(true);
    expect(existsSync(path.join(dir, 'docs/ai/modules/_example.md'))).toBe(true);

    const config = JSON.parse(readFileSync(path.join(dir, '.ctxops/config.json'), 'utf-8'));
    expect(config.version).toBe('0.1.0');

    const links = JSON.parse(readFileSync(path.join(dir, '.ctxops/links.json'), 'utf-8'));
    expect(links.links).toEqual([]);
  });

  it('T-INIT-02: fails outside git repo', () => {
    const dir = path.join(TEST_DIR, 'init-02-nogit');
    mkdirSync(dir, { recursive: true });
    // Use GIT_CEILING_DIRECTORIES to prevent git from finding parent repo
    try {
      const stdout = execSync(`GIT_CEILING_DIRECTORIES="${TEST_DIR}" node ${CLI} init`, { cwd: dir, stdio: 'pipe', env: { ...process.env, GIT_CEILING_DIRECTORIES: TEST_DIR } }).toString();
      // Should not succeed
      expect(stdout).toContain('not a git repository');
    } catch (e: any) {
      const stdout = (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '');
      expect(stdout).toContain('not a git repository');
    }
  });

  it('T-INIT-03: refuses duplicate init', () => {
    const dir = setupGitRepo('init-03');
    run('init', dir);
    const { stdout, exitCode } = run('init', dir);
    expect(exitCode).toBe(2);
    expect(stdout).toContain('already initialized');
  });

  it('T-INIT-04: --force overwrites', () => {
    const dir = setupGitRepo('init-04');
    run('init', dir);
    const { stdout, exitCode } = run('init --force', dir);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Initialized ctxops');
  });
});

// ── T-LINK tests ─────────────────────────────────────────

describe('ctx link', () => {
  it('T-LINK-01: normal link', () => {
    const dir = setupGitRepo('link-01');
    run('init', dir);
    mkdirSync(path.join(dir, 'docs/ai/modules'), { recursive: true });
    execSync('echo "# Order" > docs/ai/modules/order.md', { cwd: dir, stdio: 'pipe' });

    const { stdout, exitCode } = run('link docs/ai/modules/order.md "services/order/**"', dir);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Linked:');
    expect(stdout).toContain('docs/ai/modules/order.md');

    const links = JSON.parse(readFileSync(path.join(dir, '.ctxops/links.json'), 'utf-8'));
    expect(links.links).toHaveLength(1);
    expect(links.links[0].document).toBe('docs/ai/modules/order.md');
    expect(links.links[0].metadata.scope).toBe('module');
  });

  it('T-LINK-04: document not found', () => {
    const dir = setupGitRepo('link-04');
    run('init', dir);
    const { stdout, exitCode } = run('link docs/ai/nonexistent.md "services/order/**"', dir);
    expect(exitCode).toBe(2);
    expect(stdout).toContain('document not found');
  });

  it('T-LINK-06: remove link', () => {
    const dir = setupGitRepo('link-06');
    run('init', dir);
    mkdirSync(path.join(dir, 'docs/ai/modules'), { recursive: true });
    execSync('echo "# Order" > docs/ai/modules/order.md', { cwd: dir, stdio: 'pipe' });
    run('link docs/ai/modules/order.md "services/order/**"', dir);

    const { stdout, exitCode } = run('link --remove docs/ai/modules/order.md', dir);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Removed');

    const links = JSON.parse(readFileSync(path.join(dir, '.ctxops/links.json'), 'utf-8'));
    expect(links.links).toHaveLength(0);
  });

  it('T-LINK-07: list links', () => {
    const dir = setupGitRepo('link-07');
    run('init', dir);
    mkdirSync(path.join(dir, 'docs/ai/modules'), { recursive: true });
    execSync('echo "# Order" > docs/ai/modules/order.md', { cwd: dir, stdio: 'pipe' });
    run('link docs/ai/modules/order.md "services/order/**"', dir);

    const { stdout, exitCode } = run('link --list', dir);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('docs/ai/modules/order.md');
    expect(stdout).toContain('services/order/**');
  });

  it('T-LINK-08: list as JSON', () => {
    const dir = setupGitRepo('link-08');
    run('init', dir);
    mkdirSync(path.join(dir, 'docs/ai/modules'), { recursive: true });
    execSync('echo "# Order" > docs/ai/modules/order.md', { cwd: dir, stdio: 'pipe' });
    run('link docs/ai/modules/order.md "services/order/**"', dir);

    const { stdout, exitCode } = run('link --list --format json', dir);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].document).toBe('docs/ai/modules/order.md');
  });
});

// ── T-DOC tests ──────────────────────────────────────────

describe('ctx doctor', () => {
  function setupDoctorRepo(name: string): string {
    const dir = setupGitRepo(name);
    run('init', dir);
    mkdirSync(path.join(dir, 'docs/ai/modules'), { recursive: true });
    execSync('echo "# Order module" > docs/ai/modules/order.md', { cwd: dir, stdio: 'pipe' });
    execSync('git add . && git commit -m "add ctxops"', { cwd: dir, stdio: 'pipe' });
    run('link docs/ai/modules/order.md "services/order/**"', dir);
    execSync('git add . && git commit -m "add links"', { cwd: dir, stdio: 'pipe' });
    return dir;
  }

  it('T-DOC-01: detects DRIFTED', () => {
    const dir = setupDoctorRepo('doc-01');
    execSync('git checkout -b feature/test', { cwd: dir, stdio: 'pipe' });
    execSync('echo "changed" > services/order/handler.ts && git add . && git commit -m "change"', { cwd: dir, stdio: 'pipe' });

    const { stdout, exitCode } = run('doctor --base master', dir);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('DRIFTED');
    expect(stdout).toContain('docs/ai/modules/order.md');
  });

  it('T-DOC-03: detects SYNCED', () => {
    const dir = setupDoctorRepo('doc-03');
    execSync('git checkout -b feature/test', { cwd: dir, stdio: 'pipe' });
    execSync('echo "changed" > services/order/handler.ts && echo "updated" >> docs/ai/modules/order.md && git add . && git commit -m "change both"', { cwd: dir, stdio: 'pipe' });

    const { stdout, exitCode } = run('doctor --base master', dir);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('SYNCED');
  });

  it('T-DOC-04: UNAFFECTED when different paths change', () => {
    const dir = setupDoctorRepo('doc-04');
    execSync('git checkout -b feature/test', { cwd: dir, stdio: 'pipe' });
    execSync('echo "changed" > services/inventory/service.ts && git add . && git commit -m "change inv"', { cwd: dir, stdio: 'pipe' });

    const { stdout, exitCode } = run('doctor --base master', dir);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('unaffected');
    expect(stdout).not.toContain('DRIFTED');
  });

  it('T-DOC-05: strict mode exits 1 on drift', () => {
    const dir = setupDoctorRepo('doc-05');
    execSync('git checkout -b feature/test', { cwd: dir, stdio: 'pipe' });
    execSync('echo "changed" > services/order/handler.ts && git add . && git commit -m "change"', { cwd: dir, stdio: 'pipe' });

    const { stdout, exitCode } = run('doctor --base master --mode strict', dir);
    expect(exitCode).toBe(1);
    expect(stdout).toContain('failed');
  });

  it('T-DOC-06: strict mode passes when synced', () => {
    const dir = setupDoctorRepo('doc-06');
    execSync('git checkout -b feature/test', { cwd: dir, stdio: 'pipe' });
    execSync('echo "changed" > services/order/handler.ts && echo "updated" >> docs/ai/modules/order.md && git add . && git commit -m "change both"', { cwd: dir, stdio: 'pipe' });

    const { stdout, exitCode } = run('doctor --base master --mode strict', dir);
    expect(exitCode).toBe(0);
    expect(stdout).not.toContain('failed');
  });

  it('T-DOC-07: JSON output format', () => {
    const dir = setupDoctorRepo('doc-07');
    execSync('git checkout -b feature/test', { cwd: dir, stdio: 'pipe' });
    execSync('echo "changed" > services/order/handler.ts && git add . && git commit -m "change"', { cwd: dir, stdio: 'pipe' });

    const { stdout, exitCode } = run('doctor --base master --format json', dir);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.base).toBe('master');
    expect(parsed.results).toBeDefined();
    expect(parsed.summary).toBeDefined();
  });

  it('T-DOC-09: no links message', () => {
    const dir = setupGitRepo('doc-09');
    run('init', dir);
    execSync('git add . && git commit -m "init"', { cwd: dir, stdio: 'pipe' });
    execSync('git checkout -b feature/test', { cwd: dir, stdio: 'pipe' });
    execSync('echo "changed" > services/order/handler.ts && git add . && git commit -m "change"', { cwd: dir, stdio: 'pipe' });

    // Doctor auto-discovers links from init template docs, so it won't say 'No links found'
    // Instead it should run successfully with auto-discovered links
    const { stdout, exitCode } = run('doctor --base master', dir);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Auto-discovered');
  });
});
