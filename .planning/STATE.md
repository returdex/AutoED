---
gsd_state_version: 1.0
milestone: M1
milestone_name: milestone
status: executing
stopped_at: Completed 02-06-PLAN.md
last_updated: "2026-09-01T05:06:15.196Z"
last_activity: 2026-09-01
progress:
  total_phases: 9
  completed_phases: 0
  total_plans: 55
  completed_plans: 19
  percent: 35
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-26); AGENTS.md governs hard gates.

**Core value:** 持续归档选定且获准保留的完整课程生命周期资料，让用户及获准模型完整读取固定版本内容，明确来源、历史与缺口。
**Current focus:** Execute the 41 approved Phase 2 plans through automated implementation and release preparation, stopping at every required human/native gate.

## Current Position

Phase: 02 (poc-live) — EXECUTING
Plan: 7 of 41
Status: Ready to execute
Last activity: 2026-09-01

Plan progress: Phase 2 execution 6/41. Phase 1 remains 13/14 and is not marked complete; the approved macOS-first ordering exception does not clear Windows or Phase 3 gates.

## Performance Metrics

**Velocity:**

- Total plans completed: 19
- Average duration: N/A
- Total execution time: Not aggregated; see individual SUMMARY files

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 13 completed / 14 planned | Partial; human/native gaps remain | N/A |
| 2 | 6 completed / 41 planned | In progress; native/live gates remain blocked | N/A |
| 3–8 | Not yet planned | Not started | N/A |

**Recent Trend:**

- Last 5 plans: 02-02, 02-03, 02-04, 02-05, 02-06
- Trend: N/A

| Phase 02 P01 | 9 min | 2 tasks | 6 files |
| Phase 02 P02 | 23min | 3 tasks | 6 files |
| Phase 02 P03 | 11min | 2 tasks | 3 files |
| Phase 02 P04 | 8min | 1 tasks | 3 files |
| Phase 02 P05 | 18min | 2 tasks | 3 files |
| Phase 02 P06 | 12min | 2 tasks | 5 files |

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
- PROJECT记录gh活动账号ywan1303；returdex已登录未激活。未来远程操作前另核对returdex认证和repo-local author/committer，检查returdex/AutoED同名冲突；本轮不切账号、不创建远程、不发布。

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260831-ho4 | Record beta.19 macOS status UI human UAT pass while preserving Windows as not_run/human_needed | 2026-08-31 | 61adf70 | [260831-ho4-record-beta-19-macos-status-ui-human-uat](./quick/260831-ho4-record-beta-19-macos-status-ui-human-uat/) |
| 260831-hru | Record beta.19 packaged macOS native diagnostics pass with correct synthetic evidence boundary | 2026-08-31 | 86eb22b | [260831-hru-record-beta-19-packaged-macos-native-dia](./quick/260831-hru-record-beta-19-packaged-macos-native-dia/) |
| 260831-o7k | Record beta.19 separate macOS standard-account install UAT and restore primary service with honest no-Node and authorization boundaries | 2026-08-31 | eae6eaa | [260831-o7k-record-beta-19-separate-macos-standard-a](./quick/260831-o7k-record-beta-19-separate-macos-standard-a/) |
| 260901-5lh | Synchronize roadmap with user-approved macOS-first Phase 2 sequencing exception while preserving Windows and Phase 3 gates | 2026-09-01 | f41c535 | [260901-5lh-synchronize-roadmap-with-user-approved-m](./quick/260901-5lh-synchronize-roadmap-with-user-approved-m/) |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| None | 无已批准后续里程碑；五项细化需求已纳入M1，未延期 | N/A | - |

## Session Continuity

Last session: 2026-09-01T05:05:49.355Z
Stopped at: Completed 02-06-PLAN.md
Resume file: None
