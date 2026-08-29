import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {lstatSync,readFileSync,readdirSync,realpathSync} from 'node:fs';
import {homedir} from 'node:os';
import {dirname,join,relative,isAbsolute,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const repo=join(dirname(fileURLToPath(import.meta.url)),'../..'),allowedNames=new Set(['LICENSE','LICENSING.md']),allowedRoots=new Set(['dist','runtime','browser','public-manifest','bootstrap','docs']),sourceRoots=new Set(['.planning','apps','docs','packages','rebuild-2026-08-26','release','scripts','tests']),sourceFiles=new Set(['.gitignore','AGENTS.md','LICENSE','LICENSING.md','package-lock.json','package.json','playwright.config.ts','tsconfig.json','vitest.config.ts']),forbidden=/(?:^|\/)(?:Profile|Cookies?|.*\.sqlite(?:-wal|-shm)?|\.env(?:\..*)?|logs?|private[-_]?keys?|private[-_]?fixtures?)(?:\/|$)/i,secret=new RegExp(['gh'+'[pousr]_[A-Za-z0-9]{20,}','github_'+'pat_[A-Za-z0-9_]{20,}','-----BEGIN '+'(?:OPENSSH|EC|RSA|PRIVATE) PRIVATE KEY-----','CANARY_'+'RELEASE_SECRET'].join('|'));
const reviewedFixtures=new Map([
  ['cef27bea75b9b60bd08288674cf66fcbe3e14518',{path:'scripts/release/preflight.mjs',reason:'reviewed-detector-source'}],
  ['90eaa763d659068307640c66381003243a47cc0c',{path:'tests/integration/release-gates.test.ts',reason:'reviewed-negative-fixture'}],
  ['2624b58ba44aa0c961c04f58421964ed8e56d127',{path:'tests/integration/release-gates.test.ts',reason:'reviewed-negative-fixture'}],
]);
const digest=value=>createHash('sha256').update(value).digest('hex');
function reject(code){throw new Error(code);}
function approvedEmail(value){return /^\d+\+returdex@users\.noreply\.github\.com$/.test(value);}
export function isReviewedFixtureException(hash,path){const item=reviewedFixtures.get(hash);return !!item&&item.path===path&&(path==='scripts/release/preflight.mjs'||path==='tests/integration/release-gates.test.ts');}

export function assertReleaseIdentity(value){
  if(value?.authorName!=='returdex'||value?.committerName!=='returdex'||!approvedEmail(value.authorEmail)||!approvedEmail(value.committerEmail)||value.login!=='returdex'||value.repository?.owner!=='returdex'||value.repository?.name!=='AutoED')reject('RELEASE_IDENTITY_MISMATCH');
  if(value.repository.exists&&!(value.repository.creationReceipt?.schema===1&&value.repository.creationReceipt?.plan==='01-12'&&value.repository.creationReceipt?.owner==='returdex'&&value.repository.creationReceipt?.name==='AutoED'&&value.repository.creationReceipt?.status==='approved'))reject('REPOSITORY_CONFLICT');
  return Object.freeze({owner:'returdex',repository:'AutoED'});
}
function exactKeys(value,keys){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');}
export function validatePrerequisites(value){
  if(!exactKeys(value,['schema','plan','status','checkedAt','approvalSha256','fingerprint','fingerprintUserConfirmed','osKeyAvailable','isolatedLogin','globalLoginObserved','isolatedConfigProtection','localGit','repository','localRemoteConfigured'])||value.schema!==1||value.plan!=='01-12'||value.status!=='approved'||!/^2026-08-29T\d{2}:\d{2}:\d{2}Z$/.test(value.checkedAt)||!/^[a-f0-9]{64}$/.test(value.approvalSha256)||!/^[a-f0-9]{64}$/.test(value.fingerprint)||value.fingerprintUserConfirmed!==true||value.osKeyAvailable!==true||value.isolatedLogin!=='returdex'||value.globalLoginObserved!=='ywan1303'||value.isolatedConfigProtection!=='0700'||value.localRemoteConfigured!==false||!exactKeys(value.localGit,['authorName','committerName','authorEmail','committerEmail'])||!exactKeys(value.repository,['owner','name','exactNameExists','canonicalObserved','state'])||value.repository.owner!=='returdex'||value.repository.name!=='AutoED'||value.repository.exactNameExists!==false||value.repository.state!=='available_after_user_rename'||value.repository.canonicalObserved==='returdex/AutoED')reject('RELEASE_PREREQUISITES_INVALID');
  assertReleaseIdentity({...value.localGit,login:value.isolatedLogin,repository:{owner:value.repository.owner,name:value.repository.name,exists:value.repository.exactNameExists,creationReceipt:null}});return Object.freeze(value);
}
export function assertVersionAvailable(version,existing=[]){const match=/^0\.1\.0-beta\.(\d+)$/.exec(version);if(!match||!Number.isSafeInteger(Number(match[1]))||Number(match[1])<1)reject('VERSION_INVALID');const numbers=existing.map(x=>/^0\.1\.0-beta\.(\d+)$/.exec(x)).filter(Boolean).map(x=>Number(x[1]));if(existing.includes(version)||numbers.some(n=>n>=Number(match[1])))reject('VERSION_ALREADY_EXISTS');return true;}

function scanBytes(bytes){if(bytes.length>64*1024*1024||secret.test(bytes.toString('utf8')))reject('SECRET_SCAN_REJECTED');}
export function scanPublicPackage(root){try{if(!isAbsolute(root)||realpathSync(root)!==root||!lstatSync(root).isDirectory())throw new Error();if(!readFileSync(join(root,'LICENSE')).equals(readFileSync(join(repo,'LICENSE')))||!readFileSync(join(root,'LICENSING.md')).equals(readFileSync(join(repo,'LICENSING.md'))))reject('LICENSE_MISMATCH');let files=0;const walk=(directory,prefix='')=>{for(const entry of readdirSync(directory,{withFileTypes:true})){const rel=prefix+entry.name,path=join(directory,entry.name),stat=lstatSync(path);if(stat.isSymbolicLink()||forbidden.test(rel)||(!prefix&&!allowedNames.has(entry.name)&&!allowedRoots.has(entry.name)))reject('PUBLIC_PACKAGE_REJECTED');if(entry.isDirectory())walk(path,rel+'/');else if(entry.isFile()){if(++files>100000||stat.nlink!==1)reject('PUBLIC_PACKAGE_REJECTED');scanBytes(readFileSync(path));}else reject('PUBLIC_PACKAGE_REJECTED');}};walk(root);return{status:'pass',files};}catch(error){if(error instanceof Error&&['LICENSE_MISMATCH','PUBLIC_PACKAGE_REJECTED','SECRET_SCAN_REJECTED'].includes(error.message))throw error;reject('PUBLIC_PACKAGE_REJECTED');}}

export function scanReachableHistory(root,treeish='HEAD'){
  try{if(!isAbsolute(root)||realpathSync(root)!==root||!/^[A-Za-z0-9._/-]{1,128}$/.test(treeish))throw new Error();const rows=execFileSync('git',['rev-list','--objects',treeish],{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:32*1024*1024}).trim().split('\n').filter(Boolean);let blobs=0,exceptions=0;for(const row of rows){const hash=row.slice(0,40),path=row.length>41?row.slice(41):'';if(!/^[a-f0-9]{40}$/.test(hash))throw new Error();if(execFileSync('git',['cat-file','-t',hash],{cwd:root,encoding:'utf8',timeout:5000}).trim()!=='blob')continue;const top=path.split('/')[0];if(!path||forbidden.test(path)||(!sourceFiles.has(path)&&!sourceRoots.has(top)))reject('SOURCE_HISTORY_REJECTED');if(++blobs>200000)reject('SOURCE_HISTORY_REJECTED');const size=Number(execFileSync('git',['cat-file','-s',hash],{cwd:root,encoding:'utf8',timeout:5000}).trim());if(!Number.isSafeInteger(size)||size<0||size>64*1024*1024)reject('SOURCE_HISTORY_REJECTED');const bytes=execFileSync('git',['cat-file','blob',hash],{cwd:root,timeout:5000,maxBuffer:64*1024*1024+1});try{scanBytes(bytes);}catch(error){if(error instanceof Error&&error.message==='SECRET_SCAN_REJECTED'&&isReviewedFixtureException(hash,path)){exceptions++;continue;}throw error;}}return{status:'pass',blobs,exceptions};}catch{reject('SOURCE_HISTORY_REJECTED');}
}

function shaFile(path){return digest(readFileSync(path));}
export function identityOnly({root=repo,prerequisitesPath=join(repo,'release/prerequisites.json')}={}){
  const value=validatePrerequisites(JSON.parse(readFileSync(prerequisitesPath,'utf8'))),trust=JSON.parse(readFileSync(join(root,'release/trust-root.json'),'utf8')),approval=join(root,'release/approval.json');
  if(shaFile(approval)!==value.approvalSha256||trust.fingerprint!==value.fingerprint||trust.approvalSha256!==value.approvalSha256)reject('RELEASE_PREREQUISITES_INVALID');
  const isolated=process.platform==='darwin'?join(homedir(),'Library/Application Support/AutoED-Rebuild-Release/github'):join(process.env.LOCALAPPDATA??'', 'AutoED-Rebuild-Release/github'),env={...process.env,GH_CONFIG_DIR:isolated};
  if((lstatSync(dirname(isolated)).mode&0o777)!==0o700||(lstatSync(isolated).mode&0o777)!==0o700)reject('RELEASE_IDENTITY_MISMATCH');
  const run=(file,args,options={})=>execFileSync(file,args,{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:1024*1024,...options}).trim();
  const isolatedLogin=run('gh',['api','user','--jq','.login'],{env}),globalLogin=run('gh',['api','user','--jq','.login']);let canonical=null;try{canonical=run('gh',['api','repos/returdex/AutoED','--jq','.full_name'],{env});}catch(error){if(error?.status!==1)throw error;}
  const facts={...value.localGit,login:isolatedLogin,repository:{owner:'returdex',name:'AutoED',exists:canonical==='returdex/AutoED',creationReceipt:null}};
  facts.authorName=run('git',['config','--local','user.name']);facts.committerName=facts.authorName;facts.authorEmail=run('git',['config','--local','user.email']);facts.committerEmail=facts.authorEmail;
  if(globalLogin!==value.globalLoginObserved||canonical!==value.repository.canonicalObserved||run('git',['remote'])!==''||isolatedLogin!==value.isolatedLogin)reject('RELEASE_IDENTITY_MISMATCH');assertReleaseIdentity(facts);return Object.freeze({status:'pass',login:isolatedLogin,fingerprint:value.fingerprint,repository:'returdex/AutoED',exactNameExists:false,globalIdentityUnchanged:true});
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{if(process.argv.slice(2).join(' ')!=='--identity-only')reject('RELEASE_ARGUMENT_INVALID');process.stdout.write(JSON.stringify(identityOnly())+'\n');}catch(error){const allowed=new Set(['RELEASE_ARGUMENT_INVALID','RELEASE_PREREQUISITES_INVALID','RELEASE_IDENTITY_MISMATCH','REPOSITORY_CONFLICT']);process.stderr.write((allowed.has(error?.message)?error.message:'RELEASE_PREFLIGHT_FAILED')+'\n');process.exitCode=1;}}
