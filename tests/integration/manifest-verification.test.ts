import {expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {realpathSync,writeFileSync,unlinkSync,mkdirSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {createHarness} from '../../packages/test-support/src/harness.js';
import {protectPath} from '../../packages/platform/src/permissions.js';
import {signSyntheticManifests} from '../../scripts/build/synthetic-sign.mjs';
import {createFixtureVerifier,verifyRelease,verifyArtifactBytes,verifyFileTree,isVerifiedManifest,safeArtifactPath} from '../../packages/installer/src/verify-manifest.js';

const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
function manifest(variant:'A'|'B'='A'){
  return {schema:1,product:'autoed-rebuild',build:{version:variant==='A'?'0.1.0-beta.1':'0.1.0-beta.2',buildId:(variant==='A'?'a':'b').repeat(64),commit:'c'.repeat(40),tree:'d'.repeat(40),dependencyHash:'e'.repeat(64),protocol:1,schemaMin:1,schemaMax:1,capabilities:variant==='A'?['echo']:['echo','digest']},target:{os:'darwin',arch:'arm64',minVersion:'14.0.0'},dependencies:{node:'24.20.0',playwright:'1.62.1',browserRevision:'1234',browserVersion:'151.0.7922.34'},artifacts:[{name:'program.tar.gz',role:'program',url:'https://github.com/returdex/AutoED/releases/download/0.1.0-beta.1/program.tar.gz',sha256:hash('synthetic archive'),bytes:17,format:'tar.gz',unpackedBytes:3,files:[{path:'app.js',sha256:hash('abc'),bytes:3}]}],dependencySources:[{name:'node',version:'24.20.0',url:'https://nodejs.org/dist/v24.20.0/node-v24.20.0-darwin-arm64.tar.gz',integrity:'sha256-'+hash('source')}],tests:{synthetic:'pass',integration:'pass',macosNative:'not_run',windowsNative:'not_run',human:'not_run'}};
}
const target={os:'darwin',arch:'arm64',version:'26.5.2',schema:1,protocol:1} as const;
it('real Ed25519 signs exact A/B bytes with a short-lived fixture key; artifacts and individual files are verified',async()=>{
  const h=createHarness();try{const root=realpathSync(h.root);protectPath(root);const objects=[manifest('A'),manifest('B')];const bytes=objects.map(m=>Buffer.from(JSON.stringify(m)));const signed=await signSyntheticManifests(root,bytes);
    expect(signed.signerExited).toBe(true);expect(JSON.stringify(signed).includes('PRIVATE KEY')).toBe(false);
    const verify=createFixtureVerifier(signed.publicKey,signed.fingerprint);for(let i=0;i<bytes.length;i++){const verified=verify(bytes[i]!,Buffer.from(signed.signatures[i]!,'base64'),target);expect(isVerifiedManifest(verified)).toBe(true);expect(isVerifiedManifest(JSON.parse(JSON.stringify(verified)))).toBe(false);expect(verified.evidence).toBe('synthetic_signature');verifyArtifactBytes(verified,'program.tar.gz',Buffer.from('synthetic archive'));writeFileSync(join(root,'app.js'),'abc');verifyFileTree(verified,'program.tar.gz',root);writeFileSync(join(root,'app.js'),'bad');expect(()=>verifyFileTree(verified,'program.tar.gz',root)).toThrow('FILE_INTEGRITY');}
    writeFileSync(join(root,'app.js'),'abc');writeFileSync(join(root,'unlisted.js'),'untrusted');const verified=verify(bytes[0]!,Buffer.from(signed.signatures[0]!,'base64'),target);expect(()=>verifyFileTree(verified,'program.tar.gz',root)).toThrow('FILE_INTEGRITY');unlinkSync(join(root,'unlisted.js'));
    expect(()=>verifyRelease(bytes[0]!,Buffer.from(signed.signatures[0]!,'base64'),target)).toThrow('RELEASE_TRUST_NOT_ESTABLISHED');
  }finally{await h.cleanup();}
});
it('real headed Chrome internal spaces are valid while ancestor conflicts and nested symlinks are rejected',async()=>{
  expect(safeArtifactPath('chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing')).toBe(true);
  for(const path of ['x/../y','x/CON.txt','x/trailing ','x/dot.','x/a\\b','x/a\nb','/absolute','x/C:drive'])expect(safeArtifactPath(path)).toBe(false);
  const h=createHarness();try{const root=realpathSync(h.root);protectPath(root);const original=manifest();const nested={...original,artifacts:original.artifacts.map(a=>({...a,files:[{...a.files[0]!,path:'nested/app.js'}]}))};const conflict={...original,artifacts:original.artifacts.map(a=>({...a,unpackedBytes:9,files:['a','a-b','a/b'].map(path=>({...a.files[0]!,path}))}))};const bytes=[nested,conflict].map(m=>Buffer.from(JSON.stringify(m))),signed=await signSyntheticManifests(root,bytes),verify=createFixtureVerifier(signed.publicKey,signed.fingerprint);
    expect(()=>verify(bytes[1]!,Buffer.from(signed.signatures[1]!,'base64'),target)).toThrow('MANIFEST_INVALID');mkdirSync(join(root,'nested'));writeFileSync(join(root,'nested/app.js'),'abc');symlinkSync(root,join(root,'nested/link'));const verified=verify(bytes[0]!,Buffer.from(signed.signatures[0]!,'base64'),target);expect(()=>verifyFileTree(verified,'program.tar.gz',root)).toThrow('FILE_INTEGRITY');
  }finally{await h.cleanup();}
});
it('tampered bytes, wrong key/target/schema, missing file closure and oversized/traversal/duplicate members fail closed',async()=>{
  const h=createHarness();try{const root=realpathSync(h.root);protectPath(root);const original=manifest();const invalids=[{...original,target:{...original.target,arch:'x64'}},{...original,unexpected:true},{...original,artifacts:original.artifacts.map(a=>({...a,bytes:5e12}))},{...original,artifacts:original.artifacts.map(a=>({...a,files:[{...a.files[0]!,path:'../escape'}]}))},{...original,artifacts:original.artifacts.map(a=>({...a,files:[a.files[0],a.files[0]]}))}];const bytes=[original,...invalids].map(m=>Buffer.from(JSON.stringify(m)));const signed=await signSyntheticManifests(root,bytes);const verify=createFixtureVerifier(signed.publicKey,signed.fingerprint);
    expect(()=>verify(Buffer.concat([bytes[0]!,Buffer.from(' ')]),Buffer.from(signed.signatures[0]!,'base64'),target)).toThrow('SIGNATURE_INVALID');
    const other=await signSyntheticManifests(root,[bytes[0]!]);expect(()=>createFixtureVerifier(other.publicKey,other.fingerprint)(bytes[0]!,Buffer.from(signed.signatures[0]!,'base64'),target)).toThrow('SIGNATURE_INVALID');
    for(let i=1;i<bytes.length;i++)expect(()=>verify(bytes[i]!,Buffer.from(signed.signatures[i]!,'base64'),target)).toThrow();
    expect(()=>verify(bytes[0]!,Buffer.from(signed.signatures[0]!,'base64'),{...target,schema:2})).toThrow('INCOMPATIBLE');
    expect(()=>verify(bytes[0]!,Buffer.from(signed.signatures[0]!,'base64'),{...target,currentVersion:'0.1.0-beta.2'})).toThrow('DOWNGRADE_REQUIRES_REVIEW');
    const verified=verify(bytes[0]!,Buffer.from(signed.signatures[0]!,'base64'),target);expect(()=>verifyArtifactBytes(verified,'program.tar.gz',Buffer.from('changed'))).toThrow('ARTIFACT_INTEGRITY');expect(()=>verifyFileTree(verified,'program.tar.gz',root)).toThrow('FILE_INTEGRITY');
  }finally{await h.cleanup();}
});
