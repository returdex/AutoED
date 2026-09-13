# Phase 2 beta.47 immutable invalidation record

Recorded: 2026-09-13

## Disposition

`0.1.0-beta.47` / `v0.1.0-beta.47` is permanently consumed and invalidated
after its first formal R3 candidate gate. R2 selected the exact fresh R1
identity once. The candidate gate stopped in the fixed per-file integration
chain at client-wiring; a second bounded fixed-runner diagnostic reproduced
the same allowlisted failure family. A longer prefix then located the primary
failure at the preceding CLI lifecycle test: its 60-second whole-test budget
expired while the asynchronous body was still running, and the next fixture
surfaced the secondary `INVALID_INSTALLATION` cleanup error.

The candidate cannot proceed because correcting this source/test/release-tool
defect changes the selected tree. This is `POST_SOURCE`, not a retained
transient. No beta.47 local or remote tag, GitHub release, public asset, signed
candidate asset, canonical R3 test report, artifact receipt, publication
receipt, availability receipt, installation, update, restart, source login,
live evidence, 02-15 or Phase 3 action exists. beta.47 must never be retried,
signed, published or relabelled.

## Consumed identity

| Field | Value |
|---|---|
| Version | `0.1.0-beta.47` |
| Tag | `v0.1.0-beta.47` |
| Source commit | `523bd009fd803b3fcfad0a6602e980f50069209a` |
| Source tree | `550242bbcda2d5bda5ea6a8f8817f8ea9b55fd98` |
| Build ID | `cf2d4da83e2c573a4a65e46386fee8f8ab2d97c31fca5241d376e0e8951bae72` |
| Source SHA-256 | `724501814acbe938a1f8b1516d9b63068e5004b99f8e47f9eca54f2999368bf5` |
| R2 selection SHA-256 | `847a66ff8d2a7a7a21197da7a6b5e66d7d6c6a3f384b7fdcb7d3f4bd1551ef2a` |

## Proven cause and correction

The synthetic CLI adapter imposed a fixed 15-second timeout even though a
valid lifecycle command can sequentially wait on two owned services. On
timeout it sent `SIGTERM` and rejected immediately without proving that the
exact child had closed. The outer CLI and client-wiring tests each imposed a
60-second ceiling despite representing multi-command or multi-process chains.
Under long-chain load, Vitest could time out the test body while fixture work
continued, letting cleanup overlap later fixture provisioning.

Corrective R0 gives normal and lifecycle CLI commands separate bounded budgets,
requires `SIGTERM`, bounded grace, exact-child `SIGKILL` escalation and observed
`close` before returning `CLI_OUTPUT_TIMEOUT`, and makes the outer integration
budgets cover their full bounded workflows. The release reporter recognizes
`CLI_OUTPUT_TIMEOUT` as a timeout instead of a generic assertion failure. A
forced non-terminating CLI regression proves exact-child reap before cleanup;
CLI and client-wiring pass together, and the fixed complete integration chain
passes 400/400 with zero skip/todo and successful owned-root cleanup.

The corrective commit must complete a fresh unnumbered R1 before beta.48 may be
separately authorized or selected. No beta.48 selection, signing, publication,
installation, login, 02-15 or Phase 3 action is authorized by this record.
