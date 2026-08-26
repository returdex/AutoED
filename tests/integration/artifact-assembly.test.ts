import {expect,it} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {assembleTarget,auditDelivery} from '../../scripts/build/assemble.mjs';
import {inspectNativeBinary} from '../../scripts/build/native-artifacts.mjs';

function fixture(target:'darwin-arm64'|'win32-x64'){
  const root=mkdtempSync(join(tmpdir(),'autoed-assembly-')),source=join(root,'source'),output=join(root,'output');mkdirSync(source);for(const name of ['program','node','browser','native'])mkdirSync(join(source,name));
  writeFileSync(join(source,'program','main.js'),"import 'zod';\n");writeFileSync(join(source,'program','package.json'),JSON.stringify({type:'module',dependencies:{zod:'4.4.3'}}));
  const machine=target==='darwin-arm64'?Buffer.from([0xcf,0xfa,0xed,0xfe,0x0c,0,0,1]):Buffer.from('MZ'+String.fromCharCode(...Array(58).fill(0))+'PE\0\0d\u0086');
  writeFileSync(join(source,'node',target==='darwin-arm64'?'node':'node.exe'),machine);writeFileSync(join(source,'native',target==='darwin-arm64'?'sqlite.darwin-arm64.node':'sqlite.win32-x64.node'),machine);writeFileSync(join(source,'browser',target==='darwin-arm64'?'chrome':'chrome.exe'),machine);
  if(target==='darwin-arm64'){mkdirSync(join(source,'browser','Versions'));mkdirSync(join(source,'browser','Versions','151.0.7922.34'));symlinkSync('151.0.7922.34',join(source,'browser','Versions','Current'));}
  return {root,source,output,target,components:[['program','pure-js'],['node','node'],['browser','browser'],['native','better-sqlite3']] as const};
}

it.each(['darwin-arm64','win32-x64'] as const)('writes an auditable, target-specific dependency closure for %s',async target=>{
  const f=fixture(target),result=await assembleTarget({target,outputRoot:f.output,sourceRoot:f.source,components:f.components,diagnosticsRequired:false});expect(result.report.target).toBe(target);expect(result.report.nativeEvidence).toBe(target==='darwin-arm64'?'static_only':'not_run');expect(result.report.files.length).toBeGreaterThan(4);expect(result.report.components.every(c=>c.sourceURL&&c.integrity&&c.license)).toBe(true);expect(auditDelivery(result.root).target).toBe(target);
});

it('rejects wrong machine types, tampering, missing closure and Windows links without running foreign binaries',async()=>{
  const wrong=fixture('win32-x64');writeFileSync(join(wrong.source,'native','sqlite.win32-x64.node'),Buffer.from([0xcf,0xfa,0xed,0xfe,0x0c,0,0,1]));await expect(assembleTarget({target:wrong.target,outputRoot:wrong.output,sourceRoot:wrong.source,components:wrong.components,diagnosticsRequired:false})).rejects.toThrow('NATIVE_ARCH_MISMATCH');
  const linked=fixture('win32-x64');symlinkSync('chrome.exe',join(linked.source,'browser','linked.exe'));await expect(assembleTarget({target:linked.target,outputRoot:linked.output,sourceRoot:linked.source,components:linked.components,diagnosticsRequired:false})).rejects.toThrow('WINDOWS_LINK_FORBIDDEN');
  const clean=fixture('darwin-arm64'),built=await assembleTarget({target:clean.target,outputRoot:clean.output,sourceRoot:clean.source,components:clean.components,diagnosticsRequired:false});writeFileSync(join(built.root,'program','main.js'),'tampered');expect(()=>auditDelivery(built.root)).toThrow('DELIVERY_INTEGRITY');expect(()=>inspectNativeBinary(Buffer.from('not-native'),'darwin-arm64')).toThrow('NATIVE_ARCH_MISMATCH');
});

it('refuses final assembly until the self-contained diagnostics runner is present and hashed',async()=>{
  const f=fixture('darwin-arm64');await expect(assembleTarget({target:f.target,outputRoot:f.output,sourceRoot:f.source,components:f.components,diagnosticsRequired:true})).rejects.toThrow('DIAGNOSTICS_MISSING');
});
