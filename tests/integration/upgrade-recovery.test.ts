import {expect,it} from 'vitest';
import {recoverUpgrade,RecoveryError} from '../../packages/installer/src/recovery.js';
import {createRecoveryFixture} from '../../packages/test-support/src/upgrade-fixture.js';

it('restores a verified old snapshot only before any new-generation business write and probes the old build twice',async()=>{
  const f=await createRecoveryFixture();try{const failed=await f.failUpgrade('feature_verified','intent');const result=await recoverUpgrade(f.selection,failed.operationId,{verify:f.verify,secrets:f.secrets});expect(result).toMatchObject({code:'UPGRADE_FAILED_ROLLED_BACK',actualBuild:f.old.build,generation:2,automaticRetry:false});expect(await f.status()).toMatchObject({install:{result:'restored',actualBuild:{buildId:f.old.build.buildId}},selfcheck:{featureResult:'pass'}});expect(f.archiveCanary()).toBe('retained');expect(f.profileCanary()).toBe('retained');}finally{await f.cleanup();}
},180000);

it('stops for human recovery when writes, schema, snapshot, signature, host or process ownership are not proved',async()=>{
  for(const fault of ['new_write','schema','snapshot_hash','old_signature','old_host','pid_reuse'] as const){const f=await createRecoveryFixture();try{const failed=await f.failUpgrade('feature_verified','intent');await f.applyRecoveryFault(fault);await expect(recoverUpgrade(f.selection,failed.operationId,{verify:f.verify,secrets:f.secrets})).rejects.toMatchObject<Partial<RecoveryError>>({code:'HUMAN_RECOVERY_REQUIRED'});expect(f.currentDatabaseHash()).toBe(f.failedDatabaseHash());expect(f.archiveCanary()).toBe('retained');expect(f.profileCanary()).toBe('retained');}finally{await f.cleanupPreservingUnknown();}}
},240000);

it('reports first-install failure without inventing a rollback or deleting data and credentials',async()=>{
  const f=await createRecoveryFixture({previous:false});try{const failed=await f.failUpgrade('download_verified','intent');const result=await recoverUpgrade(f.selection,failed.operationId,{verify:f.verify,secrets:f.secrets});expect(result).toMatchObject({code:'INSTALL_FAILED_NO_PREVIOUS',automaticRetry:false});expect(await f.longTermCredentialCount()).toBe(4);expect(f.dataCanary()).toBe('retained');}finally{await f.cleanup();}
});
