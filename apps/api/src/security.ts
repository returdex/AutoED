import { createHash } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import type { SecretStore, MaintenanceStore } from '../../../packages/application/src/ports.js';
import { ApplicationError, type Permission, type Principal } from '../../../packages/application/src/policy.js';
import { verifyCredential, type CredentialRecord } from '../../../packages/platform/src/credentials.js';

export class WindowLimit {
  private started = 0; private count = 0;
  constructor(private readonly max: number, private readonly now = () => Date.now()) {}
  take() { const now = this.now(); if (now - this.started >= 60_000) { this.started = now; this.count = 0; } if (++this.count > this.max) throw new ApplicationError('RATE_LIMITED', 429); }
}
const permissions: Record<CredentialRecord['destination'], readonly Permission[]> = {
  local_cli: ['status:read', 'jobs:read', 'jobs:write', 'control:shutdown', 'pairing:approve'],
  model: ['status:read', 'jobs:read', 'jobs:write'], service: ['status:read'],
  installer: ['status:read', 'jobs:read', 'control:shutdown', 'installer'], selfcheck: ['status:read', 'jobs:read', 'jobs:selfcheck'],
};
const authenticatedRecords=new WeakMap<FastifyRequest,CredentialRecord>();
export function authenticatedRecord(request:FastifyRequest){const record=authenticatedRecords.get(request);if(!record)throw new ApplicationError('UNAUTHORIZED',401);return record;}
export function assertTransport(request: FastifyRequest, origin: string): void {
  if (request.raw.socket.remoteAddress !== '127.0.0.1' || request.headers.host !== origin.slice(7) || request.headers.origin !== undefined && request.headers.origin !== origin) throw new ApplicationError('FORBIDDEN');
  if (request.headers['sec-fetch-site'] && request.headers['sec-fetch-site'] !== 'same-origin' && request.headers['sec-fetch-site'] !== 'none') throw new ApplicationError('FORBIDDEN');
}
export async function authenticate(request: FastifyRequest, installationId: string, records: readonly CredentialRecord[], secrets: SecretStore, maintenance: MaintenanceStore): Promise<Principal> {
  const header = request.headers.authorization;
  if (!header || !/^Bearer [A-Za-z0-9_-]{43}$/.test(header)) throw new ApplicationError('UNAUTHORIZED', 401);
  const token = header.slice(7); const digest = createHash('sha256').update(token).digest('hex');
  const record = records.find(item => item.installationId === installationId && item.digest === digest);
  if (!record) throw new ApplicationError('UNAUTHORIZED', 401);
  const gate = record.destination === 'selfcheck' ? await maintenance.read() : null;
  if (gate && gate.state !== 'exclusive' || !await verifyCredential(secrets, record, token, record.scope, record.destination, gate?.operationId ?? null, gate?.generation ?? null)) throw new ApplicationError('UNAUTHORIZED', 401);
  if (request.headers.origin !== undefined && request.method !== 'GET' && request.method !== 'HEAD' && request.headers['x-autoed-csrf'] !== digest) throw new ApplicationError('FORBIDDEN');
  authenticatedRecords.set(request,record);
  return { scope: record.scope, destination: record.destination === 'model'||record.destination==='selfcheck' ? 'model' : 'local_cli', permissions: permissions[record.destination], ...(record.destination === 'selfcheck' ? { selfcheck: { operationId: record.operationId!, generation: record.generation! } } : {}) };
}
