---
status: verifying
trigger: "反复出现缺少文件、签名失败、GitHub 多账号身份错误，并要求把非秘密配置和依赖持久化、将重复签名授权收敛为一次确认"
created: 2026-09-07
updated: 2026-09-07
---

# Release environment and orchestration recurrence

## Symptoms

- Expected: R2–R5 使用同一套仓库内受管命令、固定依赖、隔离 GitHub 身份和预检过的签名权限，失败时保留可恢复的脱敏状态。
- Actual: 执行任务临时生成 `/tmp` 编排脚本；R3 输出捕获、R4 文件组装、GitHub 默认账号和 macOS 钥匙串权限在不同时间重复暴露问题。
- Errors: `RELEASE_IDENTITY_MISMATCH`、钥匙串等待、缺少正式 R4 输出编排，以及 beta.40 `PHASE2_AVAILABILITY_FAILED phase=target-proof asset=macos reason=archive_or_signature`。
- Timeline: beta.35 至 beta.40 的多次稳定化与发布尝试；beta.40 于 2026-09-07 发布后失败。
- Reproduction: 使用临时 R4 脚本生成 capability closure；脚本写入普通 JSON 字节，却在 manifest/receipt 中保存 canonical JSON 哈希；R5 对实际归档成员字节做 SHA-256。

## Current Focus

- hypothesis: 发布流程缺少仓库内唯一编排入口，导致执行任务重复发明临时 runner；beta.40 的直接失败由 closure 原始字节摘要与 canonical 摘要不一致造成。
- test: 对 beta.40 本地不可变资产逐项复现 R5 target-proof，输出首个固定失败边界；比较 R4 临时脚本和 R5 校验器的摘要语义。
- expecting: macOS 与 Windows 均在 capability closure 原始字节摘要绑定处失败，其他签名/成员检查尚未进入。
- next_action: 在修复提交上完成新的无编号 R0/R1；通过前不选择后续 beta。
- reasoning_checkpoint: beta.40 已发布且唯一完整 verifier 已消耗；禁止重试、覆盖、删除或重新标记。

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

## Eliminated

- hypothesis: beta.40 的 Ed25519 私钥或公钥不匹配。
  evidence: R4 能生成两个 64-byte 签名并完成本地 Ed25519 校验；最先失败的精确检查是 closure 文件摘要，不是签名验证。
- hypothesis: GitHub 上传改变了发布资产字节。
  evidence: GitHub 服务器报告的 16 个资产大小和 SHA-256 与本地 publication receipt 一致。

## Resolution

- root_cause: R4 缺少仓库内单一编排入口，执行任务以临时脚本重建流程；该脚本对 closure 文件和摘要使用了两种 JSON 序列化。身份与签名检查也未集中在长耗时组装之前，因此默认账号和钥匙串提示被误判为反复出现的新故障。
- fix: 增加 `release:environment` 和 `release:assemble-phase2` 固定入口。前者只使用隔离 GitHub 配置、repo-local Git 身份、受管 Node/固定缓存并提前完成一次 keyring challenge；后者用 canonical bytes 同时写文件和计算摘要，并在写 R4 收据前直接复用 R5 `phase2ArchiveProof` 检查两平台全部本地资产。非秘密本机配置持久化到 gitignored `.runtime/release-environment.json`，私钥/token 仍只留在 OS keyring/GitHub CLI 受保护配置中。
- verification: 当前环境 preflight pass；keyring selfcheck pass；beta.40 两平台旧归档均稳定复现同一预期失败；managed typecheck pass；focused release gate 41/41 pass。完整新 R1 尚待修复提交后运行。
- files_changed: [scripts/release/assemble-phase2.mjs, scripts/release/release-environment.mjs, scripts/release/verify-availability.mjs, tests/integration/phase2-release-gates.test.ts, package.json, .planning/debug/release-environment-orchestration.md]
