---
phase: 02-poc-live
plan: "04"
subsystem: auth-state-machine
tags: [typescript, pure-reducer, account-binding, bounded-recovery, fail-closed]
requires:
  - phase: 02-poc-live
    plan: "01"
    provides: strict source observations, probe results, identity evidence, account bindings and sealed probe port
provides:
  - pure Moodle-first then EdStem authentication reducer with fixed effects
  - strict cross-source binding decision and sticky identity-mismatch fence
  - source-isolated failure classification, last-success retention and bounded recovery decisions
affects: [02-07 auth worker, 02-08 paired auth API, source adapters, Phase 3 hard gate]
tech-stack:
  added: []
  patterns: [immutable event reducer, exhaustive typed failures, fixed-effect authorization ceiling, retained confirmed binding]
key-files:
  created:
    - packages/application/src/auth.ts
    - tests/unit/auth-state.test.ts
  modified: []
key-decisions:
  - "Identity mismatch keeps the previous confirmed binding separately and remains globally blocked until both sources are positively reobserved and a new explicit confirmation arrives."
  - "Only natural reauthentication and explicitly temporary network failures schedule recovery, with fixed delays 0, 5000 and 30000 milliseconds and no fourth attempt."
  - "Course access eligibility is derived only from two currently authenticated sources plus a confirmed binding; the reducer never emits a course-read effect."
  - "AUTH-01/AUTH-03/SEC-02 remain Pending because this plan produces only synthetic unit evidence."
patterns-established:
  - "Reducer effects are the authorization ceiling: fixed auth probe, bounded schedule, source pause or explicit human action only."
  - "Current failure and retained success are separate per-source state; one source failure cannot rewrite the other source."
requirements-completed: []
duration: 8min
completed: 2026-09-01
---

# Phase 2 Plan 04: Dual-Source Auth State Machine Summary

**A pure Moodle→EdStem reducer now enforces positive authentication evidence, strict account binding, sticky mismatch blocking and three-attempt source-isolated recovery without performing I/O or claiming live evidence.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-09-01T04:14:55Z
- **Completed:** 2026-09-01T04:23:51Z
- **Tasks:** 1 TDD feature
- **Files modified:** 2 product/test files plus the existing phase deferred-items ledger

## Accomplishments

- Added an immutable dual-source state with independent auth, capability, health, freshness, completeness, identity, full last-success probe, logout intent and recovery counters.
- Required approved-origin match, an explicit positive marker, authenticated structured observation and typed identity before Moodle can produce the fixed EdStem auth probe.
- Added strict candidate/manual/mismatch binding decisions that ignore display-name/email hints, retain prior confirmed fingerprints and hard-block all course eligibility on drift or conflicts.
- Classified authentication, expiry, network, parser, capability, interaction, origin, identity and unknown outcomes without leaking arbitrary result text or erasing prior success.
- Proved explicit logout never retries, while natural expiry and explicitly temporary network failure use exactly `0`, `5000`, `30000` millisecond scheduling decisions and stop before a fourth attempt.

## Task Commits

The TDD feature was committed through RED and GREEN, followed by a focused critical-coverage addition:

1. **RED: failing dual-source auth behavior contract** — `f31fce1` (test)
2. **GREEN: pure dual-source auth state machine** — `ca69436` (feat)
3. **Coverage completion: mismatch recovery fence** — `c373473` (test)

No separate REFACTOR commit was necessary. GREEN already extracted total pure helpers and exhaustive `never` checks; the post-GREEN review made no production-code changes.

## Files Created/Modified

- `packages/application/src/auth.ts` — Pure state, events, binding comparator, failure classifier and fixed effects for the Moodle→EdStem flow.
- `tests/unit/auth-state.test.ts` — 31 table-driven S tests covering ordering, positive evidence, binding, mismatch, isolation, retention, retries, immutable inputs and evidence boundaries.
- `.planning/phases/02-poc-live/deferred-items.md` — Re-records the known fixed-port full-suite conflict for this plan without stopping the installed service.

## Verification

- RED under managed Node 24.20.0: **failed as required** because `packages/application/src/auth.ts` did not exist; no test was skipped or marked TODO.
- `npm run typecheck` under managed Node 24.20.0: **passed**.
- Focused plan command across `auth-state`, `auth-contracts` and `import-boundaries`: **61/61 passed**.
- New reducer suite alone: **31/31 passed**.
- Export scan: **passed** for `AUTH_RECOVERY_DELAYS_MS`, `AuthEffect`, `AuthTransition`, `createAuthFlowState`, `reduceAuthFlow` and `decideAccountBinding`.
- Fixed-effect scan: **passed**; the implementation contains only `moodle.auth_probe` and `edstem.auth_probe` probe actions.
- Forbidden driver/capability scan: **zero matches** for Playwright, SQLite, Fastify, filesystem/process drivers, timers, browser/Profile state, source writes, evidence receipts or phase eligibility.
- Repository-wide unit attempt: **95/99 passed**. The only four failures are the existing `credential-redaction.test.ts` fixed-port cases while the healthy installed Phase 1 API owns loopback port 43187.

All results are synthetic S evidence. No external network was contacted by the tests, and the plan did not open a browser, access a source, read a Profile, persist runtime data, create a receipt, publish a beta or perform login/MFA.

## Decisions Made

- Used a separate `confirmedBinding` snapshot so a mismatch can become the active blocking decision without destroying the last user-confirmed relationship.
- Required positive reobservation of both sources before a manual confirmation may replace a mismatch binding; repeated events or one-source success cannot clear the fence.
- Preserved source-local current status separately from full prior `SourceProbeResult`, including its identity and checked time.
- Kept interaction, origin mismatch, parser change, permission denial, explicit logout and unknown results out of automatic recovery.
- Preserved Phase 1 partial status, Windows `not_run / human_needed`, Phase 2 live/native gaps and the Phase 3 hard block. AUTH-01, AUTH-03 and SEC-02 remain Pending.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added an explicit two-source mismatch recovery fence test**
- **Found during:** Post-GREEN acceptance review
- **Issue:** The initial RED suite proved mismatch was sticky across repeated events but did not explicitly prove that the old confirmed binding survives or that both sources must be reobserved before a new manual confirmation can clear the block.
- **Fix:** Added a complete mismatch → rejected early confirmation → Moodle reobservation → EdStem reobservation → explicit confirmation sequence.
- **Files modified:** `tests/unit/auth-state.test.ts`
- **Verification:** Reducer suite passes 31/31 and focused plan suite passes 61/61.
- **Committed in:** `c373473`

---

**Total deviations:** 1 auto-fixed (1 missing critical verification). **Impact:** The additional test closes a T2-03 regression gap without changing architecture, I/O authority or live scope.

The generic requirement-completion update was intentionally not applied. AGENTS.md and the approved validation strategy require AUTH-01, AUTH-03 and SEC-02 to remain Pending until all required evidence classes, including native/live evidence, exist.

## Issues Encountered

- The repository-wide unit command cannot run four existing installation credential tests while the installed Phase 1 API owns fixed loopback port 43187. Per project instructions, the service was not stopped and Phase 1 fixed-port behavior was not changed. This pre-existing environment conflict is recorded in `deferred-items.md`; all Plan 02-04 focused tests pass.

## Known Stubs

None.

## Threat Flags

None. The new reducer is the exact pure authentication/binding surface covered by the plan's T2-01, T2-03 and T2-06 threat register; it introduces no network, browser, file, persistence or transport boundary.

## Authentication Gates

None. This plan did not authenticate, access school sources, open the dedicated Profile or request user secrets.

## User Setup Required

None.

## Next Phase Readiness

- The pure reducer is ready for Plan 02-07's durable Worker/retry/fencing integration after Plans 02-05 and 02-06 provide the approved browser and adapter dependencies.
- The fixed-port full-suite conflict remains for a later approved maintenance window; it does not convert the focused synthetic result into native or live evidence.
- Windows remains `not_run / human_needed`; Phase 1 remains partial, Phase 2 is not globally passed and Phase 3 remains blocked.

## Self-Check: PASSED

Both created product/test files, the phase deferred-items ledger and this summary exist. RED/GREEN/coverage commits `f31fce1`, `ca69436` and `c373473` are present in repository history; managed typecheck, the 61-test focused suite and all static boundary gates pass.

---
*Phase: 02-poc-live*
*Completed: 2026-09-01*
