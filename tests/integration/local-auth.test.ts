import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createHarness } from '../../packages/test-support/src/harness.js';
import { openDatabase, SQLiteMaintenanceStore } from '../../packages/persistence/src/database.js';
import { SQLiteJobStore } from '../../packages/persistence/src/claims.js';
import { SQLiteStatusProjectionStore } from '../../packages/persistence/src/runtime-status.js';
import { SQLiteSessions } from '../../packages/persistence/src/sessions.js';
import { issueCredential, revokeCredential } from '../../packages/platform/src/credentials.js';
import type { CredentialRecord } from '../../packages/platform/src/credentials.js';
import type { SecretStore } from '../../packages/application/src/ports.js';
import { startApi } from '../../apps/api/src/main.js';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
export const build = { version: '0.1.0-beta.1', buildId: 'a'.repeat(64), commit: 'b'.repeat(40), tree: 'c'.repeat(40), dependencyHash: 'd'.repeat(64), protocol: 1 as const, schemaMin: 1 as const, schemaMax: 1 as const, capabilities: ['echo', 'digest'] };
async function fixture() {
  const h = createHarness(); cleanups.push(() => h.cleanup());
  const db = openDatabase(join(h.root, 'api.sqlite')); cleanups.push(async () => { db.close(); });
  const scope = { installationId: randomUUID(), source: 'synthetic' as const, courseId: 'selftest' as const };
  const values = new Map<string, string>();
  const secrets: SecretStore = { async get(_id, name) { return values.get(name) ?? null; }, async set(_id, name, value) { values.set(name, value); }, async delete(_id, name) { values.delete(name); } };
  const records: CredentialRecord[] = [];
  for (const [name, dest] of [['cli', 'local_cli'], ['mcp', 'model'], ['installer', 'installer'], ['api', 'service']] as const) records.push(await issueCredential(secrets, scope.installationId, name, scope, dest));
  const jobs = new SQLiteJobStore(db); const maintenance = new SQLiteMaintenanceStore(db); const projections = new SQLiteStatusProjectionStore(db);
  let shutdowns = 0; let onShutdown = async () => {};
  const options = { host: '127.0.0.1', port: 0, installationId: scope.installationId, build, secrets, credentials: records, jobs, maintenance, projections, sessions: new SQLiteSessions(db, scope.installationId), shutdown: async () => { shutdowns++; await onShutdown(); } };
  const api = await startApi(options); cleanups.push(() => api.close());
  async function call(path: string, name: string | null = 'cli', body?: unknown, headers: Record<string, string> = {}, method?: string) {
    return h.fetch(api.origin + path, { method: method ?? (body === undefined ? 'GET' : 'POST'), headers: { ...(name ? { authorization: `Bearer ${values.get(name)}` } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers }, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
  }
  const request = () => ({ kind: 'echo' as const, value: 'synthetic only', idempotencyKey: randomUUID(), scope });
  return { api, options, h, db, scope, records, values, secrets, jobs, maintenance, projections, call, request, shutdowns: () => shutdowns, setShutdown: (fn: () => Promise<void>) => { onShutdown = fn; } };
}
describe('authenticated actual loopback HTTP', () => {
  it('finishes shutdown acceptance before awaiting listener close, avoiding a request-close deadlock', async () => {
    const f = await fixture(); let resolveClosed!: () => void;
    const closed = new Promise<void>(resolve => { resolveClosed=resolve; });
    f.setShutdown(async () => { await f.api.close(); resolveClosed(); });
    const response = await f.call('/api/control/shutdown', 'cli', {}); expect(response.status).toBe(200);
    await closed; await expect(f.call('/api/status')).rejects.toThrow();
  });
  it('enqueues and queries through SQLite, observes API separately from absent worker', async () => {
    const f = await fixture(); const response = await f.call('/api/jobs', 'cli', f.request()); expect(response.status).toBe(200);
    const job = await response.json(); expect(job.state).toBe('queued');
    expect((await (await f.call(`/api/jobs/${job.id}`)).json()).id).toBe(job.id);
    expect(await f.jobs.query(job.id, f.scope)).not.toBeNull();
    const status = await (await f.call('/api/status')).json(); expect(status.api.build).toEqual(build); expect(status.worker).toBeNull(); expect(status.api.checkedAt).not.toBeNull();
  });
  it('rejects nonloopback binding and exact Host/Origin mismatches without disclosure', async () => {
    const f = await fixture(); await expect(startApi({ ...f.options, host: '0.0.0.0' })).rejects.toThrow('INVALID_BIND');
    const wrongHost = await new Promise<number>(resolve => { const req = httpRequest(f.api.origin + '/api/status', { headers: { host: 'localhost:9999', authorization: `Bearer ${f.values.get('cli')}` } }, res => { res.resume(); resolve(res.statusCode!); }); req.end(); });
    expect(wrongHost).toBe(403);
    for (const headers of [{ origin: 'http://evil.invalid' }, { origin: 'null' }]) {
      const r = await f.call('/api/status', 'cli', undefined, headers); expect(r.status).toBe(403); expect(await r.text()).not.toContain(build.version);
    }
    const noauth = await f.call('/api/status', null); expect(noauth.status).toBe(401); expect(Object.keys(await noauth.json()).sort()).toEqual(['code', 'nextAction', 'stage']);
  });
  it('isolates scope, rejects arbitrary URLs, malformed/oversize input and forged selfcheck fields', async () => {
    const f = await fixture();
    for (const body of [{ ...f.request(), scope: { ...f.scope, installationId: randomUUID() } }, { ...f.request(), url: 'https://school.invalid' }, { ...f.request(), selfcheck: { operationId: randomUUID(), generation: 0 } }, '{bad json', { ...f.request(), value: 'x'.repeat(17000) }]) {
      const r = await f.call('/api/jobs', 'cli', body); expect(r.status).toBeGreaterThanOrEqual(400); expect(await r.text()).not.toContain('school.invalid');
    }
    expect(f.db.prepare('SELECT count(*) AS n FROM jobs').get()).toEqual({ n: 0 });
  });
  it('requires CSRF for browser mutations and grants independent role permissions', async () => {
    const f = await fixture(); const origin = f.api.origin;
    expect((await f.call('/api/jobs', 'cli', f.request(), { origin })).status).toBe(403);
    const csrf = createHash('sha256').update(f.values.get('cli')!).digest('hex');
    expect((await f.call('/api/jobs', 'cli', f.request(), { origin, 'x-autoed-csrf': csrf })).status).toBe(200);
    expect((await f.call('/api/control/shutdown', 'mcp', {})).status).toBe(403);
    expect((await f.call('/api/jobs', 'api', f.request())).status).toBe(403);
    expect((await f.call('/api/control/shutdown', 'cli', {})).status).toBe(200); expect(f.shutdowns()).toBe(1);
  });
  it('revokes credential immediately and rate limits unauthenticated attempts without proxy bypass', async () => {
    const f = await fixture(); await revokeCredential(f.secrets, f.records[0]!);
    expect((await f.call('/api/status')).status).toBe(401);
    for (let i = 0; i < 29; i++) expect((await f.call('/api/status', null, undefined, { 'x-forwarded-for': `10.0.0.${i}` })).status).toBe(401);
    expect((await f.call('/api/status', null)).status).toBe(429);
  });
  it('enforces cap atomically in SQLite including multiple connections and idempotent retry', async () => {
    const f = await fixture(); const first = f.request(); await f.jobs.enqueue(first, { expectedGeneration: 0 });
    for (let i = 1; i < 999; i++) await f.jobs.enqueue(f.request(), { expectedGeneration: 0 });
    const source = new URL('../../packages/persistence/src/', import.meta.url).href;
    const outputs = [join(f.h.root, 'cap-one'), join(f.h.root, 'cap-two')];
    const children = outputs.map(output => f.h.spawn(['--experimental-transform-types', '--input-type=module', '-e', `
      import {registerHooks} from 'node:module'; import {writeFileSync} from 'node:fs';
      registerHooks({resolve(s,c,n){try{return n(s,c)}catch(e){if(s.endsWith('.js'))return n(s.slice(0,-3)+'.ts',c);throw e}}});
      const {openDatabase}=await import(${JSON.stringify(source + 'database.ts')});
      const {JobRepository}=await import(${JSON.stringify(source + 'jobs.ts')});
      const db=openDatabase(${JSON.stringify(join(f.h.root, 'api.sqlite'))});
      try{await new JobRepository(db).enqueue(${JSON.stringify(f.request())},{expectedGeneration:0});writeFileSync(${JSON.stringify(output)},'accepted')}
      catch(e){writeFileSync(${JSON.stringify(output)},e.code)}finally{db.close()}
    `]));
      expect((await Promise.all(children.map(child => once(child, 'exit')))).map(([code]) => code)).toEqual([0, 0]);
      expect(outputs.map(output => readFileSync(output, 'utf8')).sort()).toEqual(['QUEUE_FULL', 'accepted']);
      expect(f.db.prepare("SELECT count(*) AS n FROM jobs WHERE state='queued'").get()).toEqual({ n: 1000 });
      expect((await f.call('/api/jobs', 'cli', f.request())).status).toBe(429);
      expect((await f.call('/api/jobs', 'cli', first)).status).toBe(200);
  });
  it('fences maintenance writes and accepts only short credential operation/generation bound selfchecks', async () => {
    const f = await fixture(); const job = await (await f.call('/api/jobs', 'cli', f.request())).json(); const operationId = randomUUID();
    const enter = { action: 'enter', operationId, expectedGeneration: 0, leaseUntil: Date.now() + 60000 };
    expect((await f.call('/api/control/maintenance', 'cli', enter)).status).toBe(403);
    expect((await f.call('/api/control/maintenance', 'installer', enter)).status).toBe(200);
    expect((await f.call('/api/control/maintenance', 'installer', { action: 'exclusive', operationId, expectedGeneration: 0 })).status).toBe(200);
    expect((await f.call('/api/jobs', 'cli', f.request())).status).toBe(409);
    expect((await f.call(`/api/jobs/${job.id}/cancel`, 'cli', {})).status).toBe(409);
    const name = `selfcheck-${operationId}`;
    f.records.push(await issueCredential(f.secrets, f.scope.installationId, name, f.scope, 'selfcheck', { operationId, generation: 0, expiresAt: Date.now() + 60000 }));
    const check = await f.call('/api/jobs', name, f.request()); expect(check.status).toBe(200); expect((await check.json()).operationId).toBe(operationId);
    const selfcheckRecord = f.records.at(-1)!; const expiry = selfcheckRecord.expiresAt!; selfcheckRecord.expiresAt = Date.now()-1;
    expect((await f.call('/api/jobs', name, f.request())).status).toBe(401); selfcheckRecord.expiresAt = expiry;
    expect((await f.call('/api/control/maintenance', name, { action: 'exit', operationId, expectedGeneration: 0 })).status).toBe(403);
    expect((await f.call('/api/control/maintenance', 'installer', { action: 'exit', operationId, expectedGeneration: 0 })).status).toBe(200);
    expect((await f.call('/api/jobs', name, f.request())).status).toBe(401);
  });
  it('reads durable worker/install projections; only current installer operation may write them', async () => {
    const f = await fixture(); const operationId = randomUUID();
    await f.projections.writeComponent({ role: 'worker', build, checkedAt: new Date(Date.now() - 60000).toISOString(), health: 'error', evidence: 'process_report' }, { expectedGeneration: 0, operationId: null });
    const input = { kind: 'install', expectedGeneration: 0, operationId, value: { operationId, stage: 'stopped', result: 'failed', cleanup: 'cleanup_pending', targetBuild: build, actualBuild: null, checkedAt: new Date().toISOString() } };
    expect((await f.call('/api/control/status-projection', 'cli', input)).status).toBe(403);
    expect((await f.call('/api/control/status-projection', 'installer', input)).status).toBe(409);
    await f.maintenance.enterMaintenance({ operationId, owner: 'installer', leaseUntil: Date.now() + 60000, expectedGeneration: 0 });
    expect((await f.call('/api/control/status-projection', 'installer', input)).status).toBe(200);
    const status = await (await f.call('/api/status')).json(); expect(status.worker.health).toBe('error'); expect(status.worker.freshness).toBe('stale'); expect(status.install.cleanup).toBe('cleanup_pending');
  });
  it('redacts paths and credentials from model job text and exception details', async () => {
    const f = await fixture(); const r = await f.call('/api/jobs', 'mcp', { ...f.request(), value: `/Users/synthetic/private/Profile token=${f.values.get('mcp')}` });
    expect(r.status).toBe(200); const text = await r.text(); expect(text).not.toContain('/Users/'); expect(text).not.toContain(f.values.get('mcp'));
    const prior = await f.jobs.enqueue(f.request(), { expectedGeneration:0 });
    f.db.prepare('UPDATE jobs SET result=?,checkpoint=?,error_code=? WHERE id=?').run('/opt/private/result', f.values.get('cli'), 'token=synthetic-sensitive', prior.id);
    const historic = await (await f.call(`/api/jobs/${prior.id}`, 'mcp')).text(); expect(historic).not.toContain('/opt/private'); expect(historic).not.toContain(f.values.get('cli')); expect(historic).not.toContain('synthetic-sensitive');
    f.projections.read = async () => { throw new Error(`private ${f.h.root} ${f.values.get('cli')}`); };
    const failure = await f.call('/api/status'); expect(failure.status).toBe(500); expect(await failure.text()).toBe('{"code":"INTERNAL_ERROR","stage":"api","nextAction":"retry_or_check_local_service"}');
  });
});
