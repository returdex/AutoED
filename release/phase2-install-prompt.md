# AutoED 0.1.0-beta.52 exact Phase 2 install prompt

Repository: returdex/AutoED
Version: 0.1.0-beta.52
Tag: v0.1.0-beta.52
Build ID: 5ba1ab86653cef8e1c688248736191b4da2d58018c80725d31b06c0b215781dc
Trust fingerprint: fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557
License: PolyForm-Noncommercial-1.0.0
Signed install-prompt core SHA-256: 35874197a2fea3fd616d04ac527b8692bc4f5627d458db72d6a6b6015c0923d5

Use exactly one native target below. The capability archive and the independently rendered updater graph are both mandatory: verify their exact immutable coordinates, then run only the fixed bootstrap command. The bootstrap verifies the signed installer manifest and downloads only the four manifest-bound installer/program/Node/browser assets. Do not execute the inert source template embedded under `program/scripts/install`.

## macOS arm64

- Platform: macos
- Capability archive: autoed-0.1.0-beta.52-darwin-arm64-capability.tar.gz
- Capability archive URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.52/autoed-0.1.0-beta.52-darwin-arm64-capability.tar.gz
- Capability archive exact bytes: 14154857
- Capability archive SHA-256: 0ad210bc96280b2f9fbe5ccea0c0275a0ce4ccb8329d47d3c4ac8307bf69f5e9
- Signed capability manifest SHA-256: 0c02c42f1958f977e47fd19ab8c868f9aef73e0d025d75aba89532d398296f11
- Capability Ed25519 signature SHA-256: cd7f240fb31c022ef58a6b7213929304b5887b1f32ae2d57a8f025587fb996f7
- Capability closure SHA-256: c9003b1f45a5c56996fef64554ae7698c2b008593f32317bf3b886b9a96a63b5
- Updater bootstrap: autoed-0.1.0-beta.52-darwin-arm64-bootstrap.sh
- Updater bootstrap URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.52/autoed-0.1.0-beta.52-darwin-arm64-bootstrap.sh
- Updater bootstrap exact bytes: 89044
- Updater bootstrap SHA-256: 715b60cc20afddd1f2577ba6c2fb06cc298615518287da08a02fa9c0befd9667
- Updater manifest: autoed-0.1.0-beta.52-darwin-arm64-manifest.json
- Updater manifest SHA-256: ce4c92ffb13420300d9e9a239ec28b0503fb7296dd58f6c47d37ff8c9b949d8b
- Updater signature: autoed-0.1.0-beta.52-darwin-arm64-manifest.sig
- Updater signature SHA-256: 2fca51cad6a872c1ffd10c2aa094ad1712ea7b5584d947f90886111371d81611

```sh
curl -fL --proto '=https' -o autoed-bootstrap.sh 'https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.52/autoed-0.1.0-beta.52-darwin-arm64-bootstrap.sh'
echo '715b60cc20afddd1f2577ba6c2fb06cc298615518287da08a02fa9c0befd9667  autoed-bootstrap.sh' | shasum -a 256 -c -
/bin/sh autoed-bootstrap.sh --root "$HOME/Library/Application Support/AutoED-Rebuild-M1"
```

## Windows x64

- Platform: windows
- Capability archive: autoed-0.1.0-beta.52-win32-x64-capability.tar.gz
- Capability archive URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.52/autoed-0.1.0-beta.52-win32-x64-capability.tar.gz
- Capability archive exact bytes: 14705693
- Capability archive SHA-256: dc036ed2b51239c7f10c4f69faabc4441316666651d8162d8aff916d7f37edc4
- Signed capability manifest SHA-256: 0c02c42f1958f977e47fd19ab8c868f9aef73e0d025d75aba89532d398296f11
- Capability Ed25519 signature SHA-256: cd7f240fb31c022ef58a6b7213929304b5887b1f32ae2d57a8f025587fb996f7
- Capability closure SHA-256: c9003b1f45a5c56996fef64554ae7698c2b008593f32317bf3b886b9a96a63b5
- Updater bootstrap: autoed-0.1.0-beta.52-win32-x64-bootstrap.ps1
- Updater bootstrap URL: https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.52/autoed-0.1.0-beta.52-win32-x64-bootstrap.ps1
- Updater bootstrap exact bytes: 90916
- Updater bootstrap SHA-256: 62d6d5e20dfc99b5be7ef202612d6b83a7eff0b9a9ce0f125a4500b944918257
- Updater manifest: autoed-0.1.0-beta.52-win32-x64-manifest.json
- Updater manifest SHA-256: 6163d67833f32db1321d4911bd496746f98a52b64795518af7ee4d3852d997f2
- Updater signature: autoed-0.1.0-beta.52-win32-x64-manifest.sig
- Updater signature SHA-256: 8318dddd96c422db955faf3e62e572599441b8e7ff40b2e960aefe64611495e5

```powershell
$staging = Join-Path $env:LOCALAPPDATA 'AutoED-Rebuild-M1-Staging'
New-Item -ItemType Directory -Force -Path $staging | Out-Null
Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.52/autoed-0.1.0-beta.52-win32-x64-bootstrap.ps1' -OutFile .\autoed-bootstrap.ps1
if ((Get-FileHash .\autoed-bootstrap.ps1 -Algorithm SHA256).Hash.ToLowerInvariant() -ne '62d6d5e20dfc99b5be7ef202612d6b83a7eff0b9a9ce0f125a4500b944918257') { throw 'BOOTSTRAP_HASH_MISMATCH' }
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
