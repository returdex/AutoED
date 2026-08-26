/** Pure, shared CLI/UI feedback. Only known public fields reach presentation. */
interface DisplayIdentity {version:string;buildId:string;commit:string;tree:string;dependencyHash:string;protocol:number;schemaMin:number;schemaMax:number;capabilities:string[]}
interface DisplayComponent {role:string;build:DisplayIdentity|null;health:string;freshness?:string|undefined;checkedAt:string|null;evidence:string}
interface DisplayStatus {
  manifest?:{build:DisplayIdentity;manifestHash:string;checkedAt:string;evidence:string}|null|undefined;
  api:DisplayComponent|null;worker:DisplayComponent|null;
  install:{stage:string;result:string;cleanup:string;targetBuild:DisplayIdentity|null;actualBuild:DisplayIdentity|null;checkedAt:string|null;previousInstallation?:'none'|'present'|'unknown'|undefined}|null;
  selfcheck:{jobId:string|null;featureResult:string;probes:DisplayComponent[];checkedAt:string|null}|null;
}
export interface PublicFeedback {code:string;stage:string;impact:string;nextAction:string;message:string}
const unverifiedCopy='未验证，不代表已通过。';
const stages=new Set(['preview','download','verify','stage','quiesce','backup','migrate','activate','selfcheck','cleanup','complete','rollback','stopped']);
function displaySame(a:DisplayIdentity|null,b:DisplayIdentity|null) {return Boolean(a&&b&&a.version===b.version&&a.buildId===b.buildId&&a.commit===b.commit&&a.tree===b.tree&&a.dependencyHash===b.dependencyHash&&a.protocol===b.protocol&&a.schemaMin===b.schemaMin&&a.schemaMax===b.schemaMax&&[...a.capabilities].sort().join() === [...b.capabilities].sort().join());}
function betaVersion(value:string) {return /^0\.\d+\.\d+(?:-beta\.[1-9]\d*)?$/.test(value)?value:'未验证';}
function feedback(code:string,stage:string,message:string,impact='操作未完成或尚未验证。',nextAction='请通过本安装的 CLI 查看脱敏诊断。'):PublicFeedback {return {code,stage:stages.has(stage)?stage:'unknown',message,impact,nextAction};}
export function presentInstall(status:DisplayStatus):PublicFeedback&{complete:boolean} {
  const i=status.install;
  const output=(code:string,message:string,complete=false)=>({...feedback(code,i?.stage??'unknown',message,complete?'上次操作记录已通过验证；当前运行状态单独观察。':undefined),complete});
  if(!i)return output('NOT_OBSERVED',unverifiedCopy);
  if(i.result==='human_needed')return output('HUMAN_NEEDED','操作已停止，尚不能确认安全恢复方式。请查看脱敏原因并等待人工确认；不要删除资料或强制降级。');
  if(i.result==='restored')return output('UPGRADE_RESTORED',i.actualBuild?`升级失败，已恢复旧版。当前运行 ${betaVersion(i.actualBuild.version)}；未自动重试升级。`:'恢复结果未验证；不能确认已恢复旧版。');
  if(i.result==='failed')return output('INSTALL_FAILED',i.previousInstallation==='none'?'安装失败，服务尚未就绪。当前没有可恢复的旧版；请按诊断结果处理。':'操作失败；旧版本与恢复状态尚未确认。请通过本安装的 CLI 检查诊断结果。');
  if(i.cleanup==='cleanup_pending')return output('CLEANUP_PENDING','旧受管程序、入口或进程尚未清理完成，操作未完成；目标运行状态请查看自检结果。');
  if(i.targetBuild&&i.actualBuild&&!displaySame(i.targetBuild,i.actualBuild))return output('VERSION_MISMATCH','检测到组件版本不一致，操作未完成。请查看差异并通过本安装的升级流程处理。');
  const check=status.selfcheck;
  // Historical completion does not expire with heartbeats. Its proof must still
  // describe the target, including all four actual component observations.
  const manifest=status.manifest;
  const proven=manifest&&['build_manifest','verified_release_manifest'].includes(manifest.evidence)&&manifest.manifestHash.length===64&&displaySame(manifest.build,i.targetBuild)&&check?.featureResult==='pass'&&check.jobId!==null&&check.checkedAt!==null&&Date.parse(manifest.checkedAt)<=Date.parse(check.checkedAt)&&check.probes.length===4&&new Set(check.probes.map(p=>p.role)).size===4&&['api','worker','cli','mcp'].every(role=>check.probes.some(p=>p.role===role&&p.health==='healthy'&&p.evidence!=='not_observed'&&p.checkedAt!==null&&displaySame(p.build,i.targetBuild)));
  if(i.result==='succeeded'&&i.stage==='complete'&&i.checkedAt!==null&&i.cleanup==='complete'&&displaySame(i.targetBuild,i.actualBuild)&&proven)return output('INSTALL_COMPLETE','操作完成：目标版本已启动，实际接线自检通过，旧版本清理完成。'+(i.previousInstallation==='none'?'首次安装，无旧版本需要清理。':''),true);
  if(i.targetBuild&&[status.api,status.worker,...(check?.probes??[])].some(c=>c?.build&&!displaySame(c.build,i.targetBuild)))return output('VERSION_MISMATCH','检测到组件版本不一致，操作未完成。请查看差异并通过本安装的升级流程处理。');
  return output('NOT_VERIFIED',`操作未完成。${unverifiedCopy}`);
}
export function presentWorker(worker:DisplayComponent|null,offline:boolean):string {
  if(offline)return '旧快照：API 与 Worker 当前运行状态未确认。';
  if(!worker||worker.evidence==='not_observed')return '尚未观察到 Worker；当前运行状态未确认。请通过本安装的 CLI 检查服务。';
  if(worker.freshness!=='fresh')return 'Worker 观察已过期，当前运行状态未确认。请通过本安装的 CLI 检查服务。';
  if(worker.health==='not_observed')return 'API 可连接，但 Worker 未运行，后台任务暂不能执行。请通过本安装的 CLI 检查服务。';
  if(worker.health==='healthy')return 'Worker 最近观察为健康；观察时间见下方。';
  return 'Worker 报告异常或降级；是否仍在运行尚未确认。请通过本安装的 CLI 检查服务。';
}
export function presentFailure(code:string,stage:string):PublicFeedback {
  const allowed=new Set(['NETWORK_ERROR','PERMISSION_DENIED','RIGHTS_RESTRICTED','SCOPE_DENIED','GENERATION_MISMATCH','JOB_FAILED','CLEANUP_PENDING']);
  return feedback(allowed.has(code)?code:'UNKNOWN_ERROR',stage,'操作失败。请查看脱敏错误代码并通过本安装的诊断步骤处理。');
}
export function presentHumanGate(version:string):PublicFeedback {return feedback('HUMAN_NEEDED','selfcheck',`自动检查已完成；请更新到已发布的 ${betaVersion(version)} 并按测试清单操作，结果等待你的反馈。`,'人工验收尚未完成。','请更新已发布测试版并反馈测试结果。');}
