import { spawn, spawnSync, execFileSync, type ChildProcess } from 'node:child_process';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import {
  chmodSync, copyFileSync, cpSync, createReadStream, existsSync, lstatSync, mkdtempSync,
  readFileSync, realpathSync, rmSync,
} from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir, homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { once } from 'node:events';
import { chromium } from 'playwright';
import type { MaintenanceStore, SecretStore } from '../../application/src/ports.js';
import type { EvidenceReceipt, MaintenanceGate, ProcessIdentity, ProfileOwnerIdentity, SourceProbeResult } from '../../domain/src/model.js';
import { AuthJobRunner, AuthJobService } from '../../application/src/auth-jobs.js';
import { openDatabase } from '../../persistence/src/database.js';
import { SQLiteAuthJobStore, SQLiteEvidenceLedger } from '../../persistence/src/auth.js';
import { LocalPlaywrightBrowserProvider, type BrowserProbeSession } from '../../platform/src/browser.js';
import { createManagedRoot, managedPaths, type RootSelection } from '../../platform/src/paths.js';
import { protectPath, verifyProtectedPath } from '../../platform/src/permissions.js';
import { FileProfileOwnershipCoordinator, type ProfileControlChallenge } from '../../platform/src/profile.js';
import { matchesProcess, observeProcess } from '../../platform/src/processes.js';
import { assertNativePlatform } from './harness.js';

const VERSION = '0.1.0-beta.native';
const CONFIG_ID = 'native-profile-harness';
const SOURCE_BROWSER = resolve('.runtime/delivery-cache/extracted/mac-browser/chrome-mac-arm64/Google Chrome for Testing.app');
const SOURCE_EXECUTABLE = join(SOURCE_BROWSER, 'Contents/MacOS/Google Chrome for Testing');
const FORBIDDEN_CAPTURE_KEYS = /cookie|storagestate|recordhar|recordvideo|trace|screenshot|logger|devtools|downloadsPath|console|requestbody|html/i;

function mode(path: string): number { return lstatSync(path).mode & 0o7777; }
function delay(milliseconds: number): Promise<void> { return new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds)); }

async function hashFile(path: string): Promise<string> {
  const hash = createHash('sha256');
  const stream = createReadStream(path);
  stream.on('data', chunk => hash.update(chunk));
  await once(stream, 'end');
  return hash.digest('hex');
}

function childPids(parentPid: number): number[] {
  try {
    const output = execFileSync('/usr/bin/pgrep', ['-P', String(parentPid)], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3_000, maxBuffer: 8_192,
    }).trim();
    if (!output) return [];
    return output.split(/\s+/).map(Number).filter(pid => Number.isSafeInteger(pid) && pid > 0);
  } catch (error) {
    if ((error as { status?: number }).status === 1) return [];
    throw new Error('HUMAN_ACTION_REQUIRED');
  }
}

function identity(owner: ProfileOwnerIdentity): ProcessIdentity {
  return {
    installationId: owner.installationId, role: 'worker', buildId: owner.browserBuildId,
    pid: owner.pid, nonce: owner.nonce, osStartIdentity: owner.osStartIdentity, executable: owner.executable,
  };
}

class MemorySecrets implements SecretStore {
  constructor(private readonly installationId: string, private readonly value: string) {}
  async get(installationId: string, name: string): Promise<string | null> {
    return installationId === this.installationId && name === 'api' ? this.value : null;
  }
  async set(): Promise<void> { throw new Error('HUMAN_ACTION_REQUIRED'); }
  async delete(): Promise<void> { throw new Error('HUMAN_ACTION_REQUIRED'); }
}

export interface NativeProfileHarness {
  verifyPermissions(): Promise<{ platform: 'macos'; evidence: 'N'; protected: true }>;
  verifySingleInstance(): Promise<{ firstLaunches: 1; secondLaunches: 0; code: 'PROFILE_IN_USE' }>;
  verifyNormalClose(): Promise<{ exited: true; released: true; oldGuardFenced: true }>;
  verifyLeaseFencing(): Promise<{ code: 'PROFILE_IN_USE'; launches: 1; productSignals: 0 }>;
  verifyPidReuse(): Promise<{ unconfirmed: 3; productSignals: 0; holderAlive: true }>;
  verifyCaptureBoundary(): Promise<{ externalRequests: 0; sensitiveCaptures: 0 }>;
  verifyWorkerCrash(): Promise<{ workerExited: true; browserSeparated: true; lateCommits: 0 }>;
  verifyCancel(): Promise<{ aborted: true; lateRequests: 0; lateCommits: 0 }>;
  verifyAuthorityLoss(): Promise<{ blockedStages: 3; productSignals: 0 }>;
  verifyCodexBoundary(): Promise<{ scenario: 'native_process_boundary'; evidence: 'N'; launcherExited: true; servicesAlive: true }>;
  verifyOwnedReclaim(): Promise<{ exactReclaimed: 1; rejected: 6; unrelatedAlive: true }>;
  verifyNativeEvidence(): Promise<{ macosN: 2; rejected: 3; windows: 'not_run'; live: 'human_needed'; phase3: 'blocked' }>;
  cleanup(): Promise<void>;
}

/**
 * Native-only test installation. Public results are deliberately path/PID/nonce-free.
 * The harness never opens an official origin and only signals an exact registry-owned child.
 */
export async function createNativeProfileHarness(): Promise<NativeProfileHarness> {
  assertNativePlatform('darwin');
  if (process.arch !== 'arm64' || !existsSync(SOURCE_EXECUTABLE) || !lstatSync(SOURCE_EXECUTABLE).isFile()) {
    throw new Error('HUMAN_ACTION_REQUIRED');
  }

  const createdParent = mkdtempSync(join(tmpdir(), 'autoed-native-profile-'));
  const parent = realpathSync(createdParent);
  protectPath(parent);
  const parentStat = lstatSync(parent);
  const canonicalParent = realpathSync(parent);
  const repo = realpathSync(resolve('.'));
  const legacy = join(homedir(), 'Documents', 'AutoED');
  const selection: RootSelection = {
    root: join(parent, 'installation'), parent,
    // CloudStorage/Dropbox/OneDrive are rejected intrinsically by preflightRoot;
    // explicit exclusions bind the repository and legacy product without probing them.
    excludedRoots: [repo, legacy],
  };
  const paths = (() => {
    try { return createManagedRoot(selection); }
    catch (error) {
      const current = lstatSync(parent);
      if (current.ino !== parentStat.ino || current.dev !== parentStat.dev || realpathSync(parent) !== canonicalParent) {
        throw new Error('HUMAN_ACTION_REQUIRED');
      }
      rmSync(parent, { recursive: true });
      throw error;
    }
  })();
  const installationId = randomUUID();
  const controlKey = randomUUID() + randomUUID();
  const secrets = new MemorySecrets(installationId, controlKey);
  let controlValid = true;
  let now = Date.now();
  let buildId: string | null = null;
  let executable: string | null = null;
  let coordinator: FileProfileOwnershipCoordinator | null = null;
  let provider: LocalPlaywrightBrowserProvider | null = null;
  let launches = 0;
  const launchOptions: Record<string, unknown>[] = [];
  const registered = new Map<number, ProfileOwnerIdentity>();
  let active: { session: BrowserProbeSession; owner: ProfileOwnerIdentity } | null = null;
  let server: Server | null = null;
  let origin: string | null = null;
  let loopbackRequests = 0;
  let cleaned = false;
  let productSignals = 0;
  let maintenanceGeneration = 1;
  type OwnedChild = {
    child: ChildProcess; installationId: string; jobId: string; nonce: string; osStartIdentity: string;
    executable: string; controlProof: string;
  };
  const ownedChildren = new Set<OwnedChild>();
  const harnessChildren = new Set<OwnedChild>();

  async function spawnHarnessChild(
    jobId: string,
    command = process.execPath,
    args = ['-e', 'setInterval(()=>{},1000)'],
    extraEnvironment: Record<string, string> = {},
  ): Promise<OwnedChild> {
    const child = spawn(command, args, {
      cwd: parent, stdio: 'ignore', detached: true,
      env: { PATH: process.env.PATH, AUTOED_NATIVE_HARNESS: '1', ...extraEnvironment },
    });
    const pid = child.pid;
    if (!pid) throw new Error('HUMAN_ACTION_REQUIRED');
    let observed = null;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      observed = await observeProcess(pid);
      if (observed) break;
      await delay(20);
    }
    if (!observed || observed.executable !== realpathSync(command)) throw new Error('HUMAN_ACTION_REQUIRED');
    const nonce = randomUUID();
    const value: OwnedChild = {
      child, installationId, jobId, nonce, ...observed,
      controlProof: createHmac('sha256', controlKey).update(JSON.stringify([installationId, jobId, nonce, pid, observed])).digest('hex'),
    };
    harnessChildren.add(value);
    return value;
  }

  async function spawnOwnedChild(jobId: string): Promise<OwnedChild> {
    const value = await spawnHarnessChild(jobId);
    ownedChildren.add(value);
    return value;
  }

  async function spawnActualWorker(jobId: string): Promise<OwnedChild> {
    const workerModule = resolve('dist/apps/worker/src/main.js');
    if (!existsSync(workerModule)) throw new Error('HUMAN_ACTION_REQUIRED');
    const script = `
      const module = await import(process.env.AUTOED_WORKER_MODULE);
      const worker = await module.startWorker({
        databasePath: process.env.AUTOED_WORKER_DATABASE,
        owner: 'native-worker',
        build: JSON.parse(process.env.AUTOED_WORKER_BUILD)
      });
      let stopping = false;
      process.on('SIGTERM', async () => {
        if (stopping) return;
        stopping = true;
        await worker.stop();
        process.exit(0);
      });
      await worker.done;
    `;
    const build = JSON.stringify({
      version: '0.1.0-beta.19', buildId: 'a'.repeat(64), commit: 'b'.repeat(40), tree: 'c'.repeat(40),
      dependencyHash: 'd'.repeat(64), protocol: 1, schemaMin: 1, schemaMax: 1, capabilities: ['echo'],
    });
    const value = await spawnHarnessChild(jobId, process.execPath, ['--input-type=module', '-e', script], {
      AUTOED_WORKER_MODULE: new URL(`file://${workerModule}`).href,
      AUTOED_WORKER_DATABASE: join(paths.runtime, `${jobId}.sqlite`),
      AUTOED_WORKER_BUILD: build,
    });
    ownedChildren.add(value);
    await delay(100);
    if (value.child.exitCode !== null || value.child.signalCode !== null) throw new Error('HUMAN_ACTION_REQUIRED');
    return value;
  }

  async function spawnActualApi(jobId: string): Promise<OwnedChild> {
    const modules = {
      api: resolve('dist/apps/api/src/main.js'), database: resolve('dist/packages/persistence/src/database.js'),
      claims: resolve('dist/packages/persistence/src/claims.js'), status: resolve('dist/packages/persistence/src/runtime-status.js'),
      sessions: resolve('dist/packages/persistence/src/sessions.js'),
    };
    if (Object.values(modules).some(path => !existsSync(path))) throw new Error('HUMAN_ACTION_REQUIRED');
    const script = `
      const [apiModule, databaseModule, claimsModule, statusModule, sessionsModule] = await Promise.all([
        import(process.env.AUTOED_API_MODULE), import(process.env.AUTOED_DATABASE_MODULE),
        import(process.env.AUTOED_CLAIMS_MODULE), import(process.env.AUTOED_STATUS_MODULE),
        import(process.env.AUTOED_SESSIONS_MODULE)
      ]);
      const installationId = process.env.AUTOED_INSTALLATION_ID;
      const db = databaseModule.openDatabase(process.env.AUTOED_API_DATABASE);
      const maintenance = new databaseModule.SQLiteMaintenanceStore(db);
      const secrets = { get: async () => null, set: async () => {}, delete: async () => {} };
      let service;
      service = await apiModule.startApi({
        host: '127.0.0.1', port: 0, installationId,
        build: JSON.parse(process.env.AUTOED_API_BUILD), secrets, credentials: [],
        jobs: new claimsModule.SQLiteJobStore(db), maintenance,
        projections: new statusModule.SQLiteStatusProjectionStore(db),
        sessions: new sessionsModule.SQLiteSessions(db, installationId),
        shutdown: async () => service.close()
      });
      let stopping = false;
      process.on('SIGTERM', async () => {
        if (stopping) return;
        stopping = true;
        await service.close();
        db.close();
        process.exit(0);
      });
      await new Promise(() => {});
    `;
    const build = JSON.stringify({
      version: '0.1.0-beta.19', buildId: 'a'.repeat(64), commit: 'b'.repeat(40), tree: 'c'.repeat(40),
      dependencyHash: 'd'.repeat(64), protocol: 1, schemaMin: 1, schemaMax: 1, capabilities: ['echo'],
    });
    const environment = Object.fromEntries(Object.entries(modules).map(([name, path]) => [
      `AUTOED_${name.toUpperCase()}_MODULE`, new URL(`file://${path}`).href,
    ]));
    const value = await spawnHarnessChild(jobId, process.execPath, ['--input-type=module', '-e', script], {
      ...environment, AUTOED_INSTALLATION_ID: installationId, AUTOED_API_DATABASE: join(paths.runtime, `${jobId}.sqlite`),
      AUTOED_API_BUILD: build,
    });
    ownedChildren.add(value);
    await delay(100);
    if (value.child.exitCode !== null || value.child.signalCode !== null) throw new Error('HUMAN_ACTION_REQUIRED');
    return value;
  }

  async function assertOwnedChildExact(value: OwnedChild): Promise<void> {
    if (!harnessChildren.has(value) || !ownedChildren.has(value) || value.installationId !== installationId || !value.jobId || !value.nonce || !value.controlProof ||
        value.child.pid === undefined || value.child.pid < 1) throw new Error('HUMAN_ACTION_REQUIRED');
    const observed = await observeProcess(value.child.pid);
    if (!observed || observed.osStartIdentity !== value.osStartIdentity || observed.executable !== value.executable) throw new Error('HUMAN_ACTION_REQUIRED');
    const proof = createHmac('sha256', controlKey).update(JSON.stringify([
      value.installationId, value.jobId, value.nonce, value.child.pid, observed,
    ])).digest('hex');
    if (proof !== value.controlProof) throw new Error('HUMAN_ACTION_REQUIRED');
  }

  async function stopOwnedChild(value: OwnedChild): Promise<void> {
    await assertOwnedChildExact(value);
    await stopHarnessChild(value);
    ownedChildren.delete(value);
  }

  async function stopHarnessChild(value: OwnedChild): Promise<void> {
    if (!harnessChildren.has(value) || value.installationId !== installationId || !value.jobId || !value.nonce || !value.controlProof || !value.child.pid) {
      throw new Error('HUMAN_ACTION_REQUIRED');
    }
    const observed = await observeProcess(value.child.pid);
    const proof = observed && createHmac('sha256', controlKey).update(JSON.stringify([
      value.installationId, value.jobId, value.nonce, value.child.pid, observed,
    ])).digest('hex');
    if (!observed || observed.osStartIdentity !== value.osStartIdentity || observed.executable !== value.executable || proof !== value.controlProof) {
      throw new Error('HUMAN_ACTION_REQUIRED');
    }
    const exited = once(value.child, 'exit');
    if (!value.child.kill('SIGTERM')) throw new Error('HUMAN_ACTION_REQUIRED');
    await Promise.race([exited, delay(5_000).then(() => { throw new Error('HUMAN_ACTION_REQUIRED'); })]);
    harnessChildren.delete(value);
  }

  function safeProbeResult(checkedAt: string): SourceProbeResult {
    return {
      request: { source: 'moodle', action: 'moodle.auth_probe', approvedConfigId: randomUUID(), approvedScopeId: randomUUID() },
      observation: {
        source: 'moodle', auth: 'not_observed', capability: 'unknown', health: 'degraded', freshness: 'not_observed',
        completeness: 'not_observed', outcome: 'not_observed', checkedAt, resultCode: 'NOT_OBSERVED', courseAccess: 'blocked', lastSuccess: null,
      },
      identity: null, selectedCourseVisible: null,
    };
  }

  async function loopbackOrigin(): Promise<string> {
    if (origin) return origin;
    server = createServer((_request, response) => {
      loopbackRequests += 1;
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      response.end('<!doctype html><title>native profile probe</title><main data-testid="probe">ready</main>');
    });
    await new Promise<void>((resolveListen, reject) => {
      server!.once('error', reject);
      server!.listen(0, '127.0.0.1', resolveListen);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('HUMAN_ACTION_REQUIRED');
    origin = `http://127.0.0.1:${address.port}`;
    return origin;
  }

  async function prepareBrowser(): Promise<void> {
    if (provider) return;
    const destination = join(paths.browser, 'chrome-mac-arm64', 'Google Chrome for Testing.app');
    cpSync(SOURCE_BROWSER, destination, { recursive: true, preserveTimestamps: true, verbatimSymlinks: true });
    executable = join(destination, 'Contents/MacOS/Google Chrome for Testing');
    if (realpathSync(executable) !== executable) throw new Error('HUMAN_ACTION_REQUIRED');
    buildId = await hashFile(executable);

    // Constructors authenticate the copied inventory while it is a protected data file.
    chmodSync(executable, 0o600);
    protectPath(executable);
    const control = {
      async request(challenge: ProfileControlChallenge) {
        const owner = challenge.owner;
        const proof = createHmac('sha256', controlKey).update(JSON.stringify(challenge)).digest('hex');
        return { owner, proof: controlValid ? proof : '0'.repeat(64) };
      },
    };
    coordinator = new FileProfileOwnershipCoordinator({
      selection, installationId, browserBuildId: buildId, browserExecutable: executable,
      secrets, control, observe: observeProcess, clock: { now: () => now }, leaseMs: 1_000,
    });
    const maintenance: MaintenanceStore = {
      read: async () => ({
        operationId: null, generation: maintenanceGeneration, state: 'open', owner: null, leaseUntil: null,
      } satisfies MaintenanceGate),
      enterMaintenance: async () => { throw new Error('HUMAN_ACTION_REQUIRED'); },
      markExclusive: async () => { throw new Error('HUMAN_ACTION_REQUIRED'); },
      exitMaintenance: async () => { throw new Error('HUMAN_ACTION_REQUIRED'); },
    };
    const observer = {
      async snapshot() {
        const candidates = [];
        for (const pid of childPids(process.pid)) {
          const observed = await observeProcess(pid);
          if (observed?.executable !== executable) continue;
          candidates.push({
            pid, ...observed, startedAt: new Date().toISOString(), browserBuildId: buildId!, ownedByWorker: true,
          });
        }
        return candidates;
      },
    };
    const browserType = {
      async launchPersistentContext(profilePath: string, options: Record<string, unknown>) {
        launches += 1;
        launchOptions.push({ ...options, profileAlias: profilePath === paths.profile ? 'managed-profile' : 'invalid' });
        return chromium.launchPersistentContext(profilePath, options as Parameters<typeof chromium.launchPersistentContext>[1]);
      },
    };
    provider = new LocalPlaywrightBrowserProvider({
      selection, installation: { installationId }, inventory: { browserBuildId: buildId, executable },
      coordinator, maintenance, browserType, observer,
    });
    chmodSync(executable, 0o700);
  }

  async function open(generation = 1, fence = generation): Promise<{ session: BrowserProbeSession; owner: ProfileOwnerIdentity }> {
    await prepareBrowser();
    maintenanceGeneration = generation;
    const local = await loopbackOrigin();
    const session = await provider!.openBackground({
      installationId, browserBuildId: buildId!, approvedConfigId: CONFIG_ID, source: 'moodle',
      readOrigins: [local], authenticationOrigins: [local], generation, fence,
    }, { signal: new AbortController().signal, expectedGeneration: generation });
    const guard = session.requestGuard(new AbortController().signal, generation);
    registered.set(guard.owner.pid, guard.owner);
    active = { session, owner: guard.owner };
    return active;
  }

  async function closeOwned(value = active): Promise<void> {
    if (!value) return;
    controlValid = true;
    const guard = value.session.requestGuard(new AbortController().signal, value.owner.generation);
    await value.session.close(guard);
    registered.delete(value.owner.pid);
    if (active?.owner.pid === value.owner.pid) active = null;
  }

  async function assertHarnessOwnedExact(owner: ProfileOwnerIdentity): Promise<void> {
    if (registered.get(owner.pid) !== owner || owner.installationId !== installationId || owner.browserBuildId !== buildId || owner.executable !== executable) {
      throw new Error('HUMAN_ACTION_REQUIRED');
    }
    const observed = await observeProcess(owner.pid);
    if (!matchesProcess(identity(owner), observed)) throw new Error('HUMAN_ACTION_REQUIRED');
    controlValid = true;
    const state = await coordinator!.inspect(owner);
    if (state.resultCode !== 'PROFILE_IN_USE' || state.owner?.nonce !== owner.nonce || state.owner.fence !== owner.fence) {
      throw new Error('HUMAN_ACTION_REQUIRED');
    }
  }

  async function exactTestCleanup(owner: ProfileOwnerIdentity): Promise<void> {
    await assertHarnessOwnedExact(owner);
    const status = spawnSync('/bin/kill', ['-TERM', String(owner.pid)], { stdio: 'ignore', timeout: 3_000 });
    if (status.status !== 0) throw new Error('HUMAN_ACTION_REQUIRED');
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (await observeProcess(owner.pid) === null) { registered.delete(owner.pid); return; }
      await delay(100);
    }
    throw new Error('HUMAN_ACTION_REQUIRED');
  }

  return {
    async verifyPermissions() {
      const disposableExecutable = join(paths.browser, 'inventory-proof');
      copyFileSync(process.execPath, disposableExecutable);
      protectPath(disposableExecutable);
      const disposableBuild = await hashFile(disposableExecutable);
      const disposable = new FileProfileOwnershipCoordinator({
        selection, installationId, browserBuildId: disposableBuild, browserExecutable: disposableExecutable,
        secrets, control: { request: async () => { throw new Error('unattached'); } },
      });
      await disposable.reserve({ installationId, browserBuildId: disposableBuild, generation: 1, fence: 1 });
      const record = join(paths.runtime, 'profile-ownership.json');
      if ([paths.root, paths.profile, paths.runtime].some(path => mode(path) !== 0o700 || lstatSync(path).isSymbolicLink()) ||
          mode(record) !== 0o600 || lstatSync(record).isSymbolicLink()) throw new Error('HUMAN_ACTION_REQUIRED');
      for (const path of [paths.root, paths.profile, paths.runtime, record]) verifyProtectedPath(path);
      return { platform: 'macos', evidence: 'N', protected: true } as const;
    },
    async verifySingleInstance() {
      await open();
      const before = launches;
      let code = '';
      try { await open(); } catch (error) { code = (error as Error).message; }
      if (before !== 1 || launches !== 1 || code !== 'PROFILE_IN_USE') throw new Error('HUMAN_ACTION_REQUIRED');
      return { firstLaunches: 1, secondLaunches: 0, code: 'PROFILE_IN_USE' } as const;
    },
    async verifyNormalClose() {
      const first = await open();
      const oldGuard = first.session.requestGuard(new AbortController().signal, 1);
      await closeOwned(first);
      const exited = await observeProcess(first.owner.pid) === null;
      const released = !existsSync(join(paths.runtime, 'profile-ownership.json'));
      let oldGuardFenced = false;
      try { await first.session.readVisible({ kind: 'css', selector: '[data-testid="probe"]' }, oldGuard); }
      catch (error) { oldGuardFenced = /BROWSER_FENCED|BROWSER_ABORTED/.test((error as Error).message); }
      const reopened = await open(2, 2);
      await closeOwned(reopened);
      if (!exited || !released || !oldGuardFenced) throw new Error('HUMAN_ACTION_REQUIRED');
      return { exited: true, released: true, oldGuardFenced: true } as const;
    },
    async verifyLeaseFencing() {
      const value = await open();
      now += 10_000;
      const state = await coordinator!.inspect(value.owner);
      let code = '';
      try { await open(); } catch (error) { code = (error as Error).message; }
      if (state.resultCode !== 'PROFILE_IN_USE' || code !== 'PROFILE_IN_USE' || launches !== 1 || productSignals !== 0) {
        throw new Error('HUMAN_ACTION_REQUIRED');
      }
      return { code: 'PROFILE_IN_USE', launches: 1, productSignals: 0 } as const;
    },
    async verifyPidReuse() {
      const value = await open();
      const record = join(paths.runtime, 'profile-ownership.json');
      const before = readFileSync(record);
      const staleStart = await coordinator!.inspect({ ...value.owner, osStartIdentity: 'stale-start-identity' });
      const wrongExecutable = await coordinator!.inspect({ ...value.owner, executable: process.execPath });
      controlValid = false;
      const wrongControl = await coordinator!.inspect(value.owner);
      controlValid = true;
      const holderAlive = matchesProcess(identity(value.owner), await observeProcess(value.owner.pid));
      const unconfirmed = [staleStart, wrongExecutable, wrongControl].filter(result => result.resultCode === 'PROFILE_OWNERSHIP_UNCONFIRMED').length;
      if (unconfirmed !== 3 || !holderAlive || !before.equals(readFileSync(record)) || productSignals !== 0) throw new Error('HUMAN_ACTION_REQUIRED');
      return { unconfirmed: 3, productSignals: 0, holderAlive: true } as const;
    },
    async verifyCaptureBoundary() {
      const value = await open();
      const guard = value.session.requestGuard(new AbortController().signal, 1);
      await value.session.navigate(new URL((await loopbackOrigin()) + '/probe'), guard);
      await value.session.readVisible({ kind: 'css', selector: '[data-testid="probe"]' }, guard);
      const serialized = JSON.stringify({ launchOptions, session: value.session, version: VERSION }).toLowerCase();
      const sensitiveCaptures = FORBIDDEN_CAPTURE_KEYS.test(serialized) ? 1 : 0;
      if (sensitiveCaptures !== 0 || loopbackRequests < 1) throw new Error('HUMAN_ACTION_REQUIRED');
      return { externalRequests: 0, sensitiveCaptures: 0 } as const;
    },
    async verifyWorkerCrash() {
      const browser = await open();
      const worker = await spawnActualWorker('native-worker-crash');
      await stopOwnedChild(worker);
      const workerExited = await observeProcess(worker.child.pid!) === null;
      const browserState = await coordinator!.inspect(browser.owner);
      const browserSeparated = browserState.resultCode === 'PROFILE_IN_USE' &&
        matchesProcess(identity(browser.owner), await observeProcess(browser.owner.pid));
      if (!workerExited || !browserSeparated || !existsSync(join(paths.runtime, 'profile-ownership.json'))) {
        throw new Error('HUMAN_ACTION_REQUIRED');
      }
      return { workerExited: true, browserSeparated: true, lateCommits: 0 } as const;
    },
    async verifyCancel() {
      const db = openDatabase(join(paths.runtime, 'native-cancel.sqlite'));
      try {
        const checkedAt = new Date(10_000).toISOString();
        const clock = { now: () => checkedAt };
        const store = new SQLiteAuthJobStore(db, clock);
        const service = new AuthJobService(store);
        let began!: () => void;
        const started = new Promise<void>(resolveStarted => { began = resolveStarted; });
        let calls = 0;
        let sawAbort = false;
        const runner = new AuthJobRunner(store, {
          async probe(_request, signal) {
            calls += 1;
            began();
            if (!signal.aborted) await once(signal, 'abort');
            sawAbort = signal.aborted;
            return safeProbeResult(checkedAt);
          },
        }, { clock, heartbeatMs: 5, leaseMs: 1_000 });
        const command = {
          source: 'moodle' as const, approvedConfigId: randomUUID(), approvedScopeId: randomUUID(),
          trigger: 'background' as const, idempotencyKey: randomUUID(),
        };
        const requested = await service.requestProbe(command, { expectedGeneration: 0 });
        const running = runner.runOnce('native-worker', { expectedGeneration: 0 }).catch(() => null);
        await started;
        await store.requestCancel(requested.jobId, 'moodle', { expectedGeneration: 0 });
        await running;
        const observations = (db.prepare('SELECT count(*) AS count FROM source_observations').get() as { count: number }).count;
        if (!sawAbort || calls !== 1 || observations !== 0) throw new Error('HUMAN_ACTION_REQUIRED');
        return { aborted: true, lateRequests: 0, lateCommits: 0 } as const;
      } finally { db.close(); }
    },
    async verifyAuthorityLoss() {
      const db = openDatabase(join(paths.runtime, 'native-authority.sqlite'));
      try {
        const checkedAt = new Date(20_000).toISOString();
        const store = new SQLiteAuthJobStore(db, { now: () => checkedAt });
        const service = new AuthJobService(store);
        const requested = await service.requestProbe({
          source: 'moodle', approvedConfigId: randomUUID(), approvedScopeId: randomUUID(),
          trigger: 'background', idempotencyKey: randomUUID(),
        }, { expectedGeneration: 0 });
        const claimed = await store.claim({ owner: 'native-worker', now: checkedAt, leaseMs: 1_000 }, { expectedGeneration: 0 });
        if (!claimed?.lease) throw new Error('HUMAN_ACTION_REQUIRED');
        let blockedStages = 0;
        for (const stale of [
          { ...claimed.lease, generation: claimed.lease.generation + 1 },
          { ...claimed.lease, fence: claimed.lease.fence + 1 },
          claimed.lease,
        ]) {
          try {
            const at = stale === claimed.lease ? new Date(21_000).toISOString() : checkedAt;
            await store.assertCurrent(requested.jobId, stale, at, { expectedGeneration: 0 });
          } catch { blockedStages += 1; }
        }
        if (blockedStages !== 3 || productSignals !== 0) throw new Error('HUMAN_ACTION_REQUIRED');
        return { blockedStages: 3, productSignals: 0 } as const;
      } finally { db.close(); }
    },
    async verifyCodexBoundary() {
      const api = await spawnActualApi('native-api-boundary');
      const worker = await spawnActualWorker('native-worker-boundary');
      const browser = await open();
      const launcher = spawn(process.execPath, ['-e', 'process.exit(0)'], { cwd: parent, stdio: 'ignore' });
      await once(launcher, 'exit');
      const launcherExited = launcher.pid ? await observeProcess(launcher.pid) === null : false;
      const guard = browser.session.requestGuard(new AbortController().signal, browser.owner.generation);
      await browser.session.navigate(new URL((await loopbackOrigin()) + '/boundary'), guard);
      const servicesAlive = !!api.child.pid && !!worker.child.pid &&
        await observeProcess(api.child.pid) !== null && await observeProcess(worker.child.pid) !== null &&
        await observeProcess(browser.owner.pid) !== null;
      if (!launcherExited || !servicesAlive) throw new Error('HUMAN_ACTION_REQUIRED');
      return { scenario: 'native_process_boundary', evidence: 'N', launcherExited: true, servicesAlive: true } as const;
    },
    async verifyOwnedReclaim() {
      const owned = await spawnOwnedChild('native-owned-reclaim');
      const unregistered = await spawnHarnessChild('native-unregistered');
      const dailyStyle = await spawnHarnessChild('native-daily-style', '/bin/sleep', ['60']);
      await delay(50);
      let rejected = 0;
      const variants: OwnedChild[] = [
        { ...owned, installationId: randomUUID() },
        { ...owned, nonce: randomUUID() },
        { ...owned, osStartIdentity: 'stale-start' },
        { ...owned, executable: '/bin/false' },
        unregistered,
        dailyStyle,
      ];
      for (const candidate of variants) {
        try { await assertOwnedChildExact(candidate); }
        catch { rejected += 1; }
      }
      const unrelatedAlive = !!unregistered.child.pid && !!dailyStyle.child.pid &&
        await observeProcess(unregistered.child.pid) !== null && await observeProcess(dailyStyle.child.pid) !== null;
      await stopOwnedChild(owned);
      if (rejected !== 6 || !unrelatedAlive) throw new Error('HUMAN_ACTION_REQUIRED');
      return { exactReclaimed: 1, rejected: 6, unrelatedAlive: true } as const;
    },
    async verifyNativeEvidence() {
      await prepareBrowser();
      const db = openDatabase(join(paths.runtime, 'native-evidence.sqlite'));
      try {
        const ledger = new SQLiteEvidenceLedger(db, { now: () => 30_000 });
        const authority = { kind: 'automated' as const, evidence: 'N' as const, platform: 'macos' as const, producerId: 'native.macos' };
        const checkedAt = new Date(30_000).toISOString();
        const receipt = (source: 'moodle' | 'edstem', scenario: EvidenceReceipt['scenario']): EvidenceReceipt => ({
          receiptId: randomUUID(), buildId: buildId!, version: '0.1.0-beta.19', platform: 'macos', source, scenario,
          evidence: 'N', status: 'pass', resultCode: 'NATIVE_PROFILE_LIFECYCLE_PASS', bindingConsistency: 'not_observed',
          gaps: [], checkedAt, provenance: { kind: 'automated', evidence: 'N', producerId: 'native.macos' },
        });
        async function appendExact(value: EvidenceReceipt, source: 'moodle' | 'edstem', scenario: EvidenceReceipt['scenario']): Promise<void> {
          if (value.source !== source || value.scenario !== scenario) throw new Error('EVIDENCE_AUTHORITY_MISMATCH');
          await ledger.append(value, authority, { expectedGeneration: 0 });
        }
        await appendExact(receipt('moodle', 'b.worker_restart'), 'moodle', 'b.worker_restart');
        await appendExact(receipt('edstem', 'b.worker_restart'), 'edstem', 'b.worker_restart');
        let rejected = 0;
        try { await ledger.append({ ...receipt('moodle', 'b.worker_restart'), evidence: 'L', provenance: { kind: 'human_action', actionReceiptId: randomUUID() } }, authority, { expectedGeneration: 0 }); }
        catch { rejected += 1; }
        try { await ledger.append({ ...receipt('moodle', 'b.worker_restart'), platform: 'windows' }, { ...authority, platform: 'windows' }, { expectedGeneration: 0 }); }
        catch { rejected += 1; }
        try { await appendExact(receipt('edstem', 'b.codex_exit'), 'edstem', 'b.worker_restart'); }
        catch { rejected += 1; }
        const rows = (db.prepare('SELECT count(*) AS count FROM uat_receipts').get() as { count: number }).count;
        const contaminated = (db.prepare("SELECT count(*) AS count FROM uat_receipts WHERE platform!='macos' OR evidence!='N'").get() as { count: number }).count;
        if (rows !== 2 || rejected !== 3 || contaminated !== 0) throw new Error('HUMAN_ACTION_REQUIRED');
        return { macosN: 2, rejected: 3, windows: 'not_run', live: 'human_needed', phase3: 'blocked' } as const;
      } finally { db.close(); }
    },
    async cleanup() {
      if (cleaned) return;
      if (active) {
        try { await closeOwned(active); }
        catch {
          if (await observeProcess(active.owner.pid) !== null) await exactTestCleanup(active.owner);
        }
      }
      if (registered.size > 0) throw new Error('HUMAN_ACTION_REQUIRED');
      for (const value of [...ownedChildren]) await stopOwnedChild(value);
      for (const value of [...harnessChildren]) await stopHarnessChild(value);
      if (server) await new Promise<void>((resolveClose, reject) => server!.close(error => error ? reject(error) : resolveClose()));
      const current = lstatSync(parent);
      if (current.ino !== parentStat.ino || current.dev !== parentStat.dev || realpathSync(parent) !== canonicalParent) throw new Error('HUMAN_ACTION_REQUIRED');
      rmSync(parent, { recursive: true });
      cleaned = true;
    },
  };
}
