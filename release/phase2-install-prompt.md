# AutoED 0.1.0-beta.30 exact Phase 2 install prompt

Repository: returdex/AutoED
Version: 0.1.0-beta.30
Tag: v0.1.0-beta.30
Build ID: 0e21bf7543475c368f7ef3a5548956e075fa05c65c1fd583840e1c30fa3d88b6
Trust fingerprint: fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557
License: PolyForm-Noncommercial-1.0.0
Signed install-prompt core SHA-256: 57ca317b26dacc1164df1bca67f972459c4b60add4a595f874f06ff727ecc756

Use exactly one native target below. Verify the complete outer archive name, immutable GitHub URL, exact byte count, and SHA-256 before extraction. Then verify the signed manifest and embedded `phase2/install-prompt-core.md`; its SHA-256 must equal the signed core value above. The external prompt is not a substitute for that signed member.

## macOS arm64

- Platform: macos
- Archive: autoed-0.1.0-beta.30-darwin-arm64.tar.gz
- URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.30/autoed-0.1.0-beta.30-darwin-arm64.tar.gz
- Exact bytes: 227412187
- SHA-256: b0841a2378710c40f6514622e5a0df9bcd1297760975f4a45bcdde3b9c3f77ea
- Signed manifest SHA-256: 3e8f42136890472cbfaae2c05dc39cb898e93cedf55506e5796101428a764074
- Ed25519 signature SHA-256: efaf414a132ffca8fdb8f0b89e4d260cfdc9ca97905964b015bfba5e161049d0
- Capability closure SHA-256: 858cfb363af77aad0df330e54a7b997399bce191d770b06c431d8fe1569d1ce4

## Windows x64

- Platform: windows
- Archive: autoed-0.1.0-beta.30-win32-x64.tar.gz
- URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.30/autoed-0.1.0-beta.30-win32-x64.tar.gz
- Exact bytes: 250424350
- SHA-256: a9429810b68d59970a68219fed994d89216042f4b6647c88ecebe67ab0f11396
- Signed manifest SHA-256: 3e8f42136890472cbfaae2c05dc39cb898e93cedf55506e5796101428a764074
- Ed25519 signature SHA-256: efaf414a132ffca8fdb8f0b89e4d260cfdc9ca97905964b015bfba5e161049d0
- Capability closure SHA-256: 858cfb363af77aad0df330e54a7b997399bce191d770b06c431d8fe1569d1ce4

## Required boundaries

- Require update/reload readiness and cleanup=complete; 不得覆盖，不得强制降级，不得删除课程资料。
- Installation must not log in to Moodle or EdStem; 不得登录。
- The dedicated Profile is sensitive credential storage; 不得复制或备份 Profile。
- Windows native: not_run/human_needed. Live evidence: not_run/human_needed. Phase 3: blocked.
- Publication or installation does not claim live success, native Windows success, or Phase 3 eligibility.
