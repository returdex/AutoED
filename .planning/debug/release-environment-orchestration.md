---
status: verifying
trigger: "反复出现缺少文件、签名失败、GitHub 多账号身份错误，并要求把非秘密配置和依赖持久化、将重复签名授权收敛为一次确认"
created: 2026-09-07
updated: 2026-09-08
---

# Release environment and orchestration recurrence

## Symptoms

- Expected: R2–R5 使用同一套仓库内受管命令、固定依赖、隔离 GitHub 身份和预检过的签名权限，失败时保留可恢复的脱敏状态。
- Actual: 执行任务临时生成 `/tmp` 编排脚本；R3 输出捕获、R4 文件组装、GitHub 默认账号和 macOS 钥匙串权限在不同时间重复暴露问题。
- Errors: `RELEASE_IDENTITY_MISMATCH`、钥匙串等待、缺少正式 R4 输出编排，以及 beta.40 `PHASE2_AVAILABILITY_FAILED phase=target-proof asset=macos reason=archive_or_signature`。
- Timeline: beta.35 至 beta.40 的多次稳定化与发布尝试；beta.40 于 2026-09-07 发布后失败。
- Reproduction: 使用临时 R4 脚本生成 capability closure；脚本写入普通 JSON 字节，却在 manifest/receipt 中保存 canonical JSON 哈希；R5 对实际归档成员字节做 SHA-256。

## Current Focus

- hypothesis: 受管 runtime 在已验证缓存每次重验时仍以裸 `tar` 依赖调用 shell PATH；长测试批次后的一次 OS/name-resolution spawn 不稳定可在正式 R4 bootstrap 前造成伪“缺文件”失败。
- test: 将平台 archive tool 解析为经过文件检查的绝对路径，macOS 固定 `/usr/bin/tar`，并把非秘密坐标持久化进 release environment；回归拒绝 Windows 缺失/相对 SystemRoot 与源码中的裸 `run('tar')`。
- expecting: 受管 bootstrap 不再依赖调用 shell 的 PATH 查找 archive tool；缺失时固定 fail closed，存在时始终调用同一绝对系统工具。
- next_action: 在修复提交上完成新的无编号 R0/R1；通过前不选择后续 beta。
- reasoning_checkpoint: beta.40 保持 `POST_PUBLIC`，beta.41 保持 `POST_ARTIFACT`，beta.42 因 recurrent/ambiguous `POST_TRANSIENT` 永久消耗。三者均禁止重试、重签、覆盖、删除或重新标记；beta.43 只能在新 R1 通过并获得明确授权后选择。

## Evidence

- timestamp: 2026-09-07
  observation: beta.40 R2、R3、R4 均有本地收据；GitHub release 含 16 个资产，R5 唯一完整匿名验证失败且无 availability receipt。
- timestamp: 2026-09-07
  observation: 脱敏任务记录确认固定失败为 `phase=target-proof asset=macos reason=archive_or_signature`。
- timestamp: 2026-09-07
  observation: 聚焦本地不可变资产诊断在 macOS 与 Windows 均首先失败于 `MANIFEST_closureDigest`。
- timestamp: 2026-09-07
  observation: R4 临时脚本以 `JSON.stringify(closure)` 写文件，却以 `canonicalSha256(closure)` 写 manifest/receipt；R5 对归档内 closure 文件原始字节执行 SHA-256。
- timestamp: 2026-09-07
  observation: 正式 publish 模块已经使用受保护的隔离 `GH_CONFIG_DIR`；默认 `gh` 活动账号错误来自任务在正式入口外进行的临时检查。
- timestamp: 2026-09-07
  observation: 受管 Node 24.20.0、固定依赖、隔离 GitHub login `returdex`、repo-local Git 身份/remote 和 OS-keyring 签名 challenge 均通过前置自检；`.runtime/release-environment.json` 以 0600 权限保存非秘密坐标与依赖摘要。
- timestamp: 2026-09-07
  observation: 新回归证明 capability closure 的归档字节等于 canonical serialization，且其原始 SHA-256 等于清单绑定摘要；focused release-gates 41/41 与 managed typecheck 通过。
- timestamp: 2026-09-07
  observation: 修复提交后的首个 R1 在旧 focused 五文件单进程步骤达到 1200 秒上限并正确返回 `PRE_RUNNER/COMMAND_TIMEOUT`；无进程或临时根残留。
- timestamp: 2026-09-07
  observation: 五个 focused integration 文件独立运行全部通过：1/1（21s）、7/7（235s）、9/9（201s）、6/6（50s）、8/8（527s）。总计 31/31；证明超时来自单 Vitest 进程内的组合资源/观察边界，而非断言失败。
- timestamp: 2026-09-07
  observation: focused 隔离后的下一次完整 R1 跨过原 focused 总上限，但完整 integration 的单 Vitest 进程又在 2100 秒上限停止；快照显示其在双平台 rehearsal 归档等真实工作中持续推进。完整 32 文件清单需要相同的逐文件进程隔离。
- timestamp: 2026-09-07
  observation: 受管 runtime 每次 invocation 都重新下载 Node checksum、签名和九个 release keys；一次网络瞬断产生裸 `fetch failed`，即使全部经过签名验证的缓存已存在。修复后缓存存在时只读本地字节并继续做完整签名/fingerprint/archive 验证，缺失时才下载。
- timestamp: 2026-09-07
  observation: 完整 integration 超时后留下两个 owner 已退出的 native-fixture API/Worker。其 compiled entrypoint、synthetic root、installation metadata、runtime receipts 与 build identity 均一致，但 ledger 仅认可 installed-program 布局，因而无法回收。新增双布局严格校验后，setup 安全终止这两个精确 PID，随后 ledger 4/4、bootstrap 13/13、release gates 43/43 通过且无 synthetic service 残留。
- timestamp: 2026-09-08
  observation: 完整清单隔离后的 R1 在 focused 阶段返回旧的笼统 `COMMAND_REPORT_INVALID`；旧 runner 将非零测试退出和真正的输出解析失败压成同一码且不记录步骤。`two-build-upgrade` 随后独立 9/9 通过，真实 reporter 对固定输出 44/44 正确解析。runner 现将固定步骤名分别绑定到 `COMMAND_PROCESS_FAILED_*` 或 `COMMAND_REPORT_INVALID_*`，不输出原始内容。
- timestamp: 2026-09-08
  observation: 两个受管 runtime 并发启动时，一个进程在 verifier 目录重展开期间观察到 source-map 暂时缺失，另一个通过；文件随后恢复。根因是认证缓存可复用后仍会重验并原地展开，但 bootstrap 没有跨进程写互斥。新增带随机 owner token、PID 存活检查、崩溃回收和固定超时的本地锁，串行化 verifier/Node 展开；它不保存秘密，也不放宽每次密码学验证。
- timestamp: 2026-09-08
  observation: fresh unnumbered R1 在 `eaef25d…` 完整通过；beta.41 R2/R3 通过并签出 16 个本地资产，但正式 R4 的预发布 R5 proof 在两个 updater manifest 上同时拒绝 `build.version=0.1.0`，期望值为 `0.1.0-beta.41`。Ed25519、closure、license、四组件 hash/URL、隔离 GitHub 身份和 keyring 均通过；远端没有 beta.41 tag/release/asset。
- timestamp: 2026-09-08
  observation: 正式 R4 现在在创建输出目录前调用唯一 build 脚本并固定传入所选 prerelease 版本，随后严格校验 version/commit/tree/build ID；组装器也独立重复该校验。回归测试 45/45、artifact assembly 9/9 和 managed typecheck 通过。
- timestamp: 2026-09-08
  observation: `ce6c38c…` 的 fresh R1 完整通过，beta.42 R2/R3 也通过；首次正式 R4 却在任何候选 build/sign/asset 前返回 `Subprocess failed (spawn): tar`。两次紧随其后的 managed bootstrap selfcheck 通过，但同一诊断 shell 随后不能按名解析 `git`；无法满足单次、确定、非复发瞬态证明，beta.42 未发布即永久失效。
- timestamp: 2026-09-08
  observation: 受管 runtime 的两个认证归档解包点此前都调用裸 `tar`。纠正后通过平台函数验证绝对 archive tool，macOS 固定 `/usr/bin/tar`，release environment 将该非秘密坐标写入 0600 本地配置；缺失或不安全路径固定拒绝。

## Eliminated

- hypothesis: beta.40 的 Ed25519 私钥或公钥不匹配。
  evidence: R4 能生成两个 64-byte 签名并完成本地 Ed25519 校验；最先失败的精确检查是 closure 文件摘要，不是签名验证。
- hypothesis: GitHub 上传改变了发布资产字节。
  evidence: GitHub 服务器报告的 16 个资产大小和 SHA-256 与本地 publication receipt 一致。

## Resolution

- root_cause: 第一层问题是 R4 曾缺少仓库内单一编排入口，临时脚本对 closure 文件和摘要使用了两种 JSON 序列化。统一入口后暴露第二层问题：正式 R4 直接复用了无编号 R1 的基础版本构建，而 build ID 不包含发行显示版本，导致 `0.1.0` 编译身份通过 commit/tree/build-ID 检查并进入 beta.41 签名资产。身份、依赖、签名与最终归档证明此前没有在同一入口的正确顺序上完整收口，因此不同失败被误判为账号、钥匙串或缺文件反复失效。
- fix: 增加 `release:environment` 和 `release:assemble-phase2` 固定入口。前者只使用隔离 GitHub 配置、repo-local Git 身份、受管 Node/固定缓存并提前完成一次 keyring challenge；后者用 canonical bytes 同时写文件和计算摘要，并在写 R4 收据前直接复用 R5 `phase2ArchiveProof` 检查两平台全部本地资产。正式 R4 还必须在创建候选输出前用所选 `AUTOED_RELEASE_VERSION` 重建编译入口，严格绑定 version/commit/tree/build ID；组装器在每个平台再次拒绝任何基础版本或身份漂移。非秘密本机配置持久化到 gitignored `.runtime/release-environment.json`，私钥/token 仍只留在 OS keyring/GitHub CLI 受保护配置中。受管 runtime 优先复用本地 Node/PGP/checksum/key 缓存，但每次仍执行签名、fingerprint 和 archive hash 验证；跨进程 owner lock 串行化原地展开，避免并发看到半写目录。R1 focused 与完整 integration 都保留精确测试集合，每个 integration 文件运行于独立受管进程并各有 1200 秒硬上限；完整清单直接从 source-bound `tests/integration/*.test.ts` 排序生成并由回归测试核对。synthetic process ledger 同时严格识别 installed 与 native-fixture compiled 两种受保护布局，使 owner 被超时终止后仍能精确回收独立服务。每个步骤的非零退出和报告解析失败具有不同且固定的步骤级错误码。
- verification: 当前环境 preflight pass（24 项本地依赖，隔离账号 `returdex`，keyring selfcheck pass）；beta.40 两平台旧归档均稳定复现同一预期失败；beta.41 两平台本地资产稳定复现唯一 build-version failure 且远端无变更；beta.42 在 R4 build/sign/asset 前停止且远端/签名资产均不存在。archive-tool 修复后 bootstrap unit 16/16、managed typecheck、连续两次 bootstrap selfcheck 和完整嵌套 `release:environment` 均通过；0600 本地配置已记录 `/usr/bin/tar`。release gate 45/45、artifact assembly 9/9 先前通过。完整新 R1 尚待最终修复提交后运行。
- files_changed: [packages/test-support/src/process-ledger.ts, scripts/dev/runtime.mjs, scripts/build/assemble.mjs, scripts/release/assemble-phase2.mjs, scripts/release/release-environment.mjs, scripts/release/verify-availability.mjs, scripts/release/phase2-rehearsal.mjs, tests/integration/phase2-release-gates.test.ts, tests/unit/bootstrap.test.ts, tests/unit/process-ledger.test.ts, package.json, AGENTS.md, .planning/STATE.md, .planning/debug/release-environment-orchestration.md]
