const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3849;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html',
  '.json': 'application/json',
  '.js': 'application/javascript',
  '.css': 'text/css'
};

http.createServer((req, res) => {
  let filePath = path.join(ROOT, req.url === '/' ? '/deliverable-a.html' : req.url.split('?')[0]);
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
}).listen(PORT, () => console.log('Serving at http://localhost:' + PORT));
