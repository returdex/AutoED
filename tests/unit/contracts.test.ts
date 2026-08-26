import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { JobRequestSchema, BuildIdentitySchema, ObservationSchema, StatusSchema, MaintenanceGateSchema, ComponentObservationSchema, InstallProjectionSchema, SelfcheckProjectionSchema, SourceRightsSchema } from '../../packages/contracts/src/index.js';

const scope = { installationId: randomUUID(), source: 'synthetic', courseId: 'selftest' };
const request = { kind: 'echo', value: 'synthetic', idempotencyKey: randomUUID(), scope };
const build = { version: '0.1.0', buildId: 'a'.repeat(64), commit: 'b'.repeat(40), tree: 'c'.repeat(40), dependencyHash: 'd'.repeat(64), protocol: 1, schemaMin: 1, schemaMax: 1, capabilities: ['echo'] };
describe('strict application contracts', () => {
  it('accepts bounded synthetic jobs and rejects arbitrary browser instructions at every boundary', () => {
    expect(JobRequestSchema.parse(request)).toEqual(request);
    for (const field of ['url', 'js', 'selector', 'profile', 'browserHandle', 'operation', 'expectedGeneration', 'operationId']) {
      expect(JobRequestSchema.safeParse({ ...request, [field]: 'untrusted' }).success).toBe(false);
      expect(JobRequestSchema.safeParse({ ...request, scope: { ...scope, [field]: 'untrusted' } }).success).toBe(false);
    }
    for (const invalid of [{ ...scope, source: 'moodle' }, { ...scope, courseId: 'other' }, { ...scope, installationId: '' }]) {
      expect(JobRequestSchema.safeParse({ ...request, scope: invalid }).success).toBe(false);
    }
    expect(JobRequestSchema.safeParse({ ...request, value: 'x'.repeat(4097) }).success).toBe(false);
    expect(JobRequestSchema.safeParse({ ...request, idempotencyKey: 'not-a-uuid' }).success).toBe(false);
  });
  it('keeps rights and independent observation states explicit', () => {
    const observation = { auth: 'not_observed', capability: 'unknown', health: 'error', freshness: 'stale', completeness: 'partial', outcome: 'error', checkedAt: null };
    expect(ObservationSchema.parse(observation)).toEqual(observation);
    for (const outcome of ['partial', 'empty', 'error', 'not_observed', 'deleted']) expect(ObservationSchema.safeParse({ ...observation, outcome }).success).toBe(true);
    expect(ObservationSchema.safeParse({ ...observation, health: 'authenticated' }).success).toBe(false);
    expect(SourceRightsSchema.safeParse({ access: 'allowed', retain: 'allowed', disclose: 'unknown', basis: 'synthetic-fixture' }).success).toBe(true);
  });
  it('validates build identity, maintenance fencing and separate observations without inventing success', () => {
    expect(BuildIdentitySchema.parse(build)).toEqual(build);
    expect(BuildIdentitySchema.safeParse({ ...build, protocol: 2 }).success).toBe(false);
    expect(MaintenanceGateSchema.safeParse({ generation: 0, operationId: null, state: 'open', owner: null, leaseUntil: null }).success).toBe(true);
    expect(MaintenanceGateSchema.safeParse({ generation: 0, operationId: null, state: 'exclusive', owner: null, leaseUntil: null }).success).toBe(false);
    expect(StatusSchema.parse({ api: null, worker: null, install: null, selfcheck: null, checkedAt: null })).toEqual({ api: null, worker: null, install: null, selfcheck: null, checkedAt: null });
    const component = { role: 'api', build, checkedAt: '2026-08-27T00:00:00.000Z', health: 'healthy', evidence: 'authenticated_probe' };
    expect(ComponentObservationSchema.parse(component).role).toBe('api');
    expect(ComponentObservationSchema.safeParse({ ...component, secret: 'synthetic-canary' }).success).toBe(false);
    expect(ComponentObservationSchema.safeParse({ ...component, checkedAt: null }).success).toBe(false);
    expect(ComponentObservationSchema.safeParse({ ...component, evidence: 'not_observed' }).success).toBe(false);
    expect(StatusSchema.safeParse({ api: { ...component, role: 'worker' }, worker: null, install: null, selfcheck: null, checkedAt: null }).success).toBe(false);
  });
  it('rejects sensitive additions in install/selfcheck projections', () => {
    const install = { operationId: randomUUID(), stage: 'verify', result: 'running', targetBuild: build, actualBuild: null, cleanup: 'not_observed', checkedAt: '2026-08-27T00:00:00.000Z' };
    expect(InstallProjectionSchema.parse(install).actualBuild).toBeNull();
    expect(InstallProjectionSchema.parse(install)).not.toHaveProperty('previousInstallation');
    for(const previousInstallation of ['none','present','unknown'])expect(InstallProjectionSchema.parse({...install,previousInstallation})).toHaveProperty('previousInstallation',previousInstallation);
    expect(InstallProjectionSchema.safeParse({...install,previousInstallation:'assumed-none'}).success).toBe(false);
    expect(InstallProjectionSchema.safeParse({ ...install, profilePath: '/not-allowed' }).success).toBe(false);
    const selfcheck = { jobId: randomUUID(), probes: [], featureResult: 'not_observed', checkedAt: null };
    expect(SelfcheckProjectionSchema.parse(selfcheck)).toEqual(selfcheck);
    expect(SelfcheckProjectionSchema.safeParse({ ...selfcheck, token: 'synthetic-canary' }).success).toBe(false);
  });
  it('separates projection freshness from health and rejects false install success', () => {
    const component = { role: 'api', build, checkedAt: '2026-08-27T00:00:00.000Z', health: 'healthy', freshness: 'stale', evidence: 'authenticated_probe' };
    expect(ComponentObservationSchema.parse(component)).toMatchObject({ freshness: 'stale', health: 'healthy' });
    const install = { operationId: randomUUID(), stage: 'complete', result: 'succeeded', targetBuild: build, actualBuild: build, cleanup: 'complete', checkedAt: '2026-08-27T00:00:00.000Z' };
    expect(InstallProjectionSchema.safeParse(install).success).toBe(true);
    for (const change of [{ actualBuild: null }, { targetBuild: null }, { checkedAt: null }, { cleanup: 'cleanup_pending' }, { stage: 'selfcheck' }, { actualBuild: { ...build, buildId: 'e'.repeat(64) } }, { actualBuild: { ...build, dependencyHash: 'e'.repeat(64) } }]) {
      expect(InstallProjectionSchema.safeParse({ ...install, ...change }).success).toBe(false);
    }
  });
  it('requires actual consistent component evidence for selfcheck pass', () => {
    const checkedAt = '2026-08-27T00:00:00.000Z';
    const probes = ['api', 'worker', 'cli', 'mcp'].map(role => ({ role, build, checkedAt, health: 'healthy', evidence: 'authenticated_probe' }));
    const selfcheck = { jobId: randomUUID(), checkedAt, probes, featureResult: 'pass' };
    expect(SelfcheckProjectionSchema.safeParse(selfcheck).success).toBe(true);
    for (const change of [{ jobId: null }, { checkedAt: null }, { probes: [] }, { probes: [probes[0], probes[0], probes[2], probes[3]] }, { probes: probes.map((p, i) => i ? p : { ...p, health: 'error' }) }, { probes: probes.map((p, i) => i ? p : { ...p, build: { ...build, version: '0.1.0-beta.1' } }) }, { probes: probes.map(p => ({ ...p, checkedAt: '2026-08-28T00:00:00.000Z' })) }]) {
      expect(SelfcheckProjectionSchema.safeParse({ ...selfcheck, ...change }).success).toBe(false);
    }
  });
});
