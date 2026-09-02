import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { observeProcess } from '../../platform/src/processes.js';

/**
 * Test-runner ownership evidence. This module is intentionally limited to
 * disposable `autoed-synthetic-*` roots and never enumerates the real install.
 */
export interface SyntheticProcess {
  pid: number;
  root: string;
  role: 'api' | 'worker';
  osStartIdentity: string;
  executable: string;
  entrypoint: string;
  runId: string;
  ownerPid: number;
  ownerStartIdentity: string;
}

interface ProcessRow { pid: number; start: string; args: string }

const syntheticRootPrefix = `${realpathSync(tmpdir())}${sep}autoed-synthetic-`;
const uuid = /^[0-9a-f-]{36}$/;
const hash = /^[a-f0-9]{64}$/;

function fail(code: string): never { throw new Error(code); }

function rows(): ProcessRow[] {
  try {
    const output = execFileSync('/bin/ps', ['-axo', 'pid=', '-o', 'lstart=', '-o', 'args='], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000, maxBuffer: 512 * 1024,
    });
    return output.split('\n').flatMap(line => {
      const match = /^\s*(\d+)\s+(.{24})\s+(.+)$/.exec(line);
      return match ? [{ pid: Number(match[1]), start: match[2]!, args: match[3]!.trim() }] : [];
    });
  } catch { return fail('SYNTHETIC_PROCESS_LEDGER_UNAVAILABLE'); }
}

function regular(path: string, maxBytes: number): Buffer {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > maxBytes) fail('SYNTHETIC_PROCESS_OWNERSHIP_UNCONFIRMED');
  return readFileSync(path);
}

function syntheticRoot(path: string): string {
  if (!path.startsWith(syntheticRootPrefix) || !/^autoed-synthetic-[A-Za-z0-9]+$/.test(path.slice(syntheticRootPrefix.length))) fail('SYNTHETIC_PROCESS_OWNERSHIP_UNCONFIRMED');
  const stat = lstatSync(path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(path) !== path) fail('SYNTHETIC_PROCESS_OWNERSHIP_UNCONFIRMED');
  return path;
}

function invocation(args: string[]) {
  if (args.length !== 2 || !args[0] || !args[1]) fail('SYNTHETIC_PROCESS_OWNERSHIP_UNCONFIRMED');
  const service = /^(.*?)\s+--autoed-service\s+(\S+)\s+(\S+)\s+([0-9a-f-]{36})$/.exec(args.join(' '));
  if (!service) fail('SYNTHETIC_PROCESS_OWNERSHIP_UNCONFIRMED');
  const installation = realpathSync(service[2]!);
  const root = syntheticRoot(realpathSync(service[3]!));
  if (installation !== realpathSync(join(root, 'installation'))) fail('SYNTHETIC_PROCESS_OWNERSHIP_UNCONFIRMED');
  const entrypoint = realpathSync(args[1]!);
  const entry = /\/installation\/program\/([a-f0-9]{64})\/dist\/apps\/(api|worker)\/src\/main\.js$/.exec(entrypoint);
  const buildId = entry?.[1];
  const role = entry?.[2] as 'api' | 'worker' | undefined;
  if (!role || !buildId || !uuid.test(service[4]!)) fail('SYNTHETIC_PROCESS_OWNERSHIP_UNCONFIRMED');
  const executable = realpathSync(args[0]!);
  if (executable !== realpathSync(join(root, 'installation/runtime/24.20.0/bin/node')) || entrypoint !== realpathSync(join(root, `installation/program/${buildId}/dist/apps/${role}/src/main.js`))) fail('SYNTHETIC_PROCESS_OWNERSHIP_UNCONFIRMED');
  return { root, role, executable, entrypoint, nonce: service[4]! };
}

function validate(row: ProcessRow): SyntheticProcess | null {
  if (!row.args.includes(' --autoed-service ')) return null;
  const pieces = row.args.split(/\s+/);
  const parsed = invocation(pieces);
  const installation = join(parsed.root, 'installation');
  const metadata = JSON.parse(regular(join(installation, 'installation.json'), 16384).toString('utf8')) as { syntheticTest?: unknown; ownership?: { device?: unknown; inode?: unknown; uid?: unknown } };
  const rootStat = lstatSync(installation);
  if (metadata.syntheticTest !== true || metadata.ownership?.device !== rootStat.dev || metadata.ownership?.inode !== rootStat.ino || metadata.ownership?.uid !== rootStat.uid) fail('SYNTHETIC_PROCESS_OWNERSHIP_UNCONFIRMED');
  const marker = JSON.parse(regular(`${parsed.root}.synthetic-run.json`, 4096).toString('utf8')) as { schema?: unknown; root?: unknown; runId?: unknown; owner?: { pid?: unknown; osStartIdentity?: unknown; executable?: unknown } };
  if (marker.schema !== 1 || marker.root !== parsed.root || typeof marker.runId !== 'string' || !uuid.test(marker.runId) || !Number.isSafeInteger(marker.owner?.pid) || typeof marker.owner?.osStartIdentity !== 'string' || marker.owner?.executable !== realpathSync(process.execPath)) fail('SYNTHETIC_PROCESS_OWNERSHIP_UNCONFIRMED');
  const receipt = JSON.parse(regular(join(installation, `runtime/${parsed.role}.json`), 16384).toString('utf8')) as { pid?: unknown; role?: unknown; nonce?: unknown; osStartIdentity?: unknown; executable?: unknown; entrypoint?: unknown; buildId?: unknown };
  if (receipt.pid !== row.pid || receipt.role !== parsed.role || receipt.nonce !== parsed.nonce || receipt.osStartIdentity !== row.start || receipt.executable !== parsed.executable || receipt.entrypoint !== parsed.entrypoint || typeof receipt.buildId !== 'string' || !hash.test(receipt.buildId)) fail('SYNTHETIC_PROCESS_OWNERSHIP_UNCONFIRMED');
  return { pid: row.pid, root: parsed.root, role: parsed.role, osStartIdentity: row.start, executable: parsed.executable, entrypoint: parsed.entrypoint, runId: marker.runId, ownerPid: marker.owner!.pid as number, ownerStartIdentity: marker.owner!.osStartIdentity as string };
}

/** Read only fully validated synthetic service processes. Unknown-looking entries fail closed. */
export function readSyntheticProcessLedger(): SyntheticProcess[] {
  return rows().flatMap(row => {
    if (!row.args.includes(' --autoed-service ')) return [];
    if (!row.args.includes(syntheticRootPrefix)) return [];
    const pieces = row.args.split(/\s+/);
    const marker = pieces.indexOf('--autoed-service');
    // The user's managed installation also uses this service flag. Its
    // parent/root is outside the disposable synthetic namespace and must be
    // ignored, never inspected or signalled.
    const candidateParent = marker >= 0 ? pieces[marker + 2] : undefined;
    if (!candidateParent) fail('SYNTHETIC_PROCESS_OWNERSHIP_UNCONFIRMED');
    let canonicalParent: string;
    try { canonicalParent = realpathSync(candidateParent); } catch { fail('SYNTHETIC_PROCESS_OWNERSHIP_UNCONFIRMED'); }
    if (!canonicalParent.startsWith(syntheticRootPrefix)) return [];
    return [validate(row)!];
  });
}

async function ownerAlive(item: SyntheticProcess): Promise<'alive' | 'gone' | 'unknown'> {
  try {
    const observed = await observeProcess(item.ownerPid);
    if (!observed) return 'gone';
    return observed.osStartIdentity === item.ownerStartIdentity ? 'alive' : 'gone';
  } catch { return 'unknown'; }
}

async function waitForEmpty(timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (readSyntheticProcessLedger().length === 0) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (readSyntheticProcessLedger().length !== 0) fail('SYNTHETIC_PROCESS_RECLAIM_UNCONFIRMED');
}

/**
 * Establish a clean suite boundary. Orphans from an interrupted run are
 * reclaimed only when the disposable root, service command and runtime receipt
 * all match and the recorded harness owner has exited. A live owner is never
 * signalled; an unknown observation fails closed.
 */
export async function installSyntheticProcessLedger(): Promise<void> {
  const prior = readSyntheticProcessLedger();
  for (const item of prior) {
    const state = await ownerAlive(item);
    if (state === 'unknown') fail('SYNTHETIC_PROCESS_OWNER_UNCONFIRMED');
    if (state === 'alive') fail('SYNTHETIC_PROCESS_LEAK_PREEXISTING');
    try { process.kill(item.pid, 'SIGTERM'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') fail('SYNTHETIC_PROCESS_RECLAIM_UNCONFIRMED'); }
  }
  if (prior.length) await waitForEmpty();
  const baseline = readSyntheticProcessLedger();
  if (baseline.length) fail('SYNTHETIC_PROCESS_LEAK_PREEXISTING');
  process.once('exit', () => {
    try {
      if (readSyntheticProcessLedger().length) {
        process.stderr.write('SYNTHETIC_PROCESS_LEAK_POSTRUN\n');
        process.exitCode = process.exitCode || 1;
      }
    } catch {
      process.stderr.write('SYNTHETIC_PROCESS_LEDGER_UNAVAILABLE\n');
      process.exitCode = process.exitCode || 1;
    }
  });
}
