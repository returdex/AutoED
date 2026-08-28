import {expect,it} from 'vitest';
import {createHash,generateKeyPairSync,randomBytes,sign} from 'node:crypto';
import {mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {buildManifestBytes} from '../../scripts/release/manifest.mjs';
import {initializeTrust,loadTrustPolicy,readApproval,selfcheckTrust,signReleaseFile,verifyBootstrapBinding} from '../../scripts/release/trust.mjs';
import {createFixtureVerifier} from '../../packages/installer/src/verify-manifest.js';

const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
function synthetic(){const {privateKey,publicKey}=generateKeyPairSync('ed25519'),pem=publicKey.export({type:'spki',format:'pem'}).toString(),fingerprint=hash(publicKey.export({type:'spki',format:'der'})),privateCanary=randomBytes(32).toString('hex');return{publicKey:pem,fingerprint,privateCanary,sign:(bytes:Buffer)=>sign(null,bytes,privateKey),verify:createFixtureVerifier(pem,fingerprint)};}
function manifest(version='0.1.0-beta.2'){
  const file=Buffer.from('program');
  return {schema:1,product:'autoed-rebuild',build:{version,buildId:'a'.repeat(64),commit:'b'.repeat(40),tree:'c'.repeat(40),dependencyHash:'d'.repeat(64),protocol:1,schemaMin:1,schemaMax:1,capabilities:['echo','digest']},target:{os:'darwin',arch:'arm64',minVersion:'14.0.0'},dependencies:{node:'24.20.0',playwright:'1.62.1',browserRevision:'1234',browserVersion:'151.0.7922.34'},artifacts:[{name:'program.tar.gz',role:'program',url:'https://github.com/returdex/AutoED/releases/download/0.1.0-beta.2/program.tar.gz',sha256:hash(file),bytes:file.length,format:'file',unpackedBytes:file.length,files:[{path:'program',sha256:hash(file),bytes:file.length}]}],dependencySources:[{name:'node',version:'24.20.0',url:'https://nodejs.org/dist/v24.20.0/node-v24.20.0-darwin-arm64.tar.gz',integrity:'sha256-'+'e'.repeat(64)}],tests:{synthetic:'pass',integration:'pass',macosNative:'pass',windowsNative:'not_run',human:'not_run'}} as const;
}

it('keeps production trust fail-closed until an approved Plan 12 receipt establishes it',()=>{
  const policy=loadTrustPolicy();expect(policy).toMatchObject({schema:1,status:'unestablished',approvalReceipt:null,privateKeyStorage:'os_keyring_only'});expect(()=>policy.sign(Buffer.from('{}'))).toThrow('RELEASE_TRUST_NOT_ESTABLISHED');
});

it('signs exact manifest bytes only in an explicit ephemeral synthetic harness',()=>{
  const bytes=buildManifestBytes(manifest()),fixture=synthetic(),signature=fixture.sign(bytes),verified=fixture.verify(bytes,signature,{os:'darwin',arch:'arm64',version:'26.5.2',schema:1,protocol:1,currentVersion:'0.1.0-beta.1'});expect(verified.manifestHash).toBe(hash(bytes));expect(verified.keyFingerprint).toBe(fixture.fingerprint);expect(verified.evidence).toBe('synthetic_signature');expect(()=>fixture.verify(Buffer.concat([bytes,Buffer.from(' ')]),signature,{os:'darwin',arch:'arm64',version:'26.5.2',schema:1,protocol:1})).toThrow('SIGNATURE_INVALID');expect(JSON.stringify({signature:signature.toString('base64'),fingerprint:fixture.fingerprint})).not.toContain(fixture.privateCanary);
});

it('rejects key replacement, downgrade replay, manifest hash drift and bootstrap pin drift',()=>{
  const bytes=buildManifestBytes(manifest()),one=synthetic(),two=synthetic(),signature=one.sign(bytes);expect(()=>two.verify(bytes,signature,{os:'darwin',arch:'arm64',version:'26.5.2',schema:1,protocol:1})).toThrow('SIGNATURE_INVALID');expect(()=>one.verify(buildManifestBytes(manifest('0.1.0-beta.1')),one.sign(buildManifestBytes(manifest('0.1.0-beta.1'))),{os:'darwin',arch:'arm64',version:'26.5.2',schema:1,protocol:1,currentVersion:'0.1.0-beta.2'})).toThrow('DOWNGRADE_REQUIRES_REVIEW');expect(()=>verifyBootstrapBinding({publicKey:one.publicKey,fingerprint:one.fingerprint,nodeSha256:'f'.repeat(64)},{fingerprint:one.fingerprint,nodeSha256:'0'.repeat(64)})).toThrow('BOOTSTRAP_TRUST_MISMATCH');expect(verifyBootstrapBinding({publicKey:one.publicKey,fingerprint:one.fingerprint,nodeSha256:'f'.repeat(64)},{fingerprint:one.fingerprint,nodeSha256:'f'.repeat(64)})).toBe(true);
});

it('binds the explicit Plan 12 approval and keeps the private release key behind an injected keyring entry',async()=>{
  mkdirSync(resolve('.runtime'),{recursive:true});const receipt=resolve('release/approval.json'),root=mkdtempSync(join(resolve('.runtime'),'release-trust-test-')),publicPath=join(root,'trust-root.json'),input=join(root,'manifest.json'),output=join(root,'manifest.sig');let password:string|undefined;
  const entry={async getPassword(){return password},async setPassword(value:string){password=value},async deleteCredential(){password=undefined;return true}};
  try{expect(readApproval(receipt).scope).toMatchObject({privateKeyStorage:'os_keyring_only',githubOwner:'returdex'});const established=await initializeTrust({receiptPath:receipt,outputPath:publicPath,entry});expect(established.status).toBe('established');expect(readFileSync(publicPath,'utf8')).not.toContain(password!);await expect(initializeTrust({receiptPath:receipt,outputPath:publicPath,entry})).rejects.toThrow('RELEASE_TRUST_ALREADY_ESTABLISHED');expect(await selfcheckTrust({publicPath,receiptPath:receipt,entry})).toMatchObject({status:'pass',fingerprint:established.fingerprint});writeFileSync(input,'exact manifest',{mode:0o600});expect(await signReleaseFile({publicPath,inputPath:input,outputPath:output,entry})).toMatchObject({status:'signed',fingerprint:established.fingerprint});expect(readFileSync(output).length).toBe(64);}finally{rmSync(root,{recursive:true,force:true});}
});
