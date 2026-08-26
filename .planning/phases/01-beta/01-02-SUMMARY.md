---
phase: 01-beta
plan: "02"
subsystem: persistence
tags: [sqlite, durable-jobs, fencing, maintenance, cancellation, status]
requires:
  - phase: 01-01
    provides: Managed Node 24.20.0, exact dependencies, shared contracts and test harness
provides:
  - Real SQLite 3.53.4 schema, idempotent enqueue and scope-isolated job queries
  - Transactional leases, unique business commits, cancellation and bounded crash recovery
  - Persistent maintenance ownership and generation fencing with isolated candidate selfchecks
  - Sanitized status projections with independent freshness and retained last success
affects: [01-04, 01-05, 01-06, 01-07, 01-09, 01-10]
tech-stack:
  added: []
  patterns: [BEGIN IMMEDIATE, conditional fenced writes, bounded busy timeout, operation-bound selfcheck, separate freshness and health]
key-files:
  created: [packages/persistence/src/database.ts, packages/persistence/src/jobs.ts, packages/persistence/src/claims.ts, packages/persistence/src/runtime-status.ts, packages/application/src/jobs.ts, packages/application/src/job-runner.ts, tests/integration/job-storage.test.ts, tests/integration/job-recovery.test.ts, tests/unit/job-state.test.ts]
  modified: [packages/domain/src/model.ts, packages/contracts/src/index.ts, tests/unit/contracts.test.ts]
key-decisions:
  - "Normal queued work rebinds to the current maintenance generation only when freshly claimed; existing owners never gain a replacement fence."
  - "Only NETWORK_ERROR is eligible for bounded automatic retry; parser and permission errors stop immediately."
  - "Projection freshness is computed separately from observed health; missing records remain null/not_observed."
  - "Success-shaped install and selfcheck projections require actual matching build observations, but schema acceptance is not live evidence."
requirements-completed: []
requirements-referenced: [JOB-01, ARCH-02]
duration: 12min
completed: 2026-08-27
---

# Phase 1 Plan 2: Durable SQLite Jobs and Maintenance Fencing Summary

**Real SQLite WAL storage with idempotent enqueue, fenced business commits, bounded crash recovery, operation-scoped maintenance and preserved last-success history.**

## Performance

- **Started:** 2026-08-27 approximately 01:31 AEST
- **Completed:** 2026-08-27 approximately 01:43 AEST
- **Duration:** approximately 12 minutes
- **Tasks:** 2/2
- **Files:** 9 created implementation/test files and 3 modified contract/test files, plus this summary

## Accomplishments

- Opened the installed `better-sqlite3@13.0.3` native addon under managed Node `24.20.0`; no dependency changes, lifecycle-script enablement, compilation toolchain or system SQLite fallback were needed.
- Verified actual `sqlite_version()` is `3.53.4` and actual `sqlite_source_id()` is `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`, matching the installed approved tagged header. Runtime startup rejects either identity mismatch. This is later than the researched WAL-reset fix; no claim of exhaustive SQLite verification is made.
- Enforced WAL, foreign keys, FULL synchronous mode and a 2000ms busy timeout. Schema 1 records compatibility bounds and rejects unknown schema versions.
- Stored jobs, unique scope/key payload hashes, attempts, scheduling, cancellation, checkpoints, result history, runtime observations/status, and maintenance/write generations in actual SQLite tables.
- Implemented short immediate transactions for claim, heartbeat, checkpoint, failure, cancellation acknowledgement, expiration recovery and unique business commit. Leases last at most 30 seconds, runner heartbeats every 5 seconds, and all active writes validate owner/fence/lease/generation and maintenance context.
- Implemented three-attempt limits, 1/2/4-second bounded delay calculation (no scheduling after the final failure), sanitized failure codes, and explicit invalidation of expired owners before retry. Cancellation cannot become terminal until the handler stops or the lease is reclaimed.
- Kept business results independent from recent job errors; an empty successful string is distinguishable from absent/error. Operation-scoped installer selfchecks cannot replace normal last-success values or increment normal write generation.
- Enforced quiescing/exclusive gates, explicit ownership and no expiry-based lock clearing. Ordinary backlog survives a generation change through a fresh claim, while previous worker contexts are rejected.
- Persisted sanitized component/install/selfcheck projections, preserving last-success records after later errors. Freshness derives from actual `checkedAt`, separate from observed health.

## Task Commits

1. **02-1 RED: durable storage and maintenance tests** — `93cd482`
2. **02-1 GREEN: schema, repository, maintenance and projections** — `289e9fa`
3. **02-2 RED: claims, recovery and cancellation tests** — `8c73f54`
4. **02-2 GREEN: fenced execution and evidence guards** — `738e729`

Both RED runs failed because their implementation modules did not yet exist. They are recorded as expected failures, not passing evidence. Both GREEN runs passed the implemented behavioral tests.

## Verification Evidence

| Check | Evidence/platform | Result |
|---|---|---|
| Native driver identity query | I, macOS 26.5.2 arm64, managed Node 24.20.0 | SQLite 3.53.4 and exact approved source ID matched |
| `node scripts/dev/runtime.mjs npm run test:integration -- --run` | I, real temporary SQLite files and owned Node child processes | **20/20 pass**, 2 files |
| `node scripts/dev/runtime.mjs npm run test:unit -- --run` | S, managed Node 24.20.0 | **26/26 pass**, 4 files |
| `node scripts/dev/runtime.mjs npm run typecheck` | Automated compiler check | pass |
| `node scripts/dev/runtime.mjs npm run build` | Automated build check | pass; accurately reports 0 application entries pending later plans |
| `git diff --check` | Repository hygiene | pass |
| Native Windows execution | N, Windows 11 x64 | not_run |
| Actual OS full-disk scenario | N | not_run; integration uses SQLite `max_page_count` to trigger real `SQLITE_FULL` |
| School access, Profile, authentication, installation/live UAT | L | not_run; outside this plan |

Integration cases include reopen durability, competing-process enqueue, competing-process claim/commit, an actually stopped owned child with running-job recovery, three expired attempts ending in failure, old-fence rejection after a fresh claim, backward/forward clock cases, cancellation/completion process competition, exact empty success, last-success retention, parser/permission rejection, maintenance draining/backlog and selfcheck isolation. An owned process holds a real SQLite write lock to produce bounded `SQLITE_BUSY`; SQLite page limits produce real `SQLITE_FULL` and preserve the prior result plus database integrity.

These results prove the tested storage behaviors, not exactly-once handler execution or phase-wide acceptance. No requirement was moved to completed.

## Interfaces for Subsequent Plans

- `openDatabase(path)` returns an actual driver connection; paths must come from the protected platform/installation boundary owned by Plan 03.
- `SQLiteJobStore` in `claims.ts` implements the complete existing `JobStore` port; `JobRepository` supplies shared enqueue/query/cancel methods. `Jobs` is the thin application command wrapper.
- `SQLiteMaintenanceStore` implements the existing `MaintenanceStore` port. `maintenance_generation.generation` fences runtime ownership; `write_generation` counts normal durable mutations and excludes installer selfchecks.
- `JobRunner.runOnce(owner, context, handler)` accepts an abort-aware handler and an injectable clock. Handler abort is cooperative; no arbitrary process is killed and no successful commit is fabricated after lease loss.
- `SQLiteStatusProjectionStore` implements the existing projection port. Component, install and selfcheck models now have optional `freshness: not_observed | fresh | stale`; reads always derive it for stored top-level projections. This is separate from component `health` and preserves its observed value.
- Successful install projections require a non-null timestamp, complete stage/cleanup, and fully matching target/actual build identities (capabilities compared as sets). Passing selfchecks require a job ID, timestamp and four distinct healthy actual component observations with consistent builds and timestamps no later than the selfcheck. Future actual entrypoint/feature probes must supply that evidence; passing a schema does not substitute for them.
- Ordinary request schemas still reject privileged generation/operation fields. Authentication and installer authority remain the responsibility of the approved application boundary; these are trusted internal ports, not publicly exposed database operations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical contract fields] Separate projection freshness and truthful success shapes**
- **Found during:** Tasks 02-1 and 02-2, coordinated with the orchestrator.
- **Issue:** Initial projection contracts could not represent stale freshness separately from health and accepted successful installation/selfcheck shapes without sufficient observations.
- **Fix:** Added optional freshness to the three existing projection types/schemas; added actual-build, timestamp, cleanup and four-component selfcheck guards with negative tests. Existing port signatures remain unchanged.
- **Files:** `packages/domain/src/model.ts`, `packages/contracts/src/index.ts`, `tests/unit/contracts.test.ts`; projection storage computes freshness.
- **Verification:** 26 unit tests and 20 integration tests pass, plus typecheck.
- **Commits:** `289e9fa`, `738e729`.

**Total deviations:** one necessary additive contract correction. No architecture, dependency, permission, platform or product-scope changes.

## Known Stubs

None preventing this plan's goal. Null/not_observed values are explicit absence states. Application entrypoints, actual component probes, installer authentication and source operations are owned by later approved plans and are not claimed here.

## Threat Surface Review

No unplanned endpoints, credentials, external disclosure or source access were introduced. SQLite file access, schema changes and generation/lease boundaries are within this plan's threat model. Test databases and generated process reports live only in harness-owned temporary roots and are cleaned up; none enter Git. Only owned test processes were stopped. No legacy data, Profile, real release keys, remote services or school data were accessed.

## Issues and Human Gates

No authentication or human-action gate occurred. No unresolved task verification failure remains. Shared STATE/ROADMAP/REQUIREMENTS/VALIDATION updates are deliberately left to the orchestrator under its single-writer instruction; phase-wide requirements remain pending.

## Self-Check: PASSED

All 12 implementation/test paths exist, all four task commits resolve, and the final worktree had no implementation changes or generated untracked files after task commits. No tracked files were deleted. Final tests, typecheck and build passed as reported above. Orchestrator independent verification remains separate from this executor's evidence.
