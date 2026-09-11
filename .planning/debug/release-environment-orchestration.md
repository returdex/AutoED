---
status: verifying
trigger: "反复出现缺少文件、签名失败、GitHub 多账号身份错误，并要求把非秘密配置和依赖持久化、将重复签名授权收敛为一次确认"
created: 2026-09-07
updated: 2026-09-11
---

# Release environment and orchestration recurrence

## Symptoms

- Expected: R2–R5 使用同一套仓库内受管命令、固定依赖、隔离 GitHub 身份和预检过的签名权限，失败时保留可恢复的脱敏状态。
- Actual: 执行任务临时生成 `/tmp` 编排脚本；R3 输出捕获、R4 文件组装、GitHub 默认账号和 macOS 钥匙串权限在不同时间重复暴露问题。
- Errors: `RELEASE_IDENTITY_MISMATCH`、钥匙串等待、缺少正式 R4 输出编排，以及 beta.40 `PHASE2_AVAILABILITY_FAILED phase=target-proof asset=macos reason=archive_or_signature`。
- Timeline: beta.35 至 beta.40 的多次稳定化与发布尝试；beta.40 于 2026-09-07 发布后失败。
- Reproduction: 使用临时 R4 脚本生成 capability closure；脚本写入普通 JSON 字节，却在 manifest/receipt 中保存 canonical JSON 哈希；R5 对实际归档成员字节做 SHA-256。

## Current Focus

- hypothesis: beta.43 的 `two-build-upgrade` 在候选 A 的 API 已启动但 Worker 尚未启动时停住；该路径的 `NativeSecretStore.get()` 没有超时，合成测试又不必要地依赖真实 macOS Keychain，导致 `OwnedProcessSupervisor.start()` 的十秒边界可被绕过。Vitest 超时只终止测试协调进程，独立进程组中的合成 API 因而残留。
- test: 先用可注入的挂起 keyring 实现证明 NativeSecretStore 操作能够在固定边界失败；再为明确标记的 synthetic installation 使用受保护、跨进程的测试 secret store，并证明 runner 只回收该步骤新创建且满足精确六 token argv/安装根约束的合成服务。
- expecting: 生产 Keychain 仍是唯一生产 secret store 且有固定超时；合成测试不访问真实 Keychain；固定步骤无论通过、失败或超时都不遗留其新建的严格归属服务。
- next_action: 记录并退役 beta.43，完成聚焦回归与修复提交，再在干净树上运行一次完整、全新的无编号 R1；R1 后停止，不选择 beta.44。
- reasoning_checkpoint: beta.40 保持 `POST_PUBLIC`，beta.41 保持 `POST_ARTIFACT`，beta.42 与 beta.43 均为不可重试的未发布消耗历史。beta.43 的首个正式 R3 失败已由同一精确测试再次复现，不能按单次瞬态保留。

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
- timestamp: 2026-09-08
  observation: archive-tool 修复提交 `40abd99…` 上的首个 fresh R1 越过 focused recovery，进入完整 integration 后在首个 `artifact-assembly` 文件关闭边界返回 `PRE_RUNNER / PROCESS_GROUP_REMAINS`。失败后无相关进程残留；一次带 PID/state census 的完整复现和随后两次完整聚焦复现均 9/9 pass。
- timestamp: 2026-09-08
  observation: 旧 `pgidExists` 对任何非 `ESRCH` 信号探测错误返回 null，但最终用 `!== false` 将 null 和 true 都标成 remains；它也不能识别 zombie-only group，且 `runFixedCommand` 不附 step。纠正后 release gate 46/46 覆盖 live/zombie/absent/observer-failure，bootstrap 17/17 覆盖固定工具及裸命令源码扫描，managed typecheck 与 build 均通过。
- timestamp: 2026-09-08
  observation: 0600 `.runtime/release-environment.json` 现固定记录 `/usr/bin/tar`、`/usr/bin/git`、Git 版本、解析后的 GitHub CLI 版本路径/版本及 `/bin/ps`；环境 preflight 仍为 24 dependencies、returdex isolated identity、keyring pass。Git credential helper 的固定绝对 GitHub CLI 路径已只读解析通过。
- timestamp: 2026-09-11
  observation: `dd446af…` 的完整无编号 R1 已通过并留下精确 attestation；beta.43 随后仅完成本地 R2 选择。首次正式 R3 在固定 `two-build-upgrade` 步骤返回 `PRE_SOURCE / COMMAND_PROCESS_FAILED_TWO_BUILD_UPGRADE`，精确测试文件独立重跑再次以 300 秒超时复现（8/9 通过），因此不是一次性 runner/transient。
- timestamp: 2026-09-11
  observation: 失败 fixture 的 journal 停在 `started/intent`，候选 A API 有严格 runtime record 和 listener，Worker 尚无 record，且没有 failure receipt。该启动检查会先后等待 `NativeSecretStore.get(..., 'cli')` 与 `get(..., 'api')`，现有实现没有任何有界失败。
- timestamp: 2026-09-11
  observation: 失败后遗留的唯一服务满足测试根、安装 metadata、编译入口和六 token `--autoed-service` argv 的严格合成归属校验；已按精确 PID 终止并确认当前残留为零。beta.43 没有 tag、release、public asset、签名资产或 availability receipt。
- timestamp: 2026-09-11
  observation: 修复后的 managed typecheck 通过；凭据/账本 15/15、client wiring 8/8、process lifecycle 1/1、two-build upgrade 9/9、managed cleanup 7/7、journal 6/6、recovery 8/8、release gates 46/46 均在独立测试进程中完整通过。一次主动中断的组合批次留下两个服务，新回收入口仅在 owner 退出且全部严格证据匹配后终止它们，随后 ledger 为零。

## Eliminated

- hypothesis: beta.40 的 Ed25519 私钥或公钥不匹配。
  evidence: R4 能生成两个 64-byte 签名并完成本地 Ed25519 校验；最先失败的精确检查是 closure 文件摘要，不是签名验证。
- hypothesis: GitHub 上传改变了发布资产字节。
  evidence: GitHub 服务器报告的 16 个资产大小和 SHA-256 与本地 publication receipt 一致。

## Resolution

- root_cause: 第一层问题是 R4 曾缺少仓库内单一编排入口，临时脚本对 closure 文件和摘要使用了两种 JSON 序列化。统一入口后暴露第二层问题：正式 R4 复用了无编号 R1 的基础版本构建，导致 beta.41 版本身份错误。第三层环境问题是 release-critical 子进程仍分散依赖 PATH，且 R1 只用 `kill(-pgid,0)` 观察进程组，把 zombie-only、观察错误和真正 live descendant 合并成同一失败，又不记录步骤。这些边界没有在一个固定入口、固定工具集合和可诊断状态模型中收口，因此看似无关的账号、签名、缺文件与清理问题会反复重新调查。
- fix: 保留 `release:environment` 和 `release:assemble-phase2` 固定入口、canonical closure bytes、selected-version rebuild、R5-equivalent prepublication proof、keyring challenge、隔离 GitHub 配置和 bootstrap owner lock。新增统一的绝对可执行文件解析：发行关键脚本仅调用验证过的 tar/git/gh/ps，Git credential helper 也绑定同一绝对 gh；非秘密路径、版本、依赖摘要写入 gitignored 0600 `.runtime/release-environment.json`，私钥/token 仍只留在 OS keyring/GitHub CLI 受保护配置。R1 进程观察对信号存在结果再执行固定 `/bin/ps` census，把 zombie-only 当作无活进程，把 observer failure 与 live remains 分开，并把具体 fixed step 附到错误码。逐文件 integration、固定超时、严格 owner ledger、签名/fingerprint/archive 验证与零 skip/todo 规则均不放宽。
- verification: 当前环境 preflight pass（24 项本地依赖，隔离账号 `returdex`，keyring selfcheck pass）；beta.40–beta.43 的不可变失败边界保持不变。新修复下 managed typecheck、凭据/账本 15/15、client wiring 8/8、process lifecycle 1/1、two-build upgrade 9/9、managed cleanup 7/7、journal 6/6、recovery 8/8、release gates 46/46 pass；主动中断后的严格 orphan reclaim 也确认 ledger 为零。完整新 R1 尚待最终修复提交后运行。
- files_changed: [packages/platform/src/credentials.ts, packages/platform/src/runtime-secrets.ts, packages/platform/src/processes.ts, packages/client/src/credentials.ts, packages/client/src/http.ts, packages/installer/src/install.ts, packages/installer/src/upgrade.ts, apps/api/src/main.ts, apps/worker/src/main.ts, packages/test-support/src/native-runtime.ts, packages/test-support/src/upgrade-fixture.ts, packages/test-support/src/process-ledger.ts, scripts/install/selfcheck.mjs, scripts/release/reclaim-synthetic-processes.mjs, scripts/release/phase2-rehearsal.mjs, tests/unit/credential-redaction.test.ts, tests/integration/client-wiring.test.ts, tests/integration/process-lifecycle.test.ts, tests/integration/upgrade-journal.test.ts, AGENTS.md, .planning/STATE.md, .planning/phases/02-poc-live/02-38-BETA-43-INVALIDATION.md, .planning/debug/release-environment-orchestration.md]
