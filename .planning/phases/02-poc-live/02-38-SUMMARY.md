---
phase: 02-poc-live
plan: "38"
subsystem: release-quality
tags: [beta-selection, quality-gate, sensitive-scan, immutable-identity, update-freshness]
requires:
  - phase: 02-poc-live
    plans: ["10", "11", "12", "36", "37", "41"]
    provides: production auth workflow, complete release contracts and fixed quality schemas
provides:
  - immutable unused Phase 2 identity 0.1.0-beta.29
  - exact build-bound five-suite automated test report
  - explicit sanitized permanent invalidation of beta.21 through beta.28
affects: [02-39, 02-13, 02-14 through 02-34, Phase 2 release]
tech-stack:
  added: []
  patterns: [volatile timestamp validation separated from immutable receipt equality, monotonic fresh availability, managed-runtime release gates, source-bound quality receipts]
key-files:
  created:
    - release/phase2-build-selection.json
    - release/phase2-test-report.json
    - .planning/phases/02-poc-live/02-38-BETA-25-INVALIDATION.md
    - .planning/phases/02-poc-live/02-38-BETA-26-INVALIDATION.md
    - .planning/phases/02-poc-live/02-38-BETA-27-INVALIDATION.md
    - .planning/phases/02-poc-live/02-38-BETA-28-INVALIDATION.md
  modified:
    - scripts/release/verify-phase2-update-gate.mjs
    - tests/integration/phase2-release-gates.test.ts
    - tests/integration/phase2-live-gate.test.ts
key-decisions:
  - "Published beta.25 remains immutable public history but is permanently invalidated as an active update candidate; its tag and assets were not changed or deleted."
  - "Volatile availability checkedAt is validated for format, freshness window and strict monotonicity separately from immutable identity/asset equality."
  - "beta.26 through beta.28 were consumed after honest selected-source gate failures; beta.29 is the next fully green monotonic identity."
requirements-completed: []
duration: 1h15min corrective rerun
completed: 2026-09-02
---

# Phase 2 Plan 38: Immutable Beta Quality Binding Summary

**Beta.29 binds the corrected monotonic availability verifier to five freshly green managed-runtime suites; published beta.25 and unpublished beta.26–beta.28 are immutable invalidated history, while every Windows/live/Phase 3 gate remains blocking.**

## Performance

- **Corrective rerun:** approximately 1 h 15 min
- **Tasks:** 2
- **RED/GREEN commits:** 2
- **Fixture correction commits:** 1
- **Invalidation commits:** 4
- **Selection/report commits:** 4 selections, 1 final report

## Selected Identity

| Field | Value |
|---|---|
| Version | `0.1.0-beta.29` |
| Tag | `v0.1.0-beta.29` |
| Source commit | `867fd57fb026d91c1b1355ac6b27f2b219bdb058` |
| Source tree | `67cdb9dadb840040ec57afede394fcc52a722dc8` |
| Build ID | `2f7d10a946a169b72a7681143220c2aaa789f425458615d6854067bd0e6d3f74` |
| Source SHA-256 | `3b6d88ca9b467ae8088a79b92bea1a5663c13bb4041c97b0363ea3a6e7c75a7c` |
| Version-set SHA-256 | `cb5717da334238f3ed849adfb4f724704421148f4624349b611dc3a22928e97a` |
| Selection SHA-256 | `64fa28f1fd1ae033939385079009234ecfa5f10a30bec807ee18514a8fb13952` |
| Test-report SHA-256 | `259e38832d584e6c5d03809f23b0cb4ce97d0a3d57f7d71417a3bd73808cce71` |
| Trust fingerprint | `fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557` |
| License | `PolyForm-Noncommercial-1.0.0` |

Fresh unauthenticated/direct-remote checks confirmed beta.29 had no local tag, remote tag or public release before selection. Its version-set digest consumes every beta from 1 through 28, including unpublished invalidated identities and published invalidated beta.25, so none can be reused.

## Automated Evidence

All commands ran through the repository-approved managed Node `v24.20.0` runtime.

| Suite | Tests | Skipped | Todo | Command SHA-256 |
|---|---:|---:|---:|---|
| Typecheck | 1 command | 0 | 0 | `c8cdec81b63a83f09579ad0f57459db7cda7610a31a3a4d482fc74384df5b02d` |
| Unit | 143 | 0 | 0 | `b98c3b0584afe9dfa05fc96c87f247733c92ebd894229fb80b5e46c6035d8f50` |
| Integration | 349 | 0 | 0 | `b596a73c156f87c41f683dc1f4767070d87cf9eb22ebcb0503bff0ecbf90e0ea` |
| UI | 34 | 0 | 0 | `84d510b7e28d16445e7d3212cabe49a7cd8dd0280e5c5528b395f7527c9a7ca9` |
| macOS native | 24 | 0 | 0 | `50ca1a215155bb52b4fd8ced7a16c49135b26fc0fe3b6e1e6c2cc3882e599c66` |

- Task 1 focused selection gate: **3/3 passed**.
- No `describe/it/test.skip`, `.todo` or `.only` invocation exists in the test tree.
- Sensitive scan: **0 findings** over `tracked`, `history`, `working_tree` and `captured_output`; digest `2a8779e980ad098071cf295faab855d3739ba6b98a27625f706d6c6abbef4469`.
- Scan coverage: 303 tracked/current files (3,994,452 bytes), 953 reachable selected-history blobs with three existing exact reviewed-fixture exceptions, and five fresh beta.29 logs (16,204 bytes).
- Final ignored generated output was rebuilt from the exact selected commit and matches beta.29 commit/tree/build/source identity.

## Invalidation History

| Version | Disposition | Reason |
|---|---|---|
| beta.21–beta.24 | permanently invalidated | Earlier source/prompt/assembly/publisher corrections; exact sanitized records remain authoritative. |
| beta.25 | published, historical, permanently invalidated | The update gate exposed volatile `checkedAt` being compared as immutable. Public tag `v0.1.0-beta.25`, release `380618906` and both assets remain untouched; active local release receipts were removed. |
| beta.26 | unpublished, permanently invalidated | First unit gate ran under host Node 26 and failed 142/143 before the managed-runtime rerun. |
| beta.27 | unpublished, permanently invalidated | Complete integration passed 348/349; the old positive live-gate fixture used a nonmonotonic equal timestamp. |
| beta.28 | unpublished, permanently invalidated | Complete integration passed 348/349; one transient macOS process-observation cleanup failed, and the exact focused recheck then passed without source change. |
| beta.29 | active selection/report only | All five suites, zero-disabled gate and four-surface scan passed freshly. No signing or publication has occurred. |

## Task Commits

1. **RED: define exact fresh-receipt timestamp semantics** — `348e9f4`
2. **GREEN: compare immutable receipt identity separately from volatile time** — `ef52b6c`
3. **Invalidate published beta.25 without remote mutation** — `8547eaf`
4. **Select beta.26** — `7d2ffbe`
5. **Invalidate managed-runtime-failed beta.26** — `078d7dd`
6. **Select beta.27** — `3c8f58c`
7. **Correct the directly related positive live-gate freshness fixture** — `d83415c`
8. **Invalidate stale-fixture beta.27** — `177124b`
9. **Select beta.28** — `926fe7c`
10. **Invalidate transient-failure beta.28** — `867fd57`
11. **Task 1: lock beta.29** — `c7f47c2`
12. **Task 2: bind complete fresh beta.29 quality evidence** — `e35c476`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Update Freshness] Separated volatile observation time from immutable availability identity**

- **Found during:** downstream Plan 02-14 pre-update gate
- **Issue:** A genuinely later anonymous availability observation failed because full-object equality included `checkedAt`.
- **Fix:** Validate timestamp format/window and strict monotonicity separately, then compare every remaining immutable field exactly. Immutable drift remains `UPDATE_GATE_FRESHNESS_MISMATCH`; malformed/stale/future times retain existing fail-closed codes.
- **Commits:** RED `348e9f4`, GREEN `ef52b6c`

**2. [Rule 1 - Direct Fixture Drift] Updated the positive live-gate fixture to be genuinely fresh**

- **Found during:** beta.27 complete integration run
- **Issue:** The older positive fixture supplied equal committed/fresh timestamps and correctly failed under the new contract.
- **Fix:** Changed only the fresh synthetic receipt to a later valid in-window timestamp while keeping immutable fields exact.
- **Commit:** `d83415c`; focused live/release tests passed 34/34.

**3. [Rule 3 - Generated Build Output] Restored the selected beta.29 generated identity**

- **Found during:** final source/build binding
- **Issue:** Integration fixtures rebuilt ignored `dist/build` for their current test identity.
- **Fix:** Rebuilt variant B from selected commit `867fd57` in an isolated local clone, copied only generated output, and revalidated exact commit/tree/build/source binding.
- **Commit:** no tracked source change.

The beta.26 host-runtime failure and beta.28 transient OS process-observation failure were not hidden or converted into passes. Each consumed its selected identity and forced a complete fresh rerun.

## TDD Gate Compliance

The approved correction has an explicit RED/GREEN sequence: `348e9f4` fails the valid-later, nonmonotonic and immutable-drift cases; `ef52b6c` passes them with the narrow fail-closed implementation. The later `d83415c` change updates only a directly related positive fixture exposed by the complete gate.

## Hard Gaps

| Gate | State |
|---|---|
| Windows native | `not_run/human_needed` |
| Live evidence | `not_run/human_needed` |
| Phase 3 | `blocked` |

No automated, publication or macOS-native result creates L authority, Windows evidence or Phase 3 eligibility. AUTH-01 through AUTH-04, SEC-02 and UAT-01 remain pending.

## Known Stubs

None. Explicit `not_run/human_needed` and `blocked` states are hard-gate truth, not placeholders.

## Threat Flags

None. The correction narrows an existing read-only release trust boundary; it adds no endpoint, credential path, persistent schema or source access.

## Authentication Gates

None. No signing key, GitHub authentication, school authentication or MFA was accessed.

## External Mutation Boundary

- No signing, Keychain access, assembly, tag, publication, push, remote mutation, installation or update occurred.
- No login, Profile, school/source, live UAT or EvidenceLedger L action occurred.
- Public beta.25 remains intact as immutable historical data. It is no longer an active install/update candidate and must never be overwritten or deleted by this rerun.

## Next Phase Readiness

- Plan 02-39 must assemble and sign fresh beta.29 artifacts from the exact selection/report. No beta.25–beta.28 artifact, prompt, receipt or result may be reused or relabelled.
- Plan 02-13 must then publish beta.29 through its separate no-overwrite/public-versus-consumed flow before Plan 02-14 can restart.
- Windows native and all live login/reopen/restart/Codex-exit/cross-day/reauth checks remain `not_run/human_needed`; Phase 3 remains blocked.

## Self-Check: PASSED

- Active selection/report files exist and validate to canonical SHA-256 `64fa28f1fd1ae033939385079009234ecfa5f10a30bec807ee18514a8fb13952` and `259e38832d584e6c5d03809f23b0cb4ce97d0a3d57f7d71417a3bd73808cce71`.
- All twelve corrective/invalidation/selection/report commits listed above resolve in Git; no task commit deleted an unrelated tracked file.
- beta.25–beta.28 invalidation records exist; beta.29 remains absent from local/remote tags and public releases.
- Final source/build binding, receipt validation and `git diff --check` pass.

---
*Phase: 02-poc-live*
*Completed: 2026-09-02*
