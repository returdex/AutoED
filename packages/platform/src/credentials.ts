import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { SecretStore } from '../../application/src/ports.js';
import type { Scope } from '../../domain/src/model.js';

interface NativeEntry { getPassword(): Promise<string | undefined>; setPassword(value: string): Promise<void>; deleteCredential(): Promise<boolean> }
type EntryFactory = (service: string, name: string) => NativeEntry | Promise<NativeEntry>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function assertInstallationId(id: string): void { if (!uuid.test(id)) throw new Error('INVALID_CREDENTIAL'); }
function validate(id: string, name: string): void {
  assertInstallationId(id);
  if (!/^(api|cli|mcp|installer|native-test|selfcheck-[0-9a-f-]{36})$/.test(name)) throw new Error('INVALID_CREDENTIAL');
}
const nativeFactory: EntryFactory = async (service, name) => {
  if (!['darwin', 'win32'].includes(process.platform)) throw new Error('unsupported');
  const { AsyncEntry } = await import('@napi-rs/keyring');
  return new AsyncEntry(service, name);
};
/** Exact installation UUID namespaces only. Never enumerate or fall back to plaintext. */
export class NativeSecretStore implements SecretStore {
  readonly #factory: EntryFactory;
  constructor(factory: EntryFactory = nativeFactory) { this.#factory = factory; }
  async #entry(id: string, name: string): Promise<NativeEntry> { return this.#factory(`org.autoed.rebuild.${id.toLowerCase()}`, name); }
  async get(id: string, name: string): Promise<string | null> {
    validate(id, name);
    try { return (await (await this.#entry(id, name)).getPassword()) ?? null; } catch { throw new Error('SECRET_STORE_UNAVAILABLE'); }
  }
  async set(id: string, name: string, value: string): Promise<void> {
    validate(id, name);
    if (typeof value !== 'string' || value.length < 32 || value.length > 4096) throw new Error('INVALID_CREDENTIAL');
    try { await (await this.#entry(id, name)).setPassword(value); } catch { throw new Error('SECRET_STORE_UNAVAILABLE'); }
  }
  async delete(id: string, name: string): Promise<void> {
    validate(id, name);
    try { await (await this.#entry(id, name)).deleteCredential(); } catch { throw new Error('SECRET_STORE_UNAVAILABLE'); }
  }
}
export type CredentialDestination = 'local_cli' | 'model' | 'service' | 'installer' | 'selfcheck';
export interface CredentialRecord {
  installationId: string; name: string; digest: string; scope: Scope; destination: CredentialDestination;
  operationId: string | null; generation: number | null; expiresAt: number | null;
}
function digest(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function matches(a: string, b: string): boolean { return timingSafeEqual(Buffer.from(digest(a), 'hex'), Buffer.from(digest(b), 'hex')); }
function validateScope(id: string, scope: Scope): void {
  if (scope.installationId !== id || scope.source !== 'synthetic' || scope.courseId !== 'selftest' || Object.keys(scope).sort().join(',') !== 'courseId,installationId,source') throw new Error('INVALID_CREDENTIAL');
}
export async function issueCredential(store: SecretStore, installationId: string, name: string, scope: Scope, destination: CredentialDestination, selfcheck?: { operationId: string; generation: number; expiresAt: number }): Promise<CredentialRecord> {
  validate(installationId, name); validateScope(installationId, scope);
  const expected = name === 'api' ? 'service' : name === 'cli' ? 'local_cli' : name === 'mcp' ? 'model' : name === 'installer' ? 'installer' : name.startsWith('selfcheck-') ? 'selfcheck' : null;
  if (destination !== expected) throw new Error('INVALID_CREDENTIAL');
  if (destination === 'selfcheck') {
    if (!selfcheck || !uuid.test(selfcheck.operationId) || !Number.isSafeInteger(selfcheck.generation) || selfcheck.generation < 0 || name !== `selfcheck-${selfcheck.operationId}` || !Number.isSafeInteger(selfcheck.expiresAt) || selfcheck.expiresAt <= Date.now() || selfcheck.expiresAt > Date.now() + 300_000) throw new Error('INVALID_CREDENTIAL');
  } else if (selfcheck) throw new Error('INVALID_CREDENTIAL');
  const token = randomBytes(32).toString('base64url');
  await store.set(installationId, name, token);
  return { installationId, name, digest: digest(token), scope: { ...scope }, destination, operationId: selfcheck?.operationId ?? null, generation: selfcheck?.generation ?? null, expiresAt: selfcheck?.expiresAt ?? null };
}
/** Caller supplies authenticated scope/destination, never trusts either from request body. */
export async function verifyCredential(store: SecretStore, record: CredentialRecord, token: string, scope: Scope, destination: CredentialDestination, operationId: string | null = null, generation: number | null = null): Promise<boolean> {
  try {
    validate(record.installationId, record.name); validateScope(record.installationId, scope); validateScope(record.installationId, record.scope);
    const expected = record.name === 'api' ? 'service' : record.name === 'cli' ? 'local_cli' : record.name === 'mcp' ? 'model' : record.name === 'installer' ? 'installer' : record.name === `selfcheck-${record.operationId}` ? 'selfcheck' : null;
    if (record.destination !== expected || record.destination !== destination || record.operationId !== operationId || record.generation !== generation || record.expiresAt !== null && record.expiresAt <= Date.now() || typeof token !== 'string' || token.length > 4096 || !/^[a-f0-9]{64}$/.test(record.digest)) return false;
    if (destination === 'selfcheck' && (record.operationId === null || record.generation === null || record.expiresAt === null)) return false;
  } catch { return false; }
  let current: string | null;
  try { current = await store.get(record.installationId, record.name); } catch { throw new Error('SECRET_STORE_UNAVAILABLE'); }
  return current !== null && matches(current, token) && timingSafeEqual(Buffer.from(record.digest, 'hex'), Buffer.from(digest(current), 'hex'));
}
export async function revokeCredential(store: SecretStore, record: CredentialRecord): Promise<void> { await store.delete(record.installationId, record.name); }
