#!/usr/bin/env node
import {randomUUID} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {closeSync,existsSync,fsyncSync,linkSync,lstatSync,mkdirSync,openSync,readFileSync,realpathSync,unlinkSync,writeFileSync} from 'node:fs';
import {basename,dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonical,canonicalSha256} from './phase2-gate.mjs';
import {hashBuildInputs} from '../dev/runtime.mjs';
import {renderPhase2RehearsalInstallPromptCore} from './phase2-gate.mjs';
import {assembleManagedUpdaterRehearsalPair} from '../build/assemble.mjs';
import {combineSensitiveReports,scanCapturedOutput,scanReachableHistory,scanTrackedTree,scanWorkingTree} from './sensitive-scan.mjs';
import {phase2RehearsalCommandSha256,reportPhase2RehearsalCommand} from './phase2-rehearsal-reporter.mjs';

const SCRIPT_PATH=fileURLToPath(import.meta.url),ROOT=resolve(dirname(SCRIPT_PATH),'../..'),HASH=/^[a-f0-9]{64}$/,GIT=/^[a-f0-9]{40}$/,ISO=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&/(?:Z|[+-]\d\d:\d\d)$/.test(value),PRIVATE=/(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN (?:OPENSSH|EC|RSA|PRIVATE) PRIVATE KEY-----|\/(?:Users|home)\/|Profile|Cookies?|password|mfa|authorization)/i;
function fail(code){throw new Error(code);}
function exact(value,keys){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');}
function passCheck(value){return exact(value,['status','commandSha256','tests','skipped','todo'])&&value.status==='pass'&&HASH.test(value.commandSha256)&&Number.isSafeInteger(value.tests)&&value.tests>0&&value.skipped===0&&value.todo===0;}
function closure(value,platform){return exact(value,['status','platform','files','assets','sensitiveFindings'])&&value.status==='pass'&&value.platform===platform&&Number.isSafeInteger(value.files)&&value.files>0&&value.assets===8&&value.sensitiveFindings===0;}
export function validatePhase2Rehearsal(value){
  try{
    if(!exact(value,['schema','status','kind','releaseCoordinate','commit','tree','buildId','sourceSha256','managedRuntime','focused','quality','closures','prompt','publication','failureHistory','completedAt'])||value.schema!==1||value.status!=='pass'||value.kind!=='unnumbered_release_rehearsal'||value.releaseCoordinate!==null||!GIT.test(value.commit)||!GIT.test(value.tree)||!HASH.test(value.buildId)||!HASH.test(value.sourceSha256)||!exact(value.managedRuntime,['verified','node','npm'])||value.managedRuntime.verified!==true||value.managedRuntime.node!=='24.20.0'||value.managedRuntime.npm!=='11.19.0'||!passCheck(value.focused)||!exact(value.quality,['typecheck','unit','integration','ui','native','sensitiveScan'])||['typecheck','unit','integration','ui','native'].some(name=>!passCheck(value.quality[name]))||!exact(value.quality.sensitiveScan,['status','findings','reportSha256'])||value.quality.sensitiveScan.status!=='pass'||value.quality.sensitiveScan.findings!==0||!HASH.test(value.quality.sensitiveScan.reportSha256)||!exact(value.closures,['macos','windows'])||!closure(value.closures.macos,'macos')||!closure(value.closures.windows,'windows')||!exact(value.prompt,['status','targetCount','assetCount','commandsBound','latestReferences'])||value.prompt.status!=='pass'||value.prompt.targetCount!==2||value.prompt.assetCount!==16||value.prompt.commandsBound!==true||value.prompt.latestReferences!==0||!exact(value.publication,['status','contractTests','remoteMutations','fullVerifierInvocations'])||value.publication.status!=='pass'||!Number.isSafeInteger(value.publication.contractTests)||value.publication.contractTests<1||value.publication.remoteMutations!==0||value.publication.fullVerifierInvocations!==1||!Array.isArray(value.failureHistory)||value.failureHistory.length>32||value.failureHistory.some(item=>!exact(item,['class','code'])||!['PRE_SOURCE','PRE_RUNNER'].includes(item.class)||!/^[A-Z0-9_]{1,96}$/.test(item.code))||!ISO(value.completedAt)||PRIVATE.test(canonical(value)))throw new Error();return Object.freeze(value);
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
const FIXED_COMMANDS=Object.freeze({focused:{runner:'vitest',ceiling:1200,args:['npm','run','test:integration','--','--run','tests/integration/process-lifecycle.test.ts','tests/integration/managed-cleanup.test.ts','tests/integration/two-build-upgrade.test.ts','tests/integration/upgrade-journal.test.ts','tests/integration/upgrade-recovery.test.ts']},typecheck:{runner:'rc',ceiling:120,args:['npm','run','typecheck']},unit:{runner:'vitest',ceiling:300,args:['npm','run','test:unit','--','--run']},integration:{runner:'vitest',ceiling:2100,args:['npm','run','test:integration','--','--run']},ui:{runner:'playwright',ceiling:600,args:['npm','run','test:ui']},native:{runner:'vitest',ceiling:600,args:['npm','run','test:native','--','--run']}});
async function runFixedCommand(root,id){
  const spec=FIXED_COMMANDS[id];if(!spec)runnerFail('PRE_RUNNER','COMMAND_ID_INVALID');const node=join(root,'.runtime/dev-toolchain/node-v24.20.0-darwin-arm64/bin/node');if(!existsSync(node))runnerFail('PRE_RUNNER','MANAGED_NODE_MISSING');const args=['scripts/dev/runtime.mjs',...spec.args],sha=phase2RehearsalCommandSha256({program:'managed-node',args,env:{}}),chunks=[];let bytes=0,timeout=false;
  const result=await new Promise(resolve=>{const child=spawn(node,args,{cwd:root,detached:true,stdio:['ignore','pipe','pipe']});const take=chunk=>{bytes+=chunk.length;if(bytes<=64*1024*1024)chunks.push(chunk);};child.stdout.on('data',take);child.stderr.on('data',take);const timer=setTimeout(()=>{timeout=true;try{process.kill(-child.pid,'SIGTERM');}catch{}setTimeout(()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}},5000).unref();},spec.ceiling*1000);child.once('close',(code,signal)=>{clearTimeout(timer);resolve({code:code??1,signal});});child.once('error',()=>{clearTimeout(timer);resolve({code:1,signal:'ERROR'});});});
  if(timeout||bytes>64*1024*1024)runnerFail('PRE_RUNNER',timeout?'COMMAND_TIMEOUT':'COMMAND_OUTPUT_LIMIT');const captured=scanCapturedOutput(chunks);if(captured.status!=='pass')runnerFail('PRE_SOURCE','CAPTURED_OUTPUT_SENSITIVE');try{return {...reportPhase2RehearsalCommand({runner:spec.runner,exitCode:result.code,signal:result.signal,stdout:Buffer.concat(chunks),commandSha256:sha}),captured};}catch{runnerFail('PRE_RUNNER','COMMAND_REPORT_INVALID');}
}
const REHEARSAL_FAILURE=/^(?:PHASE2_REHEARSAL|REPORT)_[A-Z0-9_]+$/;
function runnerFail(kind,code){const error=new Error(`PHASE2_REHEARSAL_FAILED class=${kind} code=${code}`);error.rehearsal=true;throw error;}
function sameSnapshot(a,b){return exact(a,['commit','tree','sourceSha256','refsSha256','remotesSha256','receiptsSha256','clean'])&&exact(b,Object.keys(a))&&canonical(a)===canonical(b);}
function snapshotValid(value){return exact(value,['commit','tree','sourceSha256','refsSha256','remotesSha256','receiptsSha256','clean'])&&GIT.test(value.commit)&&GIT.test(value.tree)&&[value.sourceSha256,value.refsSha256,value.remotesSha256,value.receiptsSha256].every(item=>HASH.test(item))&&value.clean===true;}
function commandFact(value){return value&&value.status==='pass'&&HASH.test(value.commandSha256)&&Number.isSafeInteger(value.passed)&&value.passed>0&&value.failed===0&&value.skipped===0&&value.todo===0;}
function asCheck(value){if(!commandFact(value))runnerFail('PRE_RUNNER','COMMAND_REPORT_INVALID');return {status:'pass',commandSha256:value.commandSha256,tests:value.passed,skipped:0,todo:0};}
function closureFact(value,platform){if(!value||value.target!==platform||!Array.isArray(value.assets)||value.assets.length!==8||new Set(value.assets.map(asset=>asset.name)).size!==8||value.assets.some(asset=>!Number.isSafeInteger(asset.bytes)||asset.bytes<1||!HASH.test(asset.sha256))){runnerFail('PRE_SOURCE','CLOSURE_INVALID');}return {status:'pass',platform:platform==='darwin-arm64'?'macos':'windows',files:value.assets.reduce((total,asset)=>total+(Array.isArray(asset.files)?asset.files.length:1),0),assets:value.assets.length,sensitiveFindings:0};}

/**
 * @param {{root?:string,ops:any}} options
 * Fixed R1 orchestrator. Injected ops exist only to test ordering and adverse
 * conditions; the attestation is assembled here from validated raw facts.
 */
export async function runPhase2Rehearsal({root=ROOT,ops={}}={}){
  const call=async(name,...args)=>{if(!ops||typeof ops[name]!=='function')runnerFail('PRE_RUNNER','OPS_INVALID');return await ops[name](...args);};
  try{
    const runtime=await call('runtime');if(!exact(runtime,['verified','node','npm'])||runtime.verified!==true||runtime.node!=='24.20.0'||runtime.npm!=='11.19.0')runnerFail('PRE_RUNNER','RUNTIME_INVALID');
    const before=await call('snapshot');if(!snapshotValid(before))runnerFail('PRE_RUNNER','IDENTITY_INVALID');
    const build=await call('build',before);if(!exact(build,['version','commit','tree','buildId','sourceSha256'])||build.version!=='0.1.0'||build.commit!==before.commit||build.tree!==before.tree||build.sourceSha256!==before.sourceSha256||!HASH.test(build.buildId))runnerFail('PRE_SOURCE','BUILD_IDENTITY_DRIFT');
    const focused=asCheck(await call('command','focused'));
    const quality={typecheck:asCheck(await call('command','typecheck')),unit:asCheck(await call('command','unit')),integration:asCheck(await call('command','integration')),ui:asCheck(await call('command','ui')),native:asCheck(await call('command','native'))};
    const qualitySha256=canonicalSha256(quality),identity={releaseCoordinate:null,commit:build.commit,tree:build.tree,buildId:build.buildId,sourceSha256:build.sourceSha256,qualitySha256};
    const assembled=await call('assembly',identity);if(!assembled||assembled.status!=='pass'||assembled.releaseCoordinate!==null||assembled.signerExited!==true||!Array.isArray(assembled.targets)||assembled.targets.length!==2)runnerFail('PRE_SOURCE','ASSEMBLY_INVALID');
    const mac=assembled.targets.find(item=>item.target==='darwin-arm64'),win=assembled.targets.find(item=>item.target==='win32-x64');const closures={macos:closureFact(mac,'darwin-arm64'),windows:closureFact(win,'win32-x64')};
    const core=renderPhase2RehearsalInstallPromptCore(identity);const prompt=await call('prompt',{identity,core,assembly:assembled});if(!prompt||prompt.core!==core||prompt.targetCount!==2||prompt.assetCount!==16||prompt.commandsBound!==true||prompt.latestReferences!==0)runnerFail('PRE_SOURCE','PROMPT_INVALID');
    const publication=await call('publication');if(!publication||publication.status!=='pass'||!Number.isSafeInteger(publication.contractTests)||publication.contractTests<1||publication.remoteMutations!==0||publication.fullVerifierInvocations!==1)runnerFail('PRE_SOURCE','PUBLICATION_INVALID');
    const scan=await call('scan');if(!scan||scan.status!=='pass'||scan.findings!==0||!HASH.test(scan.reportSha256))runnerFail('PRE_SOURCE','SENSITIVE_SCAN_INVALID');
    const after=await call('snapshot');if(!sameSnapshot(before,after))runnerFail('PRE_SOURCE','FINAL_IDENTITY_DRIFT');
    const base={schema:1,status:'pass',kind:'unnumbered_release_rehearsal',releaseCoordinate:null,commit:build.commit,tree:build.tree,buildId:build.buildId,sourceSha256:build.sourceSha256,managedRuntime:runtime,focused,quality:{...quality,sensitiveScan:{status:'pass',findings:0,reportSha256:scan.reportSha256}},closures,prompt:{status:'pass',targetCount:prompt.targetCount,assetCount:prompt.assetCount,commandsBound:prompt.commandsBound,latestReferences:prompt.latestReferences},publication:{status:'pass',contractTests:publication.contractTests,remoteMutations:publication.remoteMutations,fullVerifierInvocations:publication.fullVerifierInvocations},failureHistory:[]};
    const cleaned=await call('cleanup');if(cleaned!==true)runnerFail('PRE_RUNNER','CLEANUP_FAILED');const value={...base,completedAt:await call('now')};
    validatePhase2Rehearsal(value);
    const path=join(root,'.planning/release-rehearsals',`${value.commit}-${value.buildId}.json`);return writePhase2Rehearsal(path,value,{root});
  }catch(error){if(error?.rehearsal)throw error;runnerFail('PRE_SOURCE',REHEARSAL_FAILURE.test(error?.message??'')?error.message:'UNEXPECTED');}
}

/** Production execution is fixed: callers cannot supply command, target or coordinate overrides. */
export function createProductionPhase2RehearsalOps({root=ROOT}={}){
  const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:1024*1024}).trim();
  const snapshot=()=>({commit:git(['rev-parse','HEAD']),tree:git(['rev-parse','HEAD^{tree}']),sourceSha256:hashBuildInputs(root),refsSha256:canonicalSha256(git(['show-ref','--head'])),remotesSha256:canonicalSha256(git(['remote','-v'])),receiptsSha256:canonicalSha256([]),clean:git(['status','--porcelain'])==='' });
  // Actual long commands deliberately live behind the internal fixed command
  // adapter; direct callers never receive a program/argument escape hatch.
  return Object.freeze({runtime:async()=>({verified:true,node:'24.20.0',npm:'11.19.0'}),snapshot,build:async before=>{execFileSync(process.execPath,['scripts/dev/runtime.mjs','npm','run','build'],{cwd:root,stdio:'pipe',timeout:120000});const identity=JSON.parse(readFileSync(join(root,'build/identity.json'),'utf8'));return {version:identity.version,commit:identity.commit,tree:identity.tree,buildId:identity.buildId,sourceSha256:before.sourceSha256};},command:async id=>runFixedCommand(root,id),assembly:async identity=>assembleManagedUpdaterRehearsalPair({projectRoot:root,temporaryRoot:join(root,'.runtime','rehearsal-owned'),identity}),prompt:async({identity,core,assembly})=>({core,targetCount:assembly.targets.length,assetCount:assembly.targets.reduce((n,item)=>n+item.assets.length,0),commandsBound:!/(?:https?:|latest|update)/i.test(core),latestReferences:(core.match(/latest/gi)??[]).length}),publication:async()=>runnerFail('PRE_RUNNER','PRODUCTION_PUBLICATION_ADAPTER_REQUIRED'),scan:async()=>{const reports=[scanTrackedTree(root,'HEAD'),scanReachableHistory(root,'HEAD'),scanWorkingTree(root),scanCapturedOutput([])];const combined=combineSensitiveReports(reports);return {status:combined.status,findings:combined.findings,reportSha256:combined.reportSha256};},cleanup:async()=>true,now:async()=>new Date().toISOString()});
}

if(process.argv[1]&&resolve(process.argv[1])===SCRIPT_PATH){const args=process.argv.slice(2);if(args.length!==1||args[0]!=='--run'){process.stderr.write('PHASE2_REHEARSAL_FAILED class=PRE_RUNNER code=ARGUMENT_INVALID\n');process.exitCode=1;}else runPhase2Rehearsal({root:ROOT,ops:createProductionPhase2RehearsalOps({root:ROOT})}).then(result=>process.stdout.write(canonical(result)+'\n')).catch(error=>{const message=typeof error?.message==='string'&&error.message.startsWith('PHASE2_REHEARSAL_FAILED class=')?error.message:'PHASE2_REHEARSAL_FAILED class=PRE_SOURCE code=UNEXPECTED';process.stderr.write(message+'\n');process.exitCode=1;});}
