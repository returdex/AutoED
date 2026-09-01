import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { SQLiteSessions } from '../../../packages/persistence/src/sessions.js';
import { ApplicationError, authorize, type Principal } from '../../../packages/application/src/policy.js';
import type { OutputPolicy } from '../../../packages/application/src/ports.js';

const cookieOptions = { httpOnly: true, sameSite: 'strict' as const, path: '/', secure: false };
const Empty = z.strictObject({}); const Accepted = z.strictObject({ accepted: z.literal(true) });
const Secret = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const publicPairingPaths = new Set(['/api/pairing/nonce', '/api/pairing/pending', '/api/pairing/exchange']);
export function sameOrigin(request: FastifyRequest, origin: string) {
  // Same-origin GET fetch commonly omits Origin. Fetch metadata plus exact Referer
  // supports the real browser without treating a missing Origin alone as approval.
  if (request.headers.origin === origin) return;
  if (request.method === 'GET' && request.headers.origin === undefined && request.headers['sec-fetch-site'] === 'same-origin' && request.headers.referer?.startsWith(origin + '/')) return;
  throw new ApplicationError('PAIRING_DENIED');
}
export function browserPrincipal(request: FastifyRequest, sessions: SQLiteSessions, origin: string): Principal {
  sameOrigin(request, origin);
  const token = request.cookies.autoed_session ?? '';
  const session = sessions.authenticate(token, request.method === 'GET' || request.method === 'HEAD' ? undefined : String(request.headers['x-autoed-csrf'] ?? ''));
  return {
    scope: { installationId: sessions.installationId, source: 'synthetic', courseId: 'selftest' },
    destination: 'local_ui',
    permissions: ['status:read', 'jobs:read', 'auth:read', 'auth:receipts:read', 'auth:configuration:write', 'auth:login:write', 'auth:probe:write', 'auth:logout:write', 'auth:binding:write'],
    browserSessionId: session,
  };
}
export function registerPairing(app: FastifyInstance, sessions: SQLiteSessions, origin: () => string, principal: (r: FastifyRequest) => Principal, policy: OutputPolicy) {
  const publicPolicy = async (request: FastifyRequest) => {
    sameOrigin(request, origin());
    if (!(await policy.authorize({ installationId: sessions.installationId, source: 'synthetic', courseId: 'selftest' }, 'status', 'local_ui')).allowed) throw new ApplicationError('PAIRING_DENIED');
  };
  app.get('/api/pairing/nonce', async (request, reply) => {
    await publicPolicy(request); const { nonce, binding } = sessions.nonce();
    reply.setCookie('autoed_nonce', binding, { ...cookieOptions, maxAge: 60 });
    return z.strictObject({ nonce: Secret }).parse({ nonce });
  });
  app.post('/api/pairing/pending', async (request, reply) => {
    await publicPolicy(request); const { nonce } = z.strictObject({ nonce: Secret }).parse(request.body);
    if (request.headers['x-autoed-csrf'] !== nonce) throw new ApplicationError('PAIRING_DENIED');
    const pending = sessions.pending(request.cookies.autoed_nonce ?? '', nonce);
    reply.clearCookie('autoed_nonce', cookieOptions).setCookie('autoed_pending', pending.token, { ...cookieOptions, maxAge: 300 });
    return z.strictObject({ code: z.string().regex(/^[A-F0-9]{16}$/), state: z.literal('pending') }).parse({ code: pending.code, state: 'pending' });
  });
  app.post<{ Params: { code: string } }>('/api/pairing/:code/approve', async request => {
    await authorize(policy, principal(request), 'pairing:approve', 'status');
    // Explicit confirmation payload is supplied only after the CLI human prompt.
    const { confirmedCode } = z.strictObject({ confirmedCode: z.string().max(32) }).parse(request.body);
    if (!/^[A-F0-9]{16}$/.test(request.params.code) || confirmedCode !== request.params.code) throw new ApplicationError('PAIRING_DENIED');
    sessions.approve(confirmedCode); return Accepted.parse({ accepted: true });
  });
  app.post('/api/pairing/exchange', async (request, reply) => {
    await publicPolicy(request); Empty.parse(request.body);
    const session = sessions.exchange(request.cookies.autoed_pending ?? '', String(request.headers['x-autoed-csrf'] ?? ''));
    reply.clearCookie('autoed_pending', cookieOptions).setCookie('autoed_session', session.token, { ...cookieOptions, maxAge: 8 * 60 * 60 });
    return z.strictObject({ csrf: Secret, sessionId: z.uuid() }).parse({ csrf: session.csrf, sessionId: session.id });
  });
  app.post('/api/pairing/revoke', async (request, reply) => {
    const p = principal(request);
    if (p.destination === 'local_ui') {
      await authorize(policy, p, 'status:read', 'status'); Empty.parse(request.body);
      sessions.revoke(request.cookies.autoed_session ?? '', String(request.headers['x-autoed-csrf'] ?? ''));
      reply.clearCookie('autoed_session', cookieOptions);
    } else {
      await authorize(policy, p, 'pairing:approve', 'status'); z.strictObject({ all: z.literal(true) }).parse(request.body); sessions.revokeAll();
    }
    return Accepted.parse({ accepted: true });
  });
}
