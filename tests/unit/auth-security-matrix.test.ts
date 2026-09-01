import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { AuthJobService, type AuthJobStore } from '../../packages/application/src/auth-jobs.js';
import {
  createAuthFlowState,
  decideAccountBinding,
  reduceAuthFlow,
  type AuthFlowState,
} from '../../packages/application/src/auth.js';
import { toSafeAuthApiError } from '../../packages/application/src/policy.js';
import { SourceProbeRequestSchema, SyntheticEvidenceReceiptSchema } from '../../packages/contracts/src/index.js';
import {
  presentProtectedAuthStatus,
  presentRedactedAuthStatus,
  type AuthStatusPresentationInput,
} from '../../packages/contracts/src/presentation.js';
import type {
  AccountBinding,
  IdentityEvidence,
  SourceId,
  SourceProbeResult,
} from '../../packages/domain/src/model.js';
import { makeSyntheticReceipt } from '../../packages/test-support/src/auth-fixture.js';
import {
  REQUIRED_SECURITY_CASE_IDS,
  SECURITY_MATRIX_CASES,
  SECURITY_MATRIX_SENTINELS,
  assertSecurityMatrixCoverage,
  type SecurityMatrixCase,
} from '../../packages/test-support/src/security-matrix.js';
import { registerAuthRoutes } from '../../apps/api/src/auth.js';

const CHECKED_AT = '2026-09-01T00:00:00.000Z';
const LATER = '2026-09-01T00:01:00.000Z';
const CONFIG_ID = '11111111-1111-4111-8111-111111111111';
const SCOPE_ID = '22222222-2222-4222-8222-222222222222';
const INSTALLATION_ID = '33333333-3333-4333-8333-333333333333';

function identity(source: SourceId, overrides: Partial<IdentityEvidence> = {}): IdentityEvidence {
  return {
    source,
    subjectFingerprint: 'A'.repeat(43),
    organizationFingerprint: 'B'.repeat(43),
    tenantFingerprint: 'C'.repeat(43),
    approvedScopeId: SCOPE_ID,
    evidenceKind: 'stable_subject_organization_scope',
    ...overrides,
  };
}

function probeResult(source: SourceId, code: SourceProbeResult['observation']['resultCode']): SourceProbeResult {
  const authenticated = code === 'AUTHENTICATED';
  return {
    request: { source, action: `${source}.auth_probe`, approvedConfigId: CONFIG_ID, approvedScopeId: SCOPE_ID },
    observation: {
      source,
      auth: authenticated ? 'authenticated' : code === 'AUTH_REQUIRED' ? 'unauthenticated' : code === 'REAUTH_REQUIRED' ? 'reauth_required' : 'not_observed',
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
    identity: authenticated ? identity(source) : null,
    selectedCourseVisible: null,
  };
}

function observedState(): AuthFlowState {
  const state = createAuthFlowState();
  for (const source of ['moodle', 'edstem'] as const) {
    const success = probeResult(source, 'AUTHENTICATED');
    state.sources[source] = {
      ...state.sources[source],
      observation: {
        ...success.observation,
        lastSuccess: { checkedAt: CHECKED_AT, subjectFingerprint: identity(source).subjectFingerprint },
      },
      identity: identity(source),
      currentResultCode: 'AUTHENTICATED',
      lastSuccess: success,
    };
  }
  return state;
}

function binding(status: AccountBinding['status'] = 'candidate'): AccountBinding {
  return {
    status,
    moodle: identity('moodle'),
    edstem: identity('edstem'),
    basis: status === 'identity_mismatch' ? 'identity_changed' : 'stable_subject_organization_scope',
    confirmedByActionReceiptId: null,
    courseAccess: 'blocked',
    checkedAt: CHECKED_AT,
  };
}

function presentation(): AuthStatusPresentationInput {
  const sourceValue = (source: SourceId) => ({
    config: { id: CONFIG_ID, source, officialOrigin: source === 'moodle' ? 'https://moodle.example.edu' : 'https://edstem.org', approvedScopeId: SCOPE_ID, confirmedAt: CHECKED_AT },
    observation: observedState().sources[source].observation,
    identity: {
      classification: 'protected_local' as const,
      source,
      stableSubjectId: `${SECURITY_MATRIX_SENTINELS.identity}-${source}`,
      organizationId: SECURITY_MATRIX_SENTINELS.organization,
      tenantId: SECURITY_MATRIX_SENTINELS.tenant,
      displayName: `${SECURITY_MATRIX_SENTINELS.identity} ${source}`,
      schoolEmail: `${source}@example.invalid`,
      selectedCourseName: SECURITY_MATRIX_SENTINELS.course,
    },
    sharedProfile: 'unverified' as const,
  });
  return {
    sources: { moodle: sourceValue('moodle'), edstem: sourceValue('edstem') },
    binding: binding(),
    gaps: ['WINDOWS_NOT_RUN', 'LIVE_NOT_RUN'],
    nextAction: { kind: 'wait' },
  };
}

describe('Phase 2 auth security matrix: unit', () => {
  it('manifest coverage rejects every missing, duplicate, empty or unknown registry dimension', () => {
    expect(assertSecurityMatrixCoverage(SECURITY_MATRIX_CASES)).toBe(SECURITY_MATRIX_CASES);
    expect(SECURITY_MATRIX_CASES.map(item => item.id)).toEqual(REQUIRED_SECURITY_CASE_IDS);

    const withoutFirst = SECURITY_MATRIX_CASES.slice(1);
    expect(() => assertSecurityMatrixCoverage(withoutFirst)).toThrow('SECURITY_CASE_MISSING');
    expect(() => assertSecurityMatrixCoverage([...SECURITY_MATRIX_CASES, SECURITY_MATRIX_CASES[0]!])).toThrow('SECURITY_CASE_DUPLICATE');
    expect(() => assertSecurityMatrixCoverage(SECURITY_MATRIX_CASES.map((item, index) => index === 0 ? { ...item, threats: [] } : item))).toThrow('SECURITY_CASE_THREAT_REQUIRED');
    expect(() => assertSecurityMatrixCoverage(SECURITY_MATRIX_CASES.map((item, index) => index === 0 ? { ...item, layers: [] } : item))).toThrow('SECURITY_CASE_LAYER_REQUIRED');
    expect(() => assertSecurityMatrixCoverage(SECURITY_MATRIX_CASES.map((item, index) => index === 0 ? { ...item, mustNotCall: [] } : item))).toThrow('SECURITY_CASE_SIDE_EFFECT_REQUIRED');
    expect(() => assertSecurityMatrixCoverage(SECURITY_MATRIX_CASES.map((item, index) => index === 0
      ? { ...item, threats: ['T2-99'] as unknown as SecurityMatrixCase['threats'] }
      : item))).toThrow('SECURITY_CASE_THREAT_UNKNOWN');
    expect(() => assertSecurityMatrixCoverage(SECURITY_MATRIX_CASES.map((item, index) => index === 0
      ? { ...item, layers: ['transport'] as unknown as SecurityMatrixCase['layers'] }
      : item))).toThrow('SECURITY_CASE_LAYER_UNKNOWN');
  });

  it.each([
    ['AUTH_UNAUTHENTICATED', 'AUTH_REQUIRED', false, { auth: 'unauthenticated', capability: 'unknown', health: 'healthy', freshness: 'fresh', completeness: 'not_observed' }, 'require_user_action'],
    ['AUTH_EXPIRED', 'REAUTH_REQUIRED', false, { auth: 'reauth_required', capability: 'unknown', health: 'healthy', freshness: 'stale', completeness: 'not_observed' }, 'schedule_recovery_probe'],
    ['AUTH_PERMISSION_DENIED', 'CAPABILITY_DENIED', false, { auth: 'authenticated', capability: 'denied', health: 'healthy', freshness: 'fresh', completeness: 'partial' }, 'pause_source'],
    ['AUTH_NETWORK_TIMEOUT', 'NETWORK_UNAVAILABLE', true, { auth: 'authenticated', capability: 'available', health: 'error', freshness: 'stale', completeness: 'partial' }, 'schedule_recovery_probe'],
    ['AUTH_PARSER_DRIFT', 'PARSER_CHANGED', false, { auth: 'authenticated', capability: 'unknown', health: 'degraded', freshness: 'stale', completeness: 'partial' }, 'pause_source'],
  ] as const)('%s preserves exact failure semantics and the other source', (caseId, code, temporaryFailure, expected, effectKind) => {
    const before = observedState();
    const other = structuredClone(before.sources.edstem);
    const retained = structuredClone(before.sources.moodle.lastSuccess);
    const retainedObservation = structuredClone(before.sources.moodle.observation.lastSuccess);
    const transition = reduceAuthFlow(before, {
      type: 'probe_result',
      source: 'moodle',
      result: probeResult('moodle', code),
      approvedOriginMatch: true,
      positiveMarker: false,
      temporaryFailure,
    });
    expect(SECURITY_MATRIX_CASES.find(item => item.id === caseId)?.expectedCode).toBe(code);
    expect(transition.state.sources.moodle.observation).toMatchObject(expected);
    expect(transition.state.sources.moodle.lastSuccess).toEqual(retained);
    expect(transition.state.sources.moodle.observation.lastSuccess).toEqual(retainedObservation);
    expect(transition.state.sources.edstem).toEqual(other);
    expect(transition.effects.some(effect => effect.kind === effectKind)).toBe(true);
  });

  it('same display hints and confirmed identity drift cannot create or overwrite binding authority', () => {
    const sameName = decideAccountBinding({
      moodle: identity('moodle'),
      edstem: identity('edstem', { subjectFingerprint: 'D'.repeat(43) }),
      confirmed: null,
      checkedAt: CHECKED_AT,
      displayHints: {
        moodle: { displayName: 'Same Synthetic Name', schoolEmail: 'same@example.invalid' },
        edstem: { displayName: 'Same Synthetic Name', schoolEmail: 'same@example.invalid' },
      },
    });
    expect(sameName).toMatchObject({ status: 'identity_mismatch', binding: { courseAccess: 'blocked' } });

    const prior = { ...binding('confirmed'), basis: 'human_confirmed' as const, confirmedByActionReceiptId: randomUUID(), courseAccess: 'allowed' as const };
    const drift = decideAccountBinding({
      moodle: identity('moodle'),
      edstem: identity('edstem', { organizationFingerprint: 'E'.repeat(43) }),
      confirmed: prior,
      checkedAt: LATER,
    });
    expect(drift).toMatchObject({ status: 'identity_mismatch', binding: { courseAccess: 'blocked' } });
    expect(prior).toMatchObject({ status: 'confirmed', courseAccess: 'allowed' });
    expect(reduceAuthFlow(observedState(), {
      type: 'probe_result', source: 'edstem', result: probeResult('edstem', 'IDENTITY_MISMATCH'),
      approvedOriginMatch: true, positiveMarker: false,
    }).effects.some(effect => effect.kind === 'probe' && effect.action.includes('course_visibility'))).toBe(false);
  });

  it('rejects every forbidden key at strict contract, command and actual route admission before any downstream call', async () => {
    const forbidden = [
      'url', 'javascript', 'selector', 'browserHandle', 'operation', 'method', 'requestBody', 'download', 'upload',
      'submit', 'reply', 'quizStart', 'cookie', 'storageState', 'profilePath', 'extraNested',
    ] as const;
    const counters = {
      source_request: 0, source_write: 0, download: 0, profile_reclaim: 0, job_commit: 0, ledger_append_l: 0,
    };
    const store = {
      async enqueue() { counters.job_commit += 1; throw new Error('UNEXPECTED_ENQUEUE'); },
    } as unknown as AuthJobStore;
    const service = new AuthJobService(store);
    const routeProbe = vi.fn(async () => { counters.source_request += 1; return { accepted: true }; });
    const app = Fastify();
    app.setErrorHandler((_error, _request, reply) => reply.status(400).send({ code: 'INVALID_REQUEST' }));
    registerAuthRoutes(app, {
      expectedGeneration: 1,
      principal: () => ({
        scope: { installationId: INSTALLATION_ID, source: 'synthetic', courseId: 'selftest' },
        destination: 'local_ui', permissions: ['auth:probe:write'], browserSessionId: randomUUID(),
      }),
      application: { requestProbe: routeProbe } as never,
    });
    await app.ready();
    try {
      for (const key of forbidden) {
        const extra = key === 'extraNested' ? { extraNested: { operation: 'forbidden' } } : { [key]: 'forbidden' };
        expect(SourceProbeRequestSchema.safeParse({
          source: 'moodle', action: 'moodle.auth_probe', approvedConfigId: CONFIG_ID, approvedScopeId: SCOPE_ID, ...extra,
        }).success, `source:${key}`).toBe(false);
        await expect(service.requestProbe({
          source: 'moodle', approvedConfigId: CONFIG_ID, approvedScopeId: SCOPE_ID,
          trigger: 'background', idempotencyKey: 'strict-command', ...extra,
        } as never, { expectedGeneration: 1 })).rejects.toThrow();
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/probe',
          payload: {
            source: 'moodle', approvedConfigId: CONFIG_ID, approvedScopeId: SCOPE_ID,
            trigger: 'background', idempotencyKey: 'strict-route', ...extra,
          },
        });
        expect(response.statusCode, `api:${key}`).toBe(400);
      }
    } finally {
      await app.close();
    }
    expect(routeProbe).not.toHaveBeenCalled();
    expect(counters).toEqual({ source_request: 0, source_write: 0, download: 0, profile_reclaim: 0, job_commit: 0, ledger_append_l: 0 });
  });

  it('allows synthetic full identity only in paired protected output and fixes fixture evidence to S', () => {
    const input = presentation();
    const protectedJson = JSON.stringify(presentProtectedAuthStatus(input, { destination: 'local_ui', paired: true }));
    expect(protectedJson).toContain(SECURITY_MATRIX_SENTINELS.identity);
    for (const destination of ['local_cli', 'model', 'log', 'diagnostic', 'receipt'] as const) {
      const redacted = JSON.stringify(presentRedactedAuthStatus(input, { destination }));
      for (const sentinel of Object.values(SECURITY_MATRIX_SENTINELS)) expect(redacted).not.toContain(sentinel);
    }
    const safeError = JSON.stringify(toSafeAuthApiError(Object.assign(new Error(SECURITY_MATRIX_SENTINELS.exception), {
      cause: input.sources.moodle.identity,
      stack: SECURITY_MATRIX_SENTINELS.stack,
    })));
    for (const sentinel of Object.values(SECURITY_MATRIX_SENTINELS)) expect(safeError).not.toContain(sentinel);

    const receipt = makeSyntheticReceipt({ platform: 'macos', source: 'moodle', scenario: 'a.login' });
    expect(receipt.evidence).toBe('S');
    expect(SyntheticEvidenceReceiptSchema.safeParse({ ...receipt, evidence: 'L' }).success).toBe(false);
    expect(SyntheticEvidenceReceiptSchema.safeParse({
      ...receipt,
      provenance: { kind: 'automated', evidence: 'L', producerId: 'forbidden' },
    }).success).toBe(false);
  });
});
