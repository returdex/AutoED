# AutoED 0.1.0-beta.31 exact Phase 2 install prompt

Repository: returdex/AutoED
Version: 0.1.0-beta.31
Tag: v0.1.0-beta.31
Build ID: 003e0aa9ee74b77123741b9dbbc4f723acfd1783bee6b59054f49c46caff0a7f
Trust fingerprint: fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557
License: PolyForm-Noncommercial-1.0.0
Signed install-prompt core SHA-256: 391f11ae9aeee65288cbf7d5759e01d5fb23aee715ff217107fd1e6ab8cab071

Use exactly one native target below. Verify the complete outer archive name, immutable GitHub URL, exact byte count, and SHA-256 before extraction. Then verify the signed manifest and embedded `phase2/install-prompt-core.md`; its SHA-256 must equal the signed core value above. The external prompt is not a substitute for that signed member.

## macOS arm64

- Platform: macos
- Archive: autoed-0.1.0-beta.31-darwin-arm64.tar.gz
- URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.31/autoed-0.1.0-beta.31-darwin-arm64.tar.gz
- Exact bytes: 227416297
- SHA-256: ef69ead91073aec94e1a7312ae69bb4a4f81f64a484b1ad4919e2b7369b715f1
- Signed manifest SHA-256: 567484ea34e35af4a5cf4250e654e059546a47ff4a8050ab623f10313fa836c3
- Ed25519 signature SHA-256: 81468dbe1c148c90a6909edebe1cbe22c26ddacad4529aa362cd0cd75666ab80
- Capability closure SHA-256: d26f6b1a941d416bec30f7983a8a58c14f23304919a10de4f2e9b79ccb9c7649

## Windows x64

- Platform: windows
- Archive: autoed-0.1.0-beta.31-win32-x64.tar.gz
- URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.31/autoed-0.1.0-beta.31-win32-x64.tar.gz
- Exact bytes: 250425315
- SHA-256: aa12bcdf2e068dc6be2ffa15ee3f5d5e2fa272e4527d0343ca3a0bd21c41cf8a
- Signed manifest SHA-256: 567484ea34e35af4a5cf4250e654e059546a47ff4a8050ab623f10313fa836c3
- Ed25519 signature SHA-256: 81468dbe1c148c90a6909edebe1cbe22c26ddacad4529aa362cd0cd75666ab80
- Capability closure SHA-256: d26f6b1a941d416bec30f7983a8a58c14f23304919a10de4f2e9b79ccb9c7649

## Required boundaries

- Require update/reload readiness and cleanup=complete; 不得覆盖，不得强制降级，不得删除课程资料。
- Installation must not log in to Moodle or EdStem; 不得登录。
- The dedicated Profile is sensitive credential storage; 不得复制或备份 Profile。
- Windows native: not_run/human_needed. Live evidence: not_run/human_needed. Phase 3: blocked.
- Publication or installation does not claim live success, native Windows success, or Phase 3 eligibility.
