import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { once } from 'node:events';
import { createHarness } from '../../packages/test-support/src/harness.js';
import { openDatabase, SQLiteMaintenanceStore } from '../../packages/persistence/src/database.js';
import { SQLiteJobStore } from '../../packages/persistence/src/claims.js';
import type { JobRequest, Job } from '../../packages/domain/src/model.js';

const context = { expectedGeneration: 0 };
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
function fixture() {
  const h = createHarness(); cleanups.push(() => h.cleanup());
  const path = join(h.root, 'jobs.sqlite'); const db = openDatabase(path);
  cleanups.push(async () => { if (db.open) db.close(); });
  let time = 1000; const clock = { now: () => time }; const jobs = new SQLiteJobStore(db, clock);
  const req: JobRequest = { kind: 'echo', value: 'synthetic', idempotencyKey: randomUUID(), scope: { installationId: randomUUID(), source: 'synthetic', courseId: 'selftest' } };
  return { h, path, db, jobs, req, gate: new SQLiteMaintenanceStore(db), time: (n: number) => { time = n; } };
}
async function running(f: ReturnType<typeof fixture>, owner = 'worker') {
  await f.jobs.enqueue(f.req, context);
  return (await f.jobs.claim({ owner, now: 1000, leaseMs: 30_000 }, context))!;
}
function childScript(path: string, body: string) {
  const source = new URL('../../packages/persistence/src/', import.meta.url).href;
  return `import { registerHooks } from 'node:module'; import {writeFileSync} from 'node:fs';
    registerHooks({resolve(s,c,n){try{return n(s,c)}catch(e){if(s.endsWith('.js'))return n(s.slice(0,-3)+'.ts',c);throw e;}}});
    const {openDatabase}=await import(${JSON.stringify(source + 'database.ts')});
    const {SQLiteJobStore}=await import(${JSON.stringify(source + 'claims.ts')});
    const db=openDatabase(${JSON.stringify(path)});const jobs=new SQLiteJobStore(db);${body}`;
}
async function waitFile(path: string) {
  const deadline = Date.now() + 5000;
  while (!existsSync(path)) { if (Date.now() > deadline) throw new Error('Owned child did not report'); await new Promise(r => setTimeout(r, 10)); }
}

describe('transactional leases and crash recovery', () => {
  it('permits only one business commit across two independent worker processes', async () => {
    const f = fixture(); await f.jobs.enqueue(f.req, context);
    const paths = [join(f.h.root, 'a.json'), join(f.h.root, 'b.json')];
    const children = paths.map((path, i) => f.h.spawn(['--experimental-transform-types', '--input-type=module', '-e', childScript(f.path, `
      const j=await jobs.claim({owner:'worker-${i}',now:1000,leaseMs:30000},{expectedGeneration:0});
      if(j)await jobs.commit(j.id,j.lease,'value',1001,{expectedGeneration:0});
      writeFileSync(${JSON.stringify(path)},JSON.stringify(j?.id??null));db.close();`)]));
    expect((await Promise.all(children.map(c => once(c, 'exit')))).map(([code]) => code)).toEqual([0, 0]);
    expect(paths.map(p => JSON.parse(readFileSync(p, 'utf8'))).filter(Boolean)).toHaveLength(1);
    expect(f.db.prepare('SELECT count(*) AS n FROM synthetic_results').get()).toEqual({ n: 1 });
  });
  it('recovers a killed running process, invalidates its fence, and eventually commits once', async () => {
    const f = fixture(); const queued = await f.jobs.enqueue(f.req, context); const output = join(f.h.root, 'lease.json');
    const child = f.h.spawn(['--experimental-transform-types', '--input-type=module', '-e', childScript(f.path, `const j=await jobs.claim({owner:'killed',now:1000,leaseMs:30000},{expectedGeneration:0});writeFileSync(${JSON.stringify(output)},JSON.stringify(j));setInterval(()=>{},1000);`)]);
    await waitFile(output); const old: Job = JSON.parse(readFileSync(output, 'utf8')); await f.h.stop(child);
    expect(await f.jobs.recoverExpired(31_000, context)).toBe(1);
    expect((await f.jobs.query(queued.id, f.req.scope))?.state).toBe('retry_wait');
    await expect(f.jobs.commit(old.id, old.lease!, 'late', 31_000, context)).rejects.toMatchObject({ code: 'LEASE_LOST' });
    const next = (await f.jobs.claim({ owner: 'replacement', now: 32_000, leaseMs: 30_000 }, context))!;
    expect(next.attempt).toBe(2); expect(next.lease!.fence).toBeGreaterThan(old.lease!.fence);
    await expect(f.jobs.heartbeat(old.id, old.lease!, 32_000, context)).rejects.toMatchObject({ code: 'LEASE_LOST' });
    await expect(f.jobs.commit(old.id, old.lease!, 'old fence after new claim', 32_000, context)).rejects.toMatchObject({ code: 'LEASE_LOST' });
    await f.jobs.commit(next.id, next.lease!, '', 32_001, context);
    expect((await f.jobs.query(next.id, f.req.scope))?.result).toBe('');
    expect(f.db.prepare('SELECT count(*) AS n FROM synthetic_results').get()).toEqual({ n: 1 });
  });
  it('exhausts three crashes without an infinite running job', async () => {
    const f = fixture(); let job = await running(f); let now = 31_000;
    for (let attempt = 1; attempt <= 3; attempt++) {
      expect(job.attempt).toBe(attempt); expect(await f.jobs.recoverExpired(now, context)).toBe(1);
      if (attempt < 3) { now += attempt === 1 ? 1000 : 2000; job = (await f.jobs.claim({ owner: `replacement-${attempt}`, now, leaseMs: 30_000 }, context))!; now += 30_000; }
    }
    expect(await f.jobs.query(job.id, f.req.scope)).toMatchObject({ state: 'failed', errorCode: 'RETRY_EXHAUSTED', attempt: 3 });
    expect(await f.jobs.claim({ owner: 'fourth', now: now + 100_000, leaseMs: 30_000 }, context)).toBeNull();
  });
  it('fences heartbeat checkpoint commit and failure after expiry and clock regression', async () => {
    const f = fixture(); const job = await running(f); const lease = job.lease!;
    await expect(f.jobs.heartbeat(job.id, lease, 999, context)).rejects.toMatchObject({ code: 'CLOCK_REGRESSION' });
    for (const action of [() => f.jobs.heartbeat(job.id, lease, 31_000, context), () => f.jobs.checkpoint(job.id, lease, 'late', 31_000, context), () => f.jobs.commit(job.id, lease, 'late', 31_000, context), () => f.jobs.fail(job.id, lease, 'NETWORK_ERROR', true, 31_000, context)]) {
      await expect(action()).rejects.toMatchObject({ code: 'LEASE_LOST' });
    }
    expect(await f.jobs.recoverExpired(10_000_000, context)).toBe(1);
    expect((await f.jobs.query(job.id, f.req.scope))?.state).toBe('retry_wait');
  });
  it('heartbeats extend by the original bounded lease and checkpoint persists through reopen', async () => {
    const f = fixture(); const job = await running(f); const lease = await f.jobs.heartbeat(job.id, job.lease!, 6000, context);
    expect(lease.leaseUntil).toBe(36_000); await f.jobs.checkpoint(job.id, lease, 'safe checkpoint', 6001, context);
    f.db.close(); const reopened = openDatabase(f.path);
    try { expect((await new SQLiteJobStore(reopened).query(job.id, f.req.scope))?.checkpoint).toBe('safe checkpoint'); } finally { reopened.close(); }
  });
  it('bounded retries keep latest error and prior success distinct', async () => {
    const f = fixture(); const success = await running(f); await f.jobs.commit(success.id, success.lease!, 'retained', 1001, context);
    const req = { ...f.req, idempotencyKey: randomUUID() }; await f.jobs.enqueue(req, context);
    let job = (await f.jobs.claim({ owner: 'w', now: 1002, leaseMs: 30_000 }, context))!;
    job = await f.jobs.fail(job.id, job.lease!, 'NETWORK_ERROR', true, 1003, context);
    expect(job).toMatchObject({ state: 'retry_wait', nextRunAt: 2003, errorCode: 'NETWORK_ERROR', result: null, lastSuccessResult: 'retained' });
    expect(await f.jobs.claim({ owner: 'w', now: 2002, leaseMs: 30_000 }, context)).toBeNull();
    job = (await f.jobs.claim({ owner: 'w', now: 2003, leaseMs: 30_000 }, context))!;
    job = await f.jobs.fail(job.id, job.lease!, 'NETWORK_ERROR', true, 2004, context); expect(job.nextRunAt).toBe(4004);
    job = (await f.jobs.claim({ owner: 'w', now: 4004, leaseMs: 30_000 }, context))!;
    job = await f.jobs.fail(job.id, job.lease!, 'NETWORK_ERROR', true, 4005, context);
    expect(job).toMatchObject({ state: 'failed', nextRunAt: null, attempt: 3, lastSuccessResult: 'retained' });
  });
  it('permission errors cannot retry even when caller marks retryable', async () => {
    const f = fixture(); const job = await running(f);
    expect(await f.jobs.fail(job.id, job.lease!, 'PERMISSION_DENIED', true, 1001, context)).toMatchObject({ state: 'failed', attempt: 1 });
  });
  it('parser errors stop immediately rather than attempting potentially changed source data', async () => {
    const f = fixture(); const job = await running(f);
    expect(await f.jobs.fail(job.id, job.lease!, 'PARSER_ERROR', true, 1001, context)).toMatchObject({ state: 'failed', attempt: 1, nextRunAt: null });
    expect(await f.jobs.claim({ owner: 'again', now: 99_999, leaseMs: 30_000 }, context)).toBeNull();
  });
  it('request cancellation is not acknowledgement and cannot race past commit', async () => {
    const f = fixture(); const job = await running(f);
    expect(await f.jobs.requestCancel(job.id, f.req.scope, context)).toMatchObject({ state: 'running', cancelRequested: true });
    await expect(f.jobs.commit(job.id, job.lease!, 'too late', 1001, context)).rejects.toMatchObject({ code: 'CANCEL_REQUESTED' });
    expect(await f.jobs.acknowledgeCancel(job.id, job.lease!, 1002, context)).toMatchObject({ state: 'cancelled' });
    expect(f.db.prepare('SELECT count(*) AS n FROM synthetic_results').get()).toEqual({ n: 0 });
  });
  it('winning completion remains succeeded and cancelled expired jobs never rerun', async () => {
    const f = fixture(); const job = await running(f); await f.jobs.commit(job.id, job.lease!, 'winner', 1001, context);
    expect((await f.jobs.requestCancel(job.id, f.req.scope, context)).state).toBe('succeeded');
    await f.jobs.enqueue({ ...f.req, idempotencyKey: randomUUID() }, context);
    const other = (await f.jobs.claim({ owner: 'other', now: 1002, leaseMs: 30_000 }, context))!;
    await f.jobs.requestCancel(other.id, f.req.scope, context); await f.jobs.recoverExpired(31_002, context);
    expect((await f.jobs.query(other.id, f.req.scope))?.state).toBe('cancelled');
    expect(await f.jobs.claim({ owner: 'again', now: 99_999, leaseMs: 30_000 }, context)).toBeNull();
  });
  it('serializes cancellation versus completion from separate real processes', async () => {
    const f = fixture(); const job = await running(f);
    const commit = f.h.spawn(['--experimental-transform-types', '--input-type=module', '-e', childScript(f.path, `
      try{await jobs.commit(${JSON.stringify(job.id)},${JSON.stringify(job.lease)},'won',1001,{expectedGeneration:0})}
      catch(e){if(e.code!=='CANCEL_REQUESTED')throw e;await jobs.acknowledgeCancel(${JSON.stringify(job.id)},${JSON.stringify(job.lease)},1002,{expectedGeneration:0})}db.close();`)]);
    // Use the same synthetic clock for cancellation so clock-regression protection is not the race winner.
    const cancel = f.h.spawn(['--experimental-transform-types', '--input-type=module', '-e', childScript(f.path, `
      const canceller=new SQLiteJobStore(db,{now:()=>1001});await canceller.requestCancel(${JSON.stringify(job.id)},${JSON.stringify(f.req.scope)},{expectedGeneration:0});db.close();`)]);
    expect((await Promise.all([once(commit, 'exit'), once(cancel, 'exit')])).map(([code]) => code)).toEqual([0, 0]);
    const outcome = (await f.jobs.query(job.id, f.req.scope))!;
    if (outcome.state === 'running') await f.jobs.acknowledgeCancel(job.id, job.lease!, 1002, context);
    const final = (await f.jobs.query(job.id, f.req.scope))!;
    expect(['succeeded', 'cancelled']).toContain(final.state);
    expect(f.db.prepare('SELECT count(*) AS n FROM synthetic_results').get()).toEqual({ n: final.state === 'succeeded' ? 1 : 0 });
  });
  it('quiesces workers, drains current work, isolates candidate selfcheck and safely resumes backlog', async () => {
    const f = fixture(); const job = await running(f); const backlog = await f.jobs.enqueue({ ...f.req, idempotencyKey: randomUUID() }, context);
    const op = randomUUID(); await f.gate.enterMaintenance({ operationId: op, owner: 'installer', leaseUntil: 0, expectedGeneration: 0 });
    await expect(f.gate.markExclusive(op, 0)).rejects.toMatchObject({ code: 'JOBS_NOT_DRAINED' });
    await expect(f.jobs.claim({ owner: 'candidate', now: 1001, leaseMs: 30_000 }, context)).rejects.toMatchObject({ code: 'MAINTENANCE_ACTIVE' });
    await f.jobs.commit(job.id, job.lease!, 'before upgrade', 1001, context); await f.gate.markExclusive(op, 0);
    const before = f.db.prepare('SELECT write_generation FROM maintenance_generation').get();
    await expect(f.jobs.commit(job.id, job.lease!, 'late', 1002, context)).rejects.toMatchObject({ code: 'MAINTENANCE_ACTIVE' });
    const candidate = { expectedGeneration: 0, selfcheck: { operationId: op, generation: 0 } };
    const check = await f.jobs.enqueue({ ...f.req, idempotencyKey: randomUUID() }, candidate);
    const claimed = (await f.jobs.claim({ owner: 'candidate', now: 1002, leaseMs: 30_000 }, candidate))!;
    expect(claimed.id).toBe(check.id); await f.jobs.commit(check.id, claimed.lease!, 'candidate value', 1003, candidate);
    expect(f.db.prepare('SELECT write_generation FROM maintenance_generation').get()).toEqual(before);
    expect((await f.jobs.query(backlog.id, f.req.scope))?.lastSuccessResult).toBe('before upgrade');
    await f.gate.exitMaintenance(op, 0);
    await expect(f.jobs.claim({ owner: 'old', now: 1004, leaseMs: 30_000 }, context)).rejects.toMatchObject({ code: 'GENERATION_MISMATCH' });
    const resumed = (await f.jobs.claim({ owner: 'new', now: 1004, leaseMs: 30_000 }, { expectedGeneration: 1 }))!;
    expect(resumed).toMatchObject({ id: backlog.id, generation: 1 });
    await f.jobs.commit(resumed.id, resumed.lease!, 'after upgrade', 1005, { expectedGeneration: 1 });
  });
  it('bounded SQLite busy failure never destroys a previous result', async () => {
    const f = fixture(); const job = await running(f); await f.jobs.commit(job.id, job.lease!, 'preserved', 1001, context);
    const locked = join(f.h.root, 'locked.json');
    const child = f.h.spawn(['--experimental-transform-types', '--input-type=module', '-e', childScript(f.path, `db.exec('BEGIN IMMEDIATE');writeFileSync(${JSON.stringify(locked)},'ready');setInterval(()=>{},1000);`)]);
    await waitFile(locked); const start = Date.now();
    await expect(f.jobs.enqueue({ ...f.req, idempotencyKey: randomUUID() }, context)).rejects.toMatchObject({ code: 'SQLITE_BUSY' });
    expect(Date.now() - start).toBeLessThan(3500); await f.h.stop(child);
    expect((await f.jobs.query(job.id, f.req.scope))?.result).toBe('preserved');
  });
  it('actual SQLite disk-full limit rolls back transaction without erasing success', async () => {
    const f = fixture(); const job = await running(f); await f.jobs.commit(job.id, job.lease!, 'preserved', 1001, context);
    const pages = f.db.pragma('page_count', { simple: true }) as number; f.db.pragma(`max_page_count = ${pages}`);
    let code: string | undefined;
    for (let i = 0; i < 100 && !code; i++) {
      try { await f.jobs.enqueue({ ...f.req, value: 'x'.repeat(4096), idempotencyKey: randomUUID() }, context); }
      catch (error) { code = (error as { code: string }).code; }
    }
    expect(code).toBe('SQLITE_FULL'); expect((await f.jobs.query(job.id, f.req.scope))?.result).toBe('preserved');
    expect(f.db.pragma('integrity_check', { simple: true })).toBe('ok');
  });
});
