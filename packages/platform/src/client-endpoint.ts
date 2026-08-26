import {createHmac,timingSafeEqual} from 'node:crypto';
import {lstatSync,readFileSync,realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
import {readInstallation} from './installation.js';
import {assertManagedPath,managedPaths,type RootSelection} from './paths.js';
import {verifyProtectedPath} from './permissions.js';
import {ProcessRecordSchema,matchesProcess,observeProcess,ownsListener} from './processes.js';
import type {BuildIdentity} from '../../domain/src/model.js';
import type {SecretStore} from '../../application/src/ports.js';
import type {CredentialRecord} from './credentials.js';
import {BuildIdentitySchema} from '../../contracts/src/index.js';
const nativeEndpoints=new WeakSet<object>();
export function isNativeClientEndpoint(value:unknown):boolean{return typeof value==='object'&&value!==null&&nativeEndpoints.has(value);}

function proof(key:string,challenge:string,installationId:string,build:BuildIdentity,nonce:string){return createHmac('sha256',key).update(JSON.stringify({challenge,installationId,build,nonce})).digest('hex');}
export async function clientIdentityProof(store:SecretStore,credential:CredentialRecord,installationId:string,build:BuildIdentity,nonce:string,body:unknown){
  const {challenge}=z.strictObject({challenge:z.uuid()}).parse(body);
  if(credential.installationId!==installationId)throw new Error('IDENTITY_MISMATCH');
  const key=await store.get(installationId,credential.name);if(!key)throw new Error('SECRET_STORE_UNAVAILABLE');
  return {installationId,build,challenge,proof:proof(key,challenge,installationId,build,nonce)};
}
/** The only discovery adapter: paths/process details never become tool output. */
export function discoverClientEndpoint(selection:RootSelection){
  return discoverBoundClientEndpoint(selection,realpathSync(fileURLToPath(new URL('../../../apps/api/src/main.js',import.meta.url))),realpathSync(process.execPath));
}
/** Installer-only composition must verify the signed complete tree before selecting these paths. */
export function discoverBoundClientEndpoint(selection:RootSelection,expectedEntry:string,expectedNode:string){
  const metadata=readInstallation(selection);const path=assertManagedPath(managedPaths(selection.root),'runtime/api.json');
  function read(){try{verifyProtectedPath(path);if(lstatSync(path).size>16384)throw new Error();return ProcessRecordSchema.parse(JSON.parse(readFileSync(path,'utf8')));}catch{throw new Error('BACKEND_UNAVAILABLE');}}
  const record=read();
  if(record.installationId!==metadata.installationId||record.role!=='api'||record.controlPort!==metadata.port||record.entrypoint!==realpathSync(expectedEntry)||record.executable!==realpathSync(expectedNode))throw new Error('IDENTITY_MISMATCH');
  const endpoint={installationId:metadata.installationId,scope:metadata.approvedScope,port:metadata.port,
    async guard(){const current=read();const observed=await observeProcess(record.pid);if(!observed)throw new Error('BACKEND_UNAVAILABLE');if(JSON.stringify(current)!==JSON.stringify(record)||!matchesProcess(record,observed)||!ownsListener(record.pid,record.controlPort))throw new Error('IDENTITY_MISMATCH');},
    verify(value:unknown,challenge:string,key:string){const parsed=z.strictObject({installationId:z.uuid(),build:BuildIdentitySchema,challenge:z.uuid(),proof:z.string().regex(/^[a-f0-9]{64}$/)}).parse(value);if(parsed.installationId!==metadata.installationId||parsed.challenge!==challenge||parsed.build.buildId!==record.buildId||!timingSafeEqual(Buffer.from(parsed.proof,'hex'),Buffer.from(proof(key,challenge,parsed.installationId,parsed.build,record.nonce),'hex')))throw new Error('IDENTITY_MISMATCH');return parsed.build;},
  };
  Object.freeze(endpoint);nativeEndpoints.add(endpoint);return endpoint;
}
