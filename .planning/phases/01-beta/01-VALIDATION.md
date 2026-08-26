---
phase: 1
slug: beta
status: reviewed_pending_user_plan_approval
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-27
---

# Phase 1 — Validation Strategy

规划期验证契约；所有产品测试均为not_run，没有测试基础设施。计划质量签核不代表代码、原生平台或人工UAT通过。主基线为 `.planning/VALIDATION-STRATEGY.md`、`01-CONTEXT.md` 与 `01-UI-SPEC.md`。

## Test Infrastructure

| Property | Planned value |
|---|---|
| Framework | Vitest4.1.11 + Playwright Test1.62.1，准确依赖须批准后复核锁定 |
| Config | vitest.config.ts / playwright.config.ts — bootstrap plan creates |
| Quick run | npm run test:unit -- --run |
| Full suite | npm run typecheck && npm run test:unit -- --run && npm run test:integration -- --run && npm run test:ui |
| Native suite | npm run test:native -- --run，必须记录实际OS/CPU、交付版本 |
| Runtime | 必须使用经核对的受管Node24，不能在宿主Node26运行后声称兼容 |
| Timing | quick目标30秒；原生安装/下载允许较长，实测后记录，当前无耗时证据 |

## Sampling Rate

- 每个自动任务完成后运行该任务定向验证；每次任务提交前至少相关quick检查。
- 每wave完成跑完整适用S/I/UI；原生检查依据明确测试设备/根目录另记N。
- 不允许连续三个自动任务无自动验证。新增测试命令须在bootstrap或前置任务真实创建；禁止把不存在的脚本、空测试或全skip当通过。
- quick超时预算目标30秒，完整故障注入/安装耗时单独记录，不为满足延迟指标删关键验证。
- 发布前完成适用自动检查；人工测试必须在可获取beta发布之后。N人工未跑保持human_needed/not_run，不允许据此声称Phase完成。

## Requirements Verification Map (planning baseline)

| Requirement | Evidence / secure behavior | Proposed automated command | File exists | Status |
|---|---|---|---|---|
| ARCH-01 | I/N 独立API/Worker、客户端退出后存活 | npm run test:integration -- --run tests/integration/process-lifecycle.test.ts | no — bootstrap/assigned task | not_run |
| ARCH-02 | S/I import边界与真实stdio→HTTP | npm run test:unit -- --run tests/unit/import-boundaries.test.ts; npm run test:integration -- --run tests/integration/client-wiring.test.ts | no | not_run |
| PLAT-01 | I/N 原生运行、SQLite/source ID/browser探针 | npm run test:native -- --run tests/native/platform-probes.test.ts | no | not_run |
| SEC-01 | S/I/N auth/Host/Origin/CSRF/scope、OS秘密库拒绝不降级 | npm run test:integration -- --run tests/integration/local-auth.test.ts; npm run test:native -- --run tests/native/secret-store.test.ts | no | not_run |
| JOB-01 | S/I/N 竞争、失租、幂等、取消、恢复 | npm run test:integration -- --run tests/integration/job-recovery.test.ts | no | not_run |
| DIST-01 | S/I/N 实际身份与新能力、旧入口拒绝 | npm run test:integration -- --run tests/integration/build-identity.test.ts | no | not_run |
| DIST-02 | I/N 两beta升级、回滚、所有权与清理 | npm run test:native -- --run tests/native/install-upgrade.test.ts | no | not_run |
| DIST-03 | S/I/N 账号/同名冲突/验签/公开获取/去敏 | npm run test:integration -- --run tests/integration/release-gates.test.ts | no | not_run |

## Per-Task Verification Map

14 plans / 31 tasks / 12 waves；所有产品文件当前不存在，全部not_run。01-01-1先创建受管runtime与npm scripts，01-01-2创建测试configs，表列测试由所属task先创建再运行。自动验证不等同人工批准；12为发布权限前置，14必须13公开可获取beta通过后才请求用户更新。命令中的runtime wrapper由01-01-1创建，严禁宿主Node26冒充产品Node24。

| Task | Wave | Requirements | Threat IDs | Secure behavior / observable check | Automated command | File exists / creator | Evidence status |
|---|---|---|---|---|---|---|---|
| 01-01-1 | 1 | PLAT-01,ARCH-02,DIST-01 | T-01-01,T-01-02 | 锁定受管Node与唯一构建配置 | `node scripts/dev/runtime.mjs --check` | no — `package.json` (creator this task);工具见INDEX<br>`package-lock.json` (creator this task);工具见INDEX<br>`tsconfig.json` (creator this task);工具见INDEX<br>`scripts/dev/runtime.mjs` (creator this task);工具见INDEX<br>`scripts/build/build.mjs` (creator this task);工具见INDEX | not_run |
| 01-01-2 | 1 | PLAT-01,ARCH-02,DIST-01 | T-01-01,T-01-02 | 建立真实测试设施与安全临时根 | `node scripts/dev/runtime.mjs npm run test:unit -- --run tests/unit/bootstrap.test.ts` | no — `tests/unit/bootstrap.test.ts` (creator 01-01-2) | not_run |
| 01-01-3 | 1 | PLAT-01,ARCH-02,DIST-01 | T-01-01,T-01-02 | 定义应用端口、状态与编译身份契约 | `node scripts/dev/runtime.mjs npm run test:unit -- --run tests/unit/contracts.test.ts tests/unit/import-boundaries.test.ts` | no — `tests/unit/contracts.test.ts` (creator 01-01-3)<br>`tests/unit/import-boundaries.test.ts` (creator 01-01-3) | not_run |
| 01-02-1 | 2 | JOB-01,ARCH-02 | T-01-03 | 建立schema与幂等入队查询 | `node scripts/dev/runtime.mjs npm run test:integration -- --run tests/integration/job-storage.test.ts` | no — `tests/integration/job-storage.test.ts` (creator 01-02-1) | not_run |
| 01-02-2 | 2 | JOB-01,ARCH-02 | T-01-03 | 实现领取、fence、取消与故障恢复 | `node scripts/dev/runtime.mjs npm run test:integration -- --run tests/integration/job-recovery.test.ts && node scripts/dev/runtime.mjs npm run test:unit -- --run tests/unit/job-state.test.ts` | no — `tests/integration/job-recovery.test.ts` (creator 01-02-2)<br>`tests/unit/job-state.test.ts` (creator 01-02-2) | not_run |
| 01-03-1 | 2 | SEC-01,PLAT-01 | T-01-04,T-01-05 | 受管根与原生权限适配器 | `node scripts/dev/runtime.mjs npm run test:native -- --run tests/native/platform-probes.test.ts` | no — `tests/native/platform-probes.test.ts` (creator 01-03-1) | not_run |
| 01-03-2 | 2 | SEC-01,PLAT-01 | T-01-04,T-01-05 | OS凭据库与安装身份初始化 | `node scripts/dev/runtime.mjs npm run test:native -- --run tests/native/secret-store.test.ts && node scripts/dev/runtime.mjs npm run test:unit -- --run tests/unit/credential-redaction.test.ts` | no — `tests/native/secret-store.test.ts` (creator 01-03-2)<br>`tests/unit/credential-redaction.test.ts` (creator 01-03-2) | not_run |
| 01-04-1 | 3 | SEC-01,ARCH-02,JOB-01 | T-01-06,T-01-07 | 接线受认证API与应用策略 | `node scripts/dev/runtime.mjs npm run test:integration -- --run tests/integration/local-auth.test.ts` | no — `tests/integration/local-auth.test.ts` (creator 01-04-1) | not_run |
| 01-04-2 | 3 | SEC-01,ARCH-02,JOB-01 | T-01-06,T-01-07 | 实现一次性显式配对与会话撤销 | `node scripts/dev/runtime.mjs npm run test:integration -- --run tests/integration/pairing.test.ts && node scripts/dev/runtime.mjs npm run test:unit -- --run tests/unit/output-policy.test.ts` | no — `tests/integration/pairing.test.ts` (creator 01-04-2)<br>`tests/unit/output-policy.test.ts` (creator 01-04-2) | not_run |
| 01-05-1 | 4 | ARCH-01,JOB-01,DIST-01 | T-01-08,T-01-09 | Worker入口、心跳和确定性synthetic功能 | `node scripts/dev/runtime.mjs npm run test:integration -- --run tests/integration/worker.test.ts` | no — `tests/integration/worker.test.ts` (creator 01-05-1) | not_run |
| 01-05-2 | 4 | ARCH-01,JOB-01,DIST-01 | T-01-08,T-01-09 | 受管进程监督与独立生命周期 | `node scripts/dev/runtime.mjs npm run test:integration -- --run tests/integration/process-lifecycle.test.ts && node scripts/dev/runtime.mjs npm run test:native -- --run tests/native/process-ownership.test.ts` | no — `tests/integration/process-lifecycle.test.ts` (creator 01-05-2)<br>`tests/native/process-ownership.test.ts` (creator 01-05-2) | not_run |
| 01-06-1 | 5 | ARCH-02,DIST-01,SEC-01 | T-01-10 | CLI与共享HTTP客户端 | `node scripts/dev/runtime.mjs npm run test:integration -- --run tests/integration/cli.test.ts` | no — `tests/integration/cli.test.ts` (creator 01-06-1) | not_run |
| 01-06-2 | 5 | ARCH-02,DIST-01,SEC-01 | T-01-10 | stdio MCP与跨组件真实自检 | `node scripts/dev/runtime.mjs npm run test:integration -- --run tests/integration/client-wiring.test.ts tests/integration/build-identity.test.ts` | no — `tests/integration/client-wiring.test.ts` (creator 01-06-2)<br>`tests/integration/build-identity.test.ts` (creator 01-06-2) | not_run |
| 01-07-1 | 4 | DIST-01,SEC-01,ARCH-01 | T-01-11 | 注册API静态入口及浏览器构建接线 | `node scripts/dev/runtime.mjs npm run test:integration -- --run tests/integration/static-assets.test.ts` | no — `tests/integration/static-assets.test.ts` (creator 01-07-1) | not_run |
| 01-07-2 | 4 | DIST-01,SEC-01,ARCH-01 | T-01-11 | 只读状态页与完整状态映射 | `node scripts/dev/runtime.mjs npm run test:ui -- tests/ui/status.spec.ts` | no — `tests/ui/status.spec.ts` (creator 01-07-2) | not_run |
| 01-07-3 | 4 | DIST-01,SEC-01,ARCH-01 | T-01-11 | 键盘、窄屏与统一反馈投影 | `node scripts/dev/runtime.mjs npm run test:unit -- --run tests/unit/presentation.test.ts && node scripts/dev/runtime.mjs npm run test:ui -- tests/ui/accessibility.spec.ts` | no — `tests/unit/presentation.test.ts` (creator 01-07-3)<br>`tests/ui/accessibility.spec.ts` (creator 01-07-3) | not_run |
| 01-08-1 | 6 | DIST-02,PLAT-01,SEC-01 | T-01-12,T-01-13 | 建立安装验签实现及合成签名测试支持 | `node scripts/dev/runtime.mjs npm run test:integration -- --run tests/integration/manifest-verification.test.ts` | no — `tests/integration/manifest-verification.test.ts` (creator 01-08-1) | not_run |
| 01-08-2 | 6 | DIST-02,PLAT-01,SEC-01 | T-01-12,T-01-13 | 无Node bootstrap、受管下载与信任检查 | `node scripts/dev/runtime.mjs npm run test:integration -- --run tests/integration/bootstrap.test.ts` | no — `tests/integration/bootstrap.test.ts` (creator 01-08-2) | not_run |
| 01-08-3 | 6 | DIST-02,PLAT-01,SEC-01 | T-01-12,T-01-13 | 预览、确认绑定与稳定启动入口 | `node scripts/dev/runtime.mjs npm run test:integration -- --run tests/integration/install-preview.test.ts` | no — `tests/integration/install-preview.test.ts` (creator 01-08-3) | not_run |
| 01-09-1 | 7 | DIST-02,DIST-01,JOB-01 | T-01-14,T-01-15 | 持久操作journal与维护激活事务 | `node scripts/dev/runtime.mjs npm run test:integration -- --run tests/integration/upgrade-journal.test.ts` | no — `tests/integration/upgrade-journal.test.ts` (creator 01-09-1) | not_run |
| 01-09-2 | 7 | DIST-02,DIST-01,JOB-01 | T-01-14,T-01-15 | 安全恢复判据与所有权清理 | `node scripts/dev/runtime.mjs npm run test:integration -- --run tests/integration/upgrade-recovery.test.ts tests/integration/managed-cleanup.test.ts` | no — `tests/integration/upgrade-recovery.test.ts` (creator 01-09-2)<br>`tests/integration/managed-cleanup.test.ts` (creator 01-09-2) | not_run |
| 01-10-1 | 8 | PLAT-01,DIST-01,DIST-02,ARCH-01,SEC-01,JOB-01 | T-01-16,T-01-17 | 构建可审计mac/Windows交付目录 | `node scripts/dev/runtime.mjs npm run test:integration -- --run tests/integration/artifact-assembly.test.ts` | no — `tests/integration/artifact-assembly.test.ts` (creator 01-10-1) | not_run |
| 01-10-2 | 8 | PLAT-01,DIST-01,DIST-02,ARCH-01,SEC-01,JOB-01 | T-01-16,T-01-17 | 自动双构建升级与原生故障矩阵 | `node scripts/dev/runtime.mjs npm run test:integration -- --run tests/integration/two-build-upgrade.test.ts && node scripts/dev/runtime.mjs npm run test:native -- --run tests/native/install-upgrade.test.ts` | no — `tests/native/install-upgrade.test.ts` (creator 01-10-2)<br>`tests/integration/two-build-upgrade.test.ts` (creator 01-10-2) | not_run |
| 01-11-1 | 9 | DIST-03,DIST-01,SEC-01 | T-01-18,T-01-19 | 签名与独立首次信任工具 | `node scripts/dev/runtime.mjs npm run test:integration -- --run tests/integration/release-trust.test.ts` | no — `tests/integration/release-trust.test.ts` (creator 01-11-1) | not_run |
| 01-11-2 | 9 | DIST-03,DIST-01,SEC-01 | T-01-18,T-01-19 | 发布预检、去敏与获取验证 | `node scripts/dev/runtime.mjs npm run test:integration -- --run tests/integration/release-gates.test.ts` | no — `tests/integration/release-gates.test.ts` (creator 01-11-2) | not_run |
| 01-12-1 | 10 | DIST-03,SEC-01 | T-01-20 | 确认本机发布密钥及首次信任作用域；人工硬门禁 | `node scripts/dev/runtime.mjs node scripts/release/trust.mjs check-approval --receipt release/approval.json` | no — 前置自动工具11创建；本task人工证据文件尚不存在 | not_run / human_needed |
| 01-12-2 | 10 | DIST-03,SEC-01 | T-01-20 | 本机授权、公开指纹复核与隔离returdex认证；人工硬门禁 | `node scripts/dev/runtime.mjs node scripts/release/trust.mjs selfcheck --public release/trust-root.json && node scripts/dev/runtime.mjs node scripts/release/preflight.mjs --identity-only` | no — 前置自动工具11创建；本task人工证据文件尚不存在 | not_run / human_needed |
| 01-13-1 | 11 | DIST-03,DIST-02,DIST-01,PLAT-01 | T-01-21 | 构建签名产物与版本绑定安装说明 | `node scripts/dev/runtime.mjs node scripts/build/assemble.mjs --release-pair && node scripts/dev/runtime.mjs node scripts/release/preflight.mjs --artifacts release/beta-artifacts.json` | no — `release/beta-artifacts.json` (creator this task);工具见INDEX<br>`release/install-prompts.md` (creator this task);工具见INDEX | not_run |
| 01-13-2 | 11 | DIST-03,DIST-02,DIST-01,PLAT-01 | T-01-21 | 正确身份创建/发布并匿名重新获取 | `node scripts/dev/runtime.mjs node scripts/release/publish.mjs --pair release/beta-artifacts.json && node scripts/dev/runtime.mjs node scripts/release/verify-availability.mjs --pair release/beta-artifacts.json --out release/availability.json` | no — `release/publication.json` (creator this task);工具见INDEX<br>`release/availability.json` (creator this task);工具见INDEX | not_run |
| 01-14-1 | 12 | ARCH-01,PLAT-01,SEC-01,JOB-01,DIST-01,DIST-02,DIST-03 | T-01-22 | macOS发布版安装、升级与退出Codex验收；人工硬门禁 | `node scripts/dev/runtime.mjs node scripts/release/verify-availability.mjs --pair release/beta-artifacts.json --out release/availability.json` | no — 前置自动工具11创建；本task人工证据文件尚不存在 | not_run / human_needed |
| 01-14-2 | 12 | ARCH-01,PLAT-01,SEC-01,JOB-01,DIST-01,DIST-02,DIST-03 | T-01-22 | Windows11发布版与双平台证据合并门禁；人工硬门禁 | `node scripts/dev/runtime.mjs node scripts/release/verify-availability.mjs --pair release/beta-artifacts.json --out release/availability.json` | no — 前置自动工具11创建；本task人工证据文件尚不存在 | not_run / human_needed |

### Native and release command provenance

- `scripts/test/native-report.mjs`由01-10-2先创建；01-10-1只建立assembler并用临时fixture验证，01-10-2再调用它装配完整A/B并复制runner到`diagnostics/native-report.mjs`，13验hash并发布；14使用安装的受管Node与该脚本，不要求源码/npm/Vitest。合成scenario覆盖jobs/fence/取消、OSpermissions、真实A/B恢复，所有根必须预览批准。
- `scripts/release/trust.mjs`、`preflight.mjs`、`publish.mjs`、`verify-availability.mjs`由01-11创建；12只在人类授权后执行，13签名发布，14重新核公开可获取。当前这些脚本都尚不存在，不称检查已通过。
- 10本地A/B签名测试使用08已创建的synthetic-sign及真实verify-manifest，不依赖未来真实密钥，避免发布工具循环。fixturekey不能发布、生产无跳过验证开关。
- 本机N自动测试仅算实测OS/arch；无Windows执行环境记录not_run，不用跨装配静态检查或WSL填N。用户Windows11架构仍待安装preflight。
- 14每个人工任务都先重新验证两beta的公开可获取/签名/hash，再给用户精确更新提示词；用户反馈前保持human_needed。全部学校L本阶段不适用，不请求登录。


## Wave 0 Requirements

- [ ] Exact package manifest/scripts, dependency lock and managed runtime invocation in first plan.
- [ ] Vitest/Playwright configs and synthetic temp-root/process helpers; no school/legacy fixtures.
- [ ] Each future test file explicitly created by its assigned task, initial failing behavior exercised before implementation; no permanent placeholder pass.
- [ ] Seed A/B synthetic builds and fault-injection seams for jobs, version identity and installer journal; include native artifact verification without running wrong-OS code.
- [ ] Shared safe cleanup helpers remove only owned temporary roots/processes; keyring tests use synthetic canaries and never print secrets.

## Manual-Only Verifications

| Behavior | Requirement | Why manual | Gate and instructions |
|---|---|---|---|
| Actual Codex exit and service survival | ARCH-01, DIST-02 | Real user host/process lifetime | Publish obtainable beta first; user installs, closes Codex, independently checks API/Worker via installed entrypoints |
| Clean native installation and update A→B | PLAT-01, DIST-01/02 | User Windows11 and declared macOS | Verify artifact availability, provide exact prompts, user updates and reports actual build/OS/arch; unknown hardware remains unknown |
| OS credential/access denial and prompts | SEC-01 | Keychain/Credential Manager interaction | User handles OS prompts; no passwords/tokens requested in chat; locked/denied fails closed |
| Keyboard, zoom, narrow layout, status accuracy | DIST-01/02, SEC-01 | Rendered native browser interaction | Published beta; 320px/200%/keyboard, mismatch/cleanup/rollback/401 versus stale scenarios |

Signing-key creation, GitHub authentication correction and first repository ownership checks are release prerequisites, not native UAT. They may require an earlier human authorization gate, but cannot be bypassed or disguised as product tests. Never create cloud resources or alter global accounts silently.

## Validation Sign-Off

- [x] Every task has automatic verification or explicit bootstrap dependency/human gate.
- [x] No three consecutive automatic tasks without verification.
- [x] Every missing test/config is assigned a creation task before its first use.
- [x] No watch-mode validation or fictitious pass/latency evidence.
- [x] All eight requirements and sixteen decisions trace to tasks and threats.

**Planning review:** 2026-08-27 independent checker: Nyquist planning coverage PASS; overall 0 blockers and 3 non-blocking scope warnings (01/07/08). See 01-PLAN-REVIEW.md.

**User approval:** pending. `nyquist_compliant: true` describes only this validation plan; `wave_0_complete: false` remains unchanged. No infrastructure, product test, native execution or UAT has run, and no checkbox above asserts otherwise.
