# Phase 2 beta.43 immutable invalidation record

Recorded: 2026-09-11

## Disposition

`0.1.0-beta.43` / `v0.1.0-beta.43` is permanently consumed and invalidated
during the first formal R3 candidate gate. R2 selected the exact fresh R1
identity once. The R3 focused gate then stopped at the fixed
`two-build-upgrade` step with
`PRE_SOURCE / COMMAND_PROCESS_FAILED_TWO_BUILD_UPGRADE`. The exact test file
was run independently and reproduced a 300-second timeout with 8/9 tests
completed, so this is recurrent and cannot be retained as a single proven
transient.

Bounded diagnosis found the initial A installation stopped at
`started / intent`: the API process had an exact runtime record and listener,
while the Worker had not started and no failure receipt existed. The parent
service supervisor could wait indefinitely inside two native secret-store
reads because the Keychain adapter had no timeout. The synthetic S/I fixture
also unnecessarily shared the real OS Keychain, and a Vitest timeout did not
reclaim the API's independently detached process group.

No beta.43 local or remote tag, GitHub release, public asset, signed candidate
asset, test report, artifact receipt, publication receipt, availability
receipt, installation, update, restart, source login, live evidence, 02-15 or
Phase 3 action exists. beta.43 must never be retried, signed, published or
relabelled.

## Consumed identity

| Field | Value |
|---|---|
| Version | `0.1.0-beta.43` |
| Tag | `v0.1.0-beta.43` |
| Source commit | `dd446afe80b1ea8485d942324dbdb4f38ad2caa5` |
| Source tree | `a52c4d819c4d920b61fa39e851cada75d3b64743` |
| Build ID | `c5c9ca8829817cdd701ce705e32ea395d1672def9faecf8cdb1605e64df0a724` |
| Source SHA-256 | `85e80c0a1c30a969fe67a8e64f583e28b5590f1b8d9267506dd7eb7a1e00e17c` |
| R1 rehearsal SHA-256 | `6ab2090d37d41c6623112e360326cdbfc74d5fb0cf287f5d9f48124763752d23` |
| R2 selection SHA-256 | `cc9ed6b4d451c7effb1f8c1febf7c0e49e8af14c03a8129f330b7461eae9aded` |

## Corrective boundary

Production continues to use the native OS secret store, but every native
operation now has one fixed, sanitized timeout. Explicit synthetic S/I
installations use a protected disposable file secret store shared only across
their test processes; its activation requires the synthetic environment,
exact installation selection, protected harness marker and synthetic
installation metadata. Credentials never enter argv, environment, stdout or
the repository.

Every fixed R1 step now invokes a bounded orphan-reclaim command before its
result is accepted or rejected. That command signals only processes whose
six-token service argv, disposable root, installation ownership, runtime
receipt, entrypoint/build identity and exited harness owner all match. Unknown
or live-owner state fails closed. A fresh unnumbered R1 on the corrective
commit is required before beta.44 may be separately authorized or selected.
Windows native, update/login/live evidence, 02-15 and Phase 3 remain blocked.
