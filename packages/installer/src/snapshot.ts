import Database from 'better-sqlite3';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,lstatSync,mkdirSync,openSync,closeSync,fsyncSync,statfsSync,readSync,fstatSync} from 'node:fs';
import {join} from 'node:path';
import {z} from 'zod';
import {readInstallation} from '../../platform/src/installation.js';
import {assertManagedPath,managedPaths,type RootSelection} from '../../platform/src/paths.js';
import {protectPath} from '../../platform/src/permissions.js';
import {readGate} from '../../persistence/src/database.js';
import {writeInstallerRecord} from './launchers.js';
const Record=z.strictObject({schema:z.literal(1),installationId:z.uuid(),operationId:z.uuid(),generation:z.number().int().nonnegative(),writeGeneration:z.number().int().nonnegative(),databaseHash:z.string().regex(/^[a-f0-9]{64}$/),databaseBytes:z.number().int().positive(),objects:z.array(z.never()).max(0)});
export interface Snapshot {root:string;databasePath:string;operationId:string}
export function databaseDigest(path:string){const fd=openSync(path,'r');try{const stat=fstatSync(fd);if(!stat.isFile()||stat.nlink!==1||stat.size<1||stat.size>8*1024**3)throw new Error('SNAPSHOT_SIZE_LIMIT');const hash=createHash('sha256'),chunk=Buffer.alloc(1024*1024);let position=0;while(position<stat.size){const n=readSync(fd,chunk,0,Math.min(chunk.length,stat.size-position),position);if(n===0)throw new Error('SNAPSHOT_INVALID');hash.update(chunk.subarray(0,n));position+=n;}const after=fstatSync(fd);if(after.size!==stat.size||after.mtimeMs!==stat.mtimeMs)throw new Error('SNAPSHOT_INVALID');return {databaseHash:hash.digest('hex'),databaseBytes:stat.size};}finally{closeSync(fd);}}
function state(db:Database.Database,operationId:string,generation:number){const gate=readGate(db);if(gate.generation!==generation)throw new Error('GENERATION_MISMATCH');if(gate.state!=='exclusive'||gate.operationId!==operationId)throw new Error('MAINTENANCE_OWNERSHIP_MISMATCH');if(db.pragma('user_version',{simple:true})!==1)throw new Error('SCHEMA_INCOMPATIBLE');return (db.prepare('SELECT write_generation AS value FROM maintenance_generation WHERE id=1').get() as {value:number}).value;}
/** Schema 1 has synthetic SQL results only: no referenced object files and no Profile traversal. */
export async function createSnapshot(selection:RootSelection,db:Database.Database,context:{operationId:string;generation:number}):Promise<Snapshot>{
  z.uuid().parse(context.operationId);const metadata=readInstallation(selection),paths=managedPaths(selection.root),source=assertManagedPath(paths,'data/jobs.sqlite');if(db.name!==source)throw new Error('DATABASE_OWNERSHIP_UNCONFIRMED');
  const writeGeneration=state(db,context.operationId,context.generation),root=assertManagedPath(paths,`installer-staging/snapshot-${context.operationId}`);if(existsSync(root))throw new Error('SNAPSHOT_EXISTS');
  const disk=statfsSync(paths.staging),pages=db.pragma('page_count',{simple:true}) as number,pageSize=db.pragma('page_size',{simple:true}) as number;if(disk.bavail*disk.bsize<pages*pageSize+16*1024*1024)throw new Error('DISK_LIMIT');
  mkdirSync(root,{mode:0o700});protectPath(root);const databasePath=join(root,'snapshot.sqlite'),fd=openSync(databasePath,'wx',0o600);closeSync(fd);protectPath(databasePath);const owned=lstatSync(databasePath),deadline=performance.now()+30000;
  await db.backup(databasePath,{progress:()=>{if(performance.now()>deadline||state(db,context.operationId,context.generation)!==writeGeneration)throw new Error('SNAPSHOT_FENCE_CHANGED');return 128;}});
  if(state(db,context.operationId,context.generation)!==writeGeneration)throw new Error('SNAPSHOT_FENCE_CHANGED');const actual=lstatSync(databasePath);if(actual.dev!==owned.dev||actual.ino!==owned.ino||actual.nlink!==1)throw new Error('SNAPSHOT_INVALID');
  const copy=new Database(databasePath,{fileMustExist:true});try{if(copy.pragma('integrity_check',{simple:true})!=='ok'||state(copy,context.operationId,context.generation)!==writeGeneration)throw new Error('SNAPSHOT_INVALID');if(copy.pragma('journal_mode = DELETE',{simple:true})!=='delete')throw new Error('SNAPSHOT_INVALID');}finally{copy.close();}
  const flush=openSync(databasePath,'r');try{fsyncSync(flush);}finally{closeSync(flush);}
  writeInstallerRecord(join(root,'snapshot.json'),Record.parse({schema:1,installationId:metadata.installationId,...context,writeGeneration,...databaseDigest(databasePath),objects:[]}));return {root,databasePath,operationId:context.operationId};
}
export function verifySnapshot(selection:RootSelection,snapshot:Snapshot){try{
  const metadata=readInstallation(selection),root=assertManagedPath(managedPaths(selection.root),`installer-staging/snapshot-${z.uuid().parse(snapshot.operationId)}`);if(snapshot.root!==root||snapshot.databasePath!==join(root,'snapshot.sqlite'))throw new Error();
  const recordPath=assertManagedPath(managedPaths(selection.root),`installer-staging/snapshot-${snapshot.operationId}/snapshot.json`);if(lstatSync(recordPath).size>4096)throw new Error();const record=Record.parse(JSON.parse(readFileSync(recordPath,'utf8')));const path=assertManagedPath(managedPaths(selection.root),`installer-staging/snapshot-${snapshot.operationId}/snapshot.sqlite`),actual=databaseDigest(path);if(record.installationId!==metadata.installationId||record.operationId!==snapshot.operationId||record.databaseBytes!==actual.databaseBytes||record.databaseHash!==actual.databaseHash)throw new Error();
  const copy=new Database(path,{readonly:true,fileMustExist:true});try{if(copy.pragma('integrity_check',{simple:true})!=='ok'||state(copy,record.operationId,record.generation)!==record.writeGeneration)throw new Error();}finally{copy.close();}return record;
}catch{throw new Error('SNAPSHOT_INVALID');}}
