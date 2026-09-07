# Phase 2 beta.41 immutable invalidation record

Recorded: 2026-09-08T04:19:51+10:00

## Disposition

`0.1.0-beta.41` / `v0.1.0-beta.41` is permanently consumed and invalidated as
`POST_ARTIFACT`. R2 selected the exact fresh R1 identity and R3 completed the
five-suite quality/security gate. R4 then assembled and signed 16 local assets,
but the mandatory pre-publication reuse of the R5 target proof rejected both
targets. No GitHub tag, release, asset, publication receipt, availability
receipt, installation, update, restart, source login, live evidence, 02-15 or
Phase 3 action occurred.

The local signed bytes must never be retried, resigned, published, renamed or
relabelled under beta.41.

## Consumed identity

| Field | Value |
|---|---|
| Version | `0.1.0-beta.41` |
| Tag | `v0.1.0-beta.41` |
| Source commit | `eaef25dc06de3b994dc89a1ad1f1b5f6026d5d1a` |
| Source tree | `a84fb4d2b91f5063b278092ca79a75c9e26f798a` |
| Build ID | `eff9ff2b7f81740f374dbd8cc31712b850a262d06c0709c327035ae15810a550` |
| R1 rehearsal SHA-256 | `80a38e6ea4fc62f3d627f0fd70804e94a6b33f302baba960338d4bf77f132c0b` |
| R2 selection SHA-256 | `d1a5bc7ec9dd032710eed5fcc3f5f74b13e8545e6fb52d3b64306e45cf4fe0e2` |
| R3 report SHA-256 | `4e2b51b57c7a4309f50ef1587975ce7c38ae003dd46b4dbd12fae0a510bd76b1` |
| macOS local archive | `14129692` bytes; SHA-256 `dc4c51c9ec2023c63bf040fc5f3b8c6f8833b81375883b9cd05c116818882c01` |
| Windows local archive | `14680844` bytes; SHA-256 `888594640cc19b46962dfc114e892071b5fbbaffafd7f4c8ed6f7f5f09b3d0a0` |

## Exact failure and eliminated causes

Both outer archives contain the required members. Their Ed25519 signatures,
exact archived closure-byte digests, closure member order and hashes, signed
prompt core, trust fingerprint, licenses, updater signatures, four component
hashes and canonical download URLs all verify.

The remaining exact mismatch is the updater manifest build identity. The
production build on disk and compiled API/Worker entries carry the base version
`0.1.0`, so `assembleManagedUpdater` copied `build.version = 0.1.0` into both
signed updater manifests. The selected release identity and R5 target proof
correctly require `build.version = 0.1.0-beta.41`. The build ID did not expose
the mismatch because its digest intentionally binds commit, tree, dependency,
source and variant but not the display/release version.

This is not a keyring permission, signing-key, GitHub account, upload, closure
serialization, missing-file or dependency-cache failure.

## Corrective boundary

The production Phase 2 assembler must materialize the selected prerelease
version through the existing `AUTOED_RELEASE_VERSION` build input before it
packages either target, and `assembleManagedUpdater` must reject any compiled
build whose version is not exactly the selection version. R1 contract coverage
must exercise this production-only version boundary; the release-coordinate-free
rehearsal may continue to use base version `0.1.0`.

These are release source/test/tool changes. Active beta.41 selection/report
files are retired after this record is preserved, and a fresh unnumbered R0/R1
is required before any beta.42 selection. Windows native, live evidence, 02-15
and Phase 3 remain blocked.
