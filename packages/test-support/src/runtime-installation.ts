import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BuildIdentity } from '../../domain/src/model.js';
import type { InstallationMetadata } from '../../platform/src/installation.js';
import { protectPath } from '../../platform/src/permissions.js';
import type { RootSelection } from '../../platform/src/paths.js';
import { writeInstallerRecord } from '../../installer/src/launchers.js';

const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

/** Synthetic lifecycle fixtures still publish the same owned active/launcher evidence
 * required by production API startup. This never targets a persistent installation. */
export function publishSyntheticActive(
  selection: RootSelection,
  metadata: InstallationMetadata,
  build: BuildIdentity,
  entries: { cli: string; mcp: string },
): void {
  if (metadata.syntheticTest !== true) throw new Error('SYNTHETIC_INSTALLATION_REQUIRED');
  const bin = join(selection.root, 'bin'); mkdirSync(bin, { mode: 0o700 }); protectPath(bin);
  const files = [
    { name: 'launcher.mjs', content: '/* synthetic owned launcher receipt */\n' },
    { name: process.platform === 'win32' ? 'autoed-rebuild.cmd' : 'autoed-rebuild', content: 'synthetic owned launcher\n' },
  ];
  for (const file of files) { const path = join(bin, file.name); writeFileSync(path, file.content, { mode: 0o600 }); protectPath(path); }
  const scopeHash = sha('synthetic-scope');
  writeInstallerRecord(join(bin, 'ownership.json'), {
    installationId: metadata.installationId, scopeHash,
    files: files.map(file => ({ name: file.name, sha256: sha(file.content) })),
  });
  writeInstallerRecord(join(selection.root, 'active.json'), {
    schema: 1, installationId: metadata.installationId, scopeHash, manifestHash: sha('synthetic-manifest'), artifactSha256: sha('synthetic-installer'),
    build, nodeVersion: '24.20.0', browserRevision: '1234', nodeSha256: sha(readFileSync(process.execPath)),
    cliSha256: sha(readFileSync(entries.cli)), mcpSha256: sha(readFileSync(entries.mcp)), state: 'staged',
  });
}
