---
phase: 01-beta
plan: "04"
subsystem: api
tags: [fastify, sqlite, loopback, authentication, pairing, output-policy]
requires:
  - phase: 01-01
    provides: Strict contracts, managed Node and build identity injection
  - phase: 01-02
    provides: SQLite job, maintenance and status projection stores
  - phase: 01-03
    provides: Installation-scoped credential verification and revocation
provides:
  - Real authenticated loopback HTTP application boundary
  - Explicit CLI-approved one-time browser pairing and read-only sessions
  - Atomic SQLite admission cap and protected status projections
affects: [01-05, 01-06, 01-07, 01-09]
tech-stack:
  added: []
  patterns: [transport-independent admission, strict safe outputs, boot-scoped hashed sessions]
key-files:
  created: [packages/application/src/policy.ts, packages/application/src/status.ts, apps/api/src/main.ts, apps/api/src/security.ts, apps/api/src/pairing.ts, packages/persistence/src/sessions.ts, tests/integration/local-auth.test.ts, tests/integration/pairing.test.ts, tests/unit/output-policy.test.ts]
  modified: [packages/persistence/src/jobs.ts]
key-decisions:
  - "Queue capacity is checked inside the existing immediate enqueue transaction, after idempotent lookup."
  - "Pairing uses connection-local SQLite TEMP records and explicit API boot invalidation, including same-connection restart."
  - "Production API status uses compiled identity; injected identity is only the uncompiled synthetic-test fallback."
requirements-completed: []
requirements-addressed: [SEC-01, ARCH-02, JOB-01]
duration: approximately 12 min
completed: 2026-08-27
---

# Phase 1 Plan 4: Authenticated Loopback API and Pairing Summary

**Fastify HTTP routes now call shared application policy and actual SQLite stores, with role-scoped credentials, atomic admission and explicitly approved read-only browser sessions.**

## Execution and Commits

Two tasks complete; ten implementation/test files. Executed 2026-08-27 Australia/Melbourne, finished approximately 2026-08-26T16:07:25Z. No dependencies added, remote actions, persistent product installation, legacy access, Profile access, school access or human approvals occurred.

| Task | Gate | Commit | Result |
|---|---|---|---|
| 04-1 authenticated application/API | RED | `88aa1d9` | New HTTP suite failed because API implementation was absent; not passing test evidence |
| 04-1 authenticated application/API | GREEN | `e87cd46` | Nine real HTTP integration scenarios passed, including two-process admission race |
| 04-2 explicit pairing/output policy | RED | `071994a` | New pairing suite failed because session implementation was absent; not passing test evidence |
| 04-2 explicit pairing/output policy | GREEN | `3376f7f` | Seven pairing scenarios, ten HTTP scenarios and three output-policy tests passed |

Both task RED commits precede their GREEN commits. Additional bare-token redaction coverage first failed an actual assertion and then passed after its implementation.

## Delivered Behavior

- `startApi` binds only `127.0.0.1`, validates exact Host and supplied Origin, disables proxy trust/logging, uses a 16,384-byte body limit and emits safe error envelopes containing only code/stage/nextAction. No CORS is enabled.
- Credential verification uses the actual Plan 03 verification/revocation implementation; integration tests inject synthetic SecretStore values, never an existing native credential namespace. CLI, MCP, service, installer and short-lived selfcheck roles receive distinct permissions. Selfcheck authority is bound to current exclusive operation, generation and expiry, never accepted from ordinary job JSON.
- Job enqueue/query/cancel and shutdown admission run through shared application methods. Output authorization checks the registered installation's synthetic scope, operation and local UI/CLI/model destination. Recursive redaction covers request text, historical results, checkpoints and error fields without modifying archived input.
- Enqueue's 1,000-pending cap includes queued/running/retry-wait jobs, normal and selfcheck combined. The existing SQLite immediate transaction checks capacity after idempotency lookup. Two real managed-Node child processes competing for the last slot produce exactly one admission and one `QUEUE_FULL`; full-capacity idempotent retry still returns its existing job.
- Installer-only maintenance calls the existing persisted gate transactions. Ordinary writes/cancel are rejected in the exclusive candidate window. Installer projection writes use the existing StatusProjectionStore and current operation/generation; passing selfcheck additionally requires an actual succeeded matching operation/generation job. API status reads persisted Worker/install/selfcheck projections and independently reports the responding API's compiled identity/time. Missing Worker data stays null; stale Worker errors remain errors, not healthy.
- Public `/status` is a generic shell. Same-origin nonce plus bound cookie creates pending state. The correlation code alone, pending cookie alone and unapproved exchange do not authenticate. Only a separately authenticated CLI request with an explicit matching `confirmedCode` approves; Plan 06 must place its real human prompt before that request.
- Pending TTL is five minutes; nonce/pending issuance and approval have five-per-minute limits, with at most five live pending records per installation. Exchange atomically consumes approved pending state and rotates to a fresh eight-hour read-only session. Cookies are HttpOnly, SameSite=Strict, Path=/, without Domain; HTTP has no TLS/Secure guarantee or cookie port isolation claim.
- Sessions, pending records and nonce bindings retain hashes only in SQLite TEMP tables. API boot explicitly invalidates prior sessions even when the DB connection is reused; close cleans its own boot, and expiry/revocation/replay/cross-origin/fixation/concurrent-exchange cases fail closed. No permanent database schema migration was added.
- Responses set no-store, nosniff and the planned CSP. Browser GETs may omit Origin only with same-origin Fetch Metadata and an exact-origin Referer; supplied Origin must still match. Browser mutations require exact Origin and CSRF. No URL token or localStorage is used.

## Verification Evidence

Managed **Node 24.20.0 / npm 11.19.0**, Fastify 5.12.1, Zod 4.4.3, cookie 11.1.2, SQLite 3.53.4; host macOS arm64. All test roots and child processes are harness-owned and synthetic.

| Check | Actual result |
|---|---|
| `node scripts/dev/runtime.mjs npm run test:integration -- --run tests/integration/local-auth.test.ts tests/integration/pairing.test.ts` | 17/17 integration tests passed through real HTTP listeners, not Fastify inject |
| `node scripts/dev/runtime.mjs npm run test:unit -- --run tests/unit/output-policy.test.ts` | 3/3 unit tests passed |
| Managed Node `vitest --project unit --project integration --run` | 74/74: 37 unit +37 integration |
| Managed Node TypeScript `--noEmit` | Passed |
| `node scripts/dev/runtime.mjs npm run build` after `3376f7f` | Passed; one compiled API entry; build ID `859a014c31aed6e049d1d76a4a3853f344a3697f67244c3b4f7894b397e6b583` |
| `git diff --check` | Passed |
| Orchestrator independent check | 81/81: 37 unit +37 integration +7 existing macOS native checks; typecheck passed |

The added shutdown test receives acceptance and then verifies the actual listener closes without request/close self-deadlock. This is **not** detached process/Worker lifetime evidence. The browser-header test is HTTP contract evidence, **not** browser E2E. Actual browser rendering/interaction, Windows native behavior, user pairing, Codex exit and release/manual UAT remain unrun in this plan. Phase-wide requirements remain Pending; approval is not validation.

## Deviations from Plan

**1. [Rule 2 — Required admission correctness] Atomic queue capacity in the existing repository.** Root approved the narrowly expanded ownership of `packages/persistence/src/jobs.ts`. An HTTP count-then-insert check would race. The existing immediate transaction now counts pending jobs, preserving full-queue idempotent retry. No port/schema change. Verified by actual competing processes and HTTP 429; commit `e87cd46`.

**2. [Rule 3 — Build integration] Consume compiled API identity.** The first full build correctly rejected an API entry that did not consume `__AUTOED_BUILD_IDENTITY__`. The API now exports and uses the build-injected identity ahead of caller-supplied identity; source tests use their synthetic fallback. The approved build pipeline was unchanged. Build subsequently passed; commit `3376f7f`.

During integration, planned safe output behavior was tightened for arbitrary absolute roots/bare credential-shaped strings and shutdown execution was moved until after the acceptance response. Both are covered by tests in `3376f7f`; no dependency, architecture or authority expansion.

## Documentation Lookup

Read installed exact Fastify server docs/types and cookie types; consulted official [Fastify hooks](https://fastify.dev/docs/latest/Reference/Hooks/), [cookie plugin](https://github.com/fastify/fastify-cookie) and [Zod schemas](https://zod.dev/api). The orchestrator also checked [MDN Origin](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Origin), documenting same-origin GET behavior and the forbidden request-header constraint. Context7 was unavailable; no extra documentation CLI/dependency was downloaded.

## Downstream Integration Notes

- Plan 05 should construct `SQLiteSessions(db, installationId)` alongside the existing stores and pass it to `startApi`. Shutdown callbacks run after response completion; acceptance does not claim successful process exit. The supervisor must verify actual exit and report failure. This API factory does not yet create a persistent installation, detached runtime or Worker.
- Plan 06 must show the human pairing code prompt before sending `POST /api/pairing/:code/approve` with `{confirmedCode}`. There is no auto-approval route. The CLI may revoke all sessions with authenticated `POST /api/pairing/revoke` and `{all:true}`; a paired page can revoke only its own cookie with its CSRF value. Bearer browser mutations use SHA-256(token) as `x-autoed-csrf`; normal CLI/MCP requests have no Origin.
- Every authenticated request counts toward the 30/min loopback-IP limit; downstream polling/probes must avoid busy loops. Pairing initiation uses its stricter separate limits.
- Plan 09 must account for the shared 1,000-pending cap before maintenance selfcheck: obtain capacity through approved preflight/drain or return a clear failure. Do not bypass exclusive-mode fencing to make capacity.
- Plan 07 replaces the generic public shell with approved static UI and verifies actual browser fetch/header behavior. It must retain same-origin/CSRF and public-shell non-disclosure boundaries.

## Known Stubs and Threat Review

No TODO/FIXME/placeholder or unwired stub prevents these tasks. Null observations explicitly mean not observed. The minimal generic public shell is the planned pairing boundary, not a claim that Plan 07 UI is complete. New HTTP/pairing/TEMP-session boundaries are within T-01-06/T-01-07; no new source access, remote endpoint or trust boundary outside the approved plan was introduced.

No authentication or human-action gate occurred. No stable release, beta availability, real login or live verification is claimed. Shared STATE/ROADMAP/PROJECT/REQUIREMENTS/VALIDATION mutations remain assigned to the orchestrator; no phase-wide requirement was marked complete here.

## Self-Check: PASSED

All ten implementation/test files exist. The four task hashes resolve to commit objects in order. No task commit deleted a tracked file. Full tests/typecheck/build and diff checks passed as reported; no generated/private runtime files are untracked. The only pending file before the metadata commit is this intentional summary.
