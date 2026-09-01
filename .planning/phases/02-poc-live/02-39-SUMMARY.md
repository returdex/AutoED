---
phase: 02-poc-live
plan: "39"
subsystem: release-assembly
tags: [ed25519, keychain, signed-archive, install-prompt, capability-closure, beta29]
requires:
  - phase: 02-poc-live
    plans: ["38", "41"]
    provides: corrected beta.29 identity, complete quality evidence and two-layer release contracts
  - phase: 01-beta
    plan: "12"
    provides: fixed protected Keychain Ed25519 trust root
provides:
  - historical locally assembled, signed and subsequently published beta.29 archives for darwin-arm64 and win32-x64
  - historical exact 16-member signed closure containing 15 production evidence members plus the stable install-prompt core
  - immutable evidence retained after beta.29 became availability-unproven and was removed from active local release surfaces
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
  - "Beta.29 was rebuilt and signed from its selected source; no beta.25 or other historical payload byte, receipt or prompt was reused or relabelled."
  - "The signed install-prompt core remains target-stable; only the external prompt binds archive URL, exact bytes and outer SHA-256."
  - "AUTH/UAT requirements remain incomplete until required native and real-user gates run; local signing is not live evidence."
  - "Downstream publication created immutable beta.29 release 380689537, but its first and only anonymous verifier attempt produced no availability receipt; beta.29 is permanently invalidated and must never be retried or overwritten."
patterns-established:
  - "Self-reference-safe release prompt: signed stable instructions inside the archive, exact outer archive coordinates outside it."
  - "Release receipt creation follows source/build/consumed-set/selection/report, signer, closure, component inventory, license, gap and sensitive-data verification."
requirements-completed: []
duration: 1h49min cumulative
completed: 2026-09-02
---

# Phase 2 Plan 39: Historical Signed Dual-Target Beta.29 Assembly Summary

**Beta.29 macOS arm64 and Windows x64 archives were protected-Keychain Ed25519 signed and later published unchanged, but are now permanently historical because the first and only anonymous availability verifier attempt produced no receipt.**

## Downstream Invalidation Amendment

Plan 02-13 created immutable prerelease `v0.1.0-beta.29`, release `380689537`, macOS asset `539882525` and Windows asset `539882528`, then failed closed when its first and only anonymous availability attempt produced no `release/phase2-availability.json`. Plan 02-38 permanently invalidated beta.29 in commit `0f3be00`, removed its selection/report/artifact receipt/install prompt from active canonical local surfaces, and selected fully qualified beta.30. The public beta.29 tag, release and assets remain untouched historical data and must never be retried, reused, deleted, overwritten or relabelled.

## Performance

- **Duration:** 1 h 49 min cumulative across contract corrections and corrective archive reruns
- **Beta.29 rerun:** 7 min
- **Started:** 2026-09-01T17:01:17Z
- **Completed:** 2026-09-01T17:08:11Z
- **Tasks:** 2
- **Tracked output files:** 2

## Selected and Signed Identity

| Field | Value |
|---|---|
| Version | `0.1.0-beta.29` |
| Tag | `v0.1.0-beta.29` |
| Source commit | `867fd57fb026d91c1b1355ac6b27f2b219bdb058` |
| Source tree | `67cdb9dadb840040ec57afede394fcc52a722dc8` |
| Build ID | `2f7d10a946a169b72a7681143220c2aaa789f425458615d6854067bd0e6d3f74` |
| Source SHA-256 | `3b6d88ca9b467ae8088a79b92bea1a5663c13bb4041c97b0363ea3a6e7c75a7c` |
| Consumed version-set SHA-256 | `cb5717da334238f3ed849adfb4f724704421148f4624349b611dc3a22928e97a` |
| Selection SHA-256 | `64fa28f1fd1ae033939385079009234ecfa5f10a30bec807ee18514a8fb13952` |
| Test-report SHA-256 | `259e38832d584e6c5d03809f23b0cb4ce97d0a3d57f7d71417a3bd73808cce71` |
| Trust fingerprint | `fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557` |
| License | `PolyForm-Noncommercial-1.0.0` |

The protected Keychain signer self-check passed before assembly without an OS prompt. The private key was never read, exported, printed or accepted through an override, and no alternate or skip-sign path was used.

## Historical Published Artifacts

| Target | Archive | Exact bytes | SHA-256 |
|---|---|---:|---|
| macOS arm64 | `autoed-0.1.0-beta.29-darwin-arm64.tar.gz` | 227,412,899 | `61e1c2572ef7822f39e73b3785c7cc4b2826fea6220374f4211817159b44b8e4` |
| Windows x64 | `autoed-0.1.0-beta.29-win32-x64.tar.gz` | 250,422,508 | `4729f5a372c844b5a8e510f2fe0b5d663b78c11f44483481855073864324a950` |

The ignored local archives were assembled under `.runtime/releases/0.1.0-beta.29/` and later published at the exact tracked GitHub coordinates. This plan itself did not create a tag, release or remote asset; the later Plan 02-13 attempt did. They are no longer active update inputs.

Shared signed values:

- Manifest SHA-256: `fc0d2288a0980f4ab2a41886b9d877ec110b48c4255a52f16631cee777ce8f08`
- Ed25519 signature SHA-256: `e85cf5837a082d9bf9093f05b48c1ca3ade250baed3460b00e712ba46c41522d`
- Capability-closure SHA-256: `053ef5f3172954fb951f0c81f756da74e903251fb595b216631be2bafb91221f`
- Capability-set SHA-256: `7852a4696d5dbd3383df4e817f77fa5b60419545526c48d98660c2a55760e7b5`
- Signed install-prompt core SHA-256: `354b656250d039a250086ec6262f11c333e6fe213d8455ed0da0d05a49778cb9`
- External prompt SHA-256: `44cfbdf9acda23e842921655346377fa1d5e59e14b6400ebf0d46765e97c150c`

## Accomplishments

- Revalidated beta.29 commit/tree/build/source/consumed-set and canonical selection/report hashes immediately before signing; the selected source surface had zero drift.
- Rebuilt each program, Node and browser component from beta.29 inputs and locked dependency cache. No beta.25–beta.28 archive, component, receipt or prompt was read or copied by assembly.
- Verified target dependency inventories, macOS browser symlinks inside its component ZIP, Windows no-link closure, outer regular-entry proof, signed manifest, license, support gaps and all 16 signed member hashes.
- Generated the external prompt from the strict receipt, binding the stable signed core to exact target names, URLs, byte counts and SHA-256 values without outer-hash self-reference.

## Task Commits

1. **Task 1: assemble and sign fresh beta.29 targets** — `004b3b3`
2. **Task 2: bind the exact beta.29 external install prompt** — `abaa45e`

Historical contract corrections retained by this rerun:

- `3771e77` → `eb2843d` — RED/GREEN two-layer install-prompt contract.
- `ab833b2` → `2958d61` — RED/GREEN structural dependency-path classification.

## Files Created/Modified

- `release/phase2-beta-artifacts.json` — historical beta.29 local signed-artifact receipt removed from the active canonical surface by invalidation commit `0f3be00`; exact bytes remain in Git history.
- `release/phase2-install-prompt.md` — historical beta.29 external prompt likewise removed from the active canonical surface; exact bytes remain in Git history and its public asset descriptors remain immutable.

## Verification

- Focused Plan 02-39 literal filter: **1/1 selected test passed**; 18 tests were excluded by the plan filter.
- Complete `phase2-release-gates.test.ts`: **19/19 passed**.
- Final read-only Phase 2 preflight: **pass** for exact identity, selection/report, manifest, signed core, external prompt, capability set and both local archive bytes.
- Selected-commit sensitive history scan: **pass** across 953 reachable blobs with three existing reviewed detector/negative-fixture exceptions.
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

### Beta.29 Rerun Auto-fixed Issue

**3. [Rule 3 - Blocking Driver Classification] Removed an inapplicable Phase 1 package-root scan from the temporary assembler**

- **Found during:** Task 1 fresh beta.29 assembly
- **Issue:** The temporary driver called the Phase 1 top-level package allowlist, which intentionally does not admit Phase 2's planned `phase2`, `scripts` and `node_modules` roots and stopped with `PUBLIC_PACKAGE_REJECTED` before signing.
- **Fix:** Removed only that duplicate scan from the ignored temporary driver. The Phase 2 member/sensitive scan, exact signed closure, outer archive proof and final preflight remained mandatory and passed.
- **Files modified:** ignored temporary assembly driver only; removed after use
- **Verification:** No beta.29 artifact existed after the stopped attempt; retry passed the 16-member sensitive/closure checks, 19/19 tests and full preflight.

**Total deviations:** 3 retained/auto-fixed issues (2 Rule 1, 1 Rule 3). **Impact:** No product source or release contract changed during beta.29 assembly; fail-closed scanning and signing remained intact.

## TDD Gate Compliance

Task 1 retains explicit RED/GREEN sequences `3771e77` → `eb2843d` and `ab833b2` → `2958d61`. The beta.29 rerun exercises those established contracts against fresh generated artifacts rather than adding an artificial failing receipt test.

## Issues Encountered

The first temporary-driver attempt stopped before signing with `PUBLIC_PACKAGE_REJECTED` because a Phase 1 package-root scanner was applied to a valid Phase 2 closure. The retry used the correct Phase 2 scanner and passed; no partial beta.29 output survived the stopped attempt.

## Known Stubs

None. `windowsNative: not_run/human_needed`, `live: not_run/human_needed` and `phase3: blocked` are deliberate hard-gate states, not placeholders.

## Threat Flags

None. Signing, archive access and prompt delivery are the planned trust surfaces in T2-39-01 through T2-39-03; no network endpoint, authorization path or persistent-data schema was added.

## Authentication Gates

None. The approved protected Keychain identity was available and self-check/signing completed without an OS prompt. No service login or MFA was attempted.

## External Mutation Boundary

- No tag, release, asset, push, publication, remote mutation or authentication occurred.
- No update, installation, Profile access, school/source access, browser action, live UAT or EvidenceLedger L write occurred.
- Only ignored fresh beta.29 local archives and the two tracked Plan 02-39 release metadata files were created; historical release bytes were not changed.

## Decisions Made

- Rebuilt both beta.29 targets from the selected output and locked cached dependencies; never renamed, copied or republished beta.25–beta.28 archive bytes.
- Kept archive-external target coordinates outside the signed core to avoid hash self-reference while binding both layers in the receipt.
- Preserved target-specific symlink semantics inside component archives while the outer archives retain strict regular-entry proof.
- Left AUTH-01 through AUTH-04, SEC-02 and UAT-01 incomplete because AGENTS.md requires real native/live evidence.

## Next Phase Readiness

- Beta.29 is permanently invalidated as published-but-availability-unproven; no beta.29 publication or verifier retry is permitted.
- Plan 02-39 must rerun from beta.30 selection/report and create entirely fresh protected-key signatures and archives before Plan 02-13 can restart.
- Windows native and real login/reopen/restart/Codex-exit/cross-day/reauth evidence remain `not_run/human_needed`; Phase 3 remains blocked.

## Self-Check: PASSED

- Historical beta.29 tracked outputs resolve in Git history and the public release/asset identities match the recorded byte counts and SHA-256 values; no beta.29 file remains an active canonical local release input.
- Task commits `004b3b3` and `abaa45e` plus historical RED/GREEN commits resolve in Git; task commits deleted no tracked files.
- The exact read-only preflight and complete 19-test release-gate file pass against beta.29.
- The temporary assembly driver is absent, selected source diff is zero, and `git diff --check` passes.

---
*Phase: 02-poc-live*
*Completed: 2026-09-02*
