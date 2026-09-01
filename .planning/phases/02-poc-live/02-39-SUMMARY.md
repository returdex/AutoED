---
phase: 02-poc-live
plan: "39"
subsystem: release-assembly
tags: [ed25519, keychain, signed-archive, install-prompt, capability-closure, invalidated]
requires:
  - phase: 02-poc-live
    plans: ["38", "41"]
    provides: historical beta.24 immutable quality identity and two-layer Phase 2 release contracts (subsequently invalidated)
  - phase: 01-beta
    plan: "12"
    provides: fixed protected Keychain Ed25519 trust root
provides:
  - historical invalidated beta.24 signed-archive evidence for darwin-arm64 and win32-x64
  - historical exact 16-member signed closure containing 15 production evidence members plus the stable install-prompt core
  - sanitized proof that the unpublished beta.24 outputs cannot be reused after publisher correction
affects: [02-40, Phase 2 publication, Phase 2 live UAT]
tech-stack:
  added: []
  patterns: [protected-key signing, signed stable core plus external target binding, fail-closed archive closure]
key-files:
  created:
    - release/phase2-beta-artifacts.json
    - release/phase2-install-prompt.md
  modified: []
key-decisions:
  - "The signed install-prompt core is target-stable; only the external prompt binds archive URL, exact bytes and outer SHA-256."
  - "Both targets carry one identical signed 16-member/27-capability closure; target-specific dependency payloads remain inside their independently hashed component archives."
  - "AUTH/UAT requirements remain incomplete until the required native and real-user gates run; local signing is not live evidence."
patterns-established:
  - "Self-reference-safe release prompt: signed stable instructions inside the archive, exact outer archive coordinates outside it."
  - "Release receipt creation is downstream of exact source/build/selection/report, signature, closure, license, gap and sensitive-data verification."
requirements-completed: []
duration: 1h35min cumulative
completed: 2026-09-02
---

# Phase 2 Plan 39: Signed Dual-Target Beta Assembly Summary

**Historical beta.24 signing produced exact dual-target archives, but the later publisher correction permanently invalidated that unpublished identity; its receipts are no longer active and its local bytes cannot be reused.**

## Subsequent Invalidation

Plan 02-13 stopped before remote mutation when the publisher could not distinguish an exact absent-tag GitHub 422 from other errors and compared remote public versions with the separate local consumed-version history. RED/GREEN commits `c4cabf0` and `0e189bc` corrected those semantics, changing selected source. Commit `f80ae3b` therefore permanently invalidated beta.24 and removed `release/phase2-beta-artifacts.json` plus `release/phase2-install-prompt.md` from active canonical state. The ignored beta.24 archives remain local historical bytes only; they were never tagged or published and must not be reused, overwritten or relabelled. Plan 02-39 must run again for the active beta.25 selection.

## Performance

- **Duration:** 1 h 35 min cumulative across the prompt-contract correction, deterministic-assembly correction and final beta.24 run
- **Recorded execution window:** 2026-09-01T12:38:49Z to 2026-09-01T14:13:13Z
- **Final beta.24 assembly:** 8 min from resumed preflight through final verification
- **Tasks:** 2
- **Tracked output files:** 2

## Selected and Signed Identity

| Field | Value |
|---|---|
| Version | `0.1.0-beta.24` |
| Tag | `v0.1.0-beta.24` |
| Source commit | `435c983e06a71559bc764ce34f5099966d94d29e` |
| Source tree | `c82c26962fe0654c6f78f4d5bb7e0dccb71ff2d4` |
| Build ID | `0334678a9e462b2aea6ee32ccf6b00320bad13273baf89f8dca673eecb17c8eb` |
| Source SHA-256 | `e7e9d13a2494639d5ae52dadeb334f2d1c2c011267383b0d7119c2f844d4b7a4` |
| Selection SHA-256 | `c29631d87d131fd78ba5e970aa907e7c595c8be2037895786eec5ffd03d4e995` |
| Test-report SHA-256 | `b91a2458927a5607bc95ad4a0c551661fd414629b3728bc9425b29ebb476c43c` |
| Trust fingerprint | `fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557` |
| License | `PolyForm-Noncommercial-1.0.0` |

The protected Keychain signer self-check passed before assembly. The private key was never read, exported, printed or passed as process input, and no alternate signer or skip-sign path was used.

## Artifacts

| Target | Archive | Exact bytes | SHA-256 |
|---|---|---:|---|
| macOS arm64 | `autoed-0.1.0-beta.24-darwin-arm64.tar.gz` | 227,411,545 | `b050d21c1eede056b1a965e8eaea5466fc7ac51ed4b09f7227fc7a973e074d01` |
| Windows x64 | `autoed-0.1.0-beta.24-win32-x64.tar.gz` | 250,421,634 | `5e06ce05a53dca5fa2698333247f82a4ed3745c291eb5d46938d060be4095e4a` |

Both ignored local archives are under `.runtime/releases/0.1.0-beta.24/`; the tracked receipt records their exact intended immutable GitHub release URLs without creating a tag, release or remote asset.

Shared signed values:

- Manifest SHA-256: `293b253bedd730f63b42fdec4e2b707439a674ff019d41a8919ab8ff40dbff81`
- Ed25519 signature SHA-256: `ad3c50aecac4e71d9d6f9fc15e6d388a7aa94ecab541aebeb183712d1620ecac`
- Capability-closure SHA-256: `8599a9e0827ce90c49e3ae738128dfc6f6f0b24bbd541b68bf9dc3ea972346f6`
- Capability-set SHA-256: `7852a4696d5dbd3383df4e817f77fa5b60419545526c48d98660c2a55760e7b5`
- Signed install-prompt core SHA-256: `d54f7298cf854838c1487d9b8f7dac02d5fe492f92a4f32519290e6595078d8c`
- External prompt SHA-256: `de1e00fad401dea5f7f3c638c62d84a6611efc5359db927de40fc03508541cdf`

## Accomplishments

- Revalidated the sole active beta.24 source commit/tree/build and canonical selection/report receipts immediately before signing; the selected source paths had zero drift.
- Assembled both native targets with the same 15 production evidence members plus signed `phase2/install-prompt-core.md`, closing all 27 checkpoint/update/native-evidence capabilities.
- Verified signature, public trust root, member hashes, platform dependency inventory, license, support gaps and prompt/core/archive substitution rejection locally before receipt creation.
- Generated the external prompt with exact archive names, immutable intended URLs, byte counts and SHA-256 values while keeping enclosing archive descriptors out of the signed core.

## Task Commits

1. **Task 1 contract RED: require the two-layer install-prompt contract** — `3771e77`
2. **Task 1 contract GREEN: implement stable signed core and external binding** — `eb2843d`
3. **Task 1 assembly RED: distinguish dependency package paths from runtime Cookie artifacts** — `ab833b2`
4. **Task 1 assembly GREEN: classify only structural `node_modules` package-name segments safely** — `2958d61`
5. **Task 1: assemble and sign exact beta.24 targets** — `5c3a7b4`
6. **Task 2: bind the exact beta.24 external install prompt** — `3f11232`

## Files Created/Modified

- `release/phase2-beta-artifacts.json` — local signed-artifact receipt with exact identity, target coordinates, signed digests and unresolved support gaps.
- `release/phase2-install-prompt.md` — external two-target instructions bound to the stable signed core and exact outer archive descriptors.

## Verification

- Focused Plan 02-39 verification: **1/1 selected test passed**; the other 13 release-gate tests were excluded by the literal plan filter.
- Complete `phase2-release-gates.test.ts`: **14/14 passed**.
- Read-only Phase 2 preflight: **pass**, including exact version/tag/build, selection/report, signed manifest, core/external prompt, capability set and both targets.
- Sensitive history scan: **pass** across 911 reachable blobs with the three existing reviewed detector/negative-fixture exceptions.
- Direct archive byte counts and SHA-256 values match the receipt; `git diff --check` passes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Prompt Integrity] Removed the outer-archive hash self-reference cycle**

- **Found during:** Task 1 contract review before final beta selection
- **Issue:** A prompt carrying its own enclosing archive descriptor makes the archive hash recursively unstable and cannot be verified deterministically.
- **Fix:** Added the approved two-layer contract: a stable signed embedded core plus an external exact-target prompt.
- **Files modified:** `scripts/release/phase2-artifacts.mjs`, `scripts/release/preflight.mjs`, `tests/integration/phase2-release-gates.test.ts`, `scripts/install/install-from-prompt.mjs`
- **Verification:** RED `3771e77`, GREEN `eb2843d`; all 14 release-gate tests pass.

**2. [Rule 1 - Sensitive Path Classification] Distinguished dependency package names from runtime credential artifacts**

- **Found during:** Task 1 deterministic beta.23 assembly
- **Issue:** The archive member-path scanner rejected locked dependency paths whose package segments are named `cookie`, even though runtime `Profile`, `Cookie` and `Cookies` paths must remain forbidden.
- **Fix:** Allowed `cookie`/`cookies` only when structurally a direct or nested `node_modules` package name and retained fail-closed runtime negatives.
- **Files modified:** `scripts/build/assemble.mjs`, `tests/integration/phase2-release-gates.test.ts`
- **Verification:** RED `ab833b2`, GREEN `2958d61`; full release-gate file passes.

The second correction changed selected source after beta.23 quality binding, so beta.23 was invalidated rather than signed. Plan 02-38 reran its full gates and selected beta.24 before this final assembly.

**Total deviations:** 2 Rule 1 correctness fixes. **Impact:** Both were necessary to make deterministic signed assembly possible without weakening prompt tamper detection or runtime credential-path rejection; no release or live scope expanded.

## TDD Gate Compliance

Task 1 has two explicit RED/GREEN sequences: `3771e77` → `eb2843d` for the two-layer prompt and `ab833b2` → `2958d61` for dependency-path classification. The final receipt records generated, cryptographically verified output rather than introducing an artificial failing receipt test.

## Issues Encountered

An additional ad-hoc broad text regex matched known detector strings, test negatives, SQLite documentation and target binaries when scanning archive members as undifferentiated text. Those are not private path disclosures. The selected production sensitive scanner, exact member policy, complete release-gate tests and final read-only preflight all passed; no selected source was changed for these false positives.

## Known Stubs

None. `windowsNative: not_run/human_needed`, `live: not_run/human_needed` and `phase3: blocked` are deliberate hard-gate states, not placeholders.

## Threat Flags

None. Signing, archive access and prompt delivery are the planned trust surfaces in T2-39-01 through T2-39-03; no network endpoint, authorization path or persistent-data schema was added.

## Authentication Gates

None. The already-approved protected Keychain signing identity was available and self-check/signing completed without an OS authorization prompt. No official service login or MFA was attempted.

## External Mutation Boundary

- No tag, release, asset, push, publication, remote mutation or authentication occurred.
- No update, installation, Profile access, school/source access, browser action, live UAT or EvidenceLedger L write occurred.
- Only ignored local archives and the two tracked Plan 02-39 release metadata files were created.

## Decisions Made

- Kept archive-external target coordinates outside the signed stable core to avoid hash self-reference while binding both layers cryptographically in the tracked receipt.
- Preserved target-specific symlink semantics inside dependency component archives while the signed outer archive maintains the strict regular-entry proof expected by the Phase 2 verifier.
- Left AUTH-01 through AUTH-04, SEC-02 and UAT-01 incomplete because AGENTS.md requires real native/live evidence; local assembly and signing cannot satisfy those human gates.

## Next Phase Readiness

- Beta.24 is not ready for publication. Its tracked receipt/prompt are removed from active state and its ignored archives are historical only.
- Plan 02-38 selected beta.25 after complete fresh gates. Plan 02-39 must assemble and sign new beta.25 targets before Plan 02-13 may resume.
- Windows native and real login/reopen/restart/Codex-exit/cross-day/reauth evidence remain `not_run/human_needed`; Phase 3 remains blocked.

## Self-Check: PASSED (Historical and Invalidation State)

- Original assembly commits `5c3a7b4` and `3f11232` preserve both tracked output files and their exact signed values in Git history.
- `02-38-BETA-24-INVALIDATION.md` records the selection/report/artifact/prompt/archive hashes and confirms no tag, release, asset or publication receipt consumed beta.24.
- Active canonical beta.24 artifact/prompt files are absent, while the ignored local archives remain untouched historical bytes.
- The active beta.25 selection/report supersede beta.24; no current preflight may accept the old artifacts.

---
*Phase: 02-poc-live*
*Completed: 2026-09-02*
