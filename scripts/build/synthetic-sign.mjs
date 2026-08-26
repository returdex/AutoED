import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {lstatSync,realpathSync} from 'node:fs';

/** Test support only. A separate process owns the private KeyObject and exits;
 * no private-key export, file, environment variable or parent-process return. */
export async function signSyntheticManifests(root,manifests){
  const st=lstatSync(root);if(realpathSync(root)!==root||!st.isDirectory()||st.isSymbolicLink()||process.platform==='darwin'&&(st.uid!==process.getuid()||(st.mode&0o077)!==0))throw new Error('UNSAFE_SYNTHETIC_ROOT');
  if(process.versions.node!=='24.20.0'||!Array.isArray(manifests)||!manifests.length||manifests.length>100||manifests.some(b=>!Buffer.isBuffer(b)||b.length>8*1024*1024))throw new Error('INVALID_SYNTHETIC_INPUT');
  const input=JSON.stringify(manifests.map(b=>b.toString('base64')));if(input.length>16*1024*1024)throw new Error('INVALID_SYNTHETIC_INPUT');
  const child=spawn(process.execPath,[fileURLToPath(import.meta.url),'--synthetic-sign-bytes'],{cwd:root,env:{},stdio:['pipe','pipe','pipe'],windowsHide:true});let output='';child.stdout.on('data',b=>{output+=b;if(output.length>32768)child.kill('SIGKILL');});child.stderr.on('data',()=>{});
  const timer=setTimeout(()=>child.kill('SIGKILL'),10000);
  try{child.stdin.end(input);await new Promise((resolve,reject)=>{child.once('error',()=>reject(new Error('SYNTHETIC_SIGNER_FAILED')));child.once('close',resolve);});if(child.exitCode!==0)throw new Error('SYNTHETIC_SIGNER_FAILED');return {...JSON.parse(output),signerExited:true};}finally{clearTimeout(timer);}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  if(process.argv.length!==3||process.argv[2]!=='--synthetic-sign-bytes')throw new Error('SYNTHETIC_TEST_ENTRY_ONLY');
  let input='';for await(const chunk of process.stdin){input+=chunk;if(input.length>16*1024*1024)throw new Error('INPUT_LIMIT');}
  const manifests=JSON.parse(input);if(!Array.isArray(manifests)||manifests.length>100)throw new Error('INPUT_LIMIT');
  const {privateKey,publicKey}=generateKeyPairSync('ed25519');const publicBytes=publicKey.export({type:'spki',format:'der'});
  process.stdout.write(JSON.stringify({publicKey:publicKey.export({type:'spki',format:'pem'}),fingerprint:createHash('sha256').update(publicBytes).digest('hex'),signatures:manifests.map(b=>sign(null,Buffer.from(b,'base64'),privateKey).toString('base64'))}));
}
