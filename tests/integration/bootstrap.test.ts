import {expect,it} from 'vitest';
import {createHash,createPublicKey,verify} from 'node:crypto';
import {gzipSync,crc32} from 'node:zlib';
import {join} from 'node:path';
import {mkdirSync,readFileSync,realpathSync,readdirSync,writeFileSync,readlinkSync,symlinkSync,chmodSync} from 'node:fs';
import {homedir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHarness} from '../../packages/test-support/src/harness.js';
import {protectPath} from '../../packages/platform/src/permissions.js';
import {signSyntheticManifests,withSyntheticSigner} from '../../scripts/build/synthetic-sign.mjs';
import {createFixtureVerifier} from '../../packages/installer/src/verify-manifest.js';
import {extractVerifiedArchive,assertDownloadURL,assertPublicIPv4,downloadArtifact} from '../../packages/installer/src/download.js';
import {zipEntries,validateLinkGraph,renderBootstrapPayload,renderRehearsalBootstrapPayload,verifyBootstrapManifest} from '../../packages/installer/src/archive-core.js';
const sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
function zip(entries:{path:string;data:string;type?:'symlink'}[]){const locals:Buffer[]=[],centrals:Buffer[]=[];let offset=0;for(const e of entries){const name=Buffer.from(e.path),data=Buffer.from(e.data),local=Buffer.alloc(30),central=Buffer.alloc(46);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt32LE(crc32(data),14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(name.length,26);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(0x0314,4);central.writeUInt16LE(20,6);central.writeUInt32LE(crc32(data),16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(((e.type==='symlink'?0xa1ff:0x8180)*65536)>>>0,38);central.writeUInt32LE(offset,42);locals.push(local,name,data);centrals.push(central,name);offset+=local.length+name.length+data.length;}const central=Buffer.concat(centrals),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...locals,central,end]);}
function tar(entries:{path:string;data?:string;link?:string}[]){const chunks:Buffer[]=[];for(const e of entries){const data=Buffer.from(e.data??''),h=Buffer.alloc(512);h.write(e.path,0,100);h.write('0000600\0',100);h.write(data.length.toString(8).padStart(11,'0')+'\0',124);h.fill(32,148,156);h[156]=e.link?50:48;if(e.link)h.write(e.link,157,100);h.write('ustar\0',257);h.write('00',263);const sum=h.reduce((a,b)=>a+b,0);h.write(sum.toString(8).padStart(6,'0')+'\0 ',148);chunks.push(h,data,Buffer.alloc((512-data.length%512)%512));}chunks.push(Buffer.alloc(1024));return gzipSync(Buffer.concat(chunks));}
async function verified(root:string,archive:Buffer,files:{path:string;data:string;type?:'symlink';target?:string}[],role='program',format='tar.gz'){
  const m={schema:1,product:'autoed-rebuild',build:{version:'0.1.0-beta.1',buildId:'a'.repeat(64),commit:'b'.repeat(40),tree:'c'.repeat(40),dependencyHash:'d'.repeat(64),protocol:1,schemaMin:1,schemaMax:1,capabilities:['echo']},target:{os:'darwin',arch:'arm64',minVersion:'14.0.0'},dependencies:{node:'24.20.0',playwright:'1.62.1',browserRevision:'1234',browserVersion:'151.0.7922.34'},artifacts:[{name:'payload.tar.gz',role,url:'https://github.com/returdex/AutoED/releases/download/0.1.0-beta.1/payload.tar.gz',sha256:sha(archive),bytes:archive.length,format,unpackedBytes:files.reduce((n,f)=>n+Buffer.byteLength(f.data),0),files:files.map(({data,...f})=>({...f,sha256:sha(data),bytes:Buffer.byteLength(data)}))}],dependencySources:[{name:'node',version:'24.20.0',url:'https://nodejs.org/dist/v24.20.0/node-v24.20.0-darwin-arm64.tar.gz',integrity:'sha256-'+'e'.repeat(64)}],tests:{synthetic:'pass',integration:'pass',macosNative:'not_run',windowsNative:'not_run',human:'not_run'}};
  const bytes=Buffer.from(JSON.stringify(m)),signed=await signSyntheticManifests(root,[bytes]);return createFixtureVerifier(signed.publicKey,signed.fingerprint)(bytes,Buffer.from(signed.signatures[0],'base64'),{os:'darwin',arch:'arm64',version:'26.5.2',schema:1,protocol:1});
}
it('two-stage synthetic signer binds post-discovery bytes to the same ephemeral fingerprint and exits',async()=>{
  const h=createHarness();try{const root=realpathSync(h.root),bytes=Buffer.from('post-key-discovery');const signed:any=await withSyntheticSigner(root,async(signer:any)=>({fingerprint:signer.fingerprint,signature:(await signer.sign([bytes]))[0]}));expect(signed.signerExited).toBe(true);expect(signed.result.fingerprint).toBe(signed.fingerprint);expect(verify(null,bytes,createPublicKey(signed.publicKey),Buffer.from(signed.result.signature,'base64'))).toBe(true);await expect(withSyntheticSigner(root,async()=>{throw new Error('callback');})).rejects.toThrow('SYNTHETIC_SIGNER_FAILED');await expect(withSyntheticSigner(root as any,null as any)).rejects.toThrow('INVALID_SYNTHETIC_INPUT');}finally{await h.cleanup();}
});
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
it('download policy accepts both historical and v-prefixed immutable release tags',()=>{
  for(const tag of ['0.1.0-beta.20','v0.1.0-beta.35'])expect(assertDownloadURL(`https://github.com/returdex/AutoED/releases/download/${tag}/manifest.json`).pathname).toContain(tag);
});
it('rehearsal bootstrap payload has no transport configuration and rejects non-basename manifest names',()=>{
  const payload=renderRehearsalBootstrapPayload('export{}','export{}',{publicKey:'temporary',fingerprint:'f'.repeat(64),manifestName:'manifest.json',signatureName:'manifest.sig'});
  expect(payload.source).not.toMatch(/https?:|fetch\(|httpsRequest|prepareBootstrapInstaller/);expect(payload.moduleHashes).toHaveLength(2);
  for(const manifestName of ['../manifest.json','https://example.test/manifest.json'])expect(()=>renderRehearsalBootstrapPayload('x','y',{publicKey:'temporary',fingerprint:'f'.repeat(64),manifestName,signatureName:'manifest.sig'})).toThrow('REHEARSAL_PATH_DENIED');
});
it('ZIP decodes full names and checks local names, CRC and bounded output',()=>{
  const archive=(name:Buffer,data:Buffer)=>{const local=Buffer.alloc(30),central=Buffer.alloc(46),end=Buffer.alloc(22);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt32LE(crc32(data),14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(name.length,26);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,6);central.writeUInt32LE(crc32(data),16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(name.length,28);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(46+name.length,12);end.writeUInt32LE(30+name.length+data.length,16);return Buffer.concat([local,name,data,central,name,end]);};
  const valid=archive(Buffer.from('app.js'),Buffer.from('abc'));expect(zipEntries(valid)[0]!.read().toString()).toBe('abc');
  for(const name of [Buffer.from('app.js\0evil'),Buffer.from([0xff])])expect(()=>zipEntries(archive(name,Buffer.from('abc')))).toThrow();
  const corrupt=Buffer.from(valid);corrupt[36]=0;expect(()=>zipEntries(corrupt)[0]!.read()).toThrow();
});
it('official Framework link layout resolves Current chains but dotdot, cycles, dangling, Windows and excessive links are denied',async()=>{
  const base='chrome-mac-arm64/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/';
  const paths=['Resources/a','Libraries/a','Google Chrome for Testing Framework','Helpers/a'];
  const regular=paths.map(p=>({path:base+'Versions/151.0.7922.34/'+p,bytes:3,sha256:sha('abc')}));
  const links=Object.entries({Resources:'Versions/Current/Resources','Versions/Current':'151.0.7922.34',Libraries:'Versions/Current/Libraries','Google Chrome for Testing Framework':'Versions/Current/Google Chrome for Testing Framework',Helpers:'Versions/Current/Helpers'}).map(([path,target])=>({path:base+path,target,type:'symlink' as const,bytes:Buffer.byteLength(target),sha256:sha(target)}));
  expect(()=>validateLinkGraph([...regular,...links],true)).not.toThrow();expect(()=>validateLinkGraph([...regular,...links],false)).toThrow('LINK_DENIED');
  for(const target of ['Versions/Current/../outside','missing','Resources']){const bad={...links[0]!,target,bytes:Buffer.byteLength(target),sha256:sha(target)};expect(()=>validateLinkGraph([...regular,bad,...links.slice(1)],true)).toThrow('LINK_DENIED');}
  const leaf={path:'leaf',data:'abc'},many=Array.from({length:257},(_,i)=>({path:'alias'+i,type:'symlink' as const,target:'leaf',data:'leaf'})),descriptors=[leaf,...many].map(({data,...f})=>({...f,bytes:Buffer.byteLength(data),sha256:sha(data)}));
  expect(()=>validateLinkGraph(descriptors.slice(0,257),true)).not.toThrow();expect(()=>validateLinkGraph(descriptors,true)).toThrow('LINK_LIMIT');
  const h=createHarness();try{const root=realpathSync(h.root);protectPath(root);const v=await verified(root,Buffer.from('synthetic archive'),[leaf,...many.slice(0,256)],'browser');const browser={...v.manifest.artifacts[0]!,files:descriptors,unpackedBytes:descriptors.reduce((n,f)=>n+f.bytes,0)},installer={...v.manifest.artifacts[0]!,name:'installer',role:'installer',format:'file',files:[{path:'dist/packages/installer/src/install.js',bytes:3,sha256:sha('abc')}],bytes:3,unpackedBytes:3,sha256:sha('abc')};const bytes=Buffer.from(JSON.stringify({...v.manifest,artifacts:[browser,installer]})),signed=await signSyntheticManifests(root,[bytes]),signature=Buffer.from(signed.signatures[0],'base64');
    expect(()=>createFixtureVerifier(signed.publicKey,signed.fingerprint)(bytes,signature,{os:'darwin',arch:'arm64',version:'26.5.2',schema:1,protocol:1})).toThrow('MANIFEST_INVALID');expect(()=>verifyBootstrapManifest(bytes,signature,{publicKey:signed.publicKey,fingerprint:signed.fingerprint},{os:'darwin',arch:'arm64',version:'26.5.2'})).toThrow('LINK_LIMIT');
  }finally{await h.cleanup();}
});
it('production bootstrap with no Node on PATH stops at unestablished trust without managed changes',async()=>{
  const h=createHarness();try{let failed=false;try{execFileSync('/bin/sh',['scripts/install/bootstrap.sh','--staging-parent',realpathSync(h.root)],{env:{PATH:'/usr/bin:/bin'},stdio:'pipe'});}catch(error){failed=String((error as {stderr:Buffer}).stderr).includes('RELEASE_TRUST_NOT_ESTABLISHED');}expect(failed).toBe(true);expect(readdirSync(h.root)).toEqual([]);}finally{await h.cleanup();}
});
it('verified browser ZIP preserves the five Framework links and resolves the actual regular content',async()=>{
  const h=createHarness();try{const root=realpathSync(h.root);protectPath(root);const base='chrome-mac-arm64/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/';
    const files=[...['Resources/a','Libraries/a','Google Chrome for Testing Framework','Helpers/a'].map(p=>({path:base+'Versions/151.0.7922.34/'+p,data:'abc'})),...Object.entries({Resources:'Versions/Current/Resources','Versions/Current':'151.0.7922.34',Libraries:'Versions/Current/Libraries','Google Chrome for Testing Framework':'Versions/Current/Google Chrome for Testing Framework',Helpers:'Versions/Current/Helpers'}).map(([path,target])=>({path:base+path,data:target,type:'symlink' as const,target}))];
    const archive=zip(files),v=await verified(root,archive,files,'browser','zip'),output=join(root,'browser');mkdirSync(output,{mode:0o700});protectPath(output);await extractVerifiedArchive(v,'payload.tar.gz',archive,output);expect(readlinkSync(join(output,base,'Versions/Current'))).toBe('151.0.7922.34');expect(readFileSync(join(output,base,'Resources/a'),'utf8')).toBe('abc');expect(readFileSync(join(output,base,'Helpers/a'),'utf8')).toBe('abc');
  }finally{await h.cleanup();}
});
it('shell preflight rejects literal legacy paths and unsafe owned parents before staging',async()=>{
  const h=createHarness();try{const root=realpathSync(h.root),script=join(root,'preflight.sh');protectPath(root);writeFileSync(script,readFileSync('scripts/install/bootstrap.sh','utf8').replace("TRUST_STATE='UNESTABLISHED'","TRUST_STATE='APPROVED'"));const writable=join(root,'writable'),link=join(root,'link');mkdirSync(writable);chmodSync(writable,0o777);symlinkSync(writable,link);
    for(const parent of [join(homedir(),'Documents/AutoED/no-write'),join(homedir(),'Library/Application Support/AutoED/no-write'),writable,link]){let failed=false;try{execFileSync('/bin/sh',[script,'--staging-parent',parent],{env:{...process.env,PATH:'/usr/bin:/bin'},timeout:10000,stdio:'pipe'});}catch(error){failed=String((error as {stderr:Buffer}).stderr).includes('UNSAFE_STAGING');}expect(failed).toBe(true);}expect(readdirSync(writable)).toEqual([]);
  }finally{await h.cleanup();}
});
it('Windows 11 compatibility uses the actual 10.0.build kernel version in both verifiers',async()=>{
  const h=createHarness();try{const root=realpathSync(h.root);protectPath(root);const files=[{path:'dist/packages/installer/src/install.js',data:'abc'}],archive=tar(files),v=await verified(root,archive,files,'installer');const manifest={...v.manifest,target:{os:'win32',arch:'x64',minVersion:'10.0.22000'}},bytes=Buffer.from(JSON.stringify(manifest)),signed=await signSyntheticManifests(root,[bytes]),signature=Buffer.from(signed.signatures[0],'base64'),trust={publicKey:signed.publicKey,fingerprint:signed.fingerprint},full=createFixtureVerifier(trust.publicKey,trust.fingerprint);
    expect(()=>verifyBootstrapManifest(bytes,signature,trust,{os:'win32',arch:'x64',version:'10.0.26100'})).not.toThrow();expect(()=>full(bytes,signature,{os:'win32',arch:'x64',version:'10.0.26100',schema:1,protocol:1})).not.toThrow();expect(()=>verifyBootstrapManifest(bytes,signature,trust,{os:'win32',arch:'x64',version:'10.0.19045'})).toThrow('INCOMPATIBLE');expect(()=>full(bytes,signature,{os:'win32',arch:'x64',version:'10.0.19045',schema:1,protocol:1})).toThrow('INCOMPATIBLE');
  }finally{await h.cleanup();}
});
it('actual shell boot verifies Node, embedded code, signature and installer before execution; NODE_OPTIONS cannot inject code',async()=>{
  const h=createHarness();try{const root=realpathSync(h.root);protectPath(root);const compiled=join(root,'compiled');execFileSync(process.execPath,['node_modules/typescript/bin/tsc','--outDir',compiled],{timeout:30000,stdio:'pipe'});
    const coreSource=readFileSync(join(compiled,'packages/installer/src/archive-core.js'),'utf8'),permissionsSource=readFileSync(join(compiled,'packages/platform/src/permissions.js'),'utf8');
    const marker=join(root,'executed'),injected=join(root,'injected'),entry='dist/packages/installer/src/install.js',program=`require('node:fs').appendFileSync(${JSON.stringify(marker)},'verified')`,archive=tar([{path:entry,data:program}]);
    const v=await verified(root,archive,[{path:entry,data:program}],'installer'),manifest=Buffer.from(JSON.stringify(v.manifest)),signed=await signSyntheticManifests(root,[manifest]);
    const manifestURL='https://github.com/returdex/AutoED/releases/download/0.1.0-beta.1/release-manifest.json',signatureURL=manifestURL.replace('.json','.sig');
    const template=readFileSync('scripts/install/bootstrap.sh','utf8'),nodeArchive=realpathSync('.runtime/dev-toolchain/node-v24.20.0-darwin-arm64.tar.gz');
    writeFileSync(join(root,'inject.cjs'),`require('node:fs').writeFileSync(${JSON.stringify(injected)},'unsafe')`);
    for(const scenario of ['valid','node','core','signature','installer']){
      const parent=join(root,scenario);mkdirSync(parent,{mode:0o700});protectPath(parent);
      const files={manifest:join(root,scenario+'.json'),signature:join(root,scenario+'.sig'),archive:join(root,scenario+'.tar.gz')};writeFileSync(files.manifest,manifest);writeFileSync(files.signature,scenario==='signature'?Buffer.alloc(64):Buffer.from(signed.signatures[0],'base64'));writeFileSync(files.archive,scenario==='installer'?Buffer.from('tampered'):archive);
      // Only transport is replaced in this trusted synthetic build; all verification/extraction code stays compiled source.
      const mapping={[manifestURL]:files.manifest,[signatureURL]:files.signature,[v.manifest.artifacts[0]!.url]:files.archive};
      const replacement=`const fixtureTransport={resolve:async()=>['104.20.1.2'],request:async(url)=>({status:200,body:[readFileSync(${JSON.stringify(mapping)}[url.href])]})};\nconst nativeTransport = fixtureTransport;\nconst unusedNativeTransport = {`;
      expect(coreSource.includes('const nativeTransport = {')).toBe(true);const fixtureCore=coreSource.replace('const nativeTransport = {',replacement);
      const payload=renderBootstrapPayload(fixtureCore,permissionsSource,{publicKey:signed.publicKey,fingerprint:signed.fingerprint,manifestURL,signatureURL});expect(payload.moduleHashes).toEqual([{name:'archive-core.mjs',sha256:sha(fixtureCore)},{name:'permissions.mjs',sha256:sha(permissionsSource)}]);
      const source=template.replace("TRUST_STATE='UNESTABLISHED'","TRUST_STATE='APPROVED'").replace("CORE_SHA256='UNESTABLISHED'",`CORE_SHA256='${payload.sha256}'`).replace("CORE_BASE64='UNESTABLISHED'",`CORE_BASE64='${Buffer.from(payload.source+(scenario==='core'?`\nwriteFileSync(${JSON.stringify(injected)},'tampered-core');`:'')).toString('base64')}'`).replace(/download\(\) \{[\s\S]*?\n\}\n# No managed/,`download() { /bin/cp '${scenario==='node'?files.archive:nodeArchive}' "$2"; }\n# No managed`);
      const script=join(root,scenario+'.sh');writeFileSync(script,source);let code=0;try{execFileSync('/bin/sh',[script,'--staging-parent',parent,...(scenario==='valid'?['--root',join(root,'selected-installation')]:[])],{env:{...process.env,PATH:'/usr/bin:/bin',NODE_OPTIONS:`--require=${join(root,'inject.cjs')}`},timeout:30000,stdio:'pipe'});}catch(error){code=(error as {status:number}).status??1;}
      expect(code===0,scenario).toBe(scenario==='valid');expect(readdirSync(root).includes('injected')).toBe(false);if(scenario==='valid')expect(readFileSync(marker,'utf8')).toBe('verified');
      // A second execution appends again, so an earlier valid run cannot mask unauthorized execution.
      if(scenario!=='valid')expect(readFileSync(marker,'utf8')).toBe('verified');
    }
  }finally{await h.cleanup();}
},120000);
