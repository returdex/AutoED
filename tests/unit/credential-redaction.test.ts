import { afterEach, describe, expect, it } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { NativeSecretStore, issueCredential, verifyCredential, revokeCredential } from '../../packages/platform/src/credentials.js';
import { initializeInstallation, readInstallation } from '../../packages/platform/src/installation.js';
import { createHarness } from '../../packages/test-support/src/harness.js';

const harnesses: ReturnType<typeof createHarness>[] = [];
afterEach(async () => { for (const h of harnesses.splice(0)) await h.cleanup(); });
function memory() {
  const entries = new Map<string, string>();
  return { entries, store: new NativeSecretStore((service, name) => ({
    async getPassword() { return entries.get(service + ':' + name); },
    async setPassword(value: string) { entries.set(service + ':' + name, value); },
    async deleteCredential() { return entries.delete(service + ':' + name); },
  })) };
}
describe('synthetic credential boundary (not native Keychain evidence)', () => {
  it('strips private exception details and never falls back to files', async () => {
    const h = createHarness(); harnesses.push(h); const parent = realpathSync(h.root); const root = join(parent, 'installation');
    const secret = randomBytes(32).toString('base64url');
    const denied = new NativeSecretStore(() => { throw new Error(secret); });
    await expect(initializeInstallation({ root, parent, excludedRoots: [] }, denied)).rejects.toThrow('SECRET_STORE_UNAVAILABLE');
    expect(existsSync(join(root, 'installation.json'))).toBe(false);
    // Failed provisioning leaves protected, empty directories; no plaintext token or misleading receipt.
    if (existsSync(root)) for (const name of readdirSync(root)) expect(readdirSync(join(root, name)).length).toBe(0);
    try { await denied.get(randomUUID(), 'cli'); } catch (error) { expect(String(error).includes(secret)).toBe(false); expect((error as Error).cause).toBeUndefined(); }
  });
  it('isolates installation namespaces and rejects arbitrary names', async () => {
    const { store } = memory(); const a = randomUUID(); const b = randomUUID(); const value = randomBytes(32).toString('base64url');
    await store.set(a, 'cli', value); expect((await store.get(a, 'cli')) === value).toBe(true); expect(await store.get(b, 'cli')).toBeNull();
    await expect(store.get(a, '../legacy')).rejects.toThrow('INVALID_CREDENTIAL');
    await expect(store.get('legacy', 'cli')).rejects.toThrow('INVALID_CREDENTIAL');
    await store.delete(a, 'cli'); expect(await store.get(a, 'cli')).toBeNull();
  });
  it('uses 256-bit independent tokens, binding digest to scope and destination; revoke/rotate are immediate', async () => {
    const { store, entries } = memory(); const installationId = randomUUID(); const scope = { installationId, source: 'synthetic', courseId: 'selftest' } as const;
    const record = await issueCredential(store, installationId, 'cli', scope, 'local_cli'); const token = await store.get(installationId, 'cli');
    expect(token !== null && Buffer.from(token, 'base64url').length === 32).toBe(true); expect(JSON.stringify(record).includes(token!)).toBe(false);
    expect(await verifyCredential(store, record, token!, scope, 'local_cli')).toBe(true);
    expect(await verifyCredential(store, record, token!, scope, 'model')).toBe(false);
    expect(await verifyCredential(store, record, token!, { ...scope, installationId: randomUUID() }, 'local_cli')).toBe(false);
    const rotated = await issueCredential(store, installationId, 'cli', scope, 'local_cli');
    expect(await verifyCredential(store, record, token!, scope, 'local_cli')).toBe(false);
    expect(await verifyCredential(store, rotated, token!, scope, 'local_cli')).toBe(false);
    await revokeCredential(store, rotated); expect(entries.size).toBe(0);
  });
  it('creates nonsecret metadata only after provisioning and never adopts/overwrites an existing installation', async () => {
    const h = createHarness(); harnesses.push(h); const parent = realpathSync(h.root); const selection = { root: join(parent, 'install'), parent, excludedRoots: [] }; const { store, entries } = memory();
    const result = await initializeInstallation(selection, store); const raw = readFileSync(join(selection.root, 'installation.json'), 'utf8');
    expect(result.port).toBe(43187); expect(result.rootAlias).toBe('managed-root'); expect(new Set(entries.values()).size).toBe(4);
    expect([...entries.values()].every(token => !raw.includes(token))).toBe(true); expect(raw.includes(selection.root)).toBe(false);
    expect(readInstallation(selection).installationId === result.installationId).toBe(true);
    await expect(initializeInstallation(selection, store)).rejects.toThrow('ROOT_ALREADY_EXISTS');
  });
});
