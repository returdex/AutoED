import {expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {buildManifestBytes} from '../../scripts/release/manifest.mjs';
import {createSyntheticTrustHarness,loadTrustPolicy,verifyBootstrapBinding} from '../../scripts/release/trust.mjs';

const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
function manifest(version='0.1.0-beta.2'){
  const file=Buffer.from('program');
  return {schema:1,product:'autoed-rebuild',build:{version,buildId:'a'.repeat(64),commit:'b'.repeat(40),tree:'c'.repeat(40),dependencyHash:'d'.repeat(64),protocol:1,schemaMin:1,schemaMax:1,capabilities:['echo','digest']},target:{os:'darwin',arch:'arm64',minVersion:'14.0.0'},dependencies:{node:'24.20.0',playwright:'1.62.1',browserRevision:'1234',browserVersion:'151.0.7922.34'},artifacts:[{name:'program.tar.gz',role:'program',url:'https://github.com/returdex/AutoED/releases/download/0.1.0-beta.2/program.tar.gz',sha256:hash(file),bytes:file.length,format:'file',unpackedBytes:file.length,files:[{path:'program',sha256:hash(file),bytes:file.length}]}],dependencySources:[{name:'node',version:'24.20.0',url:'https://nodejs.org/dist/v24.20.0/node-v24.20.0-darwin-arm64.tar.gz',integrity:'sha256-'+'e'.repeat(64)}],tests:{synthetic:'pass',integration:'pass',macosNative:'pass',windowsNative:'not_run',human:'not_run'}} as const;
}

it('keeps production trust fail-closed until an approved Plan 12 receipt establishes it',()=>{
  const policy=loadTrustPolicy();expect(policy).toMatchObject({schema:1,status:'unestablished',approvalReceipt:null,privateKeyStorage:'os_keyring_only'});expect(()=>policy.sign(Buffer.from('{}'))).toThrow('RELEASE_TRUST_NOT_ESTABLISHED');
});

it('signs exact manifest bytes only in an explicit ephemeral synthetic harness',()=>{
  const bytes=buildManifestBytes(manifest()),fixture=createSyntheticTrustHarness(),signature=fixture.sign(bytes),verified=fixture.verify(bytes,signature,{os:'darwin',arch:'arm64',version:'26.5.2',schema:1,protocol:1,currentVersion:'0.1.0-beta.1'});expect(verified.manifestHash).toBe(hash(bytes));expect(verified.keyFingerprint).toBe(fixture.fingerprint);expect(verified.evidence).toBe('synthetic_signature');expect(()=>fixture.verify(Buffer.concat([bytes,Buffer.from(' ')]),signature,{os:'darwin',arch:'arm64',version:'26.5.2',schema:1,protocol:1})).toThrow('SIGNATURE_INVALID');expect(JSON.stringify({signature:signature.toString('base64'),fingerprint:fixture.fingerprint})).not.toContain(fixture.privateCanary);
});

it('rejects key replacement, downgrade replay, manifest hash drift and bootstrap pin drift',()=>{
  const bytes=buildManifestBytes(manifest()),one=createSyntheticTrustHarness(),two=createSyntheticTrustHarness(),signature=one.sign(bytes);expect(()=>two.verify(bytes,signature,{os:'darwin',arch:'arm64',version:'26.5.2',schema:1,protocol:1})).toThrow('SIGNATURE_INVALID');expect(()=>one.verify(buildManifestBytes(manifest('0.1.0-beta.1')),one.sign(buildManifestBytes(manifest('0.1.0-beta.1'))),{os:'darwin',arch:'arm64',version:'26.5.2',schema:1,protocol:1,currentVersion:'0.1.0-beta.2'})).toThrow('DOWNGRADE_REQUIRES_REVIEW');expect(()=>verifyBootstrapBinding({publicKey:one.publicKey,fingerprint:one.fingerprint,nodeSha256:'f'.repeat(64)},{fingerprint:one.fingerprint,nodeSha256:'0'.repeat(64)})).toThrow('BOOTSTRAP_TRUST_MISMATCH');expect(verifyBootstrapBinding({publicKey:one.publicKey,fingerprint:one.fingerprint,nodeSha256:'f'.repeat(64)},{fingerprint:one.fingerprint,nodeSha256:'f'.repeat(64)})).toBe(true);
});
