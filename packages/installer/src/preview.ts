import {createHash,randomUUID} from 'node:crypto';
import {existsSync,lstatSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {preflightRoot,assertManagedPath,managedPaths,type RootSelection} from '../../platform/src/paths.js';
import {readInstallation} from '../../platform/src/installation.js';
import {windowsProbe} from '../../platform/src/permissions.js';
import {isVerifiedManifest,assertNoDowngrade,type VerifiedManifest} from './verify-manifest.js';
import {readActive} from './launchers.js';
const digest=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const previews=new WeakMap<object,{manifest:VerifiedManifest;snapshot:string}>(),confirmations=new WeakMap<object,object>();
function freeze<T>(value:T):T{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function snapshot(selection:RootSelection){
  preflightRoot(selection);if(/[\x00-\x1f\x7f]/.test(selection.root+selection.parent))throw new Error('UNSAFE_PATH');const parent=lstatSync(selection.parent);
  const acl=process.platform==='darwin'?execFileSync('/bin/ls',['-lde',selection.parent],{encoding:'utf8',timeout:5000,stdio:['ignore','pipe','ignore']}).split('\n').filter(line=>/^\s*\d+:/.test(line)).join('\n'):JSON.stringify(windowsProbe('(Get-Acl -LiteralPath $p.path).Sddl|ConvertTo-Json -Compress',{path:selection.parent}));
  if(process.platform==='darwin'&&/^\s*\d+:.* allow .*(?:write|add_|delete)/m.test(acl))throw new Error('INSECURE_PERMISSIONS');
  const root=existsSync(selection.root)?lstatSync(selection.root):null;const metadata=root?readInstallation(selection):null;
  const records=root?['active.json','runtime/api.json','runtime/worker.json','runtime/api.launch/intent.json','runtime/worker.launch/intent.json'].map(name=>{const path=assertManagedPath(managedPaths(selection.root),name);if(!existsSync(path))return [name,null];const s=lstatSync(path);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>65536)throw new Error('INVENTORY_UNCONFIRMED');return [name,digest(readFileSync(path))];}):[];
  return JSON.stringify({parent:{dev:parent.dev,ino:parent.ino,uid:parent.uid,mode:parent.mode,acl:digest(acl)},root:root?{dev:root.dev,ino:root.ino,uid:root.uid,mode:root.mode,id:metadata!.installationId}:null,records});
}
export interface InstallPreview {
  installationId:string;scopeHash:string;manifestHash:string;target:VerifiedManifest['manifest']['build'];current:VerifiedManifest['manifest']['build']|null;
  selection:RootSelection;paths:{program:string;runtime:string;browser:string;data:string;staging:string;bin:string};
  platform:{os:string;arch:string;minVersion:string};dependencies:VerifiedManifest['manifest']['dependencies'];downloadBytes:number;unpackedBytes:number;
  artifacts:{name:string;role:string;downloadBytes:number;unpackedBytes:number}[];
  permissions:'private-current-user';autostart:false;hostConfiguration:'unchanged';previousInstallation:'none'|'present';
  processImpact:'none_at_selected_root'|'authenticated_inventory_required';downtime:'not_started'|'maintenance_required';retainData:true;recoverability:'initialization_receipt_then_journal_required';
}
export interface InstallConfirmation {scopeHash:string;confirmationId:string}
export function createInstallPreview(manifest:VerifiedManifest,selection:RootSelection):InstallPreview{
  if(!isVerifiedManifest(manifest))throw new Error('VERIFIED_MANIFEST_REQUIRED');const observed=snapshot(selection),existing=existsSync(selection.root)?readInstallation(selection):null;
  if(manifest.manifest.target.os!==process.platform||manifest.manifest.target.arch!==process.arch)throw new Error('INCOMPATIBLE');
  const m=manifest.manifest,installationId=existing?.installationId??randomUUID();const active=existing&&existsSync(join(selection.root,'active.json'))?readActive(selection):null;
  if(active)assertNoDowngrade(m.build.version,active.build.version);
  const value={installationId,manifestHash:manifest.manifestHash,target:m.build,current:active?.build??null,selection:{root:selection.root,parent:selection.parent,excludedRoots:[...selection.excludedRoots].sort()},paths:{program:join(selection.root,'program',m.build.buildId),runtime:join(selection.root,'runtime',m.dependencies.node),browser:join(selection.root,'browser',m.dependencies.browserRevision),data:join(selection.root,'data'),staging:join(selection.root,'installer-staging'),bin:join(selection.root,'bin')},platform:m.target,dependencies:m.dependencies,artifacts:m.artifacts.map(a=>({name:a.name,role:a.role,downloadBytes:a.bytes,unpackedBytes:a.unpackedBytes})),downloadBytes:m.artifacts.reduce((n,a)=>n+a.bytes,0),unpackedBytes:m.artifacts.reduce((n,a)=>n+a.unpackedBytes,0),permissions:'private-current-user' as const,autostart:false as const,hostConfiguration:'unchanged' as const,previousInstallation:existing?'present' as const:'none' as const,processImpact:existing?'authenticated_inventory_required' as const:'none_at_selected_root' as const,downtime:existing?'maintenance_required' as const:'not_started' as const,retainData:true as const,recoverability:'initialization_receipt_then_journal_required' as const};
  const result=freeze({...value,scopeHash:digest(JSON.stringify({value,snapshot:observed}))});previews.set(result,{manifest,snapshot:observed});return result;
}
export function confirmInstallPreview(preview:InstallPreview,answer:string):InstallConfirmation{
  if(!previews.has(preview)||answer!=='INSTALL '+preview.scopeHash)throw new Error('CONFIRMATION_REQUIRED');const result=Object.freeze({scopeHash:preview.scopeHash,confirmationId:randomUUID()});confirmations.set(result,preview);return result;
}
export function approvedManifest(preview:InstallPreview,confirmation:InstallConfirmation,checkSnapshot=true):VerifiedManifest{
  const context=previews.get(preview);if(!context||confirmations.get(confirmation)!==preview||confirmation.scopeHash!==preview.scopeHash)throw new Error('CONFIRMATION_REQUIRED');
  if(checkSnapshot){try{if(snapshot(preview.selection)!==context.snapshot)throw new Error();}catch{throw new Error('REPREVIEW_REQUIRED');}}
  return context.manifest;
}
