import {request as httpRequest} from 'node:http';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {discover,isDiscoveredEndpoint} from './discovery.js';
import {clientCredential,type ClientPurpose} from './credentials.js';
import {StatusSchema} from '../../contracts/src/index.js';
import {EvidenceCellKeySchema} from '../../contracts/src/index.js';
import {RedactedAuthStatusProjectionSchema,RedactedEvidenceReceiptSchema} from '../../contracts/src/presentation.js';
import {NativeEvidenceCommandSchema,Phase2GateRuntimeProjectionSchema} from '../../contracts/src/live-evidence.js';
import {redactOutput} from '../../application/src/policy.js';
import type {BuildIdentity} from '../../domain/src/model.js';

const errorCodes=new Set(['CREDENTIAL_RECOVERY_REQUIRED','INVALID_CREDENTIAL','BACKEND_UNAVAILABLE','IDENTITY_MISMATCH','AUTH_REQUIRED','FORBIDDEN','RATE_LIMITED','MAINTENANCE_ACTIVE','GENERATION_MISMATCH','JOB_NOT_FOUND','INVALID_REQUEST','SECRET_STORE_UNAVAILABLE','PAIRING_DENIED','QUEUE_FULL','PROCESS_STOP_UNCONFIRMED','PROCESS_OWNERSHIP_UNCONFIRMED','SERVICE_START_UNCONFIRMED']);
export function clientError(error:unknown){const code=error instanceof Error?error.message:'';return {code:errorCodes.has(code)?code:'REQUEST_FAILED',stage:'client',nextAction:code==='SECRET_STORE_UNAVAILABLE'?'human_os_authorization_required':code==='CREDENTIAL_RECOVERY_REQUIRED'?'preserve_exact_receipt_for_human_recovery':'check_this_installation'};}
export class HttpClient {
  private endpoint:ReturnType<typeof discover>|undefined;private verified=false;
  constructor(private readonly root:string,private readonly parent:string,private readonly purpose:ClientPurpose,private readonly build:BuildIdentity,private readonly credentialId?:string,installerEndpoint?:ReturnType<typeof discover>){if(installerEndpoint){if(purpose!=='installer'||!isDiscoveredEndpoint(installerEndpoint))throw new Error('INVALID_REQUEST');this.endpoint=installerEndpoint;}}
  private async raw(path:string,body?:unknown){
    const endpoint=this.endpoint??=discover(this.root,this.parent);await endpoint.guard();
    const token=await clientCredential(endpoint.installationId,this.purpose,this.credentialId);
    await endpoint.guard();
    const result=await new Promise<{status:number;value:unknown}>((resolve,reject)=>{
      const req=httpRequest({hostname:'127.0.0.1',port:endpoint.port,path,method:body===undefined?'GET':'POST',agent:false,signal:AbortSignal.timeout(5000),headers:{authorization:`Bearer ${token}`,...(body===undefined?{}:{'content-type':'application/json'})}},res=>{
        if(res.statusCode&&res.statusCode>=300&&res.statusCode<400){res.resume();reject(new Error('IDENTITY_MISMATCH'));return;}
        let text='';res.on('data',chunk=>{text+=chunk;if(text.length>131072){res.destroy();reject(new Error('BACKEND_UNAVAILABLE'));}});res.on('end',()=>{try{resolve({status:res.statusCode??0,value:JSON.parse(text)});}catch{reject(new Error('BACKEND_UNAVAILABLE'));}});res.on('error',()=>reject(new Error('BACKEND_UNAVAILABLE')));
      });req.setTimeout(5000,()=>req.destroy());req.on('error',()=>reject(new Error('BACKEND_UNAVAILABLE')));req.end(body===undefined?undefined:JSON.stringify(body));
    });
    if(result.status!==200){const code=(result.value as {code?:string})?.code;throw new Error(result.status===401?'AUTH_REQUIRED':code&&errorCodes.has(code)?code:'REQUEST_FAILED');}
    return {value:result.value,token,endpoint};
  }
  async identity(){if(!this.verified){const challenge=randomUUID();const {value,token,endpoint}=await this.raw('/api/client/identity',{challenge});let actual:BuildIdentity;try{actual=endpoint.verify(value,challenge,token);}catch{throw new Error('IDENTITY_MISMATCH');}if(actual.protocol!==this.build.protocol||actual.schemaMin>this.build.schemaMax||actual.schemaMax<this.build.schemaMin)throw new Error('IDENTITY_MISMATCH');this.verified=true;}return this.endpoint!;}
  async call(path:string,body?:unknown){
    if(!/^\/api\/(?:status|jobs(?:\/[0-9a-f-]{36}(?:\/cancel)?)?|pairing\/[A-F0-9]{16}\/approve|control\/(?:maintenance|status-projection|selfcheck-credential)|auth\/(?:status|gate-runtime|native-evidence|receipts\?platform=(?:macos|windows)&source=(?:moodle|edstem)&scenario=(?:a\.login|a\.binding|a\.course_visibility|b\.reopen_[123]|b\.worker_restart|b\.codex_exit|c\.os_restart|d\.24h_recheck|reauth)&evidence=L))$/.test(path))throw new Error('INVALID_REQUEST');
    await this.identity();return redactOutput((await this.raw(path,body)).value);
  }
  async status(){const endpoint=await this.identity();const status=StatusSchema.parse(await this.call('/api/status'));if(status.installationId!==endpoint.installationId)throw new Error('IDENTITY_MISMATCH');return status;}
  async authStatus(){return RedactedAuthStatusProjectionSchema.parse(await this.call('/api/auth/status'));}
  async authReceipts(input:unknown){const key=EvidenceCellKeySchema.parse(input);if(key.evidence!=='L')throw new Error('INVALID_REQUEST');const query=`platform=${key.platform}&source=${key.source}&scenario=${key.scenario}&evidence=L`;return z.array(RedactedEvidenceReceiptSchema).parse(await this.call('/api/auth/receipts?'+query));}
  async phase2GateRuntime(){return Phase2GateRuntimeProjectionSchema.parse(await this.call('/api/auth/gate-runtime'));}
  async phase2NativeEvidence(input:unknown){return this.call('/api/auth/native-evidence',NativeEvidenceCommandSchema.parse(input));}
  async selftest(kind:unknown,value:unknown,idempotencyKey:string=randomUUID()){const input=z.strictObject({kind:z.enum(['echo','digest']),value:z.string().max(4096),idempotencyKey:z.uuid()}).parse({kind,value,idempotencyKey});const endpoint=await this.identity();return this.call('/api/jobs',{...input,scope:endpoint.scope});}
  job(id:string){return this.call('/api/jobs/'+z.uuid().parse(id));}
  cancel(id:string){return this.call('/api/jobs/'+z.uuid().parse(id)+'/cancel',{});}
}
