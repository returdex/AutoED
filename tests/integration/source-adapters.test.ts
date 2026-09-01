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
