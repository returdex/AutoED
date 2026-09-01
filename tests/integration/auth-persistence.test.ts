import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { createHarness } from '../../packages/test-support/src/harness.js';
import { openDatabase, SQLiteMaintenanceStore } from '../../packages/persistence/src/database.js';
import {
  SQLiteAccountBindingStore, SQLiteProfileOwnershipStore, SQLiteSourceConfigStore, SQLiteSourceObservationStore,
} from '../../packages/persistence/src/auth.js';
import type {
  AccountBinding, ApprovedSourceConfig, ProfileOwnerIdentity, ProfileReservation, SourceId, SourceObservation,
} from '../../packages/domain/src/model.js';

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

const writeContext = { expectedGeneration: 0 };
const scopeId = randomUUID();
const fp = (character: string) => character.repeat(64);
const at = (value: number) => new Date(value).toISOString();
function config(source: SourceId, now: number, id = randomUUID()): ApprovedSourceConfig {
  return { id, source, officialOrigin: source === 'moodle' ? 'https://moodle.example.edu' : 'https://edstem.org', approvedScopeId: scopeId, confirmedAt: at(now) };
}
function success(source: SourceId, now: number): SourceObservation {
  return {
    source, auth: 'authenticated', capability: 'available', health: 'healthy', freshness: 'fresh', completeness: 'complete',
    outcome: 'present', checkedAt: at(now), resultCode: 'AUTHENTICATED', courseAccess: 'allowed',
    lastSuccess: { checkedAt: at(now), subjectFingerprint: fp(source === 'moodle' ? 'a' : 'b') },
  };
}
function failure(source: SourceId, now: number, resultCode: SourceObservation['resultCode']): SourceObservation {
  const auth = resultCode === 'REAUTH_REQUIRED' ? 'reauth_required' as const : 'authenticated' as const;
  return {
    source, auth, capability: resultCode === 'CAPABILITY_DENIED' ? 'denied' : 'available', health: 'error', freshness: 'stale', completeness: 'partial',
    outcome: 'error', checkedAt: at(now), resultCode, courseAccess: resultCode === 'NETWORK_UNAVAILABLE' || resultCode === 'PARSER_CHANGED' ? 'allowed' : 'blocked',
    lastSuccess: { checkedAt: at(now), subjectFingerprint: fp('z') },
  };
}
function binding(now: number, status: AccountBinding['status'] = 'confirmed'): AccountBinding {
  return {
    status,
    moodle: { source: 'moodle', subjectFingerprint: fp('a'), organizationFingerprint: fp('c'), tenantFingerprint: null, approvedScopeId: scopeId, evidenceKind: 'stable_subject_organization_scope' },
    edstem: { source: 'edstem', subjectFingerprint: fp(status === 'identity_mismatch' ? 'd' : 'a'), organizationFingerprint: fp('c'), tenantFingerprint: null, approvedScopeId: scopeId, evidenceKind: 'stable_subject_organization_scope' },
    basis: status === 'confirmed' ? 'human_confirmed' : status === 'candidate' ? 'stable_subject_organization_scope' : 'identity_changed',
    confirmedByActionReceiptId: status === 'confirmed' ? randomUUID() : null,
    courseAccess: status === 'confirmed' ? 'allowed' : 'blocked', checkedAt: at(now),
  };
}
function reservation(now: number): ProfileReservation {
  return { installationId: randomUUID(), browserBuildId: fp('a'), nonce: randomUUID(), generation: 0, fence: 0, reservedAt: at(now) };
}
function owner(value: ProfileReservation, now: number): ProfileOwnerIdentity {
  return { ...value, pid: 1234, osStartIdentity: 'managed-process-start-1', executable: '/managed/browser', startedAt: at(now) };
}

describe('source stores and last success', () => {
  it('accepts only strict approved source origins and persists versioned source-isolated configuration', async () => {
    const path = databasePath(); const db = openDatabase(path); let now = 1000;
    const store = new SQLiteSourceConfigStore(db, { now: () => now });
    await store.confirm(config('moodle', now), writeContext);
    await store.confirm(config('edstem', now), writeContext);
    expect(await store.read('moodle')).toMatchObject({ source: 'moodle', officialOrigin: 'https://moodle.example.edu' });
    expect(await store.read('edstem')).toMatchObject({ source: 'edstem', officialOrigin: 'https://edstem.org' });
    now++;
    const replacement = config('moodle', now);
    await store.confirm(replacement, writeContext);
    expect(await store.read('moodle')).toEqual(replacement);
    expect(db.prepare("SELECT config_version FROM source_configs WHERE source='moodle' ORDER BY config_version").pluck().all()).toEqual([1, 2]);
    const writes = db.prepare('SELECT write_generation AS n FROM maintenance_generation').get();
    await expect(store.confirm({ ...config('moodle', now), officialOrigin: 'https://moodle.example.edu/path?capture=1' }, writeContext)).rejects.toThrow();
    await expect(store.confirm({ ...config('moodle', now), selector: '#account' } as ApprovedSourceConfig, writeContext)).rejects.toThrow();
    expect(db.prepare('SELECT write_generation AS n FROM maintenance_generation').get()).toEqual(writes);
    db.close();
    const reopened = openDatabase(path);
    try { expect(await new SQLiteSourceConfigStore(reopened).read('moodle')).toEqual(replacement); }
    finally { reopened.close(); }
  });

  it('retains per-source last success through network parser capability and reauth failures', async () => {
    const path = databasePath(); const db = openDatabase(path); let now = 1000;
    const store = new SQLiteSourceObservationStore(db, { now: () => now });
    const moodleSuccess = success('moodle', now); const edstemSuccess = success('edstem', now);
    await store.write(moodleSuccess, writeContext); await store.write(edstemSuccess, writeContext);
    for (const code of ['NETWORK_UNAVAILABLE', 'PARSER_CHANGED', 'CAPABILITY_DENIED', 'REAUTH_REQUIRED'] as const) {
      now++;
      await store.write(failure('moodle', now, code), writeContext);
      expect((await store.read('moodle'))?.lastSuccess).toEqual(moodleSuccess.lastSuccess);
      expect(await store.read('edstem')).toEqual(edstemSuccess);
    }
    const writes = db.prepare('SELECT write_generation AS n FROM maintenance_generation').get();
    await expect(store.write(failure('moodle', now, 'NETWORK_UNAVAILABLE'), writeContext)).rejects.toMatchObject({ code: 'STALE_OBSERVATION' });
    now += 10_000;
    await expect(store.write(failure('moodle', now + 1, 'NETWORK_UNAVAILABLE'), writeContext)).rejects.toMatchObject({ code: 'FUTURE_OBSERVATION' });
    expect(db.prepare('SELECT write_generation AS n FROM maintenance_generation').get()).toEqual(writes);
    db.close();
    const reopened = openDatabase(path);
    try { expect((await new SQLiteSourceObservationStore(reopened).read('moodle'))?.lastSuccess).toEqual(moodleSuccess.lastSuccess); }
    finally { reopened.close(); }
  });

  it('rejects stale generation writes without partially changing source state', async () => {
    const path = databasePath(); const db = openDatabase(path); let now = 1000;
    const store = new SQLiteSourceObservationStore(db, { now: () => now });
    await store.write(success('moodle', now), writeContext);
    const maintenance = new SQLiteMaintenanceStore(db); const operationId = randomUUID();
    await maintenance.enterMaintenance({ operationId, owner: 'installer', leaseUntil: 9000, expectedGeneration: 0 });
    await maintenance.markExclusive(operationId, 0); await maintenance.exitMaintenance(operationId, 0);
    now++;
    await expect(store.write(failure('moodle', now, 'NETWORK_UNAVAILABLE'), writeContext)).rejects.toMatchObject({ code: 'GENERATION_MISMATCH' });
    expect((await store.read('moodle'))?.resultCode).toBe('AUTHENTICATED');
    db.close();
  });
});

describe('binding persistence', () => {
  it('keeps the prior confirmed binding while a changed stable subject creates a blocking mismatch event', async () => {
    const path = databasePath(); const db = openDatabase(path); let now = 1000;
    const store = new SQLiteAccountBindingStore(db, { now: () => now });
    await store.write(binding(now, 'candidate'), writeContext); now++;
    const confirmed = binding(now); await store.write(confirmed, writeContext);
    now++;
    const mismatch = binding(now, 'identity_mismatch'); await store.write(mismatch, writeContext);
    expect(await store.read()).toEqual(mismatch);
    expect(db.prepare('SELECT status,course_access FROM account_bindings ORDER BY checked_at').all()).toEqual([
      { status: 'candidate', course_access: 'blocked' }, { status: 'confirmed', course_access: 'allowed' },
      { status: 'identity_mismatch', course_access: 'blocked' },
    ]);
    const writes = db.prepare('SELECT write_generation AS n FROM maintenance_generation').get();
    await expect(store.write({ ...binding(now + 1), displayName: 'same display', schoolEmail: 'same@example.edu' } as AccountBinding, writeContext)).rejects.toThrow();
    expect(db.prepare('SELECT write_generation AS n FROM maintenance_generation').get()).toEqual(writes);
    db.close();
  });
});

describe('profile ownership persistence', () => {
  it('allows only one acquiring connection and rejects expired leases and stale fences until confirmed exit', async () => {
    const path = databasePath(); const firstDb = openDatabase(path); const secondDb = openDatabase(path); let now = 1000;
    const first = new SQLiteProfileOwnershipStore(firstDb, { now: () => now });
    const second = new SQLiteProfileOwnershipStore(secondDb, { now: () => now });
    const request = reservation(now);
    const [winner, loser] = await Promise.allSettled([first.acquire(request, writeContext), second.acquire({ ...reservation(now), installationId: request.installationId }, writeContext)]);
    expect([winner.status, loser.status].sort()).toEqual(['fulfilled', 'rejected']);
    const acquired = winner.status === 'fulfilled' ? winner.value : (loser as PromiseFulfilledResult<Awaited<ReturnType<typeof second.acquire>>>).value;
    const store = winner.status === 'fulfilled' ? first : second;
    expect(acquired).toMatchObject({ state: 'reserved', reservation: { fence: 1 } });
    const rawOwner = owner(acquired.reservation!, now);
    now = acquired.leaseUntil! + 1;
    await expect(first.acquire(reservation(now), writeContext)).rejects.toMatchObject({ code: 'PROFILE_IN_USE' });
    const owned = await store.renew(rawOwner, now + 60_000, writeContext);
    expect(owned).toMatchObject({ state: 'owned', owner: { fence: 1 } });
    await expect(store.renew({ ...rawOwner, fence: 0 }, now + 60_001, writeContext)).rejects.toMatchObject({ code: 'PROFILE_FENCE_MISMATCH' });
    await expect(store.release(rawOwner, writeContext)).rejects.toMatchObject({ code: 'PROFILE_EXIT_UNCONFIRMED' });
    const exited = await store.markConfirmedExited(rawOwner, writeContext);
    expect(exited.state).toBe('confirmed_exited');
    await store.release(rawOwner, writeContext);
    expect(await store.read()).toMatchObject({ state: 'available' });
    const next = await first.acquire(reservation(now), writeContext);
    expect(next.reservation?.fence).toBe(2);
    await expect(store.renew(rawOwner, now + 120_000, writeContext)).rejects.toMatchObject({ code: 'PROFILE_FENCE_MISMATCH' });
    firstDb.close(); secondDb.close();
  });

  it('reopens with only irreversible owner proof and excludes rejected identity sentinels from DB WAL and backup', async () => {
    const path = databasePath(); const backupPath = databasePath('auth.backup.sqlite'); const db = openDatabase(path); const now = 1000;
    const store = new SQLiteProfileOwnershipStore(db, { now: () => now });
    const request = reservation(now); const acquired = await store.acquire(request, writeContext);
    const rawOwner = owner(acquired.reservation!, now); await store.renew(rawOwner, now + 60_001, writeContext);
    const sentinels = ['PROHIBITED_PROFILE_LOCATION', 'PROHIBITED_COOKIE_VALUE', 'PROHIBITED_PERSON_EMAIL'];
    const configs = new SQLiteSourceConfigStore(db, { now: () => now });
    await expect(configs.confirm({ ...config('moodle', now), profilePath: sentinels[0], cookie: sentinels[1], schoolEmail: sentinels[2] } as ApprovedSourceConfig, writeContext)).rejects.toThrow();
    await db.backup(backupPath);
    const persisted = Buffer.concat([readFileSync(path), readFileSync(`${path}-wal`), readFileSync(backupPath)]).toString('utf8');
    for (const sentinel of sentinels) expect(persisted).not.toContain(sentinel);
    db.close();
    const reopened = openDatabase(path);
    try {
      const read = await new SQLiteProfileOwnershipStore(reopened).read();
      expect(read.state).toBe('owned');
      expect(read.owner?.nonce).not.toBe(rawOwner.nonce);
      expect(reopened.prepare('SELECT nonce_hash,control_proof_fingerprint,managed_executable_identity FROM profile_ownership').get()).toMatchObject({
        nonce_hash: expect.stringMatching(/^[a-f0-9]{64}$/), control_proof_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/), managed_executable_identity: expect.stringMatching(/^[a-f0-9]{64}$/),
      });
    } finally { reopened.close(); }
  });
});
