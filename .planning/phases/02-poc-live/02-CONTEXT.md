# Phase 2: 双来源原生登录 POC 与 live 硬门禁 - Context

**Gathered:** 2026-09-01
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段实现并发布一个可获取的认证 POC beta：用户在 Local Playwright 的单一本机专属 Profile 中，于 Moodle 官方页面亲自完成登录/MFA；产品随后对已预先批准的 EdStem 官方来源执行有界只读认证检查，分别核验两个来源的 origin、真实账户绑定、授权范围、认证能力与恢复行为。只验证一个明确选择课程的可见性，不读取课程正文、帖子、文件、成绩或其他 Phase 3/4 内容。

用户明确批准在 Phase 1 仍为部分通过、Windows 11 仍为 `not_run / human_needed` 的情况下，先进行 Phase 2 的 macOS 设计、计划、实现、自动测试和人工验收。该顺序例外不把 Phase 1 或 Phase 2 判为完成，不允许用 macOS 填写 Windows 单元，并且 Phase 3 继续受原双平台硬门禁阻塞。Phase 2 PLAN 仍需用户另行批准；官方登录、MFA、更新与 live UAT 仍是不可自动跨越的人工门禁。

</domain>

<decisions>
## Implementation Decisions

### 阶段顺序与双来源认证
- **D-01:** Moodle 与 EdStem 的实现和自动测试先在同一阶段完成，再发布统一认证 beta 进行人工验证；不先用 Moodle-only live beta 提前填充双来源结果。
- **D-02:** 首个方案使用一个 AutoED 专属 Profile。用户先在 Moodle 官方页面登录，随后产品在两个来源均已预先批准的前提下，自动对 EdStem 执行有界只读认证检查；只核验官方 origin、认证状态、账户绑定和能力，不浏览课程或下载内容。需要额外交互/MFA 时立即暂停，由用户本人处理。
- **D-03:** 单一 Profile 是待验证假设，不是既成事实。只有 Moodle 与 EdStem 都通过三次关闭重开、Worker/系统重启、Codex 退出、至少 24 小时复查、reauth、账户绑定和敏感输出检查，才最终采用共享 Profile；状态保持不一致时停止并回到拆分方案的人工决定，不自动复制 Cookie、迁移会话或拆分 Profile。

### 身份展示与账户绑定
- **D-04:** 已配对的本地管理页为 Moodle、EdStem 提供独立状态卡，并另有总体门禁状态。每张卡显示官方 origin、完整显示名、完整学校邮箱、auth、capability、health、freshness、completeness、最近核验时间以及是否复用共享 Profile。
- **D-05:** 完整姓名和学校邮箱仅在已配对本地管理页显示，并明确提示含私人信息。CLI、MCP、日志、诊断、Git、公开 beta/UAT 记录只输出绑定一致性、脱敏结果码和不可逆短指纹，不输出姓名或完整邮箱；截图不是默认或正式证据。
- **D-06:** 两来源身份不一致时立即标记 `identity_mismatch` 并停止课程访问；不得自动切号、登出、覆盖旧绑定或继续采集。本地管理页可并列显示两个完整身份供用户核对。
- **D-07:** 先验证能否用官方稳定账户标识、统一认证主体、组织/租户和已批准授权范围建立严格自动候选绑定；可行时自动建立候选绑定，并由用户在首次 live UAT 核对一次。严格证据不足时显示两个独立来源身份，由用户人工确认一次对应关系。绝不只凭相同显示名或邮箱自动绑定；身份变化后必须停止并重新确认。

### Profile 恢复与重新认证
- **D-08:** 正常启动时使用同一专属 Profile 分别执行后台有界认证探针；两边有效时不打开窗口。出现 `reauth_required`、身份变化或额外交互时才提示并由用户打开官方窗口。
- **D-09:** 异常退出后的恢复必须先证明浏览器进程属于本安装并确认实际退出。浏览器仍运行时报告 Profile 被持有；不得因租约过期强杀进程或删除仍在使用的锁。确认退出后才可清理本安装拥有的陈旧记录并恢复。
- **D-10:** 用户显式退出来源后标记 `unauthenticated`，尊重退出意图且不自动重开；用户点击“重新登录”后才开始官方登录。自然过期标记 `reauth_required`，暂停相关任务并保留上次成功资料。
- **D-11:** 共享 Profile 中单一来源失效时只暂停该来源，另一个来源若仍有效则保持可用。对自然过期或暂时性探针失败最多执行三次有界只读恢复探针；不得自动输入凭据、绕过 MFA 或连续弹窗。三次失败后停止自动重试并标记 `reauth_required`。使用现有提示渠道；若无主动通知渠道，不在本阶段新增通知系统，但失败必须持续显示在管理页和状态接口。用户完成 Moodle reauth 后，再自动复查 EdStem 是否随统一认证恢复。

### macOS live UAT 节奏与证据
- **D-12:** macOS live UAT 分为四个独立检查点：A）首次 Moodle 登录、自动检查 EdStem、身份/候选绑定与指定课程可见性；B）两个来源关闭重开三次、Worker 重启和 Codex 完全退出；C）macOS 完整重启后复查；D）至少 24 小时后无干预复查及 reauth。每项单独记录，失败立即停止相关后续项。
- **D-13:** 检查点 A 只确认两个官方来源、完整本地账户身份以及一个由用户明确选择的课程对当前账户可见；不读取课程正文、帖子、文件、成绩或其他 Phase 3/4 内容。
- **D-14:** 产品为每个检查点生成脱敏结果单，包含版本、原生平台、来源、场景、时间、结果码、账户绑定一致性和缺口。用户反馈检查点编号及 pass/fail/脱敏错误码。姓名、完整邮箱和课程名只在本地管理页显示，不进入 Git、日志或聊天。
- **D-15:** 截图仅为用户自愿、事先本地检查并遮蔽敏感信息的辅助材料，不是通过条件；禁止默认请求或保存登录页、密码/MFA、Cookie、开发者工具、完整邮箱、课程名或其他私人内容截图。截图不进入 Git、公开发布物或长期诊断记录。
- **D-16:** 跨日保持和 reauth 分开验证：首次成功后至少等待 24 小时，仅做无干预会话复查；reauth 优先等待自然过期。合理观察期内未自然过期时，由用户主动退出一个来源后测试重新登录，不人为破坏 Cookie、Profile 或会话存储。

### 平台门禁与推进例外
- **D-17:** macOS 优先推进是用户于 2026-09-01 明确批准的执行顺序例外。Phase 1 继续为部分通过；Phase 2 Windows 原生与 live 单元继续为 `not_run / human_needed`；任何 macOS、S/I 或 synthetic 结果不得填入 Windows/L 单元。
- **D-18:** Phase 2 可以完成 macOS 设计、计划、实现、自动测试、beta 发布和 macOS 人工检查点，但不得据此整体判定 Phase 2 通过或自动进入 Phase 3。恢复 Phase 3 推进前必须补齐原路线图要求的双平台硬门禁，或由用户另行明确重定义产品平台范围并同步需求与路线图。

### the agent's Discretion
- 三次暂时性恢复探针的安全退避间隔、内部状态机字段、不可逆短指纹算法、状态卡视觉布局和结果单机器格式由研究与规划决定，但不得改变上述用户可见行为、隐私边界或证据分类。
- 研究/规划可选择最小必要的官方正面认证标志和稳定账户标识组合；任何标识必须来自用户可见或官方支持路径，不得猜测未授权 API、逆向内部端点或用 URL/HTTP 200 冒充登录成功。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目边界与阶段门禁
- `AGENTS.md` — Profile、凭据、来源权限、人工登录、原生证据和不可自动跨越门禁的最高优先级规则。
- `.planning/PROJECT.md` — 产品目标、隐私边界、双来源认证原则、人工 UAT 顺序与明确排除项。
- `.planning/REQUIREMENTS.md` §2 — AUTH-01–AUTH-04、SEC-02、UAT-01 的正式要求和 S/I/N/L 证据语义。
- `.planning/ROADMAP.md` §Phase 2 — 双来源原生登录 POC 的目标、成功条件和 Phase 3 硬停止条件。
- `.planning/VALIDATION-STRATEGY.md` — G3 live 矩阵、脱敏记录、跨平台和反例证据分类。
- `.planning/phases/01-beta/01-CONTEXT.md` — 专属本地服务、受管进程、安装/升级、人工门禁和敏感 Profile 的继承决定。

### 当前实现边界
- `packages/domain/src/model.ts` — auth/capability/health/freshness/completeness 与进程/租约基础模型。
- `packages/contracts/src/index.ts` — 当前状态、构建身份、维护门禁和证据类型的运行时契约。
- `packages/application/src/policy.ts` — 当前 output authorization 与脱敏错误边界。
- `packages/application/src/ports.ts` — application 层端口、持久任务 fence 与来源权限接口边界。
- `apps/api/src/security.ts` — loopback、Host/Origin/CSRF 和本地凭据认证模式。
- `apps/api/src/pairing.ts` — 已配对本地浏览器会话和 same-origin 控制面模式。
- `packages/persistence/src/sessions.ts` — 本地 UI 会话、配对和撤销的 SQLite 持久化模式。
- `packages/platform/src/processes.ts` — 受管进程所有权证明和只停止本安装进程的模式。
- `tests/integration/job-recovery.test.ts` — 租约、fence、取消、失败保留与恢复反例模式。
- `tests/integration/pairing.test.ts` — 浏览器配对、跨源拒绝、会话撤销与重启失效的既有集成证据。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/domain/src/model.ts` 与 `packages/contracts/src/index.ts` 已有分离的 auth/capability/health/freshness/completeness 词汇，可扩展为每来源状态而非创建含混的单一“已登录”布尔值。
- `apps/api/src/pairing.ts`、`packages/persistence/src/sessions.ts` 和现有 status UI 提供已配对本地页面、CSRF、防跨源、撤销和重启失效模式，可承载仅本地显示的完整账户身份。
- `packages/application/src/policy.ts` 与 `packages/application/src/ports.ts` 已建立 operation/destination 授权边界，可扩展为 Moodle/EdStem 官方来源和只读认证探针 allowlist。
- `packages/platform/src/processes.ts` 与持久 Job fence 可复用到浏览器/Profile 所有权、旧 Worker 停止提交和异常恢复。

### Established Patterns
- 所有真实组件通过同一 application/API 边界；MCP 不直接打开 DB、Profile 或浏览器。
- 状态和证据必须区分 `not_observed`、错误、过期、部分与成功；旧成功资料不能被失败探针清空。
- 进程回收依赖安装身份、nonce、OS 创建身份、受认证探针和实际退出，不把租约超时当进程退出。
- 本地 UI 先显式配对，公共 shell 不泄露身份；敏感完整身份只能在受保护本地页面出现。

### Integration Points
- 新 BrowserProvider/Profile/connector 端口应接入 application 层，而不是由 UI、CLI 或 MCP 直接驱动 Playwright。
- API 需要来源状态、登录动作、Profile 持有者、账户候选绑定和 UAT 结果单的严格路由及授权；只允许固定来源/固定动作，不接受任意 URL、JS、selector 或浏览器句柄。
- Worker 需要新的认证探针 Job、三次有界恢复策略和 generation/fence 检查；失租旧 Worker 不得继续请求或提交。
- persistence 需要来源身份、候选绑定、每来源观察、Profile lease/ownership 与 UAT ledger；Profile 内容本身必须留在仓库外受保护目录，永不进入 DB 备份、Git 或模型输出。
- 当前代码没有真实 BrowserProvider、Moodle/EdStem connector 或专属 Profile 生命周期实现；这些是 Phase 2 的新增实现，不得借用旧仓库或把 synthetic fixture 当 live 能力。

</code_context>

<specifics>
## Specific Ideas

- 用户描述的目标体验是“直接登录 Moodle，随后检测 EdStem 是否已因同一统一认证平台而有效”；本阶段必须实测该共享方式，不能按理论 SSO 假设直接敲定。
- 两个来源先统一实现并在同一个 beta 中接受人工测试，以便同时验证共享认证，而不是把来源拆成两个独立 live 发布批次。
- 管理页允许显示完整学校身份便于本机核对，但正式证据使用脱敏结果单；用户接受经过本地遮蔽的可选截图作为辅助。
- GitHub 多账号和仓库身份配置已移出本阶段，登记为 ROADMAP backlog Phase 999.1。

</specifics>

<deferred>
## Deferred Ideas

- Phase 999.1：显式配置并核对 GitHub 用户与目标仓库身份，避免多账号环境选错账号/仓库；不得与学校来源 Profile 或 Phase 2 认证状态混合。
- Moodle 课程正文、公告、文件、成绩等内容读取属于 Phase 3；EdStem 线程/回复/附件与双源课程绑定属于 Phase 4。本阶段只核验一个指定课程的可见性。
- 新的通知系统不属于 Phase 2；三次恢复失败只使用现有渠道，并始终保留管理页/状态接口可见性。

</deferred>

---

*Phase: 02-poc-live*
*Context gathered: 2026-09-01*
