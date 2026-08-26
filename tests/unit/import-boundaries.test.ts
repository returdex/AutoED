import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { posix } from 'node:path';

type Graph = Map<string, string[]>;
function imports(text: string): string[] {
  return [...text.matchAll(/(?:\b(?:import|export)\s+(?:[^;'"]*?\s+from\s*)?|\b(?:import|require)\s*\(\s*)['"]([^'"]+)['"]/g)].map(match => match[1]!);
}
function boundaryErrors(graph: Graph): string[] {
  const errors: string[] = [];
  function traverse(file: string, tier: 'domain' | 'application' | 'mcp', seen: Set<string>): void {
    if (seen.has(file)) return; seen.add(file);
    for (const specifier of graph.get(file) ?? []) {
      const target = specifier.startsWith('.') ? posix.normalize(posix.join(posix.dirname(file), specifier)).replace(/\.js$/, '.ts') : specifier;
      const local = specifier.startsWith('.');
      const credentialEdge = file === 'packages/client/src/credentials.ts' && target === 'packages/platform/src/credentials.ts';
      const discoveryEdge = file === 'packages/client/src/discovery.ts' && ['packages/platform/src/installation.ts','packages/platform/src/client-endpoint.ts'].includes(target);
      const hostEdge = file === 'packages/client/src/host.ts' && target === 'packages/platform/src/client-host.ts';
      const forbidden = tier === 'domain' ? !target.startsWith('packages/domain/')
        : tier === 'application' ? (local ? !/^packages\/(application|domain|contracts)\//.test(target) : !['zod', 'node:crypto'].includes(target))
        : /^(node:)?(fs|fs\/promises|child_process|process|worker_threads)$/.test(target) || /^(better-sqlite3|@napi-rs\/keyring)(?:\/|$)/.test(target) || /^packages\/(persistence|platform)\//.test(target) && !credentialEdge && !discoveryEdge && !hostEdge || /profile/i.test(target);
      if (forbidden) errors.push(`${tier}: ${file} -> ${target}`);
      else if (local && !credentialEdge && !discoveryEdge && !hostEdge) traverse(target, tier, seen);
    }
  }
  for (const file of graph.keys()) {
    if (file.startsWith('packages/domain/')) traverse(file, 'domain', new Set());
    if (file.startsWith('packages/application/')) traverse(file, 'application', new Set());
    if (file.startsWith('apps/mcp/')) traverse(file, 'mcp', new Set());
  }
  return errors;
}
function sourceGraph(): Graph {
  const graph: Graph = new Map();
  function walk(path: string): void {
    if (!existsSync(path)) return;
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const file = `${path}/${entry.name}`;
      if (entry.isDirectory()) walk(file);
      else if (file.endsWith('.ts')) graph.set(file, imports(readFileSync(file, 'utf8')));
    }
  }
  walk('packages'); walk('apps'); return graph;
}
describe('transitive architecture boundaries', () => {
  it('checks actual domain/application sources exist and respect dependencies', () => {
    const graph = sourceGraph();
    expect(graph.has('packages/domain/src/model.ts')).toBe(true);
    expect(graph.has('packages/application/src/ports.ts')).toBe(true);
    expect(boundaryErrors(graph)).toEqual([]);
  });
  it('detects direct and transitive forbidden driver/transport access', () => {
    expect(boundaryErrors(new Map([
      ['packages/domain/src/model.ts', ['node:fs']],
      ['packages/application/src/jobs.ts', ['../../persistence/src/database.js']],
      ['apps/mcp/src/main.ts', ['../../../packages/client/src/http.js']],
      ['packages/client/src/http.ts', ['../../persistence/src/database.js']],
    ]))).toHaveLength(3);
  });
  it('allows only the narrow approved client credential/discovery adapters', () => {
    expect(boundaryErrors(new Map([
      ['apps/mcp/src/main.ts', ['../../../packages/client/src/http.js']],
      ['packages/client/src/http.ts', ['./credentials.js', './discovery.js']],
      ['packages/client/src/credentials.ts', ['../../platform/src/credentials.js']],
      ['packages/client/src/discovery.ts', ['../../platform/src/installation.js']],
      ['packages/platform/src/credentials.ts', ['node:fs']],
    ]))).toEqual([]);
    expect(boundaryErrors(new Map([['apps/mcp/src/main.ts', ['../../../packages/platform/src/credentials.js']]]))).toHaveLength(1);
    expect(boundaryErrors(new Map([['apps/mcp/src/main.ts', ['../../../packages/platform/src/client-endpoint.js']]]))).toHaveLength(1);
    expect(boundaryErrors(new Map([['apps/mcp/src/main.ts', ['../../../packages/platform/src/client-host.js']]]))).toHaveLength(1);
    expect(boundaryErrors(new Map([['apps/mcp/src/main.ts',['../../../packages/client/src/host.js']],['packages/client/src/host.ts',['../../platform/src/client-host.js']]]))).toEqual([]);
    expect(boundaryErrors(new Map([['apps/mcp/src/main.ts', ['../../../packages/client/src/discovery.js']],['packages/client/src/discovery.ts',['../../platform/src/processes.js']]]))).toHaveLength(1);
    expect(boundaryErrors(new Map([['apps/mcp/src/main.ts', ['better-sqlite3', '@napi-rs/keyring']]]))).toHaveLength(2);
  });
  it('recognizes imports, re-exports, dynamic imports and CommonJS requires', () => {
    expect(imports("import x from 'a'; export { x } from 'b'; import('c'); require('d'); import 'e';")).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});
