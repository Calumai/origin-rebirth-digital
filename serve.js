import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const configuredPort = Number.parseInt(process.env.PORT || '3000', 10);
if (!Number.isInteger(configuredPort) || configuredPort < 1 || configuredPort > 65535) {
  throw new Error(`無效的 PORT：${process.env.PORT}`);
}
const canAutoSelectPort = !process.env.PORT;
const highestAutoPort = Math.min(configuredPort + 20, 65535);
let activePort = configuredPort;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  const filePath = path.join(root, urlPath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.on('listening', () => {
  console.log(`listening on http://localhost:${activePort}`);
});

server.on('error', error => {
  if (error.code === 'EADDRINUSE' && canAutoSelectPort && activePort < highestAutoPort) {
    const occupiedPort = activePort;
    activePort += 1;
    console.warn(`port ${occupiedPort} is already in use; trying ${activePort}...`);
    server.listen(activePort);
    return;
  }
  console.error(error);
  process.exitCode = 1;
});

server.listen(activePort);
