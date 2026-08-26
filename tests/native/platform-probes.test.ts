import { afterEach, describe, expect, it } from 'vitest';
import { chmodSync, existsSync, lstatSync, mkdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHarness } from '../../packages/test-support/src/harness.js';
import { assertSupportedPlatform, detectPlatform } from '../../packages/platform/src/platform.js';
import { createManagedRoot, preflightRoot, assertManagedPath, assertLocalVolume, managedPaths } from '../../packages/platform/src/paths.js';
import { protectPath, verifyProtectedPath } from '../../packages/platform/src/permissions.js';

const harnesses: ReturnType<typeof createHarness>[] = [];
function fixture() { const h = createHarness(); harnesses.push(h); const parent = realpathSync(h.root); return { parent, root: join(parent, '新 installation'), excludedRoots: [join(parent, 'legacy')] }; }
afterEach(async () => { for (const h of harnesses.splice(0)) await h.cleanup(); });
describe('native managed platform boundary (only the executing OS is evidence)', () => {
  it('detects actual OS and architecture without claiming the other native platform', () => {
    const actual = detectPlatform(); expect(actual.platform).toBe(process.platform); expect(actual.arch).toBe(process.arch);
    expect(actual.version).toMatch(/^\d+\./); expect(() => assertSupportedPlatform(actual)).not.toThrow();
    for (const invalid of [{ platform: 'linux', arch: 'x64', version: '6.1' }, { platform: 'darwin', arch: 'x64', version: '26.5.2' }, { platform: 'win32', arch: 'x64', version: '10.0.19045' }]) expect(() => assertSupportedPlatform(invalid)).toThrow('UNSUPPORTED_PLATFORM');
  });
  it('preflight is read-only and sanitized, then creates protected separated roots', () => {
    const f = fixture(); const preview = preflightRoot(f); expect(existsSync(f.root)).toBe(false); expect(JSON.stringify(preview).includes(f.parent)).toBe(false);
    const paths = createManagedRoot(f); expect(new Set(Object.values(paths)).size).toBe(8);
    for (const path of Object.values(paths)) expect(verifyProtectedPath(path)).toBe(true);
    const file = join(paths.data, 'sample'); writeFileSync(file, 'synthetic', { mode: 0o600 }); protectPath(file); expect(verifyProtectedPath(file)).toBe(true);
    if (process.platform === 'darwin') { expect(lstatSync(paths.root).mode & 0o777).toBe(0o700); expect(lstatSync(file).mode & 0o777).toBe(0o600); }
  });
  it('does not adopt unknown existing roots or change their permissions', () => {
    const f = fixture(); mkdirSync(f.root, { mode: 0o755 }); const before = lstatSync(f.root).mode;
    expect(() => createManagedRoot(f)).toThrow('ROOT_ALREADY_EXISTS'); expect(lstatSync(f.root).mode).toBe(before);
  });
  it('rejects legacy overlap, escapes, synchronized roots, and missing approval', () => {
    const f = fixture();
    expect(() => preflightRoot({ ...f, root: join(f.parent, 'legacy', 'nested') })).toThrow('UNSAFE_PATH');
    expect(() => preflightRoot({ ...f, root: join(f.parent, '..', 'escape') })).toThrow('UNSAFE_PATH');
    expect(() => preflightRoot({ ...f, root: join(f.parent, 'OneDrive', 'data') })).toThrow('UNSAFE_PATH');
    expect(() => preflightRoot({ ...f, parent: '' })).toThrow('UNSAFE_PATH');
    expect(() => preflightRoot({ root: join(homedir(), 'Documents', 'AutoED', 'nested'), parent: join(homedir(), 'Documents', 'AutoED'), excludedRoots: [] })).toThrow('UNSAFE_PATH');
    const paths = createManagedRoot(f); expect(() => assertManagedPath(paths, '../escape')).toThrow('UNSAFE_PATH');
    expect(() => assertManagedPath(paths, '/absolute')).toThrow('UNSAFE_PATH');
  });
  it('rejects every symlink/junction layer and changed managed permissions', () => {
    const f = fixture(); const paths = createManagedRoot(f); const target = join(f.parent, 'outside'); mkdirSync(target);
    symlinkSync(target, join(paths.data, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
    expect(() => assertManagedPath(paths, 'data/link/child')).toThrow('UNSAFE_PATH');
    expect(() => preflightRoot({ ...f, root: join(paths.data, 'link', 'other'), parent: join(paths.data, 'link') })).toThrow('UNSAFE_PATH');
    if (process.platform === 'darwin') { chmodSync(paths.data, 0o755); expect(() => assertManagedPath(paths, 'data/child')).toThrow('INSECURE_PERMISSIONS'); }
  });
  it('fails closed for network and unknown volumes (synthetic mount negatives)', () => {
    expect(() => assertLocalVolume('/Volumes/remote/test', { platform: 'darwin', mountTable: 'server:/share on /Volumes/remote (nfs, nodev)' })).toThrow('NONLOCAL_VOLUME');
    expect(() => assertLocalVolume('/unknown/test', { platform: 'darwin', mountTable: '' })).toThrow('LOCAL_VOLUME_UNCONFIRMED');
    expect(() => managedPaths('relative')).toThrow('UNSAFE_PATH');
  });
});
