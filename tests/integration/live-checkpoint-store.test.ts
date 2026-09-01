import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LiveCheckpointWorkflow, type PairedLiveAuthority } from '../../packages/application/src/live-checkpoints.js';
import type { LiveCheckpointBinding, PairedLiveResult, PendingLiveActionIssue } from '../../packages/domain/src/live-evidence.js';
import { SQLiteLiveCheckpointStore } from '../../packages/persistence/src/auth.js';
import { openDatabase } from '../../packages/persistence/src/database.js';
import { createHarness } from '../../packages/test-support/src/harness.js';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });

function fixture() {
  const harness = createHarness(); cleanups.push(() => harness.cleanup());
  const path = join(harness.root, 'live.sqlite');
  let now = Date.parse('2026-09-01T06:00:00.000Z');
  const db = openDatabase(path);
  const store = new SQLiteLiveCheckpointStore(db, { now: () => now });
  const authority: PairedLiveAuthority = {
    kind: 'paired_server_authenticated',
    secret: randomUUID(),
    principalSessionHash: digest('paired-session'),
  };
  const issue: PendingLiveActionIssue = {
    buildId: 'a'.repeat(64), artifactId: 'b'.repeat(64), version: '0.1.0-beta.20', installationId: randomUUID(),
    platform: 'macos', source: 'moodle', scenario: 'b.codex_exit', approvedConfigId: randomUUID(),
    approvedScopeId: randomUUID(), bindingFingerprint: 'c'.repeat(64), generation: 0,
    parentCheckpointId: randomUUID(), priorEvidenceEventId: null, ttlMs: 3_600_000,
  };
  const current = (action: Awaited<ReturnType<typeof store.issue>>): LiveCheckpointBinding => ({
    buildId: action.buildId, artifactId: action.artifactId, version: action.version, installationId: action.installationId,
    platform: action.platform, source: action.source, scenario: action.scenario, approvedConfigId: action.approvedConfigId,
    approvedScopeId: action.approvedScopeId, bindingFingerprint: action.bindingFingerprint, generation: action.generation,
    parentCheckpointId: action.parentCheckpointId, priorEvidenceEventId: action.priorEvidenceEventId,
  });
  const result = (actionId: string, correctionOfEventId: string | null = null, status: 'pass' | 'fail' = 'pass'): PairedLiveResult => {
    now += 1_000;
    return {
      actionId, status, resultCode: status === 'pass' ? 'CHECKPOINT_CONFIRMED' : 'CHECKPOINT_FAILED',
      bindingConsistency: status === 'pass' ? 'consistent' : 'not_observed', gaps: status === 'pass' ? [] : ['CHECKPOINT_FAILED'],
      checkedAt: new Date(now).toISOString(), correctionOfEventId,
    };
  };
  return { harness, path, db, store, authority, issue, current, result, setNow(value: number) { now = value; }, now: () => now };
}

describe('durable live checkpoint migration and issuance', () => {
  it('migrates through schema v4 without rebuilding existing auth/evidence tables', () => {
    const f = fixture();
    expect(f.db.pragma('user_version', { simple: true })).toBe(4);
    expect(f.db.prepare("SELECT version FROM schema_migrations ORDER BY version").pluck().all()).toEqual([1, 2, 3, 4]);
    expect(f.db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name IN ('pending_live_actions','live_action_failures') ORDER BY name").pluck().all())
      .toEqual(['live_action_failures', 'pending_live_actions']);
    expect(f.db.prepare("SELECT count(*) AS n FROM uat_receipts").get()).toEqual({ n: 0 });
  });

  it('survives close/reopen with immutable bindings, monotonic issuance and no plaintext authority', async () => {
    const f = fixture();
    const first = await f.store.issue(f.issue, f.authority, { expectedGeneration: 0 });
    const secondAuthority = { ...f.authority, secret: randomUUID() };
    const second = await f.store.issue({ ...f.issue, parentCheckpointId: randomUUID() }, secondAuthority, { expectedGeneration: 0 });
    expect(Date.parse(second.issuedAt)).toBeGreaterThan(Date.parse(first.issuedAt));
    f.db.close();

    const reopened = openDatabase(f.path);
    try {
      const store = new SQLiteLiveCheckpointStore(reopened, { now: () => Date.parse(first.issuedAt) });
      expect(await store.read(first.actionId)).toEqual(first);
      const raw = reopened.prepare('SELECT * FROM pending_live_actions WHERE action_id=?').get(first.actionId) as Record<string, unknown>;
      expect(JSON.stringify(raw)).not.toContain(f.authority.secret);
      expect(Object.keys(raw).join('|')).not.toMatch(/url|selector|javascript|browser|credential|password|mfa|profile|cookie|storage|html|dom|request|response|headers|body/i);
    } finally { reopened.close(); }
  });
});

describe('transactional exact-cell live outcomes', () => {
  it('consumes once and appends exactly one registry-backed L event in the same transaction', async () => {
    const f = fixture(); const action = await f.store.issue(f.issue, f.authority, { expectedGeneration: 0 });
    const consumed = await f.store.consumeAndAppend(f.result(action.actionId), f.current(action), f.authority, { expectedGeneration: 0 });
    expect(consumed).toMatchObject({ actionId: action.actionId, state: 'consumed' });
    expect(f.db.prepare('SELECT state,consumed_event_id FROM pending_live_actions WHERE action_id=?').get(action.actionId)).toMatchObject({ state: 'consumed' });
    expect(f.db.prepare(`SELECT platform,source,scenario,evidence,status,producer_kind,producer_id,prior_event_id
      FROM uat_receipts WHERE producer_id=?`).get(action.actionId)).toEqual({
      platform: 'macos', source: 'moodle', scenario: 'b.codex_exit', evidence: 'L', status: 'pass',
      producer_kind: 'human_action', producer_id: action.actionId, prior_event_id: null,
    });
    await expect(f.store.consumeAndAppend(f.result(action.actionId), f.current(action), f.authority, { expectedGeneration: 0 }))
      .rejects.toMatchObject({ code: 'LIVE_ACTION_REPLAY' });
    expect(f.db.prepare('SELECT count(*) AS n FROM uat_receipts').get()).toEqual({ n: 1 });
  });

  it.each([
    ['buildId', 'd'.repeat(64)], ['artifactId', 'd'.repeat(64)], ['installationId', '99999999-9999-4999-8999-999999999999'],
    ['platform', 'windows'], ['source', 'edstem'], ['scenario', 'c.os_restart'],
    ['approvedConfigId', '99999999-9999-4999-8999-999999999999'], ['approvedScopeId', '99999999-9999-4999-8999-999999999999'],
    ['bindingFingerprint', 'd'.repeat(64)], ['generation', 1], ['parentCheckpointId', '99999999-9999-4999-8999-999999999999'],
  ] as const)('rejects changed current %s without changing the evidence cell', async (field, value) => {
    const f = fixture(); const action = await f.store.issue(f.issue, f.authority, { expectedGeneration: 0 });
    await expect(f.store.consumeAndAppend(f.result(action.actionId), { ...f.current(action), [field]: value }, f.authority, { expectedGeneration: 0 }))
      .rejects.toMatchObject({ code: 'LIVE_ACTION_BINDING_MISMATCH' });
    expect(await f.store.read(action.actionId)).toMatchObject({ state: 'pending' });
    expect(f.db.prepare('SELECT count(*) AS n FROM uat_receipts').get()).toEqual({ n: 0 });
  });

  it('rejects wrong authority and expiry while retaining the pending action and evidence baseline', async () => {
    const f = fixture(); const action = await f.store.issue(f.issue, f.authority, { expectedGeneration: 0 });
    await expect(f.store.consumeAndAppend(f.result(action.actionId), f.current(action), { ...f.authority, secret: randomUUID() }, { expectedGeneration: 0 }))
      .rejects.toMatchObject({ code: 'LIVE_ACTION_AUTHORITY_MISMATCH' });
    f.setNow(Date.parse(action.expiresAt) + 1);
    await expect(f.store.consumeAndAppend({ ...f.result(action.actionId), checkedAt: new Date(Date.parse(action.expiresAt)).toISOString() }, f.current(action), f.authority, { expectedGeneration: 0 }))
      .rejects.toMatchObject({ code: 'LIVE_ACTION_EXPIRED' });
    expect(await f.store.read(action.actionId)).toMatchObject({ state: 'expired', consumedAt: null });
    expect(f.db.prepare('SELECT count(*) AS n FROM uat_receipts').get()).toEqual({ n: 0 });
  });

  it('keeps corrections append-only, same-cell and predecessor-linked', async () => {
    const f = fixture();
    const failedAction = await f.store.issue(f.issue, f.authority, { expectedGeneration: 0 });
    await f.store.consumeAndAppend(f.result(failedAction.actionId, null, 'fail'), f.current(failedAction), f.authority, { expectedGeneration: 0 });
    const failedEvent = (f.db.prepare('SELECT event_id FROM uat_receipts WHERE producer_id=?').get(failedAction.actionId) as { event_id: string }).event_id;
    const correctionIssue = { ...f.issue, parentCheckpointId: randomUUID(), priorEvidenceEventId: failedEvent };
    const correctionAuthority = { ...f.authority, secret: randomUUID() };
    const correction = await f.store.issue(correctionIssue, correctionAuthority, { expectedGeneration: 0 });
    await f.store.consumeAndAppend(f.result(correction.actionId, failedEvent), f.current(correction), correctionAuthority, { expectedGeneration: 0 });
    expect(f.db.prepare('SELECT status,prior_event_id FROM uat_receipts ORDER BY recorded_at,event_id').all()).toEqual([
      { status: 'fail', prior_event_id: null }, { status: 'pass', prior_event_id: failedEvent },
    ]);

    const staleAuthority = { ...f.authority, secret: randomUUID() };
    const stale = await f.store.issue({ ...f.issue, parentCheckpointId: randomUUID(), priorEvidenceEventId: failedEvent }, staleAuthority, { expectedGeneration: 0 });
    const newest = (f.db.prepare('SELECT event_id FROM uat_receipts ORDER BY recorded_at DESC,event_id DESC LIMIT 1').get() as { event_id: string }).event_id;
    await expect(f.store.consumeAndAppend(f.result(stale.actionId, failedEvent), f.current(stale), staleAuthority, { expectedGeneration: 0 }))
      .rejects.toMatchObject({ code: 'LIVE_ACTION_PREDECESSOR_CHANGED' });
    expect(newest).not.toBe(failedEvent);
    expect(f.db.prepare('SELECT count(*) AS n FROM uat_receipts').get()).toEqual({ n: 2 });
  });

  it('rolls back consume and pass append together, then records only a safe append-only failure', async () => {
    const f = fixture(); const action = await f.store.issue(f.issue, f.authority, { expectedGeneration: 0 });
    f.db.exec(`CREATE TRIGGER reject_live_append BEFORE INSERT ON uat_receipts BEGIN SELECT RAISE(ABORT,'injected live append failure'); END`);
    const runtime = { current: async () => f.current(action) };
    const authority = { mint: async () => f.authority, resolve: async () => f.authority };
    const workflow = new LiveCheckpointWorkflow(f.store, authority, runtime, () => new Date(f.now()).toISOString());
    await expect(workflow.consumeAndAppend(f.result(action.actionId), { expectedGeneration: 0 })).rejects.toMatchObject({ code: 'STORAGE_CONSTRAINT' });
    expect(await f.store.read(action.actionId)).toMatchObject({ state: 'pending', consumedAt: null });
    expect(f.db.prepare('SELECT count(*) AS n FROM uat_receipts').get()).toEqual({ n: 0 });
    expect(f.db.prepare('SELECT action_id,code FROM live_action_failures').all()).toEqual([{ action_id: action.actionId, code: 'STORAGE_FAILURE' }]);
  });

  it('keeps the pending action and prior ledger on SQLITE_BUSY, then appends a separate safe failure audit', async () => {
    const f = fixture(); const action = await f.store.issue(f.issue, f.authority, { expectedGeneration: 0 });
    const blocker = openDatabase(f.path); blocker.pragma('busy_timeout = 1'); f.db.pragma('busy_timeout = 1'); blocker.exec('BEGIN IMMEDIATE');
    const result = f.result(action.actionId);
    try {
      await expect(f.store.consumeAndAppend(result, f.current(action), f.authority, { expectedGeneration: 0 }))
        .rejects.toMatchObject({ code: 'SQLITE_BUSY' });
    } finally { blocker.exec('ROLLBACK'); blocker.close(); }
    await f.store.recordFailure(action.actionId, 'SQLITE_BUSY', result.checkedAt, { expectedGeneration: 0 });
    expect(await f.store.read(action.actionId)).toMatchObject({ state: 'pending', consumedAt: null });
    expect(f.db.prepare('SELECT count(*) AS n FROM uat_receipts').get()).toEqual({ n: 0 });
    expect(f.db.prepare('SELECT code FROM live_action_failures').pluck().all()).toEqual(['SQLITE_BUSY']);
  });
});
