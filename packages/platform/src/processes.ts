import { spawn, execFileSync } from 'node:child_process';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute } from 'node:path';
import { z } from 'zod';
import type { ProcessSupervisor, SecretStore } from '../../application/src/ports.js';
import type { BuildIdentity, ProcessIdentity, ProcessLaunch, WriteContext } from '../../domain/src/model.js';
import { BuildIdentitySchema } from '../../contracts/src/index.js';
import { NativeSecretStore } from './credentials.js';
import { assertPortAvailable, readInstallation } from './installation.js';
import { assertManagedPath, assertSafeAncestors, managedPaths, type RootSelection } from './paths.js';
import { protectPath, windowsProbe } from './permissions.js';

export interface OSProcess { osStartIdentity: string; executable: string }
/** OS observation is a cross-check, never sufficient ownership authority by itself. */
export async function observeProcess(pid: number): Promise<OSProcess|null> {
  if(!Number.isSafeInteger(pid)||pid<1)throw new Error('PROCESS_OWNERSHIP_UNCONFIRMED');
  try {
    if(process.platform==='darwin') {
      const text=execFileSync('/bin/ps',['-ww','-p',String(pid),'-o','lstart=','-o','comm='],{encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:3000}).trim();
      if(!text)return null;
      const match=/^(.{24})\s+(.+)$/.exec(text);if(!match)throw new Error('PROCESS_OBSERVATION_UNAVAILABLE');
      return {osStartIdentity:match[1]!,executable:realpathSync(match[2]!)};
    }
    if(process.platform==='win32') {
      const value=windowsProbe("$q=Get-CimInstance Win32_Process -Filter ('ProcessId = '+[int]$p.pid); if ($null -eq $q) { 'null' } else { @{osStartIdentity=$q.CreationDate.ToUniversalTime().ToString('o');executable=$q.ExecutablePath}|ConvertTo-Json -Compress }",{pid});
      if(value===null)return null;
      const parsed=z.strictObject({osStartIdentity:z.string().min(1),executable:z.string().min(1)}).parse(value);
      return {...parsed,executable:realpathSync(parsed.executable)};
    }
    throw new Error('UNSUPPORTED_PLATFORM');
  } catch(error) {
    // ps status 1 means no matching process. Permission/query failures are unknown.
    if(process.platform==='darwin'&&(error as {status?:number}).status===1)return null;
    throw new Error('PROCESS_OBSERVATION_UNAVAILABLE');
  }
}
export function matchesProcess(identity: ProcessIdentity, observation: OSProcess|null): boolean {
  return !!observation && !!identity.executable && identity.osStartIdentity===observation.osStartIdentity && identity.executable===observation.executable;
}
/** Bounded exact PID/port query; never enumerate unrelated processes or sockets. */
export function ownsListener(pid:number,port:number):boolean {
  if(!Number.isSafeInteger(pid)||pid<1||!Number.isInteger(port)||port<1||port>65535)return false;
  try {
    if(process.platform==='darwin') {
      const output=execFileSync('/usr/sbin/lsof',['-nP','-a','-p',String(pid),`-iTCP@127.0.0.1:${port}`,'-sTCP:LISTEN','-Fp'],{encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:3000,maxBuffer:4096});
      // lsof includes mandatory descriptor fields even when only PID was requested.
      const fields=output.trim().split('\n');
      return fields.filter(line=>line.startsWith('p')).join('\n')===`p${pid}` && fields.every(line=>/^p\d+$|^f\d+$/.test(line));
    }
    if(process.platform==='win32')return windowsProbe("$q=@(Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort ([int]$p.port) -State Listen -OwningProcess ([int]$p.pid) -ErrorAction SilentlyContinue); ($q.Count -eq 1)|ConvertTo-Json -Compress",{pid,port})===true;
  } catch{return false;}
  return false;
}
const recordSchema=z.strictObject({installationId:z.uuid(),role:z.enum(['api','worker']),buildId:z.string().regex(/^[a-f0-9]{64}$/),pid:z.number().int().positive(),nonce:z.uuid(),osStartIdentity:z.string().min(1).max(128),executable:z.string().min(1).max(4096),entrypoint:z.string().min(1).max(4096),controlPort:z.number().int().min(1).max(65535)});
export type ProcessRecord=z.infer<typeof recordSchema>;
export {recordSchema as ProcessRecordSchema};
const contextSchema=z.strictObject({expectedGeneration:z.number().int().nonnegative(),selfcheck:z.strictObject({operationId:z.uuid(),generation:z.number().int().nonnegative()}).optional()});
const intentSchema=z.strictObject({installationId:z.uuid(),role:z.enum(['api','worker']),buildId:z.string(),nonce:z.uuid(),context:contextSchema.optional(),pid:z.number().int().positive().optional(),os:z.strictObject({osStartIdentity:z.string(),executable:z.string()}).optional()});
function durableIntent(path:string,value:z.infer<typeof intentSchema>) {
  const pending=path+'.pending';const fd=openSync(pending,'wx',0o600);
  try{protectPath(pending);writeFileSync(fd,JSON.stringify(intentSchema.parse(value)));fsyncSync(fd);}finally{closeSync(fd);}
  renameSync(pending,path);
  if(process.platform==='darwin'){const directory=openSync(dirname(path),'r');try{fsyncSync(directory);}finally{closeSync(directory);}}
}
export function workerLaunchContext(selection:RootSelection,nonce:string,build:BuildIdentity):WriteContext|undefined {
  const metadata=readInstallation(selection);const path=assertManagedPath(managedPaths(selection.root),'runtime/worker.launch/intent.json');
  if(lstatSync(path).size>4096)throw new Error('PROCESS_OWNERSHIP_UNCONFIRMED');
  const intent=intentSchema.parse(JSON.parse(readFileSync(path,'utf8')));
  if(intent.installationId!==metadata.installationId||intent.role!=='worker'||intent.nonce!==nonce||intent.buildId!==build.buildId)throw new Error('PROCESS_OWNERSHIP_UNCONFIRMED');
  return intent.context as WriteContext|undefined;
}
function recordPath(selection:RootSelection,role:'api'|'worker'){return assertManagedPath(managedPaths(selection.root),`runtime/${role}.json`);}
function same(a:ProcessIdentity,b:ProcessIdentity) {return ['installationId','role','buildId','pid','nonce','osStartIdentity','executable'].every(k=>a[k as keyof ProcessIdentity]===b[k as keyof ProcessIdentity]);}
const wait=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));
function proof(key:string,challenge:string,record:ProcessRecord) {return createHmac('sha256',key).update(JSON.stringify({challenge,record})).digest('hex');}
export async function processProof(secrets:SecretStore,record:ProcessRecord,body:unknown) {
  const {challenge}=z.strictObject({challenge:z.uuid()}).parse(body);
  const key=await secrets.get(record.installationId,'api');if(!key)throw new Error('SECRET_STORE_UNAVAILABLE');
  return {record,proof:proof(key,challenge,record)};
}
export function publishProcess(selection:RootSelection,record:ProcessRecord):void {
  readInstallation(selection);const path=recordPath(selection,record.role);
  writeFileSync(path,JSON.stringify(recordSchema.parse(record)),{flag:'wx',mode:0o600});protectPath(path);
}
export async function runtimeIdentity(selection:RootSelection,role:'api'|'worker',build:BuildIdentity,nonce:string,controlPort:number):Promise<ProcessRecord> {
  const metadata=readInstallation(selection);z.uuid().parse(nonce);BuildIdentitySchema.parse(build);
  const os=await observeProcess(process.pid);if(!os||os.executable!==realpathSync(process.execPath))throw new Error('PROCESS_OWNERSHIP_UNCONFIRMED');
  return recordSchema.parse({installationId:metadata.installationId,role,buildId:build.buildId,pid:process.pid,nonce,...os,entrypoint:realpathSync(process.argv[1]!),controlPort});
}
/** Exactly three non-secret launch arguments. No default installation or ambient token. */
export function serviceSelection():{selection:RootSelection;nonce:string}|null {
  if(process.argv[2]!=='--autoed-service')return null;
  if(process.argv.length!==6)throw new Error('INVALID_SERVICE_LAUNCH');
  const root=process.argv[3]!,parent=process.argv[4]!,nonce=z.uuid().parse(process.argv[5]);
  const selection={root,parent,excludedRoots:[]};readInstallation(selection);return {selection,nonce};
}
export interface SupervisorOptions { selection:RootSelection;managedNode:string;entries:Record<'api'|'worker',string>;secrets?:SecretStore;workerContext?:WriteContext }
export class OwnedProcessSupervisor implements ProcessSupervisor {
  private readonly secrets:SecretStore;
  constructor(private readonly options:SupervisorOptions){this.secrets=options.secrets??new NativeSecretStore();}
  private record(role:'api'|'worker'):ProcessRecord|null {
    const path=recordPath(this.options.selection,role);if(!existsSync(path))return null;
    if(lstatSync(path).size>16384)throw new Error('PROCESS_OWNERSHIP_UNCONFIRMED');
    return recordSchema.parse(JSON.parse(readFileSync(path,'utf8')));
  }
  /** Local lifecycle/recovery only; never serialize these records to model/status output. */
  registered():ProcessIdentity[] {readInstallation(this.options.selection);return (['api','worker'] as const).flatMap(role=>{const record=this.record(role);return record?[record]:[];});}
  hasPendingLaunch():boolean {return (['api','worker'] as const).some(role=>existsSync(assertManagedPath(managedPaths(this.options.selection.root),`runtime/${role}.launch`)));}
  async confirmPendingLaunch(identity:ProcessIdentity):Promise<void> {
    if(await this.inspect(identity)!=='running')throw new Error('PROCESS_OWNERSHIP_UNCONFIRMED');
    const paths=managedPaths(this.options.selection.root);const lock=assertManagedPath(paths,`runtime/${identity.role}.launch`);
    const path=assertManagedPath(paths,`runtime/${identity.role}.launch/intent.json`);
    if(lstatSync(path).size>4096)throw new Error('PROCESS_OWNERSHIP_UNCONFIRMED');
    const intent=intentSchema.parse(JSON.parse(readFileSync(path,'utf8')));
    if(intent.installationId!==identity.installationId||intent.role!==identity.role||intent.buildId!==identity.buildId||intent.nonce!==identity.nonce)throw new Error('PROCESS_OWNERSHIP_UNCONFIRMED');
    unlinkSync(path);rmdirSync(lock);
  }
  /** Recover only a recorded failed launch whose PID is actually absent. No signals. */
  async confirmFailedLaunchExit(role:'api'|'worker'):Promise<void> {
    const metadata=readInstallation(this.options.selection);const paths=managedPaths(this.options.selection.root);
    const lock=assertManagedPath(paths,`runtime/${role}.launch`),path=assertManagedPath(paths,`runtime/${role}.launch/intent.json`);
    if(lstatSync(path).size>4096)throw new Error('PROCESS_OWNERSHIP_UNCONFIRMED');
    const intent=intentSchema.parse(JSON.parse(readFileSync(path,'utf8')));
    if(intent.installationId!==metadata.installationId||intent.role!==role||!intent.pid||await observeProcess(intent.pid)!==null)throw new Error('PROCESS_EXIT_UNCONFIRMED');
    unlinkSync(path);rmdirSync(lock);
  }
  private async validated(identity:ProcessIdentity):Promise<ProcessRecord> {
    const metadata=readInstallation(this.options.selection);const record=this.record(identity.role);
    if(!record||metadata.installationId!==identity.installationId||!same(record,identity)||record.entrypoint!==realpathSync(this.options.entries[identity.role])||record.executable!==realpathSync(this.options.managedNode)||!matchesProcess(identity,await observeProcess(identity.pid)))throw new Error('PROCESS_OWNERSHIP_UNCONFIRMED');
    return record;
  }
  private async request(record:ProcessRecord,path:'/api/process/inspect'|'/api/control/shutdown') {
    if(!ownsListener(record.pid,record.controlPort)||!matchesProcess(record,await observeProcess(record.pid)))throw new Error('PROCESS_OWNERSHIP_UNCONFIRMED');
    const token=await this.secrets.get(record.installationId,'cli');if(!token)throw new Error('SECRET_STORE_UNAVAILABLE');
    const challenge=randomUUID();
    const response=await fetch(`http://127.0.0.1:${record.controlPort}${path}`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(2000),headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(path==='/api/process/inspect'?{challenge}:{})});
    if(response.status!==200)throw new Error('PROCESS_OWNERSHIP_UNCONFIRMED');
    const value=await response.json();
    if(path==='/api/process/inspect') {
      const parsed=z.strictObject({record:recordSchema,proof:z.string().regex(/^[a-f0-9]{64}$/)}).parse(value);
      const key=await this.secrets.get(record.installationId,'api');
      if(!key||JSON.stringify(parsed.record)!==JSON.stringify(record)||!timingSafeEqual(Buffer.from(parsed.proof,'hex'),Buffer.from(proof(key,challenge,record),'hex')))throw new Error('PROCESS_OWNERSHIP_UNCONFIRMED');
    } else z.strictObject({accepted:z.literal(true)}).parse(value);
  }
  async inspect(identity:ProcessIdentity):Promise<'running'|'exited'|'identity_mismatch'|'unknown'> {
    try {
      const metadata=readInstallation(this.options.selection);const record=this.record(identity.role);
      if(!record||metadata.installationId!==identity.installationId||!same(record,identity))return 'identity_mismatch';
      const os=await observeProcess(identity.pid);if(!os)return 'exited';
      if(!matchesProcess(identity,os))return 'identity_mismatch';
      await this.request(await this.validated(identity),'/api/process/inspect');return 'running';
    } catch{return 'unknown';}
  }
  async start(launch:ProcessLaunch):Promise<ProcessIdentity> {
    const metadata=readInstallation(this.options.selection);BuildIdentitySchema.parse(launch.build);
    if(metadata.installationId!==launch.installationId||!['api','worker'].includes(launch.role))throw new Error('PROCESS_OWNERSHIP_UNCONFIRMED');
    const node=this.options.managedNode,entry=this.options.entries[launch.role];
    for(const path of [node,entry]) {if(!isAbsolute(path))throw new Error('UNSAFE_PATH');assertSafeAncestors(path);if(realpathSync(path)!==path||!lstatSync(path).isFile())throw new Error('UNSAFE_PATH');}
    const lock=assertManagedPath(managedPaths(this.options.selection.root),`runtime/${launch.role}.launch`);
    try {mkdirSync(lock,{mode:0o700});protectPath(lock);}catch{throw new Error('PROCESS_START_IN_PROGRESS');}
    let releaseLock=true;
    try {
      const existing=this.record(launch.role);
      if(existing) {
        const state=await this.inspect(existing);
        if(state==='running'&&existing.buildId===launch.build.buildId)return existing;
        if(state!=='exited')throw new Error('PROCESS_OWNERSHIP_UNCONFIRMED');
        unlinkSync(recordPath(this.options.selection,launch.role));
      }
      if(launch.role==='api')await assertPortAvailable(metadata.port);
      const nonce=randomUUID();
      // Credentials never enter argv/environment/stdio; child retrieves its exact OS namespace.
      const env:NodeJS.ProcessEnv={};for(const key of ['SystemRoot','WINDIR','LOCALAPPDATA','USERPROFILE','HOME','TMPDIR','TEMP','TMP'])if(process.env[key])env[key]=process.env[key];
      if(metadata.syntheticTest===true){env.AUTOED_SYNTHETIC_TEST='1';env.AUTOED_SYNTHETIC_PORT=String(metadata.port);}
      const intentPath=assertManagedPath(managedPaths(this.options.selection.root),`runtime/${launch.role}.launch/intent.json`);
      const intent=intentSchema.parse({installationId:launch.installationId,role:launch.role,buildId:launch.build.buildId,nonce,...(launch.role==='worker'&&this.options.workerContext?{context:this.options.workerContext}:{})});
      durableIntent(intentPath,intent);
      releaseLock=false;
      const child=spawn(node,[entry,'--autoed-service',this.options.selection.root,this.options.selection.parent,nonce],{detached:true,stdio:'ignore',shell:false,windowsHide:true,env});
      let spawnError=false;child.on('error',()=>{spawnError=true;});child.unref();
      if(child.pid){
        let os:OSProcess|null=null;try{os=await observeProcess(child.pid);}catch{/* PID remains a recovery candidate, never kill authority. */}
        durableIntent(intentPath,{...intent,pid:child.pid,...(os?{os}:{})});
      }
      const deadline=Date.now()+10000;
      while(Date.now()<deadline) {
        const record=this.record(launch.role);
        if(record) {
          if(record.pid!==child.pid||record.nonce!==nonce||record.buildId!==launch.build.buildId)throw new Error('PROCESS_OWNERSHIP_UNCONFIRMED');
          if(await this.inspect(record)==='running'){releaseLock=true;return record;}
        }
        if(spawnError||child.exitCode!==null||child.signalCode!==null){releaseLock=true;throw new Error('SERVICE_START_FAILED');}
        await wait(250);
      }
      // Preserve unknown/late start evidence rather than killing a PID or reporting success.
      throw new Error('SERVICE_START_UNCONFIRMED');
    } finally {if(releaseLock){const intent=assertManagedPath(managedPaths(this.options.selection.root),`runtime/${launch.role}.launch/intent.json`);if(existsSync(intent))unlinkSync(intent);rmdirSync(lock);}}
  }
  async stop(identity:ProcessIdentity):Promise<void> {
    const record=this.record(identity.role);
    if(!record||!same(record,identity))throw new Error('PROCESS_OWNERSHIP_UNCONFIRMED');
    const state=await this.inspect(identity);if(state==='exited')return;
    if(state!=='running')throw new Error('PROCESS_OWNERSHIP_UNCONFIRMED');
    await this.request(await this.validated(identity),'/api/control/shutdown');
    const deadline=Date.now()+5000;
    while(Date.now()<deadline) {const os=await observeProcess(identity.pid);if(!os)return;if(!matchesProcess(identity,os))throw new Error('PROCESS_OWNERSHIP_UNCONFIRMED');await wait(100);}
    // Authenticated control is preferred. No OS signal when the responder or OS identity is unknown.
    if(await this.inspect(identity)!=='running')throw new Error('PROCESS_STOP_UNCONFIRMED');
    await this.validated(identity);process.kill(identity.pid,'SIGTERM');
    const end=Date.now()+3000;while(Date.now()<end){const os=await observeProcess(identity.pid);if(!os)return;if(!matchesProcess(identity,os))throw new Error('PROCESS_OWNERSHIP_UNCONFIRMED');await wait(100);}
    throw new Error('PROCESS_STOP_UNCONFIRMED');
  }
}
