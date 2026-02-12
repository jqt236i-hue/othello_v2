const http = require('http');
const fs = require('fs');
const path = require('path');
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 0; // 0 => random
const root = process.cwd();
const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(root, urlPath.replace(/\\/g, path.sep));
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }
    // crude content-type handling
    if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    else if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css; charset=utf-8');
    else if (filePath.endsWith('.html')) res.setHeader('Content-Type', 'text/html; charset=utf-8');
    else if (filePath.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm');
    server.timeout = 0;
    res.end(data);
  });
});
server.listen(port, '127.0.0.1', () => {
  console.log('EPHEMERAL_SERVER_PORT:' + server.address().port);
});
