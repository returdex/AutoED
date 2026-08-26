import {execFileSync} from 'node:child_process';
import {mkdtempSync,realpathSync,rmSync,writeFileSync,lstatSync} from 'node:fs';
import {randomBytes,randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {expect,it} from 'vitest';
import Database from 'better-sqlite3';
import {chromium} from 'playwright';
import {NativeSecretStore} from '../../packages/platform/src/credentials.js';
import {protectPath,verifyProtectedPath} from '../../packages/platform/src/permissions.js';

it('reports the current native platform honestly through the self-contained runner',()=>{
  const root=realpathSync(mkdtempSync(join(tmpdir(),'autoed-native-permissions-')));
  const report=JSON.parse(execFileSync(process.execPath,[resolve('scripts/test/native-report.mjs'),'--scenario','permissions','--root',root],{encoding:'utf8',env:{PATH:'/usr/bin:/bin',HOME:process.env.HOME,TMPDIR:process.env.TMPDIR},timeout:30_000}));
  expect(report).toMatchObject({schema:1,scenario:'permissions',os:process.platform,arch:process.arch,result:'pass',synthetic:true});
  expect(report).not.toHaveProperty('token');
});

it('keeps Windows native execution not_run on a Darwin host',()=>{
  if(process.platform!=='darwin')return;
  const root=realpathSync(mkdtempSync(join(tmpdir(),'autoed-native-windows-')));
  const report=JSON.parse(execFileSync(process.execPath,[resolve('scripts/test/native-report.mjs'),'--scenario','install-recovery','--root',root,'--target','win32-x64'],{encoding:'utf8',env:{PATH:'/usr/bin:/bin',HOME:process.env.HOME,TMPDIR:process.env.TMPDIR},timeout:30_000}));
  expect(report).toMatchObject({target:'win32-x64',result:'not_run',code:'NATIVE_PLATFORM_NOT_RUN'});
});

it('runs the fully downloaded mac Node, headed-browser binary, SQLite, keyring and ACL probes',async()=>{
  if(process.platform!=='darwin'||process.arch!=='arm64')return;
  const root=realpathSync(mkdtempSync(join(tmpdir(),'autoed-packaged-native-'))),id=randomUUID(),secret=randomBytes(32).toString('base64url'),store=new NativeSecretStore();let stored=false,browser;
  try{
    protectPath(root);expect(verifyProtectedPath(root)).toBe(true);expect(lstatSync(root).mode&0o777).toBe(0o700);
    const node=resolve('.runtime/delivery-cache/extracted/mac-node/node-v24.20.0-darwin-arm64/bin/node');expect(execFileSync(node,['--version'],{encoding:'utf8',timeout:10_000}).trim()).toBe('v24.20.0');
    const dbPath=join(root,'native.sqlite'),backup=join(root,'native.backup.sqlite'),db=new Database(dbPath);db.exec('CREATE TABLE probe(value TEXT); INSERT INTO probe VALUES (\'ok\')');await db.backup(backup);db.close();const restored=new Database(backup,{readonly:true});expect(restored.prepare('SELECT value FROM probe').pluck().get()).toBe('ok');restored.close();
    await store.set(id,'native-test',secret);stored=true;expect((await store.get(id,'native-test'))===secret).toBe(true);
    const executablePath=resolve('.runtime/delivery-cache/extracted/mac-browser/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');browser=await chromium.launch({executablePath,headless:true});const page=await browser.newPage();await page.setContent('<title>AutoED synthetic native probe</title>');expect(await page.title()).toBe('AutoED synthetic native probe');
  }finally{if(browser)await browser.close();if(stored)await store.delete(id,'native-test');rmSync(root,{recursive:true,force:true});}
},60_000);
