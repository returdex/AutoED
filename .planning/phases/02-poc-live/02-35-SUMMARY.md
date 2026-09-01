---
phase: 02-poc-live
plan: "35"
subsystem: live-evidence-persistence
tags: [sqlite, live-evidence, durable-actions, exact-cell-registry, append-only-ledger]
requires:
  - phase: 02-poc-live
    plan: "02"
    provides: append-only typed UAT receipt ledger and exact evidence-key vocabulary
  - phase: 02-poc-live
    plan: "07"
    provides: durable job fencing and IMMEDIATE-transaction persistence patterns
  - phase: 02-poc-live
    plan: "08"
    provides: restart-revoked ordinary login action kept separate from live evidence authority
provides:
  - 176-cell possible-evidence registry with exactly 44 required live cells and 14 named build obligations
  - payload-external paired authority and fully bound durable pending-live-action contracts
  - SQLite v4 one-time consume-and-exact-append transaction with append-only corrections and failures
affects: [02-36 through 02-41, AUTH-01, AUTH-02, AUTH-03, AUTH-04, SEC-02, UAT-01, Phase 3 gate]
tech-stack:
  added: []
  patterns: [closed requiredness registry, payload-external authority, consume-and-append transaction, append-only correction chain]
key-files:
  created:
    - packages/domain/src/live-evidence.ts
    - packages/contracts/src/live-evidence.ts
    - packages/application/src/live-checkpoints.ts
    - tests/unit/live-evidence.test.ts
    - tests/integration/live-checkpoint-store.test.ts
  modified:
    - packages/persistence/src/database.ts
    - packages/persistence/src/auth.ts
    - packages/test-support/src/upgrade-fixture.ts
    - tests/integration/auth-persistence.test.ts
    - tests/integration/job-storage.test.ts
    - .planning/phases/02-poc-live/deferred-items.md
key-decisions:
  - "Requiredness is a closed registry: 176 cells remain possible, exactly 44 L cells are required, and 14 named S/I/N obligations are evaluated separately without cross-cell substitution."
  - "A live writer authority is paired-server state outside caller payloads and is persisted only as an authentication hash bound to immutable action context."
  - "Live success consumes the pending action and appends one exact L receipt in the same SQLite IMMEDIATE transaction; corrections and failures remain append-only."
patterns-established:
  - "Exact live key: platform, source, scenario and L class must match a registry-required cell; possible nonrequired evidence cannot change eligibility."
  - "Durable action: server-generated opaque identity plus current build, artifact, installation, platform, source, scenario, config, scope, binding, generation, parent and expiry are rechecked at consumption."
requirements-completed: []
duration: 14min
completed: 2026-09-01
---

# Phase 2 Plan 35: Durable Live Checkpoint Contracts Summary

**A closed 44-cell live registry and SQLite-backed one-time action workflow now preserve exact, authenticated checkpoint outcomes across process and OS restarts without creating any live evidence.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-09-01T06:10:42Z
- **Completed:** 2026-09-01T06:24:42Z
- **Tasks:** 2 TDD tasks
- **Files modified:** 10 production/test files plus 2 planning artifacts

## Accomplishments

- Defined all 176 readable Phase 2 live cells while limiting required live completion to exactly 44 L cells: 22 per native platform across two sources and eleven scenarios.
- Defined 14 named build-bound S/I/N obligations separately, preserving evidence class, platform, source and scenario boundaries without a Cartesian default or cross-cell substitution.
- Added strict pending-action and paired-result schemas that reject caller authority, arbitrary browser operations, sensitive paths/data and unknown fields.
- Added SQLite schema v4 durable actions and safe failure audits, with restart survival, monotonic issuance, bounded expiry and hash-only paired authority.
- Made valid completion a single IMMEDIATE transaction that rechecks the complete current binding, appends exactly one authorized L event and consumes exactly one action; replay, expiry, mismatches, busy errors and rollback never create partial evidence.

## Evidence Boundary

- **Evidence created by this plan:** synthetic S/I contract and integration test results only.
- **Live evidence:** no L success was written to the repository or any installed runtime; test databases were temporary and cleaned by the harness.
- **Not accessed:** no official login, credential, sensitive Profile, school source, course, publication, update or installed service mutation.
- **Preserved gates:** Windows remains `not_run / human_needed`; live cells remain unrun/human-needed; Phase 1 remains partial; all requirements remain Pending; Phase 3 remains blocked.

## Task Commits

1. **Task 1 RED: evidence-requiredness and durable action contracts** — `35bda5d` (test)
2. **Task 1 GREEN: exact live registry and payload-external workflow** — `bbd93f0` (feat)
3. **Task 2 RED: durable checkpoint store and transaction failures** — `9431af7` (test)
4. **Task 2 GREEN: SQLite one-time consume and exact-cell append** — `d2808b4` (feat)

## Files Created/Modified

- `packages/domain/src/live-evidence.ts` — exact possible/required registries, named build obligations, eligibility evaluator and durable action domain types.
- `packages/contracts/src/live-evidence.ts` — strict safe schemas for requirements, bindings, pending actions and paired results.
- `packages/application/src/live-checkpoints.ts` — narrow paired authority/runtime/store ports and workflow with separate failure audit.
- `packages/persistence/src/database.ts` — ordered SQLite v4 migration for pending actions and append-only live failures.
- `packages/persistence/src/auth.ts` — issuance, restart-safe lookup, exact transactional consumption, correction fencing and safe failure recording.
- `tests/unit/live-evidence.test.ts` — count, mapping, duplicate, isolation and forbidden-field contract checks.
- `tests/integration/live-checkpoint-store.test.ts` — reopen, replay, mismatch, expiry, rollback, busy, correction and audit integration checks.
- `packages/test-support/src/upgrade-fixture.ts`, `tests/integration/auth-persistence.test.ts`, `tests/integration/job-storage.test.ts` — schema-v4 compatibility expectations and migration cleanup.
- `.planning/phases/02-poc-live/deferred-items.md` — repository-wide failures outside this plan's installed-service-safe scope.

## Verification

- Managed Node 24.20.0 TypeScript typecheck: **passed**.
- Exact Task 1 unit surface: **48/48 passed**.
- Exact Task 2 persistence surface plus migration compatibility: **40/40 passed**; the plan's narrower two-file command is **33/33 passed**.
- Registry assertions: **176 possible**, **44 required L**, **22 per platform**, and **14 named S/I/N** obligations with explicit requirement mappings.
- Static stub/sensitive-surface scan: no TODO/FIXME/placeholder production path and no persisted credential, Cookie, Profile path, URL, selector, JavaScript, browser handle or raw page/network field.
- Git/runtime residual check: no database/WAL or live-result artifact was created in the repository.
- Repository-wide unit run: **127/131 passed**; the four failures are the already recorded fixed-port installed-service conflict.
- Repository-wide integration run: **249/291 passed**; unrelated port-conflict cascades, current shared-tree browser-import guard failures and the previously recorded SQLite-busy/process-lifecycle cases are deferred without modification.

## Decisions Made

- Kept readable evidence vocabulary and completion requiredness distinct. This preserves historical/display compatibility while preventing omitted cells from becoming implicitly required or successful.
- Resolved authority and current runtime state inside the paired-server workflow. Neither a result payload nor the ordinary restart-revoked login correlation can implement live evidence writer authority.
- Required exact latest same-cell predecessor linkage for corrections and retained the original receipt; a correction cannot replace another evidence class, platform, source or scenario.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Advanced schema-version compatibility fixtures with SQLite v4**

- **Found during:** Task 2 (durable checkpoint persistence)
- **Issue:** Adding the ordered v4 migration left existing current/future-version assertions and upgrade fixture injection pinned to v3/v4, blocking the migration regression surface.
- **Fix:** Updated only the shared schema compatibility fixtures to treat v4 as current, v5 as future and clean the two v4 tables during test migration resets.
- **Files modified:** `packages/test-support/src/upgrade-fixture.ts`, `tests/integration/auth-persistence.test.ts`, `tests/integration/job-storage.test.ts`
- **Verification:** Typecheck and all 40 focused persistence/migration integration tests pass.
- **Committed in:** `d2808b4`

---

**Total deviations:** 1 auto-fixed blocking compatibility issue. **Impact:** The change is limited to correctness of the planned ordered migration and its existing regression fixtures; no product or live scope expanded.

The generic requirement-completion and sequential state updates were intentionally not applied. This plan executed out of order in a shared wave, and project policy requires AUTH-01, AUTH-02, AUTH-03, AUTH-04, SEC-02 and UAT-01 to remain Pending until their complete required evidence and hard human gates exist.

## Issues Encountered

- The installed Phase 1 API continues to own fixed port `43187`, so the four existing credential-redaction unit cases and related install/upgrade integration cascades cannot run. This plan does not authorize stopping or changing that service.
- Current shared-tree compiled release/client/upgrade fixtures are rejected by the existing browser-import guard while importing status assets. The previously recorded job-recovery busy timing and process-lifecycle provisioning cases also remain. None intersects the plan-owned contract/persistence suites; all are recorded in `deferred-items.md`.

## Known Stubs

None. Every registry, workflow and persistence operation used by the focused tests is production code; fixtures create only temporary synthetic databases and authorities.

## Threat Flags

None. The registry, live authority and SQLite action/evidence boundaries are the exact T2-35-01 through T2-35-04 surfaces assigned to this plan and have negative contract/integration coverage.

## Authentication Gates

None. No official page, login, MFA, source, Profile or live UAT was used.

## User Setup Required

None.

## Next Phase Readiness

- Later Phase 2 live-checkpoint plans can issue restart-safe, fully bound pending actions and consume them into one exact authorized L cell only after a real paired human action.
- No live/native completion claim follows from this plan. Windows and all live cells remain at their existing human-needed/unrun states, and Phase 3 remains blocked.

## Self-Check: PASSED

All seven planned production/test files and this summary exist; all four RED/GREEN commits are present; typecheck, 48/48 focused unit tests and 40/40 focused persistence tests pass; no database/WAL or live-result artifact is present; and STATE, ROADMAP, REQUIREMENTS, Windows/live status, Phase 1 partial status and the Phase 3 block remain unchanged.

---
*Phase: 02-poc-live*
*Completed: 2026-09-01*
