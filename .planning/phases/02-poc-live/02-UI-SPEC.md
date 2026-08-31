---
phase: 2
slug: poc-live
status: approved
shadcn_initialized: false
preset: none
created: 2026-09-01
reviewed_at: 2026-09-01
---

# Phase 2 — UI Design Contract

> 双来源原生登录 POC、本地身份核对和 live 硬门禁的视觉与交互契约。沿用 Phase 1 已交付的原生 HTML/CSS/TypeScript 状态页，不引入前端框架或第三方组件。

## Design System

| Property | Value |
|----------|-------|
| Tool | 手工维护的现有轻量设计系统 |
| Preset | not applicable |
| Component library | none；使用语义 HTML 原生控件 |
| Icon library | none；状态不得只依赖图标 |
| Font | `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif` |
| Existing source | `apps/status/styles.css`, `apps/status/index.html`, `apps/status/src/main.ts` |

所有新增界面必须继续满足：键盘可操作、明确可见焦点、最小 48px 操作高度、`aria-live` 状态更新、窄屏单列、文本可换行、无外部字体/图片/脚本依赖。禁止把学校页面嵌入 iframe；登录只在受管的官方 Playwright 窗口中进行。

## Information Architecture

已配对本地页面从上到下固定为：

1. 页面标题、刷新按钮和全局 live-region。
2. **总体认证门禁**：第一视觉焦点；明确显示 `可开始 macOS 检查 / 需要用户操作 / 已阻塞 / 尚未验证`，并列出阻塞原因和唯一下一步。
3. **私人信息提示**：仅当来源身份可显示时出现，说明姓名、学校邮箱和课程名只在此已配对本地页面展示，不应截图或复制到聊天。
4. **双来源状态卡组**：Moodle、EdStem 同级并列；桌面双列，窄屏单列，不以其中一个作为“主来源”。
5. **账户绑定核对**：并列展示两个来源的完整身份、本地绑定判定、短指纹和确认动作；`identity_mismatch` 时位于状态卡之后并使用高优先级阻塞样式。
6. **macOS live 检查点**：A、B、C、D 与 reauth 独立行，显示 pass/failed/human_needed/not_run、时间、脱敏结果码和下一步。
7. **平台缺口**：macOS 与 Windows 分列。Windows 固定保持 `not_run / human_needed`，直到真实证据写入；任何 macOS 结果不得使总体 Phase 2 显示完成。
8. 既有运行时、版本、自检、安装与折叠诊断区；降低视觉优先级，但不得删除。

## Component Inventory

### OverallGate

- 标题：`双来源认证门禁`
- 首行必须是结果标签和一句解释，不能只显示颜色或 code。
- 内容顺序：当前平台 → Moodle/EdStem 是否各自确认 → 绑定一致性 → 当前 checkpoint → 阻塞原因 → 下一步。
- `identity_mismatch`、越界 origin、Profile 所有权不明、敏感输出检测失败均呈现为阻塞，不显示继续登录/检查课程按钮。
- macOS 全部通过但 Windows 未跑时显示：`macOS 检查已完成；Windows 仍待验证，Phase 2 尚未整体通过。`

### SourceCard

每张卡固定包含：

- 来源名和规范化 official origin。
- 状态标签：auth、capability、health、freshness、completeness。
- 完整显示名和完整学校邮箱，仅在已配对 protected view；无值时显示原因而非空白。
- `共享专属 Profile：待验证 / 已观察复用 / 已否定`，不得提前显示“已共享成功”。
- 最近检查时间和证据类型。
- 指定课程可见性仅为 `已确认可见 / 未确认 / 被拒绝 / 错误`；不显示课程正文、帖子、文件或成绩。
- 当前结果码和面向用户的下一步。

状态顺序不可改变，避免将 health=healthy 误读为 authenticated。状态值必须同时含中文解释和机器值，例如 `需要重新认证（reauth_required）`。

### PrivacyNotice

- 在任何完整姓名、邮箱或课程名上方显示。
- 固定文案：`以下账户和课程信息仅显示在这台设备的已配对页面中。请勿将完整姓名、邮箱、课程名、登录页面或验证码截图粘贴到聊天或公开记录。`
- 不提供“复制全部”功能。

### BindingPanel

- 两来源身份并列，字段对齐，避免靠位置暗示已匹配。
- 自动候选时显示依据类别：稳定主体、组织/租户、批准范围；不显示原始 token 或内部响应。
- 严格证据不足时主 CTA 为 `确认两个账户对应`；在确认前课程探针保持禁用。
- 不一致时标题为 `账户身份不一致，课程访问已停止`；只提供 `重新检查账户身份`，不提供自动切号、自动登出或覆盖绑定。
- 用户确认绑定不是破坏性操作，但必须在按钮前说明两个来源和当前本地身份。

### LoginActionPanel

- 首次主 CTA：`打开 Moodle 官方登录窗口`。
- 点击前显示两个已批准 official origins、当前目标账户/组织和“仅进行认证与指定课程可见性检查”。
- 登录窗口打开后页面 CTA 变为 `我已完成 Moodle 登录`；产品随后运行 EdStem 有界检查。若出现 MFA/额外交互，文案为 `请在官方窗口中完成 EdStem 验证`。
- 页面不得提供密码、MFA、Cookie、token 输入框；不得要求用户把这些值返回给 Codex。
- 正常后台探针运行时不弹窗；失败三次后 CTA 为 `重新打开官方登录窗口`。

### CheckpointLedger

- 每行包含 checkpoint、场景、来源、平台、状态、时间、脱敏 code、下一步。
- A、B、C、D、reauth 不能合并为一个 pass；B 中三次重开、Worker restart、Codex exit 也要作为可展开的独立子项。
- 状态文本固定为 `pass / failed / human_needed / not_run`，不得使用含混的“完成”。
- 24 小时未到显示具体最早复查时间和 `等待跨日复查`，不得提供跳过按钮。
- 结果单导出/复制仅允许脱敏字段；按钮标签为 `复制脱敏结果单`。

### StatusBadge

- 形状和文字必须共同表达状态，颜色只作为冗余提示。
- `authenticated/pass/healthy`、`human_needed/reauth_required`、`failed/mismatch`、`not_run/not_observed` 使用不同边框与标签。
- 不使用仅有 ✓/✗ 的 icon-only badge；屏幕阅读器文本与可见文本一致。

## Interaction State Machine

| UI state | Available action | Forbidden action |
|----------|------------------|------------------|
| 未配置来源 | `确认来源与范围` | 登录、课程探针 |
| 来源已确认、未登录 | `打开 Moodle 官方登录窗口` | 任意 URL 导航、EdStem 课程读取 |
| 等待用户登录/MFA | `我已完成 Moodle 登录` 或 `停止本次检查` | 自动输入凭据、后台连续弹窗 |
| Moodle 已认证、Ed 未观察 | 自动运行 EdStem auth probe；只显示进度 | 下载、课程正文、写操作 |
| 两来源已认证、绑定候选 | `确认两个账户对应` 或只读自动确认说明 | 在证据不足时继续课程探针 |
| identity_mismatch | `重新检查账户身份` | 课程访问、覆盖绑定、自动退出 |
| 暂时网络/parser 错误 | `再次检查来源状态`；自动恢复最多三次 | 清空上次成功身份、将错误写成登出 |
| 显式登出 | `重新打开官方登录窗口` | 自动重开/自动恢复 |
| Profile in use/ownership unknown | `刷新所有权状态` | 删除锁、杀 PID、启动第二实例 |

所有异步动作均需：按钮 busy 文案、禁用重复提交、live-region 描述当前步骤、完成后聚焦结果标题。取消只能表达“已请求停止”，直到 Worker 确认才显示“已停止”。

## Responsive Layout

- 页面最大宽度继续为 960px。
- ≥ 760px：双来源卡使用两列等宽 grid，卡片内容各自完整；BindingPanel 两列对照。
- < 760px：全部单列，Moodle 在前、EdStem 在后；总体门禁保持最前。
- < 600px：沿用 16px 页面与卡片内边距，`dl` 单列；按钮默认占满可用宽度。
- 长 origin、邮箱、fingerprint 和 result code 使用 `overflow-wrap: anywhere`，不得水平滚动或截断关键身份。

## Spacing Scale

Declared values：

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | 状态标签内部间隔、移动端 definition gap |
| sm | 8px | 行内元素、段落间距 |
| md | 16px | 默认控件间距、桌面 grid gap |
| lg | 24px | 卡片 padding、section 间距 |
| xl | 32px | 页面顶部/主要区域分隔 |
| 2xl | 48px | 重大门禁段落分隔和最小操作高度 |
| 3xl | 64px | 仅保留为页面级扩展，不在本阶段新增密集使用 |

Exceptions: none。边框 1px、focus outline 2px、圆角 4px/8px 是绘制属性，不是布局 spacing token。

## Typography

只允许四个字号和两个字重：

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Label / metadata | 14px | 400 或 600 | 1.5 |
| Body / control | 16px | 400 或 600 | 1.5 |
| Section heading / code emphasis | 20px | 600 | 1.2 |
| Page display | 28px | 600 | 1.2 |

机器 code 可用系统等宽字体，但字号仍为 14px 或 16px，字重仍限 400/600。不得用更小字号隐藏隐私、权限或阻塞信息。

## Color

沿用现有高对比中性底色和蓝色动作色：

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#F8FAFC` | 页面背景、主要留白 |
| Secondary (30%) | `#FFFFFF`，边框 `#CBD5E1` | 卡片、门禁区、状态组 |
| Accent (10%) | `#1D4ED8` | 唯一当前主 CTA、键盘 focus ring、当前 checkpoint 标记 |
| Destructive/blocking | `#B91C1C` | identity mismatch、越界 origin、明确失败；本阶段无删除 CTA |
| Warning | `#92400E` | human_needed、reauth_required、等待 24 小时 |
| Success | `#166534` | 已验证 pass/authenticated；不能用于 not_observed |
| Primary text | `#0F172A` | 标题和正文 |
| Secondary text | `#475569` | 辅助说明、时间、非关键 metadata |

Accent reserved for：页面唯一当前主 CTA、focus ring、当前 checkpoint 的细边/标记。次要动作采用白底蓝边，不得让所有交互元素都填充蓝色。状态色只表达语义并始终配可见文字。

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA（未登录） | `打开 Moodle 官方登录窗口` |
| Primary CTA（登录后） | `我已完成 Moodle 登录` |
| Manual binding CTA | `确认两个账户对应` |
| Retry CTA | `再次检查来源状态` |
| Reauth CTA | `重新打开官方登录窗口` |
| Receipt CTA | `复制脱敏结果单` |
| Stop CTA | `停止本次检查` |
| Empty state heading | `尚未配置学校来源` |
| Empty state body | `先确认 Moodle、EdStem 的官方地址、目标账户和一个指定课程；确认前不会打开学校页面。` |
| No observation | `尚未检查此来源；这不代表登录有效或无课程。` |
| Network error | `暂时无法连接此来源。已保留上次成功状态；请检查网络后再次检查来源状态。` |
| Parser error | `页面结构已变化，AutoED 无法确认登录状态。课程访问已暂停，请更新或等待适配修复。` |
| Reauth error | `此来源需要重新认证。请在官方窗口中亲自完成登录或 MFA。` |
| Profile conflict | `专属 Profile 仍被一个浏览器持有。AutoED 不会删除锁或终止无法确认归属的进程。` |
| Identity mismatch | `账户身份不一致，课程访问已停止。请在下方核对两个来源的账户。` |
| Cross-platform gate | `macOS 结果不能替代 Windows 验证；Phase 3 仍被阻塞。` |
| Sensitive-data warning | `以下账户和课程信息仅显示在这台设备的已配对页面中。请勿将完整姓名、邮箱、课程名、登录页面或验证码截图粘贴到聊天或公开记录。` |
| Destructive confirmation | none；本阶段不提供删除 Profile、清除 Cookie、覆盖绑定或终止未知浏览器的 UI |

禁止使用泛化的 `提交`、`确定`、`继续`、`重试`、`发生错误`。每个错误必须同时说明影响、保留了什么和下一步。

## Accessibility Contract

- 文档层级只含一个 `h1`；主要区域用 `h2`；来源卡内部可用 `h3`。
- 双来源卡使用有标签的 section；状态组合用 `dl`，不能用纯视觉表格模拟。
- live-region 只播报动作进度与最终结果，不在每次轮询重复播报完整私人身份。
- 对话/确认使用原生 `<dialog>` 时必须管理初始焦点、Escape、返回焦点；否则使用页内确认区，不自制不可访问 modal。
- 状态色文本达到 WCAG AA；focus ring 保持 2px、offset 4px。
- 登录按钮必须在点击前后可见文案变化；不可只用 spinner。
- 自动 EdStem probe 开始时播报 `正在检查 EdStem 登录状态；不会读取课程内容。`
- 完整邮箱、姓名、课程名不得进入 `aria-label`、title、DOM id、URL 或 analytics；仅作为受保护可见文本节点。

## Privacy and Failure Display

- 未配对 shell 不返回或渲染来源、origin、身份、课程、checkpoint 或 result receipt。
- 401/403 立即 `replaceChildren()` 清空 protected view；网络失败才允许保留标为 stale、带读取时间的受保护快照。
- 完整身份仅存在于 protected source/binding cards；不得写入 console、localStorage、sessionStorage、data attributes 或复制结果单。
- 页面不得显示 Profile 路径、PID、Cookie、headers、HTML、selector、请求 URL 路径或内部响应。
- 截图不是 UI 中的必选证据流；不提供上传截图控件。

## Visual Hierarchy

主屏焦点固定为 OverallGate 的状态标题和当前唯一下一步 CTA；其次是两张等权 SourceCard；第三是 BindingPanel/checkpoint ledger；运行时与安装诊断最后。阻塞状态使用左侧 4px destructive 边和明确标题，不使用全屏红底。正常状态保持安静中性，避免把“healthy”塑造成整体通过。

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none | none | PASS — 项目为原生 HTML/CSS/TypeScript，无 shadcn、无第三方 registry |

不允许执行 `npx shadcn init`、添加远程 registry、CDN UI 资源或复制未经审查的组件块。

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS — 每个 CTA、空态和错误均含具体动作与下一步。
- [x] Dimension 2 Visuals: PASS — OverallGate 为固定焦点，层级、响应布局和无 icon-only 规则明确。
- [x] Dimension 3 Color: PASS — 60/30/10、accent 保留项和阻塞/警告/成功语义明确。
- [x] Dimension 4 Typography: PASS — 4 个字号、2 个字重和两类行高。
- [x] Dimension 5 Spacing: PASS — 仅使用标准 4/8/16/24/32/48/64 scale，无例外。
- [x] Dimension 6 Registry Safety: PASS — 无第三方 registry，沿用现有手工设计系统。

**Approval:** approved 2026-09-01

---

*Source decisions: `02-CONTEXT.md` D-02–D-18；technical constraints: `02-RESEARCH.md`；existing visual baseline: `apps/status/`.*
