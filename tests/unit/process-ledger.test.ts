import { expect, it } from 'vitest';
import { mkdirSync,mkdtempSync,realpathSync,rmSync,writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,sep } from 'node:path';
import { classifySyntheticServicePaths,hasSyntheticRootName, parseSyntheticServiceArgv, readSyntheticProcessLedger } from '../../packages/test-support/src/process-ledger.js';

it('accepts only the exact full synthetic service argv grammar', () => {
  const argv = [
    '/synthetic/node',
    '/synthetic/main.js',
    '--autoed-service',
    '/synthetic/installation',
    '/synthetic/root',
    '123e4567-e89b-12d3-a456-426614174000',
  ];

  expect(parseSyntheticServiceArgv(argv)).toEqual({
    executable: '/synthetic/node',
    entrypoint: '/synthetic/main.js',
    installationPath: '/synthetic/installation',
    rootPath: '/synthetic/root',
    nonce: '123e4567-e89b-12d3-a456-426614174000',
  });
  expect(() => parseSyntheticServiceArgv([...argv, '--unexpected'])).toThrow('SYNTHETIC_PROCESS_OWNERSHIP_UNCONFIRMED');
});

it('accepts only the generated alphanumeric synthetic root suffix', () => {
  const prefix = `${realpathSync(tmpdir())}${sep}autoed-synthetic-`;
  expect(hasSyntheticRootName(`${prefix}Abc123`)).toBe(true);
  expect(hasSyntheticRootName(`${prefix}Abc-123`)).toBe(false);
  expect(hasSyntheticRootName(`${prefix}autoed-synthetic-Abc123`)).toBe(false);
});

it('recognizes the exact native-fixture compiled service layout without accepting siblings',()=>{
  const root=realpathSync(mkdtempSync(join(realpathSync(tmpdir()),'autoed-synthetic-'))),entrypoint=join(root,'compiled/apps/api/src/main.js');mkdirSync(join(root,'installation'),{recursive:true});mkdirSync(join(root,'compiled/apps/api/src'),{recursive:true});writeFileSync(entrypoint,'');
  try{expect(classifySyntheticServicePaths(root,entrypoint,process.execPath)).toMatchObject({root,role:'api',layout:'compiled',buildId:null});const sibling=join(root,'compiled/apps/api/src/other.js');writeFileSync(sibling,'');expect(()=>classifySyntheticServicePaths(root,sibling,process.execPath)).toThrow('SYNTHETIC_PROCESS_OWNERSHIP_UNCONFIRMED');}finally{rmSync(root,{recursive:true,force:true});}
});

it('does not inspect or report the persistent user installation service as synthetic', () => {
  expect(readSyntheticProcessLedger()).toEqual([]);
});
