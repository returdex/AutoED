# Phase 2 beta.30 immutable invalidation record

Recorded: 2026-09-01T18:12:07Z

## Disposition

`0.1.0-beta.30` / `v0.1.0-beta.30` is permanently consumed and invalidated as published-but-availability-unproven. Its first and only full anonymous byte/hash/signature/closure verifier attempt ran before GitHub's CDN state was ready and did not produce `release/phase2-availability.json`. The same identity must never be retried, reused, deleted, overwritten, resigned or relabelled.

The identical pre-verifier race on published beta.29 and beta.30 established a systemic release-flow defect. RED commit `c43797d` and GREEN commit `666d3a8` add a bounded anonymous read-only readiness gate before the one permitted full verifier attempt. That source correction permanently invalidates beta.30 even though its public bytes remain immutable.

## Consumed identity

| Field | Value |
|---|---|
| Source commit | `0f3be001fa259890041273eee01119b1ba8edc1e` |
| Source tree | `6b376beab7e9c3ff50775e45d3eddd54f0bb846b` |
| Build ID | `0e21bf7543475c368f7ef3a5548956e075fa05c65c1fd583840e1c30fa3d88b6` |
| Source SHA-256 | `3b6d88ca9b467ae8088a79b92bea1a5663c13bb4041c97b0363ea3a6e7c75a7c` |
| Version-set SHA-256 | `bc6be86a0ba99d94345462d3173c45e7e3dc1c64bec547ad2d77d9cc6a74ef8d` |
| Canonical selection SHA-256 | `54d163b61ee66d1e7409ad7e19e77c7e3588bfbffc1531ecfb32f9b7d477103c` |
| Canonical test-report SHA-256 | `f12d14cbece2461280c1a0422b50e7d957b5f8bdac80ce02f828771f5cd960d7` |
| Selection file-byte SHA-256 | `7c994d43a1777318e3ac151750817558153e9670fdfa1d2dce76bc3d350dbd98` |
| Test-report file-byte SHA-256 | `5438c5350a5c91c24e8c178d1386b3be73bdefc5576951a6a3a759da05ac742c` |
| Artifact-receipt file-byte SHA-256 | `3ebdb4b7ea62059541165fc0bbdaf61414fd6c9bee9c67f648540b3974b04ae5` |
| Install-prompt file-byte SHA-256 | `31c3614688f62f7b65c5b803ac744df82577dab06e3e00d6111d48611493f980` |
| Publication-receipt file-byte SHA-256 | `e75dc2b4082ab7e4c3588200144b5f3c49e582a485754075f8f559b71e088332` |
| Availability receipt | absent; never created |

## Published objects preserved

| Object | Immutable public identity |
|---|---|
| Release | ID `380716930`; created `2026-09-01T17:22:53Z`; published `2026-09-01T18:04:19Z`; target `0f3be001fa259890041273eee01119b1ba8edc1e` |
| macOS asset | ID `539932724`; `autoed-0.1.0-beta.30-darwin-arm64.tar.gz`; 227,412,187 bytes; SHA-256 `b0841a2378710c40f6514622e5a0df9bcd1297760975f4a45bcdde3b9c3f77ea` |
| Windows asset | ID `539932725`; `autoed-0.1.0-beta.30-win32-x64.tar.gz`; 250,424,350 bytes; SHA-256 `a9429810b68d59970a68219fed994d89216042f4b6647c88ecebe67ab0f11396` |
| Signed manifest | `3e8f42136890472cbfaae2c05dc39cb898e93cedf55506e5796101428a764074` |
| Signature | `efaf414a132ffca8fdb8f0b89e4d260cfdc9ca97905964b015bfba5e161049d0` |
| Capability closure | `858cfb363af77aad0df330e54a7b997399bce191d770b06c431d8fe1569d1ce4` |
| Signed prompt core | `57ca317b26dacc1164df1bca67f972459c4b60add4a595f874f06ff727ecc756` |

Anonymous read-only checks reconfirmed published beta.25 and beta.29 unchanged and confirmed beta.31 has no public release, local tag or direct-remote tag before this invalidation. The beta.30 selection, test report, signed-artifact receipt, install prompt and incomplete publication receipt are removed from the active canonical local surface in the invalidation commit. Their exact bytes remain in immutable Git/public history. No public or remote object was mutated, and no unrelated service was stopped or changed.
