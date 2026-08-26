import Fastify from 'fastify';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { BuildIdentity } from '../../../packages/domain/src/model.js';
import type { JobStore, MaintenanceStore, SecretStore, StatusProjectionStore } from '../../../packages/application/src/ports.js';
import type { CredentialRecord } from '../../../packages/platform/src/credentials.js';
import { ApiApplication, ApplicationError, SyntheticOutputPolicy, type Principal } from '../../../packages/application/src/policy.js';
import { ApplicationStatus } from '../../../packages/application/src/status.js';
import { JobRequestSchema, MaintenanceGateSchema, StatusSchema } from '../../../packages/contracts/src/index.js';
import { assertTransport, authenticate, WindowLimit } from './security.js';

export interface ApiOptions {
  host: string; port: number; installationId: string; build: BuildIdentity; secrets: SecretStore; credentials: CredentialRecord[];
  jobs: JobStore; maintenance: MaintenanceStore; projections: StatusProjectionStore; shutdown: () => Promise<void>;
}
const JobOutput = z.strictObject({
  id: z.uuid(), request: JobRequestSchema, state: z.enum(['queued','running','retry_wait','succeeded','failed','cancelled']), cancelRequested: z.boolean(), attempt: z.number().int(), maxAttempts: z.number().int(),
  nextRunAt: z.number().nullable(), lease: z.strictObject({ owner: z.string(), fence: z.number(), leaseUntil: z.number() }).nullable(), checkpoint: z.string().nullable(), result: z.string().nullable(), lastSuccessResult: z.string().nullable(), errorCode: z.string().nullable(), generation: z.number().int(), operationId: z.uuid().nullable(), createdAt: z.number(), updatedAt: z.number(),
});
const Accepted = z.strictObject({ accepted: z.literal(true) });
const safeCodes = new Set(['FORBIDDEN','UNAUTHORIZED','RATE_LIMITED','QUEUE_FULL','GENERATION_MISMATCH','MAINTENANCE_ACTIVE','MAINTENANCE_OWNERSHIP_MISMATCH','IDEMPOTENCY_CONFLICT','JOB_NOT_FOUND','JOBS_NOT_DRAINED','STALE_PROJECTION','FUTURE_OBSERVATION','INVALID_SELFCHECK']);
export async function startApi(options: ApiOptions) {
  if (options.host !== '127.0.0.1' || !Number.isInteger(options.port) || options.port < 0 || options.port > 65535) throw new Error('INVALID_BIND');
  z.uuid().parse(options.installationId);
  const app = Fastify({ logger: false, trustProxy: false, bodyLimit: 16384, requestTimeout: 10000, connectionTimeout: 10000 });
  let origin = ''; const principals = new WeakMap<FastifyRequest, Principal>(); const authLimit = new WindowLimit(30);
  const policy = new SyntheticOutputPolicy(options.installationId);
  const application = new ApiApplication(options.jobs, options.maintenance, options.projections, policy, options.shutdown);
  const status = new ApplicationStatus(options.projections, policy, options.build);
  app.addHook('onRequest', async (request, reply) => {
    reply.header('cache-control', 'no-store').header('x-content-type-options', 'nosniff').header('content-security-policy', "default-src 'self'; frame-ancestors 'none'; object-src 'none'");
    assertTransport(request, origin);
    if (request.url === '/status' && request.method === 'GET') return;
    authLimit.take(); principals.set(request, await authenticate(request, options.installationId, options.credentials, options.secrets, options.maintenance));
  });
  app.setErrorHandler((error, _request, reply) => {
    const e = error as { code?: string; statusCode?: number };
    const validation = error instanceof z.ZodError || e.code?.startsWith('FST_ERR_CTP_');
    const code = validation ? 'INVALID_REQUEST' : e.code && safeCodes.has(e.code) ? e.code : 'INTERNAL_ERROR';
    reply.code(validation ? e.statusCode === 413 ? 413 : 400 : code === 'INTERNAL_ERROR' ? 500 : e.statusCode ?? 403).send({ code, stage: 'api', nextAction: 'retry_or_check_local_service' });
  });
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ code: 'NOT_FOUND', stage: 'api', nextAction: 'use_registered_endpoint' }));
  const principal = (request: FastifyRequest) => { const p = principals.get(request); if (!p) throw new ApplicationError('UNAUTHORIZED', 401); return p; };
  app.get('/status', async (_request, reply) => reply.type('text/html').send('<!doctype html><html><head><title>AutoED</title></head><body>Pair this page using the local CLI to view status.</body></html>'));
  app.get('/api/status', async request => StatusSchema.parse(await status.read(principal(request))));
  app.post('/api/jobs', async request => JobOutput.parse(await application.enqueue(principal(request), request.body)));
  app.get<{ Params: { id: string } }>('/api/jobs/:id', async request => JobOutput.parse(await application.query(principal(request), request.params.id)));
  app.post<{ Params: { id: string } }>('/api/jobs/:id/cancel', async request => JobOutput.parse(await application.cancel(principal(request), request.params.id, request.body)));
  app.post('/api/control/shutdown', async request => Accepted.parse(await application.shutdown(principal(request), request.body)));
  app.post('/api/control/maintenance', async request => MaintenanceGateSchema.parse(await application.maintain(principal(request), request.body)));
  app.post('/api/control/status-projection', async request => Accepted.parse(await application.project(principal(request), request.body)));
  await app.listen({ host: options.host, port: options.port });
  const address = app.server.address(); if (!address || typeof address === 'string') { await app.close(); throw new Error('INVALID_BIND'); }
  origin = `http://127.0.0.1:${address.port}`;
  return { origin, close: () => app.close() };
}
