# AutoED 0.1.0-beta.45 exact Phase 2 install prompt

Repository: returdex/AutoED
Version: 0.1.0-beta.45
Tag: v0.1.0-beta.45
Build ID: cb1c79a8cd1d1fc14d32474adf222312d57305a3b31c67af010d40ffd9dee0a3
Trust fingerprint: fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557
License: PolyForm-Noncommercial-1.0.0
Signed install-prompt core SHA-256: 0c0b447b88f3052a4bb320fad7072739c14eaf6f213272d0fa83482d8217ef0c

Use exactly one native target below. The capability archive and the independently rendered updater graph are both mandatory: verify their exact immutable coordinates, then run only the fixed bootstrap command. The bootstrap verifies the signed installer manifest and downloads only the four manifest-bound installer/program/Node/browser assets. Do not execute the inert source template embedded under `program/scripts/install`.

## macOS arm64

- Platform: macos
- Capability archive: autoed-0.1.0-beta.45-darwin-arm64-capability.tar.gz
- Capability archive URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.45/autoed-0.1.0-beta.45-darwin-arm64-capability.tar.gz
- Capability archive exact bytes: 14141493
- Capability archive SHA-256: 1f1fe60ffea9f0a667e2a078a9d9be004ebfb50708d66a84df2c23e9e2ebfac9
- Signed capability manifest SHA-256: 6b2b03d7fe27d21271c8a1cca2314cf7bde029f7d1a68599620e28c34f854f0d
- Capability Ed25519 signature SHA-256: f08da73df47295823de8a70676e30716547ff9da0b001dd49e2bd75ca3d85570
- Capability closure SHA-256: d1998f65a223f41cc0c572bea4b605268b9c5e2d96e5b059e22771e03cfa2193
- Updater bootstrap: autoed-0.1.0-beta.45-darwin-arm64-bootstrap.sh
- Updater bootstrap URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.45/autoed-0.1.0-beta.45-darwin-arm64-bootstrap.sh
- Updater bootstrap exact bytes: 87412
- Updater bootstrap SHA-256: cc9087ff41c0b067ce839b4bd32599aebcf34e86f2636baa9abcbba6aabdd54b
- Updater manifest: autoed-0.1.0-beta.45-darwin-arm64-manifest.json
- Updater manifest SHA-256: b18770b9d3fe827d9f3a601695be2ba4b09100d01baf7a818dab1c257cd440cb
- Updater signature: autoed-0.1.0-beta.45-darwin-arm64-manifest.sig
- Updater signature SHA-256: efb6982c3aa5ae880305c77667305982bd47e0f93cf4d8f0041a22cd722f4c73

```sh
curl -fL --proto '=https' -o autoed-bootstrap.sh 'https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.45/autoed-0.1.0-beta.45-darwin-arm64-bootstrap.sh'
echo 'cc9087ff41c0b067ce839b4bd32599aebcf34e86f2636baa9abcbba6aabdd54b  autoed-bootstrap.sh' | shasum -a 256 -c -
/bin/sh autoed-bootstrap.sh --root "$HOME/Library/Application Support/AutoED-Rebuild-M1"
```

## Windows x64

- Platform: windows
- Capability archive: autoed-0.1.0-beta.45-win32-x64-capability.tar.gz
- Capability archive URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.45/autoed-0.1.0-beta.45-win32-x64-capability.tar.gz
- Capability archive exact bytes: 14692273
- Capability archive SHA-256: 65ce0272c8cd69aff491c5a1198522be2d314eb44a26e7b88a859e46537c2a43
- Signed capability manifest SHA-256: 6b2b03d7fe27d21271c8a1cca2314cf7bde029f7d1a68599620e28c34f854f0d
- Capability Ed25519 signature SHA-256: f08da73df47295823de8a70676e30716547ff9da0b001dd49e2bd75ca3d85570
- Capability closure SHA-256: d1998f65a223f41cc0c572bea4b605268b9c5e2d96e5b059e22771e03cfa2193
- Updater bootstrap: autoed-0.1.0-beta.45-win32-x64-bootstrap.ps1
- Updater bootstrap URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.45/autoed-0.1.0-beta.45-win32-x64-bootstrap.ps1
- Updater bootstrap exact bytes: 89201
- Updater bootstrap SHA-256: 405ab9b0da398635d314e76fd18053bd765705fe4281c95aa0c95c7b53b3192f
- Updater manifest: autoed-0.1.0-beta.45-win32-x64-manifest.json
- Updater manifest SHA-256: f6223a479a2eb02496cf3310974c3a225d94bd1a76add99034df571352d52dad
- Updater signature: autoed-0.1.0-beta.45-win32-x64-manifest.sig
- Updater signature SHA-256: 7ff62a1ac60f4bb3a5c7d547c3dd059a127653e5fdab4d6dd6c3d776f7127405

```powershell
$staging = Join-Path $env:LOCALAPPDATA 'AutoED-Rebuild-M1-Staging'
New-Item -ItemType Directory -Force -Path $staging | Out-Null
Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.45/autoed-0.1.0-beta.45-win32-x64-bootstrap.ps1' -OutFile .\autoed-bootstrap.ps1
if ((Get-FileHash .\autoed-bootstrap.ps1 -Algorithm SHA256).Hash.ToLowerInvariant() -ne '405ab9b0da398635d314e76fd18053bd765705fe4281c95aa0c95c7b53b3192f') { throw 'BOOTSTRAP_HASH_MISMATCH' }
& .\autoed-bootstrap.ps1 -StagingParent $staging
```

## Required boundaries

- Require update/reload readiness and cleanup=complete; 不得覆盖，不得强制降级，不得删除课程资料。
- Installation must not log in to Moodle or EdStem; 不得登录。
- The dedicated Profile is sensitive credential storage; 不得复制或备份 Profile。
- Windows native: not_run/human_needed. Live evidence: not_run/human_needed. Phase 3: blocked.
- Publication or installation does not claim live success, native Windows success, or Phase 3 eligibility.
