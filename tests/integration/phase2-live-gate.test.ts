import {createHash} from 'node:crypto';
import {chmodSync,existsSync,lstatSync,mkdtempSync,mkdirSync,readFileSync,readdirSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach,describe,expect,it} from 'vitest';
import {
  auditPhase2EvidenceMatrix,
  dispatchPhase2LiveGate,
  parsePhase2A1Feedback,
  parsePhase2A2Feedback,
  parsePhase2B3Feedback,
  parsePhase2ReauthFeedback,
  recordPhase2LiveCheckpoint,
  verifyPhase2FinalGate,
  verifyPhase2LiveCheckpoint,
} from '../../scripts/release/phase2-live-gate.mjs';
import {verifyPhase2UpdateGate} from '../../scripts/release/verify-phase2-update-gate.mjs';
import {runPhase2NativeEvidence} from '../../scripts/release/phase2-native-evidence.mjs';
import {PHASE2_BUILD_OBLIGATIONS,PHASE2_CAPABILITIES,renderPhase2InstallPromptCore} from '../../scripts/release/phase2-gate.mjs';
import {renderPhase2ExternalInstallPrompt} from '../../scripts/release/preflight.mjs';
import {NativeEvidenceService} from '../../packages/application/src/live-checkpoints.js';
import {openDatabase} from '../../packages/persistence/src/database.js';
import {SQLiteNativeEvidenceStore} from '../../packages/persistence/src/auth.js';

const canonical=(value:unknown):string=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:value&&typeof value==='object'?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical((value as Record<string,unknown>)[key])}`).join(',')}}`:JSON.stringify(value);
const sha=(value:unknown)=>createHash('sha256').update(Buffer.isBuffer(value)||typeof value==='string'?value:canonical(value)).digest('hex');
const buildId='a'.repeat(64),artifactSha256='b'.repeat(64),manifestSha256='c'.repeat(64),version='0.1.0-beta.20';
const observedAt='2026-09-01T08:00:00.000Z',dObservedAt='2026-09-02T08:00:00.000Z',now=Date.parse('2026-09-02T08:05:00.000Z');
const roots:string[]=[];
afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});

type Source='moodle'|'edstem';
type Scenario='a.login'|'a.binding'|'a.course_visibility'|'b.reopen_1'|'b.reopen_2'|'b.reopen_3'|'b.worker_restart'|'b.codex_exit'|'c.os_restart'|'d.24h_recheck'|'reauth';
function receipt(source:Source,scenario:Scenario,resultCode:string,platform:'macos'|'windows'='macos'){
  return {receiptId:`10000000-0000-4000-8000-${String(receipt.counter++).padStart(12,'0')}`,buildId,version,platform,source,scenario,evidence:'L',status:'pass',resultCode,bindingConsistency:'consistent',identityFingerprint:null,gaps:[],checkedAt:scenario==='d.24h_recheck'?dObservedAt:observedAt,earliestRecheckAt:null,nextAction:'none'};
}
receipt.counter=1;
function status(bindingConsistency:'candidate'|'confirmed'='confirmed'){
  return {overall:{code:'AUTHENTICATED',phase3Eligibility:'blocked',gaps:['WINDOWS_NOT_RUN']},sources:(['moodle','edstem'] as const).map(source=>({source,auth:'authenticated',capability:'available',health:'healthy',freshness:'fresh',completeness:'complete',checkedAt:observedAt,resultCode:'AUTHENTICATED',identityFingerprint:'ABCDEFGHIJKL'})),bindingConsistency};
}
function runtime(overrides:Record<string,unknown>={}){
  return {schema:1,platform:'macos',version,buildId,artifactSha256,manifestSha256,runtimeGeneration:7,phase1:'partial',api:'healthy',worker:'healthy',pairedUi:'ready',cleanup:'complete',checkedAt:observedAt,buildObligations:[],...overrides};
}
function feedbacks(){
  return {
    A1:{checkpoint:'02-16-A1-login',platform:'macos',version,build_id:buildId,moodle:'pass',moodle_code:'AUTHENTICATED',edstem:'pass',edstem_code:'AUTHENTICATED',binding:'candidate',course_visibility:'not_run',content_access:'not_started',windows:'not_run/human_needed',phase3:'blocked',observed_at:observedAt},
    A2:{checkpoint:'A2',platform:'macos',result:'pass',result_code:'A2_COMPLETE',binding:'confirmed',binding_mode:'stable_subject_org_confirmed',moodle_identity:'confirmed',edstem_identity:'confirmed',approved_scope:'matched',moodle_course:'visible',edstem_course:'visible',content_boundary:'preserved',screenshot:'not_used',windows:'not_run/human_needed',phase3:'blocked',observed_at:observedAt},
    B3:{schema:1,checkpoint:'B3',platform:'macos',result:'pass',result_code:'B3_COMPLETE',codex_exit:'observed',backend:'survived',worker:'survived',absent_status_read:'pass',reentry:'actual_client',client_build:'matched',moodle_state:'consistent',edstem_state:'consistent',binding:'confirmed',content_boundary:'preserved',screenshot:'not_used',windows:'not_run/human_needed',phase3:'blocked',observed_at:observedAt},
    reauth:{schema:1,checkpoint:'reauth',platform:'macos',path:'natural_expiry',target_source:'moodle',result:'pass',result_code:'REAUTH_COMPLETE',logout_intent:'not_applicable',automatic_reopen:'none',moodle:'reauthenticated',moodle_code:'AUTHENTICATED',edstem:'followup_authenticated',edstem_code:'AUTHENTICATED',identity_scope:'consistent',source_isolation:'preserved',last_success:'preserved',content_boundary:'preserved',screenshot:'not_used',windows:'not_run/human_needed',phase3:'blocked',observed_at:observedAt},
  } as const;
}
function allReceipts(){
  receipt.counter=1;const map=new Map<string,unknown[]>();
  const put=(source:Source,scenario:Scenario,code:string,platform:'macos'|'windows'='macos')=>map.set(`${platform}|${source}|${scenario}|L`,[receipt(source,scenario,code,platform)]);
  for(const source of ['moodle','edstem'] as const){
    put(source,'a.login','AUTHENTICATED');put(source,'a.binding','BINDING_CONFIRMED');put(source,'a.course_visibility','COURSE_VISIBLE');
    put(source,'b.reopen_1','CHECKPOINT_CONFIRMED');put(source,'b.reopen_2','CHECKPOINT_CONFIRMED');put(source,'b.reopen_3','CHECKPOINT_CONFIRMED');
    put(source,'b.worker_restart','CHECKPOINT_CONFIRMED');put(source,'b.codex_exit','B3_COMPLETE');put(source,'c.os_restart','CHECKPOINT_CONFIRMED');put(source,'d.24h_recheck','CHECKPOINT_CONFIRMED');put(source,'reauth','REAUTH_COMPLETE');
  }
  return map;
}
function fixture(overrides:{runtime?:Record<string,unknown>;status?:ReturnType<typeof status>;receipts?:Map<string,unknown[]>;nowMs?:number}={}){
  const calls={runtime:0,status:0,receipts:0,writes:0,append:0,db:0,profile:0,browser:0,source:0,process:0};const records=overrides.receipts??allReceipts();
  return {calls,now:()=>overrides.nowMs??now,async readRuntime(){calls.runtime++;return runtime(overrides.runtime);},async readStatus(){calls.status++;return overrides.status??status();},async readReceipts(key:{platform:string;source:string;scenario:string;evidence:string}){calls.receipts++;return records.get(`${key.platform}|${key.source}|${key.scenario}|${key.evidence}`)??[];}};
}
function protectedRoot(){const root=mkdtempSync(join(tmpdir(),'autoed-phase2-live-gate-'));roots.push(root);chmodSync(root,0o700);const planning=join(root,'.planning/phases/02-poc-live');mkdirSync(planning,{recursive:true,mode:0o700});chmodSync(join(root,'.planning'),0o700);chmodSync(join(root,'.planning/phases'),0o700);chmodSync(planning,0o700);return root;}
function writeFeedback(root:string,name:string,value:unknown){const directory=join(root,'feedback');if(!existsSync(directory)){mkdirSync(directory,{mode:0o700});chmodSync(directory,0o700);}const path=join(directory,name);writeFileSync(path,JSON.stringify(value),{mode:0o600});chmodSync(path,0o600);return path;}

describe('phase 2 immutable live gate',()=>{
  it('strictly parses the four feedback unions and rejects unknown keys and invalid pass conjunctions',()=>{
    const f=feedbacks();expect(parsePhase2A1Feedback(f.A1)).toEqual(f.A1);expect(parsePhase2A2Feedback(f.A2)).toEqual(f.A2);expect(parsePhase2B3Feedback(f.B3)).toEqual(f.B3);expect(parsePhase2ReauthFeedback(f.reauth)).toEqual(f.reauth);
    for(const [parse,value] of [[parsePhase2A1Feedback,f.A1],[parsePhase2A2Feedback,f.A2],[parsePhase2B3Feedback,f.B3],[parsePhase2ReauthFeedback,f.reauth]] as const){expect(()=>parse({...value,extra:'CANARY_PRIVATE_PATH_/Users/private/Profile'})).toThrow();expect(()=>parse({...value,result:'pass',resultCode:'RESULT_NOT_OBSERVED'})).toThrow();}
  });

  it('records A1 and A2 only at exact allowlisted paths with 0600 atomic no-replace publication',async()=>{
    const root=protectedRoot(),deps=fixture({status:status('candidate')}),f=feedbacks();
    const a1Feedback=writeFeedback(root,'A1-result.json',f.A1),a1Out='.planning/phases/02-poc-live/02-16-A1-RECEIPT.json';
    const a1=await dispatchPhase2LiveGate(['--record','--checkpoint','A1','--feedback',a1Feedback,'--out',a1Out,'--runtime','current','--read-only-inputs'],{...deps,repoRoot:root});
    expect(a1).toMatchObject({schema:1,checkpoint:'02-16-A1-login',resultCode:'A1_AUTHENTICATED',bindingConsistency:'candidate'});expect(lstatSync(join(root,a1Out)).mode&0o777).toBe(0o600);
    const before=readFileSync(join(root,a1Out));await expect(recordPhase2LiveCheckpoint({checkpoint:'A1',feedbackPath:a1Feedback,outPath:a1Out,runtime:'current',readOnlyInputs:true},{...deps,repoRoot:root})).rejects.toThrow('LIVE_GATE_OUTPUT_EXISTS');expect(readFileSync(join(root,a1Out))).toEqual(before);
    const a2Feedback=writeFeedback(root,'A2-result.json',f.A2),a2Out='.planning/phases/02-poc-live/02-17-A2-RECEIPT.json';
    const a2=await dispatchPhase2LiveGate(['--record','--checkpoint','A2','--feedback',a2Feedback,'--out',a2Out,'--a1',a1Out,'--runtime','current','--read-only-inputs'],{...fixture(),repoRoot:root});
    expect(a2).toMatchObject({checkpoint:'02-17-A2-binding-course',resultCode:'A2_COMPLETE',a1ReceiptSha256:sha(before)});expect(lstatSync(join(root,a2Out)).mode&0o777).toBe(0o600);
  });

  it('returns pass-only zero-file B3 and reauth handoffs from exact current L events',async()=>{
    const root=protectedRoot(),f=feedbacks();
    for(const checkpoint of ['B3','reauth'] as const){const deps=fixture();const feedbackPath=writeFeedback(root,`${checkpoint}-result.json`,f[checkpoint]);const before=new Set(readdirSync(root,{recursive:true,encoding:'utf8'}));const result=await dispatchPhase2LiveGate(['--record','--checkpoint',checkpoint,'--feedback',feedbackPath,'--runtime','current','--platform','macos','--read-only-inputs'],{...deps,repoRoot:root});expect(result).toMatchObject({schema:1,status:'pass',checkpoint,platform:'macos',resultCode:checkpoint==='B3'?'B3_COMPLETE':'REAUTH_COMPLETE'});expect(new Set(readdirSync(root,{recursive:true,encoding:'utf8'}))).toEqual(before);expect(deps.calls).toMatchObject({writes:0,append:0,db:0,profile:0,browser:0,source:0,process:0});}
  });

  it('supports every canonical read-only checkpoint for both platforms and exact B1 rounds',async()=>{
    const records=allReceipts();for(const [key,values] of [...records])records.set(key.replace(/^macos/,'windows'),(values as Record<string,unknown>[]).map(value=>({...value,platform:'windows'})));
    for(const platform of ['macos','windows'] as const){
      for(const checkpoint of ['A1','A2','B2','B3','C','D','reauth'] as const)expect(await verifyPhase2LiveCheckpoint({checkpoint,runtime:'current',platform,readOnly:true},fixture({runtime:{platform},receipts:records}))).toMatchObject({schema:1,status:'pass',checkpoint,platform});
      if(platform==='windows')for(const round of [1,2,3] as const)expect(await dispatchPhase2LiveGate(['--verify','--checkpoint','B1','--round',String(round),'--runtime','current','--platform','windows','--read-only'],fixture({runtime:{platform},receipts:records}))).toMatchObject({status:'pass',checkpoint:'B1',round,platform,resultCode:`WINDOWS_B1_REOPEN_${round}_COMPLETE`});
    }
    const root=protectedRoot(),f=feedbacks(),a1Out='.planning/phases/02-poc-live/02-16-A1-RECEIPT.json',a2Out='.planning/phases/02-poc-live/02-17-A2-RECEIPT.json';await recordPhase2LiveCheckpoint({checkpoint:'A1',feedbackPath:writeFeedback(root,'A1.json',f.A1),outPath:a1Out,runtime:'current',readOnlyInputs:true},{...fixture({status:status('candidate'),receipts:records}),repoRoot:root});await recordPhase2LiveCheckpoint({checkpoint:'A2',feedbackPath:writeFeedback(root,'A2.json',f.A2),outPath:a2Out,a1ReceiptPath:a1Out,runtime:'current',readOnlyInputs:true},{...fixture({receipts:records}),repoRoot:root});for(const round of [1,2,3] as const)expect(await dispatchPhase2LiveGate(['--verify','--checkpoint','B1','--round',String(round),'--a2',a2Out,'--runtime','current','--platform','macos','--read-only'],{...fixture({receipts:records}),repoRoot:root})).toMatchObject({status:'pass',resultCode:`B1_REOPEN_${round}_COMPLETE`});
  });

  it('returns deterministic non-mutating D waiting states before accepting due L evidence',async()=>{const records=allReceipts();for(const source of ['moodle','edstem'])records.delete(`macos|${source}|d.24h_recheck|L`);const notDue=await verifyPhase2LiveCheckpoint({checkpoint:'D',runtime:'current',platform:'macos',readOnly:true},fixture({receipts:records,nowMs:Date.parse('2026-09-01T12:00:00.000Z')}));expect(notDue).toMatchObject({status:'human_needed',resultCode:'D_NOT_DUE',actionEligible:false,remainingSeconds:72000});const ready=await verifyPhase2LiveCheckpoint({checkpoint:'D',runtime:'current',platform:'macos',readOnly:true},fixture({receipts:records,nowMs:Date.parse('2026-09-02T08:01:00.000Z')}));expect(ready).toMatchObject({status:'human_needed',resultCode:'D_READY_NOT_RUN',actionEligible:true,remainingSeconds:0});});

  it('fails closed for missing duplicate conflicting corrected substituted stale or future events without mutation',async()=>{
    const mutations=[
      ()=>[],
      (base:unknown[])=>[...base,...base],
      (base:Record<string,unknown>[])=>[{...base[0],status:'fail'}],
      (base:Record<string,unknown>[])=>[{...base[0],correctionOfReceiptId:'10000000-0000-4000-8000-000000000999'}],
      (base:Record<string,unknown>[])=>[{...base[0],evidence:'N',provenance:{kind:'automated'}}],
      (base:Record<string,unknown>[])=>[{...base[0],buildId:'d'.repeat(64)}],
      (base:Record<string,unknown>[])=>[{...base[0],checkedAt:'2026-08-20T00:00:00.000Z'}],
      (base:Record<string,unknown>[])=>[{...base[0],checkedAt:'2026-09-03T00:00:00.000Z'}],
    ];
    for(const mutate of mutations){const records=allReceipts(),key='macos|moodle|a.login|L',base=records.get(key)!;records.set(key,mutate(base as never) as unknown[]);const deps=fixture({receipts:records});await expect(verifyPhase2LiveCheckpoint({checkpoint:'A1',runtime:'current',platform:'macos',readOnly:true},deps)).rejects.toThrow();expect(deps.calls).toMatchObject({writes:0,append:0,db:0,profile:0,browser:0,source:0,process:0});}
  });

  it('rejects malformed extra duplicate mixed and dangerous CLI flags before runtime discovery',async()=>{
    const invalid=[[],['--verify'],['--verify','--checkpoint','A1','--runtime','current','--platform','macos','--read-only','--force'],['--verify','--checkpoint','A1','--checkpoint','A1','--runtime','current','--platform','macos','--read-only'],['--record','--verify','--checkpoint','B3','--runtime','current','--platform','macos','--read-only-inputs'],['--verify','--checkpoint','A1','--runtime','other','--platform','macos','--read-only'],['--verify','--checkpoint','A1','--runtime','current','--platform','macos','--read-only','--url','http://127.0.0.1:1'],['--verify','--checkpoint','A1','--runtime','current','--platform','macos','--read-only','--db','private.sqlite'],['--verify','--checkpoint','A1','--runtime','current','--platform','macos','--read-only','--ignore-platform']];
    for(const args of invalid){const deps=fixture();await expect(dispatchPhase2LiveGate(args,deps)).rejects.toThrow('LIVE_GATE_ARGUMENT_INVALID');expect(deps.calls.runtime).toBe(0);}
  });

  it('rejects unsafe feedback and output filesystem surfaces without touching prior bytes or leaving temporaries',async()=>{
    const root=protectedRoot(),f=feedbacks(),deps=fixture({status:status('candidate')}),outside=mkdtempSync(join(tmpdir(),'autoed-feedback-outside-'));roots.push(outside);chmodSync(outside,0o755);const outsideFeedback=join(outside,'A1-result.json');writeFileSync(outsideFeedback,JSON.stringify(f.A1),{mode:0o600});
    await expect(recordPhase2LiveCheckpoint({checkpoint:'A1',feedbackPath:outsideFeedback,outPath:'.planning/phases/02-poc-live/02-16-A1-RECEIPT.json',runtime:'current',readOnlyInputs:true},{...deps,repoRoot:root})).rejects.toThrow('LIVE_GATE_FEEDBACK_UNSAFE');
    const feedback=writeFeedback(root,'A1-result.json',f.A1),target=join(root,'.planning/phases/02-poc-live/02-16-A1-RECEIPT.json');symlinkSync(join(root,'nonexistent'),target);await expect(recordPhase2LiveCheckpoint({checkpoint:'A1',feedbackPath:feedback,outPath:'.planning/phases/02-poc-live/02-16-A1-RECEIPT.json',runtime:'current',readOnlyInputs:true},{...deps,repoRoot:root})).rejects.toThrow('LIVE_GATE_OUTPUT_UNSAFE');expect(lstatSync(target).isSymbolicLink()).toBe(true);expect(readdirSync(join(root,'.planning/phases/02-poc-live')).filter((name:string)=>name.startsWith('.phase2-live-'))).toEqual([]);
  });

  it('audits possible and required counts separately and keeps the 44 missing L cells visible',async()=>{
    const empty=fixture({receipts:new Map()});const mac=await auditPhase2EvidenceMatrix({platform:'macos',runtime:'current',readOnly:true},empty);expect(mac).toMatchObject({schema:1,status:'pass',audit:'platform_matrix',platform:'macos',possibleCellCount:88,requiredCellCount:22,passCellCount:0,notRunCellCount:22,humanNeededCellCount:22,phase3:'blocked'});
    const final=await verifyPhase2FinalGate({runtime:'current',platform:'all',readOnly:true},fixture({receipts:new Map()}));expect(final).toMatchObject({schema:1,status:'blocked',resultCode:'PHASE2_GATE_BLOCKED',possibleCells:176,requiredLiveCells:44,requiredLivePass:0});expect(final.gaps).toHaveLength(44+14+1);
    const records=allReceipts();for(const [key,values] of [...records])records.set(key.replace(/^macos/,'windows'),(values as Record<string,unknown>[]).map(value=>({...value,platform:'windows'})));const ids=['auth01.sealed_source_contract','auth02.native_lifecycle.macos','auth02.native_lifecycle.windows','auth03.state_contract','auth03.persistence_isolation','auth04.ownership_contract','auth04.ownership_integration','auth04.ownership_native.macos','auth04.ownership_native.windows','sec02.fixed_operations_contract','sec02.fixed_operations_integration','uat01.distribution_contract','uat01.native_update.macos','uat01.native_update.windows'],complete={phase1:'complete',buildObligations:ids.map(id=>({id,status:'pass',buildId,generation:7}))};for(const platform of ['macos','windows'] as const)expect(await auditPhase2EvidenceMatrix({platform,runtime:'current',readOnly:true},fixture({runtime:{...complete,platform},receipts:records}))).toMatchObject({status:'pass',passCellCount:22,notRunCellCount:0});expect(await verifyPhase2FinalGate({runtime:'current',platform:'all',readOnly:true},fixture({runtime:complete,receipts:records}))).toMatchObject({status:'pass',resultCode:'PHASE2_DUAL_PLATFORM_COMPLETE',requiredLivePass:44,phase3:'eligible'});
  });
});

describe('phase 2 read-only update gate',()=>{
  function updateFixture(platform:'macos'|'windows'='macos'){
    const sourceSha256='1'.repeat(64),selection={schema:1,status:'selected',owner:'returdex',repository:'returdex/AutoED',repositoryId:1350421724,version,tag:`v${version}`,commit:'2'.repeat(40),tree:'3'.repeat(40),buildId,sourceSha256,versionSetSha256:'4'.repeat(64),trustFingerprint:'fe7168c33489a34aaac2cefba36bc62bca76f9406a4b7293927a6b7e22201557',license:'PolyForm-Noncommercial-1.0.0',immutable:true,selectedAt:observedAt,gaps:{windowsNative:'not_run/human_needed',live:'not_run/human_needed',phase3:'blocked'}};
    const suite=(id:string)=>({status:'pass',commandSha256:sha(id),sourceSha256,tests:1,skipped:0,todo:0}),obligations=PHASE2_BUILD_OBLIGATIONS.map(id=>({id,status:'pass',reportDigest:sha(id)})),tests={schema:1,status:'pass',version,tag:`v${version}`,commit:selection.commit,tree:selection.tree,buildId,selectionSha256:sha(selection),sourceSha256,suites:{typecheck:suite('typecheck'),unit:suite('unit'),integration:suite('integration'),ui:suite('ui'),native:suite('native')},sensitiveScan:{status:'pass',surfaces:['tracked','history','working_tree','captured_output'],findings:0,reportDigest:sha('scan')},obligations,gaps:selection.gaps,completedAt:observedAt};
    const target=(name:string)=>({name,localPath:`.runtime/releases/${version}/${name}`,url:`https://github.com/returdex/AutoED/releases/download/v${version}/${encodeURIComponent(name)}`,bytes:4096,sha256:artifactSha256,manifestSha256:'5'.repeat(64),signatureSha256:'6'.repeat(64),capabilityClosureSha256:'7'.repeat(64)}),targets={macos:target('autoed-darwin-arm64.tar.gz'),windows:target('autoed-win32-x64.zip')},core=renderPhase2InstallPromptCore(selection,tests),draft={schema:1,status:'built_signed_verified_local',owner:'returdex',repository:'returdex/AutoED',repositoryId:1350421724,version,tag:`v${version}`,commit:selection.commit,tree:selection.tree,buildId,selectionSha256:sha(selection),testReportSha256:sha(tests),sourceSha256,versionSetSha256:selection.versionSetSha256,manifestSha256,fingerprint:selection.trustFingerprint,license:selection.license,immutable:true,installPromptCoreSha256:sha(core),externalPromptSha256:'8'.repeat(64),capabilitiesSha256:sha(PHASE2_CAPABILITIES),targets,gaps:selection.gaps},prompt=renderPhase2ExternalInstallPrompt(draft),artifacts={...draft,externalPromptSha256:sha(prompt)};
    const assets=Object.fromEntries(Object.entries(targets).map(([key,value],index)=>[key,{id:101+index,name:value.name,bytes:value.bytes,sha256:value.sha256,url:value.url}])),publication={schema:1,status:'pass',owner:'returdex',repositoryId:1350421724,version,tag:`v${version}`,buildId,manifestSha256,immutable:true,assets,checkedAt:observedAt};
    const availability={schema:1,status:'pass',anonymous:true,immutable:true,version,tag:`v${version}`,buildId,manifestSha256,assets,checkedAt:observedAt};
    const receipt={schema:1,checkpoint:platform==='macos'?'02-14-macos-update':'02-25-windows-update',platform,version,tag:`v${version}`,artifactSha256,manifestSha256,buildId,result:'pass',resultCode:'UPDATE_COMPLETE',cleanup:'complete',actualBuild:'matched',entrypoints:'matched',api:'healthy',worker:'healthy',pairedUi:'ready',sourceConfiguration:{moodle:'not_confirmed',edstem:'not_confirmed'},schoolAccess:'not_started',...(platform==='windows'?{profile:'not_created',nativePlatform:'windows-11',platformKind:'native',wsl:false}:{windows:'not_run/human_needed'}),phase3:'blocked',observedAt,feedbackDigest:'d'.repeat(64)};
    const files=new Map<string,unknown>([['release/phase2-build-selection.json',selection],['release/phase2-beta-artifacts.json',artifacts],['release/phase2-test-report.json',tests],['release/phase2-publication.json',publication],['release/phase2-availability.json',availability],['/tmp/autoed-phase2-fresh/availability.json',availability],[platform==='macos'?'.planning/phases/02-poc-live/02-14-UPDATE-RECEIPT.json':'.planning/phases/02-poc-live/02-25-WINDOWS-UPDATE-RECEIPT.json',receipt]]);
    const calls={read:0,runtime:0,mutate:0,profile:0,browser:0,source:0,process:0};
    return {files,calls,deps:{now:()=>now,nativePlatform:platform,assertFreshPath(path:string){if(path!=='/tmp/autoed-phase2-fresh/availability.json')throw new Error('UPDATE_GATE_FRESH_PATH_INVALID');},async readJson(path:string){calls.read++;return structuredClone(files.get(path));},async readText(path:string){calls.read++;if(path!=='release/phase2-install-prompt.md')throw new Error('NO');return prompt;},async readRuntime(){calls.runtime++;return runtime({platform,phase1:'partial'});}}};
  }

  it.each(['macos','windows'] as const)('%s update gate accepts exact immutable pre and current native post forms',async platform=>{
    const f=updateFixture(platform),receiptPath=platform==='macos'?'.planning/phases/02-poc-live/02-14-UPDATE-RECEIPT.json':'.planning/phases/02-poc-live/02-25-WINDOWS-UPDATE-RECEIPT.json',pre=['--artifacts','release/phase2-beta-artifacts.json','--tests','release/phase2-test-report.json','--publication','release/phase2-publication.json','--availability','release/phase2-availability.json',...(platform==='macos'?['--fresh-availability','/tmp/autoed-phase2-fresh/availability.json']:[]),'--prompt','release/phase2-install-prompt.md','--platform',platform,'--read-only'];
    await expect(verifyPhase2UpdateGate(pre,f.deps)).resolves.toMatchObject({schema:1,status:'pass',mode:'pre-update',platform,version,buildId});
    await expect(verifyPhase2UpdateGate(['--receipt',receiptPath,'--artifacts','release/phase2-beta-artifacts.json','--availability','release/phase2-availability.json','--runtime','current','--platform',platform,'--read-only'],f.deps)).resolves.toMatchObject({schema:1,status:'pass',mode:'post-update',platform,cleanup:'complete',resultCode:platform==='macos'?'UPDATE_COMPLETE':'WINDOWS_UPDATE_COMPLETE'});
    expect(f.calls).toMatchObject({mutate:0,profile:0,browser:0,source:0,process:0});
  });

  it('rejects platform spoof, WSL, identity drift, stale availability and mutation flags before success',async()=>{
    const cases=[
      (f:ReturnType<typeof updateFixture>)=>{f.deps.nativePlatform='macos';},
      (f:ReturnType<typeof updateFixture>)=>{(f.files.get('.planning/phases/02-poc-live/02-25-WINDOWS-UPDATE-RECEIPT.json') as Record<string,unknown>).wsl=true;},
      (f:ReturnType<typeof updateFixture>)=>{(f.files.get('release/phase2-availability.json') as Record<string,unknown>).buildId='e'.repeat(64);},
      (f:ReturnType<typeof updateFixture>)=>{(f.files.get('release/phase2-availability.json') as Record<string,unknown>).checkedAt='2026-08-20T00:00:00.000Z';},
      (f:ReturnType<typeof updateFixture>)=>{(f.files.get('.planning/phases/02-poc-live/02-25-WINDOWS-UPDATE-RECEIPT.json') as Record<string,unknown>).cleanup='cleanup_pending';},
      (f:ReturnType<typeof updateFixture>)=>{(f.files.get('.planning/phases/02-poc-live/02-25-WINDOWS-UPDATE-RECEIPT.json') as Record<string,unknown>).observedAt='2026-09-03T00:00:00.000Z';},
    ];
    const post=['--receipt','.planning/phases/02-poc-live/02-25-WINDOWS-UPDATE-RECEIPT.json','--artifacts','release/phase2-beta-artifacts.json','--availability','release/phase2-availability.json','--runtime','current','--platform','windows','--read-only'];for(const mutate of cases){const f=updateFixture('windows');mutate(f);await expect(verifyPhase2UpdateGate(post,f.deps)).rejects.toThrow(/^UPDATE_GATE_/);}
    const f=updateFixture('windows');await expect(verifyPhase2UpdateGate([...post,'--install'],f.deps)).rejects.toThrow('UPDATE_GATE_ARGUMENT_INVALID');expect(f.calls.read).toBe(0);
  });
});

describe('phase 2 native evidence producer',()=>{
  const macIds=['auth01.sealed_source_contract','auth02.native_lifecycle.macos','auth03.state_contract','auth03.persistence_isolation','auth04.ownership_contract','auth04.ownership_integration','auth04.ownership_native.macos','sec02.fixed_operations_contract','sec02.fixed_operations_integration','uat01.distribution_contract','uat01.native_update.macos'];
  function nativeFixture(){const calls={runtime:0,checks:0,append:0,l:0,source:0,profile:0,browser:0};const reports=macIds.map(id=>({id,status:'pass',resultCode:'CHECK_PASSED',reportDigest:sha(id)}));return{calls,reports,deps:{nativePlatform:'macos',async readRuntime(){calls.runtime++;return runtime({platform:'macos'});},async runFixedChecks(){calls.checks++;return structuredClone(reports);},async appendNativeBundle(value:unknown){calls.append++;const failed=(value as {checks:{status:string}[]}).checks.some(item=>item.status==='fail');return{schema:1,status:failed?'fail':'pass',resultCode:failed?'NATIVE_EVIDENCE_CHECK_FAILED':'NATIVE_EVIDENCE_RECORDED',platform:'macos',version,buildId,generation:7,bundleId:'10000000-0000-4000-8000-000000000111',obligations:failed?[]:macIds,gaps:failed?['NATIVE_EVIDENCE_CHECK_FAILED']:[],value};}}};}
  it('produces one current-build platform-bound S/I/N bundle and is idempotent without L authority',async()=>{const f=nativeFixture(),args=['--platform','macos','--runtime','current'];const first=await runPhase2NativeEvidence(args,f.deps),second=await runPhase2NativeEvidence(args,f.deps);expect(first).toMatchObject({status:'pass',platform:'macos',buildId,obligations:macIds});expect(second).toMatchObject({status:'pass',bundleId:first.bundleId});expect(f.calls).toMatchObject({append:2,l:0,source:0,profile:0,browser:0});expect(first.obligations).not.toContain(expect.stringMatching(/\.L$|live/i));});
  it('rejects platform mismatch, incomplete/unrequired/L reports and retains failure without pass handoff',async()=>{for(const mutate of[(f:ReturnType<typeof nativeFixture>)=>{f.deps.nativePlatform='windows';},(f:ReturnType<typeof nativeFixture>)=>{f.reports.pop();},(f:ReturnType<typeof nativeFixture>)=>{f.reports[0]={...f.reports[0]!,id:'arbitrary.operation'};},(f:ReturnType<typeof nativeFixture>)=>{f.reports[0]={...f.reports[0]!,id:'a.login.L'};}]){const f=nativeFixture();mutate(f);await expect(runPhase2NativeEvidence(['--platform','macos','--runtime','current'],f.deps)).rejects.toThrow(/^NATIVE_EVIDENCE_/);expect(f.calls.append).toBe(0);}const failed=nativeFixture();failed.reports[0]={...failed.reports[0]!,status:'fail',resultCode:'CHECK_FAILED'};await expect(runPhase2NativeEvidence(['--platform','macos','--runtime','current'],failed.deps)).rejects.toThrow('NATIVE_EVIDENCE_CHECK_FAILED');expect(failed.calls.append).toBe(1);const f=nativeFixture();await expect(runPhase2NativeEvidence(['--platform','windows','--runtime','current'],f.deps)).rejects.toThrow('NATIVE_EVIDENCE_PLATFORM_MISMATCH');expect(f.calls.runtime).toBe(0);});

  it('persists one transactional server-derived bundle idempotently and never touches the L ledger',async()=>{const root=protectedRoot(),db=openDatabase(join(root,'native.sqlite'));try{const binding={platform:'macos' as const,version,buildId,artifactSha256,manifestSha256,generation:0,checkedAt:observedAt},store=new SQLiteNativeEvidenceStore(db,{now:()=>now}),service=new NativeEvidenceService(store,{current:async()=>binding},{expectedGeneration:0}),checks=macIds.map(id=>({id,status:'pass' as const,resultCode:'CHECK_PASSED',reportDigest:sha(id)})),command={schema:1,suiteDigest:sha(checks),checks};const first=await service.record(command),second=await service.record(command);expect(first).toMatchObject({status:'pass',platform:'macos',buildId,generation:0,obligations:macIds});expect(second.bundleId).toBe(first.bundleId);expect((db.prepare('SELECT count(*) AS n FROM phase2_build_obligations').get() as {n:number}).n).toBe(11);expect((db.prepare("SELECT count(*) AS n FROM uat_receipts WHERE evidence='L'").get() as {n:number}).n).toBe(0);const failedChecks=checks.map((item,index)=>index===0?{...item,status:'fail' as const,resultCode:'CHECK_FAILED' as const}:item),failed=await service.record({...command,suiteDigest:sha(failedChecks),checks:failedChecks});expect(failed).toMatchObject({status:'fail',resultCode:'NATIVE_EVIDENCE_CHECK_FAILED'});expect((db.prepare('SELECT count(*) AS n FROM phase2_build_obligations').get() as {n:number}).n).toBe(11);expect((db.prepare("SELECT count(*) AS n FROM phase2_native_runs WHERE status='fail'").get() as {n:number}).n).toBe(1);}finally{db.close();}});
});
