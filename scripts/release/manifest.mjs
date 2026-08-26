import {ReleaseManifestSchema} from '../../packages/installer/src/verify-manifest.ts';

export function buildManifestBytes(value){
  const manifest=ReleaseManifestSchema.parse(value);
  return Buffer.from(JSON.stringify(manifest));
}
