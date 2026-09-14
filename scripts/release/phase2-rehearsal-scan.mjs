#!/usr/bin/env node
import {canonical,canonicalSha256} from './phase2-gate.mjs';
import {combineSensitiveReports,scanReachableHistory,scanTrackedTree,scanWorkingTree} from './sensitive-scan.mjs';
import {isReviewedFixtureException} from './reviewed-sensitive-fixtures.mjs';

const root=process.cwd();
try{
  const report=combineSensitiveReports([
    scanTrackedTree(root,'HEAD'),
    scanReachableHistory(root,'HEAD',{isReviewedException:isReviewedFixtureException}),
    scanWorkingTree(root),
  ],{surfaces:['tracked','history','working_tree']});
  if(report.status!=='pass'||report.findings!==0)throw new Error();
  process.stdout.write(canonical({schema:1,status:'pass',findings:0,reportSha256:report.reportSha256}));
}catch{
  process.stdout.write(canonical({schema:1,status:'fail',findings:1,reportSha256:'0'.repeat(64)}));
  process.exitCode=1;
}
