import {expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {createNativeRuntime} from '../../packages/test-support/src/native-runtime.js';
import {createServer} from 'node:http';
import {writeFileSync,unlinkSync,mkdirSync,rmdirSync} from 'node:fs';
import {join} from 'node:path';
import {runtimeIdentity} from '../../packages/platform/src/processes.js';
import {clientIdentityProof} from '../../packages/platform/src/client-endpoint.js';

it('compiled CLI starts independent services, proves identity, submits real jobs and requires pairing confirmation',async()=>{
  const f=await createNativeRuntime();try{
    const started=await f.runCli(['start']);expect(started.code,JSON.stringify(started)).toBe(0);expect(JSON.parse(started.stdout)).toMatchObject({api:'running',worker:'running'});
    const status=await f.runCli(['status']);expect(status.code).toBe(0);expect(JSON.parse(status.stdout)).toMatchObject({component:{role:'cli',build:f.build},status:{installationId:f.metadata.installationId,api:{build:f.build}}});
    const submitted=await f.runCli(['selftest','--kind','digest','--value','abc']);expect(submitted.code).toBe(0);const id=JSON.parse(submitted.stdout).id;
    let job;for(let n=0;n<3;n++){await new Promise(r=>setTimeout(r,750));job=JSON.parse((await f.runCli(['jobs','get',id])).stdout);if(job.state==='succeeded')break;}expect(job).toMatchObject({state:'succeeded',result:'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'});
    const origin=`http://127.0.0.1:${f.metadata.port}`;const nonceResponse=await f.h.fetch(origin+'/api/pairing/nonce',{headers:{origin}});const {nonce}=await nonceResponse.json();const nonceCookie=nonceResponse.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
    const pending=await f.h.fetch(origin+'/api/pairing/pending',{method:'POST',headers:{origin,cookie:nonceCookie,'content-type':'application/json','x-autoed-csrf':nonce},body:JSON.stringify({nonce})});const {code}=await pending.json();
    expect((await f.runCli(['pair','approve',code],'no\n')).code).not.toBe(0);
    expect((await f.runCli(['pair','approve',code],code+'\n')).code).toBe(0);
    for(const name of ['cli','mcp','installer']){const token=await f.secrets.get(f.metadata.installationId,name);expect([started.stdout,status.stdout,submitted.stdout].some(output=>output.includes(token!))).toBe(false);}
    expect((await f.runCli(['jobs','cancel',randomUUID()])).code).not.toBe(0);
    expect((await f.runCli(['stop'])).code).toBe(0);const offline=await f.runCli(['status']);expect(offline.code).not.toBe(0);expect(offline.stdout).toContain('BACKEND_UNAVAILABLE');
    const pendingLaunch=join(f.selection.root,'runtime/worker.launch');mkdirSync(pendingLaunch,{mode:0o700});try{const uncertain=await f.runCli(['stop']);expect(uncertain.code).not.toBe(0);expect(uncertain.stdout).toContain('PROCESS_STOP_UNCONFIRMED');}finally{rmdirSync(pendingLaunch);}
  }finally{await f.cleanup();}
},60000);

it('actual CLI rejects wrong installation proof and redirects, and sends nothing to an unowned listener',async()=>{
  const f=await createNativeRuntime();const recordPath=join(f.selection.root,'runtime/api.json');let requests=0,redirected=0;let mode='wrong-install';
  const target=createServer((_q,r)=>{redirected++;r.end('{}');});await new Promise<void>(r=>target.listen(0,'127.0.0.1',r));const targetPort=(target.address() as {port:number}).port;
  const nonce=randomUUID();const record={...await runtimeIdentity(f.selection,'api',f.build,nonce,f.metadata.port),entrypoint:f.entries.api};
  // Synthetic owned responder exercises transport/proof negatives; it is not API/Worker feature evidence.
  const server=createServer(async(q,r)=>{requests++;let body='';for await(const part of q)body+=part;
    if(q.url==='/api/client/identity'){const proof=await clientIdentityProof(f.secrets,f.metadata.credentials.find(c=>c.name==='cli')!,f.metadata.installationId,f.build,nonce,JSON.parse(body));r.setHeader('content-type','application/json');r.end(JSON.stringify(mode==='wrong-install'?{...proof,installationId:randomUUID()}:proof));}
    else {r.writeHead(302,{location:`http://127.0.0.1:${targetPort}/intercept`});r.end();}
  });
  try{
    await new Promise<void>(r=>server.listen(f.metadata.port,'127.0.0.1',r));writeFileSync(recordPath,JSON.stringify({...record,pid:99999999}),{mode:0o600});
    expect((await f.runCli(['status'])).code).not.toBe(0);expect(requests).toBe(0);
    writeFileSync(recordPath,JSON.stringify(record));expect((await f.runCli(['status'])).stdout).toContain('IDENTITY_MISMATCH');
    mode='redirect';expect((await f.runCli(['status'],'',{HTTP_PROXY:`http://127.0.0.1:${targetPort}`,HTTPS_PROXY:`http://127.0.0.1:${targetPort}`,ALL_PROXY:`http://127.0.0.1:${targetPort}`,NODE_USE_ENV_PROXY:'1'})).stdout).toContain('IDENTITY_MISMATCH');expect(requests).toBe(3);expect(redirected).toBe(0);
  }finally{await new Promise<void>(r=>server.close(()=>r()));await new Promise<void>(r=>target.close(()=>r()));unlinkSync(recordPath);await f.cleanup();}
},60000);
