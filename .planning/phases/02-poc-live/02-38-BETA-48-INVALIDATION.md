# Phase 2 beta.48 immutable invalidation record

Recorded: 2026-09-14

## Disposition

`0.1.0-beta.48` / `v0.1.0-beta.48` is permanently invalidated for the update
gate. It passed R2–R5, was signed and published once with 16 assets, and its
one permitted anonymous full verifier produced a valid availability receipt.
The single real macOS arm64 projectless updater verified the fixed immutable
release coordinates and passed all bounded legacy-recovery checks, then emitted
`installation_identity_recovery_preview`. The external prompt had nevertheless
allowed its exact bootstrap to run through a noninteractive shell with closed
stdin, so the signed installer could not receive the user's exact `RECOVER`
confirmation and stopped before migration, ordinary install preview or
activation.

This is `HUMAN_PRODUCT`, not a retryable task-context refusal: the signed
bootstrap actually ran against the managed root and exposed the future prompt
contract defect. beta.48's tag, release, 16 public assets and availability
receipt remain immutable history. Never retry, overwrite, delete, resign,
republish, relabel or show beta.48 as an active candidate. beta.19 remained
staged, beta.48 was not activated, cleanup completed and no AutoED process
remained. No school source, login, Profile read/copy/backup, course change,
02-15 or Phase 3 action occurred.

## Consumed identity

| Field | Value |
|---|---|
| Version | `0.1.0-beta.48` |
| Tag | `v0.1.0-beta.48` |
| Source commit | `1045b49a971fd2620230c1ee10d3ce8c83adc95f` |
| Source tree | `86a49144f244f41dd35c15a7d532de5b5fee140a` |
| Build ID | `0d9d5d0d846de375e9bd311b5088c1a6441ebc97bbc19073fd5ee3791a2a8ed3` |
| Source SHA-256 | `fe56b38b2752c8187156faff19749e2d599520fca64ef2f3935192b8b963e49a` |
| R1 rehearsal SHA-256 | `7abccd8039785e2597156e73095008fe3acc808deb291655a568198e8bf15b01` |
| R2 selection SHA-256 | `de70cd433d29b42b8d45dd21508b0ca97008b83ed3b61aa095175c473bf67bf6` |

## Proven cause and correction

`renderBootstrapPayload` correctly invokes one installer process with inherited
standard streams, but the beta.48 external prompt required only an exact-once
command. It did not require one live interactive PTY/session, surface both
previews, pause for each real exact confirmation, or relay each reply to the
same still-running process. `runInstallerCLI` sequentially waits for
`RECOVER <scopeHash>` and `INSTALL <scopeHash>` on that inherited stdin; the
closed transport made the first gate impossible after the safe preview.

Corrective R0 fails `INTERACTIVE_SESSION_REQUIRED` before manifest/root or
installer mutation when stdin, stdout or stderr is non-TTY. Its signed-core and
external prompt layers now machine-require exactly one live PTY/session across
both gates, complete preview surfacing, a real exact user reply and forwarding
only that reply plus newline to the same process. Focused synthetic regressions
prove the noninteractive rejection precedes recovery mutation, a single stream
can carry both confirmations in order, and both prompt layers retain the
contract. The source must complete a fresh unnumbered R1 before any later
candidate can be separately authorized or selected. No signing, publication,
installation, login, 02-15 or Phase 3 action is authorized by this record.
