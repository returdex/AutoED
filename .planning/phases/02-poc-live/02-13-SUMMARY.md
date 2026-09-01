---
phase: 02-poc-live
plan: "13"
subsystem: release-publication
tags: [github-release, immutable-publication, anonymous-availability, signed-beta, update-gate, cdn-readiness]
requires:
  - phase: 02-poc-live
    plans: ["38", "39"]
    provides: beta.31 source-bound quality evidence and signed dual-target archives with bounded anonymous readiness
provides:
  - immutable public beta.31 release owned and authenticated only by returdex
  - strict anonymous full-byte availability proof for both signed native archives
  - bounded metadata/HEAD readiness before the one permitted full verifier attempt
  - immutable historical preservation of published beta.25, beta.29 and beta.30
affects: [02-14 through 02-34, 02-40, Phase 2 live UAT]
tech-stack:
  added: []
  patterns: [isolated publication identity, no-overwrite release transaction, bounded CDN readiness, anonymous cryptographic refetch]
key-files:
  created:
    - release/phase2-publication.json
    - release/phase2-availability.json
  modified:
    - .planning/phases/02-poc-live/02-13-SUMMARY.md
    - .planning/STATE.md
    - .planning/ROADMAP.md
key-decisions:
  - "beta.31 is the sole active published update candidate; beta.25, beta.29 and beta.30 remain immutable invalidated public history."
  - "The bounded anonymous metadata/HEAD readiness gate makes no availability claim and precedes exactly one full-byte verifier attempt."
  - "Publication and availability leave Windows native and live evidence not_run/human_needed and Phase 3 blocked."
requirements-completed: []
duration: 10min beta.31 completion
completed: 2026-09-02
---

# Phase 2 Plan 13: Immutable Beta.31 Publication and Availability Summary

**AutoED 0.1.0-beta.31 is immutably published under `returdex/AutoED` and independently availability-proven by one clean anonymous full-byte verification after bounded CDN readiness.**

## Performance

- **Beta.31 active execution:** approximately 10 min
- **Tasks:** 2
- **Tracked output files:** 3, including this summary
- **Remote release:** `https://github.com/returdex/AutoED/releases/tag/v0.1.0-beta.31`

## Published Identity

| Field | Value |
|---|---|
| Version / tag | `0.1.0-beta.31` / `v0.1.0-beta.31` |
| Release ID | `380751233` |
| Source commit | `7e3044fbfc66ef14431f419e56c833951e24e4f9` |
| Source tree | `786707f3e0f3e011ecf8fb39901e2e1578b6959a` |
| Build ID | `003e0aa9ee74b77123741b9dbbc4f723acfd1783bee6b59054f49c46caff0a7f` |
| Manifest SHA-256 | `567484ea34e35af4a5cf4250e654e059546a47ff4a8050ab623f10313fa836c3` |
| Trust fingerprint | `fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557` |
| License | `PolyForm-Noncommercial-1.0.0` |
| Repository ID | `1350421724` |

Repository-local author and committer were separately verified as `returdex <73513006+returdex@users.noreply.github.com>`. Publication used only the protected isolated GitHub configuration authenticated as `returdex` ID `73513006`; repository identity and `origin` were exact, beta.31 was absent before mutation, and remote main was a safe ancestor of the selected commit.

## Public Assets and Anonymous Availability

| Target | Asset ID | Exact bytes | SHA-256 | Anonymous verification |
|---|---:|---:|---|---|
| macOS arm64 | `539997596` | 227,416,297 | `ef69ead91073aec94e1a7312ae69bb4a4f81f64a484b1ad4919e2b7369b715f1` | pass |
| Windows x64 | `539997598` | 250,425,315 | `aa12bcdf2e068dc6be2ffa15ee3f5d5e2fa272e4527d0343ca3a0bd21c41cf8a` | pass |

- Publication confirmation completed at `2026-09-01T19:02:03.608Z`.
- Bounded anonymous readiness confirmed exact release metadata, target commit, asset IDs, safe redirects and exact content lengths without downloading bytes or claiming availability.
- The first and only full verifier attempt completed at `2026-09-01T19:03:10.623Z` from a clean protected temporary directory.
- Both complete downloads matched exact URL, byte count and SHA-256, then independently passed Ed25519 signature, fixed fingerprint, manifest, license, signed install-prompt core, all 16 signed member hashes and all 27 declared capabilities.
- Publication receipt SHA-256: `7f192f81a79508564fbde1519c167c30a842bb35b4589a674a384d4d45053b14`.
- Availability receipt SHA-256: `fe29eecf6997c4bace6d4415e55d29b07fbce454e4954ddaa228b4ec384473a0`.

## Signed Update Handoff

- Source and both signed archives contain the same update-verifier SHA-256 `e570749b058c926525e26f6fd5b4123ea880a5380ac1188f47f425c12114f72c`.
- Both native archives bind the exact beta.31 commit/tree/build/source identity and the same 16-member/27-capability closure.
- Focused update/readiness tests passed 4/4, the live-gate update fixtures passed 3/3, and the complete release-gate file passed 22/22.
- Exact signed read-only preflight passed across selection, test report, source history, prompt, manifests, signatures and both outer archive bytes.

## Immutable Historical Releases

| Version | Release | Target | Asset IDs | Disposition |
|---|---:|---|---|---|
| beta.25 | `380618906` | `f80ae3b6…` | `539741564`, `539741557` | availability-proven historical, invalidated by later update correction |
| beta.29 | `380689537` | `867fd57f…` | `539882525`, `539882528` | availability-unproven historical; never retry or overwrite |
| beta.30 | `380716930` | `0f3be001…` | `539932724`, `539932725` | availability-unproven historical; never retry or overwrite |

All three releases, tags, targets, asset IDs, names and byte sizes were rechecked immediately after beta.31 publication and remained unchanged. No historical release was retried, deleted, overwritten, forced, resigned or relabelled.

## Hard Gaps Preserved

| Gate | State |
|---|---|
| Human update/install | `not_run/human_needed` |
| Windows native | `not_run/human_needed` |
| Live Moodle/EdStem evidence | `not_run/human_needed` |
| Phase 3 | `blocked` |

Publication does not establish installation, cleanup, API/Worker/UI post-update readiness, native Windows evidence, official login, account binding, Profile persistence or any L evidence. AUTH-01 through AUTH-04, SEC-02 and UAT-01 remain incomplete.

## Task Commits

1. **Task 1: revalidate beta.31 signed update handoff and readiness contract** — `d924314`
2. **Task 2: publish once and prove anonymous beta.31 availability** — `012a2df`

Relevant historical evidence remains in Git: beta.25 Task commits `90b1b45` / `be0cce2`; beta.29 and beta.30 read-only revalidations `64fbe66` / `1d739ba`; readiness RED/GREEN `c43797d` / `666d3a8`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Publisher Reconciliation] Corrected exact absent-tag and public-versus-consumed handling**

- **Found during:** historical beta.24 publication preflight.
- **Fix:** RED/GREEN `c4cabf0` / `0e189bc` added exact absent-tag classification and separate public/consumed reconciliation.
- **Impact:** Prevented a false absence/public-history claim; no identity or overwrite authority widened.

**2. [Rule 1 - Planning Metadata] Preserved dependency-ordered Phase 2 state**

- **Found during:** historical Plan 02-13 metadata completion.
- **Fix:** Kept the project-specific 19/41 position and hard-gate language instead of using the generic numeric handler that misparsed dependency-ordered `02-39`.
- **Impact:** Requirements remain incomplete and Phase 3 remains blocked.

**3. [Rule 1 - Anonymous CDN Readiness] Added bounded readiness before the one full verifier attempt**

- **Found during:** beta.29 and beta.30 post-publication races.
- **Fix:** Upstream RED/GREEN `c43797d` / `666d3a8` added strict anonymous metadata/HEAD readiness with a fixed 120-second bound, safe redirect/content-length checks, no availability claim, and exactly one later full verifier invocation.
- **Verification:** readiness tests 3/3, complete release gates 22/22, and the beta.31 first full verifier passed.

**Total deviations:** 3 historical Rule 1 correctness repairs. **Impact:** All repairs are fail-closed and preserve immutable history, exact identity and the one-verifier contract.

## Authentication Gates

None. The approved isolated `returdex` publication identity was already authenticated and required no login, MFA or OS approval.

## Known Stubs

None. Native/live/Phase 3 states are deliberate hard gates, not placeholders.

## Threat Flags

None. Release metadata, public assets and anonymous downloads are the planned T2-13 trust surfaces; no endpoint, auth path, schema or source-access boundary was added.

## External Mutation Boundary

- Remote mutation was limited to fast-forwarding `returdex/AutoED` main from the beta.30 selected source to exact beta.31 commit `7e3044f…`, then creating release `380751233` and its two exact assets.
- No tag, release, asset or receipt was overwritten, forced, rebuilt, resigned or replaced.
- No update, installation, login/MFA, Profile/browser, school/source, course, runtime-data or live-evidence operation occurred.

## Decisions Made

- Beta.31 is the sole active published candidate because it alone combines the current source, protected-key signed archives, bounded readiness and a successful first full anonymous verifier.
- Public release history remains separate from the monotonic consumed identity set.
- All AUTH/UAT requirements remain pending until their required user-run native/live evidence exists.

## Next Phase Readiness

- Plan 02-14 may now reach its hard human update checkpoint using the exact beta.31 publication and availability receipts.
- The user must perform the actual update and report results; this plan supplies no post-update or live pass.
- Windows and all real login/reopen/restart/Codex-exit/cross-day/reauth gates remain mandatory, and Phase 3 remains blocked.

## Self-Check: PASSED

- Canonical beta.31 publication and availability receipts exist and retain SHA-256 values `7f192f81…` and `fe29eecf…`.
- Task commits `d924314` and `012a2df`, plus readiness RED/GREEN `c43797d` / `666d3a8`, resolve in Git and delete no tracked files.
- Complete release gates pass 22/22; exact signed preflight passes across 984 selected-history blobs with three reviewed fixture exceptions; `git diff --check` passes.
- Remote beta.31 release, tag, target, asset IDs and byte sizes remain exact; beta.25, beta.29 and beta.30 remote identities and assets remain unchanged.
- STATE and ROADMAP retain Phase 2 at 19/41, place the next stop at the 02-14 hard human update gate, and preserve Windows/live/Phase 3 blocking.

---
*Phase: 02-poc-live*
*Completed: 2026-09-02*
