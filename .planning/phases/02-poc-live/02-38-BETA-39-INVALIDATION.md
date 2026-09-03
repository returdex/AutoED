# Phase 2 beta.39 immutable invalidation record

Recorded: 2026-09-04T00:10:00+10:00

## Disposition

`0.1.0-beta.39` / `v0.1.0-beta.39` is permanently consumed and invalidated as
`POST_PUBLIC`. Its bounded anonymous readiness stage completed and the single
permitted anonymous full verifier was invoked, but the controller wait was
interrupted before any sanitized verifier result or availability receipt was
produced. Availability cannot be attested. The public release, tag and all 16
assets remain untouched immutable history. The identity must never be retried,
overwritten, deleted or relabeled.

No installation, update, OS approval, restart, source login, live evidence or
Phase 3 action occurred.

## Consumed identity

| Field | Value |
|---|---|
| Version | `0.1.0-beta.39` |
| Tag | `v0.1.0-beta.39` |
| Source commit | `4ca8a81cefda2a20a6735d4e8607ce7a5ba93dfc` |
| Source tree | `376a3b8433f0d1b74bcef424a0281dcabacea381` |
| Build ID | `2047d7ea8ac8f822eac2a82b544bef047a9963b07675d1c3c98a1858eb6b0649` |
| macOS archive | `227429319` bytes; SHA-256 `d19cfa4f3c0dc02d04c7a4bf993a8db724541f3fd2543777885ed8c8ed2b0d9b` |
| Windows archive | `250437732` bytes; SHA-256 `473b041ccf30af6485b56bdb07cd1af63a8cb012ab4061fdd205b34f0563ad4e` |

The publication receipt is retained in Git history as the exact record of the
public mutation. The local selection, test-report, artifact, install-prompt
and active publication files are retired from candidate paths so they cannot
be reused for a later beta; their exact bytes remain recoverable from Git
history.

## Corrective boundary

The failure is limited to the absence of a verifiable anonymous receipt; it is
not evidence of installation, login, source access or live failure. A later
candidate must start with a fresh unnumbered R0/R1 rehearsal, then select
beta.40 only after that rehearsal and all later gates pass. Windows native,
live evidence and Phase 3 remain blocked.
