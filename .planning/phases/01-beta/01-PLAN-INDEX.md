# Phase 1 — Plan Index and Source Audit

**Phase:** 01-beta · 契约、原生骨架与最小 beta 安装升级  
**Status:** pending_user_plan_approval · **Plans:** 14 · **Tasks:** 31 · **Waves:** 12  
**Evidence:** 全部产品测试not_run。此文件是规划覆盖与接线索引，不是实现/安全/平台通过证明。

## Approval prerequisite

相关PLAN须用户明确确认后才能实施。当前仅研究→计划→checker；不得执行、安装、创建密钥、建远程、推送或自动进Phase2。通用auto_advance和_auto_chain_active保持false；12与14均autonomous:false，所有人工动作硬停止，不能自动批准。

工程提案随PLAN供批准：研究精确版本组合；macOS14+arm64/Windows11x64目标（实际macOS26.5.2arm64，Windows设备待检测）；纯HTML状态页；原生keyring及配对；受管根/端口43187（冲突另预览）；官方prebuilt Windows交叉装配；Ed25519本机发布信任。公开签名私钥创建、首次公钥信任与必要OS/OAuth须12再次明确许可，不能推定所有平台已通过。缺产物/不兼容停下，不自动加云CI、编译工具链或替换数据库。

## Wave structure

| Wave | Plan | Purpose | Needs / creates | Autonomous |
|---|---|---|---|---|
| 1 | 01-01 | 受管开发运行时、测试骨架与共享契约 | 批准PLAN → package.json | yes — only after PLAN approval |
| 2 | 01-02 | 真实SQLite与持久任务状态机 | 01-01 → packages/persistence/src/database.ts | yes — only after PLAN approval |
| 2 | 01-03 | 平台隔离根、原生密钥库与安装身份 | 01-01 → packages/platform/src/paths.ts | yes — only after PLAN approval |
| 3 | 01-04 | 共享应用、loopback API与显式页面配对 | 01-02, 01-03 → packages/application/src/policy.ts | yes — only after PLAN approval |
| 4 | 01-05 | 独立进程与Worker执行闭环 | 01-04 → apps/worker/src/main.ts | yes — only after PLAN approval |
| 5 | 01-06 | 真实CLI/stdio MCP入口与独立身份探针 | 01-05 → packages/client/src/http.ts | yes — only after PLAN approval |
| 4 | 01-07 | 批准的最小状态页与终端反馈文案 | 01-04 → apps/api/src/static.ts | yes — only after PLAN approval |
| 6 | 01-08 | 无需手装Node的受管安装与范围确认 | 01-03, 01-06, 01-07 → packages/installer/src/verify-manifest.ts | yes — only after PLAN approval |
| 7 | 01-09 | 持久升级日志、数据安全恢复与完整清理 | 01-08 → packages/installer/src/journal.ts | yes — only after PLAN approval |
| 8 | 01-10 | 双beta行为、原生自动检查与平台产物装配 | 01-09, 01-07 → scripts/build/assemble.mjs | yes — only after PLAN approval |
| 9 | 01-11 | 发布信任、身份与公开获取门禁工具 | 01-10 → scripts/release/trust.mjs | yes — only after PLAN approval |
| 10 | 01-12 | 发布密钥与远程身份的人工作用域门禁 | 01-11 → release/approval.json | no — blocking human action |
| 11 | 01-13 | 发布两个可获取的synthetic beta | 01-12 → release/beta-artifacts.json | yes — only after PLAN approval |
| 12 | 01-14 | 用户原生更新、独立运行与安装恢复验收 | 01-13 → .planning/phases/01-beta/01-macos-UAT.md | no — blocking human action |

同wave仅02/03及05/07并行，files_modified无交集。07修改API main和build脚本时均晚于04/01；没有同wave共享文件。其他顺序依职责真实依赖，未为凑并行放松门禁。12发布权限先决条件不是产品人工UAT；14必须13已可获取beta后才开始。

## Executable interfaces and ownership

绿地无既有代码签名；以下是01首先定义、下游必须实现的契约，不是已存在API。若实现需不兼容变更，先修订依赖计划，不让executor自行猜测。

| Owner / file | Contract | Consumers / actual wiring |
|---|---|---|
| 01 packages/domain/src/model.ts | JobState queued/running/retry_wait/succeeded/failed/cancelled; cancelRequested独立；scope installationId/source=synthetic/courseId=selftest | 02 application/persistence与05Worker |
| 01 packages/contracts/src/index.ts | JobRequest strict {kind:echo\|digest,value≤4096,idempotencyKey:UUID,scope}; BuildIdentity {version,buildId,commit,dependencyHash,protocol:1,schemaMin:1,schemaMax:1,capabilities}; Observation独立auth/capability/health/freshness/completeness | 04 routes、06 clients、07 status |
| 01 packages/application/src/ports.ts | JobStore enqueue/claim/heartbeat/commit/requestCancel/query；每写expectedGeneration与operation-scoped selfcheck；OutputPolicy authorize(scope,operation,destination) | 02实现SQLite端口、04/05调用 |
| 02 packages/persistence/src/database.ts | maintenance_gate persisted {operationId,generation,state:open/quiescing/exclusive,owner,leaseUntil}; stale不自动开写；schema1及compatibility记录 | 04installer-only control、05Worker、09upgrade |
| 02 packages/persistence/src/claims.ts | expired-running先原子fence+转retry_wait/failed/cancelled；claim attempt+1；commit同事务owner/fence/lease/cancel/generation/gate检查 | 05JobRunner；10/14故障测试 |
| 03 packages/platform/src/credentials.ts | get/set/delete by install namespace，token只内存；installer与短期selfcheck credential分权 | 04API auth、06窄client adapter；不得MCP任意platform/fs/DB访问 |
| 03 packages/platform/src/installation.ts | metadata只installId/selectedport/ownership；root路径只local人类preview，model别名 | 05supervisor、06client discovery、08installer |
| 02 runtime-status.ts / 04 application/status | StatusProjectionStore持久去敏component/install/selfcheck记录；06实际probe与09journal写入，04 GET/api/status读取，checkedAt/unknown/stale分别表达 | 真实HTTP测试从09journal恢复/06MCP自检到07UI，不仅注入UI假状态 |
| 04 apps/api/src/main.ts | GET /api/status; POST /api/jobs; GET /api/jobs/:id; POST cancel; POST /api/control/shutdown; POST /api/control/maintenance；installer-only status-projection及受控pairing routes | 06 CLI/MCP与07UI，所有业务走同application |
| 04 apps/api/src/pairing.ts | pending code不授权；CLI approve→single exchange只读cookie；TTL5min/最多5pending；session8h重启撤销 | 06pair/open-status、07公开壳和readonly状态 |
| 05 packages/platform/src/processes.ts | start/stop/inspect(installId,role,buildId,pid,nonce,OSstartIdentity)，认证shutdown先于ownedkill | CLI lifecycle、09upgrader；不设置系统自启动 |
| 06 packages/client/src/http.ts | authenticated loopback request + endpoint/install/protocol检查，不跨host redirect；backenddown明确错误 | CLI和MCP共有；UI同application HTTP |
| 06 apps/mcp/src/main.ts | 官方SDK stdio，仅autoed_status/autoed_selftest/autoed_job_get；stdout纯协议 | selfcheck真正spawn交付入口→HTTP→Job→Worker |
| 07 apps/api/src/static.ts + API main | main注册白名单静态资源；build复制HTML/CSS/browserTS到dist；未配对通用壳 | 真实API托管UI，非独立mock devserver |
| 08 verify-manifest + synthetic-sign | 严格manifest/Ed25519/target/hash；仅测试可注入fixturekey，生产无skip/任意key参数 | 08安装、10局部A/B先行测试；11复用，不依赖未来真实key |
| 09 journal/upgrade/recovery | preview至complete持久intent/done；exclusive gate+一致快照+write generation；safe恢复/unsafe停机/no-old/cleanup_pending | 08install入口、10故障测试、实际用户更新 |
| 10 assemble/native-artifacts | 两target独立闭包、官方prebuilt/native机器头/hash；生产dist+Node/browser+installer+diagnostics | 13真实签名发布；mac静态Win产物不算N |
| 10 diagnostics/native-report.mjs | 自包含生产依赖合成诊断，--scenario jobs\|permissions\|install-recovery --root 明确测试根；无npm/Vitest源码需求 | 14用户安装后受管Node运行，真实WindowsN报告 |
| 11 release tools | preflight/manifest/trust/publish/verify-availability；tree+reachablehistory+artifact扫描 | 12批准后keyinit，13发布和匿名GET，14前置检查 |

所有命令中的 `node scripts/dev/runtime.mjs npm ...` 使用受管Node24及其bundled npm；`... node file.mjs` 同样用受管Node执行指定脚本，首个 `--check` 是无需测试框架的bootstrap检查。受管开发runtime在已Gitignored的`.runtime/dev-toolchain/`，不放node_modules，避免npm ci删除正在运行的Node；构建仅清理dist/build。01创建全部npm scripts/config，后续任务只新增自己的测试文件，避免并行修改root配置。不得把主机Node26运行结果当Node24兼容证据。

## Build, platform and release ordering

1. 01–09实现合成闭环和安全安装；08已提供测试签名，10不依赖尚未存在的11/12。
2. 10生成本地A/B测试build：A echo，B真实SHA256 digest；通过相同签名验证实现，以临时fixturekey测试（绝不发布该信任根）。
3. Windows产物由mac编译平台无关JS并装配官方target Node、better-sqlite3 npm内win32-x64.node NAPI10、keyring-win32-x64-msvc及固定Chromium。静态完整性/PE/依赖闭包仅I证据，真实运行与OS凭据留N。上游缺失/不兼容停止，不用mac node_modules/WSL/新增CI代替。
4. 11工具完成 → 12明确本机发布密钥/信任/必要OS和returdex身份门禁 → 13重新构建真实签名两个beta、创建无冲突公开目标并匿名核所有资产。
5. 14提供完整提示词，由用户在Codex安装/更新；包内diagnostics通过受管Node执行，无先手装Node/npm源码前置。Windows实际加载、SQLite/browser/keyring、后台存活、升级恢复都需真实反馈。失败发新beta重走更新，不填pass、不进Phase2。

## Multi-source coverage audit

COVERED表示计划任务已覆盖，不表示需求实现/验证通过。无默许延期；学校认证P2、课程MCP P3、完整UI P7、自启动与完整备份P8按既定phase排除。

| Source | ID | Item | Plans | Status |
|---|---|---|---|---|
| GOAL | SC-1 | 独立API/Worker、退出客户端存活、共享应用/边界 | 01,04,05,06,14 | COVERED |
| GOAL | SC-2 | 持久job、竞争/去重/fence/取消/重试 | 02,04,05,10,14 | COVERED |
| GOAL | SC-3 | 实际依赖/引擎/原生矩阵、认证与权限 | 01,03,04,10,14 | COVERED |
| GOAL | SC-4 | 干净安装、双beta行为、恢复/清理 | 08,09,10,13,14 | COVERED |
| GOAL | SC-5 | 身份/许可/不可覆盖beta先于人工 | 11,12,13,14 | COVERED |
| REQ | ARCH-01 | 批准需求完整验收，见REQUIREMENTS | 05,07,10,14 | COVERED |
| REQ | ARCH-02 | 批准需求完整验收，见REQUIREMENTS | 01,02,04,06 | COVERED |
| REQ | PLAT-01 | 批准需求完整验收，见REQUIREMENTS | 01,03,08,10,13,14 | COVERED |
| REQ | SEC-01 | 批准需求完整验收，见REQUIREMENTS | 03,04,06,07,08,10,11,12,14 | COVERED |
| REQ | JOB-01 | 批准需求完整验收，见REQUIREMENTS | 02,04,05,09,10,14 | COVERED |
| REQ | DIST-01 | 批准需求完整验收，见REQUIREMENTS | 01,05,06,07,09,10,11,13,14 | COVERED |
| REQ | DIST-02 | 批准需求完整验收，见REQUIREMENTS | 08,09,10,13,14 | COVERED |
| REQ | DIST-03 | 批准需求完整验收，见REQUIREMENTS | 11,12,13,14 | COVERED |
| CONTEXT | D-01 | 01-CONTEXT锁定决定，PLAN truth/action直接引用 | 05,14 | COVERED |
| CONTEXT | D-02 | 01-CONTEXT锁定决定，PLAN truth/action直接引用 | 05,07,09,14 | COVERED |
| CONTEXT | D-03 | 01-CONTEXT锁定决定，PLAN truth/action直接引用 | 06,07,09,10,14 | COVERED |
| CONTEXT | D-04 | 01-CONTEXT锁定决定，PLAN truth/action直接引用 | 08,14 | COVERED |
| CONTEXT | D-05 | 01-CONTEXT锁定决定，PLAN truth/action直接引用 | 08,12,14 | COVERED |
| CONTEXT | D-06 | 01-CONTEXT锁定决定，PLAN truth/action直接引用 | 09,14 | COVERED |
| CONTEXT | D-07 | 01-CONTEXT锁定决定，PLAN truth/action直接引用 | 05,09,14 | COVERED |
| CONTEXT | D-08 | 01-CONTEXT锁定决定，PLAN truth/action直接引用 | 09,14 | COVERED |
| CONTEXT | D-09 | 01-CONTEXT锁定决定，PLAN truth/action直接引用 | 03,08,10,14 | COVERED |
| CONTEXT | D-10 | 01-CONTEXT锁定决定，PLAN truth/action直接引用 | 01,03,08,10,14 | COVERED |
| CONTEXT | D-11 | 01-CONTEXT锁定决定，PLAN truth/action直接引用 | 01,02,03,04,05,06,08 | COVERED |
| CONTEXT | D-12 | 01-CONTEXT锁定决定，PLAN truth/action直接引用 | 08,09,14 | COVERED |
| CONTEXT | D-13 | 01-CONTEXT锁定决定，PLAN truth/action直接引用 | 10,11,13,14 | COVERED |
| CONTEXT | D-14 | 01-CONTEXT锁定决定，PLAN truth/action直接引用 | 11,12,13 | COVERED |
| CONTEXT | D-15 | 01-CONTEXT锁定决定，PLAN truth/action直接引用 | 01,02,03,04,06,07,10,11,13,14 | COVERED |
| CONTEXT | D-16 | 01-CONTEXT锁定决定，PLAN truth/action直接引用 | 01,11,12,13,14 | COVERED |
| RESEARCH | A1-stack | Node24精确lock、MCP拆包、原生依赖版本 | 01,10 | COVERED |
| RESEARCH | A1-tiers | domain/contracts/application/persistence/platform及客户端职责 | 01,02,03,04,05,06 | COVERED |
| RESEARCH | A1-ui | 纯HTML/CSS/TS、已批准UI-SPEC真实托管 | 07 | COVERED |
| RESEARCH | A2-wal | 实际SQLite3.53.4/sourceid/WAL核验、一致backup | 02,09,10,14 | COVERED |
| RESEARCH | A2-jobs | 短事务fence/幂等/重试/取消、expired-running回收 | 02,05,10 | COVERED |
| RESEARCH | A2-maintenance | 持久维护gate/generation及正常写拒绝、特权自检 | 01,02,04,05,06,09 | COVERED |
| RESEARCH | A3-network | loopback Host/Origin/CSRF、大小限流/输出策略 | 04 | COVERED |
| RESEARCH | A3-pairing | 不具权限关联码、显式CLI批准/单次cookie、失效清空 | 04,06,07 | COVERED |
| RESEARCH | A3-os | OSkeyring+DACL、无明文降级/无secret输出 | 03,10,14 | COVERED |
| RESEARCH | A4-process | detached/所有权/端口、实际Codex退出 | 05,10,14 | COVERED |
| RESEARCH | A4-wiring | 真实SDK→stdio→HTTP→Worker，编译独立身份 | 05,06,10 | COVERED |
| RESEARCH | A5-bootstrap | 无Node系统bootstrap、路径/完整性/范围确认 | 08 | COVERED |
| RESEARCH | A5-upgrade | journal/快照/generation/firstinstall/cleanup_pending | 09,10,14 | COVERED |
| RESEARCH | A5-matrix | macOS14+arm64/Win11x64候选、实际设备检测 | 03,10,14 | COVERED |
| RESEARCH | A5-winbuild | 官方targetprebuilt交叉装配、PE/依赖闭包；无云CI | 10,13 | COVERED |
| RESEARCH | A6-trust | Ed25519/独立Node校验/固定公钥/密钥批准 | 08,11,12,13 | COVERED |
| RESEARCH | A6-release | returdex/同名/许可/源码历史和资产去敏/不可覆盖 | 11,12,13 | COVERED |
| RESEARCH | A6-order | 匿名可获取后用户更新；两个beta可安装无源码前置 | 10,13,14 | COVERED |
| RESEARCH | A7-tests | 框架/脚本/故障注入/随包synthetic诊断/不同证据 | 01–14 | COVERED |

## Scope budget and verification ownership

- 14个小计划保留同一个Phase1，不拆新阶段或删需求。01三个任务分别5/4/5文件：配置/运行时约20%、测试骨架约10%、契约约15%，合计目标45%上下文；14文件不代表14个子系统。07的11文件分4/4/3三小任务（静态接线、UI、反馈），08的12文件分3/4/5三小任务（验签、bootstrap、preview），每计划估计≤50%上下文。实际超过预算必须暂停并提议拆计划，不能删范围。其他计划两个任务。此为上下文估计，非实测工时。
- 每task至少一条实际可执行自动检查，具体新测试由同task创建后先RED再实现；01骨架先可运行。全部命令/file owner/威胁映射在01-VALIDATION，不存在未分配测试占位项。
- 自动task检验后才提交；每wave适用S/I/UI回归；N仅本OS适用项目执行，未有另一平台保持not_run并明确列缺口。原生keyring拒绝/OS弹窗由用户处理，不能模拟真人许可。
- 12/14自动命令只验证前置条件；不能替代用户确认/人工结果。当前所有计划approval=pending_user_plan_approval，所有产品测试not_run，checker文档审查另记。
