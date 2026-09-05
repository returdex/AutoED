import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {closeSync,lstatSync,openSync,readSync,readdirSync,readFileSync,realpathSync,readlinkSync,statSync} from 'node:fs';
import {dirname,isAbsolute,join,relative,resolve} from 'node:path';

const MAX_OBJECT_BYTES=64*1024*1024;
const MAX_OBJECTS=200000;
const MAX_TOTAL_BYTES=512*1024*1024;
const MAX_CAPTURED_OUTPUT_BYTES=64*1024*1024;
const CLOSURE_CHUNK_BYTES=1024*1024;
const CLOSURE_PROFILES=Object.freeze({closure:Object.freeze({maxFileBytes:512*1024*1024,maxTreeBytes:512*1024*1024}),test:Object.freeze({maxFileBytes:96,maxTreeBytes:128})});
const HASH=/^[a-f0-9]{40,64}$/;
const SURFACES=new Set(['tracked','history','working_tree','captured_output','owned_tree','public_package']);
const PRIVATE_PATH=/(?:^|\/)(?:Profile|.*\.sqlite(?:-wal|-shm)?|\.env(?:\..*)?|logs?|private[-_]?keys?|private[-_]?fixtures?)(?:\/|$)/i;
const SENSITIVE=new RegExp(['gh'+'[pousr]_[A-Za-z0-9]{20,}','github_'+'pat_[A-Za-z0-9_]{20,}','-----BEGIN '+'(?:OPENSSH|EC|RSA|PRIVATE) PRIVATE KEY-----','CANARY_'+'RELEASE_SECRET'].join('|'));
const reports=new WeakSet();
const evidence=new WeakMap();

function fail(code){throw new Error(code);}
function canonical(value){if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;return JSON.stringify(value);}
function sha(value){return createHash('sha256').update(value).digest('hex');}
function validSurface(surface){return typeof surface==='string'&&SURFACES.has(surface);}
function safeRoot(root){try{if(!isAbsolute(root))return null;const actual=realpathSync(root),stat=lstatSync(actual);return stat.isDirectory()&&!stat.isSymbolicLink()?actual:null;}catch{return null;}}
function safeRelative(value){return typeof value==='string'&&value.length>0&&value.length<=4096&&!value.includes('\\')&&!value.includes('\0')&&!isAbsolute(value)&&!value.split('/').some(part=>part===''||part==='.'||part==='..');}
function childOf(root,path){const resolved=resolve(root,path);return relative(root,resolved)!==''&&!relative(root,resolved).startsWith('..')&&!isAbsolute(relative(root,resolved))?resolved:null;}
function insideRoot(root,path){const rel=relative(root,path);return rel!==''&&!rel.startsWith('..')&&!isAbsolute(rel);}
function privatePathDenied(path){if(PRIVATE_PATH.test(path))return true;const segments=path.split('/'),packageRoot=segments[0]==='node_modules'?0:segments[0]==='program'&&segments[1]==='node_modules'?1:-1;for(let index=0;index<segments.length;index++){if(!/^cookies?$/i.test(segments[index]))continue;const dependencyPackage=packageRoot>=0&&(index===packageRoot+1||(index===packageRoot+2&&segments[packageRoot+1].startsWith('@')));if(!dependencyPackage)return true;}return false;}
function report(surface,{objects,bytes,findings},contentSha256=''){const status=findings===0?'pass':'fail',body={status,surface,objects,bytes,findings};const result=Object.freeze({...body,reportSha256:sha(canonical({...body,contentSha256}))});reports.add(result);evidence.set(result,contentSha256);return result;}
function emptyFailure(surface){return report(surface,{objects:0,bytes:0,findings:1});}

/**
 * Incrementally scans untrusted bytes without retaining their contents.  The
 * overlap keeps token detection correct when a secret crosses a stream chunk.
 */
/** @param {{surface:string,maxBytes?:number}} options */
export function createSensitiveChunkScanner({surface,maxBytes=surface==='captured_output'?MAX_CAPTURED_OUTPUT_BYTES:MAX_TOTAL_BYTES}={}){
  const ceiling=surface==='captured_output'?MAX_CAPTURED_OUTPUT_BYTES:MAX_TOTAL_BYTES;
  if(!validSurface(surface)||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>ceiling)fail('SENSITIVE_SCAN_INVALID');
  let bytes=0,objects=0,findings=0,closed=false,overflow=false,tail=Buffer.alloc(0);
  const digest=createHash('sha256');
  const write=(value,{object=true}={})=>{
    if(closed)fail('SENSITIVE_SCAN_CLOSED');
    const chunk=Buffer.isBuffer(value)?value:typeof value==='string'?Buffer.from(value):null;
    if(!chunk){findings=1;return false;}
    if(overflow)return false;
    if(object)objects++;
    if(chunk.length>maxBytes-bytes){bytes=maxBytes+1;findings=1;overflow=true;tail=Buffer.alloc(0);return false;}
    bytes+=chunk.length;
    digest.update(chunk);
    const window=tail.length?Buffer.concat([tail,chunk]):chunk;
    if(SENSITIVE.test(window.toString('utf8')))findings=1;
    tail=window.subarray(Math.max(0,window.length-4096));
    return findings===0;
  };
  const writePath=(value,{privatePath=value}={})=>{
    if(closed)fail('SENSITIVE_SCAN_CLOSED');
    if(typeof value!=='string'||value.length===0||value.length>4096||typeof privatePath!=='string'||privatePath.length===0||privatePath.length>4096){findings=1;return false;}
    digest.update(Buffer.from(`path\0${value}`));
    if(privatePathDenied(privatePath)||SENSITIVE.test(value)||SENSITIVE.test(privatePath)){findings=1;return false;}
    return findings===0;
  };
  const finish=()=>{if(closed)fail('SENSITIVE_SCAN_CLOSED');closed=true;if(surface==='captured_output'&&objects===0)findings=1;return report(surface,{objects,bytes,findings},digest.digest('hex'));};
  return Object.freeze({write,writePath,finish});
}

/** A single 64 MiB capture stream may span build output and every fixed command. */
export function createCapturedOutputScanner({maxBytes=MAX_CAPTURED_OUTPUT_BYTES}={}){return createSensitiveChunkScanner({surface:'captured_output',maxBytes});}

/** @param {Buffer|string} bytes @param {{surface?:string,maxBytes?:number}} [options] */
export function scanSensitiveBytes(bytes,{surface='captured_output',maxBytes=MAX_OBJECT_BYTES}={}){
  const scanner=createSensitiveChunkScanner({surface,maxBytes});scanner.write(bytes);return scanner.finish();
}

export function scanCapturedOutput(chunks,{maxBytes=8*1024*1024}={}){
  try{if(!chunks||typeof chunks[Symbol.iterator]!=='function')return emptyFailure('captured_output');const scanner=createCapturedOutputScanner({maxBytes});let seen=false;for(const chunk of chunks){seen=true;scanner.write(chunk);}return seen?scanner.finish():emptyFailure('captured_output');}catch{return emptyFailure('captured_output');}
}

function scanBlob(root,hash,{surface,onObject}){
  try{
    if(!HASH.test(hash))return false;
    const size=Number(execFileSync('git',['cat-file','-s',hash],{cwd:root,encoding:'utf8',timeout:5000,maxBuffer:1024*1024}).trim());
    if(!Number.isSafeInteger(size)||size<0||size>MAX_OBJECT_BYTES)return false;
    const bytes=execFileSync('git',['cat-file','blob',hash],{cwd:root,timeout:5000,maxBuffer:MAX_OBJECT_BYTES+1});
    return onObject(bytes);
  }catch{return false;}
}
function sourcePathAllowed(path,allowPath){return safeRelative(path)&&!privatePathDenied(path)&&(typeof allowPath!=='function'||allowPath(path)===true);}

/** @param {string} root @param {string} [treeish] @param {{allowPath?:(path:string)=>boolean}} [options] */
export function scanTrackedTree(root,treeish='HEAD',{allowPath}={}){
  const surface='tracked',actual=safeRoot(root);
  try{
    if(!actual||typeof treeish!=='string'||!/^[A-Za-z0-9._/-]{1,128}$/.test(treeish)){if(process.env.AUTOED_SENSITIVE_DEBUG==='1')throw new Error('SENSITIVE_HISTORY_INPUT');return emptyFailure(surface);}
    const output=execFileSync('git',['ls-tree','-r','-z',treeish],{cwd:actual,encoding:'buffer',timeout:30000,maxBuffer:64*1024*1024});
    const scanner=createSensitiveChunkScanner({surface,maxBytes:MAX_TOTAL_BYTES});let count=0;
    for(const row of output.toString('utf8').split('\0').filter(Boolean)){
      const match=/^(\d{6}) (blob) ([a-f0-9]{40,64})\t(.+)$/.exec(row);
      if(!match||!sourcePathAllowed(match[4],allowPath)||++count>MAX_OBJECTS||!scanBlob(actual,match[3],{surface,onObject:bytes=>scanner.write(bytes)}))return emptyFailure(surface);
    }
    return scanner.finish();
  }catch{return emptyFailure(surface);}
}

/** @param {string} root @param {string} [treeish] @param {{allowPath?:(path:string)=>boolean,isReviewedException?:(hash:string,path:string)=>boolean}} [options] */
export function scanReachableHistory(root,treeish='HEAD',{allowPath,isReviewedException}={}){
  const surface='history',actual=safeRoot(root);
  try{
    if(!actual||typeof treeish!=='string'||!/^[A-Za-z0-9._/-]{1,128}$/.test(treeish))return emptyFailure(surface);
    const output=execFileSync('git',['rev-list','--objects',treeish],{cwd:actual,encoding:'utf8',timeout:30000,maxBuffer:32*1024*1024});
    let count=0,totalBytes=0;const digest=createHash('sha256');
    for(const sourceRow of output.split('\n').filter(Boolean)){
      const row=sourceRow.endsWith('\r')?sourceRow.slice(0,-1):sourceRow;
      const match=/^([a-f0-9]{40,64})(?: (.*))?$/.exec(row);if(!match)return emptyFailure(surface);
      const type=execFileSync('git',['cat-file','-t',match[1]],{cwd:actual,encoding:'utf8',timeout:5000,maxBuffer:1024*1024}).trim();if(type!=='blob')continue;
      const path=match[2]??'';
      if(!sourcePathAllowed(path,allowPath)||++count>MAX_OBJECTS)return emptyFailure(surface);
      let bytes;
      if(!scanBlob(actual,match[1],{surface,onObject:value=>{bytes=value;return true;}})||!bytes)return emptyFailure(surface);
      totalBytes+=bytes.length;if(totalBytes>MAX_TOTAL_BYTES)return emptyFailure(surface);digest.update(bytes);
      const item=scanSensitiveBytes(bytes,{surface,maxBytes:MAX_OBJECT_BYTES});
      if(item.status==='fail'){
        if(typeof isReviewedException==='function'&&isReviewedException(match[1],path)===true)continue;
        return report(surface,{objects:count,bytes:totalBytes,findings:1},digest.digest('hex'));
      }
    }
    return report(surface,{objects:count,bytes:totalBytes,findings:0},digest.digest('hex'));
  }catch{return emptyFailure(surface);}
}

/** @param {string} root @param {{allowPath?:(path:string)=>boolean}} [options] */
export function scanWorkingTree(root,{allowPath}={}){
  const surface='working_tree',actual=safeRoot(root);
  try{
    if(!actual)return emptyFailure(surface);
    const output=execFileSync('git',['ls-files','-co','--exclude-standard','-z'],{cwd:actual,encoding:'buffer',timeout:30000,maxBuffer:64*1024*1024});
    const scanner=createSensitiveChunkScanner({surface,maxBytes:MAX_TOTAL_BYTES});let count=0;
    for(const path of output.toString('utf8').split('\0').filter(Boolean)){
      const absolute=safeRelative(path)&&sourcePathAllowed(path,allowPath)?childOf(actual,path):null;if(!absolute||++count>MAX_OBJECTS)return emptyFailure(surface);
      const stat=lstatSync(absolute);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size<0||stat.size>MAX_OBJECT_BYTES||realpathSync(absolute)!==absolute)return emptyFailure(surface);
      scanner.write(readFileSync(absolute));
    }
    return scanner.finish();
  }catch{return emptyFailure(surface);}
}

/**
 * Scans a caller-owned closure. macOS permits only relative in-root file or
 * directory symlinks; Windows and neutral closures reject every link.
 */
/** @param {string} root @param {{surface?:string,allowPath?:(path:string)=>boolean,platform:'darwin-arm64'|'win32-x64'|'neutral',profile?:'closure'|'test',maxObjects?:number}} options */
export function scanOwnedTree(root,{surface='owned_tree',allowPath,platform,profile='closure',maxObjects=100000}={}){
  const actual=safeRoot(root);
  try{
    const limits=CLOSURE_PROFILES[profile];if(!actual||!validSurface(surface)||typeof platform!=='string'||!/^(?:darwin-arm64|win32-x64|neutral)$/.test(platform)||!limits||!Number.isSafeInteger(maxObjects)||maxObjects<1||maxObjects>MAX_OBJECTS)return emptyFailure(validSurface(surface)?surface:'owned_tree');
    const scanner=createSensitiveChunkScanner({surface,maxBytes:limits.maxTreeBytes});scanner.writePath(`platform/${platform}`);let count=0;const scannedFiles=new Set(),scannedDirectories=new Set([actual]);
    const markObject=()=>{if(++count>maxObjects)throw new Error();scanner.write(Buffer.alloc(0));};
    const streamFile=(absolute,path,{recordPath=true}={})=>{
      const stat=lstatSync(absolute);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size<0||stat.size>limits.maxFileBytes||realpathSync(absolute)!==absolute)throw new Error();
      if(recordPath){markObject();scanner.writePath(`file/${path}`,{privatePath:path});}if(scannedFiles.has(absolute))return;scannedFiles.add(absolute);
      let fd;try{fd=openSync(absolute,'r');let offset=0;if(stat.size===0){scanner.write(Buffer.alloc(0),{object:false});return;}while(offset<stat.size){const chunk=Buffer.allocUnsafe(Math.min(CLOSURE_CHUNK_BYTES,stat.size-offset)),read=readSync(fd,chunk,0,chunk.length,offset);if(!Number.isSafeInteger(read)||read<1)throw new Error();scanner.write(chunk.subarray(0,read),{object:false});offset+=read;}}finally{if(fd!==undefined)closeSync(fd);}
    };
    const scanFile=(absolute,path)=>streamFile(absolute,path);
    const validateLink=(absolute,path)=>{
      if(platform!=='darwin-arm64')throw new Error();const target=readlinkSync(absolute);
      if(typeof target!=='string'||target.length===0||target.length>4096||target.includes('\\')||target.includes('\0')||isAbsolute(target))throw new Error();
      const lexical=resolve(dirname(absolute),target);if(!insideRoot(actual,lexical))throw new Error();
      const resolved=realpathSync(absolute);if(!insideRoot(actual,resolved))throw new Error();
      const resolvedPath=relative(actual,resolved);if(!safeRelative(resolvedPath)||!sourcePathAllowed(resolvedPath,allowPath))throw new Error();
      markObject();scanner.writePath(`link/${path}`,{privatePath:path});scanner.writePath(`link-target/${target}`,{privatePath:resolvedPath});scanner.writePath(`link-resolved/${resolvedPath}`,{privatePath:resolvedPath});
      return {resolved,resolvedPath};
    };
    const scanLink=(absolute,path)=>{
      const {resolved,resolvedPath}=validateLink(absolute,path),stat=statSync(absolute);
      if(stat.isFile()){if(stat.nlink!==1||stat.size<0||stat.size>limits.maxFileBytes)throw new Error();streamFile(resolved,resolvedPath,{recordPath:false});return;}
      if(!stat.isDirectory()||insideRoot(resolved,absolute))throw new Error();
      if(scannedDirectories.has(resolved))return;scannedDirectories.add(resolved);walk(resolved,resolvedPath,{alreadyScanned:true});
    };
    const walk=(directory,prefix='',{alreadyScanned=false}={})=>{if(!alreadyScanned){if(realpathSync(directory)!==directory)throw new Error();markObject();scanner.writePath(`directory/${prefix}`,{privatePath:prefix||'.'});if(scannedDirectories.has(directory))return;scannedDirectories.add(directory);}for(const entry of readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){
      const path=prefix?`${prefix}/${entry.name}`:entry.name,absolute=childOf(actual,path);if(!absolute||!safeRelative(path)||!sourcePathAllowed(path,allowPath))throw new Error();
      const stat=lstatSync(absolute);if(stat.isDirectory()&&realpathSync(absolute)===absolute)walk(absolute,path);else if(stat.isSymbolicLink())scanLink(absolute,path);else scanFile(absolute,path);
    }};
    walk(actual,'',{alreadyScanned:true});return scanner.finish();
  }catch{return emptyFailure(validSurface(surface)?surface:'owned_tree');}
}

export function combineSensitiveReports(input,{surfaces=['tracked','history','working_tree','captured_output']}={}){
  try{
    if(!Array.isArray(input)||!Array.isArray(surfaces)||new Set(surfaces).size!==surfaces.length||surfaces.length===0||surfaces.some(surface=>!validSurface(surface))||input.length!==surfaces.length)return emptyFailure('captured_output');
    const bySurface=new Map();for(const item of input){const contentSha256=evidence.get(item);if(!reports.has(item)||!item||typeof contentSha256!=='string'||!HASH.test(contentSha256)||Object.keys(item).sort().join(',')!=='bytes,findings,objects,reportSha256,status,surface'||!validSurface(item.surface)||bySurface.has(item.surface)||item.status!=='pass'||item.findings!==0||!Number.isSafeInteger(item.objects)||item.objects<0||!Number.isSafeInteger(item.bytes)||item.bytes<0||item.reportSha256!==sha(canonical({status:item.status,surface:item.surface,objects:item.objects,bytes:item.bytes,findings:item.findings,contentSha256})))return emptyFailure('captured_output');bySurface.set(item.surface,item);}
    if(surfaces.some(surface=>!bySurface.has(surface)))return emptyFailure('captured_output');
    const objects=input.reduce((total,item)=>total+item.objects,0),bytes=input.reduce((total,item)=>total+item.bytes,0);if(!Number.isSafeInteger(objects)||!Number.isSafeInteger(bytes))return emptyFailure('captured_output');
    return report('captured_output',{objects,bytes,findings:0},sha(canonical(input.map(item=>item.reportSha256).sort())));
  }catch{return emptyFailure('captured_output');}
}

export const SENSITIVE_SCAN_LIMITS=Object.freeze({maxObjectBytes:MAX_OBJECT_BYTES,maxObjects:MAX_OBJECTS,maxTotalBytes:MAX_TOTAL_BYTES,maxCapturedOutputBytes:MAX_CAPTURED_OUTPUT_BYTES});
