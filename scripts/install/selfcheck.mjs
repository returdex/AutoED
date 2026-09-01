import {readFileSync,lstatSync,realpathSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {dirname,isAbsolute} from 'node:path';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {z} from 'zod';
import {BuildIdentitySchema,ComponentObservationSchema} from '../../packages/contracts/src/index.js';
import {assessIdentity} from '../../packages/application/src/identity.js';
import {HttpClient,clientError} from '../../packages/client/src/http.js';
import {readInstallation} from '../../packages/platform/src/installation.js';

function regular(path,max=1048576){if(!isAbsolute(path)||realpathSync(path)!==path||!lstatSync(path).isFile()||lstatSync(path).isSymbolicLink()||lstatSync(path).size>max)throw new Error('INVALID_SELFCHECK_INPUT');return path;}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function cliStatus(node,entry,args,synthetic){
  const env=Object.fromEntries(['HOME','TMPDIR','TMP','TEMP','SystemRoot','WINDIR','USERPROFILE','LOCALAPPDATA'].flatMap(k=>process.env[k]===undefined?[]:[[k,process.env[k]]]));
  if(synthetic){env.AUTOED_SYNTHETIC_TEST='1';env.AUTOED_SYNTHETIC_PORT=String(synthetic.port);}
  const child=spawn(node,[entry,...args,'status'],{cwd:dirname(entry),env,stdio:['ignore','pipe','pipe'],windowsHide:true});
  let output='',overflow=false;child.stdout.on('data',chunk=>{output+=chunk;if(output.length>131072){overflow=true;child.kill('SIGTERM');}});child.stderr.on('data',()=>{});
  let timed=false;const timer=setTimeout(()=>{timed=true;child.kill('SIGTERM');},15000);
  const force=setTimeout(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');},18000);
  let deadline;
  try{await new Promise((resolve,reject)=>{
    child.once('error',()=>reject(new Error('CLI_START_FAILED')));child.once('close',resolve);
    deadline=setTimeout(()=>{const exited=child.exitCode!==null||child.signalCode!==null;child.stdout.destroy();child.stderr.destroy();reject(new Error(exited?'CLI_PROBE_FAILED':'CHILD_EXIT_UNCONFIRMED'));},20000);
  });if(timed||overflow||child.exitCode!==0)throw new Error('CLI_PROBE_FAILED');return JSON.parse(output);}finally{clearTimeout(timer);clearTimeout(force);clearTimeout(deadline);}
}
/** Trusted installer configuration only; never exposed as MCP arguments.
 * @param {any} options
 */
export async function runSelfcheck({selection,managedNode,cliEntry,mcpEntry,manifestPath,operationId,generation,installerClient=undefined,releaseObservation=undefined}){
  z.uuid().nullable().parse(operationId);z.number().int().nonnegative().parse(generation);regular(managedNode,200000000);regular(cliEntry);regular(mcpEntry);regular(manifestPath,16384);
  const bytes=readFileSync(manifestPath);const parsed=JSON.parse(bytes.toString('utf8'));const {entries,...identity}=parsed;
  if(!Array.isArray(entries)||entries.length!==4||[...entries].sort().join()!=='api,cli,mcp,worker')throw new Error('INVALID_BUILD_MANIFEST');
  const build=BuildIdentitySchema.parse(identity),metadata=readInstallation(selection),synthetic=metadata.syntheticTest===true?metadata:null;const manifest=releaseObservation??{build,manifestHash:createHash('sha256').update(bytes).digest('hex'),checkedAt:new Date().toISOString(),evidence:'build_manifest'};
  const installer=installerClient??new HttpClient(selection.root,selection.parent,'installer',build);const credentialId=operationId===null?null:`selfcheck-${operationId}`;
  const projection=(kind,value)=>installer.call('/api/control/status-projection',{kind,operationId,expectedGeneration:generation,value});
  let client,issued=false,result,jobId=null;const probes=[];const features={};
  const failureCode=error=>['CHILD_EXIT_UNCONFIRMED','CLI_START_FAILED','CLI_PROBE_FAILED','MCP_PROBE_FAILED','FEATURE_REQUEST_FAILED','FEATURE_QUERY_FAILED'].includes(error?.message)?error.message:clientError(error).code;
  try{
    // Set recovery obligation before the request: a response loss may follow successful issuance.
    if(operationId!==null){issued=true;const credential=await installer.call('/api/control/selfcheck-credential',{action:'issue',operationId,generation,expiresAt:Date.now()+120000});if(credential.credentialId!==credentialId)throw new Error('INVALID_CREDENTIAL');}
    const args=['--root',selection.root,'--parent',selection.parent,...(credentialId?['--credential-id',credentialId]:[])];
    const cli=await cliStatus(managedNode,cliEntry,args,synthetic);
    probes.push(ComponentObservationSchema.parse(cli.component));
    client=new Client({name:'autoed-installer-selfcheck',version:build.version});const transport=new StdioClientTransport({command:managedNode,args:[mcpEntry,...args],cwd:dirname(mcpEntry),stderr:'pipe',maxBufferSize:131072,...(synthetic?{env:{AUTOED_SYNTHETIC_TEST:'1',AUTOED_SYNTHETIC_PORT:String(synthetic.port)}}:{})});transport.stderr?.on('data',()=>{});await client.connect(transport);
    const call=async(name,args)=>{const result=await client.callTool({name,arguments:args},{timeout:10000});if(!result.structuredContent)throw new Error('MCP_PROBE_FAILED');return result;};
    const statusResult=await call('autoed_status',{});const mcp=statusResult.structuredContent;const status=mcp.status??await installer.status();
    probes.push(...[status.api,status.worker,mcp.component].filter(Boolean).map(p=>ComponentObservationSchema.parse(p)));
    const run=async kind=>{
      const response=await call('autoed_selftest',{kind,value:'abc'});if(response.isError)throw new Error('FEATURE_REQUEST_FAILED');let job=response.structuredContent;
      for(const delay of [500,1000,2000]){if(['succeeded','failed','cancelled'].includes(job.state))break;await pause(delay);const polled=await call('autoed_job_get',{jobId:job.id});if(polled.isError)throw new Error('FEATURE_QUERY_FAILED');job=polled.structuredContent;}return job;
    };
    const echo=await run('echo');features.echo=echo;jobId=echo.id;const digest=await run('digest');features.digest=digest;
    const featuresVerified=echo.state==='succeeded'&&echo.result==='abc'&&(build.capabilities.includes('digest')?digest.state==='succeeded'&&digest.result==='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad':digest.state==='failed'&&digest.errorCode==='UNSUPPORTED_CAPABILITY');
    const assessment=assessIdentity(build,probes,featuresVerified);const featureResult=assessment.matched?'pass':'fail';jobId=build.capabilities.includes('digest')?digest.id:echo.id;
    await projection('manifest',manifest);for(const probe of probes.filter(p=>p.role==='cli'||p.role==='mcp'))await projection('component',probe);
    await projection('selfcheck',{jobId,probes,featureResult,checkedAt:new Date().toISOString()});
    result={...assessment,featureResult,jobId,probes,manifest,features,projectionWritten:true};
  }catch(error){
    result={matched:false,featureResult:'fail',code:failureCode(error),jobId,probes,manifest,features,projectionWritten:false,...(error?.message==='CHILD_EXIT_UNCONFIRMED'?{recoveryNeeded:true}:{})};
    try{await projection('selfcheck',{jobId,probes,featureResult:'fail',checkedAt:new Date().toISOString()});result.projectionWritten=true;}catch(projectionError){result.projectionCode=failureCode(projectionError);}
  }finally{
    try{await client?.close();}catch(error){result={...result,matched:false,featureResult:'fail',recoveryNeeded:true,childCleanupCode:failureCode(error)};}
    if(issued)try{await installer.call('/api/control/selfcheck-credential',{action:'revoke',operationId,generation});}catch(error){result={...result,matched:false,featureResult:'fail',recoveryNeeded:true,credentialCleanupCode:failureCode(error),operationId,credentialId};}
    if(result?.recoveryNeeded)try{await projection('selfcheck',{jobId,probes,featureResult:'fail',checkedAt:new Date().toISOString()});result.projectionWritten=true;}catch(error){result.projectionWritten=false;result.projectionCode=failureCode(error);}
  }
  return result;
}
