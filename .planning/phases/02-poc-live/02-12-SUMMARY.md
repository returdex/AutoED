---
phase: 02-poc-live
plan: "12"
subsystem: native-profile-lifecycle
tags: [macos-arm64, playwright, profile-ownership, process-fencing, native-evidence]
requires:
  - phase: 02-poc-live
    plan: "03"
    provides: protected single-holder Profile ownership and confirmed-exit cleanup
  - phase: 02-poc-live
    plan: "05"
    provides: fenced Local Playwright persistent browser provider
  - phase: 02-poc-live
    plan: "07"
    provides: durable AuthJobRunner request and commit fencing
provides:
  - native macOS arm64 Profile permissions, single-instance and confirmed-close evidence
  - native crash, cancellation, stale-authority and exact-owned cleanup evidence
  - macOS N-only temporary ledger writer with Windows/L contamination rejection
affects: [02-13 beta assembly, 02-20 live UAT, AUTH-02, AUTH-04, SEC-02, Phase 3 gate]
tech-stack:
  added: []
  patterns: [fresh protected native harness root, exact registry-owned fault injection, native-authority evidence sink]
key-files:
  created:
    - packages/test-support/src/native-profile-harness.ts
    - tests/native/profile-ownership.test.ts
  modified:
    - .planning/phases/02-poc-live/deferred-items.md
key-decisions:
  - "Native Profile evidence is written only as macOS N from the asserted Darwin/arm64 runner; Windows and L remain not_run/human_needed."
  - "Fault injection and final cleanup require harness registry membership plus installation/job/nonce/PID/OS start/executable/control proof; mismatches are never signalled."
  - "The Codex-like scenario is named native_process_boundary and proves only native process independence, not real Codex or school live UAT."
patterns-established:
  - "Native browser test: copy the pinned managed Chromium into a fresh protected temporary installation, then run the production coordinator/provider against loopback only."
  - "Exact cleanup: reobserve the exact registered child and authenticate its complete proof immediately before a test-only signal."
requirements-completed: []
duration: 14min
completed: 2026-09-01
---

# Phase 2 Plan 12: Native Profile Ownership and Lifecycle Summary

**Pinned Chromium, the production Profile coordinator/browser provider, compiled API/Worker, durable auth fences and a temporary evidence ledger now produce twelve native macOS arm64 lifecycle checks without touching a real Profile or school source.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-09-01T05:50:17Z
- **Completed:** 2026-09-01T06:03:51Z
- **Tasks:** 2 TDD tasks
- **Files modified:** 3 source/test/tracking files

## Accomplishments

- Created a fresh repository-external protected test installation for every case and ran the production `FileProfileOwnershipCoordinator` and `LocalPlaywrightBrowserProvider` against the pinned Chromium 151.0.7922.34 / Playwright 1.62.1 inventory.
- Proved one launch per Profile, pre-launch `PROFILE_IN_USE`, confirmed-exit-only release, higher-generation reopen, old-guard fencing, lease-expiry non-reclaim and three PID/control mismatch failures.
- Ran the compiled production Worker and API in isolated detached processes, kept their identities separate from the owned browser, and allowed signals only after complete harness-owned proof.
- Exercised real SQLite `AuthJobRunner` cancellation/stale-authority boundaries and wrote two temporary macOS N events while rejecting L, Windows and cross-scenario contamination.
- Kept all browser traffic loopback-only and left no temporary Profile, runtime, database, WAL, log, trace, screenshot or browser process behind.

## Native Evidence

- **Platform:** native macOS arm64
- **Evidence class:** N only
- **Browser:** pinned Chromium 151.0.7922.34 through Playwright 1.62.1
- **Scenarios:** permissions, single instance, normal close/reopen, lease fencing, PID/control mismatch, capture boundary, Worker crash, cancellation, authority loss, `native_process_boundary`, exact-owned reclaim and N-only ledger isolation
- **Result:** 12/12 passed with no skipped or todo cases in the full file
- **Not run:** Windows remains `not_run / human_needed`; every L/live cell remains unrun/human-needed
- **Gate:** Phase 1 remains partial, Phase 2 is not globally complete, and Phase 3 remains blocked

The temporary ledger contains only sanitized build/scenario/result metadata. It does not contain an absolute Profile/executable path, PID, nonce/control proof, credential, cookie/storage state, DOM/body, source identity, course or school origin.

## Task Commits

1. **Task 1 RED: native Profile lifecycle behavior** — `3225bb5` (test)
2. **Task 1 GREEN: production coordinator/provider native harness** — `57f073f` (feat)
3. **Task 2 RED: native fault and evidence boundaries** — `05c82d1` (test)
4. **Task 2 GREEN: crash, cancellation, reclaim and evidence isolation** — `8e6c2b0` (feat)
5. **Task 2 cleanup correctness fix** — `775c965` (fix)
6. **Task 2 actual compiled Worker integration** — `4d53517` (fix)
7. **Task 2 actual compiled API integration** — `4aa943e` (fix)

## Files Created/Modified

- `packages/test-support/src/native-profile-harness.ts` — native-only protected install/Profile/browser/process/SQLite harness with exact-owned fault injection and cleanup.
- `tests/native/profile-ownership.test.ts` — twelve macOS native ownership, lifecycle, fencing, process-boundary and evidence-isolation cases.
- `.planning/phases/02-poc-live/deferred-items.md` — records the unrelated existing process-lifecycle fixture failure encountered by the required regression command.

## Verification

- Full Plan 02-12 native file: **12/12 passed**; no skip/todo.
- Native process/platform regression: **8/8 passed**.
- TypeScript typecheck: **passed**.
- Required upstream integration command: `auth-worker` **20/20 passed**; the existing `process-lifecycle` fixture failed during its own synthetic provisioning, including alone, and is recorded as out of scope.
- Static process/capture/source scan: production Profile/browser files gained no broad enumeration, signal or Chromium-lock deletion; harness signal sites follow exact proof checks; no official login or external/school target exists.
- Residual scan after the full run: **0** native harness roots; Git contains no runtime/Profile/database/WAL/log/capture artifact.

## Decisions Made

- Used the installation-managed pinned browser as read-only source inventory and copied it into each fresh harness-owned installation. No real dedicated/everyday/Codex Profile was inspected or reused.
- Kept actual API, Worker and browser lifecycle observations independent. Launcher exit is not browser/Worker exit, and the scenario never writes a real Codex/live pass.
- Bound native evidence outside receipt payloads to `native.macos`, exact source/scenario and evidence N; full AUTH-02/AUTH-04/SEC-02 requirements remain Pending because Windows and required L cells are absent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cleaned failed harness initialization without leaving temporary roots**

- **Found during:** Task 2 verification
- **Issue:** Constructor failures before the harness was returned could leave the exclusively created empty protected parent behind.
- **Fix:** Captured the parent inode/device/canonical identity and removes it only after exact revalidation on initialization failure. Six empty parents created by the initial failed RED/GREEN iteration were checked for exact owner/mode/emptiness and removed with `rmdir`.
- **Files modified:** `packages/test-support/src/native-profile-harness.ts`
- **Verification:** Full 12-case run passes and post-run residual count is zero.
- **Committed in:** `775c965`

**2. [Rule 2 - Missing Critical Verification] Replaced generic service children with compiled production Worker and API**

- **Found during:** Task 2 acceptance review
- **Issue:** Initial crash/boundary coverage used harness-owned detached Node children but did not prove the actual application process compositions remained independent.
- **Fix:** Started compiled `startWorker` and `startApi` with isolated temporary databases and production persistence components, then observed API, Worker and browser identities separately.
- **Files modified:** `packages/test-support/src/native-profile-harness.ts`
- **Verification:** Worker-crash and native-process-boundary cases pass within the full 12-case native run.
- **Committed in:** `4d53517`, `4aa943e`

---

**Total deviations:** 2 auto-fixed (1 cleanup bug, 1 missing critical verification). **Impact:** Both fixes strengthen the approved native harness; neither adds official login, external network, real Profile access, publication or live evidence scope.

The generic requirement-completion update was intentionally not applied. Project policy requires AUTH-02, AUTH-04 and SEC-02 to remain Pending until their complete native/live dual-platform evidence exists.

## Issues Encountered

- The required combined upstream regression passes 20/20 auth-worker cases but the existing `process-lifecycle` fixture stops during its own synthetic provisioning with `HUMAN_ACTION_REQUIRED: initialization interrupted; root preserved`, including when run alone. This plan does not modify Phase 1 provisioning or stop the healthy installed API; the issue is recorded in `deferred-items.md`.

## Known Stubs

None. All twelve named native scenarios execute on Darwin arm64; no conditional pass, skip or synthetic replacement for the native browser/process layer exists.

## Threat Flags

None. The temporary Profile, native process, fault-injection and evidence-writer surfaces are the exact T2-02/T2-04/T2-05/T2-08 boundaries assigned to this plan and are covered by native negative tests.

## Authentication Gates

None. No official page, credential, login, MFA, real source, identity, course or live UAT was requested or accessed.

## User Setup Required

None.

## Next Phase Readiness

- The macOS N ownership/lifecycle prerequisite is available for Plan 02-13 beta assembly.
- Windows remains `not_run / human_needed`; all L scenarios, real Codex exit and school login/account-binding checks remain later hard human gates.
- Phase 1 remains partial, Phase 2 remains in progress and Phase 3 remains blocked.

## Self-Check: PASSED

Both planned files and this summary exist; all seven RED/GREEN/fix commits are present; the 12/12 native file, 8/8 native regressions and typecheck pass; temporary-root residual count is zero; no sensitive/runtime artifact is tracked; and Windows/L/Phase 3 statuses remain unchanged.

---
*Phase: 02-poc-live*
*Completed: 2026-09-01*
