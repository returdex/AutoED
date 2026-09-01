---
phase: 02-poc-live
plan: "01"
subsystem: auth-contracts
tags: [zod, source-probes, profile-ownership, evidence-ledger, architecture-boundaries]
requires:
  - phase: 01-beta
    provides: strict Zod contracts, process identity, generation-aware writes and authenticated client boundary
provides:
  - fixed Moodle/EdStem read-only source probe contracts
  - fail-closed account binding and Profile ownership proof contracts
  - exact S/I/N/L native-platform evidence cells and Phase 3 hard gate
  - sealed application ports for later persistence and adapter plans
affects: [02-02 persistence, 02-03 profile coordinator, source adapters, live evidence ledger, Phase 3 gate]
tech-stack:
  added: []
  patterns: [strict discriminated runtime contracts, synthetic-only evidence factory, sealed application ports]
key-files:
  created:
    - packages/test-support/src/auth-fixture.ts
    - tests/unit/auth-contracts.test.ts
  modified:
    - packages/domain/src/model.ts
    - packages/contracts/src/index.ts
    - packages/application/src/ports.ts
    - tests/unit/import-boundaries.test.ts
key-decisions:
  - "Synthetic factories are structurally fixed to evidence S and cannot accept evidence or provenance overrides."
  - "Phase 1 remains partial, Windows live evidence remains not_run/human_needed, and Phase 3 remains blocked until the complete dual-platform matrix passes."
  - "AUTH-01/AUTH-02/AUTH-03/SEC-02/UAT-01 remain Pending because contract tests are not live or native validation."
patterns-established:
  - "Admission before drivers: a source operation is one of four source-matched actions carrying only approved configuration references."
  - "Ownership before cleanup: only confirmed_exited yields cleanup_allowed; lease and fence values never prove exit."
  - "Evidence cells use the complete platform/source/scenario/evidence key and trusted writer authority remains outside receipt payloads."
requirements-completed: []
duration: 9min
completed: 2026-09-01
---

# Phase 2 Plan 01: Auth Boundary Contracts Summary

**Strict source/action, account-binding, Profile-ownership and evidence-cell contracts now fail closed before any school page, browser driver, live writer or persistent store is introduced.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-09-01T03:19:30Z
- **Completed:** 2026-09-01T03:28:16Z
- **Tasks:** 2
- **Files modified:** 6 planned product/test files

## Accomplishments

- Added per-source orthogonal observations, approved origin confirmation, stable identity evidence and human-confirmed binding contracts; `identity_mismatch` always blocks course access.
- Added reservation/owner proof and ownership-state refinements so running or unknown holders require human action and only confirmed exit permits stale-record cleanup.
- Added exact native-platform evidence receipts/cells, a synthetic-only S factory and a dual-platform Phase 3 gate that cannot be cleared by macOS or synthetic evidence.
- Added seven narrow application ports and transitive import tests that reject application driver imports and MCP bypasses while preserving the existing authenticated client allowlist.

## Task Commits

Each task followed RED then GREEN and was committed atomically:

1. **Task 1 RED: Phase 2 auth boundary behavior** — `2e4d4df` (test)
2. **Task 1 GREEN: strict source, ownership and evidence contracts** — `d277814` (feat)
3. **Task 2 RED: sealed port and transitive import boundaries** — `27c2f67` (test)
4. **Task 2 GREEN: source/Profile/store/evidence ports** — `f8be022` (feat)

## Files Created/Modified

- `packages/domain/src/model.ts` — Pure Phase 2 source, identity, ownership, receipt/cell and gate types.
- `packages/contracts/src/index.ts` — Strict Zod schemas with cross-field source, binding, ownership, provenance and gate refinements.
- `packages/application/src/ports.ts` — Sealed probe/config/observation/binding/ownership/evidence interfaces.
- `packages/test-support/src/auth-fixture.ts` — Synthetic rejection receipt factory fixed to evidence S.
- `tests/unit/auth-contracts.test.ts` — 24 source, binding, ownership, evidence and hard-gate behavior tests.
- `tests/unit/import-boundaries.test.ts` — Real graph plus synthetic direct/transitive layering negatives.

## Verification

- `npm run typecheck`: **passed**.
- Plan-targeted unit run: **36/36 passed** across `auth-contracts`, existing `contracts`, and `import-boundaries`.
- Task 1 focused behavior run: **24/24 passed**; existing Phase 1 contract regression: **6/6 passed**.
- Task 2 import-boundary run: **6/6 passed**, including real repository graph and synthetic driver/MCP bypass negatives.
- Security static scan across domain, ports and synthetic fixture: **zero prohibited field matches**.
- Repository-wide unit attempt under managed Node 24.20.0: **65/69 passed**; four pre-existing credential-installation cases could not bind fixed port 43187 while the installed API remained active.

All produced receipts in this plan are synthetic S rejection evidence. No native or live result, school access, official login, Profile read, browser start, persistence write, publication or Phase 3 eligibility was produced.

## Decisions Made

- Kept raw protected-local identity separate from receipt/gate types; binding contracts use only stable fingerprints and approved scope evidence.
- Required a human-action receipt for confirmed binding and L evidence; display-name or email equality cannot confirm a binding.
- Preserved Phase 1 partial status and the macOS-first ordering exception exactly: Windows remains `not_run / human_needed`, Phase 2 is not globally passed, and Phase 3 stays blocked.
- Kept all listed requirements Pending. This plan supplies S contract evidence only and cannot satisfy their required native/live evidence classes.

## Deviations from Plan

None - implementation scope followed the approved plan exactly.

The generic executor requirement-completion update was intentionally not applied because AGENTS.md and the approved validation strategy require AUTH-01/AUTH-02/AUTH-03/SEC-02/UAT-01 to remain Pending until their full S/I/N/L evidence is present.

## Issues Encountered

- The repository-wide unit command first used host Node 26 instead of the pinned Node 24.20.0. Re-running through the approved managed toolchain cleared that failure.
- Four existing `credential-redaction.test.ts` cases require exclusive fixed port 43187, which the healthy installed Phase 1 API currently owns. Stopping that installed service or changing Phase 1 fixed-port behavior is outside Plan 02-01, so the exact conflict is recorded in `deferred-items.md`. All Plan 02-01 targeted tests pass.

## Known Stubs

None.

## Authentication Gates

None. This plan did not authenticate, access school sources, open the dedicated Profile or request user secrets.

## User Setup Required

None.

## Next Phase Readiness

- Ready for Plan 02-02 to implement the transactional stores behind these interfaces.
- Full-suite orchestration should use the managed Node 24 toolchain and an approved maintenance window where fixed port 43187 is available; this does not alter the Plan 02-01 targeted result.
- Windows native/live cells remain `not_run / human_needed`; Phase 1 remains partial and Phase 3 remains blocked.

## Self-Check: PASSED

All six planned product/test files and this summary exist. RED/GREEN commits `2e4d4df`, `d277814`, `27c2f67` and `f8be022` are present in repository history; targeted verification and static security gates pass.

---
*Phase: 02-poc-live*
*Completed: 2026-09-01*
