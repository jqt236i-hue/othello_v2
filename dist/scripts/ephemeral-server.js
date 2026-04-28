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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 0; // 0 => random
const root = process.cwd();
const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/')
        urlPath = '/index.html';
    const filePath = path.join(root, urlPath.replace(/\\/g, path.sep));
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.statusCode = 404;
            res.end('Not Found');
            return;
        }
        // crude content-type handling
        if (filePath.endsWith('.js') || filePath.endsWith('.mjs'))
            res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        else if (filePath.endsWith('.css'))
            res.setHeader('Content-Type', 'text/css; charset=utf-8');
        else if (filePath.endsWith('.html'))
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
        else if (filePath.endsWith('.wasm'))
            res.setHeader('Content-Type', 'application/wasm');
        server.timeout = 0;
        res.end(data);
    });
});
server.listen(port, '127.0.0.1', () => {
    console.log('EPHEMERAL_SERVER_PORT:' + server.address().port);
});
//# sourceMappingURL=ephemeral-server.js.map