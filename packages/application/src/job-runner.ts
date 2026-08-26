import type { Clock, JobStore } from './ports.js';
import type { Job, WriteContext } from '../../domain/src/model.js';

export const LEASE_MS = 30_000;
export const HEARTBEAT_MS = 5_000;
const ERROR_CODES = new Set(['JOB_FAILED', 'NETWORK_ERROR', 'PARSER_ERROR', 'PERMISSION_DENIED', 'RIGHTS_RESTRICTED', 'SCOPE_DENIED', 'INVALID_INPUT', 'ABORTED', 'UNSUPPORTED_CAPABILITY']);
export function validErrorCode(code: string): boolean { return ERROR_CODES.has(code); }
export function retryDelay(attempt: number): number { return Math.min(4000, 1000 * 2 ** Math.max(0, attempt - 1)); }
export class JobExecutionError extends Error {
  constructor(public readonly code: string, public readonly retryable = false) {
    if (!validErrorCode(code)) throw new Error('INVALID_ERROR_CODE'); super(code);
  }
}
export type JobHandler = (job: Job, signal: AbortSignal) => Promise<string>;

/** At-least-once attempts. Only the durable fenced commit publishes a business result. */
export class JobRunner {
  constructor(private readonly store: JobStore, private readonly clock: Clock = { now: () => Date.now() }) {}
  async runOnce(owner: string, context: WriteContext, handler: JobHandler): Promise<Job | null> {
    await this.store.recoverExpired(this.clock.now(), context);
    const job = await this.store.claim({ owner, now: this.clock.now(), leaseMs: LEASE_MS }, context);
    if (!job) return null;
    let lease = job.lease!; let cancelled = false; let leaseError: unknown; let poll: Promise<void> | null = null;
    const controller = new AbortController();
    const tick = async () => {
      try {
        const latest = await this.store.query(job.id, job.request.scope);
        if (latest?.cancelRequested) { cancelled = true; controller.abort(); return; }
        lease = await this.store.heartbeat(job.id, lease, this.clock.now(), context);
      } catch (error) {
        if ((error as { code?: string })?.code === 'CANCEL_REQUESTED') cancelled = true;
        else leaseError = error;
        controller.abort();
      }
    };
    const timer = setInterval(() => { if (!poll && !controller.signal.aborted) { poll = tick().finally(() => { poll = null; }); } }, HEARTBEAT_MS);
    timer.unref();
    let value: string | undefined; let handlerError: unknown; let failed = false;
    try { value = await handler(job, controller.signal); }
    catch (error) { failed = true; handlerError = error; }
    finally { clearInterval(timer); if (poll) await poll; }
    // Never acknowledge an abort while a handler may still be executing. No arbitrary PID is killed.
    if (leaseError) throw leaseError;
    if (cancelled) return this.store.acknowledgeCancel(job.id, lease, this.clock.now(), context);
    if (failed) {
      const error = handlerError instanceof JobExecutionError ? handlerError : new JobExecutionError('JOB_FAILED');
      return this.store.fail(job.id, lease, error.code, error.retryable, this.clock.now(), context);
    }
    try { return await this.store.commit(job.id, lease, value!, this.clock.now(), context); }
    catch (error) {
      if ((error as { code?: string })?.code === 'CANCEL_REQUESTED') return this.store.acknowledgeCancel(job.id, lease, this.clock.now(), context);
      throw error;
    }
  }
}
