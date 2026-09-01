---
phase: 02-poc-live
plan: "38"
subsystem: release-quality
tags: [beta-selection, quality-gate, sensitive-scan, immutable-identity, update-freshness, anonymous-readiness]
requires:
  - phase: 02-poc-live
    plans: ["10", "11", "12", "36", "37", "41"]
    provides: production auth workflow, complete release contracts and fixed quality schemas
provides:
  - immutable unused Phase 2 identity 0.1.0-beta.31
  - exact build-bound five-suite automated test report
  - explicit sanitized permanent invalidation of beta.21 through beta.30
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
    - .planning/phases/02-poc-live/02-38-BETA-30-INVALIDATION.md
  modified:
    - scripts/release/verify-phase2-update-gate.mjs
    - scripts/release/verify-availability.mjs
    - tests/integration/phase2-release-gates.test.ts
    - tests/integration/phase2-live-gate.test.ts
key-decisions:
  - "Published beta.25 remains immutable public history but is permanently invalidated as an active update candidate; its tag and assets were not changed or deleted."
  - "Volatile availability checkedAt is validated for format, freshness window and strict monotonicity separately from immutable identity/asset equality."
  - "Published beta.29 is permanently invalidated as availability-unproven after its first and only anonymous verifier attempt produced no availability receipt; its public objects remain untouched."
  - "Published beta.30 is permanently invalidated as availability-unproven after the same pre-verifier CDN readiness race; its release, tag and assets remain untouched."
  - "A bounded anonymous metadata/HEAD readiness gate now precedes the first and only full byte/hash/signature/closure verifier attempt without claiming availability."
  - "beta.31 is the next fully green monotonic identity and consumes all beta.1 through beta.30 history."
requirements-completed: []
duration: 2h25min cumulative corrective reruns
completed: 2026-09-02
---

# Phase 2 Plan 38: Immutable Beta Quality Binding Summary

**Beta.31 binds the readiness-corrected production source to five freshly green managed-runtime suites after published beta.30 failed closed as availability-unproven; all historical public objects remain immutable while every Windows/live/Phase 3 gate remains blocking.**

## Performance

- **Corrective reruns:** approximately 2 h 25 min cumulative
- **Beta.31 readiness-correction and quality rerun:** approximately 46 min
- **Tasks:** 2
- **RED/GREEN commits:** 4
- **Fixture correction commits:** 1
- **Invalidation commits:** 6
- **Selection/report commits:** 6 selections, 3 complete reports; beta.31 is the sole active pair

## Selected Identity

| Field | Value |
|---|---|
| Version | `0.1.0-beta.31` |
| Tag | `v0.1.0-beta.31` |
| Source commit | `7e3044fbfc66ef14431f419e56c833951e24e4f9` |
| Source tree | `786707f3e0f3e011ecf8fb39901e2e1578b6959a` |
| Build ID | `003e0aa9ee74b77123741b9dbbc4f723acfd1783bee6b59054f49c46caff0a7f` |
| Source SHA-256 | `71032dfe380ae7040953745e0daf29e4848200b930aec5e702fd98657a7714ae` |
| Version-set SHA-256 | `5dac58ea491d3a1547fdab2619f61901b7b72c20c3f2a6ea79fa858cbb5807b5` |
| Selection SHA-256 | `09502dcab1c9b1bab4f3b70d89d7436835ded3d5deec1b215d404528bf36c2e4` |
| Test-report SHA-256 | `356a3cbe76475c5980667af17b8eb3588df15b66bb5dd07db7fa308f7f90b384` |
| Trust fingerprint | `fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557` |
| License | `PolyForm-Noncommercial-1.0.0` |

Fresh unauthenticated/direct-remote checks confirmed beta.31 had no local tag, direct-remote tag or public release before selection. Its version-set digest consumes every beta from 1 through 30, including published invalidated beta.25, beta.29 and beta.30 plus unpublished invalidated identities, so none can be reused. The source contains only the narrowly tested anonymous readiness correction and its regression coverage beyond beta.30.

## Automated Evidence

All commands ran through the repository-approved managed Node `v24.20.0` runtime.

| Suite | Tests | Skipped | Todo | Command SHA-256 |
|---|---:|---:|---:|---|
| Typecheck | 1 command | 0 | 0 | `c8cdec81b63a83f09579ad0f57459db7cda7610a31a3a4d482fc74384df5b02d` |
| Unit | 143 | 0 | 0 | `b98c3b0584afe9dfa05fc96c87f247733c92ebd894229fb80b5e46c6035d8f50` |
| Integration | 352 | 0 | 0 | `b596a73c156f87c41f683dc1f4767070d87cf9eb22ebcb0503bff0ecbf90e0ea` |
| UI | 34 | 0 | 0 | `84d510b7e28d16445e7d3212cabe49a7cd8dd0280e5c5528b395f7527c9a7ca9` |
| macOS native | 24 | 0 | 0 | `50ca1a215155bb52b4fd8ced7a16c49135b26fc0fe3b6e1e6c2cc3882e599c66` |

- Task 1 focused selection gate: **3/3 passed**.
- No `describe/it/test.skip`, `.todo` or `.only` invocation exists in the test tree.
- Sensitive scan: **0 findings** over `tracked`, `history`, `working_tree` and `captured_output`; digest `b2b4e1877a00517279824aee269efbca02d766fbdaf4ecd8987351d9a670deb0`.
- Scan coverage: 305 tracked/current files (4,012,374 bytes), 984 reachable selected-history blobs with three existing exact reviewed-fixture exceptions, and five fresh beta.31 logs (16,422 bytes).
- Final ignored generated output was rebuilt from exact selected commit `7e3044f` and matches beta.31 commit/tree/build/source identity.

## Invalidation History

| Version | Disposition | Reason |
|---|---|---|
| beta.21–beta.24 | permanently invalidated | Earlier source/prompt/assembly/publisher corrections; exact sanitized records remain authoritative. |
| beta.25 | published, historical, permanently invalidated | The update gate exposed volatile `checkedAt` being compared as immutable. Public tag `v0.1.0-beta.25`, release `380618906` and both assets remain untouched; active local release receipts were removed. |
| beta.26 | unpublished, permanently invalidated | First unit gate ran under host Node 26 and failed 142/143 before the managed-runtime rerun. |
| beta.27 | unpublished, permanently invalidated | Complete integration passed 348/349; the old positive live-gate fixture used a nonmonotonic equal timestamp. |
| beta.28 | unpublished, permanently invalidated | Complete integration passed 348/349; one transient macOS process-observation cleanup failed, and the exact focused recheck then passed without source change. |
| beta.29 | published, historical, permanently invalidated | Release `380689537`, tag and both assets exist, but the first and only anonymous verifier attempt produced no availability receipt. Public objects remain untouched; the identity must never be retried, reused or overwritten. |
| beta.30 | published, historical, permanently invalidated | Release `380716930`, tag and both assets exist, but the first and only anonymous verifier attempt again reached the CDN before both exact assets were ready and produced no availability receipt. Public objects remain untouched; the identity must never be retried, reused or overwritten. |
| beta.31 | active selection/report only | All five suites, zero-disabled gate and four-surface scan passed freshly against the readiness-corrected source. No signing, assembly or publication has occurred. |

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
16. **RED: define bounded anonymous pre-verifier readiness** — `c43797d`
17. **GREEN: implement exact metadata/HEAD readiness before the one verifier** — `666d3a8`
18. **Invalidate published availability-unproven beta.30 without remote mutation** — `7e3044f`
19. **Task 1: lock beta.31** — `27088ac`
20. **Task 2: bind complete fresh beta.31 quality evidence** — `670299d`

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

**3. [Rule 1 - Anonymous CDN Readiness] Added a bounded gate before the first full verifier attempt**

- **Found during:** beta.29 and beta.30 publication availability verification
- **Issue:** Both immutable releases were published successfully, but the first and only full anonymous byte verifier reached GitHub's CDN before both exact assets were ready. The no-retry contract correctly left each release availability-unproven, revealing the need for readiness observation before consuming the verifier attempt.
- **Fix:** Poll only exact anonymous release metadata and safe HEAD/redirect/content-length state for the two allowlisted asset IDs/URLs. The gate has a fixed 120-second ceiling and fixed seven-attempt schedule, treats only an explicit transient HTTP set as retryable, makes no byte/signature/receipt/pass claim, and invokes the full verifier exactly once only after both assets are ready. Identity, redirect, length and timeout failures remain fail closed.
- **Commits:** RED `c43797d`, GREEN `666d3a8`; focused readiness 3/3, full release gates 22/22, typecheck and syntax all passed.

**4. [Rule 3 - Generated Build Output] Restored the selected beta.31 generated identity**

- **Found during:** final source/build binding
- **Issue:** Integration fixtures rebuilt ignored `dist/build` for their current test identity.
- **Fix:** Rebuilt variant B from selected commit `7e3044f` in an isolated local clone, copied only generated output, and revalidated exact commit/tree/build/source binding.
- **Commit:** no tracked source change.

The beta.26 host-runtime failure, beta.28 transient OS process-observation failure and beta.29/beta.30 anonymous verifier races were not hidden or converted into passes. Each consumed its selected identity and forced a complete fresh rerun.

## TDD Gate Compliance

Both approved corrections have explicit RED/GREEN sequences: `348e9f4` → `ef52b6c` separates volatile receipt time from immutable identity, while `c43797d` → `666d3a8` adds bounded anonymous readiness without consuming or duplicating the one full verifier attempt. The later `d83415c` change updates only a directly related positive fixture exposed by the complete gate.

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
- Public beta.25, beta.29 and beta.30 remain intact as immutable historical data. None is an active install/update candidate, and none was overwritten or deleted by this rerun.

## Next Phase Readiness

- Plan 02-39 must assemble and sign fresh beta.31 artifacts from the exact selection/report. No beta.25–beta.30 artifact, prompt, receipt or result may be reused or relabelled.
- Plan 02-13 must then publish beta.31 through its separate no-overwrite/public-versus-consumed flow and the new readiness-before-verification contract before Plan 02-14 can restart.
- Windows native and all live login/reopen/restart/Codex-exit/cross-day/reauth checks remain `not_run/human_needed`; Phase 3 remains blocked.

## Self-Check: PASSED

- Active selection/report files exist and validate to canonical SHA-256 `09502dcab1c9b1bab4f3b70d89d7436835ded3d5deec1b215d404528bf36c2e4` and `356a3cbe76475c5980667af17b8eb3588df15b66bb5dd07db7fa308f7f90b384`.
- All twenty corrective/invalidation/selection/report commits listed above resolve in Git; no task commit deleted an unrelated tracked file.
- beta.25–beta.30 invalidation records exist; beta.29 release `380689537` and beta.30 release `380716930` remain public historical data, and beta.31 remains absent from local/direct-remote tags and public releases.
- Final source/build binding, receipt validation and `git diff --check` pass.

---
*Phase: 02-poc-live*
*Completed: 2026-09-02*
