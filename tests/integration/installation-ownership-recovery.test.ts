import {createHash} from 'node:crypto';
import {chmodSync,existsSync,lstatSync,mkdirSync,readFileSync,rmdirSync,unlinkSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {PassThrough} from 'node:stream';
import {afterEach,describe,expect,it} from 'vitest';
import {vi} from 'vitest';
import {protectPath} from '../../packages/platform/src/permissions.js';
import {readInstallation} from '../../packages/platform/src/installation.js';
import {createInstallPreview} from '../../packages/installer/src/preview.js';
import {confirmInstallationIdentityRecovery,prepareInstallationIdentityRecovery} from '../../packages/installer/src/ownership-recovery.js';
import {runInstallerCLI} from '../../packages/installer/src/install.js';
import {verifiedEnvelope} from '../../packages/installer/src/verify-manifest.js';
import {createRecoveryFixture} from '../../packages/test-support/src/upgrade-fixture.js';
import {observeProcess} from '../../packages/platform/src/processes.js';

const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const active:Awaited<ReturnType<typeof createRecoveryFixture>>[]=[];
afterEach(async()=>{for(const fixture of active.splice(0).reverse())await fixture.cleanupPreservingUnknown();});

async function legacyDeviceMismatch(){
  const fixture=await createRecoveryFixture();active.push(fixture);await fixture.prepareRecoveryBaseline();
  const path=join(fixture.selection.root,'installation.json'),current=JSON.parse(readFileSync(path,'utf8')),root=lstatSync(fixture.selection.root);
  const legacy={...current,schema:1,ownership:{device:root.dev+1,inode:root.ino,uid:root.uid}};delete legacy.migration;
  writeFileSync(path,JSON.stringify(legacy));protectPath(path);
  expect(()=>readInstallation(fixture.selection)).toThrow('INVALID_INSTALLATION');
  return{fixture,path,legacy,current};
}

describe('legacy installation ownership recovery',()=>{
  it('requires a bounded preview and exact confirmation before migrating the sole device mismatch',async()=>{
    const{fixture,path}=await legacyDeviceMismatch(),beforeData=fixture.dataCanary(),beforeProfile=fixture.profileCanary();
    const preview=await prepareInstallationIdentityRecovery(fixture.selection,fixture.verify,fixture.secrets);
    expect(preview).toEqual({schema:1,reason:'MOUNT_IDENTITY_CHANGED',rootAlias:'managed-root',currentVersion:'0.1.0-beta.1',retainData:true,processes:'exited',checks:['permissions','identity','launchers','release-signature','file-closures','processes','clients','installer-credential'],scopeHash:expect.stringMatching(/^[a-f0-9]{64}$/)});
    await expect(confirmInstallationIdentityRecovery(preview,'no')).rejects.toThrow('RECOVERY_CONFIRMATION_REQUIRED');
    expect(JSON.parse(readFileSync(path,'utf8')).schema).toBe(1);
    const migrated=await confirmInstallationIdentityRecovery(preview,'RECOVER '+preview.scopeHash);
    expect(migrated.schema).toBe(2);if(migrated.schema!==2)throw new Error('SCHEMA_MIGRATION_FAILED');expect(migrated.ownership.kind).toBe('darwin-volume-v1');
    expect(migrated.migration).toMatchObject({fromSchema:1,reason:'mount_identity_changed'});
    expect(readInstallation(fixture.selection).installationId).toBe(migrated.installationId);
    expect(createInstallPreview(fixture.target.manifest,fixture.selection).previousInstallation).toBe('present');
    expect(fixture.dataCanary()).toBe(beforeData);expect(fixture.profileCanary()).toBe(beforeProfile);
    writeFileSync(path,JSON.stringify({...migrated,ownership:{...migrated.ownership,volumeSha256:'0'.repeat(64)}}));protectPath(path);
    expect(()=>readInstallation(fixture.selection)).toThrow('INVALID_INSTALLATION');writeFileSync(path,JSON.stringify(migrated));protectPath(path);
  },120000);

  it('fails closed on non-device drift, credential/process evidence and proof interruption',async()=>{
    const{fixture,path,legacy,current}=await legacyDeviceMismatch();
    const write=(value:unknown)=>{writeFileSync(path,JSON.stringify(value));protectPath(path);};
    write({...legacy,ownership:{...legacy.ownership,inode:legacy.ownership.inode+1}});
    await expect(prepareInstallationIdentityRecovery(fixture.selection,fixture.verify,fixture.secrets)).rejects.toThrow('INVALID_INSTALLATION');
    write({...legacy,ownership:{...legacy.ownership,uid:legacy.ownership.uid+1}});
    await expect(prepareInstallationIdentityRecovery(fixture.selection,fixture.verify,fixture.secrets)).rejects.toThrow('INVALID_INSTALLATION');
    write(legacy);chmodSync(path,0o644);
    await expect(prepareInstallationIdentityRecovery(fixture.selection,fixture.verify,fixture.secrets)).rejects.toThrow('INVALID_INSTALLATION');protectPath(path);
    await expect(prepareInstallationIdentityRecovery({...fixture.selection,root:fixture.selection.root+'-different'},fixture.verify,fixture.secrets)).rejects.toThrow('INVALID_INSTALLATION');
    write(legacy);
    const activePath=join(fixture.selection.root,'active.json'),activeBytes=readFileSync(activePath),activeRecord=JSON.parse(activeBytes.toString());
    writeFileSync(activePath,JSON.stringify({...activeRecord,installationId:'00000000-0000-4000-8000-000000000000'}));protectPath(activePath);
    await expect(prepareInstallationIdentityRecovery(fixture.selection,fixture.verify,fixture.secrets)).rejects.toThrow('INSTALLATION_RECOVERY_UNCONFIRMED_LAUNCHERS');writeFileSync(activePath,activeBytes);protectPath(activePath);
    const launcherPath=join(fixture.selection.root,'bin/ownership.json'),launcherBytes=readFileSync(launcherPath),launcher=JSON.parse(launcherBytes.toString());
    writeFileSync(launcherPath,JSON.stringify({...launcher,files:launcher.files.map((item:Record<string,unknown>,index:number)=>index?item:{...item,sha256:'0'.repeat(64)})}));protectPath(launcherPath);
    await expect(prepareInstallationIdentityRecovery(fixture.selection,fixture.verify,fixture.secrets)).rejects.toThrow('INSTALLATION_RECOVERY_UNCONFIRMED_LAUNCHERS');writeFileSync(launcherPath,launcherBytes);protectPath(launcherPath);
    const base=join(fixture.selection.root,'installer-staging','manifests',fixture.old.manifest.manifest.build.buildId),signaturePath=join(base,'manifest.sig'),signatureBytes=readFileSync(signaturePath),badSignature=Buffer.from(signatureBytes);badSignature[0]=badSignature[0]!^1;writeFileSync(signaturePath,badSignature);protectPath(signaturePath);
    await expect(prepareInstallationIdentityRecovery(fixture.selection,fixture.verify,fixture.secrets)).rejects.toThrow('INSTALLATION_RECOVERY_UNCONFIRMED_RELEASE_SIGNATURE');writeFileSync(signaturePath,signatureBytes);protectPath(signaturePath);
    const program=fixture.old.manifest.manifest.artifacts.find(item=>item.role==='program')!,programFile=program.files.find(item=>item.type!=='symlink')!,closurePath=join(fixture.selection.root,'program',fixture.old.manifest.manifest.build.buildId,programFile.path),closureBytes=readFileSync(closurePath);writeFileSync(closurePath,Buffer.concat([closureBytes,Buffer.from('x')]));protectPath(closurePath);
    await expect(prepareInstallationIdentityRecovery(fixture.selection,fixture.verify,fixture.secrets)).rejects.toThrow('INSTALLATION_RECOVERY_UNCONFIRMED_FILE_CLOSURES');writeFileSync(closurePath,closureBytes);protectPath(closurePath);
    const lock=join(fixture.selection.root,'installer-staging','update.lock');mkdirSync(lock,{mode:0o700});protectPath(lock);
    await expect(prepareInstallationIdentityRecovery(fixture.selection,fixture.verify,fixture.secrets)).rejects.toThrow('INSTALLATION_RECOVERY_UNCONFIRMED_LOCKS');rmdirSync(lock);
    const token=await fixture.secrets.get(legacy.installationId,'installer');expect(token).not.toBeNull();await fixture.secrets.set(legacy.installationId,'installer','x'.repeat(43));
    await expect(prepareInstallationIdentityRecovery(fixture.selection,fixture.verify,fixture.secrets)).rejects.toThrow('INSTALLATION_RECOVERY_UNCONFIRMED_INSTALLER_CREDENTIAL');
    await fixture.secrets.set(legacy.installationId,'installer',token!);
    const processPath=join(fixture.selection.root,'runtime','api.json'),savedProcess=readFileSync(processPath),record=JSON.parse(savedProcess.toString()),currentProcess=await observeProcess(process.pid);expect(currentProcess).not.toBeNull();
    writeFileSync(processPath,JSON.stringify({...record,pid:process.pid,...currentProcess}));protectPath(processPath);
    await expect(prepareInstallationIdentityRecovery(fixture.selection,fixture.verify,fixture.secrets)).rejects.toThrow('INSTALLATION_RECOVERY_UNCONFIRMED_PROCESSES');
    writeFileSync(processPath,JSON.stringify({...record,pid:process.pid}));protectPath(processPath);
    await expect(prepareInstallationIdentityRecovery(fixture.selection,fixture.verify,fixture.secrets)).resolves.toMatchObject({reason:'MOUNT_IDENTITY_CHANGED'});
    writeFileSync(processPath,savedProcess);protectPath(processPath);
    const clients=join(fixture.selection.root,'runtime','clients');if(!existsSync(clients)){mkdirSync(clients,{mode:0o700});protectPath(clients);}const clientPath=join(clients,'00000000-0000-4000-8000-000000000000.json');writeFileSync(clientPath,'{}',{mode:0o600});protectPath(clientPath);
    await expect(prepareInstallationIdentityRecovery(fixture.selection,fixture.verify,fixture.secrets)).rejects.toThrow('INSTALLATION_RECOVERY_UNCONFIRMED_CLIENTS');unlinkSync(clientPath);
    const liveNonce='10000000-0000-4000-8000-000000000000',livePath=join(clients,liveNonce+'.json'),liveLease={installationId:legacy.installationId,build:activeRecord.build,pid:process.pid,nonce:liveNonce,...currentProcess,entrypoint:process.argv[1]??currentProcess!.executable,operationId:null};writeFileSync(livePath,JSON.stringify(liveLease),{mode:0o600});protectPath(livePath);
    await expect(prepareInstallationIdentityRecovery(fixture.selection,fixture.verify,fixture.secrets)).rejects.toThrow('INSTALLATION_RECOVERY_UNCONFIRMED_CLIENTS');
    writeFileSync(livePath,JSON.stringify({...liveLease,osStartIdentity:liveLease.osStartIdentity+' replaced'}));protectPath(livePath);
    await expect(prepareInstallationIdentityRecovery(fixture.selection,fixture.verify,fixture.secrets)).resolves.toMatchObject({reason:'MOUNT_IDENTITY_CHANGED'});unlinkSync(livePath);
    const clientPreview=await prepareInstallationIdentityRecovery(fixture.selection,fixture.verify,fixture.secrets),staleNonce='20000000-0000-4000-8000-000000000000',stalePath=join(clients,staleNonce+'.json');writeFileSync(stalePath,JSON.stringify({...liveLease,pid:2147483647,nonce:staleNonce,osStartIdentity:'exited',executable:'/usr/bin/false'}),{mode:0o600});protectPath(stalePath);
    await expect(confirmInstallationIdentityRecovery(clientPreview,'RECOVER '+clientPreview.scopeHash)).rejects.toThrow('INSTALLATION_RECOVERY_STALE');unlinkSync(stalePath);
    const preview=await prepareInstallationIdentityRecovery(fixture.selection,fixture.verify,fixture.secrets),bytes=readFileSync(path);
    writeFileSync(path,Buffer.concat([bytes,Buffer.from('\n')]));protectPath(path);
    await expect(confirmInstallationIdentityRecovery(preview,'RECOVER '+preview.scopeHash)).rejects.toThrow('INSTALLATION_RECOVERY_STALE');
    expect(sha(readFileSync(path))).toBe(sha(Buffer.concat([bytes,Buffer.from('\n')])));
    writeFileSync(path,bytes);protectPath(path);write(current);
  },120000);

  it('wires recovery confirmation ahead of the ordinary install preview',async()=>{
    const{fixture}=await legacyDeviceMismatch(),stage=join(fixture.parent,'recovery-cli-stage');mkdirSync(stage,{mode:0o700});protectPath(stage);
    const envelope=verifiedEnvelope(fixture.target.manifest),manifestPath=join(stage,'manifest.json'),signaturePath=join(stage,'manifest.sig');writeFileSync(manifestPath,envelope.bytes,{mode:0o600});writeFileSync(signaturePath,envelope.signature,{mode:0o600});protectPath(manifestPath);protectPath(signaturePath);
    const input=new PassThrough(),descriptor=Object.getOwnPropertyDescriptor(process,'stdin'),events:string[]=[];
    Object.defineProperty(process,'stdin',{configurable:true,value:input});
    const write=vi.spyOn(process.stdout,'write').mockImplementation(((chunk:string|Uint8Array)=>{const text=String(chunk);for(const line of text.trim().split('\n'))if(line.startsWith('{')){const event=JSON.parse(line);events.push(event.type);if(event.type==='installation_identity_recovery_preview')queueMicrotask(()=>input.write('RECOVER '+event.recovery.scopeHash+'\n'));if(event.type==='install_preview')queueMicrotask(()=>input.write('INSTALL '+event.preview.scopeHash+'\n'));}return true;}) as typeof process.stdout.write);
    try{
      const result=await runInstallerCLI({verify:fixture.verify,store:fixture.secrets,acquire:async()=>fixture.target.archives},['--preview','--manifest',manifestPath,'--signature',signaturePath,'--root',fixture.selection.root]);
      expect(result.state).toBe('complete');expect(events.slice(0,3)).toEqual(['installation_identity_recovery_preview','installation_identity_recovered','install_preview']);expect(readInstallation(fixture.selection).schema).toBe(2);
    }finally{write.mockRestore();input.end();if(descriptor)Object.defineProperty(process,'stdin',descriptor);else delete (process as unknown as Record<string,unknown>).stdin;}
  },180000);
});
