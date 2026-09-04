# AutoED macOS 测试操作说明

## 现在你要做什么

**目前不要手动安装或更新。** beta.31–beta.39 已失效，当前也没有新的可安装候选。任何人都不得把旧 beta、`latest` 链接或本仓库构建直接当成可测试安装包。

当前开发构建已经在 macOS arm64 本机完成自动化验证；下一步是完成未编号 R0–R1 演练并取得一个新的、匿名可获取的候选包。只有控制器给出该候选的完整测试包后，才执行本页的“人工操作”。

## 当前自动化验证结果（2026-09-05）

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 受管开发运行时 | 通过 | Node 24.20.0，macOS arm64 |
| 类型检查 | 通过 | `tsc --noEmit` |
| 单元测试 | 通过 | 12 文件，144/144 |
| 集成测试 | 通过 | 32 文件，361/361，约 17 分钟 |
| UI 浏览器测试 | 通过 | 34/34 |
| macOS 原生测试 | 通过 | 5 文件，24/24 |
| 本地构建 | 通过 | 4 个应用入口；仅本地构建，未发布 |

这证明的是隔离的本地开发/合成环境行为，**不是**真实安装、真实账户登录、Moodle/EdStem 访问或 Phase 2 通过。

## 开发人员：如何重做自动化验证

在仓库根目录依次运行。测试会建立并清理临时合成运行时；不要在这些命令运行期间启动人工安装流程。

```sh
node scripts/dev/runtime.mjs --check
node scripts/dev/runtime.mjs npm run typecheck
node scripts/dev/runtime.mjs npm run test:unit -- --run
node scripts/dev/runtime.mjs npm run test:integration -- --run
node scripts/dev/runtime.mjs npm run test:ui
node scripts/dev/runtime.mjs npm run test:native -- --run
node scripts/dev/runtime.mjs npm run build
```

正常时长：单元约 3 秒、UI 约 20 秒、原生约 20 秒；完整集成测试约 17 分钟。集成测试会串行验证升级恢复、清理、双构建切换和进程退出，因此长时间没有新行不等于失败。只有命令以状态码 0 结束且最后汇总全部通过，才记录为通过；出现任何 `failed`、超时或非零退出就停止，不能让人工测试替代它。

## 收到新候选后，先核对测试包

控制器必须一次提供以下内容。缺少任一项都不要开始：

1. 新版本号和不可变 tag；
2. macOS arm64 归档文件名、精确字节数和 SHA-256；
3. manifest、签名和 build identity 的匹配证明；
4. 匿名完整下载可获得证明；
5. 完整、不可修改的安装/更新提示词；
6. 明确说明这是哪一轮：首次安装 A、A→B 更新，或恢复验证。

不要自行补 URL、换版本、复制旧 hash、使用 `latest`，也不要把失败 beta 重新尝试。

## 人工操作 1：建立正确的更新任务

每一次安装或更新都按下列步骤建立任务：

1. 在 Codex 点击新建任务。
2. 选择 **Local**，并选择 **projectless / 无项目**。
3. 不要选择 AutoED 项目、任何 repository、worktree、Cloud task 或已有控制器任务。
4. 将控制器提供的提示词完整粘贴；不添加标题、命令、路径、版本或自己的说明。
5. 运行后只等待该任务返回脱敏结果。

如果结果是 `UPDATE_TASK_CONTEXT_INVALID`，说明任务不是 projectless。关闭该任务，重新从第 1 步建立正确的 local projectless task，再粘贴同一份提示词。这不是产品安装失败，也不消耗候选包。

## 人工操作 2：首次安装 A

仅在控制器明确要求“安装 A”时执行：

1. 使用测试 Mac 和测试账户；关闭任何正在使用的 AutoED 测试实例。
2. 不使用日常浏览器 Profile，也不复制 Chrome/Codex cookie。
3. 按“人工操作 1”运行 A 的完整提示词。
4. 若 macOS 显示系统、钥匙串或安全确认窗口，由你本人决定是否批准；不要让任务或他人输入密码、MFA、Cookie 或 token。
5. 等待任务输出安装结果。只核对其中的版本、artifact SHA-256、build、entrypoints、API、Worker、paired UI 和 cleanup 字段。
6. 若任务报告 hash/签名/版本/entrypoint 不匹配，服务不健康，或 `cleanup` 不是 `complete`，立即停止。

安装 A 不进行 Moodle/EdStem 登录、不配置来源、不读取课程内容、不运行提交/上传/测验操作。

## 人工操作 3：检查本地管理页面

仅在 A 的安装结果全部成功后执行：

1. 用安装结果中受管入口打开本地管理页面；不要猜测端口或手工拼接地址。
2. 用 Tab、Shift+Tab、Enter 完成页面基本操作；确认焦点可见。
3. 将页面缩到约 320 CSS px，再放大至 200%；文字、状态和按钮必须仍可读、可操作。
4. 点击页面提供的“刷新/状态”操作一次；它只能刷新状态，不能创建来源任务。
5. 断网、`stale`、`unknown`、401、403 或服务停止时，页面必须显示非健康/未观察状态，不能显示成功。
6. 不点击任何“登录”“连接 Moodle”“连接 EdStem”或来源配置操作。

记录页面只用以下安全字段：版本/build 是否匹配、API/Worker 是否健康、paired UI 是否 ready，以及是否出现明确错误码。不要附 Profile 路径、日志、token、cookie、课程文本或截图中的私人资料。

## 人工操作 4：验证 Codex 退出后服务边界

仅在控制器提示词明确提供受管 health/echo 操作时执行：

1. 完全退出 Codex。
2. 打开系统终端，运行提示词中**原样提供**的受管 health/echo 操作；不要自行寻找可执行文件或复制路径。
3. 只记录 API、Worker、echo 任务和安全错误码。
4. 重新打开 Codex，再核对同一个 build 的 MCP/API/Worker 状态。

通过条件：Codex 退出期间服务可用、echo 最终成功、重开后没有 build 混用。无法观察、服务不健康或 build 不匹配都应停止。

## 人工操作 5：A→B 更新与清理验证

仅在 A 已通过且控制器给出 B 的新测试包时执行：

1. 对 B 的提示词再次执行“人工操作 1”。
2. 人工处理必要的 macOS 授权和 Codex 重启；更新任务不得登录学校站点或修改仓库/`.planning`。
3. 核对 B 的版本、归档 SHA-256、build ID 和每个受管 entrypoint 都与 B 测试包一致。
4. 核对 `api=healthy`、`worker=healthy`、`paired_ui=ready`、`cleanup=complete`。
5. 核对旧受管程序、旧启动引用和旧进程已清除；同时确认课程档案和用户资料没有被删除。
6. 如果提示词提供 `install-recovery`、`permissions` 或 `jobs` diagnostics，可运行它们并记录为 `synthetic/native`。它们不构成真实学校登录证据。

## 必须返回的脱敏结果

不要返回密码、MFA、Cookie、Profile 路径、token、请求头、日志、课程内容或截图。只返回：

```text
02-14_UPDATE_RESULT
checkpoint=02-14-macos-update
platform=macos
version=<控制器给出的精确版本>
artifact_sha256=<控制器给出的 macOS artifact SHA-256>
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
observed_at=<带时区的 ISO-8601 时间>
```

只有 `result=pass`、`result_code=UPDATE_COMPLETE`、`cleanup=complete`、build/entrypoints 均匹配、API/Worker 健康、paired UI ready，且 `school_access=not_started` 时，macOS 更新门才算通过。

## 立即停止的情况

- 没有新的候选测试包，或版本、URL、字节数、hash、签名、build 不一致；
- 任何自动化测试失败、超时或未完成；
- 要求输入或回传密码、MFA、Cookie、token、Profile 路径或课程内容；
- 自动打开 Moodle/EdStem、要求登录、读取课程内容，或执行提交、上传、测验、发帖；
- 发现旧产品/未知进程/旧入口仍存在，`cleanup_pending`，或资料可能被删除；
- 任一结果是 `mismatch`、`unhealthy`、`unavailable`、`not_observed`、`failed` 或 `human_needed`。

停止后只提交允许的安全结果；绝不补造通过、用 synthetic 结果冒充真实登录，或把发布/下载成功当成真实 macOS 更新通过。
