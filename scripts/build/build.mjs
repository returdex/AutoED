import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashBuildInputs } from '../dev/runtime.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
if (process.version !== 'v24.20.0') throw new Error('Build requires the verified managed Node 24.20.0');
const variant = process.env.AUTOED_BUILD_VARIANT ?? 'A';
if (!['A', 'B'].includes(variant)) throw new Error('Build variant must be A or B');
const hash = value => createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const commit = git('rev-parse', 'HEAD');
const tree = git('rev-parse', 'HEAD^{tree}');
const dependencyHash = hash(readFileSync(join(root, 'package-lock.json')));
const sourceHash = hashBuildInputs(root);
const identity = { version, buildId: hash(JSON.stringify({ commit, tree, dependencyHash, sourceHash, variant })), commit, tree, dependencyHash, protocol: 1, schemaMin: 1, schemaMax: 1, capabilities: variant === 'A' ? ['echo'] : ['echo', 'digest'] };
// Only this build's output roots may be cleaned; never node_modules or .runtime.
for (const dir of ['dist', 'build']) rmSync(join(root, dir), { recursive: true, force: true });
mkdirSync(join(root, 'build'), { recursive: true });
execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--outDir', 'dist'], { cwd: root, stdio: 'inherit' });
const entries = [];
for (const app of existsSync(join(root, 'apps')) ? readdirSync(join(root, 'apps')) : []) {
  const source = join(root, 'apps', app, 'src/main.ts');
  if (!existsSync(source)) continue;
  const output = join(root, 'dist/apps', app, 'src/main.js');
  const code = readFileSync(output, 'utf8');
  if (!code.includes('__AUTOED_BUILD_IDENTITY__')) throw new Error(`Entry ${app} must consume compile-time __AUTOED_BUILD_IDENTITY__`);
  writeFileSync(output, code.replaceAll('__AUTOED_BUILD_IDENTITY__', JSON.stringify(identity)));
  entries.push(app);
}
writeFileSync(join(root, 'build/identity.json'), JSON.stringify({ ...identity, entries }, null, 2));
console.log(`Built ${entries.length} actual application entries; identity ${identity.buildId}; no release/tag created`);
