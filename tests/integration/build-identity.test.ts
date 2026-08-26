import {expect,it} from 'vitest';
import {assessIdentity} from '../../packages/application/src/identity.js';
import type {BuildIdentity,ComponentObservation} from '../../packages/domain/src/model.js';
const build:BuildIdentity={version:'0.1.0-beta.1',buildId:'a'.repeat(64),commit:'b'.repeat(40),tree:'c'.repeat(40),dependencyHash:'d'.repeat(64),protocol:1,schemaMin:1,schemaMax:1,capabilities:['echo','digest']};
const probes:ComponentObservation[]=(['api','worker','cli','mcp'] as const).map(role=>({role,build,health:'healthy',evidence:'authenticated_probe',checkedAt:new Date().toISOString(),freshness:'fresh'}));
it('every identity dimension and actual feature evidence is mandatory, not version or HTTP health alone',()=>{
  expect(assessIdentity(build,probes,true).matched).toBe(true);expect(assessIdentity(build,probes,false).matched).toBe(false);
  for(const field of ['buildId','commit','tree','dependencyHash','protocol','schemaMin','schemaMax','capabilities'] as const){const changed={...build,[field]:field==='capabilities'?['echo']:typeof build[field]==='number'?2:'e'.repeat(64)};expect(assessIdentity(build,probes.map(p=>p.role==='mcp'?{...p,build:changed as BuildIdentity}:p),true).matched).toBe(false);}
  expect(assessIdentity(build,probes.slice(1),true).matched).toBe(false);expect(assessIdentity(build,probes.map(p=>p.role==='worker'?{...p,freshness:'stale'}:p),true).matched).toBe(false);
});
