import { JobRunner, HEARTBEAT_MS } from '../../../packages/application/src/job-runner.js';
import { AuthJobRunner, type AuthJobRunnerOptions } from '../../../packages/application/src/auth-jobs.js';
import type { ProfileOwnershipCoordinator, SourceProbePort } from '../../../packages/application/src/ports.js';
import { openDatabase, readGate } from '../../../packages/persistence/src/database.js';
import { SQLiteJobStore } from '../../../packages/persistence/src/claims.js';
import { SQLiteAuthJobStore } from '../../../packages/persistence/src/auth.js';
import { SQLiteStatusProjectionStore } from '../../../packages/persistence/src/runtime-status.js';
import { syntheticProvider } from '../../../packages/test-support/src/synthetic-provider.js';
import type { BuildIdentity, WriteContext, Health } from '../../../packages/domain/src/model.js';
import Fastify from 'fastify';
import { serviceSelection, runtimeIdentity, publishProcess, processProof, workerLaunchContext, type ProcessRecord } from '../../../packages/platform/src/processes.js';
import { NativeSecretStore } from '../../../packages/platform/src/credentials.js';
import { readInstallation } from '../../../packages/platform/src/installation.js';
import { managedPaths, assertManagedPath } from '../../../packages/platform/src/paths.js';
import { SQLiteMaintenanceStore } from '../../../packages/persistence/src/database.js';
import { assertTransport, authenticate, WindowLimit } from '../../api/src/security.js';
import { z } from 'zod';
import { authorize, SyntheticOutputPolicy } from '../../../packages/application/src/policy.js';
import { LocalPlaywrightBrowserProvider } from '../../../packages/platform/src/browser.js';
import { SealedSourceAdapters } from '../../../packages/platform/src/source-adapters.js';

export const WORKER_BUILD_IDENTITY = typeof __AUTOED_BUILD_IDENTITY__ === 'undefined' ? null : __AUTOED_BUILD_IDENTITY__;
type SyntheticAuthComposition = { probes: SourceProbePort; evidence: 'S/I'; clock?: AuthJobRunnerOptions['clock'] };
type ProductionAuthComposition = {
  adapters: SealedSourceAdapters;
  browserProvider: LocalPlaywrightBrowserProvider;
  profileOwnership: ProfileOwnershipCoordinator;
  clock?: AuthJobRunnerOptions['clock'];
};
export interface WorkerOptions {
  databasePath: string;
  owner: string;
  build: BuildIdentity;
  context?: WriteContext;
  /** Production accepts only the sealed adapter composition; direct probes are test-only S/I fixtures. */
  auth?: SyntheticAuthComposition | ProductionAuthComposition;
}
/** Trusted composition boundary. Production callers supply a protected installation path. */
export async function startWorker(options: WorkerOptions) {
  const db = openDatabase(options.databasePath); const jobs = new SQLiteJobStore(db);
  const projections = new SQLiteStatusProjectionStore(db); const runner = new JobRunner(jobs);
  const authStore = new SQLiteAuthJobStore(db);
  const authProbes = options.auth && 'adapters' in options.auth ? options.auth.adapters : options.auth?.probes;
  // Holding these dependencies in the production branch makes the authority chain explicit; the adapter itself
  // remains the only source request boundary and owns the Local Playwright/Profile checks.
  if (options.auth && 'adapters' in options.auth) {
    void options.auth.browserProvider;
    void options.auth.profileOwnership;
  }
  const authRunner = authProbes ? new AuthJobRunner(authStore, authProbes, { ...(options.auth?.clock ? { clock: options.auth.clock } : {}) }) : null;
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
      try {
        // Fair bounded turn: at most one synthetic unit and one due per-source auth unit per loop.
        await runner.runOnce(options.owner,context,handler);
        if (!stopping && authRunner) await authRunner.runOnce(options.owner,context);
      }
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
      stopping=true;authRunner?.stop();wake?.();await loop;
    })();
  }
  return {stop,build,done:loop};
}

async function standaloneWorker() {
  const launch=serviceSelection();if(!launch)return;
  if(!WORKER_BUILD_IDENTITY)throw new Error('COMPILED_BUILD_REQUIRED');
  const context=workerLaunchContext(launch.selection,launch.nonce,WORKER_BUILD_IDENTITY);
  process.umask(0o077);
  const metadata=readInstallation(launch.selection);const databasePath=assertManagedPath(managedPaths(launch.selection.root),'data/jobs.sqlite');
  const controlDb=openDatabase(databasePath);const maintenance=new SQLiteMaintenanceStore(controlDb);const secrets=new NativeSecretStore();
  const app=Fastify({logger:false,trustProxy:false,bodyLimit:1024,requestTimeout:3000,connectionTimeout:3000});
  const policy=new SyntheticOutputPolicy(metadata.installationId);
  let origin='';let record:ProcessRecord;let closing=false;let shutdown=false;const limit=new WindowLimit(30);
  app.addHook('onRequest',async(request,reply)=>{
    reply.header('cache-control','no-store');assertTransport(request,origin);limit.take();
    const principal=await authenticate(request,metadata.installationId,metadata.credentials,secrets,maintenance);
    await authorize(policy,principal,'control:shutdown','status');
  });
  app.setErrorHandler((_error,_request,reply)=>{reply.code(403).send({code:'PROCESS_CONTROL_DENIED'});});
  app.post('/api/process/inspect',request=>processProof(secrets,record,request.body));
  app.post('/api/control/shutdown',async request=>{z.strictObject({}).parse(request.body);shutdown=true;return {accepted:true};});
  app.addHook('onResponse',async(request,reply)=>{if(shutdown&&request.url==='/api/control/shutdown'&&reply.statusCode===200)setImmediate(()=>{void stop();});});
  await app.listen({host:'127.0.0.1',port:0});const address=app.server.address();
  if(!address||typeof address==='string')throw new Error('INVALID_BIND');origin=`http://127.0.0.1:${address.port}`;
  let worker:Awaited<ReturnType<typeof startWorker>>;
  try {worker=await startWorker({databasePath,owner:launch.nonce,build:WORKER_BUILD_IDENTITY,...(context?{context}:{})});}
  catch(error){await app.close();controlDb.close();throw error;}
  async function stop(){if(closing)return;closing=true;await worker.stop();await app.close();controlDb.close();}
  void worker.done.then(()=>stop());
  process.once('SIGTERM',()=>{void stop();});process.once('SIGINT',()=>{void stop();});
  try {record=await runtimeIdentity(launch.selection,'worker',WORKER_BUILD_IDENTITY,launch.nonce,address.port);publishProcess(launch.selection,record);}
  catch(error){await stop();throw error;}
}
void standaloneWorker().catch(()=>{process.exitCode=1;});
