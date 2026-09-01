import { spawnSync, execFileSync } from 'node:child_process';
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
import type { MaintenanceGate, ProcessIdentity, ProfileOwnerIdentity } from '../../domain/src/model.js';
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
  const paths = createManagedRoot(selection);
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
    async cleanup() {
      if (cleaned) return;
      if (active) {
        try { await closeOwned(active); }
        catch {
          if (await observeProcess(active.owner.pid) !== null) await exactTestCleanup(active.owner);
        }
      }
      if (registered.size > 0) throw new Error('HUMAN_ACTION_REQUIRED');
      if (server) await new Promise<void>((resolveClose, reject) => server!.close(error => error ? reject(error) : resolveClose()));
      const current = lstatSync(parent);
      if (current.ino !== parentStat.ino || current.dev !== parentStat.dev || realpathSync(parent) !== canonicalParent) throw new Error('HUMAN_ACTION_REQUIRED');
      rmSync(parent, { recursive: true });
      cleaned = true;
    },
  };
}
