#!/usr/bin/env node
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {closeSync,existsSync,fsyncSync,linkSync,openSync,readFileSync,unlinkSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const SCRIPT_PATH=fileURLToPath(import.meta.url);
const REPO_ROOT=resolve(dirname(SCRIPT_PATH),'../..');
const HASH=/^[a-f0-9]{64}$/;
const GIT_HASH=/^[a-f0-9]{40}$/;
const VERSION=/^0\.1\.0-beta\.[1-9]\d*$/;
const ISO=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&/(?:Z|[+-]\d\d:\d\d)$/.test(value);
const FIXED_FINGERPRINT='fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557';
const FIXED_LICENSE='PolyForm-Noncommercial-1.0.0';
const FIXED_GAPS=Object.freeze({windowsNative:'not_run/human_needed',live:'not_run/human_needed',phase3:'blocked'});
const SUITES=['typecheck','unit','integration','ui','native'];
const SCAN_SURFACES=['tracked','history','working_tree','captured_output'];

export const PHASE2_BUILD_OBLIGATIONS=Object.freeze([
  'auth01.sealed_source_contract',
  'auth03.state_contract',
  'auth03.persistence_isolation',
  'auth04.ownership_contract',
  'auth04.ownership_integration',
  'sec02.fixed_operations_contract',
  'sec02.fixed_operations_integration',
  'uat01.distribution_contract',
]);

export const PHASE2_CAPABILITIES=Object.freeze([
  'workflow.paired_server.start',
  'workflow.paired_server.resume',
  'workflow.paired_server.submit',
  'workflow.paired_server.cancel',
  'live.record.A1',
  'live.record.A2',
  'live.record.B3',
  'live.record.reauth',
  'live.verify.A1',
  'live.verify.A2',
  'live.verify.B1.1',
  'live.verify.B1.2',
  'live.verify.B1.3',
  'live.verify.B2',
  'live.verify.B3',
  'live.verify.C',
  'live.verify.D',
  'live.verify.reauth',
  'live.audit.macos',
  'live.audit.windows',
  'live.final',
  'update.pre.macos',
  'update.post.macos',
  'update.pre.windows',
  'update.post.windows',
  'native.macos',
  'native.windows',
]);

export const PHASE2_RELEASE_MEMBERS=Object.freeze([
  'LICENSE',
  'LICENSING.md',
  'dist/apps/api/src/auth.js',
  'dist/apps/api/src/main.js',
  'dist/apps/status/main.js',
  'dist/packages/application/src/live-checkpoints.js',
  'dist/packages/contracts/src/live-evidence.js',
  'dist/packages/domain/src/live-evidence.js',
  'dist/packages/persistence/src/auth.js',
  'dist/build/identity.json',
  'dist/build/phase2-test-report.json',
  'diagnostics/native-report.mjs',
  'phase2/install-prompt-core.md',
  'scripts/release/phase2-live-gate.mjs',
  'scripts/release/phase2-native-evidence.mjs',
  'scripts/release/verify-phase2-update-gate.mjs',
]);

function fail(code){throw new Error(code);}
function exact(value,keys){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');}
function same(value,expected){return canonicalSha256(value)===canonicalSha256(expected);}
function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const item of Object.values(value))freeze(item);Object.freeze(value);}return value;}
export function canonical(value){if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;return JSON.stringify(value);}
export function canonicalSha256(value){return createHash('sha256').update(Buffer.isBuffer(value)||typeof value==='string'?value:canonical(value)).digest('hex');}
export function phase2VersionSetSha256(values){
  if(!Array.isArray(values)||new Set(values).size!==values.length||values.some(value=>!VERSION.test(value)))fail('PHASE2_VERSION_SET_INVALID');
  const sorted=[...values].sort((a,b)=>Number(a.split('.').at(-1))-Number(b.split('.').at(-1)));return canonicalSha256(sorted);
}

function validGaps(value){return exact(value,['windowsNative','live','phase3'])&&same(value,FIXED_GAPS);}
function validSelection(value){
  const number=VERSION.test(value?.version)?Number(value.version.split('.').at(-1)):NaN,rehearsed=Number.isSafeInteger(number)&&number>31,keys=['schema','status','owner','repository','repositoryId','version','tag','commit','tree','buildId','sourceSha256','versionSetSha256','trustFingerprint','license','immutable','selectedAt','gaps',...(rehearsed?['rehearsalSha256']:[])];
  return exact(value,keys)&&
    value.schema===1&&value.status==='selected'&&value.owner==='returdex'&&value.repository==='returdex/AutoED'&&value.repositoryId===1350421724&&VERSION.test(value.version)&&value.tag===`v${value.version}`&&GIT_HASH.test(value.commit)&&GIT_HASH.test(value.tree)&&HASH.test(value.buildId)&&HASH.test(value.sourceSha256)&&HASH.test(value.versionSetSha256)&&(!rehearsed||HASH.test(value.rehearsalSha256))&&value.trustFingerprint===FIXED_FINGERPRINT&&value.license===FIXED_LICENSE&&value.immutable===true&&ISO(value.selectedAt)&&validGaps(value.gaps);
}

export function validateBuildSelection(value){if(!validSelection(value))fail('PHASE2_SELECTION_INVALID');return freeze(value);}
export function createBuildSelection(value){return validateBuildSelection(structuredClone(value));}
export function verifySelectionCheckout(selectionInput,current){
  const selection=validateBuildSelection(selectionInput);
  if(!exact(current,['commit','tree','sourceSha256'])||current.commit!==selection.commit||current.tree!==selection.tree||current.sourceSha256!==selection.sourceSha256)fail('PHASE2_SELECTION_CHECKOUT_DRIFT');
  return freeze({status:'pass',commit:selection.commit,tree:selection.tree,sourceSha256:selection.sourceSha256});
}

function validSuite(value,sourceSha256){return exact(value,['status','commandSha256','sourceSha256','tests','skipped','todo'])&&value.status==='pass'&&HASH.test(value.commandSha256)&&value.sourceSha256===sourceSha256&&Number.isSafeInteger(value.tests)&&value.tests>0&&value.skipped===0&&value.todo===0;}
function validScan(value){return exact(value,['status','surfaces','findings','reportDigest'])&&value.status==='pass'&&Array.isArray(value.surfaces)&&value.surfaces.join(',')===SCAN_SURFACES.join(',')&&value.findings===0&&HASH.test(value.reportDigest);}
function validObligations(value){if(!Array.isArray(value)||value.length!==PHASE2_BUILD_OBLIGATIONS.length)return false;const byId=new Map(value.map(item=>[item?.id,item]));if(byId.size!==value.length)return false;return PHASE2_BUILD_OBLIGATIONS.every(id=>{const item=byId.get(id);return exact(item,['id','status','reportDigest'])&&item.id===id&&item.status==='pass'&&HASH.test(item.reportDigest);});}
export function validatePhase2TestReport(value,selectionInput){
  const selection=validateBuildSelection(selectionInput);
  if(!exact(value,['schema','status','version','tag','commit','tree','buildId','selectionSha256','sourceSha256','suites','sensitiveScan','obligations','gaps','completedAt'])||value.schema!==1||value.status!=='pass'||value.version!==selection.version||value.tag!==selection.tag||value.commit!==selection.commit||value.tree!==selection.tree||value.buildId!==selection.buildId||value.selectionSha256!==canonicalSha256(selection)||value.sourceSha256!==selection.sourceSha256||!exact(value.suites,SUITES)||SUITES.some(name=>!validSuite(value.suites[name],selection.sourceSha256))||!validScan(value.sensitiveScan)||!validObligations(value.obligations)||!validGaps(value.gaps)||!ISO(value.completedAt))fail('PHASE2_TEST_REPORT_INVALID');
  return freeze(value);
}
export function createPhase2TestReport(value,selection){return validatePhase2TestReport(structuredClone(value),selection);}

export function renderPhase2InstallPromptCore(selectionInput,testReportInput){
  const selection=validateBuildSelection(selectionInput),testReport=validatePhase2TestReport(testReportInput,selection);
  return `# AutoED Phase 2 signed install prompt core

Contract: phase2-install-prompt-core-v1
Repository: returdex/AutoED
Version: ${selection.version}
Tag: ${selection.tag}
Build ID: ${selection.buildId}
Selection SHA-256: ${canonicalSha256(selection)}
Test report SHA-256: ${canonicalSha256(testReport)}
Trust fingerprint: ${selection.trustFingerprint}
License: ${selection.license}

This core is embedded in and covered by the signed capability closure of both target archives. It intentionally contains no enclosing archive name, URL, byte count, or archive SHA-256. Use the separately distributed external install prompt to select the native target and to verify those exact outer-archive descriptors before extraction.

Required procedure:

1. Select only the native operating-system target declared by the external prompt. Windows evidence must come from native Windows; WSL, Linux, JavaScript parity, or macOS evidence cannot substitute for it.
2. Download the complete archive without credentials, ranges, fallback mirrors, or a caller-supplied URL. Verify the exact byte count and SHA-256 from the external prompt before opening it.
3. Verify the fixed Ed25519 fingerprint, signed manifest, signature, capability closure, this core member, unchanged PolyForm Noncommercial 1.0.0 license, dependency closure, target identity, and every declared member before installation.
4. Refuse missing, extra, duplicate, linked, private, sensitive, stale, mismatched, unsigned, alternate-key, or partially downloaded content. Do not accept a substituted external prompt as this signed core.
5. Run the managed prompt-driven update, reload the Codex MCP integration when instructed, and require readiness plus cleanup=complete. 不得覆盖已发布版本，不得强制降级，不得删除课程资料。
6. Do not open a school source or perform official login/MFA during installation. 不得登录，不得读取、请求、记录或返回密码、MFA、输入值或按键。
7. The dedicated Profile is sensitive credential storage. 不得复制或备份 Profile，不得导出 Cookie、storage state、密钥或原始网络捕获。
8. Publication, installation, update, synthetic, integration, or native checks do not create live evidence. Windows remains not_run/human_needed, live remains not_run/human_needed, and Phase 3 remains blocked until the required hard human gates pass.

Expected post-update state: API healthy, Worker healthy, paired UI ready, actual build matched, managed entrypoints matched, cleanup=complete. Any mismatch, cleanup_pending, unavailable signed proof, or unknown ownership is a failure and must stop dependent work.
`;
}

export function verifyPhase2SourceBinding({selection:rawSelection,testReport:rawReport,current}){
  const selection=validateBuildSelection(rawSelection),testReport=validatePhase2TestReport(rawReport,selection);
  if(!exact(current,['commit','tree','buildId','sourceSha256'])||current.commit!==selection.commit||current.tree!==selection.tree||current.buildId!==selection.buildId||current.sourceSha256!==selection.sourceSha256)fail('PHASE2_SOURCE_DRIFT');
  return freeze({schema:1,status:'pass',version:selection.version,tag:selection.tag,commit:selection.commit,tree:selection.tree,buildId:selection.buildId,selectionSha256:canonicalSha256(selection),testReportSha256:canonicalSha256(testReport),sourceSha256:selection.sourceSha256});
}

function readJson(path){try{return JSON.parse(readFileSync(path,'utf8'));}catch{fail('PHASE2_GATE_INPUT_INVALID');}}
function fixedOutput(path,expected){const target=resolve(path);if(target!==join(REPO_ROOT,expected)||existsSync(target))fail('PHASE2_GATE_OUTPUT_INVALID');return target;}
function atomicNoReplace(path,value){const temporary=join(dirname(path),`.phase2-gate-${randomUUID()}`);let fd;try{fd=openSync(temporary,'wx',0o600);writeFileSync(fd,canonical(value)+'\n');fsyncSync(fd);closeSync(fd);fd=undefined;linkSync(temporary,path);unlinkSync(temporary);if(process.platform==='darwin'){const directory=openSync(dirname(path),'r');try{fsyncSync(directory);}finally{closeSync(directory);}}}catch(error){if(fd!==undefined)try{closeSync(fd);}catch{}try{if(existsSync(temporary))unlinkSync(temporary);}catch{}if(error?.code==='EEXIST')fail('PHASE2_GATE_OUTPUT_INVALID');fail('PHASE2_GATE_WRITE_FAILED');}}

async function main(){
  const args=process.argv.slice(2);let result;
  if(args.length===5&&args[0]==='--write-selection'&&args[1]==='--input'&&args[3]==='--out'){
    const value=validateBuildSelection(readJson(resolve(args[2]))),target=fixedOutput(args[4],'release/phase2-build-selection.json');if(Number(value.version.split('.').at(-1))>31){const {readPhase2RehearsalBinding}=await import('./phase2-rehearsal.mjs'),{hashBuildInputs}=await import('../dev/runtime.mjs');readPhase2RehearsalBinding(value);verifySelectionCheckout(value,{commit:execFileSync('git',['rev-parse','HEAD'],{cwd:REPO_ROOT,encoding:'utf8'}).trim(),tree:execFileSync('git',['rev-parse','HEAD^{tree}'],{cwd:REPO_ROOT,encoding:'utf8'}).trim(),sourceSha256:hashBuildInputs(REPO_ROOT)});}atomicNoReplace(target,value);result={status:'selected',version:value.version,buildId:value.buildId,selectionSha256:canonicalSha256(value)};
  }else if(args.length===7&&args[0]==='--write-report'&&args[1]==='--selection'&&args[3]==='--input'&&args[5]==='--out'){
    if(resolve(args[2])!==join(REPO_ROOT,'release/phase2-build-selection.json'))fail('PHASE2_GATE_ARGUMENT_INVALID');const selection=validateBuildSelection(readJson(resolve(args[2]))),value=validatePhase2TestReport(readJson(resolve(args[4])),selection),target=fixedOutput(args[6],'release/phase2-test-report.json');atomicNoReplace(target,value);result={status:'pass',version:value.version,buildId:value.buildId,testReportSha256:canonicalSha256(value)};
  }else if(args.length===3&&args[0]==='--validate-selection'&&args[2]==='--read-only'){
    const value=validateBuildSelection(readJson(resolve(args[1])));if(Number(value.version.split('.').at(-1))>31){const {readPhase2RehearsalBinding}=await import('./phase2-rehearsal.mjs');readPhase2RehearsalBinding(value);}result={status:'pass',version:value.version,buildId:value.buildId,selectionSha256:canonicalSha256(value)};
  }else if(args.length===4&&args[0]==='--validate-report'&&args[3]==='--read-only'){
    const selection=validateBuildSelection(readJson(resolve(args[1]))),value=validatePhase2TestReport(readJson(resolve(args[2])),selection);result={status:'pass',version:value.version,buildId:value.buildId,testReportSha256:canonicalSha256(value)};
  }else fail('PHASE2_GATE_ARGUMENT_INVALID');
  process.stdout.write(canonical(result)+'\n');
}
if(process.argv[1]&&resolve(process.argv[1])===SCRIPT_PATH){main().catch(error=>{const code=/^PHASE2_[A-Z0-9_]+$/.test(error?.message??'')?error.message:'PHASE2_GATE_FAILED';process.stderr.write(code+'\n');process.exitCode=1;});}
