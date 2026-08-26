---
phase: 1
slug: beta
status: approved
shadcn_initialized: false
preset: none
created: 2026-08-27
reviewed_at: 2026-08-27
---

# Phase 1 — UI Design Contract

> 最小本地状态页面与安装/升级反馈契约。视觉、语言和布局是设计默认，不是用户逐项选定；不锁定技术栈或授权实现，相关 PLAN 仍须用户确认。当前全部产品证据 not_run。

## Scope and Sources

- 基线：`AGENTS.md`、`.planning/phases/01-beta/01-CONTEXT.md` P1-D01–P1-D16、`.planning/REQUIREMENTS.md` ARCH-01/02、PLAT-01、SEC-01、JOB-01、DIST-01/02/03、`.planning/ROADMAP.md` Phase 1、`.planning/PROJECT.md`、`.planning/STATE.md`、`.planning/VALIDATION-STRATEGY.md`、`.planning/research/STACK.md`。
- 只包含最小本地状态页、安装器/CLI 的预览和结果反馈、synthetic 任务状态。学校登录在 P2；完整课程、文件、历史、搜索管理在 P7。
- 不增加系统自启动、后台自动升级、浏览器操控、远程管理、课程操作或宿主 helper。
- API 停止时自身不能托管可用页面；CLI/安装器提供外部诊断与按需启动。页面不是独立进程管理器。

## Design System

| Property | Value |
|----------|-------|
| Tool | none；未初始化设计系统 |
| Preset | not applicable |
| Component library | none selected；由研究与相关 PLAN 确定 |
| Icon library | none；文字及简单 CSS 标记，不用 emoji 表示状态 |
| Font | system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif |

仓库没有应用代码、components.json、组件库或现有设计资产。React/Vite 只是研究候选，不能据此安装 shadcn；后续批准技术栈时再检查适用门禁并对齐契约。不下载第三方 registry、外部字体、图片 CDN 或分析脚本。

默认简体中文，版本、错误码、构建 ID 保留原值。采用浅色、中性单页；不增加深色模式、全局导航、课程侧栏或品牌插图。

## Layout and Component Inventory

最大内容宽度960px；桌面左右边距24px，窄屏16px。按内容纵向堆叠，无图表或复杂仪表盘。顺序：

1. “AutoED 本地服务”、beta版本及“仅模拟数据”说明。
2. 阻塞提示：原因、影响、下一步。
3. API和Worker分别显示状态、最后成功检查时间。
4. 目标/manifest/API/Worker/CLI/MCP实际版本、build ID、检查时间和匹配结果。
5. 最近synthetic自检：job_id、状态、attempt、更新时间和结果。
6. 最近安装/升级：操作ID、阶段、自检、旧程序/入口/进程清理结果。
7. 折叠技术详情：OS/CPU、固定依赖、实际SQLite/browser版本、验证摘要及脱敏错误码。

组件只需标题、文字、状态标签、提示区、描述列表、版本比较表、步骤列表、按钮/链接、原生详情折叠和确认区。无大型data grid、tabs或主流程modal。

窄屏按上述顺序堆叠，版本值换行，不裁切关键差异。必要原始ID可局部滚动；折叠内容必须有键盘操作及展开状态语义。安装预览与确认区属于CLI/安装器，不暗示要开发图形安装器；终端采用相同字段顺序和文案，视觉CSS值仅适用于网页。

## Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | 状态标记与标签内部 |
| sm | 8px | 同组字段、按钮间隔 |
| md | 16px | 内容、窄屏边距 |
| lg | 24px | 桌面边距、区块内边距 |
| xl | 32px | 主区块间隔 |
| 2xl | 48px | 页头与主体间隔、交互目标最小高度 |
| 3xl | 64px | 页面底部空间 |

Exceptions: none。边框/focus outline是描边，不是额外间距token。

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 16px | 400 | 1.5 |
| Label | 14px | 400 | 1.5 |
| Heading | 20px | 600 | 1.2 |
| Display | 28px | 600 | 1.2 |

仅14/16/20/28px四种字号和400/600两种字重。按钮16px/600，状态强调14px/600；版本是可选文本，不额外缩小。错误、待验证、权限信息不以浅灰或小字弱化。

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | #F8FAFC | 页面背景 |
| Secondary (30%) | #FFFFFF | 状态、详情与确认区 |
| Accent (10%) | #1D4ED8 | 当前主操作、focus outline、必要下一步链接 |
| Destructive | #B91C1C | 仅具有明确破坏影响的动作；P1无删除资料动作 |

正文#0F172A，辅助文字#475569，边框#CBD5E1；60/30/10为面积指导，不为比例增加装饰。错误/成功靠明确文字、位置和结构区分，颜色不是唯一信号。禁用态保留可读文字和原因，不仅降低opacity。

Accent reserved for: 当前“刷新状态”主操作、确认操作的对应视觉呈现、键盘焦点及错误区域必要下一步链接。不得把全部交互元素、状态标签或版本值染成强调色。实心强调按钮采用白色文字；普通链接带下划线。焦点使用2px #1D4ED8描边及4px偏移。

## Interaction Contract

### Surfaces and authority

- 网页读取状态并支持“刷新状态”；启动、停止、安装、升级和已有任务操作由CLI/安装器处理。没有网页主机执行、任意URL/JS/selector入口。
- 各客户端经同一后端业务契约；UI不直接读取DB、Profile或进程秘密。
- 未配对/未认证页面只给通用拒绝与通过本机CLI重新打开的指导，不显示版本、安装ID、路径、任务、依赖或诊断资料。
- 配对机制由SEC-01研究/PLAN确定；不预先认可粘贴密钥、URL token、localStorage凭据或任意来源跨域访问。每次读取仍执行认证与权限检查。

### Startup and unavailable backend

- 默认按需启动，不配置系统登录自启动；安装/升级后自动启动并自检。关闭Codex不终止服务。
- API不可达时CLI/安装器明确报告。已打开页面若刷新失联，保留上次值但标“上次读取，当前不可确认”及时间；不继续展示成当前健康。
- 网络失联与权限失效分开：收到401/403或确认配对/权限失效时，立即隐藏此前受保护的版本、任务、路径及诊断字段，转为通用访问拒绝状态；不得沿用网络失联的旧快照展示。
- 尚未刷新时，也始终标“读取于{time}”，不声称持续实时监测。初次打开无法连接时不承诺有产品离线页面，安装说明/CLI提供外部恢复步骤。
- API正常而Worker停止分别呈现；刷新不启动后端、不升级、不创建自检任务。

### Install/upgrade preview and confirmation

变更前CLI/安装器显示目标与当前实际版本、兼容检查、本次受管安装位置、所需依赖、预计修改、影响的本安装进程/入口、服务中断、自启动关闭、新旧隔离、资料保留及安全恢复路径是否已确定。

面向本机用户的安装位置预览不含Profile路径或凭据；发送给Codex/MCP的输出使用脱敏路径别名并执行目的地检查。一次确认绑定本次范围；版本、权限或影响范围改变需重新确认。拒绝确认不产生受管安装变更。

确认后自动执行范围内步骤。OS授权、新权限、无法安全恢复或必须人工操作时暂停；不得模拟确认或把超时当同意。

### Progress and completion

依据实际执行记录显示预检、下载/校验、停止受管进程、迁移/激活、启动、自检、清理及结果。不可测量时只显示阶段和活动状态，不编造百分比或剩余时间；具体记录机制由研究/PLAN确定。

整体结果必须明确区分：
- 完成：目标启动、实际接线自检和必要清理全部通过。
- 升级失败，已恢复旧版：显示当前实际旧版，不称目标升级成功。
- 操作未完成：cleanup_pending、版本不匹配或自检失败。
- 等待人工处理：不能保证安全恢复、新权限或人工动作。
- 首次安装失败：没有旧版，不能称“已恢复旧版”。

manifest/API/Worker/CLI/MCP的差异逐项展示；无法调用或未检查不能显示“匹配”。单独version输出或HTTP200不构成完成证据。可保留的回滚副本必须明确隔离且不活动。恢复不能覆盖新写入、强制不兼容降级、备份/导出Profile或终止无关进程。

### Tasks, errors and refresh

任务展示须区分排队、运行、等待有界重试、取消请求、已取消、成功、失败；以服务端模型映射，未确认执行中断不得把取消请求标为已取消。重启后仍可查询持久job_id与状态，历史快照和当前观测分别标注。

错误显示发生阶段、脱敏错误码、影响和可执行下一步；不循环升级或重试不安全操作。刷新为读取，安装器触发的自检不因网页刷新重复执行。

动态状态采用非打断播报；关键失败一次性通知。刷新不移动焦点或重复播报全部字段。未开始、加载、无记录、失败、不可达、未验证分别呈现。

## Copywriting Contract

| Element | Copy |
|---------|------|
| Page title | AutoED 本地服务 |
| Scope notice | 当前版本仅验证本地服务与安装升级，未连接学校或采集课程。 |
| Page primary CTA | 刷新状态 |
| Installer/CLI confirmation | 确认安装 / 确认升级 |
| Decline preview | 暂不执行 |
| Preview notice | 确认后将按以上范围自动执行；新增权限或无法安全恢复时会暂停。 |
| Startup explanation | 按需启动；退出 Codex 后继续运行。系统登录自启动未启用。 |
| Loading | 正在读取本地服务状态… |
| Empty state heading | 尚无自检记录 |
| Empty state body | 安装或升级后将自动启动服务并自检。请先在 Codex 中完成已发布测试版的安装。 |
| Unpaired heading | 此页面尚未获得本地访问权限 |
| Unpaired body | 请从本安装的 CLI 重新打开本地状态页。不要在对话中粘贴访问凭据。 |
| API unavailable | 无法连接本地 API。请在 Codex 中使用本安装的启动或诊断步骤。 |
| Stale snapshot | 以下为上次读取结果，当前状态尚未确认。 |
| Worker unavailable | API 可连接，但 Worker 未运行，后台任务暂不能执行。请通过本安装的 CLI 检查服务。 |
| Version mismatch | 检测到组件版本不一致，操作未完成。请查看差异并通过本安装的升级流程处理。 |
| Cleanup pending | 旧受管程序、入口或进程尚未清理完成，操作未完成；目标运行状态请查看自检结果。 |
| Safe rollback | 升级失败，已恢复旧版。当前运行 {actual_version}；未自动重试升级。 |
| Unsafe rollback | 操作已停止，尚不能确认安全恢复方式。请查看脱敏原因并等待人工确认；不要删除资料或强制降级。 |
| First install failure | 安装失败，服务尚未就绪。当前没有可恢复的旧版；请按诊断结果处理。 |
| Success | 操作完成：目标版本已启动，实际接线自检通过，旧版本清理完成。 |
| First-install success cleanup | 首次安装，无旧版本需要清理。 |
| Unverified | 未验证，不代表已通过。 |
| Human testing gate | 自动检查已完成；请更新到已发布的 {beta_version} 并按测试清单操作，结果等待你的反馈。 |
| Destructive confirmation | 不提供删除课程资料、Profile、legacy安装或强制降级入口。受管旧程序清理包含在事前范围确认内；新增破坏性动作另行批准。 |

占位值来自已认证、脱敏的真实状态；无证据禁止填示例pass、假版本或假时间。技术详情不含原始堆栈、请求内容、环境变量、Profile路径或凭据。下一步文案在实现时必须绑定真实已安装入口/命令，不能使用不存在的helper。

## Accessibility and Responsive Behavior

- 所有操作键盘可达，焦点描边不被遮挡；可见标签即可访问名称，禁用动作同时显示原因。
- 标题层级有序；表格有表头，窄屏可变为带标签的描述列表。
- 200%放大、320px窄屏不隐藏完成条件或下一步，长版本和中文路径可读。
- 无必须动画，不持续闪烁；尊重减少动态效果偏好。
- 不以颜色、图标、hover或toast作为唯一错误提示；不默认显示私人信息，不用登录截图/录屏验收凭据。

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none | none | 仓库无组件库/registry，未下载或引入第三方块；当前不适用 |

以后新增registry须完成对应源码审查与审批，不能沿用本次“不适用”作未来安全证据。

## Verification Contract

以下是未来验收要求，当前全部not_run：
- S：覆盖加载、无记录、未认证、失联、Worker停止、版本差异、cleanup_pending、旧版恢复、首次失败和人工暂停的文案/状态。
- S/I：未配对和错误响应不泄漏数据，出口检查权限/目的地；认证失效不继续披露数据。
- I：真实API/Worker分离、持久job查询、实际安装组件版本对照；刷新不创建任务或启动服务，自检反映实际接线。
- I：API关闭后刷新标stale，冷启动不可达由CLI指导，不依赖不存在的网页启动器。
- N：声明的原生macOS/Windows键盘、缩放、长中文路径、版本换行、确认、失败反馈和后台存活检查。
- 人工N检查前先发布可获取beta，用户在Codex更新；本阶段不要求学校登录，发布不等于测试通过。
- 每项证据对应版本/平台，未测组合保持not_run。设计文本通过审查不代表渲染、无障碍或真实产品已通过测试。

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-08-27 by gsd-ui-checker; 6/6 design-contract dimensions, zero blocking findings. 非阻塞建议“网络失联与权限失效分开”已纳入。该签核仅代表设计文本审查，不是用户 PLAN 批准，也不是渲染、无障碍、安装或产品验证。
