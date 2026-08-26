import type { FastifyInstance } from 'fastify';
import { lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const assets = [
  ['/status', 'index.html', 'text/html; charset=utf-8'],
  ['/assets/status.css', 'styles.css', 'text/css; charset=utf-8'],
  ['/assets/status.js', 'main.js', 'text/javascript; charset=utf-8'],
] as const;
export const publicStaticPaths = new Set<string>(assets.map(([url]) => url));
export function registerStatic(app: FastifyInstance, root?: string) {
  if (!root) {
    // Source-level API fixtures without browser assets remain generic and unpaired.
    app.get('/status', async (_request, reply) => reply.type('text/html').send('<!doctype html><html lang="zh-CN"><head><title>AutoED</title></head><body>此页面尚未获得本地访问权限</body></html>'));
    return;
  }
  const contents = assets.map(([url, name, type]) => {
    try {
      const stat = lstatSync(join(root, name));
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 262144) throw new Error();
      return { url, type, content: readFileSync(join(root, name)) };
    } catch { throw new Error('UNSAFE_STATIC_ASSET'); }
  });
  for (const {url,type,content} of contents) app.get(url, async (_request, reply) => reply.type(type).send(content));
}
