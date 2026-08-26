# This complete script requires an independently approved SHA-256 before execution.
param([Parameter(Mandatory=$true)][string]$StagingParent)
$ErrorActionPreference='Stop'
$TrustState='UNESTABLISHED'
$CoreSha256='UNESTABLISHED'
$CoreBase64='UNESTABLISHED'
$NodeSha256='6cac9ffbca8f6a47091e4b5c772e0606049c3871cb67d900c0cedde630e545ba'
if ($TrustState -ne 'APPROVED') { throw 'RELEASE_TRUST_NOT_ESTABLISHED' }
if ([Environment]::OSVersion.Platform -ne 'Win32NT' -or [Environment]::OSVersion.Version.Build -lt 22000 -or [IntPtr]::Size -ne 8 -or [Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString() -ne 'X64') { throw 'UNSUPPORTED_PLATFORM' }
$system=[Environment]::GetFolderPath('System'); $windows=[Environment]::GetFolderPath('Windows')
$curl=Join-Path $system 'curl.exe'; if (!(Test-Path -LiteralPath $curl -PathType Leaf)) { throw 'CURL_UNAVAILABLE' }
$version=(& $curl -q --version | Select-Object -First 1); if ($LASTEXITCODE -ne 0 -or $version -notmatch '^curl (\d+)\.(\d+)\.(\d+) ' -or [int]$Matches[1] -lt 8 -or ([int]$Matches[1] -eq 8 -and [int]$Matches[2] -lt 4)) { throw 'CURL_VERSION_UNSUPPORTED' }
$homePath=[Environment]::GetFolderPath('UserProfile'); $localData=[Environment]::GetFolderPath('LocalApplicationData')
if ($StagingParent -notmatch '^[A-Za-z]:\\' -or $StagingParent -match '[<>"|?*\x00-\x1f]' -or $StagingParent.Substring(2).Contains(':') -or $StagingParent -match '[. ](\\|$)' -or [IO.Path]::GetFullPath($StagingParent) -cne $StagingParent) { throw 'UNSAFE_STAGING' }
foreach ($legacy in @((Join-Path $homePath 'Documents\AutoED'),(Join-Path $localData 'AutoED'))) { if ($StagingParent.Equals($legacy,[StringComparison]::OrdinalIgnoreCase) -or $StagingParent.StartsWith($legacy+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'UNSAFE_STAGING' } }
if ($StagingParent -match '(?i)(^|\\)(OneDrive[^\\]*|Dropbox|Google Drive|CloudStorage)(\\|$)') { throw 'UNSAFE_STAGING' }
$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User
$trusted=@($sid.Value,'S-1-5-18','S-1-5-32-544','S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464')
$cursor=$StagingParent
while ($cursor) {
  $item=Get-Item -LiteralPath $cursor -Force
  if (!$item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'UNSAFE_STAGING' }
  $acl=Get-Acl -LiteralPath $cursor
  if ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -notin $trusted) { throw 'INSECURE_PERMISSIONS' }
  foreach ($rule in $acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])) { if ($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Value -notin $trusted -and (([int]$rule.FileSystemRights -band 0x000d0156) -ne 0) -and (($rule.PropagationFlags -band [Security.AccessControl.PropagationFlags]::InheritOnly) -eq 0)) { throw 'INSECURE_PERMISSIONS' } }
  $cursor=[IO.Path]::GetDirectoryName($cursor.TrimEnd('\')); if ($cursor -match '^[A-Za-z]:$') { $cursor+='\' }
}
$drive=New-Object IO.DriveInfo([IO.Path]::GetPathRoot($StagingParent)); if (!$drive.IsReady -or $drive.DriveType -ne 'Fixed' -or $drive.DriveFormat -ne 'NTFS') { throw 'NONLOCAL_VOLUME' }
if ($drive.AvailableFreeSpace -lt 268435456) { throw 'INSUFFICIENT_DISK' }
function Test-PublicIPv4([string]$Address) {
  $ip=[Net.IPAddress]::Parse($Address); if ($ip.AddressFamily -ne 'InterNetwork') { throw 'DOWNLOAD_IP_DENIED' }; $p=$ip.GetAddressBytes(); $a=$p[0];$b=$p[1];$c=$p[2]
  if ($a -in @(0,10,127) -or $a -ge 224 -or ($a -eq 169 -and $b -eq 254) -or ($a -eq 172 -and $b -ge 16 -and $b -le 31) -or ($a -eq 192 -and $b -in @(168,0,2)) -or ($a -eq 100 -and $b -ge 64 -and $b -le 127) -or ($a -eq 198 -and ($b -in @(18,19) -or ($b -eq 51 -and $c -eq 100))) -or ($a -eq 203 -and $b -eq 0 -and $c -eq 113)) { throw 'DOWNLOAD_IP_DENIED' }
}
function Get-BoundedNode([string]$Url,[string]$Destination) {
  for ($hop=0;$hop -lt 6;$hop++) {
    $u=[Uri]$Url
    if (!$u.IsAbsoluteUri -or $u.Scheme -ne 'https' -or $u.Host -ne 'nodejs.org' -or $u.Port -ne 443 -or $u.UserInfo -or $u.Query -or $u.Fragment -or $u.AbsolutePath -notmatch '^/dist/v24\.20\.0/[A-Za-z0-9._-]+$') { throw 'DOWNLOAD_URL_DENIED' }
    $addresses=@([Net.Dns]::GetHostAddresses($u.Host) | Where-Object AddressFamily -eq 'InterNetwork'); if (!$addresses.Count) { throw 'DOWNLOAD_IP_DENIED' }; foreach ($a in $addresses) { Test-PublicIPv4 $a.ToString() }
    & $curl -q --globoff --silent --show-error --noproxy '*' --proto '=https' --max-redirs 0 --max-filesize 134217728 --max-time 120 --resolve ($u.Host+':443:'+$addresses[0].ToString()) --dump-header (Join-Path $stage 'headers') --output $Destination $Url
    if ($LASTEXITCODE -ne 0) { throw 'DOWNLOAD_FAILED' }
    $headers=Get-Content -LiteralPath (Join-Path $stage 'headers'); $status=@($headers | Where-Object { $_ -match '^HTTP/' })[-1].Split(' ')[1]
    if ($status -eq '200') { return }; if ($status -notin @('301','302','303','307','308')) { throw 'DOWNLOAD_FAILED' }
    $locations=@($headers | Where-Object { $_ -match '^Location:\s*(\S+)\s*$' }); if ($locations.Count -ne 1) { throw 'DOWNLOAD_FAILED' }; $Url=$locations[0] -replace '^Location:\s*',''
  }; throw 'DOWNLOAD_REDIRECT_LIMIT'
}
# Exclusive creation; never adopt a pre-existing stage or touch legacy installations.
$stage=Join-Path $StagingParent ('autoed-bootstrap.'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage -ErrorAction Stop | Out-Null
$acl=New-Object Security.AccessControl.DirectorySecurity; $acl.SetOwner($sid);$acl.SetAccessRuleProtection($true,$false)
foreach ($id in @($sid.Value,'S-1-5-18','S-1-5-32-544')) { $who=New-Object Security.Principal.SecurityIdentifier($id);$rule=New-Object Security.AccessControl.FileSystemAccessRule($who,'FullControl','ContainerInherit,ObjectInherit','None','Allow');$acl.AddAccessRule($rule) };Set-Acl -LiteralPath $stage -AclObject $acl
$zip=Join-Path $stage 'node.zip';Get-BoundedNode 'https://nodejs.org/dist/v24.20.0/node-v24.20.0-win-x64.zip' $zip
if ((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $NodeSha256) { throw 'NODE_INTEGRITY' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$node=Join-Path $stage 'node.exe';$archive=[IO.Compression.ZipFile]::OpenRead($zip)
try { $entries=@($archive.Entries | Where-Object FullName -ceq 'node-v24.20.0-win-x64/node.exe'); if ($entries.Count -ne 1 -or $entries[0].Length -gt 134217728 -or $entries[0].Length -lt 1) { throw 'NODE_ARCHIVE_INVALID' };$input=$entries[0].Open();$output=[IO.File]::Open($node,'CreateNew','Write','None');try { $buffer=New-Object byte[] 65536;$total=0;while (($n=$input.Read($buffer,0,$buffer.Length)) -gt 0) { $total+=$n;if ($total -gt $entries[0].Length) { throw 'NODE_ARCHIVE_INVALID' };$output.Write($buffer,0,$n) };if ($total -ne $entries[0].Length) { throw 'NODE_ARCHIVE_INVALID' };$output.Flush($true) } finally { $output.Dispose();$input.Dispose() } } finally { $archive.Dispose() }
$core=Join-Path $stage 'bootstrap-core.mjs';[IO.File]::WriteAllBytes($core,[Convert]::FromBase64String($CoreBase64))
if ((Get-FileHash -LiteralPath $core -Algorithm SHA256).Hash.ToLowerInvariant() -ne $CoreSha256) { throw 'BOOTSTRAP_CORE_INTEGRITY' }
function Invoke-VerifiedNode([string[]]$NodeArguments,[bool]$Capture) {
  $start=New-Object Diagnostics.ProcessStartInfo;$start.FileName=$node;$start.UseShellExecute=$false;$start.Arguments=($NodeArguments | ForEach-Object { '"'+$_+'"' }) -join ' ';$start.EnvironmentVariables.Clear()
  foreach ($item in @{SystemRoot=$windows;WINDIR=$windows;PATH=$system;TEMP=$stage;TMP=$stage;USERPROFILE=$homePath;LOCALAPPDATA=$localData}.GetEnumerator()) { $start.EnvironmentVariables[$item.Key]=$item.Value }
  $start.RedirectStandardOutput=$Capture;$child=New-Object Diagnostics.Process;$child.StartInfo=$start
  if (!$child.Start()) { throw 'NODE_START_FAILED' };if (!$child.WaitForExit(300000)) { $child.Kill();$child.WaitForExit();throw 'NODE_TIMEOUT' };if ($child.ExitCode -ne 0) { throw 'BOOTSTRAP_FAILED' };if ($Capture) { return $child.StandardOutput.ReadToEnd().Trim() }
}
if ((Invoke-VerifiedNode @('--version') $true) -ne 'v24.20.0') { throw 'NODE_VERSION_MISMATCH' }
Invoke-VerifiedNode @($core,$stage) $false
