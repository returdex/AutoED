# AutoED 认证、隐私与失败陷阱研究

**领域：** 本地单用户课程同步、长期归档与模型读取。  
**研究日期：** 2026-08-26；仅查公开资料，未登录、采集、安装、发布或验证旧仓库。  
**总体置信度：** MEDIUM；官方机制 HIGH，学校/账户实际兼容性 LOW、live 全部 `not_run`。  
**决策状态：** AGENTS/PROJECT 中已批准边界继续有效；本文件新增机制、字段、阶段分工均为 **proposed**，不等于批准或实现。以 PROJECT 覆盖旧 DESIGN 中过时的数据库、版本及安装待决描述。

## 关键陷阱

### 1. 把 persistent Profile 当作永久登录保证

- **观察/根因：** Playwright 持久目录保存浏览器会话数据，但官方认证指南没有 sessionStorage 持久化 API；这不证明所有 persistent-context 恢复行为，也不证明学校会话寿命。[S1] [S2]
- **后果/检测：** 同窗口能读，关窗、重启或隔日失效；HTTP 200、停留在学校域名都不是认证成功证据。分别检查来源最终 origin、受保护内容正面标志和账户绑定。
- **预防（proposed）：** 采用专属 persistent context；官方页面由用户手输密码/MFA，不读取输入值、按键、Cookie 或 token，不照抄文档中的 storageState/sessionStorage 导出示例。到期明确等待 reauth。
- **阶段/证据：** P2；synthetic 仅验证状态机，双来源×原生双平台 live 验证实际复用。24 小时是项目验收窗口，不是供应商承诺；72 小时仍只是建议。

### 2. 租约到期就抢占 Profile，或误杀日常浏览器

- **观察/根因：** Playwright 明确同一 User Data Directory 不能同时启动多个实例；关闭 persistent context 会关闭对应浏览器。数据库租约并不证明 OS 进程退出。[S1]
- **后果/检测：** 登录与同步同时开窗、Profile 锁错误、旧 Worker 恢复后写回、PID 被复用后杀错进程。
- **预防（proposed）：** 按来源账户 identity 串行化；租约＋fencing token＋进程所有权记录；确认本安装/本 Job 创建的进程退出才释放独占。所有权不确定则 `human_needed`，不删除锁文件强开、不 kill-all。
- **阶段/证据：** P1 定义不变量，P2 原生进程集成验证，P6 故障恢复；测试并发登录/同步、Worker 崩溃、过期租约与仍存活浏览器。

### 3. Windows 后台服务被误当成交互桌面，chmod 被误当作 ACL

- **观察/根因：** Windows 服务通常运行于 session 0；文件访问由安全描述符/ACE 与继承控制。DPAPI 的 machine scope 可允许同机其他用户解密，不能代替用户隔离。[S4] [S5] [S6]
- **后果/检测：** 后台显示 healthy 却无登录窗口；换 OS 用户后还能读 Profile/应用密钥；启动任务错误使用高权限账户。
- **预防（proposed）：** 浏览器和 Worker 运行于获准交互用户会话；Windows 明确检查 ACL/继承，macOS 检查目录权限。应用密钥用用户级 OS 密钥保护，不明文降级；Profile 留给浏览器管理，不导入密钥库、不导出给模型。
- **阶段/证据：** P1 平台端口，P2 原生 Windows/macOS 人工登录和跨用户拒绝测试，P8 安装/恢复回归；WSL、Linux 或容器不能替代 Windows 证据。

### 4. 专属 Profile 被当作普通文件或“无凭据”方案

- **观察/根因：** 认证状态可被用于冒充用户；Chrome 136 起限制默认用户目录的远程调试，官方要求隔离目录。[S2] [S3]
- **后果/检测：** Profile 混入 Git、备份、云盘或诊断包；日志出现路径、Cookie、输入值；为了排查失败打开 HAR、trace 或登录截图。
- **预防（proposed）：** 仓库外敏感目录，默认排除 Profile 备份/导出；禁止复用 Codex/日常 Chrome Profile。诊断仅允许脱敏错误码和版本/时间；不采集 raw HTML、网络 headers/body、录像、登录截图、敏感 console。
- **阶段/证据：** P1 数据分类，P2 登录期输出检查，P8 打包/备份排除检查；合成 canary 检查工具、日志和产物，不扫描真实秘密来证明“没有泄漏”。不承诺抵御同用户恶意进程或管理员。

### 5. 只监听 loopback，未认证的本地控制面仍可被调用

- **观察/根因：** MCP HTTP 规范明确指出 DNS rebinding 风险，要求 Origin 验证并建议 loopback 与认证；OWASP 提醒 CORS/SameSite 不能普遍替代 CSRF 防护。[S7] [S8]
- **后果/检测：** 恶意网页触发同步/删除/导出；`Host: attacker.example`、错误 Origin 或无凭据请求仍被接受。
- **预防（proposed）：** 本地 API 明确绑定 loopback，验证 Host 和精确 Origin/端口、逐请求认证、拒绝宽泛 CORS；UI 状态变更使用 CSRF 防护；无 Origin 的 CLI/MCP 也必须独立认证。配对密钥不放 URL、日志或 localStorage。
- **阶段/证据：** P1 最小安全控制面，P2 登录入口，P7 所有入口；跨站表单、错误 Host/Origin、缺失/失效凭据、跨课程访问均做反例。首版仍是 stdio MCP；HTTP 规范仅作本地 API 防护参考，不新增远程 MCP。

### 6. 看到 Moodle/Ed 网页或 XHR 就假定可调用 API

- **观察/根因：** Moodle 需要管理员启用服务、协议、函数和用户 capability/token；浏览器 APIRequestContext 共享 Cookie jar 仅是技术能力，不是站点授权。[S9] [S10]
- **后果/检测：** 把 SSO 成功标为 API 可用；按第三方 SDK 猜端点；认证失败后静默改用另一身份/通道；误将发帖或开始测验当导航。
- **预防（proposed）：** 每个来源操作登记文档、授权依据、账户/学期/scope 与唯一 access plan；未获准 API 不探测、不逆向，改用明确获准的 DOM/导出或报告 unavailable。读取按业务语义限制，不能只凭 GET/POST 判定。
- **阶段/证据：** P2 认证门禁不替代业务路径许可，P3 Moodle/P4 Ed 逐操作验证。公开 Ed 搜索只找到产品/登录/帮助材料，未取得当前账户可用 API 证据；不宣称“Ed 没有 API”。[S11]

### 7. 权限 gate 只放在某个 MCP tool，或把所有全文永久 local_only

- **观察/根因：** 用户已批准归档与模型读取，但访问、保留、外发是不同权限。Monash 官方说明教师讲义/视频及 Moodle 材料用于 AI 需要相应许可。[S12]
- **后果/检测：** REST、resource、文件下载、摘要或诊断绕过 tool gate；只返回标题/URL 也泄漏；另一端过度拒绝使全文目标未交付。
- **预防（proposed）：** 所有出口统一求交集：材料权利∩当前用户 scope∩操作∩配置目的地；包括 MCP tools/resources、API、文件/导出、诊断及安全错误信息。获准内容正常分页读全，不重复请求已给产品同意；明确受限/未知材料返回具体依据、影响和待确认动作。
- **阶段/证据：** P1 最小 policy 契约，P3 首个内容出口即执行，P5/P7 完整反例矩阵。MCP 正文到模型属于外发；不信模型自报“本地”，不通过摘要绕过限制，不推理作业辅助是否合规。

### 8. 页面文字、文件名和跳转被升级为控制命令

- **观察/根因：** 课程页面/附件都是不可信输入；下载器可能被恶意 URL 或重定向带到本机/内网，解析器可能执行宏或抓外链。OWASP 建议 allowlist 并防止重定向绕过检查。[S13]
- **后果/检测：** 页面注入改变 scope/目的地；MCP 接受任意 URL/JS/selector；ZIP 路径逃逸、压缩炸弹、HTML 脚本、Office 外链造成泄漏。
- **预防（proposed）：** MCP 只接语义 ID 与有界参数，Browser 句柄仅留可信 adapter；每次跳转检查协议/origin/解析 IP，下载写入隔离暂存，验证目标路径及 symlink/junction。解析限时/限量、不执行宏/代码/外链，UI 不执行源 HTML。
- **阶段/证据：** P1 输入边界，P3/P4 导航，P5 下载解析；合成注入、跨 origin/私网跳转、路径逃逸、超大及畸形文件测试；源站访问记录/会话刷新不被描述为学术业务写授权。

### 9. 所有失败都返回空数组，或把“文件存在”标作可读全文

- **观察/根因：** 认证、能力、网络健康、freshness、completeness 被单一 ready 混合；分页预算、文件下载和提取进度未建模。
- **后果/检测：** 登录失效清空旧课程；分页未完即删除未观察项目；扫描 PDF、加密文件或磁盘满仍显示 complete；parser 升级制造虚假来源变化。
- **预防（proposed）：** 明确区分 partial/confirmed_empty/error/not_observed/deleted；失败保留最后成功版本。分别记录 discovery/fetch/archive/extraction/model-access；不可变 revision、原文件 hash 与 parser 版本分开；固定版本分页，不以 top-k 或路径冒充完整读取。
- **阶段/证据：** P1 数据契约，P3/P4 来源，P5 提取，P6 对账；断网、权限拒绝、parser drift、缺页、磁盘满、源删除分别验收；不能借 complete 标签隐藏未支持课程分类。

### 10. beta、CI 或一门课 POC 被当成双源双平台完成

- **观察/根因：** 测试替身能通过、版本号改变或产物上传成功，被误写成真实来源登录/新功能已安装；把最小分发留到 P8 导致 P2 无法人工更新。
- **后果/检测：** Windows 无 native 结果却宣称兼容；24 小时未到就 pass；安装入口仍指旧版；Phase 2 failed 被作为“以后补”继续依赖阶段。
- **预防（proposed）：** 自动测试→构建/安装升级检查→不可覆盖的 beta→实际可获取检查→明确更新提示词/用例→用户在 Codex 更新并官方登录→脱敏 live 记录。最小 beta 通道置于 P2 live 前，P8 完成全量交付/恢复。
- **阶段/证据：** P1/P2 提前交付基础，P2 硬门禁，P8 完整覆盖；计划批准才执行，本轮不发布。版本、安装路径接线、MCP/CLI→API→Worker 与真实行为都要验证，不能只比版本字符串。

## Phase 2 live 硬门禁记录

以下为 PROJECT 已要求的验收，不新增自动批准；每个场景均逐个覆盖 **Moodle/Ed × macOS/Windows 原生**。记录仅含脱敏平台/版本/日期/场景/结果/下一步，不含真实凭据、Profile 路径或课程正文。

| 场景 | 最低观察 | 证据类型/未跑状态 |
|---|---|---|
| 官方人工登录/MFA | 用户完成，确认账户、课程范围与最终来源 | user-run live；`not_run` |
| Profile 正常关闭→重开三次 | 三次独立认证探测，不借已有浏览器 | user-run live；`not_run` |
| Worker 重启、OS 重启 | 原生安装入口恢复，仍是正确绑定 | user-run live；`not_run` |
| Codex 完全退出 | 后台在允许的用户会话中独立执行限定读取 | user-run live；`not_run` |
| 24 小时复查 | 记录真实间隔与可读/需重认证结果，不改系统时钟替代 | user-run live；`not_run` |
| 明确退出/自然过期与 reauth | 清楚提示、旧资料保留、人工重新登录 | user-run live；`not_run` |
| 真实账号绑定与授权范围 | 核对当前账号与用户选定课程范围，不探测未授权页面 | user-run live；`not_run` |
| 敏感输出与安装证据 | 合成泄漏检查先过，用户更新的是可取得 beta | automated＋user-run live；各自 `not_run` |

任一必需 live 场景 failed/human_needed/not_run 均不推进其依赖阶段；缺账号/设备时停等用户，不能 fixture 替代、自动生成反馈或偷偷缩成单源。72 小时补充观察为 **proposed**；无法保证每个站点恰在 24 小时内自然过期。

换号/identity mismatch、独占及网络/权限拒绝/parser 失败分类另列强制 S/I 反例台账，均 not_run；不要求故意制造学校故障或提供未授权第二账号，不能用这些结果填写 live 单元格。P1 基础 beta 只做安装/升级检查；官方登录从有认证功能的 P2 beta 起按场景执行。

## 中等风险与恢复

| 陷阱/早期信号 | 预防或恢复（proposed） | 阶段/证据 |
|---|---|---|
| SQLite 放同步盘；只复制主 DB；恢复后丢文件 | 本机磁盘、官方一致性备份方案、DB 与文件 manifest/hash 对账；备份排除 Profile，恢复后人工登录。[S14] [S15] | P1/P6/P8；真实 DB/文件故障注入 |
| 失联旧 Worker 重复提交、唤醒后任务风暴 | 条件领取与 fencing、有界重试、checkpoint 同事务、错过周期合并；保留失败状态 | P1/P6；多进程 integration |
| 浏览器默认选项被误认为安全部署配置 | 核对锁定版本的有效 sandbox 与启动参数；Playwright 当前 `chromiumSandbox` 默认 false，具体原生保护策略待验证，不以禁用安全措施换登录通过。[S1] | P2；native 配置与行为检查 |
| 安装“成功”但新旧入口、端口或进程混用 | 独立 install ID/data root/DB/端口/MCP 注册；只清理本安装受管程序，归档不删；回滚副本隔离不自动运行 | P1/P8；原生升级/失败回滚 |
| 断开连接被误当注销/删除全部资料 | 分清停止同步、解绑、学校注销、Profile 删除、归档删除；先预览，权限变化逐项限制而非整库抹除 | P2/P6/P8；contract＋人工确认 |
| 发布身份/标签错误或私密材料入产物 | Git author/committer 与 GitHub 认证分别检查；仅 returdex，冲突仓库停；标准许可证、beta.N 不覆盖；产物去敏清单 | P2 beta 前/P8；发布审计，本轮 `not_run` |

## 约八阶段的风险责任映射（proposed）

| 阶段主题 | 必须提前关闭的风险 | 主要证据 |
|---|---|---|
| P1 范围/骨架/平台端口 | 状态契约、scope/policy、凭据与归档分区、进程身份、本地 API 安全、最小 beta 准备 | contract/integration/synthetic |
| P2 登录 POC＋早期 beta | 专属 Profile 独占、真实认证/重启/跨日、双源双原生平台；失败即停止 | 自动门禁＋可获取 beta＋user-run live |
| P3 Moodle 全课程信息 | 已授权路径、本人信息、分页/空态、稳定 revision、首个 MCP 出口 gate | contract＋范围明确的 live |
| P4 Ed 讨论与绑定 | 授权依据、匿名/角色原始信号、编辑/回复/附件、跨源课程不误并 | contract＋来源 live |
| P5 文件归档与读取 | SSRF/路径/解析限额、完整 manifest、固定版本全文、原文件和目的地 gate | 恶意合成样本＋integration |
| P6 生命周期与恢复 | 重试幂等、崩溃恢复、历史不误删、权限变化、离线后有限补跑 | 故障注入＋原生恢复 |
| P7 UI/MCP/Skill | 所有出口同一策略、未支持/受限可见、全文可读、不加入学术推理 | 真实客户端 integration＋live |
| P8 完整分发与切换 | 跨平台安装/升级/备份恢复、实际入口接线、新旧隔离、人工 switch gate | 原生安装升级＋user-run live |

## 证据缺口与后续研究

- **HIGH：** 官方机制的明确约束；**MEDIUM：** 对本项目的机制组合与阶段建议；**LOW/not_run：** 学校 SSO 会话时长、headless 兼容、账号/API 权限、具体课程材料权利及 native 安装表现。
- sessionStorage 官方表述存在容易误读处：MDN 明确其可跨刷新/恢复、按 tab/origin 分区；不能把 Playwright 认证指南简述推导成“刷新必丢”或“Profile 必保”。实际持久恢复须 P2 验证，禁止读出秘密补齐。[S2] [S16]
- 未获得 Ed 账户/API 许可证明、实际材料外发规则、原生设备/OS/CPU 矩阵；在相关阶段锁定，不伪造可用性。学校政策只作为材料权限边界，不增加作业评估器。
- Context7 MCP 与现成 CLI 不可用；遵守本轮“不安装”约束，未运行会下载 CLI 的 npx，已改用官方网页搜索并打开。Playwright/Ed 页面动态内容与文档更新可能改变细节，实施时按锁定版本重新核对。

## 官方与一手来源

以下均于 **2026-08-26** 查阅；未提供明确页面日期者记查阅日，不把搜索抓取日当发布日期。S11 仅获得搜索摘要及打开空页面/帮助重定向，证据 LOW；其余明确机制的置信度 HIGH，不代表 AutoED 已验证。

[S1]: https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context "Playwright BrowserType：persistent context/独占/sandbox；持续更新，查阅 2026-08-26"
[S2]: https://playwright.dev/docs/auth "Playwright Authentication：敏感状态与 sessionStorage；持续更新，查阅 2026-08-26"
[S3]: https://developer.chrome.com/blog/remote-debugging-port "Chrome 调试目录变更；发布/更新 2025-03-17"
[S4]: https://learn.microsoft.com/en-us/windows/win32/services/interactive-services "Windows Interactive Services；更新 2021-01-07"
[S5]: https://learn.microsoft.com/en-us/windows/win32/fileio/file-security-and-access-rights "Windows 文件权限与继承；更新 2025-07-09"
[S6]: https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata "Windows CryptProtectData；更新 2026-05-15"
[S7]: https://modelcontextprotocol.io/specification/2025-11-25/basic/transports "MCP Transports；规范版本 2025-11-25"
[S8]: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html "OWASP CSRF Prevention；查阅 2026-08-26"
[S9]: https://docs.moodle.org/en/Using_web_services "Moodle Using web services；页面更新 2025-05-13，通用文档非学校授权"
[S10]: https://playwright.dev/docs/api/class-apirequestcontext "Playwright APIRequestContext；查阅 2026-08-26"
[S11]: https://edstem.org/ "Ed 官方产品页；查阅 2026-08-26；未获得账户 API 文档证据"
[S12]: https://www.monash.edu/student-academic-success/ai-hub/responsible-and-ethical-use-of-ai "Monash Responsible and ethical use of AI：Privacy/IP；查阅 2026-08-26"
[S13]: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html "OWASP SSRF Prevention；查阅 2026-08-26"
[S14]: https://sqlite.org/wal.html "SQLite WAL；查阅 2026-08-26"
[S15]: https://sqlite.org/backup.html "SQLite Online Backup API；查阅 2026-08-26"
[S16]: https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage "MDN sessionStorage；查阅 2026-08-26"
