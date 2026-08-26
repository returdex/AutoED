# 架构研究：AutoED M1

**领域：** macOS/Windows 本机单用户课程归档服务。**研究日期：** 2026-08-26。  
**总体信心：MEDIUM**；SQLite/MCP/格式事实 HIGH，工程组合和真实平台行为尚未验证。  
**状态：** 仅规划研究；accepted 目标不等于 validated。具体 schema、队列算法、目录、授权配对和交付实现均为 proposed。

## 推荐架构

采用模块化单体代码库、独立 API 与 Worker 进程、一个本地 SQLite 和受控文件库。此部署方向及持久化选择已经 accepted；无需 Redis、远程对象存储、LLM 或第二业务数据库。

```text
Codex / 其他 MCP 客户端 → stdio MCP 薄进程 ─┐
本地 UI / CLI / Skill 引导的语义操作 ───────┼→ 受认证 loopback HTTP API
                                          │        ↓ Application + Policy
                                          │    SQLite：索引/版本/Job/状态
                                          │        ↑ 独立 Worker 领取 Job
                                          │    Connector → Broker → Local Playwright
                                          │                     → 专属敏感 Profile
                                          │    校验/清洗 → 文件库 + 提取子进程
                                          └← manifest/固定版本正文/受控原文件
```

MCP 的 stdio 子进程随客户端启动符合协议；**它不是 API/Worker 的生命周期父进程**。关闭它不得停止后台服务。stdio 协议 stdout 只输出 JSON-RPC，诊断也必须脱敏。[MCP stdio，2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio)

## 组件边界与目录建议

| 组件/建议目录 | 拥有职责 | 不得拥有/越界 |
|---|---|---|
| `apps/api` | 本地认证、HTTP schema、UI 静态资源、用例调用 | 不直接开浏览器、解析学校页面 |
| `apps/worker` | Job 消费、checkpoint、浏览器/提取进程监管 | 不持有任意模型指令，不把租约超时当进程退出 |
| `apps/mcp`、CLI、`apps/web` | 语义输入/展示，真实 HTTP 请求 | 不读 SQLite/Profile，不实现第二份同步逻辑 |
| `packages/domain` | 身份/scope/版本/状态不变量 | 不 import HTTP、MCP、Playwright、DB driver |
| `packages/application` | 用例、策略门禁、repository/provider ports | 不含来源 selector/学校域名 |
| `packages/connectors`、`browser` | 明确获准 access plan、来源映射、Broker/LocalProvider | 不逆向未授权端点、不共享日常浏览器身份 |
| `packages/persistence`、`platform` | SQL/迁移/对象库；OS 路径/权限/进程/启动 | 不写旧产品数据，不把 Profile 放归档/备份 |
| 提取子进程/`test-support` | 有界本地格式读取 / 无私有数据 synthetic fixtures | 进程隔离不等于安全沙箱；不得运行宏/外链代码 |

依赖注入可以组织内部 ports；但生产 MCP→API 接线验收必须经过独立进程和真实 HTTP，不能以 injected callback 代替。

## 数据模型：从第一次采集就保留来源

| 实体 | 建议不变量 |
|---|---|
| Connection / AccountBinding / CourseBinding | tenant/source/account/term 隔离；跨来源匹配须用户确认，不靠相同标题 |
| Observation / SyncRun | 成功观察、失败尝试、scope、来源时间、adapter/parser version、coverage 分开 |
| Resource / SourceRevision | 稳定源键与内容版本分离；源站没有版本号时明确是本地观察版本 |
| FileObject / ExtractionRevision | 原字节 hash 与提取文本 hash 分开；parser/sanitizer 变化不冒称教师编辑 |
| CourseManifest / ResourceManifest | 不可变目录快照引用明确版本；包括缺项与每来源观察时间，不声称双源原子快照 |
| TextSpan / Locator | 指向固定 extraction revision 的范围；PDF 页、DOCX 段、PPT slide、XLSX cell 各有类型 |
| Job / ChangeEvent | 幂等 key、attempt、状态、checkpoint、租约/fence；变化与 revision 同事务提交 |
| PolicyDecision / DeliveryReceipt | 当前材料/操作/scope/目的地决定；回执只记录必要安全元数据，不存秘密 |

来源认证、capabilities、operational health、freshness、completeness 必须分别表达。`partial`、`confirmed_empty`、`error`、`not_observed`、`deleted` 不能相互替代；失败不覆盖最后成功 projection。

## 模式一：durable Job 是至少一次执行

推荐一个调度协调者、每个 Profile 最多一个运行任务。API 入队与 Worker 领取都是短事务；`queued → running → completed/failed/cancelled`，可恢复故障经 `retry_wait` 回队，需用户动作另给 `next_action`。

1. API 校验 scope/策略并插入具有去重键的 Job，立即返回 job_id；重复请求返回同一活动任务或明确结果。
2. Worker 用事务内条件更新领取 Job，递增 fencing token；先确认受管理旧浏览器已经退出，才取得 Profile 独占锁。
3. 网络、浏览器与解析均在 DB 事务之外；定期 heartbeat/checkpoint，失去租约停止后续访问并关闭自己创建的进程。
4. 完成提交在同一事务检查 lease owner、fence 和取消状态；旧 Worker、重复执行、取消后的迟到结果均不可覆盖现态。
5. 重启恢复仅重放幂等步骤；重复观察不产生重复 revision/change。租约只保护提交，不证明浏览器进程已结束。
6. 限制重试次数/退避/排队量；auth 等人工动作、parser drift 等修复，不无限请求。休眠错过周期合并，不回放全部间隔。

SQLite 允许多读但只有一个写事务；事务竞争仍会产生 BUSY，因此必须有有界等待/重试，并验证驱动行为。[Transactions](https://www.sqlite.org/lang_transaction.html)

**Phase 1 新风险：** 官方披露 WAL-reset 损坏缺陷，影响 3.7.0–3.51.2，3.51.3 及后续或明确 backport 已修复；与多连接并发写/checkpoint 相关。锁定 driver 还不够，安装产物必须检查实际 `sqlite_version()` 和修复来源。不要把最低修复版误称当前最新版。[WAL 官方说明](https://www.sqlite.org/wal.html#walreset)、[3.51.3 发布记录，2026-03-13](https://sqlite.org/releaselog/3_51_3.html)

WAL 数据库置于本机非云同步磁盘；推荐评审 `synchronous=FULL`、busy timeout、短读事务和 checkpoint 策略。长读会妨碍 checkpoint，NORMAL 存在掉电丢失最近提交的取舍；不要用跨页长事务维持模型阅读。[WAL](https://www.sqlite.org/wal.html)

## 模式二：对象先落盘，数据库决定可见性

SQLite 的原子事务不自动覆盖外部课程文件；采用应用层提交协议，且 macOS/Windows 的文件锁、落盘与重命名语义需各自验证。[SQLite 原子提交边界](https://www.sqlite.org/atomiccommit.html)

```text
获准下载 → 同卷受控 temp → 校验长度/MIME/hash → flush → 发布 immutable object
    → DB 短事务：fence + revision + spans + projection + checkpoint + change
    → commit 后才可读取；响应前仍做权限检查
```

- temp/object 名称由内部 ID/hash 生成，用户文件名仅展示；验证路径/junction/symlink/重定向，绝不把 URL/标题拼成任意目标路径。
- 对象已落盘但 DB 未提交：孤儿不可见，保留安全等待期再 GC；GC 与写入 reservation/活跃 Job 协调，不删除仍待提交对象。
- DB 事务失败：旧 projection 不变；DB 已提交但响应丢失：重试靠幂等键读取既有结果。
- 已引用对象不存在或 hash 错：返回 integrity_error 并暂停相关交付，不能返回空文件、换成最新版本或静默丢弃记录。
- 大文件中断保留 pending；仅在确认版本/validator 一致时续传，不拼接两个源版本。磁盘满不自动清理历史。
- 备份先用一致性 DB snapshot/Backup API，再依据快照 manifest 复制引用对象，期间禁止 GC 删除被引用对象；校验后发布备份。普通备份排除 Profile。[Backup API](https://www.sqlite.org/backup.html)
- 恢复演练检查 schema、引用、hash、Job 残留和入口版本；原地复制运行中的主 DB 或只测文件存在都不算恢复成功。

## 模式三：固定提取版本的可枚举全文

建议由 `CourseManifest(version)` 枚举 `ResourceManifest(resource_revision)`，后者列出原文件、提取版本、locator 类型与五维状态，再调用 `read_resource`。

```text
request:  resource_id + resource_revision + extraction_revision + cursor/locator + limit
response: schema_version + scope + exact_versions + text + locators + next_cursor/end
          + coverage + extraction_status + observed_at + policy_status + next_action
```

- 不把 latest 解析留到每一页：第一次解析后固定版本；旧版本已删除则明确 unavailable，不用新内容填旧 ID。
- 定义 offset 单位、编码、换行规范、排序和页边界；提取器升级产生新 extraction revision，旧 cursor 不跨版本解释。
- cursor 绑定版本、scope、filter 与顺序，拒绝篡改；其内容不泄漏本地路径。每页独立短查询，持续同步不造成漏项/重项。
- MCP 2026-07-28 标准 pagination 仍针对 list 操作，不给 `resources/read` 添加正文范围协议；用明确语义工具或受控 URI 模板实现业务分页。cursor 由客户端视为不透明，空字符串也可能有效；不要以真假值判断结束。另定义版本 + locator 的业务恢复断点。[Pagination](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/pagination)
- 原文件以不透明资源 ID/URI 映射受认证的实际字节读取；resource 可含 text 或 base64 blob。大型文件设交付预算并测试客户端；不返回 Profile/文件系统路径或裸 bearer URL。[Resources](https://modelcontextprotocol.io/specification/2026-07-28/server/resources)
- 若采用新规范，用户相关 resource/list/read 缓存设 private，建议敏感资料 ttlMs=0；这只是缓存提示，不是授权/撤回保证。新规范也不保证列表跨页快照，AutoED 必须自行固定 manifest。[Caching](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/caching)
- FTS5 只是可重建检索索引；命中须关联版本/locator，搜索质量与中文分词单独验收，任何 top-k 都不代替枚举和全文。[FTS5](https://www.sqlite.org/fts5.html)

## 提取与安全边界

提取进程只接收受控本地对象，限制大小/时间/内存/展开数量，默认无网络访问与秘密环境；禁止宏、脚本、外部文件链接执行。隔离策略能否在两平台落实须测试，不因启动 child process 就宣称沙箱完成。
PDF 以物理页/文字块定位；DOCX 以 part/段落/表格定位；PPTX 以 slide/shape 定位；XLSX 以 sheet/cell 定位，公式/缓存值分离。仅提取获准可见内容，隐藏 sheet/行列、批注/备注/修订不自动扩大范围。结构依据与覆盖草案见 [FEATURES.md](FEATURES.md)，具体库和格式承诺尚待确认。
扫描件、加密、图表、公式、备注/批注覆盖均有明确状态；无文字不能直接判定资料为空。不自动增加云 OCR/LLM 服务。
来源页和文档是非可信数据：保留获准原件与安全可见文本，UI 不执行 unsafe HTML；网页文字不得改变 scope、工具或授权。
政策检查放在**每个出口**：API、MCP tool/resource、原文件/导出、搜索片段和诊断。来源权利 ∩ 当前 scope ∩ 操作 ∩ 已配置目的地；模型自报身份不构成授权。
正常获准集成能读全文；受限/未知权利返回具体 exception/next_action。固定版本也需重查当前政策；撤销只能阻止后续交付，不能承诺收回模型已读材料。
本地 HTTP 绑定 loopback，校验 Host/Origin、客户端认证、CSRF/CORS；参考 MCP HTTP 的本地攻击面防护，但内部 REST 并不因此成为 Streamable HTTP MCP 服务。[HTTP 安全要求](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)

## 分阶段建设与真实接线验收

| 阶段 | 本架构要求与可观察证据 |
|---|---|
| P1 | 契约/迁移/真实 SQLite + 文件恢复测试；最小 API/Worker/薄客户端；可获取 beta 安装升级通道；实际 SQLite 修复版与 MCP 协议/SDK/宿主矩阵核查 |
| P2 | 双源 × 原生两平台人工登录硬门禁；三次 Profile 重开、重启、Codex 退出、24h、reauth、账号隔离；先发可安装 beta 再让用户更新 UAT |
| P3 / P4 | Moodle/Ed 获准操作、覆盖和版本；P3 已做安装入口→stdio→真实 HTTP→后台读取，不只 fixture callback |
| P5 | 原字节/文本/locator/manifest 一致；长文本跨页期间同步/权限撤销/版本删除等反例；受限文件真实阻止交付 |
| P6 | 全量盘点、增量、周期对账、休眠恢复、磁盘预算；提交各边界崩溃与旧 Worker 迟到提交测试 |
| P7 | 真实配置客户端枚举→分页读全→取原件→查询变化；无 LLM Key，普通文本工具兼容路径；API 停止返回 backend_unavailable |
| P8 | 提示词安装升级、迁移失败/中断恢复、备份恢复、旧受管理程序/入口清理；绝不删除课程档案或自动改旧产品 |

自动逻辑测试、真实 SQLite/多进程 integration、synthetic 浏览器 E2E、用户 live 四类证据分开。每次人工 UAT 先验证 beta 可获取，用户在 Codex 更新并自行官方登录；缺失/失败 live 不作为债务越过依赖门禁。

## 反模式与扩展边界

- 不用 `ready=true`、HTTP 200、浏览器窗口打开或版本字符串证明真实来源可读；验收实际安装入口后的业务请求。
- 不以 DB 锁保护整个网络任务，也不让 API/MCP 持有一整个模型阅读期间的 DB snapshot。
- 不把 Job 标 completed 当课程 complete，不让 parser exception 变成空集合/删除。
- 不让 workspace 导出成为第二可写数据库；不把 Profile、数据库/WAL、日志、备份或私有 fixture 放 Git。
- 规模按单安装课程数/版本数/文件体积衡量：先限制浏览器并发、短事务、对象与提取预算；没有百万用户、微服务或云部署需求。
- EvidenceLens/AssignmentFlow 不属于任何未来 AutoED phase；AutoED 不保存作业计划、评估或生成任务。

## 来源与剩余研究

所有上文官方链接已于 2026-08-26 打开。MCP 对照 2025-11-25 历史规范与 2026-07-28 新规范，本文不替项目锁协议版本；新旧握手/请求元数据不同，Phase 1 必须核对 SDK 与宿主支持。[兼容说明](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports) SQLite 为滚动官方文档，WAL 页含 2026-08-24 更新并由 2026-03-13 修复记录交叉核验。
**HIGH：** 协议列表分页/二进制表示、SQLite 写事务/WAL/Backup 行为。**MEDIUM：** 本项目进程、提交协议和版本读取设计，须通过实现测试。
**LOW/未验证：** 本校来源访问路径、原生平台 Profile 复用、客户端二进制支持、大型/复杂文件读取质量；不得因此声称平台已支持。
Phase 1/5 还需锁定 OS/CPU、driver 内嵌 SQLite、文件落盘 API、提取依赖安全配置与预算；本轮无 Context7 MCP，且禁止安装 CLI/依赖，故使用公开官方规范/格式文档，未执行安装或学校访问。
