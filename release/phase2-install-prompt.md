# AutoED 0.1.0-beta.44 exact Phase 2 install prompt

Repository: returdex/AutoED
Version: 0.1.0-beta.44
Tag: v0.1.0-beta.44
Build ID: 474f8b35d11de8bba8743082de69b285cebc8c206dbf8616d8ef61d53bfff9a3
Trust fingerprint: fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557
License: PolyForm-Noncommercial-1.0.0
Signed install-prompt core SHA-256: bd45d6f758279139db5ca64d2346e629cbc0c1005dc81ecbf01b598cf650c54f

Use exactly one native target below. The capability archive and the independently rendered updater graph are both mandatory: verify their exact immutable coordinates, then run only the fixed bootstrap command. The bootstrap verifies the signed installer manifest and downloads only the four manifest-bound installer/program/Node/browser assets. Do not execute the inert source template embedded under `program/scripts/install`.

## macOS arm64

- Platform: macos
- Capability archive: autoed-0.1.0-beta.44-darwin-arm64-capability.tar.gz
- Capability archive URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.44/autoed-0.1.0-beta.44-darwin-arm64-capability.tar.gz
- Capability archive exact bytes: 14134829
- Capability archive SHA-256: 68bf09b49560eb16aad50959443db373d33578e75f2d09a14990300e471749da
- Signed capability manifest SHA-256: bce9376607bafb8b68f3a62486d1a26a596ad7c49365e31cb21551b88ebb11f3
- Capability Ed25519 signature SHA-256: 7a204cf2c7d04f7b8f37b773b1d017cdbbdbe190c1b3f474b913902180f8ee4c
- Capability closure SHA-256: f085cb311c04d1168aa301c594ec9750b4598252494011814608a9f1f3cbce62
- Updater bootstrap: autoed-0.1.0-beta.44-darwin-arm64-bootstrap.sh
- Updater bootstrap URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.44/autoed-0.1.0-beta.44-darwin-arm64-bootstrap.sh
- Updater bootstrap exact bytes: 87412
- Updater bootstrap SHA-256: 332b68e88488255bf23b936689efaef784dc84e9d9d2d4bff96a9ee2c8bccf34
- Updater manifest: autoed-0.1.0-beta.44-darwin-arm64-manifest.json
- Updater manifest SHA-256: 92e1f471d18481b78eccfa2494be0d03da456f90daa3b91e8a34c322938341bf
- Updater signature: autoed-0.1.0-beta.44-darwin-arm64-manifest.sig
- Updater signature SHA-256: 698ada22865200d675adff6cc0c24bb5667d2cd2a7f2b2be275107f6ddda3cf8

```sh
curl -fL --proto '=https' -o autoed-bootstrap.sh 'https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.44/autoed-0.1.0-beta.44-darwin-arm64-bootstrap.sh'
echo '332b68e88488255bf23b936689efaef784dc84e9d9d2d4bff96a9ee2c8bccf34  autoed-bootstrap.sh' | shasum -a 256 -c -
/bin/sh autoed-bootstrap.sh --root "$HOME/Library/Application Support/AutoED-Rebuild-M1"
```

## Windows x64

- Platform: windows
- Capability archive: autoed-0.1.0-beta.44-win32-x64-capability.tar.gz
- Capability archive URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.44/autoed-0.1.0-beta.44-win32-x64-capability.tar.gz
- Capability archive exact bytes: 14685560
- Capability archive SHA-256: 724310cba7fd95d0cf178ec60060ee2417c9a9c9f7001009a415e28cd665cb8d
- Signed capability manifest SHA-256: bce9376607bafb8b68f3a62486d1a26a596ad7c49365e31cb21551b88ebb11f3
- Capability Ed25519 signature SHA-256: 7a204cf2c7d04f7b8f37b773b1d017cdbbdbe190c1b3f474b913902180f8ee4c
- Capability closure SHA-256: f085cb311c04d1168aa301c594ec9750b4598252494011814608a9f1f3cbce62
- Updater bootstrap: autoed-0.1.0-beta.44-win32-x64-bootstrap.ps1
- Updater bootstrap URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.44/autoed-0.1.0-beta.44-win32-x64-bootstrap.ps1
- Updater bootstrap exact bytes: 89201
- Updater bootstrap SHA-256: 8809a64216a21128617f825c721e66efe244034c5be5af6d8a3881975ed6a027
- Updater manifest: autoed-0.1.0-beta.44-win32-x64-manifest.json
- Updater manifest SHA-256: 34b9bf458a20a05415589149de69cc4488b2753f3893e9f79c6f8eb85291dbbe
- Updater signature: autoed-0.1.0-beta.44-win32-x64-manifest.sig
- Updater signature SHA-256: 1fbd3490ee721612768af6f9695296149cd6c8e58bfc19ad82c4eaaa4ec5d634

```powershell
$staging = Join-Path $env:LOCALAPPDATA 'AutoED-Rebuild-M1-Staging'
New-Item -ItemType Directory -Force -Path $staging | Out-Null
Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.44/autoed-0.1.0-beta.44-win32-x64-bootstrap.ps1' -OutFile .\autoed-bootstrap.ps1
if ((Get-FileHash .\autoed-bootstrap.ps1 -Algorithm SHA256).Hash.ToLowerInvariant() -ne '8809a64216a21128617f825c721e66efe244034c5be5af6d8a3881975ed6a027') { throw 'BOOTSTRAP_HASH_MISMATCH' }
& .\autoed-bootstrap.ps1 -StagingParent $staging
```

## Required boundaries

- Require update/reload readiness and cleanup=complete; 不得覆盖，不得强制降级，不得删除课程资料。
- Installation must not log in to Moodle or EdStem; 不得登录。
- The dedicated Profile is sensitive credential storage; 不得复制或备份 Profile。
- Windows native: not_run/human_needed. Live evidence: not_run/human_needed. Phase 3: blocked.
- Publication or installation does not claim live success, native Windows success, or Phase 3 eligibility.
