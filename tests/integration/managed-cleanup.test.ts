import {expect,it} from 'vitest';
import {cleanupManaged,cleanupRuntimeInventory} from '../../packages/installer/src/cleanup.js';
import {createRecoveryFixture} from '../../packages/test-support/src/upgrade-fixture.js';
import {createHarness} from '../../packages/test-support/src/harness.js';
import {initializeInstallation} from '../../packages/platform/src/installation.js';
import {protectPath} from '../../packages/platform/src/permissions.js';
import {realpathSync,readFileSync,readdirSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';

const digest=(bytes:string|Buffer)=>createHash('sha256').update(bytes).digest('hex');

it('completes only after old owned entries are inactive and preserves archives and unknown files',async()=>{
  const f=await createRecoveryFixture();try{const failed=await f.failUpgrade('cleaned','intent'),context=await f.cleanupContext(failed.operationId),activation=join(f.selection.root,'installer-staging','activation-'+failed.operationId),pinsPath=join(activation,'pins.json'),pins=JSON.parse(readFileSync(pinsPath,'utf8'));for(const [side,bin]of [['old',join(activation,'old-bin')],['candidate',join(f.selection.root,'bin')]]as const){const launcher=join(bin,'launcher.mjs'),large=Buffer.concat([readFileSync(launcher),Buffer.from('\n/*'+'.'.repeat(70000)+'*/\n')]);expect(large.length).toBeGreaterThan(65536);expect(large.length).toBeLessThan(1024*1024);writeFileSync(launcher,large);const ownershipPath=join(bin,'ownership.json'),ownership=JSON.parse(readFileSync(ownershipPath,'utf8')),entry=ownership.files.find((file:{name:string})=>file.name==='launcher.mjs');entry.sha256=digest(large);writeFileSync(ownershipPath,JSON.stringify(ownership));for(const file of pins[side].files)file.hash=digest(readFileSync(join(bin,file.name)));}writeFileSync(pinsPath,JSON.stringify(pins));const result=await cleanupManaged(context);expect(result).toEqual({complete:true,code:'CLEANUP_COMPLETE'});expect(f.archiveCanary()).toBe('retained');expect(f.unrelatedCanary()).toBe('retained');expect(f.oldActiveEntryExists()).toBe(false);}finally{await f.cleanup();}
},180000);

it.each(['host_receipt_unknown','process_receipt_unknown','startup_ref','mixed_pins','access_denied'] as const)('returns a bounded cleanup_pending cause for %s',async fault=>{
  const f=await createRecoveryFixture();try{const failed=await f.failUpgrade('cleaned','intent'),context=await f.cleanupContext(failed.operationId);await f.applyCleanupFault(fault);const result=await cleanupManaged(context);expect(result.complete).toBe(false);expect(result.code).toMatch(/^CLEANUP_PENDING_[A-Z_]+$/);expect(f.archiveCanary()).toBe('retained');expect(f.unrelatedCanary()).toBe('retained');}finally{await f.cleanupPreservingUnknown();}
},180000);

it('blocks a live owned host but removes a stale lease after its PID is reused without stopping the replacement',async()=>{
  const h=createHarness(),values=new Map<string,string>(),parent=realpathSync(h.root),selection={root:join(parent,'installation'),parent,excludedRoots:[]};protectPath(parent);const metadata=await initializeInstallation(selection,{get:async(id,name)=>values.get(id+name)??null,set:async(id,name,value)=>{values.set(id+name,value);},delete:async(id,name)=>{values.delete(id+name);}}),build={version:'0.1.0-beta.1',buildId:'a'.repeat(64),commit:'c'.repeat(40),tree:'d'.repeat(40),dependencyHash:'e'.repeat(64),protocol:1,schemaMin:1,schemaMax:1,capabilities:['echo']};
  const url=new URL('../../packages/platform/src/client-host.ts',import.meta.url).href,script=`import{registerHooks}from'node:module';registerHooks({resolve(s,c,n){try{return n(s,c)}catch(e){if(s.endsWith('.js'))return n(s.slice(0,-3)+'.ts',c);throw e}}});const{registerClientHost}=await import(${JSON.stringify(url)});await registerClientHost(${JSON.stringify(selection)},${JSON.stringify(build)});process.stdout.write('ready\\n');process.stdin.resume();await new Promise(r=>process.stdin.on('end',r));`;
  const fixtureEntry=join(parent,'host-fixture.mjs');writeFileSync(fixtureEntry,script);const env={PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,AUTOED_SYNTHETIC_TEST:'1',AUTOED_SYNTHETIC_PORT:process.env.AUTOED_SYNTHETIC_PORT},host=spawn(process.execPath,['--experimental-transform-types',fixtureEntry],{cwd:parent,stdio:['pipe','pipe','pipe'],env});try{const [ready]=await Promise.race([once(host.stdout!,'data'),once(host,'exit').then(()=>{throw new Error('HOST_FIXTURE_EXITED');})]);expect(String(ready)).toBe('ready\n');await expect(cleanupRuntimeInventory(selection,{timeoutMs:100,pollMs:10})).rejects.toThrow('HOST_OWNERSHIP_UNCONFIRMED');const directory=join(selection.root,'runtime/clients'),path=join(directory,readdirSync(directory)[0]!),prior=JSON.parse(readFileSync(path,'utf8')),dummy=spawn('/bin/sleep',['60'],{stdio:'ignore',env});writeFileSync(path,JSON.stringify({...prior,pid:dummy.pid}));await cleanupRuntimeInventory(selection,{timeoutMs:100,pollMs:10});expect(dummy.exitCode).toBeNull();expect(existsSync(directory)).toBe(false);dummy.kill('SIGTERM');await once(dummy,'exit');host.stdin!.end();await once(host,'exit');}finally{if(host.exitCode===null){host.stdin!.end();await once(host,'exit');}await h.cleanup();}
},30000);
