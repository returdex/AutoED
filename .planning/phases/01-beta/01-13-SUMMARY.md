---
phase: 01-beta
plan: "13"
subsystem: signed-beta-publication
tags: [release, ed25519, github, macos, windows, anonymous-verification]
requires:
  - phase: 01-12
    provides: confirmed fixed release root and isolated returdex identity
provides:
  - public returdex/AutoED repository with immutable 0.1.0-beta.1 and beta.2 prereleases
  - signed complete macOS arm64 and Windows x64 install/update assets and exact prompts
  - anonymous full-byte availability, signature, hash and archive-closure evidence
affects: [01-14 human update and native UAT]
requirements-completed: []
completed: 2026-08-29
---

# Phase 1 Plan 13: Signed Beta Pair Publication Summary

**Two complete synthetic prereleases are publicly obtainable from `returdex/AutoED`; publication is not human or Windows-native acceptance.**

## Delivered

- `0.1.0-beta.1` is the echo-only A build; `0.1.0-beta.2` is the echo+digest B build.
- Each release has 18 assets: macOS arm64 and Windows x64 installer/program/Node/browser archives, signed manifests, fixed-trust bootstrap scripts, source, standard PolyForm Noncommercial license files and an exact install prompt.
- Every target manifest has exactly one `installer`, `program`, `node` and `browser` artifact. macOS Chromium uses a strict ZIP preserving all 337 regular/symlink members; other archives use strict USTAR.
- The production installer is pinned to public fingerprint `fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557`. No downloaded key or CLI option can replace it.
- The public repository ID is `1350421724`. Repo-local Git identity and isolated OAuth are `returdex`; the observed global GitHub identity remains `ywan1303` and was not changed.

## Verification

- Full prepublication regression after trust binding: 31 files, **167/167 Vitest tests passed**; UI **10/10 passed**; TypeScript passed.
- Packaged macOS diagnostic ran from the packaged Node and production dependency closure. Windows binary/NAPI/archive closure was checked statically; Windows native remains `not_run`.
- Exact preflight checked 36 assets and scanned 388 reachable-history blobs with three exact reviewed test-fixture exceptions.
- Anonymous postpublication download verified **18/18 assets for each beta**, all byte sizes and SHA-256 values, all four Ed25519 signatures, and every archive member closure. See `release/availability.json`.
- Isolated GitHub login was rechecked as `returdex`; global login was rechecked as unchanged `ywan1303`.

## Boundaries and next gate

- No school login, Profile creation, course collection, credential export, stable release or Phase 2 work occurred.
- Human UAT is `not_run`. Windows 11 native installation/update is `not_run`. Publication cannot fill either evidence cell.
- Plan 14 is the hard human gate: the user must install beta.1, verify echo and client/MCP wiring, update to beta.2, verify digest and cleanup, then repeat required native checks on Windows 11. Any `cleanup_pending`, mixed build, old entry or unowned process blocks completion.

## Self-Check: PASSED

Both prereleases exist publicly, all declared assets can be fetched without authentication and reproduce their signed records, and the repository/identity/license/version boundaries remain intact.

---
*Phase: 01-beta*
*Completed: 2026-08-29*
