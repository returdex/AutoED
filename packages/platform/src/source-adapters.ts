import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { SourceConfigStore, SourceProbePort } from '../../application/src/ports.js';
import {
  ApprovedSourceConfigSchema, SourceProbeRequestSchema, SourceProbeResultSchema,
} from '../../contracts/src/index.js';
import type {
  ApprovedSourceConfig, IdentityEvidence, SourceAction, SourceId, SourceProbeRequest, SourceProbeResult, SourceResultCode,
} from '../../domain/src/model.js';
import {
  type BrowserLocatorSpec, type BrowserOpenInput, type BrowserProbeSession, LocalPlaywrightBrowserProvider,
} from './browser.js';

const adapterContextSchema = z.strictObject({
  installationId: z.uuid(),
  browserBuildId: z.string().regex(/^[a-f0-9]{64}$/),
  generation: z.number().int().nonnegative(),
  fence: z.number().int().nonnegative(),
});

type AdapterContext = z.infer<typeof adapterContextSchema>;
type BackgroundBrowser = Pick<LocalPlaywrightBrowserProvider, 'openBackground'>;

interface ProbeDescriptor {
  source: SourceId;
  action: SourceAction;
  routeSuffix: '/';
  pageReady: BrowserLocatorSpec;
  authenticated: BrowserLocatorSpec;
  authenticatedValue: string;
  login: BrowserLocatorSpec;
  loginValue: string;
  subject: BrowserLocatorSpec;
  organization: BrowserLocatorSpec;
  tenant: BrowserLocatorSpec;
  displayName: BrowserLocatorSpec;
  schoolEmail: BrowserLocatorSpec;
  course: BrowserLocatorSpec;
}

const css = (selector: string): BrowserLocatorSpec => Object.freeze({ kind: 'css', selector });

function descriptor(source: SourceId, action: SourceAction): ProbeDescriptor {
  return Object.freeze({
    source, action, routeSuffix: '/', pageReady: css('body'),
    authenticated: css(`[data-autoed-probe="${source}-authenticated"]`),
    authenticatedValue: `${source}-authenticated-v1`,
    login: css(`[data-autoed-probe="${source}-login"]`),
    loginValue: `${source}-login-required-v1`,
    subject: css(`[data-autoed-probe="${source}-subject"]`),
    organization: css(`[data-autoed-probe="${source}-organization"]`),
    tenant: css(`[data-autoed-probe="${source}-tenant"]`),
    displayName: css(`[data-autoed-probe="${source}-display-name"]`),
    schoolEmail: css(`[data-autoed-probe="${source}-school-email"]`),
    course: css(`[data-autoed-probe="${source}-course"]`),
  });
}

const REGISTRY = Object.freeze({
  'moodle.auth_probe': descriptor('moodle', 'moodle.auth_probe'),
  'edstem.auth_probe': descriptor('edstem', 'edstem.auth_probe'),
  'moodle.course_visibility_probe': descriptor('moodle', 'moodle.course_visibility_probe'),
  'edstem.course_visibility_probe': descriptor('edstem', 'edstem.course_visibility_probe'),
} satisfies Record<SourceAction, ProbeDescriptor>);

class AdapterFailure extends Error {
  readonly resultCode: SourceResultCode;
  readonly authenticated: boolean;
  constructor(resultCode: SourceResultCode, authenticated = false) {
    super(resultCode); this.name = 'AdapterFailure'; this.resultCode = resultCode; this.authenticated = authenticated;
  }
}

function fingerprint(kind: 'subject' | 'organization' | 'tenant', value: string): string {
  return createHash('sha256').update(`autoed-source-evidence-v1\0${kind}\0${value}`, 'utf8').digest('base64url');
}

function safeText(value: string | null, maximum: number, required: boolean): string | null {
  if (value === null) {
    if (required) throw new AdapterFailure('PARSER_CHANGED');
    return null;
  }
  const normalized = value.normalize('NFC');
  if (normalized !== value || value.trim() !== value || value.length < 1 || value.length > maximum || value.includes('\0') || /[\r\n]/.test(value)) {
    throw new AdapterFailure('PARSER_CHANGED');
  }
  return value;
}

function exactMarker(value: string | null, expected: string): boolean {
  return value !== null && safeText(value, 128, true) === expected;
}

function safeCode(error: unknown): AdapterFailure {
  if (error instanceof AdapterFailure) return error;
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
    ? error.code : error instanceof Error ? error.message : '';
  if (code === 'BROWSER_NETWORK_UNAVAILABLE') return new AdapterFailure('NETWORK_UNAVAILABLE');
  if (code === 'BROWSER_INTERACTION_REQUIRED' || code === 'BROWSER_HUMAN_ACTION_REQUIRED') return new AdapterFailure('REAUTH_REQUIRED');
  if (['BROWSER_WRITE_BLOCKED', 'BROWSER_DOWNLOAD_BLOCKED', 'BROWSER_ORIGIN_BLOCKED'].includes(code)) return new AdapterFailure('CAPABILITY_DENIED');
  if (['BROWSER_OUTPUT_LIMIT', 'BROWSER_OUTPUT_AMBIGUOUS'].includes(code)) return new AdapterFailure('PARSER_CHANGED');
  return new AdapterFailure('NOT_OBSERVED');
}

function observation(
  request: SourceProbeRequest,
  code: SourceResultCode,
  checkedAt: string,
  authenticated = code === 'AUTHENTICATED',
  identity: IdentityEvidence | null = null,
  selectedCourseVisible: boolean | null = null,
): SourceProbeResult {
  const isNetwork = code === 'NETWORK_UNAVAILABLE';
  const isParser = code === 'PARSER_CHANGED';
  const isDenied = code === 'CAPABILITY_DENIED';
  const isAuthRequired = code === 'AUTH_REQUIRED';
  const isReauth = code === 'REAUTH_REQUIRED';
  const success = code === 'AUTHENTICATED';
  return SourceProbeResultSchema.parse({
    request,
    observation: {
      source: request.source,
      auth: authenticated ? 'authenticated' : isAuthRequired ? 'unauthenticated' : isReauth ? 'reauth_required' : 'not_observed',
      capability: success ? 'available' : isDenied ? 'denied' : 'unknown',
      health: isNetwork ? 'error' : isParser ? 'degraded' : isDenied && !authenticated ? 'error' : 'healthy',
      freshness: success || authenticated ? 'fresh' : code === 'NOT_OBSERVED' ? 'not_observed' : 'stale',
      completeness: success ? 'complete' : 'partial',
      outcome: success ? 'present' : code === 'NOT_OBSERVED' ? 'not_observed' : 'error',
      checkedAt,
      resultCode: code,
      courseAccess: 'blocked',
      lastSuccess: success && identity ? { checkedAt, subjectFingerprint: identity.subjectFingerprint } : null,
    },
    identity,
    selectedCourseVisible,
  });
}

function assertOrigin(config: ApprovedSourceConfig, observed: string): void {
  let parsed: URL;
  try { parsed = new URL(observed); }
  catch { throw new AdapterFailure('CAPABILITY_DENIED'); }
  if (parsed.origin !== config.officialOrigin || observed !== parsed.origin) throw new AdapterFailure('CAPABILITY_DENIED');
}

/** Sealed four-action source boundary. It never exposes navigation, locator, script or browser handles to callers. */
export class SealedSourceAdapters implements SourceProbePort {
  readonly #browser: BackgroundBrowser;
  readonly #configs: SourceConfigStore;
  readonly #runtime: AdapterContext;
  readonly #clock: () => string;

  constructor(options: { browser: BackgroundBrowser; configs: SourceConfigStore; context: AdapterContext; clock?: () => string }) {
    this.#browser = options.browser;
    this.#configs = options.configs;
    this.#runtime = adapterContextSchema.parse(options.context);
    this.#clock = options.clock ?? (() => new Date().toISOString());
  }

  async probe(input: SourceProbeRequest, signal: AbortSignal): Promise<SourceProbeResult> {
    const request = SourceProbeRequestSchema.parse(input);
    const config = await this.#approvedConfig(request);
    const descriptorValue = REGISTRY[request.action];
    if (descriptorValue.source !== request.source || descriptorValue.action !== request.action) throw new Error('SOURCE_PROBE_REJECTED');
    const checkedAt = z.iso.datetime().parse(this.#clock());
    const openInput: BrowserOpenInput = {
      installationId: this.#runtime.installationId,
      browserBuildId: this.#runtime.browserBuildId,
      approvedConfigId: config.id,
      source: request.source,
      readOrigins: [config.officialOrigin],
      authenticationOrigins: [config.officialOrigin],
      generation: this.#runtime.generation,
      fence: this.#runtime.fence,
    };
    let session: BrowserProbeSession | null = null;
    let guard: ReturnType<BrowserProbeSession['requestGuard']> | null = null;
    let result: SourceProbeResult | null = null;
    let primaryFailure = false;
    try {
      session = await this.#browser.openBackground(openInput, { signal, expectedGeneration: this.#runtime.generation });
      guard = session.requestGuard(signal, this.#runtime.generation);
      const target = new URL(descriptorValue.routeSuffix, config.officialOrigin);
      const navigation = await session.navigate(target, guard);
      for (const hop of navigation.redirectOrigins) assertOrigin(config, hop);
      assertOrigin(config, navigation.finalOrigin);
      result = await this.#read(descriptorValue, request, session, guard, checkedAt);
    } catch (error) {
      primaryFailure = true;
      const failure = safeCode(error);
      result = observation(request, failure.resultCode, checkedAt, failure.authenticated);
    } finally {
      if (session && guard) {
        try { await session.close(guard); }
        catch (error) {
          if (!primaryFailure) {
            const failure = safeCode(error);
            result = observation(request, failure.resultCode, checkedAt, failure.authenticated);
          }
        }
      }
      if (!primaryFailure && signal.aborted) result = observation(request, 'NOT_OBSERVED', checkedAt);
    }
    return SourceProbeResultSchema.parse(result);
  }

  async #approvedConfig(request: SourceProbeRequest): Promise<ApprovedSourceConfig> {
    const candidate = await this.#configs.read(request.source);
    if (!candidate) throw new Error('SOURCE_PROBE_REJECTED');
    let config: ApprovedSourceConfig;
    try { config = ApprovedSourceConfigSchema.parse(candidate); }
    catch { throw new Error('SOURCE_PROBE_REJECTED'); }
    if (config.source !== request.source || config.id !== request.approvedConfigId ||
        config.approvedScopeId !== request.approvedScopeId) throw new Error('SOURCE_PROBE_REJECTED');
    return config;
  }

  async #read(
    descriptorValue: ProbeDescriptor,
    request: SourceProbeRequest,
    session: BrowserProbeSession,
    guard: ReturnType<BrowserProbeSession['requestGuard']>,
    checkedAt: string,
  ): Promise<SourceProbeResult> {
    await session.waitFor(descriptorValue.pageReady, guard);
    const login = await session.readVisible(descriptorValue.login, guard);
    if (login !== null) {
      if (exactMarker(login, descriptorValue.loginValue)) return observation(request, 'AUTH_REQUIRED', checkedAt);
      throw new AdapterFailure('PARSER_CHANGED');
    }
    const marker = await session.readVisible(descriptorValue.authenticated, guard);
    if (!exactMarker(marker, descriptorValue.authenticatedValue)) throw new AdapterFailure('PARSER_CHANGED');
    const identity = await this.#identity(descriptorValue, request, session, guard);
    if (request.action.endsWith('.auth_probe')) return observation(request, 'AUTHENTICATED', checkedAt, true, identity);
    const courseState = await session.readAttribute(descriptorValue.course, 'title', guard);
    if (courseState === null) return observation(request, 'NOT_OBSERVED', checkedAt, true, identity);
    safeText(courseState, 128, true);
    await session.waitFor(descriptorValue.course, guard);
    if (courseState === 'denied') return observation(request, 'CAPABILITY_DENIED', checkedAt, true, identity, false);
    if (courseState !== request.approvedScopeId) return observation(request, 'CAPABILITY_DENIED', checkedAt, true, identity, false);
    return observation(request, 'AUTHENTICATED', checkedAt, true, identity, true);
  }

  async #identity(
    descriptorValue: ProbeDescriptor,
    request: SourceProbeRequest,
    session: BrowserProbeSession,
    guard: ReturnType<BrowserProbeSession['requestGuard']>,
  ): Promise<IdentityEvidence | null> {
    const subject = safeText(await session.readAttribute(descriptorValue.subject, 'title', guard), 256, false);
    const organization = safeText(await session.readAttribute(descriptorValue.organization, 'title', guard), 256, false);
    const tenant = safeText(await session.readAttribute(descriptorValue.tenant, 'title', guard), 256, false);
    safeText(await session.readVisible(descriptorValue.displayName, guard), 256, false);
    safeText(await session.readVisible(descriptorValue.schoolEmail, guard), 320, false);
    if (!subject || !organization) return null;
    return {
      source: request.source,
      subjectFingerprint: fingerprint('subject', subject),
      organizationFingerprint: fingerprint('organization', organization),
      tenantFingerprint: tenant ? fingerprint('tenant', tenant) : null,
      approvedScopeId: request.approvedScopeId,
      evidenceKind: 'stable_subject_organization_scope',
    };
  }
}
