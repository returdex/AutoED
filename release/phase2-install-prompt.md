# AutoED 0.1.0-beta.48 exact Phase 2 install prompt

Repository: returdex/AutoED
Version: 0.1.0-beta.48
Tag: v0.1.0-beta.48
Build ID: 0d9d5d0d846de375e9bd311b5088c1a6441ebc97bbc19073fd5ee3791a2a8ed3
Trust fingerprint: fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557
License: PolyForm-Noncommercial-1.0.0
Signed install-prompt core SHA-256: 1af5431513b270c9fd57425e2ddc64134cdf6f6bbe1efadfa7c1e0f4ec114135

Use exactly one native target below. The capability archive and the independently rendered updater graph are both mandatory: verify their exact immutable coordinates, then run only the fixed bootstrap command. The bootstrap verifies the signed installer manifest and downloads only the four manifest-bound installer/program/Node/browser assets. Do not execute the inert source template embedded under `program/scripts/install`.

## macOS arm64

- Platform: macos
- Capability archive: autoed-0.1.0-beta.48-darwin-arm64-capability.tar.gz
- Capability archive URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.48/autoed-0.1.0-beta.48-darwin-arm64-capability.tar.gz
- Capability archive exact bytes: 14145359
- Capability archive SHA-256: e1eb0d96c8e1596d01c4760fbda4932984e07fe7ea8aefb133670f554df3306c
- Signed capability manifest SHA-256: 5997d45cade5b715ef55ca1deeff389eb701ad0a73af1c69643d5e98d7864c5e
- Capability Ed25519 signature SHA-256: 0fdd299e831dd6be8a6910d1a0217f0b1b65c163d93a313a6f0fabf017a84e78
- Capability closure SHA-256: 3358f2d264e938f5a6144f7935980e5b271279df40444e773f5132b1d24d8e00
- Updater bootstrap: autoed-0.1.0-beta.48-darwin-arm64-bootstrap.sh
- Updater bootstrap URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.48/autoed-0.1.0-beta.48-darwin-arm64-bootstrap.sh
- Updater bootstrap exact bytes: 87412
- Updater bootstrap SHA-256: 8ae0e17859ef895802e5e316af4583c27140bca1090b4a70952aded848ce99f3
- Updater manifest: autoed-0.1.0-beta.48-darwin-arm64-manifest.json
- Updater manifest SHA-256: a7b629a170e087086669305cb5baddbbb8881066db748cd69fcdd1b893bf2c81
- Updater signature: autoed-0.1.0-beta.48-darwin-arm64-manifest.sig
- Updater signature SHA-256: b141f2be8739cf80a0c9e66952dea2a4d02cda60fd29cf6fedf8064078a04b99

```sh
curl -fL --proto '=https' -o autoed-bootstrap.sh 'https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.48/autoed-0.1.0-beta.48-darwin-arm64-bootstrap.sh'
echo '8ae0e17859ef895802e5e316af4583c27140bca1090b4a70952aded848ce99f3  autoed-bootstrap.sh' | shasum -a 256 -c -
/bin/sh autoed-bootstrap.sh --root "$HOME/Library/Application Support/AutoED-Rebuild-M1"
```

## Windows x64

- Platform: windows
- Capability archive: autoed-0.1.0-beta.48-win32-x64-capability.tar.gz
- Capability archive URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.48/autoed-0.1.0-beta.48-win32-x64-capability.tar.gz
- Capability archive exact bytes: 14696387
- Capability archive SHA-256: 6ef3f0d85b3d1ae6757e3cac1b6e740b7a7920d917f0bb1ddd52a478de53ea29
- Signed capability manifest SHA-256: 5997d45cade5b715ef55ca1deeff389eb701ad0a73af1c69643d5e98d7864c5e
- Capability Ed25519 signature SHA-256: 0fdd299e831dd6be8a6910d1a0217f0b1b65c163d93a313a6f0fabf017a84e78
- Capability closure SHA-256: 3358f2d264e938f5a6144f7935980e5b271279df40444e773f5132b1d24d8e00
- Updater bootstrap: autoed-0.1.0-beta.48-win32-x64-bootstrap.ps1
- Updater bootstrap URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.48/autoed-0.1.0-beta.48-win32-x64-bootstrap.ps1
- Updater bootstrap exact bytes: 89201
- Updater bootstrap SHA-256: f58cc00dbffca279364d138b6c64c9d30b361da48c79785ba5fe3c0527ff9018
- Updater manifest: autoed-0.1.0-beta.48-win32-x64-manifest.json
- Updater manifest SHA-256: 47aab30e730875c76b965471bf4756112776e7d9e0f148a6730eef05390ae76c
- Updater signature: autoed-0.1.0-beta.48-win32-x64-manifest.sig
- Updater signature SHA-256: 3d28d8792e4de309804b70e3b272eafcf8dc7774cb063faee8b250297315e0d6

```powershell
$staging = Join-Path $env:LOCALAPPDATA 'AutoED-Rebuild-M1-Staging'
New-Item -ItemType Directory -Force -Path $staging | Out-Null
Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.48/autoed-0.1.0-beta.48-win32-x64-bootstrap.ps1' -OutFile .\autoed-bootstrap.ps1
if ((Get-FileHash .\autoed-bootstrap.ps1 -Algorithm SHA256).Hash.ToLowerInvariant() -ne 'f58cc00dbffca279364d138b6c64c9d30b361da48c79785ba5fe3c0527ff9018') { throw 'BOOTSTRAP_HASH_MISMATCH' }
& .\autoed-bootstrap.ps1 -StagingParent $staging
```

## Required boundaries

- Run only in a same-host/account local projectless Codex task. A task attached to any saved project, repository or worktree must stop with UPDATE_TASK_CONTEXT_INVALID before download or updater invocation. The updater task must not read, edit, commit, or push the current task workspace.
- Run the selected bootstrap exactly once; do not rerun it after any nonzero, interrupted, uncertain, or human-needed result.
- Require update/reload readiness and cleanup=complete; 不得覆盖，不得强制降级，不得删除课程资料。
- Installation must not log in to Moodle or EdStem; 不得登录。
- The dedicated Profile is sensitive credential storage; 不得复制或备份 Profile。
- Windows native: not_run/human_needed. Live evidence: not_run/human_needed. Phase 3: blocked.
- Publication or installation does not claim live success, native Windows success, or Phase 3 eligibility.
