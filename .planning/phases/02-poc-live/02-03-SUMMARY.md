---
phase: 02-poc-live
plan: "03"
subsystem: profile-ownership
tags: [profile, fencing, process-identity, hmac, protected-files]
requires:
  - phase: 02-poc-live
    plan: "01"
    provides: strict Profile ownership contracts and sealed coordinator port
provides:
  - protected repository-external single-holder Profile reservation and attach
  - fail-closed OS identity plus authenticated control proof inspection
  - confirmed-exit-only ownership cleanup with durable monotonic fence history
affects: [02-05 browser provider, AUTH-04, SEC-02, live Profile recovery]
tech-stack:
  added: []
  patterns: [exclusive reservation before launch, exact process proof, confirmed-exit cleanup, durable high-water fencing]
key-files:
  created:
    - packages/platform/src/profile.ts
    - tests/integration/profile-ownership.test.ts
  modified:
    - packages/contracts/src/index.ts
key-decisions:
  - "An active ownerless reservation is a strict PROFILE_IN_USE/human_needed state; it is not fabricated as an attached owner."
  - "Lease expiry and higher generation/fence values only revoke stale write authority; neither proves browser exit nor permits a second holder."
  - "Only an exact absent-PID observation permits ownership-record removal; running, unknown, PID-reuse and failed-control paths preserve the record."
  - "AUTH-04 and SEC-02 remain Pending because this plan supplies synthetic/integration and current-macOS native regression evidence, not live dual-platform validation."
patterns-established:
  - "Reservation before browser: atomically create the protected ownership record before any future BrowserProvider launch."
  - "Proof before cleanup: installation, build, nonce, PID, OS start identity, exact executable and challenge response must agree; only OS absence permits release."
requirements-completed: []
duration: 11min
completed: 2026-09-01
---

# Phase 2 Plan 03: Protected Profile Ownership Summary

**A repository-external protected Profile now has atomic reservation/attach, monotonic fencing, exact OS plus authenticated-control holder proof, and confirmed-exit-only cleanup without any browser termination path.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-09-01T03:59:12Z
- **Completed:** 2026-09-01T04:10:28Z
- **Tasks:** 2
- **Files modified:** 3 product/test contract files

## Accomplishments

- Implemented `FileProfileOwnershipCoordinator` over the existing application/domain contracts with protected managed paths, bounded strict records, exclusive creation, atomic replacement, file fsync and macOS directory fsync.
- Enforced one reservation/owner, exact reservation-to-owner attach, durable generation/fence high-water state and lease-expiry fencing without reclaim, process start, browser access or Profile content reads.
- Required exact PID, OS start identity, canonical managed executable and challenge-bound HMAC proof to report a running holder; every unknown/mismatch path remains `human_needed` and preserves bytes.
- Allowed release only after a fresh exact-PID observation reports absence, while retaining a protected fence record so stale generations cannot reacquire after cleanup.
- Added eleven synthetic integration negatives covering concurrency, forged identities, path exclusions, PID reuse, OS failure, control failure/timeout/replay, confirmed exit, stale owners and sensitive-output scans.

## Task Commits

Each TDD task was committed through RED then GREEN:

1. **Task 1 RED: protected Profile reservation behavior** — `d22bad6` (test)
2. **Task 1 GREEN: atomic reservation, attach and fencing** — `cbb44ca` (feat)
3. **Task 2 RED: conservative OS/control recovery behavior** — `f22f783` (test)
4. **Task 2 GREEN: exact holder proof and confirmed-exit release** — `f0319b3` (feat)
5. **Task 2 coverage completion: recursive sensitive-output scan** — `cf92b16` (test)

## Files Created/Modified

- `packages/platform/src/profile.ts` — Protected managed Profile coordination, strict durable ownership records, OS/control inspection and confirmed-exit-only release.
- `tests/integration/profile-ownership.test.ts` — Eleven synthetic reservation, fencing, path, proof, recovery and privacy tests.
- `packages/contracts/src/index.ts` — Permits a strict in-use projection for an active reservation that has not yet attached an owner.

## Verification

- Exact plan integration command under managed Node 24.20.0: **11/11 passed**.
- Exact current-native process regression command on macOS arm64: **2/2 passed**. This is a macOS N-layer regression only, not live evidence and not Windows evidence.
- `npm run typecheck` under managed Node 24.20.0: **passed**.
- Existing auth-contract regression: **24/24 passed**.
- Concurrency-focused integration file repeated three times during Task 1: **4/4 passed on every run**.
- Production termination/privacy scan: **zero matches** for process termination commands, browser-state export terms, planning paths or the legacy root.
- Test network/source scan: **zero Moodle, EdStem or HTTP(S) target matches**; fixtures use only temporary protected directories and injected observations/proofs.
- Forbidden platform dependency scan: **zero Playwright, Fastify, SQLite, status UI or MCP imports**.

All automated evidence is S/I, except the separately identified current-macOS low-level N regression. No browser was opened, no installed service was stopped, no school source was contacted, no Profile contents were inspected, no credentials were requested, and no L receipt was created.

## Decisions Made

- Represented a conflicting pre-attach reservation as ownerless `in_use/PROFILE_IN_USE` rather than inventing process identity or weakening single-holder semantics.
- Stored generation/fence high-water values with active ownership and retained a separate protected fence record after confirmed release so lease expiry and stale callers cannot become cleanup authority.
- Kept authenticated control fixed to a random challenge over the complete owner identity and verified it using the installation-level secret plus timing-safe comparison.
- Preserved Phase 1 partial status, Windows `not_run / human_needed`, Phase 2 live/native gaps and the Phase 3 hard block. AUTH-04 and SEC-02 remain Pending.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Represented conflicting reservations in the strict ownership schema**
- **Found during:** Task 1 GREEN
- **Issue:** The existing `ProfileOwnershipSchema` required a non-null attached owner for every `PROFILE_IN_USE` result, so the mandatory losing concurrent reservation could not be represented without fabricating a PID/process identity.
- **Fix:** Allowed `in_use/PROFILE_IN_USE` with a valid reservation and null owner, while retaining exact reservation/owner equality whenever an owner is present.
- **Files modified:** `packages/contracts/src/index.ts`
- **Verification:** 24/24 auth-contract tests and 11/11 Profile integration tests pass; the concurrent loser parses through the strict schema.
- **Committed in:** `cbb44ca`

---

**Total deviations:** 1 auto-fixed (1 missing critical functionality). **Impact:** The fix was necessary to satisfy the existing sealed coordinator contract without fabricating ownership evidence; no source, browser, persistence or live scope was added.

The generic requirement-completion update was intentionally not applied. AGENTS.md and the approved validation strategy require AUTH-04 and SEC-02 to remain Pending until their full required native/live evidence exists.

## Issues Encountered

- Two initially parallel managed-runtime wrapper invocations raced while both re-extracted the same authenticated Node toolchain. Verification was switched to sequential execution; the pinned Node 24.20.0 executable remained valid, and the exact wrapper commands later passed sequentially. No product, installation or service state was changed.

## Known Stubs

None.

## Authentication Gates

None. This plan did not authenticate, request secrets, access a source, read the dedicated Profile or open a browser.

## User Setup Required

None.

## Next Phase Readiness

- The coordinator is ready for the approved Plan 02-05 Local Playwright BrowserProvider integration after intervening dependencies execute.
- Shared Moodle/EdStem Profile behavior remains a live hypothesis. Windows stays `not_run / human_needed`; Phase 1 remains partial, Phase 2 is not globally passed and Phase 3 remains blocked.

## Self-Check: PASSED

All three created/modified product and test files plus this summary exist. RED/GREEN and coverage commits `d22bad6`, `cbb44ca`, `f22f783`, `f0319b3` and `cf92b16` are present in repository history; targeted integration, current-macOS native regression, strict-contract regression, typecheck and static security gates pass.

---
*Phase: 02-poc-live*
*Completed: 2026-09-01*
