import { execFileSync,spawn,type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { existsSync,mkdirSync,readFileSync,realpathSync,symlinkSync,writeFileSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { createHarness } from './harness.js';
import { initializeInstallation,readProvisioningReceipt } from '../../platform/src/installation.js';
import { NativeSecretStore } from '../../platform/src/credentials.js';
import { OwnedProcessSupervisor,matchesProcess,observeProcess,ownsListener } from '../../platform/src/processes.js';
import { protectPath } from '../../platform/src/permissions.js';
import type { BuildIdentity } from '../../domain/src/model.js';
import { buildStatusAssets } from '../../../scripts/build/build.mjs';

/** Real isolated compiled processes + fresh synthetic native credentials. Never a persistent default installation. */
export async function createNativeRuntime(variant:'A'|'B'='B') {
  const h=createHarness(),parent=realpathSync(h.root);protectPath(parent);
  const out=join(parent,'compiled'),selection={root:join(parent,'installation'),parent,excludedRoots:[]};
  const secrets=new NativeSecretStore();let initialized=false;let provisioning=false;let installationId:string|undefined;
  let supervisor:OwnedProcessSupervisor|undefined;const children=new Set<ChildProcess>();const temporaryNames=new Set<string>();
  async function cleanup() {
    for(const child of children)if(child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit');child.kill('SIGTERM');await Promise.race([exited,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('HUMAN_ACTION_REQUIRED: owned CLI exit unconfirmed; fixture preserved')),5000);timer.unref();child.once('exit',()=>clearTimeout(timer));})]);}
    if(supervisor){for(const identity of supervisor.registered().reverse()){const state=await supervisor.inspect(identity);if(state==='running')await supervisor.stop(identity);else if(state!=='exited')throw new Error('HUMAN_ACTION_REQUIRED: ownership unresolved; synthetic credentials and root preserved');}if(supervisor.hasPendingLaunch())throw new Error('HUMAN_ACTION_REQUIRED: launch pending; fixture preserved');}
    if(provisioning&&!initialized){readProvisioningReceipt(selection);throw new Error('HUMAN_ACTION_REQUIRED: initialization receipt preserved');}
    if(installationId)for(const name of [...temporaryNames,'api','cli','mcp','installer'])await secrets.delete(installationId,name);
    await h.cleanup();
  }
  try{
    mkdirSync(out,{mode:0o700});execFileSync(process.execPath,[resolve('node_modules/typescript/bin/tsc'),'--outDir',out],{stdio:'pipe'});
    await buildStatusAssets(resolve('apps/status'),join(out,'apps/status'));symlinkSync(resolve('node_modules'),join(out,'node_modules'),'dir');writeFileSync(join(out,'package.json'),'{"type":"module"}');
    const build:BuildIdentity={version:'0.1.0-beta.1',buildId:(variant==='A'?'a':'b').repeat(64),commit:'c'.repeat(40),tree:'d'.repeat(40),dependencyHash:'e'.repeat(64),protocol:1,schemaMin:1,schemaMax:1,capabilities:variant==='A'?['echo']:['echo','digest']};
    const entries={api:join(out,'apps/api/src/main.js'),worker:join(out,'apps/worker/src/main.js'),cli:join(out,'apps/cli/src/main.js'),mcp:join(out,'apps/mcp/src/main.js')};
    for(const entry of Object.values(entries))if(existsSync(entry))writeFileSync(entry,readFileSync(entry,'utf8').replaceAll('__AUTOED_BUILD_IDENTITY__',JSON.stringify(build)));
    if(!existsSync(entries.cli))throw new Error('CLI_ENTRY_MISSING');
    mkdirSync(join(out,'build'));writeFileSync(join(out,'build/identity.json'),JSON.stringify({...build,entries:['api','worker','cli','mcp']}));
    provisioning=true;const metadata=await initializeInstallation(selection,secrets);installationId=metadata.installationId;initialized=true;
    const options={selection,managedNode:realpathSync(process.execPath),entries:{api:entries.api,worker:entries.worker}};supervisor=new OwnedProcessSupervisor(options);
    const activeSupervisor=supervisor;
    async function runCli(args:string[],input='') {
      const env:NodeJS.ProcessEnv={};for(const name of ['HOME','TMPDIR','TEMP','TMP','SystemRoot','WINDIR','LOCALAPPDATA','USERPROFILE'])if(process.env[name])env[name]=process.env[name];
      const child=spawn(process.execPath,[entries.cli,'--root',selection.root,'--parent',selection.parent,...args],{cwd:out,env,stdio:['pipe','pipe','pipe'],shell:false});children.add(child);
      let stdout='',stderr='';child.stdout.on('data',chunk=>{stdout+=chunk;if(stdout.length>131072)child.kill('SIGTERM');});child.stderr.on('data',chunk=>{stderr+=chunk;if(stderr.length>8192)child.kill('SIGTERM');});child.stdin.end(input);
      const timer=setTimeout(()=>child.kill('SIGTERM'),15000);timer.unref();try{const [code]=await once(child,'exit');return {code,stdout,stderr};}finally{clearTimeout(timer);if(child.exitCode!==null||child.signalCode!==null)children.delete(child);}
    }
    async function request(path:string,body?:unknown,name='installer') {
      const identity=activeSupervisor.registered().find(i=>i.role==='api');if(!identity||!matchesProcess(identity,await observeProcess(identity.pid))||!ownsListener(identity.pid,metadata.port))throw new Error('TEST_ENDPOINT_UNCONFIRMED');
      const token=await secrets.get(metadata.installationId,name);
      return h.fetch(`http://127.0.0.1:${metadata.port}${path}`,{method:body===undefined?'GET':'POST',headers:{authorization:`Bearer ${token}`,...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    }
    return {h,parent,out,selection,secrets,metadata,build,entries,options,supervisor:activeSupervisor,runCli,request,temporaryNames,cleanup};
  }catch(error){await cleanup();throw error;}
}
