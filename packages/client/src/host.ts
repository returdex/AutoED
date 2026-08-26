import {registerClientHost} from '../../platform/src/client-host.js';
import type {BuildIdentity} from '../../domain/src/model.js';
/** Fixed entry configuration only; no host receipt or process details are returned to a model. */
export async function registerHost(root:string,parent:string,build:BuildIdentity,credentialId?:string){await registerClientHost({root,parent,excludedRoots:[]},build,credentialId);}
