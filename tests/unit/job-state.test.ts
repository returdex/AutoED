import { afterEach, describe, expect, it, vi } from 'vitest';
import { retryDelay, JobExecutionError, JobRunner } from '../../packages/application/src/job-runner.js';
import type { JobStore } from '../../packages/application/src/ports.js';
import type { Job } from '../../packages/domain/src/model.js';

afterEach(() => vi.useRealTimers());
describe('job runner attempt semantics', () => {
  it('uses bounded 1/2/4 second retry delays', () => {
    expect([1, 2, 3, 10].map(retryDelay)).toEqual([1000, 2000, 4000, 4000]);
  });
  it('persists sanitized errors instead of arbitrary handler messages', async () => {
    const job = { id: 'id', lease: { owner: 'worker', fence: 1, leaseUntil: 30_000 } } as Job;
    const store = { recoverExpired: vi.fn().mockResolvedValue(0), claim: vi.fn().mockResolvedValue(job), fail: vi.fn(), commit: vi.fn() } as unknown as JobStore;
    const runner = new JobRunner(store, { now: () => 0 });
    await runner.runOnce('worker', { expectedGeneration: 0 }, async () => { throw new Error('private arbitrary message'); });
    expect(store.fail).toHaveBeenCalledWith('id', job.lease, 'JOB_FAILED', false, 0, { expectedGeneration: 0 });
    expect(() => new JobExecutionError('private/path', true)).toThrow('INVALID_ERROR_CODE');
  });
  it('acknowledges cancellation only after handler confirms abort', async () => {
    vi.useFakeTimers(); const job = { id: 'id', request: { scope: {} }, lease: { owner: 'worker', fence: 1, leaseUntil: 30_000 } } as Job;
    const store = { recoverExpired: vi.fn().mockResolvedValue(0), claim: vi.fn().mockResolvedValue(job), query: vi.fn().mockResolvedValue({ ...job, cancelRequested: true }), heartbeat: vi.fn(), acknowledgeCancel: vi.fn(), fail: vi.fn(), commit: vi.fn() } as unknown as JobStore;
    let finish: (() => void) | undefined; let aborted = false;
    const running = new JobRunner(store, { now: () => 5000 }).runOnce('worker', { expectedGeneration: 0 }, async (_, signal) => {
      signal.addEventListener('abort', () => { aborted = true; });
      await new Promise<void>(resolve => { finish = resolve; }); return 'result';
    });
    await vi.advanceTimersByTimeAsync(5000); expect(aborted).toBe(true); expect(store.acknowledgeCancel).not.toHaveBeenCalled();
    finish!(); await running; expect(store.acknowledgeCancel).toHaveBeenCalledOnce(); expect(store.commit).not.toHaveBeenCalled();
  });
});
