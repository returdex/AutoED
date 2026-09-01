# AutoED 0.1.0-beta.29 exact Phase 2 install prompt

Repository: returdex/AutoED
Version: 0.1.0-beta.29
Tag: v0.1.0-beta.29
Build ID: 2f7d10a946a169b72a7681143220c2aaa789f425458615d6854067bd0e6d3f74
Trust fingerprint: fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557
License: PolyForm-Noncommercial-1.0.0
Signed install-prompt core SHA-256: 354b656250d039a250086ec6262f11c333e6fe213d8455ed0da0d05a49778cb9

Use exactly one native target below. Verify the complete outer archive name, immutable GitHub URL, exact byte count, and SHA-256 before extraction. Then verify the signed manifest and embedded `phase2/install-prompt-core.md`; its SHA-256 must equal the signed core value above. The external prompt is not a substitute for that signed member.

## macOS arm64

- Platform: macos
- Archive: autoed-0.1.0-beta.29-darwin-arm64.tar.gz
- URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.29/autoed-0.1.0-beta.29-darwin-arm64.tar.gz
- Exact bytes: 227412899
- SHA-256: 61e1c2572ef7822f39e73b3785c7cc4b2826fea6220374f4211817159b44b8e4
- Signed manifest SHA-256: fc0d2288a0980f4ab2a41886b9d877ec110b48c4255a52f16631cee777ce8f08
- Ed25519 signature SHA-256: e85cf5837a082d9bf9093f05b48c1ca3ade250baed3460b00e712ba46c41522d
- Capability closure SHA-256: 053ef5f3172954fb951f0c81f756da74e903251fb595b216631be2bafb91221f

## Windows x64

- Platform: windows
- Archive: autoed-0.1.0-beta.29-win32-x64.tar.gz
- URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.29/autoed-0.1.0-beta.29-win32-x64.tar.gz
- Exact bytes: 250422508
- SHA-256: 4729f5a372c844b5a8e510f2fe0b5d663b78c11f44483481855073864324a950
- Signed manifest SHA-256: fc0d2288a0980f4ab2a41886b9d877ec110b48c4255a52f16631cee777ce8f08
- Ed25519 signature SHA-256: e85cf5837a082d9bf9093f05b48c1ca3ade250baed3460b00e712ba46c41522d
- Capability closure SHA-256: 053ef5f3172954fb951f0c81f756da74e903251fb595b216631be2bafb91221f

## Required boundaries

- Require update/reload readiness and cleanup=complete; 不得覆盖，不得强制降级，不得删除课程资料。
- Installation must not log in to Moodle or EdStem; 不得登录。
- The dedicated Profile is sensitive credential storage; 不得复制或备份 Profile。
- Windows native: not_run/human_needed. Live evidence: not_run/human_needed. Phase 3: blocked.
- Publication or installation does not claim live success, native Windows success, or Phase 3 eligibility.
