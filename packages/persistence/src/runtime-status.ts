import type Database from 'better-sqlite3';
import type { Clock, ProjectionWriteContext, StatusProjectionStore } from '../../application/src/ports.js';
import type { ComponentObservation, InstallProjection, SelfcheckProjection, Status } from '../../domain/src/model.js';
import { ComponentObservationSchema, InstallProjectionSchema, SelfcheckProjectionSchema, ManifestObservationSchema } from '../../contracts/src/index.js';
import type {ManifestObservation} from '../../domain/src/model.js';
import { readGate, StorageError } from './database.js';

export class SQLiteStatusProjectionStore implements StatusProjectionStore {
  constructor(private readonly db: Database.Database, private readonly clock: Clock = { now: () => Date.now() }, private readonly staleAfterMs = 30_000) {}
  async read(): Promise<Status> {
    const rows = this.db.prepare('SELECT key,projection,checked_at FROM runtime_status').all() as { key: string; projection: string; checked_at: number | null }[];
    const values = new Map(rows.map(row => [row.key, { ...JSON.parse(row.projection), freshness: row.checked_at === null ? 'not_observed' : this.clock.now() - row.checked_at > this.staleAfterMs || row.checked_at > this.clock.now() ? 'stale' : 'fresh' }]));
    const times = rows.flatMap(row => row.checked_at === null ? [] : [row.checked_at]);
    return { manifest:values.get('manifest')??null, api: values.get('api') ?? null, worker: values.get('worker') ?? null, install: values.get('install') ?? null, selfcheck: values.get('selfcheck') ?? null,
      checkedAt: times.length ? new Date(Math.max(...times)).toISOString() : null };
  }
  async writeComponent(observation: ComponentObservation, context: ProjectionWriteContext): Promise<void> {
    const value = ComponentObservationSchema.parse(observation); this.write(value.role, value, value.health === 'healthy', context);
  }
  async writeInstall(projection: InstallProjection, context: ProjectionWriteContext): Promise<void> {
    const value = InstallProjectionSchema.parse(projection);
    if (value.operationId !== context.operationId) throw new StorageError('MAINTENANCE_OWNERSHIP_MISMATCH');
    this.write('install', value, value.result === 'succeeded', context);
  }
  async writeSelfcheck(projection: SelfcheckProjection, context: ProjectionWriteContext): Promise<void> {
    const value = SelfcheckProjectionSchema.parse(projection); this.write('selfcheck', value, value.featureResult === 'pass', context);
  }
  async writeManifest(value:ManifestObservation,context:ProjectionWriteContext){const parsed=ManifestObservationSchema.parse(value);this.write('manifest',parsed,true,context);}
  private write(key: string, value: ComponentObservation | InstallProjection | SelfcheckProjection | ManifestObservation, success: boolean, context: ProjectionWriteContext): void {
    this.db.transaction(() => {
      const gate = readGate(this.db);
      if (gate.generation !== context.expectedGeneration) throw new StorageError('GENERATION_MISMATCH');
      if (gate.operationId !== context.operationId) throw new StorageError('MAINTENANCE_ACTIVE');
      const checkedAt = value.checkedAt === null ? null : Date.parse(value.checkedAt);
      if (checkedAt !== null && checkedAt > this.clock.now()) throw new StorageError('FUTURE_OBSERVATION');
      const prior = this.db.prepare('SELECT checked_at FROM runtime_status WHERE key=?').get(key) as { checked_at: number | null } | undefined;
      if (prior?.checked_at !== null && prior?.checked_at !== undefined && (checkedAt === null || checkedAt <= prior.checked_at)) throw new StorageError('STALE_PROJECTION');
      const json = JSON.stringify(value);
      this.db.prepare('INSERT INTO runtime_status(key,projection,last_success,checked_at,generation,operation_id) VALUES(?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET projection=excluded.projection,last_success=COALESCE(excluded.last_success,runtime_status.last_success),checked_at=excluded.checked_at,generation=excluded.generation,operation_id=excluded.operation_id')
        .run(key, json, success ? json : null, checkedAt, context.expectedGeneration, context.operationId);
    }).immediate();
  }
}
