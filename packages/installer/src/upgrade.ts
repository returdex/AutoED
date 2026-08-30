import {createHash,randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync,renameSync,openSync,closeSync,fsyncSync,lstatSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {release} from 'node:os';
import type Database from 'better-sqlite3';
import type {SecretStore} from '../../application/src/ports.js';
import type {InstallProjection} from '../../domain/src/model.js';
import {sameIdentity} from '../../application/src/identity.js';
import {HttpClient} from '../../client/src/http.js';
import {discoverBoundClientEndpoint} from '../../platform/src/client-endpoint.js';
import {inspectClientHosts} from '../../platform/src/client-host.js';
import {NativeSecretStore} from '../../platform/src/credentials.js';
import {initializeInstallation,readInstallation} from '../../platform/src/installation.js';
import {OwnedProcessSupervisor,observeProcess,matchesProcess} from '../../platform/src/processes.js';
import {assertManagedPath,managedPaths,type RootSelection} from '../../platform/src/paths.js';
import {protectPath} from '../../platform/src/permissions.js';
import {openDatabase,readGate,SQLiteMaintenanceStore} from '../../persistence/src/database.js';
import {SQLiteJobStore} from '../../persistence/src/claims.js';
import {SQLiteStatusProjectionStore} from '../../persistence/src/runtime-status.js';
import {runSelfcheck} from '../../../scripts/install/selfcheck.mjs';
import {approvedManifest,type InstallPreview,type InstallConfirmation} from './preview.js';
import {isVerifiedManifest,verifyFileTree,verifyArtifactBytes,verifiedEnvelope,type VerifiedManifest} from './verify-manifest.js';
import {extractVerifiedArchive} from './download.js';
import {publishLaunchers,assertOwnedLaunchers,writeInstallerRecord,readActive,programEntryPaths} from './launchers.js';
import {UpgradeJournal,nextProjectionTime,writeJournalProjection,type JOURNAL_STAGES} from './journal.js';
import {createSnapshot,type Snapshot} from './snapshot.js';
import {z} from 'zod';

export function verifiedRuntime(selection:RootSelection,manifest:VerifiedManifest){
  if(!isVerifiedManifest(manifest))throw new Error('VERIFIED_MANIFEST_REQUIRED');const metadata=readInstallation(selection),paths=managedPaths(selection.root),m=manifest.manifest;
  const roots={program:assertManagedPath(paths,`program/${m.build.buildId}`),node:assertManagedPath(paths,`runtime/${m.dependencies.node}`),browser:assertManagedPath(paths,`browser/${m.dependencies.browserRevision}`)};
  for(const role of ['program','node','browser'] as const){const parts=m.artifacts.filter(a=>a.role===role);if(parts.length!==1)throw new Error('ARTIFACT_LAYOUT_INVALID');verifyFileTree(manifest,parts[0]!.name,roots[role]);}
  const layout=programEntryPaths(manifest);if(![layout.api,layout.worker,layout.clientHost,layout.identity].every(path=>layout.program.files.some(file=>file.path===path&&file.type!=='symlink')))throw new Error('ENTRY_MISSING');const managedNode=join(roots.node,process.platform==='darwin'?'bin/node':'bin/node.exe'),entries={api:join(roots.program,layout.api),worker:join(roots.program,layout.worker),cli:join(roots.program,layout.cli),mcp:join(roots.program,layout.mcp)};
  return {metadata,roots,managedNode,entries,manifestPath:join(roots.program,layout.identity),clientHostPath:layout.clientHost};
}
/** Only a freshly verified complete inventory can mint an installer endpoint. Never a model selector. */
export function verifiedInstallerClient(selection:RootSelection,manifest:VerifiedManifest){const runtime=verifiedRuntime(selection,manifest);return new HttpClient(selection.root,selection.parent,'installer',manifest.manifest.build,undefined,discoverBoundClientEndpoint(selection,runtime.entries.api,runtime.managedNode));}
export function runtimeSupervisor(selection:RootSelection,manifest:VerifiedManifest,context?:{operationId:string;generation:number}){const runtime=verifiedRuntime(selection,manifest);return new OwnedProcessSupervisor({selection,managedNode:runtime.managedNode,entries:runtime.entries,...(context?{workerContext:{expectedGeneration:context.generation,selfcheck:context}}:{})});}
export function preserveEnvelope(selection:RootSelection,manifest:VerifiedManifest){const parent=assertManagedPath(managedPaths(selection.root),'installer-staging/manifests');if(!existsSync(parent)){mkdirSync(parent,{mode:0o700});protectPath(parent);}const root=join(parent,manifest.manifest.build.buildId);const envelope=verifiedEnvelope(manifest);if(existsSync(root)){for(const [name,bytes]of [['manifest.json',envelope.bytes],['manifest.sig',envelope.signature]] as const)if(!readFileSync(assertManagedPath(managedPaths(selection.root),`installer-staging/manifests/${manifest.manifest.build.buildId}/${name}`)).equals(bytes))throw new Error('ARTIFACT_INTEGRITY');return;}mkdirSync(root,{mode:0o700});protectPath(root);for(const [name,bytes]of [['manifest.json',envelope.bytes],['manifest.sig',envelope.signature]] as const){const path=join(root,name),fd=openSync(path,'wx',0o600);try{protectPath(path);writeFileSync(fd,bytes);fsyncSync(fd);}finally{closeSync(fd);}}}
function hashFile(path:string){const st=lstatSync(path);if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||st.size>1024*1024)throw new Error('ENTRY_OWNERSHIP_UNCONFIRMED');return createHash('sha256').update(readFileSync(path)).digest('hex');}
function pins(root:string,bin:string,active:string){const names=readdirSync(bin).sort();if(names.join()!==['autoed-rebuild'+(process.platform==='win32'?'.cmd':''),'launcher.mjs','ownership.json'].sort().join())throw new Error('ENTRY_OWNERSHIP_UNCONFIRMED');return {active:hashFile(active),files:names.map(name=>({name,hash:hashFile(join(bin,name))})),root};}
function durableRename(from:string,to:string){if(existsSync(to))throw new Error('ENTRY_OWNERSHIP_UNCONFIRMED');renameSync(from,to);if(process.platform==='darwin')for(const path of new Set([join(from,'..'),join(to,'..')])){const fd=openSync(path,'r');try{fsyncSync(fd);}finally{closeSync(fd);}}}
const pinHash=z.string().regex(/^[a-f0-9]{64}$/),PinSide=z.strictObject({active:pinHash,files:z.array(z.strictObject({name:z.string(),hash:pinHash})).length(3),root:z.string()}),Pins=z.strictObject({schema:z.literal(1),installationId:z.uuid(),operationId:z.uuid(),old:PinSide,candidate:PinSide});
function validatePinSide(bin:string,active:string,side:z.infer<typeof PinSide>){if(!existsSync(bin)||!existsSync(active)||hashFile(active)!==side.active)throw new Error('ACTIVATION_REALITY_UNCONFIRMED');const names=readdirSync(bin).sort();if(names.join()!==side.files.map(f=>f.name).sort().join())throw new Error('ACTIVATION_REALITY_UNCONFIRMED');for(const file of side.files)if(hashFile(join(bin,file.name))!==file.hash)throw new Error('ACTIVATION_REALITY_UNCONFIRMED');}
/** Completes only one of the five exact durable rename boundaries. All hashes are checked before the first mutation. */
export function recoverCandidateActivation(selection:RootSelection,operationId:string){
  let root:string,record:z.infer<typeof Pins>;try{root=assertManagedPath(managedPaths(selection.root),`installer-staging/activation-${z.uuid().parse(operationId)}`);record=Pins.parse(JSON.parse(readFileSync(join(root,'pins.json'),'utf8')));}catch{throw new Error('ACTIVATION_REALITY_UNCONFIRMED');}if(record.operationId!==operationId||record.installationId!==readInstallation(selection).installationId)throw new Error('ACTIVATION_REALITY_UNCONFIRMED');
  const currentBin=join(selection.root,'bin'),currentActive=join(selection.root,'active.json'),oldBin=join(root,'old-bin'),oldActive=join(root,'old-active.json'),newBin=join(root,'new-bin'),newActive=join(root,'new-active.json');
  const allowed=new Set(['pins.json',...['old-bin','old-active.json','new-bin','new-active.json'].filter(name=>existsSync(join(root,name)))]);if(readdirSync(root).some(name=>!allowed.has(name)))throw new Error('ACTIVATION_REALITY_UNCONFIRMED');
  const state=[currentBin,currentActive,oldBin,oldActive,newBin,newActive].map(existsSync).map(Number).join('');const phases=new Map([['110011',0],['011011',1],['001111',2],['101101',3],['111100',4]]);const phase=phases.get(state);if(phase===undefined)throw new Error('ACTIVATION_REALITY_UNCONFIRMED');
  if(phase===0){validatePinSide(currentBin,currentActive,record.old);validatePinSide(newBin,newActive,record.candidate);}else if(phase===1){validatePinSide(oldBin,currentActive,record.old);validatePinSide(newBin,newActive,record.candidate);}else if(phase===2){validatePinSide(oldBin,oldActive,record.old);validatePinSide(newBin,newActive,record.candidate);}else if(phase===3){validatePinSide(oldBin,oldActive,record.old);validatePinSide(currentBin,newActive,record.candidate);}else{validatePinSide(oldBin,oldActive,record.old);validatePinSide(currentBin,currentActive,record.candidate);return root;}
  if(phase<1)durableRename(currentBin,oldBin);if(phase<2)durableRename(currentActive,oldActive);if(phase<3)durableRename(newBin,currentBin);if(phase<4)durableRename(newActive,currentActive);validatePinSide(oldBin,oldActive,record.old);validatePinSide(currentBin,currentActive,record.candidate);return root;
}
export function activateCandidate(preview:InstallPreview,manifest:VerifiedManifest,operationId:string){
  const selection=preview.selection,old=existsSync(join(selection.root,'active.json'))?assertOwnedLaunchers(selection):null;
  const root=assertManagedPath(managedPaths(selection.root),`installer-staging/activation-${operationId}`);mkdirSync(root,{mode:0o700});protectPath(root);publishLaunchers(preview,manifest,operationId);
  const newPins=pins(root,join(root,'new-bin'),join(root,'new-active.json')),oldPins=old?pins(selection.root,join(selection.root,'bin'),join(selection.root,'active.json')):null;
  writeInstallerRecord(join(root,'pins.json'),{schema:1,installationId:preview.installationId,operationId,old:oldPins,candidate:newPins});
  // During any torn update, the resolver's exact active hash rejects mixed pins.
  if(old){assertOwnedLaunchers(selection);durableRename(join(selection.root,'bin'),join(root,'old-bin'));durableRename(join(selection.root,'active.json'),join(root,'old-active.json'));}
  durableRename(join(root,'new-bin'),join(selection.root,'bin'));durableRename(join(root,'new-active.json'),join(selection.root,'active.json'));const active=assertOwnedLaunchers(selection);if(active.manifestHash!==manifest.manifestHash)throw new Error('ACTIVE_INTEGRITY_FAILED');return root;
}
export interface UpgradeOptions {
  archives:Record<string,Buffer>;oldManifest?:VerifiedManifest;store?:SecretStore;
  fault?:(stage:typeof JOURNAL_STAGES[number],phase:'intent'|'done')=>Promise<void>;
  cleanup?:(context:{selection:RootSelection;manifest:VerifiedManifest;oldManifest?:VerifiedManifest;journal:UpgradeJournal;snapshot:Snapshot;activationRoot:string})=>Promise<{complete:boolean;code?:string}>;
}
const stageMap:Record<typeof JOURNAL_STAGES[number],InstallProjection['stage']>={preview:'preview',confirmed:'preview',download_verified:'verify',quiesced:'quiesce',snapshot_ready:'backup',migrated:'migrate',activated:'activate',started:'selfcheck',feature_verified:'selfcheck',cleaned:'cleanup',reopened:'selfcheck',normal_verified:'selfcheck',complete:'complete'};
const pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
const HostReloadFailure=z.strictObject({operationId:z.uuid(),code:z.literal('HOST_RELOAD_REQUIRED_QUIESCED_INTENT'),generation:z.number().int().nonnegative(),writeGeneration:z.number().int().nonnegative(),projectionWritten:z.literal(true),projectionCode:z.literal('OFFLINE_EXCLUSIVE')});
function protectedJSON(path:string){const stat=lstatSync(path);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>16384)throw new Error('MAINTENANCE_RECOVERY_REQUIRED');return JSON.parse(readFileSync(path,'utf8'));}
async function recoverQuiescedHostReload(selection:RootSelection,old:VerifiedManifest,db:Database.Database){
  const paths=managedPaths(selection.root),lock=assertManagedPath(paths,'installer-staging/update.lock'),gate=readGate(db);if(!existsSync(lock)){if(gate.state!=='open')throw new Error('MAINTENANCE_RECOVERY_REQUIRED');return;}
  const admission=protectedJSON(join(lock,'admission.json')) as {operationId?:unknown;mode?:unknown},operationId=z.uuid().parse(admission.operationId),journalState=UpgradeJournal.read(selection,operationId),last=journalState.entries.at(-1),failure=HostReloadFailure.parse(protectedJSON(assertManagedPath(paths,`installer-staging/failure-${operationId}.json`)));
  if(admission.mode!=='blocked'||failure.operationId!==operationId||journalState.header.previousInstallation!=='present'||journalState.header.generation!==failure.generation||journalState.entries.length!==7||last?.stage!=='quiesced'||last.phase!=='intent'||assertOwnedLaunchers(selection).manifestHash!==old.manifestHash||existsSync(assertManagedPath(paths,`installer-staging/snapshot-${operationId}`))||existsSync(assertManagedPath(paths,`installer-staging/activation-${operationId}`)))throw new Error('MAINTENANCE_RECOVERY_REQUIRED');
  const hosts=await inspectClientHosts(selection);if(hosts.some(host=>host.state!=='exited'))throw new Error('HOST_RELOAD_REQUIRED_PRECHECK');const supervisor=runtimeSupervisor(selection,old),states=await Promise.all(supervisor.registered().map(identity=>supervisor.inspect(identity)));if(states.some(state=>state!=='exited'))throw new Error('PROCESS_OWNERSHIP_UNCONFIRMED');
  const journal=await UpgradeJournal.recover(selection,operationId),current=readGate(db),write=(db.prepare('SELECT write_generation AS value FROM maintenance_generation WHERE id=1').get() as {value:number}).value;
  if(current.state==='exclusive'&&current.operationId===operationId&&current.generation===failure.generation){if(write!==failure.writeGeneration)throw new Error('MAINTENANCE_RECOVERY_REQUIRED');await new SQLiteMaintenanceStore(db).exitMaintenance(operationId,failure.generation);}
  else if(current.state!=='open'||current.operationId!==null||current.generation!==failure.generation+1)throw new Error('MAINTENANCE_RECOVERY_REQUIRED');
  await writeJournalProjection(db,journal,{stage:'rollback',result:'restored',actualBuild:old.manifest.build,cleanup:'cleanup_pending'});await journal.resolve('HOST_RELOAD_REQUIRED_RESTORED');
}
async function stopOwned(supervisor:OwnedProcessSupervisor,identity:ReturnType<OwnedProcessSupervisor['registered']>[number]){const before=await supervisor.inspect(identity);if(before==='running')await supervisor.stop(identity);else if(before==='exited')return;else if(before!=='unknown')throw new Error(`PROCESS_IDENTITY_MISMATCH_${identity.role.toUpperCase()}`);const deadline=performance.now()+10000;while(performance.now()<deadline){let os;try{os=await observeProcess(identity.pid);}catch{await pause(100);continue;}if(!os)return;if(!matchesProcess(identity,os))throw new Error(`PROCESS_IDENTITY_MISMATCH_${identity.role.toUpperCase()}`);await pause(100);}throw new Error('PROCESS_STOP_UNCONFIRMED');}
async function awaitGenerationExit(identity:ReturnType<OwnedProcessSupervisor['registered']>[number]){const deadline=performance.now()+10000;while(performance.now()<deadline){let os;try{os=await observeProcess(identity.pid);}catch{await pause(100);continue;}if(!os)return;if(!matchesProcess(identity,os))throw new Error(`PROCESS_IDENTITY_MISMATCH_${identity.role.toUpperCase()}`);await pause(100);}throw new Error('PROCESS_STOP_UNCONFIRMED');}
export async function upgradeConfirmed(preview:InstallPreview,confirmation:InstallConfirmation,options:UpgradeOptions){
  const manifest=approvedManifest(preview,confirmation),selection=preview.selection,initial=preview.previousInstallation==='none';
  if(initial)await initializeInstallation(selection,options.store??new NativeSecretStore(),preview.installationId);
  const metadata=readInstallation(selection);if(metadata.installationId!==preview.installationId)throw new Error('INSTALLATION_MISMATCH');
  const old=options.oldManifest;if(!initial&&(!old||!isVerifiedManifest(old)||assertOwnedLaunchers(selection).manifestHash!==old.manifestHash))throw new Error('OLD_ARTIFACT_UNVERIFIED');
  if(old)verifiedRuntime(selection,old);
  if(old&&(await inspectClientHosts(selection)).some(host=>host.state!=='exited'))throw new Error('HOST_RELOAD_REQUIRED_PRECHECK');
  const db=openDatabase(assertManagedPath(managedPaths(selection.root),'data/jobs.sqlite'));protectPath(db.name);let journal:UpgradeJournal|undefined;
  let supervisor=old?runtimeSupervisor(selection,old):undefined,client:HttpClient|undefined,snapshot:Snapshot|undefined,activationRoot='',actual:VerifiedManifest|undefined=old,cleanup:'pending'|'complete'|'cleanup_pending'='pending';
  try{
    if(old)await recoverQuiescedHostReload(selection,old,db);const gate=readGate(db);if(gate.state!=='open')throw new Error('MAINTENANCE_RECOVERY_REQUIRED');const operationId=randomUUID();journal=await UpgradeJournal.create(selection,{operationId,scopeHash:preview.scopeHash,manifestHash:manifest.manifestHash,target:preview.target,platform:{os:process.platform as 'darwin'|'win32',arch:process.arch as 'arm64'|'x64',version:release()},previousInstallation:preview.previousInstallation,generation:gate.generation});
    if(supervisor?.hasPendingLaunch())throw new Error('PROCESS_START_IN_PROGRESS');
    if(old&&supervisor?.registered().some(i=>i.role==='api')){const identity=supervisor.registered().find(i=>i.role==='api')!;const status=await supervisor.inspect(identity);if(status==='running')client=verifiedInstallerClient(selection,old);else if(status!=='exited')throw new Error('PROCESS_OWNERSHIP_UNCONFIRMED');}
    const j=journal;
    async function project(stage:InstallProjection['stage'],result:InstallProjection['result']='running'){
      const value={operationId,stage,result,targetBuild:preview.target,actualBuild:actual?.manifest.build??null,cleanup,previousInstallation:preview.previousInstallation,checkedAt:await nextProjectionTime(db,'install')};
      if(client){const g=readGate(db);await client.call('/api/control/status-projection',{kind:'install',operationId:g.operationId,expectedGeneration:g.generation,value});}
      else await writeJournalProjection(db,j,value);
    }
    async function step(stage:typeof JOURNAL_STAGES[number],run:()=>Promise<void>){await j.append(stage,'intent');if(stage!=='complete')await project(stageMap[stage]);await options.fault?.(stage,'intent');await run();await j.append(stage,'done');await project(stageMap[stage],stage==='complete'?'succeeded':'running');await options.fault?.(stage,'done');}
    await step('preview',async()=>{});await step('confirmed',async()=>{});
    await step('download_verified',async()=>{
      const parts=manifest.manifest.artifacts.filter(a=>a.role!=='installer');if(parts.length!==3||['program','node','browser'].some(role=>parts.filter(a=>a.role===role).length!==1))throw new Error('ARTIFACT_LAYOUT_INVALID');
      for(const a of parts){const bytes=options.archives[a.name];if(!bytes)throw new Error('ARTIFACT_MISSING');verifyArtifactBytes(manifest,a.name,bytes);const root=a.role==='program'?preview.paths.program:a.role==='node'?preview.paths.runtime:preview.paths.browser;if(existsSync(root))verifyFileTree(manifest,a.name,root);else{mkdirSync(root,{mode:0o700});protectPath(root);await extractVerifiedArchive(manifest,a.name,bytes,root);}}
      preserveEnvelope(selection,manifest);if(old)preserveEnvelope(selection,old);verifiedRuntime(selection,manifest);
    });
    await step('quiesced',async()=>{
      if(client)await client.call('/api/control/maintenance',{action:'enter',operationId,expectedGeneration:gate.generation,leaseUntil:Date.now()+300000});else await new SQLiteMaintenanceStore(db).enterMaintenance({operationId,expectedGeneration:gate.generation,owner:'installer',leaseUntil:Date.now()+300000});
      const end=Date.now()+35000;while(db.prepare("SELECT 1 FROM jobs WHERE state='running' LIMIT 1").get()){await new SQLiteJobStore(db).recoverExpired(Date.now(),{expectedGeneration:gate.generation});if(Date.now()>end)throw new Error('JOBS_NOT_DRAINED');await pause(250);}
      if(supervisor)for(const identity of supervisor.registered().reverse()){const state=await supervisor.inspect(identity);if(state==='running')await supervisor.stop(identity);else if(state!=='exited')throw new Error('PROCESS_OWNERSHIP_UNCONFIRMED');}
      client=undefined;await new SQLiteMaintenanceStore(db).markExclusive(operationId,gate.generation);
      const hosts=await inspectClientHosts(selection);if(hosts.some(h=>h.state!=='exited'))throw new Error('HOST_RELOAD_REQUIRED');
      if(old&&!old.manifest.artifacts.find(a=>a.role==='program')!.files.some(f=>f.path===programEntryPaths(old).clientHost))throw new Error('HOST_INVENTORY_UNCONFIRMED');
    });
    await step('snapshot_ready',async()=>{snapshot=await createSnapshot(selection,db,{operationId,generation:gate.generation});});
    await step('migrated',async()=>{if(db.pragma('user_version',{simple:true})!==1||db.pragma('integrity_check',{simple:true})!=='ok')throw new Error('SCHEMA_INCOMPATIBLE');});
    await step('activated',async()=>{activationRoot=activateCandidate(preview,manifest,operationId);actual=manifest;});
    await step('started',async()=>{await j.clientAdmission('selfcheck');supervisor=runtimeSupervisor(selection,manifest,{operationId,generation:gate.generation});await supervisor.start({installationId:metadata.installationId,role:'api',build:preview.target});await supervisor.start({installationId:metadata.installationId,role:'worker',build:preview.target});client=verifiedInstallerClient(selection,manifest);});
    async function selfcheck(contextOperation:string|null,generation:number){const runtime=verifiedRuntime(selection,manifest);const observation=manifest.evidence==='verified_release_manifest'?{build:preview.target,manifestHash:manifest.manifestHash,evidence:'verified_release_manifest',checkedAt:new Date().toISOString()}:undefined;const result=await runSelfcheck({selection,managedNode:runtime.managedNode,cliEntry:runtime.entries.cli,mcpEntry:runtime.entries.mcp,manifestPath:runtime.manifestPath,operationId:contextOperation,generation,installerClient:client,...(observation?{releaseObservation:observation}:{})});if(!result?.matched||result.featureResult!=='pass'||result.recoveryNeeded)throw new Error('FEATURE_SELFCHECK_FAILED');}
    await step('feature_verified',()=>selfcheck(operationId,gate.generation));
    await step('cleaned',async()=>{const result=await options.cleanup?.({selection,manifest,...(old?{oldManifest:old}:{}),journal:j,snapshot:snapshot!,activationRoot});if(!result?.complete){cleanup='cleanup_pending';throw new Error(result?.code??'CLEANUP_PENDING');}cleanup='complete';});
    await step('reopened',async()=>{await client!.call('/api/control/maintenance',{action:'exit',operationId,expectedGeneration:gate.generation});for(const identity of supervisor!.registered().reverse())await awaitGenerationExit(identity);client=undefined;await j.clientAdmission('normal_probe');supervisor=runtimeSupervisor(selection,manifest);await supervisor.start({installationId:metadata.installationId,role:'api',build:preview.target});await supervisor.start({installationId:metadata.installationId,role:'worker',build:preview.target});client=verifiedInstallerClient(selection,manifest);});
    await step('normal_verified',()=>selfcheck(null,gate.generation+1));await step('complete',async()=>{const status=await client!.status();if(!sameIdentity(status.api?.build,preview.target)||!sameIdentity(status.worker?.build,preview.target)||status.selfcheck?.featureResult!=='pass')throw new Error('FEATURE_SELFCHECK_FAILED');});await j.release();return {state:'complete' as const,operationId,generation:gate.generation+1,build:preview.target,cleanup};
  }catch(error){
    const base=error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'UPGRADE_FAILED',last=journal?UpgradeJournal.read(selection,journal.header.operationId).entries.at(-1):undefined,code=last?`${base}_${last.stage.toUpperCase()}_${last.phase.toUpperCase()}`:base;
    if(journal){const value={stage:'stopped' as const,result:(code.startsWith('HOST_')||code.includes('OWNERSHIP')?'human_needed':'failed') as 'human_needed'|'failed',actualBuild:actual?.manifest.build??null,cleanup};let projectionWritten=false,projectionCode='PROJECTION_UNAVAILABLE';if(client){try{const g=readGate(db),full={...value,operationId:journal.header.operationId,targetBuild:journal.header.target,previousInstallation:journal.header.previousInstallation,checkedAt:await nextProjectionTime(db,'install')};await client.call('/api/control/status-projection',{kind:'install',operationId:g.operationId,expectedGeneration:g.generation,value:full});projectionWritten=true;projectionCode='AUTHENTICATED_ROUTE';}catch{projectionCode='AUTHENTICATED_ROUTE_FAILED';}}
      if(!projectionWritten){try{const gate=readGate(db),states=supervisor?await Promise.all(supervisor.registered().map(i=>supervisor!.inspect(i))):[];if(gate.state!=='exclusive'||states.some(s=>s!=='exited'))throw new Error('OFFLINE_PROJECTION_UNCONFIRMED');await writeJournalProjection(db,journal,value);projectionWritten=true;projectionCode='OFFLINE_EXCLUSIVE';}catch{if(projectionCode!=='AUTHENTICATED_ROUTE_FAILED')projectionCode='OFFLINE_PROJECTION_FAILED';}}
      const path=assertManagedPath(managedPaths(selection.root),`installer-staging/failure-${journal.header.operationId}.json`);if(!existsSync(path))writeInstallerRecord(path,{operationId:journal.header.operationId,code,generation:readGate(db).generation,writeGeneration:(db.prepare('SELECT write_generation AS value FROM maintenance_generation WHERE id=1').get() as {value:number}).value,projectionWritten,projectionCode});}
    throw new Error(code);
  }finally{db.close();}
}
