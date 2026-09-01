---
phase: 02-poc-live
plan: "02"
subsystem: auth-persistence
tags: [sqlite, migrations, fencing, append-only-ledger, privacy]
requires:
  - phase: 02-poc-live
    plan: "01"
    provides: strict auth, ownership and evidence contracts plus sealed persistence ports
provides:
  - atomic privacy-minimized SQLite schema v1 to v2 migration
  - source config, observation, account binding and Profile ownership stores
  - append-only exact-cell UAT evidence ledger with platform and producer fencing
affects: [02-03 Profile coordination, source adapters, live UAT, Phase 3 gate]
tech-stack:
  added: []
  patterns: [ordered atomic migrations, generation-fenced writes, last-success retention, append-only correction chains]
key-files:
  created:
    - packages/persistence/src/auth.ts
    - tests/integration/auth-persistence.test.ts
  modified:
    - packages/persistence/src/database.ts
    - tests/integration/job-storage.test.ts
    - packages/test-support/src/upgrade-fixture.ts
key-decisions:
  - "Profile ownership retains a monotonic fence even after confirmed release; lease expiry never proves exit."
  - "Native N evidence uses the exact native.<platform> producer namespace; integration producers cannot claim N or L."
  - "AUTH-02/AUTH-03/AUTH-04/SEC-02/UAT-01 remain Pending because persistence tests are not native or live validation."
patterns-established:
  - "All auth persistence writes parse strict contracts before BEGIN IMMEDIATE and check generation inside the transaction."
  - "Evidence corrections append a linked event; receipt replay is idempotent and conflicting reuse fails closed."
requirements-completed: []
duration: 23min
completed: 2026-09-01
---

# Phase 2 Plan 02: Transactional Auth Persistence Summary

**Atomic SQLite schema v2, privacy-minimized fenced auth stores and an immutable platform-isolated evidence ledger now persist the Phase 2 contracts without accessing any school source or browser Profile.**

## Performance

- **Duration:** 23 min
- **Started:** 2026-09-01T03:32:31Z
- **Completed:** 2026-09-01T03:55:55Z
- **Tasks:** 3
- **Files modified:** 5 planned product/test files plus 1 compatibility fixture

## Accomplishments

- Added a single ordered v1→v2 migration chain that preserves Phase 1 rows, rolls back injected failures, rejects future or forged schema metadata and creates five constrained privacy-minimized tables.
- Implemented strict approved-source configuration, per-source current/last-success observations, append-only account binding history and single-owner Profile fencing with irreversible stored proofs.
- Implemented an INSERT-only UAT ledger with exact platform/source/scenario/evidence cells, immutable prior-event links, two-connection idempotency and explicit authority contamination rejection.
- Proved prohibited identity, Profile, authentication, browser and network capture sentinels do not enter the main database, WAL, backup or returned records.

## Task Commits

Each planned task followed RED then GREEN; later coverage discoveries were also committed atomically:

1. **Task 1 RED: schema v2 migration behavior** — `fed9f5a` (test)
2. **Task 1 GREEN: atomic privacy-minimized schema v2** — `b9f6a34` (feat)
3. **Task 2 RED: fenced auth store behavior** — `7269ce2` (test)
4. **Task 2 GREEN: source, observation, binding and ownership stores** — `690963c` (feat)
5. **Task 3 RED: append-only evidence behavior** — `9446b4b` (test)
6. **Task 3 GREEN: immutable exact-cell evidence ledger** — `3f8565f` (feat)
7. **Compatibility fix: future-schema recovery fixture** — `65fa12b` (fix)
8. **Coverage completion: two-connection and contamination matrix** — `2295ce3` (test)
9. **Additional RED: reject fixture claims of native evidence** — `f56af6c` (test)
10. **Additional GREEN: exact native producer fence** — `0781c07` (fix)

## Files Created/Modified

- `packages/persistence/src/database.ts` — Ordered migration metadata validation and constrained schema v2.
- `packages/persistence/src/auth.ts` — Five strict SQLite persistence implementations with generation, ownership and evidence fences.
- `tests/integration/auth-persistence.test.ts` — Fifteen real-SQLite migration, reopen, rollback, concurrency, privacy and evidence-isolation tests.
- `tests/integration/job-storage.test.ts` — Future-schema regression now remains ahead of schema v2.
- `packages/test-support/src/upgrade-fixture.ts` — Recovery fault now injects future schema v3 rather than the newly valid v2.

## Verification

- `npm run typecheck`: **passed** under the approved managed Node 24.20.0 toolchain.
- Plan-focused regression: **21/21 passed** across `auth-persistence.test.ts` and `job-storage.test.ts`.
- Task 1 migration filter: **4/4 passed**.
- Task 2 source/last-success/binding/ownership filter: **6/6 passed**.
- Task 3 ledger/isolation/privacy filter: **5/5 passed**.
- Append-only SQL scan: **passed**, with no UAT receipt UPDATE, DELETE or REPLACE statement.
- Repository-wide unit attempt: **65/69 passed**; four fixed-port installation tests could not run while the installed Phase 1 API retained port 43187.
- Repository-wide integration attempt: **93/133 passed**. Fixed-port installation/runtime fixtures and cleanup cascades account for most failures; one pre-existing isolated SQLite-busy harness case also unexpectedly resolved rather than observing `SQLITE_BUSY`.

All persistent test databases were temporary and synthetic. The plan produced only automated contract/integration verification; temporary N-shaped rows were accepted only under the exact local native producer authority and are not native UAT evidence. No live pass, official login, school access, browser start, Profile read, publication or persistent UAT receipt was produced.

## Decisions Made

- Preserved current and last-success source observations separately so network, parser, capability and reauthentication failures cannot erase prior success or imply logout/empty/deletion.
- Preserved confirmed account-binding history when a new stable fingerprint creates `identity_mismatch`; mismatch blocks course access instead of overwriting the binding.
- Stored only nonce/control/executable digests for Profile ownership and retained the monotonic fence in an `available` row after confirmed release.
- Required actual-platform authority for every ledger write and reserved N for the exact `native.<platform>` producer; L still requires a matching human-action receipt and was never written by this plan.
- Kept Phase 1 partial, Windows `not_run / human_needed`, Phase 2 blocked and Phase 3 blocked. All listed requirements remain Pending until their required native/live evidence exists.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Kept the upgrade recovery schema fault ahead of the current schema**
- **Found during:** Overall compatibility review after Task 3
- **Issue:** The existing recovery fixture injected `user_version=2`, which became valid after this plan and no longer represented an unsupported future schema.
- **Fix:** Advanced the injected fault to `user_version=3`.
- **Files modified:** `packages/test-support/src/upgrade-fixture.ts`
- **Commit:** `65fa12b`

**2. [Rule 2 - Missing Critical Functionality] Completed cross-authority evidence isolation**
- **Found during:** Task 3 acceptance review
- **Issue:** Initial tests did not exercise two-connection replay or every required authority/evidence mismatch, and matched integration payloads could claim N.
- **Fix:** Added the complete contamination matrix and bound N writers to the exact native platform producer namespace.
- **Files modified:** `packages/persistence/src/auth.ts`, `tests/integration/auth-persistence.test.ts`
- **Commits:** `2295ce3`, `f56af6c`, `0781c07`

The generic executor requirement-completion update was intentionally not applied because AGENTS.md and the approved validation strategy require AUTH-02/AUTH-03/AUTH-04/SEC-02/UAT-01 to remain Pending until full native/live evidence exists.

## Issues Encountered

- The installed Phase 1 API owns fixed loopback port 43187. Per project instructions it was not stopped or altered merely to free the port, so the repository-wide fixed-port suites remain an honest environment conflict recorded in `deferred-items.md`.
- The existing isolated `bounded SQLite busy failure never destroys a previous result` job-recovery test resolved instead of observing `SQLITE_BUSY`. It is outside the Plan 02-02 auth path and is recorded for later investigation rather than changing an unrelated timing harness.

## Known Stubs

None.

## Authentication Gates

None. This plan did not authenticate, access school sources, read the dedicated Profile or request credentials.

## User Setup Required

None.

## Next Phase Readiness

- The strict persistence ports are ready for Plan 02-03 Profile coordination.
- A later approved maintenance window is still needed for repository-wide fixed-port verification; this does not convert the focused automated results into native/live evidence.
- Windows remains `not_run / human_needed`; Phase 1 remains partial, Phase 2 remains blocked and Phase 3 remains blocked.

## Self-Check: PASSED

All six created or modified product/test files and this summary exist. RED/GREEN and compatibility commits `fed9f5a`, `b9f6a34`, `7269ce2`, `690963c`, `9446b4b`, `3f8565f`, `65fa12b`, `2295ce3`, `f56af6c` and `0781c07` are present in repository history; targeted verification and privacy/append-only gates pass.

---
*Phase: 02-poc-live*
*Completed: 2026-09-01*
