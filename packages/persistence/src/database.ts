import Database from 'better-sqlite3';
import type { MaintenanceStore } from '../../application/src/ports.js';
import type { MaintenanceGate, WriteContext } from '../../domain/src/model.js';
import { MaintenanceGateSchema } from '../../contracts/src/index.js';

export const SQLITE_IDENTITY = Object.freeze({ version: '3.53.4', sourceId: '2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc' });
export class StorageError extends Error {
  constructor(public readonly code: string, public readonly statusCode = 409) { super(code); }
}
export function assertSQLiteIdentity(identity: { version: string; sourceId: string }): void {
  if (identity.version !== SQLITE_IDENTITY.version || identity.sourceId !== SQLITE_IDENTITY.sourceId) throw new StorageError('SQLITE_IDENTITY_MISMATCH', 503);
}

const MIGRATION_V1 = `
  CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, schema_min INTEGER NOT NULL, schema_max INTEGER NOT NULL, applied_at INTEGER NOT NULL);
  INSERT INTO schema_migrations VALUES(1,1,1,unixepoch()*1000);
  CREATE TABLE maintenance_generation(id INTEGER PRIMARY KEY CHECK(id=1), generation INTEGER NOT NULL DEFAULT 0, write_generation INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL CHECK(state IN ('open','quiescing','exclusive')), operation_id TEXT, owner TEXT, lease_until INTEGER);
  INSERT INTO maintenance_generation(id,state) VALUES(1,'open');
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
`;

const MIGRATION_V2 = `
  CREATE TABLE source_configs(
    id TEXT PRIMARY KEY CHECK(length(id)=36),
    source TEXT NOT NULL CHECK(source IN ('moodle','edstem')),
    official_origin TEXT NOT NULL CHECK(length(official_origin) BETWEEN 9 AND 2048),
    approved_scope_id TEXT NOT NULL CHECK(length(approved_scope_id)=36),
    confirmed_at INTEGER NOT NULL CHECK(confirmed_at>=0),
    config_version INTEGER NOT NULL CHECK(config_version>0),
    generation INTEGER NOT NULL CHECK(generation>=0),
    UNIQUE(source,config_version), UNIQUE(source,id));
  CREATE INDEX source_configs_latest ON source_configs(source,config_version DESC);

  CREATE TABLE source_observations(
    source TEXT PRIMARY KEY CHECK(source IN ('moodle','edstem')),
    current_contract TEXT NOT NULL CHECK(length(current_contract) BETWEEN 2 AND 8192),
    last_success_contract TEXT CHECK(last_success_contract IS NULL OR length(last_success_contract) BETWEEN 2 AND 1024),
    checked_at INTEGER CHECK(checked_at IS NULL OR checked_at>=0),
    generation INTEGER NOT NULL CHECK(generation>=0));

  CREATE TABLE account_bindings(
    event_id TEXT PRIMARY KEY CHECK(length(event_id)=36),
    status TEXT NOT NULL CHECK(status IN ('candidate','confirmed','identity_mismatch')),
    moodle_subject_fingerprint TEXT NOT NULL CHECK(length(moodle_subject_fingerprint) BETWEEN 8 AND 128),
    moodle_organization_fingerprint TEXT NOT NULL CHECK(length(moodle_organization_fingerprint) BETWEEN 8 AND 128),
    moodle_tenant_fingerprint TEXT CHECK(moodle_tenant_fingerprint IS NULL OR length(moodle_tenant_fingerprint) BETWEEN 8 AND 128),
    moodle_scope_id TEXT NOT NULL CHECK(length(moodle_scope_id)=36),
    edstem_subject_fingerprint TEXT NOT NULL CHECK(length(edstem_subject_fingerprint) BETWEEN 8 AND 128),
    edstem_organization_fingerprint TEXT NOT NULL CHECK(length(edstem_organization_fingerprint) BETWEEN 8 AND 128),
    edstem_tenant_fingerprint TEXT CHECK(edstem_tenant_fingerprint IS NULL OR length(edstem_tenant_fingerprint) BETWEEN 8 AND 128),
    edstem_scope_id TEXT NOT NULL CHECK(length(edstem_scope_id)=36),
    basis TEXT NOT NULL CHECK(basis IN ('stable_subject_organization_scope','human_confirmed','identity_changed')),
    confirmed_action_receipt_id TEXT CHECK(confirmed_action_receipt_id IS NULL OR length(confirmed_action_receipt_id)=36),
    course_access TEXT NOT NULL CHECK(course_access IN ('allowed','blocked')),
    checked_at INTEGER NOT NULL CHECK(checked_at>=0),
    generation INTEGER NOT NULL CHECK(generation>=0));
  CREATE INDEX account_bindings_latest ON account_bindings(checked_at DESC,event_id DESC);

  CREATE TABLE profile_ownership(
    id INTEGER PRIMARY KEY CHECK(id=1),
    installation_id TEXT NOT NULL CHECK(length(installation_id)=36),
    browser_build_id TEXT NOT NULL CHECK(length(browser_build_id)=64),
    pid INTEGER,
    nonce_hash TEXT NOT NULL CHECK(length(nonce_hash)=64),
    control_proof_fingerprint TEXT NOT NULL CHECK(length(control_proof_fingerprint)=64),
    os_start_identity TEXT,
    managed_executable_identity TEXT,
    reserved_at INTEGER NOT NULL CHECK(reserved_at>=0),
    started_at INTEGER,
    lease_until INTEGER NOT NULL CHECK(lease_until>=0),
    generation INTEGER NOT NULL CHECK(generation>=0),
    fence INTEGER NOT NULL CHECK(fence>0),
    state TEXT NOT NULL CHECK(state IN ('reserved','owned','in_use','unconfirmed','confirmed_exited')),
    CHECK((state='reserved' AND pid IS NULL AND os_start_identity IS NULL AND managed_executable_identity IS NULL AND started_at IS NULL)
      OR (state<>'reserved' AND pid>0 AND os_start_identity IS NOT NULL AND length(os_start_identity) BETWEEN 1 AND 256
        AND managed_executable_identity IS NOT NULL AND length(managed_executable_identity)=64 AND started_at>=0)));

  CREATE TABLE uat_receipts(
    event_id TEXT PRIMARY KEY CHECK(length(event_id)=36),
    receipt_id TEXT NOT NULL UNIQUE CHECK(length(receipt_id)=36),
    idempotency_hash TEXT NOT NULL CHECK(length(idempotency_hash)=64),
    prior_event_id TEXT REFERENCES uat_receipts(event_id),
    schema_version INTEGER NOT NULL CHECK(schema_version=1),
    build_id TEXT NOT NULL CHECK(length(build_id)=64),
    artifact_id TEXT NOT NULL CHECK(length(artifact_id)=64),
    version TEXT NOT NULL CHECK(length(version) BETWEEN 5 AND 64),
    platform TEXT NOT NULL CHECK(platform IN ('macos','windows')),
    source TEXT NOT NULL CHECK(source IN ('moodle','edstem')),
    scenario TEXT NOT NULL CHECK(scenario IN ('a.login','a.binding','a.course_visibility','b.reopen_1','b.reopen_2','b.reopen_3','b.worker_restart','b.codex_exit','c.os_restart','d.24h_recheck','reauth')),
    evidence TEXT NOT NULL CHECK(evidence IN ('S','I','N','L')),
    status TEXT NOT NULL CHECK(status IN ('pass','fail','not_run','human_needed')),
    result_code TEXT NOT NULL CHECK(length(result_code) BETWEEN 1 AND 128),
    binding_consistency TEXT NOT NULL CHECK(binding_consistency IN ('consistent','mismatch','not_observed')),
    gap_codes TEXT NOT NULL CHECK(length(gap_codes) BETWEEN 2 AND 4096),
    observed_at INTEGER NOT NULL CHECK(observed_at>=0),
    recorded_at INTEGER NOT NULL CHECK(recorded_at>=0),
    generation INTEGER NOT NULL CHECK(generation>=0),
    producer_kind TEXT NOT NULL CHECK(producer_kind IN ('automated','human_action')),
    producer_id TEXT NOT NULL CHECK(length(producer_id) BETWEEN 1 AND 128));
  CREATE INDEX uat_receipts_cell ON uat_receipts(platform,source,scenario,evidence,recorded_at,event_id);

  INSERT INTO schema_migrations VALUES(2,2,2,unixepoch()*1000);
  PRAGMA user_version = 2;
`;

function assertMigrationMetadata(db: Database.Database, version: 1 | 2): void {
  const rows = db.prepare('SELECT version,schema_min,schema_max FROM schema_migrations ORDER BY version').all() as { version: number; schema_min: number; schema_max: number }[];
  const expected = version === 1
    ? [{ version: 1, schema_min: 1, schema_max: 1 }]
    : [{ version: 1, schema_min: 1, schema_max: 1 }, { version: 2, schema_min: 2, schema_max: 2 }];
  if (JSON.stringify(rows) !== JSON.stringify(expected)) throw new StorageError('SCHEMA_INCOMPATIBLE', 503);
}

export function openDatabase(path: string): Database.Database {
  if (!path || path === ':memory:') throw new StorageError('DURABLE_DATABASE_REQUIRED');
  const db = new Database(path, { timeout: 2000 });
  try {
    assertSQLiteIdentity(db.prepare('SELECT sqlite_version() AS version, sqlite_source_id() AS sourceId').get() as typeof SQLITE_IDENTITY);
    db.pragma('foreign_keys = ON');
    if (db.pragma('journal_mode = WAL', { simple: true }) !== 'wal') throw new StorageError('WAL_REQUIRED');
    db.pragma('synchronous = FULL'); db.pragma('busy_timeout = 2000');
    db.transaction(() => {
      const version = db.pragma('user_version', { simple: true });
      if (version !== 0 && version !== 1 && version !== 2) throw new StorageError('SCHEMA_INCOMPATIBLE', 503);
      if (version === 0) db.exec(MIGRATION_V1);
      if (version !== 2) {
        assertMigrationMetadata(db, 1);
        db.exec(MIGRATION_V2);
      }
      assertMigrationMetadata(db, 2);
    }).immediate();
    return db;
  } catch (error) { db.close(); throw error; }
}
export function readGate(db: Database.Database): MaintenanceGate {
  return MaintenanceGateSchema.parse(db.prepare('SELECT operation_id AS operationId,generation,state,owner,lease_until AS leaseUntil FROM maintenance_generation WHERE id=1').get());
}
export function requireWrite(db: Database.Database, context: WriteContext, allowQuiescing = false): MaintenanceGate {
  const gate = readGate(db);
  if (gate.generation !== context.expectedGeneration) throw new StorageError('GENERATION_MISMATCH');
  if (context.selfcheck) {
    if (gate.state !== 'exclusive' || gate.operationId !== context.selfcheck.operationId || gate.generation !== context.selfcheck.generation) throw new StorageError('MAINTENANCE_ACTIVE');
  } else if (gate.state !== 'open' && !(allowQuiescing && gate.state === 'quiescing')) throw new StorageError('MAINTENANCE_ACTIVE');
  return gate;
}
export function recordWrite(db: Database.Database, context: WriteContext): void {
  if (!context.selfcheck) db.prepare('UPDATE maintenance_generation SET write_generation=write_generation+1 WHERE id=1').run();
}
export class SQLiteMaintenanceStore implements MaintenanceStore {
  constructor(private readonly db: Database.Database) {}
  async read(): Promise<MaintenanceGate> { return readGate(this.db); }
  async enterMaintenance(input: { operationId: string; owner: string; leaseUntil: number; expectedGeneration: number }): Promise<MaintenanceGate> {
    MaintenanceGateSchema.parse({ operationId: input.operationId, generation: input.expectedGeneration, state: 'quiescing', owner: input.owner, leaseUntil: input.leaseUntil });
    return this.db.transaction(() => {
      const gate = readGate(this.db);
      if (gate.generation !== input.expectedGeneration) throw new StorageError('GENERATION_MISMATCH');
      if (gate.state !== 'open') throw new StorageError('MAINTENANCE_ACTIVE');
      this.db.prepare("UPDATE maintenance_generation SET state='quiescing',operation_id=?,owner=?,lease_until=? WHERE id=1").run(input.operationId, input.owner, input.leaseUntil);
      return readGate(this.db);
    }).immediate();
  }
  async markExclusive(operationId: string, expectedGeneration: number): Promise<MaintenanceGate> {
    return this.db.transaction(() => {
      this.assertOwned(operationId, expectedGeneration);
      if (this.db.prepare("SELECT 1 FROM jobs WHERE state='running' LIMIT 1").get()) throw new StorageError('JOBS_NOT_DRAINED');
      this.db.prepare("UPDATE maintenance_generation SET state='exclusive' WHERE id=1").run();
      return readGate(this.db);
    }).immediate();
  }
  /** Recovery may renew only the same already-exclusive installer fence; it cannot acquire or change ownership. */
  async renewExclusive(operationId: string, expectedGeneration: number, leaseUntil: number): Promise<MaintenanceGate> {
    if(!Number.isSafeInteger(leaseUntil)||leaseUntil<=Date.now()||leaseUntil>Date.now()+300_000)throw new StorageError('INVALID_MAINTENANCE_LEASE');
    return this.db.transaction(()=>{const gate=readGate(this.db);if(gate.state!=='exclusive'||gate.operationId!==operationId||gate.generation!==expectedGeneration||gate.owner!=='installer')throw new StorageError('MAINTENANCE_OWNERSHIP_MISMATCH');this.db.prepare('UPDATE maintenance_generation SET lease_until=? WHERE id=1').run(leaseUntil);return readGate(this.db);}).immediate();
  }
  async exitMaintenance(operationId: string, expectedGeneration: number): Promise<MaintenanceGate> {
    return this.db.transaction(() => {
      this.assertOwned(operationId, expectedGeneration);
      if (this.db.prepare("SELECT 1 FROM jobs WHERE state='running' LIMIT 1").get()) throw new StorageError('JOBS_NOT_DRAINED');
      this.db.prepare("UPDATE maintenance_generation SET state='open',operation_id=NULL,owner=NULL,lease_until=NULL,generation=generation+1 WHERE id=1").run();
      return readGate(this.db);
    }).immediate();
  }
  private assertOwned(operationId: string, generation: number): void {
    const gate = readGate(this.db);
    if (gate.generation !== generation) throw new StorageError('GENERATION_MISMATCH');
    if (gate.operationId !== operationId || gate.state === 'open') throw new StorageError('MAINTENANCE_OWNERSHIP_MISMATCH');
  }
}
