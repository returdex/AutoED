# Phase 2: 双来源原生登录 POC 与 live 硬门禁 — Research

**Researched:** 2026-09-01
**Domain:** Local Playwright 持久 Profile、双来源只读认证、账户绑定与 live UAT
**Confidence:** HIGH（既有代码与 Playwright 官方契约）/ MEDIUM（来源页面适配方案）/ live not_run

## Research Summary

Phase 2 应在现有 application/API/worker/persistence/status 分层上增加一个受限的认证子系统，而不是让 UI、CLI 或 MCP 直接驱动浏览器。首个实现使用一个安装专属的 Playwright persistent context；Moodle 与 EdStem 各自拥有固定 origin、固定只读动作、独立正面认证标志和独立状态。共享 Profile 只是一项待 live 证明的部署假设：两个来源都通过完整门禁后才能最终采用。

Playwright 官方说明 `launchPersistentContext(userDataDir)` 使用持久存储、只返回一个 context，关闭 context 会关闭浏览器，并且浏览器不允许同一 user data directory 同时启动多个实例。官方也明确不支持自动化日常 Chrome 默认 Profile，应使用单独目录。[CITED: https://playwright.dev/docs/api/class-browsertype]

因此推荐单一 `ProfileCoordinator` 作为唯一启动入口，结合安装身份、启动 nonce、PID、OS 创建身份、受管浏览器可执行文件及本地认证控制通道证明所有权。租约只用于 fencing，不构成“浏览器已退出”的证据；只有 OS 观察确认退出后才能清理本安装的陈旧持有记录。

## User Constraints

以下结论受 `02-CONTEXT.md` 的 D-01–D-18 约束：统一 beta、先 Moodle 后 EdStem 的有界自动检查、共享 Profile 假设、双来源独立状态、完整身份仅在已配对本地 UI、身份不一致硬停、最多三次恢复、四个 macOS live 检查点、Windows 保持 `not_run / human_needed`、Phase 3 继续阻塞。GitHub 多账号、课程内容和新通知系统不属于本阶段。

## Existing Architecture Fit

| Concern | Existing asset | Phase 2 extension |
|---|---|---|
| Domain state | `packages/domain/src/model.ts` 已区分 auth/capability/health/freshness/completeness | 新增 per-source observation、binding、profile ownership、UAT receipt；禁止压成单一 logged-in boolean |
| Runtime contracts | `packages/contracts/src/index.ts` 的 strict Zod schemas | 所有 API/job/receipt 输入严格枚举；不接受 URL、JS、selector、browser handle |
| Admission/output | `packages/application/src/policy.ts`、`ports.ts` | source/action/course/destination 四维授权；本地 UI 与 CLI/MCP 使用不同投影 |
| Durable work | jobs + generation/fence + last success | auth probe job、最多三次恢复、取消/失租后停止请求并拒绝提交 |
| Process ownership | `packages/platform/src/processes.ts` | 沿用安装身份+nonce+OS start identity+exact executable+authenticated control 的证明模式 |
| Persistence | SQLite WAL、FULL、严格 generation | schema migration 增加来源状态、身份绑定、profile owner、UAT ledger；失败不覆盖 last success |
| Local UI | 配对、same-origin、CSRF、401 清空 | 两张来源卡、总体门禁、完整私人身份仅在 protected DOM |

当前 `Scope`、`JobRequest`、`OutputOperation` 和 capability 仍仅支持 synthetic。Phase 2 不应就地放宽字符串，而应把来源、固定动作和最小课程可见性探针建成 discriminated unions，使越界操作在 application admission 前即无法解析。

## Recommended Architecture

### 1. Fixed source configuration

在 live 前由用户确认 Moodle origin、EdStem origin、目标账户、组织/租户及一个课程。持久化的是经过规范化和批准的 origin/scope 记录，不是任意导航目标。运行时只能由 `SourceAdapter` 根据枚举动作构造 URL：

- `moodle.auth_probe`
- `edstem.auth_probe`
- `moodle.course_visibility_probe`
- `edstem.course_visibility_probe`

本阶段不得存在通用 `navigate(url)`、`evaluate(js)`、selector 参数、下载、表单提交或网络 API fallback。所有来源页面均是不可信数据，只读取经适配器定义、长度受限的可见文本/属性和官方支持的稳定标识。

### 2. Profile coordinator and ownership

`ProfileCoordinator` 在仓库外的受保护、非同步安装目录创建专属 user data directory；Profile 内容永不进 SQLite、日志、备份、Git、诊断或模型输出。启动 persistent context 时显式使用交付的 Chromium、`headless: false`（人工登录窗口）、`acceptDownloads: false`，且不启用 tracing、video、HAR、console/request body logging。

Playwright persistent context 的单实例限制可作为底层冲突信号，但不能替代产品所有权协议。持有记录必须包括 installation id、browser build、PID、nonce、OS start identity、exact executable、started_at 和 generation。恢复顺序：验证记录 → OS/受认证控制探针 → running 则报告 `profile_in_use` → confirmed exited 才移除陈旧记录。不得处理日常浏览器或未知 PID。

### 3. Probe contract

每个来源探针返回结构化结果，不返回原始 DOM：

```text
source, approved_origin, observed_origin,
auth, capability, health, freshness, completeness,
positive_marker, stable_subject_id?, organization_id?,
display_name?, school_email?, selected_course_visible?,
checked_at, result_code
```

`display_name` 和 `school_email` 只能进入受保护本地 UI 投影；持久绑定优先保存官方稳定 subject/organization 标识的不可逆 keyed fingerprint。CLI/MCP/receipt 只返回短指纹、binding consistency 与脱敏 code。URL/HTTP 200 只能证明导航，不是认证成功。若来源页面版本无法满足正面标志和身份证据，结果为 `parser_changed`/`capability_unknown`，不能退回“看起来已登录”。

Moodle/EdStem 的具体 selector 和稳定标识必须在实现期针对用户批准的实际官方 origin，以可见页面和官方支持路径确认。研究阶段没有足够证据声明两站具有统一 subject，也不得猜测内部 API。严格自动候选绑定仅在两个来源都提供可核对的稳定主体+组织/租户证据时启用，否则走一次人工绑定确认。

### 4. Auth and retry state machine

建议每来源状态：`not_observed → authenticated | unauthenticated | reauth_required | identity_mismatch`；独立保存 capability/health/freshness/completeness 和 last success。错误至少区分：

- `AUTH_REQUIRED`：从未登录或显式登出；不自动重开。
- `REAUTH_REQUIRED`：自然过期或三次恢复失败；暂停该来源。
- `NETWORK_UNAVAILABLE`：暂时失败；不改变最后成功身份。
- `PARSER_CHANGED`：正面标志不再可确认；不能当未登录。
- `CAPABILITY_DENIED`：课程可见性/授权被拒绝。
- `IDENTITY_MISMATCH`：停止所有课程访问并要求人工核对。
- `PROFILE_IN_USE` / `PROFILE_OWNERSHIP_UNCONFIRMED`：不抢锁、不杀进程。

三次自动恢复建议采用每次 job 内的有界尝试与单调 backoff（例如立即、5 秒、30 秒），每次均受总 deadline、取消、lease 与 generation 约束；任何需要页面交互/MFA 的结果立即停止，不消耗为自动输入尝试。显式登出不进入自动重试。Moodle reauth 成功后创建一个新的 EdStem auth probe，而不是复制会话状态。

### 5. Persistence

采用显式 SQLite migration，不重建现有表：

- `source_configs`：批准 origin、source、scope 状态、配置版本。
- `source_observations`：当前投影、last_success、checked_at、generation。
- `account_bindings`：每来源 keyed fingerprint、组织/租户、候选/confirmed/mismatch 状态；私人显示字段应最小化，并只为本地 UI 加密/受保护存储。如无法证明安全持久化，完整身份只保留当前内存会话并在 UI 注明。
- `profile_ownership`：单行持有意图/confirmed 状态及 fence，不存 Profile 路径到外部投影。
- `uat_receipts`：脱敏机器结果，不含姓名、邮箱、课程名或截图。

任何 schema 变更必须保留 Phase 1 安装/升级恢复语义。迁移失败必须走既有 rollback/human-needed 路径，且 Profile 始终排除在快照之外。

### 6. API and UI

新增 fixed-action endpoints，例如 source configuration confirmation、open login、probe、logout intent acknowledgement、binding confirmation 和 receipt read；全部要求已配对 local UI principal、same-origin CSRF 和细粒度 permission。MCP/CLI 只读状态不得触发登录窗口或自动课程访问。

管理页新增 Moodle、EdStem 两张独立卡和总体 gate。卡片必须同时显示 auth/capability/health/freshness/completeness/checked time/shared-profile 状态。完整姓名/邮箱仅在 protected view，并附私人信息提示；401/403 立即移除 DOM，网络失败仅显示带时间的 stale 快照。总体 gate 必须明确 macOS/Windows 和 S/I/N/L 的缺口，不能因 macOS pass 显示 Phase 2 complete。

## Security Threat Model Inputs

| ID | Threat | Required mitigation/evidence | Severity |
|---|---|---|---|
| T2-01 | 恶意页面诱导任意导航/脚本/写操作 | sealed adapter actions、origin allowlist、strict schemas、无 evaluate/selector/URL 参数、写路由不可达测试 | Critical |
| T2-02 | Profile/Cookie/凭据泄漏 | 仓库外 0700/0600 或 Windows ACL；无 storageState/cookie/HAR/trace/log/export；敏感输出扫描 | Critical |
| T2-03 | 两来源身份误绑定 | 稳定主体+组织证据或一次人工确认；显示名/邮箱不得单独自动绑定；mismatch hard stop | High |
| T2-04 | 租约过期误杀日常/仍运行浏览器 | 安装身份+nonce+OS start identity+executable+control proof；确认退出才清理 | Critical |
| T2-05 | 旧 Worker 失租后继续访问/提交 | request 前及 commit 前 fence/cancel/generation 检查；并发故障注入 | High |
| T2-06 | 状态将网络/parser/权限混为登出 | typed result codes、last-success retention、独立 observation dimensions | High |
| T2-07 | 本地 UI 泄露完整身份 | pairing+CSRF+CSP/no-store；401/403 DOM purge；CLI/MCP/receipt redaction contract tests | High |
| T2-08 | synthetic/native/live 证据串格 | typed evidence ledger、platform/source/scenario keys、live receipt 仅用户动作后生成 | High |

## Don't Hand-Roll

- 使用 Playwright `launchPersistentContext`，不手工解析/复制 Cookie 或连接日常 Chrome Profile。[CITED: https://playwright.dev/docs/api/class-browsertype]
- 使用 Playwright locator/role contract 和有界等待，不用任意 `evaluate`。页面/弹窗可通过 BrowserContext page events 观察；所有等待必须显式 timeout/cancellation。[CITED: https://playwright.dev/docs/api/class-browsercontext]
- 使用现有 Node crypto、SQLite transaction、Zod、Fastify 和 OS process proof；不自制加密、会话桥或 PID 所有权推断。
- 不使用 `storageState` 作为产品持久化方案。Playwright 官方提醒认证状态文件可含可冒充用户的敏感 cookies/headers；本项目直接保护整个专属 Profile 且禁止导出。[CITED: https://playwright.dev/docs/auth]

## Common Pitfalls

- SSO 登录 Moodle 后 EdStem 页面可打开，不等于 EdStem 身份/范围已验证。
- 同一 Profile 可持久化两站会话，不等于两站同一账户；必须独立绑定。
- Playwright 启动失败可能是仍有持有者，不应删 lock 后重试。
- `context.close()` 关闭浏览器是正常路径，但崩溃路径仍需 OS 实际退出证据。[CITED: https://playwright.dev/docs/api/class-browsertype]
- 默认 `acceptDownloads` 为 true；本阶段需显式 false，且下载事件必须 fail closed。[CITED: https://playwright.dev/docs/api/class-browsertype]
- 用真实页面测试 parser 时不得记录 HTML、console、request、response 或截图；fixture 只能证明适配器契约，不能填 live。
- 24 小时检查与 reauth 是两个不同检查点；未自然过期不能虚构 reauth pass。
- Windows 未跑必须持续显示 `not_run / human_needed`，不能由同一 JS bundle 或 macOS 结果推断。

## Planning Recommendations

建议按依赖拆分为：契约/迁移 → Profile ownership → sealed browser adapters → probe/binding application flow → worker retry/fencing → API/output policy → local UI → synthetic/integration/UI/native tests → beta assembly/release availability → macOS human checkpoints A/B/C/D → Windows deferred ledger/Phase 3 hard gate。每个 live plan 必须是 `autonomous: false`，且发布、更新、登录/MFA、重启、跨日等待和 reauth 分开设人工门禁。

实现计划不得提前写死实际学校 selector。首个 live 前需由用户确认两个 official origin、账户/组织、一个课程与数据目的地；适配器支持性检查若失败，应报告 human-needed 而非扩大到内部 API 或自由浏览。

## Validation Architecture

### Framework and commands

现有 Vitest 4.1.11、Playwright Test 1.62.1、TypeScript 7.0.2 和 native test projects 可直接扩展。[VERIFIED: package.json]

- Quick: `npm run typecheck && npm run test:unit -- --run`
- Integration: `npm run test:integration -- --run`
- Browser UI: `npm run test:ui`
- Native: `npm run test:native -- --run`
- Full automated: `npm run typecheck && npm run test:unit -- --run && npm run test:integration -- --run && npm run test:ui && npm run test:native -- --run`

### Requirement map

| Requirement | Automated S/I/N evidence | Manual L evidence |
|---|---|---|
| AUTH-01 | sealed adapters, positive marker/origin/identity schema, secret-output negatives | 用户在官方页面亲自登录/MFA并核对身份 |
| AUTH-02 | receipt matrix rejects missing/incorrect platform and scenario cells | macOS A/B/C/D；Windows 保持 not_run 直至原生测试 |
| AUTH-03 | distinct failure fixtures + last-success retention + UI projections | 实际账号、授权范围、认证状态核对 |
| AUTH-04 | concurrent owner, crash, cancel, lease loss, stale PID/native process tests | macOS 实际重启/Codex 退出；Windows 后补 |
| SEC-02 | malicious DOM/navigation/write attempts, arbitrary parameter rejection, output scans | 用户确认 official origins/approved scope；不故意制造学校错误 |
| UAT-01 | release manifest/artifact availability/receipt state-machine tests | 用户实际更新并逐 checkpoint 报告 |

### Test layers

- Unit：strict schemas、state machine、binding comparator、redaction、retry policy、receipt gate。
- Integration：SQLite migration/retention、job fence、profile ownership store、API permissions、source adapter fixtures、malicious page fixture。
- Synthetic browser E2E：本地 fixture 上验证弹窗、origin redirect、login marker、identity mismatch、download/write rejection、UI privacy。
- Native：受管 Chromium 启动/关闭/崩溃恢复、目录权限、PID/executable ownership、worker/Codex exit；每 OS 独立。
- Live：只由用户在发布 beta 上执行。自动测试结果不能填写 L；未到 24 小时、未重启或 Windows 缺设备均保持 `human_needed/not_run`。

### Mandatory negative fixtures

未登录、自然过期、权限拒绝、网络超时、redirect 到未批准 origin、parser drift、相同显示名但不同稳定主体、Profile 已持有、PID 重用/身份未知、旧 worker 失租、下载触发、表单/POST/quiz/upload 尝试、401 后 UI 清除、receipt 跨平台/跨证据类型污染。

### Release/live ordering

完整 automated suite 通过 → 构建并验证可获取 beta → 给用户精确更新步骤 → 用户更新 → A → B → C → 等待至少 24h 后 D → 单独 reauth。任一步失败即保持真实状态并修复新 beta；不得覆写已发布 tag。Windows 继续是独立未运行单元，Phase 3 gate 保持关闭。

## Sources

- Playwright BrowserType persistent contexts: https://playwright.dev/docs/api/class-browsertype
- Playwright BrowserContext lifecycle/events: https://playwright.dev/docs/api/class-browsercontext
- Playwright authentication-data sensitivity: https://playwright.dev/docs/auth
- Chrome default-profile remote-debugging restrictions: https://developer.chrome.com/blog/remote-debugging-port
- Project sources and policies listed in `02-CONTEXT.md` canonical references.

---

*Research status: COMPLETE for planning; source-specific selectors and shared-session behavior remain implementation/live evidence, not research facts.*
