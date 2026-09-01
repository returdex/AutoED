import { z } from 'zod';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type {
  AccountBindingStore,
  EvidenceLedger,
  JobStore,
  MaintenanceStore,
  OutputPolicy,
  SourceConfigStore,
  SourceObservationStore,
  StatusProjectionStore,
} from './ports.js';
import type {
  AccountBinding,
  ApprovedSourceConfig,
  EvidenceCellKey,
  OutputDestination,
  OutputOperation,
  ProtectedSourceIdentity,
  Scope,
  SourceId,
  WriteContext,
} from '../../domain/src/model.js';
import {
  AccountBindingSchema,
  ApprovedSourceConfigSchema,
  ComponentObservationSchema,
  EvidenceCellKeySchema,
  InstallProjectionSchema,
  JobRequestSchema,
  ManifestObservationSchema,
  OutputDestinationSchema,
  OutputOperationSchema,
  ScopeSchema,
  SelfcheckProjectionSchema,
} from '../../contracts/src/index.js';
import {
  AuthActionAcceptedSchema,
  presentEvidenceReceipts,
  presentProtectedAuthStatus,
  presentRedactedAuthStatus,
  SafeAuthApiErrorSchema,
  type AuthActionAccepted,
  type AuthStatusPresentationInput,
  type SafeAuthApiError,
  type SafeAuthErrorCode,
} from '../../contracts/src/presentation.js';
import type { AuthJobService, AuthProbeCommand } from './auth-jobs.js';
import { Jobs } from './jobs.js';
import {sameIdentity} from './identity.js';

export class ApplicationError extends Error {
  constructor(public readonly code: string, public readonly statusCode = 403) { super(code); }
}
export type Permission =
  | 'status:read'
  | 'jobs:read'
  | 'jobs:write'
  | 'jobs:selfcheck'
  | 'control:shutdown'
  | 'installer'
  | 'pairing:approve'
  | 'auth:read'
  | 'auth:receipts:read'
  | 'auth:configuration:write'
  | 'auth:login:write'
  | 'auth:probe:write'
  | 'auth:logout:write'
  | 'auth:binding:write'
  | 'auth:native-evidence:write';
export interface Principal {
  scope: Scope;
  destination: OutputDestination;
  permissions: readonly Permission[];
  selfcheck?: { operationId: string; generation: number };
  /** Set only by SQLiteSessions authentication; never accepted from a bearer or request body. */
  browserSessionId?: string;
}
export class SyntheticOutputPolicy implements OutputPolicy {
  constructor(private readonly installationId: string, private readonly destinations: readonly OutputDestination[] = ['local_ui', 'local_cli', 'model']) {}
  async authorize(scope: Scope, operation: OutputOperation, destination: OutputDestination) {
    if (!ScopeSchema.safeParse(scope).success || scope.installationId !== this.installationId) return { allowed: false, reason: 'scope_denied' as const };
    if (!OutputDestinationSchema.safeParse(destination).success || !this.destinations.includes(destination)) return { allowed: false, reason: 'destination_denied' as const };
    if (!OutputOperationSchema.safeParse(operation).success) return { allowed: false, reason: 'rights_unknown' as const };
    return { allowed: true, reason: 'allowed' as const };
  }
}
/** Source strings are inert text, never paths or tool instructions. */
export function redactText(value: string): string {
  return value.replace(/(?:\/(?:Users|home|tmp|private|var|Volumes)\/|[A-Za-z]:[\\/])[^\s"'<>]*/g, '[redacted-path]')
    .replace(/(^|[\s"'(])\/[^\s"'<>]+/g, '$1[redacted-path]')
    .replace(/(?:bearer\s+|(?:token|password|cookie|secret|authorization)\s*[:=]\s*)[^\s"'<>]+/gi, '[redacted-secret]')
    .replace(/(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/g, '[redacted-secret]');
}
export function redactOutput<T>(value: T): T {
  if (typeof value === 'string') return redactText(value) as T;
  if (Array.isArray(value)) return value.map(redactOutput) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactOutput(item)])) as T;
  return value;
}
export async function authorize(policy: OutputPolicy, principal: Principal, permission: Permission, operation: OutputOperation, scope = principal.scope): Promise<void> {
  if (!principal.permissions.includes(permission) || scope.installationId !== principal.scope.installationId || !(await policy.authorize(scope, operation, principal.destination)).allowed) throw new ApplicationError('FORBIDDEN');
}

export interface OfficialLoginLauncher {
  open(input: { source: SourceId; approvedConfigId: string; actionReceiptId: string }, signal: AbortSignal): Promise<void>;
}

export interface ProtectedAuthIdentityReader {
  read(source: SourceId): Promise<ProtectedSourceIdentity | null>;
}

export interface AuthControlDependencies {
  installationId: string;
  expectedGeneration: number;
  sourceConfigs: SourceConfigStore;
  observations: SourceObservationStore;
  bindings: AccountBindingStore;
  evidence: EvidenceLedger;
  authJobs: Pick<AuthJobService, 'requestProbe' | 'recordExplicitLogout' | 'query' | 'cancel'>;
  login: OfficialLoginLauncher;
  protectedIdentities: ProtectedAuthIdentityReader;
  outputPolicy?: OutputPolicy;
}

const sourceIdSchema = z.enum(['moodle', 'edstem']);
const configurationInputSchema = z.strictObject({ config: ApprovedSourceConfigSchema });
const loginInputSchema = z.strictObject({ source: sourceIdSchema, approvedConfigId: z.uuid() });
const probeInputSchema: z.ZodType<AuthProbeCommand> = z.strictObject({
  source: sourceIdSchema,
  approvedConfigId: z.uuid(),
  approvedScopeId: z.uuid(),
  trigger: z.enum(['background', 'user_login_completed', 'manual_retry']),
  idempotencyKey: z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/),
});
const logoutInputSchema = z.strictObject({ source: sourceIdSchema, acknowledged: z.literal(true) });
const bindingInputSchema = z.strictObject({ candidateBindingId: z.uuid(), decision: z.enum(['confirm', 'reject']) });

function uuidFromDigest(value: Buffer): string {
  const bytes = Buffer.from(value.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function bindingCandidateValue(binding: AccountBinding): string {
  if (binding.status !== 'candidate' || !binding.moodle || !binding.edstem) throw new ApplicationError('BINDING_CANDIDATE_REQUIRED', 409);
  return JSON.stringify([
    binding.moodle.subjectFingerprint,
    binding.moodle.organizationFingerprint,
    binding.moodle.tenantFingerprint,
    binding.moodle.approvedScopeId,
    binding.edstem.subjectFingerprint,
    binding.edstem.organizationFingerprint,
    binding.edstem.tenantFingerprint,
    binding.edstem.approvedScopeId,
    binding.checkedAt,
  ]);
}

const SAFE_AUTH_CODES = new Set<SafeAuthErrorCode>([
  'AUTHENTICATED', 'NOT_OBSERVED', 'AUTH_REQUIRED', 'REAUTH_REQUIRED', 'NETWORK_UNAVAILABLE', 'PARSER_CHANGED',
  'CAPABILITY_DENIED', 'IDENTITY_MISMATCH', 'PROFILE_IN_USE', 'PROFILE_OWNERSHIP_UNCONFIRMED',
  'CONFIGURATION_CONFIRMED', 'LOGIN_OPENED', 'PROBE_ACCEPTED', 'LOGOUT_RECORDED', 'BINDING_CONFIRMED',
  'BINDING_REJECTED', 'INVALID_REQUEST', 'CONFIGURATION_MISMATCH', 'SCOPE_MISMATCH', 'FORBIDDEN',
  'UNAUTHORIZED', 'PAIRING_DENIED', 'UNKNOWN_SOURCE_ERROR', 'INTERNAL_ERROR',
]);

export function toSafeAuthApiError(error: unknown): SafeAuthApiError {
  let code: SafeAuthErrorCode = 'INTERNAL_ERROR';
  if (error instanceof z.ZodError) code = 'INVALID_REQUEST';
  else if (error instanceof ApplicationError && SAFE_AUTH_CODES.has(error.code as SafeAuthErrorCode)) code = error.code as SafeAuthErrorCode;
  else if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^(?:UNKNOWN_(?:SOURCE|ADAPTER)|SOURCE_)/.test(error.code)) code = 'UNKNOWN_SOURCE_ERROR';
  const nextAction: SafeAuthApiError['nextAction'] = code === 'UNAUTHORIZED' || code === 'PAIRING_DENIED'
    ? 'pair_local_browser'
    : code === 'CONFIGURATION_MISMATCH' || code === 'SCOPE_MISMATCH'
      ? 'confirm_configuration'
      : code === 'AUTH_REQUIRED' || code === 'REAUTH_REQUIRED'
        ? 'reauthenticate'
        : code === 'PROFILE_IN_USE' || code === 'PROFILE_OWNERSHIP_UNCONFIRMED'
          ? 'human_action_required'
          : 'retry_or_check_local_service';
  return SafeAuthApiErrorSchema.parse({ code, stage: 'auth_api', nextAction });
}

/**
 * Fixed auth control facade. It accepts only strict source/config/scope references and delegates to narrow ports;
 * it never accepts browser instructions, source URLs, selectors, retry schedules or evidence authority.
 */
export class AuthControlApplication {
  private readonly policy: OutputPolicy;
  private readonly candidateKey = randomBytes(32);

  constructor(private readonly dependencies: AuthControlDependencies) {
    z.uuid().parse(dependencies.installationId);
    z.number().int().nonnegative().parse(dependencies.expectedGeneration);
    this.policy = dependencies.outputPolicy ?? new SyntheticOutputPolicy(dependencies.installationId);
  }

  private context(): WriteContext {
    return { expectedGeneration: this.dependencies.expectedGeneration };
  }

  private async admit(principal: Principal, permission: Permission, mutation = false): Promise<void> {
    if (principal.scope.installationId !== this.dependencies.installationId || mutation && principal.destination !== 'local_ui') throw new ApplicationError('FORBIDDEN');
    await authorize(this.policy, principal, permission, 'status');
  }

  private async requireConfig(source: SourceId, approvedConfigId: string, approvedScopeId?: string): Promise<ApprovedSourceConfig> {
    const config = await this.dependencies.sourceConfigs.read(source);
    if (!config || config.id !== approvedConfigId || config.source !== source) throw new ApplicationError('CONFIGURATION_MISMATCH', 409);
    if (approvedScopeId !== undefined && config.approvedScopeId !== approvedScopeId) throw new ApplicationError('SCOPE_MISMATCH', 409);
    return ApprovedSourceConfigSchema.parse(config);
  }

  private candidateId(binding: AccountBinding): string {
    const canonical = bindingCandidateValue(binding);
    return uuidFromDigest(createHash('sha256').update(this.candidateKey).update('\0').update(canonical).digest());
  }

  private accepted(actionReceiptId: string, resultCode: SafeAuthErrorCode): AuthActionAccepted {
    return AuthActionAcceptedSchema.parse({ accepted: true, actionReceiptId, resultCode });
  }

  async confirmConfiguration(principal: Principal, input: unknown): Promise<AuthActionAccepted> {
    const { config } = configurationInputSchema.parse(input);
    await this.admit(principal, 'auth:configuration:write', true);
    const binding = AccountBindingSchema.parse(await this.dependencies.bindings.read());
    if (binding.status === 'identity_mismatch') throw new ApplicationError('IDENTITY_MISMATCH', 409);
    await this.dependencies.sourceConfigs.confirm(config, this.context());
    return this.accepted(randomUUID(), 'CONFIGURATION_CONFIRMED');
  }

  async openLogin(
    principal: Principal,
    input: unknown,
    actionReceiptId: string,
    signal: AbortSignal,
  ): Promise<AuthActionAccepted> {
    const value = loginInputSchema.parse(input);
    const receiptId = z.uuid().parse(actionReceiptId);
    await this.admit(principal, 'auth:login:write', true);
    await this.requireConfig(value.source, value.approvedConfigId);
    if (signal.aborted) throw new ApplicationError('INTERNAL_ERROR', 409);
    await this.dependencies.login.open({ ...value, actionReceiptId: receiptId }, signal);
    return this.accepted(receiptId, 'LOGIN_OPENED');
  }

  async requestProbe(principal: Principal, input: unknown): Promise<AuthActionAccepted> {
    const value = probeInputSchema.parse(input);
    await this.admit(principal, 'auth:probe:write', true);
    await this.requireConfig(value.source, value.approvedConfigId, value.approvedScopeId);
    const result = await this.dependencies.authJobs.requestProbe(value, this.context());
    return this.accepted(z.uuid().parse(result.jobId), 'PROBE_ACCEPTED');
  }

  async recordLogoutIntent(principal: Principal, input: unknown): Promise<AuthActionAccepted> {
    const value = logoutInputSchema.parse(input);
    await this.admit(principal, 'auth:logout:write', true);
    await this.dependencies.authJobs.recordExplicitLogout(value.source, this.context());
    return this.accepted(randomUUID(), 'LOGOUT_RECORDED');
  }

  async confirmBinding(principal: Principal, input: unknown): Promise<AuthActionAccepted> {
    const value = bindingInputSchema.parse(input);
    await this.admit(principal, 'auth:binding:write', true);
    const binding = AccountBindingSchema.parse(await this.dependencies.bindings.read());
    if (value.candidateBindingId !== this.candidateId(binding)) throw new ApplicationError('FORBIDDEN');
    if (value.decision === 'reject') return this.accepted(value.candidateBindingId, 'BINDING_REJECTED');
    const confirmed = AccountBindingSchema.parse({
      ...binding,
      status: 'confirmed',
      basis: 'human_confirmed',
      confirmedByActionReceiptId: value.candidateBindingId,
      courseAccess: 'allowed',
    });
    await this.dependencies.bindings.write(confirmed, this.context());
    return this.accepted(value.candidateBindingId, 'BINDING_CONFIRMED');
  }

  async readStatus(principal: Principal) {
    await this.admit(principal, 'auth:read');
    const sourceValues = await Promise.all((['moodle', 'edstem'] as const).map(async source => ({
      source,
      config: await this.dependencies.sourceConfigs.read(source),
      observation: await this.dependencies.observations.read(source),
      identity: principal.destination === 'local_ui' ? await this.dependencies.protectedIdentities.read(source) : null,
    })));
    const binding = AccountBindingSchema.parse(await this.dependencies.bindings.read());
    const sources = Object.fromEntries(sourceValues.map(value => [value.source, {
      config: value.config,
      observation: value.observation,
      identity: value.identity,
      sharedProfile: 'unverified' as const,
    }])) as AuthStatusPresentationInput['sources'];
    const gaps = [
      'WINDOWS_NOT_RUN',
      'LIVE_NOT_RUN',
      ...sourceValues.filter(value => value.config === null).map(value => `${value.source.toUpperCase()}_CONFIGURATION_NOT_CONFIRMED`),
      ...sourceValues.filter(value => value.observation === null).map(value => `${value.source.toUpperCase()}_NOT_OBSERVED`),
    ];
    let nextAction: AuthStatusPresentationInput['nextAction'] = { kind: 'none' };
    const login = sourceValues.find(value => value.config && value.observation?.auth !== 'authenticated');
    if (binding.status === 'identity_mismatch') nextAction = { kind: 'wait' };
    else if (login?.config) nextAction = { kind: 'open_login', source: login.source, approvedConfigId: login.config.id, approvedScopeId: login.config.approvedScopeId };
    else if (binding.status === 'candidate') nextAction = { kind: 'confirm_binding', candidateBindingId: this.candidateId(binding) };
    const input: AuthStatusPresentationInput = { sources, binding, gaps, nextAction };
    return principal.destination === 'local_ui'
      ? presentProtectedAuthStatus(input, { destination: 'local_ui', paired: true })
      : presentRedactedAuthStatus(input, { destination: principal.destination });
  }

  async readReceipts(principal: Principal, input: unknown) {
    const key: EvidenceCellKey = EvidenceCellKeySchema.parse(input);
    await this.admit(principal, 'auth:receipts:read');
    const [receipts, binding] = await Promise.all([this.dependencies.evidence.list(key, this.dependencies.expectedGeneration), this.dependencies.bindings.read()]);
    return presentEvidenceReceipts(receipts, binding);
  }
}

const generation = z.number().int().nonnegative();
const MaintenanceInput = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('enter'), operationId: z.uuid(), expectedGeneration: generation, leaseUntil: z.number().int().nonnegative() }),
  z.strictObject({ action: z.enum(['exclusive', 'exit']), operationId: z.uuid(), expectedGeneration: generation }),
]);
const ProjectionInput = z.discriminatedUnion('kind', [
  z.strictObject({kind:z.literal('manifest'),operationId:z.uuid().nullable(),expectedGeneration:generation,value:ManifestObservationSchema}),
  z.strictObject({ kind: z.literal('component'), operationId: z.uuid().nullable(), expectedGeneration: generation, value: ComponentObservationSchema }),
  z.strictObject({ kind: z.literal('install'), operationId: z.uuid().nullable(), expectedGeneration: generation, value: InstallProjectionSchema }),
  z.strictObject({ kind: z.literal('selfcheck'), operationId: z.uuid().nullable(), expectedGeneration: generation, value: SelfcheckProjectionSchema }),
]);
/** All application admission lives here, independent of HTTP or SQLite drivers. */
export class ApiApplication {
  private readonly jobs: Jobs;
  constructor(private readonly store: JobStore, private readonly maintenance: MaintenanceStore, private readonly projections: StatusProjectionStore, readonly policy: OutputPolicy, private readonly stop: () => Promise<void>, private readonly runtimeGeneration?: number) { this.jobs = new Jobs(store); }
  private async context(principal: Principal): Promise<WriteContext> {
    const gate = await this.maintenance.read();
    const expectedGeneration=this.runtimeGeneration ?? principal.selfcheck?.generation ?? gate.generation;
    if(principal.selfcheck&&principal.selfcheck.generation!==expectedGeneration)throw new ApplicationError('GENERATION_MISMATCH',409);
    // Immutable runtime generation reaches the SQLite transaction, closing the
    // race between HTTP admission and a maintenance generation change.
    return { expectedGeneration, ...(principal.selfcheck ? { selfcheck: principal.selfcheck } : {}) };
  }
  async enqueue(principal: Principal, input: unknown) {
    const request = JobRequestSchema.parse(input);
    await authorize(this.policy, principal, principal.selfcheck ? 'jobs:selfcheck' : 'jobs:write', 'selftest', request.scope);
    return redactOutput(await this.jobs.enqueue(request, await this.context(principal)));
  }
  async query(principal: Principal, id: string) {
    await authorize(this.policy, principal, 'jobs:read', 'job_read');
    if (principal.destination === 'local_ui' && (await this.projections.read()).selfcheck?.jobId !== id) throw new ApplicationError('FORBIDDEN');
    const job = await this.jobs.query(z.uuid().parse(id), principal.scope);
    if (!job || principal.selfcheck && job.operationId !== principal.selfcheck.operationId) throw new ApplicationError('JOB_NOT_FOUND', 404);
    return redactOutput(job);
  }
  async cancel(principal: Principal, id: string, input: unknown) {
    z.strictObject({}).parse(input); await authorize(this.policy, principal, 'jobs:write', 'selftest');
    return redactOutput(await this.jobs.cancel(z.uuid().parse(id), principal.scope, await this.context(principal)));
  }
  async shutdown(principal: Principal, input: unknown) {
    z.strictObject({}).parse(input); await authorize(this.policy, principal, 'control:shutdown', 'status'); await this.stop(); return { accepted: true as const };
  }
  async maintain(principal: Principal, input: unknown) {
    await authorize(this.policy, principal, 'installer', 'status'); const value = MaintenanceInput.parse(input);
    if(this.runtimeGeneration!==undefined&&value.expectedGeneration!==this.runtimeGeneration)throw new ApplicationError('GENERATION_MISMATCH',409);
    if (value.action === 'enter') return this.maintenance.enterMaintenance({ ...value, owner: 'installer' });
    return value.action === 'exclusive' ? this.maintenance.markExclusive(value.operationId, value.expectedGeneration) : this.maintenance.exitMaintenance(value.operationId, value.expectedGeneration);
  }
  async project(principal: Principal, input: unknown) {
    await authorize(this.policy, principal, 'installer', 'status'); const value = ProjectionInput.parse(input);
    if(this.runtimeGeneration!==undefined&&value.expectedGeneration!==this.runtimeGeneration)throw new ApplicationError('GENERATION_MISMATCH',409);
    const context = { operationId: value.operationId, expectedGeneration: value.expectedGeneration };
    if (value.kind === 'manifest') await this.projections.writeManifest(value.value,context);
    else if (value.kind === 'install') {
      if(value.value.result==='succeeded'){
        const status=await this.projections.read(),check=status.selfcheck;
        const job=check?.jobId?await this.store.query(check.jobId,principal.scope):null;
        if(value.operationId!==null||!status.manifest||!sameIdentity(status.manifest.build,value.value.targetBuild)||check?.featureResult!=='pass'||!check.probes.every(p=>sameIdentity(p.build,value.value.targetBuild))||!job||job.state!=='succeeded'||job.generation!==value.expectedGeneration||job.operationId!==null)throw new ApplicationError('INVALID_SELFCHECK',409);
      }
      await this.projections.writeInstall(value.value, context);
    }
    else if (value.kind === 'component') await this.projections.writeComponent(value.value, context);
    else {
      if (value.value.featureResult === 'pass') {
        const manifest=(await this.projections.read()).manifest;
        if(!manifest||!value.value.probes.every(p=>sameIdentity(p.build,manifest.build)))throw new ApplicationError('INVALID_SELFCHECK',409);
        const job = value.value.jobId ? await this.store.query(value.value.jobId, principal.scope) : null;
        if (!job || job.state !== 'succeeded' || job.operationId !== value.operationId || job.generation !== value.expectedGeneration) throw new ApplicationError('INVALID_SELFCHECK', 409);
      }
      await this.projections.writeSelfcheck(value.value, context);
    }
    return { accepted: true as const };
  }
}
