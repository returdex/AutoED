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
  - immutable unused Phase 2 identity 0.1.0-beta.30
  - exact build-bound five-suite automated test report
  - explicit sanitized permanent invalidation of beta.21 through beta.29
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
    - .planning/phases/02-poc-live/02-38-BETA-29-INVALIDATION.md
  modified:
    - scripts/release/verify-phase2-update-gate.mjs
    - tests/integration/phase2-release-gates.test.ts
    - tests/integration/phase2-live-gate.test.ts
key-decisions:
  - "Published beta.25 remains immutable public history but is permanently invalidated as an active update candidate; its tag and assets were not changed or deleted."
  - "Volatile availability checkedAt is validated for format, freshness window and strict monotonicity separately from immutable identity/asset equality."
  - "Published beta.29 is permanently invalidated as availability-unproven after its first and only anonymous verifier attempt produced no availability receipt; its public objects remain untouched."
  - "beta.30 is the next fully green monotonic identity and consumes all beta.1 through beta.29 history."
requirements-completed: []
duration: 1h39min cumulative corrective reruns
completed: 2026-09-02
---

# Phase 2 Plan 38: Immutable Beta Quality Binding Summary

**Beta.30 binds unchanged corrected production source to five freshly green managed-runtime suites after published beta.29 failed closed as availability-unproven; all historical public objects remain immutable while every Windows/live/Phase 3 gate remains blocking.**

## Performance

- **Corrective reruns:** approximately 1 h 39 min cumulative
- **Beta.30 availability-race rollover:** 24 min
- **Tasks:** 2
- **RED/GREEN commits:** 2
- **Fixture correction commits:** 1
- **Invalidation commits:** 5
- **Selection/report commits:** 5 selections, 2 complete reports; beta.30 is the sole active pair

## Selected Identity

| Field | Value |
|---|---|
| Version | `0.1.0-beta.30` |
| Tag | `v0.1.0-beta.30` |
| Source commit | `0f3be001fa259890041273eee01119b1ba8edc1e` |
| Source tree | `6b376beab7e9c3ff50775e45d3eddd54f0bb846b` |
| Build ID | `0e21bf7543475c368f7ef3a5548956e075fa05c65c1fd583840e1c30fa3d88b6` |
| Source SHA-256 | `3b6d88ca9b467ae8088a79b92bea1a5663c13bb4041c97b0363ea3a6e7c75a7c` |
| Version-set SHA-256 | `bc6be86a0ba99d94345462d3173c45e7e3dc1c64bec547ad2d77d9cc6a74ef8d` |
| Selection SHA-256 | `54d163b61ee66d1e7409ad7e19e77c7e3588bfbffc1531ecfb32f9b7d477103c` |
| Test-report SHA-256 | `f12d14cbece2461280c1a0422b50e7d957b5f8bdac80ce02f828771f5cd960d7` |
| Trust fingerprint | `fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557` |
| License | `PolyForm-Noncommercial-1.0.0` |

Fresh unauthenticated/direct-remote checks confirmed beta.30 had no local tag, direct-remote tag or public release before selection. Its version-set digest consumes every beta from 1 through 29, including published invalidated beta.25 and beta.29 plus unpublished invalidated identities, so none can be reused. The production source digest is byte-identical to beta.29; only immutable release-history metadata advanced.

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
- Sensitive scan: **0 findings** over `tracked`, `history`, `working_tree` and `captured_output`; digest `40a4747d3950cd2c0b38767e4b1813b08b1e0c84b95daf80e6eca78df352c2cb`.
- Scan coverage: 304 tracked/current files (3,992,069 bytes), 967 reachable selected-history blobs with three existing exact reviewed-fixture exceptions, and five fresh beta.30 logs (16,197 bytes).
- Final ignored generated output was rebuilt from exact selected commit `0f3be00` and matches beta.30 commit/tree/build/source identity.

## Invalidation History

| Version | Disposition | Reason |
|---|---|---|
| beta.21–beta.24 | permanently invalidated | Earlier source/prompt/assembly/publisher corrections; exact sanitized records remain authoritative. |
| beta.25 | published, historical, permanently invalidated | The update gate exposed volatile `checkedAt` being compared as immutable. Public tag `v0.1.0-beta.25`, release `380618906` and both assets remain untouched; active local release receipts were removed. |
| beta.26 | unpublished, permanently invalidated | First unit gate ran under host Node 26 and failed 142/143 before the managed-runtime rerun. |
| beta.27 | unpublished, permanently invalidated | Complete integration passed 348/349; the old positive live-gate fixture used a nonmonotonic equal timestamp. |
| beta.28 | unpublished, permanently invalidated | Complete integration passed 348/349; one transient macOS process-observation cleanup failed, and the exact focused recheck then passed without source change. |
| beta.29 | published, historical, permanently invalidated | Release `380689537`, tag and both assets exist, but the first and only anonymous verifier attempt produced no availability receipt. Public objects remain untouched; the identity must never be retried, reused or overwritten. |
| beta.30 | active selection/report only | All five suites, zero-disabled gate and four-surface scan passed freshly against unchanged production source. No signing, assembly or publication has occurred. |

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
13. **Invalidate published availability-unproven beta.29 without remote mutation** — `0f3be00`
14. **Task 1: lock beta.30** — `887d57d`
15. **Task 2: bind complete fresh beta.30 quality evidence** — `d055b20`

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

**3. [Rule 3 - Generated Build Output] Restored the selected beta.30 generated identity**

- **Found during:** final source/build binding
- **Issue:** Integration fixtures rebuilt ignored `dist/build` for their current test identity.
- **Fix:** Rebuilt variant B from selected commit `0f3be00` in an isolated local clone, copied only generated output, and revalidated exact commit/tree/build/source binding. The first driver invocation stopped before output because macOS canonicalized `/tmp` to `/private/tmp`; rerunning the identical entrypoint through `realpath` produced the exact selected build.
- **Commit:** no tracked source change.

The beta.26 host-runtime failure, beta.28 transient OS process-observation failure and beta.29 anonymous verifier race were not hidden or converted into passes. Each consumed its selected identity and forced a complete fresh rerun.

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
- Public beta.25 and beta.29 remain intact as immutable historical data. Neither is an active install/update candidate, and neither was overwritten or deleted by this rerun.

## Next Phase Readiness

- Plan 02-39 must assemble and sign fresh beta.30 artifacts from the exact selection/report. No beta.25–beta.29 artifact, prompt, receipt or result may be reused or relabelled.
- Plan 02-13 must then publish beta.30 through its separate no-overwrite/public-versus-consumed flow before Plan 02-14 can restart.
- Windows native and all live login/reopen/restart/Codex-exit/cross-day/reauth checks remain `not_run/human_needed`; Phase 3 remains blocked.

## Self-Check: PASSED

- Active selection/report files exist and validate to canonical SHA-256 `54d163b61ee66d1e7409ad7e19e77c7e3588bfbffc1531ecfb32f9b7d477103c` and `f12d14cbece2461280c1a0422b50e7d957b5f8bdac80ce02f828771f5cd960d7`.
- All fifteen corrective/invalidation/selection/report commits listed above resolve in Git; no task commit deleted an unrelated tracked file.
- beta.25–beta.29 invalidation records exist; beta.29 release `380689537` remains public historical data, and beta.30 remains absent from local/direct-remote tags and public releases.
- Final source/build binding, receipt validation and `git diff --check` pass.

---
*Phase: 02-poc-live*
*Completed: 2026-09-02*
