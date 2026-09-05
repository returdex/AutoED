import { afterEach, expect, it } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { existsSync, lstatSync, mkdtempSync, readFileSync, readlinkSync, readdirSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { startWorker } from '../../apps/worker/src/main.js';
import { openDatabase, SQLiteMaintenanceStore } from '../../packages/persistence/src/database.js';
import { SQLiteJobStore } from '../../packages/persistence/src/claims.js';
import { SQLiteStatusProjectionStore } from '../../packages/persistence/src/runtime-status.js';
import { createHarness } from '../../packages/test-support/src/harness.js';
import { compiledRelease } from '../../packages/test-support/src/upgrade-fixture.js';
import type { BuildIdentity, JobRequest } from '../../packages/domain/src/model.js';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
const build: BuildIdentity = { version:'0.1.0', buildId:'a'.repeat(64), commit:'b'.repeat(40), tree:'c'.repeat(40), dependencyHash:'d'.repeat(64), protocol:1, schemaMin:1, schemaMax:1, capabilities:['echo'] };
type InventoryEntry = { path: string; type: 'directory' | 'file' | 'symlink'; bytes: number; sha256: string; executable: boolean };
type Inventory = { exists: boolean; digest: string; entries: InventoryEntry[] };
const sha256 = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
function inventory(root: string): Inventory {
  if (!existsSync(root)) return { exists:false, digest:sha256('missing'), entries:[] };
  const entries: InventoryEntry[] = [];
  function visit(path: string, relative: string): void {
    const stat = lstatSync(path);
    const executable = (stat.mode & 0o111) !== 0;
    if (stat.isDirectory()) {
      entries.push({ path:relative, type:'directory', bytes:0, sha256:sha256(''), executable });
      for (const name of readdirSync(path).sort()) visit(join(path,name), `${relative}/${name}`);
      return;
    }
    if (stat.isFile()) {
      const bytes = readFileSync(path);
      entries.push({ path:relative, type:'file', bytes:bytes.length, sha256:sha256(bytes), executable });
      return;
    }
    if (stat.isSymbolicLink()) {
      const target = readlinkSync(path);
      const bytes = Buffer.from(target);
      entries.push({ path:relative, type:'symlink', bytes:bytes.length, sha256:sha256(bytes), executable:false });
      return;
    }
    throw new Error('DIST_INVENTORY_UNSUPPORTED');
  }
  visit(root,'.');
  entries.sort((a,b)=>a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return { exists:true, digest:sha256(JSON.stringify(entries)), entries };
}
function optionalBytes(path: string): Buffer | null {
  return existsSync(path) ? Buffer.from(readFileSync(path)) : null;
}
function removeOwnedParent(parent: string): void {
  if (!existsSync(parent)) return;
  const stat = lstatSync(parent);
  if (!stat.isDirectory() || realpathSync(parent) !== parent) throw new Error('WORKER_FIXTURE_ROOT_INVALID');
  rmSync(parent,{recursive:true,force:true});
}
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
  const identityPath=resolve('build/identity.json');
  const distPath=resolve('dist');
  const identityBefore=optionalBytes(identityPath);
  const distBefore=inventory(distPath);
  const nodeModulesTarget=realpathSync(resolve('node_modules'));
  const parent=realpathSync(mkdtempSync(join(tmpdir(),'autoed-worker-release-')));
  try {
    symlinkSync(nodeModulesTarget,join(parent,'node_modules'),'dir');
    for(const variant of ['A','B'] as const) {
      const release=await compiledRelease(parent,variant);
      const f=fixture(); const echo=await f.jobs.enqueue(f.request,{expectedGeneration:0});
      const digest=await f.jobs.enqueue({...f.request,kind:'digest',value:'abc',idempotencyKey:randomUUID()},{expectedGeneration:0});
      const entry=pathToFileURL(join(parent,`compiled-${variant}/apps/worker/src/main.js`)).href;
      const childReport=join(f.h.root,`worker-${variant}.json`);
      const callerBuild={...build,capabilities:['digest']};
      let child: ReturnType<typeof f.h.spawn> | undefined;
      try {
        child=f.h.spawn(['--input-type=module','-e',`const {startWorker}=await import(${JSON.stringify(entry)});const {writeFileSync}=await import('node:fs');const w=await startWorker({databasePath:${JSON.stringify(f.path)},owner:'actual-child',build:${JSON.stringify(callerBuild)}});writeFileSync(${JSON.stringify(childReport)},JSON.stringify({build:w.build}));process.once('SIGTERM',async()=>{await w.stop();});`]);
        await until(async()=>existsSync(childReport) && ['succeeded','failed'].includes((await f.jobs.query(digest.id,f.request.scope))!.state) && (await f.jobs.query(echo.id,f.request.scope))?.state==='succeeded');
        const childIdentity=JSON.parse(readFileSync(childReport,'utf8')) as { build: BuildIdentity };
        expect(childIdentity.build).toMatchObject({buildId:release.build.buildId,capabilities:release.build.capabilities});
        expect((await f.jobs.query(echo.id,f.request.scope))?.result).toBe(f.request.value);
        expect(await f.jobs.query(digest.id,f.request.scope)).toMatchObject(variant==='A'?{state:'failed',errorCode:'UNSUPPORTED_CAPABILITY'}:{state:'succeeded',result:'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'});
        const projections=new SQLiteStatusProjectionStore(f.db);
        expect((await projections.read()).worker).toMatchObject({health:'healthy',freshness:'fresh',build:{buildId:release.build.buildId,capabilities:release.build.capabilities}});
        await f.h.stop(child); child=undefined;
        expect((await projections.read()).worker).toMatchObject({health:'not_observed',freshness:'fresh'});
        if(variant==='B'){
          const stopped=(await projections.read()).worker!.checkedAt;
          const crashed=f.h.spawn(['--input-type=module','-e',`const {startWorker}=await import(${JSON.stringify(entry)});await startWorker({databasePath:${JSON.stringify(f.path)},owner:'crash-child',build:${JSON.stringify(callerBuild)}});`]);
          try {
            await until(async()=>{const status=(await projections.read()).worker;return status?.health==='healthy'&&status.checkedAt!==stopped;});
            const exited=once(crashed,'exit');crashed.kill('SIGKILL');await exited;
            expect((await new SQLiteStatusProjectionStore(f.db,{now:()=>Date.now()+31000}).read()).worker).toMatchObject({health:'healthy',freshness:'stale',build:{buildId:release.build.buildId,capabilities:release.build.capabilities}});
            expect((await f.jobs.query(digest.id,f.request.scope))?.result).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
          } finally {
            await f.h.stop(crashed);
          }
        }
      } finally {
        if(child && child.exitCode===null && child.signalCode===null) await f.h.stop(child);
      }
    }
  } finally {
    removeOwnedParent(parent);
    expect(optionalBytes(identityPath)).toEqual(identityBefore);
    expect(inventory(distPath)).toEqual(distBefore);
    expect(existsSync(nodeModulesTarget)).toBe(true);
    expect(realpathSync(resolve('node_modules'))).toBe(nodeModulesTarget);
    expect(existsSync(parent)).toBe(false);
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
