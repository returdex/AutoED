import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, symlinkSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { once } from 'node:events';
import { OwnedProcessSupervisor } from '../../packages/platform/src/processes.js';
import { initializeInstallation } from '../../packages/platform/src/installation.js';
import { NativeSecretStore } from '../../packages/platform/src/credentials.js';
import { createHarness } from '../../packages/test-support/src/harness.js';
import { protectPath } from '../../packages/platform/src/permissions.js';
import type { BuildIdentity } from '../../packages/domain/src/model.js';

it('launcher exits; actual API and Worker stay independent; reuse and authenticated owned stop reject altered identities',async()=>{
  const h=createHarness(); const parent=realpathSync(h.root);protectPath(parent);
  const selection={root:join(parent,'installation'),parent,excludedRoots:[]}; const secrets=new NativeSecretStore();
  let installationId:string|undefined;let supervisor:OwnedProcessSupervisor|undefined;
  const owned:Awaited<ReturnType<OwnedProcessSupervisor['start']>>[]=[];
  try {
    const metadata=await initializeInstallation(selection,secrets);installationId=metadata.installationId;
    const out=join(parent,'compiled');mkdirSync(out,{mode:0o700});
    execFileSync(process.execPath,[resolve('node_modules/typescript/bin/tsc'),'--outDir',out],{stdio:'pipe'});
    symlinkSync(resolve('node_modules'),join(out,'node_modules'),'dir');
    writeFileSync(join(out,'package.json'),'{"type":"module"}',{mode:0o600});
    const build:BuildIdentity={version:'0.1.0',buildId:'e'.repeat(64),commit:'b'.repeat(40),tree:'c'.repeat(40),dependencyHash:'d'.repeat(64),protocol:1,schemaMin:1,schemaMax:1,capabilities:['echo','digest']};
    const entries={api:join(out,'apps/api/src/main.js'),worker:join(out,'apps/worker/src/main.js')};
    for(const entry of Object.values(entries))writeFileSync(entry,readFileSync(entry,'utf8').replaceAll('__AUTOED_BUILD_IDENTITY__',JSON.stringify(build)));
    const options={selection,managedNode:realpathSync(process.execPath),entries};
    const module=pathToFileURL(join(out,'packages/platform/src/processes.js')).href;
    const launcher=h.spawn(['--input-type=module','-e',`const {OwnedProcessSupervisor}=await import(${JSON.stringify(module)});const s=new OwnedProcessSupervisor(${JSON.stringify(options)});for(const role of ['api','worker'])await s.start({installationId:${JSON.stringify(installationId)},role,build:${JSON.stringify(build)}});`]);
    expect((await once(launcher,'exit'))[0]).toBe(0);
    supervisor=new OwnedProcessSupervisor(options);
    for(const role of ['api','worker'] as const)owned.push(await supervisor.start({installationId,role,build}));
    expect(await Promise.all(owned.map(i=>supervisor!.inspect(i)))).toEqual(['running','running']);
    for(const changed of [{nonce:randomUUID()},{pid:process.pid},{osStartIdentity:'stale'},{executable:'/unknown/program'}]) {
      await expect(supervisor.stop({...owned[0]!,...changed})).rejects.toThrow('PROCESS_OWNERSHIP_UNCONFIRMED');
    }
    const token=await secrets.get(installationId,'cli');
    const request=await fetch('http://127.0.0.1:43187/api/jobs',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({kind:'digest',value:'abc',idempotencyKey:randomUUID(),scope:metadata.approvedScope})});
    expect(request.status).toBe(200);const job=await request.json() as {id:string};
    await new Promise(r=>setTimeout(r,600));
    const completed=await fetch(`http://127.0.0.1:43187/api/jobs/${job.id}`,{headers:{authorization:`Bearer ${token}`}});
    expect(await completed.json()).toMatchObject({state:'succeeded',result:'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'});
    await supervisor.stop(owned[1]!);
    expect(await supervisor.inspect(owned[0]!)).toBe('running');expect(await supervisor.inspect(owned[1]!)).toBe('exited');
    const status=await fetch('http://127.0.0.1:43187/api/status',{headers:{authorization:`Bearer ${token}`}});
    expect(await status.json()).toMatchObject({api:{health:'healthy'},worker:{health:'not_observed'}});
    const worker=await supervisor.start({installationId,role:'worker',build});owned.push(worker);
    await supervisor.stop(owned[0]!);expect(await supervisor.inspect(worker)).toBe('running');
    await supervisor.stop(worker);
  } finally {
    // Only authenticated, fully identified processes may be stopped; never broad PID cleanup.
    if(supervisor)for(const identity of owned.reverse())if(await supervisor.inspect(identity)==='running')await supervisor.stop(identity);
    if(installationId)for(const name of ['api','cli','mcp','installer'])await secrets.delete(installationId,name);
    await h.cleanup();
  }
},30000);
