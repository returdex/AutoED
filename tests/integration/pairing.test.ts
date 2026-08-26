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
import { startApi } from '../../apps/api/src/main.js';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const fn of cleanup.splice(0).reverse()) await fn(); });
async function fixture() {
  const h = createHarness(); cleanup.push(() => h.cleanup()); const db = openDatabase(join(h.root, 'pair.sqlite')); cleanup.push(async () => { db.close(); });
  const scope = { installationId: randomUUID(), source: 'synthetic' as const, courseId: 'selftest' as const }; let now = Date.now();
  const values = new Map<string,string>(); const secrets: SecretStore = { async get(_id,n) { return values.get(n) ?? null; }, async set(_id,n,v) { values.set(n,v); }, async delete(_id,n) { values.delete(n); } };
  const credentials = [await issueCredential(secrets, scope.installationId, 'cli', scope, 'local_cli'), await issueCredential(secrets, scope.installationId, 'mcp', scope, 'model')];
  const build = { version: '0.1.0-beta.1', buildId:'a'.repeat(64), commit:'b'.repeat(40), tree:'c'.repeat(40), dependencyHash:'d'.repeat(64), protocol:1 as const, schemaMin:1 as const, schemaMax:1 as const, capabilities:['echo'] };
  const sessions = new SQLiteSessions(db, scope.installationId, { now: () => now });
  const options = { host:'127.0.0.1', port:0, installationId:scope.installationId, build, secrets, credentials, sessions, jobs:new SQLiteJobStore(db), maintenance:new SQLiteMaintenanceStore(db), projections:new SQLiteStatusProjectionStore(db), shutdown:async () => {} };
  let api = await startApi(options); cleanup.push(() => api.close());
  const cookies = (r: Response) => r.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  async function call(path: string, body?: unknown, headers: Record<string,string> = {}) {
    return h.fetch(api.origin + path, { method: body === undefined ? 'GET' : 'POST', headers: { origin:api.origin, ...(body === undefined ? {} : { 'content-type':'application/json' }), ...headers }, ...(body === undefined ? {} : { body:JSON.stringify(body) }) });
  }
  async function pending() {
    const r = await call('/api/pairing/nonce'); expect(r.status).toBe(200); const { nonce } = await r.json();
    const p = await call('/api/pairing/pending', { nonce }, { cookie:cookies(r), 'x-autoed-csrf':nonce }); expect(p.status).toBe(200);
    return { cookie:cookies(p), nonce, ...(await p.json()) };
  }
  async function approve(code: string, name = 'cli', confirmedCode = code) {
    return h.fetch(api.origin + `/api/pairing/${code}/approve`, { method:'POST', headers:{ authorization:`Bearer ${values.get(name)}`, 'content-type':'application/json' }, body:JSON.stringify({ confirmedCode }) });
  }
  async function exchange(p: { cookie:string; nonce:string }) { return call('/api/pairing/exchange', {}, { cookie:p.cookie, 'x-autoed-csrf':p.nonce }); }
  return { call, pending, approve, exchange, cookies, sessions, options, scope, raw:(path:string, headers:Record<string,string>) => h.fetch(api.origin+path,{headers}), advance:(ms:number) => { now += ms; }, restart:async () => { await api.close(); api = await startApi({ ...options, sessions:new SQLiteSessions(db, scope.installationId, { now:() => now }) }); }, origin:() => api.origin };
}
describe('explicit same-origin pairing over actual HTTP', () => {
  it('browser reads only the currently projected selfcheck job and cannot mutate it',async()=>{
    const f=await fixture();const jobs=[];
    for(let i=0;i<2;i++)jobs.push(await f.options.jobs.enqueue({kind:'echo',value:'synthetic',idempotencyKey:randomUUID(),scope:f.scope},{expectedGeneration:0}));
    const job=jobs[0]!;await f.options.projections.writeSelfcheck({jobId:job.id,probes:[],featureResult:'not_observed',checkedAt:new Date().toISOString()},{operationId:null,expectedGeneration:0});
    expect((await f.call('/api/jobs/'+job.id)).status).toBe(401);
    const p=await f.pending();await f.approve(p.code);const r=await f.exchange(p);const cookie=f.cookies(r);const {csrf}=await r.json();
    expect((await f.call('/api/jobs/'+job.id,undefined,{cookie})).status).toBe(200);
    expect((await f.call('/api/jobs/'+jobs[1]!.id,undefined,{cookie})).status).toBe(403);
    expect((await f.call('/api/jobs/'+job.id+'/cancel',{}, {cookie,'x-autoed-csrf':csrf})).status).toBe(403);
    expect((await f.call('/api/jobs',job.request,{cookie,'x-autoed-csrf':csrf})).status).toBe(403);
  });
  it('supports actual browser same-origin GET metadata without requiring a forbidden Origin header', async () => {
    const f=await fixture();
    expect((await f.raw('/api/pairing/nonce',{})).status).toBe(403);
    expect((await f.raw('/api/pairing/nonce',{'sec-fetch-site':'cross-site',referer:'http://evil.invalid/'})).status).toBe(403);
    expect((await f.raw('/api/pairing/nonce',{'sec-fetch-site':'same-origin',referer:f.origin()+'/status'})).status).toBe(200);
  });
  it('public shell discloses no identity; pending and correlation code cannot authenticate', async () => {
    const f = await fixture(); const shell = await f.call('/status'); expect(shell.status).toBe(200); expect(await shell.text()).not.toContain('beta.1');
    expect(shell.headers.get('content-security-policy')).toBe("default-src 'self'; frame-ancestors 'none'; object-src 'none'"); expect(shell.headers.get('cache-control')).toBe('no-store');
    const p = await f.pending(); expect((await f.call('/api/status', undefined, { cookie:p.cookie })).status).toBe(401);
    expect((await f.exchange(p)).status).toBe(403); expect((await f.call('/api/status', undefined, { authorization:`Bearer ${p.code}` })).status).toBe(401);
  });
  it('only explicit CLI confirmed-code approval enables single fresh read-only session exchange', async () => {
    const f = await fixture(); const p = await f.pending();
    expect((await f.approve(p.code, 'mcp')).status).toBe(403); expect((await f.approve(p.code, 'cli', 'WRONGCODE')).status).toBe(403);
    expect((await f.approve(p.code)).status).toBe(200); const exchanged = await f.exchange(p); expect(exchanged.status).toBe(200);
    const cookie = f.cookies(exchanged); const { csrf } = await exchanged.json(); expect(cookie).not.toContain(p.cookie);
    const header = exchanged.headers.getSetCookie().find(v => v.startsWith('autoed_session='))!; expect(header).toContain('HttpOnly'); expect(header).toContain('SameSite=Strict'); expect(header).toContain('Path=/'); expect(header).not.toContain('Domain='); expect(header).not.toContain('Secure');
    expect((await f.call('/api/status', undefined, { cookie })).status).toBe(200);
    expect((await f.call('/api/control/shutdown', {}, { cookie, 'x-autoed-csrf':csrf })).status).toBe(403);
    expect((await f.call('/api/jobs', { kind:'echo', value:'x', idempotencyKey:randomUUID(), scope:{ installationId:randomUUID(), source:'synthetic', courseId:'selftest' } }, { cookie, 'x-autoed-csrf':csrf })).status).toBe(403);
    expect((await f.exchange(p)).status).toBe(403); expect((await f.approve(p.code)).status).toBe(403);
  });
  it('rejects cross-origin, missing CSRF, nonce replay and stolen correlation code without matching cookie', async () => {
    const f = await fixture(); expect((await f.call('/api/pairing/nonce', undefined, { origin:'http://evil.invalid' })).status).toBe(403);
    const n = await f.call('/api/pairing/nonce'); const { nonce } = await n.json(); const cookie = f.cookies(n);
    expect((await f.call('/api/pairing/pending', { nonce }, { cookie })).status).toBe(403);
    const first = await f.call('/api/pairing/pending', { nonce }, { cookie, 'x-autoed-csrf':nonce }); expect(first.status).toBe(200);
    expect((await f.call('/api/pairing/pending', { nonce }, { cookie, 'x-autoed-csrf':nonce })).status).toBe(403);
    const code = (await first.json()).code; await f.approve(code);
    expect((await f.call('/api/pairing/exchange', {}, { cookie:'autoed_pending=attacker', 'x-autoed-csrf':nonce })).status).toBe(403);
    expect((await f.call('/api/pairing/exchange', {}, { cookie:f.cookies(first) })).status).toBe(403);
  });
  it('expires pending at five minutes and caps five pending per installation', async () => {
    const f = await fixture(); const first = await f.pending();
    for (let i=0;i<4;i++) await f.pending();
    expect((await f.call('/api/pairing/nonce')).status).toBe(429);
    f.advance(60001); const n = await f.call('/api/pairing/nonce'); expect(n.status).toBe(200); const { nonce } = await n.json();
    expect((await f.call('/api/pairing/pending', { nonce }, { cookie:f.cookies(n), 'x-autoed-csrf':nonce })).status).toBe(429);
    f.advance(240000); expect((await f.approve(first.code)).status).toBe(403);
  });
  it('revokes sessions explicitly, on eight-hour expiry, and on service restart', async () => {
    const f = await fixture(); const p = await f.pending(); await f.approve(p.code); const r = await f.exchange(p); const cookie=f.cookies(r); const { csrf }=await r.json();
    expect((await f.call('/api/pairing/revoke', {}, { cookie })).status).toBe(403);
    expect((await f.call('/api/pairing/revoke', {}, { cookie, 'x-autoed-csrf':csrf })).status).toBe(200);
    expect((await f.call('/api/status', undefined, { cookie })).status).toBe(401);
    const p2=await f.pending(); await f.approve(p2.code); const r2=await f.exchange(p2); const cookie2=f.cookies(r2);
    f.advance(8*60*60*1000); expect((await f.call('/api/status', undefined, { cookie:cookie2 })).status).toBe(401);
    const p3=await f.pending(); await f.approve(p3.code); const r3=await f.exchange(p3); const cookie3=f.cookies(r3);
    await f.restart(); expect((await f.call('/api/status', undefined, { cookie:cookie3 })).status).toBe(401); expect((await f.exchange(p3)).status).toBe(403);
  });
  it('allows exactly one concurrent exchange and cannot fix a session with a caller cookie', async () => {
    const f=await fixture(); const p=await f.pending(); await f.approve(p.code);
    const responses=await Promise.all([f.exchange(p),f.exchange(p)]); expect(responses.map(r=>r.status).sort()).toEqual([200,403]);
    const cookie=f.cookies(responses.find(r=>r.status===200)!);
    expect((await f.call('/api/status',undefined,{cookie:'autoed_session='+p.cookie.split('=')[1]})).status).toBe(401);
    expect((await f.call('/api/status',undefined,{cookie,origin:'http://127.0.0.1:1'})).status).toBe(403);
    expect((await f.call('/api/status',undefined,{cookie})).status).toBe(200);
  });
});
