# 技术栈与跨平台安装升级研究

**项目：** AutoED Rebuild · 本机单用户课程同步、归档与读取服务  
**核对日期：** 2026-08-26  
**总体信心：** MEDIUM；官方能力事实 HIGH，完整组合与原生安装恢复均未实测。  
**状态：** 本文是技术建议，不是 accepted/validated 清单；新仓库无已实现能力，旧基线 `726884c` 的历史结果不继承。

## 1. 建议结论与输入优先级

采用 TypeScript 模块化单体、独立 API/Worker、Node 24 LTS、Fastify/Zod、Local Playwright Chromium、SQLite + 最小持久 Job + 本地不可变文件；UI/CLI/MCP/Skill 共用后端。不要引入 PostgreSQL、Redis、Docker、远程浏览器、云更新器或 LLM Key。

依据新 `AGENTS.md`、`.planning/PROJECT.md` 与输入 DESIGN/DECISIONS；后两份仍有 D5/D8“待确认”旧记载，以 PROJECT 的已批准安装、数据库、版本和身份规则为准。SQLite+Job+文件、macOS/Windows、提示词安装升级是已确认目标；下面的库、版本和打包实现仍待 Phase 1 决定与验证。

## 2. 核心技术与版本建议

| 技术 | 推荐版本线 / 已核对版本 | 用途与取舍 | 信心 |
|---|---|---|---|
| Node.js | 24 LTS；已核对 `24.19.0`（2026-08-03） | 每安装管理独立 runtime，API/Worker/MCP 使用同一锁定版本；不追逐 Current 26。补丁锁定前再查安全发布。[发布记录](https://nodejs.org/en/blog/release/v24.19.0)、[LTS 表](https://nodejs.org/en/about/previous-releases) | HIGH 事实 / MEDIUM 组合 |
| TypeScript + npm workspaces | TS 至少满足 Zod 的 5.5+；精确 TS/npm 待锁定 | 开启 strict，预编译交付；一份 lockfile，构建用 `npm ci`。它在依赖与 lock 不一致时失败，不替项目自动改锁。[Zod](https://zod.dev/)、[npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/) | HIGH |
| Fastify | 5.x，补丁 Phase 1 锁定 | 本地 API、请求/响应 schema；领域逻辑留在用例层。v5 要求 Node 20+；官方 LTS 表仍列较旧 Node 行，不能把文档表当 Node24 全组合测试。[迁移指南](https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/)、[LTS](https://fastify.dev/docs/latest/Reference/LTS/) | HIGH / MEDIUM |
| Zod + Fastify type provider | Zod 4.x；若 provider 7.x 则需 Zod ≥4.2；具体补丁一起锁 | 单一契约生成校验与 OpenAPI；provider 5/6 对应 Zod4，7+ 改用 encode/decode，响应类型语义也变化。测试输出脱敏和序列化，不能只过输入校验。[兼容矩阵](https://github.com/turkerdev/fastify-type-provider-zod) | HIGH |
| Playwright + 配套 Chromium | 官方 release notes 已列 1.62；精确 npm patch/browser revision Phase 1 锁定 | 库与浏览器是配套发行单元；仅装实际使用的 Chromium。库新增的通用 MCP/CLI 不作为 AutoED 对模型开放任意浏览器操作的理由。[发行说明](https://playwright.dev/docs/release-notes)、[浏览器配套](https://playwright.dev/docs/browsers) | HIGH 事实 / MEDIUM 平台 |
| better-sqlite3 | 建议以 `13.0.2` 做首轮验证；其 release 指明 SQLite `3.53.4` | 同步 prepared statements、短事务与 backup；13.0.0 转 N-API，降低 Node ABI 更换成本，但每 OS/CPU 的二进制仍需实测，不能承诺免原生兼容问题。[13.0.2](https://github.com/WiseLibs/better-sqlite3/releases/tag/v13.0.2)、[13.0.0](https://github.com/WiseLibs/better-sqlite3/releases/tag/v13.0.0) | HIGH 事实 / MEDIUM 推荐 |
| SQL migrations + FTS5 | 跟随实际嵌入 SQLite；无第二套 DB | 小型 typed repository；Job 与业务提交共用事务；索引可重建，不成为历史内容真源。[FTS5](https://sqlite.org/fts5.html) | HIGH / MEDIUM |
| React + Vite | React 19.2 文档线；Vite/patch Phase 1 锁定 | 只做本地连接、范围、任务和归档界面，构建后由 API 提供静态文件，不运行生产 dev server。[React 版本](https://react.dev/versions)、[Vite 要求](https://vite.dev/guide/) | HIGH / MEDIUM |
| MCP 官方 TypeScript SDK | v2 stable 线；精确包与协议协商 Phase 1/3 锁定 | stdio 薄客户端，只调用本地后端；官方 README 已标 v2 随 2026-07-28 spec 稳定发布，不能沿用“v2 尚未稳定”的旧判断。[SDK](https://github.com/modelcontextprotocol/typescript-sdk)、[v2 文档](https://ts.sdk.modelcontextprotocol.io/v2/) | HIGH 事实 / MEDIUM 客户端 |
| Vitest + Playwright Test | 与 Vite/Playwright 锁定的兼容版本 | 单元/契约、真实 SQLite 多进程集成、独立 synthetic 浏览器 E2E；live UAT 单独记证据。[Vitest](https://vitest.dev/guide/) | HIGH / MEDIUM |

不把上述版本直接写成已批准的 lockfile。Node、npm、driver、嵌入 SQLite、Playwright npm 包、Chromium revision、MCP 协议、OS/CPU 必须共同进入发布清单；实际安装后的探针结果才是兼容证据。

### SQLite driver 的明确取舍

优先验证 better-sqlite3 13.0.2：已有发布物和明确 SQLite 版本，可与运行时分开升级；代价是原生二进制供应链与跨平台载入检查。`node:sqlite` 是有价值的备选，可减少独立 addon，但 Node24.19 文档仍标 **Stability 1.2 / Release candidate**，并非 stable 2.0；不是“内置所以没有兼容风险”。若候选 driver 原生矩阵失败，先做 ADR 比较再改选，不同时维护两套数据库实现。[Node24 SQLite 文档](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)

## 3. SQLite、任务与文件完整性门禁

1. **先检查实际 SQLite 版本。** 官方确认 WAL-reset 竞态可影响多线程/多进程连接的并发写/checkpoint；3.51.3 于 2026-03-13 修复，3.44.6/3.50.7 有回补。本项目建议直接采用包含修复的新版本，不把“包升级成功”当引擎已升级。[WAL 风险](https://sqlite.org/wal.html#walreset)、[3.51.3 release](https://sqlite.org/releaselog/3_51_3.html)
2. DB 只放本机非同步盘。WAL 支持读写并行，仍只有一个同时写者；事务内不做浏览器/网络/文件解析。启用 foreign_keys、有限 busy timeout，默认建议 synchronous=FULL，按实测调整，不为吞吐暗降持久性。[WAL](https://sqlite.org/wal.html)
3. API 入队与 Worker 领取/提交都是短事务；条件更新、fencing token、幂等 key、重试上限、取消和 checkpoint 构成最小状态机。Job 是 at-least-once；租约超时不代表 Profile 所属进程退出。此项为项目设计建议，Phase 1 需崩溃注入验证。
4. 监控 WAL 增长与 checkpoint 受阻。固定版本分页通过 immutable revision/cursor 实现，不跨用户多次读取长期持有 DB read transaction。[WAL checkpoint](https://sqlite.org/wal.html)
5. 英文优先验证 unicode61；中文先提供 scope 内有界子串查找，再评估 trigram。FTS5 trigram 的全文查询不匹配少于三个 Unicode 字符的子串，不能声称它解决所有中文短词。索引更新与内容提交一致，并可重建。[FTS5 tokenizer](https://sqlite.org/fts5.html#the_trigram_tokenizer)
6. 原文件使用 hash/内部 ID 定址，先受控 staging、完整性检查、落盘，再事务登记引用；失败保留旧 revision。磁盘满只产生 pending/error，不删旧材料；清理安装目录不能越入资料根。
7. 升级备份采用 SQLite backup API 或停写后的完整一致性方案，不能活跃写入时只复制主 DB。备份同时固定对象 manifest 并核对 hash；加密快照的密钥由 OS 凭据机制管理，不能与明文密钥一起打包。Profile 永不进入备份；恢复要验证引用而非仅能打开数据库。[SQLite backup API](https://sqlite.org/backup.html)

## 4. 文件提取组件建议

所有提取器精确版本、许可证、依赖树与安全公告在 Phase 1 候选矩阵、Phase 5 接入前再核对。下表是 **MEDIUM 工程建议**，不是已经验证覆盖；原文件归档与正文提取分别报告结果。

| 类型 | 推荐候选 | 必须保留 / 验证的边界 |
|---|---|---|
| PDF | Mozilla PDF.js / pdfjs-dist | 用逐页 getTextContent 建物理页 locator；字体、顺序、公式、图表和扫描件不能由“返回字符串”证明完整；缺口标 partial/needs_ocr。[页 API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html) |
| DOCX | Mammoth | 语义段落/表格映射为稳定提取 locator，不能伪造 Word 页码；Mammoth 明确不清洗不可信文档，不能将输出 HTML 直接展示，禁外部文件访问。[项目说明](https://github.com/mwilliamson/mammoth.js) |
| PPTX | 有界 ZIP + OOXML 读取，候选 yauzl / fast-xml-parser | 按 presentation 关系和 slide list 排序，保留 slide/shape/段定位；notes、表格、图表分别记覆盖。Microsoft 示例证明结构，不证明我们的 TS 实现完整。[PresentationML](https://learn.microsoft.com/en-us/office/open-xml/presentation/how-to-get-all-the-text-in-all-slides-in-a-presentation)、[XML 候选](https://github.com/NaturalIntelligence/fast-xml-parser) |
| XLSX / CSV | SheetJS CE；CSV 有界解析 | 保留 sheet/cell、公式文本与缓存值区别，不执行公式/外链；官方称 npm 的 xlsx 停在旧 0.18.5，推荐源为其官方 CDN。固定官方 tarball、完整性与许可证，不直接 npm install xlsx@latest。[官方安装](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/) |
| TXT / MD / 代码 / HTML | Node 文本解码 + 受控 HTML 到文本 adapter | 编码/换行/块定位明确；HTML 只保留允许内容，不执行脚本；HTML parser 精确库尚待选，不能用正则充当安全解析器 |
| ZIP / 嵌套 OOXML | yauzl 的逐 entry 读取 | lazyEntries、大小校验之外还要限制条目数、实际解压总量、嵌套深度；拒绝路径逃逸、symlink/junction、绝对路径和 XML DTD/entity 扩展，不能只信压缩包申报大小。[yauzl](https://github.com/thejoshwolfe/yauzl) |

提取运行于受限子进程，限内存/时长/输出量，禁止网络、宏和外部资源解析；子进程本身不是安全沙箱，OS 权限和禁网如何落实需验证。只把选定文件交给提取器，不让其接触 Profile、API 凭据或整个资料根。OCR、媒体转录与完整 Office 渲染不偷偷引入 Python/Java/LibreOffice 或云服务；先诚实报告缺口，新增依赖需计划评审。

## 5. 跨平台运行与支持矩阵

| 维度 | 建议 | Phase 1 必须锁定的证据 |
|---|---|---|
| 最低 OS | 以当前 Playwright 要求的 macOS14+、Windows11+ 为讨论起点；不默认兼容 Win10 | 选定 Playwright/Node/driver 的支持交集与用户设备；官方也列 WSL，不代表本项目可拿 WSL 替代原生 Windows。[系统要求](https://playwright.dev/docs/intro#system-requirements) |
| CPU | 先声明有产物与测试机的架构；macOS arm64/x64、Windows x64/arm64 分开 | 每组合的 Node/browser/addon 载入、安装和升级；未跑的架构标 not_run，不能泛称全平台通过 |
| 后台存活 | macOS 用户 LaunchAgent；Windows 当前已登录用户的计划任务/受管启动器 | 不依赖 Codex 父进程；用户选择启用启动项，休眠恢复有限补跑；Windows 服务不直接承担交互登录窗口。[Apple](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html)、[Windows 交互服务](https://learn.microsoft.com/en-us/windows/win32/services/interactive-services) |
| 路径与秘密 | 平台路径/ACL/OS SecretStore adapter；程序、数据、Profile 独立 | macOS mode 与 Windows ACL 各验；应用凭据使用 OS 凭据机制，具体桥接依赖待选，失败不得明文回退；模型只见不透明 ID |
| 浏览器归属 | 安装 ID + 启动实例身份 + PID/开始时间 + 持有进程句柄 | 只关闭自建进程；Profile 独占，确认退出后才重新打开。Playwright 禁止同 userDataDir 并发。[持久 context](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context) |

## 6. 提示词安装与升级方案

推荐 **受管版本目录 + 稳定入口 + 发布清单**，不先做 Electron/Tauri 壳或后台自动更新器。安装提示词驱动可重复运行的安装器；不是让用户逐条手装 Node/数据库。Node 从官方发行物安装到产品管理范围，或仅使用经明确验证的兼容安装；绝不静默替换用户全局 Node。生产不依赖临时 npx latest、源码目录或开发机 node_modules。

### Phase 1 早期 beta 基础：必须早于 Phase 2 live UAT

- 在批准计划内建立 macOS/Windows bootstrap、版本化程序包、受管 Node/Chromium 安装、install ID/独立数据根、稳定 CLI/MCP 入口、最小启动/停止/诊断与重复执行检查；不要求提前有完整课程功能。
- 首次安装和 beta→beta 升级都执行校验、排他升级锁、旧进程停止、必要 schema 迁移、激活验证、失败停止/恢复；不能以“beta”豁免数据保护。无 schema 变化也记录无操作迁移。
- 发布物包含固定版本、平台/架构、runtime/browser/DB 版本、schema 范围、hash、依赖清单与安装说明；遵循 `0.1.0-beta.N` 递增规则，目标 0.1.0 仅在路线图确认后启用，不覆盖已发标签或资产。
- 自动测试与安装检查通过 → 发布可安装 beta → 验证目标资产可下载/校验/安装 → 给用户准确更新提示词和 UAT 用例 → 停止等待用户更新、官方登录与实际反馈。发布成功不是 live 成功。

### 同一升级协议，Phase 8 完整加固与验收

| 步骤 | 实现要求与失败语义 |
|---|---|
| 1 盘点 / 预检 | 识别本安装管理的版本、API/Worker/browser/CLI/MCP/启动项、磁盘空间与 schema；新旧产品各自 data root/port/install ID/MCP 名称隔离，不自动写/卸载旧产品 |
| 2 下载 / staging | 先固定目标版本；验证平台、长度与 SHA-256，再解包到新目录。Node 官方提供签名 SHASUMS；发布清单来源需可信或签名，单独同源 hash 不能证明发布者身份。[Node 校验](https://github.com/nodejs/node#verifying-binaries) |
| 3 停止 / 隔离 | 禁止新 Job，等待/取消在途任务，关闭 DB/browser，确认所有自建进程退出；PID 不可单独证明归属。锁未释放或未知进程占用就停止并给下一步，不 kill-all |
| 4 备份 / 迁移 | 可恢复 DB 快照 + 文件 manifest；不备份 Profile。记录迁移版本/checksum/完成状态，先做兼容检查；失败保留旧数据和诊断，不能继续激活或自动反向破坏性迁移 |
| 5 激活 | 更新受管 active manifest、稳定入口和启动引用；整个操作不是天然跨文件事务，需持久升级 journal 记录阶段，重跑能识别未完成激活并恢复 |
| 6 实际验证 | 从实际安装 CLI/MCP 调到 API→Worker，确认 build ID、install ID、schema、Node/SQLite/browser 和最小真实接线；只看版本字符串或 health=200 不合格 |
| 7 恢复 / 回滚 | 旧 schema 可兼容才重启旧程序；否则在尚未恢复业务写入时恢复经过验证的迁移前快照。新运行已有写入时不自动覆盖数据；保持维护态并交人工决策 |
| 8 清理 | 验证成功后移除本安装过时程序和启动引用；失败清理列为 pending。允许的回滚副本显式隔离、不自动运行；永不清理课程资料或其他产品安装 |

**Windows 文件锁必须作为正常失败场景。** 文件被其他句柄占用时删除可能失败；不能把 Unix rename/unlink 行为直接当保证。采用并列版本目录，激活前确认所属句柄关闭，清理有界重试并记录 pending；重启后继续未完成步骤，不静默杀浏览器或强删资料。cleanup_pending不是升级完成；最终验收须清理过时受管程序/入口/进程，只有明确隔离的回滚副本可保留。[Microsoft 文件关闭/删除](https://learn.microsoft.com/en-us/windows/win32/fileio/closing-and-deleting-files)

**浏览器降级不等于应用回滚。** 本项目禁止复制/备份 Profile，因此回滚设计不能依赖 Profile 快照；升级浏览器后能否由旧浏览器继续使用该目录未验证。遇到不兼容先停止/要求受控重新登录，不自动删 Profile、读 Cookie 或宣称会话可回滚。

## 7. 验证与交付优先顺序

| 阶段 | 必须交付 / 检查 | 不可替代的人工门禁 |
|---|---|---|
| Phase 1 | 锁版本、最低平台/架构、真实 DB 并发/恢复、基础文件协议、两平台 bootstrap 与 beta 通道、校验/失败恢复 | OS 安装批准、身份/发布授权；本轮只研究不执行 |
| Phase 2 | 使用已发布可获取 beta 验证 local Profile；运行时/浏览器/服务重启与 Codex 退出隔离 | 两来源和声明平台的人工登录/MFA、重复重开、跨日、reauth、账号隔离；未跑即 human_needed/not_run |
| Phase 5–7 | 按类型 golden fixture、恶意附件、满盘/中断、完整 manifest/分页全文/原文件出口、实际 MCP 接线 | 获准真实样本和具体目的地；不以合成内容替代源站覆盖 |
| Phase 8 | 干净安装、连续跨 beta 升级、迁移失败、进程锁、断电式中断、备份恢复、过时入口清理、完整功能回归与切换 | 原生 macOS/Windows 更新和完整 UAT；新旧切换由用户控制 |

Phase 8 是完整交付验收，不是最小安装/升级能力的首次出现。每个需人工 UAT 的版本都先完成可安装 beta 与可获取性检查；Windows 缺测试机是阻塞/未验证，不是通过 Linux CI 可解除的风险备注。

## 8. 不采用项与待决项

| 不采用 / 暂不采用 | 理由与替代 |
|---|---|
| PostgreSQL/Redis/pg-boss/MinIO | 已确认本机低并发范围；用 SQLite Job 与本地文件，不双栈 |
| Electron/Tauri/Node SEA 首版必需 | 不是独立后台或自动依赖安装的前提；先版本目录交付，减少 browser/addon/签名组合面 |
| 全局 npm latest / 直接覆盖活动安装 | 难复现且可能混用版本；固定清单、staging、受管入口和安装后验证 |
| 云浏览器、自动云升级、LLM/OCR 云调用 | 当前范围未批准；不让“依赖选择”扩展数据披露或后台行为 |
| “解析成功=全文完整”“原生模块能载入=平台通过” | 分开记录 coverage 与安装/集成/synthetic/live 证据 |

尚待确认：最低 OS/CPU 与 Windows 设备、平台 SecretStore/进程归属桥接、bootstrap 信任锚及签名方式、精确 npm/提取器版本和安全审查、磁盘/解包预算、升级后浏览器 Profile 兼容恢复。以上是 Phase 1/5/8 的研究门禁，不是已批准新增功能。

## 9. 来源与研究限制

所有文内链接均在 2026-08-26 打开核对，优先官方项目文档、发行说明与 Microsoft/Apple 文档；仅检索发现而未核对的内容不进入推荐事实。滚动文档未统一给发布日期：使用访问日，不伪造发行日期；Apple 启动说明是归档文档，具体 launchctl 参数仍须对目标系统验证。

Context7 MCP 在本环境未提供；CLI fallback 会触发包获取，与本轮禁止安装约束冲突，因此使用官方网页替代。环境未提供独立 Read/Write 工具，文档以现有文件读取与补丁工具处理。未运行依赖安装、学校访问、版本构建或平台测试；库组合信心只到 MEDIUM。

发布载体可用 GitHub Release 资产（[官方说明](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)），不是云运行服务。实际发布前仍须确认 `returdex` GitHub 身份、repo-local author/committer、同名仓库冲突、标准 PolyForm Noncommercial 1.0.0 与商业授权说明；本轮不建远程、不发布、不提交 Git。
