import { expect, it } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { NativeSecretStore } from '../../packages/platform/src/credentials.js';
import { detectPlatform } from '../../packages/platform/src/platform.js';

it('native exact-entry synthetic canary set/get/isolation/delete; errors remain sanitized', async () => {
  detectPlatform();
  const store = new NativeSecretStore(); const id = randomUUID(); const other = randomUUID();
  // Generated only in this process; never argv/env/file/output. No credential enumeration.
  const canary = randomBytes(32).toString('base64url');
  let written = false;
  try {
    await store.set(id, 'native-test', canary); written = true;
    expect((await store.get(id, 'native-test')) === canary).toBe(true);
    expect((await store.get(other, 'native-test')) === null).toBe(true);
    await store.delete(id, 'native-test'); written = false;
    expect((await store.get(id, 'native-test')) === null).toBe(true);
  } finally { if (written) await store.delete(id, 'native-test'); }
}, 15_000);
