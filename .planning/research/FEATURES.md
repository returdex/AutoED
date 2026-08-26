# 功能研究：AutoED M1

**领域：** 本机单用户课程信息同步、长期归档与模型读取。  
**研究日期：** 2026-08-26。**总体信心：MEDIUM**；公开格式/协议事实 HIGH，本校来源可用性与真实平台行为未验证。  
**状态：** 本文件服务于需求/路线图讨论，不是实施批准或验收报告；新仓库没有 validated 能力。

## 依据与范围

- `AGENTS.md`、`.planning/PROJECT.md` 是当前决定；DESIGN 的 SQLite 待确认、安装待确认和版本待确认措辞已被后续决定覆盖。
- **accepted 目标：** 双源、macOS/Windows、本地 Profile、SQLite + 最小 durable Job + 文件、完整课程生命周期、全文/原文件/历史、提示词安装升级。
- **proposed 实现：** 下列接口字段、分块算法、具体格式覆盖、默认预算与阶段交付切片，须进入需求讨论后确认。
- 用户已同意本地完整资料归档和获准模型读取；不重复询问同一产品授权，不把所有资料默认降为 metadata-only/local_only。
- 本轮只研究公开资料；没有真实课程、账号、登录、下载或发布证据。来源权限未知时有逐项例外与下一步，不能推定学校 API 可用。

## 生态观察

| 来源/能力 | 官方资料能证明什么 | 对 AutoED 的含义 |
|---|---|---|
| Moodle 资源 | Book、Folder、Page、File、URL 等是不同资源形态 | 只下载附件会漏掉目录和多章正文；需课程层级 manifest。[资源文档](https://docs.moodle.org/502/en/Resources) |
| Moodle assessment | due 与 cut-off 不同，存在草稿/提交与分阶段发布反馈 | 不压成一个 deadline/boolean；保留本人可见事实与采集时间。[作业设置](https://docs.moodle.org/502/en/Assignment_settings) |
| Ed Discussion | Stanford 的官方使用指南展示线程类型、回复/评论、匿名/私有设置及文件/数学内容 | 线程不能退化成标题列表；角色和匿名信号按原样保存。该校说明不代表本校权限。[指南](https://canvashelp.stanford.edu/hc/en-us/articles/4402081717011-Getting-Started-with-Ed-Discussion) |
| MCP | resource 可传文字或二进制；标准列表分页不等于正文分页 | 业务层仍需可枚举、固定版本的全文读取契约。[Resources](https://modelcontextprotocol.io/specification/2026-07-28/server/resources)、[Pagination](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/pagination) |

**研究判断（MEDIUM）：** 差异价值在“持续归档后可复现地读全，并解释缺口”，不在复制教学平台的讨论/提交功能。没有证据支持“其他产品都不能做到”的竞争宣传。

## Table Stakes：首版不可缺的目标

| 功能 | 为什么需要 | 复杂度 | 边界/建议验收 |
|---|---|---|---|
| 来源、账号、学期、课程选择 | 防止同名课程/换号混合 | 高 | 两源绑定分别确认；只处理选定 scope |
| 独立后台和 durable Job | Codex 不是后台生命周期拥有者 | 高 | 退出客户端后任务继续；休眠恢复有限补跑 |
| 课程结构与页面 | 资源不只由附件构成 | 中 | 周次/章节/目录关系、可见正文、源定位 |
| 公告与讨论 | 澄清可能位于回复和编辑版本 | 高 | 可见线程/回复/附件、角色/匿名/编辑信号；不发帖 |
| assessment 信息 | 时间与提交状态不能猜测 | 高 | 说明/rubric/due/close/cutoff/个人延期分别保留 |
| 本人可见成绩与反馈 | 生命周期不止提交之前 | 高 | 评分/反馈/附件与 provisional/final 原始信号；不推算评分 |
| 原文件与正文归档 | 离线与结课后读取需要本地材料 | 高 | 获准原字节、hash、版本；失败保留已有成功数据 |
| Course/ResourceManifest | 用户与模型需要知道“有哪些、缺哪些” | 中 | 目录版本、资源版本、scope、观察时间、覆盖和缺项 |
| 固定版本分页全文 | top-k 不能证明全文可得 | 高 | 最后一页能结束、全程版本不漂移；每段有 locator |
| 受控原文件访问 | 本机路径对模型未必可用 | 高 | 明确实际客户端可取得字节的方式、MIME/大小/hash |
| 搜索与变化 | 帮助发现和复查，但不能代替读取 | 中 | 搜索结果带 revision/locator；变化可断点查询 |
| 缺口与下一步 | 已发现不等于已归档/可读 | 中 | discovery/fetch/archive/extraction/model_access 分开 |
| 提示词安装与升级 | 用户不应手工拼装运行依赖 | 高 | 原生平台可安装 beta；实际入口验证，资料保留 |

以上为 accepted 目标的研究分解，不自动批准字段设计，也不把表中任何一项记成已实现。

## Differentiators：需要保留的产品价值

| 能力 | 价值 | 复杂度 | 取舍 |
|---|---|---|---|
| 可复现的版本引用 | 后续读取可回到同一材料片段 | 高 | source observation、源内容版本、提取版本分离 |
| 全生命周期 coverage | 让遗漏、过期和真正空集合可辨认 | 高 | 不以“抓到 N 条”替代声明 scope 的完整盘点 |
| 模型无关的全文服务 | 无 LLM Key 也能同步、查询和归档 | 中 | 客户端如何推理属于独立项目 |
| 细粒度交付限制 | 获准资料正常读全，受限项明确解释 | 高 | 每个出口检查当前来源权利、用户 scope、操作与目的地 |
| 长期历史与失败保护 | 源站不可达时仍知最后成功观察 | 高 | 保留不等于永远可外发；权利变化需要重新检查 |

这里的“差异价值”不表示可延后：manifest、版本化全文、缺口可见已经属于用户确认的核心目标。

## 文件读取矩阵：需求草案，尚待确认

**建议：** 将“可归档原文件”“可提取文字”“可准确定位”“获准交付”拆成四个验收维度，避免一个 supported 布尔值。

| 格式/表现 | proposed 首版读取与 locator | 必须暴露的限制 |
|---|---|---|
| PDF 文本型 | 物理页 + 页内块/offset；印刷页码仅作附加标签 | 阅读顺序、表格、公式不保证还原；提取文本不是原字节。[PDF.js 页 API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html) |
| PDF 扫描/混合型 | 原文件 + 各页文字提取状态 | 无字不等于空白页；标 image_only/needs_ocr/partial，OCR 能力不自动纳入首版 |
| DOCX | part/段落/表格单元格 + 文本 offset | 页码不作默认契约；脚注、文本框等单列覆盖，不只遍历 main body。[WordprocessingML](https://learn.microsoft.com/en-us/office/open-xml/word/structure-of-a-wordprocessingml-document) |
| PPTX | slide ID/顺序 + shape/文本块；备注单列 | 图形、图表、动画与视觉关系不伪装成完整文字；notes 是否读取待确认。[PresentationML](https://learn.microsoft.com/en-us/office/open-xml/presentation/structure-of-a-presentationml-document) |
| XLSX/CSV | sheet + cell/range；CSV 行列与编码/分隔符 | 公式与缓存值分开，不执行公式/外链；缓存可能缺失或过期。[公式表示](https://learn.microsoft.com/en-us/office/open-xml/spreadsheet/working-with-formulas) |
| TXT/MD/代码 | 固定编码表示、行号和明确定义的字符 offset | 不执行代码；Unicode/换行转换需固定版本并可定位 |
| HTML/来源页面 | 安全可见正文、章节/表格/线程位置 | 不保存整页认证 HTML；不执行脚本、不提取输入值或隐藏 token |
| ZIP | 原文件 + 安全成员清单；受支持成员有界解析 | 路径穿越、符号链接、解压大小/层数/数量限制；不执行成员 |
| 图片/音视频/旧 Office/未知类型 | 获准原件及元数据，明确 unsupported_extraction | OCR、转录、旧二进制格式等不能因“Office 支持”被隐含承诺 |

Office 资料证明的是格式结构，不是某个 Node 库已经安全/完整支持该格式；实现库、版本与跨平台 corpus 测试留 Phase 1/5。仅提取获准可见内容；隐藏 sheet/行列、批注、备注、修订或包内其他内容不因解析器可见就自动纳入。
加密/损坏/超时/超额/权限限制均应保留记录和下一步；不能靠删除条目让 coverage 看起来完整。

## 全文与原文件：候选验收契约

1. 从课程 manifest 枚举全部声明范围内的资源；分类、分页、缺项和 manifest version 可检查。
2. 选择明确 resource revision 和 extraction revision；读取期间新同步不改变旧读取结果。
3. 正文返回 locator、chunk、next_cursor/明确结束、已知总量或未知原因；顺序拼接能覆盖声明的完整提取文本，无静默截断。
4. 每次翻页重新检查当前权限；固定版本不冻结旧权限。中途权限撤销须阻止后续交付并解释状态。
5. 同步接口返回 job_id，查询进度；不靠一次漫长 MCP 调用保持后台工作。
6. 原文件通过获准客户端可用的受控资源/下载路径取得实际字节，并核对 hash；不把绝对路径或带秘密 URL 当交付完成。
7. resource/binary 不被某客户端支持时有普通语义全文工具；原文件能力单独标 unsupported，不冒称所有模型客户端均能消费。
8. 不支持/扫描/图表缺口显示在 manifest 和正文页，不能只隐藏在日志；搜索 top-k 不算任何一项全文验收通过。

以上是 proposed 验收设计。核对历史 2025-11-25 与新 2026-07-28 规范后，标准分页仍列四类 list 操作；正文分块由 AutoED 应用契约实现。协议/SDK/宿主兼容组合在 Phase 1 锁定，不默认选历史版或新版本。[分页规范](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/pagination)

## Anti-Features：明确不构建

| 不构建 | 为什么不适合 | 替代 |
|---|---|---|
| 作业推理/规划/生成/评估、EvidenceLens/AssignmentFlow | 超出 AutoED 职责；也不是未来 AutoED phase | 只交付版本化事实与资料 |
| 自动源站写操作、活动 quiz、任意 JS/URL/selector 工具 | 超出权限且扩大攻击面 | 有界语义读取，来源网页只作数据 |
| 学期后自动删除、磁盘满自动删历史 | 破坏长期档案目标 | 显示 pending，用户清理或按明确材料政策处理 |
| 只做搜索/摘要或默认所有正文 local_only | 违背获准全文读取目标 | 完整枚举/版本分页，受限项明确例外 |
| 云浏览器/向量库/后台 LLM/复杂通知 | 当前无需求，新增服务与隐私成本 | Local Playwright、结构化查询、本地状态 |
| 自动后台升级或自动卸载旧版 | 未获批准；新旧数据/入口可能混用 | 用户通过提示词更新，受管理版本清理与回滚 |

## 依赖与建议阶段

```text
P1 契约/持久化骨架/最小 beta 安装升级通道
  → P2 双来源 × 原生 macOS/Windows 人工 live 硬门禁
  → P3 Moodle + 早期真实 stdio→HTTP 查询烟测 → P4 Ed
  → P5 文件/提取/manifest/权限 → P6 生命周期与恢复
  → P7 完整 UI/MCP/Skill → P8 交付、恢复、切换验收
```

- P1 定义 revision/coverage/Job/权限契约；P3 起实际使用，不能等 P5 才给历史记录补造来源版本。
- P2 之前必须已有可获取、可安装/升级 beta；每次新 live UAT 前先通过相关自动测试、构建、产物检查，再让用户在 Codex 更新。
- P2 必须包含人工登录、三次 Profile 重开、Worker/系统重启、Codex 退出、24 小时复查、reauth、账号隔离；双源双平台结果分格记录。
- failed/human_needed/not_run 阻断依赖阶段；synthetic 通过或发布 beta 都不代表 live 通过。一个作业只是 POC，M1 最终覆盖选定课程生命周期。
- P7 完善交互，不应延后 P2 登录/诊断所需的最小 UI；P8 完成全交付，不把初次可安装渠道拖到最后。

## 待确认与研究缺口

1. 文件类型、Office 备注/批注/隐藏内容处理、OCR 是否纳入、大小/页数/磁盘预算、中文搜索质量基线仍是 proposed。
2. 本校 Moodle 版本、Ed 可用页面及合规访问路径未验证；Moodle 官方说明服务启用、函数与用户权限均需配置。[Web services](https://docs.moodle.org/502/en/Using_web_services)
3. Ed 厂商首页本轮 open 无可读正文、旧 quickstart PDF 重定向 help；未登录追查，也不据此断言 API 不存在。
4. 本轮未安装 Context7 CLI 或提取依赖；环境未提供 Context7 MCP，遵守不安装约束，使用上述已打开官方格式/协议资料。

## 来源日期与信心

| 资料组 | 日期/状态 | 信心与用途 |
|---|---|---|
| Moodle Resources / Assignment settings / Web services | 当前文档重定向 5.2；前两页更新 2025-07-06 / 2026-06-08 | HIGH：公开产品语义；不证明本校同版本或授权 |
| Stanford Ed 指南 | 2026-05-19 | MEDIUM：机构自身使用说明；本校能力 LOW/待 live |
| MCP Resources / Pagination | 对照 2025-11-25 与 2026-07-28 | HIGH：各版协议能力；项目版本和客户端组合待 Phase 1 核验 |
| PDF.js 页 API / Microsoft Open XML | PDF.js 为滚动 draft；Word 2024-01-12、PPT 2024-11-26 | HIGH：结构事实；提取效果 MEDIUM/待格式 corpus |

所有链接均于 2026-08-26 打开核对；无未验证的市场份额、竞品优劣或学校权限结论。
