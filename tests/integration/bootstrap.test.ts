import {expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {join} from 'node:path';
import {mkdirSync,readFileSync,realpathSync,readdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHarness} from '../../packages/test-support/src/harness.js';
import {protectPath} from '../../packages/platform/src/permissions.js';
import {signSyntheticManifests} from '../../scripts/build/synthetic-sign.mjs';
import {createFixtureVerifier} from '../../packages/installer/src/verify-manifest.js';
import {extractVerifiedArchive,assertDownloadURL,assertPublicIPv4,downloadArtifact} from '../../packages/installer/src/download.js';
const sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
function tar(entries:{path:string;data?:string;link?:string}[]){const chunks:Buffer[]=[];for(const e of entries){const data=Buffer.from(e.data??''),h=Buffer.alloc(512);h.write(e.path,0,100);h.write('0000600\0',100);h.write(data.length.toString(8).padStart(11,'0')+'\0',124);h.fill(32,148,156);h[156]=e.link?50:48;if(e.link)h.write(e.link,157,100);h.write('ustar\0',257);h.write('00',263);const sum=h.reduce((a,b)=>a+b,0);h.write(sum.toString(8).padStart(6,'0')+'\0 ',148);chunks.push(h,data,Buffer.alloc((512-data.length%512)%512));}chunks.push(Buffer.alloc(1024));return gzipSync(Buffer.concat(chunks));}
async function verified(root:string,archive:Buffer,files:{path:string;data:string;type?:'symlink';target?:string}[],role='program'){
  const m={schema:1,product:'autoed-rebuild',build:{version:'0.1.0-beta.1',buildId:'a'.repeat(64),commit:'b'.repeat(40),tree:'c'.repeat(40),dependencyHash:'d'.repeat(64),protocol:1,schemaMin:1,schemaMax:1,capabilities:['echo']},target:{os:'darwin',arch:'arm64',minVersion:'14.0.0'},dependencies:{node:'24.20.0',playwright:'1.62.1',browserRevision:'1234',browserVersion:'151.0.7922.34'},artifacts:[{name:'payload.tar.gz',role,url:'https://github.com/returdex/AutoED/releases/download/0.1.0-beta.1/payload.tar.gz',sha256:sha(archive),bytes:archive.length,format:'tar.gz',unpackedBytes:files.reduce((n,f)=>n+Buffer.byteLength(f.data),0),files:files.map(({data,...f})=>({...f,sha256:sha(data),bytes:Buffer.byteLength(data)}))}],dependencySources:[{name:'node',version:'24.20.0',url:'https://nodejs.org/dist/v24.20.0/node-v24.20.0-darwin-arm64.tar.gz',integrity:'sha256-'+'e'.repeat(64)}],tests:{synthetic:'pass',integration:'pass',macosNative:'not_run',windowsNative:'not_run',human:'not_run'}};
  const bytes=Buffer.from(JSON.stringify(m)),signed=await signSyntheticManifests(root,[bytes]);return createFixtureVerifier(signed.publicKey,signed.fingerprint)(bytes,Buffer.from(signed.signatures[0],'base64'),{os:'darwin',arch:'arm64',version:'26.5.2',schema:1,protocol:1});
}
it('verified USTAR extracts exact regular bytes; bad hash, traversal, extra members, duplicates and links reject before writing',async()=>{
  const h=createHarness();try{const root=realpathSync(h.root);protectPath(root);const entries=[{path:'app.js',data:'abc'}],archive=tar(entries),v=await verified(root,archive,entries);const output=join(root,'output');mkdirSync(output,{mode:0o700});protectPath(output);await extractVerifiedArchive(v,'payload.tar.gz',archive,output);expect(readFileSync(join(output,'app.js'),'utf8')).toBe('abc');
    for(const [label,bad]of [['hash',Buffer.from('broken')],['traversal',tar([{path:'../escape',data:'abc'}])],['extra',tar([...entries,{path:'evil.js',data:'abc'}])],['duplicate',tar([...entries,...entries])],['link',tar([{path:'app.js',link:'../../escape'}])]] as const){const dest=join(root,label);mkdirSync(dest,{mode:0o700});protectPath(dest);const signed=label==='hash'?v:await verified(root,bad,entries);await expect(extractVerifiedArchive(signed,'payload.tar.gz',bad,dest)).rejects.toThrow();expect(readdirSync(dest)).toEqual([]);}
  }finally{await h.cleanup();}
});
it('download policy rejects unapproved domains, private addresses and redirects before a second request',async()=>{
  for(const url of ['http://nodejs.org/x','https://github.com/other/AutoED/releases/x','https://nodejs.org.evil.test/x','https://user:pass@nodejs.org/x','https://127.0.0.1/x'])expect(()=>assertDownloadURL(url)).toThrow();
  for(const ip of ['127.0.0.1','10.1.2.3','172.16.0.1','192.168.1.1','169.254.1.1','100.64.0.1','0.0.0.0','224.0.0.1','::1'])expect(()=>assertPublicIPv4(ip)).toThrow();expect(assertPublicIPv4('104.20.1.2')).toBe('104.20.1.2');
  const h=createHarness();try{const root=realpathSync(h.root);protectPath(root);const archive=tar([{path:'app.js',data:'abc'}]),v=await verified(root,archive,[{path:'app.js',data:'abc'}]);let requests=0;
    await expect(downloadArtifact(v,'payload.tar.gz',root,{resolve:async()=>['104.20.1.2'],request:async()=>{requests++;return {status:302,location:'https://127.0.0.1/private',body:[]};}})).rejects.toThrow('DOWNLOAD_URL_DENIED');expect(requests).toBe(1);expect(readdirSync(root)).toEqual([]);
  }finally{await h.cleanup();}
});
it('production bootstrap with no Node on PATH stops at unestablished trust without managed changes',()=>{
  const h=createHarness();try{let failed=false;try{execFileSync('/bin/sh',['scripts/install/bootstrap.sh','--staging-parent',realpathSync(h.root)],{env:{PATH:'/usr/bin:/bin'},stdio:'pipe'});}catch(error){failed=String((error as {stderr:Buffer}).stderr).includes('RELEASE_TRUST_NOT_ESTABLISHED');}expect(failed).toBe(true);expect(readdirSync(h.root)).toEqual([]);}finally{void h.cleanup();}
});
