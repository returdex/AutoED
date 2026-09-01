import { createHmac, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { request as nodeRequest } from 'node:http';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { AuthJobRunner, AuthJobService, type AuthJobStore, type AuthProbeCommand } from '../../packages/application/src/auth-jobs.js';
import type { SecretStore, SourceProbePort } from '../../packages/application/src/ports.js';
import type { AccountBinding, ApprovedSourceConfig, ProfileOwnerIdentity, ProtectedSourceIdentity, SourceId, SourceObservation, SourceProbeResult } from '../../packages/domain/src/model.js';
import { SQLiteAuthJobStore, SQLiteSourceObservationStore } from '../../packages/persistence/src/auth.js';
import { SQLiteJobStore } from '../../packages/persistence/src/claims.js';
import { openDatabase, SQLiteMaintenanceStore } from '../../packages/persistence/src/database.js';
import { SQLiteStatusProjectionStore } from '../../packages/persistence/src/runtime-status.js';
import { SQLiteSessions } from '../../packages/persistence/src/sessions.js';
import { issueCredential } from '../../packages/platform/src/credentials.js';
import { protectPath } from '../../packages/platform/src/permissions.js';
import { createManagedRoot, type RootSelection } from '../../packages/platform/src/paths.js';
import { FileProfileOwnershipCoordinator, type ProfileControlChallenge } from '../../packages/platform/src/profile.js';
import { SealedSourceAdapters } from '../../packages/platform/src/source-adapters.js';
import { createMaliciousSourceFixture } from '../../packages/test-support/src/auth-fixture.js';
import { createHarness } from '../../packages/test-support/src/harness.js';
import { SECURITY_MATRIX_CASES, SECURITY_MATRIX_SENTINELS, type SecurityCaseId } from '../../packages/test-support/src/security-matrix.js';
import { startApi } from '../../apps/api/src/main.js';

const INTEGRATION_CASE_IDS = [
  'ORIGIN_OUT_OF_ORIGIN', 'EFFECT_BUSINESS_WRITE', 'EFFECT_DOWNLOAD', 'OUTPUT_SENSITIVE_SENTINEL', 'PROFILE_HELD',
  'PROFILE_PID_REUSE', 'WORKER_STALE_BEFORE_REQUEST', 'WORKER_STALE_BEFORE_COMMIT', 'RETENTION_LAST_SUCCESS', 'UI_UNPAIRED_PROTECTED_READ',
] as const satisfies readonly SecurityCaseId[];
const executions = new Map<SecurityCaseId, number>();
const complete = (id: typeof INTEGRATION_CASE_IDS[number]) => executions.set(id, (executions.get(id) ?? 0) + 1);
const cleanups: Array<() => Promise<void>> = [];
const context = { expectedGeneration: 0 };
const checkedAt = '2026-09-01T00:00:00.000Z';
const scopeId = '10000000-0000-4000-8000-000000000001';
const configIds = { moodle: '10000000-0000-4000-8000-000000000002', edstem: '10000000-0000-4000-8000-000000000003' } as const;
const iso = (value: number) => new Date(value).toISOString();

afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
afterAll(() => {
  expect(SECURITY_MATRIX_CASES.filter(item => INTEGRATION_CASE_IDS.includes(item.id as never)).map(item => item.id)).toEqual(INTEGRATION_CASE_IDS);
  expect(INTEGRATION_CASE_IDS.map(id => [id, executions.get(id) ?? 0])).toEqual(INTEGRATION_CASE_IDS.map(id => [id, 1]));
});

function adapter(scenario: Parameters<typeof createMaliciousSourceFixture>[0]) {
  const fixture = createMaliciousSourceFixture(scenario);
  return { fixture, adapters: new SealedSourceAdapters({ browser: fixture.browser, configs: fixture.sourceConfigs, context: fixture.context, clock: () => '2026-09-01T00:00:01.000Z' }) };
}

function probeResult(source: SourceId, code: SourceProbeResult['observation']['resultCode'], when: string): SourceProbeResult {
  const authenticated = code === 'AUTHENTICATED';
  return {
    request: { source, action: `${source}.auth_probe`, approvedConfigId: configIds[source], approvedScopeId: scopeId },
    observation: {
      source, auth: authenticated ? 'authenticated' : code === 'AUTH_REQUIRED' ? 'unauthenticated' : 'not_observed',
      capability: authenticated ? 'available' : code === 'CAPABILITY_DENIED' ? 'denied' : 'unknown',
      health: code === 'NETWORK_UNAVAILABLE' ? 'error' : code === 'PARSER_CHANGED' ? 'degraded' : 'healthy',
      freshness: authenticated ? 'fresh' : 'stale', completeness: authenticated ? 'complete' : 'partial',
      outcome: authenticated ? 'present' : 'error', checkedAt: when, resultCode: code, courseAccess: 'blocked',
      lastSuccess: authenticated ? { checkedAt: when, subjectFingerprint: `${source}-subject` } : null,
    },
    identity: authenticated ? { source, subjectFingerprint: `${source}-subject`, organizationFingerprint: 'organization', tenantFingerprint: 'tenant', approvedScopeId: scopeId, evidenceKind: 'stable_subject_organization_scope' } : null,
    selectedCourseVisible: null,
  };
}

const authCommand = (source: SourceId, trigger: AuthProbeCommand['trigger'] = 'background'): AuthProbeCommand =>
  ({ source, approvedConfigId: configIds[source], approvedScopeId: scopeId, trigger, idempotencyKey: randomUUID() });

function intercepted(store: AuthJobStore, handlers: Partial<Pick<AuthJobStore, 'assertCurrent' | 'commitTransition'>>): AuthJobStore {
  return new Proxy(store, { get(target, property) { const replacement = handlers[property as keyof typeof handlers]; if (replacement) return replacement; const value = Reflect.get(target, property); return typeof value === 'function' ? value.bind(target) : value; } });
}

function workerFixture() {
  const harness = createHarness(); cleanups.push(() => harness.cleanup());
  const db = openDatabase(join(harness.root, 'security-worker.sqlite')); cleanups.push(async () => { if (db.open) db.close(); });
  const clock = { now: () => iso(0) }; const store = new SQLiteAuthJobStore(db, clock);
  return { db, store, service: new AuthJobService(store), clock };
}
class QueueProbe implements SourceProbePort {
  calls = 0;
  constructor(private readonly value: SourceProbeResult) {}
  async probe(): Promise<SourceProbeResult> { this.calls++; return this.value; }
}

const PROFILE_BUILD = 'b'.repeat(64);
const PROFILE_SECRET = 'synthetic-profile-control-secret';
class SyntheticSecretStore implements SecretStore {
  async get(_installationId: string, name: string) { return name === 'api' ? PROFILE_SECRET : null; }
  async set() { throw new Error('TEST_WRITE_FORBIDDEN'); }
  async delete() { throw new Error('TEST_DELETE_FORBIDDEN'); }
}
function profileFixture(mode: 'running' | 'reuse') {
  const harness = createHarness(); cleanups.push(() => harness.cleanup());
  const parent = realpathSync(harness.root); protectPath(parent);
  const selection: RootSelection = { root: join(parent, 'installation'), parent, excludedRoots: [] };
  const paths = createManagedRoot(selection); const browserExecutable = join(paths.browser, 'managed-browser');
  writeFileSync(browserExecutable, 'synthetic executable identity', { mode: 0o600 }); protectPath(browserExecutable);
  const installationId = randomUUID();
  const coordinator = new FileProfileOwnershipCoordinator({
    selection, installationId, browserBuildId: PROFILE_BUILD, browserExecutable, clock: { now: () => 1_000 }, leaseMs: 60_000,
    secrets: new SyntheticSecretStore(),
    observe: async () => ({ osStartIdentity: mode === 'running' ? 'synthetic-start' : 'reused-start', executable: browserExecutable }),
    control: { request: async (challenge: ProfileControlChallenge) => ({ owner: challenge.owner, proof: createHmac('sha256', PROFILE_SECRET).update(JSON.stringify(challenge)).digest('hex') }) },
  });
  return { coordinator, reserve: { installationId, browserBuildId: PROFILE_BUILD, generation: 0, fence: 0 }, processIdentity: { pid: 4242, osStartIdentity: 'synthetic-start', executable: browserExecutable, startedAt: iso(1_000) }, record: join(paths.runtime, 'profile-ownership.json') };
}

function sourceConfig(source: SourceId): ApprovedSourceConfig {
  return { id: configIds[source], source, officialOrigin: source === 'moodle' ? 'https://moodle.synthetic.invalid' : 'https://synthetic.edstem.org', approvedScopeId: scopeId, confirmedAt: checkedAt };
}
function sourceObservation(source: SourceId): SourceObservation {
  return { source, auth: 'authenticated', capability: 'available', health: 'healthy', freshness: 'fresh', completeness: 'complete', outcome: 'present', checkedAt, resultCode: 'AUTHENTICATED', courseAccess: 'blocked', lastSuccess: { checkedAt, subjectFingerprint: 'A'.repeat(43) } };
}
function sourceIdentity(source: SourceId): ProtectedSourceIdentity {
  return { classification: 'protected_local', source, stableSubjectId: `${SECURITY_MATRIX_SENTINELS.identity}-${source}`, organizationId: SECURITY_MATRIX_SENTINELS.organization, tenantId: SECURITY_MATRIX_SENTINELS.tenant, displayName: `${SECURITY_MATRIX_SENTINELS.identity}-${source}`, schoolEmail: `${source}@example.invalid`, selectedCourseName: SECURITY_MATRIX_SENTINELS.course };
}
function candidateBinding(): AccountBinding {
  const identity = (source: SourceId) => ({ source, subjectFingerprint: 'A'.repeat(43), organizationFingerprint: 'B'.repeat(43), tenantFingerprint: 'C'.repeat(43), approvedScopeId: scopeId, evidenceKind: 'stable_subject_organization_scope' as const });
  return { status: 'candidate', moodle: identity('moodle'), edstem: identity('edstem'), basis: 'stable_subject_organization_scope', confirmedByActionReceiptId: null, courseAccess: 'blocked', checkedAt };
}

async function apiFixture() {
  const harness = createHarness(); cleanups.push(() => harness.cleanup());
  const db = openDatabase(join(harness.root, 'security-api.sqlite')); cleanups.push(async () => { if (db.open) db.close(); });
  const installationId = randomUUID();
  const scope = { installationId, source: 'synthetic' as const, courseId: 'selftest' as const };
  const secretsMap = new Map<string, string>();
  const secrets: SecretStore = {
    async get(_id, name) { return secretsMap.get(name) ?? null; },
    async set(_id, name, value) { secretsMap.set(name, value); },
    async delete(_id, name) { secretsMap.delete(name); },
  };
  const credentials = [
    await issueCredential(secrets, installationId, 'cli', scope, 'local_cli'),
    await issueCredential(secrets, installationId, 'mcp', scope, 'model'),
  ];
  const configs = { moodle: sourceConfig('moodle'), edstem: sourceConfig('edstem') };
  const observations = { moodle: sourceObservation('moodle'), edstem: sourceObservation('edstem') };
  let statusError: unknown = null;
  const calls = { config: 0, launch: 0, probe: 0, logout: 0, binding: 0, receiptList: 0, receiptAppend: 0 };
  const auth = {
    sourceConfigs: { async read(source: SourceId) { if (statusError) throw statusError; return configs[source]; }, async confirm() { calls.config++; } },
    observations: { async read(source: SourceId) { return observations[source]; }, async write() { throw new Error('UNEXPECTED_WRITE'); } },
    bindings: { async read() { return candidateBinding(); }, async write() { calls.binding++; } },
    evidence: { async append() { calls.receiptAppend++; }, async list() { calls.receiptList++; return []; } },
    authJobs: { async requestProbe() { calls.probe++; return { jobId: randomUUID() }; }, async recordExplicitLogout() { calls.logout++; return {} as never; }, async query() { return null; }, async cancel() { throw new Error('UNEXPECTED_CANCEL'); } },
    login: { async open() { calls.launch++; } },
    protectedIdentities: { async read(source: SourceId) { return sourceIdentity(source); } },
  };
  const build = { version: '0.1.0-beta.1', buildId: 'a'.repeat(64), commit: 'b'.repeat(40), tree: 'c'.repeat(40), dependencyHash: 'd'.repeat(64), protocol: 1 as const, schemaMin: 1 as const, schemaMax: 1 as const, capabilities: ['echo' as const] };
  const api = await startApi({
    host: '127.0.0.1', port: 0, installationId, build, secrets, credentials,
    jobs: new SQLiteJobStore(db), maintenance: new SQLiteMaintenanceStore(db), projections: new SQLiteStatusProjectionStore(db),
    sessions: new SQLiteSessions(db, installationId), shutdown: async () => {}, runtimeGeneration: 0, auth,
  });
  cleanups.push(() => api.close());
  const cookies = (response: Response) => response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  const request = async (path: string, options: { method?: string; body?: unknown; cookie?: string; csrf?: string; bearer?: 'cli' | 'mcp'; origin?: string; headers?: Record<string, string> } = {}) => {
    const method = options.method ?? (options.body === undefined ? 'GET' : 'POST');
    const headers: Record<string, string> = { ...(!options.bearer || options.origin !== undefined ? { origin: options.origin ?? api.origin } : {}), ...options.headers };
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (options.cookie) headers.cookie = options.cookie;
    if (options.csrf) headers['x-autoed-csrf'] = options.csrf;
    if (options.bearer) headers.authorization = `Bearer ${secretsMap.get(options.bearer)}`;
    return harness.fetch(api.origin + path, { method, headers, ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }) });
  };
  const nonceResponse = await request('/api/pairing/nonce'); const { nonce } = await nonceResponse.json();
  const pending = await request('/api/pairing/pending', { body: { nonce }, cookie: cookies(nonceResponse), csrf: nonce }); const { code } = await pending.json();
  expect((await request(`/api/pairing/${code}/approve`, { body: { confirmedCode: code }, bearer: 'cli' })).status).toBe(200);
  const exchange = await request('/api/pairing/exchange', { body: {}, cookie: cookies(pending), csrf: nonce });
  const paired = { cookie: cookies(exchange), ...(await exchange.json() as { csrf: string; sessionId: string }) };
  return { request, paired, calls, configs, origin: api.origin, failStatus(error: unknown) { statusError = error; } };
}

describe('Phase 2 auth security matrix: actual adapters and durable state', () => {
  it('blocks cross-origin redirects, writes, downloads and parser/network negatives without any forbidden effect', async () => {
    for (const scenario of ['cross-first', 'cross-middle', 'cross-final'] as const) {
      const { fixture, adapters } = adapter(scenario);
      const result = await adapters.probe(fixture.request('moodle', 'moodle.auth_probe'), new AbortController().signal);
      expect(result.observation.resultCode).toBe('CAPABILITY_DENIED');
      expect(fixture.audit()).toMatchObject({ visibleReads: 0, attributeReads: 0, externalRequests: 0, realSchoolRequests: 0, nonGetHeadSucceeded: 0, downloadBytes: 0, sourceMutations: 0 });
    }
    complete('ORIGIN_OUT_OF_ORIGIN');

    for (const [scenario, code] of [
      ['popup', 'REAUTH_REQUIRED'], ['interaction', 'REAUTH_REQUIRED'],
      ['form-post', 'CAPABILITY_DENIED'], ['quiz-start', 'CAPABILITY_DENIED'], ['upload', 'CAPABILITY_DENIED'], ['api-fallback', 'CAPABILITY_DENIED'],
    ] as const) {
      const { fixture, adapters } = adapter(scenario);
      expect((await adapters.probe(fixture.request('moodle', 'moodle.auth_probe'), new AbortController().signal)).observation.resultCode).toBe(code);
      expect(fixture.audit()).toMatchObject({ nonGetHeadSucceeded: 0, downloadBytes: 0, popupInteractions: 0, sourceMutations: 0, externalRequests: 0, realSchoolRequests: 0, apiFallbackRequests: 0 });
    }
    complete('EFFECT_BUSINESS_WRITE');

    const blockedDownload = adapter('download');
    expect((await blockedDownload.adapters.probe(blockedDownload.fixture.request('edstem', 'edstem.auth_probe'), new AbortController().signal)).observation.resultCode).toBe('CAPABILITY_DENIED');
    expect(blockedDownload.fixture.audit()).toMatchObject({ downloadBytes: 0, nonGetHeadSucceeded: 0, sourceMutations: 0, externalRequests: 0, realSchoolRequests: 0 });
    complete('EFFECT_DOWNLOAD');

    for (const [scenario, code] of [['missing-marker', 'PARSER_CHANGED'], ['ambiguous-marker', 'PARSER_CHANGED'], ['oversize-marker', 'PARSER_CHANGED'], ['network-error', 'NETWORK_UNAVAILABLE'], ['course-denied', 'CAPABILITY_DENIED']] as const) {
      const { fixture, adapters } = adapter(scenario);
      const action = scenario === 'course-denied' ? 'moodle.course_visibility_probe' : 'moodle.auth_probe';
      expect((await adapters.probe(fixture.request('moodle', action), new AbortController().signal)).observation.resultCode).toBe(code);
      expect(fixture.audit()).toMatchObject({ externalRequests: 0, realSchoolRequests: 0, nonGetHeadSucceeded: 0, downloadBytes: 0, sourceMutations: 0 });
    }
  });

  it('retains each source last success independently across a durable failure and database reopen', async () => {
    const harness = createHarness(); cleanups.push(() => harness.cleanup()); const path = join(harness.root, 'retention.sqlite');
    let db = openDatabase(path); let store = new SQLiteSourceObservationStore(db, { now: () => 3_000 });
    await store.write(probeResult('moodle', 'AUTHENTICATED', iso(1_000)).observation, context);
    await store.write(probeResult('edstem', 'AUTHENTICATED', iso(1_000)).observation, context);
    await store.write(probeResult('moodle', 'NETWORK_UNAVAILABLE', iso(2_000)).observation, context);
    db.close(); db = openDatabase(path); cleanups.push(async () => { if (db.open) db.close(); }); store = new SQLiteSourceObservationStore(db, { now: () => 3_000 });
    expect(await store.read('moodle')).toMatchObject({ resultCode: 'NETWORK_UNAVAILABLE', lastSuccess: { checkedAt: iso(1_000), subjectFingerprint: 'moodle-subject' } });
    expect(await store.read('edstem')).toMatchObject({ resultCode: 'AUTHENTICATED', lastSuccess: { checkedAt: iso(1_000), subjectFingerprint: 'edstem-subject' } });
    complete('RETENTION_LAST_SUCCESS');
  });
});

describe('Phase 2 auth security matrix: Profile authority', () => {
  it('never reclaims a running holder', async () => {
    const value = profileFixture('running');
    const reserved = await value.coordinator.reserve(value.reserve);
    const owned = await value.coordinator.attach(reserved.reservation!, value.processIdentity);
    const original = readFileSync(value.record);
    expect(await value.coordinator.inspect(owned.owner!)).toMatchObject({ resultCode: 'PROFILE_IN_USE', disposition: 'human_needed' });
    await expect(value.coordinator.release(owned.owner!)).rejects.toThrow('PROFILE_IN_USE');
    expect(readFileSync(value.record)).toEqual(original);
    complete('PROFILE_HELD');
  });

  it('keeps PID reuse and mismatched owner facts unconfirmed with record bytes unchanged', async () => {
    const value = profileFixture('reuse');
    const reserved = await value.coordinator.reserve(value.reserve);
    const owned = await value.coordinator.attach(reserved.reservation!, value.processIdentity);
    const original = readFileSync(value.record);
    expect(await value.coordinator.inspect(owned.owner!)).toMatchObject({ resultCode: 'PROFILE_OWNERSHIP_UNCONFIRMED', disposition: 'human_needed' });
    for (const caller of [{ ...owned.owner!, nonce: randomUUID() }, { ...owned.owner!, executable: process.execPath }]) {
      await expect(value.coordinator.release(caller)).rejects.toThrow('PROFILE_OWNERSHIP_UNCONFIRMED');
      expect(readFileSync(value.record)).toEqual(original);
    }
    expect(existsSync(value.record)).toBe(true);
    complete('PROFILE_PID_REUSE');
  });
});

describe('Phase 2 auth security matrix: Worker request and commit fencing', () => {
  it('prevents every source request after cancellation, expiry, generation or fence loss', async () => {
    for (const loss of ['cancel', 'expired lease', 'stale generation', 'stale fence'] as const) {
      const f = workerFixture(); const requested = await f.service.requestProbe(authCommand('moodle'), context); let checks = 0;
      const store = intercepted(f.store, { assertCurrent: async (...args) => {
        if (++checks === 1) {
          if (loss === 'cancel') await f.store.requestCancel(requested.jobId, 'moodle', context);
          else if (loss === 'expired lease') f.db.prepare('UPDATE source_auth_jobs SET lease_until=0 WHERE id=?').run(requested.jobId);
          else if (loss === 'stale generation') f.db.prepare('UPDATE source_auth_jobs SET generation=generation+1 WHERE id=?').run(requested.jobId);
          else f.db.prepare('UPDATE source_auth_jobs SET fence=fence+1 WHERE id=?').run(requested.jobId);
        }
        return f.store.assertCurrent(...args);
      } });
      const port = new QueueProbe(probeResult('moodle', 'AUTHENTICATED', iso(0)));
      await expect(new AuthJobRunner(store, port, { clock: f.clock, leaseMs: 1_000, heartbeatMs: 5 }).runOnce('old', context)).rejects.toMatchObject({ code: expect.stringMatching(/CANCEL|LEASE|GENERATION/) });
      expect(port.calls).toBe(0);
      expect(f.db.prepare('SELECT count(*) AS n FROM source_observations').get()).toEqual({ n: 0 });
      expect(f.db.prepare('SELECT count(*) AS n FROM uat_receipts').get()).toEqual({ n: 0 });
    }
    complete('WORKER_STALE_BEFORE_REQUEST');
  });

  it('discards every late result and rolls back the SQL race before observation, follow-up or receipt commit', async () => {
    for (const loss of ['cancel', 'expired lease', 'stale generation', 'stale fence'] as const) {
      const f = workerFixture(); const requested = await f.service.requestProbe(authCommand('moodle', 'user_login_completed'), context); let checks = 0;
      const store = intercepted(f.store, { assertCurrent: async (...args) => {
        if (++checks === 2) {
          if (loss === 'cancel') await f.store.requestCancel(requested.jobId, 'moodle', context);
          else if (loss === 'expired lease') f.db.prepare('UPDATE source_auth_jobs SET lease_until=0 WHERE id=?').run(requested.jobId);
          else if (loss === 'stale generation') f.db.prepare('UPDATE source_auth_jobs SET generation=generation+1 WHERE id=?').run(requested.jobId);
          else f.db.prepare('UPDATE source_auth_jobs SET fence=fence+1 WHERE id=?').run(requested.jobId);
        }
        return f.store.assertCurrent(...args);
      } });
      const port = new QueueProbe(probeResult('moodle', 'AUTHENTICATED', iso(0)));
      await expect(new AuthJobRunner(store, port, { clock: f.clock, leaseMs: 1_000, heartbeatMs: 5 }).runOnce('old', context)).rejects.toMatchObject({ code: expect.stringMatching(/CANCEL|LEASE|GENERATION/) });
      expect(port.calls).toBe(1);
      expect(f.db.prepare('SELECT count(*) AS n FROM source_observations').get()).toEqual({ n: 0 });
      expect(f.db.prepare('SELECT count(*) AS n FROM source_auth_jobs WHERE parent_job_id IS NOT NULL').get()).toEqual({ n: 0 });
      expect(f.db.prepare('SELECT count(*) AS n FROM uat_receipts').get()).toEqual({ n: 0 });
    }
    const race = workerFixture(); const requested = await race.service.requestProbe(authCommand('moodle', 'user_login_completed'), context);
    const store = intercepted(race.store, { commitTransition: async (...args) => { await race.store.requestCancel(requested.jobId, 'moodle', context); return race.store.commitTransition(...args); } });
    await expect(new AuthJobRunner(store, new QueueProbe(probeResult('moodle', 'AUTHENTICATED', iso(0))), { clock: race.clock, leaseMs: 1_000, heartbeatMs: 5 }).runOnce('old', context)).rejects.toMatchObject({ code: 'CANCEL_REQUESTED' });
    expect(race.db.prepare('SELECT count(*) AS n FROM source_observations').get()).toEqual({ n: 0 });
    expect(race.db.prepare('SELECT count(*) AS n FROM source_auth_jobs WHERE parent_job_id IS NOT NULL').get()).toEqual({ n: 0 });
    expect(race.db.prepare('SELECT count(*) AS n FROM uat_receipts').get()).toEqual({ n: 0 });
    complete('WORKER_STALE_BEFORE_COMMIT');
  });
});

describe('Phase 2 auth security matrix: actual paired loopback API', () => {
  it('rejects every unpaired/wrong-origin mutation and arbitrary operation before downstream writes', async () => {
    const f = await apiFixture();
    const body = { source: 'moodle', approvedConfigId: f.configs.moodle.id, approvedScopeId: scopeId, trigger: 'background', idempotencyKey: 'security-matrix' };
    for (const options of [
      {}, { bearer: 'cli' as const }, { bearer: 'mcp' as const }, { cookie: f.paired.cookie }, { cookie: f.paired.cookie, csrf: 'x'.repeat(43) },
      { cookie: f.paired.cookie, csrf: f.paired.csrf, origin: 'http://evil.invalid' },
      { cookie: f.paired.cookie, csrf: f.paired.csrf, headers: { 'sec-fetch-site': 'cross-site' } },
    ]) {
      const response = await f.request('/api/auth/probe', { body, ...options });
      expect([401, 403], JSON.stringify(options)).toContain(response.status);
    }
    const hostileHostStatus = await new Promise<number>((resolve, reject) => {
      const payload = JSON.stringify(body);
      const request = nodeRequest(new URL('/api/auth/probe', f.origin), {
        method: 'POST',
        headers: { host: 'evil.invalid', origin: f.origin, cookie: f.paired.cookie, 'x-autoed-csrf': f.paired.csrf, 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) },
      }, response => { response.resume(); response.on('end', () => resolve(response.statusCode ?? 0)); });
      request.on('error', reject); request.end(payload);
    });
    expect(hostileHostStatus).toBe(403);
    for (const key of ['url', 'javascript', 'selector', 'browserHandle', 'operation', 'method', 'requestBody', 'download', 'upload', 'submit', 'reply', 'quizStart', 'cookie', 'storageState', 'profilePath']) {
      expect((await f.request('/api/auth/probe', { body: { ...body, [key]: 'forbidden' }, cookie: f.paired.cookie, csrf: f.paired.csrf })).status).toBe(400);
    }
    for (const [path, method] of [['/api/auth/operation', 'POST'], ['/api/auth/status/extra', 'GET'], ['/api/auth/status', 'PUT']] as const) {
      expect([404, 405]).toContain((await f.request(path, { method, body: method === 'GET' ? undefined : {}, cookie: f.paired.cookie, csrf: f.paired.csrf })).status);
    }
    expect(f.calls).toEqual({ config: 0, launch: 0, probe: 0, logout: 0, binding: 0, receiptList: 0, receiptAppend: 0 });
    complete('UI_UNPAIRED_PROTECTED_READ');
  });

  it('keeps private sentinels in paired protected output only and sanitizes bearer errors and unknown routes', async () => {
    const f = await apiFixture(); const protectedResponse = await f.request('/api/auth/status', { cookie: f.paired.cookie });
    expect(protectedResponse.status).toBe(200); expect(await protectedResponse.text()).toContain(SECURITY_MATRIX_SENTINELS.identity);
    for (const bearer of ['cli', 'mcp'] as const) {
      const redacted = await f.request('/api/auth/status', { bearer }); const text = await redacted.text(); expect(redacted.status).toBe(200);
      for (const sentinel of Object.values(SECURITY_MATRIX_SENTINELS)) expect(text).not.toContain(sentinel);
      expect(text).not.toMatch(/displayName|schoolEmail|selectedCourseName|approvedScopeId|officialOrigin/);
    }
    f.failStatus({ code: 'UNKNOWN_ADAPTER', message: `${SECURITY_MATRIX_SENTINELS.exception} /Users/private/Profile?cookie=SECRET`, stack: SECURITY_MATRIX_SENTINELS.stack });
    const failure = await f.request('/api/auth/status', { bearer: 'cli' }); const failedText = await failure.text();
    expect(failure.status).toBe(403); expect(JSON.parse(failedText)).toEqual({ code: 'UNKNOWN_SOURCE_ERROR', stage: 'auth_api', nextAction: 'retry_or_check_local_service' });
    for (const sentinel of Object.values(SECURITY_MATRIX_SENTINELS)) expect(failedText).not.toContain(sentinel);
    const missing = await f.request(`/api/auth/private/path?${SECURITY_MATRIX_SENTINELS.exception}=1`, { bearer: 'cli' });
    expect(missing.status).toBe(404); expect(await missing.text()).not.toContain(SECURITY_MATRIX_SENTINELS.exception);
    expect(f.calls.receiptAppend).toBe(0);
    complete('OUTPUT_SENSITIVE_SENTINEL');
  });
});
