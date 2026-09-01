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

const sha=(value:unknown)=>createHash('sha256').update(Buffer.isBuffer(value)||typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const buildId='a'.repeat(64),artifactSha256='b'.repeat(64),manifestSha256='c'.repeat(64),version='0.1.0-beta.20';
const observedAt='2026-09-01T08:00:00.000Z',now=Date.parse('2026-09-01T08:05:00.000Z');
const roots:string[]=[];
afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});

type Source='moodle'|'edstem';
type Scenario='a.login'|'a.binding'|'a.course_visibility'|'b.reopen_1'|'b.reopen_2'|'b.reopen_3'|'b.worker_restart'|'b.codex_exit'|'c.os_restart'|'d.24h_recheck'|'reauth';
function receipt(source:Source,scenario:Scenario,resultCode:string,platform:'macos'|'windows'='macos'){
  return {receiptId:`10000000-0000-4000-8000-${String(receipt.counter++).padStart(12,'0')}`,buildId,version,platform,source,scenario,evidence:'L',status:'pass',resultCode,bindingConsistency:'consistent',identityFingerprint:null,gaps:[],checkedAt:observedAt,earliestRecheckAt:null,nextAction:'none'};
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
    A1:{schema:1,checkpoint:'02-16-A1-login',platform:'macos',version,buildId,moodle:'pass',moodleCode:'AUTHENTICATED',edstem:'pass',edstemCode:'AUTHENTICATED',binding:'candidate',courseVisibility:'not_run',contentAccess:'not_started',windows:'not_run/human_needed',phase3:'blocked',observedAt},
    A2:{schema:1,checkpoint:'A2',platform:'macos',result:'pass',resultCode:'A2_COMPLETE',binding:'confirmed',bindingMode:'stable_subject_org_confirmed',moodleIdentity:'confirmed',edstemIdentity:'confirmed',approvedScope:'matched',moodleCourse:'visible',edstemCourse:'visible',contentBoundary:'preserved',screenshot:'not_used',windows:'not_run/human_needed',phase3:'blocked',observedAt},
    B3:{schema:1,checkpoint:'B3',platform:'macos',result:'pass',resultCode:'B3_COMPLETE',codexExit:'observed',backend:'survived',worker:'survived',absentStatusRead:'pass',reentry:'actual_client',clientBuild:'matched',moodleState:'consistent',edstemState:'consistent',binding:'confirmed',contentBoundary:'preserved',screenshot:'not_used',windows:'not_run/human_needed',phase3:'blocked',observedAt},
    reauth:{schema:1,checkpoint:'reauth',platform:'macos',path:'natural_expiry',targetSource:'moodle',result:'pass',resultCode:'REAUTH_COMPLETE',logoutIntent:'not_applicable',automaticReopen:'none',moodle:'reauthenticated',moodleCode:'AUTHENTICATED',edstem:'followup_authenticated',edstemCode:'AUTHENTICATED',identityScope:'consistent',sourceIsolation:'preserved',lastSuccess:'preserved',contentBoundary:'preserved',screenshot:'not_used',windows:'not_run/human_needed',phase3:'blocked',observedAt},
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
function fixture(overrides:{runtime?:Record<string,unknown>;status?:ReturnType<typeof status>;receipts?:Map<string,unknown[]>}={}){
  const calls={runtime:0,status:0,receipts:0,writes:0,append:0,db:0,profile:0,browser:0,source:0,process:0};const records=overrides.receipts??allReceipts();
  return {calls,now:()=>now,async readRuntime(){calls.runtime++;return runtime(overrides.runtime);},async readStatus(){calls.status++;return overrides.status??status();},async readReceipts(key:{platform:string;source:string;scenario:string;evidence:string}){calls.receipts++;return records.get(`${key.platform}|${key.source}|${key.scenario}|${key.evidence}`)??[];}};
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
    const a1=await recordPhase2LiveCheckpoint({checkpoint:'A1',feedbackPath:a1Feedback,outPath:a1Out,runtime:'current',readOnlyInputs:true},{...deps,repoRoot:root});
    expect(a1).toMatchObject({schema:1,checkpoint:'02-16-A1-login',resultCode:'A1_AUTHENTICATED',bindingConsistency:'candidate'});expect(lstatSync(join(root,a1Out)).mode&0o777).toBe(0o600);
    const before=readFileSync(join(root,a1Out));await expect(recordPhase2LiveCheckpoint({checkpoint:'A1',feedbackPath:a1Feedback,outPath:a1Out,runtime:'current',readOnlyInputs:true},{...deps,repoRoot:root})).rejects.toThrow('LIVE_GATE_OUTPUT_EXISTS');expect(readFileSync(join(root,a1Out))).toEqual(before);
    const a2Feedback=writeFeedback(root,'A2-result.json',f.A2),a2Out='.planning/phases/02-poc-live/02-17-A2-RECEIPT.json';
    const a2=await recordPhase2LiveCheckpoint({checkpoint:'A2',feedbackPath:a2Feedback,outPath:a2Out,a1ReceiptPath:a1Out,runtime:'current',readOnlyInputs:true},{...fixture(),repoRoot:root});
    expect(a2).toMatchObject({checkpoint:'02-17-A2-binding-course',resultCode:'A2_COMPLETE',a1ReceiptSha256:sha(before)});expect(lstatSync(join(root,a2Out)).mode&0o777).toBe(0o600);
  });

  it('returns pass-only zero-file B3 and reauth handoffs from exact current L events',async()=>{
    const root=protectedRoot(),f=feedbacks();
    for(const checkpoint of ['B3','reauth'] as const){const deps=fixture();const feedbackPath=writeFeedback(root,`${checkpoint}-result.json`,f[checkpoint]);const before=new Set(readdirSync(root,{recursive:true,encoding:'utf8'}));const result=await recordPhase2LiveCheckpoint({checkpoint,feedbackPath,runtime:'current',platform:'macos',readOnlyInputs:true},{...deps,repoRoot:root});expect(result).toMatchObject({schema:1,status:'pass',checkpoint,platform:'macos',resultCode:checkpoint==='B3'?'B3_COMPLETE':'REAUTH_COMPLETE'});expect(new Set(readdirSync(root,{recursive:true,encoding:'utf8'}))).toEqual(before);expect(deps.calls).toMatchObject({writes:0,append:0,db:0,profile:0,browser:0,source:0,process:0});}
  });

  it('supports every canonical read-only checkpoint for both platforms and exact B1 rounds',async()=>{
    const records=allReceipts();for(const [key,values] of [...records])records.set(key.replace(/^macos/,'windows'),(values as Record<string,unknown>[]).map(value=>({...value,platform:'windows'})));
    for(const platform of ['macos','windows'] as const){
      for(const checkpoint of ['A1','A2','B2','B3','C','D','reauth'] as const)expect(await verifyPhase2LiveCheckpoint({checkpoint,runtime:'current',platform,readOnly:true},fixture({runtime:{platform},receipts:records}))).toMatchObject({schema:1,status:'pass',checkpoint,platform});
      for(const round of [1,2,3] as const)expect(await verifyPhase2LiveCheckpoint({checkpoint:'B1',round,runtime:'current',platform,readOnly:true},fixture({runtime:{platform},receipts:records}))).toMatchObject({status:'pass',checkpoint:'B1',round,platform});
    }
  });

  it('fails closed for missing duplicate conflicting corrected substituted stale or future events without mutation',async()=>{
    const mutations=[
      ()=>[],
      (base:unknown[])=>[...base,...base],
      (base:Record<string,unknown>[])=>[{...base[0],status:'fail'}],
      (base:Record<string,unknown>[])=>[{...base[0],correctionOfReceiptId:'10000000-0000-4000-8000-000000000999'}],
      (base:Record<string,unknown>[])=>[{...base[0],evidence:'N',provenance:{kind:'automated'}}],
      (base:Record<string,unknown>[])=>[{...base[0],buildId:'d'.repeat(64)}],
      (base:Record<string,unknown>[])=>[{...base[0],checkedAt:'2026-08-20T00:00:00.000Z'}],
      (base:Record<string,unknown>[])=>[{...base[0],checkedAt:'2026-09-02T00:00:00.000Z'}],
    ];
    for(const mutate of mutations){const records=allReceipts(),key='macos|moodle|a.login|L',base=records.get(key)!;records.set(key,mutate(base as never) as unknown[]);const deps=fixture({receipts:records});await expect(verifyPhase2LiveCheckpoint({checkpoint:'A1',runtime:'current',platform:'macos',readOnly:true},deps)).rejects.toThrow();expect(deps.calls).toMatchObject({writes:0,append:0,db:0,profile:0,browser:0,source:0,process:0});}
  });

  it('rejects malformed extra duplicate mixed and dangerous CLI flags before runtime discovery',async()=>{
    const invalid=[[],['--verify'],['--verify','--checkpoint','A1','--runtime','current','--platform','macos','--read-only','--force'],['--verify','--checkpoint','A1','--checkpoint','A1','--runtime','current','--platform','macos','--read-only'],['--record','--verify','--checkpoint','B3','--runtime','current','--platform','macos','--read-only-inputs'],['--verify','--checkpoint','A1','--runtime','other','--platform','macos','--read-only'],['--verify','--checkpoint','A1','--runtime','current','--platform','macos','--read-only','--url','http://127.0.0.1:1'],['--verify','--checkpoint','A1','--runtime','current','--platform','macos','--read-only','--db','private.sqlite'],['--verify','--checkpoint','A1','--runtime','current','--platform','macos','--read-only','--ignore-platform']];
    for(const args of invalid){const deps=fixture();await expect(dispatchPhase2LiveGate(args,deps)).rejects.toThrow('LIVE_GATE_ARGUMENT_INVALID');expect(deps.calls.runtime).toBe(0);}
  });

  it('rejects unsafe feedback and output filesystem surfaces without touching prior bytes or leaving temporaries',async()=>{
    const root=protectedRoot(),f=feedbacks(),deps=fixture({status:status('candidate')}),outside=mkdtempSync(join(tmpdir(),'autoed-feedback-outside-'));roots.push(outside);chmodSync(outside,0o700);const outsideFeedback=join(outside,'A1-result.json');writeFileSync(outsideFeedback,JSON.stringify(f.A1),{mode:0o600});
    await expect(recordPhase2LiveCheckpoint({checkpoint:'A1',feedbackPath:outsideFeedback,outPath:'.planning/phases/02-poc-live/02-16-A1-RECEIPT.json',runtime:'current',readOnlyInputs:true},{...deps,repoRoot:root})).rejects.toThrow('LIVE_GATE_FEEDBACK_UNSAFE');
    const feedback=writeFeedback(root,'A1-result.json',f.A1),target=join(root,'.planning/phases/02-poc-live/02-16-A1-RECEIPT.json');symlinkSync(join(root,'nonexistent'),target);await expect(recordPhase2LiveCheckpoint({checkpoint:'A1',feedbackPath:feedback,outPath:'.planning/phases/02-poc-live/02-16-A1-RECEIPT.json',runtime:'current',readOnlyInputs:true},{...deps,repoRoot:root})).rejects.toThrow('LIVE_GATE_OUTPUT_UNSAFE');expect(lstatSync(target).isSymbolicLink()).toBe(true);expect(readdirSync(join(root,'.planning/phases/02-poc-live')).filter((name:string)=>name.startsWith('.phase2-live-'))).toEqual([]);
  });

  it('audits possible and required counts separately and keeps the 44 missing L cells visible',async()=>{
    const empty=fixture({receipts:new Map()});const mac=await auditPhase2EvidenceMatrix({platform:'macos',runtime:'current',readOnly:true},empty);expect(mac).toMatchObject({schema:1,status:'pass',audit:'platform_matrix',platform:'macos',possibleCellCount:88,requiredCellCount:22,passCellCount:0,notRunCellCount:22,humanNeededCellCount:22,phase3:'blocked'});
    const final=await verifyPhase2FinalGate({runtime:'current',platform:'all',readOnly:true},fixture({receipts:new Map()}));expect(final).toMatchObject({schema:1,status:'blocked',resultCode:'PHASE2_GATE_BLOCKED',possibleCells:176,requiredLiveCells:44,requiredLivePass:0});expect(final.gaps).toHaveLength(44+14+1);
  });
});
