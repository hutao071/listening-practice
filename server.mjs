import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.svg': 'image/svg+xml',
};

function isInside(root, path) {
  const name = relative(root, path);
  return name && name !== '..' && !name.startsWith('..' + sep) && !isAbsolute(name);
}

function byteRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || !size) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  return start <= end ? { start, end } : null;
}

export function createStaticServer(directory = new URL('./public/', import.meta.url)) {
  const rootPromise = realpath(directory);
  return createServer(async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }

    let name;
    try {
      name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
      response.writeHead(400).end();
      return;
    }

    try {
      const root = await rootPromise;
      const path = resolve(root, '.' + (name === '/' ? '/index.html' : name));
      if (!isInside(root, path)) throw new Error('Outside public folder');
      const file = await realpath(path);
      if (!isInside(root, file)) throw new Error('Outside public folder');
      const info = await stat(file);
      const type = types[extname(file)];
      if (!type || !info.isFile()) throw new Error('File unavailable');

      const headers = {
        'Content-Type': type,
        'Content-Length': info.size,
        'Accept-Ranges': 'bytes',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache',
      };
      let range;
      if (request.headers.range) {
        range = byteRange(request.headers.range, info.size);
        if (!range) {
          response.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end();
          return;
        }
        headers['Content-Length'] = range.end - range.start + 1;
        headers['Content-Range'] = `bytes ${range.start}-${range.end}/${info.size}`;
      }

      response.writeHead(range ? 206 : 200, headers);
      if (request.method === 'HEAD') {
        response.end();
      } else {
        const stream = createReadStream(file, range);
        stream.on('error', () => response.destroy());
        response.on('close', () => stream.destroy());
        stream.pipe(response);
      }
    } catch {
      response.writeHead(404).end();
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createStaticServer();
  const port = Number(process.env.LISTENING_PORT ?? 4173);
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE'
      ? `端口 ${port} 已被占用。请先关闭旧窗口，或设置 LISTENING_PORT 后重试。`
      : error.message);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`听一页 · http://127.0.0.1:${server.address().port}`);
    console.log('打开上面的地址开始练习。按 Ctrl+C 停止。');
  });
}
