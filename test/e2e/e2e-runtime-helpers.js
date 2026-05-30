const path = require('path');
const http = require('http');
const fs = require('fs');
const MatchServerModule = require('../../dist/scripts/local-match-server.js');

function resolveMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html';
  if (ext === '.js' || ext === '.mjs') return 'application/javascript';
  if (ext === '.css') return 'text/css';
  if (ext === '.json') return 'application/json';
  return 'application/octet-stream';
}

function resolveStaticFilePath(root, requestUrl) {
  let reqPath = (typeof requestUrl === 'string' ? requestUrl : '/').split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(reqPath);
  } catch (error) {
    return { statusCode: 400, body: 'Bad request' };
  }

  const filePath = path.resolve(root, `.${decodedPath}`);
  const normalizedRoot = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (filePath !== root && !filePath.startsWith(normalizedRoot)) {
    return { statusCode: 403, body: 'Forbidden' };
  }

  return { filePath };
}

function startStaticServer(port = 0) {
  const root = path.resolve(__dirname, '..', '..');
  const sockets = new Set();
  const server = http.createServer((req, res) => {
    const resolved = resolveStaticFilePath(root, req && req.url);
    if (!resolved || !resolved.filePath) {
      res.statusCode = resolved && Number.isInteger(resolved.statusCode) ? resolved.statusCode : 400;
      res.end((resolved && resolved.body) || 'Bad request');
      return;
    }

    const filePath = resolved.filePath;
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
      res.setHeader('Content-Type', resolveMimeType(filePath));
      res.end(data);
    });
  });

  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  server.__trackedSockets = sockets;
  server.listen(port, '127.0.0.1');
  return server;
}

function startLocalMatchServer(port = 0, host = '127.0.0.1') {
  if (!MatchServerModule || typeof MatchServerModule.createLocalMatchServer !== 'function') {
    throw new Error('createLocalMatchServer is unavailable');
  }
  const server = MatchServerModule.createLocalMatchServer();
  server.listen(port, host);
  return server;
}

function waitForTeardown(ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (timer && typeof timer.unref === 'function') {
      timer.unref();
    }
  });
}

async function settleTeardown(promise, timeoutMs) {
  await Promise.race([
    Promise.resolve(promise).catch(() => undefined),
    waitForTeardown(timeoutMs)
  ]);
}

async function stopPlaywrightPage(page, timeoutMs = 5000) {
  if (!page || typeof page.close !== 'function') return;
  await settleTeardown(page.close().catch(() => undefined), timeoutMs);
}

async function stopPlaywrightBrowser(browser, timeoutMs = 5000) {
  if (!browser || typeof browser.close !== 'function') return;
  const contexts = (typeof browser.contexts === 'function')
    ? browser.contexts()
    : [];
  for (let index = 0; index < contexts.length; index += 1) {
    const context = contexts[index];
    if (!context || typeof context.close !== 'function') continue;
    await settleTeardown(context.close().catch(() => undefined), timeoutMs);
  }
  await settleTeardown(browser.close().catch(() => undefined), timeoutMs);
}

async function stopStaticServer(server) {
  if (!server || typeof server.close !== 'function') return;

  try {
    if (typeof server.closeIdleConnections === 'function') {
      server.closeIdleConnections();
    }
  } catch (e) { /* ignore */ }

  try {
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
  } catch (e) { /* ignore */ }

  const sockets = server.__trackedSockets;
  if (sockets && typeof sockets.forEach === 'function') {
    sockets.forEach((socket) => {
      try { socket.destroy(); } catch (e) { /* ignore */ }
    });
  }

  await new Promise((resolve) => server.close(() => resolve()));
}

module.exports = {
  resolveStaticFilePath,
  startStaticServer,
  startLocalMatchServer,
  stopStaticServer,
  stopPlaywrightPage,
  stopPlaywrightBrowser
};
