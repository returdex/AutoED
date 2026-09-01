---
review_status: approved
milestone: M1
target_version: 0.1.0
granularity: standard
updated: 2026-08-26
---

# Roadmap: AutoED — M1

## Overview

本路线图交付本机单用户 macOS/Windows 课程信息同步、长期归档与获准模型完整读取。八阶段从可安装的独立服务和安全契约开始，经双来源真实认证、课程事实、文件全文、生命周期恢复，到完整客户端与交付验收。所有功能尚未实现或验证；旧仓库基线 `726884c` 不构成本项目证据。需求与路线图已于2026-08-26获用户批准，本轮完成建项后停止，不生成 PLAN、不安装、不登录、不采集、不发布。

**Scope baseline:** [REQUIREMENTS.md](REQUIREMENTS.md) 的51条已批准需求及唯一主责映射；[PROJECT.md](PROJECT.md)、[AGENTS.md](../AGENTS.md) 的已确认决定优先于旧 DESIGN 候选编号。精确技术版本和打包方案仍须实施前核对。M1 目标 `0.1.0` 已随本次确认生效；这是目标版本，不是已发布版本，不创建运行时 VERSION 或标签。

## Approval and Evidence Gates

- **G0 — 本轮审核已通过（2026-08-26）：** 用户明确确认全部51项 REQUIREMENTS、八阶段 ROADMAP 和下列五项细化提案。批准是需求基线，不是实现或测试通过；后续新增范围仍须明确批准。
- **G1 — 计划许可：** 每个相关 PLAN 须用户确认。之后可连续完成批准范围内实现、自动测试/修复、构建和可安装 beta 发布；新的计划、权限、范围或决策不继承批准。`auto_advance` 与 `_auto_chain_active` 保持 false，不修改全局 GSD，也不自动批准 human-verify/decision。
- **G2 — 每次人工检查前：** 适用自动测试 → 构建与安装/升级自动检查 → 发布不可覆盖的 beta → 核对目标平台产物可获取、校验值和实际构建身份 → 给出精确版本、更新提示词、步骤和预期 → 停止，等用户在 Codex 手动更新和反馈。P1 基础 beta 仅要求适用的安装/升级检查，不要求学校登录；P2 或以后具备认证能力的 beta 按场景需要才请用户在官方页登录/MFA。首次安装若本身需人工验收，发布前完成可运行的自动检查，将人工项保留 not_run，不制造循环前置条件。
- **G3 — Phase 2 真实认证硬门禁：** Moodle/EdStem × 原生 macOS/Windows 全矩阵逐项验证；任何必需 live 项 failed、not_run 或 human_needed 都阻止 Phase 3 及后续依赖推进。不得以 unsupported、fixture、WSL 或延后债务替代；缩小范围只能由用户明确批准并同步需求/路线图。
- **G4 — 最终交付：** 全课程/资源/全文/原件/历史、实际客户端、原生升级恢复和人工结果对应同一可定位版本；beta 发布不代表 live 成功，未完成项不得支撑稳定声明。

**Evidence legend:** **S** = unit/contract/synthetic 与本地假站点（包括 synthetic browser E2E）；**I** = 真实 SQLite、文件、多进程、HTTP/stdio 集成；**N** = 已声明原生 OS/CPU 的安装、运行与客户端证据；**L** = 用户在授权学校/账户/课程上执行的 live UAT。组合要求各类证据分别具备，不相互替代。全部当前为 **not_run**；本文件的成功条件都是未来验收目标，不是测试结果。细化场景与脱敏记录遵循 [VALIDATION-STRATEGY.md](VALIDATION-STRATEGY.md)。

### Approved details — 2026-08-26

| Requirement | Accepted detail | Primary phase |
|-------------|---------------------------------------------|---------------|
| TEXT-01 | PDF/Office/text 格式、定位和可见内容提取矩阵 | 5 |
| TEXT-02 | ZIP 目录及受支持子文件的有界安全解析 | 5 |
| SEARCH-01 | scope/type/time 搜索与声明的中英文匹配策略 | 7 |
| BUNDLE-01 | 固定 revision 的纯作业资料聚合，不编译要求或评估 | 7 |
| OPS-01 | 加密且一致的 DB+文件备份与恢复，排除 Profile | 8 |

### Invariants from the first operation

主责 phase 是交付验收归属，不是推迟约束的许可。P1 定义最小 scope、revision、权限与状态契约；从第一条真实 connector 操作及第一次输出起，就检查来源权利、当前 scope、操作、目的地，拒绝源站业务写入和任意 JS/URL/selector。P5 扩大材料策略验收，P7 验证完整实际客户端，不能让 P2/P3 先绕过安全门禁。

专属本地 Profile 含敏感凭据，仅存于仓库外受保护本机位置，不向模型暴露路径，不备份/云同步，不读导出 Cookie，不复用旧版、Codex 或日常浏览器 Profile。用户只在官方页面输入密码/MFA；不记录输入、HAR、原始网络、登录截图或秘密。页面/文件都是不可信数据，不能执行其中指令、宏、外链或 unsafe HTML。

失败不清空最后成功资料；auth/capability/health/freshness/completeness 和 partial/confirmed_empty/error/not_observed/deleted 分开。资料保留和模型外发分别检查；获准资料可正常完整读取，未知或明确受限资料给具体例外及下一步，不以摘要绕过。运行数据、Profile、DB/WAL、备份、日志和私有样本不进入 Git 或未经授权云存储。

### Why these boundaries

- **安装与 beta 提前到 P1：** P2 人工登录必须基于已发布、可更新的安装版本；P8 负责全量升级、恢复与切换加固，不是首次分发。
- **实际 MCP 提前到 P3：** 尽早验证安装入口 → stdio MCP → 认证 HTTP → 独立后端；P7 才扩充完整工具、Skill 与实际模型读取验收。早期切片不等于完整 MCP 已完成。
- **课程覆盖分层交付：** P3/P4 获取选定课程事实及附件索引；P5 交付文件/完整正文；P6 交付全生命周期。单课程/单作业仅为 POC，不是最终范围。
- **新旧与发布隔离：** 新安装 ID、数据根、DB、端口和 MCP 注册独立，旧目录只读。未来发布前分别核对 repo-local author/committer 与实际 GitHub 认证为 returdex，检查 `returdex/AutoED` 同名冲突即停；PROJECT 记录 returdex 已登录但 gh 当前活动为 ywan1303，不能据此发布。保持标准 PolyForm Noncommercial 1.0.0 和商业另行授权说明。beta 使用 `x.y.z-beta.N`、N 从1递增且不覆盖；x 仅由用户明确更新，y 在新里程碑确认时增加并重置 z，里程碑外修复发布才增加 z，不按 phase/commit 升版。

## Phases

**Phase Numbering:** 整数为本次 M1 阶段；小数仅供日后经批准的紧急插入。本路线图不含后续里程碑。

- [ ] **Phase 1: 契约、原生骨架与最小 beta 安装升级** - 用户可安装并核对独立、安全、持久的最小服务。
- [ ] **Phase 2: 双来源原生登录 POC 与 live 硬门禁** - 用户在两个原生平台确认真实会话复用、隔离与恢复。
- [ ] **Phase 3: Moodle 课程事实与首个实际 MCP 切片** - 用户读取选定课程事实并验证真实后端接线。
- [ ] **Phase 4: EdStem 线程与双源课程绑定** - 用户读取完整可见讨论并显式确认来源关联。
- [ ] **Phase 5: 文件 manifest、全文与受控原件交付** - 用户可枚举、固定版本读全并取得获准原文件。
- [ ] **Phase 6: 全课程生命周期、调度与恢复** - 用户可持续归档并在故障、离线及结课后保留可信历史。
- [ ] **Phase 7: 完整管理 UI、CLI、MCP 与 Skill** - 用户与实际模型客户端通过同一后端找资料、读全和查变化。
- [ ] **Phase 8: 跨平台交付、备份恢复与安全切换** - 用户可完成完整安装升级、恢复和隔离切换验收。

## Phase Details

### Phase 1: 契约、原生骨架与最小 beta 安装升级

**Goal**: 用户在声明的 macOS/Windows 原生环境安装独立本地服务，辨认其安全、持久化和实际版本状态，并取得下一阶段可更新的 beta。
**Depends on**: Nothing (first phase); G0 审核及相关 PLAN 用户确认后才实施。
**Requirements**: ARCH-01, ARCH-02, PLAT-01, SEC-01, JOB-01, DIST-01, DIST-02, DIST-03
**Success Criteria** (what must be TRUE):

  1. **[S/I/N]** 用户关闭 Codex/MCP/管理页后，API 与 Worker 仍可独立响应与执行无 LLM Key 的 synthetic 任务；能分辨二者停止状态。最小 HTTP 调用走共享 application 契约，边界检查证明 domain 不导入传输/浏览器/driver、MCP 不直接打开 DB/Profile。
  2. **[S/I/N]** 用户得到持久 job_id，重启仍能查询任务；并发、重复请求、过期租约和旧 fencing token 不造成重复或失权提交，取消/有界重试结果可见。
  3. **[S/I/N]** 用户可核对原生 OS/CPU、lockfile 与精确 runtime/library/browser/实际 SQLite 引擎和 WAL 修复验证记录；未验证架构明确标注。非 loopback、未配对、错误 Host/Origin、跨 scope 或伪造变更被拒绝，两平台凭据和数据保护不静默降级。
  4. **[S/I/N]** 用户在干净原生两平台按完整提示词安装经批准的 Node/浏览器和最小服务，重复运行安全；两份 synthetic beta 的升级/失败恢复演练后实际最小调用来自新入口，旧受管进程退出，组件不匹配不会报告成功。
  5. **[S/I/N]** 首个人工检查前，用户可取得不可覆盖的 beta、校验信息、支持矩阵和精确更新步骤，并核对 manifest/API/Worker/CLI/MCP 构建身份；发布前身份、同名远程、许可证及去敏检查有记录，错误账号或冲突会阻止发布，人工安装项仍如实待测。

**Plans**: TBD
**UI hint**: yes

**Planning focus**: 确认 OS/CPU 和 Windows 原生设备、依赖版本/SQLite 运行引擎、安装标识和 OS 保护机制；此时仅 synthetic 数据，不读取真实课程。最小 revision/scope/policy 契约先确定，后续使用时不得补造历史。

### Phase 2: 双来源原生登录 POC 与 live 硬门禁

**Goal**: 用户确认 Local Playwright 专属 Profile 在 Moodle/EdStem 和原生 macOS/Windows 上具有实证的登录、隔离与恢复能力，且后续阶段无法越过未通过门禁。
**Depends on**: Phase 1；相关 PLAN 用户确认。用户于2026-09-01明确批准一个仅改变执行顺序的例外：Phase 1保持部分通过且Windows保持`not_run / human_needed`时，可先进行Phase 2的macOS设计、计划、实现、自动测试、beta发布和macOS人工检查点；这不填充Windows证据、不使Phase 1/2完成，也不解除Phase 3的双平台硬门禁。认证 POC beta 在本阶段实现并发布，是本阶段 live 子步骤的前置，不是开始本阶段实现的循环前置条件；实际来源/账户/限定课程/目的地须在 live 前由用户确认。
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, SEC-02, UAT-01
**Success Criteria** (what must be TRUE):

  1. **[S/I/L]** 用户从最小管理页打开专属官方窗口自行登录/MFA，看到受保护正面标志、origin 和账户绑定核验；URL/200 不足以判成功，密码/输入/网络原始资料不进入输出。只允许批准的来源操作，恶意页面或任意 URL/JS/selector 不能扩大范围，业务写操作与未授权 API 回退不可达。
  2. **[N/L]** 用户在 Moodle/Ed × macOS/Windows 每格完成正常关开三次、Worker/OS 重启、Codex 完全退出后的最小读取、真实间隔至少24小时复查、显式登出或自然到期后的 reauth、实际账户绑定/授权范围核对及敏感输出检查；逐格记录版本/日期/结果。72小时观察不是新增必需门禁，未另行授权不要求第二个真实账号。
  3. **[S/I/L]** 用户分别看到 auth、capability、health、freshness、completeness；S/I 反例中未登录、拒绝权限、网络失败、parser 变化、换号/identity_mismatch 给出不同原因和下一步、不串数据且保留成功资料。L 独立确认实际账户、授权范围和认证状态，自然发生的故障如实记录，不故意制造学校错误。
  4. **[S/I/N]** 用户同时登录/同步只产生一个 Profile 持有者；崩溃、取消、失租后旧 Worker 不再请求或提交，仅回收本安装/任务拥有的进程，不终止日常浏览器，不因 lease 到期删除仍在用的锁。
  5. **[S/N/L]** 每个人工场景开始前用户已收到可获取 beta、更新提示词和测试预期；用户实际更新、登录并反馈后才记录 L。缺设备/发布失败/无法更新/跨日未到/失败均保持 human_needed、not_run 或 failed，阻止所有依赖阶段；synthetic 测试不能填写 live pass。

**Plans**: 41 plans in 35 waves (see `.planning/phases/02-poc-live/02-PLAN-OUTLINE.md` for the dependency-ordered list and exact `depends_on` graph)
**UI hint**: yes

**Cross-cutting plan constraints**: Every human update/login/MFA/restart/cross-day/reauth step remains a non-auto checkpoint; L evidence is written only by the paired server from real user action, while repo-side gates are read-only or create strict sanitized handoffs; macOS evidence cannot fill Windows cells; Phase 1/2 remain incomplete and Phase 3 remains blocked until the declared dual-platform requiredness registry passes.

**Hard stop**: 采用 VALIDATION-STRATEGY 的 G3 live 矩阵及独立自动故障台账。换号/绑定不匹配、权限拒绝、网络中断、parser drift 和旧 Worker 并发反例必须有 S/I 证据，但不填写任何 L 格；真实登录/复用及绑定仍逐格实测，不要求故意制造学校错误或未授权第二个真实账号。只诊断批准范围内连接方案，不自动推进 P3。

### Phase 3: Moodle 课程事实与首个实际 MCP 切片

**Goal**: 用户在确认的账户/学期/课程范围读取可信 Moodle 课程事实、来源和历史定位，并从实际安装的 MCP 验证同一后端。
**Depends on**: Phase 2 全部必需原生/live 门禁通过；具体 Moodle access plan 与 scope 已确认。
**Requirements**: SCOPE-01, MOOD-01, MOOD-02, MOOD-03, TIME-01, DATA-01, EVID-01, MCP-01
**Success Criteria** (what must be TRUE):

  1. **[S/I/L]** 用户明确选择学校/账户/学期/课程后，可对账选定 Moodle 课程的目录、周次、可见页面、公告和附件索引；同名跨学期/账户不串读，未确认范围不采集，分页或预算中止显示缺项，单作业切片不冒充全课程完成。
  2. **[S/I/L]** 用户可读获准作业说明、rubric、提交入口信息与本人可见提交状态/记录，看到来源和采集时间；due/close/cutoff、个人延期保留原文、IANA 时区、解析状态及可确定 UTC，DST/缺时区/冲突不猜时间，不启动测验或提交。
  3. **[S/I/L]** 用户可读取本人可见成绩、rubric/正文反馈和附件引用，区分未评分、隐藏、provisional、final；不会推算成绩或展示其他账户私有记录。
  4. **[S/I/L]** 用户看到 confirmed empty 的身份/scope/结构与分页依据；partial/error/not_observed 不清旧记录，无证据不判删除。同内容重采集不造伪变化，稳定源键、revision/hash/locator 可追溯，parser 更新不改写旧引用。
  5. **[I/N/L]** 用户从实际安装入口启动 stdio MCP，经认证 HTTP 取得一门课程/一个作业的获准最小事实及真实后端版本；停止 API 后返回 BACKEND_UNAVAILABLE，不使用旧 helper/cache 或 injected callback 冒充接线，每次输出均执行权限门禁。

**Plans**: TBD

**Boundary**: 文件真实字节/全格式提取在 P5 验收；本阶段附件索引不能标为已下载或已提取。所有 live 检查仍先发布可获取新 beta，再停等用户更新和反馈。

### Phase 4: EdStem 线程与双源课程绑定

**Goal**: 用户可读取选定 Ed 课程的完整可见讨论，并在不混淆账户、学期或来源事实的前提下建立和撤销双源绑定。
**Depends on**: Phase 3；持续满足 Phase 2 门禁，Ed 逐操作访问路径和权限已确认。
**Requirements**: ED-01, BIND-01, ED-02
**Success Criteria** (what must be TRUE):

  1. **[S/I/L]** 用户可读取获准 Ed 课程线程、回复、正文与附件索引，并翻页到底或看到明确缺口；匿名不被还原，角色/置顶/accepted 等作为来源信号保留，不推断权威。
  2. **[S/I/L]** 用户确认 Moodle↔Ed 的课程/学期映射后才出现绑定；同名不自动合并，跨账号匹配被阻止，撤销错误绑定不破坏两边原始记录。
  3. **[S/I/L]** 用户能定位编辑和新增回复的前后版本，完整重查后缺失与未经证实的删除分开；权限/parser/分页失败保留旧观察并标 stale/partial，unsupported 不算双来源通过。

**Plans**: TBD

### Phase 5: 文件 manifest、全文与受控原件交付

**Goal**: 用户和获准客户端可对账课程资源、读取固定版本的全部获准文本并取得原文件真实字节，同时看清每一处缺口和交付限制。
**Depends on**: Phase 4（包含 Phase 3 来源事实）；TEXT-01/TEXT-02 细化范围已批准，相关 PLAN 仍须用户确认后才能实施。
**Requirements**: FILE-01, FILE-02, TEXT-01, TEXT-02, EVID-02, READ-01, READ-02, POL-01
**Success Criteria** (what must be TRUE):

  1. **[S/I/N/L]** 用户获得的获准原文件与 revision/hash/字节一致；中断续传不拼接不同版本，每跳 redirect/origin/IP/protocol/MIME/大小校验及路径防护阻止私网目标、路径逃逸和危险下载，失败有明确结果。
  2. **[S/I/N]** 每个发现资源都分别显示 discovery/fetch/archive/extraction/model_access；失败、超额、磁盘满、加密、损坏、不支持有原因。按已批准 TEXT-01/TEXT-02，规定格式的可见文本保留页/段/slide/sheet/row 与提取版本，公式/缓存和扫描缺口不混淆，ZIP 有界列出/解析安全成员；隐藏内容不自动采集，不执行宏/外链/云调用。
  3. **[S/I/L]** 用户可取得固定目录/资源版本的 CourseManifest/ResourceManifest，按来源、scope、hash、locator、采集时间、覆盖分母/缺项与权限对账归档对象；双源观察不被称为同一原子瞬时快照。
  4. **[S/I/N]** 客户端固定内容/提取版本后可分页至 end 并重建全部获准文本，并发同步不混版；失效/越权 cursor 明确失败且每页重查权限。支持的宿主能取得原文件真实字节并校验 hash；不支持二进制的宿主明确说明并提供全文兼容路径，不能仅返回本机路径或裸 bearer URL。
  5. **[S/I/L]** 用户在 MCP tool/resource、REST、文件、导出及诊断看到一致权限结果：获准资料正常读全；来源保留/外发权、scope、操作或目的地不满足时给具体例外和下一步，不泄漏标题/URL/片段，不借摘要绕过，也不默认所有资料 local_only。

**Plans**: TBD

**Boundary**: 本阶段完整验收材料交付策略，不是首次加权限检查。复杂图表/扫描/媒体等诚实报告缺口；不批准云 OCR、转录、隐藏资料或 DRM 绕过。

### Phase 6: 全课程生命周期、调度与恢复

**Goal**: 用户选定课程持续获得可解释的全量/增量归档，在故障、休眠、结课或容量不足时保留最后成功内容和长期历史。
**Depends on**: Phase 5。
**Requirements**: LIFE-01, LIFE-02, SYNC-01, SYNC-02, STORE-01, STORE-02
**Success Criteria** (what must be TRUE):

  1. **[S/I/L]** 用户可对账初始完整盘点、增量与周期完整检查，manifest 覆盖结构/页面/公告/讨论/文件/assessment/本人评分反馈；有界下载或预算中止保留 cursor/pending，不以 POC 或搜索结果代替课程覆盖。
  2. **[S/I/L]** 用户在结课或来源关闭后仍可查询已采集且获准保留的目录和版本；降低轮询和权限变更有显式状态，不伪造首次采集前历史，不假定保留许可等于永久外发许可。
  3. **[S/I/N/L]** Codex 退出、Worker/OS 重启或休眠恢复后，用户能看到持久调度有界补跑、checkpoint 与最后尝试/成功/完整时间；不产生积压周期风暴或重复 revision/change。关机、注销和休眠期间不承诺同步运行。
  4. **[S/I/L]** 用户手动同步即获 job_id 并可看进度/取消；暂时故障有上限，429 按明确响应退避，认证/403/parser drift 停止自动重试并给下一步，partial 不刷新 last_complete。
  5. **[S/I/N]** 用户在对象落盘、DB/投影/checkpoint/change 提交边界崩溃后仍见最后成功投影及 hash 匹配的引用，失效 token 不能提交；孤立文件回收不伤在写对象。磁盘满只暂停新增并列 pending，历史不自动删除，用户清理需范围预览/确认，已删引用显示不可用而不换正文。

**Plans**: TBD

**Evidence boundary**: synthetic 跨学期场景、当前/已结课授权样本和真实可观察变化分别记证据；不把模拟学期标为真实纵向验证。

### Phase 7: 完整管理 UI、CLI、MCP 与 Skill

**Goal**: 用户及实际配置的模型客户端通过同一独立后端管理同步、找齐资料、读全固定版本内容和查变化，不引入作业推理或生成职责。
**Depends on**: Phase 6；SEARCH-01/BUNDLE-01 细化范围已批准，相关 PLAN 仍须用户确认。
**Requirements**: UI-01, CLIENT-01, SEARCH-01, CHANGE-01, BUNDLE-01, MODEL-01, BOUND-01
**Success Criteria** (what must be TRUE):

  1. **[S/I/N/L]** 用户在管理页清楚查看连接、scope、任务、课程分类、正文/文件/版本、覆盖缺口与模型权限，错误带下一步且不渲染 unsafe HTML；CLI/MCP/Skill 经同一后端提供 health/connections/courses/manifests/resources/read/file/changes/sync/jobs，sync 回 job_id 并说明网络/本地写入，Skill 不开浏览器或后台循环。
  2. **[S/I]** 按已批准 SEARCH-01，可按 scope、类型、时间检索归档内容，分页结果带版本/locator/freshness/coverage，中英文按声明策略及样例匹配；搜索不绕过策略，也不把 top-k 当完整正文。
  3. **[S/I/L]** 用户/客户端按稳定 cursor 取得新增/编辑/有证据删除/不可访问等变化及前后版本，重复查询不重建事件。按已批准 BUNDLE-01，作业资料聚合固定 revision manifest，保留来源差异、原始 AI 声明和关联不确定性，不编译要求或裁定权威。
  4. **[I/N/L]** 用户实际配置的 Codex 经已安装 MCP 枚举课程/资料、固定 revision、逐页到 end 重建获准全文并取得宿主支持的原件；结果可追溯安装/API/Worker 版本。另有通用协议客户端合约证据但不声称所有宿主已测；后端无 LLM Key 仍可同步，源站失败如实显示非实时。
  5. **[S/I]** 用户检查 API/MCP/Skill 工具和依赖，不存在作业评估/规划/草稿审计/提交/生成入口，LLM 不成为同步依赖；恶意归档内容不能触发工具或扩大权限，独立下游项目业务不写入 AutoED 状态库。

**Plans**: TBD
**UI hint**: yes

### Phase 8: 跨平台交付、备份恢复与安全切换

**Goal**: 用户在两个原生平台完成全功能安装升级、故障恢复和新旧隔离切换，并根据实测证据判断 M1 是否达到发布条件。
**Depends on**: Phase 7；OPS-01 加密备份范围已批准，相关 PLAN 仍须用户确认；所有必需人工门禁保持有效。
**Requirements**: OPS-01, OPS-02, OPS-03, OPS-04, REL-01
**Success Criteria** (what must be TRUE):

  1. **[S/I/N/L]** 按已批准 OPS-01，可创建加密且一致的 DB+文件备份，在干净目录恢复并按 manifest 校验 hash/引用/历史，活动 WAL 不遗漏；错误密钥/中断明确失败。Profile 永不备份/导出，恢复来源需用户重新官方登录，不承诺旧 Chromium 可复用升级后的 Profile。
  2. **[S/I/N]** 两平台 beta 升级后所有实际入口调用新能力；下载/迁移/启动中断能恢复或安全停止，不兼容降级被拒绝。完成验收时受管理旧程序、启动引用和进程已清理，只有明确保留且隔离不活动的回滚副本可存在；失败可报 cleanup_pending，但不得宣称升级完成或通过本项，不混版、不删课程档案。
  3. **[I/N]** 用户在干净 macOS/Windows 通过完整提示词安装全部功能，明确启停用户级后台启动；重启、文件锁、长中文路径及权限保护通过原生检查，重复安装安全，卸载程序默认保留资料并说明影响。
  4. **[S/I/N]** 用户可核对新旧数据根/DB/端口/MCP 名/安装 ID 的隔离和切换预览；默认不写旧目录、不导入旧 Profile、不卸载旧产品，回退仅切换批准入口不改写旧资料，真正停用旧版另需用户批准。
  5. **[S/N/L]** 用户可查看与构建版本对应的两个来源、两个原生平台、全课程/全文/原件/生命周期、客户端、升级/恢复及人工结果清单；未完成项保持 not_run/blocked/failed，不产生虚假稳定声明。每次人工复验仍先可获取 beta、再用户更新/登录/反馈；只有用户明确缩小范围才能重定义完成。

**Plans**: TBD

## Coverage

| Primary phase | Requirement count | Approval interpretation | Verified |
|---------------|-------------------|-------------------------|----------|
| 1 | 8 | 目标、验收与阶段已批准 | 0 |
| 2 | 6 | 目标、验收与阶段已批准 | 0 |
| 3 | 8 | 目标、验收与阶段已批准 | 0 |
| 4 | 3 | 目标、验收与阶段已批准 | 0 |
| 5 | 8 | 含2项已批准 accepted_detail | 0 |
| 6 | 6 | 目标、验收与阶段已批准 | 0 |
| 7 | 7 | 含2项已批准 accepted_detail | 0 |
| 8 | 5 | 含1项已批准 accepted_detail | 0 |
| **Total** | **51** | **46 accepted_goal + 5 accepted_detail；整体已批准** | **0** |

**51/51** 有且只有一个主责阶段；**0** 孤项、**0** 重复主责分配。跨阶段回归不重新归属需求；完整索引在 REQUIREMENTS 的 Traceability 中。映射覆盖率不是批准率或实现通过率。

## Progress

**Execution Order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8。2026-09-01用户批准在Phase 1/Windows缺口保持可见的前提下先准备并执行Phase 2的macOS范围；这是顺序例外，不是验收豁免。Phase 2未通过且双平台硬门禁未补齐时仍不得推进Phase 3。Phase 1 的14份计划已批准并开始执行；Phase 2的41份计划已批准并开始执行。计划完成数不是阶段需求验收通过数。

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. 契约、原生骨架与最小 beta 安装升级 | 13/14 | Human UAT | - |
| 2. 双来源原生登录 POC 与 live 硬门禁 | 17/41 | In progress — drifted beta.22 invalidated; corrected beta.23 selected; not yet signed/published; Windows/live gates remain blocked | - |
| 3. Moodle 课程事实与首个实际 MCP 切片 | 0/TBD | Not started | - |
| 4. EdStem 线程与双源课程绑定 | 0/TBD | Not started | - |
| 5. 文件 manifest、全文与受控原件交付 | 0/TBD | Not started | - |
| 6. 全课程生命周期、调度与恢复 | 0/TBD | Not started | - |
| 7. 完整管理 UI、CLI、MCP 与 Skill | 0/TBD | Not started | - |
| 8. 跨平台交付、备份恢复与安全切换 | 0/TBD | Not started | - |

**Current stop:** Phase 1全部14份PLAN已获批，01-01至01-13已完成；01-14为部分通过，Windows及明确未观察项继续保持`not_run / human_needed`。Phase 2的02-01至02-12、02-35至02-38及02-41已完成；两层提示词纠正使`0.1.0-beta.22`永久失效，`0.1.0-beta.23`已在完整新鲜绿色质量门后选定，下一依赖序计划为02-39签名/本地验证。尚未签名或发布，44个真实L cell仍缺失；这不授权自动登录、live UAT或推进Phase3。

## Backlog

### Phase 999.1: GitHub 多账号与仓库身份显式配置 (BACKLOG)

**Goal:** 允许用户显式配置并核对 GitHub 用户与目标仓库身份，避免多 GitHub 账号环境中选择错误账号、同步或发布到错误仓库；不得与学校来源 Profile 或 Phase 2 认证状态混合。
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with `$gsd-review-backlog` when ready)
