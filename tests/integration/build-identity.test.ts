import {expect,it} from 'vitest';
import {assessIdentity} from '../../packages/application/src/identity.js';
import type {BuildIdentity,ComponentObservation} from '../../packages/domain/src/model.js';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {realpathSync,readFileSync,writeFileSync} from 'node:fs';
import {createHarness} from '../../packages/test-support/src/harness.js';
import {initializeInstallation} from '../../packages/platform/src/installation.js';
import {SelfcheckCredentials} from '../../packages/platform/src/selfcheck-credentials.js';
import {authenticate} from '../../apps/api/src/security.js';
import type {MaintenanceStore,SecretStore} from '../../packages/application/src/ports.js';
import type {MaintenanceGate} from '../../packages/domain/src/model.js';
import type {FastifyRequest} from 'fastify';
const build:BuildIdentity={version:'0.1.0-beta.1',buildId:'a'.repeat(64),commit:'b'.repeat(40),tree:'c'.repeat(40),dependencyHash:'d'.repeat(64),protocol:1,schemaMin:1,schemaMax:1,capabilities:['echo','digest']};
const probes:ComponentObservation[]=(['api','worker','cli','mcp'] as const).map(role=>({role,build,health:'healthy',evidence:'authenticated_probe',checkedAt:new Date().toISOString(),freshness:'fresh'}));
it('every identity dimension and actual feature evidence is mandatory, not version or HTTP health alone',()=>{
  expect(assessIdentity(build,probes,true).matched).toBe(true);expect(assessIdentity(build,probes,false).matched).toBe(false);
  for(const field of ['buildId','commit','tree','dependencyHash','protocol','schemaMin','schemaMax','capabilities'] as const){const changed={...build,[field]:field==='capabilities'?['echo']:typeof build[field]==='number'?2:'e'.repeat(64)};expect(assessIdentity(build,probes.map(p=>p.role==='mcp'?{...p,build:changed as BuildIdentity}:p),true).matched).toBe(false);}
  expect(assessIdentity(build,probes.slice(1),true).matched).toBe(false);expect(assessIdentity(build,probes.map(p=>p.role==='worker'?{...p,freshness:'stale'}:p),true).matched).toBe(false);
});
it('operation credential issuance is bounded, idempotent, generation fenced, revoked and recoverable without blocking fixed credentials',async()=>{
  const h=createHarness(),parent=realpathSync(h.root),selection={root:join(parent,'installation'),parent,excludedRoots:[]};
  const keys=new Map<string,string>();let afterSet=()=>{},denyDelete=false;
  const store:SecretStore={async get(id,name){return keys.get(id+name)??null;},async set(id,name,value){keys.set(id+name,value);afterSet();},async delete(id,name){if(denyDelete)throw new Error('SECRET_STORE_UNAVAILABLE');keys.delete(id+name);}};
  try{
    const metadata=await initializeInstallation(selection,store);let gate:MaintenanceGate={state:'exclusive',operationId:randomUUID(),generation:0,owner:'installer',leaseUntil:Date.now()+60000};
    const maintenance={read:async()=>gate} as MaintenanceStore;const registry=new SelfcheckCredentials(selection,store,maintenance);const op=gate.operationId!;
    await expect(registry.issue(op,1,Date.now()+60000)).rejects.toThrow('GENERATION_MISMATCH');await expect(registry.issue(op,0,Date.now()+400000)).rejects.toThrow('INVALID_CREDENTIAL');
    const issued=await registry.issue(op,0,Date.now()+60000);expect(await registry.issue(op,0,Date.now()+50000)).toEqual(issued);expect(await registry.current()).toHaveLength(1);
    const receipt=join(selection.root,`runtime/selfcheck-${op}.json`);expect(readFileSync(receipt,'utf8').includes(keys.get(metadata.installationId+issued.credentialId)!)).toBe(false);
    denyDelete=true;await expect(registry.revoke(op,0)).rejects.toThrow('SECRET_STORE_UNAVAILABLE');expect(await registry.current()).toHaveLength(0);expect(JSON.parse(readFileSync(receipt,'utf8')).state).toBe('revoking');denyDelete=false;await registry.revoke(op,0);expect(keys.has(metadata.installationId+issued.credentialId)).toBe(false);
    writeFileSync(receipt,'invalid synthetic receipt');const request={headers:{authorization:'Bearer '+keys.get(metadata.installationId+'installer')},method:'POST'} as FastifyRequest;
    expect((await authenticate(request,metadata.installationId,metadata.credentials,store,maintenance,()=>registry.current())).permissions).toContain('installer');
    await expect(authenticate({headers:{authorization:'Bearer '+'x'.repeat(43)},method:'POST'} as FastifyRequest,metadata.installationId,metadata.credentials,store,maintenance,()=>registry.current())).rejects.toThrow('UNAUTHORIZED');
    const changed=randomUUID();gate={...gate,operationId:changed};afterSet=()=>{gate={...gate,generation:1};};await expect(registry.issue(changed,0,Date.now()+60000)).rejects.toThrow('GENERATION_MISMATCH');expect(keys.has(metadata.installationId+'selfcheck-'+changed)).toBe(false);
  }finally{keys.clear();await h.cleanup();}
});
