import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { config } from './config.js';

// Explicit asset map prevents filesystem traversal or serving environment files.
const assets = new Map([
  ['/', ['../../frontend/index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['../../frontend/app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['../../frontend/style.css', 'text/css; charset=utf-8']],
]);
function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}
const server = createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'");
  const path = new URL(request.url, 'http://localhost').pathname;
  if (request.method === 'GET' && path === '/api/health') {
    return json(response, 200, { status: 'ok', analysisImplemented: false });
  }
  if (path.startsWith('/api/jobs')) {
    return json(response, 501, { code: 'NOT_IMPLEMENTED', message: 'Analysis is not implemented yet.' });
  }
  const asset = assets.get(path);
  if (request.method !== 'GET' || !asset) return json(response, 404, { code: 'NOT_FOUND' });
  try {
    const body = await readFile(new URL(asset[0], import.meta.url));
    response.writeHead(200, { 'Content-Type': asset[1] });
    response.end(body);
  } catch {
    json(response, 500, { code: 'ASSET_UNAVAILABLE' });
  }
});
server.requestTimeout = 10000;
server.headersTimeout = 10000;
server.listen(config.port, config.host, () => {
  console.log(JSON.stringify({ event: 'server_started', port: config.port }));
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
