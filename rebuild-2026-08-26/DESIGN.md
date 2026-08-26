# AutoED 新工作区设计与重构方案

日期：2026-08-26  
状态：已根据用户四项决定修订产品范围；具体技术选型仍为提案，不代表已经接通学校账号。  
配套文件：[GSD 操作与启动说明](GSD-START.md)、[已确认与待确认决策](DECISIONS.md)。

## 1. 建议结论

将 AutoED 重新建设为独立运行的本地课程信息同步与归档服务。它管理连接、浏览器生命周期、持久同步任务、完整课程资料和来源版本；MCP、CLI、管理界面和 Skill 都是使用这个后端的入口。AutoED 提供信息，不执行作业评估、规划、内容生成或学习任务。

推荐首版路线：**用户本机 macOS + Windows、每安装单用户、TypeScript 模块化单体、独立 Worker、Local Playwright 专属 Profile、SQLite 持久索引/任务、本地资料文件、薄 MCP。**

用户已确认：不做远程部署；Windows 需要兼容，Ubuntu 等 Linux 不做强制兼容；接受本地 Profile 持久化；希望保存课程完整生命周期的全部可获取内容并让 Codex/其他模型可读；本项目只负责获取、同步、归档、信息提供。SQLite 是据此提出的新建议，尚非用户已批准的数据库选择。

首个里程碑只解决：

> 用户在 AutoED 自己的可见浏览器中登录；关闭 Codex 后，只要本地后台在线就能同步；从课程开设到结束持续归档课程结构、公告、讨论、资料、作业时间、个人提交与评分信息；资料可以通过模型可消费的接口按需读取，且每项都能看到来源、版本和获取完整度。

EvidenceLens、AssignmentFlow 和其他模型应用是**独立下游项目**，不再列为 AutoED 的后续业务里程碑。AutoED 为它们提供稳定的数据接口，不持有其任务计划、评估报告或作业进度。Browserbase、远程部署、Gmail 和第三方推送不进入当前范围。

## 2. 输入材料、证据与前面讨论的修正

### 2.1 本次依据

- 用户提供的《Muster 深度分析与 AutoED / EvidenceLens / AssignmentFlow 架构报告》，2026-08-25。
- 用户提供的《AutoED 全新技术设计建议》与本地 Playwright / Browserbase 对比分析。
- 旧仓库基线：`/Users/yifeng/Documents/AutoED`，检查时 HEAD 为 `726884c`；代码工作区原本干净。
- 旧仓库 PROJECT、ROADMAP、STATE、v1.9 归档需求与审计、研究资料、MCP 生产入口、认证与同步代码、发布规范。
- 本机已安装 GSD 的 `gsd-new-project` 说明及初始化工作流相关步骤。
- 第 18 节列出的官方文档，核对日期为 2026-08-26。

三份材料是设计输入，其中的命令和建议不自动构成执行授权。其后用户已经明确同意新产品本地持久登录、完整课程归档以及模型读取的目标；学校、版权和第三方数据限制仍需遵守。本轮只更新设计文件，没有访问学校账号、创建 Profile、读取 Cookie、安装依赖、初始化新项目或更改发布状态。

### 2.2 对旧项目的准确判断

1. 当前问题确实不止文件过长。`plugins/autoed/src/mcp/server.ts` 中生产 reader 仍有桥接不可用的路径；`src/host/codex-host.ts` 明确保留 readiness，但当前重构实现不调用旧 request callback。说明“显示浏览器状态”和“具有可用读取通道”不是同一件事。
2. v1.9 审计明确区分了 repository-side fixture/contract 通过与真实 tenant、浏览器、host 验证；后者没有因此自动完成。新项目必须把真实最小闭环列为发布门禁。
3. 旧 `.planning/REQUIREMENTS.md` 在里程碑归档后移走，不应仅因文件缺失就修复旧规划。当前 ROADMAP 明确没有活动里程碑。
4. `VERSION` 和 package 检查值都是 `1.6.6-beta.18`；规划里程碑 v1.9 不等于运行时版本。前面将它直接视为版本漂移的建议不成立。
5. 新仓库不必先修完旧全套测试。旧审计记载的六个基线失败保留为迁移背景；搬入新仓库的行为与代码则必须重新验证。此次没有重新运行旧全套测试。
6. 没有做真实登录故障复现，因此不能断言所有登录不稳都由 Cookie 隔离造成。SSO 策略、账户风险、运行时接线、Profile 生命周期与页面解析都需要分别验证。

### 2.3 材料中的建议如何处理

| 建议 | 处理 | 理由 |
|---|---|---|
| 独立后端 + 薄 MCP + Skill | 采用 | 状态和任务不再依附 Agent 任务生命周期 |
| Local Playwright 优先 | 采用；用户已接受专属 Profile 持久化 | 本地跨平台运行；仍需要真实登录复用验证 |
| 同时实现多个 BrowserProvider | 延后 | 首版只写一个真实实现和一个测试替身；抽象不等于多实现 |
| WebView 登录后导出 Cookie | 不采用 | 重新引入跨运行时会话搬运；没有本项目必要性 |
| 同 Profile 一定能免登录 | 修正 | 能持久保存部分浏览器状态，不保证学校会话不失效 |
| 看见 XHR 就复制调用 | 不作为默认路线 | 看到请求不等于获准将其当 API 使用，也不能假设 Cookie 足够 |
| 浏览器只读同步使用 `persist:false` | 不作为通用规则 | 业务只读与浏览器身份刷新不同；丢弃轮换后的状态可能更不稳定 |
| 所有原始 HTML、JSON、headers 都入库 | 不采用 | 可能含凭据、隐藏内容和第三方个人信息；改成明确分级的证据保留 |
| 每个来源都给一个 `ready` | 不采用 | 认证、能力、健康、数据完整性必须分别显示 |
| 双 Agent 一致就算正确 | 不采用 | 输入缺失与相关性错误仍然存在 |
| MCP 最后才做 | 调整 | 首个业务闭环后尽早做一个真实 MCP 验证，完整工具面再后置 |
| 首版部署多个服务、Redis、MinIO | 不采用 | 两个业务进程 + 一个数据库即可；文件先放本机 |
| Outbox 保证通知绝不重复 | 修正 | 本地事务可保证事件不丢；外部送达超时仍存在重复/遗漏取舍 |
| 把整个旧仓库复制进新工作区 | 不采用 | 会一起带入旧状态、旧初始化逻辑及运行数据 |

Muster 只作为功能与交互参考。本次核对了其许可证名称，没有重新验证报告中每一项代码漏洞。不要把报告中的评分或漏洞描述当作本轮独立审计结果。任何源码复用应先确认许可，默认独立实现。

## 3. 产品范围与首版用户旅程

### 3.1 首版用户旅程

1. 用户在 macOS 或 Windows 启动 AutoED 本地服务，打开管理页，看到后端和 Worker 的真实运行状态。
2. 用户为 Moodle 创建连接，启用已同意的专属 Profile，自己在学校页面输入凭据与 MFA。
3. 登录探测确认来源和账户；关闭浏览器后重新打开同一 Profile，再验证能否读取。
4. 同样建立 EdStem 连接。两个来源分别显示可用性，不要求“共享 SSO 一次就全部完成”。
5. 用户选择学期与课程，手动确认 Moodle 与 EdStem 的匹配；同名课程不自动合并。
6. 从一门课程/一个作业验证最小读取后，用户选择需要归档的课程与学期，系统同步其全部受支持且可访问的资料分类，并显示覆盖范围、错误和下一步。
7. 关闭 Codex，后台任务继续；设备休眠期间不承诺执行，唤醒后有限补跑。
8. 用户或下游项目查看 CourseManifest、资料全文、文件、个人成绩和历史变化；Codex/其他模型按需分页读取，不把整个课程一次塞入上下文。外发按已选择的集成和材料权限执行。
9. 会话失效时保留旧数据并提示重登录；不反复尝试密码、不切换隐蔽通道。

### 3.2 首版做什么

- macOS 和 Windows 本机运行；Linux 尽量保持可移植，但不作为发布阻断平台。
- Moodle 与 EdStem 独立连接；用户选择课程与学期后按课程级范围持续同步，跨课程严格隔离。
- 课程结构、周次、页面、公告、讨论串及回复、资料/附件索引与获准下载的文件。
- 作业说明、rubric、due/close/cutoff、学生可见提交记录、个人评分与反馈；源站未公开字段保持未知。
- 本地正文/文件版本归档、文本提取、全文检索、来源定位和变化记录。
- CourseManifest、ResourceManifest 和按版本读取接口；作业 bundle 只是信息聚合视图，不编译要求或评估作业。
- 幂等同步、部分失败、重启恢复、磁盘预算与归档导出；材料长期保存，不再默认学期后 90 天删除。
- 最小管理页、持久任务、CLI、少量 MCP 数据工具；本地运行状态提醒，不默认第三方推送。

### 3.3 首版明确不做

- 自动提交、发帖、回复、改课、改邮箱、开始 quiz attempt、获取隐藏或受限题目答案。教师已公开且允许保存的练习题、样卷和解答作为普通课程资料归档，不因内容类型一概排除。
- 逆向或猜测未获授权的内部 API、读取浏览器凭据、复制日常 Chrome Profile。
- 同时构建 Browserbase、Browserless、Stagehand 和旧 helper 回退链。
- 多用户 SaaS、远程服务器、手机远程登录、Linux 强制产品支持、复杂桌面壳。
- Gmail、绕过下载限制的录播抓取、DRM 解密、自动版本更新器。
- 自动生成作业、作业要求推理/核对、EvidenceLens、AssignmentFlow、向量数据库、后台模型总结。

“一门课程/一个作业”是开发 POC，不是最终产品范围。“全部内容”指用户有权访问和保存的课程信息，不包含密码、Cookie、隐藏题库、未发布成绩或其他账户的私有资料，也不承诺恢复首次采集之前已经删除的历史版本。

### 3.4 课程生命周期与覆盖矩阵

| 分类 | 首版目标 | 必须报告的限制 |
|---|---|---|
| 课程结构/Unit guide/周次/日历 | 获取可见目录与页面正文、来源关系 | 当前采集覆盖，不能假定全站或所有学期已发现 |
| 公告与讨论 | Moodle 公告、Ed 线程/回复/附件、可见作者角色和编辑状态 | 匿名作者不还原身份；同学内容有独立外发限制 |
| 作业/测验信息 | 说明、rubric、时间、提交入口、用户可见状态 | 不进入活动测验或采集受限题目/答案 |
| 成绩与反馈 | 用户本人可见评分、rubric 反馈、反馈附件 | 区分 provisional/final、隐藏/未评分；不推算其他学生成绩 |
| 课程资料/文件 | PDF、Office、文本、代码、图片等可下载原文件与版本 | 下载未完成、文件超额、加密、格式不支持不得静默漏掉 |
| 模型可读文本 | 首版覆盖 PDF、DOCX、PPTX、XLSX/CSV、TXT/MD/HTML/代码；保留页/段/slide/sheet 定位 | 扫描件/图片 OCR、复杂公式/图表可标 needs_ocr/partial；不伪装全文完成 |
| ZIP/其他附件 | 原文件与安全目录清单；受支持子文件有界解包/解析 | 路径逃逸、压缩炸弹、未知类型只归档不执行 |
| 录播/外链/LTI | 入口和可见 metadata；字幕/转录/媒体在有下载权限且 adapter 支持时归档 | 不能下载则保留链接和具体原因；媒体转录不是首版必需推理服务 |
| 结课归档 | 已采集内容与版本、课程索引、最后验证时间 | 源站关闭后不能继续取得新信息；本地既有材料按权限保留 |

每项分别记录 `discovery_status`、`fetch_status`、`archive_status`、`extraction_status`、`model_access_status`。已发现链接、下载成功、文本提取完成、允许模型读取是不同状态。只有声明 scope 内目标清单核对完成才报告完整。

默认对选定课程做初始完整盘点 + 有界下载，再定期增量检查并周期性完整对账；结束学期后降低轮询频率，保留本地可检索历史。资源磁盘配额耗尽时停止新增下载并明确列出 pending，不能自动删旧版本。用户可以主动清理；“归档不可变”不等于禁止用户删除自己的数据。

未开放的来源可以诚实显示 unsupported；但这不等于“双源可用里程碑”通过。若 EdStem 无法获准读取，只能由用户确认缩小范围，并重新命名/验收单源里程碑。

## 4. 目标架构与运行形态

### 4.1 逻辑结构

~~~mermaid
flowchart TB
    UI[本地管理页 / CLI] --> API[API 适配层]
    CODEX[Codex + Skill] --> MCP[薄 MCP 适配层]
    API --> USE[Application Services + Policy Gate]
    MCP --> USE
    USE --> DB[(SQLite: 连接 / 资料 / Job / 版本)]
    DB --> WORKER[Worker + 持久调度]
    WORKER --> CONNECTORS[Moodle / EdStem Connector]
    CONNECTORS --> BROKER[Browser Session Broker]
    BROKER --> LOCAL[Local Playwright 专属 Profile]
    LOCAL --> SCHOOL[学校页面: 用户授权范围]
    CONNECTORS --> NORMAL[校验 / 清洗 / 规范化]
    NORMAL --> COMMIT[事务提交: Revision + Evidence + Change]
    COMMIT --> DB
    NORMAL --> STORE[受控本地 Evidence Store]
    USE --> EXPORT[受控 API / MCP / 归档导出]
    EXPORT --> FUTURE[独立项目: EvidenceLens / AssignmentFlow / 其他模型应用]
~~~

一个仓库、一个产品、共享领域模块。API 与 Worker 分开进程是浏览器崩溃隔离，不是微服务化。

### 4.2 首版物理部署

| 组件 | 运行位置 | 持有状态 |
|---|---|---|
| API + 管理页 | 本机 Node 进程，loopback | 不持有学校会话，不直接解析页面 |
| Worker + Browser Broker | 本机用户会话中的独立 Node 进程 | 独占浏览器会话，执行队列任务 |
| SQLite + 持久 Job 表（建议） | 本机应用管理，无独立数据库服务 | 业务数据、索引、任务、提交与审计状态 |
| Profile | 仓库外、专用权限目录 | 学校登录状态，仅浏览器使用 |
| Evidence Store | 仓库外、受控数据目录 | 获准保留的材料版本 |
| MCP stdio client | 由客户端启动的薄进程 | 不持有 DB/Profile；通过受认证的本地 API 调用服务 |

macOS/Windows 首版都不把交互浏览器放进 Docker。浏览器运行在当前 OS 用户的交互桌面内；首版不部署远程 noVNC、Browserbase 或 companion。

管理页退出、Codex 退出和后端退出是不同事件。后台自动启动需要用户选择启用；macOS 使用用户级启动机制，Windows 使用当前登录用户的启动机制。不能用 Windows 系统服务直接弹登录窗口；系统服务与交互桌面有隔离。[Windows Interactive Services](https://learn.microsoft.com/en-us/windows/win32/services/interactive-services)。用户注销、机器关机、休眠时不承诺同步，恢复后有限补跑。

### 4.3 技术栈与取舍

| 项目 | 首版选择 | 边界 |
|---|---|---|
| 语言/runtime | TypeScript + Node 24 LTS | 固定可复现版本与 lockfile；实现时复查补丁版本 |
| 工程 | npm workspaces | 沿用团队熟悉的包管理；不同时引入多套 monorepo 工具 |
| HTTP | Fastify + Zod + OpenAPI | Schema 单一来源；领域逻辑不写在 route 中 |
| 浏览器 | Playwright 对应的 Chromium | 固定浏览器/库组合；专属 Profile |
| DB/任务 | SQLite + 最小持久 Job 表（待确认建议） | 单机串行写入、事务领取/提交、租约/重试；不加 Redis/pg-boss |
| 存储访问 | SQL migrations + 小型 typed repository | 不提前写通用 ORM/多数据库兼容层 |
| 证据文件 | 本地 content-addressed storage | 后续可替换对象存储，不先装 MinIO |
| 检索 | SQLite FTS5 + 结构化过滤 | 英文课程先验收；中文查找增加明确策略，不能假定英文分词适用 |
| 最小 UI | React + Vite | 只做连接、范围、任务、来源证据四类页面 |
| MCP | 首版 stdio 薄客户端 | Streamable HTTP 留后续部署需求；不同时开放公网 |
| 测试 | Vitest + Playwright 合成站点 + 真实 SQLite 文件/多进程集成 | macOS/Windows 原生 CI；学校 live UAT 单独记录 |

Node 24 为当前 LTS；具体依赖补丁版本、SQLite driver 的稳定性与 macOS/Windows 打包组合在新项目 Phase 1 固定，不沿用材料里所有示例版本。[Node 发布表](https://nodejs.org/en/about/previous-releases)。

数据库建议变更：原方案 PostgreSQL + pg-boss 面向可能远程服务的假设。用户现已明确本机运行、Windows 兼容、纯信息归档，SQLite 更符合低并发单设备应用；这是工程建议，不是用户已选技术。SQLite 只允许单个同时写事务，需短事务、busy timeout、WAL/checkpoint 和恢复测试；DB/WAL 放本机磁盘，不放 SMB/NAS/云盘同步目录。[SQLite 适用场景](https://www.sqlite.org/whentouse.html)、[WAL](https://www.sqlite.org/wal.html)。

代价是持久队列必须实现并测试小而明确的 job 状态机，不能用内存定时器替代。首版不做分布式调度/复杂 cron 平台。若用户接受独立数据库且更看重成熟队列，建项前可以保留 PG + pg-boss；最终只选择一种，不同时维护两套。

### 4.4 macOS / Windows 兼容必须项

- PlatformPaths：macOS 用户 Application Support 与 Windows LocalAppData 分开解析；运行数据不放 repo 或默认同步盘。
- SecretStore：分别接系统凭据机制；禁止 Windows 上静默退化成明文 token 文件。
- 文件访问：Windows ACL 与 macOS mode 分别实现，不假定 chmod 足以保护 Windows；处理 junction/symlink、文件锁、保留名、长路径、大小写和 Unicode。
- 文件名仅为展示；实际对象以内部 ID/hash 定位，不能用课程/附件原始标题直接拼绝对路径。
- ProcessSupervisor：跨平台启动/关闭/回收自己创建的 browser 子进程，不依赖 bash、Unix signal 或 kill-all。
- 登录、Profile 锁、重启恢复、证据下载/读取和备份都须在原生 Windows 与 macOS 测试；不能用 Ubuntu CI 或 WSL 代替 Windows 验收。
- OS 最低版本/CPU 范围在 Phase 1 按选定 Playwright/runtime 支持表与目标用户确认；没有 runner 的架构标未验证，不冒称“Windows 全版本兼容”。[Playwright 系统要求](https://playwright.dev/docs/intro)。
- 安装形态建议用户不用自行安装 Node/DB/Docker，开发者安装与最终用户安装分开；是否要求首版实现这种打包体验待 D5 确认。

### 4.5 建议目录

~~~text
apps/
  api/                     # REST、授权、本地管理页静态资源
  worker/                  # 调度消费、浏览器进程生命周期
  mcp/                     # stdio → 本地 API；无 Profile/DB 访问
  web/                     # 最小诊断和证据界面
packages/
  domain/                  # IDs、实体、状态、不变量
  contracts/               # 输入输出 schema、错误契约
  application/             # 连接、同步、查询、策略用例
  connectors/              # moodle/、edstem/；selector 只在此
  browser/                 # Broker、Provider port、local 实现
  persistence/             # SQLite repositories、migrations、证据文件
  platform/                # macOS/Windows 路径、凭据、进程与启动机制
  test-support/            # synthetic fixtures、fake IdP、测试工具
docs/
  design/                  # 本方案与批准后的 ADR
.planning/                 # 由新项目 GSD 创建，旧目录不复制
~~~

约束：domain 不 import HTTP/MCP/Playwright/数据库 driver；application 依赖 port；adapter 实现 port；启动入口负责注入。Moodle selector、学校域名和 Ed 特有字段不能进入通用领域实体。不要为了接口整齐抹掉平台字段的语义差异。

## 5. 身份、登录与浏览器设计

### 5.1 三种身份必须分开

- **AutoED 客户端身份**：谁在请求本地 API/MCP，能访问哪些课程、能否触发同步。
- **学校来源连接身份**：Moodle/EdStem 中是哪一个账户、什么租户/学期、哪些数据已授权。
- **浏览器身份**：用于一个来源账户的专属 Profile，或未来云端 Context。

另外，官方 API credential 是独立授权方式；SSO 成功不能自动生成或代替它。

默认按 `owner + institution/tenant + source + account_binding` 隔离 Profile。Moodle 和 EdStem 分开，接受可能需要各自 MFA 的成本；共享 IdP 不是共享 Profile 的充分理由。跨平台共享身份只有在明确需求与安全评估后再讨论。

### 5.2 不再使用单一 ready 状态

| 维度 | 示例 | 说明 |
|---|---|---|
| connection lifecycle | configured / disabled / disconnected | 是否启用连接 |
| auth state | unknown / login_required / login_in_progress / verified / reauth_required | 最近认证证据，不是永久有效凭证 |
| capability | courses=available、posts=unsupported | 按操作报告，不是整个来源一刀切 |
| operational health | healthy / network_error / rate_limited / parser_degraded / identity_mismatch | 不能把网络故障误报为登出 |
| data freshness | fresh / stale / never_synced | 由最后成功采集与策略计算 |
| completeness | complete_for_scope / partial / unknown | 仅针对声明的 scope 与分页范围 |

状态记录包含 `last_auth_verified_at`、`verification_method`、`last_successful_sync_at`、`last_complete_sync_at`、`error_code` 与结构化 `next_action`。所有同步在执行时重新探测，不能只信任 24 小时 readiness 缓存。

### 5.3 登录流程

~~~text
创建连接并取得本地持久化授权
→ 获取 Profile 独占租约
→ 启动可见专属 Chromium
→ 用户自己在官方页面完成登录/MFA
→ 用户点击“已完成”或执行受限 Auth Probe
→ 校验目标站点、受保护内容和账户绑定
→ 正常关闭并确认浏览器进程退出
→ 重开 Profile，独立验证复用
→ 标记 verified，释放租约
~~~

Auth Probe 至少验证：允许的最终 origin、受保护页面的正面标志、无登录/权限错误页面、可核对的来源账户标识。不能只判断 URL 或 HTTP 200；许多登录页也返回 200。

若站点不提供可靠账户标识，不猜测，也不默默复用旧账号数据：显示 identity_unverified，要求用户在本地界面确认课程与账户归属。换号时创建新的绑定，不覆盖旧 owner 的数据。

登录期间禁止采集密码/MFA 输入、DOM 输入值、网络 headers/body、录像、截图、trace、HAR、按键或 console 日志。浏览器自身为认证执行的必要请求是用户登录过程，不是业务 connector 获准发起任意写请求。

### 5.4 后台同步流程

~~~text
领取持久 Job
→ 校验连接/范围/采集策略
→ 获取同一 Profile 独占租约
→ 以已验证的运行模式启动
→ Auth Probe
→ 运行具体 read operation
→ 清洗、验证、提交结果
→ 关闭浏览器，确认退出
→ 释放租约、完成 Job
~~~

headless 是否稳定必须在真实来源验证。若 headless 不被站点支持，保持可见 headed 模式或将该连接标为需要交互；不做指纹伪装、不绕过安全挑战。隐藏窗口不是一个跨平台保证存在的 Playwright 选项。

独立 Profile 解决了“由不同宿主持有不同会话”的设计依赖，不保证学校登录永不过期。Playwright 文档明确要求独立 User Data Directory，且同一目录不能并发打开；认证状态的 sessionStorage 复用也不能简单视为自动保证。[持久 Context](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context)、[认证状态](https://playwright.dev/docs/auth)。

### 5.5 锁、崩溃与取消

- 以 browser identity 为锁粒度；不是以课程为粒度。
- Job 有 heartbeat、lease expiry 和 fencing token；提交前校验当前 token，防止失去租约的旧 Worker 提交。
- Profile 另有本机进程级独占保护。租约超时不能直接删除 Chromium lock；必须确认所属浏览器进程已退出，不能误杀用户日常浏览器。
- Worker 在数据库连接/租约丢失时停止后续请求并关闭自己创建的浏览器。
- 正在登录时，同身份同步排队；排队有上限与可见状态。
- 取消先停止导航和提取，正常关闭；超时仅回收本 Job 创建的进程。
- 不对运行中的 Profile 做复制、备份或跨机器挂载。

### 5.6 Provider port 与只读约束

Provider 只负责浏览器资源，不负责判断教师身份、作业截止或课程匹配。Broker 管锁与政策；Connector 提供来源 Auth Probe 与具体读取。

~~~ts
interface BrowserProvider {
  capabilities(): {
    interactive: 'local_window' | 'remote_view';
    persistentIdentity: boolean;
  };
  openInteractive(identity: IdentityRef): Promise<InteractiveLease>;
  openForRead(identity: IdentityRef): Promise<BrowserLease>;
  close(lease: BrowserLease): Promise<void>;
  deleteIdentity(identity: IdentityRef): Promise<void>;
}
~~~

这是内部概念接口，实际类型在 Phase 1/2 锁定。`IdentityRef`、CDP endpoint、Profile 路径和 session secret 不进入 MCP。可信 Connector 可使用浏览器句柄，Agent 不能提交 arbitrary JavaScript、任意 URL、selector 或操作闭包。

“remote read-only”指不主动修改学术业务内容；学校可能记录访问、刷新 session 或标记已读。不要承诺浏览器访问完全无服务端副作用。读接口可能使用 POST，GET 也可能触发业务修改，必须按 origin + endpoint + operation + 输入语义白名单判断，不能只按 HTTP method 判断。

### 5.7 Browserbase 的后续接入条件

只有远程部署、远程人工登录或多用户需求成为当前需求后才实施。单独评审第三方会话托管、学校允许范围、数据地区、日志/录像、费用、删除与故障恢复。

材料建议的 `persist:false` / `ON_SUCCESS` 不能照搬成本地与云端统一事务：Browserbase 的 persist 在创建 Session 时指定；本地浏览器也可能运行时写盘。不得声称能回滚认证会话。按来源验证 session rotation 后决定写回，失败标 reauth，不自动销毁尚可诊断的身份。云端关闭后还需处理 Context 写回同步延迟。[Browserbase Contexts](https://docs.browserbase.com/platform/browser/core-features/contexts)。

不通过代理、隐身/反检测功能或换地区绕过学校安全策略。云端选型不自动迁移现有本地 Profile。

## 6. 数据采集：一条明确路径，而非自动轮流尝试

### 6.1 每个操作有明确 access plan

~~~text
source + operation + owner + scope
→ 已验证可用的授权方式
→ 一个确定的 adapter
→ 结构化结果及 coverage
~~~

建议模式集合仅为 `official_api | browser_dom | authorized_export | unavailable`。内部可记录 connector/parser 版本，不把 helper/native/auto 暴露成用户必须理解的选项。

官方 API 已获得授权且覆盖操作时优先使用；没有已验证授权时不要反复探测不存在的端点。Moodle 文档存在不代表 Monash 为学生开放了相应函数。[Moodle Web Services](https://docs.moodle.org/en/Using_web_services)。

已配置 API 认证过期时，原操作返回 reauth_required；不悄悄借浏览器身份继续。接口不支持与授权失效分开处理。用户可显式选择已批准的另一连接方式。

### 6.2 内部 JSON/XHR 的边界

两份分析把内部 JSON 放在 DOM 之前，这一点与旧项目“不逆向未授权私有端点”的决定冲突，新方案不默认采纳。

`browserContext.request` 共享 Cookie jar 只是技术能力，不提供站点授权，也不自动复用页面的 JS Bearer header、CSRF 逻辑或所有存储状态。[Playwright APIRequestContext](https://playwright.dev/docs/api/class-apirequestcontext)。

首版不监听并导出网络凭据，不复制隐式 token，不猜 Ed 端点。需要结构化读取时，先有官方文档或学校/平台对该集成方式的明确许可，再登记 allowlist、operation 与 contract test。若不可用，使用获准的可见 DOM 或用户授权导出；能力不足时停止，不用 LLM 静默猜补。

### 6.3 采集边界

- 同步只处理用户选定的课程/学期/作业；不默认全站爬取。
- 初始可建议每身份并发 1、单次 50 页/100 条记录、10 分钟预算，作为可调工程预算，不冒充平台许可或限流阈值。
- 记录 page/item coverage、cursor、部分失败与预算终止；预算结束不算完整。
- 429 遵循 Retry-After；超时/5xx 有界退避；认证、403 权限、DOM 结构变化停止自动重试并给出原因。
- 不进入 quiz attempt、提交表单、上传入口或会修改完成状态的 action URL。
- 链接下载验证每次 redirect 的 origin、目标 IP、协议、MIME 与大小；防止 SSRF、本机路径和压缩炸弹。
- 登录 origin allowlist 与课程读取 origin allowlist 分开；仅由受控配置扩展，不从页面文字自动批准。

### 6.4 解析与同步结果

每个 collection 返回：`status`、`scope`、`records`、`observed_at`、`coverage`、`cursor`、`warnings`、`parser_version`、`error_code`。

| 情况 | 行为 |
|---|---|
| 成功且完整、有数据 | 更新声明 scope 内 revision 和 last_complete |
| 确认完整、确实为空 | 仅处理该 scope；不清空整个账号 |
| 部分成功 | 可提交已验证记录；未采到部分保留旧值并标 stale/unknown |
| 登录失败 | 标 reauth_required，不更新课程数据 |
| 权限变更 | 限制旧内容继续展示，保留必要审计，不把它描述成原文删除 |
| parser/network 失败 | 保留最后成功数据与失败诊断 |
| 记录从列表消失 | 先标 not_observed；有删除证据或经过完整复查才 tombstone |

“列表为空”至少需要：认证通过、已识别列表结构/空态、目标 scope 正确、分页完成、未触发限额。禁止 catch 后返回 `[]` 冒充成功。

## 7. 安全边界：必须批准的变化

### 7.1 已批准的新产品边界与仍保留的限制

旧项目以 sanitized metadata 为主，并禁止 AutoED 保存浏览器凭据和 raw payload。用户已明确批准新项目使用本地专属持久 Profile，并要求课程全文归档与模型读取；应在新项目 ADR 记录这一边界变化，不能继续用旧 metadata-only 范围削减需求。该批准不等于将登录凭据提供给模型，也不修改旧项目的运行实现。

用户意愿与平台/材料权限分别记录：

| 决策 | 用户决定 | 实施边界 |
|---|---|---|
| 本地会话持久化 | 已接受 | 专属 Profile，仅本机；不复制宿主 Profile、不导出秘密 |
| 本地课程正文/文件 | 希望完整生命周期内容归档 | 选定课程范围内有权保存的数据；不包含隐藏内容和凭据 |
| 向 Codex/其他模型提供资料 | 已明确希望全部资料模型可读 | 支持全文/文件按需读取；已知禁止外发或权限未知的材料有明确例外状态 |
| 云浏览器托管 | 首版不做远程 | 不创建 Browserbase Session/Context |
| 第三方通知 | 没有新增授权 | 仅本地状态和信息变化提示 |

用户同意不能代替学校、版权方或第三方个人数据的使用权限。材料保存、AI 操作、对外发送是三个不同授权问题。

### 7.2 Profile 与密钥

- 密码、MFA 仅由用户在学校页面输入；产品不请求、不记录、不输出。
- Profile 在仓库外，目录严格权限、操作系统账户隔离；关闭浏览器密码保存/同步/自动填充功能并验证配置有效。
- Cookie 的浏览器加密不等于整个 Profile 被强加密。首版需说明依赖 OS 权限和设备全盘加密的威胁模型；若要求抵御同用户恶意进程或离线磁盘读取，需另做隔离/加密方案。
- OS Keychain 保存应用密钥和加密 key，不宣称能把整个 Chromium Profile 放进 Keychain。
- 普通数据库只保存不透明 identity reference；普通备份排除 Profile，恢复后重新登录。
- 删除连接分为停止同步、解绑身份、本地 Profile 删除、材料清除、学校端注销；这些不等价，分别预览/确认。
- 不保证 SSD/备份上的物理安全擦除；清除状态必须包含备份保留说明。

### 7.3 API 与本地控制面

- 只绑定 `127.0.0.1`/明确支持的 loopback；不默认 `0.0.0.0`。
- 验证 Host/Origin、限制 CORS、保护状态变更请求的 CSRF、限制请求大小和速率。
- UI 使用安全的本地配对流程与 HttpOnly session；不把长期密钥放 localStorage。
- stdio 客户端经受保护的本地凭据调用 API，避免每个 MCP 进程直接取得 DB 和浏览器目录。
- 来源配置只能来自已批准站点；Agent 不能借 base_url 或导出路径做 SSRF/任意文件读写。
- 后续 Streamable HTTP 需要 TLS、客户端认证/授权、scope 与 per-owner 隔离；MCP annotations 不是授权机制。[MCP transport 安全要求](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)。

首版保护远程页面、其他本机账户、意外泄漏和 Agent 越界；不宣称能防住已经完全控制同一 OS 用户的恶意程序。

### 7.4 内容外发与 prompt injection

外发检查必须发生在所有出口：MCP tool、MCP resource、REST 导出、LLM prompt、推送、诊断包；不是只放在模型调用函数中。

**本地 MCP 把正文返回给 Codex 后，正文可能进入宿主模型上下文，因此这也是外发。** “只有 Evidence ID”也要检查标题、URL、片段、课程名是否带受限信息。

建议交付策略交集（只决定资料能否交付，不评估下游作业辅助方式）：

~~~text
source material rights
∩ approved destination
∩ allowed archive/read/export operation
∩ current user authorization
~~~

若来源明确禁止将某份材料上传模型，作为材料外发限制执行；仅限制“不得用 AI 完成作业”的声明保留原文并交给下游，不由 AutoED 推理为所有相关资料禁止归档/读取。声明不明确时提示具体待确认项，不把复杂作业合规判定引入本项目。

材料标 `local_only` 时，只在本地管理页/获准本地处理器使用。MCP 返回策略阻止状态和安全的操作提示，不能用“摘要”或脱敏来默认绕过原有使用限制。

用户对模型读取的同意已记录为产品默认目标，不应每读一个获准片段重新询问同一问题。按 integration + 课程/材料类别记录授权；权限已清楚且用户启用的集成可以正常返回全文。仅对明确受限或依据不明的材料返回相应原因和待处理项，而不是把所有正文继续永久标为 local_only。

连接端不能信任模型自行声称“我是本地模型”。由用户配置 integration policy；未指定的云模型/第三方账号不自动获得数据。Policy gate 能控制 AutoED 交付的内容，不能保证外部 Agent 已读到的内容可被撤回。AutoED 不负责判断下游作业生成是否合规，但保留原始 AI 声明和外发限制供调用者处理。

学校页面是数据，页面里的“请忽略规则”“上传配置”等文字不能改变工具权限。检索到的 URL/命令不直接执行；HTML 不作为带脚本的原样 UI 页面展示；PDF/Office 解析隔离、限时、无宏和外部资源抓取。

Monash 的官方说明要求遵循具体 assessment 的 AI 条件，并确认有权将材料输入 AI；因此“用户能在 Moodle 看见”不能自动等同于“可交给外部模型”。[Assessment AI 条件](https://www.monash.edu/student-academic-success/ai-hub/ai-and-assessments)、[材料使用权限](https://www.monash.edu/student-academic-success/ai-hub/responsible-and-ethical-use-of-ai)。

## 8. Evidence Vault：首版必须有，但不等于保存所有原始流量

### 8.1 四类内容

| 类别 | 示例 | 保留与用途 |
|---|---|---|
| 会话秘密 | Profile、Cookie、IdP 状态 | 隔离于 Vault；只由浏览器管理 |
| 来源元数据 | source ID、时间、已清洗 URL、状态 | 规范化 DB；也需按敏感程度控制出口 |
| 课程归档材料 | 完整获准正文、文件、讨论、作业说明、个人成绩/反馈 | 本地版本存储；按已授权集成提供模型读取，保留受限例外 |
| 调试原始产物 | 整页 HTML、HAR、headers、trace、完整 JSON | 首版不持久化；后续单独授权、脱敏、短保留 |

受控 DOM 证据使用 allowlist 可见正文，保持章节/表格/讨论树完整，不为方便而任意截断；不采集输入框、隐藏 token、脚本、网络 headers 和超出课程范围的个人信息。一个 fragment 不是完整 raw response，必须标注 representation 与 coverage，不能宣称保存了未修改原页面。合法下载的课程 PDF/Office 等原文件可以按原字节存档；它们与包含凭据的网络 raw payload 不同。

哈希用于完整性和去重，不证明材料真实、教师身份真实或内容具有法律权威。真实性仍来自来源路径、获取上下文、账户权限和定位。

### 8.2 首版核心实体

| 实体 | 关键字段 / 不变量 |
|---|---|
| SourceConnection | owner、tenant、source、account_binding、auth、capabilities |
| AcademicScope | institution、academic_year、term、course IDs、assignment ID |
| CourseBinding | Moodle ID ↔ Ed ID、用户确认、学期、匹配依据 |
| CourseManifest | 某课程某次目录版本、模块/资源/讨论/assessment 引用、覆盖和缺项 |
| Resource / ResourceRevision | 稳定资源 ID、父模块、原始名称、媒体类型、原文件 hash、历史版本 |
| FileObject / Extraction | 文件落盘状态、字节数、解析器版本、提取文本、页/slide/sheet locator、错误 |
| SyncRun | scope、adapter/parser versions、预算、coverage、错误、开始/结束 |
| SourceObservation | 稳定 source identity、observed_at、source_updated_at、访问结果 |
| ContentRevision | canonical hash、representation、parser/sanitizer version、object reference |
| EvidenceSpan | revision ID、局部文本/页码/offset、locator、作者角色证据 |
| Assignment | 跨来源 canonical ID，不由可变标题单独决定 |
| AssignmentBundle | 仅来源事实集合：固定 revision manifest、bundle hash、policy、coverage；不编译约束 |
| ChangeEvent | before/after revisions、type、影响 scope、幂等 key |
| PolicyDecision | material/action/destination、依据、批准者/时间/有效范围 |

Claim、Constraint、ConflictResolution、VerificationRun、WorkItem 和学生作业工件由下游项目持有，**不列入 AutoED 待办**。AutoED 可以提供 export receipt / manifest，帮助下游记录其读取的具体版本，但不接受下游直接写业务数据库。

### 8.3 版本与定位

- 稳定源键由 `tenant + account scope + source + external course/activity/thread ID` 组成；不能只用标题或 URL 文本。
- 每次成功观察更新 observation；内容变化才创建 content revision。抓取时间、随机 nonce 不应让每次内容 hash 都变化。
- 原文件 hash、canonical content hash、parser version 分开，避免解析器变化伪装成教师修改。
- EvidenceSpan 的 offset 指向固定 revision 的规范化文本；HTML selector 仅作为辅助位置，不能单独作为永久引用。
- PDF locator 包括物理页码和可选印刷页码；OCR 有提取质量标记。Word/PPT 没有稳定分页时用段落/slide locator，不能伪造页码。
- bundle 包含每项具体 revision ID 和来源采集时间，不声称跨两个学校系统得到原子瞬间快照。
- bundle 一经生成不改写。新来源产生新 bundle；旧工作流显示 update_available/revalidation_required。
- 删除源正文后旧引用可以显示“因保留政策已删除”；不可把新文本填进旧 Evidence ID。

### 8.4 截止与提交语义

保留 `due_at`、`close_at`、`cutoff_at`、公开延期和个人延期的区别；存原始显示文本、IANA 时区、解析状态、UTC 值。没有时间/时区时保留未知，不默认当天 23:59。个人延期只属于当前账号。

提交状态是观察结果：未确认、已保存草稿、已提交、待评分、已评分等按平台语义映射。最后同步时“已提交”不是当前服务器的永恒状态；用户本人可见的成绩、rubric 反馈、教师反馈正文和附件属于同步目标，但带更严格的敏感标签。AutoED 不推测评分、不评估作业质量，不让跨课程/账号查询泄漏个人成绩。

### 8.5 事务与文件一致性

1. 对受控内容做清洗、校验、hash，写入受控临时文件并完成落盘。
2. 将文件置入 immutable object store；对象尚未被 DB 引用时不对外可见。
3. 在一次 DB 事务中写 revision、spans、scope projection、checkpoint、change event 和必要 outbox。
4. 事务失败时旧 projection 不变；孤立对象进入延迟 GC，不立即删除可能仍在写入的对象。
5. 回滚与恢复验证 DB 引用的对象存在且 hash 匹配；不能只备份 DB 忽略证据文件。

### 8.6 备份、保留和 workspace

后端数据库是唯一业务存储。课程工作区只保留本地 binding 和需要的导出/工作工件；它不是第二个可写课程数据库。不要把多个 `.autoed/records` 当作双向同步真源。

建议数据目录使用新命名空间，macOS 用用户 Application Support，Windows 用用户 LocalAppData，与旧 AutoED 完全隔离。诊断元数据建议 14 天；课程资料、文件、成绩和版本默认长期保留，直到用户清理或材料政策要求删除，不按学期结束自动清空。运行日志保留期限与课程归档期限分开。权限变化暂停新采集并复查历史材料的保留/展示依据，不能直接把本地历史全部删除，也不能假定失去在线访问后历史材料必然可继续外发。

备份需加密和恢复演练；Profile 默认不备份、不导出。证据库内容及其备份都禁止进入 Git/未经批准的云盘同步目录。SQLite 使用一致性 backup/checkpoint 方案，不在写入时只复制主 DB 文件并遗漏 WAL。文件存储和 DB 按 manifest 做一致性校验。保留策略删除的是内容，不应伪造历史“从未存在”。

## 9. 持久任务、重试、变化与通知

建议使用 SQLite 持久 Job 表和单调度协调者，Browser Worker 是受控执行进程。Job 状态与业务采集结果分开，不把 worker 已退出等同于同步成功。

Job 的最小字段包括 id、type、scope、idempotency_key、queued/running/retry_wait/completed/failed/cancelled、next_run_at、lease_owner/expiry、fencing_token、attempts、checkpoint。API 入队和 Job 领取/完成都用短事务；多进程争抢用原子条件更新验证只领取一次。处理器按 at-least-once 设计。网络/下载/解析在 DB 事务外运行；重启后回收过期租约并幂等续跑。明确的重试上限、死任务列表和取消状态替代无限循环。若 Phase 1 无法证明恢复正确，重新评审成熟队列，不发布“内存定时器加 JSON”的临时代替品。

- 请求同步立即返回 `job_id`；查询/订阅 job progress，不让 MCP 长时间占着一次工具调用。
- 幂等 key 使用连接、标准化 scope、任务类型和调度窗口；重复手动请求可返回已运行 Job。
- `last_attempted` 与 `last_successful` 分开；`partial` 不刷新 `last_complete`。
- 调度持久化、重启后恢复；休眠错过的普通周期合并为一次 catch-up，禁止唤醒后回放几百次。
- 初始建议普通同步每 6 小时，并允许手动同步；周期是可调预算，需按实际课程与平台限制批准。
- Job handler 按可能重复执行设计。相同内容不会生成重复 revision/change；checkpoint 与提交在同一事务。
- 网络失败可有限重试；登录失败等待用户；parser drift 等待修复，不用高频轮询解决。

通知后续通过 outbox + provider adapter，不能放进 parser。外部服务接受发送但回执丢失时，重试可能重复；若 provider 无幂等能力，记录 `delivery_unknown`，根据消息风险选择重试或人工确认，不能承诺 exactly-once end-to-end。

首版仅本地 reauth/同步失败/关键变化消息；第三方渠道的课程名、正文、成绩、链接令牌均受外发策略控制。个性化日报、建议、作业进度推断属于下游项目；AutoED 只提供变化列表和资料更新事件。

## 10. API、MCP、Skill 与管理界面

### 10.1 第一批用例和工具

| Application 用例 | REST 示例 | MCP 示例 | 语义 |
|---|---|---|---|
| GetHealth | GET /v1/health | autoed_health | 本地诊断；无隐式学校访问 |
| ListConnections | GET /v1/connections | autoed_connections | 状态/能力/下一步 |
| BeginLogin | POST /v1/connections/:id/login | 首版由 UI/CLI 触发 | 本地显式动作，不接受密码参数 |
| ListCourses | GET /v1/courses | autoed_courses | 查询已同步索引 |
| GetCourseManifest | GET /v1/courses/:id/manifest | autoed_course_manifest | 完整分类目录、版本、覆盖与缺项 |
| ListResources | GET /v1/resources | autoed_resources | 按课程/类型/时间分页列出资料 |
| ReadResource | GET /v1/resources/:id/content | autoed_read_resource | 按固定版本/page/slide/sheet/offset 读正文 |
| GetFile | GET /v1/resources/:id/file | 受控文件资源/导出 | 校验 caller 权限，提供获准原文件；不泄露文件系统路径或 bearer URL |
| GetChanges | GET /v1/changes | autoed_changes | 断点/cursor 后的资料变化，不包含行动建议 |
| RequestSync | POST /v1/sync-jobs | autoed_sync | 有界学校读取 + 本地写入，返回 Job |
| GetJob | GET /v1/jobs/:id | autoed_job | 进度、错误、下一步 |
| GetBundle | GET /v1/assignments/:id/bundle | autoed_assignment_bundle | 固定版本结果，经过外发策略 |
| SearchEvidence | GET /v1/evidence | autoed_search_evidence | 明确 scope、分页、coverage |
| GetEvidence | GET /v1/evidence/:id | resource 或 autoed_evidence | 按 span 读取；相同外发检查 |

先落地这组，不继承旧几十个工具。CLI、UI、MCP 最终执行相同 application 用例，不能各自实现一遍同步。

只有普通查询工具才能标纯只读。`autoed_sync` 虽不改学校业务内容，却会本地持久化并访问网络；annotation、说明和服务器权限要诚实反映这一点。

Codex 官方文档支持 stdio 与 Streamable HTTP；因此独立后端不要求首版就做远程 MCP。使用 stdio 薄适配器仍可保持业务后端独立存活。[官方 MCP 说明](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)。

### 10.2 统一返回信封

~~~json
{
  "schema_version": 1,
  "status": "partial",
  "data": {},
  "scope_id": "scope_demo",
  "bundle_version": "bundle_demo",
  "observed_at": "2026-08-26T04:00:00Z",
  "freshness": "stale",
  "completeness": "partial",
  "evidence_refs": [],
  "warnings": ["EdStem 尚未完成本次读取"],
  "error": null,
  "next_action": { "kind": "open_local_connection", "connection_id": "conn_demo" }
}
~~~

ID、时间和警告仅为示例，不是本轮真实同步结果。统一错误码如 AUTH_REQUIRED、PERMISSION_DENIED、IDENTITY_MISMATCH、RATE_LIMITED、PARSER_CHANGED、BACKEND_UNAVAILABLE、POLICY_BLOCKED、SCOPE_UNCONFIRMED。

next_action 是结构化操作类型，不是让 Agent 执行任意 shell 文本。来源链接去掉 token/query secret。长证据按版本和范围读取，不能把全部课程材料塞进一次工具输出。

“模型可读”不只是有一个文件路径：必须提供 manifest、可读取的文本/结构、分页/cursor、原文定位、编码、版本、提取完整度与原文件访问方式。MCP 客户端不支持二进制/resource 时，也有普通语义工具读取文本的兼容路径。扫描件/图片/媒体可提供获准二进制给支持的调用方；不能声称文本提取完成。下游可枚举并逐块读全量内容，不依赖一个会截断的搜索 top-k。

自动拉取的大文件用 temp + 校验 + 原子落盘；中断续传须确认版本/ETag 一致，不将不同版本的 range 拼接。文件扩展名不能代替 MIME 校验；提取器隔离运行、禁宏、禁外部链接执行、限内存/时长。XLSX 明确保留 sheet/row/公式与缓存值区别；PDF 图表/公式/扫描缺口可见。未知格式仍有文件记录与原因，不能静默忽略。

### 10.3 Skill 的责任

Skill 说明调用顺序、如何解释 stale/partial、何时要求用户确认课程、何时显示本地重登录入口。它不自己调用浏览器、不导出会话、不写 DB、不创建后台循环。

AutoED Skill 只指导连接、同步与资料读取。AssignmentFlow/EvidenceLens 的 Skill 和后端在独立项目中持有其状态；AutoED 不保存学生计划、作业执行步骤或评估报告。

### 10.4 最小 UI 比完整 Dashboard 更早

首版管理界面只需四类页面：

1. 连接：使用哪个来源/账号、何时验证、登录按钮、失效原因。
2. 同步：范围、进度、覆盖、失败、重试/取消。
3. 课程归档：学期/周次/分类目录、公告、讨论、资料、作业、本人评分与反馈、最后成功采集。
4. 资料读取：原文件/提取文本、版本、定位、下载/解析缺口和模型读取权限；不渲染不受控 HTML。

这些是用户完成认证和诊断的必要入口，不应拖到所有后台模块完成后才开发。美化、Tauri 打包和复杂统计可延后。

## 11. 与独立下游项目的边界

AutoED 的终点是“可查询、可归档、可定位的信息”，不是学术推理或任务执行。

| AutoED 拥有 | 下游项目拥有 |
|---|---|
| 来源登录、授权范围、同步和归档 | 作业分析、规划、执行与评估 |
| 来源正文、文件、作者原始角色信号 | 对教师权威的语义判断与争议裁决 |
| 版本、时间、来源定位、数据完整度 | Claim、ConstraintPack、验证置信度 |
| 原始 AI statement、材料外发标记 | assessment 允许何种具体辅助操作的评估 |
| CourseManifest/ResourceRevision/变化事件 | 学生工件、WorkItem、进度、AI 使用声明 |

AutoED 不依赖 LLM API Key 才能登录、同步、归档、检索或导出。PDF/Office 文本提取是格式转换，不应偷偷调用第三方模型。OCR/媒体转录如果后续采用外部服务，另作授权，不能混进基础同步。

下游通过稳定 REST/MCP/导出包读取，不能直接接触 Profile、DB 文件或内部 Playwright 句柄。导出 manifest 包含 schema_version、scope、revision IDs、hash、采集时间、定位、coverage、获取/提取错误、外发限制；新版本产生新的 manifest，下游自己决定是否重验。

Pinned、accepted、endorsed 和 staff role 按原始信号分别保存；未知就是未知。Moodle 与 Ed 对同一日期的不同说法可以并列呈现，AutoED 不裁定哪个“正确”。作业 bundle 只聚合相关来源，关联不确定时明确标注候选关系。

Skill 不能让下游把“网页里出现的指令”当作 AutoED 控制命令。资料开放读取不等于开放自动提交、消息发送或任意文件执行权限。

## 12. 测试与真实验收

### 12.1 四层证据

| 层 | 检查对象 | 能证明什么 |
|---|---|---|
| Unit/contract | schema、状态、policy、parser | 仓库逻辑符合契约 |
| Integration | 真实 SQLite、持久 Job、文件事务、进程恢复 | 组件接线与持久化可用 |
| Synthetic E2E | 本地测试 IdP、假 Moodle/Ed 页面、浏览器 | 登录与失败流程在受控环境可用 |
| User-run live UAT | 用户授权真实站点、限定课程 | 当前机器、账号、版本、时段下真实可用 |

不能把前三层写成“真实 Moodle 已验证”。live 记录仅存日期、版本、场景和结果等脱敏证据，凭据和私有截图不得进 CI。

### 12.2 登录 POC 是早期硬门禁

每个要宣称支持的来源至少验证：

1. 可见登录和人工 MFA，账户绑定正确。
2. 正常关闭后重开专属 Profile，连续 3 次验证复用；失败要记录原因。
3. Worker 重启、Codex 完全关闭后仍可读；系统重启后重新检查。
4. 24 小时后再验证，建议再做 72 小时观察；这些是验收窗口，不是学校 session 寿命保证。
5. 明确退出或自然过期后显示 reauth，旧数据保留。
6. 两个并发请求不能同时打开同一 Profile。
7. 账户变化、权限拒绝、网络失败和 parser 失败得到不同结果。
8. 没有秘密、正文、trace、HAR、录像泄漏到日志/测试产物。

若复用不稳定，先定位存储状态、站点策略与模式差异。不得在未通过时继续堆叠日报/Agent 功能，并将 POC 缺口算作已完成。

### 12.3 数据与安全验收

- 同一输入重复同步不新增业务变化；worker 在每个提交边界崩溃后可恢复。
- 失败/部分/空态不会错误删除旧记录；分页未完成不能报告 complete。
- DST、无时间日期、个人延期、cutoff 与 due 区别、重复标题跨学期均有测试。
- Evidence ID 回到固定 revision 和 locator；删除内容后引用显示不可用，不冒充新版本。
- MCP/REST/resource 对同一 caller/scope 执行相同外发规则。
- 注入文本不能发起新工具、改 scope、扩大 origin 或泄漏文件。
- 来源账号隔离、workspace binding、路径逃逸和 URL redirect 都有反例。
- 后端停止时 MCP 给出 backend unavailable；不能回退到旧 helper 或全局缓存冒充实时数据。
- 新机器/干净用户目录按文档安装可运行；备份恢复包含 DB + 证据文件一致性检查。
- macOS 与 Windows 原生验证 Profile 独占、用户凭据保护、中文/长路径、文件锁、后台启动、安装与卸载保留资料；Linux 不代替 Windows 门禁。
- 课程范围覆盖矩阵与 manifest 对账：所有发现的文件都有下载/归档/提取/模型访问状态，不能只测一个作业就宣布全生命周期同步完成。
- 大文件中断、磁盘满、文件版本切换、PDF/Office 解析失败、加密文档与不支持类型均保留可追踪缺口。
- 无 LLM Key、无 Codex 进程时仍能完成资料同步；获准全文可分页完整读取，搜索 top-k 不等于全部资料接口。

### 12.4 测试与发布纪律

合成 fixture 必须独立于私有材料可运行；测试私有材料不存在不能让核心测试悄悄 skip。环境目录、数据库和端口隔离，不读取用户真实 Profile。

每个 phase 做相关 unit/contract/integration；合并跑 typecheck、lint、全套合成回归、secret scan、schema migrations 和依赖边界检查；正式可用声明还需要具体平台 live UAT。无运行证据的功能标 planned/experimental。

## 13. 新项目 GSD 路线图建议

这些阶段编号供新工作区建项时调整；不是覆盖旧项目的 Phase 1。先只创建 M1 的活动路线图。

### M1：本地跨平台课程资料同步、归档与模型读取

| Phase | 交付 | 前置依赖 | 不可跳过的完成条件 |
|---|---|---|---|
| 1 范围与跨平台骨架 | 已确认决策入 ADR、覆盖矩阵、platform ports、monorepo、最小 API/DB/Worker、synthetic site | D1–D4 已确认，D5 技术选择 | macOS/Windows 都启动；纯合成测试；数据与旧版隔离 |
| 2 登录可行性 POC | local Provider、Profile 租约、人工登录、Auth Probe、最小登录 UI | 1；用户已接受会话持久化 | 两来源重开/重启/失效；两个目标 OS 实测；不足则标未验证 |
| 3 Moodle 课程信息 | 单作业 POC 后扩展目录、周次、公告、assessment、时间、个人评分/反馈、资源清单 | 2 + 实际课程范围 | 完整 scope 清单；失败不清空；thin MCP 查询 smoke test |
| 4 EdStem 课程讨论 | 可见线程/回复/附件、原始作者角色信号、课程绑定与增量 | 2、3 | 获准路径、分页、匿名/角色/编辑状态、缺项明确 |
| 5 文件归档与可读化 | 课程文件下载、版本、manifest、PDF/Office/text 提取、原文件访问、外发 gate | 3、4 | 文件/文本/定位一致；获准全文可完整读取；格式缺口不隐藏 |
| 6 生命周期同步与恢复 | 初始全量、增量、周期对账、结课归档、调度、幂等、磁盘预算、checkpoint | 5 | 关闭 Codex/重启不丢任务；历史不误删；设备离线可恢复 |
| 7 资料 UI 与完整 MCP/Skill | course/resource manifests、分页全文、search、file、changes、health/jobs | 6 | 模型客户端能找资料并读全；无评估/规划/行动工具；无 LLM Key 依赖 |
| 8 跨平台交付与切换 | macOS/Windows 安装、后台启动、live UAT、备份恢复、迁移 preview、回滚 | 7 | 两平台有真实证据；全部要求或明确批准的例外；旧数据未改写 |

队列持久结构在 Phase 1 建立；Phase 6 才打开周期调度与恢复策略。Evidence 的最低 revision 契约在 Phase 1 定义、Phase 3 起使用，不等 Phase 5 再给历史数据伪造来源。

Phase 2 是一个受限的真实登录试验，不要求提前实现完整资料库。如果它失败，优先诊断连接方案，不让 GSD 继续自动完成依赖阶段。Phase 3 的单作业验证只是切片，首版最终还须完成整个选定课程的覆盖矩阵，不能把 POC 当产品范围。

### M1 候选需求编号

| ID | 可验证要求 | Phase |
|---|---|---|
| ARCH-01 | 后端与 Worker 不依赖 Codex 生命周期 | 1、6 |
| ARCH-02 | MCP/UI 共享用例，domain 无浏览器/协议依赖 | 1、7 |
| SEC-01 | 落实用户已批准的持久会话/资料读取意愿，同时保留材料权限限制 | 1、2、5 |
| SEC-02 | 所有出口执行 scope 和外发策略 | 5、7 |
| AUTH-01 | 独立 Profile、可见人工登录、无凭据采集 | 2 |
| AUTH-02 | 重启复用、过期、换号、单 Profile 独占可验证 | 2 |
| SRC-01 | Moodle 选定课程结构/公告/作业时间/个人评分与反馈可读取 | 3 |
| SRC-02 | EdStem 课程线程/回复/附件、原始角色信号可读取并定位 | 4 |
| SCOPE-01 | 学期/平台课程映射由用户确认，防账号混合 | 3、4 |
| DATA-01 | 空、失败、部分、未观察、删除分开 | 3、4 |
| EVID-01 | 不可变 revision、hash、定位、解析器版本 | 3、5 |
| EVID-02 | Course/Resource manifest 固定版本，包含来源差异和覆盖缺口 | 5 |
| EVID-03 | 正文按批准范围本地保留，禁止 raw 登录/网络材料 | 5 |
| FILE-01 | 可下载课程原文件归档；失败/超额/不支持状态可见 | 5 |
| FILE-02 | PDF/Office/text 提取与定位，原文件/提取版本关联 | 5 |
| LIFE-01 | 课程全量盘点、增量、对账、结课历史长期保留 | 6 |
| MODEL-01 | 授权模型能分页读全文/取文件；不只给 top-k 或本机路径 | 7 |
| BOUND-01 | AutoED 不含作业评估、执行、规划或模型生成依赖 | 1–8 |
| PLAT-01 | macOS + Windows 原生安装/运行/恢复验证，Linux 非强制 | 1、2、8 |
| SYNC-01 | 持久 Job、去重、有界重试与 checkpoint | 6 |
| SYNC-02 | 部分失败保留最后成功数据、重启恢复 | 6 |
| UX-01 | 连接、范围、任务、证据状态与下一步可理解 | 2、7 |
| MCP-01 | 少量语义工具、job_id 异步执行、真实客户端验证 | 3、7 |
| OPS-01 | 备份恢复、迁移预览、旧版回退可演练 | 8 |
| VERIFY-01 | 合成门禁与 live UAT 分离，未验证不得宣称支持 | 2–8 |

这是候选需求，不是已验收清单。GSD 必须在用户确认后生成新 REQUIREMENTS 并追踪到实际 phases。

### AutoED 后续范围与独立项目

AutoED 后续可按用户需要改善资料类型覆盖、解析质量、学校适配、归档/检索性能、数据可移植性；不要自动添加作业操作功能。EvidenceLens、AssignmentFlow 各自在其工作区建立 GSD 项目，通过 AutoED 的版本化接口读取信息。

Gmail、第三方推送、远程部署、Browserbase 和 Linux 强制支持都需新的明确需求，不是本次默认后续阶段。

没有可靠的工作量证据前不承诺几天完成。Phase 2 的登录复用观察至少需要跨日验证，自动测试通过不能替代这段时间。

## 14. 旧代码迁移与切换

### 14.1 可以带走的东西

在逐模块审查后选择性迁移：日期/时区处理、明确的 schema、来源链接清洗、课程身份规则、保守提交判断、纯 normalizer、隐私反例、scope 隔离测试、语义工具的用户经验。

每次迁移记录旧 commit/path、行为契约、新位置、是否改语义、对应新测试。不要让“复用旧测试”阻止有意改进的契约；应明确列出破坏性变化。

### 14.2 不直接迁移

- 旧 host bridge、readiness 伪授权接线、多重 auto fallback。
- 旧 plugin 启动时修复构建/安装/版本身份 gate 与业务混合的主入口。
- 旧 global root、Profile、cookies、local.config、`.autoed`、日志、导出、数据库、node_modules、dist。
- 历史 GSD phases、STATE 和 completed milestones 作为新项目活动状态。
- Muster 源码或私有真实课程 fixture 的未审查复制。

发布/文件安全中的经验应保留，但不把旧复杂原生 updater 当作新后端 Phase 1 的依赖。

### 14.3 默认重新采集，按需导入

新后端先从用户新建连接和选定范围重新采集。需要旧数据时才做 import：只读取获准的旧 metadata，生成 dry-run 清单，用户确认后导入；旧记录标 `legacy_import`、未知 fresh/coverage，不伪造原始证据或教师验证。

Profile 和登录状态不迁移；重新人工登录。课程映射重新确认，旧 ID 作为参考而非认证依据。

### 14.4 并行与回滚

新旧使用不同数据根、数据库、端口、MCP server name 和安装标识。对同一课程的对照读取串行/低频安排，避免两个调度器叠加请求。切换前由用户明确停用旧同步，不自动卸载旧版。

至少对照：课程归属、deadline/close、提交语义、教师澄清、错误语义、证据 fresh/coverage。不要只比较结果数量或旧版本输出；最终以用户能检查的来源为准。

回滚：停止新调度与入口、恢复旧入口；新数据保留用于诊断。新仓库不写旧数据，因此不需要做危险的反向 schema 迁移。

版本号：新工作区开发代号可用 AutoED Rebuild；发布版本待单独 ADR/用户确认。沿用 AutoED 品牌时不要擅自发布脱节的 v0.x，也不要自动宣布 v2.0。GSD 的 M1/Phase 1 与 Git tag 分开。

## 15. GSD 新工作区操作建议

详细步骤与可复制提示词见 [GSD-START.md](GSD-START.md)。关键规则如下：

1. 建议新建旧仓库旁边的独立目录，例如 `/Users/yifeng/Documents/AutoED-Rebuild`，不是旧目录里的子文件夹；避免继承旧项目 AGENTS 和运行数据。
2. 选择独立新 Git 仓库，不直接 clone 后重跑 new-project；旧源码作为只读参考。
3. 只带本设计、M1 brief、决策表及确有需要的去敏分析文件。不要先复制旧 `.planning`。
4. 新项目从 Phase 1 开始完全合理；旧项目“不能重跑 Phase 1”的规则只针对旧活动 roadmap。
5. D1–D4 已由用户确认，不重复问回；只补充 D5 安装/数据库等剩余项，再运行交互式 `$gsd-new-project`。
6. 本机工作流的 `--auto` 会跳过深入问答并自动批准需求/路线图，还可能继续自动讨论 Phase 1。当前仍需冻结文件覆盖、安装和平台支持矩阵，建议保留交互。
7. GSD 创建 PROJECT/REQUIREMENTS/ROADMAP/STATE；检查生成的 AGENTS 是否保留批准后的安全规则，不能被默认模板覆盖。
8. 每个阶段按 discuss → plan → execute → verify，真实登录/MFA 保留人工检查点；别把长文里的所有未来愿景都转成首版任务。

本次没有运行 `$gsd-new-project`，因为用户明确计划在新的工作区初始化；这里提供可带走的输入，不改变旧规划状态。

## 16. 建议 ADR 清单

| ADR | 建议决定 | 批准条件 |
|---|---|---|
| 001 产品与部署 | 本地单用户、macOS/Windows，模块化单体 | 产品范围已确认；OS/CPU 具体矩阵待锁定 |
| 002 会话政策 | 专属持久 Profile；不导出凭据，不复用宿主 Profile | 用户已接受；实际账号手动登录 |
| 003 数据政策 | 完整课程生命周期资料归档、长期保留；不采集凭据/raw 登录流量 | 用户目标已确认；源站/材料权限例外明确记录 |
| 004 连接路径 | 已授权 API 优先，否则获准 DOM/导出；无静默模式切换 | scope 和 connector 合规检查 |
| 005 持久化 | 建议 SQLite + 持久 Job + 本地文件；一个真源 | D5 待确认，先验证队列恢复与打包 |
| 006 外发 | 为 Codex/其他模型提供全文/文件；受限材料例外 | 用户意愿已确认；集成配置与材料权限仍需落实 |
| 007 版本模型 | immutable revisions、固定 bundle manifest、可见缺口 | schema 审查 |
| 008 MCP/Skill | stdio 薄客户端；Skill 不持有后台状态 | 真实客户端烟测 |
| 009 迁移 | 新目录/数据根，重新登录，metadata dry-run 导入 | 用户批准切换 |
| 010 发布 | 新开发标识与旧 runtime/tag 独立处理 | 发布前明确产品线版本 |
| 011 项目职责 | 仅采集/同步/归档/信息接口；评估与辅助由独立项目拥有 | 用户已确认，不再加入 AutoED 未来 roadmap |

## 17. 建项前仍需用户回答

已确认项与剩余项集中在 [DECISIONS.md](DECISIONS.md)。不重复追问 D1–D4。当前主要剩余问题是：是否希望首版终端用户无需手动安装 Node、Docker 或数据库？本方案据此建议 SQLite 与自带运行依赖的本地分发，但尚未替用户批准。

Phase 1 再锁定最低 OS/CPU、可用 Windows 测试设备、文件类型门禁与磁盘预算；Phase 2 需要用户指定课程/账号范围并完成真实登录。产品授权已接受不等于本轮文档编辑会自动启动登录或上传数据。

## 18. 核验来源与使用范围

以下网页仅用于核对具体技术和政策边界；架构、阶段顺序、默认预算与取舍是本方案的工程建议。

- [Playwright Persistent Context](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context)：独立目录、持久状态与独占运行。
- [Playwright Authentication](https://playwright.dev/docs/auth)：认证状态敏感性与 sessionStorage 限制。
- [Playwright APIRequestContext](https://playwright.dev/docs/api/class-apirequestcontext)：Cookie jar 共享，不等于任意内部 API 授权。
- [Playwright Docker](https://playwright.dev/docs/docker)：浏览器容器、非 root 与 sandbox 配置；首版 GUI 仍在本机。
- [Browserbase Contexts](https://docs.browserbase.com/platform/browser/core-features/contexts)：persist、重用、写回时序与站点仍可强制登出。
- [OpenAI 官方 MCP 文档](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)：stdio、Streamable HTTP 与客户端配置边界。
- [MCP Transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)：HTTP Origin/loopback/auth 安全要求；实现时锁定支持的协议版本。
- [Node.js Releases](https://nodejs.org/en/about/previous-releases)：runtime 选型依据。
- [SQLite 适用场景](https://www.sqlite.org/whentouse.html)、[SQLite WAL](https://www.sqlite.org/wal.html)：本机存储、单写事务与恢复边界；本轮据用户部署范围提出的新建议。
- [Windows Interactive Services](https://learn.microsoft.com/en-us/windows/win32/services/interactive-services)、[Playwright 系统要求](https://playwright.dev/docs/intro)：本地交互登录和跨平台支持验证。
- [Moodle Web Services](https://docs.moodle.org/en/Using_web_services)：站点启用和授权前提，不构成 Monash 账号可用证明。
- [Monash AI and assessments](https://www.monash.edu/student-academic-success/ai-hub/ai-and-assessments)、[Responsible use](https://www.monash.edu/student-academic-success/ai-hub/responsible-and-ethical-use-of-ai)：assessment 条件与上传材料权限。
- [Muster LICENSE](https://github.com/Poetrynan/Muster/blob/main/LICENSE)：当前许可证为 PolyForm Noncommercial 1.0.0；默认不复制源码，必要时单独审查授权。

GSD 操作依据本机 `/Users/yifeng/.codex/skills/gsd-new-project/SKILL.md` 与 `/Users/yifeng/.codex/get-shit-done/workflows/new-project.md`。不同安装版本可能改变命令细节，以新工作区当时加载的 skill 为准。
