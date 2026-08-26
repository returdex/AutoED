import {request as httpRequest} from 'node:http';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {discover} from './discovery.js';
import {clientCredential,type ClientPurpose} from './credentials.js';
import {StatusSchema} from '../../contracts/src/index.js';
import {redactOutput} from '../../application/src/policy.js';
import type {BuildIdentity} from '../../domain/src/model.js';

const errorCodes=new Set(['CREDENTIAL_RECOVERY_REQUIRED','INVALID_CREDENTIAL','BACKEND_UNAVAILABLE','IDENTITY_MISMATCH','AUTH_REQUIRED','FORBIDDEN','RATE_LIMITED','MAINTENANCE_ACTIVE','GENERATION_MISMATCH','JOB_NOT_FOUND','INVALID_REQUEST','SECRET_STORE_UNAVAILABLE','PAIRING_DENIED','QUEUE_FULL','PROCESS_STOP_UNCONFIRMED','PROCESS_OWNERSHIP_UNCONFIRMED','SERVICE_START_UNCONFIRMED']);
export function clientError(error:unknown){const code=error instanceof Error?error.message:'';return {code:errorCodes.has(code)?code:'REQUEST_FAILED',stage:'client',nextAction:code==='SECRET_STORE_UNAVAILABLE'?'human_os_authorization_required':code==='CREDENTIAL_RECOVERY_REQUIRED'?'preserve_exact_receipt_for_human_recovery':'check_this_installation'};}
export class HttpClient {
  private endpoint:ReturnType<typeof discover>|undefined;private verified=false;
  constructor(private readonly root:string,private readonly parent:string,private readonly purpose:ClientPurpose,private readonly build:BuildIdentity,private readonly credentialId?:string){}
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
    if(!/^\/api\/(?:status|jobs(?:\/[0-9a-f-]{36}(?:\/cancel)?)?|pairing\/[A-F0-9]{16}\/approve|control\/(?:maintenance|status-projection|selfcheck-credential))$/.test(path))throw new Error('INVALID_REQUEST');
    await this.identity();return redactOutput((await this.raw(path,body)).value);
  }
  async status(){const endpoint=await this.identity();const status=StatusSchema.parse(await this.call('/api/status'));if(status.installationId!==endpoint.installationId)throw new Error('IDENTITY_MISMATCH');return status;}
  async selftest(kind:unknown,value:unknown,idempotencyKey:string=randomUUID()){const input=z.strictObject({kind:z.enum(['echo','digest']),value:z.string().max(4096),idempotencyKey:z.uuid()}).parse({kind,value,idempotencyKey});const endpoint=await this.identity();return this.call('/api/jobs',{...input,scope:endpoint.scope});}
  job(id:string){return this.call('/api/jobs/'+z.uuid().parse(id));}
  cancel(id:string){return this.call('/api/jobs/'+z.uuid().parse(id)+'/cancel',{});}
}
