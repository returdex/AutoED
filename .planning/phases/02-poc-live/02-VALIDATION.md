---
phase: 2
slug: poc-live
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-01
---

# Phase 2 — Validation Strategy

> Phase 2 的反馈采样与 S/I/N/L 证据隔离契约。自动测试永远不能填写 live pass。

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.11 + Playwright Test 1.62.1 + native Vitest project |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `npm run typecheck && npm run test:unit -- --run` |
| **Full command** | `npm run typecheck && npm run test:unit -- --run && npm run test:integration -- --run && npm run test:ui && npm run test:native -- --run` |
| **Estimated runtime** | quick 依现有基线；full 由首次 Phase 2 运行实测记录，不预先承诺 |

## Sampling Rate

- 每个 task commit 后运行与该 task 最接近的单文件/单项目测试，并至少运行 quick command。
- 每个 plan wave 后运行 unit + integration；涉及 UI 时加 `test:ui`，涉及本机浏览器/进程时加 `test:native`。
- 发布 beta 前完整 automated suite 必须 green，并验证产物可获取与实际 manifest 身份。
- `$gsd-verify-work` 前再次运行完整 suite；live 结果仍需用户真实反馈。
- 不允许连续三个实现 task 没有自动验证。

## Per-Task Verification Map

具体 Plan/Task ID 在 PLAN.md 生成后补齐；以下是不可省略的覆盖槽位。

| Coverage slot | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Status |
|---|---|---|---|---|---|---|
| Source contracts | AUTH-01, SEC-02 | T2-01, T2-02 | 仅固定 source/action/origin；任意 URL/JS/selector/write 不可解析 | unit | `npm run test:unit -- --run` | ⬜ pending |
| Profile ownership | AUTH-04 | T2-04, T2-05 | 单持有者；未知/仍运行进程不回收；失租者停止请求/提交 | integration/native | `npm run test:integration -- --run && npm run test:native -- --run` | ⬜ pending |
| Probe/binding | AUTH-01, AUTH-03 | T2-03, T2-06 | 正面标志+origin+稳定身份；mismatch hard stop | unit/integration | `npm run test:unit -- --run && npm run test:integration -- --run` | ⬜ pending |
| Retry/retention | AUTH-03, AUTH-04 | T2-05, T2-06 | 最多三次；显式登出不重试；失败保留 last success | integration | `npm run test:integration -- --run` | ⬜ pending |
| Local UI privacy | AUTH-03, SEC-02 | T2-02, T2-07 | 完整身份仅 protected UI；401/403 清除；其他输出脱敏 | UI/integration | `npm run test:ui && npm run test:integration -- --run` | ⬜ pending |
| Evidence ledger | AUTH-02, UAT-01 | T2-08 | S/I/N/L 与 OS/source/scenario 不可串格 | unit/integration | `npm run test:unit -- --run && npm run test:integration -- --run` | ⬜ pending |
| Beta gate | UAT-01 | T2-08 | 可获取 beta 在人工场景前；真实版本和缺口明确 | integration/release | release-gate targeted tests | ⬜ pending |

## Wave 0 Requirements

现有 test projects 和脚本已存在，因此基础设施无需新建。Phase 2 首个实现 wave 必须先增加专用 fixture/harness 与测试文件，至少覆盖：

- source adapter contract/malicious page fixture
- profile ownership and crash-recovery fixture
- identity binding and state-machine unit tests
- source observation persistence/migration tests
- protected status-card privacy UI tests
- evidence receipt and platform-cell gate tests

这些测试文件必须先于对应生产行为或与其同 task 提交，不能在发布前才补。

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|---|---|---|---|
| 官方 Moodle 登录/MFA、随后 EdStem 自动只读探针 | AUTH-01, SEC-02 | 凭据/MFA 必须由用户输入，且共享 SSO 是待证假设 | beta 可获取后执行 checkpoint A；只回报 receipt code |
| 两来源关闭重开三次、Worker 重启、Codex 退出 | AUTH-02, AUTH-04 | 需要真实 Profile 与宿主生命周期 | checkpoint B，逐来源逐场景记录 |
| macOS 完整重启 | AUTH-02, AUTH-04 | synthetic 不能替代 OS 重启 | checkpoint C |
| 至少 24 小时无干预复查 | AUTH-02 | 时间事实无法加速或伪造 | checkpoint D 的 session-retention 部分 |
| 自然过期或用户显式退出后的 reauth | AUTH-02, AUTH-03 | 不得人为破坏 Cookie 或伪造过期 | D 后单独执行；未自然过期则用户主动退出一个来源 |
| Windows 11 全矩阵 | AUTH-02, AUTH-04, UAT-01 | 原生证据必须在 Windows 产生 | 当前 `not_run / human_needed`，后续用户补测 |

## Hard Gates

- 用户确认实际 official origins、账户/组织、一个课程和允许目的地前，不启动 live。
- beta 发布并从发布地址重新取得、验签和核对实际 build 前，不要求用户登录。
- 登录/MFA、更新、OS 重启、跨日等待均是 human-action；不得自动确认。
- `identity_mismatch`、越界 origin、Profile ownership 不明、敏感输出、发布不可获取任一出现即阻塞相关后续项。
- macOS pass 不得改变 Windows `not_run / human_needed`，也不得解除 Phase 3 硬门禁。

## Validation Sign-Off

- [ ] PLAN.md 的每个实现 task 都有 `<automated>` 验证或前置测试 fixture。
- [ ] 每个 threat 都映射到至少一个 negative test 和失败行为。
- [ ] 无 watch-mode flags；自动命令有界。
- [ ] 完整套件在目标 beta 构建上通过。
- [ ] 发布产物可获取、验签、实际 build 匹配。
- [ ] 用户真实完成 macOS A/B/C/D 与 reauth，逐项记录。
- [ ] Windows 保持未运行，直至独立 native/live 证据完成。

**Approval:** pending PLAN approval and later live feedback
