import {expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {existsSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {createHarness} from '../../packages/test-support/src/harness.js';
import {initializeInstallation} from '../../packages/platform/src/installation.js';
import {protectPath} from '../../packages/platform/src/permissions.js';
import {openDatabase,SQLiteMaintenanceStore} from '../../packages/persistence/src/database.js';
import {JobRepository} from '../../packages/persistence/src/jobs.js';
import {SQLiteStatusProjectionStore} from '../../packages/persistence/src/runtime-status.js';
import {UpgradeJournal,JOURNAL_STAGES,writeJournalProjection} from '../../packages/installer/src/journal.js';
import {createSnapshot,verifySnapshot} from '../../packages/installer/src/snapshot.js';

const build={version:'0.1.0-beta.2',buildId:'b'.repeat(64),commit:'c'.repeat(40),tree:'d'.repeat(40),dependencyHash:'e'.repeat(64),protocol:1 as const,schemaMin:1 as const,schemaMax:1 as const,capabilities:['echo','digest']};
async function fixture(){const h=createHarness(),parent=realpathSync(h.root);protectPath(parent);const selection={root:join(parent,'installation'),parent,excludedRoots:[]},values=new Map<string,string>();const metadata=await initializeInstallation(selection,{get:async(id,name)=>values.get(id+name)??null,set:async(id,name,value)=>{values.set(id+name,value);},delete:async(id,name)=>{values.delete(id+name);}});const db=openDatabase(join(selection.root,'data/autoed.sqlite'));return {h,selection,metadata,db};}
it('journals every durable intent/done, rejects concurrent writers and replays only persisted boundaries',async()=>{
  const f=await fixture();try{
    const input={operationId:randomUUID(),scopeHash:'a'.repeat(64),manifestHash:'f'.repeat(64),target:build,previousInstallation:'none' as const,generation:0};
    const journal=await UpgradeJournal.create(f.selection,input);
    await expect(UpgradeJournal.create(f.selection,{...input,operationId:randomUUID()})).rejects.toThrow('UPGRADE_LOCKED');
    for(const stage of JOURNAL_STAGES){await journal.append(stage,'intent');let restored=UpgradeJournal.read(f.selection,input.operationId);expect(restored.entries.at(-1)).toMatchObject({stage,phase:'intent'});await journal.append(stage,'done');restored=UpgradeJournal.read(f.selection,input.operationId);expect(restored.entries.at(-1)).toMatchObject({stage,phase:'done'});}
    expect(UpgradeJournal.read(f.selection,input.operationId).entries).toHaveLength(JOURNAL_STAGES.length*2);await journal.release();
  }finally{f.db.close();await f.h.cleanup();}
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
    const bytes=readFileSync(snapshot.databasePath);bytes[100]^=1;writeFileSync(snapshot.databasePath,bytes);expect(()=>verifySnapshot(f.selection,snapshot)).toThrow('SNAPSHOT_INVALID');
  }finally{f.db.close();await f.h.cleanup();}
});
it('persists truthful install projection through maintenance exit with actual monotonic timestamps',async()=>{
  const f=await fixture();try{
    const operationId=randomUUID(),gate=new SQLiteMaintenanceStore(f.db);await gate.enterMaintenance({operationId,expectedGeneration:0,owner:'installer',leaseUntil:Date.now()+60000});await gate.markExclusive(operationId,0);
    const journal=await UpgradeJournal.create(f.selection,{operationId,scopeHash:'a'.repeat(64),manifestHash:'f'.repeat(64),target:build,previousInstallation:'present',generation:0});
    await journal.append('preview','intent');await writeJournalProjection(f.db,journal,{stage:'stopped',result:'human_needed',actualBuild:null,cleanup:'cleanup_pending'});
    const first=(await new SQLiteStatusProjectionStore(f.db).read()).install!;await writeJournalProjection(f.db,journal,{stage:'stopped',result:'failed',actualBuild:null,cleanup:'cleanup_pending'});
    const second=(await new SQLiteStatusProjectionStore(f.db).read()).install!;expect(Date.parse(second.checkedAt!)).toBeGreaterThan(Date.parse(first.checkedAt!));expect(Date.parse(second.checkedAt!)).toBeLessThanOrEqual(Date.now());
    await gate.exitMaintenance(operationId,0);await expect(writeJournalProjection(f.db,journal,{stage:'complete',result:'succeeded',actualBuild:build,cleanup:'complete'})).rejects.toThrow('COMPLETION_EVIDENCE_REQUIRED');
  }finally{f.db.close();await f.h.cleanup();}
});
