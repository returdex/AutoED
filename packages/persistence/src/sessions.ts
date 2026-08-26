import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { Clock } from '../../application/src/ports.js';
import { ApplicationError } from '../../application/src/policy.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const secret = () => randomBytes(32).toString('base64url');
const validSecret = (value: string) => /^[A-Za-z0-9_-]{43}$/.test(value);
interface Row { id: string; csrf_hash: string; code: string | null; approved: number; expires: number }
/** Connection-local SQLite transactions, never persistent browser credentials or schema migrations.
 * A new API boot explicitly clears this installation even when reusing the DB connection.
 */
export class SQLiteSessions {
  private boot = randomUUID();
  constructor(private readonly db: Database.Database, readonly installationId: string, private readonly clock: Clock = { now: () => Date.now() }) {
    db.exec(`CREATE TEMP TABLE IF NOT EXISTS api_sessions(
      id TEXT PRIMARY KEY, installation TEXT NOT NULL, boot TEXT NOT NULL, kind TEXT NOT NULL,
      token_hash TEXT NOT NULL, csrf_hash TEXT NOT NULL, code TEXT, approved INTEGER NOT NULL DEFAULT 0,
      expires INTEGER NOT NULL, created INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS temp.api_sessions_lookup ON api_sessions(installation,boot,kind,token_hash);
      CREATE TEMP TABLE IF NOT EXISTS api_pairing_rates(installation TEXT NOT NULL, kind TEXT NOT NULL, started INTEGER NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(installation,kind));`);
  }
  now() { return this.clock.now(); }
  beginBoot() { this.revokeAll(); this.boot = randomUUID(); }
  endBoot() { this.db.prepare('DELETE FROM api_sessions WHERE installation=? AND boot=?').run(this.installationId, this.boot); }
  revokeAll() { this.db.prepare('DELETE FROM api_sessions WHERE installation=?').run(this.installationId); }
  private prune() { this.db.prepare('DELETE FROM api_sessions WHERE installation=? AND expires<=?').run(this.installationId, this.now()); }
  private limit(kind: string) {
    const row = this.db.prepare('SELECT started,count FROM api_pairing_rates WHERE installation=? AND kind=?').get(this.installationId, kind) as { started: number; count: number } | undefined;
    const reset = !row || this.now() - row.started >= 60000 || this.now() < row.started;
    if (!reset && row.count >= 5) throw new ApplicationError('RATE_LIMITED', 429);
    this.db.prepare('INSERT INTO api_pairing_rates VALUES(?,?,?,?) ON CONFLICT(installation,kind) DO UPDATE SET started=excluded.started,count=excluded.count').run(this.installationId, kind, reset ? this.now() : row.started, reset ? 1 : row.count + 1);
  }
  nonce() {
    return this.db.transaction(() => {
      this.prune(); this.limit('nonce');
      const nonce = secret(); const binding = secret();
      this.insert('nonce', binding, nonce, null, this.now() + 60000);
      return { nonce, binding };
    }).immediate();
  }
  pending(binding: string, nonce: string) {
    return this.db.transaction(() => {
      this.prune(); const row = this.find('nonce', binding);
      if (!row || !validSecret(nonce) || row.csrf_hash !== hash(nonce)) throw new ApplicationError('PAIRING_DENIED');
      this.limit('pending');
      const count = this.db.prepare("SELECT count(*) AS n FROM api_sessions WHERE installation=? AND boot=? AND kind='pending'").get(this.installationId, this.boot) as { n: number };
      if (count.n >= 5) throw new ApplicationError('RATE_LIMITED', 429);
      this.db.prepare('DELETE FROM api_sessions WHERE id=?').run(row.id);
      const token = secret(); const code = randomBytes(8).toString('hex').toUpperCase();
      this.insert('pending', token, nonce, code, this.now() + 300000);
      return { token, code };
    }).immediate();
  }
  approve(code: string) {
    // Rate counts rejected attempts too; do not roll them back with the transition.
    this.db.transaction(() => this.limit('approve')).immediate();
    this.db.transaction(() => {
      this.prune();
      const result = this.db.prepare("UPDATE api_sessions SET approved=1 WHERE installation=? AND boot=? AND kind='pending' AND code=? AND approved=0 AND expires>?").run(this.installationId, this.boot, code, this.now());
      if (result.changes !== 1) throw new ApplicationError('PAIRING_DENIED');
    }).immediate();
  }
  exchange(token: string, csrf: string) {
    return this.db.transaction(() => {
      this.prune(); const row = this.find('pending', token);
      if (!row || row.approved !== 1 || !validSecret(csrf) || row.csrf_hash !== hash(csrf)) throw new ApplicationError('PAIRING_DENIED');
      this.db.prepare('DELETE FROM api_sessions WHERE id=?').run(row.id);
      const session = secret(); const nextCsrf = secret(); const id = this.insert('session', session, nextCsrf, null, this.now() + 8 * 60 * 60 * 1000);
      return { token: session, csrf: nextCsrf, id };
    }).immediate();
  }
  authenticate(token: string, csrf?: string) {
    const row = this.find('session', token);
    if (!row) throw new ApplicationError('UNAUTHORIZED', 401);
    if (csrf !== undefined && (!validSecret(csrf) || row.csrf_hash !== hash(csrf))) throw new ApplicationError('PAIRING_DENIED');
    return row.id;
  }
  revoke(token: string, csrf: string) { const id = this.authenticate(token, csrf); this.db.prepare('DELETE FROM api_sessions WHERE id=?').run(id); }
  private find(kind: string, token: string): Row | undefined {
    if (!validSecret(token)) return undefined;
    return this.db.prepare('SELECT id,csrf_hash,code,approved,expires FROM api_sessions WHERE installation=? AND boot=? AND kind=? AND token_hash=? AND expires>?').get(this.installationId, this.boot, kind, hash(token), this.now()) as Row | undefined;
  }
  private insert(kind: string, token: string, csrf: string, code: string | null, expires: number) {
    const id = randomUUID();
    this.db.prepare('INSERT INTO api_sessions(id,installation,boot,kind,token_hash,csrf_hash,code,expires,created) VALUES(?,?,?,?,?,?,?,?,?)').run(id, this.installationId, this.boot, kind, hash(token), hash(csrf), code, expires, this.now());
    return id;
  }
}
