import {createHash,generateKeyPairSync,sign,verify} from 'node:crypto';
import {mkdirSync,mkdtempSync,readFileSync,readdirSync,realpathSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {afterEach,expect,it} from 'vitest';
import {
  PHASE2_BUILD_OBLIGATIONS,
  PHASE2_CAPABILITIES,
  PHASE2_RELEASE_MEMBERS,
  canonicalSha256,
  renderPhase2InstallPromptCore,
  validateBuildSelection,
  validatePhase2TestReport,
  verifyPhase2SourceBinding,
} from '../../scripts/release/phase2-gate.mjs';
import {
  createPhase2CapabilityManifest,
  verifyPhase2CapabilityClosure,
  verifyPhase2SignedClosure,
} from '../../scripts/build/assemble.mjs';
import {
  renderPhase2ExternalInstallPrompt,
  validatePhase2ArtifactReceipt,
  validatePhase2InstallPrompt,
  validatePhase2InstallPromptCore,
} from '../../scripts/release/preflight.mjs';
import {publishPhase2Release} from '../../scripts/release/publish.mjs';
import {verifyPhase2Availability} from '../../scripts/release/verify-availability.mjs';
import {verifyPhase2UpdateGate} from '../../scripts/release/verify-phase2-update-gate.mjs';

const roots:string[]=[];
afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
const sha=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
const hash=(character:string)=>character.repeat(64);
const commit=(character:string)=>character.repeat(40);
const now='2026-09-01T10:00:00.000Z';

function selection(){
  return {
    schema:1,status:'selected',owner:'returdex',repository:'returdex/AutoED',repositoryId:1350421724,
    version:'0.1.0-beta.21',tag:'v0.1.0-beta.21',commit:commit('a'),tree:commit('b'),buildId:hash('c'),
    sourceSha256:hash('d'),versionSetSha256:hash('e'),trustFingerprint:'fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557',
    license:'PolyForm-Noncommercial-1.0.0',immutable:true,selectedAt:now,
    gaps:{windowsNative:'not_run/human_needed',live:'not_run/human_needed',phase3:'blocked'},
  } as const;
}

function report(selected=selection()){
  const suite=(marker:string,tests:number)=>({status:'pass',commandSha256:hash(marker),sourceSha256:selected.sourceSha256,tests,skipped:0,todo:0});
  return {
    schema:1,status:'pass',version:selected.version,tag:selected.tag,commit:selected.commit,tree:selected.tree,buildId:selected.buildId,
    selectionSha256:canonicalSha256(selected),sourceSha256:selected.sourceSha256,
    suites:{typecheck:suite('1',1),unit:suite('2',50),integration:suite('3',80),ui:suite('4',10),native:suite('5',20)},
    sensitiveScan:{status:'pass',surfaces:['tracked','history','working_tree','captured_output'],findings:0,reportDigest:hash('6')},
    obligations:PHASE2_BUILD_OBLIGATIONS.map((id,index)=>({id,status:'pass',reportDigest:sha(`${index}:${id}`)})),
    gaps:{windowsNative:'not_run/human_needed',live:'not_run/human_needed',phase3:'blocked'},completedAt:now,
  } as const;
}

function makeRoot(){const root=realpathSync(mkdtempSync(join(tmpdir(),'autoed-phase2-release-')));roots.push(root);return root;}
function write(root:string,path:string,bytes:string){const target=join(root,path);mkdirSync(dirname(target),{recursive:true,mode:0o700});writeFileSync(target,bytes,{mode:0o600});}
function targetRoot(label:string){const root=makeRoot();for(const [index,path] of PHASE2_RELEASE_MEMBERS.entries())write(root,path,`${label}:${index}:${path}`);return root;}
function artifactReceipt(selected=selection(),tested=report(selected),bodies={macos:Buffer.from('macos archive'),windows:Buffer.from('windows archive')}){
  const target=(platform:'macos'|'windows')=>{const token=platform==='macos'?'darwin-arm64':'win32-x64',body=bodies[platform],name=`autoed-${selected.version}-${token}.tar.gz`;return{name,localPath:`.runtime/releases/${selected.version}/${name}`,url:`https://github.com/returdex/AutoED/releases/download/${selected.tag}/${name}`,bytes:body.length,sha256:sha(body),manifestSha256:hash(platform==='macos'?'7':'8'),signatureSha256:hash(platform==='macos'?'9':'a'),capabilityClosureSha256:hash('4')};};
  const installPromptCore=renderPhase2InstallPromptCore(selected,tested),draft={schema:1,status:'built_signed_verified_local',owner:'returdex',repository:'returdex/AutoED',repositoryId:1350421724,version:selected.version,tag:selected.tag,commit:selected.commit,tree:selected.tree,buildId:selected.buildId,selectionSha256:canonicalSha256(selected),testReportSha256:canonicalSha256(tested),sourceSha256:selected.sourceSha256,versionSetSha256:selected.versionSetSha256,manifestSha256:hash('5'),fingerprint:selected.trustFingerprint,license:selected.license,immutable:true,installPromptCoreSha256:sha(installPromptCore),externalPromptSha256:hash('6'),capabilitiesSha256:canonicalSha256(PHASE2_CAPABILITIES),targets:{macos:target('macos'),windows:target('windows')},gaps:selected.gaps},externalPrompt=renderPhase2ExternalInstallPrompt(draft)!;
  return {...draft,externalPromptSha256:sha(externalPrompt)};
}

it('quality gate binds exact selection and test-report schema to one source identity',()=>{
  const selected=selection(),tested=report(selected);
  expect(validateBuildSelection(selected)).toEqual(selected);
  expect(validatePhase2TestReport(tested,selected)).toEqual(tested);
  expect(verifyPhase2SourceBinding({selection:selected,testReport:tested,current:{commit:selected.commit,tree:selected.tree,buildId:selected.buildId,sourceSha256:selected.sourceSha256}})).toMatchObject({status:'pass',version:selected.version,buildId:selected.buildId});
  expect(()=>validateBuildSelection({...selected,extra:true})).toThrow('PHASE2_SELECTION_INVALID');
  expect(()=>validatePhase2TestReport({...tested,selectionSha256:hash('f')},selected)).toThrow('PHASE2_TEST_REPORT_INVALID');
  expect(()=>verifyPhase2SourceBinding({selection:selected,testReport:tested,current:{commit:selected.commit,tree:commit('f'),buildId:selected.buildId,sourceSha256:selected.sourceSha256}})).toThrow('PHASE2_SOURCE_DRIFT');
});

it('quality gate rejects partial suites, skip/todo state, missing obligations and unsafe scan output',()=>{
  const selected=selection(),tested=report(selected);
  expect(()=>validatePhase2TestReport({...tested,suites:{...tested.suites,integration:{...tested.suites.integration,status:'fail'}}},selected)).toThrow('PHASE2_TEST_REPORT_INVALID');
  expect(()=>validatePhase2TestReport({...tested,suites:{...tested.suites,ui:{...tested.suites.ui,skipped:1}}},selected)).toThrow('PHASE2_TEST_REPORT_INVALID');
  expect(()=>validatePhase2TestReport({...tested,obligations:tested.obligations.slice(1)},selected)).toThrow('PHASE2_TEST_REPORT_INVALID');
  expect(()=>validatePhase2TestReport({...tested,sensitiveScan:{...tested.sensitiveScan,findings:1}},selected)).toThrow('PHASE2_TEST_REPORT_INVALID');
});

it('capability closure requires identical durable workflow and canonical gate members in both targets',()=>{
  const mac=targetRoot('same'),windows=targetRoot('same'),selected=selection(),tested=report(selected);
  const macManifest=createPhase2CapabilityManifest({root:mac,selection:selected,testReport:tested});
  const windowsManifest=createPhase2CapabilityManifest({root:windows,selection:selected,testReport:tested});
  expect(macManifest.capabilities).toEqual(PHASE2_CAPABILITIES);
  expect(verifyPhase2CapabilityClosure({selection:selected,testReport:tested,targets:{macos:{root:mac,manifest:macManifest},windows:{root:windows,manifest:windowsManifest}}})).toMatchObject({status:'pass',memberCount:PHASE2_RELEASE_MEMBERS.length,capabilityCount:PHASE2_CAPABILITIES.length});
  rmSync(join(windows,PHASE2_RELEASE_MEMBERS[0]!));
  expect(()=>verifyPhase2CapabilityClosure({selection:selected,testReport:tested,targets:{macos:{root:mac,manifest:macManifest},windows:{root:windows,manifest:windowsManifest}}})).toThrow('PHASE2_CAPABILITY_CLOSURE_INVALID');
});

it('capability closure rejects wrong member bytes, stale source and a missing canonical branch',()=>{
  const mac=targetRoot('same'),windows=targetRoot('same'),selected=selection(),tested=report(selected);
  const macManifest=createPhase2CapabilityManifest({root:mac,selection:selected,testReport:tested});
  const windowsManifest=createPhase2CapabilityManifest({root:windows,selection:selected,testReport:tested});
  write(windows,PHASE2_RELEASE_MEMBERS[1]!,'tampered');
  expect(()=>verifyPhase2CapabilityClosure({selection:selected,testReport:tested,targets:{macos:{root:mac,manifest:macManifest},windows:{root:windows,manifest:windowsManifest}}})).toThrow('PHASE2_CAPABILITY_CLOSURE_INVALID');
  const bad={...macManifest,capabilities:macManifest.capabilities.slice(1)};
  expect(()=>verifyPhase2CapabilityClosure({selection:selected,testReport:tested,targets:{macos:{root:mac,manifest:bad},windows:{root:mac,manifest:macManifest}}})).toThrow('PHASE2_CAPABILITY_CLOSURE_INVALID');
  expect(()=>createPhase2CapabilityManifest({root:mac,selection:{...selected,tree:commit('f')},testReport:tested})).toThrow('PHASE2_SOURCE_DRIFT');
});

it('sensitive member scan permits declared cookie dependencies but rejects runtime credential artifacts',()=>{
  const selected=selection(),tested=report(selected),production=targetRoot('production');
  for(const path of [
    'node_modules/@fastify/cookie/index.js',
    'node_modules/cookie/index.js',
    'node_modules/light-my-request/node_modules/cookie/index.js',
  ])write(production,path,'declared production dependency');
  expect(createPhase2CapabilityManifest({root:production,selection:selected,testReport:tested})).toMatchObject({status:'closed'});

  for(const path of ['runtime/Profile/state.json','runtime/Cookie','runtime/Cookies']){
    const root=targetRoot('private');write(root,path,'credential artifact');
    expect(()=>createPhase2CapabilityManifest({root,selection:selected,testReport:tested})).toThrow('PHASE2_SENSITIVE_MEMBER');
  }
});

it('two-layer install prompt signs an archive-independent core and externally binds both exact targets',()=>{
  const selected=selection(),tested=report(selected),core=renderPhase2InstallPromptCore(selected,tested),release=artifactReceipt(selected,tested),external=renderPhase2ExternalInstallPrompt(release)!;
  expect(PHASE2_RELEASE_MEMBERS).toContain('phase2/install-prompt-core.md');
  expect(validatePhase2InstallPromptCore(core,{selection:selected,testReport:tested})).toBe(core);
  expect(validatePhase2InstallPrompt(external,release)).toBe(external);
  expect(sha(core)).toBe(release.installPromptCoreSha256);
  expect(sha(external)).toBe(release.externalPromptSha256);
  for(const target of Object.values(release.targets)){
    expect(core).not.toContain(target.name);expect(core).not.toContain(target.url);expect(core).not.toContain(`Exact bytes: ${target.bytes}`);expect(core).not.toContain(target.sha256);
    expect(external).toContain(target.name);expect(external).toContain(target.url);expect(external).toContain(String(target.bytes));expect(external).toContain(target.sha256);
  }
  expect(external).toContain(release.installPromptCoreSha256);
  expect(external).not.toContain(release.externalPromptSha256);
});

it('two-layer prompt rejects core/external tamper, target substitution, cross-target reuse and self-reference',()=>{
  const selected=selection(),tested=report(selected),core=renderPhase2InstallPromptCore(selected,tested),release=artifactReceipt(selected,tested),external=renderPhase2ExternalInstallPrompt(release)!;
  expect(()=>validatePhase2InstallPromptCore(core+'tamper',{selection:selected,testReport:tested})).toThrow('PHASE2_PROMPT_CORE_INVALID');
  expect(()=>validatePhase2InstallPrompt(external.replace(release.targets.macos.sha256,hash('f')),release)).toThrow('PHASE2_PROMPT_INVALID');
  const swapped={...release,targets:{macos:release.targets.windows,windows:release.targets.macos}};
  expect(()=>validatePhase2InstallPrompt(external,swapped)).toThrow('PHASE2_PROMPT_INVALID');
  expect(()=>validatePhase2InstallPrompt(external+`\nself=${release.externalPromptSha256}\n`,release)).toThrow('PHASE2_PROMPT_INVALID');
  const mac=targetRoot('same'),windows=targetRoot('same');write(mac,'phase2/install-prompt-core.md',core);write(windows,'phase2/install-prompt-core.md',core);
  const macManifest=createPhase2CapabilityManifest({root:mac,selection:selected,testReport:tested}),windowsManifest=createPhase2CapabilityManifest({root:windows,selection:selected,testReport:tested});
  write(windows,'phase2/install-prompt-core.md',core+'tamper');
  expect(()=>verifyPhase2CapabilityClosure({selection:selected,testReport:tested,targets:{macos:{root:mac,manifest:macManifest},windows:{root:windows,manifest:windowsManifest}}})).toThrow('PHASE2_CAPABILITY_CLOSURE_INVALID');
});

it('signed assembly accepts only the approved Ed25519 fingerprint and exact capability closure',()=>{
  const mac=targetRoot('same'),windows=targetRoot('same'),selected=selection(),tested=report(selected),closure=createPhase2CapabilityManifest({root:mac,selection:selected,testReport:tested});
  const {privateKey,publicKey}=generateKeyPairSync('ed25519'),bytes=Buffer.from(JSON.stringify({schema:1,selectionSha256:canonicalSha256(selected),testReportSha256:canonicalSha256(tested),capabilityClosureSha256:canonicalSha256(closure)})),signature=sign(null,bytes,privateKey);
  const fingerprint=sha(publicKey.export({type:'spki',format:'der'}));
  const verifyManifest=(payload:Buffer,sig:Buffer)=>verify(null,payload,publicKey,sig)?{fingerprint,selectionSha256:canonicalSha256(selected),testReportSha256:canonicalSha256(tested),capabilityClosureSha256:canonicalSha256(closure)}:null;
  expect(verifyPhase2SignedClosure({bytes,signature,expectedFingerprint:fingerprint,selection:selected,testReport:tested,closure,verifyManifest})).toMatchObject({status:'pass',fingerprint});
  expect(()=>verifyPhase2SignedClosure({bytes,signature,expectedFingerprint:hash('f'),selection:selected,testReport:tested,closure,verifyManifest})).toThrow('PHASE2_SIGNED_CLOSURE_INVALID');
  expect(()=>verifyPhase2SignedClosure({bytes:Buffer.from('changed'),signature,expectedFingerprint:fingerprint,selection:selected,testReport:tested,closure,verifyManifest})).toThrow('PHASE2_SIGNED_CLOSURE_INVALID');
});

it('artifact preflight rejects alternate trust, license/support drift and private release members',()=>{
  const selected=selection(),tested=report(selected),target={name:'autoed-0.1.0-beta.21-darwin-arm64.tar.gz',localPath:'.runtime/releases/0.1.0-beta.21/darwin.tar.gz',url:'https://github.com/returdex/AutoED/releases/download/v0.1.0-beta.21/autoed-0.1.0-beta.21-darwin-arm64.tar.gz',bytes:123,sha256:hash('1'),manifestSha256:hash('2'),signatureSha256:hash('3'),capabilityClosureSha256:hash('4')};
  const core=renderPhase2InstallPromptCore(selected,tested),draft={schema:1,status:'built_signed_verified_local',owner:'returdex',repository:'returdex/AutoED',repositoryId:1350421724,version:selected.version,tag:selected.tag,commit:selected.commit,tree:selected.tree,buildId:selected.buildId,selectionSha256:canonicalSha256(selected),testReportSha256:canonicalSha256(tested),sourceSha256:selected.sourceSha256,versionSetSha256:selected.versionSetSha256,manifestSha256:hash('5'),fingerprint:selected.trustFingerprint,license:selected.license,immutable:true,installPromptCoreSha256:sha(core),externalPromptSha256:hash('6'),capabilitiesSha256:canonicalSha256(PHASE2_CAPABILITIES),targets:{macos:target,windows:{...target,name:target.name.replace('darwin-arm64','win32-x64'),localPath:target.localPath.replace('darwin','windows'),url:target.url.replaceAll('darwin-arm64','win32-x64')}},gaps:selected.gaps},external=renderPhase2ExternalInstallPrompt(draft)!,value={...draft,externalPromptSha256:sha(external)};
  expect(validatePhase2ArtifactReceipt(value,{selection:selected,testReport:tested})).toEqual(value);
  expect(()=>validatePhase2ArtifactReceipt({...value,fingerprint:hash('f')},{selection:selected,testReport:tested})).toThrow('PHASE2_ARTIFACTS_INVALID');
  expect(()=>validatePhase2ArtifactReceipt({...value,license:'Apache-2.0'},{selection:selected,testReport:tested})).toThrow('PHASE2_ARTIFACTS_INVALID');
  expect(()=>validatePhase2ArtifactReceipt({...value,gaps:{...value.gaps,phase3:'eligible'}},{selection:selected,testReport:tested})).toThrow('PHASE2_ARTIFACTS_INVALID');
  expect(()=>validatePhase2ArtifactReceipt({...value,targets:{...value.targets,macos:{...target,name:'Profile.tar.gz'}}},{selection:selected,testReport:tested})).toThrow('PHASE2_ARTIFACTS_INVALID');
});

it('immutable publication writes one no-overwrite receipt only after exact remote confirmation',async()=>{
  const release=artifactReceipt(),directory=makeRoot(),receiptPath=join(directory,'publication.json'),assets=Object.fromEntries(Object.entries(release.targets).map(([platform,target],index)=>[platform,{id:100+index,name:target.name,bytes:target.bytes,sha256:target.sha256,url:target.url}])),before={schema:1,owner:'returdex',repositoryId:1350421724,versions:['0.1.0-beta.19','0.1.0-beta.20'],versionSetSha256:selection().versionSetSha256,tag:null,release:null,assets:[]},after={...before,versions:[...before.versions,release.version],tag:{name:release.tag,commit:release.commit,immutable:true},release:{version:release.version,tag:release.tag,buildId:release.buildId,immutable:true},assets,metadata:{manifestSha256:release.manifestSha256,installPromptCoreSha256:release.installPromptCoreSha256,externalPromptSha256:release.externalPromptSha256,capabilitiesSha256:release.capabilitiesSha256}};let observations=0,publishes=0;
  const deps={receiptRoot:directory,now:()=>Date.parse(now),preflight:async()=>({status:'pass'}),observeRemote:async()=>++observations===1?before:after,publish:async()=>{publishes++;return after;}};
  await expect(publishPhase2Release({release,receiptPath,deps})).resolves.toMatchObject({schema:1,status:'pass',owner:'returdex',repositoryId:1350421724,version:release.version,tag:release.tag,immutable:true,assets});
  expect(publishes).toBe(1);expect(JSON.parse(readFileSync(receiptPath,'utf8'))).toMatchObject({status:'pass',assets});
  await expect(publishPhase2Release({release,receiptPath,deps})).rejects.toThrow('PHASE2_PUBLICATION_RECEIPT_EXISTS');expect(publishes).toBe(1);
});

it('immutable publication rejects version races, higher partial beta and conflicting remote assets without mutation',async()=>{
  const release=artifactReceipt(),directory=makeRoot();for(const remote of [
    {schema:1,owner:'returdex',repositoryId:1350421724,versions:['0.1.0-beta.22'],versionSetSha256:selection().versionSetSha256,tag:null,release:null,assets:[]},
    {schema:1,owner:'returdex',repositoryId:1350421724,versions:['0.1.0-beta.19','0.1.0-beta.20'],versionSetSha256:selection().versionSetSha256,tag:{name:release.tag,commit:commit('f'),immutable:true},release:null,assets:[]},
    {schema:1,owner:'returdex',repositoryId:1350421724,versions:['0.1.0-beta.19','0.1.0-beta.20'],versionSetSha256:selection().versionSetSha256,tag:null,release:null,assets:[{id:7,name:release.targets.macos.name,bytes:1,sha256:hash('f'),url:release.targets.macos.url}]},
  ]){let publishes=0;await expect(publishPhase2Release({release,receiptPath:join(directory,`${publishes}-${Math.random()}.json`),deps:{receiptRoot:directory,now:()=>Date.parse(now),preflight:async()=>({status:'pass'}),observeRemote:async()=>remote,publish:async()=>{publishes++;return remote;}}})).rejects.toThrow(/^PHASE2_PUBLICATION_/);expect(publishes).toBe(0);}
});

it('anonymous availability refetches full bytes and binds hashes, signatures, prompt and capability closure',async()=>{
  const bodies={macos:Buffer.from('macos archive'),windows:Buffer.from('windows archive')},release=artifactReceipt(selection(),report(),bodies),assets=Object.fromEntries(Object.entries(release.targets).map(([platform,target],index)=>[platform,{id:200+index,name:target.name,bytes:target.bytes,sha256:target.sha256,url:target.url}])),publication={schema:1,status:'pass',owner:'returdex',repositoryId:1350421724,version:release.version,tag:release.tag,buildId:release.buildId,manifestSha256:release.manifestSha256,immutable:true,assets,checkedAt:now},temporaryParent=makeRoot();let requests=0;
  const result=await verifyPhase2Availability({release,publication,deps:{temporaryParent,now:()=>Date.parse(now),fetchMetadata:async()=>({schema:1,owner:'returdex',repositoryId:1350421724,version:release.version,tag:release.tag,buildId:release.buildId,manifestSha256:release.manifestSha256,installPromptCoreSha256:release.installPromptCoreSha256,externalPromptSha256:release.externalPromptSha256,capabilitiesSha256:release.capabilitiesSha256,immutable:true,assets}),fetchAsset:async(url:string,options:{headers:Record<string,string>})=>{requests++;expect(options.headers.authorization).toBeUndefined();const platform=url.includes('darwin')?'macos':'windows',body=bodies[platform];return{status:200,finalUrl:`https://release-assets.githubusercontent.com/${platform}`,headers:new Map([['content-length',String(body.length)]]),arrayBuffer:async()=>body};},verifyTarget:async(platform:'macos'|'windows',bytes:Buffer)=>{expect(bytes.equals(bodies[platform])).toBe(true);return{fingerprint:release.fingerprint,manifestSha256:release.targets[platform].manifestSha256,signatureSha256:release.targets[platform].signatureSha256,capabilityClosureSha256:release.targets[platform].capabilityClosureSha256,installPromptCoreSha256:release.installPromptCoreSha256};}}});
  expect(result).toMatchObject({schema:1,status:'pass',anonymous:true,immutable:true,version:release.version,tag:release.tag,buildId:release.buildId,manifestSha256:release.manifestSha256,assets,checkedAt:now});expect(requests).toBe(2);expect(readdirSync(temporaryParent)).toEqual([]);
});

it('anonymous availability rejects partial/authenticated fetch, redirect substitution and content drift',async()=>{
  const bodies={macos:Buffer.from('macos archive'),windows:Buffer.from('windows archive')},release=artifactReceipt(selection(),report(),bodies),assets=Object.fromEntries(Object.entries(release.targets).map(([platform,target],index)=>[platform,{id:300+index,name:target.name,bytes:target.bytes,sha256:target.sha256,url:target.url}])),publication={schema:1,status:'pass',owner:'returdex',repositoryId:1350421724,version:release.version,tag:release.tag,buildId:release.buildId,manifestSha256:release.manifestSha256,immutable:true,assets,checkedAt:now},metadata={schema:1,owner:'returdex',repositoryId:1350421724,version:release.version,tag:release.tag,buildId:release.buildId,manifestSha256:release.manifestSha256,installPromptCoreSha256:release.installPromptCoreSha256,externalPromptSha256:release.externalPromptSha256,capabilitiesSha256:release.capabilitiesSha256,immutable:true,assets};
  for(const response of [{status:206,finalUrl:'https://release-assets.githubusercontent.com/x',body:bodies.macos},{status:200,finalUrl:'https://evil.example/x',body:bodies.macos},{status:200,finalUrl:'https://release-assets.githubusercontent.com/x',body:Buffer.from('changed')}])await expect(verifyPhase2Availability({release,publication,deps:{temporaryParent:makeRoot(),now:()=>Date.parse(now),fetchMetadata:async()=>metadata,fetchAsset:async(_url:string,options:{headers:Record<string,string>})=>{expect(options.headers.authorization).toBeUndefined();return{status:response.status,finalUrl:response.finalUrl,headers:new Map([['content-length',String(response.body.length)]]),arrayBuffer:async()=>response.body};},verifyTarget:async()=>({fingerprint:release.fingerprint,manifestSha256:hash('7'),signatureSha256:hash('9'),capabilityClosureSha256:hash('4'),installPromptCoreSha256:release.installPromptCoreSha256})}})).rejects.toThrow('PHASE2_AVAILABILITY_FAILED');
  const validFetch=async(url:string)=>{const body=url.includes('darwin')?bodies.macos:bodies.windows;return{status:200,finalUrl:'https://release-assets.githubusercontent.com/x',headers:new Map([['content-length',String(body.length)]]),arrayBuffer:async()=>body};},base={fingerprint:release.fingerprint,manifestSha256:release.targets.macos.manifestSha256,signatureSha256:release.targets.macos.signatureSha256,capabilityClosureSha256:release.targets.macos.capabilityClosureSha256,installPromptCoreSha256:release.installPromptCoreSha256};
  for(const field of ['fingerprint','signatureSha256','capabilityClosureSha256','installPromptCoreSha256'] as const)await expect(verifyPhase2Availability({release,publication,deps:{temporaryParent:makeRoot(),now:()=>Date.parse(now),fetchMetadata:async()=>metadata,fetchAsset:validFetch,verifyTarget:async(platform:'macos'|'windows')=>({...base,manifestSha256:release.targets[platform].manifestSha256,signatureSha256:release.targets[platform].signatureSha256,capabilityClosureSha256:release.targets[platform].capabilityClosureSha256,[field]:hash('f')})}})).rejects.toThrow('PHASE2_AVAILABILITY_FAILED');
});

it('update handoff is read-only and rejects platform spoof or identity drift',async()=>{
  const selected=selection(),tested=report(selected),release=artifactReceipt(selected,tested),prompt=renderPhase2ExternalInstallPrompt(release),assets=Object.fromEntries(Object.entries(release.targets).map(([platform,target],index)=>[platform,{id:400+index,name:target.name,bytes:target.bytes,sha256:target.sha256,url:target.url}])),publication={schema:1,status:'pass',owner:'returdex',repositoryId:1350421724,version:release.version,tag:release.tag,buildId:release.buildId,manifestSha256:release.manifestSha256,immutable:true,assets,checkedAt:now},availability={schema:1,status:'pass',anonymous:true,immutable:true,version:release.version,tag:release.tag,buildId:release.buildId,manifestSha256:release.manifestSha256,assets,checkedAt:now},files=new Map<string,unknown>([['release/phase2-beta-artifacts.json',release],['release/phase2-build-selection.json',selected],['release/phase2-test-report.json',tested],['release/phase2-publication.json',publication],['release/phase2-availability.json',availability]]);let reads=0;
  const deps={nativePlatform:'windows',now:()=>Date.parse(now),readJson:async(path:string)=>{reads++;return structuredClone(files.get(path));},readText:async()=>prompt,readRuntime:async()=>{throw new Error('MUST_NOT_READ_RUNTIME');}};
  const args=['--artifacts','release/phase2-beta-artifacts.json','--tests','release/phase2-test-report.json','--publication','release/phase2-publication.json','--availability','release/phase2-availability.json','--prompt','release/phase2-install-prompt.md','--platform','windows','--read-only'];
  await expect(verifyPhase2UpdateGate(args,deps)).resolves.toMatchObject({schema:1,status:'pass',mode:'pre-update',platform:'windows',buildId:release.buildId,resultCode:'WINDOWS_UPDATE_READY',phase3:'blocked'});expect(reads).toBe(5);
  await expect(verifyPhase2UpdateGate(args,{...deps,nativePlatform:'macos'})).rejects.toThrow('UPDATE_GATE_PLATFORM_INVALID');files.set('release/phase2-availability.json',{...availability,buildId:hash('f')});await expect(verifyPhase2UpdateGate(args,deps)).rejects.toThrow('UPDATE_GATE_AVAILABILITY_INVALID');
});
