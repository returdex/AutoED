import { createHash, randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { Clock, JobStore } from '../../application/src/ports.js';
import type { Job, JobRequest, Scope, WriteContext } from '../../domain/src/model.js';
import { JobRequestSchema, ScopeSchema } from '../../contracts/src/index.js';
import { recordWrite, requireWrite, StorageError } from './database.js';

export function scopeKey(scope: Scope): string { const s = ScopeSchema.parse(scope); return JSON.stringify([s.installationId, s.source, s.courseId]); }
export interface JobRow {
  id: string; request: string; scope: string; payload_hash: string; state: Job['state']; attempt: number; max_attempts: number;
  next_run_at: number | null; lease_owner: string | null; lease_until: number | null; lease_ms: number | null; fence: number;
  cancel_requested: number; checkpoint: string | null; result: string | null; error_code: string | null;
  generation: number; operation_id: string | null; created_at: number; updated_at: number;
}
/** Shared durable repository; lease execution methods are supplied by SQLiteJobStore. */
export class JobRepository implements Pick<JobStore, 'enqueue' | 'query' | 'requestCancel'> {
  constructor(protected readonly db: Database.Database, protected readonly clock: Clock = { now: () => Date.now() }) {}
  async enqueue(input: JobRequest, context: WriteContext): Promise<Job> {
    const request = JobRequestSchema.parse(input); const scope = scopeKey(request.scope);
    const hash = createHash('sha256').update(JSON.stringify([request.kind, request.value])).digest('hex');
    return this.db.transaction(() => {
      const gate = requireWrite(this.db, context);
      const prior = this.db.prepare('SELECT * FROM jobs WHERE scope=? AND idempotency_key=?').get(scope, request.idempotencyKey) as JobRow | undefined;
      if (prior) {
        if (prior.payload_hash !== hash || prior.operation_id !== (context.selfcheck?.operationId ?? null)) throw new StorageError('IDEMPOTENCY_CONFLICT');
        return this.toJob(prior);
      }
      // Count and insert share the immediate transaction, including selfcheck jobs.
      const pending = this.db.prepare("SELECT count(*) AS n FROM jobs WHERE state IN ('queued','running','retry_wait')").get() as { n: number };
      if (pending.n >= 1000) throw new StorageError('QUEUE_FULL', 429);
      const id = randomUUID(); const now = this.clock.now();
      this.db.prepare("INSERT INTO jobs(id,scope,idempotency_key,payload_hash,request,state,generation,operation_id,created_at,updated_at) VALUES(?,?,?,?,?,'queued',?,?,?,?)")
        .run(id, scope, request.idempotencyKey, hash, JSON.stringify(request), gate.generation, context.selfcheck?.operationId ?? null, now, now);
      recordWrite(this.db, context); return this.getJob(id);
    }).immediate();
  }
  async query(jobId: string, scope: Scope): Promise<Job | null> {
    const row = this.db.prepare('SELECT * FROM jobs WHERE id=? AND scope=?').get(jobId, scopeKey(scope)) as JobRow | undefined;
    return row ? this.toJob(row) : null;
  }
  async requestCancel(jobId: string, scope: Scope, context: WriteContext): Promise<Job> {
    return this.db.transaction(() => {
      requireWrite(this.db, context, true);
      const row = this.db.prepare('SELECT * FROM jobs WHERE id=? AND scope=?').get(jobId, scopeKey(scope)) as JobRow | undefined;
      if (!row) throw new StorageError('JOB_NOT_FOUND', 404);
      if (row.operation_id !== (context.selfcheck?.operationId ?? null)) throw new StorageError('MAINTENANCE_ACTIVE');
      if (['queued', 'retry_wait', 'running'].includes(row.state)) {
        this.db.prepare("UPDATE jobs SET cancel_requested=1,state=CASE WHEN state='running' THEN state ELSE 'cancelled' END,updated_at=? WHERE id=?").run(this.clock.now(), jobId);
        recordWrite(this.db, context);
      }
      return this.getJob(jobId);
    }).immediate();
  }
  protected getRow(id: string): JobRow {
    const row = this.db.prepare('SELECT * FROM jobs WHERE id=?').get(id) as JobRow | undefined;
    if (!row) throw new StorageError('JOB_NOT_FOUND', 404); return row;
  }
  protected getJob(id: string): Job { return this.toJob(this.getRow(id)); }
  protected toJob(row: JobRow): Job {
    const request = JobRequestSchema.parse(JSON.parse(row.request));
    // Selfcheck success must never replace or masquerade as a normal job's last success.
    const last = this.db.prepare('SELECT r.result FROM synthetic_results r JOIN jobs j ON j.id=r.job_id WHERE r.scope=? AND r.kind=? AND j.operation_id IS ? ORDER BY r.committed_at DESC,r.rowid DESC LIMIT 1')
      .get(row.scope, request.kind, row.operation_id) as { result: string } | undefined;
    return { id: row.id, request, state: row.state, cancelRequested: row.cancel_requested === 1, attempt: row.attempt, maxAttempts: row.max_attempts,
      nextRunAt: row.next_run_at, lease: row.lease_owner === null || row.lease_until === null ? null : { owner: row.lease_owner, fence: row.fence, leaseUntil: row.lease_until },
      checkpoint: row.checkpoint, result: row.result, lastSuccessResult: last?.result ?? null, errorCode: row.error_code,
      generation: row.generation, operationId: row.operation_id, createdAt: row.created_at, updatedAt: row.updated_at };
  }
}
