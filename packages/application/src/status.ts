import type { BuildIdentity } from '../../domain/src/model.js';
import type { Clock, OutputPolicy, StatusProjectionStore } from './ports.js';
import { BuildIdentitySchema, StatusSchema } from '../../contracts/src/index.js';
import { authorize, redactOutput, type Principal } from './policy.js';

export class ApplicationStatus {
  constructor(private readonly projections: StatusProjectionStore, private readonly policy: OutputPolicy, private readonly build: BuildIdentity, private readonly clock: Clock = { now: () => Date.now() }) { BuildIdentitySchema.parse(build); }
  async read(principal: Principal) {
    await authorize(this.policy, principal, 'status:read', 'status');
    const stored = await this.projections.read(); const checkedAt = new Date(this.clock.now()).toISOString();
    return StatusSchema.parse(redactOutput({ ...stored, api: { role: 'api', build: this.build, checkedAt, health: 'healthy', evidence: 'process_report', freshness: 'fresh' }, checkedAt }));
  }
}
