# AutoED 0.1.0-beta.37 exact Phase 2 install prompt

Repository: returdex/AutoED
Version: 0.1.0-beta.37
Tag: v0.1.0-beta.37
Build ID: e1a566f4c0e53271ea26f14f11c7ec6a4feb20da960d70ad8a59a15820a393ab
Trust fingerprint: fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557
License: PolyForm-Noncommercial-1.0.0
Signed install-prompt core SHA-256: af8564a369f9988a014a41d7cc9c8be9119c97bf064a672066a978197e99e9f5

Use exactly one native target below. The capability archive and the independently rendered updater graph are both mandatory: verify their exact immutable coordinates, then run only the fixed bootstrap command. The bootstrap verifies the signed installer manifest and downloads only the four manifest-bound installer/program/Node/browser assets. Do not execute the inert source template embedded under `program/scripts/install`.

## macOS arm64

- Platform: macos
- Capability archive: autoed-0.1.0-beta.37-darwin-arm64.tar.gz
- Capability archive URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.37/autoed-0.1.0-beta.37-darwin-arm64.tar.gz
- Capability archive exact bytes: 227425164
- Capability archive SHA-256: b299de52bb9d8a8524310bbd5091cd8294ae6b5e30095e88ec818a62c17c7d90
- Signed capability manifest SHA-256: d386dc8a3fe24fcb2b4288b45fa5be89bf0dc253faf8a059e6448ac162bfb2b7
- Capability Ed25519 signature SHA-256: f6b74c608f5637826fff2375946419bcc05ff6588becc529d591d297be5226c9
- Capability closure SHA-256: ded436547380154a8e9a5cf67314e4e973217bc707fbbf9fdf1cd621a2f7f4e7
- Updater bootstrap: autoed-0.1.0-beta.37-darwin-arm64-bootstrap.sh
- Updater bootstrap URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.37/autoed-0.1.0-beta.37-darwin-arm64-bootstrap.sh
- Updater bootstrap exact bytes: 72020
- Updater bootstrap SHA-256: 2f092bcc9d826cc17fcf12edd11f3742094ac78fc554db47d83f0bd872af3d48
- Updater manifest: autoed-0.1.0-beta.37-darwin-arm64-manifest.json
- Updater manifest SHA-256: bca5be3f1f1af3d76247e43bb7439a1907e0a130c595277a464b84ee3d7e635c
- Updater signature: autoed-0.1.0-beta.37-darwin-arm64-manifest.sig
- Updater signature SHA-256: 0852a39c9e95adc1cd5fb152ef086119102751ef490593c367abecc8b03a5d59

```sh
curl -fL --proto '=https' -o autoed-bootstrap.sh 'https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.37/autoed-0.1.0-beta.37-darwin-arm64-bootstrap.sh'
echo '2f092bcc9d826cc17fcf12edd11f3742094ac78fc554db47d83f0bd872af3d48  autoed-bootstrap.sh' | shasum -a 256 -c -
/bin/sh autoed-bootstrap.sh --root "$HOME/Library/Application Support/AutoED-Rebuild-M1"
```

## Windows x64

- Platform: windows
- Capability archive: autoed-0.1.0-beta.37-win32-x64.tar.gz
- Capability archive URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.37/autoed-0.1.0-beta.37-win32-x64.tar.gz
- Capability archive exact bytes: 250436127
- Capability archive SHA-256: cb415d5cd1bf38906746b6bea7cd2a65632eb28657734c0486d3a260b10a45f9
- Signed capability manifest SHA-256: d386dc8a3fe24fcb2b4288b45fa5be89bf0dc253faf8a059e6448ac162bfb2b7
- Capability Ed25519 signature SHA-256: f6b74c608f5637826fff2375946419bcc05ff6588becc529d591d297be5226c9
- Capability closure SHA-256: ded436547380154a8e9a5cf67314e4e973217bc707fbbf9fdf1cd621a2f7f4e7
- Updater bootstrap: autoed-0.1.0-beta.37-win32-x64-bootstrap.ps1
- Updater bootstrap URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.37/autoed-0.1.0-beta.37-win32-x64-bootstrap.ps1
- Updater bootstrap exact bytes: 73809
- Updater bootstrap SHA-256: c75942e353a670c00e68ad412164b06fce9a195d422891f654f9b42f26bf644b
- Updater manifest: autoed-0.1.0-beta.37-win32-x64-manifest.json
- Updater manifest SHA-256: cffdcecbd6c60e87b13a84879ba3176b33fdc77597cb76a2e04329bfa5ece8b7
- Updater signature: autoed-0.1.0-beta.37-win32-x64-manifest.sig
- Updater signature SHA-256: 056386e8b92693bfbfd2054a4c33adb06b1681ff3ccebf5c5d02e11dbcb69052

```powershell
$staging = Join-Path $env:LOCALAPPDATA 'AutoED-Rebuild-M1-Staging'
New-Item -ItemType Directory -Force -Path $staging | Out-Null
Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.37/autoed-0.1.0-beta.37-win32-x64-bootstrap.ps1' -OutFile .\autoed-bootstrap.ps1
if ((Get-FileHash .\autoed-bootstrap.ps1 -Algorithm SHA256).Hash.ToLowerInvariant() -ne 'c75942e353a670c00e68ad412164b06fce9a195d422891f654f9b42f26bf644b') { throw 'BOOTSTRAP_HASH_MISMATCH' }
& .\autoed-bootstrap.ps1 -StagingParent $staging
```

## Required boundaries

- Require update/reload readiness and cleanup=complete; 不得覆盖，不得强制降级，不得删除课程资料。
- Installation must not log in to Moodle or EdStem; 不得登录。
- The dedicated Profile is sensitive credential storage; 不得复制或备份 Profile。
- Windows native: not_run/human_needed. Live evidence: not_run/human_needed. Phase 3: blocked.
- Publication or installation does not claim live success, native Windows success, or Phase 3 eligibility.
