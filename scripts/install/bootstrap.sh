#!/bin/sh
# Release packaging replaces these constants only after the Plan 12 trust gate.
# Users must verify this complete script's separately approved SHA-256 before execution.
set -eu
umask 077
TRUST_STATE='UNESTABLISHED'
CORE_SHA256='UNESTABLISHED'
CORE_BASE64='UNESTABLISHED'
NODE_SHA256='40e5607e5ecb3db9192723776da2d75d966260fc74a7a9e731c1bd67dda96bc8'
fail() { printf '%s\n' "$1" >&2; exit 1; }
[ "$TRUST_STATE" = 'APPROVED' ] || fail RELEASE_TRUST_NOT_ESTABLISHED
[ "$#" = 2 ] && [ "$1" = '--staging-parent' ] || fail INVALID_ARGUMENT
[ "$(/usr/bin/uname -s)" = Darwin ] && [ "$(/usr/bin/uname -m)" = arm64 ] || fail UNSUPPORTED_PLATFORM
parent=$2
case "$parent" in /*) ;; *) fail UNSAFE_STAGING ;; esac
home=$(/usr/bin/dscl . -read "/Users/$(/usr/bin/id -un)" NFSHomeDirectory | /usr/bin/sed 's/^NFSHomeDirectory: //')
[ -n "$home" ] || fail UNSAFE_STAGING
case "$parent" in "$home/Documents/AutoED"|"$home/Documents/AutoED/"*|"$home/Library/Application Support/AutoED"|"$home/Library/Application Support/AutoED/"*) fail UNSAFE_STAGING ;; esac
printf '%s' "$parent" | LC_ALL=C /usr/bin/grep '[[:cntrl:]]' >/dev/null && fail UNSAFE_STAGING
[ -d "$parent" ] && [ ! -L "$parent" ] || fail UNSAFE_STAGING
[ "$(cd "$parent" && /bin/pwd -P)" = "$parent" ] || fail UNSAFE_STAGING
case "$parent" in /Volumes/*|/Network/*|*/Library/CloudStorage/*|*/Library/Mobile\ Documents/*) fail UNSAFE_STAGING ;; esac
cursor=$parent; uid=$(/usr/bin/id -u)
while [ "$cursor" != '/' ]; do
  [ -d "$cursor" ] && [ ! -L "$cursor" ] || fail UNSAFE_STAGING
  owner=$(/usr/bin/stat -f '%u' "$cursor"); mode=$(/usr/bin/stat -f '%OLp' "$cursor")
  [ "$owner" = 0 ] || [ "$owner" = "$uid" ] || fail UNSAFE_STAGING
  if [ "$((0$mode & 022))" != 0 ]; then [ "$owner" = 0 ] && [ "$((0$mode & 01000))" != 0 ] || fail UNSAFE_STAGING; fi
  /bin/ls -lde "$cursor" | /usr/bin/grep -E '^[[:space:]]*[0-9]+:.* allow .*write|^[[:space:]]*[0-9]+:.* allow .*add_|^[[:space:]]*[0-9]+:.* allow .*delete' >/dev/null && fail UNSAFE_STAGING
  cursor=$(/usr/bin/dirname "$cursor")
done
/sbin/mount | /usr/bin/awk -v p="$parent" ' {n=split($0,a," on ");if(n!=2)next;i=index(a[2]," (");if(!i)next;m=substr(a[2],1,i-1);f=substr(a[2],i+2);if((p==m||m=="/"||index(p,m"/")==1)&&length(m)>best){best=length(m);ok=a[1]~/^\/dev\/disk[0-9]/&&f~/(^|, )local(,|\))/}} END {exit !ok}' || fail NONLOCAL_VOLUME
# --max-filesize bounds unknown-length responses only in curl >= 8.4.0.
/usr/bin/curl -q --version | /usr/bin/awk 'NR==1 {split($2,v,".");exit !(v[1]>8 || v[1]==8 && v[2]>=4)}' || fail CURL_VERSION_UNSUPPORTED
public_ipv4() { printf '%s\n' "$1" | /usr/bin/awk -F. 'NF!=4 {exit 1} {for(i=1;i<=4;i++)if($i!~/^[0-9]+$/||$i>255)exit 1; a=$1;b=$2;c=$3;if(a==0||a==10||a==127||a>=224||a==169&&b==254||a==172&&b>=16&&b<=31||a==192&&(b==168||b==0||b==2)||a==100&&b>=64&&b<=127||a==198&&(b==18||b==19||b==51&&c==100)||a==203&&b==0&&c==113)exit 1}'; }
# Every hop is independently approved, resolved and pinned; no proxy or curlrc.
download() {
  url=$1; destination=$2; maximum=$3; hop=0
  while [ "$hop" -lt 6 ]; do
    case "$url" in https://nodejs.org/dist/v24.20.0/*) host=nodejs.org ;; *) fail DOWNLOAD_URL_DENIED ;; esac
    case "$url" in *'@'*|*'%'*|*'#'*|*'?'*|*'\\'*|*' '* ) fail DOWNLOAD_URL_DENIED ;; esac
    addresses=$(/usr/bin/dscacheutil -q host -a name "$host" | /usr/bin/awk '/^ip_address: / {print $2}')
    [ -n "$addresses" ] || fail DOWNLOAD_IP_DENIED
    address=''
    for candidate in $addresses; do public_ipv4 "$candidate" || fail DOWNLOAD_IP_DENIED; [ -n "$address" ] || address=$candidate; done
    /usr/bin/curl -q --globoff --silent --show-error --noproxy '*' --proto '=https' --max-redirs 0 --max-filesize "$maximum" --max-time 120 --resolve "$host:443:$address" --dump-header "$stage/headers" --output "$destination" "$url" || fail DOWNLOAD_FAILED
    code=$(/usr/bin/awk '/^HTTP\// {code=$2} END {print code}' "$stage/headers")
    [ "$code" != 200 ] || return 0
    case "$code" in 301|302|303|307|308) url=$(/usr/bin/awk 'tolower($1)=="location:" {sub(/\r$/,""); print $2}' "$stage/headers") ;; *) fail DOWNLOAD_FAILED ;; esac
    hop=$((hop+1))
  done
  fail DOWNLOAD_REDIRECT_LIMIT
}
# No managed installation is changed; failed stages remain available for exact recovery.
stage=$(/usr/bin/mktemp -d "$parent/autoed-bootstrap.XXXXXXXX") || fail STAGING_FAILED
/bin/chmod -N "$stage" && /bin/chmod 700 "$stage" || fail INSECURE_PERMISSIONS
available=$(/bin/df -Pk "$stage" | /usr/bin/awk 'END {print $4}')
[ "$available" -ge 262144 ] || fail INSUFFICIENT_DISK
download 'https://nodejs.org/dist/v24.20.0/node-v24.20.0-darwin-arm64.tar.gz' "$stage/node.tar.gz" 67108864
actual=$(/usr/bin/shasum -a 256 "$stage/node.tar.gz" | /usr/bin/awk '{print $1}')
[ "$actual" = "$NODE_SHA256" ] || fail NODE_INTEGRITY
# Extract only the hash-pinned official regular Node executable, never npm links.
/usr/bin/tar -tvzf "$stage/node.tar.gz" 'node-v24.20.0-darwin-arm64/bin/node' | /usr/bin/awk 'NR==1 && substr($1,1,1)=="-" {ok=1} END {exit !(ok&&NR==1)}' || fail NODE_ARCHIVE_INVALID
/usr/bin/tar -xOzf "$stage/node.tar.gz" 'node-v24.20.0-darwin-arm64/bin/node' > "$stage/node"
/bin/chmod -N "$stage/node" && /bin/chmod 700 "$stage/node" || fail INSECURE_PERMISSIONS
printf '%s' "$CORE_BASE64" | /usr/bin/base64 -D > "$stage/bootstrap-core.mjs"
actual=$(/usr/bin/shasum -a 256 "$stage/bootstrap-core.mjs" | /usr/bin/awk '{print $1}')
[ "$actual" = "$CORE_SHA256" ] || fail BOOTSTRAP_CORE_INTEGRITY
[ "$(/usr/bin/env -i PATH=/usr/bin:/bin "$stage/node" --version)" = 'v24.20.0' ] || fail NODE_VERSION_MISMATCH
exec /usr/bin/env -i PATH=/usr/bin:/bin "$stage/node" "$stage/bootstrap-core.mjs" "$stage"
