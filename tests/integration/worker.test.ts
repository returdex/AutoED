import { afterEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { startWorker } from '../../apps/worker/src/main.js';
import { openDatabase, SQLiteMaintenanceStore } from '../../packages/persistence/src/database.js';
import { SQLiteJobStore } from '../../packages/persistence/src/claims.js';
import { SQLiteStatusProjectionStore } from '../../packages/persistence/src/runtime-status.js';
import { createHarness } from '../../packages/test-support/src/harness.js';
import type { BuildIdentity, JobRequest } from '../../packages/domain/src/model.js';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
const build: BuildIdentity = { version:'0.1.0', buildId:'a'.repeat(64), commit:'b'.repeat(40), tree:'c'.repeat(40), dependencyHash:'d'.repeat(64), protocol:1, schemaMin:1, schemaMax:1, capabilities:['echo'] };
function fixture() {
  const h=createHarness(); cleanups.push(()=>h.cleanup()); const path=join(h.root,'jobs.sqlite'); const db=openDatabase(path);
  cleanups.push(async()=>{db.close();}); const jobs=new SQLiteJobStore(db); const gate=new SQLiteMaintenanceStore(db);
  const request: JobRequest={kind:'echo',value:'https://untrusted.invalid/ is just text',idempotencyKey:randomUUID(),scope:{installationId:randomUUID(),source:'synthetic',courseId:'selftest'}};
  return {h,path,db,jobs,gate,request};
}
async function until(check:()=>Promise<boolean>, ms=8000) {
  const end=Date.now()+ms; while(!await check()) { if(Date.now()>end) throw new Error('WORKER_TIMEOUT'); await new Promise(r=>setTimeout(r,100)); }
}
it('compiled A and B independent workers execute durable echo and actual SHA256, never manifest-only capabilities', async()=>{
  for(const variant of ['A','B']) {
    execFileSync(process.execPath,['scripts/build/build.mjs'],{cwd:resolve('.'),env:{...process.env,AUTOED_BUILD_VARIANT:variant},stdio:'pipe'});
    const f=fixture(); const echo=await f.jobs.enqueue(f.request,{expectedGeneration:0});
    const digest=await f.jobs.enqueue({...f.request,kind:'digest',value:'abc',idempotencyKey:randomUUID()},{expectedGeneration:0});
    const entry=pathToFileURL(resolve('dist/apps/worker/src/main.js')).href;
    const child=f.h.spawn(['--input-type=module','-e',`const {startWorker}=await import(${JSON.stringify(entry)});const w=await startWorker({databasePath:${JSON.stringify(f.path)},owner:'actual-child',build:${JSON.stringify({...build,capabilities:['digest']})}});process.once('SIGTERM',async()=>{await w.stop();});`]);
    await until(async()=>['succeeded','failed'].includes((await f.jobs.query(digest.id,f.request.scope))!.state) && (await f.jobs.query(echo.id,f.request.scope))?.state==='succeeded');
    expect((await f.jobs.query(echo.id,f.request.scope))?.result).toBe(f.request.value);
    expect(await f.jobs.query(digest.id,f.request.scope)).toMatchObject(variant==='A'?{state:'failed',errorCode:'UNSUPPORTED_CAPABILITY'}:{state:'succeeded',result:'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'});
    const projections=new SQLiteStatusProjectionStore(f.db);
    expect((await projections.read()).worker).toMatchObject({health:'healthy',freshness:'fresh',build:{capabilities:variant==='A'?['echo']:['echo','digest']}});
    await f.h.stop(child);
    expect((await projections.read()).worker).toMatchObject({health:'not_observed',freshness:'fresh'});
  }
},30000);
it('quiescing prevents claims; exclusive executes only operation-bound selfcheck; old generation cannot resume',async()=>{
  const f=fixture(); const queued=await f.jobs.enqueue(f.request,{expectedGeneration:0});
  const op=randomUUID(); await f.gate.enterMaintenance({operationId:op,owner:'installer',leaseUntil:0,expectedGeneration:0});
  const ordinary=await startWorker({databasePath:f.path,owner:'ordinary',build}); cleanups.push(()=>ordinary.stop());
  await new Promise(r=>setTimeout(r,350)); expect((await f.jobs.query(queued.id,f.request.scope))?.state).toBe('queued');
  await ordinary.stop(); await f.gate.markExclusive(op,0);
  const context={expectedGeneration:0,selfcheck:{operationId:op,generation:0}};
  const check=await f.jobs.enqueue({...f.request,idempotencyKey:randomUUID()},context);
  const candidate=await startWorker({databasePath:f.path,owner:'candidate',build,context}); cleanups.push(()=>candidate.stop());
  await until(async()=>(await f.jobs.query(check.id,f.request.scope))?.state==='succeeded');
  expect((await f.jobs.query(queued.id,f.request.scope))?.state).toBe('queued');
  await f.gate.exitMaintenance(op,0); await new Promise(r=>setTimeout(r,350));
  await candidate.done;
  expect((await f.jobs.query(queued.id,f.request.scope))?.state).toBe('queued');
  await candidate.stop();
});
it('missing heartbeat becomes stale independently of previously healthy observation',async()=>{
  const f=fixture(); const worker=await startWorker({databasePath:f.path,owner:'heartbeat',build}); cleanups.push(()=>worker.stop());
  const projection=new SQLiteStatusProjectionStore(f.db); const first=(await projection.read()).worker!;
  await until(async()=>(await projection.read()).worker?.checkedAt!==first.checkedAt,6500);
  const later=new SQLiteStatusProjectionStore(f.db,{now:()=>Date.now()+31000});
  expect((await later.read()).worker).toMatchObject({health:'healthy',freshness:'stale'});
});
