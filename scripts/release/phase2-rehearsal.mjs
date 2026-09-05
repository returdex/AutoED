#!/usr/bin/env node
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {closeSync,existsSync,fsyncSync,linkSync,lstatSync,mkdirSync,mkdtempSync,openSync,readFileSync,realpathSync,rmSync,unlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename,dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonical,canonicalSha256,phase2VersionSetSha256} from './phase2-gate.mjs';
import {hashBuildInputs} from '../dev/runtime.mjs';
import {renderPhase2RehearsalInstallPromptCore} from './phase2-gate.mjs';
import {assembleManagedUpdaterRehearsalPair} from '../build/assemble.mjs';
import {combineSensitiveReports,createCapturedOutputScanner,scanReachableHistory as scanSensitiveReachableHistory,scanTrackedTree,scanWorkingTree} from './sensitive-scan.mjs';
import {phase2RehearsalCommandSha256,reportPhase2RehearsalCommand} from './phase2-rehearsal-reporter.mjs';
import {isAbsentPhase2CommitLookup} from './publish.mjs';
import {isReviewedFixtureException} from './reviewed-sensitive-fixtures.mjs';
import {verifyPhase2AvailabilityAfterReadiness} from './verify-availability.mjs';

const scanReachableHistory=(root,treeish='HEAD')=>scanSensitiveReachableHistory(root,treeish,{isReviewedException:isReviewedFixtureException});
const SCRIPT_PATH=fileURLToPath(import.meta.url),ROOT=resolve(dirname(SCRIPT_PATH),'../..'),HASH=/^[a-f0-9]{64}$/,GIT=/^[a-f0-9]{40}$/,ISO=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&/(?:Z|[+-]\d\d:\d\d)$/.test(value),PRIVATE=/(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN (?:OPENSSH|EC|RSA|PRIVATE) PRIVATE KEY-----|\/(?:Users|home)\/|Profile|Cookies?|password|mfa|authorization)/i;
function fail(code){throw new Error(code);}
function exact(value,keys){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');}
function passCheck(value){return exact(value,['status','commandSha256','tests','skipped','todo'])&&value.status==='pass'&&HASH.test(value.commandSha256)&&Number.isSafeInteger(value.tests)&&value.tests>0&&value.skipped===0&&value.todo===0;}
function closure(value,platform){return exact(value,['status','platform','files','assets','sensitiveFindings'])&&value.status==='pass'&&value.platform===platform&&Number.isSafeInteger(value.files)&&value.files>0&&value.assets===8&&value.sensitiveFindings===0;}
export function validatePhase2Rehearsal(value){
  try{
    if(!exact(value,['schema','status','kind','releaseCoordinate','commit','tree','buildId','sourceSha256','managedRuntime','focused','quality','closures','prompt','publication','failureHistory','completedAt'])||value.schema!==1||value.status!=='pass'||value.kind!=='unnumbered_release_rehearsal'||value.releaseCoordinate!==null||!GIT.test(value.commit)||!GIT.test(value.tree)||!HASH.test(value.buildId)||!HASH.test(value.sourceSha256)||!exact(value.managedRuntime,['verified','node','npm'])||value.managedRuntime.verified!==true||value.managedRuntime.node!=='24.20.0'||value.managedRuntime.npm!=='11.19.0'||!passCheck(value.focused)||!exact(value.quality,['typecheck','unit','integration','ui','native','sensitiveScan'])||['typecheck','unit','integration','ui','native'].some(name=>!passCheck(value.quality[name]))||!exact(value.quality.sensitiveScan,['status','findings','reportSha256'])||value.quality.sensitiveScan.status!=='pass'||value.quality.sensitiveScan.findings!==0||!HASH.test(value.quality.sensitiveScan.reportSha256)||!exact(value.closures,['macos','windows'])||!closure(value.closures.macos,'macos')||!closure(value.closures.windows,'windows')||!exact(value.prompt,['status','targetCount','assetCount','commandsBound','latestReferences','envelopeSha256'])||value.prompt.status!=='pass'||value.prompt.targetCount!==2||value.prompt.assetCount!==16||value.prompt.commandsBound!==true||value.prompt.latestReferences!==0||!HASH.test(value.prompt.envelopeSha256)||!exact(value.publication,['status','contractTests','remoteMutations','fullVerifierInvocations'])||value.publication.status!=='pass'||!Number.isSafeInteger(value.publication.contractTests)||value.publication.contractTests<1||value.publication.remoteMutations!==0||value.publication.fullVerifierInvocations!==1||!Array.isArray(value.failureHistory)||value.failureHistory.length>32||value.failureHistory.some(item=>!exact(item,['class','code'])||!['PRE_SOURCE','PRE_RUNNER'].includes(item.class)||!/^[A-Z0-9_]{1,96}$/.test(item.code))||!ISO(value.completedAt)||PRIVATE.test(canonical(value)))throw new Error();return Object.freeze(value);
  }catch{fail('PHASE2_REHEARSAL_INVALID');}
}
export function verifyPhase2RehearsalBinding(selection,value){
  try{
    const checked=validatePhase2Rehearsal(value),number=Number(/^0\.1\.0-beta\.(\d+)$/.exec(selection?.version)?.[1]);
    if(!Number.isSafeInteger(number)||number<=31||selection.commit!==checked.commit||selection.tree!==checked.tree||selection.buildId!==checked.buildId||selection.sourceSha256!==checked.sourceSha256||selection.rehearsalSha256!==canonicalSha256(checked))throw new Error();
    return Object.freeze({status:'pass',commit:checked.commit,tree:checked.tree,buildId:checked.buildId,sourceSha256:checked.sourceSha256,rehearsalSha256:selection.rehearsalSha256});
  }catch{fail('PHASE2_REHEARSAL_BINDING_INVALID');}
}

/**
 * Bind a rehearsal attestation to the actual unnumbered build currently on disk.
 * If a build identity exists, stale or hand-carried build IDs are rejected before
 * the attestation can be written. Temporary fixture roots without a build remain
 * valid for contract tests.
 */
export function verifyPhase2RehearsalBuild(value,{root=ROOT}={}){
  try{
    const identityPath=join(root,'build/identity.json');
    if(!existsSync(identityPath))return true;
    const identity=JSON.parse(readFileSync(identityPath,'utf8'));
    if(identity?.version!=='0.1.0'||identity.commit!==value.commit||identity.tree!==value.tree||identity.buildId!==value.buildId||hashBuildInputs(root)!==value.sourceSha256)throw new Error();
    return true;
  }catch{fail('PHASE2_REHEARSAL_BUILD_INVALID');}
}
export function readPhase2RehearsalBinding(selection,{root=ROOT}={}){
  try{
    const parent=join(realpathSync(root),'.planning/release-rehearsals'),target=join(parent,`${selection.commit}-${selection.buildId}.json`),stat=lstatSync(target);
    if(realpathSync(target)!==target||!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size<2||stat.size>131072)throw new Error();
    return verifyPhase2RehearsalBinding(selection,JSON.parse(readFileSync(target,'utf8')));
  }catch(error){if(error instanceof Error&&error.message==='PHASE2_REHEARSAL_BINDING_INVALID')throw error;fail('PHASE2_REHEARSAL_BINDING_INVALID');}
}
export function writePhase2Rehearsal(path,value,{root=ROOT}={}){
  const checked=validatePhase2Rehearsal(value);verifyPhase2RehearsalBuild(checked,{root});const parent=join(realpathSync(root),'.planning/release-rehearsals'),name=`${checked.commit}-${checked.buildId}.json`,target=resolve(path);if(target!==join(parent,name)||existsSync(target))fail('PHASE2_REHEARSAL_OUTPUT_INVALID');if(!existsSync(parent))mkdirSync(parent,{recursive:true,mode:0o700});if(realpathSync(parent)!==parent||!lstatSync(parent).isDirectory()||lstatSync(parent).isSymbolicLink())fail('PHASE2_REHEARSAL_OUTPUT_INVALID');const temporary=join(parent,`.rehearsal-${randomUUID()}`);let fd;try{fd=openSync(temporary,'wx',0o600);writeFileSync(fd,canonical(checked)+'\n');fsyncSync(fd);closeSync(fd);fd=undefined;linkSync(temporary,target);unlinkSync(temporary);if(process.platform==='darwin'){const directory=openSync(parent,'r');try{fsyncSync(directory);}finally{closeSync(directory);}}}catch(error){if(fd!==undefined)try{closeSync(fd);}catch{}try{if(existsSync(temporary))unlinkSync(temporary);}catch{}if(error?.code==='EEXIST')fail('PHASE2_REHEARSAL_OUTPUT_EXISTS');fail('PHASE2_REHEARSAL_WRITE_FAILED');}return Object.freeze({status:'pass',path:basename(target),rehearsalSha256:canonicalSha256(checked),commit:checked.commit,tree:checked.tree,buildId:checked.buildId});
}

const PHASE2_REHEARSAL_ORDER=Object.freeze(['runtime','freeze','build','focused','typecheck','unit','integration','ui','native','assembly','prompt','publication','scan','finalize','cleanup','write']);
// This is deliberately an invalidated historical contract fixture, not a
// candidate.  It stays in process only and is never persisted or returned.
const PUBLICATION_FIXTURE=Object.freeze({version:'0.1.0-beta.32',tag:'v0.1.0-beta.32',kind:'invalidated_historical_contract_fixture'});
const PUBLICATION_CONTRACT_IDS=Object.freeze(['historical_noncandidate','actual_two_by_eight','absent_422_exact','public_consumed_monotonic','metadata_exact','sixteen_heads','verifier_once','no_side_effect','no_fixture_leak']);
const PUBLICATION_FORBIDDEN=/\b(?:gh|curl|wget|fetch|publish|push|tag|remote\s+add)\b/i;
const FIXED_COMMANDS=Object.freeze({
  focused:{ceiling:1200,steps:Object.freeze([
    Object.freeze({name:'process-lifecycle',runner:'vitest',args:Object.freeze(['npm','run','test:integration','--','--run','tests/integration/process-lifecycle.test.ts','tests/integration/managed-cleanup.test.ts','tests/integration/two-build-upgrade.test.ts','tests/integration/upgrade-journal.test.ts','tests/integration/upgrade-recovery.test.ts'])}),
    Object.freeze({name:'historical-process-ledger',runner:'vitest',args:Object.freeze(['npm','run','test:unit','--','--run','tests/unit/process-ledger.test.ts'])}),
  ])},
  typecheck:{ceiling:120,steps:Object.freeze([Object.freeze({name:'typecheck',runner:'rc',args:Object.freeze(['npm','run','typecheck'])})])},
  unit:{ceiling:300,steps:Object.freeze([Object.freeze({name:'unit',runner:'vitest',args:Object.freeze(['npm','run','test:unit','--','--run'])})])},
  integration:{ceiling:2100,steps:Object.freeze([Object.freeze({name:'integration',runner:'vitest',args:Object.freeze(['npm','run','test:integration','--','--run'])})])},
  ui:{ceiling:600,steps:Object.freeze([Object.freeze({name:'ui',runner:'playwright',args:Object.freeze(['npm','run','test:ui'])})])},
  native:{ceiling:600,steps:Object.freeze([Object.freeze({name:'native',runner:'vitest',args:Object.freeze(['npm','run','test:native','--','--run'])})])},
});
const MAX_CAPTURE_BYTES=64*1024*1024,PROCESS_GROUP_GRACE_MS=5000;
const digestBytes=value=>createHash('sha256').update(value).digest('hex');
const pgidExists=(pid,kill=process.kill)=>{try{kill(-pid,0);return true;}catch(error){return error?.code==='ESRCH'?false:null;}};
const delay=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));

/**
 * The sole detached-child adapter for R1 runtime checks, builds, and fixed
 * suites. It is deliberately bufferless apart from the bounded report copy:
 * stdout and stderr enter the same sensitive scanner in arrival order.
 * @param {{program:string,args:string[],cwd:string,timeoutMs:number,scanner:{write:(value:Buffer)=>unknown},outputLimit?:number,kill?:typeof process.kill,spawnImpl?:typeof spawn}} options
 */
export async function runPhase2Detached({program,args,cwd,timeoutMs,scanner,outputLimit=MAX_CAPTURE_BYTES,kill=process.kill,spawnImpl=spawn}={}){
  if(typeof program!=='string'||!Array.isArray(args)||args.some(value=>typeof value!=='string')||typeof cwd!=='string'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||!scanner||typeof scanner.write!=='function'||!Number.isSafeInteger(outputLimit)||outputLimit<1||outputLimit>MAX_CAPTURE_BYTES||typeof kill!=='function'||typeof spawnImpl!=='function')runnerFail('PRE_RUNNER','SPAWN_ARGUMENT_INVALID');
  let child,timeoutTimer=null,killTimer=null,stopReason=null,bytes=0,spawnError=false,closed=false;
  const chunks=[];
  const clearTimers=()=>{if(timeoutTimer){clearTimeout(timeoutTimer);timeoutTimer=null;}if(killTimer){clearTimeout(killTimer);killTimer=null;}};
  const terminate=reason=>{
    if(stopReason!==null||!child?.pid)return;
    stopReason=reason;
    try{kill(-child.pid,'SIGTERM');}catch(error){if(error?.code!=='ESRCH')spawnError=true;}
    killTimer=setTimeout(()=>{try{kill(-child.pid,'SIGKILL');}catch(error){if(error?.code!=='ESRCH')spawnError=true;}},PROCESS_GROUP_GRACE_MS);
    killTimer.unref?.();
  };
  let result;
  try{
    child=spawnImpl(program,args,{cwd,detached:true,stdio:['ignore','pipe','pipe']});
    if(!child||!Number.isSafeInteger(child.pid)||!child.stdout||!child.stderr)runnerFail('PRE_RUNNER','SPAWN_FAILED');
    const take=chunk=>{const value=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);bytes+=value.length;scanner.write(value);if(bytes<=outputLimit)chunks.push(value);if(bytes>outputLimit)terminate('output');};
    child.stdout.on('data',take);child.stderr.on('data',take);
    const close=await new Promise(resolve=>{child.once('close',(code,signal)=>resolve({code:code??1,signal:signal??null}));child.once('error',()=>{spawnError=true;});timeoutTimer=setTimeout(()=>terminate('timeout'),timeoutMs);timeoutTimer.unref?.();});
    closed=true;result=close;
    // A parent can close while an owned descendant retains the process group.
    // Keep the group scoped to this child and prove it has disappeared.
    if(pgidExists(child.pid,kill)===true)terminate(stopReason??'descendant');
    const deadline=Date.now()+PROCESS_GROUP_GRACE_MS+1000;
    while(pgidExists(child.pid,kill)===true&&Date.now()<deadline)await delay(25);
    if(pgidExists(child.pid,kill)!==false)runnerFail('PRE_RUNNER','PROCESS_GROUP_REMAINS');
  }catch(error){if(error?.rehearsal)throw error;runnerFail('PRE_RUNNER','SPAWN_FAILED');
  }finally{clearTimers();}
  if(!closed||spawnError)runnerFail('PRE_RUNNER','SPAWN_FAILED');
  if(stopReason==='timeout')runnerFail('PRE_RUNNER','COMMAND_TIMEOUT');
  if(stopReason==='output')runnerFail('PRE_RUNNER','COMMAND_OUTPUT_LIMIT');
  return Object.freeze({exitCode:result.code,signal:result.signal,stdout:Buffer.concat(chunks)});
}
function commandDigestArgs(spec){return ['scripts/dev/runtime.mjs',...spec.steps.flatMap(step=>['--phase2-fixed-step',step.name,...step.args])];}
async function runFixedCommand(root,id,scanner,ledger){
  const spec=FIXED_COMMANDS[id];if(!spec)runnerFail('PRE_RUNNER','COMMAND_ID_INVALID');const node=join(root,'.runtime/dev-toolchain/node-v24.20.0-darwin-arm64/bin/node');if(!existsSync(node))runnerFail('PRE_RUNNER','MANAGED_NODE_MISSING');
  if(!Array.isArray(ledger))runnerFail('PRE_RUNNER','CAPTURE_INVALID');const commandSha256=phase2RehearsalCommandSha256({program:'managed-node',args:commandDigestArgs(spec),env:{}});ledger.push(Object.freeze({id,commandSha256}));let passed=0;
  for(const step of spec.steps){const child=await runPhase2Detached({program:node,args:['scripts/dev/runtime.mjs',...step.args],cwd:root,timeoutMs:spec.ceiling*1000,scanner});let report;try{report=reportPhase2RehearsalCommand({runner:step.runner,exitCode:child.exitCode,signal:child.signal,stdout:child.stdout,commandSha256});}catch{runnerFail('PRE_SOURCE','COMMAND_REPORT_INVALID');}passed+=report.passed;}
  return Object.freeze({schema:1,runner:spec.steps.length===1?spec.steps[0].runner:'vitest',status:'pass',passed,failed:0,skipped:0,todo:0,commandSha256});
}
function runnerFail(kind,code){const error=new Error(`PHASE2_REHEARSAL_FAILED class=${kind} code=${code}`);error.rehearsal=true;throw error;}
const OPERATION_FAILURE_CODES=Object.freeze({runtime:'RUNTIME_OPERATION_FAILED',snapshot:'SNAPSHOT_OPERATION_FAILED',build:'BUILD_OPERATION_FAILED',command:'COMMAND_OPERATION_FAILED',assembly:'ASSEMBLY_OPERATION_FAILED',prompt:'PROMPT_OPERATION_FAILED',publication:'PUBLICATION_OPERATION_FAILED',scan:'SCAN_OPERATION_FAILED',cleanup:'CLEANUP_OPERATION_FAILED',now:'NOW_OPERATION_FAILED'});
function operationFailureCode(name,stage){if(name==='snapshot')return stage==='final'?'SNAPSHOT_FINAL_OPERATION_FAILED':'SNAPSHOT_INITIAL_OPERATION_FAILED';return OPERATION_FAILURE_CODES[name]??'OPERATION_FAILED';}
export function requirePhase2ProcessSuccess(result,failureClass){
  if(!['PRE_RUNNER','PRE_SOURCE'].includes(failureClass))runnerFail('PRE_RUNNER','CAPTURE_CLASS_INVALID');
  if(!result||result.exitCode!==0||result.signal)runnerFail(failureClass,'COMMAND_PROCESS_FAILED');
  return result;
}
function sameSnapshot(a,b){return exact(a,['commit','tree','sourceSha256','refsSha256','remotesSha256','receiptsSha256','clean'])&&exact(b,Object.keys(a))&&canonical(a)===canonical(b);}
function snapshotValid(value){return exact(value,['commit','tree','sourceSha256','refsSha256','remotesSha256','receiptsSha256','clean'])&&GIT.test(value.commit)&&GIT.test(value.tree)&&[value.sourceSha256,value.refsSha256,value.remotesSha256,value.receiptsSha256].every(item=>HASH.test(item))&&value.clean===true;}
function commandFact(value){return value&&value.status==='pass'&&HASH.test(value.commandSha256)&&Number.isSafeInteger(value.passed)&&value.passed>0&&value.failed===0&&value.skipped===0&&value.todo===0;}
function asCheck(value){if(!commandFact(value))runnerFail('PRE_RUNNER','COMMAND_REPORT_INVALID');return {status:'pass',commandSha256:value.commandSha256,tests:value.passed,skipped:0,todo:0};}
const REQUIRED_ASSET_ROLES=Object.freeze(['bootstrap','browser','capability','installer','manifest','node','program','signature']);
const PROMPT_BANNED=/(?:https?:\/\/|\bbeta(?:[.-]|\b)|\blatest\b|\bupdate\b|\binstall\b|\blogin\b)/i;
function validScan(value,surface){return exact(value,['status','surface','objects','bytes','findings','reportSha256'])&&value.status==='pass'&&value.surface===surface&&Number.isSafeInteger(value.objects)&&value.objects>=0&&Number.isSafeInteger(value.bytes)&&value.bytes>=0&&value.findings===0&&HASH.test(value.reportSha256);}
function ownedTargetRoot(root){try{const resolved=resolve(root),stat=lstatSync(resolved);return typeof root==='string'&&resolved===root&&realpathSync(resolved)===resolved&&stat.isDirectory()&&!stat.isSymbolicLink()?resolved:null;}catch{return null;}}
function strictAssets(value,root){
  const owned=ownedTargetRoot(root);
  return !!owned&&Array.isArray(value)&&value.length===REQUIRED_ASSET_ROLES.length&&new Set(value.map(asset=>asset?.role)).size===REQUIRED_ASSET_ROLES.length&&value.every(asset=>{
    try{
      if(!exact(asset,['name','path','role','sha256','bytes'])||typeof asset.name!=='string'||asset.name.length<1||asset.name.length>512||asset.name.includes('/')||asset.name.includes('\\')||PROMPT_BANNED.test(asset.name)||!REQUIRED_ASSET_ROLES.includes(asset.role)||!Number.isSafeInteger(asset.bytes)||asset.bytes<1||!HASH.test(asset.sha256)||typeof asset.path!=='string')return false;
      const path=resolve(asset.path),stat=lstatSync(path);
      return path===asset.path&&path.startsWith(owned+'/')&&!stat.isSymbolicLink()&&stat.isFile()&&realpathSync(path)===path&&stat.size===asset.bytes&&digestBytes(readFileSync(path))===asset.sha256;
    }catch{return false;}
  });
}
function closureFact(value,platform){
  const evidence=value?.evidence;
  if(!value||value.target!==platform||!strictAssets(value.assets,value.root)||!exact(evidence,['deliveryFiles','memberCount','capabilityClosureSha256','sensitive'])||!Number.isSafeInteger(evidence.deliveryFiles)||evidence.deliveryFiles<1||evidence.memberCount!==16||!HASH.test(evidence.capabilityClosureSha256)||!exact(evidence.sensitive,['delivery','outer'])||!validScan(evidence.sensitive.delivery,'owned_tree')||!validScan(evidence.sensitive.outer,'public_package'))runnerFail('PRE_SOURCE','CLOSURE_INVALID');
  return Object.freeze({status:'pass',platform:platform==='darwin-arm64'?'macos':'windows',files:evidence.deliveryFiles,assets:value.assets.length,sensitiveFindings:evidence.sensitive.delivery.findings+evidence.sensitive.outer.findings});
}
function promptTargets(assembly){
  if(!assembly||!Array.isArray(assembly.targets)||assembly.targets.length!==2)runnerFail('PRE_SOURCE','PROMPT_INVALID');
  const targets=assembly.targets.map(target=>{if(!target||!['darwin-arm64','win32-x64'].includes(target.target)||!strictAssets(target.assets,target.root))runnerFail('PRE_SOURCE','PROMPT_INVALID');return Object.freeze({target:target.target,roles:Object.freeze(REQUIRED_ASSET_ROLES.map(role=>{const asset=target.assets.find(item=>item.role===role);return Object.freeze({role,name:asset.name,bytes:asset.bytes,sha256:asset.sha256});}))});}).sort((a,b)=>a.target.localeCompare(b.target));
  if(targets[0]?.target!=='darwin-arm64'||targets[1]?.target!=='win32-x64'||canonical(targets).match(PROMPT_BANNED))runnerFail('PRE_SOURCE','PROMPT_INVALID');
  return Object.freeze(targets);
}
/** A coordinate-free, non-executing description of the two exact 8-role closures. */
export function renderPhase2RehearsalPromptEnvelope({core,assembly}={}){
  if(typeof core!=='string'||core.length<1)runnerFail('PRE_SOURCE','PROMPT_INVALID');
  const targets=promptTargets(assembly),targetDigest=canonicalSha256(targets),value=Object.freeze({schema:1,kind:'phase2-rehearsal-prompt-envelope',coreSha256:digestBytes(Buffer.from(core)),targets,targetDigest});
  if(PROMPT_BANNED.test(canonical(value)))runnerFail('PRE_SOURCE','PROMPT_INVALID');
  return canonical(value);
}
/** Independently parses and reconstructs the envelope; success is the only commandsBound source. */
export function verifyPhase2RehearsalPromptEnvelope(envelope,{core,assembly}={}){
  try{
    if(typeof envelope!=='string'||typeof core!=='string'||PROMPT_BANNED.test(envelope))throw new Error();
    const parsed=JSON.parse(envelope),targets=promptTargets(assembly);
    if(!exact(parsed,['schema','kind','coreSha256','targets','targetDigest'])||parsed.schema!==1||parsed.kind!=='phase2-rehearsal-prompt-envelope'||parsed.coreSha256!==digestBytes(Buffer.from(core))||parsed.targetDigest!==canonicalSha256(targets)||canonical(parsed.targets)!==canonical(targets)||canonical(parsed)!==envelope)throw new Error();
    return Object.freeze({status:'pass',targetCount:targets.length,assetCount:targets.reduce((sum,target)=>sum+target.roles.length,0),envelopeSha256:digestBytes(Buffer.from(envelope))});
  }catch(error){if(error?.rehearsal)throw error;runnerFail('PRE_SOURCE','PROMPT_INVALID');}
}
function publicationFail(code='PUBLICATION_CONTRACT_INVALID'){runnerFail('PRE_SOURCE',code);}
function publicationAsset(asset,id){if(!asset||typeof asset.name!=='string'||!Number.isSafeInteger(asset.bytes)||asset.bytes<1||!HASH.test(asset.sha256)||typeof asset.role!=='string')publicationFail();return Object.freeze({id,name:asset.name,bytes:asset.bytes,sha256:asset.sha256,url:`https://github.com/returdex/AutoED/releases/download/${PUBLICATION_FIXTURE.tag}/${encodeURIComponent(asset.name)}`});}
function publicationTarget(target,startId){
  if(!target||!Array.isArray(target.assets)||target.assets.length!==8||new Set(target.assets.map(item=>item.name)).size!==8)publicationFail();
  const byRole=new Map(target.assets.map(item=>[item.role,item]));
  if(['capability','bootstrap','manifest','signature','installer','program','node','browser'].some(role=>!byRole.has(role)))publicationFail();
  const asset=role=>publicationAsset(byRole.get(role),startId++),outer=asset('capability'),bootstrap=asset('bootstrap'),manifest=asset('manifest'),signature=asset('signature'),artifacts=['installer','program','node','browser'].map(asset);
  return Object.freeze({target:Object.freeze({...outer,updater:Object.freeze({bootstrap,manifest,signature,artifacts:Object.freeze(artifacts)})}),assets:Object.freeze([outer,bootstrap,manifest,signature,...artifacts])});
}
/** Derives an in-memory, production-shaped availability contract from R1 facts. */
function derivePublicationContractFixture({identity,assembly,now}){
  try{
    if(!identity||identity.releaseCoordinate!==null||!GIT.test(identity.commit)||!GIT.test(identity.tree)||!HASH.test(identity.buildId)||!HASH.test(identity.sourceSha256)||!assembly||assembly.releaseCoordinate!==null||assembly.status!=='pass'||!Array.isArray(assembly.targets)||assembly.targets.length!==2||!Number.isFinite(Date.parse(now)))throw new Error();
    const darwin=assembly.targets.find(item=>item.target==='darwin-arm64'),windows=assembly.targets.find(item=>item.target==='win32-x64');
    const macos=publicationTarget(darwin,32001),win=publicationTarget(windows,32009),assets=Object.freeze({macos:macos.assets,windows:win.assets});
    const projection=Object.freeze({identity:Object.freeze({commit:identity.commit,tree:identity.tree,buildId:identity.buildId,sourceSha256:identity.sourceSha256,qualitySha256:identity.qualitySha256}),targets:Object.freeze(assembly.targets.map(target=>Object.freeze({target:target.target,assets:target.assets.map(asset=>Object.freeze({name:asset.name,bytes:asset.bytes,sha256:asset.sha256,role:asset.role}))}))) });
    const manifestSha256=canonicalSha256(projection),installPromptCoreSha256=canonicalSha256(renderPhase2RehearsalInstallPromptCore(identity)),externalPromptSha256=canonicalSha256(Object.freeze({projection,kind:PUBLICATION_FIXTURE.kind})),capabilitiesSha256=canonicalSha256(assembly.targets.map(target=>target.assets.filter(asset=>asset.role==='capability').map(asset=>({name:asset.name,bytes:asset.bytes,sha256:asset.sha256}))));
    const consumed=Array.from({length:31},(_,index)=>`0.1.0-beta.${index+1}`),release=Object.freeze({schema:1,status:'built_signed_verified_local',owner:'returdex',repository:'returdex/AutoED',repositoryId:1350421724,version:PUBLICATION_FIXTURE.version,tag:PUBLICATION_FIXTURE.tag,commit:identity.commit,tree:identity.tree,buildId:identity.buildId,sourceSha256:identity.sourceSha256,versionSetSha256:phase2VersionSetSha256(consumed),manifestSha256,installPromptCoreSha256,externalPromptSha256,capabilitiesSha256,immutable:true,targets:Object.freeze({macos:macos.target,windows:win.target})});
    const publication=Object.freeze({schema:1,status:'pass',owner:'returdex',repositoryId:1350421724,version:release.version,tag:release.tag,buildId:release.buildId,manifestSha256:release.manifestSha256,immutable:true,assets,checkedAt:new Date(now).toISOString()});
    const metadata=Object.freeze({schema:1,owner:'returdex',repositoryId:1350421724,version:release.version,tag:release.tag,targetCommit:release.commit,buildId:release.buildId,manifestSha256:release.manifestSha256,installPromptCoreSha256:release.installPromptCoreSha256,externalPromptSha256:release.externalPromptSha256,capabilitiesSha256:release.capabilitiesSha256,immutable:true,assets});
    return Object.freeze({release,publication,metadata,assets});
  }catch{publicationFail();}
}
/** Executes only local readiness-contract logic; it cannot publish or use network dependencies. */
export async function exercisePhase2PublicationContract({identity,assembly,now,commandLedger=/** @type {string[]} */([]),availabilityDeps={}}){
  try{
    if(!Array.isArray(commandLedger)||commandLedger.some(entry=>typeof entry!=='string'||PUBLICATION_FORBIDDEN.test(entry)))runnerFail('PRE_RUNNER','PUBLICATION_SIDE_EFFECT');
    const fixture=derivePublicationContractFixture({identity,assembly,now}),completed=new Set();
    const absent={stderr:`No commit found for SHA: ${PUBLICATION_FIXTURE.tag} (HTTP 422)`};
    if(!isAbsentPhase2CommitLookup(absent,PUBLICATION_FIXTURE.tag)||isAbsentPhase2CommitLookup({stderr:`No commit found for SHA: ${PUBLICATION_FIXTURE.tag} (HTTP 422) extra`},PUBLICATION_FIXTURE.tag)||isAbsentPhase2CommitLookup(absent,'v0.1.0-beta.33'))publicationFail();
    completed.add('historical_noncandidate');
    if(fixture.assets.macos.length!==8||fixture.assets.windows.length!==8||new Set([...fixture.assets.macos,...fixture.assets.windows].map(asset=>asset.id)).size!==16)publicationFail();completed.add('actual_two_by_eight');completed.add('absent_422_exact');
    const consumed=Array.from({length:31},(_,index)=>`0.1.0-beta.${index+1}`);if(phase2VersionSetSha256(consumed)!==fixture.release.versionSetSha256||consumed.includes(PUBLICATION_FIXTURE.version))publicationFail();completed.add('public_consumed_monotonic');
    if(!availabilityDeps||typeof availabilityDeps!=='object')publicationFail();let metadataCalls=0,headCalls=0,sleeps=0,fullVerifierInvocations=0;const headed=new Set(),localNow=()=>Date.parse(now),localSleep=async()=>{},localMetadata=async()=>({status:200,value:fixture.metadata}),localHead=async asset=>({status:200,finalUrl:`https://release-assets.githubusercontent.com/${asset.id}`,headers:new Map([['content-length',String(asset.bytes)]])}),localVerify=async()=>Object.freeze({status:'pass',invocations:1});
    const choose=(name,fallback)=>availabilityDeps[name]===undefined?fallback:availabilityDeps[name];const suppliedNow=choose('now',localNow),suppliedSleep=choose('sleep',localSleep),suppliedMetadata=choose('fetchReadinessMetadata',localMetadata),suppliedHead=choose('headAsset',localHead),suppliedVerify=choose('verifyAvailability',localVerify);if([suppliedNow,suppliedSleep,suppliedMetadata,suppliedHead,suppliedVerify].some(value=>typeof value!=='function'))publicationFail();
    const result=await verifyPhase2AvailabilityAfterReadiness({release:fixture.release,publication:fixture.publication,deps:{now:()=>suppliedNow(),sleep:async ms=>{sleeps++;return suppliedSleep(ms);},fetchReadinessMetadata:async options=>{metadataCalls++;return suppliedMetadata(options,fixture);},headAsset:async(asset,options)=>{headCalls++;if(headed.has(asset.id))publicationFail();headed.add(asset.id);return suppliedHead(asset,options,fixture);},verifyAvailability:async options=>{if(metadataCalls!==1||headCalls!==16||headed.size!==16||sleeps!==0)publicationFail();fullVerifierInvocations++;const verification=await suppliedVerify(options,fixture);if(verification?.status!=='pass'||verification.invocations!==1)publicationFail();return Object.freeze({status:'pass'});}}});
    if(result?.status!=='pass'||metadataCalls!==1||headCalls!==16||headed.size!==16||sleeps!==0||fullVerifierInvocations!==1)publicationFail();completed.add('metadata_exact');completed.add('sixteen_heads');completed.add('verifier_once');
    const remoteMutations=commandLedger.filter(entry=>PUBLICATION_FORBIDDEN.test(entry)).length;if(remoteMutations!==0)runnerFail('PRE_RUNNER','PUBLICATION_SIDE_EFFECT');completed.add('no_side_effect');
    const exposed=canonical({status:'pass',contractTests:completed.size,remoteMutations,fullVerifierInvocations});if(new RegExp(`${PUBLICATION_FIXTURE.version}|${PUBLICATION_FIXTURE.tag}|github|https?:|3200`).test(exposed))publicationFail();completed.add('no_fixture_leak');
    if(PUBLICATION_CONTRACT_IDS.some(id=>!completed.has(id))||completed.size!==PUBLICATION_CONTRACT_IDS.length)publicationFail();
    return Object.freeze({status:'pass',contractTests:completed.size,remoteMutations,fullVerifierInvocations});
  }catch(error){if(error?.rehearsal)throw error;publicationFail();}
}

/**
 * @param {{root?:string,ops:any}} options
 * Fixed R1 orchestrator. Injected ops exist only to test ordering and adverse
 * conditions; the attestation is assembled here from validated raw facts.
 */
export async function runPhase2Rehearsal({root=ROOT,ops={}}={}){
  const operationClass=Object.freeze({runtime:'PRE_RUNNER',snapshot:'PRE_RUNNER',build:'PRE_SOURCE',command:'PRE_SOURCE',assembly:'PRE_SOURCE',prompt:'PRE_SOURCE',publication:'PRE_SOURCE',scan:'PRE_SOURCE',cleanup:'PRE_RUNNER',now:'PRE_RUNNER'});
  const call=async(name,...args)=>{if(!ops||typeof ops[name]!=='function')runnerFail('PRE_RUNNER','OPS_INVALID');try{return await ops[name](...args);}catch(error){if(error?.rehearsal)throw error;runnerFail(operationClass[name]??'PRE_RUNNER',operationFailureCode(name));}};
  const snapshot=async stage=>{if(!ops||typeof ops.snapshot!=='function')runnerFail('PRE_RUNNER','OPS_INVALID');try{return await ops.snapshot({stage});}catch(error){if(error?.rehearsal)throw error;runnerFail('PRE_RUNNER',operationFailureCode('snapshot',stage));}};
  let cleanupAttempted=false;
  try{
    const runtime=await call('runtime');if(!exact(runtime,['verified','node','npm'])||runtime.verified!==true||runtime.node!=='24.20.0'||runtime.npm!=='11.19.0')runnerFail('PRE_RUNNER','RUNTIME_INVALID');
    const before=await snapshot('initial');if(!snapshotValid(before))runnerFail('PRE_RUNNER','IDENTITY_INVALID');
    const build=await call('build',before);if(!exact(build,['version','commit','tree','buildId','sourceSha256'])||build.version!=='0.1.0'||build.commit!==before.commit||build.tree!==before.tree||build.sourceSha256!==before.sourceSha256||!HASH.test(build.buildId))runnerFail('PRE_SOURCE','BUILD_IDENTITY_DRIFT');
    const focused=asCheck(await call('command','focused'));
    const quality={typecheck:asCheck(await call('command','typecheck')),unit:asCheck(await call('command','unit')),integration:asCheck(await call('command','integration')),ui:asCheck(await call('command','ui')),native:asCheck(await call('command','native'))};
    const qualitySha256=canonicalSha256(quality),identity={releaseCoordinate:null,commit:build.commit,tree:build.tree,buildId:build.buildId,sourceSha256:build.sourceSha256,qualitySha256};
    const assembled=await call('assembly',identity);if(!assembled||assembled.status!=='pass'||assembled.releaseCoordinate!==null||assembled.signerExited!==true||!Array.isArray(assembled.targets)||assembled.targets.length!==2)runnerFail('PRE_SOURCE','ASSEMBLY_INVALID');
    const mac=assembled.targets.find(item=>item.target==='darwin-arm64'),win=assembled.targets.find(item=>item.target==='win32-x64');const closures={macos:closureFact(mac,'darwin-arm64'),windows:closureFact(win,'win32-x64')};if(mac.evidence.capabilityClosureSha256!==win.evidence.capabilityClosureSha256)runnerFail('PRE_SOURCE','CLOSURE_INVALID');
    const core=renderPhase2RehearsalInstallPromptCore(identity),promptEnvelope=await call('prompt',{identity,core,assembly:assembled}),prompt=verifyPhase2RehearsalPromptEnvelope(promptEnvelope,{core,assembly:assembled});
    const publication=await call('publication',{identity,assembly:assembled,before});if(!publication||publication.status!=='pass'||!Number.isSafeInteger(publication.contractTests)||publication.contractTests<1||publication.remoteMutations!==0||publication.fullVerifierInvocations!==1)runnerFail('PRE_SOURCE','PUBLICATION_INVALID');
    const scan=await call('scan');if(!scan||scan.status!=='pass'||scan.findings!==0||!HASH.test(scan.reportSha256))runnerFail('PRE_SOURCE','SENSITIVE_SCAN_INVALID');
    cleanupAttempted=true;if(await call('cleanup')!==true)runnerFail('PRE_RUNNER','CLEANUP_FAILED');
    const after=await snapshot('final');const remoteSnapshotMutations=['refsSha256','remotesSha256','receiptsSha256'].filter(key=>before[key]!==after[key]).length;if(remoteSnapshotMutations!==0)runnerFail('PRE_RUNNER','REMOTE_MUTATION');if(!sameSnapshot(before,after))runnerFail('PRE_SOURCE','FINAL_IDENTITY_DRIFT');
    const base={schema:1,status:'pass',kind:'unnumbered_release_rehearsal',releaseCoordinate:null,commit:build.commit,tree:build.tree,buildId:build.buildId,sourceSha256:build.sourceSha256,managedRuntime:runtime,focused,quality:{...quality,sensitiveScan:{status:'pass',findings:0,reportSha256:scan.reportSha256}},closures,prompt:{status:'pass',targetCount:prompt.targetCount,assetCount:prompt.assetCount,commandsBound:true,latestReferences:0,envelopeSha256:prompt.envelopeSha256},publication:{status:'pass',contractTests:publication.contractTests,remoteMutations:publication.remoteMutations,fullVerifierInvocations:publication.fullVerifierInvocations},failureHistory:[]};
    const value={...base,completedAt:await call('now')};
    try{validatePhase2Rehearsal(value);}catch{runnerFail('PRE_SOURCE','FINAL_VALIDATION_FAILED');}
    const path=join(root,'.planning/release-rehearsals',`${value.commit}-${value.buildId}.json`);if(existsSync(path))runnerFail('PRE_SOURCE','ATTESTATION_OUTPUT_EXISTS');
    try{return writePhase2Rehearsal(path,value,{root});}catch(error){
      if(error?.message==='PHASE2_REHEARSAL_OUTPUT_EXISTS')runnerFail('PRE_SOURCE','ATTESTATION_OUTPUT_EXISTS');
      if(error?.message==='PHASE2_REHEARSAL_BUILD_INVALID')runnerFail('PRE_SOURCE','FINAL_SOURCE_DRIFT');
      runnerFail('PRE_RUNNER','ATTESTATION_WRITE_FAILED');
    }
  }catch(error){if(!cleanupAttempted){cleanupAttempted=true;try{if(await call('cleanup')!==true)runnerFail('PRE_RUNNER','CLEANUP_FAILED');}catch(cleanupError){if(cleanupError?.rehearsal)throw cleanupError;runnerFail('PRE_RUNNER','CLEANUP_FAILED');}}if(error?.rehearsal)throw error;runnerFail('PRE_SOURCE','UNEXPECTED');}
}

export function scanPhase2RehearsalSources(root,captured){
  const reports=[scanTrackedTree(root,'HEAD'),scanReachableHistory(root,'HEAD'),scanWorkingTree(root),captured];
  return combineSensitiveReports(reports);
}

/** Normalize OS temporary-directory aliases before passing an owned root across module boundaries. */
export function normalizePhase2RehearsalOwnedRoot(root){
  try{
    const normalized=realpathSync(root),stat=lstatSync(normalized);
    if(typeof root!=='string'||!stat.isDirectory()||stat.isSymbolicLink()||(stat.mode&0o077)!==0)throw new Error();
    return normalized;
  }catch(error){if(error?.message==='REHEARSAL_ROOT_INVALID')throw error;throw new Error('REHEARSAL_ROOT_INVALID');}
}
function createPhase2RehearsalOwnedRoot(){return normalizePhase2RehearsalOwnedRoot(realpathSync(mkdtempSync(join(tmpdir(),'autoed-r1-owned-'))));}
/** Production execution is fixed: callers cannot supply command, target or coordinate overrides. */
export function createProductionPhase2RehearsalOps({root=ROOT}={}){
  const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:1024*1024}).trim();
  const node=join(root,'.runtime/dev-toolchain/node-v24.20.0-darwin-arm64/bin/node'),scanner=createCapturedOutputScanner(),ledger=[],owned=createPhase2RehearsalOwnedRoot();
  const receiptNames=['release/phase2-build-selection.json','release/phase2-test-report.json','release/phase2-beta-artifacts.json','release/phase2-publication.json','release/phase2-availability.json','release/phase2-install-prompt.md'];
  const receiptDigest=()=>canonicalSha256(receiptNames.map(name=>existsSync(join(root,name))?{name,sha256:canonicalSha256(readFileSync(join(root,name)))}:{name,missing:true}));
  const snapshot=()=>({commit:git(['rev-parse','HEAD']),tree:git(['write-tree']),sourceSha256:hashBuildInputs(root),refsSha256:canonicalSha256(git(['show-ref','--head'])),remotesSha256:canonicalSha256(git(['remote','-v'])),receiptsSha256:receiptDigest(),clean:git(['status','--porcelain'])==='' });
  const capture=async(program,args,timeout=300000,failureClass='PRE_RUNNER')=>requirePhase2ProcessSuccess(await runPhase2Detached({program,args,cwd:root,timeoutMs:timeout,scanner}),failureClass).stdout;
  // Actual long commands deliberately live behind the internal fixed command
  // adapter; direct callers never receive a program/argument escape hatch.
  return Object.freeze({runtime:async()=>{if(!existsSync(node)||realpathSync(process.execPath)!==realpathSync(node))runnerFail('PRE_RUNNER','HOST_RUNTIME');await capture(node,['scripts/dev/runtime.mjs','--check']);const actualNode=(await capture(node,['-p','process.versions.node'])).toString().trim(),npmCli=process.platform==='win32'?join(dirname(node),'node_modules/npm/bin/npm-cli.js'):join(dirname(dirname(node)),'lib/node_modules/npm/bin/npm-cli.js'),actualNpm=(await capture(node,[npmCli,'--version'])).toString().trim();if(actualNode!=='24.20.0'||actualNpm!=='11.19.0')runnerFail('PRE_RUNNER','RUNTIME_INVALID');return {verified:true,node:actualNode,npm:actualNpm};},snapshot,build:async before=>{await capture(node,['scripts/dev/runtime.mjs','npm','run','build'],120000,'PRE_SOURCE');const identity=JSON.parse(readFileSync(join(root,'build/identity.json'),'utf8'));return {version:identity.version,commit:identity.commit,tree:identity.tree,buildId:identity.buildId,sourceSha256:before.sourceSha256};},command:async id=>runFixedCommand(root,id,scanner,ledger),assembly:async identity=>assembleManagedUpdaterRehearsalPair({projectRoot:root,temporaryRoot:join(owned,'assembly'),identity}),prompt:async({core,assembly})=>renderPhase2RehearsalPromptEnvelope({core,assembly}),publication:async({identity,assembly})=>exercisePhase2PublicationContract({identity,assembly,now:new Date().toISOString(),commandLedger:ledger.map(item=>item.id)}),scan:async()=>{const captured=scanner.finish(),combined=scanPhase2RehearsalSources(root,captured);return {status:combined.status,findings:combined.findings,reportSha256:combined.reportSha256};},cleanup:async()=>{try{rmSync(owned,{recursive:true,force:false,maxRetries:1});return !existsSync(owned);}catch{return false;}},now:async()=>new Date().toISOString()});
}

if(process.argv[1]&&resolve(process.argv[1])===SCRIPT_PATH){const args=process.argv.slice(2);if(args.length!==1||args[0]!=='--run'){process.stderr.write('PHASE2_REHEARSAL_FAILED class=PRE_RUNNER code=ARGUMENT_INVALID\n');process.exitCode=1;}else runPhase2Rehearsal({root:ROOT,ops:createProductionPhase2RehearsalOps({root:ROOT})}).then(result=>process.stdout.write(canonical(result)+'\n')).catch(error=>{const message=typeof error?.message==='string'&&error.message.startsWith('PHASE2_REHEARSAL_FAILED class=')?error.message:'PHASE2_REHEARSAL_FAILED class=PRE_SOURCE code=UNEXPECTED';process.stderr.write(message+'\n');process.exitCode=1;});}
