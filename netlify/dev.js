// Local runner: static site + /.netlify/functions/* handlers, zero deps.
//   node netlify/dev.js            → http://localhost:8138
// Serves the repo root; routes /.netlify/functions/<name> to netlify/functions/<name>.js (exports.handler).
// MEMBER_LOCAL_DIR (optional) — extra folder mounted at /members/_local/ (sample video for /members).
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 8138);
const loaded = {};
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon' };

function serveFile(file, req, res) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('404'); }
    const ext = path.extname(file).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Accept-Ranges': 'bytes' };
    const range = req.headers.range;
    if (range) { // <video> needs ranges
      const m = range.match(/bytes=(\d*)-(\d*)/); const start = m[1] ? Number(m[1]) : 0; const end = m[2] ? Number(m[2]) : st.size - 1;
      headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + st.size; headers['Content-Length'] = end - start + 1;
      res.writeHead(206, headers); return fs.createReadStream(file, { start, end }).pipe(res);
    }
    headers['Content-Length'] = st.size; res.writeHead(200, headers); fs.createReadStream(file).pipe(res);
  });
}

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const fn = u.pathname.match(/^\/\.netlify\/functions\/([a-z0-9_-]+)$/i);
  if (fn) {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', async () => {
      try {
        const file = path.join(ROOT, 'netlify/functions', fn[1] + '.js');
        const mtime = fs.statSync(file).mtimeMs; // reload only when the file changed (keeps in-memory state like rate limits)
        if (loaded[file] !== mtime) { delete require.cache[require.resolve(file)]; loaded[file] = mtime; }
        const { handler } = require(file);
        const out = await handler({ httpMethod: req.method, headers: req.headers, body, queryStringParameters: Object.fromEntries(u.searchParams) });
        res.writeHead(out.statusCode || 200, out.headers || {}); res.end(out.body || '');
      } catch (e) { res.writeHead(500); res.end(String(e && e.stack || e)); }
    });
    return;
  }
  const LOCAL = process.env.MEMBER_LOCAL_DIR || path.join(require("os").tmpdir(), "member-local");
  if (u.pathname.startsWith('/members/_local/')) {
    return serveFile(path.join(LOCAL, u.pathname.slice('/members/_local/'.length)), req, res);
  }
  let file = path.join(ROOT, decodeURIComponent(u.pathname));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (u.pathname.endsWith('/')) file = path.join(file, 'index.html');
  else if (!path.extname(file) && fs.existsSync(path.join(file, 'index.html'))) { res.writeHead(302, { Location: u.pathname + '/' }); return res.end(); }
  serveFile(file, req, res);
}).listen(PORT, () => console.log('137lab dev → http://localhost:' + PORT));
