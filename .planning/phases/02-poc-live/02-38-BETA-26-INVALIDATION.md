# Phase 2 beta.26 immutable invalidation record

Recorded: 2026-09-02T01:45:00Z

## Disposition

`0.1.0-beta.26` / `v0.1.0-beta.26` is permanently consumed and invalidated. It was selected after the update-gate source correction, but its first complete quality run failed closed during the unit suite: 142 of 143 tests passed and the managed-runtime assertion observed host Node `v26.0.0` instead of the repository-locked Node `v24.20.0`.

This was an execution-environment error rather than a product assertion failure. It nevertheless occurred after immutable selection, so Plan 02-38 forbids reusing beta.26 or reusing any partial result. No beta.26 report, signing, archive, tag, release, asset, publication, update or live action was created. The next fully rerun candidate is beta.27 only if fresh read-only checks continue to prove it unused. Every beta.27 quality command must run through the approved managed runtime wrapper.

## Consumed identity

| Field | Value |
|---|---|
| Source commit | `8547eaf7bf8349cc65597dc2f8b6049f21458c83` |
| Source tree | `17e521139d843cfd1a3653add2d8cb4c15df6869` |
| Build ID | `21b2c44b73ec5662a9fe683db625be6ca874b220653a57d17484f1cdc75b23b1` |
| Source SHA-256 | `3b6d88ca9b467ae8088a79b92bea1a5663c13bb4041c97b0363ea3a6e7c75a7c` |
| Version-set SHA-256 | `64879b290a34d3eb2782e8f992c397fb12d3471a1ce6b18b4ade0823bc7df4c5` |
| Canonical selection SHA-256 | `503f46784c218d2c7608992786d08aa03fb53a96322c913046dc2d4e4cd78208` |
| Selection file-byte SHA-256 | `70ee481fb46636fefb1fb5c39c377929e06b38b5648d9aa051f3d66c828e921b` |

Read-only checks confirmed that beta.26 and beta.27 had no local tag, direct-remote tag or public release at invalidation time. The failed captured output remains only in the private temporary gate log for four-surface scanning; it is not a release receipt or live evidence.

The beta.26 selection is removed from the active canonical release surface in this commit. Its exact bytes remain in Git history. No existing service was stopped or changed.
