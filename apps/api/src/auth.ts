import { createHash, randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ApplicationError, type AuthControlApplication, type Principal } from '../../../packages/application/src/policy.js';
import type { SecretStore } from '../../../packages/application/src/ports.js';
import {
  type LiveCheckpointAuthorityPort,
  type PairedLiveAuthority,
  type PairedLiveCheckpointService,
  type NativeEvidenceService,
} from '../../../packages/application/src/live-checkpoints.js';
import type { LiveCheckpointBinding, PairedLiveResult } from '../../../packages/domain/src/live-evidence.js';
import { ApprovedSourceConfigSchema, EvidenceCellKeySchema } from '../../../packages/contracts/src/index.js';
import { NativeEvidenceCommandSchema, Phase2GateRuntimeProjectionSchema } from '../../../packages/contracts/src/live-evidence.js';
import type { Phase2GateRuntimeProjection } from '../../../packages/domain/src/live-evidence.js';

const source = z.enum(['moodle', 'edstem']);
const configurationBody = z.strictObject({ config: ApprovedSourceConfigSchema });
const loginBody = z.strictObject({ source, approvedConfigId: z.uuid() });
const probeBody = z.strictObject({
  source,
  approvedConfigId: z.uuid(),
  approvedScopeId: z.uuid(),
  trigger: z.enum(['background', 'user_login_completed', 'manual_retry']),
  idempotencyKey: z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/),
  actionReceiptId: z.uuid().optional(),
}).superRefine((value, context) => {
  if (value.trigger === 'user_login_completed' && value.actionReceiptId === undefined) context.addIssue({ code: 'custom', message: 'Action receipt required' });
  if (value.trigger !== 'user_login_completed' && value.actionReceiptId !== undefined) context.addIssue({ code: 'custom', message: 'Action receipt forbidden' });
});
const logoutBody = z.strictObject({ source, acknowledged: z.literal(true) });
const bindingBody = z.strictObject({ candidateBindingId: z.uuid(), decision: z.enum(['confirm', 'reject']) });
const emptyLiveBody = z.strictObject({});
const liveResultBody = z.strictObject({ actionId: z.uuid(), acknowledgement: z.enum(['completed', 'failed', 'human_needed']) });

const liveBindingHash = (binding: LiveCheckpointBinding): string => createHash('sha256').update(JSON.stringify(binding)).digest('hex');

/** Restart-safe authority derives only from protected installation secret state and immutable binding. */
export class DurablePairedLiveAuthority implements LiveCheckpointAuthorityPort {
  #secret: Promise<string> | null = null;
  constructor(private readonly secrets: SecretStore, private readonly installationId: string) { z.uuid().parse(installationId); }
  private authority(binding: LiveCheckpointBinding, secret: string): PairedLiveAuthority {
    return { kind: 'paired_server_authenticated', secret, principalSessionHash: liveBindingHash(binding) };
  }
  private key(): Promise<string> {
    if (!this.#secret) this.#secret = (async () => {
      const current = await this.secrets.get(this.installationId, 'live-checkpoint-authority');
      if (current && z.uuid().safeParse(current).success) return current;
      if (current) throw new ApplicationError('INTERNAL_ERROR', 503);
      const created = randomUUID(); await this.secrets.set(this.installationId, 'live-checkpoint-authority', created); return created;
    })();
    return this.#secret;
  }
  async mint(binding: LiveCheckpointBinding): Promise<PairedLiveAuthority> { return this.authority(binding, await this.key()); }
  async resolve(action: import('../../../packages/domain/src/live-evidence.js').PendingLiveAction, result: PairedLiveResult): Promise<PairedLiveAuthority> {
    if (action.actionId !== result.actionId) throw new ApplicationError('FORBIDDEN');
    const { actionId: _id, issuedAt: _issued, expiresAt: _expires, state: _state, consumedAt: _consumed, ...binding } = action;
    return this.authority(binding, await this.key());
  }
}

interface LoginAction {
  sessionId: string;
  source: 'moodle' | 'edstem';
  approvedConfigId: string;
  generation: number;
  kind: 'official_login';
  expiresAt: number;
  consumedAt: number | null;
}

/** Process-local correlation only. A service restart necessarily revokes every outstanding action. */
class LoginActionRegistry {
  readonly #records = new Map<string, LoginAction>();
  constructor(private readonly generation: number, private readonly now = () => Date.now(), private readonly lifetimeMs = 10 * 60_000) {}

  issue(sessionId: string, value: { source: 'moodle' | 'edstem'; approvedConfigId: string }): string {
    const actionReceiptId = randomUUID();
    this.#records.set(actionReceiptId, { sessionId, ...value, generation: this.generation, kind: 'official_login', expiresAt: this.now() + this.lifetimeMs, consumedAt: null });
    return actionReceiptId;
  }

  revoke(actionReceiptId: string): void { this.#records.delete(actionReceiptId); }

  revokeSession(sessionId: string): void {
    for (const [id, record] of this.#records) if (record.sessionId === sessionId) this.#records.delete(id);
  }

  consume(actionReceiptId: string, expected: { sessionId: string; source: 'moodle' | 'edstem'; approvedConfigId: string }): void {
    const record = this.#records.get(actionReceiptId);
    if (!record || record.consumedAt !== null || record.expiresAt <= this.now() || record.generation !== this.generation ||
        record.kind !== 'official_login' || record.sessionId !== expected.sessionId || record.source !== expected.source ||
        record.approvedConfigId !== expected.approvedConfigId) throw new ApplicationError('FORBIDDEN');
    record.consumedAt = this.now();
  }
}

export interface AuthRouteDependencies {
  application: AuthControlApplication | null;
  liveApplication?: PairedLiveCheckpointService | null;
  nativeEvidenceApplication?: NativeEvidenceService | null;
  gateRuntime?: (() => Promise<Phase2GateRuntimeProjection>) | null;
  expectedGeneration: number;
  principal(request: FastifyRequest): Principal;
}

export function registerAuthRoutes(app: FastifyInstance, dependencies: AuthRouteDependencies): void {
  const actions = new LoginActionRegistry(dependencies.expectedGeneration);
  const application = () => {
    if (!dependencies.application) throw new ApplicationError('INTERNAL_ERROR', 503);
    return dependencies.application;
  };
  const liveApplication = () => {
    if (!dependencies.liveApplication) throw new ApplicationError('INTERNAL_ERROR', 503);
    return dependencies.liveApplication;
  };
  const nativeEvidenceApplication = () => {
    if (!dependencies.nativeEvidenceApplication) throw new ApplicationError('INTERNAL_ERROR', 503);
    return dependencies.nativeEvidenceApplication;
  };
  const paired = (request: FastifyRequest) => {
    const principal = dependencies.principal(request);
    if (principal.destination !== 'local_ui' || !principal.browserSessionId) throw new ApplicationError('FORBIDDEN');
    return { principal, sessionId: principal.browserSessionId };
  };

  app.get('/api/auth/status', async request => application().readStatus(dependencies.principal(request)));
  app.get('/api/auth/gate-runtime', async request => {
    const actor=dependencies.principal(request);if(!actor.permissions.includes('auth:read')||!dependencies.gateRuntime)throw new ApplicationError('FORBIDDEN');
    return Phase2GateRuntimeProjectionSchema.parse(await dependencies.gateRuntime());
  });
  app.post('/api/auth/native-evidence', async request => {
    const actor=dependencies.principal(request);if(actor.destination!=='local_cli'||!actor.permissions.includes('auth:native-evidence:write'))throw new ApplicationError('FORBIDDEN');
    return nativeEvidenceApplication().record(NativeEvidenceCommandSchema.parse(request.body));
  });

  app.post('/api/auth/configuration/confirm', async request => {
    const body = configurationBody.parse(request.body); const actor = paired(request);
    return application().confirmConfiguration(actor.principal, body);
  });

  app.post('/api/auth/login/open', async request => {
    const body = loginBody.parse(request.body); const actor = paired(request);
    const actionReceiptId = actions.issue(actor.sessionId, body);
    try { return await application().openLogin(actor.principal, body, actionReceiptId, new AbortController().signal); }
    catch (error) { actions.revoke(actionReceiptId); throw error; }
  });

  app.post('/api/auth/probe', async request => {
    const body = probeBody.parse(request.body); const actor = paired(request);
    if (body.trigger === 'user_login_completed') actions.consume(body.actionReceiptId!, { sessionId: actor.sessionId, source: body.source, approvedConfigId: body.approvedConfigId });
    const { actionReceiptId: _actionReceiptId, ...command } = body;
    return application().requestProbe(actor.principal, command);
  });

  app.post('/api/auth/logout-intent', async request => {
    const body = logoutBody.parse(request.body); const actor = paired(request);
    const result = await application().recordLogoutIntent(actor.principal, body);
    actions.revokeSession(actor.sessionId);
    return result;
  });

  app.post('/api/auth/binding/confirm', async request => {
    const body = bindingBody.parse(request.body); const actor = paired(request);
    return application().confirmBinding(actor.principal, body);
  });

  app.get('/api/auth/receipts', async request => {
    const query = EvidenceCellKeySchema.parse(request.query);
    return application().readReceipts(dependencies.principal(request), query);
  });

  app.get('/api/auth/live-action/status', async request => {
    paired(request); return liveApplication().status();
  });

  const liveRoutes = [
    ['a1-login', (service: PairedLiveCheckpointService, body: unknown) => service.issueA1Login(body), (service: PairedLiveCheckpointService, body: unknown) => service.resumeA1Login(body), (service: PairedLiveCheckpointService, body: unknown) => service.resultA1Login(body)],
    ['a2-binding', (service: PairedLiveCheckpointService, body: unknown) => service.issueA2Binding(body), (service: PairedLiveCheckpointService, body: unknown) => service.resumeA2Binding(body), (service: PairedLiveCheckpointService, body: unknown) => service.resultA2Binding(body)],
    ['a2-course-visibility', (service: PairedLiveCheckpointService, body: unknown) => service.issueA2CourseVisibility(body), (service: PairedLiveCheckpointService, body: unknown) => service.resumeA2CourseVisibility(body), (service: PairedLiveCheckpointService, body: unknown) => service.resultA2CourseVisibility(body)],
    ['b1-reopen-1', (service: PairedLiveCheckpointService, body: unknown) => service.issueB1Reopen1(body), (service: PairedLiveCheckpointService, body: unknown) => service.resumeB1Reopen1(body), (service: PairedLiveCheckpointService, body: unknown) => service.resultB1Reopen1(body)],
    ['b1-reopen-2', (service: PairedLiveCheckpointService, body: unknown) => service.issueB1Reopen2(body), (service: PairedLiveCheckpointService, body: unknown) => service.resumeB1Reopen2(body), (service: PairedLiveCheckpointService, body: unknown) => service.resultB1Reopen2(body)],
    ['b1-reopen-3', (service: PairedLiveCheckpointService, body: unknown) => service.issueB1Reopen3(body), (service: PairedLiveCheckpointService, body: unknown) => service.resumeB1Reopen3(body), (service: PairedLiveCheckpointService, body: unknown) => service.resultB1Reopen3(body)],
    ['b2-worker-restart', (service: PairedLiveCheckpointService, body: unknown) => service.issueB2WorkerRestart(body), (service: PairedLiveCheckpointService, body: unknown) => service.resumeB2WorkerRestart(body), (service: PairedLiveCheckpointService, body: unknown) => service.resultB2WorkerRestart(body)],
    ['b3-codex-exit', (service: PairedLiveCheckpointService, body: unknown) => service.issueB3CodexExit(body), (service: PairedLiveCheckpointService, body: unknown) => service.resumeB3CodexExit(body), (service: PairedLiveCheckpointService, body: unknown) => service.resultB3CodexExit(body)],
    ['c-os-restart', (service: PairedLiveCheckpointService, body: unknown) => service.issueCOsRestart(body), (service: PairedLiveCheckpointService, body: unknown) => service.resumeCOsRestart(body), (service: PairedLiveCheckpointService, body: unknown) => service.resultCOsRestart(body)],
    ['d-24h-recheck', (service: PairedLiveCheckpointService, body: unknown) => service.issueD24hRecheck(body), (service: PairedLiveCheckpointService, body: unknown) => service.resumeD24hRecheck(body), (service: PairedLiveCheckpointService, body: unknown) => service.resultD24hRecheck(body)],
    ['reauth', (service: PairedLiveCheckpointService, body: unknown) => service.issueReauth(body), (service: PairedLiveCheckpointService, body: unknown) => service.resumeReauth(body), (service: PairedLiveCheckpointService, body: unknown) => service.resultReauth(body)],
  ] as const;
  for (const [slug, issue, resume, result] of liveRoutes) {
    app.post(`/api/auth/live-action/${slug}/issue`, async request => {
      const body = emptyLiveBody.parse(request.body); paired(request); return issue(liveApplication(), body);
    });
    app.post(`/api/auth/live-action/${slug}/resume`, async request => {
      const body = emptyLiveBody.parse(request.body); paired(request); return resume(liveApplication(), body);
    });
    app.post(`/api/auth/live-action/${slug}/result`, async request => {
      const body = liveResultBody.parse(request.body); paired(request); return result(liveApplication(), body);
    });
  }
}
