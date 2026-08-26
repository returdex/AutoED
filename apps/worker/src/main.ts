import { JobRunner, HEARTBEAT_MS } from '../../../packages/application/src/job-runner.js';
import { openDatabase, readGate } from '../../../packages/persistence/src/database.js';
import { SQLiteJobStore } from '../../../packages/persistence/src/claims.js';
import { SQLiteStatusProjectionStore } from '../../../packages/persistence/src/runtime-status.js';
import { syntheticProvider } from '../../../packages/test-support/src/synthetic-provider.js';
import type { BuildIdentity, WriteContext, Health } from '../../../packages/domain/src/model.js';

export const WORKER_BUILD_IDENTITY = typeof __AUTOED_BUILD_IDENTITY__ === 'undefined' ? null : __AUTOED_BUILD_IDENTITY__;
export interface WorkerOptions { databasePath: string; owner: string; build: BuildIdentity; context?: WriteContext }
/** Trusted composition boundary. Production callers supply a protected installation path. */
export async function startWorker(options: WorkerOptions) {
  const db = openDatabase(options.databasePath); const jobs = new SQLiteJobStore(db);
  const projections = new SQLiteStatusProjectionStore(db); const runner = new JobRunner(jobs);
  const build = WORKER_BUILD_IDENTITY ?? options.build;
  const handler = syntheticProvider(build.capabilities.includes('digest'));
  // Capture once; an old process must never adopt a replacement generation.
  const context = options.context ?? { expectedGeneration: readGate(db).generation };
  let stopping = false; let failed = false; let latest = 0;
  let wake: (() => void) | undefined;
  async function report(health: Health) {
    const now = Date.now(); if (now <= latest) return;
    const gate = readGate(db);
    // A normal process can describe its own health during quiescence, but cannot
    // promote itself to an operation-scoped executor or a replacement generation.
    await projections.writeComponent({role:'worker',build,checkedAt:new Date(now).toISOString(),health,evidence:'process_report'},
      {expectedGeneration:context.expectedGeneration,operationId:gate.operationId}); latest = now;
  }
  try { await report('healthy'); } catch(error) { db.close(); throw error; }
  let heartbeat: Promise<void> | undefined;
  const timer = setInterval(()=> { if(!heartbeat && !stopping) heartbeat=report('healthy').catch(()=>{failed=true;stopping=true;wake?.();}).finally(()=>{heartbeat=undefined;}); },HEARTBEAT_MS);
  const loop = (async()=>{
    while(!stopping) {
      try { await runner.runOnce(options.owner,context,handler); }
      catch(error) {
        const code=(error as {code?:string}).code;
        if(code!=='MAINTENANCE_ACTIVE') { failed=true;stopping=true; }
      }
      if(!stopping) await new Promise<void>(resolve=>{ const delay=setTimeout(()=>{wake=undefined;resolve();},250);wake=()=>{clearTimeout(delay);wake=undefined;resolve();}; });
    }
  })().finally(async()=>{
    clearInterval(timer);if(heartbeat)await heartbeat;
    try { if(Date.now()<=latest)await new Promise(r=>setTimeout(r,2));await report(failed?'error':'not_observed'); } catch { /* A lost generation cannot overwrite its replacement. */ }
    db.close();
  });
  let stopPromise: Promise<void> | undefined;
  function stop(): Promise<void> {
    return stopPromise ??= (async()=>{
      stopping=true;wake?.();await loop;
    })();
  }
  return {stop,build,done:loop};
}
