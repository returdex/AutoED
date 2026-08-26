#!/usr/bin/env node
import {chmodSync,closeSync,fsyncSync,mkdirSync,openSync,realpathSync,renameSync,statSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

function fail(code){process.stdout.write(JSON.stringify({schema:1,synthetic:true,result:'fail',code})+'\n');process.exitCode=1;}
const args=process.argv.slice(2),value=name=>{const i=args.indexOf(name);return i<0?null:args[i+1]},scenario=value('--scenario'),rootArg=value('--root'),target=value('--target')??`${process.platform}-${process.arch}`;
if(!['jobs','permissions','install-recovery'].includes(scenario)||!rootArg)fail('DIAGNOSTIC_ARGUMENT_INVALID');
else try{
  const root=realpathSync(rootArg),temporary=realpathSync(tmpdir());
  if(root===temporary||!root.startsWith(temporary+'/')||statSync(root).isSymbolicLink())throw Error('DIAGNOSTIC_ROOT_UNSAFE');
  const expected=`${process.platform}-${process.arch}`;
  if(target!==expected){process.stdout.write(JSON.stringify({schema:1,synthetic:true,scenario,target,os:process.platform,arch:process.arch,result:'not_run',code:'NATIVE_PLATFORM_NOT_RUN'})+'\n');}
  else {
    const owned=join(root,'diagnostic');mkdirSync(owned,{mode:0o700});const canary=join(owned,'owned-canary');writeFileSync(canary,scenario,{mode:0o600});if(readFileSync(canary,'utf8')!==scenario)throw Error('DIAGNOSTIC_IO_FAILED');const codes=['OWNED_ROOT_PROTECTED','NO_USER_DATA'];
    if(scenario==='permissions'){chmodSync(owned,0o700);chmodSync(canary,0o600);if((statSync(owned).mode&0o777)!==0o700||(statSync(canary).mode&0o777)!==0o600)throw Error('PERMISSION_PROBE_FAILED');codes.push('ACL_PROTECTED');}
    if(scenario==='jobs'){const moduleURL=import.meta.resolve('better-sqlite3'),script=fileURLToPath(import.meta.url),program=process.env.AUTOED_PACKAGED_DIAGNOSTIC==='1'?dirname(dirname(script)):dirname(dirname(dirname(script)));if(!fileURLToPath(moduleURL).startsWith(join(program,'node_modules')+'/'))throw Error('DEPENDENCY_CLOSURE_ESCAPE');const {default:Database}=await import('better-sqlite3');const path=join(owned,'jobs.sqlite'),a=new Database(path),b=new Database(path);try{a.pragma('journal_mode = WAL');a.exec("CREATE TABLE jobs(id TEXT PRIMARY KEY,state TEXT,generation INTEGER,owner TEXT); INSERT INTO jobs VALUES ('job','pending',1,NULL)");const claim=a.prepare("UPDATE jobs SET state='running',owner='worker-a' WHERE id='job' AND state='pending' AND generation=1").run();const fenced=b.prepare("UPDATE jobs SET state='running',owner='worker-b' WHERE id='job' AND state='pending' AND generation=1").run();const cancelled=a.prepare("UPDATE jobs SET state='cancelled' WHERE id='job' AND owner='worker-a' AND generation=1").run();if(claim.changes!==1||fenced.changes!==0||cancelled.changes!==1)throw Error('JOB_FENCE_FAILED');codes.push('MODULE_CLOSURE_LOCAL','DUAL_CONNECTION_FENCED','CANCEL_CONFIRMED');}finally{b.close();a.close();}}
    if(scenario==='install-recovery'){const intent=join(owned,'000-intent.json'),done=join(owned,'000-done.json');writeFileSync(intent,JSON.stringify({schema:1,stage:'candidate'}),{mode:0o600});const fd=openSync(intent,'r');try{fsyncSync(fd);}finally{closeSync(fd);}renameSync(intent,done);const directory=openSync(owned,'r');try{fsyncSync(directory);}finally{closeSync(directory);}if(JSON.parse(readFileSync(done,'utf8')).stage!=='candidate')throw Error('RECOVERY_JOURNAL_FAILED');codes.push('INTENT_DURABLE','RECOVERY_REOPENED');}
    rmSync(owned,{recursive:true});process.stdout.write(JSON.stringify({schema:1,synthetic:true,scenario,target,os:process.platform,arch:process.arch,result:'pass',codes})+'\n');
  }
}catch(error){fail(error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'DIAGNOSTIC_FAILED');}
