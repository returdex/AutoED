# AutoED 0.1.0-beta.38 exact Phase 2 install prompt

Repository: returdex/AutoED
Version: 0.1.0-beta.38
Tag: v0.1.0-beta.38
Build ID: 2999283bd4733b798cfa0cec3862efdf72495221475277d905f6800ec4c00d76
Trust fingerprint: fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557
License: PolyForm-Noncommercial-1.0.0
Signed install-prompt core SHA-256: 6679dfe841f497b4f8bf246955d1ba59b65b4539ace9eba46adfaf95aac696e5

Use exactly one native target below. The capability archive and the independently rendered updater graph are both mandatory: verify their exact immutable coordinates, then run only the fixed bootstrap command. The bootstrap verifies the signed installer manifest and downloads only the four manifest-bound installer/program/Node/browser assets. Do not execute the inert source template embedded under `program/scripts/install`.

## macOS arm64

- Platform: macos
- Capability archive: autoed-0.1.0-beta.38-darwin-arm64.tar.gz
- Capability archive URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.38/autoed-0.1.0-beta.38-darwin-arm64.tar.gz
- Capability archive exact bytes: 227426388
- Capability archive SHA-256: 7260c7870bf005d6f04608bcf8b4bc2069ec6c2a5e37bc255adc25a22fe09862
- Signed capability manifest SHA-256: 07d93a97332838f4a4611fc544a39a2bd78adcbdfccae9b7988eae9832ff438e
- Capability Ed25519 signature SHA-256: 996747af027743977caafd77b0e6910575138e89945b6ae6772364cd551a83f4
- Capability closure SHA-256: 00941a9fab999322e720d3264c9539c0c087891a08c4ef0c1656449454a4eed5
- Updater bootstrap: autoed-0.1.0-beta.38-darwin-arm64-bootstrap.sh
- Updater bootstrap URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.38/autoed-0.1.0-beta.38-darwin-arm64-bootstrap.sh
- Updater bootstrap exact bytes: 72020
- Updater bootstrap SHA-256: c465c4e5a9dde3d6a92d2432e548951ffb898e0b8d09b28c098c564ad6053a90
- Updater manifest: autoed-0.1.0-beta.38-darwin-arm64-manifest.json
- Updater manifest SHA-256: 2d8619889b01ef15383d143c4278d14acb7d02caa195070ccc3291798da0ad41
- Updater signature: autoed-0.1.0-beta.38-darwin-arm64-manifest.sig
- Updater signature SHA-256: e9f8d316c5a0932584d0171161d6c89b3fe092d944f72b602634de8f88b4d85c

```sh
curl -fL --proto '=https' -o autoed-bootstrap.sh 'https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.38/autoed-0.1.0-beta.38-darwin-arm64-bootstrap.sh'
echo 'c465c4e5a9dde3d6a92d2432e548951ffb898e0b8d09b28c098c564ad6053a90  autoed-bootstrap.sh' | shasum -a 256 -c -
/bin/sh autoed-bootstrap.sh --root "$HOME/Library/Application Support/AutoED-Rebuild-M1"
```

## Windows x64

- Platform: windows
- Capability archive: autoed-0.1.0-beta.38-win32-x64.tar.gz
- Capability archive URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.38/autoed-0.1.0-beta.38-win32-x64.tar.gz
- Capability archive exact bytes: 250437303
- Capability archive SHA-256: a99d7923e19d388255b0f1b206d45e8e67c91f129d9f61feb5419b11aec24fdd
- Signed capability manifest SHA-256: 07d93a97332838f4a4611fc544a39a2bd78adcbdfccae9b7988eae9832ff438e
- Capability Ed25519 signature SHA-256: 996747af027743977caafd77b0e6910575138e89945b6ae6772364cd551a83f4
- Capability closure SHA-256: 00941a9fab999322e720d3264c9539c0c087891a08c4ef0c1656449454a4eed5
- Updater bootstrap: autoed-0.1.0-beta.38-win32-x64-bootstrap.ps1
- Updater bootstrap URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.38/autoed-0.1.0-beta.38-win32-x64-bootstrap.ps1
- Updater bootstrap exact bytes: 73809
- Updater bootstrap SHA-256: 4b24a7747e2626d64344522a13e3de935dafca2c88cd1fbdb2289c2772bab174
- Updater manifest: autoed-0.1.0-beta.38-win32-x64-manifest.json
- Updater manifest SHA-256: d101b31693ac06604f90fcd40f807d2e4307ed06459a9c65da129b2bac477119
- Updater signature: autoed-0.1.0-beta.38-win32-x64-manifest.sig
- Updater signature SHA-256: 8407c3cbd4b097dbcce16c41e93cf36631faa4ec826f69e917be95caff56f436

```powershell
$staging = Join-Path $env:LOCALAPPDATA 'AutoED-Rebuild-M1-Staging'
New-Item -ItemType Directory -Force -Path $staging | Out-Null
Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.38/autoed-0.1.0-beta.38-win32-x64-bootstrap.ps1' -OutFile .\autoed-bootstrap.ps1
if ((Get-FileHash .\autoed-bootstrap.ps1 -Algorithm SHA256).Hash.ToLowerInvariant() -ne '4b24a7747e2626d64344522a13e3de935dafca2c88cd1fbdb2289c2772bab174') { throw 'BOOTSTRAP_HASH_MISMATCH' }
& .\autoed-bootstrap.ps1 -StagingParent $staging
```

## Required boundaries

- Require update/reload readiness and cleanup=complete; 不得覆盖，不得强制降级，不得删除课程资料。
- Installation must not log in to Moodle or EdStem; 不得登录。
- The dedicated Profile is sensitive credential storage; 不得复制或备份 Profile。
- Windows native: not_run/human_needed. Live evidence: not_run/human_needed. Phase 3: blocked.
- Publication or installation does not claim live success, native Windows success, or Phase 3 eligibility.
