# Phase 2 beta.31 immutable invalidation record

Recorded: 2026-09-02T09:35:00Z

## Disposition

`0.1.0-beta.31` / `v0.1.0-beta.31` is permanently consumed and invalidated for the Phase 2 update gate after a genuine macOS product attempt returned `ENTRYPOINT_MISMATCH`. The active installation remained beta.19; API and Worker were healthy only for that old runtime, while the expected beta.31 build and entrypoints mismatched and cleanup and paired UI were not observed. No source configuration, school login or Phase 3 action began.

The failure is classified `HUMAN_PRODUCT`, not a user-environment or task-context failure. Beta.31 must never be retried, reused, deleted, overwritten, resigned or relabelled. Its public release, tag and assets remain immutable history.

## Root cause and corrective boundary

The beta.31 release contract proved two signed capability archives were downloadable but did not publish or bind a runnable rendered bootstrap, standard signed installer manifest, or installer/program/node/browser component graph. The embedded bootstrap was the intentionally inert source template. Availability therefore did not prove updateability.

The corrective source requires 8 exact assets per platform and a complete executable update command in the external prompt. It also requires a sanitized exact-source unnumbered rehearsal before assigning any later beta. That R0/R1 rehearsal passed; it does not create, reserve or publish a prerelease number.

## Consumed identity

| Field | Value |
|---|---|
| Source commit | `7e3044fbfc66ef14431f419e56c833951e24e4f9` |
| Source tree | `786707f3e0f3e011ecf8fb39901e2e1578b6959a` |
| Build ID | `003e0aa9ee74b77123741b9dbbc4f723acfd1783bee6b59054f49c46caff0a7f` |
| Source SHA-256 | `71032dfe380ae7040953745e0daf29e4848200b930aec5e702fd98657a7714ae` |
| Version-set SHA-256 | `5dac58ea491d3a1547fdab2619f61901b7b72c20c3f2a6ea79fa858cbb5807b5` |
| Selection file SHA-256 | `485040941df6c565326102c6e6e7d4b271b2338b0dce1523d834796ef770a9d9` |
| Test-report file SHA-256 | `46e99d8278122a88f4eb908cc048fba3ae6a990aa39f78c1f71f4216d61d7ff1` |
| Artifact-receipt file SHA-256 | `9c5762605265bdee6e5b72677a4b15d1ab9b7f68b362a575a1cf0ed549ff0e02` |
| Install-prompt file SHA-256 | `72310c1ad1b5d97338e9bf1adc35a0d978806ebcd982b491922989fb633e94b3` |
| Publication-receipt file SHA-256 | `7f192f81a79508564fbde1519c167c30a842bb35b4589a674a384d4d45053b14` |
| Availability-receipt file SHA-256 | `fe29eecf6997c4bace6d4415e55d29b07fbce454e4954ddaa228b4ec384473a0` |

## Published objects preserved

| Object | Immutable public identity |
|---|---|
| Release | ID `380751233`; tag `v0.1.0-beta.31` |
| macOS asset | ID `539997596`; `autoed-0.1.0-beta.31-darwin-arm64.tar.gz`; 227,416,297 bytes; SHA-256 `ef69ead91073aec94e1a7312ae69bb4a4f81f64a484b1ad4919e2b7369b715f1` |
| Windows asset | ID `539997598`; `autoed-0.1.0-beta.31-win32-x64.tar.gz`; 250,425,315 bytes; SHA-256 `aa12bcdf2e068dc6be2ffa15ee3f5d5e2fa272e4527d0343ca3a0bd21c41cf8a` |
| Signed manifest | `567484ea34e35af4a5cf4250e654e059546a47ff4a8050ab623f10313fa836c3` |
| Signed prompt core | `391f11ae9aeee65288cbf7d5759e01d5fb23aee715ff217107fd1e6ab8cab071` |

The beta.31 selection, test report, artifact receipt, install prompt, publication receipt and availability receipt are removed only from the active canonical local surface. Their exact bytes remain in immutable Git/public history. No public or remote object was mutated.
