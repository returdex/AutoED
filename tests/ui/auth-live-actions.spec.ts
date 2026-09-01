import { syntheticTest as test, expect } from '../../playwright.config.js';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { startApi } from '../../apps/api/src/main.js';
import type { PairedLiveCheckpointService } from '../../packages/application/src/live-checkpoints.js';
import type { SecretStore } from '../../packages/application/src/ports.js';
import { openDatabase, SQLiteMaintenanceStore } from '../../packages/persistence/src/database.js';
import { SQLiteJobStore } from '../../packages/persistence/src/claims.js';
import { SQLiteStatusProjectionStore } from '../../packages/persistence/src/runtime-status.js';
import { SQLiteSessions } from '../../packages/persistence/src/sessions.js';
import { issueCredential } from '../../packages/platform/src/credentials.js';
import type { AccountBinding, ApprovedSourceConfig, ProtectedSourceIdentity, SourceId, SourceObservation } from '../../packages/domain/src/model.js';
import { createHarness } from '../../packages/test-support/src/harness.js';
import { buildStatusAssets } from '../../scripts/build/build.mjs';

type Projection = {
  platform: 'macos' | 'windows'; scenario: 'a.login' | 'd.24h_recheck';
  state: 'ready' | 'waiting' | 'pending' | 'human_needed' | 'pass'; instruction: string;
  earliestActionAt: string | null; actions: Array<{ source: SourceId; actionId: string }>;
};

const checkedAt = '2026-09-01T00:00:00.000Z';
const scopeId = '10000000-0000-4000-8000-000000000001';
const fingerprints = { moodle: 'A'.repeat(43), edstem: 'B'.repeat(43) } as const;
function config(source: SourceId): ApprovedSourceConfig { return { id: randomUUID(), source, officialOrigin: source === 'moodle' ? 'https://moodle.synthetic.invalid' : 'https://synthetic.edstem.org', approvedScopeId: scopeId, confirmedAt: checkedAt }; }
function observation(source: SourceId): SourceObservation { return { source, auth: 'authenticated', capability: 'available', health: 'healthy', freshness: 'fresh', completeness: 'complete', outcome: 'present', checkedAt, resultCode: 'AUTHENTICATED', courseAccess: 'allowed', lastSuccess: { checkedAt, subjectFingerprint: fingerprints[source] } }; }
function identity(source: SourceId): ProtectedSourceIdentity { return { classification: 'protected_local', source, stableSubjectId: `private-${source}-subject`, organizationId: 'private-org', tenantId: 'private-tenant', displayName: `Private ${source} Name`, schoolEmail: `private-${source}@synthetic.invalid`, selectedCourseName: `Private ${source} Course` }; }
function binding(): AccountBinding {
  const item = (source: SourceId) => ({ source, subjectFingerprint: fingerprints[source], organizationFingerprint: fingerprints[source], tenantFingerprint: fingerprints[source], approvedScopeId: scopeId, evidenceKind: 'stable_subject_organization_scope' as const });
  return { status: 'confirmed', moodle: item('moodle'), edstem: item('edstem'), basis: 'human_confirmed', confirmedByActionReceiptId: randomUUID(), courseAccess: 'allowed', checkedAt };
}

async function fixture(initial: Projection) {
  const harness = createHarness(); const assets = join(harness.root, 'assets'); await buildStatusAssets(join(process.cwd(), 'apps/status'), assets);
  const db = openDatabase(join(harness.root, 'live-ui.sqlite')); const installationId = randomUUID();
  const scope = { installationId, source: 'synthetic' as const, courseId: 'selftest' as const }; const values = new Map<string, string>();
  const secrets: SecretStore = { async get(_id, name) { return values.get(name) ?? null; }, async set(_id, name, value) { values.set(name, value); }, async delete(_id, name) { values.delete(name); } };
  const credentials = [await issueCredential(secrets, installationId, 'cli', scope, 'local_cli')];
  const configs = { moodle: config('moodle'), edstem: config('edstem') }; const observations = { moodle: observation('moodle'), edstem: observation('edstem') }; const currentBinding = binding();
  const auth = {
    sourceConfigs: { async read(source: SourceId) { return configs[source]; }, async confirm() { throw new Error('UNEXPECTED'); } },
    observations: { async read(source: SourceId) { return observations[source]; }, async write() { throw new Error('UNEXPECTED'); } },
    bindings: { async read() { return currentBinding; }, async write() { throw new Error('UNEXPECTED'); } },
    evidence: { async append() { throw new Error('NO_UI_EVIDENCE_WRITE'); }, async list() { return []; } },
    authJobs: { async requestProbe() { throw new Error('UNEXPECTED'); }, async recordExplicitLogout() { throw new Error('UNEXPECTED'); }, async query() { return null; }, async cancel() { throw new Error('UNEXPECTED'); } },
    login: { async open() { throw new Error('UNEXPECTED'); } }, protectedIdentities: { async read(source: SourceId) { return identity(source); } },
  };
  let projection = structuredClone(initial); const calls: Array<{ kind: string; input: unknown }> = [];
  const pending = () => ({ ...projection, state: 'pending' as const, actions: [{ source: 'moodle' as const, actionId: randomUUID() }, { source: 'edstem' as const, actionId: randomUUID() }] });
  const live = {
    async status() { calls.push({ kind: 'status', input: null }); return structuredClone(projection); },
    async issueA1Login(input: unknown) { calls.push({ kind: 'issue', input }); projection = pending(); return structuredClone(projection); },
    async resumeA1Login(input: unknown) { calls.push({ kind: 'resume', input }); return structuredClone(projection); },
    async resultA1Login(input: unknown) { calls.push({ kind: 'result', input }); projection = { ...projection, state: 'pass', actions: [] }; return structuredClone(projection); },
    async issueD24hRecheck(input: unknown) { calls.push({ kind: 'issue-d', input }); projection = pending(); return structuredClone(projection); },
    async resumeD24hRecheck(input: unknown) { calls.push({ kind: 'resume-d', input }); return structuredClone(projection); },
    async resultD24hRecheck(input: unknown) { calls.push({ kind: 'result-d', input }); return structuredClone(projection); },
  } as unknown as PairedLiveCheckpointService;
  const build = { version: '0.1.0-beta.20', buildId: 'a'.repeat(64), commit: 'b'.repeat(40), tree: 'c'.repeat(40), dependencyHash: 'd'.repeat(64), protocol: 1 as const, schemaMin: 1 as const, schemaMax: 1 as const, capabilities: ['echo' as const] };
  const api = await startApi({ host: '127.0.0.1', port: 0, installationId, build, secrets, credentials, jobs: new SQLiteJobStore(db), maintenance: new SQLiteMaintenanceStore(db), projections: new SQLiteStatusProjectionStore(db), sessions: new SQLiteSessions(db, installationId), shutdown: async () => {}, assetsRoot: assets, auth, live, requestLimitNow: (() => { let time = 0; return () => time += 60_001; })() });
  async function approve(code: string) { return harness.fetch(`${api.origin}/api/pairing/${code}/approve`, { method: 'POST', headers: { authorization: `Bearer ${values.get('cli')}`, 'content-type': 'application/json' }, body: JSON.stringify({ confirmedCode: code }) }); }
  return { api, calls, setProjection(value: Projection) { projection = structuredClone(value); }, approve, async close() { await api.close(); db.close(); await harness.cleanup(); } };
}

async function pair(page: import('@playwright/test').Page, f: Awaited<ReturnType<typeof fixture>>) {
  await page.goto(`${f.api.origin}/status`); await expect(page.locator('#pair-code')).toHaveText(/^[A-F0-9]{16}$/); const code = await page.locator('#pair-code').innerText();
  expect((await f.approve(code)).status).toBe(200); await page.getByRole('button', { name: '刷新状态' }).click(); await expect(page.getByRole('status')).toHaveText('本地状态已读取。');
}

const ready = (platform: 'macos' | 'windows' = 'macos'): Projection => ({ platform, scenario: 'a.login', state: 'ready', instruction: '请在官方窗口中亲自完成登录或 MFA。', earliestActionAt: null, actions: [] });

test.describe('paired durable checkpoint UI', () => {
  test('durable live action uses one fixed CTA and exact issue/result bodies', async ({ page }) => {
    const f = await fixture(ready()); try {
      const requests: Array<{ path: string; body: unknown }> = []; page.on('request', request => { if (request.url().includes('/live-action/') && request.method() === 'POST') requests.push({ path: new URL(request.url()).pathname, body: request.postDataJSON() }); });
      await pair(page, f); await expect(page.locator('button.primary-action')).toHaveCount(1); await expect(page.locator('.live-action-panel')).toContainText('请在官方窗口中亲自完成登录或 MFA。');
      await page.getByRole('button', { name: '开始 A 登录检查' }).click(); await expect(page.getByRole('button', { name: '我已完成 A 登录检查' })).toBeVisible();
      expect(requests[0]).toEqual({ path: '/api/auth/live-action/a1-login/issue', body: {} });
      await page.getByRole('button', { name: '我已完成 A 登录检查' }).click();
      expect(requests.filter(item => item.path.endsWith('/result')).map(item => Object.keys(item.body as object).sort())).toEqual([['acknowledgement', 'actionId'], ['acknowledgement', 'actionId']]);
    } finally { await f.close(); }
  });

  test('checkpoint recovery resumes server-projected pending actions after reload', async ({ page }) => {
    const pending = { ...ready(), state: 'pending' as const, actions: [{ source: 'moodle' as const, actionId: randomUUID() }, { source: 'edstem' as const, actionId: randomUUID() }] };
    const f = await fixture(pending); try { await pair(page, f); await page.reload(); await expect(page.getByRole('button', { name: '我已完成 A 登录检查' })).toBeVisible(); expect(f.calls.some(call => call.kind === 'resume' && JSON.stringify(call.input) === '{}')).toBe(true); } finally { await f.close(); }
  });

  test('payload external authority keeps correlations out of DOM attributes storage URL clipboard and logs', async ({ page }) => {
    const ids = [randomUUID(), randomUUID()]; const f = await fixture({ ...ready(), state: 'pending', actions: [{ source: 'moodle', actionId: ids[0]! }, { source: 'edstem', actionId: ids[1]! }] });
    try { const messages: string[] = []; page.on('console', message => messages.push(message.text())); await pair(page, f); const audit = await page.evaluate(() => ({ text: document.body.innerText, attrs: [...document.querySelectorAll('*')].flatMap(element => [...element.attributes].map(attribute => attribute.value)).join('\n'), url: location.href, local: JSON.stringify(localStorage), session: JSON.stringify(sessionStorage) })); for (const id of ids) expect(JSON.stringify({ ...audit, messages })).not.toContain(id); } finally { await f.close(); }
  });

  test('platform isolation renders Windows independently and D time gate has no skip', async ({ page }) => {
    const earliest = '2026-09-02T00:00:00.000Z'; const f = await fixture({ platform: 'windows', scenario: 'd.24h_recheck', state: 'waiting', instruction: '等待服务器显示的最早复查时间；此步骤不能跳过。', earliestActionAt: earliest, actions: [] });
    try { await pair(page, f); await expect(page.locator('.live-action-panel')).toContainText('Windows'); await expect(page.locator('.live-action-panel')).toContainText(earliest); await expect(page.locator('.live-action-panel')).toContainText('不能跳过'); await expect(page.getByRole('button', { name: /跳过|开始 D|完成 D/ })).toHaveCount(0); await expect(page.locator('.platform-gaps')).toContainText('macOS 结果不能替代 Windows 验证'); } finally { await f.close(); }
  });
});
