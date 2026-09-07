# Phase 2 beta.40 immutable invalidation record

Recorded: 2026-09-07T13:00:00+10:00

## Disposition

`0.1.0-beta.40` / `v0.1.0-beta.40` is permanently consumed and invalidated as
`POST_PUBLIC`. R2 selection, complete R3 qualification and R4 assembly/signing
completed, then the release was published once with 16 assets. Bounded anonymous
readiness reached the single permitted full verifier, which failed with the
sanitized result `PHASE2_AVAILABILITY_FAILED phase=target-proof asset=macos
reason=archive_or_signature`. No availability receipt was written. The public
release, tag and assets remain untouched immutable history and must never be
retried, overwritten, deleted or relabeled.

No installation, update, restart, source login, live evidence, 02-15 or Phase 3
action occurred.

## Consumed identity

| Field | Value |
|---|---|
| Version | `0.1.0-beta.40` |
| Tag | `v0.1.0-beta.40` |
| Source commit | `0c7248785a15870c0645127aef0c9555fa1e858b` |
| Source tree | `194418f30963c8701a50c06c722b440ac7b568e3` |
| Build ID | `a3a09e5501b4243d7788ab862bb4749541772403f6f503c20126faa965110e60` |
| macOS archive | `14123494` bytes; SHA-256 `cc077e305f63467dbf1136e4208ff14d742a3d818bb00eb55a2bd284eb15bff5` |
| Windows archive | `14674439` bytes; SHA-256 `3deca128d189082a353b88326ebeb7ad81d0253eb5b3c08ac853eb4f164a76a8` |

## Root cause

The temporary R4 assembly script wrote `JSON.stringify(closure)` bytes into
`phase2/capability-closure.json`, but bound `canonicalSha256(closure)` into the
signed manifest and artifact receipt. R5 correctly hashes the exact archived
member bytes, so both local target archives fail at the same closure-digest
boundary. The Ed25519 key pair, local signature verification, isolated GitHub
identity and uploaded asset byte hashes were not the cause.

The publication receipt is retained in Git history as the exact public-mutation
record. Active R2-R5 files are retired from candidate paths after this record is
committed so they cannot be reused by a later candidate.

## Corrective boundary

The correction adds a repository-owned R4 entrypoint, canonical byte
serialization, an early managed-runtime/identity/keyring preflight, and exact
reuse of the R5 target proof before publication. These are release-source/tool
changes, so a fresh unnumbered R0/R1 is required before any later candidate may
be selected. Windows native, live evidence, 02-15 and Phase 3 remain blocked.
