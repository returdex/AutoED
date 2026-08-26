import {randomUUID} from 'node:crypto';
import {existsSync,lstatSync,mkdirSync,openSync,closeSync,writeFileSync,fsyncSync,readFileSync,readdirSync,rmdirSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {z} from 'zod';
import {BuildIdentitySchema} from '../../contracts/src/index.js';
import type {BuildIdentity} from '../../domain/src/model.js';
import {readInstallation} from './installation.js';
import {assertManagedPath,managedPaths,type RootSelection} from './paths.js';
import {protectPath} from './permissions.js';
import {observeProcess,matchesProcess} from './processes.js';
const Lease=z.strictObject({installationId:z.uuid(),build:BuildIdentitySchema,pid:z.number().int().positive(),nonce:z.uuid(),osStartIdentity:z.string(),executable:z.string(),entrypoint:z.string(),operationId:z.uuid().nullable()});
const Admission=z.strictObject({operationId:z.uuid(),buildId:z.string().regex(/^[a-f0-9]{64}$/),mode:z.enum(['selfcheck','normal_probe','blocked'])});
const AdmissionOwner=z.strictObject({installationId:z.uuid(),pid:z.number().int().positive(),nonce:z.uuid(),osStartIdentity:z.string(),executable:z.string()});
function save(path:string,value:unknown){const fd=openSync(path,'wx',0o600);try{protectPath(path);writeFileSync(fd,JSON.stringify(value));fsyncSync(fd);}finally{closeSync(fd);}}
function read(path:string){if(lstatSync(path).size>16384)throw new Error('HOST_INVENTORY_UNCONFIRMED');return JSON.parse(readFileSync(path,'utf8'));}
/** Serializes MCP publication with acquisition of the installer update lock. Stale locks never expire. */
export async function withClientAdmission<T>(selection:RootSelection,run:()=>Promise<T>):Promise<T>{
  const metadata=readInstallation(selection),os=await observeProcess(process.pid);if(!os)throw new Error('HOST_ADMISSION_UNCONFIRMED');const lock=assertManagedPath(managedPaths(selection.root),'runtime/client-admission.lock');try{mkdirSync(lock,{mode:0o700});protectPath(lock);}catch{throw new Error('HOST_ADMISSION_UNCONFIRMED');}
  const owner=AdmissionOwner.parse({installationId:metadata.installationId,pid:process.pid,nonce:randomUUID(),...os});save(join(lock,'owner.json'),owner);
  try{return await run();}finally{if(JSON.stringify(AdmissionOwner.parse(read(join(lock,'owner.json'))))!==JSON.stringify(owner))throw new Error('HOST_ADMISSION_UNCONFIRMED');unlinkSync(join(lock,'owner.json'));rmdirSync(lock);}
}
export async function recoverClientAdmission(selection:RootSelection){const metadata=readInstallation(selection),paths=managedPaths(selection.root),lock=assertManagedPath(paths,'runtime/client-admission.lock'),path=assertManagedPath(paths,'runtime/client-admission.lock/owner.json'),owner=AdmissionOwner.parse(read(path));if(owner.installationId!==metadata.installationId||await observeProcess(owner.pid)!==null||readdirSync(lock).join()!=='owner.json')throw new Error('HOST_ADMISSION_UNCONFIRMED');unlinkSync(path);rmdirSync(lock);}
export async function registerClientHost(selection:RootSelection,build:BuildIdentity,credentialId?:string){return withClientAdmission(selection,async()=>{
  const metadata=readInstallation(selection),paths=managedPaths(selection.root);BuildIdentitySchema.parse(build);const operationId=credentialId?z.uuid().parse(credentialId.replace(/^selfcheck-/,'')):null;
  const update=assertManagedPath(paths,'installer-staging/update.lock');
  if(existsSync(update)){
    const admission=Admission.parse(read(assertManagedPath(paths,'installer-staging/update.lock/admission.json')));
    if(admission.buildId!==build.buildId||admission.mode==='blocked'||(operationId===null?admission.mode!=='normal_probe':admission.mode!=='selfcheck'||admission.operationId!==operationId))throw new Error('MAINTENANCE_ACTIVE');
  }
  const active=assertManagedPath(paths,'active.json');if(existsSync(active)){const record=read(active) as {installationId?:string;build?:BuildIdentity};if(record.installationId!==metadata.installationId||record.build?.buildId!==build.buildId)throw new Error('IDENTITY_MISMATCH');}
  const observed=await observeProcess(process.pid);if(!observed)throw new Error('HOST_INVENTORY_UNCONFIRMED');const lease=Lease.parse({installationId:metadata.installationId,build,pid:process.pid,nonce:randomUUID(),...observed,entrypoint:process.argv[1],operationId});
  const directory=assertManagedPath(paths,'runtime/clients');if(!existsSync(directory)){mkdirSync(directory,{mode:0o700});protectPath(directory);}if(readdirSync(directory).length>=256)throw new Error('HOST_INVENTORY_LIMIT');save(join(directory,lease.nonce+'.json'),lease);
  // Keep immutable receipt after EOF. Cleanup must observe actual OS exit, not trust an exit callback.
  return lease.nonce;
});}
export async function inspectClientHosts(selection:RootSelection){
  const metadata=readInstallation(selection),paths=managedPaths(selection.root),directory=assertManagedPath(paths,'runtime/clients');if(!existsSync(directory))return [];
  const names=readdirSync(directory);if(names.length>256)throw new Error('HOST_INVENTORY_UNCONFIRMED');const result=[];
  for(const name of names){if(!/^[a-f0-9-]{36}\.json$/.test(name))throw new Error('HOST_INVENTORY_UNCONFIRMED');const path=assertManagedPath(paths,'runtime/clients/'+name),lease=Lease.parse(read(path));if(lease.installationId!==metadata.installationId||name!==lease.nonce+'.json')throw new Error('HOST_INVENTORY_UNCONFIRMED');const os=await observeProcess(lease.pid);const state=os===null?'exited':matchesProcess({...lease,role:'api',buildId:lease.build.buildId},os)?'running':'unknown';result.push({lease,path,state});}
  return result;
}
export {Admission as ClientAdmissionSchema};
