import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ApplicationError, type AuthControlApplication, type Principal } from '../../../packages/application/src/policy.js';
import { ApprovedSourceConfigSchema, EvidenceCellKeySchema } from '../../../packages/contracts/src/index.js';

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
  expectedGeneration: number;
  principal(request: FastifyRequest): Principal;
}

export function registerAuthRoutes(app: FastifyInstance, dependencies: AuthRouteDependencies): void {
  const actions = new LoginActionRegistry(dependencies.expectedGeneration);
  const application = () => {
    if (!dependencies.application) throw new ApplicationError('INTERNAL_ERROR', 503);
    return dependencies.application;
  };
  const paired = (request: FastifyRequest) => {
    const principal = dependencies.principal(request);
    if (principal.destination !== 'local_ui' || !principal.browserSessionId) throw new ApplicationError('FORBIDDEN');
    return { principal, sessionId: principal.browserSessionId };
  };

  app.get('/api/auth/status', async request => application().readStatus(dependencies.principal(request)));

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
}
