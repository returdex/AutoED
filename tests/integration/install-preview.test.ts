import {expect,it} from 'vitest';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,realpathSync,existsSync,chmodSync} from 'node:fs';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {createHarness} from '../../packages/test-support/src/harness.js';
import {protectPath} from '../../packages/platform/src/permissions.js';
import {initializeInstallation,readInstallation} from '../../packages/platform/src/installation.js';
import {signSyntheticManifests} from '../../scripts/build/synthetic-sign.mjs';
import {createFixtureVerifier} from '../../packages/installer/src/verify-manifest.js';
import {createInstallPreview,confirmInstallPreview} from '../../packages/installer/src/preview.js';
import {installConfirmed} from '../../packages/installer/src/install.js';
import {readActive,launcherRegistration} from '../../packages/installer/src/launchers.js';
const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
function tar(files:{path:string;data:Buffer}[]){const chunks:Buffer[]=[];for(const f of files){const h=Buffer.alloc(512);h.write(f.path,0,100);h.write('0000600\0',100);h.write(f.data.length.toString(8).padStart(11,'0')+'\0',124);h.fill(32,148,156);h[156]=48;h.write('ustar\0',257);h.write('00',263);h.write(h.reduce((n,b)=>n+b,0).toString(8).padStart(6,'0')+'\0 ',148);chunks.push(h,f.data,Buffer.alloc((512-f.data.length%512)%512));}chunks.push(Buffer.alloc(1024));return gzipSync(Buffer.concat(chunks));}
async function fixture(parent:string){
  const program=Buffer.from(`process.stdout.write(JSON.stringify({entry:require('node:path').basename(require('node:path').dirname(require('node:path').dirname(__filename))),args:process.argv.slice(2)})+'\\n');`),programFiles=['apps/cli/src/main.js','apps/mcp/src/main.js'].map(path=>({path,data:program})),node=readFileSync(process.execPath),browser=Buffer.from('synthetic-browser-only');
  const parts=[{name:'program.tar.gz',role:'program',format:'tar.gz',data:tar(programFiles),files:programFiles},{name:'node',role:'node',format:'file',data:node,files:[{path:'bin/node',data:node,executable:true}]},{name:'browser',role:'browser',format:'file',data:browser,files:[{path:'synthetic-browser.txt',data:browser}]}];
  const manifest={schema:1,product:'autoed-rebuild',build:{version:'0.1.0-beta.1',buildId:'a'.repeat(64),commit:'b'.repeat(40),tree:'c'.repeat(40),dependencyHash:'d'.repeat(64),protocol:1,schemaMin:1,schemaMax:1,capabilities:['echo']},target:{os:'darwin',arch:'arm64',minVersion:'14.0.0'},dependencies:{node:'24.20.0',playwright:'1.62.1',browserRevision:'1234',browserVersion:'151.0.7922.34'},artifacts:parts.map(p=>({name:p.name,role:p.role,format:p.format,url:'https://github.com/returdex/AutoED/releases/download/0.1.0-beta.1/'+p.name,sha256:sha(p.data),bytes:p.data.length,unpackedBytes:p.files.reduce((n,f)=>n+f.data.length,0),files:p.files.map(({data,...f})=>({...f,bytes:data.length,sha256:sha(data)}))})),dependencySources:[{name:'node',version:'24.20.0',url:'https://nodejs.org/dist/v24.20.0/node-v24.20.0-darwin-arm64.tar.gz',integrity:'sha256-'+'e'.repeat(64)}],tests:{synthetic:'pass',integration:'pass',macosNative:'not_run',windowsNative:'not_run',human:'not_run'}};
  const bytes=Buffer.from(JSON.stringify(manifest)),signed=await signSyntheticManifests(parent,[bytes]);return {verified:createFixtureVerifier(signed.publicKey,signed.fingerprint)(bytes,Buffer.from(signed.signatures[0],'base64'),{os:'darwin',arch:'arm64',version:'26.5.2',schema:1,protocol:1}),archives:Object.fromEntries(parts.map(p=>[p.name,p.data]))};
}
function memoryStore(){const entries=new Map<string,string>();let writes=0;return {get:async(id:string,name:string)=>entries.get(id+':'+name)??null,set:async(id:string,name:string,value:string)=>{writes++;entries.set(id+':'+name,value);},delete:async(id:string,name:string)=>{entries.delete(id+':'+name);},writes:()=>writes};}
it('denied, forged or stale scope confirmation and invalid installation UUID cause zero managed changes',async()=>{
  const h=createHarness();try{const parent=realpathSync(h.root);protectPath(parent);const selection={root:join(parent,'new'),parent,excludedRoots:[]},f=await fixture(parent),store=memoryStore(),preview=createInstallPreview(f.verified,selection);
    expect(()=>confirmInstallPreview(preview,'no')).toThrow('CONFIRMATION_REQUIRED');await expect(installConfirmed(preview,{scopeHash:preview.scopeHash} as never,{store,archives:f.archives})).rejects.toThrow('CONFIRMATION_REQUIRED');expect(existsSync(selection.root)).toBe(false);
    const confirmation=confirmInstallPreview(preview,'INSTALL '+preview.scopeHash);chmodSync(parent,0o750);await expect(installConfirmed(preview,confirmation,{store,archives:f.archives})).rejects.toThrow('REPREVIEW_REQUIRED');chmodSync(parent,0o700);expect(existsSync(selection.root)).toBe(false);
    await expect(initializeInstallation(selection,store,'not-a-uuid')).rejects.toThrow();expect(existsSync(selection.root)).toBe(false);expect(store.writes()).toBe(0);
  }finally{await h.cleanup();}
});
it('confirmed installation binds the actual ID, stages immutable bytes and launches independently from spaces/Chinese paths',async()=>{
  const h=createHarness();try{const base=realpathSync(h.root);protectPath(base);const parent=join(base,'空 格 %!');mkdirSync(parent,{mode:0o700});protectPath(parent);const selection={root:join(parent,'AutoED-Rebuild'),parent,excludedRoots:[]},f=await fixture(base),store=memoryStore(),preview=createInstallPreview(f.verified,selection),confirmation=confirmInstallPreview(preview,'INSTALL '+preview.scopeHash);
    const result=await installConfirmed(preview,confirmation,{store,archives:f.archives});expect(result.state).toBe('staged');expect(readInstallation(selection).installationId).toBe(preview.installationId);expect(readInstallation(selection).credentials.every(c=>c.scope.installationId===preview.installationId)).toBe(true);expect(readActive(selection).manifestHash).toBe(f.verified.manifestHash);
    const registration=launcherRegistration(selection);expect(registration.name).toBe('autoed-rebuild-m1');expect(registration.args).toEqual(['mcp']);const output=execFileSync(registration.command,['status'],{cwd:base,env:{PATH:'/usr/bin:/bin',NODE_OPTIONS:'--require=/nonexistent-canary'},encoding:'utf8',timeout:10000});expect(JSON.parse(output)).toEqual({entry:'cli',args:['--root',selection.root,'--parent',parent,'status']});
    const retained=join(selection.root,'data','retained.txt');writeFileSync(retained,'retained');await installConfirmed(preview,confirmation,{store,archives:f.archives});expect(store.writes()).toBe(4);expect(readFileSync(retained,'utf8')).toBe('retained');expect(existsSync(join(selection.root,'provisioning.json'))).toBe(true);
    writeFileSync(registration.command,'unknown replacement');await expect(installConfirmed(preview,confirmation,{store,archives:f.archives})).rejects.toThrow('ENTRY_OWNERSHIP_UNCONFIRMED');
  }finally{await h.cleanup();}
},30000);
