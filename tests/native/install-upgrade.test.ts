import {execFileSync} from 'node:child_process';
import {mkdtempSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {expect,it} from 'vitest';

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
