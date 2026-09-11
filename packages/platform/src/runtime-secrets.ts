import { randomUUID } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { SecretStore } from '../../application/src/ports.js';
import { NativeSecretStore, assertInstallationId } from './credentials.js';
import { readInstallation } from './installation.js';
import { assertManagedPath, managedPaths, type RootSelection } from './paths.js';
import { protectPath, verifyProtectedPath } from './permissions.js';

const credentialName = /^(api|cli|mcp|installer|native-test|selfcheck-[0-9a-f-]{36})$/;
const runId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function syntheticSelection(selection: RootSelection): boolean {
  let parent: string;
  try { parent = realpathSync(selection.parent); }
  catch { return false; }
  if (!/^autoed-synthetic-[A-Za-z0-9]+$/.test(basename(parent))) return false;
  try {
    if (process.env.AUTOED_SYNTHETIC_TEST !== '1') throw new Error('context');
    if (selection.root !== join(parent, 'installation')) throw new Error('selection');
    const markerPath = `${parent}.synthetic-run.json`, stat = lstatSync(markerPath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 4096) throw new Error('marker');
    verifyProtectedPath(markerPath);
    const marker = JSON.parse(readFileSync(markerPath, 'utf8')) as { schema?: unknown; root?: unknown; runId?: unknown };
    if (marker.schema !== 1 || marker.root !== parent || typeof marker.runId !== 'string' || !runId.test(marker.runId)) throw new Error('marker');
    return true;
  } catch { throw new Error('SYNTHETIC_SECRET_STORE_DENIED'); }
}

class SyntheticFileSecretStore implements SecretStore {
  constructor(private readonly selection: RootSelection) { if (!syntheticSelection(selection)) throw new Error('SYNTHETIC_SECRET_STORE_DENIED'); }
  #path(id: string, name: string): string {
    assertInstallationId(id); if (!credentialName.test(name)) throw new Error('INVALID_CREDENTIAL');
    const directory = assertManagedPath(managedPaths(this.selection.root), 'secrets/synthetic-credentials');
    if (!existsSync(directory)) { mkdirSync(directory, { mode: 0o700 }); protectPath(directory); }
    else verifyProtectedPath(directory);
    return assertManagedPath(managedPaths(this.selection.root), `secrets/synthetic-credentials/${id.toLowerCase()}-${name}`);
  }
  async get(id: string, name: string): Promise<string | null> {
    const path = this.#path(id, name); if (!existsSync(path)) return null;
    try {
      const stat = lstatSync(path); if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size < 32 || stat.size > 4096) throw new Error('credential');
      verifyProtectedPath(path); return readFileSync(path, 'utf8');
    } catch { throw new Error('SECRET_STORE_UNAVAILABLE'); }
  }
  async set(id: string, name: string, value: string): Promise<void> {
    if (typeof value !== 'string' || value.length < 32 || value.length > 4096) throw new Error('INVALID_CREDENTIAL');
    const path = this.#path(id, name), pending = `${path}.${randomUUID()}.pending`; let descriptor: number | undefined;
    try {
      descriptor = openSync(pending, 'wx', 0o600); protectPath(pending); writeFileSync(descriptor, value); fsyncSync(descriptor); closeSync(descriptor); descriptor = undefined;
      renameSync(pending, path); protectPath(path);
    } catch { if (descriptor !== undefined) try { closeSync(descriptor); } catch {} try { if (existsSync(pending)) unlinkSync(pending); } catch {} throw new Error('SECRET_STORE_UNAVAILABLE'); }
  }
  async delete(id: string, name: string): Promise<void> {
    const path = this.#path(id, name);
    try { if (existsSync(path)) { verifyProtectedPath(path); unlinkSync(path); } }
    catch { throw new Error('SECRET_STORE_UNAVAILABLE'); }
  }
}

/** Synthetic S/I fixtures use only their protected disposable installation.
 * Every production installation continues to use the native OS secret store.
 */
export function secretStoreForProvisioning(selection: RootSelection): SecretStore {
  return syntheticSelection(selection) ? new SyntheticFileSecretStore(selection) : new NativeSecretStore();
}

export function secretStoreForInstallation(selection: RootSelection): SecretStore {
  const metadata = readInstallation(selection);
  if (metadata.syntheticTest === true && syntheticSelection(selection)) return new SyntheticFileSecretStore(selection);
  return new NativeSecretStore();
}
