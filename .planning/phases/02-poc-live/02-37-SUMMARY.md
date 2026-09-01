---
phase: 02-poc-live
plan: "37"
subsystem: release-evidence-gates
tags: [live-evidence, native-evidence, sqlite, release-gates, exact-cli, tdd]
requires:
  - phase: 02-poc-live
    plan: "35"
    provides: closed 44-cell L registry, 14 named S/I/N obligations and durable live actions
  - phase: 02-poc-live
    plan: "36"
    provides: fixed paired workflow endpoints and server-observed live results
provides:
  - immutable macOS/Windows live checkpoint, audit and final gate CLI
  - strict macOS/Windows pre/post update verifier
  - current-build native S/I/N producer with transactional server-held authority
  - redacted current artifact, manifest and runtime-generation projection
affects: [02-14 through 02-34, 02-38 through 02-41, Phase 2 release, Phase 3 gate]
tech-stack:
  added: []
  patterns: [closed argv grammar, pass-only planning handoff, server-derived automated authority, generation-filtered evidence projection]
key-files:
  created:
    - scripts/release/phase2-live-gate.mjs
    - scripts/release/verify-phase2-update-gate.mjs
    - scripts/release/phase2-native-evidence.mjs
  modified:
    - packages/domain/src/live-evidence.ts
    - packages/contracts/src/live-evidence.ts
    - packages/application/src/live-checkpoints.ts
    - packages/persistence/src/database.ts
    - packages/persistence/src/auth.ts
    - apps/api/src/auth.ts
    - apps/api/src/main.ts
    - packages/client/src/http.ts
    - tests/integration/phase2-live-gate.test.ts
key-decisions:
  - "The verifier reads only fixed redacted API projections and exact L receipt cells; feedback and SUMMARY files never gain ledger authority."
  - "Native S/I/N authority is created inside the server from the actual OS, signed active artifact/manifest, current build and current runtime generation."
  - "D waiting is a deterministic exit-2 human-needed state; absence of due evidence can never become pass or trigger source work."
patterns-established:
  - "Pass-only handoff: failed or human-needed feedback never writes an A1/A2 receipt or produces a B3/reauth pass block."
  - "Build obligation bundle: one SQLite transaction records the native run and fixed named obligations, while L remains in the separate live ledger."
requirements-completed: []
duration: 55min
completed: 2026-09-01
---

# Phase 2 Plan 37: Immutable Release Evidence Gates Summary

**Exact live/update verifiers and a transactional server-derived native S/I/N producer now bind every release decision to the current signed artifact, build and runtime generation while leaving all unrun L evidence visible.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-01T08:50:42Z
- **Completed:** 2026-09-01T09:44:02Z
- **Tasks:** 3 TDD tasks
- **Files modified:** 20 production/test files plus 2 planning artifacts

## Accomplishments

- Implemented all four exact record forms. A1/A2 accept only strict pass feedback and current server-observed macOS/L digests before 0600 atomic no-replace publication; B3/reauth return zero-file pass handoffs.
- Implemented every macOS and Windows A1/A2/B1/B2/B3/C/D/reauth branch, both platform audits, immutable receipt verification and the dual-platform final conjunction.
- Implemented strict update pre/post modes with exact fixed receipt/artifact/test/publication/availability/prompt paths, native-platform checks, WSL rejection, freshness checks and stable completion codes.
- Added SQLite v5 native-run and named-obligation persistence plus a local-CLI-only API. The server derives actual platform/build/artifact/manifest/generation authority and cannot write L.
- Added current-generation filtering to redacted receipt reads so a same-build result from an older service generation cannot satisfy a live gate.

## Branch and Code Coverage

| Checkpoint | macOS pass code | Windows pass code |
|---|---|---|
| A1 | `A1_AUTHENTICATED` | `WINDOWS_A1_COMPLETE` |
| A2 | `A2_COMPLETE` | `WINDOWS_A2_COMPLETE` |
| B1 rounds 1/2/3 | `B1_REOPEN_<round>_COMPLETE` | `WINDOWS_B1_REOPEN_<round>_COMPLETE` |
| B2 | `B2_WORKER_RESTARTED` | `WINDOWS_B2_WORKER_RESTART_COMPLETE` |
| B3 | `B3_COMPLETE` | `WINDOWS_B3_CODEX_EXIT_COMPLETE` |
| C | `C_OS_RESTART_COMPLETE` | `WINDOWS_C_OS_RESTART_COMPLETE` |
| D | `D_24H_RECHECK_COMPLETE` | `WINDOWS_D_24H_RECHECK_COMPLETE` |
| reauth | `REAUTH_COMPLETE` | `WINDOWS_REAUTH_COMPLETE` |

- D additionally returns `D_NOT_DUE` / `D_READY_NOT_RUN` or the Windows-prefixed equivalents as non-mutating `human_needed` output; the command exits 2.
- Update preflight returns `MACOS_UPDATE_READY` / `WINDOWS_UPDATE_READY`; post-update returns `UPDATE_COMPLETE` / `WINDOWS_UPDATE_COMPLETE`.
- Both audits prove 22 exact L cells per platform. The final test proves the only success path is 44/44 current L cells, 14/14 current build/generation obligations and Phase 1 complete.
- Missing final evidence remains explicit: an empty runtime reports 44 live gaps, 14 build-obligation gaps and the Phase 1 gap.

## Evidence Boundary

- **Evidence created by this execution:** synthetic/integration/native test evidence only, in temporary test stores.
- **Live evidence:** no real L event, login, source visit or pass record was created. The production native writer has no L authority.
- **Planning handoffs:** no A1/A2 receipt was created in the repository; tests used protected temporary roots. Failed/human-needed branches write no pass handoff.
- **Preserved hard gates:** all 44 real L cells remain missing; Windows remains `not_run / human_needed`; Phase 1 remains partial; Phase 3 remains blocked; requirements remain Pending.
- **Not performed:** no official login/MFA, Profile access, school/course access, publication, remote operation or user checkpoint.

## Task Commits

1. **Task 1 RED: immutable live gate failures** — `af1d3ef` (test)
2. **Task 1 GREEN: immutable live checkpoint/audit/final gate** — `44fb5e1` (feat)
3. **Task 2 RED: immutable update gate failures** — `04954d0` (test)
4. **Task 2 GREEN: macOS/Windows update verification** — `fd10042` (feat)
5. **Task 3 RED: native producer contract** — `00053e2` (test)
6. **Task 3 RED: server native bundle transaction** — `cf21710` (test)
7. **Task 3 GREEN: production native authority and runtime surface** — `d20fcb9` (feat)
8. **Final conjunction coverage** — `2061461` (test)

## Files Created/Modified

- `scripts/release/phase2-live-gate.mjs` — closed record/verify/audit/final grammar, strict feedback/receipt schemas, exact platform codes, D clock states and atomic handoffs.
- `scripts/release/verify-phase2-update-gate.mjs` — strict fixed-path pre/post update identity and freshness checks for macOS and Windows.
- `scripts/release/phase2-native-evidence.mjs` — fixed installed command that combines signed cross-platform reports with bounded packaged native diagnostics.
- `packages/domain/src/live-evidence.ts`, `packages/contracts/src/live-evidence.ts` — native binding/command/bundle/runtime projection types and strict fixed obligation schemas.
- `packages/application/src/live-checkpoints.ts` — server-only automated authority, exact requiredness and current-runtime binding.
- `packages/application/src/ports.ts`, `packages/application/src/policy.ts` — current-generation receipt query boundary.
- `packages/persistence/src/database.ts`, `packages/persistence/src/auth.ts` — SQLite v5 native run/obligation tables, idempotency, failure retention and generation-filtered reads.
- `apps/api/src/auth.ts`, `apps/api/src/main.ts`, `apps/api/src/security.ts` — redacted runtime projection and local-CLI-only native evidence endpoint.
- `packages/client/src/http.ts` — fixed gate/runtime/native/receipt client methods without arbitrary URL or operation selection.
- `packages/installer/src/launchers.ts` — signed release artifact digest persisted in new active records while legacy active records remain readable for upgrade.
- `tests/integration/phase2-live-gate.test.ts`, `tests/integration/auth-api.test.ts`, `tests/integration/auth-persistence.test.ts`, `tests/integration/install-preview.test.ts` — exhaustive grammar, API authority, schema-v5, generation and artifact identity coverage.
- `.planning/phases/02-poc-live/deferred-items.md` — records the existing fixed-port verification conflict.

## Verification

- Managed Node 24.20.0 typecheck: **passed**.
- Focused gate/API/persistence/security/workflow integration surface: **58/58 passed**.
- Complete native suite: **24/24 passed**.
- Gate command file: **15/15 passed**, including four record forms, every downstream read-only branch, both audits, blocked final and complete final.
- Core API/persistence subset after schema v5 and generation filtering: **38/38 passed**.
- `git diff --check`: **passed**.
- Stub/sensitive scan: no TODO/FIXME/placeholder production branch; no real Profile, credential, source, database/WAL, feedback or live-result artifact entered Git.

## Decisions Made

- Kept final-gate possible counts (176) separate from required live counts (44), and consumed the exact Plan 35 registry rather than recreating requiredness from observations.
- Required exact macOS B1 `--a2` predecessor input while preserving the approved Windows B1 grammar without a planning receipt.
- Persisted failed native runs for audit but wrote no named pass obligation and emitted no pass handoff for them. Prior successful obligations remain immutable.
- Extended the signed active installation record with the release artifact digest. Legacy records remain readable only for upgrade; the Phase 2 runtime fails closed unless the new current artifact identity exists.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added the minimum production server authority and persistence surface**

- **Found during:** Task 3 (native S/I/N production)
- **Issue:** A CLI-only or dependency-injected producer could not create production evidence securely; the server lacked current artifact/generation projection, fixed named-obligation persistence and transactional automated authority.
- **Fix:** Added strict domain/contracts, SQLite v5 tables/store, server-only WeakSet authority, local-CLI API permission/route, fixed client methods and production runtime binding.
- **Files modified:** `packages/domain/src/live-evidence.ts`, `packages/contracts/src/live-evidence.ts`, `packages/application/src/live-checkpoints.ts`, `packages/persistence/src/database.ts`, `packages/persistence/src/auth.ts`, `apps/api/src/auth.ts`, `apps/api/src/main.ts`, `apps/api/src/security.ts`, `packages/client/src/http.ts`
- **Verification:** 38/38 core gate/API/persistence tests, 58/58 combined focused integration tests, 24/24 native tests and typecheck pass.
- **Committed in:** `d20fcb9`

**2. [Rule 1 - Security Bug] Bound receipt reads and active artifact identity to the current runtime**

- **Found during:** Task 3 production-surface review
- **Issue:** A same-build receipt from an old generation could be returned by the redacted API, and the runtime initially projected the CLI file hash rather than the installed release artifact digest.
- **Fix:** Filtered API receipt reads by the server's expected generation and persisted the verified release artifact digest in new signed active records, with legacy-read compatibility for upgrades and fail-closed Phase 2 startup.
- **Files modified:** `packages/application/src/ports.ts`, `packages/application/src/policy.ts`, `packages/persistence/src/auth.ts`, `packages/installer/src/launchers.ts`, `apps/api/src/main.ts`, `tests/integration/auth-persistence.test.ts`, `tests/integration/install-preview.test.ts`
- **Verification:** generation-isolation integration test, focused integration suite and typecheck pass.
- **Committed in:** `d20fcb9`

**3. [Rule 1 - Contract Bug] Corrected downstream grammar, codes and D waiting semantics before release**

- **Found during:** exhaustive Plans 14-34 command audit
- **Issue:** Initial branches omitted the macOS B1 `--a2` form, used non-round B1 and several noncanonical platform codes, accepted alternate update paths and treated an empty D cell as a generic error rather than the required non-mutating waiting state.
- **Fix:** Implemented byte-for-byte fixed forms, exact pass codes, strict A1/A2 predecessor schemas, exact update paths/codes and D server-time `human_needed` projections with exit 2.
- **Files modified:** `scripts/release/phase2-live-gate.mjs`, `scripts/release/verify-phase2-update-gate.mjs`, `tests/integration/phase2-live-gate.test.ts`
- **Verification:** all 15 gate tests and the complete final conjunction pass.
- **Committed in:** `d20fcb9`, `2061461`

**4. [Rule 3 - Blocking] Advanced shared schema and release-report compatibility**

- **Found during:** Task 3 schema/API integration
- **Issue:** Existing migration fixtures stopped at v4, and the update/native tools initially expected incompatible shapes for the same signed Phase 2 test report.
- **Fix:** Advanced current/future migration assertions to v5 and defined one exact signed report shape with eight named cross-platform obligation digests consumed by both tools.
- **Files modified:** `tests/integration/auth-persistence.test.ts`, `scripts/release/verify-phase2-update-gate.mjs`, `scripts/release/phase2-native-evidence.mjs`, `tests/integration/phase2-live-gate.test.ts`
- **Verification:** schema migration, update preflight, native requiredness and typecheck pass.
- **Committed in:** `d20fcb9`

---

**Total deviations:** 4 auto-fixed (2 correctness/security bugs, 1 missing critical production surface, 1 blocking compatibility issue). **Impact:** All changes are required to make the approved verifier/producer production-capable and fail closed; no source, Profile, live or publication scope was added.

Every upstream deviation file is listed above. Shared `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md` and requirement-completion tracking were intentionally left unchanged for the sequential phase orchestrator; the six requirements remain Pending until real evidence and hard human gates pass.

## Issues Encountered

- The existing installed Phase 1 API owns fixed loopback port `43187`. The repository-wide unit run therefore remains **138/142**, and the later installer-focused attempt remains **1/4**, solely on `PORT_CONFLICT_REPREVIEW`. The installed detached service was not stopped or modified; the conflict is recorded in `deferred-items.md`.

## Known Stubs

None. `phase1: partial`, 44 missing L cells, Windows human-needed status and Phase 3 blocking are intentional hard-gate state, not placeholders.

## Threat Flags

None. The new runtime endpoint, local-CLI native writer and SQLite tables are the exact runtime/native authority surfaces assigned to T2-37-02/T2-37-03; tests cover model/MCP rejection, payload authority rejection, L rejection, cross-platform rejection and failed-run isolation.

## Authentication Gates

None encountered or invoked. No official login, MFA, Profile or source action was attempted.

## User Setup Required

None.

## Next Phase Readiness

- Plans 14-34 and 38-41 can consume a fixed signed grammar without editing these verifier branches after release.
- Release remains correctly blocked: Phase 1 is partial, all 44 real L cells are missing, Windows is human-needed and Phase 3 is blocked.
- The future Phase 2 test report must use the exact shared obligation shape validated here; assembly must package that report and the fixed diagnostic runner before the native command can run from an installed beta.

## Self-Check: PASSED

All 13 key production/test files and this summary exist; all eight RED/GREEN/final-coverage commits resolve in Git; 58/58 focused integration tests, 24/24 native tests, the 15/15 gate file, typecheck and `git diff --check` pass. No runtime database/WAL, feedback, live receipt, secret, Profile data or publication artifact was created. Shared STATE/ROADMAP/REQUIREMENTS tracking remains unchanged for the orchestrator, and the existing installed service was not modified.

---
*Phase: 02-poc-live*
*Completed: 2026-09-01*
