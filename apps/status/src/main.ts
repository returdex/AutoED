type Identity = {version:string;buildId:string;commit:string;tree:string;dependencyHash:string;protocol:number;schemaMin:number;schemaMax:number;capabilities:string[]};
type Component = {role:string;build:Identity|null;health:string;freshness?:string;checkedAt:string|null;evidence:string};
type Installation = {operationId:string;stage:string;result:string;cleanup:string;targetBuild:Identity|null;actualBuild:Identity|null;checkedAt:string|null;freshness?:string;previousInstallation?:'none'|'present'|'unknown'};
type RuntimeSnapshot = {manifest?:{build:Identity;manifestHash:string;checkedAt:string;evidence:string}|null;api:Component|null;worker:Component|null;install:Installation|null;selfcheck:{jobId:string|null;featureResult:string;probes:Component[];checkedAt:string|null;freshness?:string}|null;checkedAt:string|null};
type JobView = {id:string;state:string;attempt:number;updatedAt:number;result:string|null;errorCode:string|null};
type SourceId = 'moodle'|'edstem';
type AuthSource = {
  source:SourceId;officialOrigin:string;approvedScopeId:string;
  identity:{displayName:string;schoolEmail:string;selectedCourseName:string|null}|null;identityFingerprint:string|null;
  auth:'not_observed'|'authenticated'|'unauthenticated'|'reauth_required'|'identity_mismatch';capability:'unknown'|'available'|'unavailable'|'denied';
  health:'not_observed'|'healthy'|'degraded'|'error';freshness:'not_observed'|'fresh'|'stale';completeness:'not_observed'|'complete'|'partial';
  checkedAt:string|null;resultCode:string;courseAccess:'allowed'|'blocked';sharedProfile:'candidate'|'observed'|'unverified';
};
type AuthSnapshot = {
  overall:{code:string;phase3Eligibility:'blocked';gaps:string[]};sources:AuthSource[];
  binding:{consistency:'not_observed'|'candidate'|'confirmed'|'mismatch';identityFingerprint:string|null};
  nextAction:{kind:'open_login';source:SourceId;approvedConfigId:string;approvedScopeId:string}|{kind:'confirm_binding';candidateBindingId:string}|{kind:'wait'|'none'};
};
type Receipt = {receiptId:string;buildId:string;version:string;platform:'macos'|'windows';source:SourceId;scenario:string;evidence:'S'|'I'|'N'|'L';status:'pass'|'fail'|'not_run'|'human_needed';resultCode:string;bindingConsistency:'consistent'|'mismatch'|'not_observed';identityFingerprint:string|null;gaps:string[];checkedAt:string;earliestRecheckAt:string|null;nextAction:'none'|'resolve_gaps'|'human_action_required'};
type SafeAuthError = {code:string;stage:'auth_api';nextAction:string};
type PendingLogin = {source:SourceId;approvedConfigId:string;approvedScopeId:string;actionReceiptId:string};

const unknown = '未验证，不代表已通过。';
const privacyCopy = '以下账户和课程信息仅显示在这台设备的已配对页面中。请勿将完整姓名、邮箱、课程名、登录页面或验证码截图粘贴到聊天或公开记录。';
const scenarios = [
  ['a.login','A 登录'],['a.binding','A 绑定'],['a.course_visibility','A 课程可见性'],['b.reopen_1','B 重开 1'],['b.reopen_2','B 重开 2'],
  ['b.reopen_3','B 重开 3'],['b.worker_restart','B Worker 重启'],['b.codex_exit','B Codex 退出'],['c.os_restart','C 系统重启'],
  ['d.24h_recheck','D 跨日复查'],['reauth','reauth'],
] as const;
const sourceOrder = ['moodle','edstem'] as const;
const refreshButton = document.querySelector<HTMLButtonElement>('#refresh')!;
const feedback = document.querySelector<HTMLElement>('#feedback')!;
const pairing = document.querySelector<HTMLElement>('#pairing')!;
const pairCode = document.querySelector<HTMLElement>('#pair-code')!;
const protectedView = document.querySelector<HTMLElement>('#protected')!;
let runtimeSnapshot:RuntimeSnapshot|null=null;
let authSnapshot:AuthSnapshot|null=null;
let job:JobView|null=null;
let receipts:Receipt[]=[];
let pairingNonce:string|null=null;
let csrf:string|null=null;
let pendingAt=0;
let readAt='';
let busy=false;
let staleView=false;
let pendingLogin:PendingLogin|null=null;
let stopRequested=false;
let safeAuthError:SafeAuthError|null=null;
let clipboardSource:string|null=null;

function announce(text:string) { if(feedback.textContent!==text)feedback.textContent=text; }
function node<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string) {const result=document.createElement(tag);if(text!==undefined)result.textContent=text;return result;}
function rows(parent:HTMLElement,values:readonly (readonly [string,string])[]) {const list=node('dl');for(const [label,value]of values)list.append(node('dt',label),node('dd',value));parent.append(list);return list;}
function section(title:string,className?:string) {const element=node('section');if(className)element.className=className;element.append(node('h2',title));protectedView.append(element);return element;}
function identity(build:Identity|null|undefined) {return build?`${build.version}\nbuild_id: ${build.buildId}\ncommit: ${build.commit}\ntree: ${build.tree}\ndependency_hash: ${build.dependencyHash}\nprotocol: ${build.protocol}; schema: ${build.schemaMin}–${build.schemaMax}; capabilities: ${build.capabilities.join(', ')}`:unknown;}
function same(a:Identity|null|undefined,b:Identity|null|undefined) {return Boolean(a&&b&&a.version===b.version&&a.buildId===b.buildId&&a.commit===b.commit&&a.tree===b.tree&&a.dependencyHash===b.dependencyHash&&a.protocol===b.protocol&&a.schemaMin===b.schemaMin&&a.schemaMax===b.schemaMax&&[...a.capabilities].sort().join() === [...b.capabilities].sort().join());}

function installPresentation(status:RuntimeSnapshot) {
  const i=status.install;
  const base={impact:'操作未完成或尚未验证。',nextAction:'请通过本安装的 CLI 查看脱敏诊断。'};
  if(!i)return {...base,code:'NOT_OBSERVED',stage:'unknown',message:unknown};
  if(i.result==='human_needed')return {...base,code:'HUMAN_NEEDED',stage:i.stage,message:'操作已停止，尚不能确认安全恢复方式。请查看脱敏原因并等待人工确认；不要删除资料或强制降级。'};
  if(i.result==='restored')return {...base,code:'UPGRADE_RESTORED',stage:i.stage,message:i.actualBuild?`升级失败，已恢复旧版。当前运行 ${i.actualBuild.version}；未自动重试升级。`:'恢复结果未验证；不能确认已恢复旧版。'};
  if(i.result==='failed')return {...base,code:'INSTALL_FAILED',stage:i.stage,message:i.previousInstallation==='none'?'安装失败，服务尚未就绪。当前没有可恢复的旧版；请按诊断结果处理。':'操作失败；旧版本与恢复状态尚未确认。请通过本安装的 CLI 检查诊断结果。'};
  if(i.cleanup==='cleanup_pending')return {...base,code:'CLEANUP_PENDING',stage:i.stage,message:'旧受管程序、入口或进程尚未清理完成，操作未完成；目标运行状态请查看自检结果。'};
  if(i.targetBuild&&i.actualBuild&&!same(i.targetBuild,i.actualBuild))return {...base,code:'VERSION_MISMATCH',stage:i.stage,message:'检测到组件版本不一致，操作未完成。请查看差异并通过本安装的升级流程处理。'};
  const check=status.selfcheck;const manifest=status.manifest;
  const proven=Boolean(manifest&&['build_manifest','verified_release_manifest'].includes(manifest.evidence)&&manifest.manifestHash.length===64&&same(manifest.build,i.targetBuild)&&check?.featureResult==='pass'&&check.jobId!==null&&check.checkedAt!==null&&Date.parse(manifest.checkedAt)<=Date.parse(check.checkedAt)&&check.probes.length===4&&new Set(check.probes.map(probe=>probe.role)).size===4&&['api','worker','cli','mcp'].every(role=>check.probes.some(probe=>probe.role===role&&probe.health==='healthy'&&probe.evidence!=='not_observed'&&probe.checkedAt!==null&&same(probe.build,i.targetBuild))));
  if(i.result==='succeeded'&&i.stage==='complete'&&i.checkedAt!==null&&i.cleanup==='complete'&&same(i.targetBuild,i.actualBuild)&&proven)return {code:'INSTALL_COMPLETE',stage:i.stage,message:'操作完成：目标版本已启动，实际接线自检通过，旧版本清理完成。'+(i.previousInstallation==='none'?'首次安装，无旧版本需要清理。':''),impact:'上次操作记录已通过验证；当前运行状态单独观察。',nextAction:base.nextAction};
  if(i.targetBuild&&[status.api,status.worker,...(check?.probes??[])].some(component=>component?.build&&!same(component.build,i.targetBuild)))return {...base,code:'VERSION_MISMATCH',stage:i.stage,message:'检测到组件版本不一致，操作未完成。请查看差异并通过本安装的升级流程处理。'};
  return {...base,code:'NOT_VERIFIED',stage:i.stage,message:`操作未完成。${unknown}`};
}
function workerPresentation(worker:Component|null,stale:boolean) {
  if(stale)return '旧快照：API 与 Worker 当前运行状态未确认。';
  if(!worker||worker.evidence==='not_observed')return '尚未观察到 Worker；当前运行状态未确认。请通过本安装的 CLI 检查服务。';
  if(worker.freshness!=='fresh')return 'Worker 观察已过期，当前运行状态未确认。请通过本安装的 CLI 检查服务。';
  if(worker.health==='not_observed')return 'API 可连接，但 Worker 未运行，后台任务暂不能执行。请通过本安装的 CLI 检查服务。';
  if(worker.health==='healthy')return 'Worker 最近观察为健康；观察时间见下方。';
  return 'Worker 报告异常或降级；是否仍在运行尚未确认。请通过本安装的 CLI 检查服务。';
}

const statusCopy = {
  auth:{not_observed:'尚未验证',authenticated:'已认证',unauthenticated:'未登录',reauth_required:'需要重新认证',identity_mismatch:'身份不一致'},
  capability:{unknown:'能力未知',available:'能力可用',unavailable:'能力不可用',denied:'能力被拒绝'},
  health:{not_observed:'运行健康未观察',healthy:'运行健康',degraded:'运行降级',error:'运行错误'},
  freshness:{not_observed:'新鲜度未观察',fresh:'状态新鲜',stale:'状态过期'},
  completeness:{not_observed:'完整性未观察',complete:'观察完整',partial:'观察部分'},
} as const;
function explained(group:keyof typeof statusCopy,value:string) {const labels=statusCopy[group] as Record<string,string>;return `${labels[value]??'未知状态'}（${value}）`;}
function statusTone(group:keyof typeof statusCopy,value:string) {
  if((group==='auth'&&value==='authenticated')||(group==='health'&&value==='healthy')||(group==='freshness'&&value==='fresh')||(group==='completeness'&&value==='complete')||(group==='capability'&&value==='available'))return 'status-success';
  if(value==='unauthenticated'||value==='reauth_required'||value==='degraded'||value==='stale'||value==='partial')return 'status-warning';
  if(value==='identity_mismatch'||value==='error'||value==='denied')return 'status-blocked';
  return 'status-neutral';
}
function actionLabel(snapshot:AuthSnapshot|null) {
  if(pendingLogin&&!stopRequested)return '我已完成 Moodle 登录';
  if(!snapshot||snapshot.sources.length<2)return '确认来源与范围';
  if(snapshot.binding.consistency==='mismatch')return '重新检查账户身份';
  if(snapshot.nextAction.kind==='confirm_binding')return '确认两个账户对应';
  const code=snapshot.overall.code;
  if(code==='REAUTH_REQUIRED'||snapshot.sources.some(source=>source.auth==='reauth_required'))return '重新打开官方登录窗口';
  if(code==='NETWORK_UNAVAILABLE'||code==='PARSER_CHANGED'||code==='PROFILE_IN_USE'||code==='PROFILE_OWNERSHIP_UNCONFIRMED')return '再次检查来源状态';
  if(snapshot.nextAction.kind==='open_login')return '打开 Moodle 官方登录窗口';
  return '再次检查来源状态';
}
function renderOverallGate(snapshot:AuthSnapshot|null,stale:boolean) {
  const panel=section('双来源认证门禁','overall-gate');
  const heading=node('p');heading.className='gate-result';heading.tabIndex=-1;
  const code=snapshot?.overall.code??'NOT_OBSERVED';
  const result=snapshot?.binding.consistency==='mismatch'?'已阻塞':code==='AUTHENTICATED'&&snapshot?.binding.consistency==='confirmed'?'可开始 macOS 检查':snapshot?.nextAction.kind==='confirm_binding'?'需要用户操作':'尚未验证';
  heading.textContent=`${result}（${code}）`;panel.append(heading);
  if(stale)panel.append(node('p',`以下为上次读取结果，当前状态尚未确认。读取时间：${readAt}`));
  const sourceState=(source:SourceId)=>snapshot?.sources.find(item=>item.source===source)?.auth==='authenticated'?'已确认':'未确认';
  rows(panel,[['当前平台','macOS 优先检查；Windows 独立待验证'],['双来源确认',`Moodle ${sourceState('moodle')}；EdStem ${sourceState('edstem')}`],['binding consistency',snapshot?.binding.consistency??'not_observed'],['当前 checkpoint','A / B / C / D / reauth 均独立'],['阻塞原因',snapshot?.overall.gaps.join('、')||'WINDOWS_NOT_RUN'],['唯一下一步',actionLabel(snapshot)]]);
  return panel;
}
function renderPrivacyNotice(snapshot:AuthSnapshot|null) {if(snapshot?.sources.some(source=>source.identity)){const panel=section('私人信息提示','privacy-notice');panel.append(node('p',privacyCopy));}}
function renderSourceCard(source:AuthSource) {
  const card=node('article');card.className='source-card';card.append(node('h3',source.source==='moodle'?'Moodle':'EdStem'));
  const profile=source.sharedProfile==='observed'?'已观察复用':source.sharedProfile==='candidate'?'待验证':'待验证';
  const list=rows(card,[['官方来源',source.officialOrigin],['auth',explained('auth',source.auth)],['capability',explained('capability',source.capability)],['health',explained('health',source.health)],['freshness',explained('freshness',source.freshness)],['completeness',explained('completeness',source.completeness)],['完整显示名',source.identity?.displayName??'未提供；不代表身份已确认。'],['完整学校邮箱',source.identity?.schoolEmail??'未提供；不代表身份已确认。'],['共享专属 Profile',profile],['最近检查时间 / 证据',`${source.checkedAt??unknown} / 受保护状态投影；页面不推断 L`],['指定课程',source.identity?.selectedCourseName??'未提供；不读取课程内容。'],['课程可见性',source.courseAccess==='allowed'?'已确认可见':'未确认'],['result code / next action',`${source.resultCode} / ${actionLabel(authSnapshot)}`]]);
  const statuses=[['auth',source.auth],['capability',source.capability],['health',source.health],['freshness',source.freshness],['completeness',source.completeness]] as const;
  const values=list.querySelectorAll<HTMLElement>('dd');for(let index=0;index<statuses.length;index++){const [group,value]=statuses[index]!;values[index+1]?.classList.add('status-badge',statusTone(group,value));}
  return card;
}
function renderSourceCards(snapshot:AuthSnapshot|null) {
  const panel=section('双来源状态','source-section');const grid=node('div');grid.className='source-grid';
  for(const source of sourceOrder){const value=snapshot?.sources.find(item=>item.source===source);if(value)grid.append(renderSourceCard(value));else{const missing=node('article');missing.className='source-card';missing.append(node('h3',source==='moodle'?'Moodle':'EdStem'),node('p','尚未配置学校来源'));grid.append(missing);}}panel.append(grid);
}
function renderBindingPanel(snapshot:AuthSnapshot|null) {
  const panel=section(snapshot?.binding.consistency==='mismatch'?'账户身份不一致，课程访问已停止':'账户绑定核对','binding-panel');if(snapshot?.binding.consistency==='mismatch')panel.classList.add('blocked');
  const grid=node('div');grid.className='binding-grid';for(const source of sourceOrder){const value=snapshot?.sources.find(item=>item.source===source);const column=node('div');column.className='binding-column';column.append(node('h3',source==='moodle'?'Moodle 身份':'EdStem 身份'));rows(column,[['完整显示名',value?.identity?.displayName??unknown],['完整学校邮箱',value?.identity?.schoolEmail??unknown],['短 fingerprint',value?.identityFingerprint??unknown]]);grid.append(column);}panel.append(grid);rows(panel,[['依据类别','稳定主体、组织 / 租户、批准范围'],['binding consistency',snapshot?.binding.consistency??'not_observed'],['说明','仅核对两个来源当前本地身份；不显示原始主体、token 或内部响应。']]);
}
function renderLoginActionPanel(snapshot:AuthSnapshot|null,stale:boolean) {const panel=section('登录与来源检查','login-action-panel');panel.append(node('p','只使用已批准的两个官方来源，仅进行认证与指定课程可见性检查；不会读取课程内容。'));const button=node('button',actionLabel(snapshot));button.type='button';button.className='primary-action';button.disabled=stale;panel.append(button);}
function latestReceipt(source:SourceId,scenario:string) {return receipts.filter(receipt=>receipt.platform==='macos'&&receipt.source===source&&receipt.scenario===scenario&&receipt.evidence==='L').sort((a,b)=>b.checkedAt.localeCompare(a.checkedAt))[0]??null;}
function renderCheckpointLedger(stale:boolean) {
  const panel=section('macOS live 检查点','checkpoint-ledger');const list=node('ul');for(const [scenario,label]of scenarios)for(const source of sourceOrder){const receipt=latestReceipt(source,scenario);const item=node('li');rows(item,[['checkpoint / 场景',`${label} / ${scenario}`],['来源 / 平台 / 证据',`${source==='moodle'?'Moodle':'EdStem'} / macOS / L`],['状态',receipt?.status??'not_run / human_needed'],['时间',receipt?.checkedAt??unknown],['脱敏 code',receipt?.resultCode??'NOT_RUN'],['下一步',scenario==='d.24h_recheck'?(receipt?.earliestRecheckAt?`最早复查时间 ${receipt.earliestRecheckAt}；等待跨日复查`:'等待跨日复查'):receipt?.nextAction??'human_action_required']]);list.append(item);}panel.append(list);const copy=node('button','复制脱敏结果单');copy.type='button';copy.className='secondary-action';copy.disabled=stale;copy.addEventListener('click',()=>{void copyReceipts();});panel.append(copy);
}
function renderPlatformGaps() {const panel=section('平台缺口','platform-gaps');const grid=node('div');grid.className='platform-grid';const mac=node('article');mac.append(node('h3','macOS'),node('p','当前仅显示逐格状态；未运行项保持 not_run / human_needed。'));const windows=node('article');windows.append(node('h3','Windows'),node('p','not_run / human_needed'),node('p','macOS 结果不能替代 Windows 验证；Phase 3 仍被阻塞。'));grid.append(mac,windows);panel.append(grid);}
function renderExistingDiagnostics(snapshot:RuntimeSnapshot,stale:boolean) {
  const scope=section('版本与范围');rows(scope,[['API 当前版本',snapshot.api?.build?.version??unknown],['范围','当前版本仅验证本地服务与安装升级；认证状态在上方独立显示。'],['启动方式','按需启动；退出 Codex 后继续运行。系统登录自启动未启用。'],['读取时间',readAt],['当前确认',stale?'以下为上次读取结果，当前状态尚未确认。':'本次读取成功；各组件观察时间分别列出。']]);
  const attention=section(stale?'上次操作记录（旧快照）':'上次操作记录');const state=installPresentation(snapshot);attention.append(node('p',state.message));rows(attention,[['code',state.code],['stage',state.stage],['影响',state.impact],['下一步',state.nextAction]]);attention.append(node('p',workerPresentation(snapshot.worker,stale)));
  const health=section('API 与 Worker');for(const [name,c]of [['API',snapshot.api],['Worker',snapshot.worker]] as const)rows(health,[[name,stale?'旧快照，当前未确认':c?`${c.health} · ${c.freshness??'not_observed'}`:'not_observed'],[`${name} 观察时间`,c?.checkedAt??unknown]]);
  const versions=section('版本身份与差异');rows(versions,[['目标版本',identity(snapshot.install?.targetBuild)],['发布 manifest',identity(snapshot.manifest?.build)],['manifest 证据',snapshot.manifest?`${snapshot.manifest.evidence} · ${snapshot.manifest.manifestHash} · ${snapshot.manifest.checkedAt}（构建清单观察不等于发布签名验证）`:unknown]]);for(const role of ['api','worker','cli','mcp']){const c=role==='api'?snapshot.api:role==='worker'?snapshot.worker:snapshot.selfcheck?.probes.find(probe=>probe.role===role);rows(versions,[[role.toUpperCase(),identity(c?.build)],[`${role.toUpperCase()} 检查时间`,c?.checkedAt??unknown],[`${role.toUpperCase()} 目标匹配`,c?.build&&snapshot.install?.targetBuild?(same(c.build,snapshot.install.targetBuild)?'身份一致；不单独代表自检通过':'不一致'):unknown]]);}
  const checks=section(snapshot.selfcheck?'最近一次自检':'尚无自检记录');if(!snapshot.selfcheck)checks.append(node('p','安装或升级后将自动启动服务并自检。请先在 Codex 中完成已发布测试版的安装。'));else rows(checks,[['job_id',snapshot.selfcheck.jobId??unknown],['状态',job?.state??unknown],['attempt',job?String(job.attempt):unknown],['更新时间',job?new Date(job.updatedAt).toISOString():unknown],['任务结果',job?.result??unknown],['错误代码',job?.errorCode??'无已观察错误代码'],['实际接线自检',snapshot.selfcheck.featureResult],['自检观察时间',snapshot.selfcheck.checkedAt??unknown]]);
  const install=section('最近一次安装或升级');rows(install,[['operation_id',snapshot.install?.operationId??unknown],['阶段',snapshot.install?.stage??unknown],['结果',snapshot.install?.result??unknown],['清理',snapshot.install?.cleanup??unknown],['观察时间',snapshot.install?.checkedAt??unknown]]);
  const details=node('details');details.append(node('summary','诊断详情'));rows(details,[['OS / CPU',unknown],['固定依赖版本',unknown],['实际 SQLite 版本',unknown],['实际浏览器版本',unknown],['完整验证状态',unknown],['诊断说明','此接口未提供的字段保持未验证，不从浏览器环境或产品文案推测。']]);protectedView.append(details);
}
function render(stale=false) {if(!runtimeSnapshot)return;staleView=stale;const detailsOpen=protectedView.querySelector('details')?.open??false;protectedView.replaceChildren();pairing.hidden=true;renderOverallGate(authSnapshot,stale);renderPrivacyNotice(authSnapshot);renderSourceCards(authSnapshot);renderBindingPanel(authSnapshot);renderLoginActionPanel(authSnapshot,stale);renderCheckpointLedger(stale);renderPlatformGaps();renderExistingDiagnostics(runtimeSnapshot,stale);if(stale){for(const area of protectedView.querySelectorAll<HTMLElement>('section, .source-card, .binding-column, .checkpoint-ledger li, .platform-grid article')){const notice=node('p',`旧快照；读取时间：${readAt}`);notice.className='stale-notice';area.insertBefore(notice,area.children[1]??null);}for(const control of protectedView.querySelectorAll<HTMLButtonElement>('button'))control.disabled=true;}const details=protectedView.querySelector('details');if(details)details.open=detailsOpen;const primary=protectedView.querySelector<HTMLButtonElement>('.primary-action');if(primary&&!stale)primary.addEventListener('click',()=>{void runPrimary(primary);});if(pendingLogin&&!stale){const panel=protectedView.querySelector<HTMLElement>('.login-action-panel');if(panel){const stop=node('button',stopRequested?'已请求停止':'停止本次检查');stop.type='button';stop.className='secondary-action';stop.disabled=stopRequested;stop.addEventListener('click',()=>{stopRequested=true;announce('已请求停止；等待服务确认。');render();});panel.append(stop);}}if(safeAuthError){const panel=protectedView.querySelector<HTMLElement>('.login-action-panel');if(panel){const error=node('div');error.className='auth-error';rows(error,[['safe code',safeAuthError.code],['影响','当前认证动作未确认完成。'],['保留状态','上次成功资料保持不变。'],['下一步',safeAuthError.nextAction]]);panel.append(error);}}}
function clearProtected() {runtimeSnapshot=null;authSnapshot=null;job=null;receipts=[];readAt='';csrf=null;pendingLogin=null;stopRequested=false;safeAuthError=null;clipboardSource=null;staleView=false;protectedView.replaceChildren();pairing.hidden=false;}
async function request(path:string,body?:object) {return fetch(path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',...(body===undefined?{}:{headers:{'content-type':'application/json','x-autoed-csrf':csrf??pairingNonce??''},body:JSON.stringify(body)})});}
async function beginPairing() {if(pairingNonce&&Date.now()-pendingAt<300000)return;pairingNonce=null;csrf=null;pairCode.textContent='';const response=await request('/api/pairing/nonce');if(!response.ok)throw new Error('PAIRING_UNAVAILABLE');const value=await response.json();if(!/^[A-Za-z0-9_-]{43}$/.test(value.nonce))throw new Error('INVALID_RESPONSE');pairingNonce=value.nonce;const pending=await request('/api/pairing/pending',{nonce:pairingNonce});if(!pending.ok){pairingNonce=null;throw new Error('PAIRING_UNAVAILABLE');}const value2=await pending.json();if(!/^[A-F0-9]{16}$/.test(value2.code))throw new Error('INVALID_RESPONSE');pairCode.textContent=value2.code;pendingAt=Date.now();}
const safeCodes=new Set(['AUTHENTICATED','NOT_OBSERVED','AUTH_REQUIRED','REAUTH_REQUIRED','NETWORK_UNAVAILABLE','PARSER_CHANGED','CAPABILITY_DENIED','IDENTITY_MISMATCH','PROFILE_IN_USE','PROFILE_OWNERSHIP_UNCONFIRMED','CONFIGURATION_CONFIRMED','LOGIN_OPENED','PROBE_ACCEPTED','LOGOUT_RECORDED','BINDING_CONFIRMED','BINDING_REJECTED','INVALID_REQUEST','CONFIGURATION_MISMATCH','SCOPE_MISMATCH','FORBIDDEN','UNAUTHORIZED','PAIRING_DENIED','UNKNOWN_SOURCE_ERROR','INTERNAL_ERROR']);
function accepted(value:unknown):value is {accepted:true;actionReceiptId:string;resultCode:string} {if(!value||typeof value!=='object')return false;const item=value as Record<string,unknown>;return Object.keys(item).sort().join(',')==='accepted,actionReceiptId,resultCode'&&item.accepted===true&&typeof item.actionReceiptId==='string'&&/^[0-9a-f-]{36}$/.test(item.actionReceiptId)&&typeof item.resultCode==='string'&&safeCodes.has(item.resultCode);}
function safeError(value:unknown):SafeAuthError {if(value&&typeof value==='object'){const item=value as Record<string,unknown>;if(Object.keys(item).sort().join(',')==='code,nextAction,stage'&&typeof item.code==='string'&&safeCodes.has(item.code)&&item.stage==='auth_api'&&typeof item.nextAction==='string')return {code:item.code,stage:'auth_api',nextAction:item.nextAction};}return {code:'INTERNAL_ERROR',stage:'auth_api',nextAction:'retry_or_check_local_service'};}
async function authMutation(path:string,body:object) {
  const response=await request(path,body);
  if(response.status===401||response.status===403){clearProtected();announce('此页面尚未获得本地访问权限');await beginPairing();throw new Error('AUTH_REVOKED');}
  const value:unknown=await response.json().catch(()=>null);
  if(!response.ok){safeAuthError=safeError(value);if(response.status>=500)render(true);else render();announce('认证动作未确认完成；请查看脱敏结果。');throw new Error('AUTH_ACTION_FAILED');}
  if(!accepted(value))throw new Error('INVALID_RESPONSE');return value;
}
function focusResult(){protectedView.querySelector<HTMLElement>('.gate-result')?.focus();}
async function runPrimary(button:HTMLButtonElement) {
  if(busy||staleView)return;busy=true;button.disabled=true;safeAuthError=null;
  const original=button.textContent??'';button.textContent=original==='我已完成 Moodle 登录'?'正在提交登录完成状态…':original.includes('登录窗口')?'正在请求官方登录窗口…':original==='确认两个账户对应'?'正在确认账户对应关系…':'正在检查来源状态…';announce('正在执行认证检查；不会读取课程内容。');
  try{
    if(pendingLogin&&!stopRequested){const pending=pendingLogin;pendingLogin=null;stopRequested=false;await authMutation('/api/auth/probe',{source:pending.source,approvedConfigId:pending.approvedConfigId,approvedScopeId:pending.approvedScopeId,trigger:'user_login_completed',idempotencyKey:`ui-${crypto.randomUUID()}`,actionReceiptId:pending.actionReceiptId});busy=false;await refresh();focusResult();return;}
    const snapshot=authSnapshot;if(!snapshot){busy=false;await refresh();focusResult();return;}
    if(snapshot.nextAction.kind==='confirm_binding'){await authMutation('/api/auth/binding/confirm',{candidateBindingId:snapshot.nextAction.candidateBindingId,decision:'confirm'});busy=false;await refresh();focusResult();return;}
    if(snapshot.nextAction.kind==='open_login'){
      const action=actionLabel(snapshot);
      if(action==='再次检查来源状态') {await authMutation('/api/auth/probe',{source:snapshot.nextAction.source,approvedConfigId:snapshot.nextAction.approvedConfigId,approvedScopeId:snapshot.nextAction.approvedScopeId,trigger:'manual_retry',idempotencyKey:`ui-${crypto.randomUUID()}`});busy=false;await refresh();focusResult();return;}
      const result=await authMutation('/api/auth/login/open',{source:snapshot.nextAction.source,approvedConfigId:snapshot.nextAction.approvedConfigId});pendingLogin={source:snapshot.nextAction.source,approvedConfigId:snapshot.nextAction.approvedConfigId,approvedScopeId:snapshot.nextAction.approvedScopeId,actionReceiptId:result.actionReceiptId};stopRequested=false;render();announce('官方登录窗口已请求；请只在官方窗口中完成登录。');focusResult();return;
    }
    busy=false;await refresh();focusResult();return;
  }catch(error){if(error instanceof Error&&error.message==='AUTH_REVOKED')return;if(error instanceof Error&&error.message==='AUTH_ACTION_FAILED')return;safeAuthError={code:'INTERNAL_ERROR',stage:'auth_api',nextAction:'retry_or_check_local_service'};render(true);announce('认证动作未确认完成；请查看脱敏结果。');}
  finally{busy=false;const current=protectedView.querySelector<HTMLButtonElement>('.primary-action');if(current&&!staleView)current.disabled=false;}
}
function forbiddenReceiptKey(value:unknown):boolean {if(Array.isArray(value))return value.some(forbiddenReceiptKey);if(value&&typeof value==='object')return Object.entries(value).some(([key,item])=>/(?:name|email|course|path|cookie|profile|origin|url|header|body)/i.test(key)||forbiddenReceiptKey(item));return false;}
async function copyReceipts() {const payload=receipts.map(receipt=>({receiptId:receipt.receiptId,buildId:receipt.buildId,version:receipt.version,platform:receipt.platform,source:receipt.source,scenario:receipt.scenario,evidence:receipt.evidence,status:receipt.status,resultCode:receipt.resultCode,bindingConsistency:receipt.bindingConsistency,identityFingerprint:receipt.identityFingerprint,gaps:[...receipt.gaps],checkedAt:receipt.checkedAt,earliestRecheckAt:receipt.earliestRecheckAt,nextAction:receipt.nextAction}));if(forbiddenReceiptKey(payload)){announce('脱敏结果单未复制。');return;}clipboardSource=JSON.stringify(payload);try{await navigator.clipboard.writeText(clipboardSource);announce('脱敏结果单已复制。');}catch{clipboardSource=null;announce('脱敏结果单未复制。');}}
async function readReceipts() {const results=await Promise.all(scenarios.flatMap(([scenario])=>sourceOrder.map(async source=>{const response=await request(`/api/auth/receipts?platform=macos&source=${source}&scenario=${scenario}&evidence=L`);if(response.status===401||response.status===403)throw new Error('AUTH_REVOKED');if(!response.ok)throw new Error('RECEIPTS_UNAVAILABLE');return await response.json() as Receipt[];})));return results.flat();}
async function refresh() {
  if(busy)return;const restoreRefreshFocus=document.activeElement===refreshButton;busy=true;refreshButton.disabled=true;announce('正在读取本地服务状态…');
  try{
    if(pairingNonce&&Date.now()-pendingAt<300000){const exchanged=await request('/api/pairing/exchange',{});if(exchanged.ok){const value=await exchanged.json();csrf=value.csrf;pairingNonce=null;pairCode.textContent='';}else if(exchanged.status!==403)throw new Error('PAIRING_UNAVAILABLE');}
    const statusResponse=await request('/api/status');if(statusResponse.status===401||statusResponse.status===403){clearProtected();announce('此页面尚未获得本地访问权限');await beginPairing();return;}if(!statusResponse.ok)throw new Error('STATUS_UNAVAILABLE');const nextRuntime:RuntimeSnapshot=await statusResponse.json();let nextJob:JobView|null=null;
    if(nextRuntime.selfcheck?.jobId){const result=await request('/api/jobs/'+encodeURIComponent(nextRuntime.selfcheck.jobId));if(result.status===401||result.status===403)throw new Error('AUTH_REVOKED');if(result.ok)nextJob=await result.json();}
    const authResponse=await request('/api/auth/status');let nextAuth:AuthSnapshot|null=null;let nextReceipts:Receipt[]=[];if(authResponse.status===401||authResponse.status===403)throw new Error('AUTH_REVOKED');if(authResponse.ok){nextAuth=await authResponse.json();nextReceipts=await readReceipts();}else if(authSnapshot)throw new Error('AUTH_UNAVAILABLE');
    runtimeSnapshot=nextRuntime;authSnapshot=nextAuth;receipts=nextReceipts;job=nextJob;readAt=new Date().toISOString();render();announce('本地状态已读取。');
  }catch(error){if(error instanceof Error&&error.message==='AUTH_REVOKED'){clearProtected();announce('此页面尚未获得本地访问权限');await beginPairing();}else if(runtimeSnapshot){render(true);announce('以下为上次读取结果，当前状态尚未确认。读取时间：'+readAt);}else announce('无法连接本地 API。请在 Codex 中使用本安装的启动或诊断步骤。');}finally{busy=false;refreshButton.disabled=false;if(restoreRefreshFocus)refreshButton.focus();}
}
refreshButton.addEventListener('click',()=>{void refresh();});
void refresh();
