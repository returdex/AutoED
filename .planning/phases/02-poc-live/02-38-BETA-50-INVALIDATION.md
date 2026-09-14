# Phase 2 beta.50 immutable invalidation record

Recorded: 2026-09-14

## Disposition

`0.1.0-beta.50` / `v0.1.0-beta.50` is permanently consumed and invalidated
during its first formal R3 candidate gate. R2 selected the exact passing fresh
R1 identity once. Managed typecheck passed 1/1 and unit passed 154/154; the
per-file integration chain then stopped after `managed-cleanup` with the
sanitized runner result
`PRE_RUNNER / PROCESS_GROUP_OBSERVATION_FAILED`.

Bounded diagnosis reclaimed only test-owned processes and found no tracked
source/test/tool drift, artifact output, remote object or residual owned
process. The first independent run of the exact `managed-cleanup` file reached
a normally observed closed process group but its test process exited nonzero.
A second independent run passed 7/7 with zero skip/todo and an immediately
absent process group. Those different failure modes do not identify one proven
environmental transient. Under `.planning/RELEASE-STABILIZATION.md`, ambiguity
forbids candidate retention or the two-complete-pass exception.

No beta.50 local or remote tag, GitHub release, signed/public asset, canonical
R3 test report, artifact receipt, install prompt, publication receipt,
availability receipt, installation, update, restart, source login, live
evidence, 02-15 or Phase 3 action exists. beta.50 must never be retried, signed,
published or relabelled.

## Consumed identity

| Field | Value |
|---|---|
| Version | `0.1.0-beta.50` |
| Tag | `v0.1.0-beta.50` |
| Source commit | `accc799619e4aa1050bea739920b87a579805cef` |
| Source tree | `e6e3e243288a03242d42f16c0d320d9b2644d59c` |
| Build ID | `423e5c1a4f728b49fcc72f971246d382ce65acd8216349efa12aa7fc3c733233` |
| Source SHA-256 | `41102c1d726ebff685cdeb13b14ab0ac3e8b2b321c1591270c5412618f7c2300` |
| R1 rehearsal SHA-256 | `2f2dca8374d7c3afe81e96c98a2edfed24bd6f07259eb2a88c8c8a2f11bfa64c` |
| R2 selection SHA-256 | `d115c463fb8617568b290f2e1dee83189c9679da825835f0df394b7e1d60eb33` |

## Corrective boundary

Return to bounded R0 and make process-group observation failures retain only
allowlisted, non-sensitive stage detail that distinguishes missing group,
zombie-only state, observer timeout, observer execution failure and permission
failure. The same bounded diagnosis must also identify why the exact managed
cleanup test can independently exit nonzero after a normally observed close.
Do not weaken process ownership, cleanup, suite completeness or sensitive-output
rules. Any source/test/release-tool correction requires a complete fresh
unnumbered R1 before beta.51 may be separately authorized or selected. Windows
native/live remain `not_run/human_needed`, and 02-15/Phase 3 remain blocked.
