import {closeSync,existsSync,fsyncSync,lstatSync,openSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {z} from 'zod';
import type {MaintenanceStore,SecretStore} from '../../application/src/ports.js';
import {issueCredential,verifyCredential,type CredentialRecord} from './credentials.js';
import {readInstallation} from './installation.js';
import {assertManagedPath,managedPaths,type RootSelection} from './paths.js';
import {protectPath,verifyProtectedPath} from './permissions.js';
import {ScopeSchema} from '../../contracts/src/index.js';
const recordSchema=z.strictObject({installationId:z.uuid(),name:z.string(),digest:z.string().regex(/^[a-f0-9]{64}$/),scope:ScopeSchema,destination:z.literal('selfcheck'),operationId:z.uuid(),generation:z.number().int().nonnegative(),expiresAt:z.number().int()});
const receiptSchema=z.strictObject({installationId:z.uuid(),operationId:z.uuid(),generation:z.number().int().nonnegative(),state:z.enum(['issuing','active','revoking','revoked']),record:recordSchema.nullable()});
type Receipt=z.infer<typeof receiptSchema>;
export const SelfcheckCredentialInput=z.discriminatedUnion('action',[
  z.strictObject({action:z.literal('issue'),operationId:z.uuid(),generation:z.number().int().nonnegative(),expiresAt:z.number().int()}),
  z.strictObject({action:z.literal('revoke'),operationId:z.uuid(),generation:z.number().int().nonnegative()}),
]);
/** Fixed exact operation receipt contains only nonsecret digests; installation metadata stays immutable. */
export class SelfcheckCredentials {
  private busy=new Set<string>();
  constructor(private selection:RootSelection,private secrets:SecretStore,private maintenance:MaintenanceStore){}
  private path(op:string){z.uuid().parse(op);readInstallation(this.selection);return assertManagedPath(managedPaths(this.selection.root),`runtime/selfcheck-${op}.json`);}
  private read(op:string):Receipt|null {
    const path=this.path(op);if(!existsSync(path))return null;verifyProtectedPath(path);if(!lstatSync(path).isFile()||lstatSync(path).size>8192)throw new Error('INVALID_CREDENTIAL');
    const r=receiptSchema.parse(JSON.parse(readFileSync(path,'utf8')));const metadata=readInstallation(this.selection);
    if(r.installationId!==metadata.installationId||r.operationId!==op||r.record&&(r.record.name!==`selfcheck-${op}`||r.record.installationId!==r.installationId||r.record.scope.installationId!==r.installationId||r.record.operationId!==op||r.record.generation!==r.generation))throw new Error('INVALID_CREDENTIAL');return r;
  }
  private write(r:Receipt,initial=false){
    const path=this.path(r.operationId),destination=initial?path:path+'.pending';const fd=openSync(destination,'wx',0o600);
    try{protectPath(destination);writeFileSync(fd,JSON.stringify(r));fsyncSync(fd);}finally{closeSync(fd);}if(!initial)renameSync(destination,path);
    if(process.platform==='darwin'){const directory=openSync(dirname(path),'r');try{fsyncSync(directory);}finally{closeSync(directory);}}
  }
  private async gate(op:string,generation:number){const gate=await this.maintenance.read();if(gate.state!=='exclusive'||gate.operationId!==op||gate.generation!==generation||gate.leaseUntil===null||gate.leaseUntil<=Date.now())throw new Error('GENERATION_MISMATCH');}
  async issue(op:string,generation:number,expiresAt:number){
    if(this.busy.has(op))throw new Error('CREDENTIAL_RECOVERY_REQUIRED');this.busy.add(op);
    try{return await this.issueUnlocked(op,generation,expiresAt);}finally{this.busy.delete(op);}
  }
  private async issueUnlocked(op:string,generation:number,expiresAt:number){
    SelfcheckCredentialInput.parse({action:'issue',operationId:op,generation,expiresAt});await this.gate(op,generation);
    if(expiresAt<=Date.now()||expiresAt>Date.now()+300000)throw new Error('INVALID_CREDENTIAL');
    const existing=this.read(op);if(existing){
      if(existing.state!=='active'||existing.generation!==generation||!existing.record)throw new Error('CREDENTIAL_RECOVERY_REQUIRED');
      const key=await this.secrets.get(existing.installationId,existing.record.name);await this.gate(op,generation);
      if(!key||!await verifyCredential(this.secrets,existing.record,key,existing.record.scope,'selfcheck',op,generation))throw new Error('CREDENTIAL_RECOVERY_REQUIRED');await this.gate(op,generation);
      return {credentialId:existing.record.name,expiresAt:existing.record.expiresAt};
    }
    const metadata=readInstallation(this.selection);const r:Receipt={installationId:metadata.installationId,operationId:op,generation,state:'issuing',record:null};this.write(r,true);
    // The durable intent survives any native failure or interruption. Never rotate a prior operation.
    const record=await issueCredential(this.secrets,metadata.installationId,`selfcheck-${op}`,metadata.approvedScope,'selfcheck',{operationId:op,generation,expiresAt});
    try{await this.gate(op,generation);if(expiresAt<=Date.now())throw new Error('GENERATION_MISMATCH');}catch(error){await this.revokeUnlocked(op,generation);throw error;}
    this.write({...r,state:'active',record:record as z.infer<typeof recordSchema>});return {credentialId:record.name,expiresAt};
  }
  async current():Promise<CredentialRecord[]>{const gate=await this.maintenance.read();if(gate.state!=='exclusive'||!gate.operationId)return [];const r=this.read(gate.operationId);return r?.state==='active'&&r.generation===gate.generation&&r.record&&r.record.expiresAt>Date.now()?[r.record]:[];}
  async revoke(op:string,generation:number){if(this.busy.has(op))throw new Error('CREDENTIAL_RECOVERY_REQUIRED');this.busy.add(op);try{return await this.revokeUnlocked(op,generation);}finally{this.busy.delete(op);}}
  private async revokeUnlocked(op:string,generation:number){const r=this.read(op);if(!r)return {revoked:true};if(r.generation!==generation)throw new Error('GENERATION_MISMATCH');if(r.state==='revoked')return {revoked:true};this.write({...r,state:'revoking'});await this.secrets.delete(r.installationId,`selfcheck-${op}`);this.write({...r,state:'revoked',record:null});return {revoked:true};}
}
