"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const http = __importStar(require("http"));
const e2e_runtime_helpers_js_1 = require("./e2e/e2e-runtime-helpers.js");
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
        server = (0, e2e_runtime_helpers_js_1.startStaticServer)(0);
        port = await waitForListening(server);
    });
    afterEach(async () => {
        await (0, e2e_runtime_helpers_js_1.stopStaticServer)(server);
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
//# sourceMappingURL=e2e-runtime-helpers.test.js.map