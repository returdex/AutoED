---
phase: 02-poc-live
plan: "41"
subsystem: release-toolchain
tags: [release, immutable-publication, ed25519, anonymous-verification, capability-closure, tdd]
requires:
  - phase: 02-poc-live
    plan: "37"
    provides: exact live, audit, final, update and native-evidence gate commands
  - phase: 01-beta
    plans: ["06", "07", "08", "09", "10", "11", "12", "13"]
    provides: signed delivery, fixed trust root, isolated owner identity and immutable release contracts
provides:
  - exact immutable Phase 2 build-selection and full-suite test-report schemas
  - identical 15-member and 27-capability closure for both signed targets
  - no-overwrite returdex publication and anonymous full-byte availability commands
  - acyclic selection-to-update receipt chain with remote IDs introduced only after publication
affects: [02-38, 02-39, 02-13, 02-14 through 02-34, Phase 2 release]
tech-stack:
  added: []
  patterns: [selection-bound test report, signed portable capability closure, atomic no-replace public receipts, anonymous independent refetch]
key-files:
  created:
    - scripts/release/phase2-gate.mjs
    - tests/integration/phase2-release-gates.test.ts
  modified:
    - scripts/build/assemble.mjs
    - scripts/release/preflight.mjs
    - scripts/release/publish.mjs
    - scripts/release/verify-availability.mjs
    - scripts/release/verify-phase2-update-gate.mjs
    - scripts/release/phase2-native-evidence.mjs
    - tests/integration/phase2-live-gate.test.ts
key-decisions:
  - "The receipt chain is selection -> test report -> signed artifact -> publication -> availability; preselection records never depend on later artifact or remote IDs."
  - "Metadata-only planning/output commits may follow selection, but selected source/tests must remain byte-identical and the selected commit must remain an ancestor."
  - "Anonymous verification trusts neither GitHub metadata nor downloaded bytes until exact public metadata, hashes, Ed25519 signature, fixed fingerprint, prompt, license and capability members all agree."
patterns-established:
  - "Portable closure: macOS and Windows carry byte-identical hashes for every required workflow/gate member and the fixed capability list."
  - "No-overwrite release: conflicts, partial/higher betas, extra assets or receipt reuse fail without force/delete/fallback paths."
requirements-completed: []
duration: 30min
completed: 2026-09-01
---

# Phase 2 Plan 41: Immutable Release Toolchain Summary

**Selection-bound quality reports, dual-target signed capability closure, immutable returdex publication and anonymous content-bound verification are source-complete before any Phase 2 beta identity is selected.**

## Performance

- **Duration:** 30 min
- **Started:** 2026-09-01T09:46:46Z
- **Completed:** 2026-09-01T10:16:22Z
- **Tasks:** 2 TDD tasks
- **Files modified:** 9 production/test files plus 2 planning artifacts

## Accomplishments

- Defined strict no-extra-key selection and test-report schemas binding repository ID, `0.1.0-beta.N`, tag, commit, tree, build, source digest, full suite counts, zero skip/todo, four sensitive-scan surfaces and eight named cross-platform obligations.
- Closed both targets over 15 exact portable members and 27 capabilities covering durable start/resume/submit/cancel, all live record/verify/audit/final branches, both platform update pre/post branches and native evidence.
- Bound assembly and preflight to one selected identity, fixed PolyForm Noncommercial 1.0.0 licensing, fixed Ed25519 fingerprint, exact target hashes and a sensitive-member scan.
- Implemented a production Phase 2 publication CLI with repo-local Git identity, isolated `returdex` GitHub ownership, repository ID `1350421724`, non-force publication, exact two-asset metadata, race re-observation and atomic no-replace receipt.
- Implemented a production anonymous availability CLI that freshly downloads both complete assets with no authorization header, follows only approved HTTPS redirects, rechecks disk bytes, verifies the embedded Ed25519 manifest/signature, prompt/license and every capability member, then atomically writes one receipt.
- Migrated installed update/native consumers to the exact acyclic report chain; remote asset IDs now appear only in publication/availability receipts and never in the prepublication artifact receipt.

## Toolchain Branch Coverage

| Surface | Positive coverage | Fail-closed coverage |
|---|---|---|
| Selection/report | exact identity, five suites, four scan surfaces, eight obligations | extra keys, partial suite, skip/todo, missing obligation, scan finding, commit/tree/source drift |
| Assembly | 15 identical member hashes and 27 identical capabilities on macOS/Windows | missing/wrong member, stale source, missing capability, alternate key, changed signed bytes, private member |
| Preflight | fixed owner/repository/version/license/fingerprint, source-only postselection closure | identity/license/support drift, history/private path, prompt/artifact mismatch |
| Publication | unused beta, exact tag/commit/build, two immutable assets and metadata | existing/higher beta, tag race, partial/conflicting/extra assets, reused receipt, postpublish version-set race |
| Availability | anonymous metadata and two full-byte refetches, signature/fingerprint/prompt/capability proof | partial response, authenticated header, redirect substitution, byte/hash/signature/capability/prompt drift |
| Update/native handoff | rich selection-bound report and publication asset mapping | platform spoof, WSL/identity drift, stale availability, artifact/report cycle or remote-ID substitution |

## Task Commits

1. **Task 1 RED: quality and signed capability closure tests** — `c762684` (test)
2. **Task 1 GREEN: quality, assembly and preflight closure** — `af04436` (feat)
3. **Task 2 RED: immutable publication and anonymous availability tests** — `22aea9a` (test)
4. **Task 2 GREEN: production publication, availability and update handoff** — `7b21192` (feat)

## Files Created/Modified

- `scripts/release/phase2-gate.mjs` — exact selection/test-report schemas, version-set digest and source binding.
- `scripts/build/assemble.mjs` — Phase 2 program staging, member/capability manifest, dual-target equality and signed closure checks.
- `scripts/release/preflight.mjs` — strict artifact/prompt/source/license validation and existing-repository `returdex` identity preflight.
- `scripts/release/publish.mjs` — no-force/no-delete exact two-asset publication and atomic immutable receipt.
- `scripts/release/verify-availability.mjs` — anonymous full-byte fetch, allowlisted redirects, embedded signature/member proof and no-replace output.
- `scripts/release/verify-phase2-update-gate.mjs` — acyclic selection/report/artifact/publication/availability verification for both platforms.
- `scripts/release/phase2-native-evidence.mjs` — installed rich test-report compatibility without a later artifact-receipt dependency.
- `tests/integration/phase2-release-gates.test.ts` — 11 positive/negative release-chain contracts.
- `tests/integration/phase2-live-gate.test.ts` — updated exact update-handoff fixtures and regression coverage.
- `.planning/phases/02-poc-live/deferred-items.md` — preserved the known installed-service fixed-port verification conflict.

## Verification

- Managed Node 24.20.0 Task 1 gate: **6/6 passed**; Task 2 gate: **5/5 passed**.
- Complete `phase2-release-gates` file: **11/11 passed**.
- Combined Phase 2 release/live/update regression: **26/26 passed**.
- Focused release/live/trust run: **38/41 passed**; the only three failures are the already-recorded `install-preview` fixed-port conflict with the healthy installed Phase 1 API.
- Complete native suite: **24/24 passed**.
- Typecheck, five release-script syntax checks and `git diff --check`: **passed**.
- No Phase 2 selection, test report, artifact receipt, prompt, publication receipt or availability receipt exists. No beta tag was created.

## Decisions Made

- Used an acyclic receipt graph. The selected identity hashes the test report; the artifact hashes selection/report; publication adds GitHub asset IDs; availability binds fresh anonymous bytes back to the signed artifact.
- Allowed only planning/output commits after selection. Preflight requires the selected commit to remain an ancestor while source, tests and build-input digests remain unchanged; it does not incorrectly require HEAD to equal the pre-output commit.
- Required outer target archives to carry a signed manifest, capability closure and install prompt plus every `program/<member>` byte. The approved trust root verifies the signature before any capability proof is accepted.
- Required actual GitHub URLs to use the selected `v0.1.0-beta.N` tag while the version field remains `0.1.0-beta.N`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Contract Bug] Removed the prepublication artifact/test-report cycle**

- **Found during:** Task 2 update-handoff integration
- **Issue:** The existing update and installed native verifiers required `phase2-test-report.json.artifactReceiptSha256`, although Plan 38 creates the test report before Plan 39 creates the artifact receipt. The existing artifact target also required a GitHub asset ID that cannot exist before publication.
- **Fix:** Bound the report to selection/source identity, bound the artifact to selection/report hashes, and moved remote asset IDs to publication/availability receipts only. Both downstream consumers now validate the same rich report.
- **Files modified:** `scripts/release/verify-phase2-update-gate.mjs`, `scripts/release/phase2-native-evidence.mjs`, `tests/integration/phase2-live-gate.test.ts`
- **Verification:** 26/26 combined Phase 2 release/live/update tests and 24/24 native tests pass.
- **Committed in:** `7b21192`

**2. [Rule 1 - Source Identity Bug] Preserved selection across output-only commits**

- **Found during:** Task 2 production preflight review
- **Issue:** Requiring current HEAD/tree to equal the selected commit would always reject after Plans 38/39 commit generated receipts, despite no source/test change.
- **Fix:** Require selected-commit ancestry, selected tree integrity, unchanged source/test diff and exact build-input digest; scan history at the selected commit.
- **Files modified:** `scripts/release/preflight.mjs`
- **Verification:** source/tree drift negatives and typecheck pass.
- **Committed in:** `7b21192`

**3. [Rule 1 - Publication URL Bug] Bound asset URLs to the real selected tag**

- **Found during:** Task 2 production GitHub binding
- **Issue:** The initial descriptor used the bare version in `/releases/download/...` while the exact selected tag is prefixed with `v`; GitHub download URLs are tag-bound.
- **Fix:** Required `/releases/download/v0.1.0-beta.N/<asset>` consistently across artifact, publication, availability and update fixtures.
- **Files modified:** `scripts/release/preflight.mjs`, `scripts/release/publish.mjs`, `tests/integration/phase2-release-gates.test.ts`, `tests/integration/phase2-live-gate.test.ts`
- **Verification:** all 11 release-chain and all 15 live/update tests pass.
- **Committed in:** `7b21192`

---

**Total deviations:** 3 auto-fixed correctness/contract bugs. **Impact:** The fixes make the approved chain executable and acyclic without adding release, login, Profile, source or live authority.

Shared `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md` and requirement completion were intentionally left unchanged for the sequential phase orchestrator. AUTH-01 through AUTH-04, SEC-02 and UAT-01 remain Pending until their required real evidence and hard human gates pass.

## Issues Encountered

- The healthy installed Phase 1 API owns fixed loopback port `43187`; three unrelated `install-preview` cases report `PORT_CONFLICT_REPREVIEW`. The installed service was not stopped or modified. This is recorded in `deferred-items.md`; all release-toolchain, live/update, trust and native tests executed outside that fixture pass.

## TDD Gate Compliance

- RED commits `c762684` and `22aea9a` failed for the intended missing quality/assembly and publication/availability behavior.
- GREEN commits `af04436` and `7b21192` followed each RED commit and pass their exact task gates.

## Known Stubs

None. `not_run/human_needed` for Windows/live and `phase3: blocked` are intentional hard-gate states, not placeholders.

## Threat Flags

None. Publication, anonymous network input, archive file access and signed-manifest checks are the exact surfaces assigned to T2-41-01 through T2-41-04; negative tests cover their trust-boundary failures.

## Authentication Gates

None encountered or invoked. Tests use injected fixtures only; no GitHub authentication, account change, official login/MFA, Profile or source action occurred.

## External Mutation Boundary

- No build identity was selected and no real custody/signing operation ran.
- No remote API, push, tag, release, asset upload, publication or anonymous network fetch ran.
- No installed runtime, Profile, school source, live ledger or update action was touched.
- No generated release artifact or receipt was overwritten or created.

## User Setup Required

None.

## Next Phase Readiness

- Plan 02-38 can select one unused beta and create the exact selection/test report without editing source or tests.
- Plan 02-39 can consume the closure/signing/preflight tooling to produce one immutable dual-target artifact receipt and prompt.
- Plan 02-13 can execute the fixed publication and availability CLIs. Any version/source/asset race requires a new selection and full 02-38 -> 02-39 -> 02-13 rerun.
- Windows native and all real live/UAT gates remain `not_run/human_needed`; Phase 3 remains blocked.

## Self-Check: PASSED

All nine key production/test files and this summary exist; all four RED/GREEN commits resolve in Git. The 11/11 release-chain tests, 15/15 live/update regressions, 24/24 native suite, typecheck, syntax checks and `git diff --check` pass. All six Phase 2 generated release outputs remain absent, no beta tag exists, and no remote, installed runtime, Profile, source or live evidence mutation occurred. Shared tracking remains unchanged for the orchestrator.

---
*Phase: 02-poc-live*
*Completed: 2026-09-01*
