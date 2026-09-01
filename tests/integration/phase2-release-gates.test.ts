import {createHash,generateKeyPairSync,sign,verify} from 'node:crypto';
import {mkdirSync,mkdtempSync,readFileSync,realpathSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {afterEach,expect,it} from 'vitest';
import {
  PHASE2_BUILD_OBLIGATIONS,
  PHASE2_CAPABILITIES,
  PHASE2_RELEASE_MEMBERS,
  canonicalSha256,
  validateBuildSelection,
  validatePhase2TestReport,
  verifyPhase2SourceBinding,
} from '../../scripts/release/phase2-gate.mjs';
import {
  createPhase2CapabilityManifest,
  verifyPhase2CapabilityClosure,
  verifyPhase2SignedClosure,
} from '../../scripts/build/assemble.mjs';
import {validatePhase2ArtifactReceipt} from '../../scripts/release/preflight.mjs';

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
  const selected=selection(),tested=report(selected),target={name:'autoed-0.1.0-beta.21-darwin-arm64.tar.gz',localPath:'.runtime/releases/0.1.0-beta.21/darwin.tar.gz',url:'https://github.com/returdex/AutoED/releases/download/0.1.0-beta.21/autoed-0.1.0-beta.21-darwin-arm64.tar.gz',bytes:123,sha256:hash('1'),manifestSha256:hash('2'),signatureSha256:hash('3'),capabilityClosureSha256:hash('4')};
  const value={schema:1,status:'built_signed_verified_local',owner:'returdex',repository:'returdex/AutoED',repositoryId:1350421724,version:selected.version,tag:selected.tag,commit:selected.commit,tree:selected.tree,buildId:selected.buildId,selectionSha256:canonicalSha256(selected),testReportSha256:canonicalSha256(tested),sourceSha256:selected.sourceSha256,manifestSha256:hash('5'),fingerprint:selected.trustFingerprint,license:selected.license,immutable:true,promptSha256:hash('6'),capabilitiesSha256:canonicalSha256(PHASE2_CAPABILITIES),targets:{macos:target,windows:{...target,name:target.name.replace('darwin-arm64','win32-x64'),localPath:target.localPath.replace('darwin','windows'),url:target.url.replaceAll('darwin-arm64','win32-x64')}},gaps:selected.gaps};
  expect(validatePhase2ArtifactReceipt(value,{selection:selected,testReport:tested})).toEqual(value);
  expect(()=>validatePhase2ArtifactReceipt({...value,fingerprint:hash('f')},{selection:selected,testReport:tested})).toThrow('PHASE2_ARTIFACTS_INVALID');
  expect(()=>validatePhase2ArtifactReceipt({...value,license:'Apache-2.0'},{selection:selected,testReport:tested})).toThrow('PHASE2_ARTIFACTS_INVALID');
  expect(()=>validatePhase2ArtifactReceipt({...value,gaps:{...value.gaps,phase3:'eligible'}},{selection:selected,testReport:tested})).toThrow('PHASE2_ARTIFACTS_INVALID');
  expect(()=>validatePhase2ArtifactReceipt({...value,targets:{...value.targets,macos:{...target,name:'Profile.tar.gz'}}},{selection:selected,testReport:tested})).toThrow('PHASE2_ARTIFACTS_INVALID');
});
