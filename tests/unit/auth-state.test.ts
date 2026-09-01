import { describe, expect, it } from 'vitest';
import {
  AUTH_RECOVERY_DELAYS_MS,
  createAuthFlowState,
  decideAccountBinding,
  reduceAuthFlow,
  type AuthEvent,
  type AuthFlowState,
  type AuthResultCode,
} from '../../packages/application/src/auth.js';
import type { AccountBinding, IdentityEvidence, SourceId, SourceProbeResult } from '../../packages/domain/src/model.js';

const CHECKED_AT = '2026-09-01T00:00:00.000Z';
const LATER = '2026-09-01T00:01:00.000Z';
const CONFIG_ID = '11111111-1111-4111-8111-111111111111';
const SCOPE_ID = '22222222-2222-4222-8222-222222222222';
const RECEIPT_ID = '33333333-3333-4333-8333-333333333333';

function identity(
  source: SourceId,
  overrides: Partial<IdentityEvidence> = {},
): IdentityEvidence {
  return {
    source,
    subjectFingerprint: 'unified-subject',
    organizationFingerprint: 'organization-one',
    tenantFingerprint: 'tenant-one',
    approvedScopeId: SCOPE_ID,
    evidenceKind: 'stable_subject_organization_scope',
    ...overrides,
  };
}

function result(
  source: SourceId,
  code: SourceProbeResult['observation']['resultCode'] = 'AUTHENTICATED',
  identityEvidence: IdentityEvidence | null = identity(source),
): SourceProbeResult {
  const authenticated = code === 'AUTHENTICATED';
  return {
    request: {
      source,
      action: `${source}.auth_probe`,
      approvedConfigId: CONFIG_ID,
      approvedScopeId: SCOPE_ID,
    },
    observation: {
      source,
      auth: authenticated ? 'authenticated' : code === 'AUTH_REQUIRED' ? 'unauthenticated' : code === 'REAUTH_REQUIRED' ? 'reauth_required' : code === 'IDENTITY_MISMATCH' ? 'identity_mismatch' : 'not_observed',
      capability: authenticated ? 'available' : code === 'CAPABILITY_DENIED' ? 'denied' : 'unknown',
      health: code === 'NETWORK_UNAVAILABLE' ? 'error' : code === 'PARSER_CHANGED' ? 'degraded' : 'healthy',
      freshness: authenticated ? 'fresh' : 'stale',
      completeness: authenticated ? 'complete' : 'partial',
      outcome: authenticated ? 'present' : 'error',
      checkedAt: LATER,
      resultCode: code,
      courseAccess: 'blocked',
      lastSuccess: null,
    },
    identity: identityEvidence,
    selectedCourseVisible: null,
  };
}

function observed(
  source: SourceId,
  probeResult: SourceProbeResult,
  overrides: Partial<Extract<AuthEvent, { type: 'probe_result' }>> = {},
): Extract<AuthEvent, { type: 'probe_result' }> {
  return {
    type: 'probe_result',
    source,
    result: probeResult,
    approvedOriginMatch: true,
    positiveMarker: probeResult.observation.resultCode === 'AUTHENTICATED',
    ...overrides,
  };
}

function apply(state: AuthFlowState, event: AuthEvent): AuthFlowState {
  return reduceAuthFlow(state, event).state;
}

function authenticatedState(): AuthFlowState {
  let state = createAuthFlowState();
  state = apply(state, { type: 'start_probe_cycle' });
  state = apply(state, observed('moodle', result('moodle')));
  state = apply(state, observed('edstem', result('edstem')));
  state = apply(state, { type: 'confirm_binding', actionReceiptId: RECEIPT_ID, checkedAt: LATER });
  return state;
}

describe('dual-source auth state machine', () => {
  it('probes Moodle first and advances to EdStem only with all positive evidence', () => {
    const initial = createAuthFlowState();
    const started = reduceAuthFlow(initial, { type: 'start_probe_cycle' });
    expect(started.effects).toEqual([{ kind: 'probe', source: 'moodle', action: 'moodle.auth_probe' }]);
    expect(started.state.sequence).toBe('moodle_pending');
    expect(initial.sequence).toBe('idle');

    for (const [approvedOriginMatch, positiveMarker, expectedCode] of [
      [false, true, 'ORIGIN_MISMATCH'],
      [true, false, 'PARSER_CHANGED'],
    ] as const) {
      const transition = reduceAuthFlow(started.state, observed('moodle', result('moodle'), { approvedOriginMatch, positiveMarker }));
      expect(transition.state.sources.moodle.currentResultCode).toBe(expectedCode);
      expect(transition.effects).not.toContainEqual({ kind: 'probe', source: 'edstem', action: 'edstem.auth_probe' });
      expect(transition.effects.some(effect => effect.kind === 'pause_source')).toBe(true);
    }

    const positive = reduceAuthFlow(started.state, observed('moodle', result('moodle')));
    expect(positive.effects).toEqual([{ kind: 'probe', source: 'edstem', action: 'edstem.auth_probe' }]);
    expect(positive.state.sequence).toBe('edstem_pending');
    expect(positive.state.sources.edstem.observation.auth).toBe('not_observed');
  });

  it('stops immediately for interaction or MFA without scheduling recovery', () => {
    const state = authenticatedState();
    const transition = reduceAuthFlow(state, observed('edstem', result('edstem', 'REAUTH_REQUIRED'), {
      resultCode: 'INTERACTION_REQUIRED', interactionRequired: true,
    }));
    expect(transition.state.sources.edstem.currentResultCode).toBe('INTERACTION_REQUIRED');
    expect(transition.effects).toEqual([{ kind: 'require_user_action', source: 'edstem', reason: 'interaction' }]);
    expect(transition.effects.some(effect => effect.kind === 'schedule_recovery_probe')).toBe(false);
  });

  describe('strict account binding', () => {
    const confirmed = (moodle = identity('moodle'), edstem = identity('edstem')): AccountBinding => ({
      status: 'confirmed', moodle, edstem, basis: 'human_confirmed', confirmedByActionReceiptId: RECEIPT_ID,
      courseAccess: 'allowed', checkedAt: CHECKED_AT,
    });

    it('creates only a candidate for complete matching stable evidence', () => {
      const decision = decideAccountBinding({ moodle: identity('moodle'), edstem: identity('edstem'), confirmed: null, checkedAt: CHECKED_AT });
      expect(decision.status).toBe('candidate');
      expect(decision.reason).toBe('strict_match');
      expect(decision.binding).toMatchObject({ status: 'candidate', courseAccess: 'blocked', confirmedByActionReceiptId: null });
    });

    it('requires manual confirmation when either source lacks cross-source stable evidence', () => {
      const decision = decideAccountBinding({ moodle: identity('moodle'), edstem: null, confirmed: null, checkedAt: CHECKED_AT });
      expect(decision.status).toBe('manual_confirmation_required');
      expect(decision.binding).toMatchObject({ status: 'unbound', courseAccess: 'blocked' });
    });

    it('never treats matching display names or email addresses as binding evidence', () => {
      const decision = decideAccountBinding({
        moodle: identity('moodle'),
        edstem: identity('edstem', { subjectFingerprint: 'different-subject' }),
        confirmed: null,
        checkedAt: CHECKED_AT,
        displayHints: {
          moodle: { displayName: 'Same Person', schoolEmail: 'same@example.edu' },
          edstem: { displayName: 'Same Person', schoolEmail: 'same@example.edu' },
        },
      });
      expect(decision.status).toBe('identity_mismatch');
      expect(decision.reason).toBe('evidence_conflict');
    });

    it.each([
      ['subject', { subjectFingerprint: 'changed-subject' }],
      ['organization', { organizationFingerprint: 'changed-organization' }],
      ['tenant', { tenantFingerprint: 'changed-tenant' }],
      ['approved scope', { approvedScopeId: '44444444-4444-4444-8444-444444444444' }],
    ] satisfies ReadonlyArray<readonly [string, Partial<IdentityEvidence>]>)('hard-blocks a %s conflict', (_name, change) => {
      const decision = decideAccountBinding({ moodle: identity('moodle'), edstem: identity('edstem', change), confirmed: null, checkedAt: CHECKED_AT });
      expect(decision.status).toBe('identity_mismatch');
      expect(decision.binding.courseAccess).toBe('blocked');
    });

    it('detects drift from either side of an existing confirmed binding', () => {
      const prior = confirmed();
      for (const input of [
        { moodle: identity('moodle', { subjectFingerprint: 'new-moodle' }), edstem: identity('edstem') },
        { moodle: identity('moodle'), edstem: identity('edstem', { organizationFingerprint: 'new-organization' }) },
      ]) {
        const decision = decideAccountBinding({ ...input, confirmed: prior, checkedAt: LATER });
        expect(decision).toMatchObject({ status: 'identity_mismatch', reason: 'identity_changed' });
        expect(decision.binding).not.toEqual(prior);
        expect(prior.status).toBe('confirmed');
      }
    });
  });

  it('makes identity mismatch a sticky global course-access fence', () => {
    const state = authenticatedState();
    const mismatch = reduceAuthFlow(state, observed('edstem', result('edstem', 'IDENTITY_MISMATCH', identity('edstem', { subjectFingerprint: 'changed-subject' }))));
    expect(mismatch.state.courseAccess).toBe('blocked');
    expect(mismatch.state.binding.status).toBe('identity_mismatch');
    expect(mismatch.state.sources.moodle.observation.courseAccess).toBe('blocked');
    expect(mismatch.state.sources.edstem.observation.courseAccess).toBe('blocked');
    expect(mismatch.effects.every(effect => effect.kind !== 'probe' || effect.action.endsWith('.auth_probe'))).toBe(true);

    const repeated = reduceAuthFlow(mismatch.state, observed('moodle', result('moodle')));
    expect(repeated.state.courseAccess).toBe('blocked');
    expect(repeated.state.binding.status).toBe('identity_mismatch');
    expect(repeated.effects.some(effect => effect.kind === 'probe' && effect.action.includes('course_visibility'))).toBe(false);
    expect(state.binding.status).toBe('confirmed');
  });

  describe('source-isolated failures and last success', () => {
    const cases: ReadonlyArray<{
      code: AuthResultCode;
      domainCode: SourceProbeResult['observation']['resultCode'];
      overrides?: Partial<Extract<AuthEvent, { type: 'probe_result' }>>;
      expected: Record<string, string>;
    }> = [
      { code: 'AUTH_REQUIRED', domainCode: 'AUTH_REQUIRED', expected: { auth: 'unauthenticated', capability: 'unknown', health: 'healthy', freshness: 'fresh', completeness: 'not_observed' } },
      { code: 'REAUTH_REQUIRED', domainCode: 'REAUTH_REQUIRED', expected: { auth: 'reauth_required', capability: 'unknown', health: 'healthy', freshness: 'stale', completeness: 'not_observed' } },
      { code: 'NETWORK_UNAVAILABLE', domainCode: 'NETWORK_UNAVAILABLE', overrides: { temporaryFailure: true }, expected: { auth: 'authenticated', capability: 'available', health: 'error', freshness: 'stale', completeness: 'partial' } },
      { code: 'PARSER_CHANGED', domainCode: 'PARSER_CHANGED', expected: { auth: 'authenticated', capability: 'unknown', health: 'degraded', freshness: 'stale', completeness: 'partial' } },
      { code: 'CAPABILITY_DENIED', domainCode: 'CAPABILITY_DENIED', expected: { auth: 'authenticated', capability: 'denied', health: 'healthy', freshness: 'fresh', completeness: 'partial' } },
      { code: 'INTERACTION_REQUIRED', domainCode: 'REAUTH_REQUIRED', overrides: { resultCode: 'INTERACTION_REQUIRED', interactionRequired: true }, expected: { auth: 'reauth_required', capability: 'unknown', health: 'healthy', freshness: 'stale', completeness: 'partial' } },
      { code: 'ORIGIN_MISMATCH', domainCode: 'PARSER_CHANGED', overrides: { resultCode: 'ORIGIN_MISMATCH', approvedOriginMatch: false }, expected: { auth: 'authenticated', capability: 'unknown', health: 'error', freshness: 'stale', completeness: 'partial' } },
      { code: 'IDENTITY_MISMATCH', domainCode: 'IDENTITY_MISMATCH', expected: { auth: 'identity_mismatch', capability: 'available', health: 'healthy', freshness: 'fresh', completeness: 'partial' } },
    ];

    it.each(cases)('classifies $code without mutating the other source or prior success', testCase => {
      const before = authenticatedState();
      const otherBefore = structuredClone(before.sources.moodle);
      const failedBefore = before.sources.edstem;
      const lastSuccess = failedBefore.lastSuccess;
      const priorIdentity = failedBefore.identity;
      const transition = reduceAuthFlow(before, observed('edstem', result('edstem', testCase.domainCode), testCase.overrides));
      const failed = transition.state.sources.edstem;

      expect(failed.currentResultCode).toBe(testCase.code);
      expect(failed.observation).toMatchObject(testCase.expected);
      expect(failed.lastSuccess).toEqual(lastSuccess);
      expect(failed.identity).toEqual(priorIdentity);
      if (testCase.code !== 'IDENTITY_MISMATCH') expect(transition.state.sources.moodle).toEqual(otherBefore);
      expect(before.sources.edstem).toBe(failedBefore);
      expect(before.sources.edstem.currentResultCode).toBe('AUTHENTICATED');
    });

    it('fails closed on an unknown result without exposing or scheduling it', () => {
      const state = authenticatedState();
      const transition = reduceAuthFlow(state, observed('edstem', result('edstem'), { resultCode: 'PRIVATE_PAGE_TEXT' as AuthResultCode }));
      expect(transition.state.sources.edstem.currentResultCode).toBe('UNKNOWN_RESULT');
      expect(transition.state.sources.edstem).toMatchObject({ paused: true, recoveryAttempt: 0 });
      expect(transition.effects).toEqual([{ kind: 'pause_source', source: 'edstem', reason: 'UNKNOWN_RESULT' }]);
      expect(JSON.stringify(transition)).not.toContain('PRIVATE_PAGE_TEXT');
    });
  });

  it('persists explicit logout intent until the user explicitly requests login', () => {
    const loggedOut = reduceAuthFlow(authenticatedState(), { type: 'explicit_logout', source: 'moodle' });
    expect(loggedOut.state.sources.moodle).toMatchObject({ logoutIntent: true, recoveryAttempt: 0, paused: true });
    expect(loggedOut.state.sources.moodle.observation.auth).toBe('unauthenticated');
    expect(loggedOut.effects).toEqual([{ kind: 'require_user_action', source: 'moodle', reason: 'login' }]);

    const ordinaryStart = reduceAuthFlow(loggedOut.state, { type: 'start_probe_cycle' });
    expect(ordinaryStart.state.sources.moodle.logoutIntent).toBe(true);
    expect(ordinaryStart.effects).toEqual([{ kind: 'require_user_action', source: 'moodle', reason: 'login' }]);

    const requested = reduceAuthFlow(ordinaryStart.state, { type: 'user_requested_login', source: 'moodle' });
    expect(requested.state.sources.moodle.logoutIntent).toBe(false);
    expect(requested.effects).toEqual([{ kind: 'require_user_action', source: 'moodle', reason: 'login' }]);
    expect([...loggedOut.effects, ...ordinaryStart.effects, ...requested.effects].some(effect => effect.kind === 'schedule_recovery_probe')).toBe(false);
  });

  it.each(['REAUTH_REQUIRED', 'NETWORK_UNAVAILABLE'] as const)('bounds %s recovery to delays 0, 5000 and 30000', code => {
    let state = authenticatedState();
    const delays: number[] = [];
    for (let failure = 0; failure < 4; failure += 1) {
      const transition = reduceAuthFlow(state, observed('moodle', result('moodle', code), code === 'NETWORK_UNAVAILABLE' ? { temporaryFailure: true } : {}));
      delays.push(...transition.effects.filter(effect => effect.kind === 'schedule_recovery_probe').map(effect => effect.delayMs));
      state = transition.state;
      if (failure === 3) {
        expect(transition.effects.some(effect => effect.kind === 'schedule_recovery_probe')).toBe(false);
        expect(transition.effects.some(effect => effect.kind === 'pause_source')).toBe(true);
        expect(transition.effects).toContainEqual({ kind: 'require_user_action', source: 'moodle', reason: 'reauth' });
      }
    }
    expect(delays).toEqual([...AUTH_RECOVERY_DELAYS_MS]);
    expect(state.sources.moodle.recoveryAttempt).toBe(3);
  });

  it.each([
    ['PARSER_CHANGED', 'PARSER_CHANGED'],
    ['CAPABILITY_DENIED', 'CAPABILITY_DENIED'],
    ['ORIGIN_MISMATCH', 'PARSER_CHANGED'],
    ['INTERACTION_REQUIRED', 'REAUTH_REQUIRED'],
    ['IDENTITY_MISMATCH', 'IDENTITY_MISMATCH'],
  ] as const)('never schedules automatic recovery for %s', (resultCode, domainCode) => {
    const transition = reduceAuthFlow(authenticatedState(), observed('edstem', result('edstem', domainCode), {
      resultCode, approvedOriginMatch: resultCode !== 'ORIGIN_MISMATCH', interactionRequired: resultCode === 'INTERACTION_REQUIRED',
    }));
    expect(transition.effects.some(effect => effect.kind === 'schedule_recovery_probe')).toBe(false);
  });

  it('clears recovery after success and re-probes EdStem after Moodle reauth without copying auth', () => {
    let state = authenticatedState();
    state = apply(state, observed('moodle', result('moodle', 'REAUTH_REQUIRED')));
    const edstemBefore = structuredClone(state.sources.edstem);
    const recovered = reduceAuthFlow(state, observed('moodle', result('moodle')));
    expect(recovered.state.sources.moodle).toMatchObject({ recoveryAttempt: 0, paused: false, currentResultCode: 'AUTHENTICATED' });
    expect(recovered.effects).toEqual([{ kind: 'probe', source: 'edstem', action: 'edstem.auth_probe' }]);
    expect(recovered.state.sources.edstem).toEqual(edstemBefore);
  });

  it('emits only fixed synthetic-safe effects and never claims native, live, Windows or Phase 3 evidence', () => {
    let state = createAuthFlowState();
    const transitions = [
      reduceAuthFlow(state, { type: 'start_probe_cycle' }),
      reduceAuthFlow(authenticatedState(), observed('moodle', result('moodle', 'NETWORK_UNAVAILABLE'), { temporaryFailure: true })),
      reduceAuthFlow(authenticatedState(), observed('edstem', result('edstem', 'PARSER_CHANGED'))),
      reduceAuthFlow(authenticatedState(), { type: 'explicit_logout', source: 'edstem' }),
    ];
    state = transitions[0]!.state;
    const serialized = JSON.stringify(transitions.flatMap(item => item.effects));
    expect(serialized).not.toMatch(/receipt|native|live|windows|platform|phase|eligib|course_visibility|url|selector|cookie|profile/i);
    for (const effect of transitions.flatMap(item => item.effects)) {
      expect(['probe', 'schedule_recovery_probe', 'pause_source', 'require_user_action']).toContain(effect.kind);
    }
    expect(state.courseAccess).toBe('blocked');
  });
});
