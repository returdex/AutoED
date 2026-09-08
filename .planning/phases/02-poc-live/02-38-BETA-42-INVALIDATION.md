# Phase 2 beta.42 immutable invalidation record

Recorded: 2026-09-08

## Disposition

`0.1.0-beta.42` / `v0.1.0-beta.42` is permanently consumed and invalidated
before artifact assembly as a recurrent or ambiguous `POST_TRANSIENT` runner
failure. R2 selected the exact fresh R1 identity once. R3 then passed the
complete managed candidate gate: focused 35, typecheck 1, unit 150,
integration 393, UI 34 and native 24, with zero skip/todo and zero sensitive
findings.

The first formal R4 invocation stopped during the outer managed-runtime
bootstrap with the sanitized error `Subprocess failed (spawn): tar`. It did so
before the selected-version build, keyring signing, target assembly or any
remote mutation. Two immediately repeated managed bootstrap selfchecks passed,
but that same bounded diagnostic shell subsequently failed to resolve `git` by
name. A later isolated observation found both `/usr/bin/tar` and `/usr/bin/git`
present and executable. The evidence therefore does not prove one isolated,
non-recurrent transient, and the policy forbids retaining this candidate.

No beta.42 local or remote tag, GitHub release, public asset, signed candidate
asset, artifact receipt, publication receipt, availability receipt,
installation, update, restart, source login, live evidence, 02-15 or Phase 3
action exists. beta.42 must never be retried, published or relabelled.

## Consumed identity

| Field | Value |
|---|---|
| Version | `0.1.0-beta.42` |
| Tag | `v0.1.0-beta.42` |
| Source commit | `ce6c38c34ef5a17c30eb6e29a118cf195e09dee0` |
| Source tree | `4919d5c871ae95a5c8d61bbbf16e90f023f2ab90` |
| Build ID | `0e76fd32582c2a7185636bd4429126a444df167e0aec8ea039ce7cbedbbfd700` |
| R1 rehearsal SHA-256 | `a9c714c18bae7d2335928f39e49fecff45afd1e9b8f10f37b0777237a0adfea5` |
| R2 selection SHA-256 | `a2d074eb41c98df4c1d5661fe4c37548d3d7715ebf7524df0ae21ac52c5521d6` |
| R3 report SHA-256 | `ea0b1e5e7ea2443d0aa63ba2576c864b0170f812e0bab73595b7081ec7dbc0f5` |

## Corrective boundary

The managed runtime must not depend on mutable shell `PATH` lookup for its
archive verifier. Platform system-tool paths must be resolved and validated
before bootstrap, and macOS archive extraction must use the fixed
`/usr/bin/tar` executable. The release-environment preflight must persist only
the non-secret validated tool coordinates; it must not weaken package,
signature, fingerprint or archive verification.

This is a release tool/source change. Retire beta.42 active selection/report
files after preserving them with this record, then complete a fresh unnumbered
R0/R1 before any beta.43 selection. Windows native, update/login/live evidence,
02-15 and Phase 3 remain blocked.
