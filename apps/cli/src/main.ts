import {fileURLToPath} from 'node:url';
import {realpathSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {createInterface} from 'node:readline/promises';
import {z} from 'zod';
import {HttpClient,clientError} from '../../../packages/client/src/http.js';
import {readInstallation} from '../../../packages/platform/src/installation.js';
import {Lifecycle} from './lifecycle.js';
import {presentInstall} from '../../../packages/contracts/src/presentation.js';

export const CLI_BUILD_IDENTITY=typeof __AUTOED_BUILD_IDENTITY__==='undefined'?null:__AUTOED_BUILD_IDENTITY__;
async function main(){
  if(!CLI_BUILD_IDENTITY)throw new Error('COMPILED_BUILD_REQUIRED');
  const args=process.argv.slice(2);if(args.shift()!=='--root')throw new Error('INVALID_REQUEST');const root=args.shift();if(args.shift()!=='--parent')throw new Error('INVALID_REQUEST');const parent=args.shift();if(!root||!parent)throw new Error('INVALID_REQUEST');
  let credentialId:string|undefined;if(args[0]==='--credential-id'){args.shift();credentialId=args.shift();if(!credentialId||!/^selfcheck-[0-9a-f-]{36}$/.test(credentialId))throw new Error('AUTH_REQUIRED');}
  const command=args.shift();const selection={root,parent,excludedRoots:[]};
  const client=new HttpClient(root,parent,'cli',CLI_BUILD_IDENTITY,credentialId);
  if(command==='start'||command==='stop'){
    if(args.length||credentialId)throw new Error('INVALID_REQUEST');const metadata=readInstallation(selection);
    const lifecycle=new Lifecycle({selection,managedNode:realpathSync(process.execPath),entries:{api:fileURLToPath(new URL('../../api/src/main.js',import.meta.url)),worker:fileURLToPath(new URL('../../worker/src/main.js',import.meta.url))}});
    if(command==='start'){await lifecycle.start(metadata.installationId,CLI_BUILD_IDENTITY);return {api:'running',worker:'running'};}
    if(lifecycle.supervisor.hasPendingLaunch())throw new Error('PROCESS_STOP_UNCONFIRMED');
    const identities=lifecycle.supervisor.registered();for(const role of ['worker','api']){const identity=identities.find(i=>i.role===role);if(identity)await lifecycle.supervisor.stop(identity);}
    if(lifecycle.supervisor.hasPendingLaunch())throw new Error('PROCESS_STOP_UNCONFIRMED');return {api:'stopped',worker:'stopped'};
  }
  if(command==='status'&&!args.length){const status=await client.status();return {component:{role:'cli',build:CLI_BUILD_IDENTITY,checkedAt:new Date().toISOString(),health:'healthy',evidence:'authenticated_probe'},status,feedback:presentInstall(status)};}
  if(command==='selftest'&&args.length===4&&args[0]==='--kind'&&args[2]==='--value')return client.selftest(args[1],args[3]);
  if(command==='jobs'&&args.length===2){const action=args[0],id=z.uuid().parse(args[1]);if(action==='get')return client.job(id);if(action==='cancel'&&!credentialId)return client.cancel(id);}
  if(command==='pair'&&args.length===2&&args[0]==='approve'&&!credentialId){const code=z.string().regex(/^[A-F0-9]{16}$/).parse(args[1]);
    const lines=createInterface({input:process.stdin,output:process.stderr});let answer;try{answer=await lines.question(`请核对页面关联码 ${code}。仅输入相同关联码确认本页面的只读访问；其他输入取消：\n`);}finally{lines.close();}
    if(answer.trim()!==code)throw new Error('PAIRING_DENIED');return client.call(`/api/pairing/${code}/approve`,{confirmedCode:code});
  }
  if(command==='open-status'&&!args.length&&!credentialId){const endpoint=await client.identity();await endpoint.guard();const url=`http://127.0.0.1:${endpoint.port}/status`;
    await new Promise<void>((resolve,reject)=>{if(process.platform==='darwin')execFile('/usr/bin/open',[url],{timeout:5000},error=>error?reject(new Error('OPEN_STATUS_FAILED')):resolve());else if(process.platform==='win32')execFile('rundll32.exe',['url.dll,FileProtocolHandler',url],{timeout:5000,windowsHide:true},error=>error?reject(new Error('OPEN_STATUS_FAILED')):resolve());else reject(new Error('OPEN_STATUS_FAILED'));});return {opened:true};
  }
  throw new Error('INVALID_REQUEST');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])void main().then(value=>{process.stdout.write(JSON.stringify(value)+'\n');}).catch(error=>{process.stdout.write(JSON.stringify({...clientError(error),component:{role:'cli',build:CLI_BUILD_IDENTITY,health:'not_observed',checkedAt:new Date().toISOString(),evidence:'process_report'}})+'\n');process.exitCode=1;});
