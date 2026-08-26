import {extractArchive,downloadArchive,type DownloadTransport} from './archive-core.js';
export {assertDownloadURL,assertPublicIPv4,type DownloadTransport} from './archive-core.js';
import {protectPath,verifyProtectedPath} from '../../platform/src/permissions.js';
import {isVerifiedManifest,verifyArtifactBytes,verifyFileTree,type VerifiedManifest} from './verify-manifest.js';

export async function downloadArtifact(v:VerifiedManifest,name:string,root:string,transport?:DownloadTransport){
  if(!isVerifiedManifest(v))throw new Error('VERIFIED_MANIFEST_REQUIRED');
  const artifact=v.manifest.artifacts.find(a=>a.name===name);if(!artifact)throw new Error('ARTIFACT_NOT_LISTED');
  return downloadArchive(artifact,root,{verify:verifyProtectedPath,protect:protectPath},transport);
}
export async function extractVerifiedArchive(v:VerifiedManifest,name:string,bytes:Buffer,root:string){
  const artifact=verifyArtifactBytes(v,name,bytes);extractArchive(artifact,bytes,root,v.manifest.target.os,{verify:verifyProtectedPath,protect:protectPath});verifyFileTree(v,name,root);return root;
}
