import type { WriteContext } from '../../domain/src/model.js';
import type {
  LiveActionFailure,
  LiveCheckpointBinding,
  PairedLiveResult,
  PendingLiveAction,
  PendingLiveActionIssue,
} from '../../domain/src/live-evidence.js';
import {
  PairedLiveResultSchema,
  PendingLiveActionIssueSchema,
} from '../../contracts/src/live-evidence.js';

/** Authenticated paired-server authority is never a request or persisted plaintext field. */
export interface PairedLiveAuthority {
  kind: 'paired_server_authenticated';
  secret: string;
  principalSessionHash: string;
}

export interface LiveCheckpointAuthorityPort {
  mint(binding: LiveCheckpointBinding): Promise<PairedLiveAuthority>;
  resolve(action: PendingLiveAction, result: PairedLiveResult): Promise<PairedLiveAuthority>;
}

export interface LiveCheckpointRuntimePort {
  /** Re-read current signed build/install/generation/binding state after the bounded human result. */
  current(action: PendingLiveAction): Promise<LiveCheckpointBinding>;
}

export interface LiveCheckpointStore {
  issue(input: PendingLiveActionIssue, authority: PairedLiveAuthority, context: WriteContext): Promise<PendingLiveAction>;
  read(actionId: string): Promise<PendingLiveAction | null>;
  recordFailure(actionId: string, code: string, checkedAt: string, context: WriteContext): Promise<LiveActionFailure>;
  consumeAndAppend(
    result: PairedLiveResult,
    current: LiveCheckpointBinding,
    authority: PairedLiveAuthority,
    context: WriteContext,
  ): Promise<PendingLiveAction>;
}

const SAFE_FAILURE_CODES = new Set([
  'LIVE_ACTION_NOT_FOUND', 'LIVE_ACTION_EXPIRED', 'LIVE_ACTION_REPLAY', 'LIVE_ACTION_BINDING_MISMATCH',
  'LIVE_ACTION_AUTHORITY_MISMATCH', 'LIVE_ACTION_PREDECESSOR_CHANGED', 'LIVE_ACTION_RESULT_INVALID',
  'GENERATION_MISMATCH', 'SQLITE_BUSY', 'SQLITE_FULL', 'STORAGE_FAILURE',
]);

function safeFailureCode(error: unknown): string {
  const code = (error as { code?: unknown })?.code;
  return typeof code === 'string' && SAFE_FAILURE_CODES.has(code) ? code : 'STORAGE_FAILURE';
}

/**
 * The workflow never accepts authority or runtime binding from its caller. Both are resolved from
 * authenticated server state only after the strict, bounded paired result has been parsed.
 */
export class LiveCheckpointWorkflow {
  constructor(
    private readonly store: LiveCheckpointStore,
    private readonly authority: LiveCheckpointAuthorityPort,
    private readonly runtime: LiveCheckpointRuntimePort,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async issue(input: unknown, context: WriteContext): Promise<PendingLiveAction> {
    const issue = PendingLiveActionIssueSchema.parse(input);
    const authority = await this.authority.mint(issue);
    return this.store.issue(issue, authority, context);
  }

  async read(actionId: string): Promise<PendingLiveAction | null> {
    return this.store.read(actionId);
  }

  async consumeAndAppend(input: unknown, context: WriteContext): Promise<PendingLiveAction> {
    const result = PairedLiveResultSchema.parse(input);
    const action = await this.store.read(result.actionId);
    if (!action) throw Object.assign(new Error('LIVE_ACTION_NOT_FOUND'), { code: 'LIVE_ACTION_NOT_FOUND' });
    try {
      const [current, authority] = await Promise.all([
        this.runtime.current(action),
        this.authority.resolve(action, result),
      ]);
      return await this.store.consumeAndAppend(result, current, authority, context);
    } catch (error) {
      await this.store.recordFailure(result.actionId, safeFailureCode(error), this.now(), context);
      throw error;
    }
  }
}
