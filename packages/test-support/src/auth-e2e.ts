import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page, type Route } from 'playwright';
import type { SecretStore, SourceProbePort } from '../../application/src/ports.js';
import { decideAccountBinding } from '../../application/src/auth.js';
import { AuthJobRunner, AuthJobService, type AuthJob } from '../../application/src/auth-jobs.js';
import type {
  AccountBinding, ApprovedSourceConfig, EvidenceReceipt, IdentityEvidence, ProfileOwnerIdentity, ProtectedSourceIdentity,
  SourceId, SourceProbeRequest, SourceProbeResult, UatScenario,
} from '../../domain/src/model.js';
import { startApi } from '../../../apps/api/src/main.js';
import { buildStatusAssets } from '../../../scripts/build/build.mjs';
import { issueCredential } from '../../platform/src/credentials.js';
import { SealedSourceAdapters } from '../../platform/src/source-adapters.js';
import type { BrowserLocatorSpec, BrowserOpenGuard, BrowserOpenInput, BrowserProbeSession, BrowserRequestGuard } from '../../platform/src/browser.js';
import { SQLiteJobStore } from '../../persistence/src/claims.js';
import { openDatabase, SQLiteMaintenanceStore } from '../../persistence/src/database.js';
import {
  SQLiteAccountBindingStore, SQLiteAuthJobStore, SQLiteEvidenceLedger, SQLiteSourceConfigStore, SQLiteSourceObservationStore,
} from '../../persistence/src/auth.js';
import { SQLiteStatusProjectionStore } from '../../persistence/src/runtime-status.js';
import { SQLiteSessions } from '../../persistence/src/sessions.js';
import { createHarness } from './harness.js';

type SourceScenario = 'direct' | 'redirect-1' | 'redirect-2' | 'redirect-3' | 'missing-marker' | 'ambiguous-marker' | 'cross-final' | 'interaction';
type Barrier = 'navigate' | 'wait' | 'read' | 'commit';

export interface SyntheticAuthE2EOptions {
  moodleScenario?: SourceScenario;
  edstemScenario?: SourceScenario;
  edstemSubject?: string;
  barrier?: Barrier;
}

interface RequestAudit {
  context: 'source' | 'ui';
  source: SourceId | null;
  action: string;
  method: string;
  origin: string;
  classification: 'synthetic_fulfill' | 'loopback' | 'blocked';
  at: number;
}

const ORIGINS = {
  moodle: 'https://moodle.synthetic.invalid',
  // Existing strict source admission requires an EdStem subdomain. This value is
  // route-fulfilled in memory and is never resolved or placed on a proxy bypass.
  edstem: 'https://synthetic.edstem.org',
} as const;
const SCOPE_ID = '20000000-0000-4000-8000-000000000002';
const CONFIG_IDS = {
  moodle: '30000000-0000-4000-8000-000000000003',
  edstem: '40000000-0000-4000-8000-000000000004',
} as const;
const BUILD_ID = '6'.repeat(64);
const PRIVATE = {
  moodle: { displayName: 'Synthetic Moodle Private Name', schoolEmail: 'moodle-private@synthetic.invalid', course: 'Synthetic Moodle Private Course' },
  edstem: { displayName: 'Synthetic Ed Private Name', schoolEmail: 'ed-private@synthetic.invalid', course: 'Synthetic Ed Private Course' },
} as const;

function safeBrowserError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

function sameOwner(left: ProfileOwnerIdentity, right: ProfileOwnerIdentity): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

class BarrierControl {
  readonly at: Barrier | null;
  #arrivedResolve!: () => void;
  #releaseResolve!: () => void;
  readonly arrived = new Promise<void>(resolve => { this.#arrivedResolve = resolve; });
  readonly released = new Promise<void>(resolve => { this.#releaseResolve = resolve; });
  #used = false;
  constructor(at: Barrier | undefined) { this.at = at ?? null; }
  async stop(at: Barrier): Promise<void> {
    if (this.at !== at || this.#used) return;
    this.#used = true;
    this.#arrivedResolve();
    await this.released;
  }
  release(): void { this.#releaseResolve(); }
}

class SyntheticSourceChromium {
  readonly requests: RequestAudit[] = [];
  readonly errors: string[] = [];
  readonly sourceRequests: Record<SourceId, number> = { moodle: 0, edstem: 0 };
  realSchoolRequests = 0;
  unmappedRequests = 0;
  externalSockets = 0;
  downloads = 0;
  popupInteractions = 0;
  nonGetHeadSuccesses = 0;
  #browser!: Browser;
  readonly #contexts = new Set<BrowserContext>();
  readonly #scenario: Record<SourceId, SourceScenario>;
  readonly #subject: Record<SourceId, string>;
  readonly #barrier: BarrierControl;
  readonly #owner: ProfileOwnerIdentity;

  constructor(options: SyntheticAuthE2EOptions, installationId: string, barrier: BarrierControl) {
    this.#scenario = { moodle: options.moodleScenario ?? 'direct', edstem: options.edstemScenario ?? 'direct' };
    this.#subject = { moodle: 'stable-synthetic-subject', edstem: options.edstemSubject ?? 'stable-synthetic-subject' };
    this.#barrier = barrier;
    this.#owner = {
      installationId, browserBuildId: BUILD_ID, nonce: randomUUID(), generation: 0, fence: 1,
      reservedAt: '2026-09-01T00:00:00.000Z', pid: 4242, osStartIdentity: 'synthetic-browser-start',
      executable: '/synthetic/managed/chromium', startedAt: '2026-09-01T00:00:00.000Z',
    };
  }

  async start(): Promise<void> {
    this.#browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'] });
  }

  async openBackground(input: BrowserOpenInput, guard: BrowserOpenGuard): Promise<BrowserProbeSession> {
    if (guard.signal.aborted || guard.expectedGeneration !== 0 || input.readOrigins.length !== 1 || input.readOrigins[0] !== ORIGINS[input.source]) {
      throw safeBrowserError('BROWSER_FENCED');
    }
    this.sourceRequests[input.source] += 1;
    const context = await this.#browser.newContext({ serviceWorkers: 'block', acceptDownloads: false });
    this.#contexts.add(context);
    context.on('download', () => { this.downloads += 1; });
    context.on('page', page => { if (page !== context.pages()[0]) { this.popupInteractions += 1; void page.close(); } });
    const page = await context.newPage();
    await page.route('**/*', async route => { await this.#route(input.source, route); });
    page.on('requestfailed', request => { this.errors.push(`requestfailed:${request.failure()?.errorText ?? 'UNKNOWN'}`); });
    return this.#session(input.source, context, page);
  }

  async #route(source: SourceId, route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const allowedSynthetic = url.origin === ORIGINS[source] || url.origin === 'https://escape.synthetic.invalid';
    if (!['GET', 'HEAD'].includes(method)) {
      this.requests.push({ context: 'source', source, action: 'route', method, origin: url.origin, classification: 'blocked', at: Date.now() });
      await route.abort('blockedbyclient');
      return;
    }
    if (!allowedSynthetic) {
      if (/(?:moodle|edstem|school|university)/i.test(url.hostname) && !url.hostname.endsWith('.synthetic.invalid')) this.realSchoolRequests += 1;
      this.unmappedRequests += 1;
      this.requests.push({ context: 'source', source, action: 'route', method, origin: url.origin, classification: 'blocked', at: Date.now() });
      await route.abort('blockedbyclient');
      return;
    }
    this.requests.push({ context: 'source', source, action: 'route', method, origin: url.origin, classification: 'synthetic_fulfill', at: Date.now() });
    const scenario = this.#scenario[source];
    const hop = /^\/redirect\/(\d)$/.exec(url.pathname)?.[1];
    if (url.pathname === '/' && scenario.startsWith('redirect-')) {
      await route.fulfill({ status: 200, contentType: 'text/html', body: `<script>location.replace('/redirect/${scenario.slice(-1)}')</script>` });
      return;
    }
    if (hop && Number(hop) > 1) {
      await route.fulfill({ status: 200, contentType: 'text/html', body: `<script>location.replace('/redirect/${Number(hop) - 1}')</script>` });
      return;
    }
    if ((hop === '1' || url.pathname === '/') && scenario === 'cross-final') {
      await route.fulfill({ status: 200, contentType: 'text/html', body: `<script>location.replace('https://escape.synthetic.invalid/final')</script>` });
      return;
    }
    const marker = scenario === 'missing-marker' ? '' : scenario === 'ambiguous-marker'
      ? `<span data-autoed-probe="${source}-authenticated">${source}-authenticated-v1</span><span data-autoed-probe="${source}-authenticated">${source}-authenticated-v1</span>`
      : `<span data-autoed-probe="${source}-authenticated">${source}-authenticated-v1</span>`;
    const html = `<!doctype html><html><body>${marker}<span data-autoed-probe="${source}-subject" title="${this.#subject[source]}">subject</span><span data-autoed-probe="${source}-organization" title="stable-synthetic-organization">organization</span><span data-autoed-probe="${source}-tenant" title="stable-synthetic-tenant">tenant</span><span data-autoed-probe="${source}-display-name">${PRIVATE[source].displayName}</span><span data-autoed-probe="${source}-school-email">${PRIVATE[source].schoolEmail}</span><span data-autoed-probe="${source}-course" title="${SCOPE_ID}">visible</span></body></html>`;
    try {
      await route.fulfill({ status: 200, contentType: 'text/html', body: html });
    } catch (error) {
      this.errors.push(`fulfill:${error instanceof Error ? error.message.split('\n')[0] : 'UNKNOWN'}`);
      throw error;
    }
  }

  #session(source: SourceId, context: BrowserContext, page: Page): BrowserProbeSession {
    const owner = this.#owner;
    const check = (guard: BrowserRequestGuard) => {
      if (guard.signal.aborted) throw safeBrowserError('BROWSER_ABORTED');
      if (guard.expectedGeneration !== 0 || !sameOwner(guard.owner, owner)) throw safeBrowserError('BROWSER_FENCED');
    };
    const locator = (spec: BrowserLocatorSpec) => {
      if (spec.kind !== 'css') throw safeBrowserError('BROWSER_INPUT_INVALID');
      return page.locator(spec.selector);
    };
    return {
      requestGuard(signal, expectedGeneration) { return { signal, expectedGeneration, owner: structuredClone(owner) }; },
      navigate: async (target, guard) => {
        this.requests.push({ context: 'source', source, action: 'navigate', method: 'GET', origin: target.origin, classification: 'synthetic_fulfill', at: Date.now() });
        check(guard); await this.#barrier.stop('navigate');
        if (this.#scenario[source] === 'interaction') throw safeBrowserError('BROWSER_INTERACTION_REQUIRED');
        let response;
        try { response = await page.goto(target.href, { waitUntil: 'domcontentloaded' }); }
        catch (error) { this.errors.push(error instanceof Error ? error.message.split('\n')[0]! : 'UNKNOWN_NAVIGATION_ERROR'); throw error; }
        if (!response) throw safeBrowserError('BROWSER_NETWORK_UNAVAILABLE');
        const scenario = this.#scenario[source];
        const finalURL = scenario === 'cross-final' ? 'https://escape.synthetic.invalid/final'
          : scenario.startsWith('redirect-') ? `${ORIGINS[source]}/redirect/1` : target.href;
        if (page.url() !== finalURL) await page.waitForURL(finalURL);
        const origins = this.requests.filter(item => item.source === source && item.action === 'route').map(item => item.origin);
        return { redirectOrigins: origins, finalOrigin: new URL(page.url()).origin };
      },
      waitFor: async (spec, guard) => { this.requests.push({ context: 'source', source, action: 'wait', method: 'GET', origin: ORIGINS[source], classification: 'synthetic_fulfill', at: Date.now() }); check(guard); await this.#barrier.stop('wait'); await locator(spec).waitFor({ state: 'visible' }); return 'visible'; },
      readVisible: async (spec, guard) => {
        this.requests.push({ context: 'source', source, action: 'read-visible', method: 'GET', origin: ORIGINS[source], classification: 'synthetic_fulfill', at: Date.now() });
        check(guard); await this.#barrier.stop('read'); const value = locator(spec); const count = await value.count();
        if (count === 0) return null; if (count !== 1) throw safeBrowserError('BROWSER_OUTPUT_AMBIGUOUS'); return value.innerText();
      },
      readAttribute: async (spec, attribute, guard) => {
        this.requests.push({ context: 'source', source, action: 'read-attribute', method: 'GET', origin: ORIGINS[source], classification: 'synthetic_fulfill', at: Date.now() });
        check(guard); const value = locator(spec); const count = await value.count();
        if (count === 0) return null; if (count !== 1) throw safeBrowserError('BROWSER_OUTPUT_AMBIGUOUS'); return value.getAttribute(attribute);
      },
      close: async guard => { this.requests.push({ context: 'source', source, action: 'close', method: 'GET', origin: ORIGINS[source], classification: 'synthetic_fulfill', at: Date.now() }); check(guard); await context.close(); this.#contexts.delete(context); },
    };
  }

  async close(): Promise<void> {
    for (const context of this.#contexts) await context.close();
    this.#contexts.clear();
    await this.#browser.close();
  }
}

function config(source: SourceId, confirmedAt: string): ApprovedSourceConfig {
  return { id: CONFIG_IDS[source], source, officialOrigin: ORIGINS[source], approvedScopeId: SCOPE_ID, confirmedAt };
}

function protectedIdentity(source: SourceId, subject: string): ProtectedSourceIdentity {
  return {
    classification: 'protected_local', source, stableSubjectId: subject, organizationId: 'stable-synthetic-organization', tenantId: 'stable-synthetic-tenant',
    displayName: PRIVATE[source].displayName, schoolEmail: PRIVATE[source].schoolEmail, selectedCourseName: PRIVATE[source].course,
  };
}

function identityEvidence(source: SourceId, subject: string): IdentityEvidence {
  const digest = (kind: 'subject' | 'organization' | 'tenant', value: string) => createHash('sha256')
    .update(`autoed-source-evidence-v1\0${kind}\0${value}`, 'utf8').digest('base64url');
  return {
    source, subjectFingerprint: digest('subject', subject), organizationFingerprint: digest('organization', 'stable-synthetic-organization'),
    tenantFingerprint: digest('tenant', 'stable-synthetic-tenant'), approvedScopeId: SCOPE_ID, evidenceKind: 'stable_subject_organization_scope',
  };
}

export async function createSyntheticAuthE2E(options: SyntheticAuthE2EOptions = {}) {
  const harness = createHarness();
  const barrier = new BarrierControl(options.barrier);
  let tick = Date.parse('2026-09-01T00:00:00.000Z');
  let requestLimitTick = tick;
  const clock = { nowMs: () => ++tick, nowIso: () => new Date(++tick).toISOString() };
  const assets = join(harness.root, 'assets');
  await buildStatusAssets(join(process.cwd(), 'apps/status'), assets);
  const db = openDatabase(join(harness.root, 'auth-e2e.sqlite'));
  const context = { expectedGeneration: 0 };
  const installationId = randomUUID();
  const configs = new SQLiteSourceConfigStore(db, { now: clock.nowMs });
  await configs.confirm(config('moodle', clock.nowIso()), context);
  await configs.confirm(config('edstem', clock.nowIso()), context);
  const observations = new SQLiteSourceObservationStore(db, { now: clock.nowMs });
  const bindings = new SQLiteAccountBindingStore(db, { now: clock.nowMs });
  if (options.edstemSubject && options.edstemSubject !== 'stable-synthetic-subject') {
    const baselineDecision = decideAccountBinding({
      moodle: identityEvidence('moodle', 'stable-synthetic-subject'), edstem: identityEvidence('edstem', 'stable-synthetic-subject'),
      confirmed: null, checkedAt: clock.nowIso(),
    });
    if (baselineDecision.binding.status !== 'candidate') throw new Error('SYNTHETIC_BASELINE_BINDING_INVALID');
    await bindings.write(baselineDecision.binding, context);
    await bindings.write({ ...baselineDecision.binding, status: 'confirmed', basis: 'human_confirmed', confirmedByActionReceiptId: randomUUID(), courseAccess: 'allowed' }, context);
  }
  const evidence = new SQLiteEvidenceLedger(db, { now: clock.nowMs });
  const authJobStore = new SQLiteAuthJobStore(db, { now: clock.nowIso });
  const authJobService = new AuthJobService(authJobStore);
  const sourceChromium = new SyntheticSourceChromium(options, installationId, barrier);
  await sourceChromium.start();
  const sealed = new SealedSourceAdapters({ browser: sourceChromium, configs, context: { installationId, browserBuildId: BUILD_ID, generation: 0, fence: 1 }, clock: clock.nowIso });
  const results = new Map<SourceId, SourceProbeResult>();
  const timeline: Array<{ source: SourceId; checkedAt: string; resultCode: string; validIdentity: boolean }> = [];
  const probes: SourceProbePort = {
    async probe(request: SourceProbeRequest, signal: AbortSignal) {
      const result = await sealed.probe(request, signal);
      results.set(request.source, structuredClone(result));
      timeline.push({ source: request.source, checkedAt: result.observation.checkedAt!, resultCode: result.observation.resultCode, validIdentity: result.identity?.approvedScopeId === request.approvedScopeId });
      return result;
    },
  };
  const runner = new AuthJobRunner(authJobStore, probes, { clock: { now: clock.nowIso }, leaseMs: 30_000, heartbeatMs: 30_000 });
  const values = new Map<string, string>();
  const secrets: SecretStore = {
    async get(_installationId, name) { return values.get(name) ?? null; },
    async set(_installationId, name, value) { values.set(name, value); },
    async delete(_installationId, name) { values.delete(name); },
  };
  const scope = { installationId, source: 'synthetic' as const, courseId: 'selftest' as const };
  const credentials = [await issueCredential(secrets, installationId, 'cli', scope, 'local_cli')];
  let jobsEnqueued = 0;
  let courseRequests = 0;
  let cancelObservationCount: number | null = null;
  const wrappedJobs = {
    async requestProbe(command: Parameters<AuthJobService['requestProbe']>[0], write: Parameters<AuthJobService['requestProbe']>[1]) {
      const job = await authJobService.requestProbe(command, write);
      jobsEnqueued += 1;
      return job;
    },
    recordExplicitLogout: authJobService.recordExplicitLogout.bind(authJobService),
    query: authJobService.query.bind(authJobService),
    cancel: authJobService.cancel.bind(authJobService),
  };
  const build = { version: '0.1.0-beta.1', buildId: BUILD_ID, commit: 'b'.repeat(40), tree: 'c'.repeat(40), dependencyHash: 'd'.repeat(64), protocol: 1 as const, schemaMin: 1 as const, schemaMax: 1 as const, capabilities: ['echo' as const] };
  const sessions = new SQLiteSessions(db, installationId);
  const api = await startApi({
    host: '127.0.0.1', port: 0, installationId, build, secrets, credentials,
    jobs: new SQLiteJobStore(db), maintenance: new SQLiteMaintenanceStore(db), projections: new SQLiteStatusProjectionStore(db),
    sessions, shutdown: async () => {}, assetsRoot: assets, runtimeGeneration: 0,
    auth: {
      sourceConfigs: configs, observations, bindings, evidence, authJobs: wrappedJobs,
      login: { async open() { /* UI intent only; synthetic tests never open or fill an official login page. */ } },
      protectedIdentities: { async read(source: SourceId) { return protectedIdentity(source, source === 'edstem' ? options.edstemSubject ?? 'stable-synthetic-subject' : 'stable-synthetic-subject'); } },
    },
    requestLimitNow: () => requestLimitTick += 60_001,
  });
  const uiBrowser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:9', bypass: 'localhost,127.0.0.1,[::1]' } });
  const uiContext = await uiBrowser.newContext({ serviceWorkers: 'block', acceptDownloads: false });
  const uiRequests: RequestAudit[] = [];
  await uiContext.route('**/*', async route => {
    const url = new URL(route.request().url());
    const loopback = url.origin === api.origin;
    uiRequests.push({ context: 'ui', source: null, action: 'ui', method: route.request().method(), origin: url.origin, classification: loopback ? 'loopback' : 'blocked', at: Date.now() });
    if (!loopback) await route.abort('blockedbyclient'); else await route.continue();
  });
  const uiPage = await uiContext.newPage();
  const consoleMessages: string[] = [];
  uiPage.on('console', message => consoleMessages.push(message.text()));
  uiPage.on('pageerror', error => consoleMessages.push(error.message));

  async function approve(code: string) {
    return harness.fetch(`${api.origin}/api/pairing/${code}/approve`, {
      method: 'POST', headers: { authorization: `Bearer ${values.get('cli')}`, 'content-type': 'application/json' }, body: JSON.stringify({ confirmedCode: code }),
    });
  }
  async function pair() {
    await uiPage.goto(`${api.origin}/status`);
    await uiPage.locator('#pair-code').waitFor();
    const code = await uiPage.locator('#pair-code').innerText();
    const response = await approve(code);
    if (response.status !== 200) throw new Error('PAIRING_FAILED');
    await uiPage.getByRole('button', { name: '刷新状态' }).click();
    await uiPage.getByRole('status').filter({ hasText: '本地状态已读取。' }).waitFor();
  }
  async function refresh() {
    const refreshButton = uiPage.getByRole('button', { name: '刷新状态' });
    await refreshButton.waitFor({ state: 'visible' });
    await uiPage.waitForFunction(() => !(document.querySelector('#refresh') as HTMLButtonElement | null)?.disabled);
    await refreshButton.click();
    const status = uiPage.getByRole('status').filter({ hasText: /本地状态已读取。|此页面尚未获得本地访问权限|以下为上次读取结果/ });
    await status.waitFor();
    return status.innerText();
  }
  async function reconcileBinding() {
    const moodle = results.get('moodle')?.identity ?? null;
    const edstem = results.get('edstem')?.identity ?? null;
    if (!moodle || !edstem) return;
    const current = await bindings.read();
    const decision = decideAccountBinding({ moodle, edstem, confirmed: current.status === 'confirmed' ? current : null, checkedAt: clock.nowIso() });
    if (decision.binding.status !== 'unbound') await bindings.write(decision.binding, context);
  }
  async function pump(): Promise<AuthJob | null> {
    const job = await runner.runOnce('synthetic-auth-e2e-worker', context);
    await barrier.stop('commit');
    if (job?.state === 'succeeded') await reconcileBinding();
    return job;
  }
  async function enqueueLoginCompleted(source: SourceId) {
    return wrappedJobs.requestProbe({ source, approvedConfigId: CONFIG_IDS[source], approvedScopeId: SCOPE_ID, trigger: 'user_login_completed', idempotencyKey: `e2e-${source}-${randomUUID()}` }, context);
  }
  async function waitForEnqueued(expected: number): Promise<void> {
    const deadline = Date.now() + 2_000;
    while (jobsEnqueued < expected && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
    if (jobsEnqueued < expected) throw new Error('AUTH_JOB_ENQUEUE_TIMEOUT');
  }
  async function waitForBindingStatus(expected: AccountBinding['status']): Promise<void> {
    const deadline = Date.now() + 2_000;
    while ((await bindings.read()).status !== expected && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
    if ((await bindings.read()).status !== expected) throw new Error('BINDING_STATUS_TIMEOUT');
  }
  async function completeDualProbe() {
    await enqueueLoginCompleted('moodle');
    await pump();
    await pump();
    if (uiPage.url() === 'about:blank') await pair();
  }
  async function requestCancel(source: SourceId) {
    const row = db.prepare("SELECT id FROM source_auth_jobs WHERE source=? ORDER BY created_at DESC LIMIT 1").get(source) as { id: string };
    cancelObservationCount = (db.prepare('SELECT COUNT(*) AS n FROM source_observations').get() as { n: number }).n;
    await wrappedJobs.cancel(row.id, source, context);
  }
  async function probeApprovedCourseVisibility() {
    const binding = await bindings.read();
    if (binding.status !== 'confirmed') return { moodle: false, edstem: false };
    const output = { moodle: false, edstem: false };
    for (const source of ['moodle', 'edstem'] as const) {
      courseRequests += 1;
      const result = await sealed.probe({ source, action: `${source}.course_visibility_probe`, approvedConfigId: CONFIG_IDS[source], approvedScopeId: SCOPE_ID }, new AbortController().signal);
      output[source] = result.selectedCourseVisible === true;
    }
    return output;
  }
  async function appendSyntheticReceipt(input: { source: SourceId; scenario: UatScenario; status: EvidenceReceipt['status'] }) {
    const receipt: EvidenceReceipt = {
      receiptId: randomUUID(), buildId: BUILD_ID, version: '0.1.0-beta.1', platform: 'macos', source: input.source,
      scenario: input.scenario, evidence: 'S', status: input.status, resultCode: 'SYNTHETIC_UI_GATE', bindingConsistency: 'not_observed', gaps: [], checkedAt: clock.nowIso(),
      provenance: { kind: 'automated', evidence: 'S', producerId: 'phase-02-auth-e2e' },
    };
    await evidence.append(receipt, { kind: 'automated', evidence: 'S', platform: 'macos', producerId: 'phase-02-auth-e2e' }, context);
  }
  async function surfaceInventory() {
    const sentinels = Object.values(PRIVATE).flatMap(value => Object.values(value));
    const inventory = await uiPage.evaluate(values => {
      const protectedText = document.querySelector('#protected')?.textContent ?? '';
      const attributes = [...document.querySelectorAll('*')].flatMap(element => [...element.attributes].map(attribute => attribute.value)).join('\n');
      const forbidden = [attributes, document.querySelector('[aria-live]')?.textContent ?? '', location.href, JSON.stringify(localStorage), JSON.stringify(sessionStorage)];
      return { protectedVisibleHits: values.filter(value => protectedText.includes(value)).length, forbiddenHits: values.filter(value => forbidden.some(surface => surface.includes(value))) };
    }, sentinels);
    return { ...inventory, forbiddenHits: [...inventory.forbiddenHits, ...sentinels.filter(value => consoleMessages.some(message => message.includes(value)))] };
  }
  async function failNextAuth(path: string, status: 401 | 403 | 500) {
    await uiPage.route(`${api.origin}${path}`, async route => {
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ code: status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR', stage: 'auth_api', nextAction: 'retry_or_check_local_service' }) });
    }, { times: 1 });
  }
  function audit() {
    const evidenceClasses = (db.prepare('SELECT DISTINCT evidence FROM uat_receipts ORDER BY evidence').all() as Array<{ evidence: string }>).map(row => row.evidence);
    const evidenceReceipts = (db.prepare('SELECT COUNT(*) AS n FROM uat_receipts').get() as { n: number }).n;
    const observationCount = (db.prepare('SELECT COUNT(*) AS n FROM source_observations').get() as { n: number }).n;
    return {
      realSchoolRequests: sourceChromium.realSchoolRequests,
      sourceRequests: { ...sourceChromium.sourceRequests },
      externalSockets: sourceChromium.externalSockets,
      unmappedRequests: sourceChromium.unmappedRequests,
      downloads: sourceChromium.downloads,
      popupInteractions: sourceChromium.popupInteractions,
      nonGetHeadSuccesses: sourceChromium.nonGetHeadSuccesses,
      jobsEnqueued, courseRequests, commitsAfterCancel: cancelObservationCount === null ? 0 : observationCount - cancelObservationCount, timeline: [...timeline], evidenceClasses, evidenceReceipts,
      requests: [...sourceChromium.requests, ...uiRequests],
      errors: [...sourceChromium.errors],
    };
  }
  let closed = false;
  async function close() {
    if (closed) return { ...audit(), residualRoots: existsSync(harness.root) ? 1 : 0, browserArtifacts: 0 };
    closed = true;
    const finalAudit = audit();
    runner.stop();
    await uiContext.close();
    await uiBrowser.close();
    await sourceChromium.close();
    await api.close();
    db.close();
    values.clear();
    await harness.cleanup();
    return { ...finalAudit, residualRoots: existsSync(harness.root) ? 1 : 0, browserArtifacts: 0 };
  }
  return {
    uiPage, pair, refresh, pump, enqueueLoginCompleted, waitForEnqueued, waitForBindingStatus, completeDualProbe, requestCancel,
    waitAtBarrier: () => barrier.arrived, releaseBarrier: async () => { barrier.release(); },
    probeApprovedCourseVisibility, appendSyntheticReceipt, surfaceInventory, failNextAuth, audit, close,
  };
}
