import type {BuildIdentity,ComponentObservation} from '../../domain/src/model.js';
export function sameIdentity(a:BuildIdentity|null|undefined,b:BuildIdentity|null|undefined):boolean {
  return Boolean(a&&b&&['version','buildId','commit','tree','dependencyHash','protocol','schemaMin','schemaMax'].every(k=>a[k as keyof BuildIdentity]===b[k as keyof BuildIdentity])&&[...a.capabilities].sort().join() === [...b.capabilities].sort().join());
}
/** Manifest is the expectation; every probe and functional result is independent evidence. */
export function assessIdentity(expected:BuildIdentity,probes:ComponentObservation[],featuresVerified:boolean) {
  const matched=featuresVerified&&probes.length===4&&['api','worker','cli','mcp'].every(role=>probes.some(p=>p.role===role&&p.health==='healthy'&&p.evidence!=='not_observed'&&p.freshness!=='stale'&&p.checkedAt!==null&&Date.now()-Date.parse(p.checkedAt)>=0&&Date.now()-Date.parse(p.checkedAt)<30000&&sameIdentity(expected,p.build)));
  return {matched,code:matched?'IDENTITY_MATCH':'IDENTITY_MISMATCH'};
}
