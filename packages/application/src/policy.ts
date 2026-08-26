import { z } from 'zod';
import type { OutputPolicy, JobStore, MaintenanceStore, StatusProjectionStore } from './ports.js';
import type { OutputDestination, OutputOperation, Scope, WriteContext } from '../../domain/src/model.js';
import { JobRequestSchema, ScopeSchema, OutputDestinationSchema, OutputOperationSchema, ComponentObservationSchema, InstallProjectionSchema, SelfcheckProjectionSchema } from '../../contracts/src/index.js';
import { Jobs } from './jobs.js';

export class ApplicationError extends Error {
  constructor(public readonly code: string, public readonly statusCode = 403) { super(code); }
}
export type Permission = 'status:read' | 'jobs:read' | 'jobs:write' | 'jobs:selfcheck' | 'control:shutdown' | 'installer' | 'pairing:approve';
export interface Principal { scope: Scope; destination: OutputDestination; permissions: readonly Permission[]; selfcheck?: { operationId: string; generation: number } }
export class SyntheticOutputPolicy implements OutputPolicy {
  constructor(private readonly installationId: string, private readonly destinations: readonly OutputDestination[] = ['local_ui', 'local_cli', 'model']) {}
  async authorize(scope: Scope, operation: OutputOperation, destination: OutputDestination) {
    if (!ScopeSchema.safeParse(scope).success || scope.installationId !== this.installationId) return { allowed: false, reason: 'scope_denied' as const };
    if (!OutputDestinationSchema.safeParse(destination).success || !this.destinations.includes(destination)) return { allowed: false, reason: 'destination_denied' as const };
    if (!OutputOperationSchema.safeParse(operation).success) return { allowed: false, reason: 'rights_unknown' as const };
    return { allowed: true, reason: 'allowed' as const };
  }
}
/** Source strings are inert text, never paths or tool instructions. */
export function redactText(value: string): string {
  return value.replace(/(?:\/(?:Users|home|tmp|private|var|Volumes)\/|[A-Za-z]:[\\/])[^\s"'<>]*/g, '[redacted-path]')
    .replace(/(?:bearer\s+|(?:token|password|cookie|secret|authorization)\s*[:=]\s*)[^\s"'<>]+/gi, '[redacted-secret]');
}
export function redactOutput<T>(value: T): T {
  if (typeof value === 'string') return redactText(value) as T;
  if (Array.isArray(value)) return value.map(redactOutput) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactOutput(item)])) as T;
  return value;
}
export async function authorize(policy: OutputPolicy, principal: Principal, permission: Permission, operation: OutputOperation, scope = principal.scope): Promise<void> {
  if (!principal.permissions.includes(permission) || scope.installationId !== principal.scope.installationId || !(await policy.authorize(scope, operation, principal.destination)).allowed) throw new ApplicationError('FORBIDDEN');
}
const generation = z.number().int().nonnegative();
const MaintenanceInput = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('enter'), operationId: z.uuid(), expectedGeneration: generation, leaseUntil: z.number().int().nonnegative() }),
  z.strictObject({ action: z.enum(['exclusive', 'exit']), operationId: z.uuid(), expectedGeneration: generation }),
]);
const ProjectionInput = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('component'), operationId: z.uuid(), expectedGeneration: generation, value: ComponentObservationSchema }),
  z.strictObject({ kind: z.literal('install'), operationId: z.uuid(), expectedGeneration: generation, value: InstallProjectionSchema }),
  z.strictObject({ kind: z.literal('selfcheck'), operationId: z.uuid(), expectedGeneration: generation, value: SelfcheckProjectionSchema }),
]);
/** All application admission lives here, independent of HTTP or SQLite drivers. */
export class ApiApplication {
  private readonly jobs: Jobs;
  constructor(private readonly store: JobStore, private readonly maintenance: MaintenanceStore, private readonly projections: StatusProjectionStore, readonly policy: OutputPolicy, private readonly stop: () => Promise<void>) { this.jobs = new Jobs(store); }
  private async context(principal: Principal): Promise<WriteContext> {
    const gate = await this.maintenance.read();
    return { expectedGeneration: principal.selfcheck?.generation ?? gate.generation, ...(principal.selfcheck ? { selfcheck: principal.selfcheck } : {}) };
  }
  async enqueue(principal: Principal, input: unknown) {
    const request = JobRequestSchema.parse(input);
    await authorize(this.policy, principal, principal.selfcheck ? 'jobs:selfcheck' : 'jobs:write', 'selftest', request.scope);
    return redactOutput(await this.jobs.enqueue(request, await this.context(principal)));
  }
  async query(principal: Principal, id: string) {
    await authorize(this.policy, principal, 'jobs:read', 'job_read');
    const job = await this.jobs.query(z.uuid().parse(id), principal.scope);
    if (!job || principal.selfcheck && job.operationId !== principal.selfcheck.operationId) throw new ApplicationError('JOB_NOT_FOUND', 404);
    return redactOutput(job);
  }
  async cancel(principal: Principal, id: string, input: unknown) {
    z.strictObject({}).parse(input); await authorize(this.policy, principal, 'jobs:write', 'selftest');
    return redactOutput(await this.jobs.cancel(z.uuid().parse(id), principal.scope, await this.context(principal)));
  }
  async shutdown(principal: Principal, input: unknown) {
    z.strictObject({}).parse(input); await authorize(this.policy, principal, 'control:shutdown', 'status'); await this.stop(); return { accepted: true as const };
  }
  async maintain(principal: Principal, input: unknown) {
    await authorize(this.policy, principal, 'installer', 'status'); const value = MaintenanceInput.parse(input);
    if (value.action === 'enter') return this.maintenance.enterMaintenance({ ...value, owner: 'installer' });
    return value.action === 'exclusive' ? this.maintenance.markExclusive(value.operationId, value.expectedGeneration) : this.maintenance.exitMaintenance(value.operationId, value.expectedGeneration);
  }
  async project(principal: Principal, input: unknown) {
    await authorize(this.policy, principal, 'installer', 'status'); const value = ProjectionInput.parse(input);
    const context = { operationId: value.operationId, expectedGeneration: value.expectedGeneration };
    if (value.kind === 'install') await this.projections.writeInstall(value.value, context);
    else if (value.kind === 'component') await this.projections.writeComponent(value.value, context);
    else {
      if (value.value.featureResult === 'pass') {
        const job = value.value.jobId ? await this.store.query(value.value.jobId, principal.scope) : null;
        if (!job || job.state !== 'succeeded' || job.operationId !== value.operationId || job.generation !== value.expectedGeneration) throw new ApplicationError('INVALID_SELFCHECK', 409);
      }
      await this.projections.writeSelfcheck(value.value, context);
    }
    return { accepted: true as const };
  }
}
