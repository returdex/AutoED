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
  - historical immutable public beta.29 release whose first and only anonymous verifier attempt produced no availability receipt
  - historical immutable public beta.30 release whose first and only anonymous verifier attempt produced no availability receipt
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
  - "Published beta.29 is permanently consumed as availability-unproven; release 380689537, its tag and both assets remain immutable and may never be retried or overwritten."
  - "Published beta.30 is permanently consumed as availability-unproven; release 380716930, its tag and both assets remain immutable and may never be retried or overwritten."
  - "A bounded anonymous metadata/HEAD readiness gate now precedes—but never substitutes for—the one permitted full verifier attempt."
requirements-completed: []
duration: 20min active across initial attempt and beta.25 continuation
completed: 2026-09-02
---

# Phase 2 Plan 13: Immutable Beta Publication History Summary

**AutoED beta.25 remains fully availability-proven historical data, while beta.29 and beta.30 remain immutably published but permanently availability-unproven after their first and only anonymous verifier attempts created no receipt.**

## Upstream Invalidation Amendment

Plan 02-14 failed closed with `UPDATE_GATE_FRESHNESS_MISMATCH`, exposing that beta.25's verifier compared volatile `checkedAt` as though it were immutable. RED/GREEN commits `348e9f4` and `ef52b6c` corrected the contract, and Plan 02-38 invalidated beta.25 without deleting or overwriting tag `v0.1.0-beta.25`, release `380618906` or either public asset. All publication/availability values below are historical evidence only; beta.25 must not be offered for the pending update gate.

After consuming beta.26 through beta.28 on honest gate failures, Plan 02-38 selected and fully qualified beta.29 and Plan 02-39 assembled/signed it. This plan published beta.29 once, but its first and only anonymous verification attempt produced no availability receipt. The same pre-verifier CDN readiness race recurred after fresh qualification, assembly and one-time publication of beta.30. Plan 02-38 therefore invalidated both public identities, added a bounded anonymous readiness gate before the one permitted full verifier, and selected fully qualified beta.31. Corrective Plan 02-39 must now assemble/sign beta.31 before this plan can restart for beta.31.

## Beta.29 Published but Availability Unproven

| Field | Immutable historical value |
|---|---|
| Version / tag | `0.1.0-beta.29` / `v0.1.0-beta.29` |
| Release | ID `380689537`; published `2026-09-01T17:17:54Z` |
| Target commit | `867fd57fb026d91c1b1355ac6b27f2b219bdb058` |
| macOS asset | ID `539882525`; 227,412,899 bytes; SHA-256 `61e1c2572ef7822f39e73b3785c7cc4b2826fea6220374f4211817159b44b8e4` |
| Windows asset | ID `539882528`; 250,422,508 bytes; SHA-256 `4729f5a372c844b5a8e510f2fe0b5d663b78c11f44483481855073864324a950` |
| Publication receipt | created locally at `2026-09-01T17:17:58.590Z`, then removed from the active canonical surface by invalidation |
| Availability receipt | absent; never created |

The release, tag and both assets remain untouched public history. The missing receipt is not inferred as success, and no same-version verifier retry, delete, overwrite, resign or relabel path exists. Public beta.25 release `380618906` and both beta.25 assets were rechecked read-only and remain unchanged.

## Beta.30 Published but Availability Unproven

| Field | Immutable historical value |
|---|---|
| Version / tag | `0.1.0-beta.30` / `v0.1.0-beta.30` |
| Release | ID `380716930`; created `2026-09-01T17:22:53Z`; published `2026-09-01T18:04:19Z` |
| Target commit | `0f3be001fa259890041273eee01119b1ba8edc1e` |
| macOS asset | ID `539932724`; 227,412,187 bytes; SHA-256 `b0841a2378710c40f6514622e5a0df9bcd1297760975f4a45bcdde3b9c3f77ea` |
| Windows asset | ID `539932725`; 250,424,350 bytes; SHA-256 `a9429810b68d59970a68219fed994d89216042f4b6647c88ecebe67ab0f11396` |
| Publication receipt | captured locally, then removed from the active canonical surface by invalidation |
| Availability receipt | absent; never created |

The beta.30 release, tag and assets remain untouched public history. RED `c43797d` and GREEN `666d3a8` correct the systemic race with a fixed 120-second, seven-attempt anonymous readiness gate that checks only exact release metadata plus safe asset HEAD/redirect/content-length state. It makes no byte, signature, closure, receipt or pass claim; timeout/mismatch fails closed, and the full verifier is still invoked exactly once only after readiness.

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
5. **Beta.29 signed-handoff revalidation before publication** — `64fbe66`
6. **Beta.29 one-time publication / failed anonymous verifier boundary** — remote release `380689537`; no completion commit because Task 2 failed closed before an availability receipt existed
7. **Upstream immutable beta.29 invalidation** — `0f3be00`
8. **Beta.30 one-time publication / failed anonymous verifier boundary** — release `380716930`; no availability receipt exists
9. **Readiness RED/GREEN** — `c43797d` / `666d3a8`
10. **Upstream immutable beta.30 invalidation** — `7e3044f`

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

**3. [Rule 1 - Anonymous CDN Readiness] Added a bounded readiness gate before the one full verifier attempt**

- **Found during:** identical beta.29 and beta.30 post-publication races
- **Issue:** Publication metadata existed, but the first full anonymous verifier reached the CDN before both immutable assets were ready. The one-attempt/no-retry rule correctly left both releases unavailable for update.
- **Fix:** Upstream RED/GREEN `c43797d` / `666d3a8` added strict anonymous release/asset identity checks and safe HEAD readiness polling before the full verifier, preserving exact-one verifier invocation and every no-overwrite/no-retry rule.
- **Verification:** focused readiness 3/3, complete release gates 22/22, typecheck/syntax pass, followed by the complete fresh beta.31 quality gate.

**Total deviations:** 3 Rule 1 correctness repairs. **Impact:** The publisher and readiness repairs preserve exact public history while preventing premature verifier consumption; the metadata repair preserved dependency order and hard gates. None widened scope, identity, overwrite or live authority.

## Authentication Gates

None. The approved isolated `returdex` publication identity was already authenticated and required no login, MFA or OS approval. The unrelated default GitHub account was neither used nor switched.

## Known Stubs

None. The native/live/Phase 3 states are deliberate hard gates, not placeholders.

## Threat Flags

None. The tag, release assets and public download URLs are the exact planned T2-13 trust surfaces. No endpoint, auth path, schema or source-access boundary was added.

## External Mutation Boundary

- Remote mutation was limited to the original exact beta.25 publication and the later exact beta.29 and beta.30 one-time publications. This amendment performed no remote mutation.
- No tag or asset was overwritten, forced, resigned, rebuilt or replaced.
- No update, installation, login/MFA, Profile/browser, school/source, course, runtime-data or live-evidence operation occurred.
- Invalidated beta.21 through beta.24 and beta.26 through beta.28 remain unpublished; invalidated beta.25, beta.29 and beta.30 remain immutable public history.

## Decisions Made

- Published beta.25 only after repeating signed-manifest, update-gate, identity, repository and absence checks against its fresh bytes.
- Kept public release history distinct from the monotonic locally consumed identity prefix.
- Kept all AUTH/UAT requirements pending until their required user-run native/live evidence exists.

## Next Phase Readiness

- Public beta.25, beta.29 and beta.30 remain available only as immutable historical data and are not eligible for Plan 02-14.
- Rerun Plan 02-39 for beta.31, then rerun this publication plan once for beta.31 through the readiness-before-verification flow before the hard human update checkpoint can restart.
- Plan 02-14 must stop for the user's actual update and feedback; this summary supplies no post-update or live pass.
- Windows and all real login/reopen/restart/Codex-exit/cross-day/reauth gates remain mandatory, and Phase 3 remains blocked.

## Self-Check: PASSED

- Historical publication and availability receipt bytes remain in Git history, while their active canonical files were removed by the beta.25 invalidation; the summary and public objects remain.
- Beta.29 release `380689537`, tag and both assets were captured read-only; no availability receipt exists, and beta.29 active local receipts were removed by invalidation commit `0f3be00`.
- Beta.30 release `380716930`, tag and both assets were captured read-only; no availability receipt exists, and beta.30 active local receipts were removed by invalidation commit `7e3044f`.
- Historical/corrective commits `e5933d4`, `c4cabf0`, `0e189bc` and final beta.25 Task commits `90b1b45`, `be0cce2` all resolve in Git.
- Complete `phase2-release-gates.test.ts` passes 16/16 after publication, and `git diff --check` passes.
- Remote main/tag/release target the exact selected commit; both public asset names and byte counts match the anonymous availability receipt.

---
*Phase: 02-poc-live*
*Completed: 2026-09-02*
