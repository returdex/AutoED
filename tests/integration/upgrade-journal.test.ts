import {expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {existsSync,readFileSync,realpathSync,writeFileSync,readdirSync,symlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHarness} from '../../packages/test-support/src/harness.js';
import {initializeInstallation,readInstallation} from '../../packages/platform/src/installation.js';
import {protectPath} from '../../packages/platform/src/permissions.js';
import {openDatabase,SQLiteMaintenanceStore} from '../../packages/persistence/src/database.js';
import {JobRepository} from '../../packages/persistence/src/jobs.js';
import {SQLiteStatusProjectionStore} from '../../packages/persistence/src/runtime-status.js';
import {UpgradeJournal,JOURNAL_STAGES,writeJournalProjection} from '../../packages/installer/src/journal.js';
import {createSnapshot,verifySnapshot} from '../../packages/installer/src/snapshot.js';
import {signSyntheticManifests} from '../../scripts/build/synthetic-sign.mjs';
import {createFixtureVerifier} from '../../packages/installer/src/verify-manifest.js';
import {createInstallPreview,confirmInstallPreview} from '../../packages/installer/src/preview.js';
import {upgradeConfirmed,runtimeSupervisor,recoverCandidateActivation} from '../../packages/installer/src/upgrade.js';
import {NativeSecretStore} from '../../packages/platform/src/credentials.js';
import {inspectClientHosts} from '../../packages/platform/src/client-host.js';
import {compiledRelease} from '../../packages/test-support/src/upgrade-fixture.js';
import {once} from 'node:events';
import {release as osRelease} from 'node:os';
import {createHash} from 'node:crypto';
import {mkdirSync,renameSync} from 'node:fs';

const nativePlatform={os:process.platform as 'darwin'|'win32',arch:process.arch as 'arm64'|'x64',version:osRelease()};
const build={version:'0.1.0-beta.2',buildId:'b'.repeat(64),commit:'c'.repeat(40),tree:'d'.repeat(40),dependencyHash:'e'.repeat(64),protocol:1 as const,schemaMin:1 as const,schemaMax:1 as const,capabilities:['echo','digest']};
async function fixture(){const h=createHarness(),parent=realpathSync(h.root);protectPath(parent);const selection={root:join(parent,'installation'),parent,excludedRoots:[]},values=new Map<string,string>();const metadata=await initializeInstallation(selection,{get:async(id,name)=>values.get(id+name)??null,set:async(id,name,value)=>{values.set(id+name,value);},delete:async(id,name)=>{values.delete(id+name);}});const db=openDatabase(join(selection.root,'data/jobs.sqlite'));protectPath(db.name);return {h,selection,metadata,db};}
it('journals every durable intent/done, rejects concurrent writers and replays only persisted boundaries',async()=>{
  const f=await fixture();try{
    const input={operationId:randomUUID(),scopeHash:'a'.repeat(64),manifestHash:'f'.repeat(64),target:build,platform:nativePlatform,previousInstallation:'none' as const,generation:0};
    const url=new URL('../../packages/installer/src/journal.ts',import.meta.url).href;
    for(const [sequence,{stage,phase}]of JOURNAL_STAGES.flatMap(stage=>[{stage,phase:'intent' as const},{stage,phase:'done' as const}]).entries()){
      const script=`import{registerHooks}from'node:module';registerHooks({resolve(s,c,n){try{return n(s,c)}catch(e){if(s.endsWith('.js'))return n(s.slice(0,-3)+'.ts',c);throw e}}});const {UpgradeJournal}=await import(${JSON.stringify(url)});const selection=${JSON.stringify(f.selection)},input=${JSON.stringify(input)};const journal=${sequence===0?'await UpgradeJournal.create(selection,input)':'await UpgradeJournal.recover(selection,input.operationId)'};await journal.append(${JSON.stringify(stage)},${JSON.stringify(phase)});process.exit(73);`;
      const child=f.h.spawn(['--experimental-transform-types','--input-type=module','-e',script]);expect((await once(child,'exit'))[0]).toBe(73);expect(UpgradeJournal.read(f.selection,input.operationId).entries.at(-1)).toMatchObject({stage,phase});
    }
    await expect(UpgradeJournal.create(f.selection,{...input,operationId:randomUUID()})).rejects.toThrow('UPGRADE_LOCKED');const journal=await UpgradeJournal.recover(f.selection,input.operationId);expect(UpgradeJournal.read(f.selection,input.operationId).entries).toHaveLength(JOURNAL_STAGES.length*2);await journal.release();
  }finally{f.db.close();await f.h.cleanup();}
});
it('reopens a strictly resolved journal and rejects a second resolution',async()=>{
  const f=await fixture();try{const operationId=randomUUID(),journal=await UpgradeJournal.create(f.selection,{operationId,scopeHash:'a'.repeat(64),manifestHash:'f'.repeat(64),target:build,platform:nativePlatform,previousInstallation:'none',generation:0});await journal.resolve('INSTALL_FAILED_NO_PREVIOUS');expect(UpgradeJournal.read(f.selection,operationId).recovery).toMatchObject({operationId,code:'INSTALL_FAILED_NO_PREVIOUS'});await expect(journal.resolve('INSTALL_FAILED_NO_PREVIOUS')).rejects.toThrow();writeFileSync(join(f.selection.root,'installer-staging/operations',operationId,'unknown.json'),'{}');expect(()=>UpgradeJournal.read(f.selection,operationId)).toThrow('JOURNAL_INVALID');}finally{f.db.close();await f.h.cleanup();}
});
it('completes every exact activation rename boundary and rejects mixed or unknown reality without mutation',async()=>{
  const digest=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
  for(let phase=0;phase<5;phase++){const f=await fixture();try{const operationId=randomUUID(),root=join(f.selection.root,'installer-staging','activation-'+operationId),bin=join(f.selection.root,'bin'),active=join(f.selection.root,'active.json');mkdirSync(root,{mode:0o700});mkdirSync(bin,{mode:0o700});for(const name of ['launcher.mjs','autoed-rebuild','ownership.json'])writeFileSync(join(bin,name),'old-'+name);writeFileSync(active,'old-active');mkdirSync(join(root,'new-bin'));for(const name of ['launcher.mjs','autoed-rebuild','ownership.json'])writeFileSync(join(root,'new-bin',name),'new-'+name);writeFileSync(join(root,'new-active.json'),'new-active');const side=(b:string,a:string)=>({root:b,active:digest(a),files:readdirSync(b).sort().map(name=>({name,hash:digest(join(b,name))}))});writeFileSync(join(root,'pins.json'),JSON.stringify({schema:1,installationId:f.metadata.installationId,operationId,old:side(bin,active),candidate:side(join(root,'new-bin'),join(root,'new-active.json'))}));if(phase>=1)renameSync(bin,join(root,'old-bin'));if(phase>=2)renameSync(active,join(root,'old-active.json'));if(phase>=3)renameSync(join(root,'new-bin'),bin);if(phase>=4)renameSync(join(root,'new-active.json'),active);recoverCandidateActivation(f.selection,operationId);expect(readFileSync(active,'utf8')).toBe('new-active');expect(readFileSync(join(root,'old-active.json'),'utf8')).toBe('old-active');}finally{f.db.close();await f.h.cleanup();}}
  const f=await fixture();try{const operationId=randomUUID(),root=join(f.selection.root,'installer-staging','activation-'+operationId);mkdirSync(root,{mode:0o700});writeFileSync(join(root,'pins.json'),'{}');writeFileSync(join(root,'unknown'),'canary');const before=readFileSync(join(root,'unknown'));expect(()=>recoverCandidateActivation(f.selection,operationId)).toThrow('ACTIVATION_REALITY_UNCONFIRMED');expect(readFileSync(join(root,'unknown'))).toEqual(before);}finally{f.db.close();await f.h.cleanup();}
});
it('uses a completed SQLite backup with gate/write fencing and never copies unrelated private directories',async()=>{
  const f=await fixture();try{
    const job=await new JobRepository(f.db).enqueue({kind:'echo',value:'retained',idempotencyKey:randomUUID(),scope:f.metadata.approvedScope},{expectedGeneration:0});
    const operationId=randomUUID(),gate=new SQLiteMaintenanceStore(f.db);await gate.enterMaintenance({operationId,expectedGeneration:0,owner:'installer',leaseUntil:Date.now()+60000});await gate.markExclusive(operationId,0);
    // Synthetic canary only: the snapshot must never inspect/copy this directory.
    writeFileSync(join(f.selection.root,'profile-private/canary'),'synthetic-private',{mode:0o000});
    const snapshot=await createSnapshot(f.selection,f.db,{operationId,generation:0});expect(verifySnapshot(f.selection,snapshot)).toMatchObject({writeGeneration:1,schema:1,objects:[]});
    const copy=openDatabase(snapshot.databasePath);try{expect(await new JobRepository(copy).query(job.id,f.metadata.approvedScope)).toMatchObject({id:job.id,request:{value:'retained'}});}finally{copy.close();}
    expect(existsSync(join(snapshot.root,'profile-private'))).toBe(false);expect(existsSync(join(snapshot.root,'secrets'))).toBe(false);
    await expect(createSnapshot(f.selection,f.db,{operationId,generation:1})).rejects.toThrow('GENERATION_MISMATCH');
    const bytes=readFileSync(snapshot.databasePath);bytes[100]=bytes[100]!^1;writeFileSync(snapshot.databasePath,bytes);expect(()=>verifySnapshot(f.selection,snapshot)).toThrow('SNAPSHOT_INVALID');
  }finally{f.db.close();await f.h.cleanup();}
});
it('persists truthful install projection through maintenance exit with actual monotonic timestamps',async()=>{
  const f=await fixture();try{
    const operationId=randomUUID(),gate=new SQLiteMaintenanceStore(f.db);await gate.enterMaintenance({operationId,expectedGeneration:0,owner:'installer',leaseUntil:Date.now()+60000});await gate.markExclusive(operationId,0);
    const journal=await UpgradeJournal.create(f.selection,{operationId,scopeHash:'a'.repeat(64),manifestHash:'f'.repeat(64),target:build,platform:nativePlatform,previousInstallation:'present',generation:0});
    await journal.append('preview','intent');await writeJournalProjection(f.db,journal,{stage:'stopped',result:'human_needed',actualBuild:null,cleanup:'cleanup_pending'});
    const first=(await new SQLiteStatusProjectionStore(f.db).read()).install!;await writeJournalProjection(f.db,journal,{stage:'stopped',result:'failed',actualBuild:null,cleanup:'cleanup_pending'});
    const second=(await new SQLiteStatusProjectionStore(f.db).read()).install!;expect(Date.parse(second.checkedAt!)).toBeGreaterThan(Date.parse(first.checkedAt!));expect(Date.parse(second.checkedAt!)).toBeLessThanOrEqual(Date.now());
    await gate.exitMaintenance(operationId,0);await expect(writeJournalProjection(f.db,journal,{stage:'complete',result:'succeeded',actualBuild:build,cleanup:'complete'})).rejects.toThrow('COMPLETION_EVIDENCE_REQUIRED');
  }finally{f.db.close();await f.h.cleanup();}
});

it('starts independently installed target entries, runs operation and fresh-generation selfchecks, then exposes real status',async()=>{
  const h=createHarness(),secrets=new NativeSecretStore();let selection:{root:string;parent:string;excludedRoots:never[]}|undefined,installationId:string|undefined,manifest:ReturnType<ReturnType<typeof createFixtureVerifier>>|undefined,safe=false;
  try{const parent=realpathSync(h.root);protectPath(parent);symlinkSync(realpathSync('node_modules'),join(parent,'node_modules'),'dir');const release=await compiledRelease(parent,'B'),signed=await signSyntheticManifests(parent,[release.bytes]);manifest=createFixtureVerifier(signed.publicKey,signed.fingerprint)(release.bytes,Buffer.from(signed.signatures[0]!,'base64'),{os:'darwin',arch:'arm64',version:'26.5.2',schema:1,protocol:1});selection={root:join(parent,'installation'),parent,excludedRoots:[]};const preview=createInstallPreview(manifest,selection),confirmation=confirmInstallPreview(preview,'INSTALL '+preview.scopeHash);installationId=preview.installationId;
    const result=await upgradeConfirmed(preview,confirmation,{archives:release.archives,store:secrets,cleanup:async({selection})=>({complete:(await inspectClientHosts(selection)).every(host=>host.state==='exited')})});expect(result).toMatchObject({state:'complete',generation:1,cleanup:'complete'});expect(preview.paths.program.startsWith(join(selection.root,'program'))).toBe(true);expect(realpathSync(resolve('packages/installer/src/upgrade.ts')).startsWith(preview.paths.program)).toBe(false);
    const origin=`http://127.0.0.1:${readInstallation(selection).port}`;const response=await h.fetch(origin+'/api/status',{headers:{authorization:`Bearer ${await secrets.get(installationId,'installer')}`}});expect(response.status).toBe(200);const status=await response.json() as any;expect(status).toMatchObject({installationId,api:{build:{buildId:release.build.buildId}},worker:{build:{buildId:release.build.buildId}},install:{result:'succeeded',cleanup:'complete'},selfcheck:{featureResult:'pass'}});
    const attempted={kind:'install',operationId:null,expectedGeneration:1,value:{...status.install,stage:'stopped',result:'failed',cleanup:'cleanup_pending',checkedAt:new Date().toISOString()}};expect((await h.fetch(origin+'/api/control/status-projection',{method:'POST',headers:{authorization:`Bearer ${await secrets.get(installationId,'cli')}`,'content-type':'application/json'},body:JSON.stringify(attempted)})).status).toBe(403);expect((await h.fetch(origin+'/api/control/status-projection',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(attempted)})).status).toBe(401);
    const supervisor=runtimeSupervisor(selection,manifest);for(const identity of supervisor.registered().reverse())await supervisor.stop(identity);expect((await inspectClientHosts(selection)).every(host=>host.state==='exited')).toBe(true);safe=true;
  }finally{if(!safe&&selection&&manifest){const supervisor=runtimeSupervisor(selection,manifest);for(const identity of supervisor.registered().reverse())for(let attempt=0;attempt<100;attempt++){const state=await supervisor.inspect(identity);if(state==='running'){await supervisor.stop(identity);break;}if(state==='exited')break;await new Promise(r=>setTimeout(r,100));if(attempt===99)throw new Error('HUMAN_ACTION_REQUIRED: fixture process ownership unresolved');}if((await inspectClientHosts(selection)).some(host=>host.state!=='exited'))throw new Error('HUMAN_ACTION_REQUIRED: fixture client host unresolved');safe=true;}if(safe&&selection&&installationId){for(const name of ['api','cli','mcp','installer'])await secrets.delete(installationId,name);for(const directory of existsSync(join(selection.root,'installer-staging/operations'))?readdirSync(join(selection.root,'installer-staging/operations')):[])await secrets.delete(installationId,'selfcheck-'+directory);await h.cleanup();}}
},180000);
