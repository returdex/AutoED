/** Shared bootstrap/runtime archive checks. Runtime dependencies must remain node:* only. */
import {lookup} from 'node:dns/promises';
import {request as httpsRequest} from 'node:https';
import {isIPv4} from 'node:net';
import {createHash,createPublicKey,verify} from 'node:crypto';
import {gunzipSync,inflateRawSync,crc32} from 'node:zlib';
import {posix,join} from 'node:path';
import {lstatSync,realpathSync,readdirSync,statfsSync,openSync,closeSync,fsyncSync,writeFileSync,mkdirSync,symlinkSync,chmodSync,readFileSync,readlinkSync,writeSync,fstatSync,unlinkSync} from 'node:fs';
export const LIMITS=Object.freeze({manifestBytes:8*1024*1024,archiveBytes:2*1024*1024*1024,unpackedBytes:8*1024*1024*1024,tarUnpackedBytes:512*1024*1024,files:100000,links:256,artifacts:8});
export type ArchiveFile={path:string;sha256:string;bytes:number;type?:'file'|undefined;executable?:boolean|undefined}|{path:string;sha256:string;bytes:number;type:'symlink';target:string};
const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
export function safeArtifactPath(path:string):boolean {
  return path.length<=512&&!path.startsWith('/')&&!path.endsWith('/')&&path.split('/').every(p=>/^[A-Za-z0-9@_+ ().-]+$/.test(p)&&p.trim()===p&&p!=='.'&&p!=='..'&&!p.endsWith('.')&&!/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(p));
}
export function validateLinkGraph(files:ArchiveFile[],allowed:boolean){
  const nodes=new Set(files.map(f=>f.path)),directories=new Set<string>(),links=new Map(files.filter(f=>f.type==='symlink').map(f=>[f.path,f.target]));
  if(links.size>LIMITS.links)throw new Error('LINK_LIMIT');
  for(const f of files){const parts=f.path.split('/');for(let i=1;i<parts.length;i++)directories.add(parts.slice(0,i).join('/'));}
  if(!allowed&&links.size)throw new Error('LINK_DENIED');
  for(const f of files)if(f.type==='symlink'&&(Buffer.byteLength(f.target)!==f.bytes||digest(Buffer.from(f.target))!==f.sha256))throw new Error('LINK_DENIED');
  for(const [path,target]of links){
    if(!safeArtifactPath(target))throw new Error('LINK_DENIED');
    let resolved=posix.normalize(posix.join(posix.dirname(path),target));const visited=new Set<string>();
    for(let count=0;;count++){
      if(count>links.size||!safeArtifactPath(resolved)||visited.has(resolved))throw new Error('LINK_DENIED');visited.add(resolved);
      const parts=resolved.split('/');let changed=false;
      for(let i=1;i<=parts.length;i++){const prefix=parts.slice(0,i).join('/'),next=links.get(prefix);if(next!==undefined){resolved=posix.normalize(posix.join(posix.dirname(prefix),next,...parts.slice(i)));changed=true;break;}}
      if(!changed){if(!nodes.has(resolved)&&!directories.has(resolved)||directories.has(resolved)&&[...links.keys()].some(link=>link.startsWith(resolved+'/')))throw new Error('LINK_DENIED');break;}
    }
  }
}
export type Entry={path:string;kind:'file'|'symlink'|'directory';size:number;read:()=>Buffer};
function zipText(bytes:Buffer){if(bytes.includes(0))throw new Error('ARCHIVE_INVALID');return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
function text(bytes:Buffer){const end=bytes.indexOf(0);return new TextDecoder('utf-8',{fatal:true}).decode(end<0?bytes:bytes.subarray(0,end));}
function octal(bytes:Buffer){const s=text(bytes).trim();if(!/^[0-7]+$/.test(s))throw new Error('ARCHIVE_INVALID');return parseInt(s,8);}
export function tarEntries(archive:Buffer,budget:number):Entry[]{
  if(budget>512*1024*1024)throw new Error('ARCHIVE_LIMIT');const bytes=gunzipSync(archive,{maxOutputLength:budget+LIMITS.files*1024+1024});const entries:Entry[]=[];let p=0,end=false;
  while(p+512<=bytes.length){const h=bytes.subarray(p,p+512);if(h.every(b=>b===0)){end=true;break;}if(text(h.subarray(257,263))!=='ustar')throw new Error('ARCHIVE_INVALID');const sum=h.reduce((n,b,i)=>n+(i>=148&&i<156?32:b),0);if(sum!==octal(h.subarray(148,156)))throw new Error('ARCHIVE_INVALID');
    const prefix=text(h.subarray(345,500)),name=text(h.subarray(0,100)),path=prefix?prefix+'/'+name:name,size=octal(h.subarray(124,136)),type=h[156];if(size>512*1024*1024||p+512+size>bytes.length||entries.length>=LIMITS.files)throw new Error('ARCHIVE_LIMIT');
    const data=bytes.subarray(p+512,p+512+size);if(type===48||type===0)entries.push({path,kind:'file',size,read:()=>data});else if(type===50){if(size!==0)throw new Error('ARCHIVE_INVALID');const link=Buffer.from(text(h.subarray(157,257)));entries.push({path,kind:'symlink',size:link.length,read:()=>link});}else if(type===53&&size===0)entries.push({path:path.replace(/\/$/,''),kind:'directory',size:0,read:()=>Buffer.alloc(0)});else throw new Error('ARCHIVE_TYPE_DENIED');p+=512+Math.ceil(size/512)*512;
  }
  if(!end||p+1024>bytes.length||!bytes.subarray(p).every(b=>b===0))throw new Error('ARCHIVE_INVALID');return entries;
}
export function zipEntries(bytes:Buffer):Entry[]{
  let end=-1;for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(bytes.readUInt32LE(p)===0x06054b50){end=p;break;}
  if(end<0||bytes.readUInt16LE(end+4)||bytes.readUInt16LE(end+6)||end+22+bytes.readUInt16LE(end+20)!==bytes.length)throw new Error('ARCHIVE_INVALID');
  const count=bytes.readUInt16LE(end+10),size=bytes.readUInt32LE(end+12),start=bytes.readUInt32LE(end+16);if(count!==bytes.readUInt16LE(end+8)||count===65535||start+size!==end)throw new Error('ARCHIVE_INVALID');const entries:Entry[]=[];let p=start,lastEnd=0;
  for(let i=0;i<count;i++){
    if(p+46>end||bytes.readUInt32LE(p)!==0x02014b50)throw new Error('ARCHIVE_INVALID');const flags=bytes.readUInt16LE(p+8),method=bytes.readUInt16LE(p+10),crc=bytes.readUInt32LE(p+16),compressed=bytes.readUInt32LE(p+20),unpacked=bytes.readUInt32LE(p+24),nameLength=bytes.readUInt16LE(p+28),extra=bytes.readUInt16LE(p+30),comment=bytes.readUInt16LE(p+32),attributes=bytes.readUInt32LE(p+38),offset=bytes.readUInt32LE(p+42);if(flags&~0x808||![0,8].includes(method)||unpacked>512*1024*1024||compressed===0xffffffff||offset===0xffffffff||bytes.readUInt16LE(p+34)||p+46+nameLength+extra+comment>end)throw new Error('ARCHIVE_TYPE_DENIED');
    const path=zipText(bytes.subarray(p+46,p+46+nameLength));if(path.includes('\0')||offset<lastEnd||offset+30>start||bytes.readUInt32LE(offset)!==0x04034b50||bytes.readUInt16LE(offset+6)!==flags||bytes.readUInt16LE(offset+8)!==method)throw new Error('ARCHIVE_INVALID');const localName=bytes.readUInt16LE(offset+26),localExtra=bytes.readUInt16LE(offset+28);if(zipText(bytes.subarray(offset+30,offset+30+localName))!==path)throw new Error('ARCHIVE_INVALID');
    const dataStart=offset+30+localName+localExtra,dataEnd=dataStart+compressed;if(dataEnd>start)throw new Error('ARCHIVE_INVALID');lastEnd=dataEnd;
    if(!(flags&8)&&(bytes.readUInt32LE(offset+14)!==crc||bytes.readUInt32LE(offset+18)!==compressed||bytes.readUInt32LE(offset+22)!==unpacked))throw new Error('ARCHIVE_INVALID');
    const mode=(attributes>>>16)&0xf000,kind=mode===0xa000?'symlink':path.endsWith('/')?'directory':'file';if(mode&&![0x8000,0x4000,0xa000].includes(mode)||kind==='directory'&&unpacked!==0)throw new Error('ARCHIVE_TYPE_DENIED');
    entries.push({path:kind==='directory'?path.slice(0,-1):path,kind,size:unpacked,read:()=>{const data=method===0?bytes.subarray(dataStart,dataEnd):inflateRawSync(bytes.subarray(dataStart,dataEnd),{maxOutputLength:Math.max(1,unpacked)});if(data.length!==unpacked||crc32(data)!==crc)throw new Error('ARCHIVE_INVALID');return data;}});p+=46+nameLength+extra+comment;
  }if(p!==end)throw new Error('ARCHIVE_INVALID');return entries;
}

export interface ArchiveDescriptor {role:string;sha256:string;bytes:number;unpackedBytes:number;format:'tar.gz'|'zip'|'file';files:ArchiveFile[]}
export function validateArchiveDescriptor(a:ArchiveDescriptor,targetOS:string){
  if(!a||!['program','installer','browser','node'].includes(a.role)||!['tar.gz','zip','file'].includes(a.format)||!Number.isSafeInteger(a.bytes)||a.bytes<1||a.bytes>LIMITS.archiveBytes||!Number.isSafeInteger(a.unpackedBytes)||a.unpackedBytes<0||a.unpackedBytes>LIMITS.unpackedBytes||a.format==='tar.gz'&&a.unpackedBytes>LIMITS.tarUnpackedBytes||!Array.isArray(a.files)||a.files.length<1||a.files.length>LIMITS.files||!/^[a-f0-9]{64}$/.test(a.sha256))throw new Error('MANIFEST_INVALID');
  const seen=new Set<string>();let size=0;for(const f of a.files){if(!f||typeof f.path!=='string'||!safeArtifactPath(f.path)||seen.has(f.path.toLowerCase())||!/^[a-f0-9]{64}$/.test(f.sha256)||!Number.isSafeInteger(f.bytes)||f.bytes<0||f.bytes>512*1024*1024||f.type!==undefined&&f.type!=='file'&&f.type!=='symlink'||f.type==='symlink'&&(typeof f.target!=='string'||f.bytes>512)||f.type!=='symlink'&&f.executable!==undefined&&typeof f.executable!=='boolean')throw new Error('MANIFEST_INVALID');seen.add(f.path.toLowerCase());size+=f.bytes;}
  for(const f of a.files){const allowed=f.type==='symlink'?['path','sha256','bytes','type','target']:['path','sha256','bytes','type','executable'];if(Object.keys(f).some(key=>!allowed.includes(key)))throw new Error('MANIFEST_INVALID');}
  if(size!==a.unpackedBytes||a.format==='file'&&a.files.length!==1)throw new Error('MANIFEST_INVALID');for(const name of seen){const parts=name.split('/');for(let i=1;i<parts.length;i++)if(seen.has(parts.slice(0,i).join('/')))throw new Error('MANIFEST_INVALID');}validateLinkGraph(a.files,targetOS==='darwin'&&a.role==='browser');
}
/** Minimal bootstrap trust check, executed only from the independently hash-pinned embedded core. */
export function verifyBootstrapManifest(bytes:Buffer,signature:Buffer,trust:{publicKey:string;fingerprint:string},target:{os:string;arch:string;version:string}){
  const key=createPublicKey(trust.publicKey);if(key.asymmetricKeyType!=='ed25519'||digest(key.export({type:'spki',format:'der'}))!==trust.fingerprint)throw new Error('TRUST_ROOT_INVALID');
  if(bytes.length>LIMITS.manifestBytes||signature.length!==64||!verify(null,bytes,key,signature))throw new Error('SIGNATURE_INVALID');
  const object=(v:unknown,keys:string[])=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!==keys.sort().join(','))throw new Error('MANIFEST_INVALID');return v as Record<string,unknown>;};
  const m=object(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),['schema','product','build','target','dependencies','artifacts','dependencySources','tests']);
  const b=object(m.build,['version','buildId','commit','tree','dependencyHash','protocol','schemaMin','schemaMax','capabilities']);
  if(m.schema!==1||m.product!=='autoed-rebuild'||typeof b.version!=='string'||!/^0\.\d+\.\d+(?:-beta\.[1-9]\d*)?$/.test(b.version)||b.protocol!==1||b.schemaMin!==1||b.schemaMax!==1||!Array.isArray(b.capabilities)||b.capabilities.length<1||b.capabilities.length>2||b.capabilities.some(c=>!['echo','digest'].includes(c)))throw new Error('MANIFEST_INVALID');
  for(const field of ['buildId','dependencyHash'])if(typeof b[field]!=='string'||!/^[a-f0-9]{64}$/.test(b[field]))throw new Error('MANIFEST_INVALID');
  for(const field of ['commit','tree'])if(typeof b[field]!=='string'||!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(b[field]))throw new Error('MANIFEST_INVALID');
  const t=object(m.target,['os','arch','minVersion']);if(t.os!==target.os||t.arch!==target.arch||!['darwin:arm64','win32:x64'].includes(target.os+':'+target.arch)||typeof t.minVersion!=='string'||!/^\d+\.\d+\.\d+$/.test(t.minVersion)||!/^\d+\.\d+\.\d+$/.test(target.version))throw new Error('INCOMPATIBLE');
  const current=target.version.split('.').map(Number),minimum=t.minVersion.split('.').map(Number);for(let i=0;i<3;i++){if(current[i]!<minimum[i]!)throw new Error('INCOMPATIBLE');if(current[i]!>minimum[i]!)break;}
  const dependencies=object(m.dependencies,['node','playwright','browserRevision','browserVersion']);if(dependencies.node!=='24.20.0'||dependencies.playwright!=='1.62.1'||dependencies.browserRevision!=='1234'||dependencies.browserVersion!=='151.0.7922.34')throw new Error('INCOMPATIBLE');
  if(!Array.isArray(m.artifacts)||m.artifacts.length<1||m.artifacts.length>LIMITS.artifacts)throw new Error('MANIFEST_INVALID');let count=0,total=0;const names=new Set<string>();
  const artifacts=m.artifacts.map(value=>{const a=object(value,['name','role','url','sha256','bytes','format','unpackedBytes','files']) as unknown as ArchiveDescriptor&{name:string;url:string};validateArchiveDescriptor(a,target.os);if(typeof a.name!=='string'||!safeArtifactPath(a.name)||a.name.includes('/')||names.has(a.name.toLowerCase()))throw new Error('MANIFEST_INVALID');names.add(a.name.toLowerCase());assertDownloadURL(a.url);count+=a.files.length;total+=a.unpackedBytes;return a;});
  if(count>LIMITS.files||total>LIMITS.unpackedBytes||!Array.isArray(m.dependencySources)||m.dependencySources.length<1||m.dependencySources.length>1000)throw new Error('MANIFEST_INVALID');
  for(const source of m.dependencySources){const s=object(source,['name','version','url','integrity']);if(typeof s.name!=='string'||!s.name.length||s.name.length>128||typeof s.version!=='string'||!s.version.length||s.version.length>64||typeof s.url!=='string'||s.url.length>2048||typeof s.integrity!=='string'||!/^(?:sha256-[a-f0-9]{64}|sha512-[A-Za-z0-9+/]+={0,2})$/.test(s.integrity))throw new Error('MANIFEST_INVALID');const url=new URL(s.url);if(url.protocol!=='https:'||url.username||url.password||url.hash||url.port&&url.port!=='443')throw new Error('MANIFEST_INVALID');}
  const tests=object(m.tests,['synthetic','integration','macosNative','windowsNative','human']);if(Object.values(tests).some(v=>!['pass','fail','not_run','human_needed'].includes(v as string)))throw new Error('MANIFEST_INVALID');
  const installers=artifacts.filter(a=>a.role==='installer');if(installers.length!==1)throw new Error('INSTALLER_ARTIFACT_REQUIRED');return {artifact:installers[0]!,manifestHash:digest(bytes)};
}
const sha=digest;
function disk(root:string,bytes:number){const stat=statfsSync(root,{bigint:true});if(stat.bavail*stat.bsize<BigInt(bytes)+16n*1024n*1024n)throw new Error('INSUFFICIENT_DISK');}
export function extractArchive(artifact:ArchiveDescriptor,bytes:Buffer,root:string,targetOS:string,permissions:{verify:(path:string)=>unknown;protect:(path:string)=>unknown}){
  validateArchiveDescriptor(artifact,targetOS);
  if(bytes.length!==artifact.bytes||sha(bytes)!==artifact.sha256)throw new Error('ARTIFACT_INTEGRITY');
  if(realpathSync(root)!==root||!lstatSync(root).isDirectory()||lstatSync(root).isSymbolicLink())throw new Error('UNSAFE_STAGING');permissions.verify(root);
  validateLinkGraph(artifact.files,targetOS==='darwin'&&artifact.role==='browser');
  if(artifact.files.some(f=>f.type==='symlink')&&(process.platform!=='darwin'||targetOS!=='darwin'||artifact.role!=='browser'))throw new Error('LINK_DENIED');if(readdirSync(root).length)throw new Error('STAGING_NOT_EMPTY');disk(root,artifact.unpackedBytes);
  let entries:Entry[];try{entries=artifact.format==='tar.gz'?tarEntries(bytes,artifact.unpackedBytes):artifact.format==='zip'?zipEntries(bytes):[{path:artifact.files[0]!.path,kind:'file',size:bytes.length,read:()=>bytes}];}catch{throw new Error('ARCHIVE_INVALID');}
  const expected=new Map(artifact.files.map(f=>[f.path,f])),directories=new Set<string>(),seen=new Set<string>();for(const f of artifact.files){const parts=f.path.split('/');for(let i=1;i<parts.length;i++)directories.add(parts.slice(0,i).join('/'));}
  let total=0;for(const e of entries){if(!safeArtifactPath(e.path)||seen.has(e.path.toLowerCase()))throw new Error('ARCHIVE_PATH_DENIED');seen.add(e.path.toLowerCase());if(e.kind==='directory'){if(!directories.has(e.path))throw new Error('ARCHIVE_PATH_DENIED');continue;}const f=expected.get(e.path);if(!f||e.kind!==(f.type==='symlink'?'symlink':'file')||e.size!==f.bytes||(total+=e.size)>artifact.unpackedBytes||sha(e.read())!==f.sha256)throw new Error('ARCHIVE_INTEGRITY');}
  if(entries.filter(e=>e.kind!=='directory').length!==artifact.files.length||total!==artifact.unpackedBytes)throw new Error('ARCHIVE_INTEGRITY');
  for(const dir of [...directories].sort((a,b)=>a.split('/').length-b.split('/').length)){const path=join(root,dir);mkdirSync(path,{mode:0o700});permissions.protect(path);}
  for(const e of entries.filter(e=>e.kind==='file')){const f=expected.get(e.path)!;const path=join(root,e.path),fd=openSync(path,'wx',0o600);try{permissions.protect(path);writeFileSync(fd,e.read());fsyncSync(fd);}finally{closeSync(fd);}if(f.type!=='symlink'&&f.executable)chmodSync(path,0o700);}
  for(const f of artifact.files)if(f.type==='symlink'){symlinkSync(f.target,join(root,f.path));}
  for(const f of artifact.files){const path=join(root,f.path),st=lstatSync(path);if(f.type==='symlink'){if(!st.isSymbolicLink()||readlinkSync(path)!==f.target)throw new Error('FILE_INTEGRITY');}else if(!st.isFile()||st.nlink!==1||realpathSync(path)!==path||st.size!==f.bytes||sha(readFileSync(path))!==f.sha256)throw new Error('FILE_INTEGRITY');}return root;
}

export function assertDownloadURL(input:string):URL{
  let u:URL;try{u=new URL(input);}catch{throw new Error('DOWNLOAD_URL_DENIED');}
  const paths:Record<string,RegExp>={'nodejs.org':/^\/dist\/v24\.20\.0\/[A-Za-z0-9._-]+$/,'github.com':/^\/returdex\/AutoED\/releases\/download\/v?0\.\d+\.\d+-beta\.\d+\/[A-Za-z0-9._-]+$/,'release-assets.githubusercontent.com':/^\//,'objects.githubusercontent.com':/^\//,'cdn.playwright.dev':/^\/builds\//,'storage.googleapis.com':/^\/chrome-for-testing-public\//};
  if(u.protocol!=='https:'||u.username||u.password||u.hash||u.port&&u.port!=='443'||!paths[u.hostname]?.test(u.pathname)||u.pathname.includes('%'))throw new Error('DOWNLOAD_URL_DENIED');return u;
}
export function assertPublicIPv4(ip:string):string{
  if(!isIPv4(ip))throw new Error('DOWNLOAD_IP_DENIED');const [a,b,c]=ip.split('.').map(Number);
  if(a===0||a===10||a===127||a===169&&b===254||a===172&&b!>=16&&b!<=31||a===192&&(b===168||b===0||b===2)||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113||a===100&&b!>=64&&b!<=127||a!>=224)throw new Error('DOWNLOAD_IP_DENIED');return ip;
}
interface TransportResponse {status:number;location?:string;body:AsyncIterable<Buffer>|Iterable<Buffer>;length?:number}
export interface DownloadTransport {resolve(host:string):Promise<string[]>;request(url:URL,address:string,maxBytes:number):Promise<TransportResponse>}
const nativeTransport:DownloadTransport={
  async resolve(host){return (await lookup(host,{all:true,family:4})).map(a=>a.address);},
  request(url,address,maxBytes){return new Promise((resolve,reject)=>{
    const request=httpsRequest(url,{agent:false,family:4,signal:AbortSignal.timeout(120000),lookup:(_host,_options,callback)=>callback(null,address,4),headers:{'accept-encoding':'identity'}},response=>{
      const status=response.statusCode??0;if(status>=300&&status<400){response.destroy();resolve({status,...(response.headers.location?{location:response.headers.location}:{}),body:[]});return;}
      if(status!==200){response.destroy();reject(new Error('DOWNLOAD_FAILED'));return;}
      const length=response.headers['content-length']===undefined?undefined:Number(response.headers['content-length']);if(length!==undefined&&(!Number.isSafeInteger(length)||length>maxBytes)||response.headers['content-encoding']&&response.headers['content-encoding']!=='identity'){response.destroy();reject(new Error('DOWNLOAD_LIMIT'));return;}
      resolve({status,body:response,...(length===undefined?{}:{length})});
    });request.on('error',()=>reject(new Error('DOWNLOAD_FAILED')));request.end();
  });},
};
export async function readBoundedReleaseURL(input:string,maximum:number,transport:DownloadTransport=nativeTransport){
  if(!Number.isSafeInteger(maximum)||maximum<1||maximum>LIMITS.manifestBytes)throw new Error('DOWNLOAD_LIMIT');let url=assertDownloadURL(input);
  for(let hop=0;hop<6;hop++){const addresses=await transport.resolve(url.hostname);if(!addresses.length)throw new Error('DOWNLOAD_IP_DENIED');addresses.forEach(assertPublicIPv4);const response=await transport.request(url,addresses[0]!,maximum);if(response.status>=300&&response.status<400){if(!response.location)throw new Error('DOWNLOAD_FAILED');url=assertDownloadURL(new URL(response.location,url).href);continue;}if(response.status!==200)throw new Error('DOWNLOAD_FAILED');const chunks:Buffer[]=[];let size=0;for await(const chunk of response.body){if(!Buffer.isBuffer(chunk)||(size+=chunk.length)>maximum)throw new Error('DOWNLOAD_LIMIT');chunks.push(chunk);}return Buffer.concat(chunks);}throw new Error('DOWNLOAD_REDIRECT_LIMIT');
}
export async function prepareBootstrapInstaller(config:{publicKey:string;fingerprint:string;manifestURL:string;signatureURL:string},root:string,target:{os:string;arch:string;version:string},permissions:{verify:(path:string)=>unknown;protect:(path:string)=>unknown},transport:DownloadTransport=nativeTransport){
  permissions.verify(root);const bytes=await readBoundedReleaseURL(config.manifestURL,LIMITS.manifestBytes,transport),signature=await readBoundedReleaseURL(config.signatureURL,64,transport);
  const {artifact,manifestHash}=verifyBootstrapManifest(bytes,signature,config,target);
  const entry='dist/packages/installer/src/install.js';if(!artifact.files.some(f=>f.path===entry&&f.type!=='symlink'))throw new Error('INSTALLER_ENTRY_MISSING');
  const archive=await downloadArchive(artifact,root,permissions,transport),directory=join(root,'verified-installer');mkdirSync(directory,{mode:0o700});permissions.protect(directory);extractArchive(artifact,readFileSync(archive),directory,target.os,permissions);
  for(const [name,data]of [['release-manifest.json',bytes],['release-manifest.sig',signature]] as const){const path=join(root,name),fd=openSync(path,'wx',0o600);try{permissions.protect(path);writeFileSync(fd,data);fsyncSync(fd);}finally{closeSync(fd);}}
  return {entry:join(directory,entry),manifestPath:join(root,'release-manifest.json'),signaturePath:join(root,'release-manifest.sig'),manifestHash};
}
/** Build-time only: callers supply this repository's freshly compiled modules, never downloaded code. */
export function renderBootstrapPayload(coreJavaScript:string,permissionsJavaScript:string,config:{publicKey:string;fingerprint:string;manifestURL:string;signatureURL:string}){
  assertDownloadURL(config.manifestURL);assertDownloadURL(config.signatureURL);
  const modules=[['archive-core.mjs',coreJavaScript],['permissions.mjs',permissionsJavaScript]].map(([name,source])=>({name:name!,bytes:Buffer.from(source!).toString('base64'),sha256:digest(Buffer.from(source!))}));
  const source=`import {writeFileSync,openSync,closeSync,fsyncSync,realpathSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=process.argv[2],selectedRoot=process.argv[3];
if(!root||realpathSync(root)!==root||!lstatSync(root).isDirectory()||lstatSync(root).isSymbolicLink())throw new Error('UNSAFE_STAGING');
for(const module of ${JSON.stringify(modules)}){const bytes=Buffer.from(module.bytes,'base64');if(createHash('sha256').update(bytes).digest('hex')!==module.sha256)throw new Error('BOOTSTRAP_CORE_INTEGRITY');const fd=openSync(join(root,module.name),'wx',0o600);try{writeFileSync(fd,bytes);fsyncSync(fd);}finally{closeSync(fd);}}
const permissions=await import(pathToFileURL(join(root,'permissions.mjs')).href);permissions.verifyProtectedPath(root);for(const name of ['archive-core.mjs','permissions.mjs'])permissions.protectPath(join(root,name));
const core=await import(pathToFileURL(join(root,'archive-core.mjs')).href);
const version=process.platform==='darwin'?execFileSync('/usr/bin/sw_vers',['-productVersion'],{encoding:'utf8',timeout:5000}).trim():execFileSync(join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-Command','[Environment]::OSVersion.Version.ToString(3)'],{encoding:'utf8',timeout:5000}).trim();
const prepared=await core.prepareBootstrapInstaller(${JSON.stringify(config)},root,{os:process.platform,arch:process.arch,version},{verify:permissions.verifyProtectedPath,protect:permissions.protectPath});
execFileSync(process.execPath,[prepared.entry,'--preview','--manifest',prepared.manifestPath,'--signature',prepared.signaturePath,...(selectedRoot?['--root',selectedRoot]:[])],{cwd:root,env:process.env,stdio:'inherit',timeout:300000});
`;
  return {source,sha256:digest(Buffer.from(source)),moduleHashes:modules.map(m=>({name:m.name,sha256:m.sha256}))};
}
/** Injected transport is for trusted synthetic composition only, never CLI/config/tool input. */
export async function downloadArchive(artifact:ArchiveDescriptor&{name:string;url:string},root:string,permissions:{verify:(path:string)=>unknown;protect:(path:string)=>unknown},transport:DownloadTransport=nativeTransport){
  if(!safeArtifactPath(artifact.name)||artifact.name.includes('/'))throw new Error('MANIFEST_INVALID');permissions.verify(root);disk(root,artifact.bytes+artifact.unpackedBytes);let url=assertDownloadURL(artifact.url);let response:TransportResponse|undefined;
  for(let hop=0;hop<6;hop++){const addresses=await transport.resolve(url.hostname);if(!addresses.length)throw new Error('DOWNLOAD_IP_DENIED');for(const ip of addresses)assertPublicIPv4(ip);response=await transport.request(url,addresses[0]!,artifact.bytes);
    if(response.status>=300&&response.status<400){if(!response.location)throw new Error('DOWNLOAD_FAILED');url=assertDownloadURL(new URL(response.location,url).href);continue;}break;
  }
  if(!response||response.status!==200)throw new Error('DOWNLOAD_FAILED');
  const destination=join(root,artifact.name),fd=openSync(destination,'wx',0o600),identity=fstatSync(fd);let complete=false;
  try{permissions.protect(destination);let size=0;const hash=createHash('sha256');for await(const chunk of response.body){if(!Buffer.isBuffer(chunk)||(size+=chunk.length)>artifact.bytes)throw new Error('DOWNLOAD_LIMIT');hash.update(chunk);let offset=0;while(offset<chunk.length){const written=writeSync(fd,chunk,offset,chunk.length-offset);if(!written)throw new Error('DOWNLOAD_FAILED');offset+=written;}}
    if(size!==artifact.bytes||hash.digest('hex')!==artifact.sha256)throw new Error('ARTIFACT_INTEGRITY');fsyncSync(fd);complete=true;return destination;
  }finally{closeSync(fd);if(!complete){const actual=lstatSync(destination);if(actual.dev===identity.dev&&actual.ino===identity.ino&&actual.isFile()&&!actual.isSymbolicLink())unlinkSync(destination);}}
}
