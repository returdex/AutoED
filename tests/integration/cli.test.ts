import {expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {createNativeRuntime} from '../../packages/test-support/src/native-runtime.js';

it('compiled CLI starts independent services, proves identity, submits real jobs and requires pairing confirmation',async()=>{
  const f=await createNativeRuntime();try{
    const started=await f.runCli(['start']);expect(started.code).toBe(0);expect(JSON.parse(started.stdout)).toMatchObject({api:'running',worker:'running'});
    const status=await f.runCli(['status']);expect(status.code).toBe(0);expect(JSON.parse(status.stdout)).toMatchObject({component:{role:'cli',build:f.build},status:{installationId:f.metadata.installationId,api:{build:f.build}}});
    const submitted=await f.runCli(['selftest','--kind','digest','--value','abc']);expect(submitted.code).toBe(0);const id=JSON.parse(submitted.stdout).id;
    let job;for(let n=0;n<3;n++){await new Promise(r=>setTimeout(r,750));job=JSON.parse((await f.runCli(['jobs','get',id])).stdout);if(job.state==='succeeded')break;}expect(job).toMatchObject({state:'succeeded',result:'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'});
    const origin='http://127.0.0.1:43187';const nonceResponse=await f.h.fetch(origin+'/api/pairing/nonce',{headers:{origin}});const {nonce}=await nonceResponse.json();const nonceCookie=nonceResponse.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
    const pending=await f.h.fetch(origin+'/api/pairing/pending',{method:'POST',headers:{origin,cookie:nonceCookie,'content-type':'application/json','x-autoed-csrf':nonce},body:JSON.stringify({nonce})});const {code}=await pending.json();
    expect((await f.runCli(['pair','approve',code],'no\n')).code).not.toBe(0);
    expect((await f.runCli(['pair','approve',code],code+'\n')).code).toBe(0);
    for(const name of ['cli','mcp','installer']){const token=await f.secrets.get(f.metadata.installationId,name);expect([started.stdout,status.stdout,submitted.stdout].some(output=>output.includes(token!))).toBe(false);}
    expect((await f.runCli(['jobs','cancel',randomUUID()])).code).not.toBe(0);
    expect((await f.runCli(['stop'])).code).toBe(0);const offline=await f.runCli(['status']);expect(offline.code).not.toBe(0);expect(offline.stdout).toContain('BACKEND_UNAVAILABLE');
  }finally{await f.cleanup();}
},60000);
