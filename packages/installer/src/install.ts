import {existsSync,lstatSync,readFileSync,mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline/promises';
import {randomUUID} from 'node:crypto';
import type {SecretStore} from '../../application/src/ports.js';
import {initializeInstallation,readInstallation} from '../../platform/src/installation.js';
import {NativeSecretStore} from '../../platform/src/credentials.js';
import {defaultRoot,preflightRoot,assertSafeAncestors} from '../../platform/src/paths.js';
import {protectPath,verifyProtectedPath} from '../../platform/src/permissions.js';
import {detectPlatform} from '../../platform/src/platform.js';
import {presentInstall} from '../../contracts/src/presentation.js';
import {approvedManifest,createInstallPreview,confirmInstallPreview,type InstallPreview,type InstallConfirmation} from './preview.js';
import {verifyRelease,verifyArtifactBytes,verifyFileTree,type VerifiedManifest} from './verify-manifest.js';
import {downloadArtifact,extractVerifiedArchive} from './download.js';
import {publishLaunchers,assertOwnedLaunchers,writeInstallerRecord,launcherRegistration} from './launchers.js';
import {upgradeConfirmed} from './upgrade.js';
import {cleanupManaged,cleanupRuntimeInventory} from './cleanup.js';
import {assertManagedPath,managedPaths} from '../../platform/src/paths.js';
import {pendingCleanupRecovery,recoverUpgrade} from './recovery.js';
export async function installConfirmed(preview:InstallPreview,confirmation:InstallConfirmation,options:{store?:SecretStore;archives:Record<string,Buffer>}){
  const manifest=approvedManifest(preview,confirmation,false),selection=preview.selection,parts=manifest.manifest.artifacts.filter(a=>a.role!=='installer');
  if(parts.length!==3||['program','node','browser'].some(role=>parts.filter(a=>a.role===role).length!==1)||Object.keys(options.archives).sort().join(',')!==parts.map(a=>a.name).sort().join(','))throw new Error('ARTIFACT_LAYOUT_INVALID');
  for(const artifact of parts)verifyArtifactBytes(manifest,artifact.name,options.archives[artifact.name]!);
  if(existsSync(selection.root)){
    const metadata=readInstallation(selection);if(metadata.installationId!==preview.installationId)throw new Error('INSTALLATION_MISMATCH');
    if(!existsSync(join(selection.root,'active.json')))throw new Error('INSTALLATION_RECOVERY_REQUIRED');const active=assertOwnedLaunchers(selection);
    if(active.scopeHash!==preview.scopeHash||active.manifestHash!==preview.manifestHash)throw new Error('UPGRADE_ENGINE_REQUIRED');
    for(const a of parts)verifyFileTree(manifest,a.name,a.role==='program'?preview.paths.program:a.role==='node'?preview.paths.runtime:preview.paths.browser);
    return staged(preview);
  }
  approvedManifest(preview,confirmation);await initializeInstallation(selection,options.store??new NativeSecretStore(),preview.installationId);
  writeInstallerRecord(join(preview.paths.staging,'approved-preview.json'),{schema:1,installationId:preview.installationId,scopeHash:preview.scopeHash,manifestHash:preview.manifestHash,state:'approved_staging',paths:preview.paths});
  for(const a of parts){const root=a.role==='program'?preview.paths.program:a.role==='node'?preview.paths.runtime:preview.paths.browser;if(existsSync(root))throw new Error('ENTRY_OWNERSHIP_UNCONFIRMED');mkdirSync(root,{mode:0o700});protectPath(root);await extractVerifiedArchive(manifest,a.name,options.archives[a.name]!,root);}
  publishLaunchers(preview,manifest);return staged(preview);
}
function staged(preview:InstallPreview){const checkedAt=new Date().toISOString();return {state:'staged' as const,installationId:preview.installationId,scopeHash:preview.scopeHash,registration:launcherRegistration(preview.selection),nextAction:'安装流程仍需执行实际启动、自检及清理；此结果不是安装或升级完成。',feedback:presentInstall({api:null,worker:null,selfcheck:null,install:{previousInstallation:preview.previousInstallation,stage:'stage',result:'running',targetBuild:preview.target,actualBuild:null,cleanup:'not_observed',checkedAt}})};}
interface InstallerDependencies {verify?:typeof verifyRelease;store?:SecretStore;acquire?:(manifest:VerifiedManifest,stagingParent:string)=>Promise<Record<string,Buffer>>;execute?:typeof upgradeConfirmed;recover?:typeof recoverUpgrade}
function protectedInput(path:string,maximum:number){assertSafeAncestors(path);verifyProtectedPath(path);const stat=lstatSync(path);if(!stat.isFile()||stat.nlink!==1||stat.size>maximum)throw new Error('MANIFEST_INVALID');return readFileSync(path);}
/** Trusted composition parameters are not CLI arguments or model inputs. */
export async function runInstallerCLI(dependencies:InstallerDependencies={},args=process.argv.slice(2)){
  if(args.length!==5&&args.length!==7||args[0]!=='--preview'||args[1]!=='--manifest'||args[3]!=='--signature'||args.length===7&&args[5]!=='--root')throw new Error('INVALID_ARGUMENT');
  const manifestPath=args[2]!,signaturePath=args[4]!,stagingParent=dirname(manifestPath);if(dirname(signaturePath)!==stagingParent)throw new Error('UNSAFE_STAGING');preflightRoot({root:stagingParent,parent:dirname(stagingParent),excludedRoots:[]});verifyProtectedPath(stagingParent);
  const platform=detectPlatform(),manifest=(dependencies.verify??verifyRelease)(protectedInput(manifestPath,8*1024*1024),protectedInput(signaturePath,64),{os:platform.platform as 'darwin'|'win32',arch:platform.arch as 'arm64'|'x64',version:platform.version,schema:1,protocol:1});
  const lines=createInterface({input:process.stdin,output:process.stderr});try{
    const root=args[6]??await lines.question(`安装根目录候选：${defaultRoot()}。请输入要预览的完整目录；空白取消：\n`);if(!root)throw new Error('CONFIRMATION_REQUIRED');const preview=createInstallPreview(manifest,{root,parent:dirname(root),excludedRoots:[]});process.stdout.write(JSON.stringify({type:'install_preview',preview})+'\n');
    const answer=await lines.question(`请检查上述路径、依赖和影响。仅输入 INSTALL ${preview.scopeHash} 确认本次范围；其他输入取消：\n`),confirmation=confirmInstallPreview(preview,answer);
    if(preview.previousInstallation==='present'){const operationId=pendingCleanupRecovery(preview.selection);if(operationId){const result=await (dependencies.recover??recoverUpgrade)(preview.selection,operationId,{verify:dependencies.verify??verifyRelease,secrets:dependencies.store??new NativeSecretStore()}),restored={type:'install_result' as const,state:'restored' as const,...result,nextAction:'重新运行同一个已验证的安装引导程序以开始全新的升级。'};process.stdout.write(JSON.stringify(restored)+'\n');return restored;}}
    const acquire=dependencies.acquire??(async(v:VerifiedManifest,parent:string)=>{const root=join(parent,'downloads-'+randomUUID());mkdirSync(root,{mode:0o700});protectPath(root);const archives:Record<string,Buffer>={};for(const a of v.manifest.artifacts.filter(a=>a.role!=='installer'))archives[a.name]=readFileSync(await downloadArtifact(v,a.name,root));return archives;});
    const archives=await acquire(manifest,stagingParent);let oldManifest:VerifiedManifest|undefined;if(preview.previousInstallation==='present'){const active=assertOwnedLaunchers(preview.selection),paths=managedPaths(preview.selection.root),base=`installer-staging/manifests/${active.build.buildId}`;oldManifest=(dependencies.verify??verifyRelease)(protectedInput(assertManagedPath(paths,base+'/manifest.json'),8*1024*1024),protectedInput(assertManagedPath(paths,base+'/manifest.sig'),64),{os:platform.platform as 'darwin'|'win32',arch:platform.arch as 'arm64'|'x64',version:platform.version,schema:1,protocol:1});if(oldManifest.manifestHash!==active.manifestHash)throw new Error('OLD_ARTIFACT_UNVERIFIED');}
    const execute=dependencies.execute??upgradeConfirmed,result=await execute(preview,confirmation,{archives,...(oldManifest?{oldManifest}:{}),...(dependencies.store?{store:dependencies.store}:{}),cleanup:async context=>context.oldManifest?cleanupManaged({selection:context.selection,operationId:context.journal.header.operationId,currentManifest:context.manifest,oldManifest:context.oldManifest}):cleanupRuntimeInventory(context.selection).then(()=>({complete:true})).catch(()=>({complete:false,code:'CLEANUP_PENDING'}))});process.stdout.write(JSON.stringify({type:'install_result',...result})+'\n');return result;
  }finally{lines.close();}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])void runInstallerCLI().catch(error=>{const code=error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'INSTALLATION_FAILED';process.stderr.write(code+'\n');process.exitCode=1;});
