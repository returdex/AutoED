import { describe, expect, it } from 'vitest';
import type { SourceAction, SourceId } from '../../packages/domain/src/model.js';
import { SealedSourceAdapters } from '../../packages/platform/src/source-adapters.js';
import { createMaliciousSourceFixture } from '../../packages/test-support/src/auth-fixture.js';

const ACTIONS = [
  ['moodle', 'moodle.auth_probe'],
  ['edstem', 'edstem.auth_probe'],
  ['moodle', 'moodle.course_visibility_probe'],
  ['edstem', 'edstem.course_visibility_probe'],
] as const satisfies ReadonlyArray<readonly [SourceId, SourceAction]>;

function setup(scenario: Parameters<typeof createMaliciousSourceFixture>[0] = 'positive') {
  const fixture = createMaliciousSourceFixture(scenario);
  const adapters = new SealedSourceAdapters({
    browser: fixture.browser,
    configs: fixture.sourceConfigs,
    context: fixture.context,
    clock: () => '2026-09-01T00:00:01.000Z',
  });
  return { fixture, adapters };
}

describe('sealed actions', () => {
  it.each(ACTIONS)('dispatches only the fixed %s / %s pair', async (source, action) => {
    const { fixture, adapters } = setup(action.endsWith('course_visibility_probe') ? 'course-visible' : 'positive');
    const request = fixture.request(source, action);
    const result = await adapters.probe(request, new AbortController().signal);
    expect(result.request).toEqual(request);
    expect(fixture.audit()).toMatchObject({ openBackground: 1, openOfficialLogin: 0, navigate: 1, externalRequests: 0 });
    expect(fixture.openInputs()[0]).toMatchObject({ source, approvedConfigId: request.approvedConfigId });
  });

  it.each([
    { source: 'moodle', action: 'edstem.auth_probe' },
    { source: 'edstem', action: 'moodle.course_visibility_probe' },
    { source: 'moodle', action: 'moodle.write' },
  ])('rejects wrong-source or unknown action before browser admission', async invalid => {
    const { fixture, adapters } = setup();
    await expect(adapters.probe({ ...fixture.request('moodle', 'moodle.auth_probe'), ...invalid } as never, new AbortController().signal))
      .rejects.toThrow();
    expect(fixture.audit()).toMatchObject({ openBackground: 0, navigate: 0, mappedRequests: 0 });
  });

  it.each(['url', 'js', 'selector', 'browserHandle', 'method', 'body', 'download', 'write']) (
    'rejects the caller %s field before browser admission',
    async field => {
      const { fixture, adapters } = setup();
      await expect(adapters.probe({ ...fixture.request('moodle', 'moodle.auth_probe'), [field]: 'untrusted' } as never, new AbortController().signal))
        .rejects.toThrow();
      expect(fixture.audit()).toMatchObject({ openBackground: 0, navigate: 0, mappedRequests: 0 });
    },
  );
});

describe('approved config', () => {
  it.each([
    ['missing config', (f: ReturnType<typeof createMaliciousSourceFixture>) => f.setConfig('moodle', null)],
    ['config id mismatch', (f: ReturnType<typeof createMaliciousSourceFixture>) => f.setConfig('moodle', { ...f.config('moodle'), id: '90000000-0000-4000-8000-000000000009' })],
    ['scope mismatch', (f: ReturnType<typeof createMaliciousSourceFixture>) => f.setConfig('moodle', { ...f.config('moodle'), approvedScopeId: '90000000-0000-4000-8000-000000000009' })],
    ['source mismatch', (f: ReturnType<typeof createMaliciousSourceFixture>) => f.setConfig('moodle', { ...f.config('moodle'), source: 'edstem' })],
    ['non-normalized origin', (f: ReturnType<typeof createMaliciousSourceFixture>) => f.setConfig('moodle', { ...f.config('moodle'), officialOrigin: `${f.origins.moodle}/` })],
  ] as const)('rejects %s without opening or navigating', async (_name, mutate) => {
    const { fixture, adapters } = setup(); mutate(fixture);
    await expect(adapters.probe(fixture.request('moodle', 'moodle.auth_probe'), new AbortController().signal)).rejects.toThrow();
    expect(fixture.audit()).toMatchObject({ openBackground: 0, navigate: 0, mappedRequests: 0 });
  });
});

describe('official origin', () => {
  it.each(['direct', 'redirect-1', 'redirect-2', 'redirect-3'] as const)('accepts %s synthetic navigation within the approved origin', async scenario => {
    const { fixture, adapters } = setup(scenario);
    const result = await adapters.probe(fixture.request('moodle', 'moodle.auth_probe'), new AbortController().signal);
    expect(result.observation.resultCode).toBe('AUTHENTICATED');
    expect(fixture.audit()).toMatchObject({ externalRequests: 0, realSchoolRequests: 0, abortedRequests: 0 });
  });

  it.each(['cross-first', 'cross-middle', 'cross-final'] as const)('fails closed for a cross-origin %s hop before locator reads', async scenario => {
    const { fixture, adapters } = setup(scenario);
    const result = await adapters.probe(fixture.request('moodle', 'moodle.auth_probe'), new AbortController().signal);
    expect(result).toMatchObject({ identity: null, selectedCourseVisible: null, observation: { resultCode: 'CAPABILITY_DENIED' } });
    expect(fixture.audit()).toMatchObject({ visibleReads: 0, attributeReads: 0, externalRequests: 0, realSchoolRequests: 0 });
  });
});

describe('synthetic containment', () => {
  it('uses in-memory fixture origins only and cannot create native or live evidence', async () => {
    const { fixture, adapters } = setup('redirect-3');
    await adapters.probe(fixture.request('edstem', 'edstem.auth_probe'), new AbortController().signal);
    expect(fixture.audit()).toMatchObject({ externalRequests: 0, realSchoolRequests: 0, apiFallbackRequests: 0, sourceMutations: 0 });
    expect(fixture.evidence).toEqual({ kinds: ['S', 'I'], native: false, live: false });
    expect(JSON.stringify(fixture.openInputs())).not.toMatch(/cookie|storageState|har|trace|video|screenshot|console|requestBody/i);
  });
});

function serialized(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item instanceof Error ? { name: item.name, message: item.message } : item);
}

describe('positive markers', () => {
  it.each([
    ['positive', 'AUTHENTICATED', 'authenticated'],
    ['login-required', 'AUTH_REQUIRED', 'unauthenticated'],
    ['missing-marker', 'PARSER_CHANGED', 'not_observed'],
    ['hidden-marker', 'PARSER_CHANGED', 'not_observed'],
    ['wrong-marker', 'PARSER_CHANGED', 'not_observed'],
    ['ambiguous-marker', 'PARSER_CHANGED', 'not_observed'],
    ['oversize-marker', 'PARSER_CHANGED', 'not_observed'],
    ['network-error', 'NETWORK_UNAVAILABLE', 'not_observed'],
  ] as const)('%s maps to %s without treating reachability as authentication', async (scenario, resultCode, auth) => {
    const { fixture, adapters } = setup(scenario);
    const result = await adapters.probe(fixture.request('moodle', 'moodle.auth_probe'), new AbortController().signal);
    expect(result.observation).toMatchObject({ resultCode, auth });
    if (resultCode !== 'AUTHENTICATED') expect(result.identity).toBeNull();
  });

  it('keeps the five observation dimensions distinct for parser and network failure', async () => {
    for (const [scenario, expected] of [
      ['missing-marker', { auth: 'not_observed', capability: 'unknown', health: 'degraded', freshness: 'stale', completeness: 'partial' }],
      ['network-error', { auth: 'not_observed', capability: 'unknown', health: 'error', freshness: 'stale', completeness: 'partial' }],
    ] as const) {
      const { fixture, adapters } = setup(scenario);
      const result = await adapters.probe(fixture.request('edstem', 'edstem.auth_probe'), new AbortController().signal);
      expect(result.observation).toMatchObject(expected);
    }
  });
});

describe('identity evidence', () => {
  it('returns bounded source-specific stable evidence without raw names, email or stable identifiers', async () => {
    const results = [];
    for (const source of ['moodle', 'edstem'] as const) {
      const { fixture, adapters } = setup('positive');
      results.push(await adapters.probe(fixture.request(source, `${source}.auth_probe`), new AbortController().signal));
    }
    expect(results[0]!.identity?.source).toBe('moodle');
    expect(results[1]!.identity?.source).toBe('edstem');
    expect(results[0]!.identity?.subjectFingerprint).toBe(results[1]!.identity?.subjectFingerprint);
    expect(results[0]!.identity?.organizationFingerprint).toBe(results[1]!.identity?.organizationFingerprint);
    const output = serialized(results);
    expect(output).not.toMatch(/Synthetic Private Name|synthetic@example\.invalid|stable-synthetic-(?:subject|organization|tenant)/);
  });

  it('keeps conflicting stable subjects independent despite matching display hints', async () => {
    const results = [];
    for (const source of ['moodle', 'edstem'] as const) {
      const { fixture, adapters } = setup('identity-conflict');
      results.push(await adapters.probe(fixture.request(source, `${source}.auth_probe`), new AbortController().signal));
    }
    expect(results[0]!.identity?.subjectFingerprint).not.toBe(results[1]!.identity?.subjectFingerprint);
    expect(results[0]!.identity?.organizationFingerprint).toBe(results[1]!.identity?.organizationFingerprint);
    expect(serialized(results)).not.toContain('Synthetic Private Name');
  });

  it('keeps manual confirmation possible when stable evidence is absent', async () => {
    const { fixture, adapters } = setup('identity-missing');
    const result = await adapters.probe(fixture.request('moodle', 'moodle.auth_probe'), new AbortController().signal);
    expect(result).toMatchObject({ identity: null, observation: { resultCode: 'AUTHENTICATED', auth: 'authenticated', courseAccess: 'blocked' } });
  });

  it('treats oversized identity evidence as parser drift and never authenticated', async () => {
    const { fixture, adapters } = setup('identity-oversize');
    const result = await adapters.probe(fixture.request('moodle', 'moodle.auth_probe'), new AbortController().signal);
    expect(result).toMatchObject({ identity: null, observation: { resultCode: 'PARSER_CHANGED', auth: 'not_observed' } });
  });
});

describe('course visibility', () => {
  it.each([
    ['course-visible', 'AUTHENTICATED', true],
    ['course-denied', 'CAPABILITY_DENIED', false],
    ['course-not-observed', 'NOT_OBSERVED', null],
    ['course-out-of-scope', 'CAPABILITY_DENIED', false],
    ['course-error', 'NETWORK_UNAVAILABLE', null],
  ] as const)('returns the bounded %s status for one approved scope', async (scenario, resultCode, selectedCourseVisible) => {
    const { fixture, adapters } = setup(scenario);
    const result = await adapters.probe(fixture.request('moodle', 'moodle.course_visibility_probe'), new AbortController().signal);
    expect(result).toMatchObject({ selectedCourseVisible, observation: { resultCode, courseAccess: 'blocked' } });
    expect(result.request.approvedScopeId).toBe(fixture.scopeId);
    const output = serialized(result);
    for (const sentinel of Object.values(fixture.sensitiveSentinels)) expect(output).not.toContain(sentinel);
  });
});

describe('malicious effects', () => {
  it.each([
    ['popup', 'REAUTH_REQUIRED'],
    ['interaction', 'REAUTH_REQUIRED'],
    ['download', 'CAPABILITY_DENIED'],
    ['form-post', 'CAPABILITY_DENIED'],
    ['quiz-start', 'CAPABILITY_DENIED'],
    ['upload', 'CAPABILITY_DENIED'],
    ['api-fallback', 'CAPABILITY_DENIED'],
  ] as const)('fails closed for %s with no business side effect', async (scenario, resultCode) => {
    const { fixture, adapters } = setup(scenario);
    const result = await adapters.probe(fixture.request('edstem', 'edstem.auth_probe'), new AbortController().signal);
    expect(result.observation.resultCode).toBe(resultCode);
    expect(result.observation.auth).not.toBe('authenticated');
    expect(fixture.audit()).toMatchObject({
      nonGetHeadSucceeded: 0, downloadBytes: 0, popupInteractions: 0, apiFallbackRequests: 0,
      sourceMutations: 0, visibleReads: 0, attributeReads: 0,
    });
  });

  it('never returns fixture course, post or grade sentinel content', async () => {
    const { fixture, adapters } = setup('course-visible');
    const result = await adapters.probe(fixture.request('edstem', 'edstem.course_visibility_probe'), new AbortController().signal);
    const captured = serialized({ result, audit: fixture.audit() });
    for (const sentinel of Object.values(fixture.sensitiveSentinels)) expect(captured).not.toContain(sentinel);
  });
});

describe('parser drift', () => {
  it.each([
    'aborted-navigate', 'aborted-wait', 'aborted-read', 'aborted-close',
    'fenced', 'fenced-wait', 'fenced-read', 'fenced-close',
  ] as const)('stops after %s and cannot publish authenticated evidence', async scenario => {
    const { fixture, adapters } = setup(scenario);
    const result = await adapters.probe(fixture.request('moodle', 'moodle.auth_probe'), new AbortController().signal);
    expect(result.observation.auth).not.toBe('authenticated');
    expect(result.identity).toBeNull();
    expect(fixture.audit()).toMatchObject({ requestGuardCalls: 1, wrongOwnerGuards: 0, openOfficialLogin: 0 });
  });

  it('aborts before browser admission when the caller signal is already cancelled', async () => {
    const { fixture, adapters } = setup('positive'); const controller = new AbortController(); controller.abort();
    const result = await adapters.probe(fixture.request('moodle', 'moodle.auth_probe'), controller.signal);
    expect(result.observation.auth).not.toBe('authenticated');
    expect(fixture.audit()).toMatchObject({ openBackground: 1, requestGuardCalls: 0, navigate: 0 });
  });
});
