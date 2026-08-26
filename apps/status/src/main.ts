type Identity = {version:string;buildId:string;commit:string;tree:string;dependencyHash:string;protocol:number;schemaMin:number;schemaMax:number;capabilities:string[]};
type Component = {role:string;build:Identity|null;health:string;freshness?:string;checkedAt:string|null;evidence:string};
type Installation = {operationId:string;stage:string;result:string;cleanup:string;targetBuild:Identity|null;actualBuild:Identity|null;checkedAt:string|null;freshness?:string;previousInstallation?:'none'|'present'|'unknown'};
type Snapshot = {api:Component|null;worker:Component|null;install:Installation|null;selfcheck:{jobId:string|null;featureResult:string;probes:Component[];checkedAt:string|null;freshness?:string}|null;checkedAt:string|null};
type JobView = {id:string;state:string;attempt:number;updatedAt:number;result:string|null;errorCode:string|null};
const unknown = '未验证，不代表已通过。';
const refreshButton = document.querySelector<HTMLButtonElement>('#refresh')!;
const feedback = document.querySelector<HTMLElement>('#feedback')!;
const pairing = document.querySelector<HTMLElement>('#pairing')!;
const pairCode = document.querySelector<HTMLElement>('#pair-code')!;
const protectedView = document.querySelector<HTMLElement>('#protected')!;
let snapshot:Snapshot|null=null;
let job:JobView|null=null;
let nonce:string|null=null;
let pendingAt=0;
let readAt='';
let busy=false;

function announce(text:string) { if(feedback.textContent!==text)feedback.textContent=text; }
function node<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string) {const result=document.createElement(tag);if(text!==undefined)result.textContent=text;return result;}
function section(title:string) {const element=node('section');element.append(node('h2',title));protectedView.append(element);return element;}
function rows(parent:HTMLElement,values:[string,string][]) {const list=node('dl');for(const [label,value]of values)list.append(node('dt',label),node('dd',value));parent.append(list);}
function identity(build:Identity|null|undefined) {return build?`${build.version}\nbuild_id: ${build.buildId}\ncommit: ${build.commit}\ntree: ${build.tree}\ndependency_hash: ${build.dependencyHash}\nprotocol: ${build.protocol}; schema: ${build.schemaMin}–${build.schemaMax}; capabilities: ${build.capabilities.join(', ')}`:unknown;}
function same(a:Identity|null|undefined,b:Identity|null|undefined) {return Boolean(a&&b&&a.version===b.version&&a.buildId===b.buildId&&a.commit===b.commit&&a.tree===b.tree&&a.dependencyHash===b.dependencyHash&&a.protocol===b.protocol&&a.schemaMin===b.schemaMin&&a.schemaMax===b.schemaMax&&[...a.capabilities].sort().join() === [...b.capabilities].sort().join());}
function render(stale=false) {
  if(!snapshot)return;
  const open=protectedView.querySelector('details')?.open??false;
  protectedView.replaceChildren();pairing.hidden=true;
  const s=snapshot;
  const scope=section('版本与范围');rows(scope,[['API 当前版本',s.api?.build?.version??unknown],['范围','当前版本仅验证本地服务与安装升级，未连接学校或采集课程。'],['启动方式','按需启动；退出 Codex 后继续运行。系统登录自启动未启用。'],['读取时间',readAt],['当前确认',stale?'以下为上次读取结果，当前状态尚未确认。':'本次读取成功；各组件观察时间分别列出。']]);
  const attention=section(stale?'上次操作记录（旧快照）':'上次操作记录');const state=presentInstall(s);attention.append(node('p',state.message));
  rows(attention,[['code',state.code],['stage',state.stage],['影响',state.impact],['下一步',state.nextAction]]);
  attention.append(node('p',presentWorker(s.worker,stale)));
  const health=section('API 与 Worker');for(const [name,c]of [['API',s.api],['Worker',s.worker]] as const)rows(health,[[name,stale?'旧快照，当前未确认':c?`${c.health} · ${c.freshness??'not_observed'}`:'not_observed'],[`${name} 观察时间`,c?.checkedAt??unknown]]);
  const versions=section('版本身份与差异');rows(versions,[['目标版本',identity(s.install?.targetBuild)],['发布 manifest',unknown]]);
  for(const role of ['api','worker','cli','mcp']){const c=role==='api'?s.api:role==='worker'?s.worker:s.selfcheck?.probes.find(p=>p.role===role);rows(versions,[[role.toUpperCase(),identity(c?.build)],[`${role.toUpperCase()} 检查时间`,c?.checkedAt??unknown],[`${role.toUpperCase()} 目标匹配`,c?.build&&s.install?.targetBuild?(same(c.build,s.install.targetBuild)?'身份一致；不单独代表自检通过':'不一致'):unknown]]);}
  const checks=section(s.selfcheck?'最近一次自检':'尚无自检记录');
  if(!s.selfcheck)checks.append(node('p','安装或升级后将自动启动服务并自检。请先在 Codex 中完成已发布测试版的安装。'));
  else rows(checks,[['job_id',s.selfcheck.jobId??unknown],['状态',job?.state??unknown],['attempt',job?String(job.attempt):unknown],['更新时间',job?new Date(job.updatedAt).toISOString():unknown],['任务结果',job?.result??unknown],['错误代码',job?.errorCode??'无已观察错误代码'],['实际接线自检',s.selfcheck.featureResult],['自检观察时间',s.selfcheck.checkedAt??unknown]]);
  const install=section('最近一次安装或升级');rows(install,[['operation_id',s.install?.operationId??unknown],['阶段',s.install?.stage??unknown],['结果',s.install?.result??unknown],['清理',s.install?.cleanup??unknown],['观察时间',s.install?.checkedAt??unknown]]);
  const details=node('details');details.open=open;details.append(node('summary','诊断详情'));rows(details,[['OS / CPU',unknown],['固定依赖版本',unknown],['实际 SQLite 版本',unknown],['实际浏览器版本',unknown],['完整验证状态',unknown],['诊断说明','此接口未提供的字段保持未验证，不从浏览器环境或产品文案推测。']]);protectedView.append(details);
}
function clearProtected() {snapshot=null;job=null;readAt='';protectedView.replaceChildren();pairing.hidden=false;}
async function request(path:string,body?:object) {return fetch(path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',...(body===undefined?{}:{headers:{'content-type':'application/json','x-autoed-csrf':nonce??''},body:JSON.stringify(body)})});}
async function beginPairing() {
  if(nonce&&Date.now()-pendingAt<300000)return;
  nonce=null;pairCode.textContent='';
  const response=await request('/api/pairing/nonce');if(!response.ok)throw new Error('PAIRING_UNAVAILABLE');
  const value=await response.json();if(!/^[A-Za-z0-9_-]{43}$/.test(value.nonce))throw new Error('INVALID_RESPONSE');nonce=value.nonce;
  const pending=await request('/api/pairing/pending',{nonce});if(!pending.ok){nonce=null;throw new Error('PAIRING_UNAVAILABLE');}
  const value2=await pending.json();if(!/^[A-F0-9]{16}$/.test(value2.code))throw new Error('INVALID_RESPONSE');pairCode.textContent=value2.code;pendingAt=Date.now();
}
async function refresh() {
  if(busy)return;busy=true;refreshButton.setAttribute('aria-disabled','true');announce('正在读取本地服务状态…');
  try{
    if(nonce&&Date.now()-pendingAt<300000){const exchanged=await request('/api/pairing/exchange',{});if(exchanged.ok){nonce=null;pairCode.textContent='';}else if(exchanged.status!==403)throw new Error('PAIRING_UNAVAILABLE');}
    const response=await request('/api/status');
    if(response.status===401||response.status===403){clearProtected();announce('此页面尚未获得本地访问权限');await beginPairing();return;}
    if(!response.ok)throw new Error('STATUS_UNAVAILABLE');
    const next:Snapshot=await response.json();let nextJob:JobView|null=null;
    if(next.selfcheck?.jobId){const result=await request('/api/jobs/'+encodeURIComponent(next.selfcheck.jobId));if(result.status===401||result.status===403){clearProtected();announce('此页面尚未获得本地访问权限');return;}if(result.ok)nextJob=await result.json();}
    snapshot=next;job=nextJob;readAt=new Date().toISOString();render();announce('本地状态已读取。');
  }catch{
    if(snapshot){render(true);announce('以下为上次读取结果，当前状态尚未确认。读取时间：'+readAt);}
    else announce('无法连接本地 API。请在 Codex 中使用本安装的启动或诊断步骤。');
  }finally{busy=false;refreshButton.removeAttribute('aria-disabled');}
}
refreshButton.addEventListener('click',()=>{void refresh();});
void refresh();
import { presentInstall, presentWorker } from '../../../packages/contracts/src/presentation.js';
