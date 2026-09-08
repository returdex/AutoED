#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chmodSync,existsSync,lstatSync,mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkPackage,NODE_VERSION,RELEASE_FINGERPRINTS,TOOLCHAIN,runtimeArchiveTool,runtimeGitTool,runtimeGithubTool,runtimeProcessObserver} from '../dev/runtime.mjs';
import {phase2IdentityOnly} from './preflight.mjs';
import {selfcheckTrust} from './trust.mjs';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const sha=value=>createHash('sha256').update(value).digest('hex');
const expected=Object.freeze({owner:'returdex',repository:'returdex/AutoED',repositoryId:1350421724,githubHost:'github.com',githubConfigMode:'isolated',keyringService:'AutoED-Rebuild-Release',keyringAccount:'release-ed25519-private-v1',nodeVersion:NODE_VERSION,npmVersion:'11.19.0'});
function fail(){throw new Error('RELEASE_ENVIRONMENT_INVALID');}
function protectedDirectory(path){const stat=lstatSync(path);if(!stat.isDirectory()||stat.isSymbolicLink()||stat.uid!==process.getuid()||(stat.mode&0o077)!==0)fail();}
function requiredPaths(root){return[
  join(TOOLCHAIN,'verification.json'),join(TOOLCHAIN,`node-v${NODE_VERSION}-darwin-arm64.tar.gz`),join(TOOLCHAIN,'SHASUMS256.txt'),join(TOOLCHAIN,'SHASUMS256.txt.sig'),join(TOOLCHAIN,'verifier/openpgp-6.3.1.tgz'),...RELEASE_FINGERPRINTS.map(fingerprint=>join(TOOLCHAIN,`${fingerprint}.asc`)),
  join(root,'.runtime/delivery-cache/node-darwin-arm64.tar.gz'),join(root,'.runtime/delivery-cache/node-win-x64.zip'),
  join(root,'.runtime/delivery-cache/chrome-mac-arm64.zip'),join(root,'.runtime/delivery-cache/chrome-win64.zip'),
  join(root,'.runtime/delivery-cache/keyring-win32-x64-msvc-1.3.0.tgz'),
  join(root,'.runtime/delivery-cache/extracted/mac-node/node-v24.20.0-darwin-arm64/bin/node'),
  join(root,'.runtime/delivery-cache/extracted/win-node/node-v24.20.0-win-x64/node.exe'),
  join(root,'.runtime/delivery-cache/extracted/mac-browser/chrome-mac-arm64'),
  join(root,'.runtime/delivery-cache/extracted/win-browser/chrome-win64'),
  join(root,'.runtime/delivery-cache/extracted/win-keyring/package'),
];}
export function releaseEnvironmentConfig({root=repo}={}){
  const githubConfigDir=process.platform==='darwin'?join(homedir(),'Library/Application Support/AutoED-Rebuild-Release/github'):join(process.env.LOCALAPPDATA??'','AutoED-Rebuild-Release/github'),managedNode=join(TOOLCHAIN,`node-v${NODE_VERSION}-${process.platform==='darwin'?'darwin-arm64':'win-x64'}`,process.platform==='win32'?'node.exe':'bin/node'),paths=requiredPaths(root),gitTool=runtimeGitTool(),githubTool=runtimeGithubTool(),processObserver=runtimeProcessObserver();
  if(!paths.every(existsSync)||!existsSync(managedNode)||!existsSync(githubConfigDir))fail();protectedDirectory(dirname(githubConfigDir));protectedDirectory(githubConfigDir);
  const gitVersion=execFileSync(gitTool,['--version'],{encoding:'utf8',timeout:5000,stdio:['ignore','pipe','ignore']}).trim(),githubVersion=execFileSync(githubTool,['--version'],{encoding:'utf8',timeout:5000,stdio:['ignore','pipe','ignore']}).split('\n')[0].trim();
  return Object.freeze({schema:1,...expected,githubConfigDir,managedNode,archiveTool:runtimeArchiveTool(),gitTool,gitVersion,githubTool,githubVersion,processObserver,deliveryCache:join(root,'.runtime/delivery-cache'),dependencyCount:paths.length,packageSha256:sha(readFileSync(join(root,'package.json'))),lockSha256:sha(readFileSync(join(root,'package-lock.json'))),platformMatrixSha256:sha(readFileSync(join(root,'scripts/build/platform-matrix.json')))});
}
export function writeReleaseEnvironmentConfig(value,{root=repo}={}){
  const runtime=join(root,'.runtime');if(!existsSync(runtime))mkdirSync(runtime,{mode:0o700});if(lstatSync(runtime).isSymbolicLink()||!lstatSync(runtime).isDirectory())fail();const path=join(runtime,'release-environment.json'),temporary=path+'.tmp';
  try{if(existsSync(temporary))fail();writeFileSync(temporary,JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});chmodSync(temporary,0o600);renameSync(temporary,path);chmodSync(path,0o600);return path;}catch(error){if(error instanceof Error&&error.message==='RELEASE_ENVIRONMENT_INVALID')throw error;fail();}
}
export async function preflightReleaseEnvironment({root=repo,write=true}={}){
  try{checkPackage();const config=releaseEnvironmentConfig({root});if(process.version!==`v${config.nodeVersion}`||resolve(process.execPath)!==resolve(config.managedNode))fail();const identity=phase2IdentityOnly({root}),trust=await selfcheckTrust({publicPath:join(root,'release/trust-root.json'),receiptPath:join(root,'release/approval.json')});if(identity.owner!==config.owner||identity.repository!==config.repository||identity.repositoryId!==config.repositoryId||trust.fingerprint!==identity.fingerprint)fail();if(write)writeReleaseEnvironmentConfig(config,{root});return Object.freeze({status:'pass',owner:config.owner,repository:config.repository,runtime:`node-${config.nodeVersion}`,dependencies:config.dependencyCount,keyring:'pass',githubConfig:'isolated'});}catch(error){if(error instanceof Error&&['RELEASE_IDENTITY_MISMATCH','RELEASE_KEY_STORE_UNAVAILABLE','RELEASE_KEY_UNAVAILABLE','RELEASE_KEY_MISMATCH','RELEASE_TRUST_INVALID','RELEASE_APPROVAL_MISMATCH'].includes(error.message))throw error;fail();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))preflightReleaseEnvironment().then(value=>process.stdout.write(JSON.stringify(value)+'\n')).catch(error=>{process.stderr.write(`${error?.message??'RELEASE_ENVIRONMENT_INVALID'}\n`);process.exitCode=1;});
