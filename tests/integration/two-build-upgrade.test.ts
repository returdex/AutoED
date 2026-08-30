import {execFileSync,spawn} from 'node:child_process';
import {existsSync,mkdtempSync,readFileSync,realpathSync,readdirSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {expect,it} from 'vitest';
import {once} from 'node:events';
import {compiledRelease,createRecoveryFixture} from '../../packages/test-support/src/upgrade-fixture.js';
import {assembleCachedBuild,auditDelivery,stageProductionClosure} from '../../scripts/build/assemble.mjs';
import {createInstallPreview,confirmInstallPreview} from '../../packages/installer/src/preview.js';
import {upgradeConfirmed} from '../../packages/installer/src/upgrade.js';
import {openDatabase,readGate} from '../../packages/persistence/src/database.js';

it('runs the packaged synthetic jobs diagnostic without development dependencies',()=>{
  const root=realpathSync(mkdtempSync(join(tmpdir(),'autoed-native-report-')));
  const stdout=execFileSync(process.execPath,[resolve('scripts/test/native-report.mjs'),'--scenario','jobs','--root',root],{encoding:'utf8',env:{PATH:'/usr/bin:/bin',HOME:process.env.HOME,TMPDIR:process.env.TMPDIR},timeout:30_000});
  expect(JSON.parse(stdout)).toMatchObject({schema:1,scenario:'jobs',result:'pass',synthetic:true});
});
it('reopens a durable synthetic recovery journal through the packaged runner',()=>{
  const root=realpathSync(mkdtempSync(join(tmpdir(),'autoed-native-recovery-'))),stdout=execFileSync(process.execPath,[resolve('scripts/test/native-report.mjs'),'--scenario','install-recovery','--root',root],{encoding:'utf8',env:{PATH:'/usr/bin:/bin',HOME:process.env.HOME,TMPDIR:process.env.TMPDIR},timeout:30_000});expect(JSON.parse(stdout)).toMatchObject({scenario:'install-recovery',result:'pass',codes:expect.arrayContaining(['INTENT_DURABLE','RECOVERY_REOPENED'])});rmSync(root,{recursive:true,force:true});
});

it('does not represent downloaded browser hashes as release-signature trust',()=>{
  const matrix=JSON.parse(readFileSync(resolve('scripts/build/platform-matrix.json'),'utf8'));
  expect(matrix.components.browser.integrity).toBe('full-archive-sha256-recorded-in-synthetic-build-manifest');
  for(const target of Object.values(matrix.targets) as Array<{browser:{bytes?:number;sha256?:string}}>)expect(target.browser).toMatchObject({bytes:expect.any(Number),sha256:expect.stringMatching(/^[a-f0-9]{64}$/)});
});

it.each(['darwin-arm64','win32-x64'] as const)('builds a target-only locked production closure for %s',target=>{
  const parent=realpathSync(mkdtempSync(join(tmpdir(),'autoed-prod-closure-'))),destination=join(parent,target);
  try{const result=stageProductionClosure({projectRoot:resolve('.'),destination,target,windowsKeyringRoot:resolve('.runtime/delivery-cache/extracted/win-keyring/package')});expect(result.packages.length).toBeGreaterThan(60);expect(result.packages.some(p=>p.name==='fsevents')).toBe(false);expect(result.packages.filter(p=>p.name.startsWith('@napi-rs/keyring-')).map(p=>p.name)).toEqual([target==='darwin-arm64'?'@napi-rs/keyring-darwin-arm64':'@napi-rs/keyring-win32-x64-msvc']);const lock=JSON.parse(readFileSync(resolve('package-lock.json'),'utf8'));expect(result.packages.every(p=>lock.packages[`node_modules/${p.name}`]?.dev!==true)).toBe(true);const prebuilds=readdirSync(join(destination,'node_modules/better-sqlite3/prebuilds'));expect(prebuilds).toEqual([target==='darwin-arm64'?'darwin-arm64.node':'win32-x64.node']);expect(existsSync(join(destination,'node_modules',target==='darwin-arm64'?'@napi-rs/keyring-darwin-arm64':'@napi-rs/keyring-win32-x64-msvc'))).toBe(true);expect(JSON.parse(readFileSync(join(destination,'closure.json'),'utf8')).target).toBe(target);}finally{rmSync(parent,{recursive:true,force:true});}
});

it('assembles actual A/B target trees and runs diagnostics only from the packaged closure',async()=>{
  const parent=realpathSync(mkdtempSync(join(tmpdir(),'autoed-deliveries-')));symlinkSync(realpathSync('node_modules'),join(parent,'node_modules'),'dir');
  try{const releases=await Promise.all([compiledRelease(parent,'A'),compiledRelease(parent,'B')]),built=[];for(const release of releases)for(const target of ['darwin-arm64','win32-x64'] as const){const output=join(parent,`${release.build.version}-${target}`),delivery=await assembleCachedBuild({projectRoot:resolve('.'),compiledRoot:join(parent,`compiled-${release.build.capabilities.includes('digest')?'B':'A'}`),cacheRoot:resolve('.runtime/delivery-cache'),outputRoot:output,target});expect(auditDelivery(delivery.root).target).toBe(target);expect(delivery.report.files.some(f=>f.path==='program/dist/build/identity.json')).toBe(true);expect(delivery.report.nativeEvidence).not.toBe('passed');built.push(delivery);}const mac=built.find(x=>x.report.target==='darwin-arm64'&&x.report.files.some(f=>f.path.includes('diagnostics/native-report.mjs')))!;const native=join(mac.root,'node/bin/node'),runner=join(mac.root,'program/diagnostics/native-report.mjs'),diagnosticRoot=realpathSync(mkdtempSync(join(tmpdir(),'autoed-packaged-runner-'))),report=JSON.parse(execFileSync(native,[runner,'--scenario','jobs','--root',diagnosticRoot],{cwd:mac.root,encoding:'utf8',env:{PATH:'/usr/bin:/bin',HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,AUTOED_PACKAGED_DIAGNOSTIC:'1'},timeout:30_000}));expect(report).toMatchObject({result:'pass',codes:expect.arrayContaining(['MODULE_CLOSURE_LOCAL','DUAL_CONNECTION_FENCED'])});rmSync(diagnosticRoot,{recursive:true,force:true});expect(built.filter(x=>x.report.target==='win32-x64').every(x=>x.report.nativeEvidence==='not_run')).toBe(true);}finally{rmSync(parent,{recursive:true,force:true});}
},300_000);

it('recovers an exact pre-activation host-reload stop and completes the next signed upgrade',async()=>{
  const fixture=await createRecoveryFixture();let primary:unknown;
  try{const stopped=await fixture.prepareHostReloadFailure();expect(fixture.failureReceipt(stopped.operationId)).toMatchObject({code:'HOST_RELOAD_REQUIRED_QUIESCED_INTENT',projectionWritten:true,projectionCode:'OFFLINE_EXCLUSIVE'});const result=await fixture.resumeHostReloadUpgrade();expect(result).toMatchObject({state:'complete',build:{buildId:fixture.target.build.buildId},cleanup:'complete'});expect(await fixture.status()).toMatchObject({install:{result:'succeeded',actualBuild:{buildId:fixture.target.build.buildId}},selfcheck:{featureResult:'pass'}});}catch(error){primary=error;throw error;}finally{try{await fixture.cleanup();}catch(error){if(!primary)throw error;}}
},300_000);

it('requests host reload before creating a journal or entering maintenance',async()=>{
  const fixture=await createRecoveryFixture(),entry=join(fixture.parent,'live-host.mjs'),url=new URL('../../packages/platform/src/client-host.ts',import.meta.url).href;let primary:unknown;const script=`import{registerHooks}from'node:module';registerHooks({resolve(s,c,n){try{return n(s,c)}catch(e){if(s.endsWith('.js'))return n(s.slice(0,-3)+'.ts',c);throw e}}});const{registerClientHost}=await import(${JSON.stringify(url)});await registerClientHost(${JSON.stringify(fixture.selection)},${JSON.stringify(fixture.old.build)});process.stdout.write('ready\\n');process.stdin.resume();await new Promise(r=>process.stdin.on('end',r));`;
  const {writeFileSync}=await import('node:fs');writeFileSync(entry,script);const host=spawn(process.execPath,['--experimental-transform-types',entry],{cwd:fixture.parent,stdio:['pipe','pipe','pipe'],env:{PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR}});
  try{const [ready]=await once(host.stdout!,'data');expect(String(ready)).toBe('ready\n');const preview=createInstallPreview(fixture.target.manifest,fixture.selection),confirmation=confirmInstallPreview(preview,'INSTALL '+preview.scopeHash);await expect(upgradeConfirmed(preview,confirmation,{archives:fixture.target.archives,oldManifest:fixture.old.manifest,store:fixture.secrets,cleanup:async()=>({complete:true})})).rejects.toThrow('HOST_RELOAD_REQUIRED_PRECHECK');const db=openDatabase(join(fixture.selection.root,'data/jobs.sqlite'));try{expect(readGate(db).state).toBe('open');}finally{db.close();}expect(existsSync(join(fixture.selection.root,'installer-staging/update.lock'))).toBe(false);expect(JSON.parse(readFileSync(join(fixture.selection.root,'active.json'),'utf8')).build.buildId).toBe(fixture.old.build.buildId);}catch(error){primary=error;throw error;}finally{if(host.exitCode===null){host.stdin!.end();await once(host,'exit');}try{await fixture.cleanup();}catch(error){if(!primary)throw error;}}
},300_000);

it('installs echo-only A then upgrades through the real CLI/MCP/API/Worker path to digest-capable B',async()=>{
  const fixture=await createRecoveryFixture();let primary:unknown;
  try{
    expect(fixture.old.build).toMatchObject({version:'0.1.0-beta.1',capabilities:['echo']});
    expect(fixture.target.build).toMatchObject({version:'0.1.0-beta.2',capabilities:['echo','digest']});
    const result=await fixture.runUpgradeCLI();expect(result).toMatchObject({type:'install_result',state:'complete',build:{buildId:fixture.target.build.buildId},cleanup:'complete'});
    expect(await fixture.status()).toMatchObject({install:{result:'succeeded',actualBuild:{buildId:fixture.target.build.buildId}},selfcheck:{featureResult:'pass'}});
  }catch(error){primary=error;throw error;}finally{try{await fixture.cleanup();}catch(error){if(!primary)throw error;}}
},300_000);
