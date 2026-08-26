# AutoED Rebuild

## What This Is

AutoED 是独立运行在用户本机的课程信息同步与归档服务，面向 macOS/Windows、每安装单用户。它拥有来源连接、专属浏览器会话、同步任务、课程资料、消息和版本；API、管理页、CLI、stdio MCP 与 Skill 是同一后端的客户端。

当前只建立 M1：本地跨平台课程资料同步、归档和模型读取。Codex 退出后，只要设备与用户后台服务在线，同步仍可运行；关机、注销和休眠期间不承诺运行，恢复后有限补跑。

## Core Value

在用户选定且有权访问、保存的课程范围内，持续归档完整课程生命周期资料，并通过受控接口让用户及获准模型完整读取固定版本内容，明确展示来源、历史与覆盖缺口。

## Initialization Status

- 建项方式：交互式；用户于2026-08-26批准全部51项需求、五项细化提案及八阶段路线图。文档校验完成，建项完成；M1目标0.1.0生效，下一步讨论/规划Phase 1，不自动启动实现。
- 新代码库：无已实现或已验证能力；旧项目的完成状态不继承。
- 本轮只准备文档；不安装依赖、不登录、不采集、不传输课程资料、不创建云服务、不执行 phase。
- 许可证方案已确认：PolyForm Noncommercial 1.0.0 + 商业用途另行授权。本轮不创建远程仓库、不推送；正式商业授权文本另行审查。
- 本地 Git author/committer 已绑定 returdex 的 GitHub ID 型 noreply：`73513006+returdex@users.noreply.github.com`。公开 GitHub API 核对 login/id/2020 年创建日期，邮箱格式按 GitHub 官方文档生成；不读取私人邮箱或秘密。
- `gh auth status` 显示 returdex 已登录但当前活动账号为 ywan1303；本轮不切换全局账号、不执行认证远程操作。未来创建/推送前必须确认实际认证为 returdex，不能只检查 commit 作者。

## Requirements

### Validated

无。用户确认需求不等于实现通过验证；synthetic、integration 与 live UAT 必须分别记证据。

### Active

以下是用户已确认的目标，全部待实现、待验证；详细原子需求、可观察验收和唯一主责 phase 已在 REQUIREMENTS 中获用户确认。

- [ ] macOS/Windows 原生安装和运行；Linux 非强制，不做远程或多用户。
- [ ] 独立本地后端与 Worker；Codex、MCP 或管理页退出不终止后台同步。
- [ ] Local Playwright 为首版唯一真实 BrowserProvider，另有 synthetic 替身。
- [ ] 用户在官方页面手动完成登录/MFA，专属 Profile 本地持久化并隔离。
- [ ] Moodle/EdStem 来源分别验证认证、能力、健康、freshness 和 completeness。
- [ ] 一账户、一课程、一作业先做 POC，最终覆盖选定课程的完整生命周期。
- [ ] 获取课程目录、周次与页面、公告、讨论及回复、资料附件、作业说明/rubric/时间、本人可见提交状态、评分与反馈及历史。
- [ ] 课程资料与版本长期保留；同步失败不覆盖最后成功数据，partial/empty/error 分开。
- [ ] CourseManifest/ResourceManifest、固定版本分页全文、受控原文件访问、搜索、变化接口；不能只提供 top-k 或本机路径。
- [ ] 下载、归档、提取、模型访问分别报告状态；受限、不支持、加密、扫描与预算缺口不静默忽略。
- [ ] 同一后端的 UI/CLI/MCP/Skill；所有出口执行来源权限、scope、操作与目的地检查。
- [ ] SQLite + 最小持久 Job + 本地文件；持久化、幂等、租约、重试、取消、崩溃恢复与一致性备份可验证。
- [ ] 完整安装提示词可让 Agent 自动执行安装和升级，用户无需逐条手动安装依赖；允许经批准安装 Node 与 Playwright 浏览器。
- [ ] 安装/升级识别并处理受管理旧版本、入口和进程，验证新能力实际接线；失败可恢复，不混用版本。
- [ ] 可自动测试的逻辑自动测试；需要人工登录等场景明确交给用户，先完成可安装测试版推送，再请用户在 Codex 中手动更新和测试。
- [ ] 遵循用户自定义 x.y.z 发布规则、beta 测试版规则与 returdex GitHub 身份约束。

本次另已批准五项细化需求：TEXT-01 的 PDF/Office/文本可见内容与定位矩阵、TEXT-02 的有界安全 ZIP 解析、SEARCH-01 的范围搜索与声明的中英文匹配策略、BUNDLE-01 的固定版本纯作业资料聚合、OPS-01 的加密一致备份恢复（不含 Profile）。具体实现和依赖选择仍须在相关 PLAN 中确认，不增加隐藏内容采集、要求推理或云模型调用。

### Proposed / Not Yet Accepted

以下是设计或工程建议，不能写成用户已批准的新能力或已验证结果：

- TypeScript、Node 24 LTS、Fastify/Zod、npm workspaces、React/Vite、SQLite FTS5、Vitest 的具体版本与实现组合；实施前用官方资料核对、固定并验证依赖。
- 升级时 staging、版本清单、备份/迁移/激活/健康验证/清理与隔离回滚副本的具体实现。

### Out of Scope

- EvidenceLens、AssignmentFlow、ConstraintPack、作业评估、要求推理、规划、草稿检查、执行与生成辅助：属于独立项目，不是 AutoED 的未来阶段。
- Gmail、Browserbase、远程部署、多用户、复杂通知、第三方推送、后台模型总结与 LLM Key 依赖。
- 源站业务写操作、提交、发帖、开始测验、上传作业、隐藏内容访问、DRM 绕过。
- Codex/日常 Chrome Profile 复用、Cookie 桥接、未授权内部端点逆向、自动回退到其他身份或通道。
- 自动后台升级尚未批准；用户要求的是可由安装提示词执行的安装/升级，人工测试由用户在 Codex 中触发更新。
- 本轮远程仓库创建、发布、推送、真实安装/采集，以及旧版本卸载/旧数据导入。

## Context and Provenance

- 当前 cwd 和 Git 根：`/Users/yifeng/Documents/ChatGPT/AutoED`。
- 实际输入目录是 `rebuild-2026-08-26/`，不是最初提示中的 `rebuild/`；三份文件均已完整阅读，保持原样。
- 设计来源：`rebuild-2026-08-26/DESIGN.md`（815 行）、`DECISIONS.md`（98 行）、`GSD-START.md`（225 行）。
- 旧仓库 `/Users/yifeng/Documents/AutoED` 仅为只读参考，参考基线 `726884c`；本轮没有验证旧 HEAD 或读取旧运行数据。
- 不复制旧 `.git`、`.planning`、`.autoed`、Profile、Cookie、密钥、运行配置、数据库、日志、导出、构建产物或依赖缓存。
- 新产品安装标识、MCP 名称、数据根、数据库、端口与旧版隔离；用户新批准的 0.x 版本线只适用于新产品，不改旧标签。
- 原 DESIGN 不含首版自动更新器；后续用户明确增加提示词安装/升级和测试版发布要求，此处记录范围变更。
- 官方资料研究已完成于 `.planning/research/`；技术组合与具体版本是 proposed，真实学校/平台/客户端均未验证。研究发现 SQLite 实际引擎 WAL 修复和 MCP 业务全文分页必须单独验收。

## Constraints

### Privacy and Source Permissions

- 密码/MFA 只由用户在官方页面输入；Agent 不接收、不读取、不记录输入值、按键或秘密。
- 专属 Profile 是敏感凭据存储，已获用户同意；不能称为无凭据方案。仓库外本地保存，不导出给模型、不备份/云同步、不复用宿主 Profile。
- 不默认保留整页 HTML、HAR、headers/body、trace、录像或登录截图；获准下载的课程原文件与登录/网络原始流量分别处理。
- 用户已确认本地正文保留与模型读取意愿；获准集成正常提供完整分页内容，不默认全部 local_only。对明确受限或依据未知材料逐项说明例外。
- 用户意愿不替代学校、版权方或第三方隐私权限；来源访问、保留和外发分别校验。
- 官方 API 必须有资料和明确授权；不猜测 Moodle/Ed API 对该账号可用。
- 页面内容仅为数据；MCP 不接受任意 JS、URL、selector、Profile 路径或操作闭包。
- 下载、解析与本地 API 需防路径逃逸、SSRF、恶意文件、提示注入和越权；不执行宏或外链代码。

### Data and Runtime

- source auth、capability、operational health、freshness、completeness 独立表达。
- partial/empty/error/not_observed/deleted 不混淆；失败保留最后成功数据。
- Profile 独占；租约超时不等于浏览器已退出，不能误杀日常浏览器。
- 运行数据/数据库/Profile/备份不得入 Git 或未经批准的同步盘；SQLite 只用本机磁盘。
- 无法在实际平台验证的能力标 not_run/未验证，不能以 WSL/Linux 替代原生 Windows。

### Testing and Release Order

自动测试 → 构建与安装/升级自动检查 → 推送可安装 beta 产物及明确版本 → 确认产物可获取 → 给用户更新提示词与人工 UAT 清单 → 用户在 Codex 手动更新、在官方页登录 → 记录脱敏 live 结果。

- 需要人工测试时先告知场景；不能在测试版尚未推送或实际不可安装时要求用户验证新能力。
- beta 是待验证测试版，不代表 live 通过；无真实证据不能发出稳定可用声明。
- Phase 2 登录门禁要求来源/平台、人工登录、Profile 重开三次、Worker/系统重启、Codex 退出、24 小时复查、退出/过期 reauth、真实账号绑定与敏感输出检查；换号隔离/网络/权限拒绝/parser 反例单独以 S/I 验证，不冒充 live，不故意触发学校错误或要求未授权第二账号。建议 72 小时观察仍为建议。
- 未通过或无法开展 live 测试时，标 failed/human_needed/not_run，停止依赖阶段；不能用 fixture 通过替代。
- 因此最小 beta 安装/升级通道需要在 Phase 2 live UAT 前建立，不能全部留到 Phase 8。
- 用户允许后续创建公开 `returdex/AutoED` 仓库和测试版推送；本轮仍只建项。先确认许可证、账号和仓库是否存在，不覆盖已有同名仓库。

### Version and Identity Rules

- 正式版本格式 `x.y.z`；x 从 0 开始，只有用户明确要求才更新。
- M1 路线图已确认，目标版本为 `0.1.0`（尚未发布）；每次新里程碑确认时 y 加一且 z 归零；不因新 phase 或里程碑完成再次自动更新 y。
- 里程碑外零散修复，每次发布更新 z；普通本地 commit 不等于发布。
- 测试版本为 `x.y.z-beta.N`，N 从 1 递增；例如 `0.1.0-beta.1`、`0.1.0-beta.2`，不覆盖已发布产物。
- GitHub 仓库、认证推送账号限定 `returdex`，禁止 `ywan1303`。
- Git commit author/committer 与 GitHub 登录是不同身份，必须分别验证；本地 repo 配置正确关联的身份，禁止猜测邮箱或修改全局配置影响其他仓库。
- 新功能验收必须经过实际安装入口 → MCP/CLI → API → Worker，不能仅检查版本字符串或 injected callback。

### Approved Execution Continuation

- 用户确认相关 PLAN 文件后，允许在已批准计划范围内连续进行实现、自动测试、修复、构建、可安装 beta 推送与发布产物检查，不必每个自动步骤重复询问。
- 该许可不是本轮开始实现的指令。本轮完成交互建项，需求/路线图已审核通过但未生成或批准 PLAN；未来阶段的新计划、范围变化与新授权不能自动视为已批准。
- 需要用户在 Codex 手动更新、官方登录/MFA、live UAT 或其他人工验证时必须停止并给出明确步骤；测试版必须先可获取，不能自行填写用户批准或 pass。
- 未通过的测试、发布失败、无法升级或 live 门禁缺口不能伪装成完成，也不能推进依赖阶段；可在已批准范围内诊断修复，不能扩大权限或自动改变方案。
- 本机 GSD 的通用 auto-mode 会自动批准部分 human-verify 和 decision，故不能直接将它视为上述许可。初始化不启用 workflow.auto_advance 或临时自动链；后续由编排遵守此项目规则，所有人工门禁仍硬停止，必要时使用 human-action 类型明确承载用户操作。
- 此处是项目执行约束，不宣称 GSD 已有一个独立的“仅执行到人工测试”设置，也不修改全局 GSD 工作流。

## Key Decisions

| ID | Decision | Decision status | Implementation outcome |
|----|----------|-----------------|------------------------|
| D1 | 本机单用户 macOS/Windows；Linux 非强制，无远程 | accepted | unvalidated |
| D2 | 本地专属 Profile 持久会话；人工官方登录 | accepted | unvalidated |
| D3 | 完整课程生命周期归档、长期保留与获准模型读取 | accepted | unvalidated |
| D4 | 仅获取/同步/归档/提供信息；无作业评估或辅助 | accepted | unvalidated |
| D5 | 提示词自动安装/升级；允许安装 Node/Playwright；SQLite + 最小持久 Job + 本地文件 | accepted | unvalidated |
| D6 | 实际来源、课程、账号范围、原生平台设备与 live UAT | pending before live POC | not_run |
| D7 | 当前无第三方通知/云服务 | accepted exclusion | not_applicable |
| D8 | 新旧隔离；后续公开 returdex/AutoED；不使用 ywan1303 | accepted direction; identity details pending | not_run |
| D9 | x 固定 0 至用户改大版本；M1 0.1.0；里程碑确认 y+1/z=0；零散修复发布 z+1；测试版 beta.N | accepted | not_run |
| D10 | 自动测试优先；人工 UAT 前先发布可更新测试版，用户在 Codex 手动更新测试 | accepted | not_run |
| D11 | PolyForm Noncommercial 1.0.0 + 商业用途另行授权；不使用 Apache-2.0 冒充非商业限制 | accepted | standard LICENSE and LICENSING.md recorded; no release |
| D12 | 计划经用户确认后，自动执行批准范围内工作直至必须人工操作/测试；不得自动批准人工门禁 | accepted | not_run |
| D13 | 交互建项、standard 约 8 阶段、官方研究/plan check/verifier、独立研究可并行子代理、继承模型、去敏文档本地 Git 跟踪 | accepted | config.json created; auto flags false |
| D14 | 全部51项需求、五项细化提案及八阶段路线图获批；M1目标0.1.0生效 | accepted (2026-08-26) | planning complete; implementation/tests not_run |

## Remaining Questions and Gates

1. 许可证方案已确认；发布前保留标准 PolyForm Noncommercial 1.0.0 原文并说明商业另行授权，不篡改标准许可证、不误称 Apache-2.0。许可涵盖符合条款的非商业组织用途，并非仅限个人学习。商业授权联系与具体合同待发布准备时确定。
2. 版本细则已确认；M1目标0.1.0已确认，未发布版本不创建标签。
3. GSD 偏好已确认（D13）；后续允许确认计划后连续执行至人工门禁（D12），不直接使用会自动批准检查点的通用 auto-mode。全局 defaults 只有 resolve_model_ids=omit；本项目使用用户此次确认的独立配置。
4. Phase 1：锁定官方依赖版本、最低 OS/CPU、Windows 测试设备、已批准提取矩阵的具体实现、磁盘预算与安装标识。
5. Phase 2 前：实际课程和来源范围、集成目的地、用户官方登录与原生平台测试。
6. 全部51项需求、五项细化提案及八阶段路线图已展示并获确认；完成建项后停止。下一步讨论/规划Phase 1，相关PLAN须再次确认后才能实现。

## License Research (2026-08-26)

- Apache Software Foundation FAQ 明确不区分个人、内部或商业用途且不收取使用费用：<https://www.apache.org/foundation/license-faq.html>。
- PolyForm Noncommercial 1.0.0 允许非商业用途和符合条件的个人学习等用途，同时包含非商业组织条款；用户已确认采用该标准许可证并对商业用途另行授权：<https://polyformproject.org/licenses/noncommercial/1.0.0>。
- 以上为条款核对，不是针对具体商业使用的法律意见；正式商业授权文本另行审查。

## Evolution

每个阶段转换时检查需求是否实现并取得适当证据，才可移入 Validated；失效需求须说明原因，新增能力未获批准前只列 proposed。更新关键决策、产品描述和证据状态。

每个里程碑结束时完整复核范围、Core Value、排除项、验证与实际运行结果。不得将其他独立项目变成 AutoED 后续里程碑，不得因流程模板覆盖隐私与安全边界。

---
*Last updated: 2026-08-26 after D14 requirements/roadmap approval; initialization complete, Phase 1 not started.*
