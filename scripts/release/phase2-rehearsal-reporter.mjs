import {createHash} from 'node:crypto';

const HASH=/^[a-f0-9]{64}$/;
const VITEST_PURE_FILES=/^\s*Test Files\s+([1-9]\d*)\s+passed\s+\(\1\)\s*$/;
const VITEST_PURE_TESTS=/^\s*Tests\s+([1-9]\d*)\s+passed\s+\(\1\)\s*$/;
const VITEST_ADVERSE_SUMMARY=/^\s*(?:Test Files|Tests)\s+.*\b(?:failed|skipped|todo)\b/i;
const PLAYWRIGHT_PURE_PASSED=/^\s*([1-9]\d*)\s+passed(?:\s+\([^)]*\))?\s*$/;
const PLAYWRIGHT_ADVERSE_SUMMARY=/^\s*[1-9]\d*\s+(?:failed|skipped|flaky|interrupted)(?:\s+\([^)]*\))?\s*$/i;
const fail=code=>{throw new Error(code);};
const digest=value=>createHash('sha256').update(value).digest('hex');
const text=value=>typeof value==='string'?value:Buffer.isBuffer(value)?value.toString('utf8'):'';

/**
 * Converts bounded child-process output into a deliberately small machine
 * report. Raw output, paths, stack traces and environment values never leave
 * this module. The caller owns process-group timeout/termination.
 */
/** @param {{runner?:string,exitCode?:number,signal?:string|null,stdout?:string|Buffer,stderr?:string|Buffer,commandSha256?:string}} options */
export function reportPhase2RehearsalCommand({runner,exitCode,signal=null,stdout='',stderr='',commandSha256}={}){
  try{
    if(!['rc','vitest','playwright','json'].includes(runner)||!Number.isInteger(exitCode)||exitCode<0||exitCode>255||(signal!==null&&typeof signal!=='string')||!HASH.test(commandSha256))fail('REPORT_ARGUMENT_INVALID');
    const output=`${text(stdout)}\n${text(stderr)}`;
    if(Buffer.byteLength(output)>64*1024*1024)fail('REPORT_OUTPUT_LIMIT');
    if(exitCode!==0||signal)fail('REPORT_PROCESS_FAILED');
    if(runner==='rc')return Object.freeze({schema:1,runner,status:'pass',passed:1,failed:0,skipped:0,todo:0,commandSha256});
    if(runner==='json'){
      const lines=output.split(/\r?\n/).filter(Boolean);if(lines.length!==1)fail('REPORT_MALFORMED');const value=JSON.parse(lines[0]);
      if(!value||value.status!=='pass'||!Number.isSafeInteger(value.passed)||value.passed<1||value.failed!==0||value.skipped!==0||value.todo!==0)fail('REPORT_MALFORMED');
      return Object.freeze({schema:1,runner,status:'pass',passed:value.passed,failed:0,skipped:0,todo:0,commandSha256});
    }
    const lines=output.replace(/\r/g,'').split('\n');
    if(runner==='vitest'){
      const files=lines.filter(line=>VITEST_PURE_FILES.test(line));const tests=lines.filter(line=>VITEST_PURE_TESTS.test(line));
      if(files.length!==1||tests.length!==1||lines.some(line=>VITEST_ADVERSE_SUMMARY.test(line)))fail('REPORT_MALFORMED');
      return Object.freeze({schema:1,runner,status:'pass',passed:Number(/\d+/.exec(tests[0])[0]),failed:0,skipped:0,todo:0,commandSha256});
    }
    const passed=lines.filter(line=>PLAYWRIGHT_PURE_PASSED.test(line));
    if(passed.length!==1||lines.some(line=>PLAYWRIGHT_ADVERSE_SUMMARY.test(line)))fail('REPORT_MALFORMED');
    return Object.freeze({schema:1,runner,status:'pass',passed:Number(/\d+/.exec(passed[0])[0]),failed:0,skipped:0,todo:0,commandSha256});
  }catch(error){fail(/^REPORT_[A-Z_]+$/.test(error?.message??'')?error.message:'REPORT_INVALID');}
}

/** @param {{program?:string,args?:string[],env?:Record<string,string>}} options */
export function phase2RehearsalCommandSha256({program,args=[],env={}}={}){
  if(typeof program!=='string'||!Array.isArray(args)||args.some(item=>typeof item!=='string'||item.startsWith('/')||item.includes('..'))||!env||typeof env!=='object'||Object.values(env).some(value=>typeof value!=='string'))fail('REPORT_COMMAND_INVALID');
  return digest(JSON.stringify({program,args:[...args],env:Object.fromEntries(Object.entries(env).sort())}));
}
