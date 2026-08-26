import {expect,it} from 'vitest';
import {cleanupManaged} from '../../packages/installer/src/cleanup.js';
import {createRecoveryFixture} from '../../packages/test-support/src/upgrade-fixture.js';

it('completes only after old owned entries are inactive and preserves archives and unknown files',async()=>{
  const f=await createRecoveryFixture();try{const failed=await f.failUpgrade('cleaned','intent'),context=await f.cleanupContext(failed.operationId);const result=await cleanupManaged(context);expect(result).toEqual({complete:true,code:'CLEANUP_COMPLETE'});expect(f.archiveCanary()).toBe('retained');expect(f.unrelatedCanary()).toBe('retained');expect(f.oldActiveEntryExists()).toBe(false);}finally{await f.cleanup();}
});

it('returns cleanup_pending for old live/unknown hosts, reused PIDs, unknown startup refs, mixed pins or denied removal',async()=>{
  for(const fault of ['old_host','pid_reuse','startup_ref','mixed_pins','access_denied'] as const){const f=await createRecoveryFixture();try{const failed=await f.failUpgrade('cleaned','intent'),context=await f.cleanupContext(failed.operationId);await f.applyCleanupFault(fault);expect(await cleanupManaged(context)).toMatchObject({complete:false,code:'CLEANUP_PENDING'});expect(f.archiveCanary()).toBe('retained');expect(f.unrelatedCanary()).toBe('retained');}finally{await f.cleanupPreservingUnknown();}}
},240000);
