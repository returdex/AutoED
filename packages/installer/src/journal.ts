import {createHash,randomUUID} from 'node:crypto';
import {existsSync,lstatSync,mkdirSync,readFileSync,readdirSync,unlinkSync,rmdirSync,renameSync,openSync,closeSync,fsyncSync} from 'node:fs';
import {join} from 'node:path';
import {z} from 'zod';
import type Database from 'better-sqlite3';
import type {InstallProjection} from '../../domain/src/model.js';
import {BuildIdentitySchema} from '../../contracts/src/index.js';
import {readInstallation} from '../../platform/src/installation.js';
import {assertManagedPath,managedPaths,type RootSelection} from '../../platform/src/paths.js';
import {protectPath} from '../../platform/src/permissions.js';
import {observeProcess} from '../../platform/src/processes.js';
import {withClientAdmission,ClientAdmissionSchema} from '../../platform/src/client-host.js';
import {readGate} from '../../persistence/src/database.js';
import {SQLiteStatusProjectionStore} from '../../persistence/src/runtime-status.js';
import {writeInstallerRecord} from './launchers.js';

export const JOURNAL_STAGES=['preview','confirmed','download_verified','quiesced','snapshot_ready','migrated','activated','started','feature_verified','cleaned','reopened','normal_verified','complete'] as const;
const hash=z.string().regex(/^[a-f0-9]{64}$/),generation=z.number().int().nonnegative();
const Header=z.strictObject({operationId:z.uuid(),scopeHash:hash,manifestHash:hash,target:BuildIdentitySchema,previousInstallation:z.enum(['none','present']),generation,installationId:z.uuid()});
const Entry=z.strictObject({sequence:z.number().int().nonnegative(),stage:z.enum(JOURNAL_STAGES),phase:z.enum(['intent','done']),previousHash:hash,checkedAt:z.number().int().nonnegative()});
const Lock=z.strictObject({operationId:z.uuid(),installationId:z.uuid(),pid:z.number().int().positive(),osStartIdentity:z.string(),executable:z.string()});
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export type JournalInput=Omit<z.infer<typeof Header>,'installationId'>;
function readRecord(path:string,max=16384){const st=lstatSync(path);if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||st.size>max)throw new Error('JOURNAL_INVALID');return JSON.parse(readFileSync(path,'utf8'));}
function journalPath(selection:RootSelection,operationId:string){z.uuid().parse(operationId);return assertManagedPath(managedPaths(selection.root),`installer-staging/operations/${operationId}`);}
export class UpgradeJournal {
  private constructor(readonly selection:RootSelection,readonly header:z.infer<typeof Header>,private readonly lock:z.infer<typeof Lock>){}
  static async create(selection:RootSelection,input:JournalInput){
    return withClientAdmission(selection,()=>this.createLocked(selection,input));
  }
  private static async createLocked(selection:RootSelection,input:JournalInput){
    const metadata=readInstallation(selection),header=Header.parse({...input,installationId:metadata.installationId}),paths=managedPaths(selection.root),lockPath=assertManagedPath(paths,'installer-staging/update.lock');
    if(existsSync(lockPath))throw new Error('UPGRADE_LOCKED');const os=await observeProcess(process.pid);if(!os)throw new Error('PROCESS_OWNERSHIP_UNCONFIRMED');
    const lock=Lock.parse({operationId:header.operationId,installationId:header.installationId,pid:process.pid,...os});
    try{mkdirSync(lockPath,{mode:0o700});}catch{throw new Error('UPGRADE_LOCKED');}protectPath(lockPath);writeInstallerRecord(join(lockPath,'owner.json'),lock);
    const operations=assertManagedPath(paths,'installer-staging/operations');if(!existsSync(operations)){mkdirSync(operations,{mode:0o700});protectPath(operations);}
    const root=journalPath(selection,header.operationId);mkdirSync(root,{mode:0o700});protectPath(root);writeInstallerRecord(join(root,'header.json'),header);writeInstallerRecord(join(lockPath,'admission.json'),{operationId:header.operationId,buildId:header.target.buildId,mode:'blocked'});
    return new UpgradeJournal(selection,header,lock);
  }
  static async recover(selection:RootSelection,operationId:string){
    return withClientAdmission(selection,async()=>{const metadata=readInstallation(selection),paths=managedPaths(selection.root),lockPath=assertManagedPath(paths,'installer-staging/update.lock'),ownerPath=assertManagedPath(paths,'installer-staging/update.lock/owner.json'),prior=Lock.parse(readRecord(ownerPath));if(prior.installationId!==metadata.installationId||prior.operationId!==operationId||await observeProcess(prior.pid)!==null)throw new Error('UPGRADE_LOCKED');const os=await observeProcess(process.pid);if(!os)throw new Error('PROCESS_OWNERSHIP_UNCONFIRMED');const lock=Lock.parse({...prior,pid:process.pid,...os});replaceJournalRecord(ownerPath,prior,lock);const state=this.read(selection,operationId);return new UpgradeJournal(selection,state.header,lock);});
  }
  static read(selection:RootSelection,operationId:string){
    const metadata=readInstallation(selection),root=journalPath(selection,operationId),header=Header.parse(readRecord(assertManagedPath(managedPaths(selection.root),`installer-staging/operations/${operationId}/header.json`)));
    if(header.installationId!==metadata.installationId||header.operationId!==operationId)throw new Error('JOURNAL_INVALID');
    const names=readdirSync(root).filter(n=>n!=='header.json').sort();if(names.length>JOURNAL_STAGES.length*2||names.some((n,i)=>n!==`${String(i).padStart(3,'0')}.json`))throw new Error('JOURNAL_INVALID');
    const entries:z.infer<typeof Entry>[]=[];let previousHash=digest(header);
    for(const [i,name]of names.entries()){const value=Entry.parse(readRecord(assertManagedPath(managedPaths(selection.root),`installer-staging/operations/${operationId}/${name}`)));if(value.sequence!==i||value.stage!==JOURNAL_STAGES[Math.floor(i/2)]||value.phase!==(i%2?'done':'intent')||value.previousHash!==previousHash||value.checkedAt>Date.now()||value.checkedAt<(entries.at(-1)?.checkedAt??0))throw new Error('JOURNAL_INVALID');entries.push(value);previousHash=digest(value);}
    return {header,entries};
  }
  private assertOwner(){const path=assertManagedPath(managedPaths(this.selection.root),'installer-staging/update.lock/owner.json');if(JSON.stringify(Lock.parse(readRecord(path)))!==JSON.stringify(this.lock)||this.lock.pid!==process.pid)throw new Error('UPGRADE_LOCKED');}
  async append(stage:typeof JOURNAL_STAGES[number],phase:'intent'|'done'){
    this.assertOwner();const state=UpgradeJournal.read(this.selection,this.header.operationId),sequence=state.entries.length;
    if(stage!==JOURNAL_STAGES[Math.floor(sequence/2)]||phase!==(sequence%2?'done':'intent'))throw new Error('JOURNAL_ORDER');
    const entry=Entry.parse({sequence,stage,phase,previousHash:digest(state.entries.at(-1)??state.header),checkedAt:Date.now()});
    writeInstallerRecord(join(journalPath(this.selection,this.header.operationId),`${String(sequence).padStart(3,'0')}.json`),entry);
  }
  async clientAdmission(mode:'blocked'|'selfcheck'|'normal_probe',buildId=this.header.target.buildId){this.assertOwner();await withClientAdmission(this.selection,async()=>{const path=assertManagedPath(managedPaths(this.selection.root),'installer-staging/update.lock/admission.json'),prior=ClientAdmissionSchema.parse(readRecord(path));replaceJournalRecord(path,prior,ClientAdmissionSchema.parse({operationId:this.header.operationId,buildId,mode}));});}
  async release(){this.assertOwner();const last=UpgradeJournal.read(this.selection,this.header.operationId).entries.at(-1);if(last?.stage!=='complete'||last.phase!=='done')throw new Error('UPGRADE_INCOMPLETE');await withClientAdmission(this.selection,async()=>{const path=assertManagedPath(managedPaths(this.selection.root),'installer-staging/update.lock');unlinkSync(join(path,'admission.json'));unlinkSync(join(path,'owner.json'));rmdirSync(path);});}
}
export function replaceJournalRecord(path:string,expected:unknown,value:unknown){if(digest(readRecord(path))!==digest(expected))throw new Error('JOURNAL_REALITY_MISMATCH');const temporary=path+'.'+randomUUID();writeInstallerRecord(temporary,value);if(digest(readRecord(path))!==digest(expected))throw new Error('JOURNAL_REALITY_MISMATCH');renameSync(temporary,path);if(process.platform==='darwin'){const fd=openSync(join(path,'..'),'r');try{fsyncSync(fd);}finally{closeSync(fd);}}}
const pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
/** Wait for real time to advance; never invent a future observation to beat a prior write. */
export async function nextProjectionTime(db:Database.Database,key:string){const prior=db.prepare('SELECT checked_at FROM runtime_status WHERE key=?').get(key) as {checked_at:number|null}|undefined;const deadline=performance.now()+1000;while(prior?.checked_at!==null&&prior?.checked_at!==undefined&&Date.now()<=prior.checked_at){if(performance.now()>=deadline)throw new Error('OBSERVATION_CLOCK_UNCONFIRMED');await pause(1);}return new Date().toISOString();}
export async function writeJournalProjection(db:Database.Database,journal:UpgradeJournal,value:Pick<InstallProjection,'stage'|'result'|'actualBuild'|'cleanup'>){
  const state=UpgradeJournal.read(journal.selection,journal.header.operationId),gate=readGate(db);
  if(value.result==='succeeded'&&(state.entries.at(-1)?.stage!=='complete'||state.entries.at(-1)?.phase!=='done'))throw new Error('COMPLETION_EVIDENCE_REQUIRED');
  if(gate.operationId!==journal.header.operationId&&(gate.state!=='open'||gate.operationId!==null||gate.generation<journal.header.generation||gate.generation>journal.header.generation+1))throw new Error('MAINTENANCE_OWNERSHIP_MISMATCH');
  await new SQLiteStatusProjectionStore(db).writeInstall({...value,operationId:journal.header.operationId,previousInstallation:journal.header.previousInstallation,targetBuild:journal.header.target,checkedAt:await nextProjectionTime(db,'install')},{expectedGeneration:gate.generation,operationId:gate.operationId});
}
