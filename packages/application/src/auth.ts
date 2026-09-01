import type {
  AccountBinding,
  IdentityEvidence,
  SourceId,
  SourceObservation,
  SourceProbeResult,
  SourceResultCode,
  WriteContext,
} from '../../domain/src/model.js';
import type { AccountBindingStore, SourceProbePort } from './ports.js';

export const AUTH_RECOVERY_DELAYS_MS = [0, 5_000, 30_000] as const;

export type AuthProbePort = SourceProbePort;
export type AuthResultCode = SourceResultCode | 'INTERACTION_REQUIRED' | 'ORIGIN_MISMATCH' | 'UNKNOWN_RESULT';
export type RecoveryAttempt = 0 | 1 | 2 | 3;

export type AuthEffect =
  | { kind: 'probe'; source: 'moodle' | 'edstem'; action: 'moodle.auth_probe' | 'edstem.auth_probe' }
  | { kind: 'schedule_recovery_probe'; source: SourceId; attempt: 1 | 2 | 3; delayMs: 0 | 5000 | 30000 }
  | { kind: 'pause_source'; source: SourceId; reason: AuthResultCode }
  | { kind: 'require_user_action'; source: SourceId; reason: 'login' | 'reauth' | 'interaction' | 'binding_confirmation' };

export interface AuthSourceState {
  source: SourceId;
  observation: SourceObservation;
  identity: IdentityEvidence | null;
  currentResultCode: AuthResultCode;
  lastSuccess: SourceProbeResult | null;
  logoutIntent: boolean;
  recoveryAttempt: RecoveryAttempt;
  paused: boolean;
}

export type BindingDecisionStatus = 'unbound' | 'candidate' | 'manual_confirmation_required' | 'confirmed' | 'identity_mismatch';
export type BindingDecisionReason = 'none' | 'strict_match' | 'insufficient_evidence' | 'confirmed_match' | 'evidence_conflict' | 'identity_changed';

export interface BindingDecisionInput {
  moodle: IdentityEvidence | null;
  edstem: IdentityEvidence | null;
  confirmed: AccountBinding | null;
  checkedAt: string | null;
  displayHints?: {
    moodle: { displayName: string; schoolEmail: string };
    edstem: { displayName: string; schoolEmail: string };
  };
}

export interface BindingDecision {
  status: BindingDecisionStatus;
  reason: BindingDecisionReason;
  binding: AccountBinding;
}

export interface AuthFlowState {
  sources: { moodle: AuthSourceState; edstem: AuthSourceState };
  binding: AccountBinding;
  confirmedBinding: AccountBinding | null;
  bindingDecision: BindingDecisionStatus;
  courseAccess: 'blocked' | 'eligible';
  sequence: 'idle' | 'moodle_pending' | 'edstem_pending' | 'binding_pending' | 'complete' | 'paused';
  reobservedAfterMismatch: { moodle: boolean; edstem: boolean };
}

export type AuthEvent =
  | { type: 'start_probe_cycle' }
  | {
      type: 'probe_result';
      source: SourceId;
      result: SourceProbeResult;
      approvedOriginMatch: boolean;
      positiveMarker: boolean;
      resultCode?: AuthResultCode;
      temporaryFailure?: boolean;
      interactionRequired?: boolean;
    }
  | { type: 'explicit_logout'; source: SourceId }
  | { type: 'user_requested_login'; source: SourceId }
  | {
      type: 'confirm_binding';
      actionReceiptId: string;
      checkedAt: string;
      moodle?: IdentityEvidence;
      edstem?: IdentityEvidence;
    };

export interface AuthTransition {
  state: AuthFlowState;
  effects: readonly AuthEffect[];
}

const KNOWN_CODES = new Set<AuthResultCode>([
  'NOT_OBSERVED',
  'AUTHENTICATED',
  'AUTH_REQUIRED',
  'REAUTH_REQUIRED',
  'NETWORK_UNAVAILABLE',
  'PARSER_CHANGED',
  'CAPABILITY_DENIED',
  'IDENTITY_MISMATCH',
  'INTERACTION_REQUIRED',
  'ORIGIN_MISMATCH',
  'UNKNOWN_RESULT',
]);

function initialObservation(source: SourceId): SourceObservation {
  return {
    source,
    auth: 'not_observed',
    capability: 'unknown',
    health: 'not_observed',
    freshness: 'not_observed',
    completeness: 'not_observed',
    outcome: 'not_observed',
    checkedAt: null,
    resultCode: 'NOT_OBSERVED',
    courseAccess: 'blocked',
    lastSuccess: null,
  };
}

function initialSource(source: SourceId): AuthSourceState {
  return {
    source,
    observation: initialObservation(source),
    identity: null,
    currentResultCode: 'NOT_OBSERVED',
    lastSuccess: null,
    logoutIntent: false,
    recoveryAttempt: 0,
    paused: false,
  };
}

function unbound(checkedAt: string | null = null): AccountBinding {
  return {
    status: 'unbound',
    moodle: null,
    edstem: null,
    basis: 'none',
    confirmedByActionReceiptId: null,
    courseAccess: 'blocked',
    checkedAt,
  };
}

function cloneIdentity(value: IdentityEvidence | null): IdentityEvidence | null {
  return value ? { ...value } : null;
}

function cloneProbe(value: SourceProbeResult | null): SourceProbeResult | null {
  if (!value) return null;
  return {
    request: { ...value.request },
    observation: {
      ...value.observation,
      lastSuccess: value.observation.lastSuccess ? { ...value.observation.lastSuccess } : null,
    },
    identity: cloneIdentity(value.identity),
    selectedCourseVisible: value.selectedCourseVisible,
  };
}

function cloneSource(value: AuthSourceState): AuthSourceState {
  return {
    ...value,
    observation: {
      ...value.observation,
      lastSuccess: value.observation.lastSuccess ? { ...value.observation.lastSuccess } : null,
    },
    identity: cloneIdentity(value.identity),
    lastSuccess: cloneProbe(value.lastSuccess),
  };
}

function cloneBinding(value: AccountBinding): AccountBinding {
  return { ...value, moodle: cloneIdentity(value.moodle), edstem: cloneIdentity(value.edstem) };
}

function cloneState(value: AuthFlowState): AuthFlowState {
  return {
    ...value,
    sources: { moodle: cloneSource(value.sources.moodle), edstem: cloneSource(value.sources.edstem) },
    binding: cloneBinding(value.binding),
    confirmedBinding: value.confirmedBinding ? cloneBinding(value.confirmedBinding) : null,
    reobservedAfterMismatch: { ...value.reobservedAfterMismatch },
  };
}

export function createAuthFlowState(input: Partial<AuthFlowState> = {}): AuthFlowState {
  const base: AuthFlowState = {
    sources: { moodle: initialSource('moodle'), edstem: initialSource('edstem') },
    binding: unbound(),
    confirmedBinding: null,
    bindingDecision: 'unbound',
    courseAccess: 'blocked',
    sequence: 'idle',
    reobservedAfterMismatch: { moodle: false, edstem: false },
  };
  const state: AuthFlowState = {
    ...base,
    ...input,
    sources: input.sources
      ? { moodle: cloneSource(input.sources.moodle), edstem: cloneSource(input.sources.edstem) }
      : base.sources,
    binding: input.binding ? cloneBinding(input.binding) : base.binding,
    confirmedBinding: input.confirmedBinding ? cloneBinding(input.confirmedBinding) : null,
    reobservedAfterMismatch: input.reobservedAfterMismatch
      ? { ...input.reobservedAfterMismatch }
      : base.reobservedAfterMismatch,
  };
  return cloneState(state);
}

function sameEvidence(left: IdentityEvidence, right: IdentityEvidence): boolean {
  return left.source === right.source
    && left.subjectFingerprint === right.subjectFingerprint
    && left.organizationFingerprint === right.organizationFingerprint
    && left.tenantFingerprint === right.tenantFingerprint
    && left.approvedScopeId === right.approvedScopeId
    && left.evidenceKind === right.evidenceKind;
}

function crossSourceMatch(moodle: IdentityEvidence, edstem: IdentityEvidence): boolean {
  return moodle.source === 'moodle'
    && edstem.source === 'edstem'
    && moodle.subjectFingerprint === edstem.subjectFingerprint
    && moodle.organizationFingerprint === edstem.organizationFingerprint
    && moodle.tenantFingerprint === edstem.tenantFingerprint
    && moodle.approvedScopeId === edstem.approvedScopeId
    && moodle.evidenceKind === 'stable_subject_organization_scope'
    && edstem.evidenceKind === 'stable_subject_organization_scope';
}

function mismatchBinding(moodle: IdentityEvidence, edstem: IdentityEvidence, checkedAt: string | null): AccountBinding {
  return {
    status: 'identity_mismatch',
    moodle: cloneIdentity(moodle),
    edstem: cloneIdentity(edstem),
    basis: 'identity_changed',
    confirmedByActionReceiptId: null,
    courseAccess: 'blocked',
    checkedAt,
  };
}

export function decideAccountBinding(input: BindingDecisionInput): BindingDecision {
  void input.displayHints;
  const { moodle, edstem, confirmed, checkedAt } = input;
  if (!moodle || !edstem) {
    return { status: 'manual_confirmation_required', reason: 'insufficient_evidence', binding: unbound(checkedAt) };
  }
  if (confirmed?.status === 'confirmed' && confirmed.moodle && confirmed.edstem) {
    if (!sameEvidence(moodle, confirmed.moodle) || !sameEvidence(edstem, confirmed.edstem)) {
      return { status: 'identity_mismatch', reason: 'identity_changed', binding: mismatchBinding(moodle, edstem, checkedAt) };
    }
    return {
      status: 'confirmed',
      reason: 'confirmed_match',
      binding: { ...cloneBinding(confirmed), moodle: cloneIdentity(moodle), edstem: cloneIdentity(edstem), checkedAt },
    };
  }
  if (!crossSourceMatch(moodle, edstem)) {
    return { status: 'identity_mismatch', reason: 'evidence_conflict', binding: mismatchBinding(moodle, edstem, checkedAt) };
  }
  return {
    status: 'candidate',
    reason: 'strict_match',
    binding: {
      status: 'candidate',
      moodle: cloneIdentity(moodle),
      edstem: cloneIdentity(edstem),
      basis: 'stable_subject_organization_scope',
      confirmedByActionReceiptId: null,
      courseAccess: 'blocked',
      checkedAt,
    },
  };
}

/** Persists only evidence-derived candidate or drift decisions; human confirmation remains an API-only action. */
export class IdentityBindingCoordinator {
  constructor(private readonly store: AccountBindingStore, private readonly now: () => string = () => new Date().toISOString()) {}

  async reconcile(moodle: IdentityEvidence | null, edstem: IdentityEvidence | null, context: WriteContext): Promise<BindingDecision> {
    const current = await this.store.read();
    const decision = decideAccountBinding({
      moodle,
      edstem,
      confirmed: current.status === 'confirmed' ? current : null,
      checkedAt: this.now(),
    });
    if (decision.binding.status === 'candidate' || decision.binding.status === 'identity_mismatch') {
      await this.store.write(decision.binding, context);
    }
    return decision;
  }
}

function authProbe(source: SourceId): AuthEffect {
  return source === 'moodle'
    ? { kind: 'probe', source, action: 'moodle.auth_probe' }
    : { kind: 'probe', source, action: 'edstem.auth_probe' };
}

function safeCode(event: Extract<AuthEvent, { type: 'probe_result' }>): AuthResultCode {
  if (event.interactionRequired) return 'INTERACTION_REQUIRED';
  if (!event.approvedOriginMatch) return 'ORIGIN_MISMATCH';
  if (!event.positiveMarker && (event.resultCode ?? event.result.observation.resultCode) === 'AUTHENTICATED') return 'PARSER_CHANGED';
  const candidate = event.resultCode ?? event.result.observation.resultCode;
  return KNOWN_CODES.has(candidate) ? candidate : 'UNKNOWN_RESULT';
}

function validPositive(event: Extract<AuthEvent, { type: 'probe_result' }>, code: AuthResultCode): boolean {
  const { result, source } = event;
  return code === 'AUTHENTICATED'
    && event.approvedOriginMatch
    && event.positiveMarker
    && !event.interactionRequired
    && result.request.source === source
    && result.request.action === `${source}.auth_probe`
    && result.observation.source === source
    && result.observation.auth === 'authenticated'
    && result.observation.resultCode === 'AUTHENTICATED'
    && result.identity?.source === source
    && result.identity.approvedScopeId === result.request.approvedScopeId;
}

function domainCode(code: AuthResultCode): SourceResultCode {
  if (code === 'INTERACTION_REQUIRED') return 'REAUTH_REQUIRED';
  if (code === 'ORIGIN_MISMATCH' || code === 'UNKNOWN_RESULT') return 'PARSER_CHANGED';
  return code;
}

function failureObservation(source: AuthSourceState, incoming: SourceObservation, code: AuthResultCode): SourceObservation {
  const retained = source.observation;
  const common = {
    ...retained,
    source: source.source,
    checkedAt: incoming.checkedAt ?? retained.checkedAt,
    resultCode: domainCode(code),
    courseAccess: 'blocked' as const,
    lastSuccess: retained.lastSuccess ? { ...retained.lastSuccess } : null,
  };
  switch (code) {
    case 'AUTH_REQUIRED':
      return { ...common, auth: 'unauthenticated', capability: 'unknown', health: 'healthy', freshness: 'fresh', completeness: 'not_observed', outcome: 'error' };
    case 'REAUTH_REQUIRED':
      return { ...common, auth: 'reauth_required', capability: 'unknown', health: 'healthy', freshness: 'stale', completeness: 'not_observed', outcome: 'error' };
    case 'NETWORK_UNAVAILABLE':
      return { ...common, health: 'error', freshness: 'stale', completeness: 'partial', outcome: 'error' };
    case 'PARSER_CHANGED':
      return { ...common, capability: 'unknown', health: 'degraded', freshness: 'stale', completeness: 'partial', outcome: 'error' };
    case 'CAPABILITY_DENIED':
      return { ...common, capability: 'denied', health: 'healthy', freshness: 'fresh', completeness: 'partial', outcome: 'partial' };
    case 'INTERACTION_REQUIRED':
      return { ...common, auth: 'reauth_required', capability: 'unknown', health: 'healthy', freshness: 'stale', completeness: 'partial', outcome: 'partial' };
    case 'ORIGIN_MISMATCH':
    case 'UNKNOWN_RESULT':
      return { ...common, capability: 'unknown', health: 'error', freshness: 'stale', completeness: 'partial', outcome: 'error' };
    case 'IDENTITY_MISMATCH':
      return { ...common, auth: 'identity_mismatch', health: 'healthy', freshness: 'fresh', completeness: 'partial', outcome: 'error' };
    case 'NOT_OBSERVED':
      return { ...common, auth: 'not_observed', capability: 'unknown', health: 'not_observed', freshness: 'not_observed', completeness: 'not_observed', outcome: 'not_observed' };
    case 'AUTHENTICATED':
      return common;
    default:
      return assertNever(code);
  }
}

function assertNever(value: never): never {
  throw new Error(`UNREACHABLE_AUTH_STATE:${String(value)}`);
}

function markGlobalMismatch(state: AuthFlowState, source: SourceId, checkedAt: string | null): void {
  const moodle = state.sources.moodle.identity;
  const edstem = state.sources.edstem.identity;
  state.binding = moodle && edstem ? mismatchBinding(moodle, edstem, checkedAt) : {
    ...unbound(checkedAt), status: 'identity_mismatch', basis: 'identity_changed', courseAccess: 'blocked',
  };
  state.bindingDecision = 'identity_mismatch';
  state.courseAccess = 'blocked';
  state.sequence = 'paused';
  state.sources.moodle.observation.courseAccess = 'blocked';
  state.sources.edstem.observation.courseAccess = 'blocked';
  if (state.confirmedBinding === null) state.reobservedAfterMismatch = { moodle: false, edstem: false };
  state.reobservedAfterMismatch[source] = true;
}

function applyPositive(state: AuthFlowState, event: Extract<AuthEvent, { type: 'probe_result' }>): AuthTransition {
  const source = event.source;
  const slot = state.sources[source];
  slot.observation = {
    ...event.result.observation,
    courseAccess: 'blocked',
    lastSuccess: {
      checkedAt: event.result.observation.checkedAt!,
      subjectFingerprint: event.result.identity!.subjectFingerprint,
    },
  };
  slot.identity = cloneIdentity(event.result.identity);
  slot.currentResultCode = 'AUTHENTICATED';
  slot.lastSuccess = cloneProbe(event.result);
  slot.logoutIntent = false;
  slot.recoveryAttempt = 0;
  slot.paused = false;
  state.courseAccess = 'blocked';

  if (state.bindingDecision === 'identity_mismatch') state.reobservedAfterMismatch[source] = true;
  if (source === 'moodle') {
    state.sequence = 'edstem_pending';
    return { state, effects: [authProbe('edstem')] };
  }

  const decision = decideAccountBinding({
    moodle: state.sources.moodle.identity,
    edstem: state.sources.edstem.identity,
    confirmed: state.confirmedBinding,
    checkedAt: event.result.observation.checkedAt,
  });
  state.binding = decision.binding;
  state.bindingDecision = decision.status;
  if (decision.status === 'identity_mismatch') {
    markGlobalMismatch(state, source, event.result.observation.checkedAt);
    return { state, effects: [{ kind: 'pause_source', source, reason: 'IDENTITY_MISMATCH' }] };
  }
  if (decision.status === 'confirmed'
    && state.sources.moodle.observation.auth === 'authenticated'
    && state.sources.edstem.observation.auth === 'authenticated') {
    state.courseAccess = 'eligible';
    state.sequence = 'complete';
    state.sources.moodle.observation.courseAccess = 'allowed';
    state.sources.edstem.observation.courseAccess = 'allowed';
    return { state, effects: [] };
  }
  state.sequence = 'binding_pending';
  return {
    state,
    effects: [{ kind: 'require_user_action', source: 'edstem', reason: 'binding_confirmation' }],
  };
}

function applyFailure(
  state: AuthFlowState,
  event: Extract<AuthEvent, { type: 'probe_result' }>,
  code: AuthResultCode,
): AuthTransition {
  const source = event.source;
  const slot = state.sources[source];
  slot.observation = failureObservation(slot, event.result.observation, code);
  slot.currentResultCode = code;
  slot.paused = true;
  state.courseAccess = 'blocked';
  state.sequence = 'paused';

  if (code === 'IDENTITY_MISMATCH') {
    markGlobalMismatch(state, source, event.result.observation.checkedAt);
    return { state, effects: [{ kind: 'pause_source', source, reason: code }] };
  }
  if (code === 'INTERACTION_REQUIRED') {
    return { state, effects: [{ kind: 'require_user_action', source, reason: 'interaction' }] };
  }
  if (code === 'AUTH_REQUIRED') {
    slot.recoveryAttempt = 0;
    return { state, effects: [{ kind: 'require_user_action', source, reason: 'login' }] };
  }
  const recoverable = code === 'REAUTH_REQUIRED' || code === 'NETWORK_UNAVAILABLE' && event.temporaryFailure === true;
  if (recoverable && slot.recoveryAttempt < AUTH_RECOVERY_DELAYS_MS.length) {
    const attempt = (slot.recoveryAttempt + 1) as 1 | 2 | 3;
    slot.recoveryAttempt = attempt;
    slot.paused = false;
    return {
      state,
      effects: [{ kind: 'schedule_recovery_probe', source, attempt, delayMs: AUTH_RECOVERY_DELAYS_MS[attempt - 1]! }],
    };
  }
  slot.recoveryAttempt = recoverable ? 3 : 0;
  const effects: AuthEffect[] = [{ kind: 'pause_source', source, reason: code }];
  if (recoverable) effects.push({ kind: 'require_user_action', source, reason: 'reauth' });
  return { state, effects };
}

function confirmBinding(state: AuthFlowState, event: Extract<AuthEvent, { type: 'confirm_binding' }>): AuthTransition {
  const moodle = event.moodle ?? state.sources.moodle.identity;
  const edstem = event.edstem ?? state.sources.edstem.identity;
  const canReplaceMismatch = state.bindingDecision !== 'identity_mismatch'
    || state.reobservedAfterMismatch.moodle && state.reobservedAfterMismatch.edstem;
  if (!moodle || !edstem || moodle.source !== 'moodle' || edstem.source !== 'edstem' || !canReplaceMismatch) {
    return { state, effects: [{ kind: 'require_user_action', source: 'edstem', reason: 'binding_confirmation' }] };
  }
  const binding: AccountBinding = {
    status: 'confirmed',
    moodle: cloneIdentity(moodle),
    edstem: cloneIdentity(edstem),
    basis: 'human_confirmed',
    confirmedByActionReceiptId: event.actionReceiptId,
    courseAccess: 'allowed',
    checkedAt: event.checkedAt,
  };
  state.binding = binding;
  state.confirmedBinding = cloneBinding(binding);
  state.bindingDecision = 'confirmed';
  state.reobservedAfterMismatch = { moodle: false, edstem: false };
  const bothAuthenticated = state.sources.moodle.observation.auth === 'authenticated'
    && state.sources.edstem.observation.auth === 'authenticated';
  state.courseAccess = bothAuthenticated ? 'eligible' : 'blocked';
  state.sequence = bothAuthenticated ? 'complete' : 'paused';
  state.sources.moodle.observation.courseAccess = bothAuthenticated ? 'allowed' : 'blocked';
  state.sources.edstem.observation.courseAccess = bothAuthenticated ? 'allowed' : 'blocked';
  return { state, effects: [] };
}

export function reduceAuthFlow(previous: AuthFlowState, event: AuthEvent): AuthTransition {
  const state = cloneState(previous);
  switch (event.type) {
    case 'start_probe_cycle':
      state.courseAccess = 'blocked';
      if (state.sources.moodle.logoutIntent) {
        state.sequence = 'paused';
        return { state, effects: [{ kind: 'require_user_action', source: 'moodle', reason: 'login' }] };
      }
      state.sequence = 'moodle_pending';
      return { state, effects: [authProbe('moodle')] };
    case 'probe_result': {
      const code = safeCode(event);
      return validPositive(event, code) ? applyPositive(state, event) : applyFailure(state, event, code === 'AUTHENTICATED' ? 'PARSER_CHANGED' : code);
    }
    case 'explicit_logout': {
      const slot = state.sources[event.source];
      slot.logoutIntent = true;
      slot.recoveryAttempt = 0;
      slot.paused = true;
      slot.currentResultCode = 'AUTH_REQUIRED';
      slot.observation = failureObservation(slot, slot.observation, 'AUTH_REQUIRED');
      state.courseAccess = 'blocked';
      state.sequence = 'paused';
      return { state, effects: [{ kind: 'require_user_action', source: event.source, reason: 'login' }] };
    }
    case 'user_requested_login':
      state.sources[event.source].logoutIntent = false;
      state.sources[event.source].paused = true;
      state.sequence = 'paused';
      return { state, effects: [{ kind: 'require_user_action', source: event.source, reason: 'login' }] };
    case 'confirm_binding':
      return confirmBinding(state, event);
    default:
      return assertNever(event);
  }
}
