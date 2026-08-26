import { createHash } from 'node:crypto';
import { JobExecutionError, type JobHandler } from '../../application/src/job-runner.js';

/** Fixed synthetic operations only. Strings never become URLs, code or instructions. */
export function syntheticProvider(digestEnabled: boolean): JobHandler {
  return async (job, signal) => {
    if (signal.aborted) throw new JobExecutionError('ABORTED');
    if (job.request.kind === 'echo') return job.request.value;
    if (job.request.kind === 'digest' && digestEnabled) return createHash('sha256').update(job.request.value, 'utf8').digest('hex');
    throw new JobExecutionError('UNSUPPORTED_CAPABILITY');
  };
}
