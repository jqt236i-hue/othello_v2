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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const stream_1 = require("stream");
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
const DEFAULT_REPO = 'mmnga-o/NVIDIA-Nemotron-Nano-9B-v2-Japanese-gguf';
const DEFAULT_FILE = 'NVIDIA-Nemotron-Nano-9B-v2-Japanese-IQ4_XS.gguf';
function readArgValue(name) {
    const key = `--${name}`;
    const idx = process.argv.indexOf(key);
    if (idx >= 0 && idx + 1 < process.argv.length) {
        return String(process.argv[idx + 1] || '').trim();
    }
    return '';
}
function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/download-nemotron-gguf.js [options]',
        '',
        'Options:',
        '  --repo <name>      Model repo name (default: mmnga-o/NVIDIA-Nemotron-Nano-9B-v2-Japanese-gguf)',
        '  --file <name>      GGUF file name (default: NVIDIA-Nemotron-Nano-9B-v2-Japanese-IQ4_XS.gguf)',
        '  --out-dir <path>   Download directory (default: models)',
        '  --token <token>    Optional access token (or use HF_TOKEN env)',
        '  --help             Show this help'
    ].join('\n'));
}
function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0)
        return '?';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let idx = 0;
    while (value >= 1024 && idx < units.length - 1) {
        value /= 1024;
        idx += 1;
    }
    return `${value.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
}
async function main() {
    const showHelp = process.argv.includes('--help') || process.argv.includes('-h');
    if (showHelp) {
        printHelp();
        return;
    }
    if (typeof fetch !== 'function') {
        throw new Error('fetch_not_available');
    }
    const repo = readArgValue('repo') || DEFAULT_REPO;
    const file = readArgValue('file') || DEFAULT_FILE;
    const outDir = path.resolve(process.cwd(), readArgValue('out-dir') || 'models');
    const token = readArgValue('token') || process.env.HF_TOKEN || '';
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, file);
    if (fs.existsSync(outPath)) {
        console.log(`[download] already exists: ${outPath}`);
        return;
    }
    const encodedRepo = repo.split('/').map((s) => encodeURIComponent(s)).join('/');
    const encodedFile = file.split('/').map((s) => encodeURIComponent(s)).join('/');
    const url = `https://huggingface.co/${encodedRepo}/resolve/main/${encodedFile}`;
    const headers = {};
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    console.log(`[download] repo: ${repo}`);
    console.log(`[download] file: ${file}`);
    console.log(`[download] url: ${url}`);
    console.log(`[download] output: ${outPath}`);
    const response = await fetch(url, { headers });
    if (!response || !response.ok) {
        throw new Error(`download_failed_${response ? response.status : 'no_response'}`);
    }
    if (!response.body) {
        throw new Error('empty_response_body');
    }
    const totalBytes = Number(response.headers.get('content-length') || 0);
    const readable = stream_1.Readable.fromWeb(response.body);
    const writer = fs.createWriteStream(outPath);
    let downloaded = 0;
    let lastShownAt = Date.now();
    readable.on('data', (chunk) => {
        downloaded += chunk.length;
        const now = Date.now();
        if (now - lastShownAt < 800)
            return;
        lastShownAt = now;
        if (totalBytes > 0) {
            const ratio = (downloaded / totalBytes) * 100;
            process.stdout.write(`\r[download] ${ratio.toFixed(1)}% (${formatBytes(downloaded)} / ${formatBytes(totalBytes)})   `);
        }
        else {
            process.stdout.write(`\r[download] ${formatBytes(downloaded)}   `);
        }
    });
    await new Promise((resolve, reject) => {
        readable.on('error', reject);
        writer.on('error', reject);
        writer.on('finish', resolve);
        readable.pipe(writer);
    });
    process.stdout.write('\n');
    console.log(`[download] completed: ${outPath}`);
}
main().catch((err) => {
    console.error('[download] failed:', err && err.message ? err.message : err);
    process.exitCode = 1;
});
//# sourceMappingURL=download-nemotron-gguf.js.map