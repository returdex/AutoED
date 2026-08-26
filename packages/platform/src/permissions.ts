import { execFileSync } from 'node:child_process';
import { chmodSync, lstatSync } from 'node:fs';
import { join } from 'node:path';

/** Static script only; data travels on stdin, never interpolated as PowerShell code. */
export function windowsProbe(script: string, input: object): unknown {
  if (process.platform !== 'win32') throw new Error('UNSUPPORTED_PLATFORM');
  try {
    const executable = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const code = "$ErrorActionPreference='Stop'; $p=[Console]::In.ReadToEnd()|ConvertFrom-Json; " + script;
    const result = execFileSync(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(code, 'utf16le').toString('base64')], { input: JSON.stringify(input), encoding: 'utf8', timeout: 10_000, maxBuffer: 65536, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
    return JSON.parse(result.replace(/^\uFEFF/, '').trim());
  } catch { throw new Error('NATIVE_PROBE_FAILED'); }
}

const windowsACL = `
$item=Get-Item -LiteralPath $p.path -Force;
if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'unsafe' };
$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User;
$acl=Get-Acl -LiteralPath $p.path;
if ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value) { throw 'owner' };
if ($p.protect) {
  if ($item.PSIsContainer) { $acl=New-Object Security.AccessControl.DirectorySecurity } else { $acl=New-Object Security.AccessControl.FileSecurity };
  $acl.SetOwner($sid); $acl.SetAccessRuleProtection($true,$false);
  foreach ($id in @($sid.Value,'S-1-5-18','S-1-5-32-544')) {
    $who=New-Object Security.Principal.SecurityIdentifier($id);
    if ($item.PSIsContainer) { $rule=New-Object Security.AccessControl.FileSystemAccessRule($who,'FullControl','ContainerInherit,ObjectInherit','None','Allow') }
    else { $rule=New-Object Security.AccessControl.FileSystemAccessRule($who,'FullControl','Allow') };
    $acl.AddAccessRule($rule);
  };
  Set-Acl -LiteralPath $p.path -AclObject $acl;
  $acl=Get-Acl -LiteralPath $p.path;
};
$ok=$acl.AreAccessRulesProtected -and ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -eq $sid.Value);
$seen=@();
foreach ($r in $acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])) {
  $id=$r.IdentityReference.Value;
  if ($r.IsInherited -or $id -notin @($sid.Value,'S-1-5-18','S-1-5-32-544') -or $r.AccessControlType -ne 'Allow' -or $r.FileSystemRights -ne [Security.AccessControl.FileSystemRights]::FullControl) { $ok=$false };
  $seen+=$id;
};
if ($sid.Value -notin $seen) { $ok=$false };
$ok|ConvertTo-Json -Compress;
`;

function inspect(path: string) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile()) || (stat.isFile() && stat.nlink !== 1)) throw new Error('UNSAFE_PATH');
  return stat;
}
/** Only call on a path already owned by the installation or just exclusively created. */
export function protectPath(path: string): void {
  try {
    const stat = inspect(path);
    if (process.platform === 'darwin') {
      if (stat.uid !== process.getuid!()) throw new Error('owner');
      // POSIX mode bits do not remove an inherited macOS ACL.
      execFileSync('/bin/chmod', ['-N', path], { stdio: 'ignore', timeout: 5000 });
      chmodSync(path, stat.isDirectory() ? 0o700 : 0o600);
    } else if (process.platform === 'win32') {
      if (windowsProbe(windowsACL, { path, protect: true }) !== true) throw new Error('acl');
    } else throw new Error('platform');
    verifyProtectedPath(path);
  } catch { throw new Error('INSECURE_PERMISSIONS'); }
}
export function verifyProtectedPath(path: string): true {
  try {
    const stat = inspect(path);
    if (process.platform === 'darwin') {
      if (stat.uid !== process.getuid!() || (stat.mode & 0o7777) !== (stat.isDirectory() ? 0o700 : 0o600)) throw new Error('mode');
      const acl = execFileSync('/bin/ls', ['-lde', path], { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] });
      if (/^\s*\d+:/m.test(acl)) throw new Error('acl');
    } else if (process.platform === 'win32') {
      if (windowsProbe(windowsACL, { path, protect: false }) !== true) throw new Error('acl');
    } else throw new Error('platform');
    return true;
  } catch { throw new Error('INSECURE_PERMISSIONS'); }
}
