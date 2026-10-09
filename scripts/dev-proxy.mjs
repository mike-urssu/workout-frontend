// Dev-only CORS proxy so `expo start --web` can call the API (the server has CORS disabled on purpose).
// Run: npm run proxy   (target: API_TARGET, default https://workout-api.jjoon.cloud)
import http from 'node:http';

const TARGET = process.env.API_TARGET ?? 'https://workout-api.jjoon.cloud';
const PORT = Number(process.env.PORT ?? 8787);

http
  .createServer(async (req, res) => {
    const cors = {
      'Access-Control-Allow-Origin': req.headers.origin ?? '*',
      'Access-Control-Allow-Headers': 'content-type,authorization,x-time-zone',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      Vary: 'Origin',
    };
    if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();
    try {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const headers = {};
      for (const h of ['content-type', 'authorization', 'x-time-zone']) if (req.headers[h]) headers[h] = req.headers[h];
      const up = await fetch(TARGET + req.url, {
        method: req.method,
        headers,
        body: chunks.length ? Buffer.concat(chunks) : undefined,
      });
      res.writeHead(up.status, { ...cors, 'content-type': up.headers.get('content-type') ?? 'application/json' });
      res.end(Buffer.from(await up.arrayBuffer()));
    } catch (e) {
      res.writeHead(502, cors).end(JSON.stringify({ code: 'PROXY_ERROR', message: String(e) }));
    }
  })
  .listen(PORT, () => console.log(`CORS proxy: http://localhost:${PORT} -> ${TARGET}`));
