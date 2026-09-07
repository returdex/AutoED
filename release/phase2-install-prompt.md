# AutoED 0.1.0-beta.40 exact Phase 2 install prompt

Repository: returdex/AutoED
Version: 0.1.0-beta.40
Tag: v0.1.0-beta.40
Build ID: a3a09e5501b4243d7788ab862bb4749541772403f6f503c20126faa965110e60
Trust fingerprint: fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557
License: PolyForm-Noncommercial-1.0.0
Signed install-prompt core SHA-256: 76a8921bd58311bf9b0ecf612c49bbd66766f4273dcb868aa3417c6ccf91ae00

Use exactly one native target below. The capability archive and the independently rendered updater graph are both mandatory: verify their exact immutable coordinates, then run only the fixed bootstrap command. The bootstrap verifies the signed installer manifest and downloads only the four manifest-bound installer/program/Node/browser assets. Do not execute the inert source template embedded under `program/scripts/install`.

## macOS arm64

- Platform: macos
- Capability archive: autoed-0.1.0-beta.40-darwin-arm64-capability.tar.gz
- Capability archive URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.40/autoed-0.1.0-beta.40-darwin-arm64-capability.tar.gz
- Capability archive exact bytes: 14123494
- Capability archive SHA-256: cc077e305f63467dbf1136e4208ff14d742a3d818bb00eb55a2bd284eb15bff5
- Signed capability manifest SHA-256: e31eb684facf26734a8748787f5a15f5d37401ba613ee8d332bd49d10b511b72
- Capability Ed25519 signature SHA-256: 5c4608ac6028afdd61863721bacda5151639d2ea50f23332e19d9713eb7ee4e7
- Capability closure SHA-256: 437aa6dcd423d71b15be60b1d0c0eaa534c6e0bd39596d0b04b2afd6e856dfae
- Updater bootstrap: autoed-0.1.0-beta.40-darwin-arm64-bootstrap.sh
- Updater bootstrap URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.40/autoed-0.1.0-beta.40-darwin-arm64-bootstrap.sh
- Updater bootstrap exact bytes: 87412
- Updater bootstrap SHA-256: 67275372dec4924a0e0fbcd51467f89b1420cde225b97d6922bf1bbb4d4f031e
- Updater manifest: autoed-0.1.0-beta.40-darwin-arm64-manifest.json
- Updater manifest SHA-256: a2afd49cc68df1226009b92d1efb97628d6066cbaa8d0ba2d9cbfc946caec7ae
- Updater signature: autoed-0.1.0-beta.40-darwin-arm64-manifest.sig
- Updater signature SHA-256: eef8ffc11bb9504460bc40fe5b831184bfb56959d3c77a54dcef1ad651e5b0c2

```sh
curl -fL --proto '=https' -o autoed-bootstrap.sh 'https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.40/autoed-0.1.0-beta.40-darwin-arm64-bootstrap.sh'
echo '67275372dec4924a0e0fbcd51467f89b1420cde225b97d6922bf1bbb4d4f031e  autoed-bootstrap.sh' | shasum -a 256 -c -
/bin/sh autoed-bootstrap.sh --root "$HOME/Library/Application Support/AutoED-Rebuild-M1"
```

## Windows x64

- Platform: windows
- Capability archive: autoed-0.1.0-beta.40-win32-x64-capability.tar.gz
- Capability archive URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.40/autoed-0.1.0-beta.40-win32-x64-capability.tar.gz
- Capability archive exact bytes: 14674439
- Capability archive SHA-256: 3deca128d189082a353b88326ebeb7ad81d0253eb5b3c08ac853eb4f164a76a8
- Signed capability manifest SHA-256: e31eb684facf26734a8748787f5a15f5d37401ba613ee8d332bd49d10b511b72
- Capability Ed25519 signature SHA-256: 5c4608ac6028afdd61863721bacda5151639d2ea50f23332e19d9713eb7ee4e7
- Capability closure SHA-256: 437aa6dcd423d71b15be60b1d0c0eaa534c6e0bd39596d0b04b2afd6e856dfae
- Updater bootstrap: autoed-0.1.0-beta.40-win32-x64-bootstrap.ps1
- Updater bootstrap URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.40/autoed-0.1.0-beta.40-win32-x64-bootstrap.ps1
- Updater bootstrap exact bytes: 89201
- Updater bootstrap SHA-256: 94589a4d9ca2727704c8d980dbaf014303c1196b0b8751705021142cb87f076e
- Updater manifest: autoed-0.1.0-beta.40-win32-x64-manifest.json
- Updater manifest SHA-256: e793d0ea94dc4bdf562c489fe5db75252ef2ab572c22904a1495020934ecb110
- Updater signature: autoed-0.1.0-beta.40-win32-x64-manifest.sig
- Updater signature SHA-256: f689a0dd0a47627d07fb23e0341002f71cbf0ada1877f2e423ba6624d92f2dfc

```powershell
$staging = Join-Path $env:LOCALAPPDATA 'AutoED-Rebuild-M1-Staging'
New-Item -ItemType Directory -Force -Path $staging | Out-Null
Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.40/autoed-0.1.0-beta.40-win32-x64-bootstrap.ps1' -OutFile .\autoed-bootstrap.ps1
if ((Get-FileHash .\autoed-bootstrap.ps1 -Algorithm SHA256).Hash.ToLowerInvariant() -ne '94589a4d9ca2727704c8d980dbaf014303c1196b0b8751705021142cb87f076e') { throw 'BOOTSTRAP_HASH_MISMATCH' }
& .\autoed-bootstrap.ps1 -StagingParent $staging
```

## Required boundaries

- Require update/reload readiness and cleanup=complete; 不得覆盖，不得强制降级，不得删除课程资料。
- Installation must not log in to Moodle or EdStem; 不得登录。
- The dedicated Profile is sensitive credential storage; 不得复制或备份 Profile。
- Windows native: not_run/human_needed. Live evidence: not_run/human_needed. Phase 3: blocked.
- Publication or installation does not claim live success, native Windows success, or Phase 3 eligibility.
