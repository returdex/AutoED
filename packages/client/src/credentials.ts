import {NativeSecretStore} from '../../platform/src/credentials.js';
import {z} from 'zod';
export type ClientPurpose='cli'|'mcp'|'installer';
export async function clientCredential(installationId:string,purpose:ClientPurpose,credentialId?:string){
  z.uuid().parse(installationId);z.enum(['cli','mcp','installer']).parse(purpose);
  if(credentialId&&!/^selfcheck-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(credentialId))throw new Error('AUTH_REQUIRED');
  const token=await new NativeSecretStore().get(installationId,credentialId??purpose);if(!token)throw new Error('AUTH_REQUIRED');return token;
}
