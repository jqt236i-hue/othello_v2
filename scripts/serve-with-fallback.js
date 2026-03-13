#!/usr/bin/env node
'use strict';

const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

function parseInteger(value, label) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
        throw new Error(`${label} must be a non-negative integer`);
    }
    return parsed;
}

function parseArgs(argv) {
    const args = {
        root: '.',
        host: process.env.HOST ? String(process.env.HOST).trim() : '0.0.0.0',
        preferredPort: parseInteger(process.env.PORT || '8000', '--port'),
        cacheSeconds: -1,
        maxAttempts: 20,
        passThrough: [],
        help: false
    };

    let rootAssigned = false;
    for (let i = 0; i < argv.length; i++) {
        const token = String(argv[i] || '').trim();
        if (!token) continue;
        if (token === '--help' || token === '-h') { args.help = true; continue; }
        if (token === '--port' || token === '-p') {
            args.preferredPort = parseInteger(argv[++i], '--port');
            continue;
        }
        if (token.startsWith('--port=')) {
            args.preferredPort = parseInteger(token.slice('--port='.length), '--port');
            continue;
        }
        if (token === '--host' || token === '-a') {
            args.host = String(argv[++i] || '').trim() || '0.0.0.0';
            continue;
        }
        if (token.startsWith('--host=')) {
            args.host = String(token.slice('--host='.length) || '').trim() || '0.0.0.0';
            continue;
        }
        if (token === '--cache' || token === '-c') {
            args.cacheSeconds = Number(argv[++i]);
            continue;
        }
        if (token.startsWith('--cache=')) {
            args.cacheSeconds = Number(token.slice('--cache='.length));
            continue;
        }
        if (token === '--max-attempts') {
            args.maxAttempts = parseInteger(argv[++i], '--max-attempts');
            continue;
        }
        if (!rootAssigned && !token.startsWith('-')) {
            args.root = token;
            rootAssigned = true;
            continue;
        }
        args.passThrough.push(token);
    }

    if (!Number.isFinite(args.cacheSeconds)) {
        throw new Error('--cache must be a number');
    }
    return args;
}

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/serve-with-fallback.js [root] [options] [-- extra-http-server-flags]',
        '',
        'Options:',
        '      --port <n>         Preferred port (default: 8000 or PORT env)',
        '      --host <host>      Host to bind (default: 0.0.0.0 or HOST env)',
        '      --cache <n>        Cache seconds for http-server (default: -1)',
        '      --max-attempts <n> Number of sequential ports to try before falling back to OS-assigned port',
        '  -h, --help             Show this help'
    ].join('\n'));
}

function resolveHttpServerEntrypoint() {
    try {
        return require.resolve('http-server/bin/http-server');
    } catch (error) {
        throw new Error('http-server is not installed. Run npm install before starting the local server.');
    }
}

function checkPortAvailable(port, host) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.unref();
        server.on('error', () => resolve(null));
        server.listen({ port, host }, () => {
            const address = server.address();
            const resolvedPort = address && typeof address === 'object' ? address.port : port;
            server.close(() => resolve(resolvedPort));
        });
    });
}

async function chooseServePort(options) {
    const host = options && options.host ? options.host : '0.0.0.0';
    const preferredPort = options && Number.isFinite(options.preferredPort)
        ? Math.max(0, Math.floor(options.preferredPort))
        : 8000;
    const maxAttempts = options && Number.isFinite(options.maxAttempts)
        ? Math.max(0, Math.floor(options.maxAttempts))
        : 20;

    for (let offset = 0; offset <= maxAttempts; offset++) {
        const candidate = preferredPort + offset;
        const available = await checkPortAvailable(candidate, host);
        if (Number.isFinite(available)) {
            return available;
        }
    }
    const ephemeral = await checkPortAvailable(0, host);
    if (Number.isFinite(ephemeral)) {
        return ephemeral;
    }
    throw new Error(`no available port found for host ${host}`);
}

function buildHttpServerArgs(entrypoint, options, selectedPort) {
    const rootPath = path.resolve(process.cwd(), options.root || '.');
    if (!fs.existsSync(rootPath)) {
        throw new Error(`serve root not found: ${rootPath}`);
    }
    return [
        entrypoint,
        rootPath,
        '-p', String(selectedPort),
        '-a', String(options.host || '0.0.0.0'),
        `-c${String(options.cacheSeconds)}`
    ].concat(Array.isArray(options.passThrough) ? options.passThrough : []);
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }

    const entrypoint = resolveHttpServerEntrypoint();
    const selectedPort = await chooseServePort(args);
    if (selectedPort !== args.preferredPort) {
        console.warn(`[serve] port ${args.preferredPort} is busy; using ${selectedPort} instead`);
    }

    const childArgs = buildHttpServerArgs(entrypoint, args, selectedPort);
    console.log(`[serve] root=${path.resolve(process.cwd(), args.root || '.')} host=${args.host} port=${selectedPort}`);

    const child = spawn(process.execPath, childArgs, {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'inherit'
    });

    child.on('error', (error) => {
        console.error('[serve] failed:', error && error.message ? error.message : error);
        process.exit(1);
    });
    child.on('close', (code) => {
        process.exit(Number.isFinite(code) ? code : 0);
    });
}

if (require.main === module) {
    Promise.resolve(main()).catch((error) => {
        console.error('[serve] failed:', error && error.message ? error.message : error);
        process.exit(1);
    });
}

module.exports = {
    parseArgs,
    chooseServePort,
    buildHttpServerArgs,
    resolveHttpServerEntrypoint
};