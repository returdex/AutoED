import { randomUUID } from 'node:crypto';
import { closeSync, fsyncSync, lstatSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname } from 'node:path';
import { z } from 'zod';
import type { SecretStore } from '../../application/src/ports.js';
import { NativeSecretStore, issueCredential, assertInstallationId } from './credentials.js';
import { assertManagedPath, createManagedRoot, managedPaths, preflightRoot, type RootSelection } from './paths.js';
import { protectPath, verifyProtectedPath } from './permissions.js';

const scopeSchema = z.strictObject({ installationId: z.uuid(), source: z.literal('synthetic'), courseId: z.literal('selftest') });
const recordSchema = z.strictObject({ installationId: z.uuid(), name: z.enum(['api', 'cli', 'mcp', 'installer']), digest: z.string().regex(/^[a-f0-9]{64}$/), scope: scopeSchema, destination: z.enum(['service', 'local_cli', 'model', 'installer']), operationId: z.null(), generation: z.null(), expiresAt: z.null() });
const metadataSchema = z.strictObject({
  schema: z.literal(1), installationId: z.uuid(), port: z.literal(43187), rootAlias: z.literal('managed-root'),
  ownership: z.strictObject({ device: z.number().int(), inode: z.number().int(), uid: z.number().int() }),
  approvedScope: scopeSchema, credentials: z.array(recordSchema).length(4),
}).refine(value => value.approvedScope.installationId === value.installationId && new Set(value.credentials.map(c => c.name)).size === 4 && value.credentials.every(c => c.installationId === value.installationId && c.scope.installationId === value.installationId && c.destination === ({ api: 'service', cli: 'local_cli', mcp: 'model', installer: 'installer' } as const)[c.name]));
export type InstallationMetadata = z.infer<typeof metadataSchema>;
const receiptSchema = z.strictObject({ schema: z.literal(1), installationId: z.uuid(), state: z.literal('initialization_intent'), names: z.tuple([z.literal('api'), z.literal('cli'), z.literal('mcp'), z.literal('installer')]), ownership: z.strictObject({ device: z.number().int(), inode: z.number().int(), uid: z.number().int() }) });
function writeProtectedJSON(path: string, value: unknown): void {
  const fd = openSync(path, 'wx', 0o600);
  try { protectPath(path); writeFileSync(fd, JSON.stringify(value)); fsyncSync(fd); } finally { closeSync(fd); }
  if (process.platform === 'darwin') {
    const directory = openSync(dirname(path), 'r');
    try { fsyncSync(directory); } finally { closeSync(directory); }
  }
  // Windows fsync flushes the file, but directory-entry survival after power loss
  // is not verified here. This receipt supports process interruption recovery;
  // it is not a claim of cross-platform power-loss atomicity.
}

/** Bind-only collision check: never connects to or authenticates with an unknown service. */
export async function assertPortAvailable(port = 43187): Promise<void> {
  if (port !== 43187) throw new Error('INSTALLATION_PREVIEW_REQUIRED');
  await new Promise<void>((resolve, reject) => {
    const server = createServer(); server.once('error', () => reject(new Error('PORT_CONFLICT_REPREVIEW')));
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => server.close(error => error ? reject(new Error('PORT_CONFLICT_REPREVIEW')) : resolve()));
  });
}
/** Installer must obtain approval for the exact selection first. No persistent default-root side effects. */
export async function initializeInstallation(selection: RootSelection, store: SecretStore = new NativeSecretStore(), installationId: string = randomUUID()): Promise<InstallationMetadata> {
  assertInstallationId(installationId);
  preflightRoot(selection); await assertPortAvailable();
  const paths = createManagedRoot(selection);
  const scope = { installationId, source: 'synthetic', courseId: 'selftest' } as const;
  const stat = lstatSync(paths.root);
  const ownership = { device: stat.dev, inode: stat.ino, uid: stat.uid };
  // Flushed exact namespace intent precedes any credential operation. If interrupted or
  // denied, recovery can locate only these owned entries without enumeration or guessing.
  writeProtectedJSON(assertManagedPath(paths, 'provisioning.json'), { schema: 1, installationId, state: 'initialization_intent', names: ['api', 'cli', 'mcp', 'installer'], ownership });
  const credentials = [];
  // A store failure stops immediately: do not retry, prompt, or publish a successful receipt.
  // Any partially provisioned exact UUID entries require installer recovery, not broad cleanup.
  for (const [name, destination] of [['api', 'service'], ['cli', 'local_cli'], ['mcp', 'model'], ['installer', 'installer']] as const) credentials.push(await issueCredential(store, installationId, name, scope, destination));
  const metadata = metadataSchema.parse({ schema: 1, installationId, port: 43187, rootAlias: 'managed-root', ownership, approvedScope: scope, credentials });
  const path = assertManagedPath(paths, 'installation.json');
  writeProtectedJSON(path, metadata);
  return metadata;
}
/** Historical initialization intent, not current state. Recovery must check for valid
 * installation.json first and must never revoke an active installation from this receipt.
 * Does not retry a denied/locked OS operation. */
export function readProvisioningReceipt(selection: RootSelection) {
  try {
    preflightRoot(selection); const paths = managedPaths(selection.root);
    const path = assertManagedPath(paths, 'provisioning.json'); if (lstatSync(path).size > 4096) throw new Error('receipt');
    const receipt = receiptSchema.parse(JSON.parse(readFileSync(path, 'utf8'))); const stat = lstatSync(paths.root);
    if (receipt.ownership.device !== stat.dev || receipt.ownership.inode !== stat.ino || receipt.ownership.uid !== stat.uid) throw new Error('owner');
    return receipt;
  } catch { throw new Error('INVALID_INSTALLATION'); }
}
export function readInstallation(selection: RootSelection): InstallationMetadata {
  try {
    preflightRoot(selection); const paths = managedPaths(selection.root); verifyProtectedPath(paths.root);
    const path = assertManagedPath(paths, 'installation.json'); const info = lstatSync(path);
    if (!info.isFile() || info.size > 16384) throw new Error('metadata');
    const metadata = metadataSchema.parse(JSON.parse(readFileSync(path, 'utf8'))); const stat = lstatSync(paths.root);
    if (metadata.ownership.device !== stat.dev || metadata.ownership.inode !== stat.ino || metadata.ownership.uid !== stat.uid) throw new Error('owner');
    return metadata;
  } catch { throw new Error('INVALID_INSTALLATION'); }
}
