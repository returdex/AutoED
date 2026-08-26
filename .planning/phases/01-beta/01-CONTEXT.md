# Phase 1: 契约、原生骨架与最小 beta 安装升级 - Context

**Gathered:** 2026-08-27
**Status:** Ready for planning
**Approval:** 用户明确要求“生成”；下列产品决定已逐项确认。未生成或批准 PLAN，未实现、安装、登录或发布；全部产品证据 not_run。

<domain>
## Phase Boundary

交付可在原生 macOS/Windows 安装、运行和升级的最小独立服务：API 与 Worker 分进程、共享业务契约、最小本地安全控制面、持久任务、统一构建身份、完整安装/升级提示词与可获取 beta。

主责需求为 ARCH-01、ARCH-02、PLAT-01、SEC-01、JOB-01、DIST-01、DIST-02、DIST-03；具体可观察验收及证据类型以 `.planning/REQUIREMENTS.md` 和 `.planning/ROADMAP.md` 为准。本阶段只用 synthetic 数据，不登录学校、不采集真实课程。

完整管理界面在 Phase 7；真实认证在 Phase 2，实际课程 MCP 切片在 Phase 3；Phase 8 完成完整交付及用户级自启动启停验收。不能删除 Phase 1 已批准的最小状态/控制面，也不能因完整 UI 尚未到来取消后台独立性。
</domain>

<decisions>
## Implementation Decisions

### 启动方式（已确认）
- **P1-D01:** 默认不配置随系统登录自动启动。用户通过 Codex/CLI 按需启动服务；服务启动后独立运行，退出 Codex 不会终止 API/Worker。
- **P1-D02:** 安装或升级流程应自动启动目标服务并自检，展示实际版本、运行状态、旧版本清理结果。这是本次操作后的启动，不是授权系统登录自启动。
- **P1-D03:** 启动、自检和必要清理均完成才报告整个操作成功。版本字符串或 health=200 不能替代实际接线检查；组件不匹配、旧入口/进程仍生效或 cleanup_pending 不能报升级成功。

### 安装/升级交互（已确认）
- **P1-D04:** 开始前展示目标版本、安装位置、需下载的依赖和预计修改；用户确认一次后在该范围内自动执行，不逐条要求用户手装依赖。
- **P1-D05:** 遇到新增权限、无法安全恢复或必须人工操作时暂停；操作系统授权提示由用户本人处理。预览确认不授权超出范围的改动、旧产品卸载或真实课程访问。

### 升级失败默认行为（已确认）
- **P1-D06:** 能够确认不会丢失数据时，自动恢复到上一个可运行版本，明确报告“升级失败，已恢复旧版”。恢复成功不等于目标升级成功；不自动循环重试升级。
- **P1-D07:** 不能保证安全时停止、保留安全的诊断状态并等用户确认。不得覆盖升级后的新写入、运行不兼容 schema 的旧程序、自动破坏性反向迁移或误杀无关进程。“保留现场”不授权记录秘密、HAR、原始请求或私有内容。
- **P1-D08:** 不备份/导出 Profile，不假设浏览器降级可以恢复会话。首次安装没有旧版时不得虚报“已恢复旧版”；具体无旧版失败收尾及回滚安全判据由研究/计划明确，必要人工决定仍暂停。

### 原生测试设备（用户报告，未核验）
- **P1-D09:** 用户有可用于实际安装测试版的 Windows 电脑，系统为 Windows 11；处理器描述为“ultra7 265k可能是”。型号及 CPU 架构待设备检测核实，不能写成已验证硬件或据此声称原生验收通过。
- **P1-D10:** 当前工作区位于 macOS 路径，但实际 macOS 版本/架构未在本次讨论核实。研究/规划需确定依赖支持交集与平台产物矩阵；安装前检测实际系统/架构。不得以 WSL/Linux 替代 Windows 原生证据，不默认承诺所有架构。

### 继承的要求与硬门禁（不重新询问）
- **P1-D11:** 独立本地单用户、macOS/Windows、SQLite+最小持久 Job+本地文件、Local Playwright 唯一真实 Provider；无远程部署或 LLM Key 依赖。旧仓库只读，不复用旧运行配置、数据、Profile 或安装标识。
- **P1-D12:** 安装和升级必须处理本安装受管理旧程序、入口、进程；仅允许明确隔离且不活动的回滚副本。不得将“清理旧版”解释成自动卸载 legacy AutoED，也不得删除课程档案。
- **P1-D13:** 人工验收前先完成适用自动检查、发布可安装且可获取的 beta，再给用户精确更新提示词与测试步骤；用户在 Codex 手动更新并反馈。P1 人工测试只涉及适用安装/升级，学校登录在 P2 认证 beta 之后；发布本身不是测试通过。
- **P1-D14:** M1 目标0.1.0，beta 为0.1.0-beta.N且不可覆盖。远程操作必须分别验证 returdex 认证、repo-local作者/提交者及同名仓库冲突，不能使用 ywan1303；标准 PolyForm Noncommercial 1.0.0及商业另行授权边界不变。
- **P1-D15:** 所有来源权限、数据保护、来源内容不可信、Profile敏感性、持久任务与失败保留最后成功数据规则从首次相关操作生效。严格区分 S/I/N/L，未跑不填 pass。
- **P1-D16:** 本轮只生成讨论上下文。后续相关 PLAN 经用户确认才可连续实现、自动测试修复、构建和批准范围内 beta 发布；必须人工操作/登录/更新/UAT或新决策时停止。通用 auto_advance/_auto_chain_active保持false，不自动进入 plan/execute。

### Research and planner discretion / remaining checks

以下属于研究与规划职责，不冒充用户已选择具体实现：锁定并验证依赖版本、实际 SQLite 引擎/WAL 修复、OS凭据保护、受管依赖与安装路径/标识、稳定入口、升级日志与恢复安全判据、持久任务契约和最小状态呈现。优先官方资料；现有研究版本是候选，需实施前复核。

平台支持矩阵仍是规划前置核实项，不是已完成验证，也不是新里程碑的延期项。需要用户提供无法本机检测的设备信息时只补问缺失事实。不要再次询问是否需要自动安装/升级、双平台或后台独立运行。具体计划仍交用户确认；此次讨论没有批准某个依赖组合、最低系统版本或额外能力。
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.** 当前确认优先于历史输入里的旧待决或旧项目完成状态。

### 当前批准基线
- `AGENTS.md` — 隐私、安全、执行许可、安装升级及发布身份边界。
- `.planning/PROJECT.md` — 产品边界和 D1–D14，0.1.0目标与来源依据。
- `.planning/REQUIREMENTS.md` — Phase 1 八项需求及证据类型；M1完整边界。
- `.planning/ROADMAP.md` — Phase 1验收、八阶段依赖和P2真实门禁。
- `.planning/STATE.md` — 当前进度，批准不等于实现或验证。
- `.planning/VALIDATION-STRATEGY.md` — S/I/N/L台账、beta先于人工测试、认证硬门禁。

### 官方资料研究（候选设计，不是已验证实现）
- `.planning/research/STACK.md` — 依赖、跨平台、受管安装及升级恢复风险。
- `.planning/research/ARCHITECTURE.md` — API/Worker、持久任务、安全及客户端边界。
- `.planning/research/PITFALLS.md` — 会话、数据完整性、人工证据与失败风险。

### 原始输入（只读历史依据）
- `rebuild-2026-08-26/DESIGN.md` — 新产品设计与早期可行性门禁；旧完成状态不继承。
- `rebuild-2026-08-26/DECISIONS.md` — 初始决定；以当前批准记录覆盖已解决待决项。
- `rebuild-2026-08-26/GSD-START.md` — 交互建项、安全、隔离与验收约束。
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- 仓库仅有规划/研究、原始输入、AGENTS、许可证与.gitignore；没有产品源码、依赖清单、运行时版本文件或已实现安装器。可复用的是约束与验收文档，不是旧产品实现或数据。

### Established Patterns
- 已确定模块化单体方向、独立API/Worker、同一后端的薄客户端；具体代码模式尚未实现。Phase 1无已有CONTEXT/SPEC/PLAN或代码地图，无匹配待办。

### Integration Points
- 待建立最小控制面、持久任务/存储契约、稳定CLI/MCP入口及受管安装器；为P2认证与P3实际课程MCP接线准备边界。此处描述计划接入点，不声明接线已完成。
</code_context>

<specifics>
## Specific Ideas

- 用户提醒安装升级目标在建项时已经详细说明；讨论应直接继承，不让用户重复回答。
- 无独立前端管理不意味着服务必须依附Codex进程；用户确认的是暂不默认系统自启动。
- 最终结果需明确区分目标升级成功、升级失败但旧版恢复、停止等待人工；不能将部分完成包装为成功。
</specifics>

<deferred>
## Deferred Ideas

无新增范围外能力。完整管理UI（P7）、最终交付与用户级自启动启停（P8）保持既定归属，没有因本次决定删除或另建未来里程碑。平台/依赖核实留给本阶段研究规划，不视为验收豁免。
</deferred>

---
*Phase: 01-beta*
*Context gathered: 2026-08-27*
