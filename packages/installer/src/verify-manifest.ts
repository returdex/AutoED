import {createHash,createPublicKey,verify} from 'node:crypto';
import {lstatSync,readFileSync,realpathSync,readdirSync,readlinkSync} from 'node:fs';
import {join,relative,isAbsolute} from 'node:path';
import {z} from 'zod';
import {BuildIdentitySchema} from '../../contracts/src/index.js';
export {LIMITS,safeArtifactPath,validateLinkGraph} from './archive-core.js';
import {LIMITS,safeArtifactPath,validateLinkGraph} from './archive-core.js';
const hash=z.string().regex(/^[a-f0-9]{64}$/);
const path=z.string().refine(safeArtifactPath);
const httpsURL=z.url().max(2048).refine(s=>{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&(!u.port||u.port==='443');});
const file=z.union([
  z.strictObject({path,sha256:hash,bytes:z.number().int().nonnegative().max(512*1024*1024),type:z.literal('file').optional(),executable:z.boolean().optional()}),
  z.strictObject({path,sha256:hash,bytes:z.number().int().positive().max(512),type:z.literal('symlink'),target:z.string().min(1).max(512)}),
]);
const artifact=z.strictObject({name:path.refine(s=>!s.includes('/')),role:z.enum(['program','node','browser','installer']),url:httpsURL,sha256:hash,bytes:z.number().int().positive().max(LIMITS.archiveBytes),format:z.enum(['tar.gz','zip','file']),unpackedBytes:z.number().int().nonnegative().max(LIMITS.unpackedBytes),files:z.array(file).min(1).max(LIMITS.files)}).refine(a=>{
  const names=a.files.map(f=>f.path.toLowerCase()),seen=new Set(names);return seen.size===names.length&&a.files.reduce((n,f)=>n+f.bytes,0)===a.unpackedBytes&&names.every(name=>{const parts=name.split('/');return parts.every((_,i)=>i===parts.length-1||!seen.has(parts.slice(0,i+1).join('/')));});
},'Invalid file closure').refine(a=>a.format!=='tar.gz'||a.unpackedBytes<=LIMITS.tarUnpackedBytes,'USTAR decoded size limit');
const result=z.enum(['pass','fail','not_run','human_needed']);
export const ReleaseManifestSchema=z.strictObject({
  schema:z.literal(1),product:z.literal('autoed-rebuild'),build:BuildIdentitySchema,
  target:z.strictObject({os:z.enum(['darwin','win32']),arch:z.enum(['arm64','x64']),minVersion:z.string().regex(/^\d+\.\d+\.\d+$/)}),
  dependencies:z.strictObject({node:z.literal('24.20.0'),playwright:z.literal('1.62.1'),browserRevision:z.literal('1234'),browserVersion:z.literal('151.0.7922.34')}),
  artifacts:z.array(artifact).min(1).max(LIMITS.artifacts),
  dependencySources:z.array(z.strictObject({name:z.string().min(1).max(128),version:z.string().min(1).max(64),url:httpsURL,integrity:z.string().regex(/^(?:sha256-[a-f0-9]{64}|sha512-[A-Za-z0-9+/]+={0,2})$/)})).min(1).max(1000),
  tests:z.strictObject({synthetic:result,integration:result,macosNative:result,windowsNative:result,human:result}),
}).refine(m=>((m.target.os==='darwin'&&m.target.arch==='arm64')||(m.target.os==='win32'&&m.target.arch==='x64'))&&new Set(m.artifacts.map(a=>a.name.toLowerCase())).size===m.artifacts.length&&m.artifacts.reduce((n,a)=>n+a.unpackedBytes,0)<=LIMITS.unpackedBytes&&m.artifacts.reduce((n,a)=>n+a.files.length,0)<=LIMITS.files,'Unsupported target or duplicate artifact').refine(m=>{try{for(const artifact of m.artifacts)validateLinkGraph(artifact.files,m.target.os==='darwin'&&artifact.role==='browser');return true;}catch{return false;}},'Invalid link graph');
export type ReleaseManifest=z.infer<typeof ReleaseManifestSchema>;
export interface VerificationTarget {os:'darwin'|'win32';arch:'arm64'|'x64';version:string;schema:number;protocol:number;currentVersion?:string}
export interface VerifiedManifest {readonly manifest:ReleaseManifest;readonly manifestHash:string;readonly keyFingerprint:string;readonly evidence:'synthetic_signature'|'verified_release_manifest'}
const verifiedObjects=new WeakSet<object>();
export function isVerifiedManifest(value:unknown):value is VerifiedManifest{return typeof value==='object'&&value!==null&&verifiedObjects.has(value);}
function digest(bytes:Buffer){return createHash('sha256').update(bytes).digest('hex');}
function compare(a:string,b:string){const version=(s:string)=>{const match=/^(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/.exec(s);if(!match)throw new Error('INCOMPATIBLE');return [Number(match[1]),Number(match[2]),Number(match[3]),match[4]===undefined?Number.MAX_SAFE_INTEGER:Number(match[4])];};const left=version(a),right=version(b);for(let i=0;i<4;i++)if(left[i]!==right[i])return left[i]!>right[i]!?1:-1;return 0;}
function freeze<T>(value:T):T{if(value&&typeof value==='object'){for(const item of Object.values(value))freeze(item);Object.freeze(value);}return value;}
function verifier(publicKey:string,fingerprint:string,evidence:VerifiedManifest['evidence']){
  const key=createPublicKey(publicKey);if(key.asymmetricKeyType!=='ed25519'||digest(key.export({type:'spki',format:'der'}))!==hash.parse(fingerprint))throw new Error('TRUST_ROOT_INVALID');
  return (bytes:Buffer,signature:Buffer,target:VerificationTarget):VerifiedManifest=>{
    if(!Buffer.isBuffer(bytes)||bytes.length>LIMITS.manifestBytes||!Buffer.isBuffer(signature)||signature.length!==64||!verify(null,bytes,key,signature))throw new Error('SIGNATURE_INVALID');
    let manifest:ReleaseManifest;try{manifest=ReleaseManifestSchema.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));}catch{throw new Error('MANIFEST_INVALID');}
    if(manifest.target.os!==target.os||manifest.target.arch!==target.arch||compare(target.version,manifest.target.minVersion)<0||target.schema<manifest.build.schemaMin||target.schema>manifest.build.schemaMax||target.protocol!==manifest.build.protocol)throw new Error('INCOMPATIBLE');
    if(target.currentVersion&&compare(manifest.build.version,target.currentVersion)<0)throw new Error('DOWNGRADE_REQUIRES_REVIEW');
    const result=freeze({manifest,manifestHash:digest(bytes),keyFingerprint:fingerprint,evidence});verifiedObjects.add(result);return result;
  };
}
/** Only synthetic test composition may select this root. No production CLI flag accepts a key. */
export function createFixtureVerifier(publicKey:string,fingerprint:string){return verifier(publicKey,fingerprint,'synthetic_signature');}
/** Plan 12 must establish a separately approved fixed release root. Never trust a downloaded self-supplied key. */
export function verifyRelease(_bytes:Buffer,_signature:Buffer,_target:VerificationTarget):VerifiedManifest{throw new Error('RELEASE_TRUST_NOT_ESTABLISHED');}
function selected(value:VerifiedManifest,name:string){if(!isVerifiedManifest(value))throw new Error('VERIFIED_MANIFEST_REQUIRED');const artifact=value.manifest.artifacts.find(a=>a.name===name);if(!artifact)throw new Error('ARTIFACT_NOT_LISTED');return artifact;}
export function verifyArtifactBytes(value:VerifiedManifest,name:string,bytes:Buffer){const artifact=selected(value,name);if(bytes.length!==artifact.bytes||digest(bytes)!==artifact.sha256)throw new Error('ARTIFACT_INTEGRITY');return artifact;}
/** Caller selects a previously empty owned extraction root; every listed regular file is re-read. */
export function verifyFileTree(value:VerifiedManifest,name:string,root:string){
  const artifact=selected(value,name);try{
    if(!isAbsolute(root)||realpathSync(root)!==root||!lstatSync(root).isDirectory())throw new Error();
    const expected=new Map(artifact.files.map(f=>[f.path,f])),directories=new Set<string>();let count=0;
    for(const file of artifact.files){const parts=file.path.split('/');for(let i=1;i<parts.length;i++)directories.add(parts.slice(0,i).join('/'));}
    const walk=(directory:string,prefix='')=>{for(const entry of readdirSync(directory,{withFileTypes:true})){const path=prefix+entry.name;if(!safeArtifactPath(path))throw new Error();if(entry.isDirectory()){if(!directories.has(path))throw new Error();walk(join(directory,entry.name),path+'/');}else if(!expected.has(path)||entry.isSymbolicLink()!==(expected.get(path)!.type==='symlink')||!entry.isSymbolicLink()&&!entry.isFile()||++count>artifact.files.length)throw new Error();}};walk(root);if(count!==artifact.files.length)throw new Error();
    for(const file of artifact.files){const path=join(root,file.path);const rel=relative(root,path);if(rel.startsWith('..')||isAbsolute(rel))throw new Error();const st=lstatSync(path);if(file.type==='symlink'){const target=readlinkSync(path);if(!st.isSymbolicLink()||target!==file.target||Buffer.byteLength(target)!==file.bytes||digest(Buffer.from(target))!==file.sha256)throw new Error();}else if(realpathSync(path)!==path||!st.isFile()||st.isSymbolicLink()||st.nlink!==1||st.size!==file.bytes||digest(readFileSync(path))!==file.sha256)throw new Error();}
  }catch{throw new Error('FILE_INTEGRITY');}
}
