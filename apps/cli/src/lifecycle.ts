import type { BuildIdentity, ProcessIdentity } from '../../../packages/domain/src/model.js';
import { OwnedProcessSupervisor, type SupervisorOptions } from '../../../packages/platform/src/processes.js';

/** Explicit on-demand operations only; no launch agent, login item or scheduled task. */
export class Lifecycle {
  readonly supervisor:OwnedProcessSupervisor;
  constructor(options:SupervisorOptions){this.supervisor=new OwnedProcessSupervisor(options);}
  async start(installationId:string,build:BuildIdentity){
    const api=await this.supervisor.start({installationId,role:'api',build});
    const worker=await this.supervisor.start({installationId,role:'worker',build});
    return {api,worker};
  }
  async stop(identities:{api:ProcessIdentity;worker:ProcessIdentity}){
    await this.supervisor.stop(identities.worker);await this.supervisor.stop(identities.api);
  }
  async diagnose(identities:{api:ProcessIdentity;worker:ProcessIdentity}){
    return {api:await this.supervisor.inspect(identities.api),worker:await this.supervisor.inspect(identities.worker)};
  }
}
