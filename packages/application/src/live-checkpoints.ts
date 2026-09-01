import { z } from 'zod';
import type { NativePlatform, SourceId, UatScenario, WriteContext } from '../../domain/src/model.js';
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

export interface PairedLiveCheckpointRuntimePort extends LiveCheckpointRuntimePort {
  platform(): NativePlatform;
  /** Resolve current immutable build/install/config/scope/binding state without caller values. */
  prepare(scenario: UatScenario, source: SourceId): Promise<LiveCheckpointBinding>;
  /** Commit/observe only the fixed bounded lifecycle operation represented by the action. */
  observe(
    action: PendingLiveAction,
    acknowledgement: LiveActionAcknowledgement,
  ): Promise<PairedLiveResult | HumanNeededLiveResult>;
}

export interface LiveCheckpointOutcome {
  eventId: string;
  status: 'pass' | 'fail' | 'not_run' | 'human_needed';
  checkedAt: string;
}

export interface LiveCheckpointStore {
  issue(input: PendingLiveActionIssue, authority: PairedLiveAuthority, context: WriteContext): Promise<PendingLiveAction>;
  read(actionId: string): Promise<PendingLiveAction | null>;
  listPending(platform: NativePlatform, scenario: UatScenario): Promise<PendingLiveAction[]>;
  latestOutcome(platform: NativePlatform, source: SourceId, scenario: UatScenario): Promise<LiveCheckpointOutcome | null>;
  recordFailure(actionId: string, code: string, checkedAt: string, context: WriteContext): Promise<LiveActionFailure>;
  consumeAndAppend(
    result: PairedLiveResult,
    current: LiveCheckpointBinding,
    authority: PairedLiveAuthority,
    context: WriteContext,
  ): Promise<PendingLiveAction>;
}

export type LiveActionAcknowledgement = 'completed' | 'failed' | 'human_needed';
export interface HumanNeededLiveResult { status: 'human_needed'; resultCode: string; checkedAt: string }

export interface LiveScenarioWorkflow {
  slug: string;
  scenario: UatScenario;
  predecessor: UatScenario | null;
  sources: readonly ['moodle', 'edstem'];
  platforms: readonly ['macos', 'windows'];
  ttlMs: number;
  instruction: string;
}

const BOTH_SOURCES = Object.freeze(['moodle', 'edstem'] as const);
const BOTH_PLATFORMS = Object.freeze(['macos', 'windows'] as const);
const HOUR = 60 * 60 * 1000;

/** Closed production scenario registry. No request field selects an operation or evidence cell. */
export const LIVE_SCENARIO_WORKFLOWS: readonly LiveScenarioWorkflow[] = Object.freeze([
  { slug: 'a1-login', scenario: 'a.login', predecessor: null, sources: BOTH_SOURCES, platforms: BOTH_PLATFORMS, ttlMs: HOUR, instruction: '请在官方窗口中亲自完成登录或 MFA，然后返回此已配对页面。' },
  { slug: 'a2-binding', scenario: 'a.binding', predecessor: 'a.login', sources: BOTH_SOURCES, platforms: BOTH_PLATFORMS, ttlMs: HOUR, instruction: '请在本机已配对页面核对两个来源的当前账户绑定。' },
  { slug: 'a2-course-visibility', scenario: 'a.course_visibility', predecessor: 'a.binding', sources: BOTH_SOURCES, platforms: BOTH_PLATFORMS, ttlMs: HOUR, instruction: '仅确认已批准课程可见；不会读取课程内容。' },
  { slug: 'b1-reopen-1', scenario: 'b.reopen_1', predecessor: 'a.course_visibility', sources: BOTH_SOURCES, platforms: BOTH_PLATFORMS, ttlMs: HOUR, instruction: '关闭并重新打开专属浏览器，然后完成第 1 轮有界复查。' },
  { slug: 'b1-reopen-2', scenario: 'b.reopen_2', predecessor: 'b.reopen_1', sources: BOTH_SOURCES, platforms: BOTH_PLATFORMS, ttlMs: HOUR, instruction: '关闭并重新打开专属浏览器，然后完成第 2 轮有界复查。' },
  { slug: 'b1-reopen-3', scenario: 'b.reopen_3', predecessor: 'b.reopen_2', sources: BOTH_SOURCES, platforms: BOTH_PLATFORMS, ttlMs: HOUR, instruction: '关闭并重新打开专属浏览器，然后完成第 3 轮有界复查。' },
  { slug: 'b2-worker-restart', scenario: 'b.worker_restart', predecessor: 'b.reopen_3', sources: BOTH_SOURCES, platforms: BOTH_PLATFORMS, ttlMs: HOUR, instruction: '按本安装的固定步骤重启 Worker，并等待服务重新核验。' },
  { slug: 'b3-codex-exit', scenario: 'b.codex_exit', predecessor: 'b.worker_restart', sources: BOTH_SOURCES, platforms: BOTH_PLATFORMS, ttlMs: 24 * HOUR, instruction: '完全退出 Codex；AutoED 后端必须继续运行。重新打开 Codex 后回到此页面。' },
  { slug: 'c-os-restart', scenario: 'c.os_restart', predecessor: 'b.codex_exit', sources: BOTH_SOURCES, platforms: BOTH_PLATFORMS, ttlMs: 7 * 24 * HOUR, instruction: '完整重启当前操作系统，重新配对此页面后继续。' },
  { slug: 'd-24h-recheck', scenario: 'd.24h_recheck', predecessor: 'c.os_restart', sources: BOTH_SOURCES, platforms: BOTH_PLATFORMS, ttlMs: 7 * 24 * HOUR, instruction: '等待服务器显示的最早复查时间；此步骤不能跳过。' },
  { slug: 'reauth', scenario: 'reauth', predecessor: 'd.24h_recheck', sources: BOTH_SOURCES, platforms: BOTH_PLATFORMS, ttlMs: 7 * 24 * HOUR, instruction: '仅在自然过期或用户主动退出后，由用户本人完成重新登录或 MFA。' },
]);

const workflowByScenario = new Map(LIVE_SCENARIO_WORKFLOWS.map(item => [item.scenario, item]));
const emptyBody = z.strictObject({});
const resultBody = z.strictObject({ actionId: z.uuid(), acknowledgement: z.enum(['completed', 'failed', 'human_needed']) });

export interface LiveActionReference { source: SourceId; actionId: string }
export interface LiveActionProjection {
  platform: NativePlatform;
  scenario: UatScenario;
  state: 'ready' | 'waiting' | 'blocked' | 'pending' | 'human_needed' | 'failed' | 'pass';
  instruction: string;
  earliestActionAt: string | null;
  actions: LiveActionReference[];
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

function liveError(code: string): Error {
  return Object.assign(new Error(code), { code });
}

function sameBinding(left: LiveCheckpointBinding, right: LiveCheckpointBinding): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Scenario-specific paired workflow. The UI can only call the named methods below; scenario,
 * platform, source, predecessor, current binding and L authority are all server-resolved.
 */
export class PairedLiveCheckpointService {
  constructor(
    private readonly store: LiveCheckpointStore,
    private readonly authority: LiveCheckpointAuthorityPort,
    private readonly runtime: PairedLiveCheckpointRuntimePort,
    private readonly context: WriteContext,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async status(): Promise<LiveActionProjection> {
    const platform = this.runtime.platform();
    for (const workflow of LIVE_SCENARIO_WORKFLOWS) {
      const latest = await Promise.all(workflow.sources.map(source => this.store.latestOutcome(platform, source, workflow.scenario)));
      if (latest.every(item => item?.status === 'pass')) continue;
      const pending = await this.store.listPending(platform, workflow.scenario);
      if (pending.length) return this.projection(workflow, 'pending', pending);
      const predecessor = await this.predecessors(workflow);
      if (!predecessor.ready) return this.projection(workflow, 'blocked', []);
      const earliestActionAt = workflow.scenario === 'd.24h_recheck' ? this.dEarliest(predecessor.outcomes) : null;
      if (earliestActionAt && this.now() < Date.parse(earliestActionAt)) return this.projection(workflow, 'waiting', [], earliestActionAt);
      return this.projection(workflow, latest.some(item => item?.status === 'fail') ? 'failed' : 'ready', [], earliestActionAt);
    }
    const reauth = workflowByScenario.get('reauth')!;
    return this.projection(reauth, 'pass', []);
  }

  issueA1Login(input: unknown = {}) { return this.issue('a.login', input); }
  resumeA1Login(input: unknown = {}) { return this.resume('a.login', input); }
  resultA1Login(input: unknown) { return this.result('a.login', input); }
  issueA2Binding(input: unknown = {}) { return this.issue('a.binding', input); }
  resumeA2Binding(input: unknown = {}) { return this.resume('a.binding', input); }
  resultA2Binding(input: unknown) { return this.result('a.binding', input); }
  issueA2CourseVisibility(input: unknown = {}) { return this.issue('a.course_visibility', input); }
  resumeA2CourseVisibility(input: unknown = {}) { return this.resume('a.course_visibility', input); }
  resultA2CourseVisibility(input: unknown) { return this.result('a.course_visibility', input); }
  issueB1Reopen1(input: unknown = {}) { return this.issue('b.reopen_1', input); }
  resumeB1Reopen1(input: unknown = {}) { return this.resume('b.reopen_1', input); }
  resultB1Reopen1(input: unknown) { return this.result('b.reopen_1', input); }
  issueB1Reopen2(input: unknown = {}) { return this.issue('b.reopen_2', input); }
  resumeB1Reopen2(input: unknown = {}) { return this.resume('b.reopen_2', input); }
  resultB1Reopen2(input: unknown) { return this.result('b.reopen_2', input); }
  issueB1Reopen3(input: unknown = {}) { return this.issue('b.reopen_3', input); }
  resumeB1Reopen3(input: unknown = {}) { return this.resume('b.reopen_3', input); }
  resultB1Reopen3(input: unknown) { return this.result('b.reopen_3', input); }
  issueB2WorkerRestart(input: unknown = {}) { return this.issue('b.worker_restart', input); }
  resumeB2WorkerRestart(input: unknown = {}) { return this.resume('b.worker_restart', input); }
  resultB2WorkerRestart(input: unknown) { return this.result('b.worker_restart', input); }
  issueB3CodexExit(input: unknown = {}) { return this.issue('b.codex_exit', input); }
  resumeB3CodexExit(input: unknown = {}) { return this.resume('b.codex_exit', input); }
  resultB3CodexExit(input: unknown) { return this.result('b.codex_exit', input); }
  issueCOsRestart(input: unknown = {}) { return this.issue('c.os_restart', input); }
  resumeCOsRestart(input: unknown = {}) { return this.resume('c.os_restart', input); }
  resultCOsRestart(input: unknown) { return this.result('c.os_restart', input); }
  issueD24hRecheck(input: unknown = {}) { return this.issue('d.24h_recheck', input); }
  resumeD24hRecheck(input: unknown = {}) { return this.resume('d.24h_recheck', input); }
  resultD24hRecheck(input: unknown) { return this.result('d.24h_recheck', input); }
  issueReauth(input: unknown = {}) { return this.issue('reauth', input); }
  resumeReauth(input: unknown = {}) { return this.resume('reauth', input); }
  resultReauth(input: unknown) { return this.result('reauth', input); }

  private async issue(scenario: UatScenario, input: unknown): Promise<LiveActionProjection> {
    emptyBody.parse(input);
    const workflow = workflowByScenario.get(scenario)!;
    const platform = this.runtime.platform();
    if (!workflow.platforms.includes(platform)) throw liveError('LIVE_ACTION_PLATFORM_UNSUPPORTED');
    const predecessors = await this.predecessors(workflow);
    if (!predecessors.ready) throw liveError('LIVE_ACTION_PREDECESSOR_REQUIRED');
    const earliestActionAt = scenario === 'd.24h_recheck' ? this.dEarliest(predecessors.outcomes) : null;
    if (earliestActionAt && this.now() < Date.parse(earliestActionAt)) throw liveError('LIVE_ACTION_TIME_GATE');
    const existing = await this.store.listPending(platform, scenario);
    const actions: PendingLiveAction[] = [...existing];
    for (const source of workflow.sources) {
      if (actions.some(item => item.source === source)) continue;
      const prepared = await this.runtime.prepare(scenario, source);
      if (prepared.platform !== platform || prepared.source !== source || prepared.scenario !== scenario) throw liveError('LIVE_ACTION_BINDING_MISMATCH');
      const predecessor = workflow.predecessor === null ? null : await this.store.latestOutcome(platform, source, workflow.predecessor);
      const prior = await this.store.latestOutcome(platform, source, scenario);
      const binding = {
        ...prepared,
        parentCheckpointId: predecessor?.eventId ?? prepared.parentCheckpointId,
        priorEvidenceEventId: prior?.eventId ?? null,
      };
      actions.push(await this.store.issue({ ...binding, ttlMs: workflow.ttlMs }, await this.authority.mint(binding), this.context));
    }
    return this.projection(workflow, 'pending', actions, earliestActionAt);
  }

  private async resume(scenario: UatScenario, input: unknown): Promise<LiveActionProjection> {
    emptyBody.parse(input);
    const workflow = workflowByScenario.get(scenario)!;
    const actions = await this.store.listPending(this.runtime.platform(), scenario);
    if (!actions.length) throw liveError('LIVE_ACTION_NOT_FOUND');
    for (const action of actions) {
      const current = await this.runtime.current(action);
      if (!sameBinding(current, this.binding(action))) throw liveError('LIVE_ACTION_BINDING_MISMATCH');
    }
    return this.projection(workflow, 'pending', actions);
  }

  private async result(scenario: UatScenario, input: unknown): Promise<LiveActionProjection> {
    const command = resultBody.parse(input);
    const action = await this.store.read(command.actionId);
    if (!action) throw liveError('LIVE_ACTION_NOT_FOUND');
    if (action.scenario !== scenario || action.platform !== this.runtime.platform() || action.state !== 'pending') {
      throw liveError(action.state === 'consumed' ? 'LIVE_ACTION_REPLAY' : 'LIVE_ACTION_BINDING_MISMATCH');
    }
    const current = await this.runtime.current(action);
    if (!sameBinding(current, this.binding(action))) throw liveError('LIVE_ACTION_BINDING_MISMATCH');
    const observed = await this.runtime.observe(action, command.acknowledgement);
    if (observed.status === 'human_needed') {
      await this.store.recordFailure(action.actionId, observed.resultCode, observed.checkedAt, this.context);
      return this.projection(workflowByScenario.get(scenario)!, 'human_needed', [action]);
    }
    const result = PairedLiveResultSchema.parse({ ...observed, actionId: action.actionId, correctionOfEventId: action.priorEvidenceEventId });
    try {
      // This authority is deliberately created after the sealed observation and never enters input/output payloads.
      const writerAuthority = { kind: 'human_action' as const, actionReceiptId: action.actionId, paired: await this.authority.resolve(action, result) };
      await this.store.consumeAndAppend(result, current, writerAuthority.paired, this.context);
    } catch (error) {
      await this.store.recordFailure(action.actionId, safeFailureCode(error), new Date(this.now()).toISOString(), this.context);
      throw error;
    }
    return this.projection(workflowByScenario.get(scenario)!, result.status === 'pass' ? 'pass' : 'failed', []);
  }

  private async predecessors(workflow: LiveScenarioWorkflow): Promise<{ ready: boolean; outcomes: LiveCheckpointOutcome[] }> {
    if (workflow.predecessor === null) return { ready: true, outcomes: [] };
    const platform = this.runtime.platform();
    const outcomes = await Promise.all(workflow.sources.map(source => this.store.latestOutcome(platform, source, workflow.predecessor!)));
    return { ready: outcomes.every(item => item?.status === 'pass'), outcomes: outcomes.filter((item): item is LiveCheckpointOutcome => item !== null) };
  }

  private dEarliest(outcomes: readonly LiveCheckpointOutcome[]): string | null {
    if (!outcomes.length) return null;
    return new Date(Math.max(...outcomes.map(item => Date.parse(item.checkedAt))) + 24 * HOUR).toISOString();
  }

  private binding(action: PendingLiveAction): LiveCheckpointBinding {
    const { actionId: _actionId, issuedAt: _issuedAt, expiresAt: _expiresAt, state: _state, consumedAt: _consumedAt, ...binding } = action;
    return binding;
  }

  private projection(workflow: LiveScenarioWorkflow, state: LiveActionProjection['state'], actions: readonly PendingLiveAction[], earliestActionAt: string | null = null): LiveActionProjection {
    return {
      platform: this.runtime.platform(), scenario: workflow.scenario, state, instruction: workflow.instruction,
      earliestActionAt, actions: actions.map(action => ({ source: action.source, actionId: action.actionId })),
    };
  }
}
