const REVIEWED_SENSITIVE_FIXTURES=Object.freeze([
  Object.freeze(['cef27bea75b9b60bd08288674cf66fcbe3e14518','scripts/release/preflight.mjs']),
  Object.freeze(['90eaa763d659068307640c66381003243a47cc0c','tests/integration/release-gates.test.ts']),
  Object.freeze(['2624b58ba44aa0c961c04f58421964ed8e56d127','tests/integration/release-gates.test.ts']),
]);

export function isReviewedFixtureException(hash,path){
  return REVIEWED_SENSITIVE_FIXTURES.some(([reviewedHash,reviewedPath])=>reviewedHash===hash&&reviewedPath===path);
}
