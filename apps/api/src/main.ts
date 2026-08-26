import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { BuildIdentity } from '../../../packages/domain/src/model.js';
import type { JobStore, MaintenanceStore, SecretStore, StatusProjectionStore } from '../../../packages/application/src/ports.js';
import type { CredentialRecord } from '../../../packages/platform/src/credentials.js';
import { ApiApplication, ApplicationError, SyntheticOutputPolicy, authorize, type Principal } from '../../../packages/application/src/policy.js';
import { ApplicationStatus } from '../../../packages/application/src/status.js';
import { JobRequestSchema, MaintenanceGateSchema, StatusSchema } from '../../../packages/contracts/src/index.js';
import { assertTransport, authenticate, WindowLimit } from './security.js';
import { browserPrincipal, publicPairingPaths, registerPairing } from './pairing.js';
import { publicStaticPaths, registerStatic } from './static.js';
import { fileURLToPath } from 'node:url';
import type { SQLiteSessions } from '../../../packages/persistence/src/sessions.js';
import { SQLiteSessions as Sessions } from '../../../packages/persistence/src/sessions.js';
import { openDatabase, readGate, SQLiteMaintenanceStore } from '../../../packages/persistence/src/database.js';
import { SQLiteJobStore } from '../../../packages/persistence/src/claims.js';
import { SQLiteStatusProjectionStore } from '../../../packages/persistence/src/runtime-status.js';
import { NativeSecretStore } from '../../../packages/platform/src/credentials.js';
import { readInstallation } from '../../../packages/platform/src/installation.js';
import { assertManagedPath, managedPaths } from '../../../packages/platform/src/paths.js';
import { serviceSelection, runtimeIdentity, publishProcess, processProof, type ProcessRecord } from '../../../packages/platform/src/processes.js';

// Production build replaces this symbol; source tests supply a synthetic identity.
export const API_BUILD_IDENTITY = typeof __AUTOED_BUILD_IDENTITY__ === 'undefined' ? null : __AUTOED_BUILD_IDENTITY__;

export interface ApiOptions {
  host: string; port: number; installationId: string; build: BuildIdentity; secrets: SecretStore; credentials: CredentialRecord[];
  jobs: JobStore; maintenance: MaintenanceStore; projections: StatusProjectionStore; shutdown: () => Promise<void>;
  sessions: SQLiteSessions;
  processRecord?: () => ProcessRecord;
  runtimeGeneration?: number;
  assetsRoot?: string;
}
const JobOutput = z.strictObject({
  id: z.uuid(), request: JobRequestSchema, state: z.enum(['queued','running','retry_wait','succeeded','failed','cancelled']), cancelRequested: z.boolean(), attempt: z.number().int(), maxAttempts: z.number().int(),
  nextRunAt: z.number().nullable(), lease: z.strictObject({ owner: z.string(), fence: z.number(), leaseUntil: z.number() }).nullable(), checkpoint: z.string().nullable(), result: z.string().nullable(), lastSuccessResult: z.string().nullable(), errorCode: z.string().nullable(), generation: z.number().int(), operationId: z.uuid().nullable(), createdAt: z.number(), updatedAt: z.number(),
});
const Accepted = z.strictObject({ accepted: z.literal(true) });
const safeCodes = new Set(['FORBIDDEN','UNAUTHORIZED','PAIRING_DENIED','RATE_LIMITED','QUEUE_FULL','GENERATION_MISMATCH','MAINTENANCE_ACTIVE','MAINTENANCE_OWNERSHIP_MISMATCH','IDEMPOTENCY_CONFLICT','JOB_NOT_FOUND','JOBS_NOT_DRAINED','STALE_PROJECTION','FUTURE_OBSERVATION','INVALID_SELFCHECK']);
export async function startApi(options: ApiOptions) {
  if (options.host !== '127.0.0.1' || !Number.isInteger(options.port) || options.port < 0 || options.port > 65535) throw new Error('INVALID_BIND');
  z.uuid().parse(options.installationId);
  if(options.runtimeGeneration!==undefined)z.number().int().nonnegative().parse(options.runtimeGeneration);
  if (options.sessions.installationId !== options.installationId) throw new Error('INVALID_SESSION_SCOPE');
  const app = Fastify({ logger: false, trustProxy: false, bodyLimit: 16384, requestTimeout: 10000, connectionTimeout: 10000 });
  await app.register(cookie);
  let origin = ''; let shutdownRequested = false; const principals = new WeakMap<FastifyRequest, Principal>(); const authLimit = new WindowLimit(30);
  const policy = new SyntheticOutputPolicy(options.installationId);
  const application = new ApiApplication(options.jobs, options.maintenance, options.projections, policy, async () => { shutdownRequested = true; },options.runtimeGeneration);
  app.addHook('onResponse', async (request, reply) => {
    if (shutdownRequested && request.url === '/api/control/shutdown' && reply.statusCode === 200) {
      shutdownRequested = false;
      // Response must finish before a stop callback can await Fastify.close().
      setImmediate(() => { void options.shutdown().catch(() => { /* Acceptance is not completion; supervisor verifies exit. */ }); });
    }
  });
  const status = new ApplicationStatus(options.projections, policy, API_BUILD_IDENTITY ?? options.build);
  app.addHook('onRequest', async (request, reply) => {
    reply.header('cache-control', 'no-store').header('x-content-type-options', 'nosniff').header('content-security-policy', "default-src 'self'; frame-ancestors 'none'; object-src 'none'");
    assertTransport(request, origin);
    if (publicStaticPaths.has(request.url) && request.method === 'GET') return;
    if (publicPairingPaths.has(request.url)) return;
    authLimit.take();
    principals.set(request, request.headers.authorization !== undefined || !request.cookies.autoed_session
      ? await authenticate(request, options.installationId, options.credentials, options.secrets, options.maintenance)
      : browserPrincipal(request, options.sessions, origin));
    if(options.runtimeGeneration!==undefined&&request.url!=='/api/process/inspect'&&request.url!=='/api/control/shutdown'&&(await options.maintenance.read()).generation!==options.runtimeGeneration)throw new ApplicationError('GENERATION_MISMATCH',409);
  });
  app.setErrorHandler((error, _request, reply) => {
    const e = error as { code?: string; statusCode?: number };
    const validation = error instanceof z.ZodError || e.code?.startsWith('FST_ERR_CTP_');
    const code = validation ? 'INVALID_REQUEST' : e.code && safeCodes.has(e.code) ? e.code : 'INTERNAL_ERROR';
    reply.code(validation ? e.statusCode === 413 ? 413 : 400 : code === 'INTERNAL_ERROR' ? 500 : e.statusCode ?? 403).send({ code, stage: 'api', nextAction: 'retry_or_check_local_service' });
  });
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ code: 'NOT_FOUND', stage: 'api', nextAction: 'use_registered_endpoint' }));
  const principal = (request: FastifyRequest) => { const p = principals.get(request); if (!p) throw new ApplicationError('UNAUTHORIZED', 401); return p; };
  registerPairing(app, options.sessions, () => origin, principal, policy);
  registerStatic(app, options.assetsRoot);
  app.get('/api/status', async request => StatusSchema.parse(await status.read(principal(request))));
  app.post('/api/process/inspect', async request => {
    const p=principal(request);
    await authorize(policy,p,'control:shutdown','status');
    if(p.scope.installationId!==options.installationId||!options.processRecord)throw new ApplicationError('FORBIDDEN');
    return processProof(options.secrets,options.processRecord(),request.body);
  });
  app.post('/api/jobs', async request => JobOutput.parse(await application.enqueue(principal(request), request.body)));
  app.get<{ Params: { id: string } }>('/api/jobs/:id', async request => JobOutput.parse(await application.query(principal(request), request.params.id)));
  app.post<{ Params: { id: string } }>('/api/jobs/:id/cancel', async request => JobOutput.parse(await application.cancel(principal(request), request.params.id, request.body)));
  app.post('/api/control/shutdown', async request => Accepted.parse(await application.shutdown(principal(request), request.body)));
  app.post('/api/control/maintenance', async request => MaintenanceGateSchema.parse(await application.maintain(principal(request), request.body)));
  app.post('/api/control/status-projection', async request => Accepted.parse(await application.project(principal(request), request.body)));
  let bootStarted = false;
  app.addHook('onClose', async () => { if (bootStarted) options.sessions.endBoot(); });
  try {
    await app.listen({ host: options.host, port: options.port });
    const address = app.server.address(); if (!address || typeof address === 'string') throw new Error('INVALID_BIND');
    origin = `http://127.0.0.1:${address.port}`;
    options.sessions.beginBoot();
    bootStarted = true;
  } catch (error) { await app.close(); throw error; }
  return { origin, close: () => app.close() };
}

async function standaloneApi() {
  const launch=serviceSelection();if(!launch)return;
  if(!API_BUILD_IDENTITY)throw new Error('COMPILED_BUILD_REQUIRED');
  process.umask(0o077);
  const metadata=readInstallation(launch.selection);const paths=managedPaths(launch.selection.root);
  const db=openDatabase(assertManagedPath(paths,'data/jobs.sqlite'));
  const projections=new SQLiteStatusProjectionStore(db);const context={expectedGeneration:readGate(db).generation};
  let record:ProcessRecord;let closing=false;let last=0;
  async function report(health:'healthy'|'not_observed') {
    const now=Date.now();if(now<=last)return;
    await projections.writeComponent({role:'api',build:API_BUILD_IDENTITY!,checkedAt:new Date(now).toISOString(),health,evidence:'process_report'},
      {...context,operationId:readGate(db).operationId});last=now;
  }
  const secrets=new NativeSecretStore();
  const service=await startApi({host:'127.0.0.1',port:metadata.port,installationId:metadata.installationId,build:API_BUILD_IDENTITY,secrets,credentials:metadata.credentials,
    jobs:new SQLiteJobStore(db),maintenance:new SQLiteMaintenanceStore(db),projections,sessions:new Sessions(db,metadata.installationId),
    processRecord:()=>record,runtimeGeneration:context.expectedGeneration,shutdown:()=>stop(),assetsRoot:fileURLToPath(new URL('../../status/',import.meta.url))});
  let pulse:Promise<void>|undefined;
  const timer=setInterval(()=>{if(!closing&&!pulse)pulse=report('healthy').catch(()=>{setImmediate(()=>{void stop();});}).finally(()=>{pulse=undefined;});},5000);
  async function stop() {
    if(closing)return;closing=true;clearInterval(timer);await service.close();if(pulse)await pulse;
    try{if(Date.now()<=last)await new Promise(r=>setTimeout(r,2));await report('not_observed');}catch{}finally{db.close();}
  }
  process.once('SIGTERM',()=>{void stop();});process.once('SIGINT',()=>{void stop();});
  try {record=await runtimeIdentity(launch.selection,'api',API_BUILD_IDENTITY,launch.nonce,metadata.port);await report('healthy');publishProcess(launch.selection,record);}
  catch(error){await stop();throw error;}
}
void standaloneApi().catch(()=>{process.exitCode=1;});
