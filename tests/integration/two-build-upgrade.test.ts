import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {expect,it} from 'vitest';

it('runs the packaged synthetic jobs diagnostic without development dependencies',()=>{
  const root=realpathSync(mkdtempSync(join(tmpdir(),'autoed-native-report-')));
  const stdout=execFileSync(process.execPath,[resolve('scripts/test/native-report.mjs'),'--scenario','jobs','--root',root],{encoding:'utf8',env:{PATH:'/usr/bin:/bin',HOME:process.env.HOME,TMPDIR:process.env.TMPDIR},timeout:30_000});
  expect(JSON.parse(stdout)).toMatchObject({schema:1,scenario:'jobs',result:'pass',synthetic:true});
});

it('does not represent downloaded browser hashes as release-signature trust',()=>{
  const matrix=JSON.parse(readFileSync(resolve('scripts/build/platform-matrix.json'),'utf8'));
  expect(matrix.components.browser.integrity).toBe('full-archive-sha256-recorded-in-synthetic-build-manifest');
  for(const target of Object.values(matrix.targets) as Array<{browser:{bytes?:number;sha256?:string}}>)expect(target.browser).toMatchObject({bytes:expect.any(Number),sha256:expect.stringMatching(/^[a-f0-9]{64}$/)});
});
