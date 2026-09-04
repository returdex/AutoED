# AutoED macOS 测试操作与脱敏证据指南

**适用对象：** 需要在真实 macOS 设备上执行 AutoED 人工验收的用户。  
**当前状态（2026-09-04）：** beta.31–beta.39 都是不可重试、不可覆盖的失效历史；当前没有可供更新的有效候选。不要运行旧版提示词，也不要使用 `latest` 或手工替换版本、标签、URL、字节数或 SHA-256。

本文件只提供测试步骤和安全的证据格式，不会替代用户的实际操作。密码、MFA、Cookie、Profile、私有路径、原始日志和课程内容不得发送给任何人，也不得写入本文件、Git 或收据。

## 1. 证据类型和角色

- **S（synthetic）**：单元/契约/合成测试；不能证明真实设备或真实来源。
- **I（integration）**：本地 SQLite、文件、多进程和 HTTP/stdio 集成测试。
- **N（native）**：在声明的 macOS 版本和 arm64 设备上实际运行。
- **L（live）**：用户本人在批准的真实设备、账户和来源上完成的证据。

控制器负责自动测试、构建、签名和发布检查；用户负责真实 macOS 的安装、更新、OS 授权、重启、退出 Codex 和人工观察。控制器不得替用户点击或编写通过结果。

## 2. 开始前：等待有效候选

只有控制器明确提供以下全部信息，才能开始安装或更新：

1. 精确 `version`、`tag` 和 macOS 目标 `darwin-arm64`；
2. macOS 归档的精确字节数和 SHA-256；
3. manifest、签名验证结果、build identity；
4. 公开发布对象的匿名完整可获取证明（availability receipt）；
5. 与上述收据逐字段绑定、逐字展示的安装/更新提示词。

任一项缺失、失效、`cleanup_pending`、`not_observed` 或不一致，都应停止。不要下载或运行 beta.31–beta.39，不要自行拼接命令，不要改写提示词。

## 3. Phase 1：macOS 原生安装与升级验收

当控制器给出新的有效候选后，按下列顺序执行。每一步只记录公开版本、平台、状态和 safe code。

### 3.1 声明测试环境

1. 在测试记录中写 `platform=macos` 和 `arch=arm64`，记录 macOS 大版本即可。
2. 使用测试账户和受管安装目录；不要把用户名、绝对路径或 Profile 位置发回。
3. 以安全方式检查宿主 Node 是否存在，只返回 `node_present` 或 `node_absent`，不要复制路径：

   ```sh
   command -v node >/dev/null 2>&1 && echo node_present || echo node_absent
   ```

   若目标是“无 Node”验收而结果为 `node_present`，记为 `not_observed`，不能宣称该项通过。

### 3.2 首次安装（A 版本）

1. 只使用控制器提供的完整、已验证提示词；按提示进行预览和一次确认。
2. 仅在系统确实提示时，由用户本人处理 macOS OS/Keychain 授权；不要降低系统安全设置。
3. 核对安装结果：版本、build、受管 API/Worker、安装状态和 `cleanup`。数据目录必须保持受保护，不能删除既有课程档案。
4. 若出现权限拒绝、路径冲突、签名/hash 不匹配或其他不确定情况，立即停止并记 `failed` 或 `human_needed`。

### 3.3 A→B 更新

1. 在 Codex 中打开新的**同一主机、同一账户的 local projectless Codex task**；不要选择 AutoED 项目、repository/worktree 或 cloud task。
2. 将控制器展示的更新提示词完整逐字粘贴；不要手工改版本、URL、hash 或命令。
3. 更新器只能更新新产品的受管安装/运行目录，不得写仓库或 `.planning`，不得修改旧产品，不得复制/导出 Profile，不得打开 Moodle/EdStem 或输入密码/MFA。
4. 若需要重启 Codex 或处理 OS 对话框，由用户本人完成。更新器不会代替用户批准。
5. 更新后核对：
   - 实际版本、macOS artifact SHA-256、build ID 与候选完全一致；
   - 所有受管 entrypoint 已指向新版本；
   - API 和 Worker 均为 `healthy`；
   - paired UI 为 `ready`；
   - `cleanup=complete`，旧受管程序、启动引用和进程已清除；
   - 用户资料仍在，不能因清理程序而删除课程档案。

### 3.4 独立运行与故障分支

1. 完全退出 Codex，在系统终端使用安装说明中的受管绝对入口执行一次无敏感内容的 echo/health 检查；只返回状态和 safe code，不返回路径、PID 或日志。
2. 重新打开 Codex，确认 MCP/API/Worker 仍指向同一实际 build；不要把新启动的自检进程冒充宿主已重载。
3. 按清单观察重复安装、中文及空格路径、文件占用/锁、更新中断、恢复、旧进程清理和数据保留。
4. 运行包内已提供的 synthetic diagnostics（如 `install-recovery`、`permissions`、`jobs`）。这些只能算 S/I/N 证据，不能填写 live L。
5. UI 人工检查：键盘 Tab/Shift+Tab/Enter、窄窗口约 320 CSS px、200% 缩放、刷新不创建新任务，以及 `stale`/`unknown` 不被显示为健康。

## 4. Phase 2：macOS 更新门 02-14

Phase 2 的更新门只验证“用户是否真的运行了指定 beta”，不验证学校登录。

1. 等控制器确认新的候选已完成 R0–R5：精确 rehearsal、候选锁定、完整测试、双平台签名归档、公开发布和匿名 availability 通过。
2. 在提示词中逐字段核对版本、tag、macOS 目标、字节数、SHA-256、manifest、签名和 build identity；任何差异立即停止。
3. 在同一主机/账户新建 **local projectless Codex task**，粘贴提示词全文。AutoED 项目控制器只等待结果，不运行更新、不批准 OS、不重启 Codex、不创建通过收据。
4. `UPDATE_TASK_CONTEXT_INVALID` 表示任务上下文错误，不是产品更新失败；不要把它写成安装失败。应重新创建正确的 projectless task，再使用同一份 exact prompt。
5. 更新结果必须同时满足以下条件才能通过 02-14：
   - exact version/hash/build 匹配；
   - `result=pass`、`result_code=UPDATE_COMPLETE`；
   - `cleanup=complete`；
   - `actual_build=matched`、`entrypoints=matched`；
   - `api=healthy`、`worker=healthy`、`paired_ui=ready`；
   - `source_configuration=moodle:not_confirmed,edstem:not_confirmed`；
   - `school_access=not_started`、`windows=not_run/human_needed`、`phase3=blocked`。

任何 `failed`、`human_needed`、`not_observed`、mismatch、unhealthy、unavailable 或 `cleanup_pending` 都保持阻塞，不得继续来源配置或登录。

## 5. 后续 live 检查（本文件不执行）

02-14 通过后，仍需另行完成 Phase 2 的 paired 来源/账户/组织/课程/目的地确认、官方页面登录/MFA、Profile 重开、Worker/OS 重启、Codex 退出、至少 24 小时复查和 reauth。确认前不得打开 Moodle/EdStem；不要求第二个真实账户，也不得故意制造学校错误。Windows 原生证据不能由 macOS、Linux 或 WSL 替代。

## 6. 脱敏证据返回格式

### 6.1 Phase 2 02-14 更新结果

只返回下面固定块，不附解释、截图、日志或私人字段。尖括号内容由控制器提供或由用户填写，不要猜测：

```text
02-14_UPDATE_RESULT
checkpoint=02-14-macos-update
platform=macos
version=<exact candidate version>
artifact_sha256=<exact macOS artifact SHA-256>
result=pass|failed|human_needed
result_code=UPDATE_COMPLETE|UPDATE_FAILED|UPDATE_HUMAN_NEEDED|UPDATE_TASK_CONTEXT_INVALID|CLEANUP_PENDING|VERSION_MISMATCH|ENTRYPOINT_MISMATCH|SERVICE_UNHEALTHY|PAIRED_UI_UNAVAILABLE|RESULT_NOT_OBSERVED
cleanup=complete|cleanup_pending|not_observed
actual_build=matched|mismatch|not_observed
entrypoints=matched|mismatch|not_observed
api=healthy|unhealthy|not_observed
worker=healthy|unhealthy|not_observed
paired_ui=ready|unavailable|not_observed
source_configuration=moodle:not_confirmed|confirmed|not_observed,edstem:not_confirmed|confirmed|not_observed
school_access=not_started
windows=not_run/human_needed
phase3=blocked
observed_at=<ISO-8601 with timezone>
```

### 6.2 Phase 1 人工记录建议

每项只写：`日期/时区、platform、arch、公开 version、公开 build、pass|failed|not_observed|human_needed、safe code`。把“发布可获取”“synthetic diagnostics”“本机原生观察”“用户 live 操作”分开记录；不要以其中任何一类替代另一类。

## 7. 必须立即停止的情况

- 提示词、版本、tag、字节数、hash、签名或 build identity 不一致；
- 公开候选没有 availability 通过收据，或候选已经标记失效；
- 要求输入密码、MFA、Cookie、Bearer/token，或要求粘贴 Profile/私有路径；
- 页面或脚本试图打开学校来源、读取课程内容、上传/提交/回复或调用未批准 API；
- 发现 legacy 目录、日常浏览器 Profile、未知进程或不属于本安装的文件；
- 任何结果无法观察、服务不健康、旧入口仍在、清理未完成或数据可能受损。

停止后只返回允许的 safe code。不要为了“完成测试”重试失效 beta、删除课程档案、放宽权限、复制凭据或补造通过证据。
