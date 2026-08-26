import {createHash,createPublicKey} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));
const digest=value=>createHash('sha256').update(value).digest('hex');
const policyPath=join(here,'../../release/trust-policy.json');

export function loadTrustPolicy(){
  const policy=JSON.parse(readFileSync(policyPath,'utf8'));
  if(policy.schema!==1||policy.status!=='unestablished'||policy.approvalReceipt!==null||policy.publicKey!==null||policy.fingerprint!==null||policy.privateKeyStorage!=='os_keyring_only'||policy.keyringService!=='AutoED-Rebuild-Release')throw new Error('TRUST_POLICY_INVALID');
  return Object.freeze({...policy,sign(){throw new Error('RELEASE_TRUST_NOT_ESTABLISHED');}});
}

export function verifyBootstrapBinding(observed,expected){
  if(!observed||!expected||!/^([a-f0-9]{64})$/.test(observed.fingerprint)||!/^([a-f0-9]{64})$/.test(observed.nodeSha256)||observed.fingerprint!==expected.fingerprint||observed.nodeSha256!==expected.nodeSha256)throw new Error('BOOTSTRAP_TRUST_MISMATCH');
  const key=createPublicKey(observed.publicKey);if(key.asymmetricKeyType!=='ed25519'||digest(key.export({type:'spki',format:'der'}))!==observed.fingerprint)throw new Error('BOOTSTRAP_TRUST_MISMATCH');return true;
}
