---
phase: 02-poc-live
plan: "13"
subsystem: release-publication
tags: [github-release, immutable-publication, anonymous-availability, signed-beta, update-gate]
requires:
  - phase: 02-poc-live
    plans: ["38", "39"]
    provides: historical beta.25 identity and signed dual-target archives, subsequently invalidated by the update-freshness correction
provides:
  - historical immutable public beta.25 release owned and authenticated only by returdex
  - historical anonymous full-byte availability proof for both signed native archives
  - sanitized proof that beta.25 public objects remain untouched but cannot satisfy the corrected update gate
affects: [02-14 through 02-34, 02-40, Phase 2 live UAT]
tech-stack:
  added: []
  patterns: [isolated publication identity, no-overwrite release transaction, anonymous cryptographic refetch]
key-files:
  created:
    - release/phase2-publication.json
    - release/phase2-availability.json
    - .planning/phases/02-poc-live/02-13-SUMMARY.md
  modified: []
key-decisions:
  - "Only fresh beta.25 was published; invalidated beta.21 through beta.24 remain consumed but unpublished and cannot be relabelled."
  - "A later source correction invalidated beta.25 as an active candidate without deleting or overwriting its immutable public tag, release or assets."
  - "Publication used the locked isolated returdex GitHub configuration even though the unrelated default gh account remains ywan1303."
  - "Publication and anonymous availability leave Windows native and live evidence not_run/human_needed and Phase 3 blocked."
requirements-completed: []
duration: 20min active across initial attempt and beta.25 continuation
completed: 2026-09-02
---

# Phase 2 Plan 13: Immutable Beta Publication and Availability Summary

**AutoED 0.1.0-beta.25 remains immutably published under `returdex/AutoED`, but a later source correction permanently invalidated it as the active update candidate; its exact public objects are preserved as historical data.**

## Upstream Invalidation Amendment

Plan 02-14 failed closed with `UPDATE_GATE_FRESHNESS_MISMATCH`, exposing that beta.25's verifier compared volatile `checkedAt` as though it were immutable. RED/GREEN commits `348e9f4` and `ef52b6c` corrected the contract, and Plan 02-38 invalidated beta.25 without deleting or overwriting tag `v0.1.0-beta.25`, release `380618906` or either public asset. All publication/availability values below are historical evidence only; beta.25 must not be offered for the pending update gate.

After consuming beta.26 through beta.28 on honest gate failures, Plan 02-38 selected and fully qualified beta.29. Plan 02-39 must assemble/sign beta.29 and this plan must then rerun its no-overwrite publication/anonymous availability flow before Plan 02-14 restarts.

## Performance

- **Active execution:** approximately 20 min across the original fail-closed attempt and beta.25 continuation
- **Beta.25 continuation:** 6 min (`2026-09-01T15:20:58Z` to `2026-09-01T15:27:36Z`)
- **Tasks:** 2
- **Tracked output files:** 3, including this summary
- **Remote release:** `https://github.com/returdex/AutoED/releases/tag/v0.1.0-beta.25`

## Published Identity

| Field | Value |
|---|---|
| Version | `0.1.0-beta.25` |
| Tag | `v0.1.0-beta.25` |
| Source commit | `f80ae3b6f7bb5f600e0a0a60b55c61c1a043f804` |
| Source tree | `8e702d1311e26dd26bd4b191a9157a5f29db4772` |
| Build ID | `6c44e404b42e72c8dfb3f1dfef3bb9aa1f5cb95f17de32280019cc23c89c20e5` |
| Manifest SHA-256 | `c2c1100f338a078fe8682bb05927c2e552973de4acb8977257307179604204a8` |
| Trust fingerprint | `fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557` |
| License | `PolyForm-Noncommercial-1.0.0` |
| Repository ID | `1350421724` |

The repository-local Git author and committer are `returdex <73513006+returdex@users.noreply.github.com>`. The publisher used only its protected isolated GitHub configuration, whose active account is `returdex` ID `73513006`; the default `gh` account `ywan1303` was never used or changed.

## Public Assets and Anonymous Availability

| Target | Asset ID | Exact bytes | SHA-256 | Anonymous verification |
|---|---:|---:|---|---|
| macOS arm64 | `539741564` | 227,413,903 | `56f141ff2e3d8e054c5cb299bcc7e715e1bd638ac88aa8ce2b867ca4e995d338` | pass |
| Windows x64 | `539741557` | 250,419,021 | `579fbdea67e103734842ffe8157f5f5c97e66d8c1bbfec24a2ed006cdc1728ec` | pass |

- Publication confirmation completed at `2026-09-01T15:25:21.945Z`.
- Anonymous clean-directory refetch completed at `2026-09-01T15:26:30.516Z`.
- Both refetched archives matched their exact URL, byte count and SHA-256.
- Both archives independently passed manifest, Ed25519 signature, fixed fingerprint, signed install-prompt core, license, member hash and capability-closure verification.
- The release is a non-draft prerelease targeting the exact selected commit. No existing tag, asset or receipt was overwritten.

## Signed Update Handoff

- Source verifier SHA-256: `ab2da7c08053d729f47449eac57cc511e4131f6b87f96a70d22183909104a9eb`.
- Both beta.25 archives contain that exact verifier hash in their signed capability manifests and carry byte-identical verifier source.
- Each target contains the same exact 16 signed release members and all 27 declared Phase 2 workflow, live-gate, update and native-evidence capabilities.
- macOS and Windows pre/post fixtures passed, including platform spoof, WSL substitution, identity/hash drift, stale/future receipt, unavailable asset, incomplete cleanup and mutation-authority negatives.
- The real macOS pre-update command consumed the current publication and fresh availability receipts and returned `MACOS_UPDATE_READY`; it performed no runtime mutation.

## Hard Gaps Preserved

| Gate | State |
|---|---|
| Human update/install | `not_run/human_needed` |
| Windows native | `not_run/human_needed` |
| Live Moodle/EdStem evidence | `not_run/human_needed` |
| Phase 3 | `blocked` |

Publication does not establish installation, cleanup, API/Worker/UI post-update readiness, native Windows evidence, official login, account binding, Profile persistence or any L evidence. AUTH-01 through AUTH-04, SEC-02 and UAT-01 remain incomplete.

## Task Commits

1. **Historical beta.24 read-only handoff evidence** — `e5933d4`
2. **Publisher reconciliation RED/GREEN discovered during Task 2** — `c4cabf0` / `0e189bc`
3. **Task 1: revalidate fresh beta.25 signed update handoff** — `90b1b45`
4. **Task 2: publish once and prove anonymous beta.25 availability** — `be0cce2`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Publisher Reconciliation] Corrected exact absent-tag and public-versus-consumed handling before publication**

- **Found during:** Task 2's original beta.24 immutable publication preflight
- **Issue:** GitHub returned an exact HTTP 422 for the intentionally absent tag, and the publisher conflated the remote public release set with locally consumed unpublished beta identities.
- **Fix:** Upstream RED/GREEN commits `c4cabf0` / `0e189bc` added exact absent-tag classification and separate fail-closed public/consumed reconciliation. Because publisher source changed, beta.24 was permanently invalidated and Plans 02-38/02-39 fully requalified and signed fresh beta.25 before this continuation.
- **Files modified upstream:** `scripts/release/publish.mjs`, `tests/integration/phase2-release-gates.test.ts`
- **Verification:** complete fresh five-suite beta.25 quality gate, 16/16 release-gate tests, exact signed preflight, no beta.24 remote mutation, and successful beta.25 publication/anonymous verification
- **Commits:** `c4cabf0`, `0e189bc`

**2. [Rule 1 - Planning Metadata] Corrected the generic state handler's dependency-order misparse**

- **Found during:** Plan completion metadata update
- **Issue:** The generic numeric plan counter parsed the existing dependency-ordered `02-39` position as `3-39`, set `Ready to execute`, and could not record this plan's custom metrics or decisions.
- **Fix:** Restored the exact project state directly, advanced Phase 2 from 18/41 to 19/41, recorded beta.25 publication/availability without completing requirements, and updated the roadmap current stop to the Plan 02-14 hard human gate.
- **Files modified:** `.planning/STATE.md`, `.planning/ROADMAP.md`
- **Verification:** STATE and ROADMAP agree on 19/41, beta.25 publication, remaining native/live gaps and Phase 3 blocking; `git diff --check` passes.
- **Commit:** final Plan 02-13 metadata commit

**Total deviations:** 2 Rule 1 correctness repairs. **Impact:** The publisher repair prevented false absence/public-history claims, and the metadata repair preserved the project's dependency order and hard gates; neither widened scope, identity, overwrite or live authority.

## Authentication Gates

None. The approved isolated `returdex` publication identity was already authenticated and required no login, MFA or OS approval. The unrelated default GitHub account was neither used nor switched.

## Known Stubs

None. The native/live/Phase 3 states are deliberate hard gates, not placeholders.

## Threat Flags

None. The tag, release assets and public download URLs are the exact planned T2-13 trust surfaces. No endpoint, auth path, schema or source-access boundary was added.

## External Mutation Boundary

- Remote mutation was limited to fast-forwarding `returdex/AutoED` main to the exact selected source commit and creating immutable prerelease tag/assets for beta.25.
- No tag or asset was overwritten, forced, resigned, rebuilt or replaced.
- No update, installation, login/MFA, Profile/browser, school/source, course, runtime-data or live-evidence operation occurred.
- Invalidated beta.21 through beta.24 remain unpublished.

## Decisions Made

- Published beta.25 only after repeating signed-manifest, update-gate, identity, repository and absence checks against its fresh bytes.
- Kept public release history distinct from the monotonic locally consumed identity prefix.
- Kept all AUTH/UAT requirements pending until their required user-run native/live evidence exists.

## Next Phase Readiness

- Public beta.25 remains available only as immutable historical data and is not eligible for Plan 02-14.
- Rerun Plan 02-39 for beta.29, then rerun this publication plan before the hard human update checkpoint can restart.
- Plan 02-14 must stop for the user's actual update and feedback; this summary supplies no post-update or live pass.
- Windows and all real login/reopen/restart/Codex-exit/cross-day/reauth gates remain mandatory, and Phase 3 remains blocked.

## Self-Check: PASSED

- Historical publication and availability receipt bytes remain in Git history, while their active canonical files were removed by the beta.25 invalidation; the summary and public objects remain.
- Historical/corrective commits `e5933d4`, `c4cabf0`, `0e189bc` and final beta.25 Task commits `90b1b45`, `be0cce2` all resolve in Git.
- Complete `phase2-release-gates.test.ts` passes 16/16 after publication, and `git diff --check` passes.
- Remote main/tag/release target the exact selected commit; both public asset names and byte counts match the anonymous availability receipt.

---
*Phase: 02-poc-live*
*Completed: 2026-09-02*
