# Phase 2: 双来源原生登录 POC 与 live 硬门禁 - Pattern Map

**Mapped:** 2026-09-01
**Files analyzed:** 28 original anticipated files plus the exhaustive Plans 35–41 revision surface
**Analogs found:** 24 / 28 in the original map; every revision-surface file is classified below as an exact/role analog or explicit research-contract-first/no-analog case

This map treats the file list below as the implementation surface implied by `02-CONTEXT.md` and `02-RESEARCH.md`. The planner may co-locate a narrowly scoped implementation, but it must preserve the listed layer boundaries and evidence semantics. In particular, a synthetic fixture is never a live BrowserProvider or live login result.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/domain/src/model.ts` | model | event-driven state | itself, lines 10-25, 65-84 | exact modification |
| `packages/contracts/src/index.ts` | config/validation | transform | itself, lines 12-33, 41-64 | exact modification |
| `packages/contracts/src/presentation.ts` | utility/presentation | transform | itself, lines 15-46 | exact modification |
| `packages/application/src/ports.ts` | provider/ports | request-response | itself, lines 7-52 | exact modification |
| `packages/application/src/auth.ts` | service | event-driven + request-response | `packages/application/src/policy.ts`, lines 36-110 | role/data-flow match |
| `packages/application/src/policy.ts` | middleware/service | request-response + transform | itself, lines 9-38, 40-110 | exact modification |
| `packages/persistence/src/database.ts` | migration/config | CRUD | itself, lines 13-48, 65-103 | exact modification |
| `packages/persistence/src/auth.ts` | store | CRUD | `packages/persistence/src/sessions.ts`, lines 35-86 | role-match |
| `packages/platform/src/paths.ts` | utility/config | file-I/O | itself, lines 8-16, 79-96 | exact modification |
| `packages/platform/src/profile.ts` | provider | file-I/O + event-driven | `packages/platform/src/processes.ts`, lines 38-84, 146-211 | strong role/data-flow match |
| `packages/platform/src/browser.ts` | provider | event-driven + request-response | none (real browser provider does not exist) | no analog |
| `packages/platform/src/source-adapters.ts` | provider | request-response + transform | none (no Moodle/EdStem connector exists) | no analog |
| `apps/api/src/security.ts` | middleware | request-response | itself, lines 12-33 | exact modification |
| `apps/api/src/main.ts` | controller/route | request-response | itself, lines 45-108 | exact modification |
| `apps/worker/src/main.ts` | service | event-driven + batch | `packages/application/src/job-runner.ts`, lines 16-53 | strong match |
| `apps/status/index.html` | component | request-response | itself / `apps/status/src/main.ts`, lines 19-44 | exact modification |
| `apps/status/src/main.ts` | component | request-response + transform | itself, lines 19-69 | exact modification |
| `apps/status/styles.css` | component | transform | itself | exact modification |
| `playwright.config.ts` | config | request-response | itself, lines 6-32 | exact modification |
| `packages/test-support/src/auth-fixture.ts` | test utility/provider | request-response | `packages/test-support/src/status-fixture.ts` | role-match only |
| `tests/unit/auth-state.test.ts` | test | transform | `tests/unit/output-policy.test.ts`, lines 1-21 | role-match |
| `tests/unit/import-boundaries.test.ts` | test | transform | itself, lines 9-31, 45-73 | exact modification |
| `tests/integration/auth-persistence.test.ts` | test | CRUD | `tests/integration/job-recovery.test.ts`, lines 14-25, 90-110 | strong match |
| `tests/integration/auth-api.test.ts` | test | request-response | `tests/integration/pairing.test.ts`, lines 39-110 | strong match |
| `tests/integration/auth-worker.test.ts` | test | event-driven | `tests/integration/job-recovery.test.ts`, lines 51-83, 112-161 | strong match |
| `tests/integration/source-adapters.test.ts` | test | request-response + transform | none (fixtures must be new and local-only) | no analog |
| `tests/native/profile-ownership.test.ts` | test | file-I/O + event-driven | `tests/native/process-ownership.test.ts`, lines 1-28 | strong match |
| `tests/ui/auth-status.spec.ts` | test | request-response | `tests/ui/status.spec.ts`, lines 1-27 | strong match |

## Pattern Assignments

### `packages/domain/src/model.ts` (model, event-driven state)

**Analog:** `packages/domain/src/model.ts`

Extend the existing orthogonal observation vocabulary; do not replace it with `loggedIn: boolean`. Add per-source identity/binding/profile/UAT types beside the current model, and add `identity_mismatch` without collapsing capability, health, freshness, completeness, or outcome.

**Core state pattern** (lines 10-25):

```typescript
export type Health = 'not_observed' | 'healthy' | 'degraded' | 'error';
export interface Observation {
  auth: 'not_observed' | 'authenticated' | 'unauthenticated' | 'reauth_required';
  capability: 'unknown' | 'available' | 'unavailable' | 'denied';
  health: Health;
  freshness: 'not_observed' | 'fresh' | 'stale';
  completeness: 'not_observed' | 'complete' | 'partial';
  outcome: 'partial' | 'empty' | 'error' | 'not_observed' | 'deleted' | 'present';
  checkedAt: string | null;
}
export type Right = 'allowed' | 'restricted' | 'unknown';
export interface SourceRights { access: Right; retain: Right; disclose: Right; basis: string }
export type OutputOperation = 'status' | 'job_read' | 'selftest';
export type OutputDestination = 'local_ui' | 'local_cli' | 'model';
```

The Phase 2 model must keep `moodle` and `edstem` as separate source observations and retain the previous successful identity/observation on network/parser failure. A shared Profile is an observed deployment hypothesis, not a merged source state.

### `packages/contracts/src/index.ts` (strict runtime validation)

**Analog:** `packages/contracts/src/index.ts`

Use `z.strictObject`, enums, bounded strings/arrays, and cross-field `refine`. Model fixed source actions as discriminated unions; there must be no input fields for arbitrary URL, selector, JavaScript, browser handle, POST body, download, upload, reply, submission, or quiz start.

**Strict schema pattern** (lines 12-33):

```typescript
export const ScopeSchema = z.strictObject({
  installationId: z.uuid(),
  source: z.literal('synthetic'),
  courseId: z.literal('selftest')
});
export const JobRequestSchema: z.ZodType<JobRequest> = z.strictObject({
  kind: z.enum(['echo', 'digest']),
  value: z.string().max(4096),
  idempotencyKey: z.uuid(),
  scope: ScopeSchema
});
export const MaintenanceGateSchema: z.ZodType<MaintenanceGate> = z.strictObject({
  operationId: z.uuid().nullable(),
  generation: z.number().int().nonnegative(),
  state: z.enum(['open', 'quiescing', 'exclusive']),
  owner: z.string().min(1).max(128).nullable(),
  leaseUntil: z.number().int().nonnegative().nullable(),
}).refine(/* ownership consistency */);
```

The receipt schema should strictly enumerate native platform, source, scenario/checkpoint, evidence class, result code, binding consistency, gaps, and observed time. It must make cross-platform or S/I/N/L evidence substitution invalid at parse time.

### `packages/contracts/src/presentation.ts` (safe projection)

**Analog:** `packages/contracts/src/presentation.ts`

Add separate protected-local and public/redacted presenters. Full display name, school email, and selected course name may appear only in the paired local UI projection. CLI, MCP/model, logs, diagnostics, and UAT receipts receive only consistency, safe result codes, and a short irreversible keyed fingerprint.

**Fail-closed presentation pattern** (lines 15-24, 42-46):

```typescript
function feedback(code:string,stage:string,message:string,impact='操作未完成或尚未验证。',nextAction='请通过本安装的 CLI 查看脱敏诊断。'):PublicFeedback {
  return {code,stage:stages.has(stage)?stage:'unknown',message,impact,nextAction};
}
if(i.result==='human_needed')
  return output('HUMAN_NEEDED','操作已停止，尚不能确认安全恢复方式。请查看脱敏原因并等待人工确认；不要删除资料或强制降级。');

export function presentFailure(code:string,stage:string):PublicFeedback {
  const allowed=new Set(['NETWORK_ERROR','PERMISSION_DENIED','RIGHTS_RESTRICTED','SCOPE_DENIED','GENERATION_MISMATCH','JOB_FAILED','CLEANUP_PENDING']);
  return feedback(allowed.has(code)?code:'UNKNOWN_ERROR',stage,'操作失败。请查看脱敏错误代码并通过本安装的诊断步骤处理。');
}
```

Unknown/new source errors must become a generic safe code rather than leaking DOM, URL path/query, identity, Profile path, or browser diagnostics.

### `packages/application/src/ports.ts` (ports) and `packages/application/src/auth.ts` (service)

**Analog:** `packages/application/src/ports.ts` plus `packages/application/src/policy.ts`

Declare browser/profile/source/persistence interfaces in `ports.ts`; orchestrate them in `auth.ts`. The application layer may import only application/domain/contracts (and existing approved `zod`/`node:crypto` exceptions), never Playwright, filesystem, SQLite, Fastify, or platform drivers.

**Port pattern** (`ports.ts` lines 26-44):

```typescript
export interface OutputPolicy {
  /** Resolve source rights and authenticated current scope internally; fail closed. */
  authorize(scope: Scope, operation: OutputOperation, destination: OutputDestination): Promise<Authorization>;
}
export interface ProcessSupervisor {
  start(launch: ProcessLaunch): Promise<ProcessIdentity>;
  stop(identity: ProcessIdentity): Promise<void>;
  inspect(identity: ProcessIdentity): Promise<'running' | 'exited' | 'identity_mismatch' | 'unknown'>;
}
```

The new interfaces should expose sealed methods such as `probe(source, fixedAction, signal)` and `openOfficialLogin(source)` rather than generic navigation. `auth.ts` should implement the state transition, identity comparator, candidate binding, one-source pause, Moodle-then-EdStem recheck, and exactly three bounded recovery probes.

**Admission-before-driver pattern** (`policy.ts` lines 50-65):

```typescript
/** All application admission lives here, independent of HTTP or SQLite drivers. */
export class ApiApplication {
  async enqueue(principal: Principal, input: unknown) {
    const request = JobRequestSchema.parse(input);
    await authorize(this.policy, principal, principal.selfcheck ? 'jobs:selfcheck' : 'jobs:write', 'selftest', request.scope);
    return redactOutput(await this.jobs.enqueue(request, await this.context(principal)));
  }
}
```

### `packages/application/src/policy.ts` (authorization/redaction)

**Analog:** `packages/application/src/policy.ts`

Extend authorization across source, fixed action, selected course/scope, operation, and destination. The local UI is not a blanket bypass: it may receive the explicit protected identity projection only after pairing; other destinations must be redacted.

**Authorization and recursive redaction pattern** (lines 23-38):

```typescript
export function redactText(value: string): string {
  return value.replace(/(?:\/(?:Users|home|tmp|private|var|Volumes)\/|[A-Za-z]:[\\/])[^\s"'<>]*/g, '[redacted-path]')
    .replace(/(?:bearer\s+|(?:token|password|cookie|secret|authorization)\s*[:=]\s*)[^\s"'<>]+/gi, '[redacted-secret]');
}
export function redactOutput<T>(value: T): T {
  if (typeof value === 'string') return redactText(value) as T;
  if (Array.isArray(value)) return value.map(redactOutput) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactOutput(item)])) as T;
  return value;
}
export async function authorize(/* ... */): Promise<void> {
  if (!principal.permissions.includes(permission) || /* scope/policy denial */) throw new ApplicationError('FORBIDDEN');
}
```

Add explicit safe codes for `AUTH_REQUIRED`, `REAUTH_REQUIRED`, `IDENTITY_MISMATCH`, `NETWORK_UNAVAILABLE`, `PARSER_CHANGED`, `CAPABILITY_DENIED`, `PROFILE_IN_USE`, and human-needed unsupported-adapter outcomes. Never pass an exception message from a source page directly to a response.

### `packages/persistence/src/database.ts` and `packages/persistence/src/auth.ts` (migration/store)

**Analog:** `packages/persistence/src/database.ts` and `packages/persistence/src/sessions.ts`

Use a versioned, transactional migration and strict repository methods. Persist approved normalized origins/scopes, per-source observations, keyed identity fingerprints/binding status, Profile owner metadata, and the UAT ledger. Do not persist cookies, storage state, raw HTML/DOM, headers/bodies, full identity in public projections, Profile content/path, screenshots, traces, HAR, video, console output, or login input.

**Database open/migration pattern** (`database.ts` lines 13-48):

```typescript
export function openDatabase(path: string): Database.Database {
  if (!path || path === ':memory:') throw new StorageError('DURABLE_DATABASE_REQUIRED');
  const db = new Database(path, { timeout: 2000 });
  try {
    assertSQLiteIdentity(db.prepare('SELECT sqlite_version() AS version, sqlite_source_id() AS sourceId').get() as typeof SQLITE_IDENTITY);
    db.pragma('foreign_keys = ON');
    if (db.pragma('journal_mode = WAL', { simple: true }) !== 'wal') throw new StorageError('WAL_REQUIRED');
    db.pragma('synchronous = FULL'); db.pragma('busy_timeout = 2000');
    db.transaction(() => { /* ordered migration + PRAGMA user_version */ }).immediate();
    return db;
  } catch (error) { db.close(); throw error; }
}
```

**Connection-local transactional store pattern** (`sessions.ts` lines 64-79):

```typescript
exchange(token: string, csrf: string) {
  return this.db.transaction(() => {
    const row = this.row('pending', token);
    if (!row || row.approved !== 1 || !validSecret(csrf) || row.csrf_hash !== hash(csrf)) throw new ApplicationError('PAIRING_DENIED');
    // consume pending state and atomically create the replacement
  }).immediate();
}
authenticate(token: string, csrf?: string) {
  const row = this.row('session', token);
  if (!row) throw new ApplicationError('UNAUTHORIZED', 401);
  if (csrf !== undefined && (!validSecret(csrf) || row.csrf_hash !== hash(csrf))) throw new ApplicationError('PAIRING_DENIED');
  return row.id;
}
```

Failed probes update current failure/checked time without deleting the last successful identity or observation. UAT cells are append-only observations or monotonic corrections with audit context; macOS evidence must never update a Windows row.

### `packages/platform/src/paths.ts` and `packages/platform/src/profile.ts` (protected Profile lifecycle)

**Analog:** `packages/platform/src/paths.ts` and `packages/platform/src/processes.ts`

Use only the installation-managed, protected, non-cloud-synced Profile directory already represented by `managedPaths(...).profile`. Do not expose that absolute path outside the platform driver.

**Managed path pattern** (`paths.ts` lines 8-16, 89-95):

```typescript
export function managedPaths(root: string) {
  if (!isAbsolute(root) || root !== resolve(root)) throw new Error('UNSAFE_PATH');
  return Object.freeze({
    root, program: join(root, 'program'), runtime: join(root, 'runtime'),
    browser: join(root, 'browser'), data: join(root, 'data'), secrets: join(root, 'secrets'),
    staging: join(root, 'installer-staging'), profile: join(root, 'profile-private')
  });
}
export function assertManagedPath(paths: ManagedPaths, child: string): string {
  if (!child || isAbsolute(child) || child.split(/[\\/]/).some(part => part === '..' || part === '.' || !part)) throw new Error('UNSAFE_PATH');
  const target = join(paths.root, child);
  // ancestor, local-volume, ownership and permission checks follow
  return target;
}
```

Profile ownership records should copy the process proof fields and durable-write approach: installation id, browser build, PID, nonce, OS start identity, exact executable, started time, and generation.

**Ownership and recovery pattern** (`processes.ts` lines 38-40, 146-169):

```typescript
export function matchesProcess(identity: ProcessIdentity, observation: OSProcess|null): boolean {
  return !!observation && !!identity.executable &&
    identity.osStartIdentity===observation.osStartIdentity &&
    identity.executable===observation.executable;
}
async inspect(identity:ProcessIdentity):Promise<'running'|'exited'|'identity_mismatch'|'unknown'> {
  const record=this.record(identity.role);
  if(!record || !same(record,identity)) return 'identity_mismatch';
  const os=await observeProcess(identity.pid); if(!os) return 'exited';
  if(!matchesProcess(identity,os)) return 'identity_mismatch';
  await this.request(await this.validated(identity),'/api/process/inspect');
  return 'running';
}
// On start, stale records are removed only when inspect(existing) === 'exited'.
```

Lease expiry is fencing only. If the browser is running or ownership is unknown, return `profile_in_use`/human-needed. Clear stale ownership only after confirmed exit. Never kill an unrelated browser, daily Chrome, or an unproven PID.

### `packages/platform/src/browser.ts` and `packages/platform/src/source-adapters.ts`

**Analog:** No real equivalent exists; follow `02-RESEARCH.md` Recommended Architecture §§1-3 and the official Playwright contracts cited there.

Implement one `ProfileCoordinator` as the only `launchPersistentContext` caller. Required launch behavior: the dedicated Profile, shipped managed Chromium, interactive login window only on user action, `acceptDownloads: false`, and no trace/video/HAR/screenshot/console/request-body capture. Normal probes should not open a window when both sessions are valid.

Adapters must be sealed to exactly:

```typescript
type SourceAction =
  | 'moodle.auth_probe'
  | 'edstem.auth_probe'
  | 'moodle.course_visibility_probe'
  | 'edstem.course_visibility_probe';
```

Each adapter constructs its own approved URL and returns only the structured probe contract. It validates observed origin, an explicit positive authenticated marker, stable subject/organization evidence when available, and bounded visible identity/course visibility. HTTP 200 or a reachable URL is not authentication evidence. Redirects outside the approved origin, downloads, writes, popups requiring interaction, parser drift, or unbounded page data fail closed. Do not guess internal APIs or freeze school-specific selectors before the user confirms the official origins and supported visible markers.

### `apps/api/src/security.ts` and `apps/api/src/main.ts` (middleware/routes)

**Analog:** existing loopback API admission and error handling.

Register only fixed routes/actions. Login/open-window/confirm-binding/explicit-logout/UAT-receipt mutations require the paired local principal and CSRF. Source status may return full identity only through the protected local UI projection. CLI/model status receives the redacted projection.

**Transport/auth/error pattern** (`main.ts` lines 63-84):

```typescript
app.addHook('onRequest', async (request, reply) => {
  reply.header('cache-control', 'no-store')
    .header('x-content-type-options', 'nosniff')
    .header('content-security-policy', "default-src 'self'; frame-ancestors 'none'; object-src 'none'");
  assertTransport(request, origin);
  if (publicStaticPaths.has(request.url) && request.method === 'GET') return;
  if (publicPairingPaths.has(request.url)) return;
  principals.set(request, /* authenticated CLI/MCP or paired-browser principal */);
});
app.setErrorHandler((error, _request, reply) => {
  const validation = error instanceof z.ZodError;
  const code = validation ? 'INVALID_REQUEST' : /* safe allowlist or INTERNAL_ERROR */;
  reply.code(/* bounded status */).send({ code, stage: 'api', nextAction: 'retry_or_check_local_service' });
});
app.get('/api/status', async request => StatusSchema.parse(await status.read(principal(request))));
```

**Pairing authorization negative pattern** (`tests/integration/pairing.test.ts` lines 57-82): public shell has no identity; a pending/correlation code cannot authenticate; cross-origin, missing CSRF, replay, or stolen cookies return 401/403.

### `apps/worker/src/main.ts` (auth probe jobs)

**Analog:** `packages/application/src/job-runner.ts`

Route auth jobs through the same durable, cancellable, generation-fenced runner. The handler must honor `AbortSignal` before navigation and between bounded browser steps. A lost lease or cancellation prevents any further request and rejects late commit.

**Bounded retry/fencing pattern** (`job-runner.ts` lines 16-53):

```typescript
/** At-least-once attempts. Only the durable fenced commit publishes a business result. */
export class JobRunner {
  async runOnce(owner: string, context: WriteContext, handler: JobHandler): Promise<Job | null> {
    await this.store.recoverExpired(this.clock.now(), context);
    const job = await this.store.claim({ owner, now: this.clock.now(), leaseMs: LEASE_MS }, context);
    if (!job) return null;
    const controller = new AbortController();
    // heartbeat observes cancel/lease loss and aborts the handler
    // only the fenced store.commit publishes success
  }
}
```

Apply exactly three bounded recovery probes only to natural expiry or temporary probe failure. Explicit logout remains `unauthenticated` and does not auto-open. Parser change, capability denial, identity mismatch, unknown Profile ownership, or human interaction/MFA stops immediately. One source failure pauses only that source; Moodle reauth triggers an EdStem recheck but does not assume shared SSO recovery.

### `apps/status/index.html`, `apps/status/src/main.ts`, and `apps/status/styles.css` (paired local UI)

**Analog:** existing status page.

Create two independent source cards plus an overall gate card. Preserve accessible semantic elements, live announcements, safe DOM construction via `textContent`, refresh serialization, stale snapshots, and clearing protected content on 401/403/session revocation.

**Safe render/request pattern** (`main.ts` lines 19-22, 43-66):

```typescript
function announce(text:string) { if(feedback.textContent!==text)feedback.textContent=text; }
function node<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string) {
  const result=document.createElement(tag);
  if(text!==undefined)result.textContent=text;
  return result;
}
function clearProtected() {
  snapshot=null; job=null; readAt=''; protectedView.replaceChildren(); pairing.hidden=false;
}
async function request(path:string,body?:object) {
  return fetch(path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',/* CSRF for POST */});
}
if(response.status===401||response.status===403){
  clearProtected(); announce('此页面尚未获得本地访问权限'); await beginPairing(); return;
}
```

Each source card shows official origin, full display name, full school email, auth/capability/health/freshness/completeness, last verified time, and shared-Profile use, with a clear private-information notice. On `identity_mismatch`, render both identities for local comparison and disable course access. The overall card must show macOS A/B/C/D independently, reauth separately, Windows as `not_run / human_needed`, and Phase 3 as blocked.

### Tests and fixtures

#### `packages/test-support/src/auth-fixture.ts` and `tests/integration/source-adapters.test.ts`

There is no live-adapter analog. Build local malicious/positive pages only; block all external requests. Fixtures cover login marker, origin redirect, popup/interaction request, parser drift, same display name with different stable subjects, download event, write/form/POST/quiz/upload attempts, and bounded timeouts. Fixture success is S/I evidence only.

Copy the network containment from `playwright.config.ts` lines 9-31:

```typescript
context: async ({ context }, use) => {
  await context.route('**/*', async route => {
    try { assertLocalURL(route.request().url()); }
    catch { await route.abort('blockedbyclient'); return; }
    await route.continue();
  });
  await use(context);
},
// trace/video/screenshot off; non-local traffic sent to a closed local proxy
```

#### `tests/unit/auth-state.test.ts` and `tests/unit/import-boundaries.test.ts`

Use table-driven state transitions and assert rejection, not just happy paths. Add new application files to the existing transitive boundary enforcement. The current boundary test (`import-boundaries.test.ts` lines 19-29) forbids domain imports outside domain, driver/transport imports from application, and platform/persistence/Profile access from MCP.

Required unit cases: all auth/error states; last-success retention; exactly three retry attempts; explicit logout vs natural expiry; one-source isolation; strict vs manual candidate binding; keyed fingerprint projection; receipt platform/evidence contamination; and Windows remaining `not_run/human_needed` after macOS success.

#### `tests/integration/auth-persistence.test.ts` and `tests/integration/auth-worker.test.ts`

Copy real SQLite reopen, competing-worker, crash, fence, cancel, and prior-success assertions from `tests/integration/job-recovery.test.ts`.

**Retention/retry pattern** (lines 90-101):

```typescript
const success = await running(f);
await f.jobs.commit(success.id, success.lease!, 'retained', 1001, context);
// later retryable failures
expect(job).toMatchObject({
  state: 'retry_wait', errorCode: 'NETWORK_ERROR',
  result: null, lastSuccessResult: 'retained'
});
// third attempt becomes failed while lastSuccessResult remains retained
```

Also prove that an old Worker cannot issue a browser request after lease loss, not merely that its final DB commit fails.

#### `tests/integration/auth-api.test.ts`

Copy the real HTTP fixture style from `tests/integration/pairing.test.ts`: exercise public/paired/CLI/MCP principals, same-origin headers, CSRF, revocation, restart, concurrency, and actual JSON projections. Assert full names/emails/course names are absent from public shell, CLI, MCP/model, logs, errors, and receipts, while the paired local UI endpoint can return them.

#### `tests/native/profile-ownership.test.ts`

Copy exact executable + OS creation identity checks from `tests/native/process-ownership.test.ts` lines 8-20:

```typescript
const os=await observeProcess(child.pid!);
const identity={/* installation, pid, nonce, osStartIdentity, executable */};
expect(matchesProcess(identity,os)).toBe(true);
expect(matchesProcess({...identity,osStartIdentity:'old PID creation'},os)).toBe(false);
expect(matchesProcess({...identity,executable:'/unknown/program'},os)).toBe(false);
await h.stop(child);
expect(await observeProcess(child.pid!)).toBeNull();
```

Native results are platform-specific. Run macOS now under the approved sequencing exception. Leave Windows `not_run / human_needed`; do not infer it from JavaScript parity, Linux/WSL, or macOS results.

#### `tests/ui/auth-status.spec.ts`

Copy paired real-browser HTTP testing from `tests/ui/status.spec.ts` lines 8-26: verify public shell is empty, pair explicitly, inspect protected content, simulate offline stale state, deny/revoke and ensure protected DOM clears, and assert no local/session storage. Add two source cards, private-info notice, identity mismatch halt, per-checkpoint receipt display, Windows deferred state, and Phase 3 blocked status.

## Shared Patterns

### Layering and dependency direction

**Source:** `tests/unit/import-boundaries.test.ts` lines 19-31

Apply to every Phase 2 file:

```text
domain <- contracts/application <- drivers (persistence/platform/API/worker/UI)
MCP/CLI/UI -> authenticated API/client boundary
MCP never imports Profile, browser, platform, or persistence drivers
```

Browser/Profile/source adapter ports belong in application; Playwright and filesystem implementation belongs in platform. UI/API never drives Playwright directly.

### Authentication and local UI protection

**Source:** `apps/api/src/pairing.ts` and `tests/integration/pairing.test.ts`

Apply to every identity-bearing API/UI route. Same-origin transport, paired session, CSRF on mutations, `no-store`, strict CSP, revocation, and 401/403 clearing remain mandatory. Public HTML and pending pairing state contain no identity.

### Error handling and privacy

**Source:** `packages/application/src/policy.ts` lines 9-38; `apps/api/src/main.ts` lines 74-80

Use enumerated safe codes, recursive redaction, strict output schemas, and a generic `INTERNAL_ERROR` fallback. Never emit source DOM/text beyond bounded approved identity fields, raw URL/query, Profile path, cookie/storage state, headers/body, screenshot, HAR, trace, console output, password/MFA field/value, or keystroke.

### Transactions, last success, and fences

**Source:** `packages/persistence/src/database.ts` lines 13-48; `tests/integration/job-recovery.test.ts` lines 51-110

Every state update is transactional and generation/fence checked. Temporary/current failure is distinct from last successful observation. Cancellation and lease loss abort browser work; stale Workers cannot request or commit. Retry is bounded to three attempts.

### Profile/process ownership

**Source:** `packages/platform/src/processes.ts` lines 38-84, 146-211

Installation id + nonce + PID + OS start identity + exact executable + authenticated control proof are jointly required. A lease timeout is never exit proof. Only confirmed exit permits stale-record cleanup, and only owned processes may be stopped.

### Evidence and hard gates

**Source:** `02-CONTEXT.md` D-12–D-18 and `02-RESEARCH.md` Validation Architecture

Apply to receipts, UI, tests, release, and planning:

1. Automated suite completes before beta assembly.
2. The installable beta is published and availability-checked before asking for live UAT.
3. User performs update, official Moodle login/MFA, and any EdStem interaction.
4. macOS checkpoints remain distinct: A (first login/binding/one selected course visibility), B (three close/reopens + Worker restart + Codex exit), C (full macOS restart), D (at least 24-hour no-intervention recheck); reauth is a separate observation.
5. Failure stops dependent live steps and remains a failure until a new beta is actually tested.
6. Windows remains `not_run / human_needed` under the approved macOS-first sequencing exception.
7. macOS or synthetic/integration/native results must not fill Windows/L cells.
8. Phase 1 and Phase 2 are not globally complete under this exception, and Phase 3 remains blocked until the original dual-platform hard gate is met or the user explicitly changes product scope and planning artifacts.
9. Every live plan is `autonomous: false`; publication/update, official login/MFA, native restart, Codex exit, 24-hour wait, reauth, and user result confirmation are hard human gates.

## No Analog Found

| File | Role | Data Flow | Reason / planner action |
|---|---|---|---|
| `packages/platform/src/browser.ts` | provider | event-driven + request-response | No real BrowserProvider exists. Use the official Playwright persistent-context contract and research constraints; do not copy the synthetic provider as live implementation. |
| `packages/platform/src/source-adapters.ts` | provider | request-response + transform | No Moodle or EdStem connector exists. Implement sealed fixed actions from research; actual selectors/markers require approved-origin supportability and live human confirmation. |
| `tests/integration/source-adapters.test.ts` | test | request-response | No source fixtures exist. Build local-only positive and malicious fixtures; never contact school origins in automated tests. |
| Runtime UAT ledger/receipt implementation within `packages/persistence/src/auth.ts` | store | event-driven | Existing status projections are only a partial analog. Encode platform/scenario/evidence-class cells explicitly and preserve `not_run/human_needed`; never infer live evidence. |

## Plans 35–41 Revision Surface

The following mapping is exhaustive for every file created or modified by Plans 35–41. A row marked **existing mapping** inherits the exact excerpt and constraints earlier in this document. A row marked **research-contract-first** has no implementation analog and must follow the cited Phase 2 contract rather than improvise a broad API.

| File | Plan(s) | Deterministic analog or explicit no-analog classification |
|---|---:|---|
| `packages/domain/src/live-evidence.ts` | 35 | **Research-contract-first, no file analog.** Use `packages/domain/src/model.ts`’s orthogonal literal-union/interface style (excerpt below), but requiredness/count semantics come only from `02-CONTEXT.md` D-12–D-18 and `02-RESEARCH.md` Validation Architecture. |
| `packages/contracts/src/live-evidence.ts` | 35 | **Research-contract-first, no file analog.** Use `packages/contracts/src/index.ts` strict `z.strictObject` + typed cross-field refine pattern already excerpted above; do not use permissive records or caller-selected cells. |
| `packages/application/src/live-checkpoints.ts` | 35, 36 | **Research-contract-first, no workflow analog.** Ports follow `packages/application/src/ports.ts`; orchestration/abort/fence shape follows `packages/application/src/job-runner.ts` lines 16–53. Live authority and predecessor rules come only from the closed scenario contract in Plans 35/36. |
| `packages/persistence/src/database.ts` | 35 | **Existing mapping.** Use the transactional ordered migration excerpt earlier in this document; do not rebuild existing tables. |
| `packages/persistence/src/auth.ts` | 35 | **Existing mapping plus no-analog live store.** Use `packages/persistence/src/sessions.ts` IMMEDIATE transaction pattern; exact pending-action/consume-and-append semantics are research-contract-first and payload authority remains external. |
| `tests/unit/live-evidence.test.ts` | 35 | **Analog:** `tests/unit/auth-contracts.test.ts` table-driven strict/cross-field rejection; registry count/duplicate/requiredness assertions are research-contract-first. |
| `tests/integration/live-checkpoint-store.test.ts` | 35 | **Analog:** `tests/integration/job-recovery.test.ts` real SQLite reopen/crash/fence/last-success pattern already excerpted above; add atomic pending-action consume/append cases, never a live fixture. |
| `apps/api/src/auth.ts` | 36 | **Existing mapping:** fixed paired routes use `apps/api/src/main.ts` and `tests/integration/pairing.test.ts`; no dynamic operation/cell route. |
| `apps/api/src/main.ts` | 36 | **Existing mapping:** exact middleware/error excerpt earlier in this document. |
| `apps/status/src/main.ts` | 36 | **Existing mapping:** safe `textContent`, paired request, 401/403 purge excerpt earlier in this document. |
| `tests/integration/live-checkpoint-workflows.test.ts` | 36 | **Analog:** `tests/integration/auth-worker.test.ts` plus `tests/integration/pairing.test.ts`; durable A–D/reauth scenario table and payload-external L authority are research-contract-first. |
| `tests/ui/auth-live-actions.spec.ts` | 36 | **Analog:** `tests/ui/auth-status.spec.ts` / `tests/ui/status.spec.ts` paired real-browser HTTP pattern; durable action recovery and exact checkpoint CTAs follow `02-UI-SPEC.md`. |
| `scripts/release/phase2-live-gate.mjs` | 37 | **Research-contract-first, no gate analog.** The finite record/verify/audit/final grammar comes from Plans 16–34 and Plan 37. Reuse only the closed argv/safe-error pattern from `scripts/release/preflight.mjs` and atomic no-replace record publication from `packages/installer/src/launchers.ts` (excerpts below). |
| `scripts/release/phase2-native-evidence.mjs` | 37 | **Research-contract-first, no producer analog.** Native platform/build attestation shape follows `scripts/test/native-report.mjs`; fixed argv and safe output follow `scripts/release/preflight.mjs`. It must use only named `signed_automated` S/I/N obligations and has no L route. |
| `scripts/release/verify-phase2-update-gate.mjs` | 37 | **Analog:** `scripts/release/preflight.mjs` exact identity/schema/closed argv checks. Phase 2 macOS/Windows pre/post conjunctions are research-contract-first; the verifier has zero installation/runtime/evidence mutation authority. |
| `tests/integration/phase2-live-gate.test.ts` | 37 | **Analog:** `tests/integration/release-gates.test.ts` fixture-driven CLI/identity/negative style. The four record branches, exact event digests, no-write snapshots and all downstream command enumerations are research-contract-first. |
| `release/phase2-build-selection.json` | 38 | **Generated-artifact contract-first; no source analog.** Shape follows strict public identity fields in `release/beta-artifacts.json`, but Plan 38’s one-version/commit/tree/build selection schema is authoritative. |
| `release/phase2-test-report.json` | 38 | **Generated-artifact contract-first; no source analog.** Use only command/source hashes, bounded counts and pass/gap enums; never captured raw output or live evidence. |
| `release/phase2-beta-artifacts.json` | 39 | **Analog:** `release/beta-artifacts.json` and `scripts/release/preflight.mjs#artifactPreflight`; extend with exact Phase 2 member hashes/capability closure without weakening immutable identity/signature checks. |
| `release/phase2-install-prompt.md` | 39 | **Analog:** `release/install-prompts.md`; exact selected identity/asset hashes and current support gaps only, with no credential/source/live-result content. |
| `.planning/phases/02-poc-live/02-40-WINDOWS-NATIVE-RECEIPT.json` | 40 | **Generated planning handoff, research-contract-first.** Public build/platform, named S/I/N obligation counts and safe codes only; no device/path/PID/source/identity/Profile or L fields. |
| `scripts/release/phase2-gate.mjs` | 41 | **Analog:** `scripts/release/preflight.mjs` for exact repository/version/commit/tree/build identity, closed argv and safe errors; Phase 2 suite/capability closure is contract-first. |
| `scripts/build/assemble.mjs` | 41 | **Existing exact modification:** retain `assembleTarget`/`stageProductionClosure` inventory, no-existing-destination and member/hash checks; add Phase 2 capabilities without broad copying or alternate signing. |
| `scripts/release/preflight.mjs` | 41 | **Existing exact modification:** retain `exactKeys`, `assertReleaseIdentity`, `assertVersionAvailable`, history/package scans and safe CLI dispatch. |
| `scripts/release/publish.mjs` | 41 | **Existing exact modification:** retain fixed `returdex/AutoED`, preflight-before-network and no existing version; replace any overwriting receipt helper with the no-replace record pattern for new Phase 2 outputs. |
| `scripts/release/verify-availability.mjs` | 41 | **Existing exact modification:** retain clean anonymous full-byte fetch, redirect allowlist, byte/hash/signature/member verification and bounded output. |
| `tests/integration/phase2-release-gates.test.ts` | 41 | **Analog:** `tests/integration/release-gates.test.ts`; add Phase 2 identity/capability/member/publish/availability negatives and assert zero remote mutation in fixtures. |

### Exact analog excerpts for the revised surface

**Closed argv and safe errors — `scripts/release/preflight.mjs` lines 15, 24, 58:**

```javascript
function reject(code){throw new Error(code);}
function exactKeys(value,keys){
  return value&&typeof value==='object'&&!Array.isArray(value)&&
    Object.keys(value).sort().join(',')===[...keys].sort().join(',');
}
if (args.join(' ')==='--identity-only') result=identityOnly();
else if(args[0]==='--artifacts'&&args.length===2) result=artifactPreflight(args[1]);
else reject('RELEASE_ARGUMENT_INVALID');
```

Phase 2 gate scripts must preserve the same closed-dispatch property. They may add only the finite forms enumerated in the plans; no generic option parser, endpoint/path/operation override or ignored extra flag.

**Atomic no-replace planning record — `packages/installer/src/launchers.ts` line 21:**

```typescript
export function writeInstallerRecord(path:string,value:unknown){
  if(existsSync(path))throw new Error('ENTRY_OWNERSHIP_UNCONFIRMED');
  const temporary=join(dirname(path),'.record-'+randomUUID()),fd=openSync(temporary,'wx',0o600);
  try{protectPath(temporary);writeFileSync(fd,JSON.stringify(value));fsyncSync(fd);}finally{closeSync(fd);}
  linkSync(temporary,path); unlinkSync(temporary);
  if(process.platform==='darwin'){
    const directory=openSync(dirname(path),'r'); try{fsyncSync(directory);}finally{closeSync(directory);}
  }
}
```

`phase2-live-gate.mjs` A1/A2 must use this no-replace durability shape with an exact allowlisted planning path and canonical schema re-parse. B3/reauth have an explicitly empty filesystem-output set and must reject `--out`.

**Native bounded report shape — `scripts/test/native-report.mjs` line 20:**

```javascript
const fd=openSync(intent,'r');
try{fsyncSync(fd);}finally{closeSync(fd);}
renameSync(intent,done);
const directory=openSync(owned,'r');
try{fsyncSync(directory);}finally{closeSync(directory);}
```

This is only a durability/native-test analog. `phase2-native-evidence.mjs` must additionally prove current signed build and actual declared OS through the Phase 2 contract; it may not treat a file transition as platform or live evidence.

**Anonymous full-byte verification — `scripts/release/verify-availability.mjs` lines 8–11:**

```javascript
const response=await fetch(asset.url,{redirect:'manual',headers:{accept:'application/octet-stream'},signal:AbortSignal.timeout(300000)});
const bytes=Buffer.from(await response.arrayBuffer());
if(bytes.length!==asset.bytes||digest(bytes)!==asset.sha256)throw new Error();
```

Retain the existing redirect host allowlist and manifest/signature/member checks; Phase 2 capability metadata never substitutes for downloaded-byte verification.

### Plan-reference rule

Plans 35–41 must cite this section in each implementation action that owns one of the files above. Plans 16/17/20/23 only consume the already tested and signed `phase2-live-gate.mjs`; they must never extend the no-analog gate during live execution.

## Metadata

**Analog search scope:** `packages/domain`, `packages/contracts`, `packages/application`, `packages/persistence`, `packages/platform`, `packages/test-support`, `apps/api`, `apps/worker`, `apps/status`, `tests/unit`, `tests/integration`, `tests/native`, `tests/ui`, root Playwright configuration

**Files scanned:** 81 repository source/test/config files; 20 files read for concrete excerpts

**Revision inspection:** Added exact excerpts from `scripts/release/preflight.mjs`, `packages/installer/src/launchers.ts`, `scripts/test/native-report.mjs`, and `scripts/release/verify-availability.mjs`; classified every `files_modified` entry from Plans 35–41.

**Strong analog set:** strict contracts/model; application admission/output policy; SQLite transaction/session/job recovery; managed process/path ownership; paired API/status UI and layered tests

**Pattern extraction date:** 2026-09-01 (revised for Plans 35–41 checker feedback)
