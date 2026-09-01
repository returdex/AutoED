---
phase: 02-poc-live
plan: "39"
subsystem: release-assembly
tags: [ed25519, keychain, signed-archive, install-prompt, capability-closure, beta31]
requires:
  - phase: 02-poc-live
    plans: ["38", "41"]
    provides: qualified beta.31 identity, complete quality evidence and two-layer release contracts
  - phase: 01-beta
    plan: "12"
    provides: fixed protected Keychain Ed25519 trust root
provides:
  - active locally assembled and signed beta.31 archives for darwin-arm64 and win32-x64
  - exact 16-member signed closure containing 15 production evidence members plus the stable install-prompt core
  - external install prompt binding the signed core to exact fresh per-target archive coordinates
affects: [02-13, 02-40, Phase 2 publication, Phase 2 live UAT]
tech-stack:
  added: []
  patterns: [protected-key signing, signed stable core plus external target binding, fail-closed archive closure]
key-files:
  created:
    - release/phase2-beta-artifacts.json
    - release/phase2-install-prompt.md
  modified: []
key-decisions:
  - "Beta.31 was rebuilt and signed from its selected source; no beta.30, beta.29, beta.25 or other historical payload byte, receipt or prompt was reused or relabelled."
  - "The signed install-prompt core remains target-stable; only the external prompt binds archive URL, exact bytes and outer SHA-256."
  - "AUTH/UAT requirements remain incomplete until required native and real-user gates run; local signing is not live evidence."
patterns-established:
  - "Self-reference-safe release prompt: signed stable instructions inside the archive, exact outer archive coordinates outside it."
  - "Release receipt creation follows source/build/consumed-set/selection/report, signer, closure, component inventory, license, gap and sensitive-data verification."
requirements-completed: []
duration: 2h01min cumulative
completed: 2026-09-02
---

# Phase 2 Plan 39: Signed Dual-Target Beta.31 Assembly Summary

**Fresh beta.31 macOS arm64 and Windows x64 archives are protected-Keychain Ed25519 signed, locally verified over a shared 16-member/27-capability closure, and bound by a self-reference-safe two-layer install prompt.**

## Performance

- **Duration:** 2 h 01 min cumulative across contract corrections and corrective archive reruns
- **Beta.31 rerun:** 8 min
- **Started:** 2026-09-01T18:44:48Z
- **Completed:** 2026-09-01T18:52:49Z
- **Tasks:** 2
- **Tracked output files:** 2

## Selected and Signed Identity

| Field | Value |
|---|---|
| Version | `0.1.0-beta.31` |
| Tag | `v0.1.0-beta.31` |
| Source commit | `7e3044fbfc66ef14431f419e56c833951e24e4f9` |
| Source tree | `786707f3e0f3e011ecf8fb39901e2e1578b6959a` |
| Build ID | `003e0aa9ee74b77123741b9dbbc4f723acfd1783bee6b59054f49c46caff0a7f` |
| Source SHA-256 | `71032dfe380ae7040953745e0daf29e4848200b930aec5e702fd98657a7714ae` |
| Consumed version-set SHA-256 | `5dac58ea491d3a1547fdab2619f61901b7b72c20c3f2a6ea79fa858cbb5807b5` |
| Selection SHA-256 | `09502dcab1c9b1bab4f3b70d89d7436835ded3d5deec1b215d404528bf36c2e4` |
| Test-report SHA-256 | `356a3cbe76475c5980667af17b8eb3588df15b66bb5dd07db7fa308f7f90b384` |
| Trust fingerprint | `fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557` |
| License | `PolyForm-Noncommercial-1.0.0` |

The protected Keychain signer self-check passed before assembly without an OS prompt. The private key was never read, exported, printed or accepted through an override, and no alternate or skip-sign path was used.

## Active Artifacts

| Target | Archive | Exact bytes | SHA-256 |
|---|---|---:|---|
| macOS arm64 | `autoed-0.1.0-beta.31-darwin-arm64.tar.gz` | 227,416,297 | `ef69ead91073aec94e1a7312ae69bb4a4f81f64a484b1ad4919e2b7369b715f1` |
| Windows x64 | `autoed-0.1.0-beta.31-win32-x64.tar.gz` | 250,425,315 | `aa12bcdf2e068dc6be2ffa15ee3f5d5e2fa272e4527d0343ca3a0bd21c41cf8a` |

Both ignored local archives are under `.runtime/releases/0.1.0-beta.31/`. Their tracked URLs are intended immutable GitHub release coordinates only; this plan did not create a tag, release or remote asset.

Shared signed values:

- Manifest SHA-256: `567484ea34e35af4a5cf4250e654e059546a47ff4a8050ab623f10313fa836c3`
- Ed25519 signature SHA-256: `81468dbe1c148c90a6909edebe1cbe22c26ddacad4529aa362cd0cd75666ab80`
- Capability-closure SHA-256: `d26f6b1a941d416bec30f7983a8a58c14f23304919a10de4f2e9b79ccb9c7649`
- Capability-set SHA-256: `7852a4696d5dbd3383df4e817f77fa5b60419545526c48d98660c2a55760e7b5`
- Signed install-prompt core SHA-256: `391f11ae9aeee65288cbf7d5759e01d5fb23aee715ff217107fd1e6ab8cab071`
- External prompt SHA-256: `72310c1ad1b5d97338e9bf1adc35a0d978806ebcd982b491922989fb633e94b3`

## Accomplishments

- Revalidated beta.31 commit/tree/build/source/consumed-set and canonical selection/report hashes immediately before signing; the selected source surface had zero drift.
- Rebuilt each program, Node and browser component from beta.31 generated output and the locked dependency cache. Assembly did not copy or rename any historical release archive.
- Verified dependency inventories, macOS browser symlinks inside its component ZIP, Windows no-link closure, outer regular-entry proof, signed manifest, license, support gaps and all 16 signed member hashes.
- Generated the external prompt from the strict receipt, binding the stable signed core to exact target names, URLs, byte counts and SHA-256 values without outer-hash self-reference.

## Task Commits

1. **Task 1: assemble and sign fresh beta.31 targets** — `4dc0733`
2. **Task 2: bind the exact beta.31 external install prompt** — `81c0c12`

Historical contract corrections retained by this rerun:

- `3771e77` → `eb2843d` — RED/GREEN two-layer install-prompt contract.
- `ab833b2` → `2958d61` — RED/GREEN structural dependency-path classification.

## Files Created/Modified

- `release/phase2-beta-artifacts.json` — active beta.31 local signed-artifact receipt with exact identity, target coordinates, signed digests and unresolved support gaps.
- `release/phase2-install-prompt.md` — active beta.31 external prompt bound to the stable signed core and fresh outer archives.

## Verification

- Complete `phase2-release-gates.test.ts`: **22/22 passed**.
- Final read-only Phase 2 preflight: **pass** for exact identity, selection/report, manifest, signed core, external prompt, capability set and both local archive bytes.
- Selected-commit sensitive history scan: **pass** across 984 reachable blobs with three existing reviewed detector/negative-fixture exceptions.
- Direct byte counts and SHA-256 values match the receipt; tracked output scan and `git diff --check` pass; selected source diff is zero.

## Deviations from Plan

### Historical Auto-fixed Issues Retained by the Contract

**1. [Rule 1 - Prompt Integrity] Removed the outer-archive hash self-reference cycle**

- **Found during:** original Task 1 contract review
- **Fix:** Added the approved stable signed embedded core plus external exact-target prompt.
- **Verification:** RED `3771e77`, GREEN `eb2843d`; all 22 current release-gate tests pass.

**2. [Rule 1 - Sensitive Path Classification] Distinguished dependency package names from runtime credential artifacts**

- **Found during:** historical deterministic assembly
- **Fix:** Allowed `cookie`/`cookies` only as structural `node_modules` package names while runtime Profile/Cookie/Cookies paths remain rejected.
- **Verification:** RED `ab833b2`, GREEN `2958d61`; all 22 current release-gate tests pass.

**3. [Rule 3 - Blocking Driver Classification] Removed an inapplicable Phase 1 package-root scan from the historical temporary assembler**

- **Found during:** historical beta.29 assembly
- **Fix:** Kept the temporary assembler on the Phase 2 member/sensitive scanner, exact signed closure and outer archive proof; each ignored driver is removed after use.
- **Verification:** The beta.31 rerun passed on its first assembly attempt with no tracked source change.

The beta.31 rerun introduced no new deviation. **Total deviations:** 3 retained historical issues (2 Rule 1, 1 Rule 3). **Impact:** No product source or release contract changed; fail-closed scanning and signing remained intact.

## TDD Gate Compliance

Task 1 retains explicit RED/GREEN sequences `3771e77` → `eb2843d` and `ab833b2` → `2958d61`. The beta.31 rerun exercises those established contracts against fresh generated artifacts rather than adding an artificial failing receipt test.

## Issues Encountered

None in the beta.31 rerun.

## Known Stubs

None. `windowsNative: not_run/human_needed`, `live: not_run/human_needed` and `phase3: blocked` are deliberate hard-gate states, not placeholders.

## Threat Flags

None. Signing, archive access and prompt delivery are the planned trust surfaces in T2-39-01 through T2-39-03; no network endpoint, authorization path or persistent-data schema was added.

## Authentication Gates

None. The approved protected Keychain identity was available and self-check/signing completed without an OS prompt. No service login or MFA was attempted.

## External Mutation Boundary

- No tag, release, asset, push, publication, remote mutation or remote authentication occurred.
- No update, installation, Profile access, school/source access, browser action, live UAT or EvidenceLedger L write occurred.
- Only ignored fresh beta.31 local archives and the two tracked Plan 02-39 release metadata files were created; historical release bytes were not changed.

## Decisions Made

- Rebuilt both beta.31 targets from the selected output and locked cached dependencies; never renamed, copied or republished beta.30 or earlier archive bytes.
- Kept archive-external target coordinates outside the signed core to avoid hash self-reference while binding both layers in the receipt.
- Preserved target-specific symlink semantics inside component archives while the outer archives retain strict regular-entry proof.
- Left AUTH-01 through AUTH-04, SEC-02 and UAT-01 incomplete because AGENTS.md requires real native/live evidence; this project rule overrides the generic summary template's requirement-completion default.

## Next Phase Readiness

- The exact beta.31 local artifacts and prompt are ready for Plan 02-13's separately controlled no-overwrite publication and readiness-before-single-verifier rerun, subject to another fresh immutable preflight.
- Any source/tree/build/consumed-set/selection/report/core/archive or public-object drift must invalidate beta.31 and return to Plan 02-38; no artifact may be resigned in place under the same identity.
- Windows native and real login/reopen/restart/Codex-exit/cross-day/reauth evidence remain `not_run/human_needed`; Phase 3 remains blocked.

## Self-Check: PASSED

- Both tracked beta.31 outputs and both ignored fresh target archives exist with the recorded byte counts and SHA-256 values.
- Task commits `4dc0733` and `81c0c12` plus historical RED/GREEN commits resolve in Git; task commits deleted no tracked files.
- The exact read-only preflight and complete 22-test release-gate file pass against beta.31.
- The temporary assembly driver is absent, selected source diff is zero, and `git diff --check` passes.

---
*Phase: 02-poc-live*
*Completed: 2026-09-02*
