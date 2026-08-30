import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readFileSync,readdirSync,unlinkSync,rmdirSync} from 'node:fs';
import {join} from 'node:path';
import {z} from 'zod';
import type {RootSelection} from '../../platform/src/paths.js';
import {inspectClientHosts} from '../../platform/src/client-host.js';
import {assertOwnedLaunchers} from './launchers.js';
import {isVerifiedManifest,type VerifiedManifest} from './verify-manifest.js';
import {readInstallation} from '../../platform/src/installation.js';
import {writeInstallerRecord} from './launchers.js';

export interface CleanupContext {selection:RootSelection;operationId:string;currentManifest:VerifiedManifest;oldManifest:VerifiedManifest}
function regular(path:string,max=65536){const s=lstatSync(path);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>max)throw new Error('OWNERSHIP_UNCONFIRMED');return readFileSync(path);}
const hash=z.string().regex(/^[a-f0-9]{64}$/),Pins=z.strictObject({schema:z.literal(1),installationId:z.uuid(),operationId:z.uuid(),old:z.strictObject({active:hash,files:z.array(z.strictObject({name:z.string(),hash})).length(3),root:z.string()}),candidate:z.strictObject({active:hash,files:z.array(z.strictObject({name:z.string(),hash})).length(3),root:z.string()})});
const Revoked=z.strictObject({installationId:z.uuid(),operationId:z.uuid(),generation:z.number().int().nonnegative(),state:z.literal('revoked'),record:z.null()});
const sha=(path:string)=>createHash('sha256').update(regular(path)).digest('hex');
const pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
async function observedHosts(selection:RootSelection,deadline:number,pollMs:number){for(;;){try{return await inspectClientHosts(selection);}catch(error){if(!(error instanceof Error)||error.message!=='PROCESS_OBSERVATION_UNAVAILABLE'||performance.now()>=deadline)throw new Error('HOST_OWNERSHIP_UNCONFIRMED');await pause(pollMs);}}}
export async function cleanupRuntimeInventory(selection:RootSelection,wait:{timeoutMs?:number;pollMs?:number}={}){const metadata=readInstallation(selection),runtimeRoot=join(selection.root,'runtime'),runtimeNames=readdirSync(runtimeRoot),receipts=runtimeNames.filter(name=>/^selfcheck-[0-9a-f-]{36}\.json$/.test(name));if(runtimeNames.some(name=>!['24.20.0','api.json','worker.json','clients'].includes(name)&&!receipts.includes(name)))throw new Error('RUNTIME_OWNERSHIP_UNCONFIRMED');for(const name of receipts){const receipt=Revoked.parse(JSON.parse(regular(join(runtimeRoot,name),8192).toString()));if(name!==`selfcheck-${receipt.operationId}.json`||receipt.installationId!==metadata.installationId)throw new Error('RUNTIME_OWNERSHIP_UNCONFIRMED');}const timeoutMs=wait.timeoutMs??10000,pollMs=wait.pollMs??100,deadline=performance.now()+timeoutMs;let hosts=await observedHosts(selection,deadline,pollMs);if(hosts.some(host=>host.state==='unknown'))throw new Error('HOST_OWNERSHIP_UNCONFIRMED');while(hosts.some(host=>host.state==='running')&&performance.now()<deadline){await pause(pollMs);hosts=await observedHosts(selection,deadline,pollMs);if(hosts.some(host=>host.state==='unknown'))throw new Error('HOST_OWNERSHIP_UNCONFIRMED');}if(hosts.some(host=>host.state!=='exited'))throw new Error('HOST_OWNERSHIP_UNCONFIRMED');for(const host of hosts){if((await observedHosts(selection,deadline,pollMs)).find(h=>h.path===host.path)?.state!=='exited')throw new Error('HOST_OWNERSHIP_UNCONFIRMED');unlinkSync(host.path);}if(existsSync(join(runtimeRoot,'clients'))&&readdirSync(join(runtimeRoot,'clients')).length===0)rmdirSync(join(runtimeRoot,'clients'));for(const name of receipts)unlinkSync(join(runtimeRoot,name));}

/** Audits the bounded installation-owned entry inventory. It never scans or removes data, Profile, archives, or unrelated paths. */
export async function cleanupManaged(context:CleanupContext){
  try{
    z.uuid().parse(context.operationId);if(!isVerifiedManifest(context.currentManifest)||!isVerifiedManifest(context.oldManifest))throw new Error('VERIFIED_MANIFEST_REQUIRED');
    const active=assertOwnedLaunchers(context.selection);if(active.build.buildId!==context.currentManifest.manifest.build.buildId)throw new Error('ACTIVE_MISMATCH');
    const activation=join(context.selection.root,'installer-staging','activation-'+context.operationId);if((lstatSync(activation).mode&0o777)!==0o700)throw new Error('ACCESS_DENIED');const allowed=new Set(['pins.json','old-bin','old-active.json','inactive.json']);
    for(const name of readdirSync(activation))if(!allowed.has(name))throw new Error('UNKNOWN_ACTIVATION_ENTRY');
    const pins=Pins.parse(JSON.parse(regular(join(activation,'pins.json')).toString()));if(pins.operationId!==context.operationId||pins.installationId!==active.installationId)throw new Error('MIXED_PINS');
    if(sha(join(context.selection.root,'active.json'))!==pins.candidate.active)throw new Error('MIXED_PINS');for(const file of pins.candidate.files)if(sha(join(context.selection.root,'bin',file.name))!==file.hash)throw new Error('MIXED_PINS');
    if(sha(join(activation,'old-active.json'))!==pins.old.active)throw new Error('MIXED_PINS');for(const file of pins.old.files)if(sha(join(activation,'old-bin',file.name))!==file.hash)throw new Error('MIXED_PINS');
    if(existsSync(join(context.selection.root,'runtime','startup-ref.json')))throw new Error('STARTUP_REFERENCE_UNKNOWN');
    await cleanupRuntimeInventory(context.selection);const inactive=join(activation,'inactive.json');if(!existsSync(inactive))writeInstallerRecord(inactive,{schema:1,installationId:active.installationId,operationId:context.operationId,build:context.oldManifest.manifest.build,manifestHash:context.oldManifest.manifestHash,state:'inactive_rollback_artifact'});for(const file of pins.old.files)unlinkSync(join(activation,'old-bin',file.name));rmdirSync(join(activation,'old-bin'));unlinkSync(join(activation,'old-active.json'));
    return {complete:true as const,code:'CLEANUP_COMPLETE' as const};
  }catch{return {complete:false as const,code:'CLEANUP_PENDING' as const};}
}
