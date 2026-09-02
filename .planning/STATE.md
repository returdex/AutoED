---
gsd_state_version: 1.0
milestone: M1
milestone_name: milestone
status: executing
stopped_at: beta.34 invalidated after stale rehearsal/build identity drift; attestation binding fix and fresh R0/R1 are next
last_updated: "2026-09-02T09:35:00.000Z"
last_activity: 2026-09-02
progress:
  total_phases: 9
  completed_phases: 0
  total_plans: 55
  completed_plans: 32
  percent: 58
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-26); AGENTS.md governs hard gates.

**Core value:** 持续归档选定且获准保留的完整课程生命周期资料，让用户及获准模型完整读取固定版本内容，明确来源、历史与缺口。
**Current focus:** Preserve beta.31–beta.34 as immutable invalidated history; enforce exact rehearsal/build identity binding before a fresh R0/R1. All update/login/live/Phase 3 gates remain blocked.

## Current Position

Phase: 02 (poc-live) — EXECUTING
Plan: Post-02-14 repair returned to RELEASE-STABILIZATION R0 after beta.34 failed exact R3 identity binding; 19 of 41 have completion summaries
Status: beta.31 is immutable failed public history; beta.32, beta.33 and beta.34 are consumed locally and unpublished; no active candidate is assigned
Last activity: 2026-09-02

Plan progress: Phase 2 execution 19/41. Phase 1 remains 13/14 and is not marked complete; the approved macOS-first ordering exception does not clear Windows or Phase 3 gates.

## Performance Metrics

**Velocity:**

- Total plan summaries on disk: 32 (historical 02-38, 02-39 and 02-13 produced beta.31; its real update failed and corrective R0/R1 is complete)
- Average duration: N/A
- Total execution time: Not aggregated; see individual SUMMARY files

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 13 completed / 14 planned | Partial; human/native gaps remain | N/A |
| 2 | 19 summaries / 41 planned | In progress; beta.31 update-invalidated, R0/R1 repair passed, later candidate not assigned; live/Windows gates remain blocked | N/A |
| 3–8 | Not yet planned | Not started | N/A |

**Recent Trend:**

- Last 5 plan summaries: 02-37, 02-41, 02-38, 02-39, 02-13; active position is revised 02-38 R2 after the beta.33 runner repair and exact R0/R1 rehearsal
- Trend: N/A

| Phase 02 P01 | 9 min | 2 tasks | 6 files |
| Phase 02 P02 | 23min | 3 tasks | 6 files |
| Phase 02 P03 | 11min | 2 tasks | 3 files |
| Phase 02 P04 | 8min | 1 tasks | 3 files |
| Phase 02 P05 | 18min | 2 tasks | 3 files |
| Phase 02 P06 | 12min | 2 tasks | 5 files |
| Phase 02 P07 | 17min | 2 tasks | 8 files |
| Phase 02 P08 | 18min | 2 tasks | 8 files |
| Phase 02 P39 | 2h01min cumulative | 2 tasks | 2 files |
| Phase 02 P13 | 10min beta.31 completion | 2 tasks | 3 files |
| Phase 02 P38 corrective reruns | 2h25min cumulative | 2 tasks | 13 tracked files |

## Accumulated Context

### Decisions

Full decisions: PROJECT.md Key Decisions; acceptance rules: VALIDATION-STRATEGY.md.

- M1 本地单用户 macOS/Windows；SQLite+最小持久 Job+文件；Local Playwright 唯一真实 provider；无云服务/LLM Key/作业推理生成。
- 用户确认相关 PLAN 后可连续实现、自动测试修复、构建及 beta 发布；不扩批准范围。每次用户更新/官方登录/MFA/live UAT/新决策必须硬停止，不能自动填写批准或 pass。GSD auto_advance/_auto_chain_active 均 false。
- P1 最小提示词安装升级 beta；P2 双来源×原生双OS live 硬门禁；P3 实际 MCP 切片；P5 完整材料交付；P7 完整客户端；P8 全量交付恢复。安全/权限从首次相关操作即生效。
- M1 目标0.1.0已随本次用户确认生效，尚未发布；无 VERSION/tag。beta.N从1递增且不可覆盖；不按phase/commit升版。标准 PolyForm Noncommercial 1.0.0，商业另行授权。
- 初始化仅新仓库可写；未来批准的安装/测试计划可写明确选定的新产品运行/测试目录及受管依赖。旧 /Users/yifeng/Documents/AutoED（参考726884c）始终只读，不继承 validated 能力、不复制运行数据。Profile是敏感凭据存储，仓库外本机保护、不导出/备份/云同步；新旧安装完全隔离。
- [Phase 02]: Synthetic auth fixtures are structurally limited to S evidence and cannot accept live provenance overrides. — Prevents automated or fixture results from filling L cells.
- [Phase 02]: Phase 1 stays partial, Windows stays not_run/human_needed and Phase 3 stays blocked under the macOS-first ordering exception. — Plan 02-01 contract success is not native or live validation.
- [Phase 02]: Profile ownership retains a monotonic fence after confirmed release; lease expiry never proves exit.
- [Phase 02]: Native N evidence is fenced to native.<platform>; integration producers cannot claim N or L.
- [Phase 02]: Active ownerless Profile reservations project as strict PROFILE_IN_USE/human_needed without fabricated process identity. — This preserves single-holder evidence before attach.
- [Phase 02]: Profile cleanup requires fresh exact OS absence; lease expiry, PID reuse, control failure and higher fences preserve the holder record. — Unknown ownership never grants reclaim authority.
- [Phase 02]: Identity mismatch preserves the prior confirmed binding and remains blocked until both sources are positively reobserved and explicitly confirmed. — Prevents automatic account switching or silent overwrite.
- [Phase 02]: Only natural reauthentication and explicitly temporary network failures receive fixed 0, 5000 and 30000 millisecond recovery schedules. — Keeps parser, permission, origin, interaction, logout and identity failures fail closed.
- [Phase 02]: Course eligibility requires two currently authenticated sources and a confirmed binding; the reducer emits no course-read effect. — Keeps authentication proof separate from source content access.
- [Phase 02]: Headed login authority is consumed only after cancellation and maintenance-generation admission, with exact receipt/source/config binding.
- [Phase 02]: Every browser operation and intercepted request is fenced before and after work by cancellation, maintenance generation and complete Profile owner identity.
- [Phase 02]: Local Playwright exposes only bounded origin/string projections; close releases Profile ownership only after confirmed process exit.
- [Phase 02]: Browser sessions mint exact-owner guards; source adapters cannot supply or replace browser ownership identity. — Keeps ownership enforcement inside the attached session and fails closed before any bounded read.
- [Phase 02]: Source descriptors remain fixed and source-specific; missing or ambiguous visible markers fail as parser drift with no API fallback. — Prevents URL reachability, selector injection, arbitrary browser control or guessed source support from becoming authentication evidence.
- [Phase 02]: Plan 02-06 automated fixtures are synthetic S/I evidence only; AUTH-01, AUTH-03 and SEC-02 remain Pending. — Preserves native/live, Windows and Phase 3 hard gates without treating fixture success as real-source validation.
- [Phase 02]: Durable auth recovery is anchored to one persisted recoveryStartedAt and consumes only reducer-approved immediate/5000/30000 effects. — Process restart cannot reset attempts or create a fourth probe.
- [Phase 02]: Auth probe authority is checked before source access, after probe completion, and again as the identical SQL transition predicate. — Stale cancel/lease/generation/fence races cannot publish observations or follow-ups.
- [Phase 02]: Production auth work accepts only sealed adapters; direct SourceProbePort injection remains explicit synthetic S/I composition. — Automated jobs cannot become live evidence or arbitrary browser authority.
- [Phase 02]: Full source identity and canonical origin exist only in the paired local-UI protected projection; bearer/model/receipt outputs are rebuilt from redacted allowlists. — Prevents protected identity from reaching CLI, MCP, logs, diagnostics or receipts.
- [Phase 02]: Ordinary login action IDs are restart-revoked, single-use and bound to the authenticated browser session, source, approved config and runtime generation; they grant no evidence authority. — Prevents forged, cross-session or replayed login completion from authorizing probes or live receipts.
- [Phase 02]: Auth mutations require paired cookie principal, exact same-origin and CSRF together; CLI and MCP remain auth status/receipt read-only. — Preserves one local control plane without bearer mutation authority.
- [Phase 02]: beta.21 through beta.31 are permanently consumed and invalidated; beta.31 is published and availability-proven history but failed the real update gate with `ENTRYPOINT_MISMATCH`. — All public identities remain immutable, while no invalidated identity can be retried or reused.
- [Phase 02]: Historical signed beta.24/beta.25/beta.29/beta.30 used one stable signed install-prompt core plus an external exact-target binding, but those bytes cannot be reused after invalidation. — A fresh beta.31 assembly must preserve the same self-reference-safe contract.
- [Phase 02]: Historical Plan 02-39 beta.30 local signing leaves Windows native and live evidence not_run/human_needed and Phase 3 blocked; beta.31 requires an entirely fresh assembly/signing rerun. — AGENTS.md forbids treating local or synthetic verification as real native/live evidence.
- [Phase 02]: Published beta.25 remains immutable public history but is not an active update candidate. — The update-freshness correction changed selected source; no tag, release or asset was overwritten or deleted.
- [Phase 02]: Availability `checkedAt` is a separately validated volatile observation: it must be valid, in-window and strictly later; every immutable identity/asset field must remain exact. — Prevents stale/equal observations without misclassifying legitimate fresh refetch time as identity drift.
- [Phase 02]: beta.31 complete quality evidence is automated distribution evidence only; Windows native/live remain not_run/human_needed and Phase 3 remains blocked. — Quality and publication cannot substitute for user update, native runtime or L evidence.
- [Phase 02]: Published beta.29 is permanently availability-unproven because its first and only anonymous verifier attempt produced no receipt. — Release 380689537, its tag and both assets remain untouched historical data; same-version retry, reuse or overwrite is forbidden.
- [Phase 02]: Published beta.30 is permanently availability-unproven because its first and only anonymous verifier attempt produced no receipt. — Release 380716930, its tag and both assets remain untouched historical data; same-version retry, reuse or overwrite is forbidden.
- [Phase 02]: A bounded anonymous metadata/HEAD readiness gate precedes the one full byte/hash/signature/closure verifier attempt. — Readiness makes no availability claim, fails closed on mismatch/timeout and never authorizes retrying a consumed public identity.
- [Phase 02]: Fresh beta.31 archives replace invalidated beta.30 as the sole active Plan 02-39 output; historical public bytes remain untouched and unusable for update. — The new identity was completely rebuilt and protected-key signed rather than relabelled.
- [Phase 02]: beta.31 release 380751233 passed bounded anonymous readiness and its first full-byte verifier, binding asset IDs 539997596/539997598 to exact hashes, signatures, fingerprint, license, prompt and 16-member/27-capability closure. — Publication is distribution evidence only; update, Windows native and live gates remain pending.
- [Release]: Every candidate after beta.31 must pass an exact-source unnumbered stabilization rehearsal before beta.N assignment; failure classes determine whether a candidate is consumed, while public objects remain permanently immutable. — Prevents internal test/runner attempts from becoming prerelease-number churn and keeps assembly/publication plans output-only.
- [Phase 02]: Human update execution is isolated from the repository controller: the user runs the exact verified prompt in a same-host/account local projectless Codex task, personally controls OS/restart actions, and returns sanitized output; an AutoED project task's inherited-gate refusal is UPDATE_TASK_CONTEXT_INVALID. — Prevents the controller gate from deadlocking the approved prompt-driven updater without allowing self-approval or school access.
- [Phase 02]: beta.31's real macOS update is a `HUMAN_PRODUCT` failure: the old beta.19 runtime stayed active because the released archives lacked a bound runnable updater graph. — API/Worker health from the old build cannot satisfy exact-build, entrypoint, cleanup or paired-UI requirements.
- [Release]: The corrective R0/R1 rehearsal passed only after binding 8 assets per platform and exact updater commands, adding protected synthetic-process ownership ledgers, bounded process/listener/mount observations, and switching capability rehearsal from tar to exact-member ZIP to preserve legitimate long Chrome helper paths. — The current sanitized attestation is intentionally kept uncommitted until R2 selection; it assigns no beta number.
- [Release]: beta.32 is permanently consumed and unpublished after R3 exposed that selection targeted rehearsed commit `fe54a6e…` while the active checkout had advanced to planning commit `7372fe5…`. — Candidate writing must require exact current commit/tree/source; changing a selected identity in place is forbidden.
- [Release]: beta.33 is permanently consumed and unpublished after an initial mount-observation failure, one complete pass, and a recurrent recovery/process-observation failure in the required second complete pass. — POST_TRANSIENT retention requires two consecutive complete passes; recurrence invalidates without publishing.
- [Release]: beta.34 is permanently consumed and unpublished after R3 detected a stale rehearsal build ID (`STALE_REHEARSAL_BUILD_ID`) following a planning commit; the attestation writer now verifies the on-disk identity and source hash before writing. — A fresh unnumbered R0/R1 is required before beta.35.

### Pending Todos

- TEXT-01、TEXT-02、SEARCH-01、BUNDLE-01、OPS-01 已随全部51项需求获批，仍未实现/验证。
- 01-01至01-13已完成；已发布beta由returdex提供并通过相应匿名资产验签/hash/闭包验证。2026-08-31用户确认beta.19安装/清理、Codex重载MCP、持久echo、退出Codex后API/Worker独立存活、状态UI、包内三项诊断，以及新标准账户首次安装/受管停服通过；主账户服务已恢复健康。测试账户发现宿主Node26且没有OS授权提示，因此no-Node和真实拒绝仍未建立；Windows按用户要求暂缓并保持`not_run / human_needed`。

### Blockers/Concerns

- 01-09备份/恢复按[SQLite backup](https://www.sqlite.org/backup.html)与[WAL持久状态](https://www.sqlite.org/wal.html#the_wal_file)：完成backup API后才验证一致快照，恢复前证明所有连接/拥有进程退出并正确收束WAL，不直接copy运行主DB或任意删WAL。本地better-sqlite3 13.0.3 backup会允许既有destination，须新建受管目标、前后核对gate/write_generation与完整性。最终projection须处理exit后operationId=null/gen++及严格单调非未来checkedAt，不能吞掉写入失败。
- 01-08解包须保留官方macOS headed浏览器的合法Framework links。根于2026-08-27只读核对Playwright固定151.0.7922.34 mac-arm64官方ZIP（cdn.playwright.dev→storage.googleapis.com）：187406357bytes、647members、central143185bytes；5个link的local data长度/CRC已核，Resources/Libraries/Helpers/Framework→Versions/Current对应项，Current→151.0.7922.34。不是完整archive hash/安装/运行证据。清单显式绑定相对target并解析链接图，拒绝越界/循环/悬空/经link写文件；Windows拒绝links。不能展开成regular后未经核验声称保留代码签名。
- 初始化已完成，Phase 1执行中；01-01至01-12已有166项U/I/macOS原生+10项Chromium UI及类型检查/构建/HEAD扫描证据，production trust已建立但尚无发布beta；51项阶段级需求仍 Pending，Windows native仍not_run。
- 01-08只完成验签/安全引导/确认范围/初始staging与私有入口，不是安装升级完成。生产信任仍UNESTABLISHED；09须接真正启动、journal、清理与恢复。active hash、Node/resolver/launcher pins作为同一更新集；Windows MCP预览采用固定PowerShell协议，OS argv可显示launcher.mjs，父退出不代表Node子退出，原生Windows留14验收。
- 01-06已接实际构建manifest、API安装身份、短期selfcheck凭据与发token前所有权校验；08/09须由真正verifier建立发行签名证据，journal记录预解析/离线失败，不能将build_manifest改名冒充验签。01-09从真实inventory填写previousInstallation；01-10补实际平台/依赖诊断，UI现明确未验证。
- 安装自检新spawn的MCP不能证明当前Codex中长期运行的MCP已经重载。01-09/10/14须检查受管旧入口与实际客户端版本；若宿主仍持有旧客户端且无法安全自动重载，明确human_needed/cleanup_pending并给出重载步骤，不能把新子进程自检冒充宿主实际更新完成。
- 01-09实际安装接线须覆盖installer位于bootstrap staging、API位于program/build的不同目录：06普通client discovery锚定自身编译树API路径，独立installer不能直接假定同树。旧/新API控制须从已验inventory建立仅installer内部可信入口，或运行目标包内受控controller；MCP不得接受任意expectedEntry。测试不能只把所有组件放在同一fixture编译树。
- 精确开发依赖、SQLite任务、原生保护、认证API与独立Worker已有本机证据；实际CLI/MCP已验证，Windows原生运行与安装升级仍待后续验证；P2前确认实际来源/账户/课程/access plan/目的地。维护退出后的API/Worker必须新代重启和再次探测，不能直接复用候选自检结果。
- P2所有必需真实场景未跑：官方登录、Profile重开三次、Worker/系统重启、Codex退出、至少24小时复查、退出/过期reauth和实际账户绑定。换号/identity_mismatch/网络/403/parser反例另记必需S/I，不故意制造学校错误、不要求未授权第二账号，不拿S/I填L；缺失/失败阻止依赖，Windows不能用WSL代替。
- 每次人工UAT先自动检查、发布并核对可获取beta，再给精确更新/测试步骤，等用户在Codex手动更新反馈。P1仅检查安装/升级；官方登录仅P2及以后按场景需要请求。发布成功本身不是live通过。
- 2026-09-02 首次 beta.31 更新任务因附属于 AutoED project 而继承 controller gate，返回 `human_needed/not_observed`；这被分类为 `UPDATE_TASK_CONTEXT_INVALID`，没有执行安装、没有产品失败、没有新 beta。重试必须使用同一主机/账户的 local projectless Codex task 和完全相同的 verified prompt。
- 2026-09-02 随后的真实 projectless macOS 更新返回 `ENTRYPOINT_MISMATCH`：beta.19 API/Worker 仍健康，但 build/entrypoints mismatch，cleanup 与 paired UI 未观察；beta.31 因此按 `HUMAN_PRODUCT` 永久失效。R0/R1 修复演练已通过，尚未分配新 beta；02-14、登录、Windows 与 Phase 3 继续阻塞。
- 2026-09-03 beta.34 本地选择后，R3 发现选择携带的演练 build ID 与当前精确构建不一致（`STALE_REHEARSAL_BUILD_ID`）；未签名、未发布、未安装、未登录。已永久消耗 beta.34，并加入 attestation writer 的 on-disk identity/source hash 阻断与回归测试；须重新完成无编号 R0/R1 后才能选择 beta.35。
- 本次发布前默认与受保护隔离gh配置均观测为returdex；Plan 02-13仍只使用受保护隔离配置并独立核对repo-local author/committer、repository ID与origin。后续远程操作仍须重复隔离身份检查，绝不能假定默认账号或回退到ywan1303。

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260831-ho4 | Record beta.19 macOS status UI human UAT pass while preserving Windows as not_run/human_needed | 2026-08-31 | 61adf70 |  | [260831-ho4-record-beta-19-macos-status-ui-human-uat](./quick/260831-ho4-record-beta-19-macos-status-ui-human-uat/) |
| 260831-hru | Record beta.19 packaged macOS native diagnostics pass with correct synthetic evidence boundary | 2026-08-31 | 86eb22b |  | [260831-hru-record-beta-19-packaged-macos-native-dia](./quick/260831-hru-record-beta-19-packaged-macos-native-dia/) |
| 260831-o7k | Record beta.19 separate macOS standard-account install UAT and restore primary service with honest no-Node and authorization boundaries | 2026-08-31 | eae6eaa |  | [260831-o7k-record-beta-19-separate-macos-standard-a](./quick/260831-o7k-record-beta-19-separate-macos-standard-a/) |
| 260901-5lh | Synchronize roadmap with user-approved macOS-first Phase 2 sequencing exception while preserving Windows and Phase 3 gates | 2026-09-01 | f41c535 |  | [260901-5lh-synchronize-roadmap-with-user-approved-m](./quick/260901-5lh-synchronize-roadmap-with-user-approved-m/) |
| 260902-lse | Establish and enforce post-beta.31 release stabilization policy | 2026-09-02 | 0109a29 | Verified | [260902-lse-validate-establish-and-enforce-a-post-be](./quick/260902-lse-validate-establish-and-enforce-a-post-be/) |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| None | 无已批准后续里程碑；五项细化需求已纳入M1，未延期 | N/A | - |

## Session Continuity

Last session: 2026-09-03T00:06:25+10:00
Stopped at: beta.33 runner repair and exact unnumbered R0/R1 rehearsal complete; remain before R2 candidate assignment
Resume file: None
Forensic report: `.planning/forensics/report-20260902-051348.md`; its pre-update findings remain historical context.
Resolved debug: `.planning/debug/beta31-entrypoint-mismatch.md`, `.planning/debug/beta33-runner-instability.md`; beta.31 is update-invalidated and the repaired release contract passed unnumbered R0/R1 rehearsal.
