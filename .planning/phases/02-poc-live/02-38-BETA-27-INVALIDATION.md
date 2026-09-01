# Phase 2 beta.27 immutable invalidation record

Recorded: 2026-09-02T02:06:30Z

## Disposition

`0.1.0-beta.27` / `v0.1.0-beta.27` is permanently consumed and invalidated. Managed Node 24 typecheck and all 143 unit tests passed, then the complete integration suite failed closed after 348 of 349 tests passed. The sole failure was the macOS positive update-gate fixture in `phase2-live-gate.test.ts`: it still supplied identical committed and fresh `checkedAt` values even though the approved contract now requires a genuinely later fresh observation.

The directly related fixture was corrected in `d83415c` to retain exact immutable fields and use a later in-window timestamp; the focused live/release integration set passed 34/34 and managed typecheck passed. That corrective commit changes selected source. Plan 02-38 therefore forbids reusing beta.27 or any of its partial results. No beta.27 report, signing, archive, tag, release, asset, publication, update or live action was created.

## Consumed identity

| Field | Value |
|---|---|
| Source commit | `078d7ddde2db1a8430b382f570c354b1cfc6d5df` |
| Source tree | `9cf6960a5605227731e27e8c7a375794c8bed38b` |
| Build ID | `a67becf9a0b45807be5ab7aa4061e722f1ffe5386c9eaf71c62e89c2b8019eed` |
| Source SHA-256 | `3b6d88ca9b467ae8088a79b92bea1a5663c13bb4041c97b0363ea3a6e7c75a7c` |
| Version-set SHA-256 | `d6118aea618bc30135b63474cd010bd597aec6742fd1ef47fe58b0c75d1e36a6` |
| Canonical selection SHA-256 | `6634fd5ae0d4f9ccc06239b102132dd916772bce895e29e1b92c2f66f15b7505` |
| Selection file-byte SHA-256 | `8211b81a37985579566b59232dabde3f1dbddd45071ca7cef3524061871e83ae` |

Read-only checks confirmed beta.28 had no local tag, direct-remote tag or public release before this invalidation. The beta.27 selection is removed from the active canonical release surface in this commit; its exact bytes and sanitized failure record remain in Git history. No existing service was stopped or changed.
