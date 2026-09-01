# AutoED 0.1.0-beta.24 exact Phase 2 install prompt

Repository: returdex/AutoED
Version: 0.1.0-beta.24
Tag: v0.1.0-beta.24
Build ID: 0334678a9e462b2aea6ee32ccf6b00320bad13273baf89f8dca673eecb17c8eb
Trust fingerprint: fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557
License: PolyForm-Noncommercial-1.0.0
Signed install-prompt core SHA-256: d54f7298cf854838c1487d9b8f7dac02d5fe492f92a4f32519290e6595078d8c

Use exactly one native target below. Verify the complete outer archive name, immutable GitHub URL, exact byte count, and SHA-256 before extraction. Then verify the signed manifest and embedded `phase2/install-prompt-core.md`; its SHA-256 must equal the signed core value above. The external prompt is not a substitute for that signed member.

## macOS arm64

- Platform: macos
- Archive: autoed-0.1.0-beta.24-darwin-arm64.tar.gz
- URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.24/autoed-0.1.0-beta.24-darwin-arm64.tar.gz
- Exact bytes: 227411545
- SHA-256: b050d21c1eede056b1a965e8eaea5466fc7ac51ed4b09f7227fc7a973e074d01
- Signed manifest SHA-256: 293b253bedd730f63b42fdec4e2b707439a674ff019d41a8919ab8ff40dbff81
- Ed25519 signature SHA-256: ad3c50aecac4e71d9d6f9fc15e6d388a7aa94ecab541aebeb183712d1620ecac
- Capability closure SHA-256: 8599a9e0827ce90c49e3ae738128dfc6f6f0b24bbd541b68bf9dc3ea972346f6

## Windows x64

- Platform: windows
- Archive: autoed-0.1.0-beta.24-win32-x64.tar.gz
- URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.24/autoed-0.1.0-beta.24-win32-x64.tar.gz
- Exact bytes: 250421634
- SHA-256: 5e06ce05a53dca5fa2698333247f82a4ed3745c291eb5d46938d060be4095e4a
- Signed manifest SHA-256: 293b253bedd730f63b42fdec4e2b707439a674ff019d41a8919ab8ff40dbff81
- Ed25519 signature SHA-256: ad3c50aecac4e71d9d6f9fc15e6d388a7aa94ecab541aebeb183712d1620ecac
- Capability closure SHA-256: 8599a9e0827ce90c49e3ae738128dfc6f6f0b24bbd541b68bf9dc3ea972346f6

## Required boundaries

- Require update/reload readiness and cleanup=complete; 不得覆盖，不得强制降级，不得删除课程资料。
- Installation must not log in to Moodle or EdStem; 不得登录。
- The dedicated Profile is sensitive credential storage; 不得复制或备份 Profile。
- Windows native: not_run/human_needed. Live evidence: not_run/human_needed. Phase 3: blocked.
- Publication or installation does not claim live success, native Windows success, or Phase 3 eligibility.
