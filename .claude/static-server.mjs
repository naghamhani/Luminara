import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
const root = process.cwd();
const types = { '.html':'text/html', '.svg':'image/svg+xml', '.png':'image/png', '.css':'text/css', '.js':'text/javascript', '.json':'application/json' };
createServer(async (req, res) => {
  // POST /save?path=relative/path.png  body = raw base64 (no data: prefix)
  if (req.method === 'POST' && req.url.startsWith('/save')) {
    const rel = normalize(new URL(req.url, 'http://x').searchParams.get('path') || '');
    if (rel.startsWith('..')) { res.writeHead(400); return res.end('bad path'); }
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const dest = join(root, rel);
        await mkdir(dirname(dest), { recursive: true });
        await writeFile(dest, Buffer.from(body, 'base64'));
        res.writeHead(200, {'access-control-allow-origin':'*'}); res.end('ok:' + rel);
      } catch (e) { res.writeHead(500); res.end(String(e)); }
    });
    return;
  }
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = join(root, normalize(p));
    const buf = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(process.env.PORT || 4599, function () { console.log('static+save server on http://localhost:' + this.address().port); });
