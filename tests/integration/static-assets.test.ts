import { expect, it } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { buildStatusAssets } from '../../scripts/build/build.mjs';
import { createStatusFixture } from '../../packages/test-support/src/status-fixture.js';
import { createHarness } from '../../packages/test-support/src/harness.js';

it('actual browser build and API main serve only generic allowlisted assets with security headers',async()=>{
  const h=createHarness();let fixture:Awaited<ReturnType<typeof createStatusFixture>>|undefined;
  try{
    const input=join(h.root,'input');mkdirSync(join(input,'src'),{recursive:true});
    writeFileSync(join(input,'index.html'),'<!doctype html><html lang="zh-CN"><head><link rel="stylesheet" href="/assets/status.css"><script type="module" src="/assets/status.js"></script></head><body><h1>AutoED 本地服务</h1></body></html>');
    writeFileSync(join(input,'styles.css'),'body { color: #0F172A; }');
    writeFileSync(join(input,'src/main.ts'),'const label: string = "此页面尚未获得本地访问权限"; document.body.append(document.createTextNode(label));');
    const output=join(h.root,'output');await buildStatusAssets(input,output);
    expect(readFileSync(join(output,'main.js'),'utf8')).not.toContain(': string');
    fixture=await createStatusFixture({assetsRoot:output});
    for(const [path,type] of [['/status','text/html'],['/assets/status.css','text/css'],['/assets/status.js','javascript']]){
      const response=await h.fetch(fixture.api.origin+path);expect(response.status).toBe(200);expect(response.headers.get('content-type')).toContain(type);
      expect(response.headers.get('cache-control')).toBe('no-store');expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('content-security-policy')).toContain("default-src 'self'");
      const text=await response.text();expect(text).not.toContain(fixture.scope.installationId);expect(text).not.toContain(fixture.build.version);
    }
    expect((await h.fetch(fixture.api.origin+'/api/status')).status).toBe(401);
    for(const path of ['/assets/installation.json','/assets/%2e%2e/package.json','/packages/platform/src/credentials.js','/assets/status.js?path=../../installation.json'])expect([401,403,404]).toContain((await h.fetch(fixture.api.origin+path)).status);
    // A symlink cannot turn a compiled public asset into an arbitrary file read.
    const unsafe=join(h.root,'unsafe');mkdirSync(unsafe);symlinkSync(join(input,'index.html'),join(unsafe,'index.html'));
    await expect(createStatusFixture({assetsRoot:unsafe})).rejects.toThrow('UNSAFE_STATIC_ASSET');
  }finally{if(fixture)await fixture.close();await h.cleanup();}
});
it('browser builder rejects Node imports and does not execute source instructions',async()=>{
  const h=createHarness();try{
    const input=join(h.root,'input');mkdirSync(join(input,'src'),{recursive:true});writeFileSync(join(input,'index.html'),'<html></html>');writeFileSync(join(input,'styles.css'),'body{}');
    writeFileSync(join(input,'src/main.ts'),'import fs from "node:fs"; fs.readFileSync("secret");');
    await expect(buildStatusAssets(input,join(h.root,'output'))).rejects.toThrow('BROWSER_IMPORT_DENIED');
  }finally{await h.cleanup();}
});
