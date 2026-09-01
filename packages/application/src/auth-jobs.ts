import { z } from 'zod';
import type {
  SourceId,
  SourceLastSuccess,
  SourceProbeRequest,
  SourceProbeResult,
  WriteContext,
} from '../../domain/src/model.js';
import { AUTH_RECOVERY_DELAYS_MS, createAuthFlowState, reduceAuthFlow, type AuthFlowState, type AuthTransition } from './auth.js';
import type { SourceProbePort } from './ports.js';

export type PublicAuthProbeTrigger = 'background' | 'user_login_completed' | 'manual_retry';
export interface AuthProbeCommand {
  source: SourceId;
  approvedConfigId: string;
  approvedScopeId: string;
  trigger: PublicAuthProbeTrigger;
  idempotencyKey: string;
}

type InternalAuthProbeTrigger = PublicAuthProbeTrigger | 'recovery' | 'moodle_reauth_follow_up';
export type AuthJobState = 'queued' | 'running' | 'retry_wait' | 'succeeded' | 'failed' | 'cancelled' | 'human_needed';
export interface AuthJobLease {
  owner: string;
  fence: number;
  generation: number;
  leaseUntil: string;
}
export type AuthJobResultCode =
  | 'authenticated'
  | 'network_unavailable'
  | 'parser_changed'
  | 'permission_denied'
  | 'authentication_required'
  | 'reauth_required'
  | 'interaction_required'
  | 'mfa_required'
  | 'identity_mismatch'
  | 'not_observed'
  | 'cancelled'
  | 'lease_expired';

export interface AuthJob {
  id: string;
  source: SourceId;
  action: 'moodle.auth_probe' | 'edstem.auth_probe';
  approvedConfigId: string;
  approvedScopeId: string;
  trigger: InternalAuthProbeTrigger;
  idempotencyKey: string;
  state: AuthJobState;
  attempt: number;
  recoveryStartedAt: string | null;
  nextRunAt: string | null;
  cancelRequested: boolean;
  lease: AuthJobLease | null;
  generation: number;
  resultCode: AuthJobResultCode | null;
  lastSuccess: SourceLastSuccess | null;
  parentJobId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthJobStore {
  enqueue(command: AuthProbeCommand, context: WriteContext): Promise<AuthJob>;
  claim(input: { owner: string; now: string; leaseMs: number }, context: WriteContext): Promise<AuthJob | null>;
  assertCurrent(jobId: string, lease: AuthJobLease, now: string, context: WriteContext): Promise<AuthJob>;
  heartbeat(jobId: string, lease: AuthJobLease, now: string, leaseMs: number, context: WriteContext): Promise<AuthJobLease>;
  commitTransition(jobId: string, lease: AuthJobLease, transition: AuthTransition, now: string, context: WriteContext): Promise<AuthJob>;
  requestCancel(jobId: string, source: SourceId, context: WriteContext): Promise<AuthJob>;
  cancelSourceForLogout(source: SourceId, context: WriteContext): Promise<void>;
  acknowledgeCancel(jobId: string, lease: AuthJobLease, context: WriteContext): Promise<AuthJob>;
  recoverExpired(now: string, context: WriteContext): Promise<number>;
  get(jobId: string, source: SourceId): Promise<AuthJob | null>;
}

const commandSchema: z.ZodType<AuthProbeCommand> = z.strictObject({
  source: z.enum(['moodle', 'edstem']),
  approvedConfigId: z.uuid(),
  approvedScopeId: z.uuid(),
  trigger: z.enum(['background', 'user_login_completed', 'manual_retry']),
  idempotencyKey: z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/),
});
const sourceSchema = z.enum(['moodle', 'edstem']);

function action(source: SourceId): AuthJob['action'] {
  return source === 'moodle' ? 'moodle.auth_probe' : 'edstem.auth_probe';
}

export class AuthJobService {
  constructor(private readonly store: AuthJobStore) {}
  async requestProbe(input: AuthProbeCommand, context: WriteContext): Promise<{ jobId: string }> {
    const command = commandSchema.parse(input);
    const job = await this.store.enqueue(command, context);
    return { jobId: job.id };
  }
  async recordExplicitLogout(input: SourceId, context: WriteContext): Promise<AuthFlowState> {
    const source = sourceSchema.parse(input);
    const transition = reduceAuthFlow(createAuthFlowState(), { type: 'explicit_logout', source });
    await this.store.cancelSourceForLogout(source, context);
    return transition.state;
  }
  cancel(jobId: string, input: SourceId, context: WriteContext): Promise<AuthJob> {
    return this.store.requestCancel(z.uuid().parse(jobId), sourceSchema.parse(input), context);
  }
  query(jobId: string, input: SourceId): Promise<AuthJob | null> {
    return this.store.get(z.uuid().parse(jobId), sourceSchema.parse(input));
  }
}

interface RunnerClock { now(): string }
export interface AuthJobRunnerOptions {
  clock?: RunnerClock;
  leaseMs?: number;
  heartbeatMs?: number;
}

function errorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') return error.code;
  return error instanceof Error ? error.message : 'NOT_OBSERVED';
}

function failureResult(job: AuthJob, code: string, checkedAt: string): {
  result: SourceProbeResult;
  interactionRequired: boolean;
  resultCode?: 'INTERACTION_REQUIRED';
  safeResultCode?: 'interaction_required' | 'mfa_required';
} {
  const interactionRequired = code === 'INTERACTION_REQUIRED' || code === 'MFA_REQUIRED';
  const resultCode = code === 'NETWORK_UNAVAILABLE' ? 'NETWORK_UNAVAILABLE'
    : code === 'CAPABILITY_DENIED' || code === 'PERMISSION_DENIED' ? 'CAPABILITY_DENIED'
      : code === 'AUTH_REQUIRED' ? 'AUTH_REQUIRED'
        : code === 'REAUTH_REQUIRED' || interactionRequired ? 'REAUTH_REQUIRED'
          : code === 'IDENTITY_MISMATCH' ? 'IDENTITY_MISMATCH'
            : code === 'PARSER_CHANGED' ? 'PARSER_CHANGED' : 'NOT_OBSERVED';
  const request: SourceProbeRequest = {
    source: job.source,
    action: action(job.source),
    approvedConfigId: job.approvedConfigId,
    approvedScopeId: job.approvedScopeId,
  };
  return {
    result: {
      request,
      observation: {
        source: job.source,
        auth: resultCode === 'AUTH_REQUIRED' ? 'unauthenticated' : resultCode === 'REAUTH_REQUIRED' ? 'reauth_required' : resultCode === 'IDENTITY_MISMATCH' ? 'identity_mismatch' : 'not_observed',
        capability: resultCode === 'CAPABILITY_DENIED' ? 'denied' : 'unknown',
        health: resultCode === 'NETWORK_UNAVAILABLE' ? 'error' : resultCode === 'PARSER_CHANGED' ? 'degraded' : 'healthy',
        freshness: 'stale',
        completeness: 'partial',
        outcome: 'error',
        checkedAt,
        resultCode,
        courseAccess: 'blocked',
        lastSuccess: job.lastSuccess,
      },
      identity: null,
      selectedCourseVisible: null,
    },
    interactionRequired,
    ...(interactionRequired ? { resultCode: 'INTERACTION_REQUIRED' as const } : {}),
    ...(code === 'MFA_REQUIRED' ? { safeResultCode: 'mfa_required' as const }
      : code === 'INTERACTION_REQUIRED' ? { safeResultCode: 'interaction_required' as const } : {}),
  };
}

function stateFor(job: AuthJob): AuthFlowState {
  const state = createAuthFlowState();
  const slot = state.sources[job.source];
  slot.recoveryAttempt = Math.min(job.attempt, AUTH_RECOVERY_DELAYS_MS.length) as 0 | 1 | 2 | 3;
  slot.observation.lastSuccess = job.lastSuccess;
  return state;
}

export class AuthJobRunner {
  private readonly clock: RunnerClock;
  private readonly leaseMs: number;
  private readonly heartbeatMs: number;
  private active: AbortController | null = null;

  constructor(private readonly store: AuthJobStore, private readonly probes: SourceProbePort, options: AuthJobRunnerOptions = {}) {
    this.clock = options.clock ?? { now: () => new Date().toISOString() };
    this.leaseMs = options.leaseMs ?? 30_000;
    this.heartbeatMs = options.heartbeatMs ?? 5_000;
    if (!Number.isSafeInteger(this.leaseMs) || this.leaseMs < 1 || this.leaseMs > 30_000 ||
        !Number.isSafeInteger(this.heartbeatMs) || this.heartbeatMs < 1 || this.heartbeatMs > this.leaseMs) throw new Error('INVALID_AUTH_RUNNER_TIMING');
  }

  stop(): void { this.active?.abort(); }

  async runOnce(owner: string, context: WriteContext): Promise<AuthJob | null> {
    await this.store.recoverExpired(this.clock.now(), context);
    const claimed = await this.store.claim({ owner, now: this.clock.now(), leaseMs: this.leaseMs }, context);
    if (!claimed) return null;
    if (!claimed.lease) throw new Error('AUTH_LEASE_REQUIRED');
    let lease = claimed.lease;
    const controller = new AbortController();
    this.active = controller;
    let heartbeatError: unknown;
    let heartbeat: Promise<void> | null = null;
    const timer = setInterval(() => {
      if (heartbeat || controller.signal.aborted) return;
      heartbeat = this.store.heartbeat(claimed.id, lease, this.clock.now(), this.leaseMs, context)
        .then(next => { lease = next; })
        .catch(error => { heartbeatError = error; controller.abort(); })
        .finally(() => { heartbeat = null; });
    }, this.heartbeatMs);
    timer.unref();
    try {
      // First authority gate: no source request is permitted after cancellation or stale authority.
      await this.store.assertCurrent(claimed.id, lease, this.clock.now(), context);
      let probeResult: SourceProbeResult;
      let interactionRequired = false;
      let override: 'INTERACTION_REQUIRED' | undefined;
      let safeResultCode: 'interaction_required' | 'mfa_required' | undefined;
      try {
        probeResult = await this.probes.probe({
          source: claimed.source,
          action: action(claimed.source),
          approvedConfigId: claimed.approvedConfigId,
          approvedScopeId: claimed.approvedScopeId,
        }, controller.signal);
      } catch (error) {
        if (controller.signal.aborted && heartbeatError) throw heartbeatError;
        const failure = failureResult(claimed, errorCode(error), this.clock.now());
        probeResult = failure.result;
        interactionRequired = failure.interactionRequired;
        override = failure.resultCode;
        safeResultCode = failure.safeResultCode;
      }
      if (heartbeat) await heartbeat;
      if (heartbeatError) throw heartbeatError;
      const reduced = reduceAuthFlow(stateFor(claimed), {
        type: 'probe_result',
        source: claimed.source,
        result: probeResult,
        approvedOriginMatch: true,
        positiveMarker: probeResult.observation.resultCode === 'AUTHENTICATED',
        temporaryFailure: probeResult.observation.resultCode === 'NETWORK_UNAVAILABLE',
        interactionRequired,
        ...(override ? { resultCode: override } : {}),
      });
      const transition: AuthTransition & { safeResultCode?: 'interaction_required' | 'mfa_required' } = {
        ...reduced,
        ...(safeResultCode ? { safeResultCode } : {}),
      };
      // Second authority gate: late source results remain unpublished after any loss of authority.
      await this.store.assertCurrent(claimed.id, lease, this.clock.now(), context);
      return await this.store.commitTransition(claimed.id, lease, transition, this.clock.now(), context);
    } finally {
      clearInterval(timer);
      if (heartbeat) await heartbeat;
      controller.abort();
      if (this.active === controller) this.active = null;
    }
  }
}
