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
    installation_id TEXT CHECK(installation_id IS NULL OR length(installation_id)=36),
    browser_build_id TEXT CHECK(browser_build_id IS NULL OR length(browser_build_id)=64),
    pid INTEGER,
    nonce_hash TEXT CHECK(nonce_hash IS NULL OR length(nonce_hash)=64),
    control_proof_fingerprint TEXT CHECK(control_proof_fingerprint IS NULL OR length(control_proof_fingerprint)=64),
    os_start_identity TEXT,
    managed_executable_identity TEXT,
    reserved_at INTEGER CHECK(reserved_at IS NULL OR reserved_at>=0),
    started_at INTEGER,
    lease_until INTEGER CHECK(lease_until IS NULL OR lease_until>=0),
    generation INTEGER NOT NULL CHECK(generation>=0),
    fence INTEGER NOT NULL CHECK(fence>=0),
    state TEXT NOT NULL CHECK(state IN ('available','reserved','owned','in_use','unconfirmed','confirmed_exited')),
    CHECK((state='available' AND installation_id IS NULL AND browser_build_id IS NULL AND pid IS NULL AND nonce_hash IS NULL
        AND control_proof_fingerprint IS NULL AND os_start_identity IS NULL AND managed_executable_identity IS NULL
        AND reserved_at IS NULL AND started_at IS NULL AND lease_until IS NULL)
      OR (state='reserved' AND installation_id IS NOT NULL AND browser_build_id IS NOT NULL AND nonce_hash IS NOT NULL
        AND control_proof_fingerprint IS NOT NULL AND reserved_at IS NOT NULL AND lease_until IS NOT NULL
        AND pid IS NULL AND os_start_identity IS NULL AND managed_executable_identity IS NULL AND started_at IS NULL)
      OR (state NOT IN ('available','reserved') AND installation_id IS NOT NULL AND browser_build_id IS NOT NULL
        AND nonce_hash IS NOT NULL AND control_proof_fingerprint IS NOT NULL AND reserved_at IS NOT NULL AND lease_until IS NOT NULL
        AND pid>0 AND os_start_identity IS NOT NULL AND length(os_start_identity) BETWEEN 1 AND 256
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

const MIGRATION_V3 = `
  CREATE TABLE source_auth_controls(
    source TEXT PRIMARY KEY CHECK(source IN ('moodle','edstem')),
    logout_intent INTEGER NOT NULL DEFAULT 0 CHECK(logout_intent IN (0,1)),
    generation INTEGER NOT NULL CHECK(generation>=0),
    updated_at INTEGER NOT NULL CHECK(updated_at>=0));
  INSERT INTO source_auth_controls(source,logout_intent,generation,updated_at)
    VALUES('moodle',0,0,unixepoch()*1000),('edstem',0,0,unixepoch()*1000);

  CREATE TABLE source_auth_jobs(
    id TEXT PRIMARY KEY CHECK(length(id)=36),
    source TEXT NOT NULL CHECK(source IN ('moodle','edstem')),
    action TEXT NOT NULL CHECK(action IN ('moodle.auth_probe','edstem.auth_probe')),
    trigger TEXT NOT NULL CHECK(trigger IN ('background','user_login_completed','manual_retry','recovery','moodle_reauth_follow_up')),
    idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 128),
    command_hash TEXT NOT NULL CHECK(length(command_hash)=64),
    approved_config_id TEXT NOT NULL CHECK(length(approved_config_id)=36),
    approved_scope_id TEXT NOT NULL CHECK(length(approved_scope_id)=36),
    state TEXT NOT NULL CHECK(state IN ('queued','running','retry_wait','succeeded','failed','cancelled','human_needed')),
    attempt INTEGER NOT NULL DEFAULT 0 CHECK(attempt BETWEEN 0 AND 3),
    recovery_started_at INTEGER CHECK(recovery_started_at IS NULL OR recovery_started_at>=0),
    next_run_at INTEGER CHECK(next_run_at IS NULL OR next_run_at>=0),
    cancel_requested INTEGER NOT NULL DEFAULT 0 CHECK(cancel_requested IN (0,1)),
    lease_owner TEXT CHECK(lease_owner IS NULL OR length(lease_owner) BETWEEN 1 AND 128),
    lease_until INTEGER CHECK(lease_until IS NULL OR lease_until>=0),
    lease_ms INTEGER CHECK(lease_ms IS NULL OR lease_ms BETWEEN 1 AND 30000),
    fence INTEGER NOT NULL DEFAULT 0 CHECK(fence>=0),
    generation INTEGER NOT NULL CHECK(generation>=0),
    safe_result_code TEXT CHECK(safe_result_code IS NULL OR safe_result_code IN
      ('authenticated','network_unavailable','parser_changed','permission_denied','authentication_required','reauth_required',
       'interaction_required','mfa_required','identity_mismatch','not_observed','cancelled','lease_expired')),
    last_success_checked_at INTEGER CHECK(last_success_checked_at IS NULL OR last_success_checked_at>=0),
    last_success_fingerprint TEXT CHECK(last_success_fingerprint IS NULL OR length(last_success_fingerprint) BETWEEN 8 AND 128),
    parent_job_id TEXT REFERENCES source_auth_jobs(id),
    effect_kind TEXT CHECK(effect_kind IS NULL OR effect_kind='moodle_reauth_follow_up'),
    created_at INTEGER NOT NULL CHECK(created_at>=0),
    updated_at INTEGER NOT NULL CHECK(updated_at>=0),
    CHECK((source='moodle' AND action='moodle.auth_probe') OR (source='edstem' AND action='edstem.auth_probe')),
    CHECK((lease_owner IS NULL AND lease_until IS NULL AND lease_ms IS NULL) OR
          (lease_owner IS NOT NULL AND lease_until IS NOT NULL AND lease_ms IS NOT NULL)),
    UNIQUE(source,idempotency_key),
    UNIQUE(parent_job_id,effect_kind));
  CREATE INDEX source_auth_jobs_ready ON source_auth_jobs(state,next_run_at,created_at,id);
  CREATE INDEX source_auth_jobs_source ON source_auth_jobs(source,state,updated_at);

  INSERT INTO schema_migrations VALUES(3,3,3,unixepoch()*1000);
  PRAGMA user_version = 3;
`;

const MIGRATION_V4 = `
  CREATE TABLE pending_live_actions(
    action_id TEXT PRIMARY KEY CHECK(length(action_id)=36),
    authority_hash TEXT NOT NULL UNIQUE CHECK(length(authority_hash)=64),
    build_id TEXT NOT NULL CHECK(length(build_id)=64),
    artifact_id TEXT NOT NULL CHECK(length(artifact_id)=64),
    version TEXT NOT NULL CHECK(length(version) BETWEEN 5 AND 64),
    installation_id TEXT NOT NULL CHECK(length(installation_id)=36),
    platform TEXT NOT NULL CHECK(platform IN ('macos','windows')),
    source TEXT NOT NULL CHECK(source IN ('moodle','edstem')),
    scenario TEXT NOT NULL CHECK(scenario IN ('a.login','a.binding','a.course_visibility','b.reopen_1','b.reopen_2','b.reopen_3','b.worker_restart','b.codex_exit','c.os_restart','d.24h_recheck','reauth')),
    approved_config_id TEXT NOT NULL CHECK(length(approved_config_id)=36),
    approved_scope_id TEXT NOT NULL CHECK(length(approved_scope_id)=36),
    binding_fingerprint TEXT NOT NULL CHECK(length(binding_fingerprint)=64),
    generation INTEGER NOT NULL CHECK(generation>=0),
    parent_checkpoint_id TEXT NOT NULL CHECK(length(parent_checkpoint_id)=36),
    prior_evidence_event_id TEXT REFERENCES uat_receipts(event_id),
    issued_at INTEGER NOT NULL CHECK(issued_at>=0),
    expires_at INTEGER NOT NULL CHECK(expires_at>issued_at),
    state TEXT NOT NULL CHECK(state IN ('pending','consumed')),
    consumed_at INTEGER CHECK(consumed_at IS NULL OR consumed_at>=issued_at),
    consumed_event_id TEXT REFERENCES uat_receipts(event_id),
    CHECK((state='pending' AND consumed_at IS NULL AND consumed_event_id IS NULL) OR
          (state='consumed' AND consumed_at IS NOT NULL AND consumed_event_id IS NOT NULL)));
  CREATE INDEX pending_live_actions_state ON pending_live_actions(state,expires_at,issued_at,action_id);
  CREATE INDEX pending_live_actions_cell ON pending_live_actions(platform,source,scenario,issued_at,action_id);

  CREATE TABLE live_action_failures(
    failure_id TEXT PRIMARY KEY CHECK(length(failure_id)=36),
    action_id TEXT NOT NULL REFERENCES pending_live_actions(action_id),
    code TEXT NOT NULL CHECK(length(code) BETWEEN 1 AND 128),
    checked_at INTEGER NOT NULL CHECK(checked_at>=0),
    generation INTEGER NOT NULL CHECK(generation>=0));
  CREATE INDEX live_action_failures_action ON live_action_failures(action_id,checked_at,failure_id);

  INSERT INTO schema_migrations VALUES(4,4,4,unixepoch()*1000);
  PRAGMA user_version = 4;
`;

const MIGRATION_V5 = `
  CREATE TABLE phase2_native_runs(
    run_id TEXT PRIMARY KEY CHECK(length(run_id)=36),
    bundle_hash TEXT NOT NULL UNIQUE CHECK(length(bundle_hash)=64),
    build_id TEXT NOT NULL CHECK(length(build_id)=64),
    artifact_sha256 TEXT NOT NULL CHECK(length(artifact_sha256)=64),
    manifest_sha256 TEXT NOT NULL CHECK(length(manifest_sha256)=64),
    version TEXT NOT NULL CHECK(length(version) BETWEEN 5 AND 64),
    platform TEXT NOT NULL CHECK(platform IN ('macos','windows')),
    generation INTEGER NOT NULL CHECK(generation>=0),
    status TEXT NOT NULL CHECK(status IN ('pass','fail')),
    result_code TEXT NOT NULL CHECK(result_code IN ('NATIVE_EVIDENCE_RECORDED','NATIVE_EVIDENCE_CHECK_FAILED')),
    checked_at INTEGER NOT NULL CHECK(checked_at>=0),
    recorded_at INTEGER NOT NULL CHECK(recorded_at>=0));
  CREATE INDEX phase2_native_runs_build ON phase2_native_runs(build_id,generation,platform,recorded_at,run_id);
  CREATE TABLE phase2_build_obligations(
    build_id TEXT NOT NULL CHECK(length(build_id)=64), generation INTEGER NOT NULL CHECK(generation>=0),
    obligation_id TEXT NOT NULL CHECK(obligation_id IN (
      'auth01.sealed_source_contract','auth02.native_lifecycle.macos','auth02.native_lifecycle.windows','auth03.state_contract',
      'auth03.persistence_isolation','auth04.ownership_contract','auth04.ownership_integration','auth04.ownership_native.macos',
      'auth04.ownership_native.windows','sec02.fixed_operations_contract','sec02.fixed_operations_integration',
      'uat01.distribution_contract','uat01.native_update.macos','uat01.native_update.windows')),
    evidence TEXT NOT NULL CHECK(evidence IN ('S','I','N')),
    platform TEXT NOT NULL CHECK(platform IN ('cross-platform','macos','windows')),
    report_digest TEXT NOT NULL CHECK(length(report_digest)=64), run_id TEXT NOT NULL REFERENCES phase2_native_runs(run_id),
    checked_at INTEGER NOT NULL CHECK(checked_at>=0), PRIMARY KEY(build_id,generation,obligation_id));
  INSERT INTO schema_migrations VALUES(5,5,5,unixepoch()*1000);
  PRAGMA user_version = 5;
`;

function assertMigrationMetadata(db: Database.Database, version: 1 | 2 | 3 | 4 | 5): void {
  const rows = db.prepare('SELECT version,schema_min,schema_max FROM schema_migrations ORDER BY version').all() as { version: number; schema_min: number; schema_max: number }[];
  const expected = [
    { version: 1, schema_min: 1, schema_max: 1 },
    { version: 2, schema_min: 2, schema_max: 2 },
    { version: 3, schema_min: 3, schema_max: 3 },
    { version: 4, schema_min: 4, schema_max: 4 },
    { version: 5, schema_min: 5, schema_max: 5 },
  ].slice(0, version);
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
      if (version !== 0 && version !== 1 && version !== 2 && version !== 3 && version !== 4 && version !== 5) throw new StorageError('SCHEMA_INCOMPATIBLE', 503);
      if (version === 0) db.exec(MIGRATION_V1);
      if (version < 2) {
        assertMigrationMetadata(db, 1);
        db.exec(MIGRATION_V2);
      }
      if (version < 3) {
        assertMigrationMetadata(db, 2);
        db.exec(MIGRATION_V3);
      }
      if (version < 4) {
        assertMigrationMetadata(db, 3);
        db.exec(MIGRATION_V4);
      }
      if (version < 5) {
        assertMigrationMetadata(db, 4);
        db.exec(MIGRATION_V5);
      }
      assertMigrationMetadata(db, 5);
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
