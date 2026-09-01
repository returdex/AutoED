import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { createHarness } from '../../packages/test-support/src/harness.js';
import { openDatabase, SQLiteMaintenanceStore } from '../../packages/persistence/src/database.js';
import { SQLiteJobStore } from '../../packages/persistence/src/claims.js';
import { SQLiteStatusProjectionStore } from '../../packages/persistence/src/runtime-status.js';
import { SQLiteSessions } from '../../packages/persistence/src/sessions.js';
import { issueCredential } from '../../packages/platform/src/credentials.js';
import type { SecretStore } from '../../packages/application/src/ports.js';
import type { AccountBinding, ApprovedSourceConfig, ProtectedSourceIdentity, SourceId, SourceObservation } from '../../packages/domain/src/model.js';
import { startApi } from '../../apps/api/src/main.js';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });

const checkedAt = '2026-09-01T00:00:00.000Z';
const scopeId = '10000000-0000-4000-8000-000000000001';
const fullFingerprint = 'A'.repeat(43);

function sourceConfig(source: SourceId): ApprovedSourceConfig {
  return { id: randomUUID(), source, officialOrigin: source === 'moodle' ? 'https://moodle.example.edu' : 'https://edstem.org', approvedScopeId: scopeId, confirmedAt: checkedAt };
}
function sourceObservation(source: SourceId): SourceObservation {
  return { source, auth: 'authenticated', capability: 'available', health: 'healthy', freshness: 'fresh', completeness: 'complete', outcome: 'present', checkedAt, resultCode: 'AUTHENTICATED', courseAccess: 'blocked', lastSuccess: { checkedAt, subjectFingerprint: fullFingerprint } };
}
function sourceIdentity(source: SourceId): ProtectedSourceIdentity {
  return { classification: 'protected_local', source, stableSubjectId: `PRIVATE-${source}-SUBJECT`, organizationId: 'PRIVATE-ORG', tenantId: 'PRIVATE-TENANT', displayName: `PRIVATE ${source.toUpperCase()} NAME`, schoolEmail: `private-${source}@example.edu` };
}
function candidateBinding(): AccountBinding {
  const identity = (source: SourceId) => ({ source, subjectFingerprint: fullFingerprint, organizationFingerprint: fullFingerprint, tenantFingerprint: fullFingerprint, approvedScopeId: scopeId, evidenceKind: 'stable_subject_organization_scope' as const });
  return { status: 'candidate', moodle: identity('moodle'), edstem: identity('edstem'), basis: 'stable_subject_organization_scope', confirmedByActionReceiptId: null, courseAccess: 'blocked', checkedAt };
}

async function fixture() {
  const harness = createHarness(); cleanup.push(() => harness.cleanup());
  const db = openDatabase(join(harness.root, 'auth-api.sqlite')); cleanup.push(async () => db.close());
  const installationId = randomUUID();
  const scope = { installationId, source: 'synthetic' as const, courseId: 'selftest' as const };
  const secretsMap = new Map<string, string>();
  const secrets: SecretStore = { async get(_id, name) { return secretsMap.get(name) ?? null; }, async set(_id, name, value) { secretsMap.set(name, value); }, async delete(_id, name) { secretsMap.delete(name); } };
  const credentials = [await issueCredential(secrets, installationId, 'cli', scope, 'local_cli'), await issueCredential(secrets, installationId, 'mcp', scope, 'model')];
  const configs: Record<SourceId, ApprovedSourceConfig> = { moodle: sourceConfig('moodle'), edstem: sourceConfig('edstem') };
  const observations: Record<SourceId, SourceObservation> = { moodle: sourceObservation('moodle'), edstem: sourceObservation('edstem') };
  let binding = candidateBinding();
  const calls = { config: 0, launch: 0, probe: 0, logout: 0, binding: 0, receiptList: 0, receiptAppend: 0 };
  const auth = {
    sourceConfigs: { async read(source: SourceId) { return configs[source]; }, async confirm(value: ApprovedSourceConfig) { calls.config++; configs[value.source] = value; } },
    observations: { async read(source: SourceId) { return observations[source]; }, async write() { throw new Error('UNEXPECTED_WRITE'); } },
    bindings: { async read() { return binding; }, async write(value: AccountBinding) { calls.binding++; binding = value; } },
    evidence: { async append() { calls.receiptAppend++; throw new Error('NO_LIVE_EVIDENCE'); }, async list() { calls.receiptList++; return []; } },
    authJobs: { async requestProbe() { calls.probe++; return { jobId: randomUUID() }; }, async recordExplicitLogout() { calls.logout++; return {} as never; }, async query() { return null; }, async cancel() { throw new Error('UNEXPECTED_CANCEL'); } },
    login: { async open() { calls.launch++; } }, protectedIdentities: { async read(source: SourceId) { return sourceIdentity(source); } },
  };
  const build = { version: '0.1.0-beta.1', buildId: 'a'.repeat(64), commit: 'b'.repeat(40), tree: 'c'.repeat(40), dependencyHash: 'd'.repeat(64), protocol: 1 as const, schemaMin: 1 as const, schemaMax: 1 as const, capabilities: ['echo' as const] };
  const base = { host: '127.0.0.1', port: 0, installationId, build, secrets, credentials, jobs: new SQLiteJobStore(db), maintenance: new SQLiteMaintenanceStore(db), projections: new SQLiteStatusProjectionStore(db), shutdown: async () => {}, runtimeGeneration: 0, auth };
  let sessions = new SQLiteSessions(db, installationId);
  let api = await startApi({ ...base, sessions }); cleanup.push(() => api.close());
  const cookies = (response: Response) => response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  async function request(path: string, options: { method?: string; body?: unknown; cookie?: string; csrf?: string; bearer?: 'cli' | 'mcp'; origin?: string; headers?: Record<string, string> } = {}) {
    const method = options.method ?? (options.body === undefined ? 'GET' : 'POST');
    const headers: Record<string, string> = { ...(!options.bearer || options.origin !== undefined ? { origin: options.origin ?? api.origin } : {}), ...options.headers };
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (options.cookie) headers.cookie = options.cookie;
    if (options.csrf) headers['x-autoed-csrf'] = options.csrf;
    if (options.bearer) headers.authorization = `Bearer ${secretsMap.get(options.bearer)}`;
    return harness.fetch(api.origin + path, { method, headers, ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }) });
  }
  async function pair() {
    const nonceResponse = await request('/api/pairing/nonce'); const { nonce } = await nonceResponse.json();
    const pending = await request('/api/pairing/pending', { body: { nonce }, cookie: cookies(nonceResponse), csrf: nonce }); const { code } = await pending.json();
    expect((await request(`/api/pairing/${code}/approve`, { body: { confirmedCode: code }, bearer: 'cli' })).status).toBe(200);
    const exchange = await request('/api/pairing/exchange', { body: {}, cookie: cookies(pending), csrf: nonce });
    return { cookie: cookies(exchange), ...(await exchange.json() as { csrf: string; sessionId: string }) };
  }
  async function restart() { await api.close(); sessions = new SQLiteSessions(db, installationId); api = await startApi({ ...base, sessions }); }
  return { request, pair, restart, calls, configs, secretsMap };
}

describe('paired fixed auth api', () => {
  it('registers only the seven fixed routes and rejects forbidden capability fields before any side effect', async () => {
    const f = await fixture(); const paired = await f.pair();
    const forbidden = ['url', 'js', 'selector', 'browserHandle', 'method', 'requestBody', 'download', 'upload', 'submit', 'reply', 'quizStart', 'cookie', 'storageState', 'profilePath', 'displayName', 'schoolEmail', 'courseName', 'screenshot'];
    for (const key of forbidden) {
      const response = await f.request('/api/auth/login/open', { body: { source: 'moodle', approvedConfigId: f.configs.moodle.id, [key]: 'PRIVATE_SENTINEL' }, cookie: paired.cookie, csrf: paired.csrf });
      expect(response.status, key).toBe(400);
    }
    for (const [path, method] of [['/api/auth/moodle/open', 'POST'], ['/api/auth/operation', 'POST'], ['/api/auth/receipts', 'POST'], ['/api/auth/status/extra', 'GET'], ['/api/auth/status', 'PUT'], ['/api/auth/status', 'PATCH'], ['/api/auth/status', 'DELETE']] as const) {
      expect([404, 405]).toContain((await f.request(path, { method, body: method === 'GET' ? undefined : {}, cookie: paired.cookie, csrf: paired.csrf })).status);
    }
    expect(f.calls).toEqual({ config: 0, launch: 0, probe: 0, logout: 0, binding: 0, receiptList: 0, receiptAppend: 0 });
  });

  it('permits every mutation only for the current paired same-origin session with exact CSRF', async () => {
    const f = await fixture(); const paired = await f.pair();
    const mutations = [
      ['/api/auth/configuration/confirm', { config: f.configs.moodle }],
      ['/api/auth/login/open', { source: 'moodle', approvedConfigId: f.configs.moodle.id }],
      ['/api/auth/probe', { source: 'moodle', approvedConfigId: f.configs.moodle.id, approvedScopeId: scopeId, trigger: 'background', idempotencyKey: 'background-1' }],
      ['/api/auth/logout-intent', { source: 'moodle', acknowledged: true }],
    ] as const;
    for (const [path, body] of mutations) {
      expect([401, 403]).toContain((await f.request(path, { body })).status);
      expect((await f.request(path, { body, bearer: 'cli' })).status).toBe(403);
      expect((await f.request(path, { body, bearer: 'mcp' })).status).toBe(403);
      expect((await f.request(path, { body, cookie: paired.cookie })).status).toBe(403);
      expect((await f.request(path, { body, cookie: paired.cookie, csrf: 'x'.repeat(43) })).status).toBe(403);
      expect((await f.request(path, { body, cookie: paired.cookie, csrf: paired.csrf, origin: 'http://evil.invalid' })).status).toBe(403);
      expect((await f.request(path, { body, cookie: paired.cookie, csrf: paired.csrf })).status).toBe(200);
    }
    const status = await (await f.request('/api/auth/status', { cookie: paired.cookie })).json();
    const candidateBindingId = status.nextAction.candidateBindingId;
    expect((await f.request('/api/auth/binding/confirm', { body: { candidateBindingId, decision: 'confirm' }, cookie: paired.cookie, csrf: paired.csrf })).status).toBe(200);
    expect(f.calls).toMatchObject({ config: 1, launch: 1, probe: 1, logout: 1, binding: 1, receiptAppend: 0 });
  });

  it('binds a server-issued login action to session/source/config/generation and consumes it once before probe', async () => {
    const f = await fixture(); const first = await f.pair(); const second = await f.pair();
    const open = await f.request('/api/auth/login/open', { body: { source: 'moodle', approvedConfigId: f.configs.moodle.id }, cookie: first.cookie, csrf: first.csrf });
    expect(open.status).toBe(200); const { actionReceiptId } = await open.json(); expect(actionReceiptId).toMatch(/^[0-9a-f-]{36}$/);
    const probeBody = { source: 'moodle', approvedConfigId: f.configs.moodle.id, approvedScopeId: scopeId, trigger: 'user_login_completed', idempotencyKey: 'login-completed-1', actionReceiptId };
    expect((await f.request('/api/auth/probe', { body: probeBody, cookie: second.cookie, csrf: second.csrf })).status).toBe(403);
    expect((await f.request('/api/auth/probe', { body: { ...probeBody, actionReceiptId: randomUUID() }, cookie: first.cookie, csrf: first.csrf })).status).toBe(403);
    expect((await f.request('/api/auth/probe', { body: probeBody, cookie: first.cookie, csrf: first.csrf })).status).toBe(200);
    expect((await f.request('/api/auth/probe', { body: { ...probeBody, idempotencyKey: 'login-completed-replay' }, cookie: first.cookie, csrf: first.csrf })).status).toBe(403);
    expect((await f.request('/api/auth/probe', { body: { ...probeBody, trigger: 'background', idempotencyKey: 'background-with-id' }, cookie: first.cookie, csrf: first.csrf })).status).toBe(400);
    expect(f.calls.probe).toBe(1); expect(f.calls.receiptAppend).toBe(0);
    const next = await f.request('/api/auth/login/open', { body: { source: 'moodle', approvedConfigId: f.configs.moodle.id }, cookie: first.cookie, csrf: first.csrf });
    const nextId = (await next.json()).actionReceiptId; await f.restart();
    expect([401, 403]).toContain((await f.request('/api/auth/probe', { body: { ...probeBody, actionReceiptId: nextId, idempotencyKey: 'after-restart' }, cookie: first.cookie, csrf: first.csrf })).status);
    expect(f.calls.probe).toBe(1);
  });

  it('returns protected status only to paired UI and redacted status/receipts to bearer readers with safe errors', async () => {
    const f = await fixture(); const paired = await f.pair();
    expect((await f.request('/api/auth/status')).status).toBe(401);
    const protectedResponse = await f.request('/api/auth/status', { cookie: paired.cookie }); const protectedJson = await protectedResponse.json();
    expect(JSON.stringify(protectedJson)).toContain('PRIVATE MOODLE NAME'); expect(protectedResponse.headers.get('cache-control')).toBe('no-store');
    for (const bearer of ['cli', 'mcp'] as const) {
      const redacted = await f.request('/api/auth/status', { bearer }); const json = await redacted.json(); const text = JSON.stringify(json);
      expect(redacted.status).toBe(200); expect(text).not.toMatch(/PRIVATE|example\.edu|officialOrigin|displayName|schoolEmail/);
      const receipts = await f.request('/api/auth/receipts?platform=macos&source=moodle&scenario=a.login&evidence=S', { bearer });
      expect(receipts.status).toBe(200); expect(await receipts.json()).toEqual([]);
    }
    const invalid = await f.request('/api/auth/receipts?platform=macos&source=moodle&scenario=a.login&evidence=S&all=true', { bearer: 'cli' });
    expect(invalid.status).toBe(400); expect(Object.keys(await invalid.json()).sort()).toEqual(['code', 'nextAction', 'stage']);
    const missing = await f.request('/api/auth/private/path?PRIVATE_SENTINEL=1', { bearer: 'cli' }); const body = await missing.text();
    expect(missing.status).toBe(404); expect(body).not.toMatch(/PRIVATE_SENTINEL|private\/path|message|cause|stack/);
  });
});
