# Phase 2 beta.29 immutable invalidation record

Recorded: 2026-09-01T17:22:08Z

## Disposition

`0.1.0-beta.29` / `v0.1.0-beta.29` is permanently consumed and invalidated as published-but-availability-unproven. The first and only anonymous availability verification attempt did not produce `release/phase2-availability.json`; Plan 02-13 therefore failed closed before any update, installation or live action. The same identity must never be retried, reused, deleted, overwritten or relabelled.

The public prerelease remains immutable historical data. Read-only checks confirmed release `380689537`, tag `v0.1.0-beta.29` and both assets exist and target source commit `867fd57fb026d91c1b1355ac6b27f2b219bdb058`. No local beta.29 tag exists. Public beta.25 release `380618906`, its tag and both historical assets remain unchanged.

## Consumed identity

| Field | Value |
|---|---|
| Source commit | `867fd57fb026d91c1b1355ac6b27f2b219bdb058` |
| Source tree | `67cdb9dadb840040ec57afede394fcc52a722dc8` |
| Build ID | `2f7d10a946a169b72a7681143220c2aaa789f425458615d6854067bd0e6d3f74` |
| Source SHA-256 | `3b6d88ca9b467ae8088a79b92bea1a5663c13bb4041c97b0363ea3a6e7c75a7c` |
| Version-set SHA-256 | `cb5717da334238f3ed849adfb4f724704421148f4624349b611dc3a22928e97a` |
| Canonical selection SHA-256 | `64fa28f1fd1ae033939385079009234ecfa5f10a30bec807ee18514a8fb13952` |
| Canonical test-report SHA-256 | `259e38832d584e6c5d03809f23b0cb4ce97d0a3d57f7d71417a3bd73808cce71` |
| Selection file-byte SHA-256 | `407de049e2402df1157b6bb8ab513ec56b30c1b99868db9c6880884e84c5e33d` |
| Test-report file-byte SHA-256 | `97b3c97ad60917925d9cdc4ab6d5f44e1da48cd51186f28a9d64b2170585df83` |
| Artifact-receipt file-byte SHA-256 | `b425d3d754cc46a1d01a7ed9e23370cd59588bd0a0a0dacea571551ba9cdc5bd` |
| Install-prompt file-byte SHA-256 | `44cfbdf9acda23e842921655346377fa1d5e59e14b6400ebf0d46765e97c150c` |
| Publication-receipt file-byte SHA-256 | `6f63be4fb4747cdf687e4fd9dabfc687d842101a5a625b069d03b3cb912acf47` |
| Availability receipt | absent; never created |

## Published objects preserved

| Object | Immutable public identity |
|---|---|
| Release | ID `380689537`; created `2026-09-01T16:29:18Z`; published `2026-09-01T17:17:54Z` |
| macOS asset | ID `539882525`; `autoed-0.1.0-beta.29-darwin-arm64.tar.gz`; 227,412,899 bytes; SHA-256 `61e1c2572ef7822f39e73b3785c7cc4b2826fea6220374f4211817159b44b8e4` |
| Windows asset | ID `539882528`; `autoed-0.1.0-beta.29-win32-x64.tar.gz`; 250,422,508 bytes; SHA-256 `4729f5a372c844b5a8e510f2fe0b5d663b78c11f44483481855073864324a950` |
| Signed manifest | `fc0d2288a0980f4ab2a41886b9d877ec110b48c4255a52f16631cee777ce8f08` |
| Signature | `e85cf5837a082d9bf9093f05b48c1ca3ade250baed3460b00e712ba46c41522d` |
| Capability closure | `053ef5f3172954fb951f0c81f756da74e903251fb595b216631be2bafb91221f` |
| Signed prompt core | `354b656250d039a250086ec6262f11c333e6fe213d8455ed0da0d05a49778cb9` |

The beta.29 selection, test report, signed-artifact receipt, install prompt and incomplete publication receipt are removed from the active canonical local surface in the invalidation commit. Their exact bytes remain available in immutable Git/public history. No public or remote object was mutated, and no unrelated service was stopped or changed.
