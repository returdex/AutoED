# AutoED 0.1.0-beta.25 exact Phase 2 install prompt

Repository: returdex/AutoED
Version: 0.1.0-beta.25
Tag: v0.1.0-beta.25
Build ID: 6c44e404b42e72c8dfb3f1dfef3bb9aa1f5cb95f17de32280019cc23c89c20e5
Trust fingerprint: fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557
License: PolyForm-Noncommercial-1.0.0
Signed install-prompt core SHA-256: 48ed614431d98998199b4c4f82be2c8ff0787870a5ac56717584bb0fd5495fc0

Use exactly one native target below. Verify the complete outer archive name, immutable GitHub URL, exact byte count, and SHA-256 before extraction. Then verify the signed manifest and embedded `phase2/install-prompt-core.md`; its SHA-256 must equal the signed core value above. The external prompt is not a substitute for that signed member.

## macOS arm64

- Platform: macos
- Archive: autoed-0.1.0-beta.25-darwin-arm64.tar.gz
- URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.25/autoed-0.1.0-beta.25-darwin-arm64.tar.gz
- Exact bytes: 227413903
- SHA-256: 56f141ff2e3d8e054c5cb299bcc7e715e1bd638ac88aa8ce2b867ca4e995d338
- Signed manifest SHA-256: c2c1100f338a078fe8682bb05927c2e552973de4acb8977257307179604204a8
- Ed25519 signature SHA-256: 15bc1af968e0b06b4a193cc6c770e0ae5fbf76ce9e12bc3e74da65f28afe3bb2
- Capability closure SHA-256: c1e7ede3907d7fe65de4c416b9d06897aff7dce0c94cd65a1b5441b2e5adb949

## Windows x64

- Platform: windows
- Archive: autoed-0.1.0-beta.25-win32-x64.tar.gz
- URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.25/autoed-0.1.0-beta.25-win32-x64.tar.gz
- Exact bytes: 250419021
- SHA-256: 579fbdea67e103734842ffe8157f5f5c97e66d8c1bbfec24a2ed006cdc1728ec
- Signed manifest SHA-256: c2c1100f338a078fe8682bb05927c2e552973de4acb8977257307179604204a8
- Ed25519 signature SHA-256: 15bc1af968e0b06b4a193cc6c770e0ae5fbf76ce9e12bc3e74da65f28afe3bb2
- Capability closure SHA-256: c1e7ede3907d7fe65de4c416b9d06897aff7dce0c94cd65a1b5441b2e5adb949

## Required boundaries

- Require update/reload readiness and cleanup=complete; 不得覆盖，不得强制降级，不得删除课程资料。
- Installation must not log in to Moodle or EdStem; 不得登录。
- The dedicated Profile is sensitive credential storage; 不得复制或备份 Profile。
- Windows native: not_run/human_needed. Live evidence: not_run/human_needed. Phase 3: blocked.
- Publication or installation does not claim live success, native Windows success, or Phase 3 eligibility.
