import { execFileSync } from 'node:child_process';
import { release } from 'node:os';

export interface Platform { platform: string; arch: string; version: string }
export function assertSupportedPlatform(actual: Platform): void {
  const parts = actual.version.split('.').map(Number);
  if (!((actual.platform === 'darwin' && actual.arch === 'arm64' && (parts[0] ?? 0) >= 14) ||
    (actual.platform === 'win32' && actual.arch === 'x64' && parts[0] === 10 && (parts[2] ?? 0) >= 22000))) throw new Error('UNSUPPORTED_PLATFORM');
}
export function detectPlatform(): Platform {
  try {
    const actual = { platform: process.platform, arch: process.arch, version: process.platform === 'darwin' ? execFileSync('/usr/bin/sw_vers', ['-productVersion'], { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).trim() : release() };
    assertSupportedPlatform(actual); return actual;
  } catch { throw new Error('UNSUPPORTED_PLATFORM'); }
}
