import {expect,it} from 'vitest';
import {existsSync,mkdtempSync,mkdirSync,writeFileSync,readFileSync,symlinkSync,realpathSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {assembleTarget,assembleManagedUpdaterRehearsalPair,auditDelivery,auditRehearsalOuterArchive,auditRehearsalArtifactArchive} from '../../scripts/build/assemble.mjs';
import {inspectNativeBinary,sha256} from '../../scripts/build/native-artifacts.mjs';
import {canonicalSha256,renderPhase2RehearsalInstallPromptCore} from '../../scripts/release/phase2-gate.mjs';
import {hashBuildInputs} from '../../scripts/dev/runtime.mjs';
import {tarEntries} from '../../packages/installer/src/archive-core.js';
import {createHarness} from '../../packages/test-support/src/harness.js';
import matrix from '../../scripts/build/platform-matrix.json' with {type:'json'};

function fixture(target:'darwin-arm64'|'win32-x64'){
  const root=realpathSync(mkdtempSync(join(tmpdir(),'autoed-assembly-'))),source=join(root,'source'),output=join(root,'output');mkdirSync(source);for(const name of ['program','node','browser','native'])mkdirSync(join(source,name));
  writeFileSync(join(source,'program','main.js'),"import 'zod';\n");writeFileSync(join(source,'program','package.json'),JSON.stringify({type:'module',dependencies:{zod:'4.4.3'}}));
  const machine=target==='darwin-arm64'?Buffer.from([0xcf,0xfa,0xed,0xfe,0x0c,0,0,1]):(()=>{const b=Buffer.alloc(80);b.write('MZ');b.writeUInt32LE(64,0x3c);b.write('PE\0\0',64);b.writeUInt16LE(0x8664,68);return b;})();
  const nodePath=join(source,'node',target==='darwin-arm64'?'node':'node.exe'),browserPath=join(source,'browser',target==='darwin-arm64'?'chrome':'chrome.exe');writeFileSync(nodePath,machine);chmodSync(nodePath,0o700);writeFileSync(join(source,'native',target==='darwin-arm64'?'sqlite.darwin-arm64.node':'sqlite.win32-x64.node'),machine);writeFileSync(browserPath,machine);chmodSync(browserPath,0o700);
  if(target==='darwin-arm64'){mkdirSync(join(source,'browser','Versions'));mkdirSync(join(source,'browser','Versions','151.0.7922.34'));symlinkSync('151.0.7922.34',join(source,'browser','Versions','Current'));}
  return {root,source,output,target,components:[['program','pure-js'],['node','node'],['browser','browser'],['native','better-sqlite3']] as const};
}
it('accepts omitted implicit tar directories but rejects unexpected and long outer members',()=>{
  const data=Buffer.from('x'),file={path:'nested/member',type:'file',bytes:data.length,sha256:sha256(data)},entry={path:file.path,kind:'file' as const,size:data.length,read:()=>data};
  expect(auditRehearsalOuterArchive([entry],[file])).toBe('PASS');
  expect(auditRehearsalOuterArchive([entry,{path:'unexpected',kind:'directory' as const,size:0,read:()=>Buffer.alloc(0)}],[file])).toBe('UNEXPECTED_DIRECTORY');
  const long={...file,path:'a'.repeat(101)};expect(auditRehearsalOuterArchive([{...entry,path:long.path}],[long])).toBe('LONG_PATH');
});
it('audits every rehearsal sibling archive member before capability assembly',()=>{
  const bytes=Buffer.from('x'),file={path:'member',type:'file',bytes:bytes.length,sha256:sha256(bytes)},artifact={role:'program',format:'tar.gz',bytes:bytes.length,sha256:sha256(bytes),files:[file]},entry={path:'member',kind:'file' as const,size:bytes.length,read:()=>bytes},tools={tarEntries:()=>[entry],zipEntries:()=>[entry],validateLinkGraph:()=>undefined,safeArtifactPath:(path:string)=>/^[a-z]+$/.test(path)&&path.length<=512};
  expect(auditRehearsalArtifactArchive(artifact,bytes,tools)).toMatchObject({role:'program',memberCount:1});
  for(const entries of [[],[entry,{...entry,path:'extra'}],[entry,entry],[{...entry,path:'a'.repeat(513)}],[{...entry,kind:'symlink' as const,size:1,read:()=>Buffer.from('x')}]] as const)expect(()=>auditRehearsalArtifactArchive(artifact,bytes,{...tools,tarEntries:()=>entries})).toThrow('REHEARSAL_ARTIFACT_ARCHIVE_INVALID');
  expect(()=>auditRehearsalArtifactArchive({...artifact,sha256:'0'.repeat(64)},bytes,tools)).toThrow('REHEARSAL_ARTIFACT_ARCHIVE_INVALID');
});

it.each(['darwin-arm64','win32-x64'] as const)('writes an auditable, target-specific dependency closure for %s',async target=>{
  const f=fixture(target),result=await assembleTarget({target,outputRoot:f.output,sourceRoot:f.source,components:f.components,diagnosticsRequired:false});expect(result.report.target).toBe(target);expect(result.report.nativeEvidence).toBe(target==='darwin-arm64'?'static_only':'not_run');expect(result.report.nativeEvidence).not.toBe('passed');expect(result.report.platform.actualNative.status).toBe('not_run');expect(result.report.files.length).toBeGreaterThan(4);expect(result.report.files.find(file=>file.path===`node/${target==='darwin-arm64'?'node':'node.exe'}`)?.executable).toBe(true);expect(result.report.components.every(c=>c.sourceURL&&c.integrity&&c.license)).toBe(true);expect(auditDelivery(result.root).target).toBe(target);
});

it('rejects wrong machine types, tampering, missing closure and Windows links without running foreign binaries',async()=>{
  const wrong=fixture('win32-x64');writeFileSync(join(wrong.source,'native','sqlite.win32-x64.node'),Buffer.from([0xcf,0xfa,0xed,0xfe,0x0c,0,0,1]));await expect(assembleTarget({target:wrong.target,outputRoot:wrong.output,sourceRoot:wrong.source,components:wrong.components,diagnosticsRequired:false})).rejects.toThrow('NATIVE_ARCH_MISMATCH');expect(existsSync(wrong.output)).toBe(false);
  const hidden=fixture('win32-x64');writeFileSync(join(hidden.source,'program','unexpected.dll'),Buffer.from([0xcf,0xfa,0xed,0xfe,0x0c,0,0,1]));await expect(assembleTarget({target:hidden.target,outputRoot:hidden.output,sourceRoot:hidden.source,components:hidden.components,diagnosticsRequired:false})).rejects.toThrow('NATIVE_ARCH_MISMATCH');
  const linked=fixture('win32-x64');symlinkSync('chrome.exe',join(linked.source,'browser','linked.exe'));await expect(assembleTarget({target:linked.target,outputRoot:linked.output,sourceRoot:linked.source,components:linked.components,diagnosticsRequired:false})).rejects.toThrow('WINDOWS_LINK_FORBIDDEN');
  const clean=fixture('darwin-arm64'),built=await assembleTarget({target:clean.target,outputRoot:clean.output,sourceRoot:clean.source,components:clean.components,diagnosticsRequired:false});writeFileSync(join(built.root,'program','main.js'),'tampered');expect(()=>auditDelivery(built.root)).toThrow('DELIVERY_INTEGRITY');expect(()=>inspectNativeBinary(Buffer.from('not-native'),'darwin-arm64')).toThrow('NATIVE_ARCH_MISMATCH');
});

it('refuses final assembly until the self-contained diagnostics runner is present and hashed',async()=>{
  const f=fixture('darwin-arm64');await expect(assembleTarget({target:f.target,outputRoot:f.output,sourceRoot:f.source,components:f.components,diagnosticsRequired:true})).rejects.toThrow('DIAGNOSTICS_MISSING');
});
it('pins actual lockfile platform package names and keeps Windows execution evidence not_run',()=>{
  expect(matrix.targets['darwin-arm64'].keyringPackage.name).toBe('@napi-rs/keyring-darwin-arm64');expect(matrix.targets['win32-x64'].keyringPackage).toMatchObject({name:'@napi-rs/keyring-win32-x64-msvc',integrity:expect.stringMatching(/^sha512-/)});expect(matrix.targets['win32-x64'].actualNative).toEqual({osVersion:null,status:'not_run'});expect(matrix.components['better-sqlite3']).toMatchObject({version:'13.0.3',integrity:expect.stringMatching(/^sha512-/)});
});
it('renders a release-coordinate-free rehearsal prompt core bound to exact source and quality digests',()=>{
  const value={releaseCoordinate:null,commit:'a'.repeat(40),tree:'b'.repeat(40),buildId:'c'.repeat(64),sourceSha256:'d'.repeat(64),qualitySha256:'e'.repeat(64)},core=renderPhase2RehearsalInstallPromptCore(value);
  expect(core).toContain('Release coordinate: null');expect(core).toContain(value.qualitySha256);expect(core).not.toMatch(/https?:\/\/|beta\.|github\.com|latest/);
  expect(()=>renderPhase2RehearsalInstallPromptCore({...value,releaseCoordinate:'0.1.0-beta.40'})).toThrow('PHASE2_REHEARSAL_PROMPT_INVALID');
});
it('assembles a dual-target rehearsal capability package with compressed component siblings',async()=>{
  const h=createHarness();try{const build=JSON.parse(readFileSync('build/identity.json','utf8')),identity={releaseCoordinate:null,commit:build.commit,tree:build.tree,buildId:build.buildId,sourceSha256:hashBuildInputs(process.cwd()),qualitySha256:'f'.repeat(64)},pair:any=await assembleManagedUpdaterRehearsalPair({temporaryRoot:join(realpathSync(h.root),'rehearsal'),identity});expect(pair.signerExited).toBe(true);expect(pair.targets).toHaveLength(2);
    for(const target of pair.targets as any[]){expect(target.assets).toHaveLength(8);expect(new Set(target.assets.map((asset:any)=>asset.name)).size).toBe(8);expect(target.assets.map((asset:any)=>asset.role).sort()).toEqual(['bootstrap','browser','capability','installer','manifest','node','program','signature']);expect(target.assets.every((asset:any)=>asset.bytes>0&&/^[a-f0-9]{64}$/.test(asset.sha256))).toBe(true);expect(target.evidence).toMatchObject({deliveryFiles:expect.any(Number),memberCount:16,capabilityClosureSha256:expect.stringMatching(/^[a-f0-9]{64}$/),sensitive:{delivery:{status:'pass'},outer:{status:'pass'}}});for(const report of [target.evidence.sensitive.delivery,target.evidence.sensitive.outer])expect(Object.keys(report).sort()).toEqual(['bytes','findings','objects','reportSha256','status','surface']);expect(target.evidence.deliveryFiles).toBeGreaterThan(16);expect(target.root).toBe(join(realpathSync(h.root),'rehearsal',target.target));expect(target.deliveryRoot).toBeUndefined();const outer=target.assets.find((asset:any)=>asset.role==='capability')!,entries=tarEntries(readFileSync(outer.path),512*1024*1024),members=entries.map(entry=>entry.path),byPath=new Map(entries.map(entry=>[entry.path,entry])),node=target.assets.find((asset:any)=>asset.role==='node')!,browser=target.assets.find((asset:any)=>asset.role==='browser')!;expect(entries.every(entry=>entry.kind==='file'||entry.kind==='directory')).toBe(true);expect(members).toContain(`components/${node.name}`);expect(members).toContain(`components/${browser.name}`);expect(sha256(byPath.get(`components/${node.name}`)!.read())).toBe(node.sha256);expect(sha256(byPath.get(`components/${browser.name}`)!.read())).toBe(browser.sha256);expect(members.some(path=>path.startsWith('node/')||path.startsWith('browser/'))).toBe(false);expect(members).not.toContain(node.name);expect(members).not.toContain(browser.name);expect(members).not.toContain(target.assets.find((asset:any)=>asset.role==='installer')!.name);expect(members).not.toContain(target.assets.find((asset:any)=>asset.role==='program')!.name);expect(members).toContain('components/inventory.json');expect(members).toContain('delivery.json');expect(members).toContain('phase2/manifest.json');expect(members).toContain('phase2/manifest.sig');expect(members).toContain('phase2/capability-closure.json');expect(members).toContain('program/phase2/install-prompt-core.md');expect(members).toContain('program/LICENSE');expect(members).not.toContain('phase2-rehearsal-prompt-core.md');expect(members).not.toContain('release/phase2-install-prompt.md');expect(members).not.toContain(outer.name);const componentInventory=JSON.parse(byPath.get('components/inventory.json')!.read().toString('utf8'));expect(componentInventory.components.map((item:any)=>item.role).sort()).toEqual(['browser','node']);const capabilityManifest=JSON.parse(byPath.get('phase2/manifest.json')!.read().toString('utf8')),capabilityClosure=JSON.parse(byPath.get('phase2/capability-closure.json')!.read().toString('utf8'));expect(capabilityManifest.fingerprint).toBe(pair.fingerprint);expect(capabilityManifest.closureSha256).toBe(canonicalSha256(capabilityClosure));expect(capabilityClosure.members).toHaveLength(16);}
  }finally{await h.cleanup();}
},120000);
