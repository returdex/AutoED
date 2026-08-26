# Project Research Summary

**Project:** AutoED Rebuild · M1
**Domain:** 本机单用户 macOS/Windows 课程信息同步、长期归档与获准模型读取
**Researched:** 2026-08-26
**Confidence:** MEDIUM；官方机制与项目适用性分开评价
**Status:** 研究综合；51 项 REQUIREMENTS、五项细化提案与路线图已于2026-08-26获用户批准；全部产品测试证据 `not_run`，无 validated 能力。

## Executive Summary

AutoED 应围绕“选定课程的持续完整盘点、版本化资料与可解释缺口”建设，而非单作业抓取器或作业助手。已批准目标包括独立本地后端、Local Playwright 专属敏感 Profile、SQLite＋最小持久 Job＋本地文件、macOS/Windows、长期归档、全文与原文件读取、提示词安装升级。用户已同意本地全文归档和获准模型读取，但每份材料的访问、保留与外发权限仍须分别满足；不默认全部 local_only，也不因用户同意而绕过材料限制。

研究建议采用 TypeScript 模块化单体、独立 API/Worker、薄 stdio MCP 与共享 application/policy 层；这是 proposed 实现组合，库版本、打包与具体算法尚未锁定；解析矩阵目标已获批。先建立真实持久化、最小安全控制面和可安装升级 beta，再进行双来源×双原生平台人工认证门禁；P3 即接通实际 MCP→HTTP→后端，之后扩展双源资料、文件全文与生命周期。P7 完成实际客户端读取，P8 完成全量交付恢复，而不是等到最后才建立分发通道。

最大风险是把持久 Profile 当永久登录、把租约当进程所有权、把失败当空集合、把搜索或文件路径当完整交付，以及把 beta/fixture 成功当 live 通过。应从第一条真实读取起执行来源/scope/操作/目的地门禁，保持不可变版本和分项状态，验证实际 SQLite 引擎的 WAL 修复，并将人工更新、官方登录、跨日复查和 Windows 原生证据设为不可自动批准的硬门禁。本轮只做规划，不安装、登录、采集或发布。

## Key Findings

### Recommended Stack

详见 [STACK.md](STACK.md)。SQLite＋Job＋文件与唯一真实 Local Playwright Provider 是已批准方向；下列依赖与实现均为 **proposed**，实施前再核对官方版本并固定完整发布清单。

- **TypeScript＋Node 24 LTS＋npm workspaces：** 共享类型契约、预编译交付、锁文件复现；研究核对 Node 24.19.0，但未选为最终锁定版本。
- **Fastify 5＋Zod 4：** 本地 API 请求/响应契约；provider 兼容性一起锁定，特别检查输出序列化与脱敏，而非只校验输入。
- **Playwright＋配套 Chromium：** 研究发行线已列 1.62；npm patch、browser revision、sandbox 配置与 OS/CPU 必须成套实测，不能复用日常/Codex Profile。
- **better-sqlite3 13.0.2 候选＋FTS5：** 研究记录其内嵌 SQLite 3.53.4；优先验证原生矩阵，`node:sqlite` 仅为待评审备选。必须运行 `sqlite_version()` 核对实际引擎及 WAL-reset 修复，不能只看包版本。
- **React/Vite、MCP TypeScript SDK v2、Vitest/Playwright Test：** 分别承担本地管理页、stdio 薄客户端与分层自动测试；SDK/协议/实际宿主兼容性待锁定，中文检索与二进制交付须单独验收。

### Expected Features

详见 [FEATURES.md](FEATURES.md)；核心价值不能以“差异化功能”为由挪出 M1。

- **Must have：** 账号/学期/课程范围与双源绑定；结构/页面/公告/讨论/附件；assessment 时间、本人可见状态/成绩/反馈；独立任务、长期历史及提示词安装升级。
- **Must have：** CourseManifest/ResourceManifest、固定版本分页全文、可取得真实字节的原文件访问、搜索与变化；分别呈现 discovery/fetch/archive/extraction/model_access，失败不覆盖最后成功数据。
- **Should have / 核心差异价值：** 可复现 locator/revision、覆盖分母与缺项、模型无关读取、逐出口权限检查；这些已属于目标，不是可随意推迟的附加项。
- **本次已批准的五项 accepted_detail：** TEXT-01 格式/定位矩阵、TEXT-02 有界 ZIP、SEARCH-01 中英文匹配策略、BUNDLE-01 纯资料聚合、OPS-01 加密完整备份。解析器可见的隐藏内容不自动属于采集范围；聚合不编译要求、不裁定权威、不评估作业。
- **Defer / 无已批准后续里程碑：** 更多解析格式、学校适配、旧 metadata 导入、后台自动升级只能另提需求；扫描/媒体等先诚实报告缺口。作业 AI、EvidenceLens/AssignmentFlow、云服务及 Linux 强制支持不进入未来 AutoED 阶段。

### Architecture Approach

详见 [ARCHITECTURE.md](ARCHITECTURE.md)。推荐以同一后端拥有状态，客户端仅做语义输入/展示；固定版本解决阅读一致性，短事务与幂等提交解决恢复，不用跨页长事务保持快照。

1. **API＋application/policy：** 认证 loopback 控制面，统一 scope/材料权利/操作/目的地检查；domain 不依赖传输、浏览器或数据库 driver。
2. **独立 Worker＋Job＋Browser Broker：** 至少一次执行、有界重试、fencing、checkpoint 与本安装进程监管；MCP/Codex 退出不终止 Worker，租约过期不证明浏览器退出。
3. **来源 adapter＋LocalProvider：** 每个操作都有明确授权 access plan；Moodle/Ed 认证和能力分开，不把可见 XHR 或登录成功当 API 授权。
4. **SQLite＋不可变对象库＋有界提取：** 对象先落盘，DB 决定可见性；observation、源 revision、提取 revision 分开；提交/备份通过 manifest/hash 对账，Profile 永不进入备份。
5. **UI/CLI/stdio MCP/Skill：** 真实 HTTP 接线、manifest 枚举、版本分页与原件访问；MCP 不开 DB/Profile，不接受任意 JS/URL/selector；子进程隔离本身不等于安全沙箱。

### Critical Pitfalls

详见 [PITFALLS.md](PITFALLS.md)，建议优先关闭以下五组风险。

1. **登录与进程误判：** 持久 Profile 不保证学校会话寿命；官方人工登录、账户正面探测、独占与进程所有权验证并行设计，不导出秘密补齐会话。
2. **权限与不可信内容越界：** loopback 仍需认证/Host/Origin/CSRF 防护；所有出口执行同一策略，下载防 SSRF/路径逃逸，解析不执行宏、脚本或外链。
3. **假完整与历史损坏：** 分开 auth/capability/health/freshness/completeness，以及 partial/confirmed_empty/error/not_observed/deleted；提取更新不冒充源内容变化。
4. **数据库、对象与升级失配：** 核验 WAL 修复、短事务、提交边界故障注入与一致性备份；并列程序版本、受管入口和失败恢复不删除档案，也不备份/回滚 Profile。
5. **证据与分发顺序颠倒：** 自动测试→构建/安装升级检查→发布并核验 beta 可获取→用户在 Codex 更新→官方登录/live UAT；fixture、WSL、版本字符串和 beta 发布均不能替代真实验收。

## Implications for Roadmap

以下八阶段与已批准 REQUIREMENTS 主责映射一致。用户已明确批准需求与路线图；研究结论本身不是批准，相关 PLAN 仍须用户确认。

### Phase 1: 契约、持久化骨架与最小 beta 安装升级

**Rationale / Delivers:** 先证明独立 API/Worker、SQLite/Job、平台保护与最小真实接线；锁定依赖/OS/CPU，建立双平台提示词 bootstrap、两个 synthetic beta 构建的升级/失败恢复、可获取产物与版本 manifest。
**Addresses / Avoids:** ARCH/PLAT/SEC-01/JOB/DIST；把安装、升级和发布检查提前，避免 P2 无法更新、嵌入 SQLite 未修复、旧入口混用或 beta 豁免数据保护。

### Phase 2: 双来源×双原生平台登录 POC 与 live 硬门禁

**Rationale / Delivers:** 用已可获取认证 POC beta 和最小管理页，逐格验证 Moodle/Ed×macOS/Windows：人工登录/MFA、Profile 重开三次、Worker/系统重启、Codex 退出、至少 24 小时复查、reauth、真实账号绑定与敏感输出。换号/网络/权限拒绝/parser 的 S/I 反例台账独立记录，不冒充 live；P1 基础 beta 只检查安装升级，不提前要求学校登录。
**Addresses / Avoids:** AUTH/SEC-02/UAT；任何 required live `failed/human_needed/not_run` 均阻断依赖阶段；缺 Windows 原生设备不能以 WSL/fixture 代替，72 小时观察仍仅 proposed。

### Phase 3: Moodle 课程资料与首个实际 MCP 切片

**Rationale / Delivers:** 认证门禁通过后，从明确选课范围读取结构、页面、公告、assessment、本人状态/成绩/反馈；保留时间原文/时区、覆盖、稳定 revision，并接通安装入口→stdio MCP→真实 HTTP→后端。
**Addresses / Avoids:** SCOPE/MOOD/TIME/DATA/EVID-01/MCP-01；首个出口即执行 policy；拒绝错误空集合、猜测时间与 injected callback 假接线，后台停止须明确 BACKEND_UNAVAILABLE。

### Phase 4: EdStem 线程、变化与双源绑定

**Rationale / Delivers:** 在独立获准路径上读取线程、回复、编辑与附件索引，保留匿名/角色等原始信号；由用户确认 Moodle↔Ed 课程/学期映射，允许撤销错误绑定。
**Addresses / Avoids:** ED/BIND；不猜 API、不还原匿名、不按同名合并，不以 unsupported 或分页未完冒充双源完成。

### Phase 5: 全文件盘点、可读化与受控完整交付

**Rationale / Delivers:** 汇合双源资源，交付获准原文件、经审核的格式/ZIP 解析矩阵、manifest、固定源/提取版本分页全文及当前权限检查；不支持、扫描、加密、超额逐项留缺口。
**Addresses / Avoids:** FILE/TEXT/EVID-02/READ/POL；验证原字节 hash、locator、翻页重建与权限撤销，防恶意文件、SSRF、混版、静默截断及“路径即交付”；安全策略从此前阶段已生效。

### Phase 6: 全课程生命周期、调度与恢复

**Rationale / Delivers:** 在完整资源/版本模型上实现初始盘点、增量和周期对账、结课保留、休眠后有界补跑、取消/重试、磁盘预算与提交边界故障恢复。
**Addresses / Avoids:** LIFE/SYNC/STORE；失败保留成功投影，不把未观察当删除，不回放任务风暴、不自动删历史；synthetic 学期变化与实际可访问历史样本分别记证据。

### Phase 7: 管理页、CLI/MCP/Skill 与实际客户端读取

**Rationale / Delivers:** 完善共享后端的入口；实际配置 Codex 经已安装 MCP 枚举课程/资料、逐页读全、取得支持的原件、搜索与查询变化，另测通用协议客户端；纯资料聚合已随需求批准，仍须相关 PLAN 确认。
**Addresses / Avoids:** UI/CLIENT/SEARCH/CHANGE/BUNDLE/MODEL/BOUND；不是首次 MCP 接线，不以 top-k、协议宣称或版本号替代真实读取，不加入作业推理/生成或 LLM Key 依赖。

### Phase 8: 完整交付、加密备份恢复与安全切换

**Rationale / Delivers:** 完成双平台干净安装、连续升级、迁移/中断/文件锁恢复、全部入口/功能回归、受管旧程序清理与用户控制的新旧切换；加密完整备份及引用校验按已批准 OPS-01 及后续确认的 PLAN 实施。
**Addresses / Avoids:** OPS/REL；最小分发已在 P1 存在；不删除课程档案、不写旧产品、不自动卸载旧版，不用未跑项支持稳定声明；缺失人工结果继续阻塞。

### Phase Ordering Rationale

P1 建立安装与安全不变量→P2 关闭真实认证风险→P3/P4 建来源事实与版本→P5 完成内容交付→P6 生命周期恢复→P7 客户端端到端→P8 全量交付验收。跨阶段安全规则从首次相关操作起生效；每次新人工 UAT 都先发可获取 beta，不能把 P2 失败结转为后续债务。

### Research Flags

- **需 `$gsd-research-phase` 深研：** P1 原生依赖/SecretStore/升级信任与 SQLite；P2 交互用户会话、Profile/进程和真实来源；P3/P4 逐操作授权/覆盖；P5 解析安全/定位/二进制交付；P8 原生迁移/恢复/切换。
- **成熟模式可不做泛化重研：** P6 短事务、幂等、checkpoint 与周期对账；P7 共享 API 的 CRUD/展示和语义工具。仍须针对故障边界、实际宿主兼容和用户界面做定向验证；“跳过重研”不等于跳过测试。

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | 官方发行/协议事实较强；精确组合、原生二进制与安装恢复未运行。 |
| Features | MEDIUM | 用户目标明确，格式/协议事实 HIGH；本校来源覆盖、材料许可及提取质量未验证。 |
| Architecture | MEDIUM | SQLite/MCP 机制有官方依据；进程边界、对象提交、分页及 policy 组合仍是待测设计。 |
| Pitfalls | MEDIUM | 官方机制约束 HIGH；学校 SSO、原生 Profile、实际客户端及来源权限 LOW/未验证。 |

**Overall confidence:** MEDIUM。synthetic/contract、真实 SQLite/多进程 integration、synthetic browser E2E、原生安装/客户端和 user-run live 均为 `not_run`，研究不提供产品验收证据。

### Gaps to Address

- **审核与输入版本：** 当前 REQUIREMENTS 的51项需求及八阶段路线图已获用户批准，PROJECT 已同步 D14；仍为0实现/验证。旧 DESIGN 的数据库/安装/版本待决记录被当前批准决定覆盖，原始三份输入保持不变作为历史依据，不能倒退。
- **平台与授权：** P1 确定 OS/CPU、Windows 设备、OS 凭据桥接、进程身份/沙箱与依赖清单；P2–P4 明确真实账号/课程、每操作路径与材料目的地权限。未取得 Ed API 证据不等于 API 不存在。
- **内容与客户端：** 五项细化需求已批准；复杂文件覆盖、预算、中文搜索实现、MCP 新旧协议/SDK/宿主与原件能力仍需在相关 PLAN 确认及验证；标准列表分页不是正文分页协议，受限材料不能借摘要绕过。
- **发布与恢复：** M1 路线图已确认，目标0.1.0生效但尚未发布，测试版 beta.N 从 1 递增且不覆盖；未来仅 returdex/AutoED，创建前查同名冲突。PROJECT 记录 gh 活动账号为 ywan1303，未来须重新核对 returdex 认证与本地 author/committer，不能沿用当前认证发布。保持标准 PolyForm Noncommercial 1.0.0 与商业授权说明，签名信任及 Profile 跨浏览器升级恢复仍待验证。

## Sources

- **研究输入：** [STACK](STACK.md)、[FEATURES](FEATURES.md)、[ARCHITECTURE](ARCHITECTURE.md)、[PITFALLS](PITFALLS.md)，及 AGENTS/PROJECT/REQUIREMENTS；本摘要汇总已读研究，不声称重新实测。源文记录官方页面查阅日 2026-08-26，滚动文档日期不等于发布时间。
- **Primary / HIGH 机制依据：** [Node 发布记录](https://nodejs.org/en/blog/release/v24.19.0)、[better-sqlite3 13.0.2](https://github.com/WiseLibs/better-sqlite3/releases/tag/v13.0.2)、[SQLite WAL-reset](https://sqlite.org/wal.html#walreset)、[SQLite Backup](https://sqlite.org/backup.html)、[Playwright persistent context](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context)、[Windows interactive services](https://learn.microsoft.com/en-us/windows/win32/services/interactive-services)。
- **Primary / HIGH 格式与协议依据：** [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)、[2026-07-28 Resources](https://modelcontextprotocol.io/specification/2026-07-28/server/resources)、[Pagination](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/pagination)、[Moodle Web services](https://docs.moodle.org/502/en/Using_web_services)、[PDF.js](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html)、[Open XML](https://learn.microsoft.com/en-us/office/open-xml/word/structure-of-a-wordprocessingml-document)；不证明本校授权或具体库覆盖。
- **Secondary / MEDIUM 适用性：** [Stanford Ed 指南](https://canvashelp.stanford.edu/hc/en-us/articles/4402081717011-Getting-Started-with-Ed-Discussion)仅说明该机构使用方式；[Monash AI/IP 指引](https://www.monash.edu/student-academic-success/ai-hub/responsible-and-ethical-use-of-ai)提示材料许可边界，不构成逐材料授权结论。
- **Tertiary / LOW：** Ed 厂商页本轮研究仅得搜索摘要、不可读页面或帮助重定向；不将 snippet 作为 API、账号权限或功能可用性的事实依据。无安装、私有样本、登录或发布验证。

*Research completed: 2026-08-26 · Initialization: complete · Requirements/roadmap approval: approved (2026-08-26) · Implementation/release: not started.*
