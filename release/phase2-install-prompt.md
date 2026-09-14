# AutoED 0.1.0-beta.51 exact Phase 2 install prompt

Repository: returdex/AutoED
Version: 0.1.0-beta.51
Tag: v0.1.0-beta.51
Build ID: 9a39bccc79391b37bde1a7871b5dbd234fbef76cd6bcd331852156521c266c80
Trust fingerprint: fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557
License: PolyForm-Noncommercial-1.0.0
Signed install-prompt core SHA-256: 2e625ea6cd58bfaeb5fb8d42bd8937c43aaafae03bd8c67cda2d699e2c6c9fb2

Use exactly one native target below. The capability archive and the independently rendered updater graph are both mandatory: verify their exact immutable coordinates, then run only the fixed bootstrap command. The bootstrap verifies the signed installer manifest and downloads only the four manifest-bound installer/program/Node/browser assets. Do not execute the inert source template embedded under `program/scripts/install`.

## macOS arm64

- Platform: macos
- Capability archive: autoed-0.1.0-beta.51-darwin-arm64-capability.tar.gz
- Capability archive URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.51/autoed-0.1.0-beta.51-darwin-arm64-capability.tar.gz
- Capability archive exact bytes: 14150153
- Capability archive SHA-256: c24a12aa415b9810fff0557e8dd9615223adf41ca22edfc15ee65e49f607aa2f
- Signed capability manifest SHA-256: 2e2dda85bdc5679179ed4061b57146afcd05285a5e3a26e5e4241c35f7ea7c67
- Capability Ed25519 signature SHA-256: 75235204bd18ffab147d64938b853acf8c24948e1744027b6a800659c0512185
- Capability closure SHA-256: e3b657491e1f6821de932bc39b7477a3ac29633cb5739bebe48cc2ba26f30fb5
- Updater bootstrap: autoed-0.1.0-beta.51-darwin-arm64-bootstrap.sh
- Updater bootstrap URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.51/autoed-0.1.0-beta.51-darwin-arm64-bootstrap.sh
- Updater bootstrap exact bytes: 87412
- Updater bootstrap SHA-256: 35ebffc52f96103b96142a32ee1a464c2da9224caea1d4273f4fef0c41be24d2
- Updater manifest: autoed-0.1.0-beta.51-darwin-arm64-manifest.json
- Updater manifest SHA-256: 1210e0feced9118a62ddd9c6f7903be657d95c08873e6786d88c93450df3af0c
- Updater signature: autoed-0.1.0-beta.51-darwin-arm64-manifest.sig
- Updater signature SHA-256: e8c779b8c3d4eeb6e0fa26a66ccabb16680b0a15f0e2ad239be1b1dcfc19bbf7

```sh
curl -fL --proto '=https' -o autoed-bootstrap.sh 'https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.51/autoed-0.1.0-beta.51-darwin-arm64-bootstrap.sh'
echo '35ebffc52f96103b96142a32ee1a464c2da9224caea1d4273f4fef0c41be24d2  autoed-bootstrap.sh' | shasum -a 256 -c -
/bin/sh autoed-bootstrap.sh --root "$HOME/Library/Application Support/AutoED-Rebuild-M1"
```

## Windows x64

- Platform: windows
- Capability archive: autoed-0.1.0-beta.51-win32-x64-capability.tar.gz
- Capability archive URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.51/autoed-0.1.0-beta.51-win32-x64-capability.tar.gz
- Capability archive exact bytes: 14701067
- Capability archive SHA-256: cf0eb340c2990c5701880a977bb8072bd34e686bc5f648cb84e9f821af042fe2
- Signed capability manifest SHA-256: 2e2dda85bdc5679179ed4061b57146afcd05285a5e3a26e5e4241c35f7ea7c67
- Capability Ed25519 signature SHA-256: 75235204bd18ffab147d64938b853acf8c24948e1744027b6a800659c0512185
- Capability closure SHA-256: e3b657491e1f6821de932bc39b7477a3ac29633cb5739bebe48cc2ba26f30fb5
- Updater bootstrap: autoed-0.1.0-beta.51-win32-x64-bootstrap.ps1
- Updater bootstrap URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.51/autoed-0.1.0-beta.51-win32-x64-bootstrap.ps1
- Updater bootstrap exact bytes: 89201
- Updater bootstrap SHA-256: 8a9320f6845784a4661a524ead61bc860b5e45a546638b14dc2b9f43e7c093d5
- Updater manifest: autoed-0.1.0-beta.51-win32-x64-manifest.json
- Updater manifest SHA-256: 1eca76c554408de443e673d083da7dbb5ceea1eecc78abf9b347768745afe7a7
- Updater signature: autoed-0.1.0-beta.51-win32-x64-manifest.sig
- Updater signature SHA-256: ba1959d9ecd02e6d745742c3b1cf82a6d332b403b447fe0ec1c3d96b6f8ed475

```powershell
$staging = Join-Path $env:LOCALAPPDATA 'AutoED-Rebuild-M1-Staging'
New-Item -ItemType Directory -Force -Path $staging | Out-Null
Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.51/autoed-0.1.0-beta.51-win32-x64-bootstrap.ps1' -OutFile .\autoed-bootstrap.ps1
if ((Get-FileHash .\autoed-bootstrap.ps1 -Algorithm SHA256).Hash.ToLowerInvariant() -ne '8a9320f6845784a4661a524ead61bc860b5e45a546638b14dc2b9f43e7c093d5') { throw 'BOOTSTRAP_HASH_MISMATCH' }
& .\autoed-bootstrap.ps1 -StagingParent $staging
```

## Required boundaries

- Run only in a same-host/account local projectless Codex task. A task attached to any saved project, repository or worktree must stop with UPDATE_TASK_CONTEXT_INVALID before download or updater invocation. The updater task must not read, edit, commit, or push the current task workspace.
- Before invoking the selected bootstrap, create exactly one live interactive PTY/session with TTY stdin, stdout and stderr. Do not use a non-interactive command runner, detached process, closed stdin, transcript replay, or a second session. The updater must stop with INTERACTIVE_SESSION_REQUIRED before mutation if that transport is absent.
- Run the selected bootstrap exactly once and keep that same process/session alive across both human gates. On each recovery or install preview, show the complete preview, pause for the user's real exact response, then relay only that response plus one newline to the same still-running PTY/session. Do not rerun after any nonzero, interrupted, uncertain, malformed, or human-needed result.
- Require update/reload readiness and cleanup=complete; 不得覆盖，不得强制降级，不得删除课程资料。
- Installation must not log in to Moodle or EdStem; 不得登录。
- The dedicated Profile is sensitive credential storage; 不得复制或备份 Profile。
- Windows native: not_run/human_needed. Live evidence: not_run/human_needed. Phase 3: blocked.
- Publication or installation does not claim live success, native Windows success, or Phase 3 eligibility.
