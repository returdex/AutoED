import type { JobStore } from '../../application/src/ports.js';
import { retryDelay, validErrorCode } from '../../application/src/job-runner.js';
import type { Job, Lease, WriteContext } from '../../domain/src/model.js';
import { JobRepository, type JobRow } from './jobs.js';
import { recordWrite, requireWrite, StorageError } from './database.js';

function timestamp(now: number): void { if (!Number.isSafeInteger(now) || now < 0) throw new StorageError('INVALID_CLOCK'); }
function boundedValue(value: string): void { if (typeof value !== 'string' || value.length > 4096) throw new StorageError('INVALID_JOB_VALUE'); }

/** Short BEGIN IMMEDIATE transactions serialize claims, cancellation and business commits. */
export class SQLiteJobStore extends JobRepository implements JobStore {
  async claim(input: { owner: string; now: number; leaseMs: number }, context: WriteContext): Promise<Job | null> {
    timestamp(input.now);
    if (!input.owner || input.owner.length > 128 || !Number.isSafeInteger(input.leaseMs) || input.leaseMs < 1 || input.leaseMs > 30_000 || !Number.isSafeInteger(input.now + input.leaseMs)) throw new StorageError('INVALID_LEASE');
    return this.db.transaction(() => {
      const gate = requireWrite(this.db, context);
      const row = this.db.prepare("SELECT * FROM jobs WHERE state IN ('queued','retry_wait') AND cancel_requested=0 AND attempt<max_attempts AND (next_run_at IS NULL OR next_run_at<=?) AND operation_id IS ? ORDER BY created_at,id LIMIT 1")
        .get(input.now, context.selfcheck?.operationId ?? null) as JobRow | undefined;
      if (!row) return null;
      if (input.now < row.updated_at) throw new StorageError('CLOCK_REGRESSION');
      // Queued ordinary work survives an upgrade; only a fresh claim rebinds it to the active generation.
      this.db.prepare("UPDATE jobs SET state='running',attempt=attempt+1,fence=fence+1,lease_owner=?,lease_until=?,lease_ms=?,generation=?,next_run_at=NULL,updated_at=? WHERE id=?")
        .run(input.owner, input.now + input.leaseMs, input.leaseMs, gate.generation, input.now, row.id);
      recordWrite(this.db, context); return this.getJob(row.id);
    }).immediate();
  }
  async heartbeat(jobId: string, lease: Lease, now: number, context: WriteContext): Promise<Lease> {
    return this.db.transaction(() => {
      const row = this.fenced(jobId, lease, now, context);
      if (row.cancel_requested) throw new StorageError('CANCEL_REQUESTED');
      const until = now + row.lease_ms!;
      if (!Number.isSafeInteger(until)) throw new StorageError('INVALID_CLOCK');
      this.updateFenced('lease_until=?,updated_at=?', [until, now], jobId, lease, now);
      recordWrite(this.db, context); return { owner: lease.owner, fence: lease.fence, leaseUntil: until };
    }).immediate();
  }
  async checkpoint(jobId: string, lease: Lease, value: string, now: number, context: WriteContext): Promise<void> {
    boundedValue(value);
    this.db.transaction(() => {
      const row = this.fenced(jobId, lease, now, context); if (row.cancel_requested) throw new StorageError('CANCEL_REQUESTED');
      this.updateFenced('checkpoint=?,updated_at=?', [value, now], jobId, lease, now); recordWrite(this.db, context);
    }).immediate();
  }
  async commit(jobId: string, lease: Lease, result: string, now: number, context: WriteContext): Promise<Job> {
    boundedValue(result);
    return this.db.transaction(() => {
      const row = this.fenced(jobId, lease, now, context); if (row.cancel_requested) throw new StorageError('CANCEL_REQUESTED');
      const job = this.getJob(jobId);
      this.db.prepare('INSERT INTO synthetic_results(job_id,scope,kind,result,committed_at) VALUES(?,?,?,?,?)').run(jobId, row.scope, job.request.kind, result, now);
      this.updateFenced("state='succeeded',result=?,error_code=NULL,lease_owner=NULL,lease_until=NULL,lease_ms=NULL,next_run_at=NULL,updated_at=?", [result, now], jobId, lease, now, true);
      recordWrite(this.db, context); return this.getJob(jobId);
    }).immediate();
  }
  async fail(jobId: string, lease: Lease, errorCode: string, retryable: boolean, now: number, context: WriteContext): Promise<Job> {
    if (!validErrorCode(errorCode)) throw new StorageError('INVALID_ERROR_CODE');
    return this.db.transaction(() => {
      const row = this.fenced(jobId, lease, now, context);
      // Calling fail confirms that the handler has stopped, so a pending cancel can now become terminal.
      const retry = retryable && errorCode === 'NETWORK_ERROR' && row.attempt < row.max_attempts;
      const state = row.cancel_requested ? 'cancelled' : retry ? 'retry_wait' : 'failed';
      this.updateFenced('state=?,error_code=?,next_run_at=?,lease_owner=NULL,lease_until=NULL,lease_ms=NULL,updated_at=?',
        [state, errorCode, state === 'retry_wait' ? now + retryDelay(row.attempt) : null, now], jobId, lease, now);
      recordWrite(this.db, context); return this.getJob(jobId);
    }).immediate();
  }
  async acknowledgeCancel(jobId: string, lease: Lease, now: number, context: WriteContext): Promise<Job> {
    return this.db.transaction(() => {
      const row = this.fenced(jobId, lease, now, context);
      if (!row.cancel_requested) throw new StorageError('CANCEL_NOT_REQUESTED');
      this.updateFenced("state='cancelled',lease_owner=NULL,lease_until=NULL,lease_ms=NULL,next_run_at=NULL,updated_at=?", [now], jobId, lease, now);
      recordWrite(this.db, context); return this.getJob(jobId);
    }).immediate();
  }
  async recoverExpired(now: number, context: WriteContext): Promise<number> {
    timestamp(now);
    return this.db.transaction(() => {
      requireWrite(this.db, context, true);
      const rows = this.db.prepare("SELECT * FROM jobs WHERE state='running' AND lease_until<=? AND operation_id IS ?").all(now, context.selfcheck?.operationId ?? null) as JobRow[];
      for (const row of rows) {
        const state = row.cancel_requested ? 'cancelled' : row.attempt >= row.max_attempts ? 'failed' : 'retry_wait';
        this.db.prepare("UPDATE jobs SET state=?,fence=fence+1,lease_owner=NULL,lease_until=NULL,lease_ms=NULL,next_run_at=?,error_code=?,updated_at=? WHERE id=? AND state='running' AND lease_until<=?")
          .run(state, state === 'retry_wait' ? now + retryDelay(row.attempt) : null, state === 'failed' ? 'RETRY_EXHAUSTED' : state === 'retry_wait' ? 'LEASE_EXPIRED' : row.error_code, now, row.id, now);
      }
      if (rows.length) recordWrite(this.db, context); return rows.length;
    }).immediate();
  }
  private fenced(id: string, lease: Lease, now: number, context: WriteContext): JobRow {
    timestamp(now); requireWrite(this.db, context, true);
    const row = this.getRow(id);
    if (row.operation_id !== (context.selfcheck?.operationId ?? null) || row.generation !== context.expectedGeneration) throw new StorageError('GENERATION_MISMATCH');
    if (row.state !== 'running' || row.lease_owner !== lease.owner || row.fence !== lease.fence || row.lease_until === null || row.lease_until <= now) throw new StorageError('LEASE_LOST');
    if (now < row.updated_at) throw new StorageError('CLOCK_REGRESSION'); return row;
  }
  private updateFenced(set: string, parameters: (string | number | null)[], id: string, lease: Lease, now: number, requireNotCancelled = false): void {
    // SQL fragments come only from the fixed methods above, never caller/source data.
    const result = this.db.prepare(`UPDATE jobs SET ${set} WHERE id=? AND lease_owner=? AND fence=? AND state='running' AND lease_until>?${requireNotCancelled ? ' AND cancel_requested=0' : ''}`)
      .run(...parameters, id, lease.owner, lease.fence, now);
    if (result.changes !== 1) throw new StorageError('LEASE_LOST');
  }
}
