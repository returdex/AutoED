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
      if (version !== 0 && version !== 1) throw new StorageError('SCHEMA_INCOMPATIBLE', 503);
      if (version === 0) {
        db.exec(`
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
        `);
      }
      const migration = db.prepare('SELECT version,schema_min,schema_max FROM schema_migrations ORDER BY version DESC LIMIT 1').get() as { version: number; schema_min: number; schema_max: number } | undefined;
      if (!migration || migration.version !== 1 || migration.schema_min !== 1 || migration.schema_max !== 1) throw new StorageError('SCHEMA_INCOMPATIBLE', 503);
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
