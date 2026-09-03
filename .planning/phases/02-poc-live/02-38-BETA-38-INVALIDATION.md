# Phase 2 beta.38 immutable invalidation record

Recorded: 2026-09-03T12:54:00Z

## Disposition

`0.1.0-beta.38` / `v0.1.0-beta.38` is permanently consumed and invalidated as
`POST_PUBLIC` candidate. Its bounded anonymous readiness gate passed, but
the single permitted anonymous full verifier failed with
`PHASE2_AVAILABILITY_FAILED` at `phase=target-proof`, `asset=macos`,
`reason=archive_or_signature`; no availability receipt was created. The public
release, tag and all 16 assets remain untouched immutable history. The identity
must never be retried, overwritten, deleted or relabeled.

No installation, update, OS approval, restart, source login, live evidence or
Phase 3 action occurred.

## Consumed identity

| Field | Value |
|---|---|
| Version | `0.1.0-beta.38` |
| Tag | `v0.1.0-beta.38` |
| Source commit | `f8c87b3cf133bc5f7c78825f784083f1d9cd197c` |
| Source tree | `963ce4e7a5f016050df7ab38e5b48c03cd4031b1` |
| Build ID | `2999283bd4733b798cfa0cec3862efdf72495221475277d905f6800ec4c00d76` |
| macOS archive | `227426388` bytes; SHA-256 `7260c7870bf005d6f04608bcf8b4bc2069ec6c2a5e37bc255adc25a22fe09862` |
| Windows archive | `250437303` bytes; SHA-256 `a99d7923e19d388255b0f1b206d45e8e67c91f129d9f61feb5419b11aec24fdd` |

The publication receipt is retained as the exact immutable record of the
public mutation. The local selection, test-report, artifact and install-prompt
files are retired from active candidate paths so they cannot be reused for a
later beta; their exact bytes remain recoverable from Git history.

## Corrective boundary

The failure is confined to the post-public anonymous target-proof observation;
local R0–R4 evidence remains historical distribution evidence, not availability
proof. A later candidate must start with a fresh unnumbered R0/R1 rehearsal,
then select beta.39 only after that rehearsal and all later gates pass. Windows
native, live evidence and Phase 3 remain blocked.
