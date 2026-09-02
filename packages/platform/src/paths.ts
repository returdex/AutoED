import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { detectPlatform } from './platform.js';
import { protectPath, verifyProtectedPath, windowsProbe } from './permissions.js';

export interface RootSelection { root: string; parent: string; excludedRoots: readonly string[] }
export function managedPaths(root: string) {
  if (!isAbsolute(root) || root !== resolve(root)) throw new Error('UNSAFE_PATH');
  return Object.freeze({ root, program: join(root, 'program'), runtime: join(root, 'runtime'), browser: join(root, 'browser'), data: join(root, 'data'), secrets: join(root, 'secrets'), staging: join(root, 'installer-staging'), profile: join(root, 'profile-private') });
}
export type ManagedPaths = ReturnType<typeof managedPaths>;
function within(parent: string, child: string): boolean { const r = relative(parent, child); return r === '' || (!isAbsolute(r) && r !== '..' && !r.startsWith('..' + sep)); }
function safeSyntax(path: string): void {
  if (!isAbsolute(path) || path.includes('\0') || path !== resolve(path) || /(?:^|[\\/])(?:\.\.|OneDrive[^\\/]*|Dropbox|Google Drive|CloudStorage|Mobile Documents)(?:[\\/]|$)/i.test(path) || (process.platform === 'win32' && (/^\\\\/.test(path) || /[<>"|?*]/.test(path) || path.slice(2).includes(':') || /[. ](?:\\|$)/.test(path)))) throw new Error('UNSAFE_PATH');
}
/** Walk lexical ancestors before realpath; never silently follow a user symlink/junction. */
export function assertSafeAncestors(path: string): void {
  safeSyntax(path);
  const root = parse(path).root; let cursor = root;
  for (const part of path.slice(root.length).split(sep).filter(Boolean)) {
    cursor = join(cursor, part);
    let st;
    try { st = lstatSync(cursor); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw new Error('UNSAFE_PATH'); }
    if (st.isSymbolicLink()) throw new Error('UNSAFE_PATH');
    if (cursor !== path && !st.isDirectory() || !st.isDirectory() && !st.isFile() || st.isFile() && st.nlink !== 1) throw new Error('UNSAFE_PATH');
    if (process.platform === 'darwin' && st.uid !== 0 && st.uid !== process.getuid!()) throw new Error('UNSAFE_PATH');
    // Shared system temporary parents are allowed only when root-owned and sticky.
    if (process.platform === 'darwin' && (st.mode & 0o022) && !(st.uid === 0 && (st.mode & 0o1000))) throw new Error('UNSAFE_PATH');
    if (process.platform === 'win32' && windowsProbe(`
      $i=Get-Item -LiteralPath $p.path -Force; $acl=Get-Acl -LiteralPath $p.path;
      $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;
      $trusted=@($sid,'S-1-5-18','S-1-5-32-544','S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464');
      $ok=(($i.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) -and ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -in $trusted);
      foreach ($r in $acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])) {
        if ($r.AccessControlType -eq 'Allow' -and $r.IdentityReference.Value -notin $trusted -and (([int]$r.FileSystemRights -band 0x000d0156) -ne 0) -and (($r.PropagationFlags -band [Security.AccessControl.PropagationFlags]::InheritOnly) -eq 0)) { $ok=$false };
      }; $ok|ConvertTo-Json -Compress`, { path: cursor }) !== true) throw new Error('UNSAFE_PATH');
    const canonical = realpathSync(cursor);
    if (process.platform === 'win32' ? canonical.toLowerCase() !== cursor.toLowerCase() : canonical !== cursor) throw new Error('UNSAFE_PATH');
  }
}
export function assertLocalVolume(path: string, fixture?: { platform: string; mountTable: string }): void {
  const platform = fixture?.platform ?? process.platform;
  if (platform === 'darwin') {
    let table: string;
    if (fixture) table = fixture.mountTable;
    else {
      table = '';
      for (let attempt = 0; attempt < 2 && !table; attempt++) {
        try { table = execFileSync('/sbin/mount', [], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }); }
        catch { if (attempt === 1) throw new Error('LOCAL_VOLUME_UNCONFIRMED'); }
      }
      if (!table) throw new Error('LOCAL_VOLUME_UNCONFIRMED');
    }
    const mounts = table.split('\n').map(line => /^(.+) on (.+) \((.+)\)$/.exec(line)).filter(match => match && within(match[2]!, path)).sort((a, b) => b![2]!.length - a![2]!.length);
    const match = mounts[0]; if (!match) throw new Error('LOCAL_VOLUME_UNCONFIRMED');
    const flags = match[3]!.split(', ');
    if (!flags.includes('local') || !/^\/dev\/disk\d/.test(match[1]!)) throw new Error('NONLOCAL_VOLUME');
  } else if (platform === 'win32' && !fixture) {
    const result = windowsProbe("$d=New-Object IO.DriveInfo([IO.Path]::GetPathRoot($p.path)); ($d.IsReady -and $d.DriveType -eq [IO.DriveType]::Fixed -and $d.DriveFormat -eq 'NTFS')|ConvertTo-Json -Compress", { path });
    if (result !== true) throw new Error('NONLOCAL_VOLUME');
  } else throw new Error('LOCAL_VOLUME_UNCONFIRMED');
}
/** Defaults are candidates for a human preview, not permission to create them. */
export function defaultRoot(): string {
  detectPlatform();
  const base = process.platform === 'darwin' ? join(realpathSync(homedir()), 'Library', 'Application Support') : process.env.LOCALAPPDATA;
  if (!base) throw new Error('UNSAFE_PATH');
  return join(base, 'AutoED-Rebuild');
}
export function preflightRoot(selection: RootSelection) {
  const platform = detectPlatform();
  safeSyntax(selection.parent); safeSyntax(selection.root);
  if (selection.root === selection.parent || !within(selection.parent, selection.root)) throw new Error('UNSAFE_PATH');
  // Known legacy roots are intrinsic; callers can only add exclusions, never remove them.
  // Lexical overlap is checked before touching these paths; legacy data is never inspected.
  const legacy = [join(homedir(), 'Documents', 'AutoED'), join(homedir(), 'Library', 'Application Support', 'AutoED')];
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) legacy.push(join(process.env.LOCALAPPDATA, 'AutoED'));
  for (const excluded of [...legacy, ...selection.excludedRoots]) { safeSyntax(excluded); if (within(excluded, selection.root) || within(selection.root, excluded)) throw new Error('UNSAFE_PATH'); }
  assertSafeAncestors(selection.parent); assertSafeAncestors(selection.root);
  if (!lstatSync(selection.parent).isDirectory()) throw new Error('UNSAFE_PATH');
  assertLocalVolume(selection.root);
  return { ...platform, rootAlias: 'managed-root', localVolume: true, permissions: existsSync(selection.root) ? 'existing_requires_ownership' : 'not_created' } as const;
}
/** Called only after installer approval of this exact selection; never adopts an existing directory. */
export function createManagedRoot(selection: RootSelection): ManagedPaths {
  preflightRoot(selection);
  if (existsSync(selection.root)) throw new Error('ROOT_ALREADY_EXISTS');
  // Parent must exist: never recursively create or change unknown ancestor directories.
  if (dirname(selection.root) !== selection.parent) throw new Error('UNSAFE_PATH');
  const paths = managedPaths(selection.root);
  mkdirSync(paths.root, { mode: 0o700 }); protectPath(paths.root);
  for (const path of Object.values(paths).filter(path => path !== paths.root)) { assertSafeAncestors(path); mkdirSync(path, { mode: 0o700 }); protectPath(path); }
  return paths;
}
export function assertManagedPath(paths: ManagedPaths, child: string): string {
  if (!child || isAbsolute(child) || child.split(/[\\/]/).some(part => part === '..' || part === '.' || !part)) throw new Error('UNSAFE_PATH');
  const target = join(paths.root, child); if (!within(paths.root, target)) throw new Error('UNSAFE_PATH');
  assertSafeAncestors(target); assertLocalVolume(target);
  let cursor = existsSync(target) ? target : dirname(target);
  while (within(paths.root, cursor)) { if (existsSync(cursor)) verifyProtectedPath(cursor); if (cursor === paths.root) break; cursor = dirname(cursor); }
  return target;
}
