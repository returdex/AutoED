import { syntheticTest as test, expect } from '../../playwright.config.js';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { startApi } from '../../apps/api/src/main.js';
import type { SecretStore } from '../../packages/application/src/ports.js';
import { openDatabase, SQLiteMaintenanceStore } from '../../packages/persistence/src/database.js';
import { SQLiteJobStore } from '../../packages/persistence/src/claims.js';
import { SQLiteStatusProjectionStore } from '../../packages/persistence/src/runtime-status.js';
import { SQLiteSessions } from '../../packages/persistence/src/sessions.js';
import { issueCredential } from '../../packages/platform/src/credentials.js';
import type {
  AccountBinding, ApprovedSourceConfig, EvidenceCellKey, EvidenceReceipt, ProtectedSourceIdentity, SourceId, SourceObservation,
} from '../../packages/domain/src/model.js';
import { createHarness } from '../../packages/test-support/src/harness.js';
import { buildStatusAssets } from '../../scripts/build/build.mjs';
import { ApplicationError } from '../../packages/application/src/policy.js';

const READ_AT = '2026-09-01T00:00:00.000Z';
const SCOPE_ID = '10000000-0000-4000-8000-000000000001';
const FINGERPRINTS = { moodle: 'A'.repeat(43), edstem: 'B'.repeat(43) } as const;
const PRIVATE = {
  moodleName: 'Synthetic Moodle Private Name', edName: 'Synthetic Ed Private Name',
  moodleEmail: 'moodle-private@synthetic.invalid', edEmail: 'ed-private@synthetic.invalid',
  moodleCourse: 'Synthetic Moodle Private Course', edCourse: 'Synthetic Ed Private Course',
};
const ORIGINS = { moodle: 'https://moodle.synthetic.invalid', edstem: 'https://synthetic.edstem.org' } as const;
const PRIVATE_SENTINELS = Object.values(PRIVATE);

function config(source: SourceId): ApprovedSourceConfig {
  return { id: randomUUID(), source, officialOrigin: ORIGINS[source], approvedScopeId: SCOPE_ID, confirmedAt: READ_AT };
}
function observation(source: SourceId): SourceObservation {
  return {
    source, auth: 'authenticated', capability: 'available', health: 'healthy', freshness: 'fresh', completeness: 'complete',
    outcome: 'present', checkedAt: READ_AT, resultCode: 'AUTHENTICATED', courseAccess: 'blocked',
    lastSuccess: { checkedAt: READ_AT, subjectFingerprint: FINGERPRINTS[source] },
  };
}
function identity(source: SourceId): ProtectedSourceIdentity {
  return {
    classification: 'protected_local', source, stableSubjectId: `synthetic-${source}-subject`, organizationId: 'synthetic-organization', tenantId: 'synthetic-tenant',
    displayName: source === 'moodle' ? PRIVATE.moodleName : PRIVATE.edName,
    schoolEmail: source === 'moodle' ? PRIVATE.moodleEmail : PRIVATE.edEmail,
    selectedCourseName: source === 'moodle' ? PRIVATE.moodleCourse : PRIVATE.edCourse,
  };
}
function binding(): AccountBinding {
  const evidence = (source: SourceId) => ({
    source, subjectFingerprint: FINGERPRINTS[source], organizationFingerprint: FINGERPRINTS[source], tenantFingerprint: FINGERPRINTS[source],
    approvedScopeId: SCOPE_ID, evidenceKind: 'stable_subject_organization_scope' as const,
  });
  return { status: 'candidate', moodle: evidence('moodle'), edstem: evidence('edstem'), basis: 'stable_subject_organization_scope', confirmedByActionReceiptId: null, courseAccess: 'blocked', checkedAt: READ_AT };
}
function cellKey(key: EvidenceCellKey): string { return `${key.platform}|${key.source}|${key.scenario}|${key.evidence}`; }

async function authUiFixture() {
  const harness = createHarness();
  const assets = join(harness.root, 'assets');
  await buildStatusAssets(join(process.cwd(), 'apps/status'), assets);
  const db = openDatabase(join(harness.root, 'auth-status.sqlite'));
  const installationId = randomUUID();
  const scope = { installationId, source: 'synthetic' as const, courseId: 'selftest' as const };
  const values = new Map<string, string>();
  const secrets: SecretStore = {
    async get(_installationId, name) { return values.get(name) ?? null; },
    async set(_installationId, name, value) { values.set(name, value); },
    async delete(_installationId, name) { values.delete(name); },
  };
  const credentials = [await issueCredential(secrets, installationId, 'cli', scope, 'local_cli')];
  const configs: Record<SourceId, ApprovedSourceConfig> = { moodle: config('moodle'), edstem: config('edstem') };
  const observations: Record<SourceId, SourceObservation> = { moodle: observation('moodle'), edstem: observation('edstem') };
  const identities: Record<SourceId, ProtectedSourceIdentity> = { moodle: identity('moodle'), edstem: identity('edstem') };
  let currentBinding = binding();
  const receipts = new Map<string, EvidenceReceipt[]>();
  let statusFailure: ApplicationError|null=null;
  let receiptFailure: ApplicationError|null=null;
  let mutationFailure: ApplicationError|null=null;
  const calls = { login: [] as unknown[], probe: [] as unknown[], binding: [] as unknown[], logout: [] as unknown[] };
  const auth = {
    sourceConfigs: { async read(source: SourceId) { if(statusFailure)throw statusFailure;return configs[source]; }, async confirm(value: ApprovedSourceConfig) { if(mutationFailure)throw mutationFailure;configs[value.source] = value; } },
    observations: { async read(source: SourceId) { return observations[source]; }, async write() { throw new Error('UNEXPECTED_WRITE'); } },
    bindings: { async read() { return currentBinding; }, async write(value: AccountBinding) { if(mutationFailure)throw mutationFailure;calls.binding.push(structuredClone(value));currentBinding = value; } },
    evidence: { async append() { throw new Error('NO_UI_EVIDENCE_WRITE'); }, async list(key: EvidenceCellKey) { if(receiptFailure)throw receiptFailure;return receipts.get(cellKey(key)) ?? []; } },
    authJobs: { async requestProbe(command: unknown) { if(mutationFailure)throw mutationFailure;calls.probe.push(structuredClone(command));return { jobId: randomUUID() }; }, async recordExplicitLogout(command: unknown) { if(mutationFailure)throw mutationFailure;calls.logout.push(structuredClone(command));return {} as never; }, async query() { return null; }, async cancel() { return {} as never; } },
    login: { async open(input: unknown) { if(mutationFailure)throw mutationFailure;calls.login.push(structuredClone(input)); } }, protectedIdentities: { async read(source: SourceId) { return identities[source]; } },
  };
  const build = { version: '0.1.0-beta.1', buildId: 'a'.repeat(64), commit: 'b'.repeat(40), tree: 'c'.repeat(40), dependencyHash: 'd'.repeat(64), protocol: 1 as const, schemaMin: 1 as const, schemaMax: 1 as const, capabilities: ['echo' as const] };
  const sessions = new SQLiteSessions(db, installationId);
  let requestLimitTime = 0;
  const api = await startApi({ host: '127.0.0.1', port: 0, installationId, build, secrets, credentials, jobs: new SQLiteJobStore(db), maintenance: new SQLiteMaintenanceStore(db), projections: new SQLiteStatusProjectionStore(db), sessions, shutdown: async () => {}, assetsRoot: assets, auth, requestLimitNow: () => requestLimitTime += 60_001 });
  async function approve(code: string) {
    return harness.fetch(`${api.origin}/api/pairing/${code}/approve`, { method: 'POST', headers: { authorization: `Bearer ${values.get('cli')}`, 'content-type': 'application/json' }, body: JSON.stringify({ confirmedCode: code }) });
  }
  return {
    api, build, calls, configs, observations, identities, receipts, sessions, approve,
    setBinding(value:AccountBinding){currentBinding=value;},
    failStatus(error:ApplicationError|null){statusFailure=error;},failReceipts(error:ApplicationError|null){receiptFailure=error;},failMutation(error:ApplicationError|null){mutationFailure=error;},
    async close() { await api.close(); db.close(); values.clear(); await harness.cleanup(); },
  };
}

async function pair(page: import('@playwright/test').Page, fixture: Awaited<ReturnType<typeof authUiFixture>>) {
  await page.goto(`${fixture.api.origin}/status`);
  await expect(page.locator('#pair-code')).toHaveText(/^[A-F0-9]{16}$/);
  const code = await page.locator('#pair-code').innerText();
  const approved = await fixture.approve(code);
  expect(approved.status, await approved.text()).toBe(200);
  await page.getByRole('button', { name: '刷新状态' }).click();
  await expect(page.getByRole('status')).toHaveText('本地状态已读取。');
}

test.describe('paired Phase 2 auth status UI', () => {
  test('paired auth layout keeps the public shell generic and orders all protected sections', async ({ page }) => {
    const fixture = await authUiFixture();
    try {
      await page.goto(`${fixture.api.origin}/status`);
      await expect(page.locator('#protected')).toBeEmpty();
      const publicText = await page.locator('body').innerText();
      for (const sentinel of [...PRIVATE_SENTINELS, ...Object.values(ORIGINS), fixture.build.version, 'A.login', 'receipt']) expect(publicText).not.toContain(sentinel);
      await pair(page, fixture);
      expect(await page.locator('h1').count()).toBe(1);
      expect((await page.locator('#protected h2').allTextContents()).slice(0, 8)).toEqual([
        '双来源认证门禁', '私人信息提示', '双来源状态', '账户绑定核对', '登录与来源检查', 'macOS live 检查点', '平台缺口', '版本与范围',
      ]);
      expect(await page.locator('.source-card h3').allTextContents()).toEqual(['Moodle', 'EdStem']);
    } finally { await fixture.close(); }
  });

  test('protected identity remains visible text after the privacy notice and nowhere else', async ({ page }) => {
    const fixture = await authUiFixture();
    try {
      await pair(page, fixture);
      await expect(page.getByText('以下账户和课程信息仅显示在这台设备的已配对页面中。请勿将完整姓名、邮箱、课程名、登录页面或验证码截图粘贴到聊天或公开记录。')).toBeVisible();
      for (const sentinel of PRIVATE_SENTINELS) await expect(page.locator('#protected')).toContainText(sentinel);
      const audit = await page.evaluate(sentinels => {
        const attributeText = [...document.querySelectorAll('*')].flatMap(element => [...element.attributes].map(attribute => attribute.value)).join('\n');
        return {
          attributeText, live: document.querySelector('[role="status"]')?.textContent ?? '',
          local: Object.keys(localStorage), session: Object.keys(sessionStorage),
          privacyBeforeIdentity: Boolean((document.querySelector('.privacy-notice')?.compareDocumentPosition(document.querySelector('.source-card')!) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING),
          cardLabels: [...document.querySelectorAll('.source-card')].map(card => [...card.querySelectorAll('dt')].map(item => item.textContent)),
        };
      }, PRIVATE_SENTINELS);
      expect(audit.privacyBeforeIdentity).toBe(true);
      expect(audit.cardLabels[0]).toEqual(audit.cardLabels[1]);
      expect(audit.cardLabels[0]).toEqual(['官方来源', 'auth', 'capability', 'health', 'freshness', 'completeness', '完整显示名', '完整学校邮箱', '共享专属 Profile', '最近检查时间 / 证据', '指定课程', '课程可见性', 'result code / next action']);
      for (const sentinel of PRIVATE_SENTINELS) { expect(audit.attributeText).not.toContain(sentinel); expect(audit.live).not.toContain(sentinel); }
      expect(audit.local).toEqual([]); expect(audit.session).toEqual([]);
    } finally { await fixture.close(); }
  });

  test('checkpoint ledger keeps every macOS scenario independent without creating live evidence', async ({ page }) => {
    const fixture = await authUiFixture();
    try {
      await pair(page, fixture);
      const ledger = page.locator('.checkpoint-ledger');
      for (const label of ['A 登录', 'A 绑定', 'A 课程可见性', 'B 重开 1', 'B 重开 2', 'B 重开 3', 'B Worker 重启', 'B Codex 退出', 'C 系统重启', 'D 跨日复查', 'reauth']) await expect(ledger).toContainText(label);
      expect(await ledger.locator('li').count()).toBe(22);
      await expect(ledger).toContainText('not_run / human_needed');
      await expect(ledger).toContainText('等待跨日复查');
      expect([...fixture.receipts.values()].flat()).toEqual([]);
    } finally { await fixture.close(); }
  });

  test('platform gaps never promote synthetic macOS UI state into Windows or Phase 3', async ({ page }) => {
    const fixture = await authUiFixture();
    try {
      await pair(page, fixture);
      await expect(page.locator('.platform-gaps')).toContainText('macOS');
      await expect(page.locator('.platform-gaps')).toContainText('Windows');
      await expect(page.locator('.platform-gaps')).toContainText('not_run / human_needed');
      await expect(page.locator('.platform-gaps')).toContainText('macOS 结果不能替代 Windows 验证；Phase 3 仍被阻塞。');
      await expect(page.locator('#protected')).not.toContainText('Phase 2 complete');
      await expect(page.locator('#protected')).not.toContainText('Phase 3 eligible');
    } finally { await fixture.close(); }
  });

  test('existing diagnostics remain visible beneath auth state', async ({ page }) => {
    const fixture = await authUiFixture();
    try {
      await pair(page, fixture);
      for (const heading of ['版本与范围', 'API 与 Worker', '版本身份与差异', '尚无自检记录', '最近一次安装或升级', '诊断详情']) await expect(page.getByText(heading, { exact: true })).toBeVisible();
      await expect(page.locator('#protected')).toContainText(fixture.build.version);
    } finally { await fixture.close(); }
  });

  test('auth actions use one exact primary CTA, paired CSRF and fixed bodies', async ({ page, context }) => {
    const fixture = await authUiFixture();
    try {
      fixture.observations.moodle = { ...fixture.observations.moodle, auth: 'unauthenticated', resultCode: 'AUTH_REQUIRED' };
      const requests: Array<{ path:string; body:unknown; csrf:string|null }> = [];
      page.on('request', request => { if(request.url().includes('/api/auth/') && request.method()==='POST')requests.push({path:new URL(request.url()).pathname,body:request.postDataJSON(),csrf:request.headers()['x-autoed-csrf']??null}); });
      await pair(page, fixture);
      await expect(page.locator('button.primary-action')).toHaveCount(1);
      await page.getByRole('button',{name:'打开 Moodle 官方登录窗口'}).dblclick();
      await expect(page.getByRole('button',{name:'我已完成 Moodle 登录'})).toBeVisible();
      expect(requests.filter(request=>request.path==='/api/auth/login/open')).toEqual([{path:'/api/auth/login/open',body:{source:'moodle',approvedConfigId:fixture.configs.moodle.id},csrf:expect.stringMatching(/^[A-Za-z0-9_-]{43}$/)}]);
      expect((await context.cookies()).some(cookie=>cookie.name==='autoed_session'&&cookie.httpOnly)).toBe(true);
      await page.getByRole('button',{name:'我已完成 Moodle 登录'}).click();
      await expect(page.locator('.overall-gate .gate-result')).toBeFocused();
      const probe=requests.find(request=>request.path==='/api/auth/probe');
      expect(probe).toMatchObject({path:'/api/auth/probe',body:{source:'moodle',approvedConfigId:fixture.configs.moodle.id,approvedScopeId:SCOPE_ID,trigger:'user_login_completed',actionReceiptId:expect.stringMatching(/^[0-9a-f-]{36}$/),idempotencyKey:expect.stringMatching(/^ui-/)},csrf:expect.stringMatching(/^[A-Za-z0-9_-]{43}$/)});
      expect(fixture.calls.login).toHaveLength(1);expect(fixture.calls.probe).toHaveLength(1);
      expect(await page.getByRole('status').innerText()).not.toMatch(/Synthetic|@|moodle\.synthetic/);
    } finally { await fixture.close(); }
  });

  test('auth actions confirm only the projected opaque binding candidate', async ({ page }) => {
    const fixture=await authUiFixture();
    try{
      const requests:Array<{path:string;body:unknown;csrf:string|null}>=[];
      page.on('request',request=>{if(request.url().includes('/api/auth/')&&request.method()==='POST')requests.push({path:new URL(request.url()).pathname,body:request.postDataJSON(),csrf:request.headers()['x-autoed-csrf']??null});});
      await pair(page,fixture);const primary=page.locator('button.primary-action');await expect(primary).toHaveText('确认两个账户对应');
      expect(await primary.evaluate(element=>getComputedStyle(element).backgroundColor)).toBe('rgb(29, 78, 216)');
      await primary.dblclick();await expect.poll(()=>fixture.calls.binding.length).toBe(1);
      const request=requests.find(item=>item.path==='/api/auth/binding/confirm');
      expect(request).toMatchObject({path:'/api/auth/binding/confirm',body:{candidateBindingId:expect.stringMatching(/^[0-9a-f-]{36}$/),decision:'confirm'},csrf:expect.stringMatching(/^[A-Za-z0-9_-]{43}$/)});
      expect(Object.keys(request!.body as object).sort()).toEqual(['candidateBindingId','decision']);
      await expect(page.locator('.overall-gate .gate-result')).toBeFocused();
      expect(await page.locator('.primary-action').count()).toBe(1);
    }finally{await fixture.close();}
  });

  test('receipt copy uses an explicit redacted allowlist', async ({ page, context }) => {
    const fixture=await authUiFixture();
    try{
      fixture.receipts.set(cellKey({platform:'macos',source:'moodle',scenario:'a.login',evidence:'L'}),[{receiptId:randomUUID(),buildId:fixture.build.buildId,version:fixture.build.version,platform:'macos',source:'moodle',scenario:'a.login',evidence:'L',status:'human_needed',resultCode:'NOT_RUN',bindingConsistency:'not_observed',gaps:['LIVE_NOT_RUN'],checkedAt:READ_AT,provenance:{kind:'human_action',actionReceiptId:randomUUID()},schoolEmail:PRIVATE.moodleEmail} as EvidenceReceipt]);
      await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:fixture.api.origin});await pair(page,fixture);
      await page.getByRole('button',{name:'复制脱敏结果单'}).click();const copied=await page.evaluate(()=>navigator.clipboard.readText());
      expect(copied).toContain('"scenario":"a.login"');expect(copied).not.toContain(PRIVATE.moodleEmail);expect(copied).not.toContain('schoolEmail');expect(copied).not.toContain('actionReceiptId');
      for(const sentinel of PRIVATE_SENTINELS)expect(copied).not.toContain(sentinel);
    }finally{await fixture.close();}
  });

  test('server issued intent is memory-only, one-time and cleared on reload', async ({ page }) => {
    const fixture = await authUiFixture();
    try {
      fixture.observations.moodle = { ...fixture.observations.moodle, auth: 'unauthenticated', resultCode: 'AUTH_REQUIRED' };
      await pair(page, fixture);await page.getByRole('button',{name:'打开 Moodle 官方登录窗口'}).click();
      await expect.poll(()=>fixture.calls.login.length).toBe(1);
      const issued=(fixture.calls.login[0] as {actionReceiptId:string}).actionReceiptId;
      expect(issued).toMatch(/^[0-9a-f-]{36}$/);
      const beforeReload=await page.evaluate(value=>({body:document.body.innerText,attributes:[...document.querySelectorAll('*')].flatMap(element=>[...element.attributes].map(attribute=>attribute.value)).join('\n'),url:location.href}),issued);
      expect(JSON.stringify(beforeReload)).not.toContain(issued);
      await page.reload();await expect(page.getByRole('button',{name:'打开 Moodle 官方登录窗口'})).toBeVisible();
      expect(await page.evaluate(()=>({local:Object.keys(localStorage),session:Object.keys(sessionStorage)}))).toEqual({local:[],session:[]});
      expect(await page.locator('body').innerText()).not.toContain(issued);
    } finally { await fixture.close(); }
  });

  test('protected purge clears identity and action state on auth, receipt and mutation denial', async ({ page }) => {
    for(const surface of ['status','receipts','mutation'] as const){
      const fixture=await authUiFixture();
      try{
        if(surface==='mutation')fixture.observations.moodle={...fixture.observations.moodle,auth:'unauthenticated',resultCode:'AUTH_REQUIRED'};
        await pair(page,fixture);
        if(surface==='status'){fixture.failStatus(new ApplicationError('UNAUTHORIZED',401));await page.getByRole('button',{name:'刷新状态'}).click();}
        else if(surface==='receipts'){fixture.failReceipts(new ApplicationError('FORBIDDEN',403));await page.getByRole('button',{name:'刷新状态'}).click();}
        else{fixture.failMutation(new ApplicationError('FORBIDDEN',403));await page.getByRole('button',{name:'打开 Moodle 官方登录窗口'}).click();}
        await expect(page.locator('#protected')).toBeEmpty();await expect(page.getByRole('heading',{name:'此页面尚未获得本地访问权限'})).toBeVisible();
        for(const sentinel of PRIVATE_SENTINELS)expect(await page.locator('body').innerText()).not.toContain(sentinel);
      }finally{await fixture.close();}
    }
  });

  test('stale snapshot preserves read time, labels every protected group and disables mutation', async ({ page, context }) => {
    const fixture=await authUiFixture();
    try{
      await pair(page,fixture);const readTime=(await page.locator('.overall-gate dd').nth(0).textContent())??'';
      await context.setOffline(true);await page.getByRole('button',{name:'刷新状态'}).click();
      await expect(page.getByRole('status')).toContainText('以下为上次读取结果');
      await expect(page.locator('#protected')).toContainText(PRIVATE.moodleName);
      expect(await page.locator('#protected section .stale-notice').count()).toBeGreaterThanOrEqual(8);
      expect(await page.locator('#protected button:not(:disabled)').count()).toBe(0);
      await context.setOffline(false);await expect(page.getByRole('button',{name:'刷新状态'})).toBeEnabled();await page.getByRole('button',{name:'刷新状态'}).click();
      await expect(page.locator('.stale-notice')).toHaveCount(0);expect(readTime).not.toBe('');
    }finally{await fixture.close();}
  });

  test('auth accessibility and auth responsive layout preserve keyboard focus and approved dimensions', async ({ page }) => {
    const fixture=await authUiFixture();
    try{
      await page.setViewportSize({width:1280,height:900});await pair(page,fixture);
      const desktop=await page.locator('.source-card').evaluateAll(cards=>cards.map(card=>card.getBoundingClientRect().width));expect(Math.abs(desktop[0]!-desktop[1]!)).toBeLessThan(1);
      for(const width of [759,599]){await page.setViewportSize({width,height:900});const columns=await page.locator('.source-grid').evaluate(element=>getComputedStyle(element).gridTemplateColumns.split(' ').length);expect(columns).toBe(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);}
      const controls=await page.locator('button,summary').evaluateAll(elements=>elements.map(element=>({height:element.getBoundingClientRect().height,outline:getComputedStyle(element).outlineWidth,offset:getComputedStyle(element).outlineOffset})));expect(controls.every(control=>control.height>=48)).toBe(true);
      await page.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();});await page.keyboard.press('Tab');
      expect(await page.locator(':focus').evaluate(element=>({outline:getComputedStyle(element).outlineWidth,offset:getComputedStyle(element).outlineOffset}))).toEqual({outline:'2px',offset:'4px'});
      expect(await page.locator('input,textarea,select,iframe,[type=file],[type=password]').count()).toBe(0);
    }finally{await fixture.close();}
  });
});
