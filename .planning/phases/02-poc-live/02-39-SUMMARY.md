---
phase: 02-poc-live
plan: "39"
subsystem: release-assembly
tags: [ed25519, keychain, signed-archive, install-prompt, capability-closure, beta25, invalidated]
requires:
  - phase: 02-poc-live
    plans: ["38", "41"]
    provides: historical beta.25 identity and quality evidence, subsequently invalidated by the update-freshness correction
  - phase: 01-beta
    plan: "12"
    provides: fixed protected Keychain Ed25519 trust root
provides:
  - historical invalidated beta.25 signed-archive evidence for darwin-arm64 and win32-x64
  - historical exact 16-member signed closure containing 15 production evidence members plus the stable install-prompt core
  - sanitized proof that published beta.25 outputs cannot be reused after source correction
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
  - "Beta.25 was rebuilt and signed from its selected source, then permanently invalidated after the update-freshness source correction; its public bytes remain historical and unusable for the next release."
  - "The signed install-prompt core remains target-stable; only the external prompt binds archive URL, exact bytes and outer SHA-256."
  - "AUTH/UAT requirements remain incomplete until required native and real-user gates run; local signing is not live evidence."
patterns-established:
  - "Self-reference-safe release prompt: signed stable instructions inside the archive, exact outer archive coordinates outside it."
  - "Release receipt creation follows source/build/selection/report, signer, closure, component inventory, license, gap and sensitive-data verification."
requirements-completed: []
duration: 1h42min cumulative
completed: 2026-09-02
---

# Phase 2 Plan 39: Signed Dual-Target Beta Assembly Summary

**Historical beta.25 macOS arm64 and Windows x64 archives were protected-Keychain Ed25519 signed and published, but are now permanently invalidated as active update inputs; their exact public history remains immutable.**

## Upstream Invalidation Amendment

Plan 02-14 failed closed because the selected beta.25 verifier treated volatile availability `checkedAt` as an immutable equality field. Corrective commits `348e9f4` and `ef52b6c` changed source, so Plan 02-38 permanently invalidated beta.25 without overwriting or deleting its public tag, release or assets. Every beta.25 identity, artifact and verification value below is historical only and must not be reused, resigned, relabelled or offered as the current update candidate.

Plan 02-38 subsequently consumed beta.26 through beta.28 after honest gate failures and produced the fully green beta.29 selection/report. This plan must rerun from beta.29 before publication can restart; active `release/phase2-beta-artifacts.json` and `release/phase2-install-prompt.md` do not exist yet.

## Performance

- **Duration:** 1 h 42 min cumulative across the original contract corrections, beta.24 run and beta.25 rerun
- **Beta.25 rerun:** 7 min
- **Started:** 2026-09-01T15:07:43Z
- **Completed:** 2026-09-01T15:15:00Z
- **Tasks:** 2
- **Tracked output files:** 2

## Selected and Signed Identity

| Field | Value |
|---|---|
| Version | `0.1.0-beta.25` |
| Tag | `v0.1.0-beta.25` |
| Source commit | `f80ae3b6f7bb5f600e0a0a60b55c61c1a043f804` |
| Source tree | `8e702d1311e26dd26bd4b191a9157a5f29db4772` |
| Build ID | `6c44e404b42e72c8dfb3f1dfef3bb9aa1f5cb95f17de32280019cc23c89c20e5` |
| Source SHA-256 | `24478d9e7d392e538b0037cb4b804c629f0f864b427d585dc2d871f49bec221c` |
| Version-set SHA-256 | `d99d2c596d648d9c7a9dbab9e347f3294623a5e92216ffdc135fab4fce70ad62` |
| Selection SHA-256 | `4a2c250708d02ee19b2e44bd0de215850a08620ad3eac4ff0991702eeec94bae` |
| Test-report SHA-256 | `005c62b326bd13aa0ec62e583858b6377d0405454ca7f846011b9f789e18d51a` |
| Trust fingerprint | `fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557` |
| License | `PolyForm-Noncommercial-1.0.0` |

The protected Keychain signer self-check passed before assembly. The private key was never read, exported, printed or accepted through an override, and no alternate or skip-sign path was used.

## Historical Invalidated Artifacts

| Target | Archive | Exact bytes | SHA-256 |
|---|---|---:|---|
| macOS arm64 | `autoed-0.1.0-beta.25-darwin-arm64.tar.gz` | 227,413,903 | `56f141ff2e3d8e054c5cb299bcc7e715e1bd638ac88aa8ce2b867ca4e995d338` |
| Windows x64 | `autoed-0.1.0-beta.25-win32-x64.tar.gz` | 250,419,021 | `579fbdea67e103734842ffe8157f5f5c97e66d8c1bbfec24a2ed006cdc1728ec` |

Both ignored local archives are under `.runtime/releases/0.1.0-beta.25/`. Their tracked URLs are intended immutable GitHub release coordinates only; this plan did not create a tag, release or remote asset.

Shared signed values:

- Manifest SHA-256: `c2c1100f338a078fe8682bb05927c2e552973de4acb8977257307179604204a8`
- Ed25519 signature SHA-256: `15bc1af968e0b06b4a193cc6c770e0ae5fbf76ce9e12bc3e74da65f28afe3bb2`
- Capability-closure SHA-256: `c1e7ede3907d7fe65de4c416b9d06897aff7dce0c94cd65a1b5441b2e5adb949`
- Capability-set SHA-256: `7852a4696d5dbd3383df4e817f77fa5b60419545526c48d98660c2a55760e7b5`
- Signed install-prompt core SHA-256: `48ed614431d98998199b4c4f82be2c8ff0787870a5ac56717584bb0fd5495fc0`
- External prompt SHA-256: `13be26d9fe90564e247804b0cfc19da8a30d4b2275aa74c61af756d67227c6cd`

## Accomplishments

- Revalidated beta.25 commit/tree/build/source/version-set plus canonical selection/report hashes immediately before signing; the selected source surface had zero drift.
- Rebuilt each program, Node and browser component from beta.25 inputs. The beta.25 outer hashes differ from historical beta.24, whose ignored bytes remain untouched and invalidated.
- Verified exact target dependency inventories, macOS browser symlinks inside its component ZIP, Windows no-link closure, outer regular-entry proof, signed manifest, license, support gaps and all 16 member hashes.
- Generated the external prompt from the strict receipt, binding the stable signed core to exact target names, URLs, byte counts and SHA-256 values without outer-hash self-reference.

## Task Commits

Current beta.25 rerun:

1. **Task 1: assemble and sign fresh beta.25 targets** — `6e6a304`
2. **Task 2: bind the exact beta.25 external install prompt** — `fe64201`

Historical contract and assembly corrections retained by this rerun:

- `3771e77` → `eb2843d` — RED/GREEN two-layer install-prompt contract.
- `ab833b2` → `2958d61` — RED/GREEN structural dependency-path classification.
- `5c3a7b4` / `3f11232` — historical beta.24 local assembly/prompt, later invalidated before publication.

## Files Created/Modified

- `release/phase2-beta-artifacts.json` — active beta.25 local signed-artifact receipt with exact identity, target coordinates, signed digests and unresolved support gaps.
- `release/phase2-install-prompt.md` — active beta.25 external prompt bound to the stable signed core and fresh outer archives.

## Verification

- Focused Plan 02-39 filter: **1/1 selected test passed**; 15 tests were excluded by the plan's literal filter.
- Complete `phase2-release-gates.test.ts`: **16/16 passed**.
- Final read-only Phase 2 preflight: **pass** for exact identity, selection/report, manifest, signed core, external prompt, capability set and both local archive bytes.
- Selected-commit sensitive history scan: **pass** across 926 reachable blobs with three existing reviewed detector/negative-fixture exceptions.
- Direct archive byte counts and SHA-256 values match the receipt; beta.25 hashes are distinct from beta.24; `git diff --check` passes.

## Deviations from Plan

### Historical Auto-fixed Issues Retained by the Contract

**1. [Rule 1 - Prompt Integrity] Removed the outer-archive hash self-reference cycle**

- **Found during:** original Task 1 contract review
- **Fix:** Added the approved stable signed embedded core plus external exact-target prompt.
- **Verification:** RED `3771e77`, GREEN `eb2843d`; all 16 current release-gate tests pass.

**2. [Rule 1 - Sensitive Path Classification] Distinguished dependency package names from runtime credential artifacts**

- **Found during:** historical beta.23 deterministic assembly
- **Fix:** Allowed `cookie`/`cookies` only as structural `node_modules` package names while runtime Profile/Cookie/Cookies paths remain rejected.
- **Verification:** RED `ab833b2`, GREEN `2958d61`; all 16 current release-gate tests pass.

The beta.25 rerun introduced no new deviation. Upstream publisher fixes `c4cabf0`/`0e189bc` changed selected source, so Plan 02-38 permanently invalidated unpublished beta.24 and selected beta.25 after complete fresh gates. This plan rebuilt rather than relabelled the old bytes.

**Total deviations:** 2 historical Rule 1 correctness fixes, 0 new in the beta.25 rerun. **Impact:** Prompt tamper detection and runtime credential-path rejection remain strict; no release or live scope expanded.

## TDD Gate Compliance

Task 1 retains two explicit RED/GREEN sequences: `3771e77` → `eb2843d` for the two-layer prompt and `ab833b2` → `2958d61` for dependency-path classification. The beta.25 rerun exercises those established contracts against fresh generated artifacts rather than adding an artificial failing receipt test.

## Issues Encountered

None in the beta.25 rerun.

## Known Stubs

None. `windowsNative: not_run/human_needed`, `live: not_run/human_needed` and `phase3: blocked` are deliberate hard-gate states, not placeholders.

## Threat Flags

None. Signing, archive access and prompt delivery are the planned trust surfaces in T2-39-01 through T2-39-03; no network endpoint, authorization path or persistent-data schema was added.

## Authentication Gates

None. The already-approved protected Keychain identity was available and self-check/signing completed without an OS prompt. No service login or MFA was attempted.

## External Mutation Boundary

- No tag, release, asset, push, publication, remote mutation or authentication occurred.
- No update, installation, Profile access, school/source access, browser action, live UAT or EvidenceLedger L write occurred.
- Only ignored fresh beta.25 local archives and the two tracked Plan 02-39 release metadata files were created; historical beta.24 bytes were not changed.

## Decisions Made

- Rebuilt both beta.25 targets from the selected output and cached locked dependencies; never renamed, copied or republished beta.24 archive bytes.
- Kept archive-external target coordinates outside the signed core to avoid hash self-reference while binding both layers in the receipt.
- Preserved target-specific symlink semantics inside component archives while the outer archives retain strict regular-entry proof.
- Left AUTH-01 through AUTH-04, SEC-02 and UAT-01 incomplete because AGENTS.md requires real native/live evidence.

## Next Phase Readiness

- Rerun this plan to assemble and sign fresh beta.29 artifacts from selection SHA-256 `64fa28f1fd1ae033939385079009234ecfa5f10a30bec807ee18514a8fb13952` and report SHA-256 `259e38832d584e6c5d03809f23b0cb4ce97d0a3d57f7d71417a3bd73808cce71`.
- Public beta.25 and all beta.26-beta.28 histories are consumed; none may be reused, overwritten, resigned or relabelled.
- Windows native and real login/reopen/restart/Codex-exit/cross-day/reauth evidence remain `not_run/human_needed`; Phase 3 remains blocked.

## Self-Check: PASSED

- Historical beta.25 tracked outputs and ignored archives were removed from the active release surface by the beta.25 invalidation; their exact prior bytes/digests remain in Git/public history.
- Current Task commits `6e6a304` and `fe64201`, historical RED/GREEN commits and beta.24 history all resolve in Git; task commits deleted no tracked files.
- The historical exact preflight passed against beta.25 before publication; current release-gate coverage passes 19/19 against the corrected contract, but beta.25 itself is no longer eligible.
- The temporary assembly driver was removed, no selected source path differs from beta.25, and `git diff --check` passes.

---
*Phase: 02-poc-live*
*Completed: 2026-09-02*
