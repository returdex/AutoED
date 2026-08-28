import {createHash,createPrivateKey,createPublicKey,generateKeyPairSync,randomBytes,sign,verify} from 'node:crypto';
import {chmodSync,existsSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {dirname,isAbsolute,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));
const digest=value=>createHash('sha256').update(value).digest('hex');
const policyPath=join(here,'../../release/trust-policy.json');
const keyAccount='release-ed25519-private-v1';
const expectedScope=Object.freeze({algorithm:'Ed25519',privateKeyStorage:'os_keyring_only',keyringService:'AutoED-Rebuild-Release',privateKeyExport:false,cloudCI:false,platformCodeSigning:false,publicTrustUse:'complete_install_prompt_fixed_trust',githubOwner:'returdex',repository:'AutoED',repositoryMutation:'plan_13_after_conflict_check'});

function exactKeys(value,keys){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');}
export function readApproval(path){
  let value;try{value=JSON.parse(readFileSync(path,'utf8'));}catch{throw new Error('RELEASE_APPROVAL_INVALID');}
  if(!exactKeys(value,['schema','plan','approvedAt','approvalSignal','scope'])||value.schema!==1||value.plan!=='01-12'||value.approvalSignal!=='确认'||!/^2026-08-29(?:T.*)?$/.test(value.approvedAt)||!exactKeys(value.scope,Object.keys(expectedScope))||Object.entries(expectedScope).some(([key,expected])=>value.scope[key]!==expected))throw new Error('RELEASE_APPROVAL_INVALID');
  return Object.freeze(value);
}
function approvalDigest(path){return digest(readFileSync(path));}
function parseRoot(path){
  let value;try{value=JSON.parse(readFileSync(path,'utf8'));}catch{throw new Error('RELEASE_TRUST_INVALID');}
  if(!exactKeys(value,['schema','status','algorithm','publicKey','fingerprint','approvalSha256','keyringService','keyringAccount','establishedByPlan'])||value.schema!==1||value.status!=='established'||value.algorithm!=='Ed25519'||value.keyringService!=='AutoED-Rebuild-Release'||value.keyringAccount!==keyAccount||value.establishedByPlan!=='01-12'||!/^[a-f0-9]{64}$/.test(value.fingerprint)||!/^[a-f0-9]{64}$/.test(value.approvalSha256))throw new Error('RELEASE_TRUST_INVALID');
  const publicKey=createPublicKey(value.publicKey);if(publicKey.asymmetricKeyType!=='ed25519'||digest(publicKey.export({type:'spki',format:'der'}))!==value.fingerprint)throw new Error('RELEASE_TRUST_INVALID');return{value,publicKey};
}
async function nativeStore(){const {AsyncEntry}=await import('@napi-rs/keyring');return new AsyncEntry('AutoED-Rebuild-Release',keyAccount);}
function safePath(path){const absolute=resolve(path);if(!isAbsolute(absolute)||!absolute.startsWith(resolve(here,'../..')+'/'))throw new Error('RELEASE_PATH_INVALID');return absolute;}
function atomicJSON(path,value){const target=safePath(path),temporary=target+'.tmp';writeFileSync(temporary,JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});chmodSync(temporary,0o600);renameSync(temporary,target);chmodSync(target,0o600);}

export async function initializeTrust({receiptPath,outputPath,entry}){
  readApproval(receiptPath);const approvalSha256=approvalDigest(receiptPath),store=entry??await nativeStore(),existing=await store.getPassword();
  if(existing!==undefined&&existing!==null)throw new Error(existsSync(outputPath)?'RELEASE_TRUST_ALREADY_ESTABLISHED':'RELEASE_KEY_STATE_UNKNOWN');
  const {privateKey,publicKey}=generateKeyPairSync('ed25519'),privateDer=privateKey.export({type:'pkcs8',format:'der'}),publicPem=publicKey.export({type:'spki',format:'pem'}).toString(),fingerprint=digest(publicKey.export({type:'spki',format:'der'}));
  try{await store.setPassword(privateDer.toString('base64'));}catch{privateDer.fill(0);throw new Error('RELEASE_KEY_STORE_UNAVAILABLE');}privateDer.fill(0);
  const root={schema:1,status:'established',algorithm:'Ed25519',publicKey:publicPem,fingerprint,approvalSha256,keyringService:'AutoED-Rebuild-Release',keyringAccount:keyAccount,establishedByPlan:'01-12'};
  try{atomicJSON(outputPath,root);}catch{try{await store.deleteCredential();}catch{}throw new Error('RELEASE_TRUST_WRITE_FAILED');}
  return Object.freeze({status:'established',fingerprint,approvalSha256});
}
async function privateForRoot(root,entry){const store=entry??await nativeStore();let encoded;try{encoded=await store.getPassword();}catch{throw new Error('RELEASE_KEY_STORE_UNAVAILABLE');}if(typeof encoded!=='string'||encoded.length<32||encoded.length>4096)throw new Error('RELEASE_KEY_UNAVAILABLE');let bytes;try{bytes=Buffer.from(encoded,'base64');const privateKey=createPrivateKey({key:bytes,format:'der',type:'pkcs8'}),derived=createPublicKey(privateKey);if(!derived.export({type:'spki',format:'der'}).equals(root.publicKey.export({type:'spki',format:'der'})))throw new Error();return privateKey;}catch{throw new Error('RELEASE_KEY_MISMATCH');}finally{bytes?.fill(0);encoded=null;}}
export async function selfcheckTrust({publicPath,receiptPath,entry}){const {value,publicKey}=parseRoot(publicPath);if(receiptPath&&value.approvalSha256!==approvalDigest(receiptPath))throw new Error('RELEASE_APPROVAL_MISMATCH');const privateKey=await privateForRoot({publicKey},entry),challenge=randomBytes(32),signature=sign(null,challenge,privateKey);if(!verify(null,challenge,publicKey,signature))throw new Error('RELEASE_KEY_MISMATCH');return Object.freeze({status:'pass',fingerprint:value.fingerprint,keyringAvailable:true});}
export async function signReleaseFile({publicPath,inputPath,outputPath,entry}){const {value,publicKey}=parseRoot(publicPath),privateKey=await privateForRoot({publicKey},entry),bytes=readFileSync(safePath(inputPath)),signature=sign(null,bytes,privateKey);if(!verify(null,bytes,publicKey,signature))throw new Error('RELEASE_SIGN_FAILED');const target=safePath(outputPath);writeFileSync(target,signature,{mode:0o600,flag:'wx'});chmodSync(target,0o600);return Object.freeze({status:'signed',fingerprint:value.fingerprint,sha256:digest(bytes),signatureSha256:digest(signature)});}

export function loadTrustPolicy(){
  const policy=JSON.parse(readFileSync(policyPath,'utf8'));
  if(policy.schema!==1||policy.status!=='unestablished'||policy.approvalReceipt!==null||policy.publicKey!==null||policy.fingerprint!==null||policy.privateKeyStorage!=='os_keyring_only'||policy.keyringService!=='AutoED-Rebuild-Release')throw new Error('TRUST_POLICY_INVALID');
  return Object.freeze({...policy,sign(){throw new Error('RELEASE_TRUST_NOT_ESTABLISHED');}});
}

export function verifyBootstrapBinding(observed,expected){
  if(!observed||!expected||!/^([a-f0-9]{64})$/.test(observed.fingerprint)||!/^([a-f0-9]{64})$/.test(observed.nodeSha256)||observed.fingerprint!==expected.fingerprint||observed.nodeSha256!==expected.nodeSha256)throw new Error('BOOTSTRAP_TRUST_MISMATCH');
  const key=createPublicKey(observed.publicKey);if(key.asymmetricKeyType!=='ed25519'||digest(key.export({type:'spki',format:'der'}))!==observed.fingerprint)throw new Error('BOOTSTRAP_TRUST_MISMATCH');return true;
}

function option(args,name,required=true){const index=args.indexOf(name),value=index>=0?args[index+1]:null;if(required&&(!value||value.startsWith('--')))throw new Error('RELEASE_ARGUMENT_INVALID');return value;}
async function main(){const [command,...args]=process.argv.slice(2);let result;if(command==='check-approval')result={status:'approved',approvalSha256:approvalDigest(option(args,'--receipt')),...{scope:readApproval(option(args,'--receipt')).scope}};else if(command==='init')result=await initializeTrust({receiptPath:option(args,'--receipt'),outputPath:option(args,'--out',false)??join(here,'../../release/trust-root.json')});else if(command==='selfcheck')result=await selfcheckTrust({publicPath:option(args,'--public'),receiptPath:option(args,'--receipt',false)});else if(command==='sign')result=await signReleaseFile({publicPath:option(args,'--public'),inputPath:option(args,'--input'),outputPath:option(args,'--out')});else throw new Error('RELEASE_ARGUMENT_INVALID');process.stdout.write(JSON.stringify(result)+'\n');}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{const allowed=new Set(['RELEASE_APPROVAL_INVALID','RELEASE_ARGUMENT_INVALID','RELEASE_PATH_INVALID','RELEASE_KEY_STATE_UNKNOWN','RELEASE_TRUST_ALREADY_ESTABLISHED','RELEASE_KEY_STORE_UNAVAILABLE','RELEASE_KEY_UNAVAILABLE','RELEASE_KEY_MISMATCH','RELEASE_TRUST_INVALID','RELEASE_TRUST_WRITE_FAILED','RELEASE_APPROVAL_MISMATCH','RELEASE_SIGN_FAILED']);process.stderr.write((allowed.has(error?.message)?error.message:'RELEASE_TRUST_FAILED')+'\n');process.exitCode=1;});
