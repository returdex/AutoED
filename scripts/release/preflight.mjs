import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {lstatSync,readFileSync,readdirSync,realpathSync} from 'node:fs';
import {dirname,join,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';

const repo=join(dirname(fileURLToPath(import.meta.url)),'../..'),allowedNames=new Set(['LICENSE','LICENSING.md']),allowedRoots=new Set(['dist','runtime','browser','public-manifest','bootstrap','docs']),sourceRoots=new Set(['.planning','apps','docs','packages','rebuild-2026-08-26','release','scripts','tests']),sourceFiles=new Set(['.gitignore','AGENTS.md','LICENSE','LICENSING.md','package-lock.json','package.json','playwright.config.ts','tsconfig.json','vitest.config.ts']),forbidden=/(?:^|\/)(?:Profile|Cookies?|.*\.sqlite(?:-wal|-shm)?|\.env(?:\..*)?|logs?|private[-_]?keys?|private[-_]?fixtures?)(?:\/|$)/i,secret=/(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN (?:OPENSSH|EC|RSA|PRIVATE) PRIVATE KEY-----|CANARY_RELEASE_SECRET)/;
const digest=value=>createHash('sha256').update(value).digest('hex');
function reject(code){throw new Error(code);}
function approvedEmail(value){return /^\d+\+returdex@users\.noreply\.github\.com$/.test(value);}

export function assertReleaseIdentity(value){
  if(value?.authorName!=='returdex'||value?.committerName!=='returdex'||!approvedEmail(value.authorEmail)||!approvedEmail(value.committerEmail)||value.login!=='returdex'||value.repository?.owner!=='returdex'||value.repository?.name!=='AutoED')reject('RELEASE_IDENTITY_MISMATCH');
  if(value.repository.exists&&!(value.repository.creationReceipt?.schema===1&&value.repository.creationReceipt?.plan==='01-12'&&value.repository.creationReceipt?.owner==='returdex'&&value.repository.creationReceipt?.name==='AutoED'&&value.repository.creationReceipt?.status==='approved'))reject('REPOSITORY_CONFLICT');
  return Object.freeze({owner:'returdex',repository:'AutoED'});
}
export function assertVersionAvailable(version,existing=[]){const match=/^0\.1\.0-beta\.(\d+)$/.exec(version);if(!match||!Number.isSafeInteger(Number(match[1]))||Number(match[1])<1)reject('VERSION_INVALID');const numbers=existing.map(x=>/^0\.1\.0-beta\.(\d+)$/.exec(x)).filter(Boolean).map(x=>Number(x[1]));if(existing.includes(version)||numbers.some(n=>n>=Number(match[1])))reject('VERSION_ALREADY_EXISTS');return true;}

function scanBytes(bytes){if(bytes.length>64*1024*1024||secret.test(bytes.toString('utf8')))reject('SECRET_SCAN_REJECTED');}
export function scanPublicPackage(root){try{if(!isAbsolute(root)||realpathSync(root)!==root||!lstatSync(root).isDirectory())throw new Error();if(!readFileSync(join(root,'LICENSE')).equals(readFileSync(join(repo,'LICENSE')))||!readFileSync(join(root,'LICENSING.md')).equals(readFileSync(join(repo,'LICENSING.md'))))reject('LICENSE_MISMATCH');let files=0;const walk=(directory,prefix='')=>{for(const entry of readdirSync(directory,{withFileTypes:true})){const rel=prefix+entry.name,path=join(directory,entry.name),stat=lstatSync(path);if(stat.isSymbolicLink()||forbidden.test(rel)||(!prefix&&!allowedNames.has(entry.name)&&!allowedRoots.has(entry.name)))reject('PUBLIC_PACKAGE_REJECTED');if(entry.isDirectory())walk(path,rel+'/');else if(entry.isFile()){if(++files>100000||stat.nlink!==1)reject('PUBLIC_PACKAGE_REJECTED');scanBytes(readFileSync(path));}else reject('PUBLIC_PACKAGE_REJECTED');}};walk(root);return{status:'pass',files};}catch(error){if(error instanceof Error&&['LICENSE_MISMATCH','PUBLIC_PACKAGE_REJECTED','SECRET_SCAN_REJECTED'].includes(error.message))throw error;reject('PUBLIC_PACKAGE_REJECTED');}}

export function scanReachableHistory(root,treeish='HEAD'){
  try{if(!isAbsolute(root)||realpathSync(root)!==root||!/^[A-Za-z0-9._/-]{1,128}$/.test(treeish))throw new Error();const rows=execFileSync('git',['rev-list','--objects',treeish],{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:32*1024*1024}).trim().split('\n').filter(Boolean);let blobs=0;for(const row of rows){const hash=row.slice(0,40),path=row.length>41?row.slice(41):'';if(!/^[a-f0-9]{40}$/.test(hash))throw new Error();if(execFileSync('git',['cat-file','-t',hash],{cwd:root,encoding:'utf8',timeout:5000}).trim()!=='blob')continue;const top=path.split('/')[0];if(!path||forbidden.test(path)||(!sourceFiles.has(path)&&!sourceRoots.has(top)))reject('SOURCE_HISTORY_REJECTED');if(++blobs>200000)reject('SOURCE_HISTORY_REJECTED');const size=Number(execFileSync('git',['cat-file','-s',hash],{cwd:root,encoding:'utf8',timeout:5000}).trim());if(!Number.isSafeInteger(size)||size<0||size>64*1024*1024)reject('SOURCE_HISTORY_REJECTED');scanBytes(execFileSync('git',['cat-file','blob',hash],{cwd:root,timeout:5000,maxBuffer:64*1024*1024+1}));}return{status:'pass',blobs};}catch{reject('SOURCE_HISTORY_REJECTED');}
}
