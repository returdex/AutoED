# AutoED-Rebuild 安装与更新

当前实现能验证安装材料、展示并确认准确范围、在隔离根中暂存程序及依赖，并建立独立入口。**暂存不是安装成功**：实际维护事务、启动、自检、旧程序清理及失败恢复由后续安装流程接线。生产发行信任根尚未批准，当前发行入口会以 `RELEASE_TRUST_NOT_ESTABLISHED` 停止；没有可供安装的正式下载地址、SHA-256 或公钥指纹。不要运行占位值，也不要自行接受下载响应提供的新公钥。

## 支持范围与安全边界

- 首版目标是 macOS 14+ ARM64 与 Windows 11 x64。Windows 原生安装检查尚未运行；Windows 版本比较使用内核版本，例如 `10.0.22000`，不是 `11.0.0`。
- 不要求用户预先安装 Node/npm。bootstrap 先用系统工具下载固定 Node 24.20.0，核对经官方独立签名验证的固定哈希，只提取 Node 可执行文件，再运行已固定哈希的最小验证核心。安装包内的程序不能用于证明自身可信。
- macOS 使用系统 shell/curl/shasum/tar；Windows 使用内置 PowerShell、固定 System32/curl.exe、Get-FileHash 和 ZipArchive 的单文件提取。curl 必须至少为 8.4.0；缺失或版本不足会停止，不会静默安装替代工具。
- 下载不使用环境代理或 curlrc，不自动跟随未经重新验证的重定向；每跳检查域名及公有 IPv4，并固定解析地址。解包校验精确文件清单、大小、哈希、路径和链接图。USTAR 的解压数据上限为 512 MiB；较大的浏览器包须使用受支持的 ZIP 格式。
- 只对当前用户的本地保护目录操作；旧 AutoED 根、网络盘、云同步目录、未知同名入口、符号链接/重解析点祖先均不能被自动接管。不访问学校，不读取或复用任何浏览器 Profile、Cookie、密码或课程数据。
- 不修改全局 Node/PATH、系统自启动或 Codex/MCP 宿主配置。不卸载旧产品，不把清理程序理解为删除课程档案的许可。OS 安全提示、权限拒绝和信任根变更均须停止，不能关闭系统防护或永久修改 ExecutionPolicy。

## macOS 完整安装提示词

发行页实际提供批准材料后，可将下面整段交给 Codex。发布流程必须先把方括号替换为该次不可变发行的真实值；当前不要执行。

> 请安装独立的 AutoED-Rebuild M1 beta。目标为 macOS ARM64，本次版本为 [真实版本]。使用 [批准的 bootstrap.sh 下载地址]，其经独立渠道确认的 SHA-256 是 [真实 bootstrap SHA-256]，批准的发行公钥指纹是 [真实指纹]。先将脚本下载到文件、核对整份脚本哈希，再运行，禁止 curl 管道直接执行，禁止从同一未可信下载响应自行接受新密钥。如果材料不存在、不一致、降版或有权限/OS 提示，停止并告诉我。不要要求我手工安装 Node/npm；只允许固定官方 Node 和已签名清单内的依赖，下载到明确选中的私有暂存目录。旧 `/Users/当前用户/Documents/AutoED` 和旧 Application Support/AutoED 只读，不访问其运行时、Profile 或秘密。先展示实际安装 ID、当前/目标身份、完整目标路径、依赖版本与字节、权限、受管程序/进程/入口影响、停机与保留数据、恢复状态，以及不启用自启动、不改宿主配置的事实。等待我确认该准确范围；范围变化重新预览。执行后报告实际启动、自检、清理和恢复结果，不能把暂存或 HTTP 200 当安装成功。需要注册 MCP 时，仅展示独立名称 `autoed-rebuild-m1` 的精确命令和变更预览，未经我对具体宿主配置的确认不要写入。

## Windows 完整安装提示词

> 请安装独立的 AutoED-Rebuild M1 beta。目标为原生 Windows 11 x64，本次版本为 [真实版本]。使用 [批准的 bootstrap.ps1 下载地址]，整份脚本的独立批准 SHA-256 是 [真实 bootstrap SHA-256]，发行公钥指纹是 [真实指纹]。先下载为文件并核验，再运行；不要用 Linux/WSL 结果替代 Windows 检查。不要要求我预装 Node/npm，不安装全局工具、不改 PATH、不永久修改 ExecutionPolicy、不关闭 SmartScreen/防病毒/其他系统防护；工具缺失、版本不支持、签名/哈希不符或出现 OS 权限提示时停止并说明。仅使用明确选中的本地 NTFS 私有暂存和 AutoED-Rebuild 根，旧 Documents/AutoED 与 LocalAppData/AutoED 不可写，不访问 Profile/学校或用户秘密。先完整预览实际安装 ID、当前/目标版本与构建、根与分区、依赖字节和版本、权限、进程/入口影响、停机、保留数据、恢复状态；不启用自启动、不改宿主配置。等待我确认准确范围，变化则重新确认。结束时分开报告暂存、实际启动、自检和清理，不把新启动的测试 MCP 当作现有 Codex 宿主已更新。MCP 仅用独立名称 `autoed-rebuild-m1`；未经我确认具体宿主配置变更不要写入。

## 更新提示词

> 请将我明确选中的 AutoED-Rebuild 安装更新到 [已批准不可变版本及其 bootstrap 地址、SHA-256、公钥指纹]。先验证发行信任，再盘点该安装的真实 ID、active 记录、受管程序、Node/浏览器、入口和已认证的进程；未知同名程序不能接管或按 PID 杀死。预览全部变更、停机、数据保留、迁移与恢复方式，等待我确认准确范围。仅通过维护 journal/恢复流程升级，已有 active 安装不能直接改指针覆盖；若当前版本尚未接入升级引擎，以 `UPGRADE_ENGINE_REQUIRED` 停止。退出维护后以新 generation 重新启动正常 API/Worker，复核真实功能、五项身份和宿主当前 MCP；新启动一个探针不代表长期宿主进程已经重载。保留课程档案，旧受管程序/入口/进程清理未完成须报告 cleanup_pending，不得报告升级完成。权限、发布信任或需要人工操作时停止，给我明确下一步。

## 确认与入口

安装器在同一个交互进程中先输出 `install_preview`，然后要求输入 `INSTALL <完整 scopeHash>`。安装 ID 在预览时确定并用于真实 metadata/credential scope；不同输入取消且不创建受管安装根。确认绑定清单哈希、路径、权限和实际库存。内存确认对象不能序列化后冒充新进程的批准；中断后必须从真实文件重建预览并由恢复流程重新验证。

分区为 `program/<buildId>`、`runtime/24.20.0`、`browser/1234`、`data`、`installer-staging` 与 `bin`。私有 `bin/autoed-rebuild`（Windows 为 `.cmd`）使用绝对 Node 路径，分别验证 Node、resolver、active 记录、安装 ID 和程序文件闭包；未知或被替换的入口不会自动覆盖。macOS MCP 注册预览使用该绝对入口及参数 `mcp`。Windows 注册预览使用固定系统 PowerShell 可执行文件及静态编码的启动协议，路径仅作数据，校验后以原始 stdio handles 启动受管 Node，不依赖通用宿主能直接执行 `.cmd`。两平台名称均为 `autoed-rebuild-m1`，不改 PATH 或宿主配置。

稳定入口的内容并非永久不变：active 哈希、Node/resolver/入口固定值必须由升级 journal 作为同一更新集合管理。resolver 在同一 Node 进程导入 CLI/MCP，OS 命令行仍显示 `bin/launcher.mjs`；旧宿主库存必须结合已验证注册记录及实际 MCP build 探针，不能只按命令行中的 `apps/mcp/main.js` 匹配。Windows PowerShell 父进程退出不证明 Node 子进程退出；原生 EOF、宿主关闭及子进程退出仍须 Plan 14 验证。

## 下游交付检查

发行装配必须嵌入本仓实际编译的 archive-core 与 permissions 字节并同步校验，建立真实固定公钥及 bootstrap SHA-256，签完整文件闭包。macOS headed 浏览器的合法 Framework 内部链接须保持，不能用 headless 包或破坏签名的展开方式代替。完整安装/升级需在真实 program 位置运行受控 controller，不能假设 bootstrap staging 与 API 属于同一编译树。Windows 原生、实际 Codex 退出、当前宿主 MCP 重载和用户更新/登录 UAT 仍需各自证据。
