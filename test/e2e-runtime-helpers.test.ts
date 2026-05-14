import * as http from 'http';

const { startStaticServer, stopStaticServer } = require('./e2e/e2e-runtime-helpers.js');
function waitForListening(server) {
  return new Promise((resolve, reject) => {
    if (!server || typeof server.once !== 'function') {
      reject(new Error('Server is not available'));
      return;
    }
    if (server.listening && server.address()) {
      resolve(server.address().port);
      return;
    }
    server.once('error', reject);
    server.once('listening', () => resolve(server.address().port));
  });
}

function requestPath(port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: pathname,
      method: 'GET'
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => resolve({
        statusCode: res.statusCode || 0,
        body: raw
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('e2e runtime helpers static server', () => {
  let server;
  let port;

  beforeEach(async () => {
    server = startStaticServer(0);
    port = await waitForListening(server);
  });

  afterEach(async () => {
    await stopStaticServer(server);
    server = null;
  });

  test('serves the repo index from loopback', async () => {
    const response = await requestPath(port, '/');

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('<!DOCTYPE html>');
  });

  test('rejects path traversal outside repo root', async () => {
    const response = await requestPath(port, '/%2e%2e/%2e%2e/package.json');

    expect(response.statusCode).toBe(403);
    expect(response.body).toBe('Forbidden');
  });

  test('rejects malformed URI encoding instead of throwing', async () => {
    const response = await requestPath(port, '/%E0%A4%A');

    expect(response.statusCode).toBe(400);
    expect(response.body).toBe('Bad request');
  });
});
