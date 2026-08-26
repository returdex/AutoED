import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { observeProcess, matchesProcess } from '../../packages/platform/src/processes.js';
import { createHarness, assertNativePlatform } from '../../packages/test-support/src/harness.js';

it('native creation identity and canonical executable distinguish current, stale and unrelated PIDs',async()=>{
  assertNativePlatform(process.platform as 'darwin'|'win32'); const h=createHarness();
  try {
    const child=h.spawn(['-e','setInterval(()=>{},1000)']);
    const os=await observeProcess(child.pid!); expect(os).not.toBeNull();
    expect(os!.executable).toBe(realpathSync(process.execPath));
    const identity={installationId:randomUUID(),role:'worker' as const,buildId:'a'.repeat(64),pid:child.pid!,nonce:randomUUID(),osStartIdentity:os!.osStartIdentity,executable:os!.executable};
    expect(matchesProcess(identity,os)).toBe(true);
    expect(matchesProcess({...identity,osStartIdentity:'old PID creation'},os)).toBe(false);
    expect(matchesProcess({...identity,executable:'/unknown/program'},os)).toBe(false);
    expect(matchesProcess({...identity,executable:undefined},os)).toBe(false);
    await h.stop(child);expect(await observeProcess(child.pid!)).toBeNull();
  } finally {await h.cleanup();}
});
