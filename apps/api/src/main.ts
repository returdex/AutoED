import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { uptime } from 'node:os';
import type { BuildIdentity, SourceId, UatScenario } from '../../../packages/domain/src/model.js';
import type { AccountBindingStore, JobStore, MaintenanceStore, ProfileOwnershipStore, SecretStore, SourceConfigStore, SourceObservationStore, StatusProjectionStore } from '../../../packages/application/src/ports.js';
import type { CredentialRecord } from '../../../packages/platform/src/credentials.js';
import { ApiApplication, ApplicationError, AuthControlApplication, SyntheticOutputPolicy, authorize, toSafeAuthApiError, type AuthControlDependencies, type Principal } from '../../../packages/application/src/policy.js';
import { ApplicationStatus } from '../../../packages/application/src/status.js';
import { JobRequestSchema, MaintenanceGateSchema, StatusSchema } from '../../../packages/contracts/src/index.js';
import { assertTransport, authenticate, authenticatedRecord, WindowLimit } from './security.js';
import { clientIdentityProof } from '../../../packages/platform/src/client-endpoint.js';
import {SelfcheckCredentials,SelfcheckCredentialInput} from '../../../packages/platform/src/selfcheck-credentials.js';
import { browserPrincipal, publicPairingPaths, registerPairing } from './pairing.js';
import { publicStaticPaths, registerStatic } from './static.js';
import { registerAuthRoutes } from './auth.js';
import { NativeEvidenceService, PairedLiveCheckpointService, type LiveActionAcknowledgement, type PairedLiveCheckpointRuntimePort, type NativeEvidenceRuntimePort } from '../../../packages/application/src/live-checkpoints.js';
import type { LiveCheckpointBinding, PairedLiveResult, PendingLiveAction, NativeEvidenceRuntimeBinding, Phase2GateRuntimeProjection } from '../../../packages/domain/src/live-evidence.js';
import { fileURLToPath } from 'node:url';
import type { SQLiteSessions } from '../../../packages/persistence/src/sessions.js';
import { SQLiteSessions as Sessions } from '../../../packages/persistence/src/sessions.js';
import { openDatabase, readGate, SQLiteMaintenanceStore } from '../../../packages/persistence/src/database.js';
import { SQLiteJobStore } from '../../../packages/persistence/src/claims.js';
import { SQLiteStatusProjectionStore } from '../../../packages/persistence/src/runtime-status.js';
import { SQLiteAccountBindingStore, SQLiteLiveCheckpointStore, SQLiteNativeEvidenceStore, SQLiteProfileOwnershipStore, SQLiteSourceConfigStore, SQLiteSourceObservationStore } from '../../../packages/persistence/src/auth.js';
import { NativeSecretStore } from '../../../packages/platform/src/credentials.js';
import { readInstallation } from '../../../packages/platform/src/installation.js';
import { assertManagedPath, managedPaths } from '../../../packages/platform/src/paths.js';
import { serviceSelection, runtimeIdentity, publishProcess, processProof, type ProcessRecord } from '../../../packages/platform/src/processes.js';
import { DurablePairedLiveAuthority } from './auth.js';
import { assertOwnedLaunchers } from '../../../packages/installer/src/launchers.js';

const liveDigest = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function liveUuid(value: unknown): string {
  const bytes = Buffer.from(liveDigest(value).slice(0, 32), 'hex'); bytes[6] = (bytes[6]! & 0x0f) | 0x40; bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex'); return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Production runtime reads actual durable auth/build/lifecycle state; acknowledgement alone cannot create pass. */
class ProductionLiveCheckpointRuntime implements PairedLiveCheckpointRuntimePort {
  constructor(
    private readonly build: BuildIdentity,
    private readonly installationId: string,
    private readonly generation: number,
    private readonly configs: SourceConfigStore,
    private readonly observations: SourceObservationStore,
    private readonly bindings: AccountBindingStore,
    private readonly ownership: ProfileOwnershipStore,
    private readonly projections: StatusProjectionStore,
  ) {}
  platform() { if (process.platform === 'darwin') return 'macos' as const; if (process.platform === 'win32') return 'windows' as const; throw new ApplicationError('FORBIDDEN'); }
  async prepare(scenario: UatScenario, source: SourceId): Promise<LiveCheckpointBinding> {
    const [config, binding, ownership, status] = await Promise.all([this.configs.read(source), this.bindings.read(), this.ownership.read(), this.projections.read()]);
    if (!config || status.installationId && status.installationId !== this.installationId || !status.manifest ||
        status.manifest.build.buildId !== this.build.buildId || status.manifest.build.version !== this.build.version || status.manifest.evidence !== 'verified_release_manifest') {
      throw Object.assign(new Error('LIVE_ACTION_BUILD_UNCONFIRMED'), { code: 'LIVE_ACTION_BINDING_MISMATCH' });
    }
    if (ownership.state === 'in_use' || ownership.state === 'unconfirmed' || ownership.reservation &&
        (ownership.reservation.installationId !== this.installationId || ownership.reservation.browserBuildId !== this.build.buildId || ownership.reservation.generation !== this.generation)) {
      throw Object.assign(new Error('LIVE_ACTION_PROFILE_UNCONFIRMED'), { code: 'LIVE_ACTION_BINDING_MISMATCH' });
    }
    return {
      buildId: this.build.buildId, artifactId: status.manifest.manifestHash, version: this.build.version, installationId: this.installationId,
      platform: this.platform(), source, scenario, approvedConfigId: config.id, approvedScopeId: config.approvedScopeId,
      bindingFingerprint: liveDigest(binding), generation: this.generation,
      parentCheckpointId: liveUuid([this.installationId, this.build.buildId, this.platform(), 'phase2-live-root']), priorEvidenceEventId: null,
    };
  }
  async current(action: PendingLiveAction): Promise<LiveCheckpointBinding> {
    const current = await this.prepare(action.scenario, action.source);
    return { ...current, parentCheckpointId: action.parentCheckpointId, priorEvidenceEventId: action.priorEvidenceEventId };
  }
  async observe(action: PendingLiveAction, acknowledgement: LiveActionAcknowledgement): Promise<PairedLiveResult | { status: 'human_needed'; resultCode: string; checkedAt: string }> {
    const checkedAt = new Date().toISOString();
    if (acknowledgement === 'human_needed') return { status: 'human_needed', resultCode: 'HUMAN_ACTION_REQUIRED', checkedAt };
    if (acknowledgement === 'failed') return { actionId: action.actionId, status: 'fail', resultCode: 'CHECKPOINT_FAILED', bindingConsistency: 'not_observed', gaps: ['CHECKPOINT_FAILED'], checkedAt, correctionOfEventId: action.priorEvidenceEventId };
    const [observation, binding, status] = await Promise.all([this.observations.read(action.source), this.bindings.read(), this.projections.read()]);
    const issuedAt = Date.parse(action.issuedAt);
    let confirmed = observation?.auth === 'authenticated' && observation.capability === 'available' && observation.health === 'healthy' &&
      observation.freshness === 'fresh' && observation.checkedAt !== null && Date.parse(observation.checkedAt) >= issuedAt;
    if (action.scenario !== 'a.login') confirmed = confirmed && binding.status === 'confirmed' && binding.courseAccess === 'allowed';
    if (action.scenario === 'a.course_visibility') confirmed = confirmed && observation?.courseAccess === 'allowed';
    if (action.scenario === 'b.worker_restart') confirmed = confirmed && status.worker?.checkedAt !== null && status.worker?.checkedAt !== undefined && Date.parse(status.worker.checkedAt) >= issuedAt;
    if (action.scenario === 'c.os_restart') confirmed = confirmed && Date.now() - uptime() * 1000 >= issuedAt;
    if (!confirmed) return { status: 'human_needed', resultCode: 'LIVE_RESULT_NOT_CONFIRMED', checkedAt };
    const resultCode:Record<UatScenario,string>={'a.login':'AUTHENTICATED','a.binding':'BINDING_CONFIRMED','a.course_visibility':'COURSE_VISIBLE','b.reopen_1':'CHECKPOINT_CONFIRMED','b.reopen_2':'CHECKPOINT_CONFIRMED','b.reopen_3':'CHECKPOINT_CONFIRMED','b.worker_restart':'CHECKPOINT_CONFIRMED','b.codex_exit':'B3_COMPLETE','c.os_restart':'CHECKPOINT_CONFIRMED','d.24h_recheck':'CHECKPOINT_CONFIRMED',reauth:'REAUTH_COMPLETE'};
    return { actionId: action.actionId, status: 'pass', resultCode: resultCode[action.scenario], bindingConsistency: 'consistent', gaps: [], checkedAt, correctionOfEventId: action.priorEvidenceEventId };
  }
}

class ProductionNativeEvidenceRuntime implements NativeEvidenceRuntimePort {
  constructor(private readonly build:BuildIdentity,private readonly artifactSha256:string,private readonly manifestSha256:string,private readonly generation:number,private readonly projections:StatusProjectionStore){}
  async current():Promise<NativeEvidenceRuntimeBinding>{
    const status=await this.projections.read(),platform=process.platform==='darwin'?'macos':process.platform==='win32'?'windows':null;
    if(!platform||!status.manifest||status.manifest.build.buildId!==this.build.buildId||status.manifest.manifestHash!==this.manifestSha256||
      status.worker?.health!=='healthy'||status.worker.build?.buildId!==this.build.buildId||status.selfcheck?.featureResult!=='pass'||status.install?.cleanup!=='complete')throw new ApplicationError('FORBIDDEN');
    return{platform,version:this.build.version,buildId:this.build.buildId,artifactSha256:this.artifactSha256,manifestSha256:this.manifestSha256,generation:this.generation,checkedAt:new Date().toISOString()};
  }
}

// Production build replaces this symbol; source tests supply a synthetic identity.
export const API_BUILD_IDENTITY = typeof __AUTOED_BUILD_IDENTITY__ === 'undefined' ? null : __AUTOED_BUILD_IDENTITY__;

export interface ApiOptions {
  host: string; port: number; installationId: string; build: BuildIdentity; secrets: SecretStore; credentials: CredentialRecord[];
  jobs: JobStore; maintenance: MaintenanceStore; projections: StatusProjectionStore; shutdown: () => Promise<void>;
  sessions: SQLiteSessions;
  processRecord?: () => ProcessRecord;
  runtimeGeneration?: number;
  requestLimitNow?: () => number;
  assetsRoot?: string;
  selfcheckCredentials?:SelfcheckCredentials;
  auth?: Omit<AuthControlDependencies, 'installationId' | 'expectedGeneration' | 'outputPolicy'>;
  live?: PairedLiveCheckpointService;
  nativeEvidence?: NativeEvidenceService;
  gateRuntime?: () => Promise<Phase2GateRuntimeProjection>;
}
const JobOutput = z.strictObject({
  id: z.uuid(), request: JobRequestSchema, state: z.enum(['queued','running','retry_wait','succeeded','failed','cancelled']), cancelRequested: z.boolean(), attempt: z.number().int(), maxAttempts: z.number().int(),
  nextRunAt: z.number().nullable(), lease: z.strictObject({ owner: z.string(), fence: z.number(), leaseUntil: z.number() }).nullable(), checkpoint: z.string().nullable(), result: z.string().nullable(), lastSuccessResult: z.string().nullable(), errorCode: z.string().nullable(), generation: z.number().int(), operationId: z.uuid().nullable(), createdAt: z.number(), updatedAt: z.number(),
});
const Accepted = z.strictObject({ accepted: z.literal(true) });
const safeCodes = new Set(['SECRET_STORE_UNAVAILABLE','CREDENTIAL_RECOVERY_REQUIRED','INVALID_CREDENTIAL','FORBIDDEN','UNAUTHORIZED','PAIRING_DENIED','RATE_LIMITED','QUEUE_FULL','GENERATION_MISMATCH','MAINTENANCE_ACTIVE','MAINTENANCE_OWNERSHIP_MISMATCH','IDEMPOTENCY_CONFLICT','JOB_NOT_FOUND','JOBS_NOT_DRAINED','STALE_PROJECTION','FUTURE_OBSERVATION','INVALID_SELFCHECK']);
export async function startApi(options: ApiOptions) {
  if (options.host !== '127.0.0.1' || !Number.isInteger(options.port) || options.port < 0 || options.port > 65535) throw new Error('INVALID_BIND');
  z.uuid().parse(options.installationId);
  if(options.runtimeGeneration!==undefined)z.number().int().nonnegative().parse(options.runtimeGeneration);
  if (options.sessions.installationId !== options.installationId) throw new Error('INVALID_SESSION_SCOPE');
  const app = Fastify({ logger: false, trustProxy: false, bodyLimit: 16384, requestTimeout: 10000, connectionTimeout: 10000 });
  await app.register(cookie);
  let origin = ''; let shutdownRequested = false; const principals = new WeakMap<FastifyRequest, Principal>(); const authLimit = new WindowLimit(30, options.requestLimitNow);
  const policy = new SyntheticOutputPolicy(options.installationId);
  const application = new ApiApplication(options.jobs, options.maintenance, options.projections, policy, async () => { shutdownRequested = true; },options.runtimeGeneration);
  const authApplication = options.auth ? new AuthControlApplication({
    ...options.auth,
    installationId: options.installationId,
    expectedGeneration: options.runtimeGeneration ?? 0,
    outputPolicy: policy,
  }) : null;
  app.addHook('onResponse', async (request, reply) => {
    if (shutdownRequested && request.url === '/api/control/shutdown' && reply.statusCode === 200) {
      shutdownRequested = false;
      // Response must finish before a stop callback can await Fastify.close().
      setImmediate(() => { void options.shutdown().catch(() => { /* Acceptance is not completion; supervisor verifies exit. */ }); });
    }
  });
  const status = new ApplicationStatus(options.projections, policy, API_BUILD_IDENTITY ?? options.build,undefined,options.installationId);
  app.addHook('onRequest', async (request, reply) => {
    reply.header('cache-control', 'no-store').header('x-content-type-options', 'nosniff').header('content-security-policy', "default-src 'self'; frame-ancestors 'none'; object-src 'none'");
    assertTransport(request, origin);
    if (publicStaticPaths.has(request.url) && request.method === 'GET') return;
    if (publicPairingPaths.has(request.url)) return;
    authLimit.take();
    principals.set(request, request.headers.authorization !== undefined || !request.cookies.autoed_session
      ? await authenticate(request, options.installationId, options.credentials, options.secrets, options.maintenance,options.selfcheckCredentials?()=>options.selfcheckCredentials!.current():undefined)
      : browserPrincipal(request, options.sessions, origin));
    if(options.runtimeGeneration!==undefined&&request.url!=='/api/process/inspect'&&request.url!=='/api/control/shutdown'&&(await options.maintenance.read()).generation!==options.runtimeGeneration)throw new ApplicationError('GENERATION_MISMATCH',409);
  });
  app.setErrorHandler((error, request, reply) => {
    const e = error as { code?: string; statusCode?: number };
    const validation = error instanceof z.ZodError || e.code?.startsWith('FST_ERR_CTP_');
    if (request.url.startsWith('/api/auth/')) {
      const safe = toSafeAuthApiError(error);
      const statusCode = validation ? e.statusCode === 413 ? 413 : 400 : e.statusCode === 503 ? 503 : safe.code === 'INTERNAL_ERROR' ? 500 : e.statusCode ?? 403;
      return reply.code(statusCode).send(safe);
    }
    const code = validation ? 'INVALID_REQUEST' : e.code && safeCodes.has(e.code) ? e.code : 'INTERNAL_ERROR';
    reply.code(validation ? e.statusCode === 413 ? 413 : 400 : code === 'INTERNAL_ERROR' ? 500 : e.statusCode ?? 403).send({ code, stage: 'api', nextAction: code === 'SECRET_STORE_UNAVAILABLE' ? 'human_os_authorization_required' : code === 'CREDENTIAL_RECOVERY_REQUIRED' ? 'preserve_exact_receipt_for_human_recovery' : 'retry_or_check_local_service' });
  });
  app.setNotFoundHandler((request, reply) => request.url.startsWith('/api/auth/')
    ? reply.code(404).send({ code: 'INVALID_REQUEST', stage: 'auth_api', nextAction: 'retry_or_check_local_service' })
    : reply.code(404).send({ code: 'NOT_FOUND', stage: 'api', nextAction: 'use_registered_endpoint' }));
  const principal = (request: FastifyRequest) => { const p = principals.get(request); if (!p) throw new ApplicationError('UNAUTHORIZED', 401); return p; };
  registerPairing(app, options.sessions, () => origin, principal, policy);
  registerAuthRoutes(app, { application: authApplication, liveApplication: options.live ?? null, nativeEvidenceApplication:options.nativeEvidence??null,gateRuntime:options.gateRuntime??null,expectedGeneration: options.runtimeGeneration ?? 0, principal });
  registerStatic(app, options.assetsRoot);
  app.get('/api/status', async request => StatusSchema.parse(await status.read(principal(request))));
  app.post('/api/client/identity',async request=>{
    await authorize(policy,principal(request),'status:read','status');
    if(!options.processRecord)throw new ApplicationError('FORBIDDEN');
    return clientIdentityProof(options.secrets,authenticatedRecord(request),options.installationId,API_BUILD_IDENTITY??options.build,options.processRecord().nonce,request.body);
  });
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
  app.post('/api/control/selfcheck-credential',async request=>{
    await authorize(policy,principal(request),'installer','status');if(!options.selfcheckCredentials)throw new ApplicationError('FORBIDDEN');
    const input=SelfcheckCredentialInput.parse(request.body);
    if(input.action==='issue'&&options.runtimeGeneration!==undefined&&input.generation!==options.runtimeGeneration)throw new ApplicationError('GENERATION_MISMATCH',409);
    try{return input.action==='issue'?await options.selfcheckCredentials.issue(input.operationId,input.generation,input.expiresAt):await options.selfcheckCredentials.revoke(input.operationId,input.generation);}
    catch(error){const code=error instanceof Error?error.message:'';if(['GENERATION_MISMATCH','SECRET_STORE_UNAVAILABLE','CREDENTIAL_RECOVERY_REQUIRED','INVALID_CREDENTIAL'].includes(code))throw new ApplicationError(code,409);throw error;}
  });
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
  const secrets=new NativeSecretStore();const maintenance=new SQLiteMaintenanceStore(db);
  const sourceConfigs=new SQLiteSourceConfigStore(db),observations=new SQLiteSourceObservationStore(db),bindings=new SQLiteAccountBindingStore(db),ownership=new SQLiteProfileOwnershipStore(db);
  const liveStore=new SQLiteLiveCheckpointStore(db),liveAuthority=new DurablePairedLiveAuthority(secrets,metadata.installationId);
  const live=new PairedLiveCheckpointService(liveStore,liveAuthority,
    new ProductionLiveCheckpointRuntime(API_BUILD_IDENTITY,metadata.installationId,context.expectedGeneration,sourceConfigs,observations,bindings,ownership,projections),context);
  const active=assertOwnedLaunchers(launch.selection);if(!active.artifactSha256)throw new Error('ACTIVE_ARTIFACT_IDENTITY_MISSING');const nativeStore=new SQLiteNativeEvidenceStore(db),nativeRuntime=new ProductionNativeEvidenceRuntime(API_BUILD_IDENTITY,active.artifactSha256,active.manifestHash,context.expectedGeneration,projections),nativeEvidence=new NativeEvidenceService(nativeStore,nativeRuntime,context);
  const gateRuntime=async():Promise<Phase2GateRuntimeProjection>=>{const current=await nativeRuntime.current(),ids=await nativeEvidence.listPassed(current.buildId,current.generation);return{schema:1,platform:current.platform,version:current.version,buildId:current.buildId,artifactSha256:current.artifactSha256,manifestSha256:current.manifestSha256,runtimeGeneration:current.generation,phase1:'partial',api:'healthy',worker:'healthy',pairedUi:'ready',cleanup:'complete',checkedAt:current.checkedAt,buildObligations:ids.map(id=>({id,status:'pass',buildId:current.buildId,generation:current.generation}))};};
  const service=await startApi({host:'127.0.0.1',port:metadata.port,installationId:metadata.installationId,build:API_BUILD_IDENTITY,secrets,credentials:metadata.credentials,
    jobs:new SQLiteJobStore(db),maintenance,projections,sessions:new Sessions(db,metadata.installationId),selfcheckCredentials:new SelfcheckCredentials(launch.selection,secrets,maintenance),
    processRecord:()=>record,runtimeGeneration:context.expectedGeneration,shutdown:()=>stop(),assetsRoot:fileURLToPath(new URL('../../status/',import.meta.url)),live,nativeEvidence,gateRuntime});
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
