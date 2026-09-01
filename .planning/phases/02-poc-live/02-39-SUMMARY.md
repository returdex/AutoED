---
phase: 02-poc-live
plan: "39"
subsystem: release-assembly
tags: [ed25519, keychain, signed-archive, install-prompt, capability-closure, beta30, historical-invalidated]
requires:
  - phase: 02-poc-live
    plans: ["38", "41"]
    provides: historical qualified beta.30 identity, complete quality evidence and two-layer release contracts
  - phase: 01-beta
    plan: "12"
    provides: fixed protected Keychain Ed25519 trust root
provides:
  - historical locally assembled, signed and published beta.30 archives for darwin-arm64 and win32-x64
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
  - "Beta.30 was rebuilt and signed from its selected source; no beta.29, beta.25 or other historical payload byte, receipt or prompt was reused or relabelled."
  - "Beta.30 is now immutable published but availability-unproven history; its active artifact receipt and prompt were removed and beta.31 requires fresh assembly/signing."
  - "The signed install-prompt core remains target-stable; only the external prompt binds archive URL, exact bytes and outer SHA-256."
  - "AUTH/UAT requirements remain incomplete until required native and real-user gates run; local signing is not live evidence."
patterns-established:
  - "Self-reference-safe release prompt: signed stable instructions inside the archive, exact outer archive coordinates outside it."
  - "Release receipt creation follows source/build/consumed-set/selection/report, signer, closure, component inventory, license, gap and sensitive-data verification."
requirements-completed: []
duration: 1h53min cumulative
completed: 2026-09-02
---

# Phase 2 Plan 39: Signed Dual-Target Beta.30 Assembly Summary

**Beta.30 macOS arm64 and Windows x64 archives were protected-Keychain Ed25519 signed and locally verified, then permanently invalidated after publication because the first and only anonymous verifier attempt produced no availability receipt.**

## Upstream Invalidation Amendment

Plan 02-13 published beta.30 exactly once as release `380716930`, but the same pre-verifier CDN readiness race already exposed by beta.29 prevented the first and only full anonymous verifier attempt from producing an availability receipt. Plan 02-38 therefore permanently invalidated beta.30 in commit `7e3044f` without deleting, overwriting, resigning or relabelling its release, tag or assets. The active `release/phase2-beta-artifacts.json` and `release/phase2-install-prompt.md` files were removed; their historical bytes and this exact audit record remain in Git. Beta.31 is the sole active quality-bound identity and must be assembled and signed freshly by a corrective Plan 02-39 run.

## Performance

- **Duration:** 1 h 53 min cumulative across contract corrections and corrective archive reruns
- **Beta.30 rerun:** 4 min
- **Started:** 2026-09-01T17:52:06Z
- **Completed:** 2026-09-01T17:55:46Z
- **Tasks:** 2
- **Tracked output files:** 2

## Selected and Signed Identity

| Field | Value |
|---|---|
| Version | `0.1.0-beta.30` |
| Tag | `v0.1.0-beta.30` |
| Source commit | `0f3be001fa259890041273eee01119b1ba8edc1e` |
| Source tree | `6b376beab7e9c3ff50775e45d3eddd54f0bb846b` |
| Build ID | `0e21bf7543475c368f7ef3a5548956e075fa05c65c1fd583840e1c30fa3d88b6` |
| Source SHA-256 | `3b6d88ca9b467ae8088a79b92bea1a5663c13bb4041c97b0363ea3a6e7c75a7c` |
| Consumed version-set SHA-256 | `bc6be86a0ba99d94345462d3173c45e7e3dc1c64bec547ad2d77d9cc6a74ef8d` |
| Selection SHA-256 | `54d163b61ee66d1e7409ad7e19e77c7e3588bfbffc1531ecfb32f9b7d477103c` |
| Test-report SHA-256 | `f12d14cbece2461280c1a0422b50e7d957b5f8bdac80ce02f828771f5cd960d7` |
| Trust fingerprint | `fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557` |
| License | `PolyForm-Noncommercial-1.0.0` |

The protected Keychain signer self-check passed before assembly without an OS prompt. The private key was never read, exported, printed or accepted through an override, and no alternate or skip-sign path was used.

## Historical Published Artifacts

| Target | Archive | Exact bytes | SHA-256 |
|---|---|---:|---|
| macOS arm64 | `autoed-0.1.0-beta.30-darwin-arm64.tar.gz` | 227,412,187 | `b0841a2378710c40f6514622e5a0df9bcd1297760975f4a45bcdde3b9c3f77ea` |
| Windows x64 | `autoed-0.1.0-beta.30-win32-x64.tar.gz` | 250,424,350 | `a9429810b68d59970a68219fed994d89216042f4b6647c88ecebe67ab0f11396` |

These exact bytes were later published under immutable tag `v0.1.0-beta.30`; they are historical only and are not eligible for installation/update. This original assembly plan itself did not create the tag, release or remote assets.

Shared signed values:

- Manifest SHA-256: `3e8f42136890472cbfaae2c05dc39cb898e93cedf55506e5796101428a764074`
- Ed25519 signature SHA-256: `efaf414a132ffca8fdb8f0b89e4d260cfdc9ca97905964b015bfba5e161049d0`
- Capability-closure SHA-256: `858cfb363af77aad0df330e54a7b997399bce191d770b06c431d8fe1569d1ce4`
- Capability-set SHA-256: `7852a4696d5dbd3383df4e817f77fa5b60419545526c48d98660c2a55760e7b5`
- Signed install-prompt core SHA-256: `57ca317b26dacc1164df1bca67f972459c4b60add4a595f874f06ff727ecc756`
- External prompt SHA-256: `31c3614688f62f7b65c5b803ac744df82577dab06e3e00d6111d48611493f980`

## Accomplishments

- Revalidated beta.30 commit/tree/build/source/consumed-set and canonical selection/report hashes immediately before signing; the selected source surface had zero drift.
- Rebuilt each program, Node and browser component from beta.30 inputs and the locked dependency cache. Assembly did not read or copy any historical release archive.
- Verified target dependency inventories, macOS browser symlinks inside its component ZIP, Windows no-link closure, outer regular-entry proof, signed manifest, license, support gaps and all 16 signed member hashes.
- Generated the external prompt from the strict receipt, binding the stable signed core to exact target names, URLs, byte counts and SHA-256 values without outer-hash self-reference.

## Task Commits

1. **Task 1: assemble and sign fresh beta.30 targets** — `4c5eb71`
2. **Task 2: bind the exact beta.30 external install prompt** — `7e0bc30`

Historical contract corrections retained by this rerun:

- `3771e77` → `eb2843d` — RED/GREEN two-layer install-prompt contract.
- `ab833b2` → `2958d61` — RED/GREEN structural dependency-path classification.

## Historical Files Created/Modified

- `release/phase2-beta-artifacts.json` — historical beta.30 signed-artifact receipt, removed from the active canonical surface by invalidation commit `7e3044f`.
- `release/phase2-install-prompt.md` — historical beta.30 external prompt, removed from the active canonical surface by invalidation commit `7e3044f`.

## Verification

- Focused Plan 02-39 literal filter: **1/1 selected test passed**; 18 tests were excluded by the plan filter.
- Complete `phase2-release-gates.test.ts`: **19/19 passed**.
- Final read-only Phase 2 preflight: **pass** for exact identity, selection/report, manifest, signed core, external prompt, capability set and both local archive bytes.
- Selected-commit sensitive history scan: **pass** across 967 reachable blobs with three existing reviewed detector/negative-fixture exceptions.
- Direct byte counts and SHA-256 values match the receipt; tracked output scan and `git diff --check` pass; selected source diff is zero.

## Deviations from Plan

### Historical Auto-fixed Issues Retained by the Contract

**1. [Rule 1 - Prompt Integrity] Removed the outer-archive hash self-reference cycle**

- **Found during:** original Task 1 contract review
- **Fix:** Added the approved stable signed embedded core plus external exact-target prompt.
- **Verification:** RED `3771e77`, GREEN `eb2843d`; all 19 current release-gate tests pass.

**2. [Rule 1 - Sensitive Path Classification] Distinguished dependency package names from runtime credential artifacts**

- **Found during:** historical deterministic assembly
- **Fix:** Allowed `cookie`/`cookies` only as structural `node_modules` package names while runtime Profile/Cookie/Cookies paths remain rejected.
- **Verification:** RED `ab833b2`, GREEN `2958d61`; all 19 current release-gate tests pass.

**3. [Rule 3 - Blocking Driver Classification] Removed an inapplicable Phase 1 package-root scan from the historical temporary assembler**

- **Found during:** historical beta.29 assembly
- **Fix:** Kept the temporary assembler on the Phase 2 member/sensitive scanner, exact signed closure and outer archive proof; the ignored driver was removed after use.
- **Verification:** The beta.30 rerun passed on its first assembly attempt with no tracked source change.

The beta.30 rerun introduced no new deviation. **Total deviations:** 3 retained historical issues (2 Rule 1, 1 Rule 3). **Impact:** No product source or release contract changed; fail-closed scanning and signing remained intact.

## TDD Gate Compliance

Task 1 retains explicit RED/GREEN sequences `3771e77` → `eb2843d` and `ab833b2` → `2958d61`. The beta.30 rerun exercises those established contracts against fresh generated artifacts rather than adding an artificial failing receipt test.

## Issues Encountered

None in the beta.30 rerun.

## Known Stubs

None. `windowsNative: not_run/human_needed`, `live: not_run/human_needed` and `phase3: blocked` are deliberate hard-gate states, not placeholders.

## Threat Flags

None. Signing, archive access and prompt delivery are the planned trust surfaces in T2-39-01 through T2-39-03; no network endpoint, authorization path or persistent-data schema was added.

## Authentication Gates

None. The approved protected Keychain identity was available and self-check/signing completed without an OS prompt. No service login or MFA was attempted.

## External Mutation Boundary

- No tag, release, asset, push, publication, remote mutation or authentication occurred.
- No update, installation, Profile access, school/source access, browser action, live UAT or EvidenceLedger L write occurred.
- The original run created only ignored fresh beta.30 local archives and two tracked Plan 02-39 metadata files; invalidation removed the active tracked files but did not change public historical bytes.

## Decisions Made

- Rebuilt both beta.30 targets from the selected output and locked cached dependencies; never renamed, copied or republished beta.29 or earlier archive bytes.
- Kept archive-external target coordinates outside the signed core to avoid hash self-reference while binding both layers in the receipt.
- Preserved target-specific symlink semantics inside component archives while the outer archives retain strict regular-entry proof.
- Left AUTH-01 through AUTH-04, SEC-02 and UAT-01 incomplete because AGENTS.md requires real native/live evidence.

## Next Phase Readiness

- Corrective Plan 02-39 must assemble and sign beta.31 from selection `09502dca…` and test report `356a3cbe…`; no beta.30 byte, signature, prompt or receipt may be reused or relabelled.
- Any source/tree/build/consumed-set/selection/report/core/archive or public-object drift must invalidate beta.31 and return to Plan 02-38; no artifact may be resigned in place under the same identity.
- Windows native and real login/reopen/restart/Codex-exit/cross-day/reauth evidence remain `not_run/human_needed`; Phase 3 remains blocked.

## Self-Check: PASSED

- Historical beta.30 task commits and recorded values remain in Git; the active tracked artifact receipt and prompt are absent after immutable invalidation.
- Task commits `4c5eb71` and `7e0bc30` plus historical RED/GREEN commits resolve in Git; task commits deleted no tracked files.
- The original exact read-only preflight and complete 19-test release-gate file passed against beta.30 before publication; current active selection/report now bind beta.31.
- The temporary assembly driver is absent, selected source diff is zero, and `git diff --check` passes.

---
*Phase: 02-poc-live*
*Completed: 2026-09-02*
