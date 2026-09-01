import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { createHarness } from '../../packages/test-support/src/harness.js';
import { openDatabase } from '../../packages/persistence/src/database.js';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });

function databasePath(name = 'auth.sqlite') {
  const harness = createHarness();
  cleanups.push(() => harness.cleanup());
  return join(harness.root, name);
}

function createV1(path: string) {
  const db = new Database(path);
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, schema_min INTEGER NOT NULL, schema_max INTEGER NOT NULL, applied_at INTEGER NOT NULL);
    INSERT INTO schema_migrations VALUES(1,1,1,1000);
    CREATE TABLE maintenance_generation(id INTEGER PRIMARY KEY CHECK(id=1), generation INTEGER NOT NULL DEFAULT 0, write_generation INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL CHECK(state IN ('open','quiescing','exclusive')), operation_id TEXT, owner TEXT, lease_until INTEGER);
    INSERT INTO maintenance_generation(id,generation,write_generation,state,operation_id,owner,lease_until) VALUES(1,7,11,'exclusive','${randomUUID()}','installer',9000);
    CREATE TABLE jobs(id TEXT PRIMARY KEY, scope TEXT NOT NULL, idempotency_key TEXT NOT NULL, payload_hash TEXT NOT NULL, request TEXT NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('queued','running','retry_wait','succeeded','failed','cancelled')),
      attempt INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 3 CHECK(max_attempts BETWEEN 1 AND 3), next_run_at INTEGER,
      lease_owner TEXT, lease_until INTEGER, lease_ms INTEGER, fence INTEGER NOT NULL DEFAULT 0, cancel_requested INTEGER NOT NULL DEFAULT 0,
      checkpoint TEXT, result TEXT, error_code TEXT, generation INTEGER NOT NULL, operation_id TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      UNIQUE(scope,idempotency_key));
    CREATE INDEX jobs_ready ON jobs(state,next_run_at,created_at);
    CREATE TABLE synthetic_results(job_id TEXT PRIMARY KEY REFERENCES jobs(id), scope TEXT NOT NULL, kind TEXT NOT NULL, result TEXT NOT NULL, committed_at INTEGER NOT NULL);
    CREATE INDEX synthetic_latest ON synthetic_results(scope,kind,committed_at DESC);
    CREATE TABLE runtime_observations(key TEXT PRIMARY KEY, observation TEXT NOT NULL, checked_at INTEGER NOT NULL);
    CREATE TABLE runtime_status(key TEXT PRIMARY KEY, projection TEXT NOT NULL, last_success TEXT, checked_at INTEGER, generation INTEGER NOT NULL, operation_id TEXT);
    PRAGMA user_version = 1;
  `);
  return db;
}

function phase2Tables(db: Database.Database) {
  return db.prepare(`SELECT name FROM sqlite_schema WHERE type='table' AND name IN
    ('source_configs','source_observations','account_bindings','profile_ownership','uat_receipts') ORDER BY name`).pluck().all();
}

describe('schema v2 migration', () => {
  it('preserves every Phase 1 row while atomically migrating and reopening schema v2', () => {
    const path = databasePath();
    const v1 = createV1(path);
    const jobId = randomUUID();
    const scope = JSON.stringify({ installationId: randomUUID(), source: 'synthetic', courseId: 'selftest' });
    const request = JSON.stringify({ kind: 'echo', value: 'retained', idempotencyKey: randomUUID(), scope: JSON.parse(scope) });
    v1.prepare(`INSERT INTO jobs(id,scope,idempotency_key,payload_hash,request,state,attempt,max_attempts,fence,cancel_requested,result,generation,created_at,updated_at)
      VALUES(?,?,?,?,?,'succeeded',1,3,2,0,'retained',7,1000,1001)`).run(jobId, scope, randomUUID(), 'a'.repeat(64), request);
    v1.prepare('INSERT INTO synthetic_results VALUES(?,?,?,?,?)').run(jobId, scope, 'echo', 'retained', 1001);
    v1.prepare('INSERT INTO runtime_observations VALUES(?,?,?)').run('api', '{"health":"healthy"}', 1002);
    v1.prepare('INSERT INTO runtime_status VALUES(?,?,?,?,?,?)').run('api', '{"health":"healthy"}', '{"health":"healthy"}', 1002, 7, null);
    const before = {
      gate: v1.prepare('SELECT * FROM maintenance_generation').get(),
      jobs: v1.prepare('SELECT * FROM jobs').all(),
      results: v1.prepare('SELECT * FROM synthetic_results').all(),
      observations: v1.prepare('SELECT * FROM runtime_observations').all(),
      status: v1.prepare('SELECT * FROM runtime_status').all(),
    };
    v1.close();

    const migrated = openDatabase(path);
    expect(migrated.pragma('user_version', { simple: true })).toBe(2);
    expect(phase2Tables(migrated)).toEqual(['account_bindings', 'profile_ownership', 'source_configs', 'source_observations', 'uat_receipts']);
    expect(migrated.prepare('SELECT * FROM maintenance_generation').get()).toEqual(before.gate);
    expect(migrated.prepare('SELECT * FROM jobs').all()).toEqual(before.jobs);
    expect(migrated.prepare('SELECT * FROM synthetic_results').all()).toEqual(before.results);
    expect(migrated.prepare('SELECT * FROM runtime_observations').all()).toEqual(before.observations);
    expect(migrated.prepare('SELECT * FROM runtime_status').all()).toEqual(before.status);
    expect(migrated.pragma('foreign_key_check')).toEqual([]);
    expect(migrated.pragma('integrity_check', { simple: true })).toBe('ok');
    migrated.close();

    const reopened = openDatabase(path);
    try {
      expect(reopened.pragma('user_version', { simple: true })).toBe(2);
      expect(reopened.prepare('SELECT version,schema_min,schema_max FROM schema_migrations ORDER BY version').all()).toEqual([
        { version: 1, schema_min: 1, schema_max: 1 },
        { version: 2, schema_min: 2, schema_max: 2 },
      ]);
      expect(reopened.prepare('SELECT result FROM synthetic_results WHERE job_id=?').get(jobId)).toEqual({ result: 'retained' });
    } finally { reopened.close(); }
  });

  it('rolls back every schema v2 migration statement after an injected SQL failure', () => {
    const path = databasePath();
    const v1 = createV1(path);
    v1.prepare(`CREATE TRIGGER reject_v2 BEFORE INSERT ON schema_migrations WHEN NEW.version=2 BEGIN SELECT RAISE(ABORT,'injected migration failure'); END`).run();
    const gate = v1.prepare('SELECT * FROM maintenance_generation').get();
    v1.close();

    expect(() => openDatabase(path)).toThrow('injected migration failure');
    const failed = new Database(path);
    expect(failed.pragma('user_version', { simple: true })).toBe(1);
    expect(failed.prepare('SELECT * FROM maintenance_generation').get()).toEqual(gate);
    expect(phase2Tables(failed)).toEqual([]);
    expect(failed.prepare('SELECT version FROM schema_migrations ORDER BY version').pluck().all()).toEqual([1]);
    failed.prepare('DROP TRIGGER reject_v2').run();
    failed.close();

    const retried = openDatabase(path);
    try { expect(retried.pragma('user_version', { simple: true })).toBe(2); }
    finally { retried.close(); }
  });

  it('creates fresh databases through the ordered migration chain and rejects forged metadata', () => {
    const freshPath = databasePath('fresh.sqlite');
    const fresh = openDatabase(freshPath);
    expect(fresh.prepare('SELECT version,schema_min,schema_max FROM schema_migrations ORDER BY version').all()).toEqual([
      { version: 1, schema_min: 1, schema_max: 1 },
      { version: 2, schema_min: 2, schema_max: 2 },
    ]);
    fresh.close();

    const futurePath = databasePath('future.sqlite');
    const future = createV1(futurePath); future.pragma('user_version = 3'); future.close();
    expect(() => openDatabase(futurePath)).toThrow('SCHEMA_INCOMPATIBLE');

    const missingPath = databasePath('missing.sqlite');
    const missing = createV1(missingPath); missing.prepare('DELETE FROM schema_migrations').run(); missing.close();
    expect(() => openDatabase(missingPath)).toThrow('SCHEMA_INCOMPATIBLE');

    const forgedPath = databasePath('forged.sqlite');
    const forged = createV1(forgedPath); forged.prepare('UPDATE schema_migrations SET schema_max=2').run(); forged.close();
    expect(() => openDatabase(forgedPath)).toThrow('SCHEMA_INCOMPATIBLE');
  });

  it('has no schema v2 column or generic dump capable of persisting prohibited captures', () => {
    const path = databasePath(); const db = openDatabase(path);
    try {
      const schema = db.prepare("SELECT name,sql FROM sqlite_schema WHERE type='table' ORDER BY name").all() as { name: string; sql: string }[];
      const phase2 = schema.filter(row => phase2Tables(db).includes(row.name));
      const columns = phase2.flatMap(row => (db.pragma(`table_info(${row.name})`) as { name: string; type: string }[]).map(column => column.name));
      expect(columns.join('|')).not.toMatch(/profile.*path|cookie|storage|password|mfa|input|dom|html|request|response|full.*name|email|course.*(?:name|title)|screenshot|har|trace|video|console|(?:^|_)(?:blob|dump)(?:_|$)/i);
      expect(phase2.map(row => row.sql).join('\n')).not.toMatch(/profile.*path|cookie|storage_state|password|mfa|raw_(?:dom|html|network)|screenshot|har|trace|video|console/i);
    } finally { db.close(); }
  });
});
