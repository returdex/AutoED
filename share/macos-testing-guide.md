# AutoED macOS 测试步骤

## 先确认能不能开始

当前 beta.31–beta.39 都已失效，不能安装、更新或重试。开始前必须先收到控制器提供的**新有效候选**：版本、tag、macOS 归档字节数、SHA-256、manifest/签名/build identity、匿名可获取通过证明，以及完整更新提示词。缺任何一项就停止，不要使用 `latest`，不要自己改 URL、版本或 hash。

以下步骤只适用于收到新候选之后。

## 1. 检查 macOS 测试环境

1. 打开“终端”。
2. 记录 macOS 大版本和 `arm64` 架构。
3. 检查是否有宿主 Node，但不要显示路径：

   ```sh
   command -v node >/dev/null 2>&1 && echo node_present || echo node_absent
   ```

4. 如果本次要求“无 Node”，结果必须是 `node_absent`；否则记 `not_observed`，不能算通过。

## 2. 安装 A 版本

1. 使用测试账户，不要使用日常浏览器 Profile。
2. 只运行控制器给出的完整安装提示词，不要自行拼接命令。
3. 如果 macOS 弹出 OS/Keychain 授权，由你本人决定是否批准；不要降低系统安全设置。
4. 安装完成后检查：
   - 显示的版本和 build 与提示词一致；
   - API、Worker 状态为 `healthy`；
   - 安装状态成功，`cleanup=complete`；
   - 原有资料仍在。

出现签名/hash 不匹配、路径冲突、权限错误或无法确认时，停止并记录 `failed` 或 `human_needed`。

## 3. 检查本地管理页面

1. 打开安装后的本地管理页面。
2. 用 Tab、Shift+Tab、Enter 操作，不使用鼠标也应能完成主要操作。
3. 将窗口缩到约 320 CSS px，再放大到 200%。
4. 点击刷新；刷新不能创建新任务。
5. `stale`、`unknown`、断网或 401/403 必须显示为非健康状态，不能伪装成成功。

## 4. 检查退出 Codex 后服务仍运行

1. 完全退出 Codex。
2. 在系统终端使用安装提示词中显示的受管 CLI 入口，执行一次无敏感内容的 health/echo 检查。
3. 只记录 `api`、`worker`、任务结果和 safe code；不要复制路径、PID、日志或 token。
4. 重新打开 Codex，确认 MCP/API/Worker 仍是同一个实际 build。

通过条件：Codex 退出期间 API/Worker 仍可用，echo 任务最终成功，重新打开 Codex 后版本没有混用。

## 5. 测试重复安装、更新中断和恢复

按顺序执行并逐项记录结果：

1. 在中文或包含空格的测试目录重复安装。
2. 执行 A→B 更新，核对 B 的版本、artifact SHA-256、build 和所有受管 entrypoint。
3. 在更新或文件占用场景中按提示停止，确认能安全恢复。
4. 检查旧受管程序、旧启动引用和旧进程已清除。
5. 确认清理程序没有删除课程档案或用户资料。
6. 运行包内的 `install-recovery`、`permissions`、`jobs` synthetic diagnostics（如果提示词提供），只把它们记录为 synthetic/native 结果，不能当作真实来源登录证据。

## 6. Phase 2 更新必须这样做

1. 在 Codex 中新建**同一主机、同一账户的 local projectless Codex task**。
2. 不要选择 AutoED project、repository/worktree 或 cloud task。
3. 将控制器提供的更新提示词完整逐字粘贴。
4. 你本人处理必要的 macOS 授权和 Codex 重启；更新器不得登录 Moodle/EdStem、输入密码/MFA、修改仓库或 `.planning`。
5. 如果返回 `UPDATE_TASK_CONTEXT_INVALID`，这表示任务上下文选错，不是产品更新失败。重新创建正确的 projectless task，再粘贴同一份 exact prompt。

## 7. 更新后必须全部满足

- 版本、macOS artifact SHA-256、build ID 完全匹配；
- `entrypoints=matched`；
- `api=healthy`、`worker=healthy`；
- `paired_ui=ready`；
- `cleanup=complete`；
- 旧受管程序/入口/进程已清除；
- `source_configuration=moodle:not_confirmed,edstem:not_confirmed`；
- `school_access=not_started`；
- `windows=not_run/human_needed`；
- `phase3=blocked`。

任一项为 mismatch、unhealthy、unavailable、`not_observed`、`failed` 或 `cleanup_pending`，都不能继续来源确认或登录。

## 8. 只返回下面的脱敏结果

不要附截图、日志、路径或解释性私人信息：

```text
02-14_UPDATE_RESULT
checkpoint=02-14-macos-update
platform=macos
version=<控制器提供的 exact version>
artifact_sha256=<控制器提供的 macOS artifact SHA-256>
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

只有 `result=pass`、`result_code=UPDATE_COMPLETE`、`cleanup=complete`、build/entrypoints 匹配、API/Worker 健康、paired UI ready 且未开始学校访问，才算更新门通过。

## 9. 立即停止的情况

- 提示词或候选已失效，或版本/URL/hash/签名不一致；
- 要求输入密码、MFA、Cookie、token，或提供 Profile/私有路径；
- 自动打开 Moodle/EdStem、读取课程内容或执行提交/上传；
- 发现旧产品、未知进程、旧入口仍在，或资料可能被删除；
- 结果无法观察或不确定。

停止后只返回允许的 safe code。不要补造通过结果，也不要把发布、下载、synthetic 测试当成真实 macOS 更新通过。
