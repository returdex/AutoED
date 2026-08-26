import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { createHarness } from '../../packages/test-support/src/harness.js';
import { openDatabase, assertSQLiteIdentity, SQLiteMaintenanceStore } from '../../packages/persistence/src/database.js';
import { JobRepository } from '../../packages/persistence/src/jobs.js';
import { SQLiteStatusProjectionStore } from '../../packages/persistence/src/runtime-status.js';
import type { JobRequest } from '../../packages/domain/src/model.js';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
function fixture() {
  const h = createHarness(); cleanups.push(() => h.cleanup());
  const path = join(h.root, 'jobs.sqlite');
  const db = openDatabase(path); cleanups.push(async () => { if (db.open) db.close(); });
  return { db, path, h, jobs: new JobRepository(db, { now: () => 1000 }), gate: new SQLiteMaintenanceStore(db) };
}
const request = (): JobRequest => ({ kind: 'echo', value: 'synthetic value', idempotencyKey: randomUUID(), scope: { installationId: randomUUID(), source: 'synthetic', courseId: 'selftest' } });
const context = { expectedGeneration: 0 };

describe('real SQLite durable storage', () => {
  it('reopens persisted jobs with safe SQLite settings and exact approved engine', async () => {
    const { db, path, jobs } = fixture(); const req = request();
    const job = await jobs.enqueue(req, context);
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(db.pragma('synchronous', { simple: true })).toBe(2);
    expect(db.pragma('busy_timeout', { simple: true })).toBe(2000);
    db.close(); const reopened = openDatabase(path);
    try { expect(await new JobRepository(reopened).query(job.id, req.scope)).toEqual(job); }
    finally { reopened.close(); }
    expect(() => assertSQLiteIdentity({ version: '3.53.3', sourceId: 'wrong' })).toThrow('SQLITE_IDENTITY_MISMATCH');
    expect(() => assertSQLiteIdentity({ version: '3.53.4', sourceId: 'wrong' })).toThrow('SQLITE_IDENTITY_MISMATCH');
  });
  it('deduplicates equal payloads, rejects conflicts and isolates scope', async () => {
    const { jobs } = fixture(); const req = request();
    const [a, b] = await Promise.all([jobs.enqueue(req, context), jobs.enqueue(req, context)]);
    expect(a.id).toBe(b.id);
    await expect(jobs.enqueue({ ...req, value: 'changed' }, context)).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', statusCode: 409 });
    expect(await jobs.query(a.id, { ...req.scope, installationId: randomUUID() })).toBeNull();
  });
  it('maintenance persists, never clears expired locks, and only admits matching operation selfchecks', async () => {
    const { gate, jobs, db, path } = fixture(); const operationId = randomUUID();
    await gate.enterMaintenance({ operationId, owner: 'installer', leaseUntil: 1, expectedGeneration: 0 });
    await expect(jobs.enqueue(request(), context)).rejects.toMatchObject({ code: 'MAINTENANCE_ACTIVE' });
    await gate.markExclusive(operationId, 0);
    const selfcheck = { expectedGeneration: 0, selfcheck: { operationId, generation: 0 } };
    await jobs.enqueue(request(), selfcheck);
    expect(db.prepare('SELECT write_generation AS n FROM maintenance_generation').get()).toEqual({ n: 0 });
    await expect(jobs.enqueue(request(), { ...selfcheck, selfcheck: { ...selfcheck.selfcheck, operationId: randomUUID() } })).rejects.toMatchObject({ code: 'MAINTENANCE_ACTIVE' });
    db.close(); const reopened = openDatabase(path);
    try {
      const restored = new SQLiteMaintenanceStore(reopened);
      expect((await restored.read()).state).toBe('exclusive');
      expect((await restored.exitMaintenance(operationId, 0)).generation).toBe(1);
      await expect(new JobRepository(reopened).enqueue(request(), context)).rejects.toMatchObject({ code: 'GENERATION_MISMATCH' });
    } finally { reopened.close(); }
  });
  it('rejects unknown schema instead of silently downgrading', () => {
    const { db, path } = fixture(); db.pragma('user_version = 2'); db.close();
    expect(() => openDatabase(path)).toThrow('SCHEMA_INCOMPATIBLE');
  });
  it('persists sanitized status, keeps success on error, expires freshness without changing health, and fences stale projections', async () => {
    const { db, gate } = fixture(); let now = 1000;
    const status = new SQLiteStatusProjectionStore(db, { now: () => now }, 1000);
    expect(await status.read()).toMatchObject({ api: null, worker: null });
    const observed = { role: 'api' as const, build: null, checkedAt: new Date(now).toISOString(), health: 'error' as const, evidence: 'process_report' as const };
    await status.writeComponent(observed, { expectedGeneration: 0, operationId: null });
    now = 3000;
    expect((await status.read()).api).toMatchObject({ health: 'error', freshness: 'stale', checkedAt: observed.checkedAt });
    await expect(status.writeComponent({ ...observed, secret: 'must-not-persist' } as typeof observed, { expectedGeneration: 0, operationId: null })).rejects.toThrow();
    const op = randomUUID(); await gate.enterMaintenance({ operationId: op, owner: 'installer', leaseUntil: 9000, expectedGeneration: 0 });
    await expect(status.writeComponent(observed, { expectedGeneration: 0, operationId: null })).rejects.toMatchObject({ code: 'MAINTENANCE_ACTIVE' });
    await status.writeInstall({ operationId: op, stage: 'complete', result: 'succeeded', cleanup: 'complete', targetBuild: null, actualBuild: null, checkedAt: new Date(now).toISOString() }, { expectedGeneration: 0, operationId: op });
    now += 1;
    await status.writeInstall({ operationId: op, stage: 'stopped', result: 'failed', cleanup: 'cleanup_pending', targetBuild: null, actualBuild: null, checkedAt: new Date(now).toISOString() }, { expectedGeneration: 0, operationId: op });
    expect(db.prepare("SELECT last_success FROM runtime_status WHERE key='install'").get()).toMatchObject({ last_success: expect.stringContaining('succeeded') });
    expect((await status.read()).install?.result).toBe('failed');
  });
});
