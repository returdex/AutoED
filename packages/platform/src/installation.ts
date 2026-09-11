import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { closeSync, existsSync, fsyncSync, lstatSync, openSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import type {Stats} from 'node:fs';
import { createServer } from 'node:net';
import { dirname } from 'node:path';
import { z } from 'zod';
import type { SecretStore } from '../../application/src/ports.js';
import { NativeSecretStore, issueCredential, assertInstallationId } from './credentials.js';
import { assertManagedPath, createManagedRoot, managedPaths, preflightRoot, type RootSelection } from './paths.js';
import { protectPath, verifyProtectedPath } from './permissions.js';

const scopeSchema = z.strictObject({ installationId: z.uuid(), source: z.literal('synthetic'), courseId: z.literal('selftest') });
const recordSchema = z.strictObject({ installationId: z.uuid(), name: z.enum(['api', 'cli', 'mcp', 'installer']), digest: z.string().regex(/^[a-f0-9]{64}$/), scope: scopeSchema, destination: z.enum(['service', 'local_cli', 'model', 'installer']), operationId: z.null(), generation: z.null(), expiresAt: z.null() });
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const legacyOwnershipSchema = z.strictObject({ device: z.number().int(), inode: z.number().int(), uid: z.number().int() });
const durableOwnershipSchema = z.strictObject({ kind: z.literal('darwin-volume-v1'), device: z.number().int(), inode: z.number().int(), uid: z.number().int(), rootSha256: hash, volumeSha256: hash });
const migrationSchema = z.strictObject({ fromSchema: z.literal(1), reason: z.literal('mount_identity_changed'), legacyOwnershipSha256: hash, migratedAt: z.iso.datetime({offset:true}) });
const metadataBase = {
  installationId: z.uuid(), port: z.number().int().min(1).max(65535), rootAlias: z.literal('managed-root'),
  syntheticTest: z.literal(true).optional(),
  approvedScope: scopeSchema, credentials: z.array(recordSchema).length(4),
};
const metadataSchema = z.discriminatedUnion('schema',[
  z.strictObject({schema:z.literal(1),...metadataBase,ownership:legacyOwnershipSchema}),
  z.strictObject({schema:z.literal(2),...metadataBase,ownership:durableOwnershipSchema,migration:migrationSchema.optional()}),
]).refine(value => (value.syntheticTest === true ? value.port !== 43187 : value.port === 43187) && value.approvedScope.installationId === value.installationId && new Set(value.credentials.map(c => c.name)).size === 4 && value.credentials.every(c => c.installationId === value.installationId && c.scope.installationId === value.installationId && c.destination === ({ api: 'service', cli: 'local_cli', mcp: 'model', installer: 'installer' } as const)[c.name]));
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

const digest=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
function darwinVolumeSha256(path:string):string {
  try {
    const output=execFileSync('/bin/df',['-P',path],{encoding:'utf8',timeout:5000,stdio:['ignore','pipe','ignore'],maxBuffer:65536}).trim().split('\n');
    const device=/^(\/dev\/disk[^\s]+)\s/.exec(output.at(-1)??'')?.[1];if(!device)throw new Error();
    const plist=execFileSync('/usr/sbin/diskutil',['info','-plist',device],{timeout:5000,stdio:['ignore','pipe','ignore'],maxBuffer:1024*1024});
    const uuid=execFileSync('/usr/bin/plutil',['-extract','VolumeUUID','raw','-o','-','-'],{input:plist,encoding:'utf8',timeout:5000,stdio:['pipe','pipe','ignore'],maxBuffer:4096}).trim().toLowerCase();
    if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(uuid))throw new Error();return digest('darwin-volume-v1\0'+uuid);
  } catch { throw new Error('LOCAL_VOLUME_IDENTITY_UNCONFIRMED'); }
}
function durableOwnership(root:string,stat:Stats,synthetic:boolean){
  if(process.platform!=='darwin')throw new Error('LOCAL_VOLUME_IDENTITY_UNCONFIRMED');
  const canonical=realpathSync(root),volumeSha256=synthetic?digest('synthetic-volume-v1\0'+realpathSync(dirname(root))):darwinVolumeSha256(root);
  return {kind:'darwin-volume-v1' as const,device:stat.dev,inode:stat.ino,uid:stat.uid,rootSha256:digest('managed-root-v1\0'+canonical),volumeSha256};
}
function durableMatches(actual:ReturnType<typeof durableOwnership>,expected:z.infer<typeof durableOwnershipSchema>){
  return actual.kind===expected.kind&&actual.inode===expected.inode&&actual.uid===expected.uid&&actual.rootSha256===expected.rootSha256&&actual.volumeSha256===expected.volumeSha256;
}

export interface LegacyDeviceRecoveryProof {readonly schema:1}
const legacyRecoveryProofs=new WeakMap<object,{selection:RootSelection;metadata:Extract<InstallationMetadata,{schema:1}>;bytesSha256:string;ownership:ReturnType<typeof durableOwnership>}>();
/** Produces an in-memory proof only when the volatile macOS device is the sole
 * ownership mismatch. It performs no write and exposes no installation data. */
export function inspectLegacyDeviceRecovery(selection:RootSelection):LegacyDeviceRecoveryProof {
  try {
    if(process.platform!=='darwin')throw new Error();preflightRoot(selection);const paths=managedPaths(selection.root);verifyProtectedPath(paths.root);
    const path=assertManagedPath(paths,'installation.json'),info=lstatSync(path);if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||info.size>16384)throw new Error();verifyProtectedPath(path);
    const bytes=readFileSync(path),metadata=metadataSchema.parse(JSON.parse(bytes.toString('utf8')));if(metadata.schema!==1)throw new Error();const stat=lstatSync(paths.root);
    if(metadata.ownership.device===stat.dev||metadata.ownership.inode!==stat.ino||metadata.ownership.uid!==stat.uid)throw new Error();
    const proof=Object.freeze({schema:1 as const});legacyRecoveryProofs.set(proof,{selection,metadata,bytesSha256:digest(bytes),ownership:durableOwnership(paths.root,stat,metadata.syntheticTest===true)});return proof;
  } catch { throw new Error('INVALID_INSTALLATION'); }
}
export function legacyInstallationMetadata(proof:LegacyDeviceRecoveryProof):Extract<InstallationMetadata,{schema:1}>{const context=legacyRecoveryProofs.get(proof);if(!context)throw new Error('INSTALLATION_RECOVERY_UNCONFIRMED');return context.metadata;}
/** Commits only the still-current inspected bytes. Full release/process/credential
 * authorization remains the installer's responsibility before it calls this. */
export function commitLegacyDeviceRecovery(proof:LegacyDeviceRecoveryProof,migratedAt:string):InstallationMetadata {
  const context=legacyRecoveryProofs.get(proof);if(!context)throw new Error('INSTALLATION_RECOVERY_UNCONFIRMED');
  const {selection,metadata,bytesSha256,ownership}=context,paths=managedPaths(selection.root),path=assertManagedPath(paths,'installation.json');
  let pending:string|undefined;
  try {
    z.iso.datetime({offset:true}).parse(migratedAt);preflightRoot(selection);verifyProtectedPath(paths.root);verifyProtectedPath(path);const current=readFileSync(path),stat=lstatSync(paths.root),observed=durableOwnership(paths.root,stat,metadata.syntheticTest===true);
    if(digest(current)!==bytesSha256||!durableMatches(observed,ownership))throw new Error('stale');
    const parsed=metadataSchema.parse(JSON.parse(current.toString('utf8')));if(parsed.schema!==1||JSON.stringify(parsed)!==JSON.stringify(metadata))throw new Error('stale');
    const next=metadataSchema.parse({...metadata,schema:2,ownership:observed,migration:{fromSchema:1,reason:'mount_identity_changed',legacyOwnershipSha256:digest(JSON.stringify(metadata.ownership)),migratedAt}});pending=path+'.migration-'+randomUUID();
    writeProtectedJSON(pending,next);if(digest(readFileSync(path))!==bytesSha256){unlinkSync(pending);throw new Error('stale');}renameSync(pending,path);if(process.platform==='darwin'){const directory=openSync(dirname(path),'r');try{fsyncSync(directory);}finally{closeSync(directory);}}legacyRecoveryProofs.delete(proof);return readInstallation(selection);
  } catch(error){if(pending&&existsSync(pending))try{unlinkSync(pending);}catch{}if(error instanceof Error&&error.message==='stale')throw new Error('INSTALLATION_RECOVERY_STALE');if(error instanceof Error&&error.message==='INSTALLATION_RECOVERY_STALE')throw error;throw new Error('INSTALLATION_RECOVERY_UNCONFIRMED');}
}

function installationPort(): { port: number; syntheticTest?: true } {
  if (process.env.AUTOED_SYNTHETIC_TEST !== '1') return { port: 43187 };
  const port = Number(process.env.AUTOED_SYNTHETIC_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535 || port === 43187) throw new Error('SYNTHETIC_PORT_INVALID');
  return { port, syntheticTest: true };
}
/** Bind-only collision check: never connects to or authenticates with an unknown service. */
export async function assertPortAvailable(port = 43187): Promise<void> {
  const selected = installationPort();
  if (port !== 43187 && (selected.syntheticTest !== true || port !== selected.port)) throw new Error('INSTALLATION_PREVIEW_REQUIRED');
  await new Promise<void>((resolve, reject) => {
    const server = createServer(); server.once('error', () => reject(new Error('PORT_CONFLICT_REPREVIEW')));
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => server.close(error => error ? reject(new Error('PORT_CONFLICT_REPREVIEW')) : resolve()));
  });
}
/** Installer must obtain approval for the exact selection first. No persistent default-root side effects. */
export async function initializeInstallation(selection: RootSelection, store: SecretStore = new NativeSecretStore(), installationId: string = randomUUID()): Promise<InstallationMetadata> {
  assertInstallationId(installationId);
  const endpoint = installationPort();
  preflightRoot(selection); await assertPortAvailable(endpoint.port);
  const paths = createManagedRoot(selection);
  const scope = { installationId, source: 'synthetic', courseId: 'selftest' } as const;
  const stat = lstatSync(paths.root);
  const ownership = process.platform==='darwin'?durableOwnership(paths.root,stat,endpoint.syntheticTest===true):{device:stat.dev,inode:stat.ino,uid:stat.uid};
  // Flushed exact namespace intent precedes any credential operation. If interrupted or
  // denied, recovery can locate only these owned entries without enumeration or guessing.
  writeProtectedJSON(assertManagedPath(paths, 'provisioning.json'), { schema: 1, installationId, state: 'initialization_intent', names: ['api', 'cli', 'mcp', 'installer'], ownership:{device:stat.dev,inode:stat.ino,uid:stat.uid} });
  const credentials = [];
  // A store failure stops immediately: do not retry, prompt, or publish a successful receipt.
  // Any partially provisioned exact UUID entries require installer recovery, not broad cleanup.
  for (const [name, destination] of [['api', 'service'], ['cli', 'local_cli'], ['mcp', 'model'], ['installer', 'installer']] as const) credentials.push(await issueCredential(store, installationId, name, scope, destination));
  const metadata = metadataSchema.parse({ schema: process.platform==='darwin'?2:1, installationId, port: endpoint.port, rootAlias: 'managed-root', ...endpoint.syntheticTest ? { syntheticTest: true } : {}, ownership, approvedScope: scope, credentials });
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
    if (metadata.syntheticTest === true && installationPort().port !== metadata.port) throw new Error('test context');
    if(metadata.schema===1){if(metadata.ownership.device!==stat.dev||metadata.ownership.inode!==stat.ino||metadata.ownership.uid!==stat.uid)throw new Error('owner');}
    else if(!durableMatches(durableOwnership(paths.root,stat,metadata.syntheticTest===true),metadata.ownership))throw new Error('owner');
    return metadata;
  } catch { throw new Error('INVALID_INSTALLATION'); }
}
