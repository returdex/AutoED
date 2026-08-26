import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cpSync,mkdtempSync,mkdirSync,readFileSync,realpathSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {expect,it} from 'vitest';
import {assertReleaseIdentity,assertVersionAvailable,isReviewedFixtureException,scanPublicPackage,scanReachableHistory} from '../../scripts/release/preflight.mjs';
import {createPublishPlan} from '../../scripts/release/publish.mjs';
import {verifyPublicAvailability} from '../../scripts/release/verify-availability.mjs';

const sha=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
function packageFixture(){const root=realpathSync(mkdtempSync(join(tmpdir(),'autoed-release-package-')));cpSync(resolve('LICENSE'),join(root,'LICENSE'));cpSync(resolve('LICENSING.md'),join(root,'LICENSING.md'));mkdirSync(join(root,'dist'));writeFileSync(join(root,'dist/program.js'),'safe');return root;}
function identity(overrides={}){return{authorName:'returdex',committerName:'returdex',authorEmail:'123+returdex@users.noreply.github.com',committerEmail:'123+returdex@users.noreply.github.com',login:'returdex',repository:{owner:'returdex',name:'AutoED',exists:false,creationReceipt:null},...overrides};}

it('requires independent returdex identities and refuses an unknown same-name repository',()=>{
  expect(assertReleaseIdentity(identity())).toMatchObject({owner:'returdex',repository:'AutoED'});expect(()=>assertReleaseIdentity(identity({login:'ywan1303'}))).toThrow('RELEASE_IDENTITY_MISMATCH');expect(()=>assertReleaseIdentity(identity({repository:{owner:'returdex',name:'AutoED',exists:true,creationReceipt:null}}))).toThrow('REPOSITORY_CONFLICT');
});

it('refuses beta overwrite, license drift, forbidden runtime material and package canaries',()=>{
  expect(()=>assertVersionAvailable('0.1.0-beta.2',['0.1.0-beta.2'])).toThrow('VERSION_ALREADY_EXISTS');expect(()=>assertVersionAvailable('0.1.0',['0.1.0-beta.1'])).toThrow('VERSION_INVALID');const root=packageFixture();try{expect(scanPublicPackage(root)).toMatchObject({status:'pass'});writeFileSync(join(root,'dist/.env'),'CANARY_'+'RELEASE_SECRET');expect(()=>scanPublicPackage(root)).toThrow('PUBLIC_PACKAGE_REJECTED');rmSync(join(root,'dist/.env'));writeFileSync(join(root,'LICENSE'),'Apache-2.0');expect(()=>scanPublicPackage(root)).toThrow('LICENSE_MISMATCH');}finally{rmSync(root,{recursive:true,force:true});}
});

it('limits reviewed fixture exceptions to exact immutable object and path pairs',()=>{
  const hash='cef27bea75b9b60bd08288674cf66fcbe3e14518';expect(isReviewedFixtureException(hash,'scripts/release/preflight.mjs')).toBe(true);expect(isReviewedFixtureException(hash,'tests/integration/release-gates.test.ts')).toBe(false);expect(isReviewedFixtureException('0'+hash.slice(1),'scripts/release/preflight.mjs')).toBe(false);expect(isReviewedFixtureException(hash,'runtime/preflight.mjs')).toBe(false);expect(isReviewedFixtureException('f'.repeat(40),'scripts/release/preflight.mjs')).toBe(false);
});

it('scans every reachable source-history blob and blocks a secret deleted from the working tree',()=>{
  const root=realpathSync(mkdtempSync(join(tmpdir(),'autoed-release-history-'))),secret='ghp_'+'A'.repeat(36);try{execFileSync('git',['init','-q'],{cwd:root});execFileSync('git',['config','user.name','returdex'],{cwd:root});execFileSync('git',['config','user.email','123+returdex@users.noreply.github.com'],{cwd:root});mkdirSync(join(root,'docs'));writeFileSync(join(root,'docs/private.txt'),secret);execFileSync('git',['add','docs/private.txt'],{cwd:root});execFileSync('git',['commit','-qm','old secret'],{cwd:root});rmSync(join(root,'docs/private.txt'));writeFileSync(join(root,'docs/safe.txt'),'safe');execFileSync('git',['add','-A'],{cwd:root});execFileSync('git',['commit','-qm','remove secret'],{cwd:root});expect(()=>scanReachableHistory(root,'HEAD')).toThrow('SOURCE_HISTORY_REJECTED');try{scanReachableHistory(root,'HEAD');}catch(error){expect(String(error)).not.toContain(secret);}}finally{rmSync(root,{recursive:true,force:true});}
});

it('creates no publish action without a Plan 13 receipt and requires anonymous full-byte availability',async()=>{
  expect(()=>createPublishPlan({preflight:{status:'pass'},approvalReceipt:null,version:'0.1.0-beta.1',assets:[]})).toThrow('PUBLISH_APPROVAL_REQUIRED');const body=Buffer.from('asset'),asset={name:'program.tar.gz',url:'https://github.com/returdex/AutoED/releases/download/0.1.0-beta.1/program.tar.gz',bytes:body.length,sha256:sha(body)},fetch=async(_url:string,options?:{headers?:Record<string,string>})=>{expect(options?.headers?.authorization).toBeUndefined();return{status:200,arrayBuffer:async()=>body,headers:new Map([['content-length',String(body.length)]])};};await expect(verifyPublicAvailability({version:'0.1.0-beta.1',assets:[asset],fetch:async()=>({status:404,arrayBuffer:async()=>new ArrayBuffer(0),headers:new Map()}),verifyManifest:()=>true})).rejects.toThrow('PUBLIC_AVAILABILITY_FAILED');await expect(verifyPublicAvailability({version:'0.1.0-beta.1',assets:[asset],fetch,verifyManifest:()=>{throw Error('bad signature')}})).rejects.toThrow('PUBLIC_AVAILABILITY_FAILED');expect(await verifyPublicAvailability({version:'0.1.0-beta.1',assets:[asset],fetch,verifyManifest:(downloaded:Map<string,Buffer>)=>{expect(downloaded.get(asset.name)?.equals(body)).toBe(true);return{manifestHash:'f'.repeat(64)};}})).toMatchObject({status:'pass',version:'0.1.0-beta.1',manifestHash:'f'.repeat(64)});
});
