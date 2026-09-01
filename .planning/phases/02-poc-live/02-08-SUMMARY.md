---
phase: 02-poc-live
plan: "08"
subsystem: auth-api
tags: [paired-loopback, csrf, destination-policy, one-time-action, privacy]
requires:
  - phase: 02-poc-live
    plan: "02"
    provides: SQLite auth stores, evidence ledger and strict source/binding contracts
  - phase: 02-poc-live
    plan: "04"
    provides: fail-closed auth state and identity mismatch semantics
  - phase: 02-poc-live
    plan: "06"
    provides: sealed source actions and narrow browser boundary
  - phase: 02-poc-live
    plan: "07"
    provides: durable AuthJobService with fixed probe/logout commands
provides:
  - seven fixed paired loopback auth routes with strict body/query admission
  - protected local-UI and redacted CLI/MCP status/receipt projections
  - restart-revoked one-time login correlation bound to paired session, source, config and generation
  - auth-specific safe errors with no raw exception or request reflection
affects: [02-09 paired status UI, 02-10 security matrix, 02-11 synthetic E2E, AUTH-01, AUTH-03, SEC-02, UAT-01]
tech-stack:
  added: []
  patterns: [allowlist projection, fixed-operation facade, paired-session correlation, parse-before-port, fail-closed optional composition]
key-files:
  created:
    - apps/api/src/auth.ts
    - tests/integration/auth-api.test.ts
  modified:
    - packages/application/src/policy.ts
    - packages/contracts/src/presentation.ts
    - apps/api/src/main.ts
    - apps/api/src/pairing.ts
    - apps/api/src/security.ts
    - tests/unit/output-policy.test.ts
key-decisions:
  - "Full source identity and canonical origin exist only in the paired local-UI protected projection; every bearer, model, receipt and diagnostic path is rebuilt from a redacted allowlist."
  - "The login action identifier is process-local, single-use and bound to the SQLite-authenticated browser session, source, approved config and runtime generation; it grants no evidence authority."
  - "Auth mutations require the existing paired cookie principal, exact same-origin and CSRF together; CLI and MCP receive only auth status and redacted receipt read permissions."
patterns-established:
  - "Fixed control surface: routes invoke one named AuthControlApplication method and never accept a generic operation, URL, browser handle or follow-up closure."
  - "Destination presentation: protected and redacted schemas construct exact new DTOs instead of spreading internal state or generic redaction output."
requirements-completed: []
duration: 18min
completed: 2026-09-01
---

# Phase 2 Plan 08: Paired Fixed Auth Control Plane Summary

**Seven strict loopback auth actions now share the existing paired browser session and CSRF boundary while full identity stays confined to protected local DOM data and every non-UI output is schema-redacted.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-09-01T05:28:39Z
- **Completed:** 2026-09-01T05:46:34Z
- **Tasks:** 2 TDD tasks
- **Files modified:** 8 source/test files

## Accomplishments

- Added exact protected/redacted status projections, redacted evidence receipts, twelve-character display fingerprints and a fixed three-field auth error contract.
- Added `AuthControlApplication` with separate read, receipt-read and five mutation permissions; all mutations validate installation, destination, source, configuration, scope and current binding before calling a narrow port.
- Registered only status, configuration confirmation, login open, probe, logout intent, binding confirmation and receipt read routes on the actual Fastify loopback server.
- Bound login completion to a server-generated, restart-revoked, one-time action record keyed by the already authenticated browser session; no action creates L/pass evidence.
- Proved all five strict mutation schemas reject each of eighteen forbidden capability/identity fields before any launcher, job, store or ledger side effect.

## Task Commits

Each task followed the required RED then GREEN sequence:

1. **Task 1 RED: auth output and application admission boundaries** — `8c665f8` (test)
2. **Task 1 GREEN: destination presenters and fixed auth facade** — `25d58ff` (feat)
3. **Task 2 RED: actual loopback route, CSRF, action and privacy matrix** — `b87dd55` (test)
4. **Task 2 GREEN: paired fixed auth control API** — `56757cc` (feat)

No separate REFACTOR commit was necessary; both GREEN implementations already isolate strict schemas, destination presenters and the process-local action registry.

## Files Created/Modified

- `packages/contracts/src/presentation.ts` — Protected/redacted status, receipt/action/error schemas and allowlist presenters.
- `packages/application/src/policy.ts` — Fine-grained permissions, session-bound principal field, safe error mapping and `AuthControlApplication`.
- `apps/api/src/auth.ts` — Seven explicit routes and bounded process-local one-time login action registry.
- `apps/api/src/main.ts` — Explicit auth dependency composition, route registration and auth-only safe error/not-found responses.
- `apps/api/src/pairing.ts` — Reuses the authenticated SQLite session ID and grants the paired UI exact auth permissions.
- `apps/api/src/security.ts` — Adds read-only auth status/receipt permissions to CLI and model bearer principals.
- `tests/unit/output-policy.test.ts` — Destination privacy, fingerprint, receipt, admission and unknown-error tests.
- `tests/integration/auth-api.test.ts` — Actual HTTP fixed-route, strict-body, principal/CSRF, replay/restart and output-privacy tests.

## Verification

- Actual loopback auth API plus pairing regression: **12/12 passed**.
- Output policy, auth contracts/state and import boundaries: **71/71 passed**.
- TypeScript typecheck: **passed**.
- All eighteen forbidden fields were rejected for each of the five mutation bodies with zero side effects.
- Fixed-route scan found exactly seven explicit registrations; browser-capability scan found no arbitrary evaluation, selector, handle, request-body, storage, capture or tracing surface.
- No skipped/todo tests and `git diff --check` passed.

All evidence is synthetic/unit/integration only. No school source, real browser, official login, persistent Profile content, credential, course, publication, native result or L receipt was accessed or created.

## Decisions Made

- Kept the ordinary login action registry in the API process. A restart invalidates all records by construction; this is deliberately separate from the later durable live-checkpoint authority.
- Selected projection by authenticated principal destination only. No request header, query or payload can request the protected representation.
- Parsed each route-specific body/query before application or port invocation, then repeated strict application validation at the trust boundary.
- Kept missing `ApiOptions.auth` fail closed: the seven routes remain registered and return a safe unavailable response rather than a canned success or direct database/browser fallback.
- Preserved Phase 1 partial status, Windows `not_run / human_needed`, Phase 2 live/native gaps and the Phase 3 block. AUTH-01, AUTH-03, SEC-02 and UAT-01 remain Pending.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Accepted valid null optional source presentation fields**
- **Found during:** Task 1 GREEN
- **Issue:** The first source-consistency guard compared `null` configuration, observation and identity values as though they were populated, rejecting a valid not-observed source.
- **Fix:** Guarded each source comparison by its non-null state while preserving strict schema validation for populated values.
- **Files modified:** `packages/contracts/src/presentation.ts`
- **Verification:** The complete 71-test unit target and typecheck pass.
- **Committed in:** `25d58ff`

**2. [Rule 2 - Missing Critical Functionality] Carried the authenticated pairing session ID into the auth principal**
- **Found during:** Task 2 GREEN
- **Issue:** Existing `browserPrincipal()` authenticated the cookie/CSRF but discarded the returned SQLite session ID, so a one-time login action could not be bound to the exact paired session as required.
- **Fix:** Added an internal optional `browserSessionId` to `Principal`, populated it only from `SQLiteSessions.authenticate()`, and rejected mutation/action admission when it is absent.
- **Files modified:** `packages/application/src/policy.ts`, `apps/api/src/pairing.ts`
- **Verification:** Cross-session consumption is rejected, correct consumption succeeds once, replay and restart fail, and pairing regression remains 8/8.
- **Committed in:** `56757cc`

---

**Total deviations:** 2 auto-fixed (1 correctness bug, 1 missing critical security binding). **Impact:** Both fixes were necessary to preserve not-observed status handling and exact paired-session action authority; neither adds source access, browser control or evidence scope.

## Issues Encountered

- The initial Task 2 RED fixture used an unsupported build capability and a runtime generation different from its fresh SQLite gate. Both synthetic setup values were corrected before the RED commit; the suite then failed solely on the absent auth routes as required.
- Repository-wide fixed-port conflicts remain the previously documented out-of-scope installed-service issue. Plan 02-08 used only focused ephemeral-port suites and did not stop, alter or replace the installed service.

## Known Stubs

None. An absent managed auth dependency is an intentional fail-closed composition state returning 503, not a success stub; test composition supplies only synthetic ports and cannot promote native/live evidence.

## Threat Flags

None. The new endpoints, auth path and session correlation are the exact T2-01, T2-02 and T2-07 surfaces assigned to this plan and covered by its mitigations; no file, schema or unregistered network boundary was added.

## Authentication Gates

None. This plan did not open an official page, launch a real login, request credentials/MFA or perform live UAT.

## User Setup Required

None.

## Next Phase Readiness

- Plan 02-09 can consume the protected paired status and fixed mutation routes without adding a parallel state or destination switch.
- Plan 02-10 can extend the canonical cross-layer negative matrix over these exact schemas and routes.
- Windows remains `not_run / human_needed`; all native/live scenarios remain unrun, Phase 2 is not globally passed and Phase 3 remains blocked.

## Self-Check: PASSED

All eight changed source/test files and this SUMMARY exist; RED/GREEN commits `8c665f8`, `25d58ff`, `b87dd55` and `56757cc` are present in order; focused integration/unit suites, typecheck and static security gates pass.

---
*Phase: 02-poc-live*
*Completed: 2026-09-01*
