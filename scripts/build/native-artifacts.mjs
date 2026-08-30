import {closeSync,lstatSync,openSync,readFileSync,readdirSync,readlinkSync,readSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,relative,resolve,isAbsolute} from 'node:path';

export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function inspectNativeBinary(bytes,target){
  if(!Buffer.isBuffer(bytes)||bytes.length<8)throw new Error('NATIVE_ARCH_MISMATCH');
  if(target==='darwin-arm64'){
    if(bytes.readUInt32LE(0)!==0xfeedfacf||bytes.readUInt32LE(4)!==0x0100000c)throw new Error('NATIVE_ARCH_MISMATCH');
    return {format:'Mach-O',arch:'arm64'};
  }
  if(target==='win32-x64'){
    if(bytes.length<70||bytes.toString('ascii',0,2)!=='MZ')throw new Error('NATIVE_ARCH_MISMATCH');const offset=bytes.readUInt32LE(0x3c);
    if(offset+6>bytes.length||bytes.toString('ascii',offset,offset+4)!=='PE\0\0'||bytes.readUInt16LE(offset+4)!==0x8664)throw new Error('NATIVE_ARCH_MISMATCH');
    return {format:'PE',arch:'x64'};
  }
  throw new Error('TARGET_UNSUPPORTED');
}
export function inspectTreeMachines(root,files,target){for(const file of files){if(file.type!=='file')continue;const fd=openSync(join(root,file.path),'r'),header=Buffer.alloc(4096);let length=0;try{length=readSync(fd,header,0,header.length,0);}finally{closeSync(fd);}const bytes=header.subarray(0,length),magic=bytes.length>=4&&(bytes.readUInt32LE(0)===0xfeedfacf||bytes.subarray(0,2).toString()==='MZ'),nativeName=/\.(?:node|exe|dll|dylib)$/i.test(file.path);if(magic||nativeName)inspectNativeBinary(bytes,target);}}
function safeName(name){return name&&name!=='.'&&name!=='..'&&!name.includes('/')&&!name.includes('\\')&&!/[\0-\x1f]/.test(name);}
export function inventoryTree(root,target){
  if(!isAbsolute(root)||realpathSync(root)!==root||!lstatSync(root).isDirectory())throw new Error('SOURCE_UNSAFE');const files=[];
  const walk=(directory,prefix='')=>{for(const entry of readdirSync(directory,{withFileTypes:true})){if(!safeName(entry.name))throw new Error('SOURCE_UNSAFE');const path=join(directory,entry.name),name=prefix+entry.name,st=lstatSync(path);if(entry.isDirectory()){if(st.isSymbolicLink())throw new Error('SOURCE_UNSAFE');walk(path,name+'/');}else if(entry.isSymbolicLink()){if(target==='win32-x64')throw new Error('WINDOWS_LINK_FORBIDDEN');const link=readlinkSync(path);if(!link||isAbsolute(link)||link.split('/').some(part=>part==='.'||part==='..'))throw new Error('LINK_GRAPH_INVALID');const resolved=resolve(directory,link),rel=relative(root,resolved);if(rel.startsWith('..')||isAbsolute(rel))throw new Error('LINK_GRAPH_INVALID');files.push({path:name,type:'symlink',bytes:Buffer.byteLength(link),sha256:sha256(Buffer.from(link)),target:link});}else if(entry.isFile()&&!st.isSymbolicLink()&&st.nlink===1){const bytes=readFileSync(path);files.push({path:name,type:'file',bytes:bytes.length,sha256:sha256(bytes),...(st.mode&0o111?{executable:true}:{})});}else throw new Error('SOURCE_UNSAFE');}};walk(root);return files.sort((a,b)=>a.path.localeCompare(b.path));
}
