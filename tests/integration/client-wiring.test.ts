import {expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readFileSync,writeFileSync} from 'node:fs';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {createNativeRuntime} from '../../packages/test-support/src/native-runtime.js';
import {OwnedProcessSupervisor} from '../../packages/platform/src/processes.js';

async function exclusive(f:Awaited<ReturnType<typeof createNativeRuntime>>,workerBuild=f.build){
  await f.supervisor.start({installationId:f.metadata.installationId,role:'api',build:f.build});const operationId=randomUUID();f.temporaryNames.add('selfcheck-'+operationId);
  for(const action of ['enter','exclusive'])expect((await f.request('/api/control/maintenance',{action,operationId,expectedGeneration:0,...(action==='enter'?{leaseUntil:Date.now()+120000}:{})})).status).toBe(200);
  const worker=new OwnedProcessSupervisor({...f.options,workerContext:{expectedGeneration:0,selfcheck:{operationId,generation:0}}});await worker.start({installationId:f.metadata.installationId,role:'worker',build:workerBuild});return operationId;
}
for(const variant of ['A','B'] as const)it(`actual ${variant} CLI + SDK stdio MCP → authenticated API → SQLite Worker; short credential revoked`,async()=>{
  const f=await createNativeRuntime(variant);try{
    const operationId=await exclusive(f);const {runSelfcheck}=await import(pathToFileURL(join(f.out,'scripts/install/selfcheck.mjs')).href);
    const result=await runSelfcheck({selection:f.selection,managedNode:process.execPath,cliEntry:f.entries.cli,mcpEntry:f.entries.mcp,manifestPath:join(f.out,'build/identity.json'),operationId,generation:0});
    expect(result).toMatchObject({matched:true,featureResult:'pass'});expect(result.probes.map((p:{role:string})=>p.role).sort()).toEqual(['api','cli','mcp','worker']);
    expect(result.features.digest).toMatchObject(variant==='B'?{state:'succeeded',result:'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'}:{state:'failed',errorCode:'UNSUPPORTED_CAPABILITY'});
    expect(await f.secrets.get(f.metadata.installationId,'selfcheck-'+operationId)===null).toBe(true);
    const status=await (await f.request('/api/status')).json();expect(status).toMatchObject({installationId:f.metadata.installationId,manifest:{build:f.build,evidence:'build_manifest'},selfcheck:{jobId:result.jobId,featureResult:'pass'}});
  }finally{await f.cleanup();}
},60000);

for(const stale of ['cli','mcp','worker','manifest'] as const)it(`selfcheck records actual mismatched ${stale}, even with the same version string`,async()=>{
  const f=await createNativeRuntime('B');try{
    const old={...f.build,buildId:'a'.repeat(64),capabilities:['echo']};let cliEntry=f.entries.cli,mcpEntry=f.entries.mcp;
    if(stale==='worker')writeFileSync(f.entries.worker,readFileSync(f.entries.worker,'utf8').replaceAll(JSON.stringify(f.build),JSON.stringify(old)));
    if(stale==='cli'||stale==='mcp'){const oldEntry=join(f.out,`apps/${stale}/src/old-main.js`);writeFileSync(oldEntry,readFileSync(f.entries[stale],'utf8').replaceAll(JSON.stringify(f.build),JSON.stringify(old)));if(stale==='cli')cliEntry=oldEntry;else mcpEntry=oldEntry;}
    if(stale==='manifest')writeFileSync(join(f.out,'build/identity.json'),JSON.stringify({...old,entries:['api','worker','cli','mcp']}));
    const operationId=await exclusive(f,stale==='worker'?old:f.build);const {runSelfcheck}=await import(pathToFileURL(join(f.out,'scripts/install/selfcheck.mjs')).href);
    const result=await runSelfcheck({selection:f.selection,managedNode:process.execPath,cliEntry,mcpEntry,manifestPath:join(f.out,'build/identity.json'),operationId,generation:0});
    expect(result.matched).toBe(false);expect(result.featureResult).toBe('fail');const status=await (await f.request('/api/status')).json();expect(status.selfcheck.featureResult).toBe('fail');
    expect(stale==='manifest'?status.manifest.build.buildId:status.selfcheck.probes.find((p:{role:string})=>p.role===stale).build.buildId).toBe(old.buildId);
  }finally{await f.cleanup();}
},60000);

it('official stdio exposes only three strict tools, denies browser instructions and reports stopped API without autostart',async()=>{
  const f=await createNativeRuntime();let client:Client|undefined;try{
    expect((await f.runCli(['start'])).code).toBe(0);client=new Client({name:'synthetic-contract-client',version:'0.1.0'});
    const transport=new StdioClientTransport({command:process.execPath,args:[f.entries.mcp,'--root',f.selection.root,'--parent',f.selection.parent],cwd:f.out,stderr:'pipe',maxBufferSize:131072});
    transport.stderr?.on('data',()=>{});await client.connect(transport);
    expect((await client.listTools()).tools.map(t=>t.name).sort()).toEqual(['autoed_job_get','autoed_selftest','autoed_status']);
    for(const field of ['url','js','selector','path','root']){let denied=false;try{const result=await client.callTool({name:'autoed_status',arguments:{[field]:'untrusted'}});denied=result.isError===true;}catch{denied=true;}expect(denied).toBe(true);}
    const status=await client.callTool({name:'autoed_status',arguments:{}});expect(status.structuredContent).toMatchObject({component:{role:'mcp',build:f.build},status:{installationId:f.metadata.installationId}});
    await f.supervisor.stop(f.supervisor.registered().find(p=>p.role==='api')!);
    const stopped=await client.callTool({name:'autoed_status',arguments:{}});expect(stopped.isError).toBe(true);expect(stopped.structuredContent).toMatchObject({code:'BACKEND_UNAVAILABLE'});
  }finally{await client?.close();await f.cleanup();}
},60000);

it('early actual CLI failure replaces old selfcheck evidence with failure and revokes the exact temporary credential',async()=>{
  const f=await createNativeRuntime();try{
    const operationId=await exclusive(f);const broken=join(f.out,'apps/cli/src/broken.js');writeFileSync(broken,'process.exitCode=7;');
    const {runSelfcheck}=await import(pathToFileURL(join(f.out,'scripts/install/selfcheck.mjs')).href);
    const result=await runSelfcheck({selection:f.selection,managedNode:process.execPath,cliEntry:broken,mcpEntry:f.entries.mcp,manifestPath:join(f.out,'build/identity.json'),operationId,generation:0});
    expect(result).toMatchObject({matched:false,featureResult:'fail',code:'CLI_PROBE_FAILED',projectionWritten:true,probes:[]});
    expect((await (await f.request('/api/status')).json()).selfcheck).toMatchObject({featureResult:'fail',jobId:null,probes:[]});expect(await f.secrets.get(f.metadata.installationId,'selfcheck-'+operationId)===null).toBe(true);
  }finally{await f.cleanup();}
},60000);
