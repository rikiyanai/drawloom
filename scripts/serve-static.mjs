import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain', '.ico': 'image/x-icon', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
export function staticServer(directory = 'out') {
  const root = path.resolve(directory);
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname === '/drawloom') {
        response.writeHead(308, { location: '/drawloom/' }); response.end(); return;
      }
      if (!url.pathname.startsWith('/drawloom/') || !['GET', 'HEAD'].includes(request.method)) throw new Error('Not found');
      let filename = path.resolve(root, '.' + decodeURIComponent(url.pathname.slice('/drawloom'.length)));
      if (filename !== root && !filename.startsWith(root + path.sep)) throw new Error('Not found');
      if ((await stat(filename)).isDirectory()) filename = path.join(filename, 'index.html');
      const info = await stat(filename);
      if (!info.isFile()) throw new Error('Not found');
      response.writeHead(200, { 'content-type': types[path.extname(filename)] ?? 'application/octet-stream', 'content-length': info.size, 'cache-control': 'no-store' });
      if (request.method === 'HEAD') response.end();
      else createReadStream(filename).on('error', () => response.destroy()).pipe(response);
    } catch { response.writeHead(404); response.end('Not found'); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000);
  staticServer(process.argv[2]).listen(port, '127.0.0.1', () => console.log(`Drawloom export: http://127.0.0.1:${port}/drawloom/`));
}
