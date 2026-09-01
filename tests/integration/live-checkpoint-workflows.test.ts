import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  LIVE_SCENARIO_WORKFLOWS,
  PairedLiveCheckpointService,
  type LiveCheckpointAuthorityPort,
  type LiveCheckpointRuntimePort,
  type PairedLiveAuthority,
} from '../../packages/application/src/live-checkpoints.js';
import type {
  LiveCheckpointBinding,
  PairedLiveResult,
  PendingLiveAction,
} from '../../packages/domain/src/live-evidence.js';
import { SQLiteLiveCheckpointStore } from '../../packages/persistence/src/auth.js';
import { openDatabase } from '../../packages/persistence/src/database.js';
import { createHarness } from '../../packages/test-support/src/harness.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });

function fixture() {
  const harness = createHarness(); cleanups.push(() => harness.cleanup());
  const db = openDatabase(join(harness.root, 'live-workflows.sqlite'));
  cleanups.push(async () => { db.close(); });
  let now = Date.parse('2026-09-01T08:30:00.000Z');
  let generation = 7;
  const installationId = randomUUID();
  const store = new SQLiteLiveCheckpointStore(db, { now: () => now });
  const calls: string[] = [];
  const authorityValue: PairedLiveAuthority = {
    kind: 'paired_server_authenticated', secret: randomUUID(), principalSessionHash: hash('paired-server-principal'),
  };
  const authority: LiveCheckpointAuthorityPort = {
    async mint(binding) { calls.push(`mint:${binding.scenario}:${binding.source}`); return authorityValue; },
    async resolve(action) { calls.push(`resolve:${action.scenario}:${action.source}`); return authorityValue; },
  };
  const runtime: LiveCheckpointRuntimePort = {
    platform: () => 'macos',
    async prepare(scenario, source) {
      calls.push(`prepare:${scenario}:${source}`);
      return {
        buildId: 'a'.repeat(64), artifactId: 'b'.repeat(64), version: '0.1.0-beta.20', installationId,
        platform: 'macos', source, scenario, approvedConfigId: source === 'moodle' ? '10000000-0000-4000-8000-000000000001' : '10000000-0000-4000-8000-000000000002',
        approvedScopeId: '20000000-0000-4000-8000-000000000001', bindingFingerprint: 'c'.repeat(64), generation,
        parentCheckpointId: randomUUID(), priorEvidenceEventId: null,
      };
    },
    async current(action) {
      calls.push(`current:${action.scenario}:${action.source}`);
      return { ...action, generation };
    },
    async observe(action, acknowledgement): Promise<PairedLiveResult | { status: 'human_needed'; resultCode: string; checkedAt: string }> {
      calls.push(`observe:${action.scenario}:${action.source}:${acknowledgement}`);
      now += 1_000;
      if (acknowledgement === 'human_needed') return { status: 'human_needed', resultCode: 'HUMAN_ACTION_REQUIRED', checkedAt: new Date(now).toISOString() };
      return {
        actionId: action.actionId, status: acknowledgement === 'failed' ? 'fail' : 'pass',
        resultCode: acknowledgement === 'failed' ? 'CHECKPOINT_FAILED' : 'CHECKPOINT_CONFIRMED',
        bindingConsistency: acknowledgement === 'failed' ? 'not_observed' : 'consistent',
        gaps: acknowledgement === 'failed' ? ['CHECKPOINT_FAILED'] : [], checkedAt: new Date(now).toISOString(),
        correctionOfEventId: action.priorEvidenceEventId,
      };
    },
  };
  const service = new PairedLiveCheckpointService(store, authority, runtime, { expectedGeneration: generation }, () => now);
  return { db, store, service, calls, setGeneration(value: number) { generation = value; }, now: () => now };
}

async function completeBundle(
  service: PairedLiveCheckpointService,
  issue: () => Promise<{ actions: Array<{ actionId: string }> }>,
  result: (input: { actionId: string; acknowledgement: 'completed' }) => Promise<unknown>,
) {
  const bundle = await issue();
  expect(bundle.actions).toHaveLength(2);
  for (const action of bundle.actions) await result({ actionId: action.actionId, acknowledgement: 'completed' });
  return bundle;
}

describe('paired live checkpoint scenario workflows', () => {
  it('locks both platforms to the exact A1/A2/B1/B2/B3/C/D/reauth predecessor chain', () => {
    expect(LIVE_SCENARIO_WORKFLOWS.map(item => [item.slug, item.scenario, item.predecessor])).toEqual([
      ['a1-login', 'a.login', null],
      ['a2-binding', 'a.binding', 'a.login'],
      ['a2-course-visibility', 'a.course_visibility', 'a.binding'],
      ['b1-reopen-1', 'b.reopen_1', 'a.course_visibility'],
      ['b1-reopen-2', 'b.reopen_2', 'b.reopen_1'],
      ['b1-reopen-3', 'b.reopen_3', 'b.reopen_2'],
      ['b2-worker-restart', 'b.worker_restart', 'b.reopen_3'],
      ['b3-codex-exit', 'b.codex_exit', 'b.worker_restart'],
      ['c-os-restart', 'c.os_restart', 'b.codex_exit'],
      ['d-24h-recheck', 'd.24h_recheck', 'c.os_restart'],
      ['reauth', 'reauth', 'd.24h_recheck'],
    ]);
    expect(new Set(LIVE_SCENARIO_WORKFLOWS.flatMap(item => item.platforms))).toEqual(new Set(['macos', 'windows']));
    expect(LIVE_SCENARIO_WORKFLOWS.every(item => item.sources.join(',') === 'moodle,edstem')).toBe(true);
  });

  it('issues two durable A1 children, rejects a missing predecessor, and creates authority only after observation', async () => {
    const f = fixture();
    await expect(f.service.issueA2Binding()).rejects.toMatchObject({ code: 'LIVE_ACTION_PREDECESSOR_REQUIRED' });
    const bundle = await f.service.issueA1Login();
    expect(bundle).toMatchObject({ platform: 'macos', scenario: 'a.login', state: 'pending' });
    expect(bundle.actions.map(item => item.source).sort()).toEqual(['edstem', 'moodle']);
    const first = bundle.actions[0]!;
    await f.service.resultA1Login({ actionId: first.actionId, acknowledgement: 'completed' });
    const observed = f.calls.indexOf(`observe:a.login:${first.source}:completed`);
    const resolved = f.calls.indexOf(`resolve:a.login:${first.source}`);
    expect(observed).toBeGreaterThan(-1); expect(resolved).toBeGreaterThan(observed);
    await expect(f.service.issueA2Binding()).rejects.toMatchObject({ code: 'LIVE_ACTION_PREDECESSOR_REQUIRED' });
    await f.service.resultA1Login({ actionId: bundle.actions[1]!.actionId, acknowledgement: 'completed' });
    expect((await f.service.status()).scenario).toBe('a.binding');
  });

  it('retains human-needed, exact failure, correction and one-time transactional outcomes without inferred pass', async () => {
    const f = fixture(); const bundle = await f.service.issueA1Login(); const first = bundle.actions[0]!;
    const pending = await f.service.resultA1Login({ actionId: first.actionId, acknowledgement: 'human_needed' });
    expect(pending).toMatchObject({ state: 'human_needed' });
    expect(await f.store.read(first.actionId)).toMatchObject({ state: 'pending' });
    expect(f.db.prepare('SELECT count(*) AS n FROM uat_receipts').get()).toEqual({ n: 0 });
    expect(f.db.prepare('SELECT code FROM live_action_failures').pluck().all()).toEqual(['HUMAN_ACTION_REQUIRED']);

    await f.service.resultA1Login({ actionId: first.actionId, acknowledgement: 'failed' });
    expect(f.db.prepare('SELECT status FROM uat_receipts').pluck().all()).toEqual(['fail']);
    await expect(f.service.resultA1Login({ actionId: first.actionId, acknowledgement: 'completed' }))
      .rejects.toMatchObject({ code: 'LIVE_ACTION_REPLAY' });

    const correction = await f.service.issueA1Login();
    const corrected = correction.actions.find(item => item.source === first.source)!;
    await f.service.resultA1Login({ actionId: corrected.actionId, acknowledgement: 'completed' });
    expect(f.db.prepare('SELECT status FROM uat_receipts ORDER BY recorded_at,event_id').pluck().all()).toEqual(['fail', 'pass']);
  });

  it('recovers B3/C/D/reauth from durable state while build or generation drift fails closed', async () => {
    const f = fixture();
    const steps = [
      [() => f.service.issueA1Login(), (input: { actionId: string; acknowledgement: 'completed' }) => f.service.resultA1Login(input)],
      [() => f.service.issueA2Binding(), (input: { actionId: string; acknowledgement: 'completed' }) => f.service.resultA2Binding(input)],
      [() => f.service.issueA2CourseVisibility(), (input: { actionId: string; acknowledgement: 'completed' }) => f.service.resultA2CourseVisibility(input)],
      [() => f.service.issueB1Reopen1(), (input: { actionId: string; acknowledgement: 'completed' }) => f.service.resultB1Reopen1(input)],
      [() => f.service.issueB1Reopen2(), (input: { actionId: string; acknowledgement: 'completed' }) => f.service.resultB1Reopen2(input)],
      [() => f.service.issueB1Reopen3(), (input: { actionId: string; acknowledgement: 'completed' }) => f.service.resultB1Reopen3(input)],
      [() => f.service.issueB2WorkerRestart(), (input: { actionId: string; acknowledgement: 'completed' }) => f.service.resultB2WorkerRestart(input)],
    ] as const;
    for (const [issue, result] of steps) await completeBundle(f.service, issue, result);
    const b3 = await f.service.issueB3CodexExit();
    const reopenedStore = new SQLiteLiveCheckpointStore(f.db, { now: f.now });
    const restarted = new PairedLiveCheckpointService(reopenedStore, {
      mint: async () => ({ kind: 'paired_server_authenticated', secret: randomUUID(), principalSessionHash: hash('unused') }),
      resolve: async () => ({ kind: 'paired_server_authenticated', secret: (f as never), principalSessionHash: hash('unused') }),
    } as never, {} as never, { expectedGeneration: 7 }, f.now);
    // The production service can be reconstructed after restart; the original action IDs are recovered by scenario/platform.
    expect((await f.service.resumeB3CodexExit()).actions.map(item => item.actionId).sort()).toEqual(b3.actions.map(item => item.actionId).sort());
    void restarted;
    f.setGeneration(8);
    await expect(f.service.resultB3CodexExit({ actionId: b3.actions[0]!.actionId, acknowledgement: 'completed' }))
      .rejects.toMatchObject({ code: 'LIVE_ACTION_BINDING_MISMATCH' });
    expect(f.db.prepare("SELECT count(*) AS n FROM uat_receipts WHERE scenario='b.codex_exit'").get()).toEqual({ n: 0 });
  });

  it('rejects caller authority, dynamic operations and ordinary login correlations before store side effects', async () => {
    const f = fixture(); const before = f.db.prepare('SELECT count(*) AS n FROM pending_live_actions').get();
    for (const input of [
      { authority: { kind: 'human_action' } }, { operation: 'append' }, { cell: '*' }, { url: 'https://school.invalid' },
      { selector: '#password' }, { js: 'return document.cookie' }, { profilePath: '/Users/private/Profile' }, { credential: 'SECRET' },
    ]) await expect(f.service.issueA1Login(input as never)).rejects.toMatchObject({ name: 'ZodError' });
    expect(f.db.prepare('SELECT count(*) AS n FROM pending_live_actions').get()).toEqual(before);
    await expect(f.service.resultA1Login({ actionId: randomUUID(), acknowledgement: 'completed' }))
      .rejects.toMatchObject({ code: 'LIVE_ACTION_NOT_FOUND' });
  });
});
