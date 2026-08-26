import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashBuildInputs } from '../dev/runtime.mjs';

// Browser assets have no runtime identity and cannot import server modules.
export async function buildStatusAssets(inputRoot, outputRoot) {
  let source = readFileSync(join(inputRoot, 'src/main.ts'), 'utf8');
  const sharedImport = "import { presentInstall, presentWorker } from '../../../packages/contracts/src/presentation.js';";
  if (source.includes(sharedImport)) {
    const shared=readFileSync(join(root, 'packages/contracts/src/presentation.ts'), 'utf8').replace(/^export /gm,'');
    source=`const {presentInstall,presentWorker}=(()=>{\n${shared}\nreturn {presentInstall,presentWorker};\n})();\n`+source.replace(sharedImport,'');
  }
  if (/\b(?:import|export|require|eval|process|Buffer|__dirname|__filename|__AUTOED_BUILD_IDENTITY__)\b|\\u[0-9a-f{]/i.test(source)) throw new Error('BROWSER_IMPORT_DENIED');
  const css = readFileSync(join(inputRoot, 'styles.css'), 'utf8');
  if (/@import|url\s*\(/i.test(css)) throw new Error('BROWSER_IMPORT_DENIED');
  mkdirSync(outputRoot, { recursive: true });
  writeFileSync(join(outputRoot, 'index.html'), readFileSync(join(inputRoot, 'index.html')));
  writeFileSync(join(outputRoot, 'styles.css'), css);
  // TypeScript 7 exposes a different unstable API; use its approved native CLI.
  const entry=join(outputRoot,'.status-entry.ts');writeFileSync(entry,source);
  try {
    execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--ignoreConfig', '--target', 'ES2023', '--module', 'ES2022', '--skipLibCheck', '--noResolve', '--rootDir', outputRoot, '--outDir', outputRoot, entry], { cwd: root, stdio: 'pipe' });
    renameSync(join(outputRoot,'.status-entry.js'),join(outputRoot,'main.js'));
  } finally {rmSync(entry,{force:true});rmSync(join(outputRoot,'.status-entry.js'),{force:true});}
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
async function build() {
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
  if (app === 'status') continue;
  const source = join(root, 'apps', app, 'src/main.ts');
  if (!existsSync(source)) continue;
  const output = join(root, 'dist/apps', app, 'src/main.js');
  const code = readFileSync(output, 'utf8');
  if (!code.includes('__AUTOED_BUILD_IDENTITY__')) throw new Error(`Entry ${app} must consume compile-time __AUTOED_BUILD_IDENTITY__`);
  writeFileSync(output, code.replaceAll('__AUTOED_BUILD_IDENTITY__', JSON.stringify(identity)));
  entries.push(app);
}
await buildStatusAssets(join(root, 'apps/status'), join(root, 'dist/apps/status'));
writeFileSync(join(root, 'build/identity.json'), JSON.stringify({ ...identity, entries }, null, 2));
console.log(`Built ${entries.length} actual application entries; identity ${identity.buildId}; no release/tag created`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await build();
