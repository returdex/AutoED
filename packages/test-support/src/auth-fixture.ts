import { randomUUID } from 'node:crypto';
import { SyntheticEvidenceReceiptSchema } from '../../contracts/src/index.js';
import type { SourceConfigStore } from '../../application/src/ports.js';
import type {
  ApprovedSourceConfig, NativePlatform, ProfileOwnerIdentity, SourceAction, SourceId, SourceProbeRequest, UatScenario,
} from '../../domain/src/model.js';
import type {
  BrowserLocatorSpec, BrowserOpenGuard, BrowserOpenInput, BrowserProbeSession, BrowserRequestGuard, NavigationObservation,
} from '../../platform/src/browser.js';

export interface SyntheticReceiptInput {
  platform: NativePlatform;
  source: SourceId;
  scenario: UatScenario;
  buildId?: string;
  version?: string;
  checkedAt?: string;
}

/** Creates rejection-oriented synthetic evidence and cannot be promoted to native or live evidence. */
export function makeSyntheticReceipt(input: SyntheticReceiptInput) {
  return SyntheticEvidenceReceiptSchema.parse({
    receiptId: randomUUID(),
    buildId: input.buildId ?? 'a'.repeat(64),
    version: input.version ?? '0.1.0',
    platform: input.platform,
    source: input.source,
    scenario: input.scenario,
    evidence: 'S',
    status: 'fail',
    resultCode: 'SYNTHETIC_REJECTION_OBSERVED',
    bindingConsistency: 'not_observed',
    gaps: [],
    checkedAt: input.checkedAt ?? '2026-09-01T00:00:00.000Z',
    provenance: { kind: 'automated', evidence: 'S', producerId: 'phase-02-contract-fixture' },
  });
}

export type MaliciousSourceScenario =
  | 'direct' | 'redirect-1' | 'redirect-2' | 'redirect-3'
  | 'cross-first' | 'cross-middle' | 'cross-final'
  | 'positive' | 'login-required' | 'missing-marker' | 'ambiguous-marker' | 'oversize-marker' | 'network-error'
  | 'wrong-marker' | 'hidden-marker' | 'identity-missing' | 'identity-oversize' | 'identity-conflict'
  | 'course-visible' | 'course-denied' | 'course-not-observed' | 'course-out-of-scope' | 'course-error'
  | 'popup' | 'interaction' | 'download' | 'form-post' | 'quiz-start' | 'upload' | 'api-fallback'
  | 'aborted-navigate' | 'aborted-wait' | 'aborted-read' | 'aborted-close'
  | 'fenced' | 'fenced-wait' | 'fenced-read' | 'fenced-close';

export interface SourceFixtureAudit {
  openBackground: number;
  openOfficialLogin: number;
  navigate: number;
  waits: number;
  visibleReads: number;
  attributeReads: number;
  closes: number;
  mappedRequests: number;
  abortedRequests: number;
  externalRequests: number;
  realSchoolRequests: number;
  apiFallbackRequests: number;
  nonGetHeadSucceeded: number;
  downloadBytes: number;
  popupInteractions: number;
  sourceMutations: number;
  requestGuardCalls: number;
  wrongOwnerGuards: number;
}

const SYNTHETIC_ORIGINS = Object.freeze({
  moodle: 'https://moodle.synthetic.invalid',
  // This hostname exists only as an in-memory origin key. The fixture never resolves or opens it.
  edstem: 'https://synthetic.edstem.org',
} satisfies Record<SourceId, string>);

const FIXTURE_INSTALLATION_ID = '10000000-0000-4000-8000-000000000001';
const FIXTURE_BUILD_ID = '6'.repeat(64);
const FIXTURE_SCOPE_ID = '20000000-0000-4000-8000-000000000002';
const FIXTURE_CONFIG_IDS = Object.freeze({
  moodle: '30000000-0000-4000-8000-000000000003',
  edstem: '40000000-0000-4000-8000-000000000004',
} satisfies Record<SourceId, string>);

function initialAudit(): SourceFixtureAudit {
  return {
    openBackground: 0, openOfficialLogin: 0, navigate: 0, waits: 0, visibleReads: 0, attributeReads: 0,
    closes: 0, mappedRequests: 0, abortedRequests: 0, externalRequests: 0, realSchoolRequests: 0,
    apiFallbackRequests: 0, nonGetHeadSucceeded: 0, downloadBytes: 0, popupInteractions: 0, sourceMutations: 0,
    requestGuardCalls: 0, wrongOwnerGuards: 0,
  };
}

function sameOwner(left: ProfileOwnerIdentity, right: ProfileOwnerIdentity): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function safeFailure(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

/**
 * Synthetic-only Moodle/EdStem page boundary. It performs no DNS, proxy, socket, browser, Profile, receipt or capture work.
 * All page observations are in-memory and can establish only S/I rejection behavior.
 */
export function createMaliciousSourceFixture(initialScenario: MaliciousSourceScenario = 'positive') {
  let scenario = initialScenario;
  const audit = initialAudit();
  const configs = new Map<SourceId, ApprovedSourceConfig | null>(
    (['moodle', 'edstem'] as const).map(source => [source, {
      id: FIXTURE_CONFIG_IDS[source], source, officialOrigin: SYNTHETIC_ORIGINS[source],
      approvedScopeId: FIXTURE_SCOPE_ID, confirmedAt: '2026-09-01T00:00:00.000Z',
    }]),
  );
  const owner: ProfileOwnerIdentity = {
    installationId: FIXTURE_INSTALLATION_ID, browserBuildId: FIXTURE_BUILD_ID,
    nonce: '50000000-0000-4000-8000-000000000005', generation: 7, fence: 11,
    reservedAt: '2026-09-01T00:00:00.000Z', pid: 4242, osStartIdentity: 'synthetic-start',
    executable: '/synthetic/never-executed', startedAt: '2026-09-01T00:00:00.000Z',
  };
  const openInputs: BrowserOpenInput[] = [];

  function assertGuard(guard: BrowserRequestGuard): void {
    if (guard.signal.aborted) throw safeFailure('BROWSER_ABORTED');
    if (guard.expectedGeneration !== owner.generation || !sameOwner(guard.owner, owner)) {
      audit.wrongOwnerGuards += 1;
      throw safeFailure('BROWSER_FENCED');
    }
  }

  function locatorKey(locator: BrowserLocatorSpec): string {
    return locator.kind === 'css' ? locator.selector : locator.kind === 'role'
      ? `${locator.role}:${locator.name ?? ''}` : locator.text;
  }

  function effectFailure(): string | null {
    if (scenario === 'popup' || scenario === 'interaction') return 'BROWSER_INTERACTION_REQUIRED';
    if (scenario === 'download') return 'BROWSER_DOWNLOAD_BLOCKED';
    if (['form-post', 'quiz-start', 'upload'].includes(scenario)) return 'BROWSER_WRITE_BLOCKED';
    if (scenario === 'api-fallback') return 'BROWSER_ORIGIN_BLOCKED';
    return null;
  }

  class SyntheticSession implements BrowserProbeSession {
    requestGuard(signal: AbortSignal, expectedGeneration: number): BrowserRequestGuard {
      audit.requestGuardCalls += 1;
      return { signal, expectedGeneration, owner };
    }

    async navigate(target: URL, guard: BrowserRequestGuard): Promise<NavigationObservation> {
      audit.navigate += 1; assertGuard(guard);
      if (scenario === 'aborted-navigate') throw safeFailure('BROWSER_ABORTED');
      if (scenario === 'fenced') throw safeFailure('BROWSER_FENCED');
      const source = openInputs.at(-1)?.source;
      const approvedOrigin = source ? SYNTHETIC_ORIGINS[source] : '';
      if (!(target instanceof URL) || target.origin !== approvedOrigin) {
        audit.abortedRequests += 1; throw safeFailure('BROWSER_ORIGIN_BLOCKED');
      }
      if (scenario === 'network-error' || scenario === 'course-error') throw safeFailure('BROWSER_NETWORK_UNAVAILABLE');
      const effect = effectFailure();
      if (effect) {
        audit.abortedRequests += 1;
        throw safeFailure(effect);
      }
      const hops = scenario.startsWith('redirect-') ? Number(scenario.slice(-1)) : 0;
      audit.mappedRequests += 1 + hops;
      if (scenario === 'cross-first') return { redirectOrigins: ['https://escape.invalid'], finalOrigin: approvedOrigin };
      if (scenario === 'cross-middle') return { redirectOrigins: [approvedOrigin, 'https://escape.invalid', approvedOrigin], finalOrigin: approvedOrigin };
      if (scenario === 'cross-final') return { redirectOrigins: [approvedOrigin], finalOrigin: 'https://escape.invalid' };
      return { redirectOrigins: Array.from({ length: Math.max(1, hops) }, () => approvedOrigin), finalOrigin: approvedOrigin };
    }

    async waitFor(_locator: BrowserLocatorSpec, guard: BrowserRequestGuard): Promise<'visible'> {
      audit.waits += 1; assertGuard(guard);
      if (scenario === 'aborted-wait') throw safeFailure('BROWSER_ABORTED');
      if (scenario === 'fenced-wait') throw safeFailure('BROWSER_FENCED');
      return 'visible';
    }

    async readVisible(locator: BrowserLocatorSpec, guard: BrowserRequestGuard): Promise<string | null> {
      audit.visibleReads += 1; assertGuard(guard);
      if (scenario === 'aborted-read') throw safeFailure('BROWSER_ABORTED');
      if (scenario === 'fenced-read') throw safeFailure('BROWSER_FENCED');
      const key = locatorKey(locator);
      if (scenario === 'ambiguous-marker') throw safeFailure('BROWSER_OUTPUT_AMBIGUOUS');
      if (scenario === 'oversize-marker' && key.includes('authenticated')) throw safeFailure('BROWSER_OUTPUT_LIMIT');
      if (scenario === 'login-required' && key.includes('login')) return `${openInputs.at(-1)!.source}-login-required-v1`;
      if (['missing-marker', 'hidden-marker', 'login-required'].includes(scenario) && key.includes('authenticated')) return null;
      if (scenario === 'wrong-marker' && key.includes('authenticated')) return 'other-source-authenticated-v1';
      if (key.includes('authenticated')) return `${openInputs.at(-1)!.source}-authenticated-v1`;
      if (key.includes('display-name')) return 'Synthetic Private Name';
      if (key.includes('school-email')) return 'synthetic@example.invalid';
      if (key.includes('course')) return scenario === 'course-denied' || scenario === 'course-not-observed' ? null : 'visible';
      return null;
    }

    async readAttribute(locator: BrowserLocatorSpec, _attribute: string, guard: BrowserRequestGuard): Promise<string | null> {
      audit.attributeReads += 1; assertGuard(guard);
      const key = locatorKey(locator);
      if (scenario === 'identity-missing' && (key.includes('subject') || key.includes('organization'))) return null;
      if (scenario === 'identity-oversize' && key.includes('subject')) return 'x'.repeat(600);
      if (key.includes('subject')) return scenario === 'identity-conflict' && openInputs.at(-1)!.source === 'edstem'
        ? 'stable-conflicting-subject' : 'stable-synthetic-subject';
      if (key.includes('organization')) return 'stable-synthetic-organization';
      if (key.includes('tenant')) return 'stable-synthetic-tenant';
      if (key.includes('course')) return scenario === 'course-denied' ? 'denied'
        : scenario === 'course-not-observed' ? null
          : scenario === 'course-out-of-scope' ? '90000000-0000-4000-8000-000000000009' : FIXTURE_SCOPE_ID;
      return null;
    }

    async close(guard: BrowserRequestGuard): Promise<void> {
      audit.closes += 1; assertGuard(guard);
      if (scenario === 'aborted-close') throw safeFailure('BROWSER_ABORTED');
      if (scenario === 'fenced-close') throw safeFailure('BROWSER_FENCED');
    }
  }

  const sourceConfigs: SourceConfigStore = {
    async read(source) { return configs.get(source) ?? null; },
    async confirm() { throw safeFailure('SYNTHETIC_CONFIG_WRITE_FORBIDDEN'); },
  };
  const browser = {
    async openBackground(input: BrowserOpenInput, guard: BrowserOpenGuard): Promise<BrowserProbeSession> {
      audit.openBackground += 1;
      if (guard.signal.aborted) throw safeFailure('BROWSER_ABORTED');
      openInputs.push(structuredClone(input));
      return new SyntheticSession();
    },
    async openOfficialLogin(): Promise<never> {
      audit.openOfficialLogin += 1; throw safeFailure('SYNTHETIC_INTERACTIVE_LOGIN_FORBIDDEN');
    },
  };

  function request(source: SourceId, action: SourceAction): SourceProbeRequest {
    return { source, action, approvedConfigId: FIXTURE_CONFIG_IDS[source], approvedScopeId: FIXTURE_SCOPE_ID };
  }

  return {
    browser,
    sourceConfigs,
    context: {
      installationId: FIXTURE_INSTALLATION_ID, browserBuildId: FIXTURE_BUILD_ID, generation: owner.generation, fence: owner.fence,
    },
    origins: SYNTHETIC_ORIGINS,
    configIds: FIXTURE_CONFIG_IDS,
    scopeId: FIXTURE_SCOPE_ID,
    request,
    setScenario(value: MaliciousSourceScenario) { scenario = value; },
    setConfig(source: SourceId, value: ApprovedSourceConfig | null) { configs.set(source, value); },
    config(source: SourceId): ApprovedSourceConfig { return structuredClone(configs.get(source)!) as ApprovedSourceConfig; },
    audit(): Readonly<SourceFixtureAudit> { return Object.freeze({ ...audit }); },
    openInputs(): readonly BrowserOpenInput[] { return structuredClone(openInputs); },
    sensitiveSentinels: Object.freeze({
      body: 'SYNTHETIC_COURSE_BODY_MUST_NEVER_ESCAPE',
      post: 'SYNTHETIC_PRIVATE_POST_MUST_NEVER_ESCAPE',
      grade: 'SYNTHETIC_PRIVATE_GRADE_MUST_NEVER_ESCAPE',
    }),
    evidence: Object.freeze({ kinds: ['S', 'I'] as const, native: false as const, live: false as const }),
  };
}
