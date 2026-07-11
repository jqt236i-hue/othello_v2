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

async function closeMaintenanceNoticeIfPresent(page, timeoutMs = 5000) {
  if (!page || typeof page.locator !== 'function') return false;
  const notice = page.locator('#maintenanceNotice.is-open');
  const noticeCount = await notice.count().catch(() => 0);
  if (noticeCount <= 0) return false;

  const closeButton = page.locator('#maintenanceNoticeCloseBtn');
  const closeCount = await closeButton.count().catch(() => 0);
  if (closeCount > 0) {
    await closeButton.click({ timeout: timeoutMs }).catch(async () => {
      await page.evaluate(() => {
        const button = document.getElementById('maintenanceNoticeCloseBtn');
        if (button instanceof HTMLElement) button.click();
      }).catch(() => undefined);
    });
  } else {
    await page.evaluate(() => {
      const maintenanceNotice = document.getElementById('maintenanceNotice');
      if (!maintenanceNotice) return;
      maintenanceNotice.classList.remove('is-open');
      maintenanceNotice.setAttribute('aria-hidden', 'true');
    }).catch(() => undefined);
  }

  await page.waitForFunction(() => {
    const maintenanceNotice = document.getElementById('maintenanceNotice');
    return !maintenanceNotice
      || !maintenanceNotice.classList.contains('is-open')
      || maintenanceNotice.getAttribute('aria-hidden') === 'true';
  }, { timeout: timeoutMs }).catch(() => undefined);
  return true;
}

async function closeSidePanelIfPresent(page, timeoutMs = 5000) {
  if (!page || typeof page.locator !== 'function') return false;
  const panel = page.locator('#side-panel.is-open');
  const panelCount = await panel.count().catch(() => 0);
  if (panelCount <= 0) return false;

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => {
    const sidePanel = document.getElementById('side-panel');
    return !sidePanel
      || (sidePanel.classList.contains('side-panel-collapsed') && sidePanel.getAttribute('aria-hidden') === 'true');
  }, { timeout: timeoutMs }).catch(() => undefined);
  return true;
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
  stopPlaywrightBrowser,
  closeMaintenanceNoticeIfPresent,
  closeSidePanelIfPresent
};
