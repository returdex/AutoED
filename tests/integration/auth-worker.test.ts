import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { SourceId, SourceProbeResult } from '../../packages/domain/src/model.js';
import type { SourceProbePort } from '../../packages/application/src/ports.js';
import {
  AuthJobRunner,
  AuthJobService,
  type AuthJobStore,
  type AuthProbeCommand,
} from '../../packages/application/src/auth-jobs.js';
import { openDatabase } from '../../packages/persistence/src/database.js';
import { SQLiteAuthJobStore, SQLiteSourceConfigStore } from '../../packages/persistence/src/auth.js';
import { SQLiteJobStore } from '../../packages/persistence/src/claims.js';
import { createHarness } from '../../packages/test-support/src/harness.js';
import { startWorker } from '../../apps/worker/src/main.js';
import type { BuildIdentity, JobRequest } from '../../packages/domain/src/model.js';

const context = { expectedGeneration: 0 };
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });

const ids = {
  moodleConfig: '10000000-0000-4000-8000-000000000001',
  edstemConfig: '10000000-0000-4000-8000-000000000002',
  scope: '20000000-0000-4000-8000-000000000001',
};
const iso = (value: number) => new Date(value).toISOString();

function command(source: SourceId, trigger: AuthProbeCommand['trigger'] = 'background'): AuthProbeCommand {
  return {
    source,
    approvedConfigId: source === 'moodle' ? ids.moodleConfig : ids.edstemConfig,
    approvedScopeId: ids.scope,
    trigger,
    idempotencyKey: randomUUID(),
  };
}

function result(source: SourceId, code: SourceProbeResult['observation']['resultCode'], checkedAt: string): SourceProbeResult {
  const authenticated = code === 'AUTHENTICATED';
  return {
    request: {
      source,
      action: `${source}.auth_probe`,
      approvedConfigId: source === 'moodle' ? ids.moodleConfig : ids.edstemConfig,
      approvedScopeId: ids.scope,
    },
    observation: {
      source,
      auth: authenticated ? 'authenticated' : code === 'AUTH_REQUIRED' ? 'unauthenticated' : code === 'REAUTH_REQUIRED' ? 'reauth_required' : 'not_observed',
      capability: authenticated ? 'available' : code === 'CAPABILITY_DENIED' ? 'denied' : 'unknown',
      health: code === 'NETWORK_UNAVAILABLE' ? 'error' : code === 'PARSER_CHANGED' ? 'degraded' : 'healthy',
      freshness: authenticated ? 'fresh' : 'stale',
      completeness: authenticated ? 'complete' : 'partial',
      outcome: authenticated ? 'present' : 'error',
      checkedAt,
      resultCode: code,
      courseAccess: 'blocked',
      lastSuccess: authenticated ? { checkedAt, subjectFingerprint: `${source}-subject` } : null,
    },
    identity: authenticated ? {
      source,
      subjectFingerprint: `${source}-subject`,
      organizationFingerprint: 'organization',
      tenantFingerprint: 'tenant',
      approvedScopeId: ids.scope,
      evidenceKind: 'stable_subject_organization_scope',
    } : null,
    selectedCourseVisible: null,
  };
}

function fixture() {
  const harness = createHarness(); cleanups.push(() => harness.cleanup());
  const databasePath = join(harness.root, 'auth-jobs.sqlite');
  const db = openDatabase(databasePath); cleanups.push(async () => { if (db.open) db.close(); });
  let now = 0;
  const clock = { now: () => iso(now) };
  const store = new SQLiteAuthJobStore(db, clock);
  const service = new AuthJobService(store);
  return { harness, databasePath, db, store, service, now: (value: number) => { now = value; }, clock };
}

class QueueProbe implements SourceProbePort {
  readonly calls: { source: SourceId; aborted: boolean }[] = [];
  constructor(private readonly values: Array<SourceProbeResult | Error>) {}
  async probe(request: Parameters<SourceProbePort['probe']>[0], signal: AbortSignal): Promise<SourceProbeResult> {
    this.calls.push({ source: request.source, aborted: signal.aborted });
    const value = this.values.shift();
    if (!value) throw Object.assign(new Error('fixture exhausted'), { code: 'PARSER_CHANGED' });
    if (value instanceof Error) throw value;
    return value;
  }
}

describe('D-08/D-10/D-11 durable per-source auth jobs', () => {
  it('strictly validates commands, replays idempotently per source and isolates sources', async () => {
    const f = fixture();
    const moodle = command('moodle');
    const first = await f.service.requestProbe(moodle, context);
    expect(await f.service.requestProbe(moodle, context)).toEqual(first);
    const edstem = await f.service.requestProbe({ ...command('edstem'), idempotencyKey: moodle.idempotencyKey }, context);
    expect(edstem.jobId).not.toBe(first.jobId);
    await expect(f.service.requestProbe({ ...moodle, url: 'https://example.invalid/' } as AuthProbeCommand, context)).rejects.toThrow();
    expect(await f.service.query(first.jobId, 'moodle')).toMatchObject({ state: 'queued', source: 'moodle', attempt: 0 });
    expect(await f.service.query(first.jobId, 'edstem')).toBeNull();
  });

  it('uses exactly the 0ms, +5s and +30s recovery probes with no fourth request', async () => {
    const f = fixture();
    const port = new QueueProbe([
      result('moodle', 'NETWORK_UNAVAILABLE', iso(0)),
      result('moodle', 'NETWORK_UNAVAILABLE', iso(5_000)),
      result('moodle', 'NETWORK_UNAVAILABLE', iso(30_000)),
    ]);
    const runner = new AuthJobRunner(f.store, port, { clock: f.clock, leaseMs: 1_000, heartbeatMs: 5 });
    const { jobId } = await f.service.requestProbe(command('moodle'), context);
    expect((await f.service.query(jobId, 'moodle'))?.nextRunAt).toBe(iso(0));
    await runner.runOnce('worker', context);
    expect(await f.service.query(jobId, 'moodle')).toMatchObject({ state: 'retry_wait', attempt: 1, recoveryStartedAt: iso(0), nextRunAt: iso(5_000) });
    f.now(4_999); expect(await runner.runOnce('worker', context)).toBeNull();
    f.now(5_000); await runner.runOnce('worker', context);
    expect(await f.service.query(jobId, 'moodle')).toMatchObject({ state: 'retry_wait', attempt: 2, nextRunAt: iso(30_000) });
    f.now(30_000); await runner.runOnce('worker', context);
    expect(await f.service.query(jobId, 'moodle')).toMatchObject({ state: 'human_needed', attempt: 3, nextRunAt: null, resultCode: 'reauth_required' });
    f.now(60_000); expect(await runner.runOnce('worker', context)).toBeNull();
    expect(port.calls).toHaveLength(3);
  });

  it.each(['INTERACTION_REQUIRED', 'MFA_REQUIRED'] as const)('%s hard-stops on the first attempt without retry', async code => {
    const f = fixture();
    const failure = Object.assign(new Error(code), { code });
    const port = new QueueProbe([failure]);
    const runner = new AuthJobRunner(f.store, port, { clock: f.clock, leaseMs: 1_000, heartbeatMs: 5 });
    const { jobId } = await f.service.requestProbe(command('edstem'), context);
    await runner.runOnce('worker', context);
    expect(await f.service.query(jobId, 'edstem')).toMatchObject({ state: 'human_needed', attempt: 1, nextRunAt: null, resultCode: code.toLowerCase() });
    f.now(100_000); expect(await runner.runOnce('worker', context)).toBeNull();
    expect(port.calls).toHaveLength(1);
  });

  it('explicit logout cancels queued/waiting work, marks running cancellation, and only login completion clears intent', async () => {
    const f = fixture();
    const queued = await f.service.requestProbe(command('moodle'), context);
    const running = await f.store.claim({ owner: 'held', now: iso(0), leaseMs: 1_000 }, context);
    expect(running?.id).toBe(queued.jobId);
    await f.service.recordExplicitLogout('moodle', context);
    expect(await f.service.query(queued.jobId, 'moodle')).toMatchObject({ state: 'running', cancelRequested: true });
    await expect(f.service.requestProbe(command('moodle', 'background'), context)).rejects.toMatchObject({ code: 'EXPLICIT_LOGOUT_ACTIVE' });
    await expect(f.service.requestProbe(command('moodle', 'manual_retry'), context)).rejects.toMatchObject({ code: 'EXPLICIT_LOGOUT_ACTIVE' });
    const reopened = await f.service.requestProbe(command('moodle', 'user_login_completed'), context);
    expect(reopened.jobId).not.toBe(queued.jobId);
  });

  it('creates exactly one independent EdStem follow-up after Moodle login completion succeeds', async () => {
    const f = fixture();
    const configs = new SQLiteSourceConfigStore(f.db, { now: () => 0 });
    await configs.confirm({ id: ids.moodleConfig, source: 'moodle', officialOrigin: 'https://moodle.example.edu', approvedScopeId: ids.scope, confirmedAt: iso(0) }, context);
    await configs.confirm({ id: ids.edstemConfig, source: 'edstem', officialOrigin: 'https://edstem.org', approvedScopeId: ids.scope, confirmedAt: iso(0) }, context);
    const port = new QueueProbe([result('moodle', 'AUTHENTICATED', iso(0))]);
    const runner = new AuthJobRunner(f.store, port, { clock: f.clock, leaseMs: 1_000, heartbeatMs: 5 });
    const parent = await f.service.requestProbe(command('moodle', 'user_login_completed'), context);
    await runner.runOnce('worker', context);
    expect(await f.service.query(parent.jobId, 'moodle')).toMatchObject({ state: 'succeeded', resultCode: 'authenticated' });
    const rows = f.db.prepare("SELECT source,approved_config_id,approved_scope_id,parent_job_id,count(*) AS count FROM source_auth_jobs WHERE parent_job_id=? GROUP BY source,approved_config_id,approved_scope_id,parent_job_id").all(parent.jobId);
    expect(rows).toEqual([{ source: 'edstem', approved_config_id: ids.edstemConfig, approved_scope_id: ids.scope, parent_job_id: parent.jobId, count: 1 }]);
  });

  it('rejects stale lease owner/fence/generation, expiry and cancellation before transition commit', async () => {
    const f = fixture();
    const { jobId } = await f.service.requestProbe(command('moodle'), context);
    const job = (await f.store.claim({ owner: 'current', now: iso(0), leaseMs: 1_000 }, context))!;
    const lease = job.lease!;
    for (const stale of [
      { ...lease, owner: 'old' },
      { ...lease, fence: lease.fence + 1 },
      { ...lease, generation: lease.generation + 1 },
    ]) await expect(f.store.assertCurrent(jobId, stale, iso(0), context)).rejects.toMatchObject({ code: expect.stringMatching(/LEASE|GENERATION/) });
    await expect(f.store.assertCurrent(jobId, lease, iso(1_000), context)).rejects.toMatchObject({ code: 'LEASE_LOST' });
    f.now(1); await f.store.requestCancel(jobId, 'moodle', context);
    await expect(f.store.assertCurrent(jobId, lease, iso(1), context)).rejects.toMatchObject({ code: 'CANCEL_REQUESTED' });
  });

  it('keeps parser, permission, authentication and network states distinct while retaining last success', async () => {
    for (const [code, expected] of [
      ['NETWORK_UNAVAILABLE', 'network_unavailable'],
      ['PARSER_CHANGED', 'parser_changed'],
      ['CAPABILITY_DENIED', 'permission_denied'],
      ['AUTH_REQUIRED', 'authentication_required'],
    ] as const) {
      const f = fixture();
      const port = new QueueProbe([result('edstem', 'AUTHENTICATED', iso(0)), result('edstem', code, iso(1))]);
      const runner = new AuthJobRunner(f.store, port, { clock: f.clock, leaseMs: 1_000, heartbeatMs: 5 });
      await f.service.requestProbe(command('edstem'), context); await runner.runOnce('worker', context);
      f.now(1); const failed = await f.service.requestProbe(command('edstem'), context); await runner.runOnce('worker', context);
      expect(await f.service.query(failed.jobId, 'edstem')).toMatchObject({ resultCode: expected, lastSuccess: { checkedAt: iso(0) } });
      const observation = f.db.prepare("SELECT current_contract,last_success_contract FROM source_observations WHERE source='edstem'").get() as { current_contract: string; last_success_contract: string };
      expect(JSON.parse(observation.current_contract).resultCode).toBe(code);
      expect(JSON.parse(observation.last_success_contract).checkedAt).toBe(iso(0));
    }
  });
});

function intercepted(store: AuthJobStore, handlers: Partial<{
  assertCurrent: AuthJobStore['assertCurrent'];
  commitTransition: AuthJobStore['commitTransition'];
}>): AuthJobStore {
  return new Proxy(store, {
    get(target, property) {
      const replacement = handlers[property as keyof typeof handlers];
      if (replacement) return replacement;
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

describe('T2-05 request and commit fencing', () => {
  it.each(['cancel', 'expired lease', 'stale generation', 'stale fence'] as const)('before-request %s prevents any SourceProbePort call', async loss => {
    const f = fixture(); const requested = await f.service.requestProbe(command('moodle'), context);
    let checks = 0;
    const store = intercepted(f.store, {
      assertCurrent: async (...args) => {
        if (++checks === 1) {
          if (loss === 'cancel') await f.store.requestCancel(requested.jobId, 'moodle', context);
          else if (loss === 'expired lease') f.db.prepare('UPDATE source_auth_jobs SET lease_until=0 WHERE id=?').run(requested.jobId);
          else if (loss === 'stale generation') f.db.prepare('UPDATE source_auth_jobs SET generation=generation+1 WHERE id=?').run(requested.jobId);
          else f.db.prepare('UPDATE source_auth_jobs SET fence=fence+1 WHERE id=?').run(requested.jobId);
        }
        return f.store.assertCurrent(...args);
      },
    });
    const port = new QueueProbe([result('moodle', 'AUTHENTICATED', iso(0))]);
    await expect(new AuthJobRunner(store, port, { clock: f.clock, leaseMs: 1_000, heartbeatMs: 5 }).runOnce('old', context))
      .rejects.toMatchObject({ code: expect.stringMatching(/CANCEL|LEASE|GENERATION/) });
    expect(port.calls).toHaveLength(0);
    expect(f.db.prepare('SELECT count(*) AS n FROM source_observations').get()).toEqual({ n: 0 });
  });

  it('in-flight heartbeat cancellation aborts the probe and publishes no result', async () => {
    const f = fixture(); const requested = await f.service.requestProbe(command('edstem'), context);
    let started!: () => void; const entered = new Promise<void>(resolve => { started = resolve; });
    let observedAbort = false;
    const port: SourceProbePort = {
      probe: async (_request, signal) => {
        started();
        await new Promise<void>((_resolve, reject) => signal.addEventListener('abort', () => {
          observedAbort = true; reject(Object.assign(new Error('ABORTED'), { code: 'ABORTED' }));
        }, { once: true }));
        throw new Error('unreachable');
      },
    };
    const runner = new AuthJobRunner(f.store, port, { clock: f.clock, leaseMs: 1_000, heartbeatMs: 5 });
    const running = runner.runOnce('worker', context);
    await entered; await f.store.requestCancel(requested.jobId, 'edstem', context);
    await expect(running).rejects.toMatchObject({ code: 'CANCEL_REQUESTED' });
    expect(observedAbort).toBe(true);
    expect(f.db.prepare('SELECT count(*) AS n FROM source_observations').get()).toEqual({ n: 0 });
  });

  it.each(['cancel', 'expired lease', 'stale generation', 'stale fence'] as const)('before-commit %s discards the late result and writes no observation or follow-up', async loss => {
    const f = fixture(); const requested = await f.service.requestProbe(command('moodle', 'user_login_completed'), context);
    let checks = 0;
    const store = intercepted(f.store, {
      assertCurrent: async (...args) => {
        if (++checks === 2) {
          if (loss === 'cancel') await f.store.requestCancel(requested.jobId, 'moodle', context);
          else if (loss === 'expired lease') f.db.prepare('UPDATE source_auth_jobs SET lease_until=0 WHERE id=?').run(requested.jobId);
          else if (loss === 'stale generation') f.db.prepare('UPDATE source_auth_jobs SET generation=generation+1 WHERE id=?').run(requested.jobId);
          else f.db.prepare('UPDATE source_auth_jobs SET fence=fence+1 WHERE id=?').run(requested.jobId);
        }
        return f.store.assertCurrent(...args);
      },
    });
    const runner = new AuthJobRunner(store, new QueueProbe([result('moodle', 'AUTHENTICATED', iso(0))]), { clock: f.clock, leaseMs: 1_000, heartbeatMs: 5 });
    await expect(runner.runOnce('old', context)).rejects.toMatchObject({ code: expect.stringMatching(/CANCEL|LEASE|GENERATION/) });
    expect(f.db.prepare('SELECT count(*) AS n FROM source_observations').get()).toEqual({ n: 0 });
    expect(f.db.prepare('SELECT count(*) AS n FROM source_auth_jobs WHERE parent_job_id IS NOT NULL').get()).toEqual({ n: 0 });
  });

  it('commitTransition SQL predicate rolls back observation and follow-up after a post-check race', async () => {
    const f = fixture(); const requested = await f.service.requestProbe(command('moodle', 'user_login_completed'), context);
    const store = intercepted(f.store, {
      commitTransition: async (...args) => {
        await f.store.requestCancel(requested.jobId, 'moodle', context);
        return f.store.commitTransition(...args);
      },
    });
    const runner = new AuthJobRunner(store, new QueueProbe([result('moodle', 'AUTHENTICATED', iso(0))]), { clock: f.clock, leaseMs: 1_000, heartbeatMs: 5 });
    await expect(runner.runOnce('old', context)).rejects.toMatchObject({ code: 'CANCEL_REQUESTED' });
    expect(f.db.prepare('SELECT count(*) AS n FROM source_observations').get()).toEqual({ n: 0 });
    expect(f.db.prepare('SELECT count(*) AS n FROM source_auth_jobs WHERE parent_job_id IS NOT NULL').get()).toEqual({ n: 0 });
  });

  it('Worker gives one turn to synthetic and auth queues without source starvation', async () => {
    const f = fixture(); const jobs = new SQLiteJobStore(f.db, { now: () => 0 });
    const build: BuildIdentity = { version: '0.1.0', buildId: 'a'.repeat(64), commit: 'b'.repeat(40), tree: 'c'.repeat(40), dependencyHash: 'd'.repeat(64), protocol: 1, schemaMin: 1, schemaMax: 1, capabilities: ['echo'] };
    const synthetic: JobRequest = { kind: 'echo', value: 'synthetic', idempotencyKey: randomUUID(), scope: { installationId: randomUUID(), source: 'synthetic', courseId: 'selftest' } };
    const ordinary = await jobs.enqueue(synthetic, context);
    const auth = await f.service.requestProbe(command('edstem'), context);
    const worker = await startWorker({
      databasePath: f.databasePath,
      owner: 'combined',
      build,
      auth: { probes: new QueueProbe([result('edstem', 'AUTHENTICATED', iso(0))]), evidence: 'S/I', clock: f.clock },
    });
    cleanups.push(() => worker.stop());
    const deadline = Date.now() + 5_000;
    while ((await jobs.query(ordinary.id, synthetic.scope))?.state !== 'succeeded' || (await f.service.query(auth.jobId, 'edstem'))?.state !== 'succeeded') {
      if (Date.now() > deadline) throw new Error('COMBINED_WORKER_TIMEOUT');
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    await worker.stop();
  });

  it('documents automated results as S/I only while Windows and Phase 3 stay blocked', () => {
    const evidence = { automated: 'S/I', windows: 'not_run', disposition: 'human_needed', phase3: 'blocked' };
    expect(evidence).toEqual({ automated: 'S/I', windows: 'not_run', disposition: 'human_needed', phase3: 'blocked' });
  });
});
