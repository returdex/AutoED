import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {lstatSync,realpathSync} from 'node:fs';

const MAX_MANIFESTS=100,MAX_MANIFEST_BYTES=8*1024*1024,MAX_INPUT_BYTES=16*1024*1024,MAX_OUTPUT_BYTES=32768;
function safeRoot(root){const st=lstatSync(root);if(realpathSync(root)!==root||!st.isDirectory()||st.isSymbolicLink()||process.platform==='darwin'&&(st.uid!==process.getuid()||(st.mode&0o077)!==0))throw new Error('UNSAFE_SYNTHETIC_ROOT');}
function validBytes(manifests){return Array.isArray(manifests)&&manifests.length>0&&manifests.length<=MAX_MANIFESTS&&manifests.every(bytes=>Buffer.isBuffer(bytes)&&bytes.length<=MAX_MANIFEST_BYTES)&&JSON.stringify(manifests.map(bytes=>bytes.toString('base64'))).length<=MAX_INPUT_BYTES;}
function exact(value,keys){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===keys.sort().join(',');}

/** Run a bounded, one-key signing session without exporting or persisting its
 * private key. The callback may sign only bounded byte batches after seeing
 * the matching ephemeral public key and fingerprint. */
export async function withSyntheticSigner(root,callback){
  safeRoot(root);if(typeof callback!=='function'||process.versions.node!=='24.20.0')throw new Error('INVALID_SYNTHETIC_INPUT');
  const child=spawn(process.execPath,[fileURLToPath(import.meta.url),'--synthetic-session'],{cwd:root,env:{},stdio:['pipe','pipe','pipe'],windowsHide:true});let output='',ready,closed=false,waiters=new Map(),next=0;
  const fail=()=>{for(const reject of waiters.values())reject(new Error('SYNTHETIC_SIGNER_FAILED'));waiters.clear();};
  const consume=()=>{let newline;while((newline=output.indexOf('\n'))>=0){const line=output.slice(0,newline);output=output.slice(newline+1);let message;try{message=JSON.parse(line);}catch{child.kill('SIGKILL');return fail();}if(!ready){if(!exact(message,['type','publicKey','fingerprint'])||message.type!=='ready'||typeof message.publicKey!=='string'||!message.publicKey.includes('BEGIN PUBLIC KEY')||!/^[a-f0-9]{64}$/.test(message.fingerprint)){child.kill('SIGKILL');return fail();}ready=message;continue;}if(!exact(message,['type','id','signatures'])||message.type!=='signed'||!Number.isSafeInteger(message.id)||!Array.isArray(message.signatures)||message.signatures.some(value=>typeof value!=='string'||Buffer.from(value,'base64').length!==64)){child.kill('SIGKILL');return fail();}const waiter=waiters.get(message.id);if(!waiter){child.kill('SIGKILL');return fail();}waiters.delete(message.id);waiter.resolve(message.signatures);}};
  child.stdout.on('data',chunk=>{output+=chunk;if(output.length>MAX_OUTPUT_BYTES){child.kill('SIGKILL');fail();return;}consume();});child.stderr.on('data',()=>{});child.once('error',fail);const closedPromise=new Promise(resolve=>child.once('close',code=>{closed=true;if(code!==0||output||waiters.size)fail();resolve(code);}));
  const timer=setTimeout(()=>child.kill('SIGKILL'),10000);
  try{
    await new Promise((resolve,reject)=>{const interval=setInterval(()=>{if(ready){clearInterval(interval);resolve();}else if(closed){clearInterval(interval);reject(new Error('SYNTHETIC_SIGNER_FAILED'));}},5);});
    const signBytes=manifests=>{if(!validBytes(manifests)||closed)throw new Error('INVALID_SYNTHETIC_INPUT');const id=next++,payload=JSON.stringify({type:'sign',id,manifests:manifests.map(bytes=>bytes.toString('base64'))});if(payload.length>MAX_INPUT_BYTES)throw new Error('INVALID_SYNTHETIC_INPUT');return new Promise((resolve,reject)=>{waiters.set(id,{resolve,reject});child.stdin.write(payload+'\n',error=>{if(error){waiters.delete(id);reject(new Error('SYNTHETIC_SIGNER_FAILED'));}});});};
    const result=await callback(Object.freeze({publicKey:ready.publicKey,fingerprint:ready.fingerprint,sign:signBytes}));child.stdin.end(JSON.stringify({type:'close'})+'\n');if(await closedPromise!==0)throw new Error('SYNTHETIC_SIGNER_FAILED');return Object.freeze({result,publicKey:ready.publicKey,fingerprint:ready.fingerprint,signerExited:true});
  }catch(error){child.kill('SIGKILL');throw error instanceof Error&&['INVALID_SYNTHETIC_INPUT','UNSAFE_SYNTHETIC_ROOT'].includes(error.message)?error:new Error('SYNTHETIC_SIGNER_FAILED');}finally{clearTimeout(timer);}
}

/** Test support only. A separate process owns the private KeyObject and exits;
 * no private-key export, file, environment variable or parent-process return. */
export async function signSyntheticManifests(root,manifests){
  if(!validBytes(manifests))throw new Error('INVALID_SYNTHETIC_INPUT');const session=await withSyntheticSigner(root,async signer=>({signatures:await signer.sign(manifests)}));return Object.freeze({publicKey:session.publicKey,fingerprint:session.fingerprint,signatures:session.result.signatures,signerExited:session.signerExited});
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  if(process.argv.length!==3||process.argv[2]!=='--synthetic-session')throw new Error('SYNTHETIC_TEST_ENTRY_ONLY');
  const {privateKey,publicKey}=generateKeyPairSync('ed25519'),publicBytes=publicKey.export({type:'spki',format:'der'});process.stdout.write(JSON.stringify({type:'ready',publicKey:publicKey.export({type:'spki',format:'pem'}),fingerprint:createHash('sha256').update(publicBytes).digest('hex')})+'\n');
  let input='';for await(const chunk of process.stdin){input+=chunk;if(input.length>MAX_INPUT_BYTES)throw new Error('INPUT_LIMIT');let newline;while((newline=input.indexOf('\n'))>=0){const line=input.slice(0,newline);input=input.slice(newline+1);const request=JSON.parse(line);if(exact(request,['type'])&&request.type==='close'){if(input)throw new Error('INPUT_LIMIT');process.exit(0);}if(!exact(request,['type','id','manifests'])||request.type!=='sign'||!Number.isSafeInteger(request.id)||!Array.isArray(request.manifests)||!validBytes(request.manifests.map(value=>Buffer.from(value,'base64'))))throw new Error('INPUT_LIMIT');process.stdout.write(JSON.stringify({type:'signed',id:request.id,signatures:request.manifests.map(value=>sign(null,Buffer.from(value,'base64'),privateKey).toString('base64'))})+'\n');}}
  throw new Error('INPUT_LIMIT');
}
