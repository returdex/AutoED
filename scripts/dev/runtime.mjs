import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, lstatSync, readdirSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve, relative, isAbsolute, delimiter, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const TOOLCHAIN = join(ROOT, '.runtime/dev-toolchain');
export const NODE_VERSION = '24.20.0';
export const VERIFIER_INTEGRITY = 'sha512-7oSPvmlKPojxFoyelT5DWPIAVmqWZh4qU/5pO6bdoShEtRpCw9Sye9IXUQj6EFM3XpgGssqccAr705YtTcLNQw==';
// Reviewed official nodejs/release-keys README at this immutable revision.
const KEY_REVISION = 'b28073028e6d6855cfb53bf7fa0137599c01f967';
export const RELEASE_FINGERPRINTS = Object.freeze([
  '5BE8A3F6C8A5C01D106C0AD820B1A390B168D356', 'DD792F5973C6DE52C432CBDAC77ABFA00DDBF2B7',
  'CC68F5A3106FF448322E48ED27F5E38D5B0A215F', '8FCCA13FEF1D0C2E91008E09770F7A9A5AE15600',
  '890C08DB8579162FEE0DF9DB8BEAB4DFCF555EF4', 'C82FA3AE1CBEDC6BE46B9360C43CEC45C17AB93C',
  '108F52B48DB57BB0CC439B2997B01419BD92F80A', '655F3B5C1FB3FA8D1A0CA6BDE4A7D232B936D2FD',
  'A363A499291CBBC940DD62E41F10027AF002F8B0',
]);
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function hashBuildInputs(root) {
  function files(path) {
    if (!existsSync(join(root, path))) return [];
    return readdirSync(join(root, path), { withFileTypes: true }).flatMap(entry => {
      const relative = `${path}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error('Linked build inputs are not supported');
      return entry.isDirectory() ? files(relative) : /\.(ts|mjs|html|css)$/.test(relative) ? [relative] : [];
    });
  }
  const inputs = ['package.json', 'package-lock.json', 'tsconfig.json', ...['apps', 'packages', 'scripts'].flatMap(files)].sort();
  return sha256(JSON.stringify(inputs.map(path => [path, sha256(readFileSync(join(root, path)))])));
}

export function assertRegularFile(path) {
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Unsafe bootstrap file');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

function assertExtractionTree(path, allowInternalLinks = false, root = path) {
  if (!existsSync(path)) { assertRegularFile(path); return; }
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) {
    if (!allowInternalLinks || !realpathSync(path).startsWith(`${root}${sep}`)) throw new Error('Unsafe bootstrap extraction link');
    return;
  }
  if (stat.isDirectory()) for (const name of readdirSync(path)) assertExtractionTree(join(path, name), allowInternalLinks, root);
  else if (!stat.isFile()) throw new Error('Unsafe bootstrap extraction entry');
}

export function verifyIntegrity(bytes, integrity) {
  const actual = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
  if (actual !== integrity) throw new Error('Bootstrap verifier integrity mismatch');
}

async function download(url, destination, maxBytes = 150 * 1024 * 1024) {
  assertRegularFile(destination);
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`Official download failed: ${response.status}`);
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('Official download exceeds limit');
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  writeFileSync(destination, bytes, { mode: 0o600 });
  return bytes;
}

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, { cwd: ROOT, stdio: 'inherit', ...options });
  if (result.error || result.status !== 0) throw new Error(`Subprocess failed (${result.status ?? 'spawn'}): ${executable}`);
  return result;
}

function safeDirectory(path) {
  // Do not follow a pre-existing link into an unrelated installation.
  let current = ROOT;
  const suffix = relative(ROOT, path);
  if (!suffix || suffix.startsWith(`..${sep}`) || suffix === '..' || isAbsolute(suffix)) throw new Error('Toolchain escaped repository');
  for (const segment of suffix.split(sep)) {
    current = join(current, segment);
    try {
      const stat = lstatSync(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Toolchain directory is not an owned plain directory');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    mkdirSync(current, { recursive: true, mode: 0o700 });
  }
}

export async function loadVerifier() {
  const verifier = join(TOOLCHAIN, 'verifier');
  safeDirectory(verifier);
  const tarball = join(verifier, 'openpgp-6.3.1.tgz');
  assertRegularFile(tarball);
  const bytes = existsSync(tarball) ? readFileSync(tarball) : await download(
    'https://registry.npmjs.org/openpgp/-/openpgp-6.3.1.tgz', tarball, 30 * 1024 * 1024);
  verifyIntegrity(bytes, VERIFIER_INTEGRITY);
  // Unpack the verified published bundle directly: no npm, lifecycle scripts,
  // optional peers, global installs or production dependency. LICENSE stays here.
  assertExtractionTree(join(verifier, 'package'));
  run('tar', ['-xzf', tarball, '-C', verifier]);
  const metadata = JSON.parse(readFileSync(join(verifier, 'package/package.json'), 'utf8'));
  if (metadata.name !== 'openpgp' || metadata.version !== '6.3.1' || !existsSync(join(verifier, 'package/LICENSE'))) {
    throw new Error('Unexpected verifier package');
  }
  return import(pathToFileURL(join(verifier, 'package/dist/node/openpgp.mjs')).href);
}

export async function verifySignedChecksums(openpgp, checksums, signatureBytes, armoredKeys, fingerprints = RELEASE_FINGERPRINTS) {
  const keys = await Promise.all(armoredKeys.map(armoredKey => openpgp.readKey({ armoredKey })));
  for (const key of keys) {
    if (!fingerprints.includes(key.getFingerprint().toUpperCase())) throw new Error('Untrusted release key fingerprint');
  }
  const result = await openpgp.verify({
    message: await openpgp.createMessage({ binary: new Uint8Array(checksums) }),
    signature: await openpgp.readSignature({ binarySignature: new Uint8Array(signatureBytes) }),
    verificationKeys: keys, format: 'binary',
  });
  if (result.signatures.length !== 1) throw new Error('Expected one detached release signature');
  await result.signatures[0].verified;
  return result.signatures[0].keyID.toHex();
}

export function verifyArchive(checksums, filename, bytes) {
  const lines = checksums.toString('utf8').split(/\r?\n/).filter(line => line.endsWith(`  ${filename}`));
  if (lines.length !== 1 || !/^[a-f0-9]{64}  [A-Za-z0-9._-]+$/.test(lines[0])) throw new Error('Missing or ambiguous official checksum');
  if (sha256(bytes) !== lines[0].slice(0, 64)) throw new Error('Node archive hash mismatch');
}

export function target() {
  if (process.platform === 'darwin' && process.arch === 'arm64') return 'darwin-arm64';
  if (process.platform === 'win32' && process.arch === 'x64') return 'win-x64';
  throw new Error('Unapproved development platform (native macOS arm64 / Windows x64 only)');
}

export async function bootstrap() {
  const platform = target();
  const stem = `node-v${NODE_VERSION}-${platform}`;
  const filename = `${stem}.${platform.startsWith('win') ? 'zip' : 'tar.gz'}`;
  const nodeRoot = join(TOOLCHAIN, stem);
  const node = join(nodeRoot, platform.startsWith('win') ? 'node.exe' : 'bin/node');
  console.error(`Scoped bootstrap: .runtime/dev-toolchain; Node ${NODE_VERSION} ${platform}; isolated openpgp 6.3.1; no global changes`);
  safeDirectory(TOOLCHAIN);
  const openpgp = await loadVerifier();
  const checksumPath = join(TOOLCHAIN, 'SHASUMS256.txt');
  const signaturePath = join(TOOLCHAIN, 'SHASUMS256.txt.sig');
  const checksums = await download(`https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt`, checksumPath, 100_000);
  const signature = await download(`https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt.sig`, signaturePath, 100_000);
  const keys = [];
  for (const fingerprint of RELEASE_FINGERPRINTS) {
    const bytes = await download(`https://raw.githubusercontent.com/nodejs/release-keys/${KEY_REVISION}/keys/${fingerprint}.asc`, join(TOOLCHAIN, `${fingerprint}.asc`), 100_000);
    keys.push(bytes.toString('utf8'));
  }
  const signer = await verifySignedChecksums(openpgp, checksums, signature, keys);
  const archivePath = join(TOOLCHAIN, filename);
  assertRegularFile(archivePath);
  const archive = existsSync(archivePath) ? readFileSync(archivePath) : await download(`https://nodejs.org/dist/v${NODE_VERSION}/${filename}`, archivePath);
  verifyArchive(checksums, filename, archive);
  assertExtractionTree(nodeRoot, true);
  // Re-extract authenticated bytes even on reuse; a cached node executable is not trusted.
  run('tar', [platform.startsWith('win') ? '-xf' : '-xzf', archivePath, '-C', TOOLCHAIN]);
  run(node, ['--version']);
  assertRegularFile(join(TOOLCHAIN, 'verification.json'));
  writeFileSync(join(TOOLCHAIN, 'verification.json'), JSON.stringify({ node: NODE_VERSION, platform, signer, archiveHash: sha256(archive), verifiedAt: new Date().toISOString() }, null, 2));
  return { node, nodeRoot };
}

export function checkPackage() {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'));
  if (pkg.engines.node !== NODE_VERSION || lock.lockfileVersion !== 3) throw new Error('Runtime/lock mismatch');
  for (const group of ['dependencies', 'devDependencies']) {
    for (const [name, version] of Object.entries(pkg[group])) {
      if (!/^\d+\.\d+\.\d+$/.test(version) || lock.packages[''][group][name] !== version || lock.packages[`node_modules/${name}`]?.version !== version) throw new Error(`Unpinned dependency: ${name}`);
      if (!existsSync(join(ROOT, 'node_modules', name, 'package.json'))) throw new Error(`Missing installed dependency: ${name}`);
      const installed = JSON.parse(readFileSync(join(ROOT, 'node_modules', name, 'package.json'), 'utf8'));
      if (installed.name !== name || installed.version !== version) throw new Error(`Installed dependency mismatch: ${name}`);
    }
  }
  for (const script of ['typecheck', 'test:unit', 'test:integration', 'test:native', 'test:ui', 'build', 'check:bootstrap']) {
    if (!pkg.scripts[script]) throw new Error(`Missing script: ${script}`);
  }
  return pkg;
}

async function main() {
  const { node, nodeRoot } = await bootstrap();
  const args = process.argv.slice(2);
  const env = { ...process.env, PATH: `${dirname(node)}${delimiter}${process.env.PATH ?? ''}`, npm_config_cache: join(TOOLCHAIN, 'npm-cache'), npm_config_ignore_scripts: 'true', npm_config_audit: 'false', npm_config_fund: 'false', PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' };
  if (args[0] === '--check') {
    checkPackage();
    run(node, ['-e', `if(process.version !== 'v${NODE_VERSION}') process.exit(1)`], { env });
    console.log('Bootstrap check passed: signed Node, exact lock, installed packages and scripts');
  } else if (args[0] === 'npm') {
    run(node, [join(nodeRoot, process.platform === 'win32' ? 'node_modules/npm/bin/npm-cli.js' : 'lib/node_modules/npm/bin/npm-cli.js'), ...args.slice(1)], { env });
  } else if (args[0] === 'node') run(node, args.slice(1), { env });
  else if (args.length) throw new Error('Usage: runtime.mjs [--check | npm ... | node ...]');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
