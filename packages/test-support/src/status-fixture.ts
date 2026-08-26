import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { createHarness } from './harness.js';
import { startApi } from '../../../apps/api/src/main.js';
import { openDatabase, SQLiteMaintenanceStore } from '../../persistence/src/database.js';
import { SQLiteJobStore } from '../../persistence/src/claims.js';
import { SQLiteStatusProjectionStore } from '../../persistence/src/runtime-status.js';
import { SQLiteSessions } from '../../persistence/src/sessions.js';
import { issueCredential } from '../../platform/src/credentials.js';
import type { SecretStore, StatusProjectionStore } from '../../application/src/ports.js';
import type { BuildIdentity } from '../../domain/src/model.js';
import { ApplicationError } from '../../application/src/policy.js';

/** Synthetic-only test fixture. No fixture route, real credentials or persistent Profile. */
export async function createStatusFixture(options:{assetsRoot:string;build?:BuildIdentity}) {
  const h=createHarness();const db=openDatabase(join(h.root,'status.sqlite'));
  const scope={installationId:randomUUID(),source:'synthetic' as const,courseId:'selftest' as const};
  const build=options.build??{version:'0.1.0-beta.1',buildId:'a'.repeat(64),commit:'b'.repeat(40),tree:'c'.repeat(40),dependencyHash:'d'.repeat(64),protocol:1,schemaMin:1,schemaMax:1,capabilities:['echo']} as BuildIdentity;
  const values=new Map<string,string>();const secrets:SecretStore={async get(_id,name){return values.get(name)??null;},async set(_id,name,value){values.set(name,value);},async delete(_id,name){values.delete(name);}};
  const credentials=[await issueCredential(secrets,scope.installationId,'cli',scope,'local_cli')];
  const jobs=new SQLiteJobStore(db),projections=new SQLiteStatusProjectionStore(db),maintenance=new SQLiteMaintenanceStore(db),sessions=new SQLiteSessions(db,scope.installationId);
  let denied=false;let hold:Promise<void>|undefined;let release:(()=>void)|undefined;
  const reads:StatusProjectionStore={async read(){if(hold)await hold;if(denied)throw new ApplicationError('FORBIDDEN');return projections.read();},writeComponent:(...args)=>projections.writeComponent(...args),writeInstall:(...args)=>projections.writeInstall(...args),writeSelfcheck:(...args)=>projections.writeSelfcheck(...args)};
  try{
    const api=await startApi({host:'127.0.0.1',port:0,installationId:scope.installationId,build,secrets,credentials,jobs,projections:reads,maintenance,sessions,shutdown:async()=>{},assetsRoot:options.assetsRoot});
    return {h,db,scope,build,jobs,projections,maintenance,sessions,api,
      async approve(code:string){return h.fetch(api.origin+`/api/pairing/${code}/approve`,{method:'POST',headers:{authorization:`Bearer ${values.get('cli')}`,'content-type':'application/json'},body:JSON.stringify({confirmedCode:code})});},
      deny(value:boolean){denied=value;},hold(){hold=new Promise<void>(r=>{release=r;});},release(){release?.();hold=undefined;},
      async close(){release?.();await api.close();db.close();values.clear();await h.cleanup();},
    };
  }catch(error){db.close();values.clear();await h.cleanup();throw error;}
}
