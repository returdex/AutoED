import type { JobStore } from './ports.js';
import type { JobRequest, Scope, WriteContext } from '../../domain/src/model.js';

/** Transport-independent job commands. Authentication/policy is supplied by the application boundary. */
export class Jobs {
  constructor(private readonly store: Pick<JobStore, 'enqueue' | 'query' | 'requestCancel'>) {}
  enqueue(request: JobRequest, context: WriteContext) { return this.store.enqueue(request, context); }
  query(id: string, scope: Scope) { return this.store.query(id, scope); }
  cancel(id: string, scope: Scope, context: WriteContext) { return this.store.requestCancel(id, scope, context); }
}
