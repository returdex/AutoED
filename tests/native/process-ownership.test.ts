import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { observeProcess, matchesProcess, ownsListener } from '../../packages/platform/src/processes.js';
import { createServer } from 'node:net';
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
it('native listener ownership accepts exact PID and rejects wrong PID/closed port',async()=>{
  const server=createServer();await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
  const address=server.address();if(!address||typeof address==='string')throw new Error('TEST_BIND');
  try {expect(ownsListener(process.pid,address.port)).toBe(true);expect(ownsListener(1,address.port)).toBe(false);}
  finally {await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));}
  expect(ownsListener(process.pid,address.port)).toBe(false);
});
