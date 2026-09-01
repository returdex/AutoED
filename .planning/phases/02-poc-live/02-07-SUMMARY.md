---
phase: 02-poc-live
plan: "07"
subsystem: auth-worker
tags: [sqlite, durable-jobs, auth-recovery, fencing, source-isolation]
requires:
  - phase: 02-poc-live
    plan: "02"
    provides: writer authority, observations and evidence persistence
  - phase: 02-poc-live
    plan: "03"
    provides: monotonic Profile ownership generation and fences
  - phase: 02-poc-live
    plan: "04"
    provides: pure auth reducer and fixed recovery effects
  - phase: 02-poc-live
    plan: "06"
    provides: sealed fixed-action Moodle and EdStem SourceProbePort
provides:
  - strict durable per-source auth-job facade and SQLite schema v3 queue
  - bounded immediate/5s/30s recovery with logout and interaction hard stops
  - request, heartbeat, commit and SQL-condition fencing in the combined Worker
affects: [02-08 paired auth API, 02-09 auth management UI, AUTH-03, AUTH-04, SEC-02]
tech-stack:
  added: []
  patterns: [closed durable command, absolute recovery timeline, same-predicate transactional commit, dual-queue fair polling]
key-files:
  created:
    - packages/application/src/auth-jobs.ts
    - tests/integration/auth-worker.test.ts
  modified:
    - packages/persistence/src/database.ts
    - packages/persistence/src/auth.ts
    - apps/worker/src/main.ts
    - tests/integration/job-storage.test.ts
    - tests/integration/auth-persistence.test.ts
    - .planning/phases/02-poc-live/deferred-items.md
key-decisions:
  - "Recovery offsets are persisted against one recoveryStartedAt and consumed only from reducer effects, so restart cannot reset the three-attempt budget."
  - "Every source request is preceded by a full authority assertion, every result is asserted again, and the final transaction repeats the identical lease/fence/generation/cancel predicate before writing observations or follow-ups."
  - "Production Worker composition accepts only sealed adapters with guarded local browser/Profile dependencies; direct SourceProbePort injection is explicitly synthetic S/I test composition."
patterns-established:
  - "Per-source failure isolation: a Moodle job never overwrites EdStem state and vice versa."
  - "Fresh follow-up: successful Moodle user-login completion creates one independently configured EdStem probe rather than copying auth state."
requirements-completed: []
duration: 17min
completed: 2026-09-01
---

# Phase 2 Plan 07: Durable Per-Source Auth Worker Summary

**SQLite-backed Moodle and EdStem auth jobs now survive restarts, recover only on the fixed three-probe timeline, and fence every source request and state commit against cancellation and stale Worker authority.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-09-01T05:08:02Z
- **Completed:** 2026-09-01T05:24:34Z
- **Tasks:** 2 TDD tasks
- **Files modified:** 8 source/test/tracking files

## Accomplishments

- Added a strict `AuthProbeCommand`, durable `AuthJobStore`, service facade and runner with no URL, script, selector, browser handle, credential, Profile path or network-capture payload.
- Migrated SQLite atomically from v2 to v3 with normalized per-source jobs and logout controls while preserving jobs, observations, binding, Profile ownership and evidence state; failed migration rolls back completely.
- Persisted the absolute immediate/+5s/+30s recovery schedule, capped recoverable failures at three requests, and made interaction, MFA and explicit logout immediate human boundaries.
- Added request-before, in-flight heartbeat and commit-before fencing for cancel, lease, generation and fence, plus a same-condition transactional SQL guard that rolls back observation and follow-up writes on a race.
- Integrated one auth work unit per existing Worker loop alongside one synthetic work unit, preserving fairness and aborting an in-flight auth probe on shutdown without opening login UI or reclaiming unrelated browser processes.

## Task Commits

1. **Task 1 RED: durable auth-job and migration contracts** — `8ab35b3` (test)
2. **Task 1 GREEN: isolated SQLite auth jobs and transactional transitions** — `b324e67` (feat)
3. **Task 2 RED: request/heartbeat/commit race coverage** — `a86fb22` (test)
4. **Task 2 GREEN: fenced combined Worker integration** — `c8ac50e` (feat)
5. **Direct regression compatibility: schema-v3 auth persistence assertions** — `9032612` (test)

No separate REFACTOR commit was necessary; both GREEN implementations remained within the planned application/store/Worker boundaries.

## Files Created/Modified

- `packages/application/src/auth-jobs.ts` — Closed command and job contracts, facade, reducer mapping and doubly fenced runner.
- `packages/persistence/src/database.ts` — Atomic v2→v3 auth-job/control migration and version metadata.
- `packages/persistence/src/auth.ts` — Transactional enqueue, claim, heartbeat, fencing, recovery, logout and unique follow-up store.
- `apps/worker/src/main.ts` — Fair synthetic/auth polling and sealed production versus explicit S/I test composition.
- `tests/integration/auth-worker.test.ts` — Source isolation, retry, logout, MFA, follow-up, restart and race coverage.
- `tests/integration/job-storage.test.ts` — v3 migration preservation and rollback coverage.
- `tests/integration/auth-persistence.test.ts` — Existing persistence expectations advanced to current schema v3.
- `.planning/phases/02-poc-live/deferred-items.md` — Exact-command result for the pre-existing SQLite-busy timing case.

## Verification

- Focused auth-worker/job-storage/Worker run: **30/30 passed**.
- Schema-v3 auth-persistence regression: **15/15 passed**.
- Exact Task 2 command: all **20/20** auth-worker, **3/3** Worker and **13/14** existing job-recovery cases passed; the sole failure is the previously recorded unrelated SQLite-busy timing case.
- `npm run typecheck`: **passed**.
- Plan export, v3 schema, fixed recovery, double-assert, AbortSignal, composition and evidence scans: **passed**.
- Forbidden auth-job payload and direct browser/credential/kill scans: **zero matches**.
- `git diff --check`: **passed**.

All new results are local synthetic/integration S/I evidence. No school network, official login, Profile contents, source content, publication, native/live claim or L receipt was accessed or created.

## Decisions Made

- Anchored all retries to one durable `recoveryStartedAt`; job recovery uses reducer-approved effects and cannot gain extra attempts after a process restart.
- Kept source state independent and preserved each source's prior `lastSuccess` across network, parser, permission, authentication and interaction/MFA failures.
- Made Moodle login completion enqueue one idempotent EdStem job inside the successful transition transaction using EdStem's own approved config/scope and authority fields.
- Preserved the existing synthetic job runner and limited each Worker loop to one unit from each queue, preventing a waiting source from starving unrelated work.
- Left AUTH-03, AUTH-04 and SEC-02 Pending: these implementations provide S/I evidence only and do not satisfy required live/native cells.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated the existing auth-persistence regression for schema v3**

- **Found during:** Overall verification after Task 2
- **Issue:** The prior regression fixture asserted schema v2 as the current version and treated v3 as an unsupported future schema after this plan intentionally made v3 current.
- **Fix:** Advanced current-version assertions to v3, retained rejection coverage for a true future v4 database, and preserved all existing observation/binding/evidence checks.
- **Files modified:** `tests/integration/auth-persistence.test.ts`
- **Verification:** Auth-persistence regression passes 15/15 and typecheck passes.
- **Committed in:** `9032612`

---

**Total deviations:** 1 auto-fixed blocking compatibility issue. **Impact:** The change is a direct schema-version regression update; no product scope or test timing behavior was widened.

The generic requirement-completion update was intentionally not applied. AGENTS.md and the approved validation strategy require AUTH-03, AUTH-04 and SEC-02 to remain Pending until their complete S/I/N/L evidence exists.

## Issues Encountered

- The exact Task 2 command still encounters the pre-existing `bounded SQLite busy failure never destroys a previous result` timing regression: the promise resolves rather than observing `SQLITE_BUSY`. This plan did not change that unrelated job path or timing harness. It remains recorded in `deferred-items.md`; every Plan 02-07 test and 13 other job-recovery cases pass.

## Known Stubs

None.

## Threat Flags

None. The durable auth schema, source probe boundary and Worker authority paths are the T2-04/T2-05/T2-06/T2-08 surfaces explicitly registered and tested by this plan; no new endpoint, arbitrary browser operation, credential capture, file access or source-write surface was introduced.

## Authentication Gates

None. This plan did not open an official login, request credentials/MFA or perform a live source action.

## User Setup Required

None.

## Next Phase Readiness

- Plan 02-08 can expose the strict per-source auth facade and durable status without adding browser-control inputs.
- Windows remains `not_run / human_needed`; actual login, Profile reopen/restart/Codex-exit/cross-day/reauth/account-binding live checks remain unrun.
- Phase 1 remains partial, Phase 2 is not complete, and Phase 3 remains blocked by the required native/live gate.

## Self-Check: PASSED

All eight created/modified plan files exist; RED/GREEN and compatibility commits `8ab35b3`, `b324e67`, `a86fb22`, `c8ac50e` and `9032612` are present in order; the 30/30 focused integration run, 15/15 schema-v3 regression, typecheck and static gates passed; and `git diff --check` reported no whitespace errors.

---
*Phase: 02-poc-live*
*Completed: 2026-09-01*
