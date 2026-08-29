# AutoED 0.1.0-beta.5 安装与更新提示

这是首次安装 0.1.0-beta.5：只验证 echo；不要尝试 digest。

发布根：`returdex/AutoED`；许可为 PolyForm Noncommercial 1.0.0。Windows 产物只有静态闭包证据，原生运行仍为 not_run。

### macOS 14+（Apple Silicon）

完整 bootstrap SHA-256：`b12df589bf529aaf7507b2ab8e5c6c36b32a06fdddc07df90c32c9340fe7a078`  
固定发布公钥指纹：`fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557`

```sh
mkdir -p "$HOME/Library/Caches/AutoED-Rebuild-M1" && chmod 700 "$HOME/Library/Caches/AutoED-Rebuild-M1"
curl -fL --proto '=https' -o autoed-bootstrap.sh 'https://github.com/returdex/AutoED/releases/download/0.1.0-beta.5/autoed-0.1.0-beta.5-darwin-arm64-bootstrap.sh'
echo 'b12df589bf529aaf7507b2ab8e5c6c36b32a06fdddc07df90c32c9340fe7a078  autoed-bootstrap.sh' | shasum -a 256 -c -
/bin/sh autoed-bootstrap.sh --staging-parent "$HOME/Library/Caches/AutoED-Rebuild-M1"
```

安装器显示预览时，安装根目录输入：`$HOME/Library/Application Support/AutoED-Rebuild-M1`。核对版本、build ID、保留数据、停机和清理范围后，按屏幕要求输入完整确认短语。不要在聊天中提供密码/MFA；本 beta 不登录课程网站。

安装成功后，CLI 位于 `$HOME/Library/Application Support/AutoED-Rebuild-M1/bin/autoed-rebuild`。MCP 注册名固定为 `autoed-rebuild-m1`，command 使用该 CLI，args 为 `["mcp"]`；重新加载 Codex 后再调用。

### Windows 11 x64

完整 bootstrap SHA-256：`0de429a52611d31efd1fc5e774bf24bf69379dbc9e517b2d2171ee7c9ef106c1`  
固定发布公钥指纹：`fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557`

```powershell
New-Item -ItemType Directory -Force -Path "$env:LOCALAPPDATA\AutoED-Rebuild-M1-Staging" | Out-Null
Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/returdex/AutoED/releases/download/0.1.0-beta.5/autoed-0.1.0-beta.5-win32-x64-bootstrap.ps1' -OutFile .\autoed-bootstrap.ps1
if ((Get-FileHash .\autoed-bootstrap.ps1 -Algorithm SHA256).Hash.ToLowerInvariant() -ne '0de429a52611d31efd1fc5e774bf24bf69379dbc9e517b2d2171ee7c9ef106c1') { throw 'BOOTSTRAP_HASH_MISMATCH' }
& .\autoed-bootstrap.ps1 -StagingParent "$env:LOCALAPPDATA\AutoED-Rebuild-M1-Staging"
```

安装器显示预览时，安装根目录输入：`$env:LOCALAPPDATA\AutoED-Rebuild-M1`。核对版本、build ID、保留数据、停机和清理范围后，按屏幕要求输入完整确认短语。不要在聊天中提供密码/MFA；本 beta 不登录课程网站。

安装成功后，CLI 位于 `$env:LOCALAPPDATA\AutoED-Rebuild-M1\bin\autoed-rebuild.cmd`。MCP 注册名固定为 `autoed-rebuild-m1`，command 使用该 CLI，args 为 `["mcp"]`；重新加载 Codex 后再调用。

## 更新与人工测试顺序

1. 在对应原生系统执行本页命令并完成安装器预览确认。
2. 运行 CLI `status` 与 `selftest --kind echo --value beta`；0.1.0-beta.6 再运行 `selftest --kind digest --value beta`。
3. 核对 MCP 注册、重载 Codex、调用 `autoed_status`；不得把 beta 发布本身当作人工通过。
4. 发现旧入口、旧受管进程、build 不一致或 `cleanup_pending` 时立即停止，不开始登录。


---

# AutoED 0.1.0-beta.6 安装与更新提示

这是 A→B 更新：先确认当前 0.1.0-beta.5 可调用 echo，再执行本页 0.1.0-beta.6 bootstrap；升级完成必须核对实际 build ID、digest 自检和 cleanup=complete。若 cleanup_pending，保留现场并停止测试。

发布根：`returdex/AutoED`；许可为 PolyForm Noncommercial 1.0.0。Windows 产物只有静态闭包证据，原生运行仍为 not_run。

### macOS 14+（Apple Silicon）

完整 bootstrap SHA-256：`48b34d3cb9c631308cdaead333cdafb32af5a22eccdd3ec17ff5555de5d60c7f`  
固定发布公钥指纹：`fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557`

```sh
mkdir -p "$HOME/Library/Caches/AutoED-Rebuild-M1" && chmod 700 "$HOME/Library/Caches/AutoED-Rebuild-M1"
curl -fL --proto '=https' -o autoed-bootstrap.sh 'https://github.com/returdex/AutoED/releases/download/0.1.0-beta.6/autoed-0.1.0-beta.6-darwin-arm64-bootstrap.sh'
echo '48b34d3cb9c631308cdaead333cdafb32af5a22eccdd3ec17ff5555de5d60c7f  autoed-bootstrap.sh' | shasum -a 256 -c -
/bin/sh autoed-bootstrap.sh --staging-parent "$HOME/Library/Caches/AutoED-Rebuild-M1"
```

安装器显示预览时，安装根目录输入：`$HOME/Library/Application Support/AutoED-Rebuild-M1`。核对版本、build ID、保留数据、停机和清理范围后，按屏幕要求输入完整确认短语。不要在聊天中提供密码/MFA；本 beta 不登录课程网站。

安装成功后，CLI 位于 `$HOME/Library/Application Support/AutoED-Rebuild-M1/bin/autoed-rebuild`。MCP 注册名固定为 `autoed-rebuild-m1`，command 使用该 CLI，args 为 `["mcp"]`；重新加载 Codex 后再调用。

### Windows 11 x64

完整 bootstrap SHA-256：`f1ab68565a7d0cfc0d1725be5d9dda13fb72350c0ecad262a7813c0316c159da`  
固定发布公钥指纹：`fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557`

```powershell
New-Item -ItemType Directory -Force -Path "$env:LOCALAPPDATA\AutoED-Rebuild-M1-Staging" | Out-Null
Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/returdex/AutoED/releases/download/0.1.0-beta.6/autoed-0.1.0-beta.6-win32-x64-bootstrap.ps1' -OutFile .\autoed-bootstrap.ps1
if ((Get-FileHash .\autoed-bootstrap.ps1 -Algorithm SHA256).Hash.ToLowerInvariant() -ne 'f1ab68565a7d0cfc0d1725be5d9dda13fb72350c0ecad262a7813c0316c159da') { throw 'BOOTSTRAP_HASH_MISMATCH' }
& .\autoed-bootstrap.ps1 -StagingParent "$env:LOCALAPPDATA\AutoED-Rebuild-M1-Staging"
```

安装器显示预览时，安装根目录输入：`$env:LOCALAPPDATA\AutoED-Rebuild-M1`。核对版本、build ID、保留数据、停机和清理范围后，按屏幕要求输入完整确认短语。不要在聊天中提供密码/MFA；本 beta 不登录课程网站。

安装成功后，CLI 位于 `$env:LOCALAPPDATA\AutoED-Rebuild-M1\bin\autoed-rebuild.cmd`。MCP 注册名固定为 `autoed-rebuild-m1`，command 使用该 CLI，args 为 `["mcp"]`；重新加载 Codex 后再调用。

## 更新与人工测试顺序

1. 在对应原生系统执行本页命令并完成安装器预览确认。
2. 运行 CLI `status` 与 `selftest --kind echo --value beta`；0.1.0-beta.6 再运行 `selftest --kind digest --value beta`。
3. 核对 MCP 注册、重载 Codex、调用 `autoed_status`；不得把 beta 发布本身当作人工通过。
4. 发现旧入口、旧受管进程、build 不一致或 `cleanup_pending` 时立即停止，不开始登录。
