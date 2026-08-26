import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, existsSync, symlinkSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { assertNativePlatform, assertLocalURL, createHarness, summarizeEvidence, evidence } from '../../packages/test-support/src/harness.js';
import { TOOLCHAIN, target, hashBuildInputs, loadVerifier, verifySignedChecksums, verifyArchive, verifyIntegrity, assertRegularFile, checkPackage, RELEASE_FINGERPRINTS, VERIFIER_INTEGRITY } from '../../scripts/dev/runtime.mjs';

describe('managed bootstrap and synthetic harness', () => {
  it('runs actual Node 24 and exact installed dependencies', () => {
    expect(process.version).toBe('v24.20.0');
    const pkg = checkPackage();
    expect(Object.keys(pkg.dependencies).some(name => /openai|anthropic|openpgp/i.test(name))).toBe(false);
    expect(pkg.dependencies.playwright).toBe(pkg.devDependencies['@playwright/test']);
  });
  it('changes build inputs hash when an untracked source changes', async () => {
    const harness = createHarness();
    try {
      for (const file of ['package.json', 'package-lock.json', 'tsconfig.json']) writeFileSync(join(harness.root, file), '{}');
      mkdirSync(join(harness.root, 'apps'));
      writeFileSync(join(harness.root, 'apps/main.ts'), 'export const value = 1;');
      const before = hashBuildInputs(harness.root);
      writeFileSync(join(harness.root, 'apps/main.ts'), 'export const value = 2;');
      expect(hashBuildInputs(harness.root)).not.toBe(before);
    } finally { await harness.cleanup(); }
  });
  it('accepts loopback only and rejects school hosts, userinfo and non-http schemes', () => {
    expect(assertLocalURL('http://127.0.0.1:43187/status').hostname).toBe('127.0.0.1');
    for (const url of ['https://moodle.example.edu/', 'http://127.0.0.1.evil/', 'file:///private/data', 'http://user@localhost/']) expect(() => assertLocalURL(url)).toThrow();
  });
  it('enforces local-only fetch without issuing external requests', async () => {
    const harness = createHarness();
    const server = createServer((_req, res) => res.end('synthetic'));
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Missing address');
      expect(await (await harness.fetch(`http://127.0.0.1:${address.port}`)).text()).toBe('synthetic');
      await expect(harness.fetch('https://moodle.example.edu')).rejects.toThrow();
    } finally { server.close(); await harness.cleanup(); }
  });
  it('owns temporary roots and refuses forged process cleanup', async () => {
    const harness = createHarness();
    expect(existsSync(harness.root)).toBe(true);
    await expect(harness.stop({ pid: process.pid } as never)).rejects.toThrow(/owned/);
    const child = harness.spawn(['-e', 'setInterval(() => {}, 1000)']);
    await once(child, 'spawn');
    await harness.stop(child);
    await harness.cleanup();
    expect(existsSync(harness.root)).toBe(false);
  });
  it('rejects symlinks before cache writes', async () => {
    const harness = createHarness();
    try {
      const target = join(harness.root, 'owned'); writeFileSync(target, 'unchanged');
      const link = join(harness.root, 'link'); symlinkSync(target, link);
      expect(() => assertRegularFile(link)).toThrow();
      expect(readFileSync(target, 'utf8')).toBe('unchanged');
    } finally { await harness.cleanup(); }
  });
  it('keeps unrun/skipped evidence from becoming pass and rejects WSL native Windows', () => {
    const item = evidence('S', 'bootstrap', 'build-synthetic');
    expect(item.result).toBe('not_run');
    expect(summarizeEvidence([])).toBe('not_run');
    expect(summarizeEvidence([{ ...item, result: 'skip' }])).toBe('not_run');
    expect(summarizeEvidence([{ ...item, result: 'pass' }, item])).toBe('not_run');
    expect(() => assertNativePlatform('win32', { platform: 'linux', arch: 'x64', release: 'microsoft-WSL2' })).toThrow();
    expect(() => assertNativePlatform('win32', { platform: 'win32', arch: 'x64', release: '10.0.26100' })).not.toThrow();
  });
});

describe('official detached-signature verification', () => {
  let verifier: Awaited<ReturnType<typeof loadVerifier>>;
  const checksums = readFileSync(join(TOOLCHAIN, 'SHASUMS256.txt'));
  const signature = readFileSync(join(TOOLCHAIN, 'SHASUMS256.txt.sig'));
  const keys = RELEASE_FINGERPRINTS.map(fingerprint => readFileSync(join(TOOLCHAIN, `${fingerprint}.asc`), 'utf8'));
  beforeAll(async () => { verifier = await loadVerifier(); });
  it('validates the exact public verifier tarball integrity and rejects tampering', () => {
    const archive = readFileSync(join(TOOLCHAIN, 'verifier/openpgp-6.3.1.tgz'));
    expect(() => verifyIntegrity(archive, VERIFIER_INTEGRITY)).not.toThrow();
    expect(() => verifyIntegrity(Buffer.concat([archive, Buffer.from('changed')]), VERIFIER_INTEGRITY)).toThrow();
  });
  it('accepts the official signed checksum bytes', async () => {
    await expect(verifySignedChecksums(verifier, checksums, signature, keys)).resolves.toMatch(/^[a-f0-9]+$/);
  });
  it('rejects changed checksums and wrong trusted or untrusted keys', async () => {
    await expect(verifySignedChecksums(verifier, Buffer.concat([checksums, Buffer.from('changed')]), signature, keys)).rejects.toThrow();
    await expect(verifySignedChecksums(verifier, checksums, signature, [keys[1]!])).rejects.toThrow();
    await expect(verifySignedChecksums(verifier, checksums, signature, keys, ['0000000000000000000000000000000000000000'])).rejects.toThrow(/fingerprint/);
  });
  it('rejects changed archives and missing or duplicate checksums', () => {
    const filename = `node-v24.20.0-${target()}.${process.platform === 'win32' ? 'zip' : 'tar.gz'}`;
    const archive = readFileSync(join(TOOLCHAIN, filename));
    expect(() => verifyArchive(checksums, filename, archive)).not.toThrow();
    expect(() => verifyArchive(checksums, filename, Buffer.concat([archive, Buffer.from('changed')]))).toThrow(/hash/);
    expect(() => verifyArchive(checksums, 'absent.tar.gz', archive)).toThrow();
    expect(() => verifyArchive(Buffer.concat([checksums, checksums]), filename, archive)).toThrow();
  });
});
