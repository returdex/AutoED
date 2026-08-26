import { afterEach, describe, expect, it } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { NativeSecretStore, issueCredential, verifyCredential, revokeCredential } from '../../packages/platform/src/credentials.js';
import { initializeInstallation, readInstallation, readProvisioningReceipt } from '../../packages/platform/src/installation.js';
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
    if (existsSync(root)) for (const name of readdirSync(root).filter(name => name !== 'provisioning.json')) expect(readdirSync(join(root, name)).length).toBe(0);
    try { await denied.get(randomUUID(), 'cli'); } catch (error) { expect(String(error).includes(secret)).toBe(false); expect((error as Error).cause).toBeUndefined(); }
  });
  it('retains exact nonsecret recovery intent if the second native-store write is denied', async () => {
    const h = createHarness(); harnesses.push(h); const parent = realpathSync(h.root); const selection = { root: join(parent, 'partial'), parent, excludedRoots: [] };
    const { store, entries } = memory(); let writes = 0;
    const interrupted = { get: store.get.bind(store), delete: store.delete.bind(store), async set(id: string, name: string, value: string) { if (++writes === 2) throw new Error('SECRET_STORE_UNAVAILABLE'); await store.set(id, name, value); } };
    await expect(initializeInstallation(selection, interrupted)).rejects.toThrow('SECRET_STORE_UNAVAILABLE');
    const receipt = readProvisioningReceipt(selection); expect(writes).toBe(2); expect(entries.size).toBe(1);
    const raw = readFileSync(join(selection.root, 'provisioning.json'), 'utf8'); expect([...entries.values()].every(value => !raw.includes(value))).toBe(true);
    expect(() => readInstallation(selection)).toThrow('INVALID_INSTALLATION');
    // Synthetic recovery exercises only the recorded namespace. Actual OS authorization remains a human gate.
    for (const name of receipt.names) await store.delete(receipt.installationId, name);
    expect(entries.size).toBe(0);
  });
  it('requires matching operation, generation and unexpired short-lived selfcheck authority', async () => {
    const { store } = memory(); const id = randomUUID(); const operationId = randomUUID(); const scope = { installationId: id, source: 'synthetic', courseId: 'selftest' } as const;
    const record = await issueCredential(store, id, `selfcheck-${operationId}`, scope, 'selfcheck', { operationId, generation: 2, expiresAt: Date.now() + 60000 });
    const token = (await store.get(id, record.name))!;
    expect(await verifyCredential(store, record, token, scope, 'selfcheck', operationId, 2)).toBe(true);
    expect(await verifyCredential(store, record, token, scope, 'selfcheck', operationId, 3)).toBe(false);
    expect(await verifyCredential(store, record, token, scope, 'selfcheck', randomUUID(), 2)).toBe(false);
    expect(await verifyCredential(store, { ...record, expiresAt: Date.now() - 1 }, token, scope, 'selfcheck', operationId, 2)).toBe(false);
  });
  it('isolates installation namespaces and rejects arbitrary names', async () => {
    const { store } = memory(); const a = randomUUID(); const b = randomUUID(); const value = randomBytes(32).toString('base64url');
    await store.set(a, 'cli', value); expect((await store.get(a, 'cli')) === value).toBe(true); expect(await store.get(b, 'cli')).toBeNull();
    await expect(store.get(a, '../legacy')).rejects.toThrow('INVALID_CREDENTIAL');
    await expect(store.get('legacy', 'cli')).rejects.toThrow('INVALID_CREDENTIAL');
    await store.delete(a, 'cli'); expect(await store.get(a, 'cli')).toBeNull();
  });
  it('maps simulated locked/unavailable get, set and delete to a safe hard failure', async () => {
    const privateDetail = randomBytes(32).toString('base64url'); const id = randomUUID();
    const store = new NativeSecretStore(() => ({ async getPassword() { throw new Error(privateDetail); }, async setPassword() { throw new Error(privateDetail); }, async deleteCredential() { throw new Error(privateDetail); } }));
    for (const run of [() => store.get(id, 'cli'), () => store.set(id, 'cli', privateDetail), () => store.delete(id, 'cli')]) {
      try { await run(); throw new Error('expected rejection'); } catch (error) { expect((error as Error).message === 'SECRET_STORE_UNAVAILABLE').toBe(true); expect(String(error).includes(privateDetail)).toBe(false); }
    }
    const { store: working } = memory(); const scope = { installationId: id, source: 'synthetic', courseId: 'selftest' } as const;
    const record = await issueCredential(working, id, 'cli', scope, 'local_cli');
    await expect(verifyCredential(store, record, privateDetail, scope, 'local_cli')).rejects.toThrow('SECRET_STORE_UNAVAILABLE');
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
    writeFileSync(join(selection.root, 'installation.json'), JSON.stringify({ ...result, ownership: { ...result.ownership, inode: result.ownership.inode + 1 } }));
    expect(() => readInstallation(selection)).toThrow('INVALID_INSTALLATION');
    writeFileSync(join(selection.root, 'installation.json'), JSON.stringify({ ...result, credentials: result.credentials.map(c => ({ ...c, destination: 'installer' })) }));
    expect(() => readInstallation(selection)).toThrow('INVALID_INSTALLATION');
  });
  it('stops before root/credential writes on a selected-port conflict without connecting to the listener', async () => {
    const h = createHarness(); harnesses.push(h); const parent = realpathSync(h.root); const selection = { root: join(parent, 'conflict'), parent, excludedRoots: [] }; const { store, entries } = memory();
    const listener = createServer(); let connections = 0; listener.on('connection', socket => { connections++; socket.destroy(); });
    await new Promise<void>((resolve, reject) => { listener.once('error', reject); listener.listen(43187, '127.0.0.1', resolve); });
    try { await expect(initializeInstallation(selection, store)).rejects.toThrow('PORT_CONFLICT_REPREVIEW'); expect(existsSync(selection.root)).toBe(false); expect(entries.size).toBe(0); expect(connections).toBe(0); }
    finally { await new Promise<void>(resolve => listener.close(() => resolve())); }
  });
});
