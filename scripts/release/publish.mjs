export function createPublishPlan({preflight,approvalReceipt,version,assets}){
  if(preflight?.status!=='pass'||approvalReceipt?.schema!==1||approvalReceipt?.plan!=='01-13'||approvalReceipt?.status!=='approved'||approvalReceipt?.repository!=='returdex/AutoED'||approvalReceipt?.version!==version)throw new Error('PUBLISH_APPROVAL_REQUIRED');
  if(!Array.isArray(assets)||!assets.length||new Set(assets.map(x=>x.name)).size!==assets.length)throw new Error('PUBLISH_ASSETS_INVALID');
  return Object.freeze({status:'planned',repository:'returdex/AutoED',version,immutable:true,assets:assets.map(x=>Object.freeze({name:x.name,sha256:x.sha256,bytes:x.bytes}))});
}
