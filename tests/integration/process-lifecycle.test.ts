import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, symlinkSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { OwnedProcessSupervisor, observeProcess } from '../../packages/platform/src/processes.js';
import { initializeInstallation, readProvisioningReceipt } from '../../packages/platform/src/installation.js';
import { NativeSecretStore } from '../../packages/platform/src/credentials.js';
import { createHarness } from '../../packages/test-support/src/harness.js';
import { protectPath } from '../../packages/platform/src/permissions.js';
import type { BuildIdentity } from '../../packages/domain/src/model.js';
import { publishSyntheticActive } from '../../packages/test-support/src/runtime-installation.js';

it('launcher exits; actual API and Worker stay independent; reuse and authenticated owned stop reject altered identities',async()=>{
  const h=createHarness(); const parent=realpathSync(h.root);protectPath(parent);
  const selection={root:join(parent,'installation'),parent,excludedRoots:[]}; const secrets=new NativeSecretStore();
  let installationId:string|undefined;let supervisor:OwnedProcessSupervisor|undefined;
  let provisioningComplete=false;
  let stage='initialization';let originalCode='NONE';
  const owned:Awaited<ReturnType<OwnedProcessSupervisor['start']>>[]=[];
  try {
    const metadata=await initializeInstallation(selection,secrets);installationId=metadata.installationId;provisioningComplete=true;
    const out=join(parent,'compiled');mkdirSync(out,{mode:0o700});
    execFileSync(process.execPath,[resolve('node_modules/typescript/bin/tsc'),'--outDir',out],{stdio:'pipe'});
    const {buildStatusAssets}=await import('../../scripts/build/build.mjs');
    await buildStatusAssets(resolve('apps/status'),join(out,'apps/status'));
    symlinkSync(resolve('node_modules'),join(out,'node_modules'),'dir');
    writeFileSync(join(out,'package.json'),'{"type":"module"}',{mode:0o600});
    const build:BuildIdentity={version:'0.1.0',buildId:'e'.repeat(64),commit:'b'.repeat(40),tree:'c'.repeat(40),dependencyHash:'d'.repeat(64),protocol:1,schemaMin:1,schemaMax:1,capabilities:['echo','digest']};
    const entries={api:join(out,'apps/api/src/main.js'),worker:join(out,'apps/worker/src/main.js')};
    for(const entry of Object.values(entries))writeFileSync(entry,readFileSync(entry,'utf8').replaceAll('__AUTOED_BUILD_IDENTITY__',JSON.stringify(build)));
    publishSyntheticActive(selection,metadata,build,{cli:entries.api,mcp:entries.worker});
    const options={selection,managedNode:realpathSync(process.execPath),entries};
    supervisor=new OwnedProcessSupervisor(options);
    const module=pathToFileURL(join(out,'packages/platform/src/processes.js')).href;
    const launcher=h.spawn(['--input-type=module','-e',`const {OwnedProcessSupervisor}=await import(${JSON.stringify(module)});const s=new OwnedProcessSupervisor(${JSON.stringify(options)});for(const role of ['api','worker'])await s.start({installationId:${JSON.stringify(installationId)},role,build:${JSON.stringify(build)}});`]);
    expect((await once(launcher,'exit'))[0]).toBe(0);
    for(const role of ['api','worker'] as const)owned.push(await supervisor.start({installationId,role,build}));
    expect(await Promise.all(owned.map(i=>supervisor!.inspect(i)))).toEqual(['running','running']);
    const recordPath=join(selection.root,'runtime/api.json');const original=readFileSync(recordPath,'utf8');
    let intercepted=0;const unknown=createServer((_request,response)=>{intercepted++;response.end('{}');});
    await new Promise<void>(r=>unknown.listen(0,'127.0.0.1',r));const address=unknown.address();
    if(!address||typeof address==='string')throw new Error('TEST_BIND');
    try{
      writeFileSync(recordPath,JSON.stringify({...JSON.parse(original),controlPort:address.port}));
      expect(await supervisor.inspect(owned[0]!)).toBe('unknown');expect(intercepted).toBe(0);
    }finally{writeFileSync(recordPath,original);await new Promise<void>((r,j)=>unknown.close(e=>e?j(e):r()));}
    for(const changed of [{nonce:randomUUID()},{pid:process.pid},{osStartIdentity:'stale'},{executable:'/unknown/program'}]) {
      await expect(supervisor.stop({...owned[0]!,...changed})).rejects.toThrow('PROCESS_OWNERSHIP_UNCONFIRMED');
    }
    const token=await secrets.get(installationId,'cli');
    const model=await secrets.get(installationId,'mcp');
    const origin=`http://127.0.0.1:${metadata.port}`;
    const denied=await fetch(origin+'/api/process/inspect',{method:'POST',headers:{authorization:`Bearer ${model}`,'content-type':'application/json'},body:JSON.stringify({challenge:randomUUID()})});
    expect(denied.status).toBe(403);expect(await denied.json()).toMatchObject({code:'FORBIDDEN'});
    const request=await fetch(origin+'/api/jobs',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({kind:'digest',value:'abc',idempotencyKey:randomUUID(),scope:metadata.approvedScope})});
    expect(request.status).toBe(200);const job=await request.json() as {id:string};
    let result:unknown;for(let attempt=0;attempt<4;attempt++){
      await new Promise(r=>setTimeout(r,750));
      const completed=await fetch(`${origin}/api/jobs/${job.id}`,{headers:{authorization:`Bearer ${token}`}});result=await completed.json();
      if((result as {state?:string}).state==='succeeded')break;
    }
    expect(result).toMatchObject({state:'succeeded',result:'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'});
    await supervisor.stop(owned[1]!);
    expect(await supervisor.inspect(owned[0]!)).toBe('running');expect(await supervisor.inspect(owned[1]!)).toBe('exited');
    const status=await fetch(origin+'/api/status',{headers:{authorization:`Bearer ${token}`}});
    expect(await status.json()).toMatchObject({api:{health:'healthy'},worker:{health:'not_observed'}});
    const worker=await supervisor.start({installationId,role:'worker',build});owned.push(worker);
    await supervisor.stop(owned[0]!);expect(await supervisor.inspect(worker)).toBe('running');
    await supervisor.stop(worker);
    stage='generation-fencing';
    const staleApi=await supervisor.start({installationId,role:'api',build});
    const installer=await secrets.get(installationId,'installer');const operationId=randomUUID();
    for(const action of ['enter','exclusive','exit']){
      const changed=await fetch(origin+'/api/control/maintenance',{method:'POST',headers:{authorization:`Bearer ${installer}`,'content-type':'application/json'},body:JSON.stringify({action,operationId,expectedGeneration:0,...(action==='enter'?{leaseUntil:Date.now()+30000}:{})})});
      expect(changed.status).toBe(200);
    }
    const fenced=await fetch(origin+'/api/jobs',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({kind:'echo',value:'late API',idempotencyKey:randomUUID(),scope:metadata.approvedScope})});
    expect(fenced.status).toBe(409);expect(await fenced.json()).toMatchObject({code:'GENERATION_MISMATCH'});
    await supervisor.stop(staleApi);
    // An owned test entry intentionally never publishes, then exits itself. No PID kill.
    stage='unconfirmed-launch';const release=join(out,'release-test-child');
    const slow=join(out,'no-publish.js');writeFileSync(slow,`import{existsSync}from'node:fs';const timer=setInterval(()=>{if(existsSync(${JSON.stringify(release)})){clearInterval(timer);clearTimeout(bound);}},100);const bound=setTimeout(()=>clearInterval(timer),20000);`,{mode:0o600});
    const uncertain=new OwnedProcessSupervisor({...options,entries:{...entries,worker:slow}});
    try{
      await expect(uncertain.start({installationId,role:'worker',build})).rejects.toThrow('SERVICE_START_UNCONFIRMED');
      const intent=JSON.parse(readFileSync(join(selection.root,'runtime/worker.launch/intent.json'),'utf8'));
      stage='launch-receipt';expect(intent).toMatchObject({installationId,role:'worker',pid:expect.any(Number)});
      if(intent.os)expect(intent.os).toMatchObject({osStartIdentity:expect.any(String),executable:realpathSync(process.execPath)});
      expect(await observeProcess(intent.pid)).not.toBeNull();
      stage='duplicate-launch';await expect(uncertain.start({installationId,role:'worker',build})).rejects.toThrow('PROCESS_START_IN_PROGRESS');
      stage='live-exit-refusal';await expect(uncertain.confirmFailedLaunchExit('worker')).rejects.toThrow('PROCESS_EXIT_UNCONFIRMED');
    }finally{writeFileSync(release,'release',{mode:0o600});}
    stage='failed-launch-recovery';
    const intent=JSON.parse(readFileSync(join(selection.root,'runtime/worker.launch/intent.json'),'utf8'));
    const deadline=Date.now()+4000;while(await observeProcess(intent.pid)){if(Date.now()>deadline)throw new Error('TEST_CHILD_EXIT_UNCONFIRMED');await new Promise(r=>setTimeout(r,250));}
    await uncertain.confirmFailedLaunchExit('worker');expect(uncertain.hasPendingLaunch()).toBe(false);
  } catch(error){originalCode=error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'ASSERTION_FAILED';throw error;} finally {
    // Only authenticated, fully identified processes may be stopped; never broad PID cleanup.
    if(supervisor){
      for(const identity of supervisor.registered()){
        const state=await supervisor.inspect(identity);
        if(state==='running')await supervisor.stop(identity);
        else if(state!=='exited')throw new Error('HUMAN_ACTION_REQUIRED: synthetic process ownership unresolved; credentials and root preserved');
      }
      if(supervisor.hasPendingLaunch())throw new Error(`HUMAN_ACTION_REQUIRED: synthetic launch pending; stage=${stage}; original=${originalCode}; credentials and root preserved`);
    }
    if(!provisioningComplete){
      try{readProvisioningReceipt(selection);}catch{throw new Error('HUMAN_ACTION_REQUIRED: initialization interrupted; root preserved');}
      throw new Error('HUMAN_ACTION_REQUIRED: exact provisioning receipt preserved for OS credential recovery');
    }
    if(installationId)for(const name of ['api','cli','mcp','installer'])await secrets.delete(installationId,name);
    await h.cleanup();
  }
},30000);
