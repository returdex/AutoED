import { expect,it } from 'vitest';
import { presentInstall,presentWorker,presentFailure,presentHumanGate } from '../../packages/contracts/src/presentation.js';
import type { BuildIdentity, Status } from '../../packages/domain/src/model.js';
const build:BuildIdentity={version:'0.1.0-beta.1',buildId:'a'.repeat(64),commit:'b'.repeat(40),tree:'c'.repeat(40),dependencyHash:'d'.repeat(64),protocol:1,schemaMin:1,schemaMax:1,capabilities:['echo']};
function complete():Status {const checkedAt='2026-08-27T00:00:00.000Z';const probes=(['api','worker','cli','mcp'] as const).map(role=>({role,build,health:'healthy' as const,evidence:'authenticated_probe' as const,checkedAt,freshness:'stale' as const}));return {manifest:{build,manifestHash:'e'.repeat(64),checkedAt,evidence:'build_manifest'},api:probes[0]!,worker:probes[1]!,selfcheck:{jobId:'00000000-0000-4000-8000-000000000001',featureResult:'pass',checkedAt,probes,freshness:'stale'},install:{operationId:'00000000-0000-4000-8000-000000000002',stage:'complete',result:'succeeded',cleanup:'complete',targetBuild:build,actualBuild:build,checkedAt},checkedAt};}
it('complete needs matching target, historical feature proof and cleanup, not current heartbeat freshness',()=>{
  expect(presentInstall(complete()).complete).toBe(true);
  for(const change of ['cleanup','proof','target'] as const){const s=complete();if(change==='cleanup')s.install!.cleanup='cleanup_pending';if(change==='proof')s.selfcheck!.featureResult='fail';if(change==='target')s.install!.actualBuild={...build,buildId:'z'.repeat(64)};expect(presentInstall(s).complete).toBe(false);}
});
it('rollback, no-old failure, unsafe recovery and cleanup remain distinct',()=>{
  const s=complete();s.install!.result='restored';s.install!.stage='rollback';expect(presentInstall(s).message).toContain('升级失败，已恢复旧版');
  s.install!.result='failed';s.install!.actualBuild=null;expect(presentInstall(s).message).not.toContain('当前没有可恢复的旧版');
  const explicit={...s,install:{...s.install!,previousInstallation:'none' as const}};expect(presentInstall(explicit).message).toContain('当前没有可恢复的旧版');
  s.install!.result='human_needed';expect(presentInstall(s).message).toContain('尚不能确认安全恢复方式');
  s.install!.result='running';s.install!.cleanup='cleanup_pending';expect(presentInstall(s).message).toContain('操作未完成');
});
it('unknown and stale worker are not described as stopped and offline never claims API reachable',()=>{
  expect(presentWorker(null,false)).toContain('尚未观察');
  expect(presentWorker(complete().worker,false)).toContain('当前运行状态未确认');
  expect(presentWorker({...complete().worker!,health:'not_observed',freshness:'fresh'},false)).toContain('Worker 未运行');
  expect(presentWorker(complete().worker,true)).not.toContain('API 可连接');
});
it('unsafe error payload is reduced to bounded structured public fields',()=>{
  const view=presentFailure('/Users/private/token=credential','Error at /private/runtime');
  expect(Object.keys(view).sort()).toEqual(['code','impact','message','nextAction','stage']);
  expect(JSON.stringify(view)).not.toMatch(/Users|credential|private|Error at/);
});
it('human feedback is pending and uses only a validated beta version',()=>{
  expect(presentHumanGate('0.1.0-beta.1').message).toContain('结果等待你的反馈');
  expect(presentHumanGate('/private/secret').message).not.toContain('/private');
});

it('missing or mismatched manifest cannot complete five identities',()=>{const s=complete();s.manifest=null;expect(presentInstall(s).complete).toBe(false);s.manifest={...complete().manifest!,build:{...build,buildId:'f'.repeat(64)}};expect(presentInstall(s).complete).toBe(false);});
