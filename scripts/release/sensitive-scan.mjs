import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {lstatSync,readdirSync,readFileSync,realpathSync} from 'node:fs';
import {isAbsolute,join,relative,resolve} from 'node:path';

const MAX_OBJECT_BYTES=64*1024*1024;
const MAX_OBJECTS=200000;
const MAX_TOTAL_BYTES=512*1024*1024;
const HASH=/^[a-f0-9]{40,64}$/;
const SURFACES=new Set(['tracked','history','working_tree','captured_output','owned_tree','public_package']);
const PRIVATE_PATH=/(?:^|\/)(?:Profile|Cookies?|.*\.sqlite(?:-wal|-shm)?|\.env(?:\..*)?|logs?|private[-_]?keys?|private[-_]?fixtures?)(?:\/|$)/i;
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
function report(surface,{objects,bytes,findings},contentSha256=''){const status=findings===0?'pass':'fail',body={status,surface,objects,bytes,findings};const result=Object.freeze({...body,reportSha256:sha(canonical({...body,contentSha256}))});reports.add(result);evidence.set(result,contentSha256);return result;}
function emptyFailure(surface){return report(surface,{objects:0,bytes:0,findings:1});}

/**
 * Incrementally scans untrusted bytes without retaining their contents.  The
 * overlap keeps token detection correct when a secret crosses a stream chunk.
 */
/** @param {{surface:string,maxBytes?:number}} options */
export function createSensitiveChunkScanner({surface,maxBytes=MAX_TOTAL_BYTES}={}){
  if(!validSurface(surface)||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>MAX_TOTAL_BYTES)fail('SENSITIVE_SCAN_INVALID');
  let bytes=0,objects=0,findings=0,closed=false,tail=Buffer.alloc(0);
  const digest=createHash('sha256');
  const write=value=>{
    if(closed)fail('SENSITIVE_SCAN_CLOSED');
    const chunk=Buffer.isBuffer(value)?value:typeof value==='string'?Buffer.from(value):null;
    if(!chunk){findings=1;return false;}
    objects++;
    bytes+=chunk.length;
    digest.update(chunk);
    if(bytes>maxBytes){findings=1;tail=Buffer.alloc(0);return false;}
    const window=tail.length?Buffer.concat([tail,chunk]):chunk;
    if(SENSITIVE.test(window.toString('utf8')))findings=1;
    tail=window.subarray(Math.max(0,window.length-4096));
    return findings===0;
  };
  const finish=()=>{if(closed)fail('SENSITIVE_SCAN_CLOSED');closed=true;return report(surface,{objects,bytes,findings},digest.digest('hex'));};
  return Object.freeze({write,finish});
}

/** @param {Buffer|string} bytes @param {{surface?:string,maxBytes?:number}} [options] */
export function scanSensitiveBytes(bytes,{surface='captured_output',maxBytes=MAX_OBJECT_BYTES}={}){
  const scanner=createSensitiveChunkScanner({surface,maxBytes});scanner.write(bytes);return scanner.finish();
}

export function scanCapturedOutput(chunks,{maxBytes=8*1024*1024}={}){
  try{if(!chunks||typeof chunks[Symbol.iterator]!=='function')return emptyFailure('captured_output');const scanner=createSensitiveChunkScanner({surface:'captured_output',maxBytes});for(const chunk of chunks)scanner.write(chunk);return scanner.finish();}catch{return emptyFailure('captured_output');}
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
function sourcePathAllowed(path,allowPath){return safeRelative(path)&&!PRIVATE_PATH.test(path)&&(typeof allowPath!=='function'||allowPath(path)===true);}

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

/** Scans a caller-owned output directory after rejecting links and special files. */
/** @param {string} root @param {{surface?:string,allowPath?:(path:string)=>boolean,platform?:string,maxObjects?:number,maxBytes?:number}} [options] */
export function scanOwnedTree(root,{surface='owned_tree',allowPath,platform,maxObjects=100000,maxBytes=MAX_TOTAL_BYTES}={}){
  const actual=safeRoot(root);
  try{
    if(!actual||!validSurface(surface)||!Number.isSafeInteger(maxObjects)||maxObjects<1||maxObjects>MAX_OBJECTS||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>MAX_TOTAL_BYTES||(platform!==undefined&&(typeof platform!=='string'||!/^(?:darwin-arm64|win32-x64|neutral)$/.test(platform))))return emptyFailure(validSurface(surface)?surface:'owned_tree');
    const scanner=createSensitiveChunkScanner({surface,maxBytes});let count=0;
    const walk=(directory,prefix='')=>{for(const entry of readdirSync(directory,{withFileTypes:true})){
      const path=prefix?`${prefix}/${entry.name}`:entry.name,absolute=childOf(actual,path);if(!absolute||!safeRelative(path)||!sourcePathAllowed(path,allowPath))throw new Error();
      const stat=lstatSync(absolute);if(stat.isSymbolicLink()||realpathSync(absolute)!==absolute)throw new Error();
      if(stat.isDirectory())walk(absolute,path);else if(stat.isFile()&&stat.nlink===1&&stat.size>=0&&stat.size<=MAX_OBJECT_BYTES){if(++count>maxObjects)throw new Error();scanner.write(readFileSync(absolute));}else throw new Error();
    }};
    walk(actual);return scanner.finish();
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

export const SENSITIVE_SCAN_LIMITS=Object.freeze({maxObjectBytes:MAX_OBJECT_BYTES,maxObjects:MAX_OBJECTS,maxTotalBytes:MAX_TOTAL_BYTES});
