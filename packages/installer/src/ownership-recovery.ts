import {createHash,timingSafeEqual} from 'node:crypto';
import {existsSync,lstatSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {SecretStore} from '../../application/src/ports.js';
import {inspectClientHostsForRecovery} from '../../platform/src/client-host.js';
import {commitLegacyDeviceRecovery,inspectLegacyDeviceRecovery,legacyInstallationMetadata,type InstallationMetadata,type LegacyDeviceRecoveryProof} from '../../platform/src/installation.js';
import {assertManagedPath,managedPaths,type RootSelection} from '../../platform/src/paths.js';
import {detectPlatform} from '../../platform/src/platform.js';
import {ProcessRecordSchema,observeProcess} from '../../platform/src/processes.js';
import {inspectOwnedLaunchersForRecovery} from './launchers.js';
import {verifyFileTree,type VerificationTarget,type VerifiedManifest} from './verify-manifest.js';

const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const checks=['permissions','identity','launchers','release-signature','file-closures','processes','clients','installer-credential'] as const;
export interface InstallationIdentityRecoveryPreview {
  readonly schema:1;readonly reason:'MOUNT_IDENTITY_CHANGED';readonly rootAlias:'managed-root';readonly currentVersion:string;readonly retainData:true;readonly processes:'exited';readonly checks:typeof checks;readonly scopeHash:string;
}
type Verify=(bytes:Buffer,signature:Buffer,target:VerificationTarget)=>VerifiedManifest;
const previews=new WeakMap<object,{proof:LegacyDeviceRecoveryProof}>();
function protectedBytes(paths:ReturnType<typeof managedPaths>,relative:string,maximum:number){
  const path=assertManagedPath(paths,relative),stat=lstatSync(path);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size<1||stat.size>maximum)throw new Error('INSTALLATION_RECOVERY_UNCONFIRMED');return readFileSync(path);
}
function equalHash(left:string,right:string){return timingSafeEqual(Buffer.from(left,'hex'),Buffer.from(right,'hex'));}
/** Read-only, fail-closed authorization for the single supported legacy receipt
 * migration. It never edits the installation and returns only a sanitized scope. */
export async function prepareInstallationIdentityRecovery(selection:RootSelection,verify:Verify,store:SecretStore):Promise<InstallationIdentityRecoveryPreview>{
  let proof:LegacyDeviceRecoveryProof;
  try{proof=inspectLegacyDeviceRecovery(selection);}catch(error){if(error instanceof Error&&error.message==='INVALID_INSTALLATION')throw error;throw new Error('INVALID_INSTALLATION');}
  try{
    const metadata=legacyInstallationMetadata(proof),paths=managedPaths(selection.root);
    for(const relative of ['installer-staging/update.lock','runtime/client-admission.lock','runtime/api.launch','runtime/worker.launch'])if(existsSync(assertManagedPath(paths,relative)))throw new Error();
    const active=inspectOwnedLaunchersForRecovery(selection,metadata.installationId),platform=detectPlatform(),base=`installer-staging/manifests/${active.build.buildId}`;
    const manifest=verify(protectedBytes(paths,base+'/manifest.json',8*1024*1024),protectedBytes(paths,base+'/manifest.sig',64),{os:platform.platform as 'darwin'|'win32',arch:platform.arch as 'arm64'|'x64',version:platform.version,schema:1,protocol:1});
    if(manifest.manifestHash!==active.manifestHash||JSON.stringify(manifest.manifest.build)!==JSON.stringify(active.build))throw new Error();
    const roots={program:join(paths.program,active.build.buildId),node:join(paths.runtime,active.nodeVersion),browser:join(paths.browser,active.browserRevision)} as const;
    for(const role of ['program','node','browser'] as const){const artifacts=manifest.manifest.artifacts.filter(item=>item.role===role);if(artifacts.length!==1)throw new Error();verifyFileTree(manifest,artifacts[0]!.name,roots[role]);}
    const processDigests:Record<string,string|null>={};
    for(const role of ['api','worker'] as const){const relative=`runtime/${role}.json`,path=assertManagedPath(paths,relative);if(!existsSync(path)){processDigests[role]=null;continue;}const bytes=protectedBytes(paths,relative,16384),record=ProcessRecordSchema.parse(JSON.parse(bytes.toString('utf8')));if(record.installationId!==metadata.installationId||record.role!==role||record.buildId!==active.build.buildId||await observeProcess(record.pid)!==null)throw new Error();processDigests[role]=sha(bytes);}
    const clientCount=await inspectClientHostsForRecovery(selection,metadata.installationId),credential=metadata.credentials.find(item=>item.name==='installer');if(!credential)throw new Error();
    const token=await store.get(metadata.installationId,'installer');if(token===null||!equalHash(sha(token),credential.digest))throw new Error();
    const scopeHash=sha(JSON.stringify({contract:'legacy-device-recovery-v1',installationId:metadata.installationId,activeHash:sha(JSON.stringify(active)),manifestHash:manifest.manifestHash,processDigests,clientCount,credentialDigest:credential.digest}));
    const preview=Object.freeze({schema:1 as const,reason:'MOUNT_IDENTITY_CHANGED' as const,rootAlias:'managed-root' as const,currentVersion:active.build.version,retainData:true as const,processes:'exited' as const,checks,scopeHash});previews.set(preview,{proof});return preview;
  }catch{throw new Error('INSTALLATION_RECOVERY_UNCONFIRMED');}
}
/** The exact preview object and exact one-time scope confirmation are required. */
export async function confirmInstallationIdentityRecovery(preview:InstallationIdentityRecoveryPreview,answer:string):Promise<InstallationMetadata>{
  const context=previews.get(preview);if(!context||answer!==`RECOVER ${preview.scopeHash}`)throw new Error('RECOVERY_CONFIRMATION_REQUIRED');previews.delete(preview);return commitLegacyDeviceRecovery(context.proof,new Date().toISOString());
}
