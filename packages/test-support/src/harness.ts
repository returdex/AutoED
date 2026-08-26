import { mkdtempSync, lstatSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir, release } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';

export type EvidenceKind = 'S' | 'I' | 'N' | 'L';
export type EvidenceResult = 'not_run' | 'pass' | 'fail' | 'skip' | 'human_needed';
export interface Evidence {
  kind: EvidenceKind; scenario: string; build: string; os: string; arch: string;
  result: EvidenceResult; checkedAt: string | null;
}
export function evidence(kind: EvidenceKind, scenario: string, build: string): Evidence {
  return { kind, scenario, build, os: process.platform, arch: process.arch, result: 'not_run', checkedAt: null };
}
export function summarizeEvidence(items: readonly Evidence[]): EvidenceResult {
  if (items.some(item => item.result === 'fail')) return 'fail';
  if (items.some(item => item.result === 'human_needed')) return 'human_needed';
  return items.length > 0 && items.every(item => item.result === 'pass') ? 'pass' : 'not_run';
}
export function assertNativePlatform(expected: 'darwin' | 'win32', actual = { platform: process.platform as string, arch: process.arch as string, release: release() }): void {
  if (actual.platform !== expected || /microsoft|wsl/i.test(actual.release) ||
      (expected === 'win32' ? actual.arch !== 'x64' : actual.arch !== 'arm64')) throw new Error('Required native platform not available');
}
export function assertLocalURL(input: string | URL): URL {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname) || url.username || url.password) {
    throw new Error('Synthetic tests permit loopback HTTP only');
  }
  return url;
}

/** No real Profile or data roots; ownership is object identity, never a caller PID. */
export function createHarness() {
  const root = mkdtempSync(join(tmpdir(), 'autoed-synthetic-'));
  const original = lstatSync(root);
  const canonical = realpathSync(root);
  const owned = new Set<ChildProcess>();
  let cleaned = false;
  async function stop(child: ChildProcess): Promise<void> {
    if (!owned.has(child)) throw new Error('Process is not owned by this harness');
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      await Promise.race([exited, new Promise<never>((_, reject) => {
        const timer = setTimeout(() => reject(new Error('Owned child did not exit; cleanup stopped')), 5_000); timer.unref();
        child.once('exit', () => clearTimeout(timer));
      })]);
    }
    owned.delete(child);
  }
  return {
    root,
    canary: `synthetic-only-${randomUUID()}`,
    async fetch(input: string | URL, options: RequestInit = {}): Promise<Response> {
      return fetch(assertLocalURL(input), { ...options, redirect: 'error', signal: options.signal ?? AbortSignal.timeout(5_000) });
    },
    spawn(args: readonly string[]): ChildProcess {
      if (cleaned) throw new Error('Harness already cleaned');
      const child = spawn(process.execPath, [...args], { cwd: root, stdio: 'ignore', env: { PATH: process.env.PATH, AUTOED_SYNTHETIC_TEST: '1' } });
      owned.add(child);
      return child;
    },
    stop,
    async cleanup(): Promise<void> {
      if (cleaned) return;
      for (const child of owned) await stop(child);
      const current = lstatSync(root);
      if (current.isSymbolicLink() || current.ino !== original.ino || current.dev !== original.dev || realpathSync(root) !== canonical) throw new Error('Temporary root ownership changed');
      rmSync(root, { recursive: true });
      cleaned = true;
    },
  };
}
