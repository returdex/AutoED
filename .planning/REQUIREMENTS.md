# Requirements: AutoED — M1

**Defined:** 2026-08-26
**Review status:** approved
**Milestone:** M1 本地跨平台课程资料同步、归档与模型读取；已确认目标版本 0.1.0。
**Core Value:** 持续归档用户选定且有权保存的完整课程生命周期资料，并让获准客户端完整读取固定版本内容，明确来源、历史与缺口。

## Status and evidence rules

- 用户于 2026-08-26 确认全部51项需求、可观察验收、阶段映射及五项细化提案。`accepted_goal` 表示原已确认目标，`accepted_detail` 表示本次批准的 TEXT-01、TEXT-02、SEARCH-01、BUNDLE-01、OPS-01。批准不等于实现或验证；任何新增能力仍须另行批准。
- 所有复选框未勾选，所有证据 **not_run**。需求通过须有实现、实际测试记录和可定位版本，不能由旧 commit 726884c 或研究文档代替。
- **S** = synthetic/unit/contract/本地假站点；**I** = 真实 SQLite/文件/进程/HTTP 集成；**N** = 原生 macOS 与 Windows 安装运行/客户端测试；**L** = 用户授权真实学校、限定课程的 live UAT。N 不自动代表学校登录，S/I 不代表 L；组合表示全部所列证据都需要。
- N 的具体 OS/CPU 在 Phase 1 确认并公开实际测试矩阵，Linux/WSL 不代替 Windows。L 记录只含脱敏场景、构建版本、日期、结果和缺口；私有材料不进入 Git/CI。
- 每个需求只有一个**主责 Phase**；跨阶段约束从首次相关操作起生效，之后持续回归，不允许以主责阶段尚未到达为由绕过安全规则。
- 计划确认后可连续执行批准范围内自动工作；人工更新/登录/测试必须暂停。**beta 已推送且可获取 → 用户手动更新 → 人工 UAT**，不允许自动批准 human-verify 或将 live 缺口结转为通过。

## M1 Requirements

### 1. 基础、跨平台与早期分发

- [ ] **ARCH-01**: 用户关闭 Codex/MCP/管理页后 API 与 Worker 仍为独立可诊断进程；无 LLM Key 可启动并执行 synthetic 持久任务；停止 Worker 与停止 API 有不同健康状态。
  **验收证据:** I+N · **主责 Phase:** 1 · **目标依据:** accepted_goal

- [ ] **ARCH-02**: UI/CLI/MCP 通过同一 application 契约；依赖检查禁止 domain 导入 HTTP/MCP/Playwright/DB driver，MCP 进程不直接打开数据库或 Profile；最小真实 HTTP 请求可通。
  **验收证据:** S+I · **主责 Phase:** 1 · **目标依据:** accepted_goal

- [ ] **PLAT-01**: 用户能查看受支持 OS/CPU 与精确依赖清单；macOS/Windows 原生启动最小服务；lockfile 固定 runtime/library/browser，运行时核对实际 SQLite 引擎及 WAL 修复，未验证架构明确标注。
  **验收证据:** I+N · **主责 Phase:** 1 · **目标依据:** accepted_goal

- [ ] **SEC-01**: 本地控制面只绑定 loopback；未配对客户端、错误 Host/Origin、跨 scope 与伪造状态变更请求被拒绝；平台凭据/数据路径保护有效，Windows 不静默降级明文密钥文件。
  **验收证据:** S+I+N · **主责 Phase:** 1 · **目标依据:** accepted_goal

- [ ] **JOB-01**: API 入队返回 job_id；重启后任务仍在；多进程竞争只获一有效租约，失效 fencing token 不能提交；重复请求不产生重复业务提交，取消/有界重试有状态。
  **验收证据:** S+I+N · **主责 Phase:** 1 · **目标依据:** accepted_goal

- [ ] **DIST-01**: 用户能核对安装 manifest、API、Worker、CLI/MCP 的实际版本和构建身份；不兼容组件、错误入口或旧进程产生明确错误，不能显示升级成功；执行版本规则检查且不覆盖 beta 标签/产物。
  **验收证据:** S+I+N · **主责 Phase:** 1 · **目标依据:** accepted_goal

- [ ] **DIST-02**: 完整提示词在两平台干净测试用户环境安装所需 Node/浏览器及新服务；重复运行安全；用两个 synthetic beta 构建验证升级、入口切换、旧进程退出、失败恢复和最小用例实际调用。系统权限由用户确认。
  **验收证据:** I+N · **主责 Phase:** 1 · **目标依据:** accepted_goal

- [ ] **DIST-03**: 首个人工检查前已有可获取 beta、校验信息、安装/升级说明和支持矩阵；发布前核对 returdex 的 author/committer 与认证账号、LICENSE 和去敏产物；检测同名远程冲突即停止，禁止用 ywan1303。
  **验收证据:** S+I+N · **主责 Phase:** 1 · **目标依据:** accepted_goal


### 2. 来源登录与人工硬门禁

- [ ] **AUTH-01**: 用户由最小管理页开启独立专属 Profile，在官方窗口自己输入密码/MFA；Auth Probe 核对受保护正面标志、origin 和账户绑定，不仅判断 URL/200；登录期间没有秘密/输入值/网络原始资料进入输出。
  **验收证据:** S+L · **主责 Phase:** 2 · **目标依据:** accepted_goal

- [ ] **AUTH-02**: Moodle 与 EdStem 各自在声明的两个目标 OS 上完成：正常关闭重开三次、Worker/系统重启、Codex 退出后最小读取、至少 24 小时复查、退出/过期后 reauth 和真实账户绑定核对；每项单独记录，未跑/失败阻止依赖阶段。换号隔离反例另由 AUTH-03 的 S/I 验证，不要求未授权第二个真实账号。
  **验收证据:** N+L · **主责 Phase:** 2 · **目标依据:** accepted_goal

- [ ] **AUTH-03**: 用户能分别看到 auth、capability、health、freshness、completeness；未登录、权限拒绝、网络失败、parser 变化与换号/identity_mismatch 在合成与真实持久化反例中显示不同原因和下一步且不串数据；live 单独确认实际账户/授权范围与认证状态，不需故意制造真实 parser/网络故障，旧数据不被错误覆盖。
  **验收证据:** S+I+L · **主责 Phase:** 2 · **目标依据:** accepted_goal

- [ ] **AUTH-04**: 同一 Profile 登录/同步并发时只有一个持有者；崩溃、取消、租约丢失后只回收本任务进程，旧 Worker 不再请求/提交；不会删除仍在用的浏览器锁或终止日常浏览器。
  **验收证据:** S+I+N · **主责 Phase:** 2 · **目标依据:** accepted_goal

- [ ] **SEC-02**: 所有真实 connector 操作具已批准来源/用途 allowlist；恶意页面、任意 URL/JS/selector 和越界课程请求不能扩大权限；提交、发帖、测验启动、作业上传等业务写操作不可达，无 Cookie 桥接或未授权端点回退。
  **验收证据:** S+I+L · **主责 Phase:** 2 · **目标依据:** accepted_goal

- [ ] **UAT-01**: 每个人工场景前提供已推送 beta 版本、可执行更新提示词与步骤/预期；用户更新和官方登录后才记录 live 结果。发布失败、无法更新、缺设备或待跨日复查均为 human_needed/not_run，不得填 pass 或推进依赖。
  **验收证据:** S+N+L · **主责 Phase:** 2 · **目标依据:** accepted_goal


### 3. Moodle 课程信息与首个真实 MCP 切片

- [ ] **SCOPE-01**: 用户明确选择学校/账户/学期/课程；同名跨学期、跨账号与跨课程数据不能串读；切换身份不能覆盖前一账户资料，未确认 scope 不启动采集。
  **验收证据:** S+I+L · **主责 Phase:** 3 · **目标依据:** accepted_goal

- [ ] **MOOD-01**: 从单课程/单作业切片扩展到选定 Moodle 课程的目录、周次、可见页面、公告和资源/附件清单；与用户可核对的范围清单对账，分页/预算未完成显示缺口。
  **验收证据:** S+I+L · **主责 Phase:** 3 · **目标依据:** accepted_goal

- [ ] **MOOD-02**: 用户可读取获准作业说明、rubric、提交入口信息及本人可见提交记录/状态，保留来源定位和采集时间；不打开活动测验或执行提交。
  **验收证据:** S+I+L · **主责 Phase:** 3 · **目标依据:** accepted_goal

- [ ] **MOOD-03**: 用户可读取本人可见成绩、rubric 反馈、反馈正文及附件引用；未评分/隐藏/provisional/final 保留区别，不推算成绩，不暴露其他账户私有记录。
  **验收证据:** S+I+L · **主责 Phase:** 3 · **目标依据:** accepted_goal

- [ ] **TIME-01**: due/close/cutoff、公开/个人延期分别保存原文、IANA 时区、解析状态和可确定 UTC；DST、无时间/时区与来源冲突测试不自动补 23:59 或裁定唯一正确值。
  **验收证据:** S+L · **主责 Phase:** 3 · **目标依据:** accepted_goal

- [ ] **DATA-01**: confirmed empty 必须同时通过身份、scope、结构/空态与分页完成检查；partial/error/not_observed 不清空旧记录；无删除证据不能把暂时消失当删除。
  **验收证据:** S+I+L · **主责 Phase:** 3 · **目标依据:** accepted_goal

- [ ] **EVID-01**: 稳定源键不依赖标题；同内容重采集只更新 observation，不创建伪变化；固定 revision/hash/locator 可追溯，原文件内容与 parser 版本分开，旧引用不指向新文本。
  **验收证据:** S+I · **主责 Phase:** 3 · **目标依据:** accepted_goal

- [ ] **MCP-01**: 从实际启动的 stdio MCP 经认证本地 HTTP 读取一门课程/一个作业的获准最小信息，结果指向真实后端版本；后端停机返回 BACKEND_UNAVAILABLE，不借旧 helper/cache 或 injected callback 冒充。
  **验收证据:** I+N+L · **主责 Phase:** 3 · **目标依据:** accepted_goal


### 4. EdStem 与双源绑定

- [ ] **ED-01**: 在已获准且实证可用路径读取选定 Ed 课程线程、回复、可见正文与附件索引；分页到底或报告明确缺口，匿名不还原身份，原始角色/置顶/accepted 等信号不作权威推理。
  **验收证据:** S+I+L · **主责 Phase:** 4 · **目标依据:** accepted_goal

- [ ] **BIND-01**: 用户确认 Moodle↔Ed 的课程/学期映射后才建立绑定；同名不自动合并，错误绑定可撤销且不破坏原来源记录，跨账号匹配被阻止。
  **验收证据:** S+I+L · **主责 Phase:** 4 · **目标依据:** accepted_goal

- [ ] **ED-02**: 编辑、回复新增与完整重查后的缺失分别产生可定位版本/变化；权限、parser、分页失败保留旧观察并标 stale/partial，unsupported 不能算双源通过。
  **验收证据:** S+I+L · **主责 Phase:** 4 · **目标依据:** accepted_goal


### 5. 文件归档、完整可读化与交付策略

- [ ] **FILE-01**: 获准下载经逐次 redirect/origin/IP/protocol/MIME/大小校验，临时文件校验后归档；中断续传须验证同版本，文件 hash/字节与 revision 一致，安全反例不能访问本机私有目标或路径。
  **验收证据:** S+I+N+L · **主责 Phase:** 5 · **目标依据:** accepted_goal

- [ ] **FILE-02**: 每个发现的资源分别显示 discovery/fetch/archive/extraction/model_access；下载失败、超额、磁盘满、加密、损坏、不支持均有记录及原因，不静默漏项、不冒称已提取。
  **验收证据:** S+I · **主责 Phase:** 5 · **目标依据:** accepted_goal

- [ ] **TEXT-01**: PDF、DOCX、PPTX、XLSX/CSV、TXT/MD/HTML/代码可提取获准可见文本；保留物理页/段/slide/sheet/row 定位、公式与缓存值区别及提取版本；扫描件/图表/公式缺口明确标 partial/needs_ocr，禁止宏/外部资源/云模型调用；隐藏sheet/行列/修订/备注不能因解析器可见就自动扩大采集。
  **验收证据:** S+I+N · **主责 Phase:** 5 · **目标依据:** accepted_detail

- [ ] **TEXT-02**: ZIP 提供安全目录清单，受支持子文件有界解析；路径逃逸、symlink、压缩炸弹、嵌套/超时/资源限制均被拦截并留原因，未知类型保留获准原文件但不执行。
  **验收证据:** S+I+N · **主责 Phase:** 5 · **目标依据:** accepted_detail

- [ ] **EVID-02**: CourseManifest/ResourceManifest 固定目录与资源版本，包含来源、scope、hash、定位、采集时间、覆盖分母/缺项和权限；与归档对象可对账，不宣称双来源是原子同时快照。
  **验收证据:** S+I+L · **主责 Phase:** 5 · **目标依据:** accepted_goal

- [ ] **READ-01**: 客户端可在固定内容/提取版本上分页直到 end 并重建全部获准文本；并发同步不造成漏读/混版，cursor 越权/失效明确报错，每页检查当前权限；搜索 top-k 不替代完整读取。
  **验收证据:** S+I+N · **主责 Phase:** 5 · **目标依据:** accepted_goal

- [ ] **READ-02**: 支持的调用方能取得获准原文件真实字节并校验 hash，而非仅有本机路径或裸 bearer URL；不支持二进制的宿主有明确能力说明与全文工具兼容路径，不假报二进制可用。
  **验收证据:** S+I+N · **主责 Phase:** 5 · **目标依据:** accepted_goal

- [ ] **POL-01**: MCP tool/resource、REST、文件、导出及诊断出口一致检查来源保留/外发权、用户scope、操作和目的地；允许资料正常分页读取，受限或依据未知资料返回具体例外，连标题/URL/片段也不越权；不通过摘要绕过限制。
  **验收证据:** S+I+L · **主责 Phase:** 5 · **目标依据:** accepted_goal


### 6. 全课程生命周期与恢复

- [ ] **LIFE-01**: 选定课程有初始完整盘点、有界下载、增量和周期完整对账；manifest 覆盖结构/页面/公告/讨论/文件/assessment/本人评分反馈，不以单作业POC代表完整课程。预算中止保留 cursor/pending。
  **验收证据:** S+I+L · **主责 Phase:** 6 · **目标依据:** accepted_goal

- [ ] **LIFE-02**: 课程结束或源站关闭后，已采集且仍获准保留的版本/目录可查询；降低轮询与权限变更有显式状态，不伪造首次采集前已删除历史，不自动假定历史永远可外发。
  **验收证据:** S+I+L · **主责 Phase:** 6 · **目标依据:** accepted_goal

- [ ] **SYNC-01**: 周期调度持久化；Codex 退出、Worker/系统重启、休眠唤醒后有界补跑，不回放大量过期周期；任务、checkpoint、最后尝试/成功/完整时间准确且无重复 revision/change。
  **验收证据:** S+I+N+L · **主责 Phase:** 6 · **目标依据:** accepted_goal

- [ ] **SYNC-02**: 手动同步立即返回 job_id，进度/取消可见；429按明确响应退避，暂时故障有上限，认证/403/parser drift停止自动重试并给下一步，partial不刷新last_complete。
  **验收证据:** S+I+L · **主责 Phase:** 6 · **目标依据:** accepted_goal

- [ ] **STORE-01**: 文件落盘与DB revision/projection/checkpoint/change提交边界逐点杀进程后可恢复；失效token无提交，旧projection保留，引用对象存在且hash匹配，孤立文件安全回收不伤在写对象。
  **验收证据:** S+I+N · **主责 Phase:** 6 · **目标依据:** accepted_goal

- [ ] **STORE-02**: 资料与历史默认长期保留；磁盘额度耗尽暂停新增并列pending，不自动删历史；用户清理有范围预览/确认，删除后的旧引用显示不可用而非替换正文。
  **验收证据:** S+I+N · **主责 Phase:** 6 · **目标依据:** accepted_goal


### 7. 管理页、CLI、MCP 与模型实际读取

- [ ] **UI-01**: 用户在管理页查看连接、范围、任务、课程分类、正文/文件/版本、覆盖缺口与模型权限；错误有可执行下一步，不渲染带脚本原始HTML，不把多个状态合成一个ready。
  **验收证据:** S+I+N+L · **主责 Phase:** 7 · **目标依据:** accepted_goal

- [ ] **CLIENT-01**: CLI/MCP/Skill 通过同一后端提供health/connections/courses/manifests/resources/read/file/changes/sync/jobs；sync返回job_id且诚实标网络/本地写入，Skill不启动浏览器或后台循环。
  **验收证据:** S+I+N · **主责 Phase:** 7 · **目标依据:** accepted_goal

- [ ] **SEARCH-01**: 用户可按scope、类型与时间搜索已归档内容，结果带版本/locator/freshness/coverage及分页；英文与中文匹配采用声明策略并有样例验收，不能通过搜索绕过策略或伪称覆盖全文。
  **验收证据:** S+I · **主责 Phase:** 7 · **目标依据:** accepted_detail

- [ ] **CHANGE-01**: 用户/客户端按稳定cursor取得新增/编辑/删除证据/不可访问等变化及前后版本；重复查询不重建事件，变化记录只给来源事实，不生成学习或作业行动建议。
  **验收证据:** S+I+L · **主责 Phase:** 7 · **目标依据:** accepted_goal

- [ ] **BUNDLE-01**: 作业信息可聚合为固定revision manifest，保留来源差异、原始AI声明与关联不确定性；不编译要求、不裁定教师权威、不评估作业。
  **验收证据:** S+I+L · **主责 Phase:** 7 · **目标依据:** accepted_detail

- [ ] **MODEL-01**: 实际配置的 Codex 客户端通过安装后的 MCP 找到课程、枚举资料、逐页读完整获准文本并取得支持的文件；另有通用协议客户端合约测试。能追到后端/安装版本，无LLM Key仍可同步，源站失败不伪装实时。
  **验收证据:** I+N+L · **主责 Phase:** 7 · **目标依据:** accepted_goal

- [ ] **BOUND-01**: 对API/MCP/Skill与依赖做检查，无评估/规划/草稿审计/提交/生成工具，无LLM服务是同步依赖；受控资料注入不能启动工具或扩权，独立下游项目不在AutoED状态库中持有业务。
  **验收证据:** S+I · **主责 Phase:** 7 · **目标依据:** accepted_goal


### 8. 完整交付、备份与安全切换

- [ ] **OPS-01**: 用户可创建加密且一致的DB+文件备份，干净目录恢复后按manifest核对hash/引用/历史；活动WAL不遗漏，Profile不备份/导出，恢复来源需重新人工登录；错误密钥/中断明确失败。
  **验收证据:** S+I+N+L · **主责 Phase:** 8 · **目标依据:** accepted_detail

- [ ] **OPS-02**: 两平台从旧beta升级到新beta/正式候选后实际所有入口调用新能力；注入下载/迁移/启动故障可恢复或安全停止，拒绝不兼容降级；完成验收时清除受管理旧程序/启动项/进程，仅保留明确隔离的回滚副本，无版本混用和资料丢失；cleanup_pending可诊断但不得报告升级完成。
  **验收证据:** S+I+N · **主责 Phase:** 8 · **目标依据:** accepted_goal

- [ ] **OPS-03**: 干净原生两平台按完整提示词安装可运行；用户可明确启用/禁用用户级后台启动；重启/文件锁/长中文路径/权限保护可验收，卸载程序默认保留资料并说明影响。
  **验收证据:** I+N · **主责 Phase:** 8 · **目标依据:** accepted_goal

- [ ] **OPS-04**: 用户可查看新旧数据根、DB、端口、MCP名和安装标识隔离及切换预览；默认不写旧目录、不导入Profile、不卸载旧版；回退只切换获准入口，旧资料不改写，真实旧版停用须另行批准。
  **验收证据:** S+I+N · **主责 Phase:** 8 · **目标依据:** accepted_goal

- [ ] **REL-01**: 发布验收清单把两个来源、两个原生平台、全文/文件/生命周期覆盖、升级/恢复与人工结果逐项对应版本；未完成项是not_run/blocked而非pass，不发布虚假稳定声明；只有用户明确缩小范围才能重定义完成。
  **验收证据:** S+N+L · **主责 Phase:** 8 · **目标依据:** accepted_goal


## Coverage and scope interpretation

- `complete_for_scope` 只指已声明课程、类型、分页与观察窗口；不代表全校、所有历史、隐藏内容或未经授权媒体全部可得。
- 录播/外链/LTI 的可见入口和 metadata 进入资源盘点；原媒体/字幕只在获准下载且 adapter 支持时归档，否则 manifest 留具体原因。首版不要求云转录/OCR服务，不绕过 DRM。
- 教师已公开且允许保留的练习/样卷/解答可作为普通资料归档；不进入活动测验或取得隐藏答案。
- 全生命周期验收使用synthetic跨学期变化、用户指定的当前/已结课可访问样本和可观察真实变化；不能把模拟学期当真实纵向证据，也不要求伪造首次采集前的历史。
- P1发布最小基础beta，P2发布认证POC beta后才人工测试，P3以后每次需人工检查的新能力均先发新beta；P8是最终交付加固，不是首次建立可更新通道。
- 同源权限 gate 在第一条真实读取/输出前就必须存在；P5负责完整材料交付策略验收，P7再次在实际客户端验证，不能在P3烟测时泄漏未经批准资料。

## Beyond M1

无已批准 M2/M3。更多解析格式、学校适配、旧metadata导入、自动后台更新等仅能在新需求明确后 proposed；当前不建立相关未来阶段。

## Out of Scope

| Exclusion | Reason |
|-----------|--------|
| EvidenceLens/AssignmentFlow、作业评估/要求推理/规划/执行/生成 | 独立项目职责，不是AutoED未来里程碑 |
| Gmail、Browserbase、远程服务、多用户、复杂通知/第三方推送 | 当前用户明确排除 |
| LLM Key依赖、后台总结、向量数据库、云OCR/转录 | 基础同步/格式转换不依赖生成模型；新增服务另行批准 |
| 源站业务写操作、隐藏内容、Cookie桥接/宿主Profile复用、未经授权API | 安全及访问权限硬边界 |
| Linux强制支持、复杂桌面壳、后台无提示自动升级 | 未批准为M1必需 |
| 自动发布本轮规划、改旧标签、卸载旧版或复制旧运行数据 | 本轮仅建项；新旧隔离且操作授权分别处理 |

## Traceability

上方每个需求的主责 Phase 是唯一映射；下面列出完整索引，状态全部 Pending。

| Requirement | Phase | Status | Required evidence |
|-------------|-------|--------|-------------------|
| ARCH-01 | Phase 1 | Pending | I+N |
| ARCH-02 | Phase 1 | Pending | S+I |
| PLAT-01 | Phase 1 | Pending | I+N |
| SEC-01 | Phase 1 | Pending | S+I+N |
| JOB-01 | Phase 1 | Pending | S+I+N |
| DIST-01 | Phase 1 | Pending | S+I+N |
| DIST-02 | Phase 1 | Pending | I+N |
| DIST-03 | Phase 1 | Pending | S+I+N |
| AUTH-01 | Phase 2 | Pending | S+L |
| AUTH-02 | Phase 2 | Pending | N+L |
| AUTH-03 | Phase 2 | Pending | S+I+L |
| AUTH-04 | Phase 2 | Pending | S+I+N |
| SEC-02 | Phase 2 | Pending | S+I+L |
| UAT-01 | Phase 2 | Pending | S+N+L |
| SCOPE-01 | Phase 3 | Pending | S+I+L |
| MOOD-01 | Phase 3 | Pending | S+I+L |
| MOOD-02 | Phase 3 | Pending | S+I+L |
| MOOD-03 | Phase 3 | Pending | S+I+L |
| TIME-01 | Phase 3 | Pending | S+L |
| DATA-01 | Phase 3 | Pending | S+I+L |
| EVID-01 | Phase 3 | Pending | S+I |
| MCP-01 | Phase 3 | Pending | I+N+L |
| ED-01 | Phase 4 | Pending | S+I+L |
| BIND-01 | Phase 4 | Pending | S+I+L |
| ED-02 | Phase 4 | Pending | S+I+L |
| FILE-01 | Phase 5 | Pending | S+I+N+L |
| FILE-02 | Phase 5 | Pending | S+I |
| TEXT-01 | Phase 5 | Pending | S+I+N |
| TEXT-02 | Phase 5 | Pending | S+I+N |
| EVID-02 | Phase 5 | Pending | S+I+L |
| READ-01 | Phase 5 | Pending | S+I+N |
| READ-02 | Phase 5 | Pending | S+I+N |
| POL-01 | Phase 5 | Pending | S+I+L |
| LIFE-01 | Phase 6 | Pending | S+I+L |
| LIFE-02 | Phase 6 | Pending | S+I+L |
| SYNC-01 | Phase 6 | Pending | S+I+N+L |
| SYNC-02 | Phase 6 | Pending | S+I+L |
| STORE-01 | Phase 6 | Pending | S+I+N |
| STORE-02 | Phase 6 | Pending | S+I+N |
| UI-01 | Phase 7 | Pending | S+I+N+L |
| CLIENT-01 | Phase 7 | Pending | S+I+N |
| SEARCH-01 | Phase 7 | Pending | S+I |
| CHANGE-01 | Phase 7 | Pending | S+I+L |
| BUNDLE-01 | Phase 7 | Pending | S+I+L |
| MODEL-01 | Phase 7 | Pending | I+N+L |
| BOUND-01 | Phase 7 | Pending | S+I |
| OPS-01 | Phase 8 | Pending | S+I+N+L |
| OPS-02 | Phase 8 | Pending | S+I+N |
| OPS-03 | Phase 8 | Pending | I+N |
| OPS-04 | Phase 8 | Pending | S+I+N |
| REL-01 | Phase 8 | Pending | S+N+L |

**Coverage:** 51 requirements; 51 mapped; 0 unmapped; 0 duplicate primary assignments; 0 verified. Accepted details (2026-08-26): TEXT-01, TEXT-02, SEARCH-01, BUNDLE-01, OPS-01.

---
*Last updated: 2026-08-26 after explicit user approval of all 51 requirements and the eight-phase roadmap; implementation not started.*
