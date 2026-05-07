#!/usr/bin/env node
// @ts-nocheck

'use strict';

import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';
import { spawn } from 'child_process';
import _generate_asset_manifest from './generate-asset-manifest';
const { generateManifest } = _generate_asset_manifest;
import _generate_observation_gacha_catalog from './generate-observation-gacha-catalog';
const { generateObservationGachaCatalogs } = _generate_observation_gacha_catalog;

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function parseInteger(value: any, label: any) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
        throw new Error(`${label} must be a non-negative integer`);
    }
    return parsed;
}

function parseArgs(argv: string[]) {
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

function checkPortAvailable(port: any, host: any) {
    return new Promise((resolve: any) => {
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

async function chooseServePort(options: any) {
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

function buildHttpServerArgs(entrypoint: any, options: any, selectedPort: any) {
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

function refreshGeneratedCatalogArtifacts(rootPath: string) {
    const resolvedRoot = path.resolve(String(rootPath || '.'));
    const assetsDir = path.join(resolvedRoot, 'assets');
    if (fs.existsSync(assetsDir)) {
        generateManifest({ root: resolvedRoot });
    }

    const gachaDir = path.join(resolvedRoot, 'assets', 'images', 'Gacha');
    const sharedDir = path.join(resolvedRoot, 'shared');
    if (fs.existsSync(gachaDir) && fs.existsSync(sharedDir)) {
        generateObservationGachaCatalogs({ root: resolvedRoot });
    }
}

function collectAssetSourceEntries(dirPath: any, basePath: any, entries: any) {
    if (!fs.existsSync(dirPath)) return;
    const dirEntries = fs.readdirSync(dirPath, { withFileTypes: true });
    dirEntries.forEach((entry: any) => {
        const entryPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            collectAssetSourceEntries(entryPath, basePath, entries);
            return;
        }
        if (!entry.isFile()) return;
        const relativePath = path.relative(basePath, entryPath).replace(/\\/g, '/');
        if (relativePath === 'assets/asset-manifest.json') return;
        const stats = fs.statSync(entryPath);
        entries.push(`${relativePath}:${Math.floor(stats.mtimeMs)}:${stats.size}`);
    });
}

function computeAssetSourceFingerprint(rootPath: string) {
    const resolvedRoot = path.resolve(String(rootPath || '.'));
    const assetsDir = path.join(resolvedRoot, 'assets');
    if (!fs.existsSync(assetsDir)) return '';
    const entries = [];
    collectAssetSourceEntries(assetsDir, resolvedRoot, entries);
    entries.sort();
    return JSON.stringify(entries);
}

function refreshGeneratedCatalogArtifactsIfNeeded(rootPath: any, state: any) {
    const resolvedRoot = path.resolve(String(rootPath || '.'));
    const targetState = (state && typeof state === 'object') ? state : {};
    const nextFingerprint = computeAssetSourceFingerprint(resolvedRoot);
    if (targetState.lastAssetSourceFingerprint === nextFingerprint) {
        return { changed: false, fingerprint: nextFingerprint };
    }
    refreshGeneratedCatalogArtifacts(resolvedRoot);
    targetState.lastAssetSourceFingerprint = nextFingerprint;
    return { changed: true, fingerprint: nextFingerprint };
}

function startArtifactRefreshLoop(rootPath, options = {}) {
    const resolvedRoot = path.resolve(String(rootPath || '.'));
    const intervalMs = Number.isFinite(Number(options.intervalMs))
        ? Math.max(250, Math.floor(Number(options.intervalMs)))
        : 500;
    const state = {
        lastAssetSourceFingerprint: computeAssetSourceFingerprint(resolvedRoot)
    };
    const tick = () => {
        try {
            return refreshGeneratedCatalogArtifactsIfNeeded(resolvedRoot, state);
        } catch (error) {
            console.warn('[serve] asset refresh failed:', error && error.message ? error.message : error);
            return { changed: false, fingerprint: state.lastAssetSourceFingerprint, error };
        }
    };
    const timer = setInterval(tick, intervalMs);
    if (timer && typeof timer.unref === 'function') {
        timer.unref();
    }
    return {
        tick,
        dispose() {
            clearInterval(timer);
        }
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }

    const entrypoint = resolveHttpServerEntrypoint();
    const resolvedRoot = path.resolve(process.cwd(), args.root || '.');
    refreshGeneratedCatalogArtifacts(resolvedRoot);
    const artifactRefreshLoop = startArtifactRefreshLoop(resolvedRoot);
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

    child.on('error', (error: any) => {
        artifactRefreshLoop.dispose();
        console.error('[serve] failed:', error && error.message ? error.message : error);
        process.exit(1);
    });
    child.on('close', (code: any) => {
        artifactRefreshLoop.dispose();
        process.exit(Number.isFinite(code) ? code : 0);
    });
}

if (require.main === module) {
    Promise.resolve(main()).catch((error: any) => {
        console.error('[serve] failed:', error && error.message ? error.message : error);
        process.exit(1);
    });
}

export = {
    parseArgs,
    chooseServePort,
    buildHttpServerArgs,
    resolveHttpServerEntrypoint,
    computeAssetSourceFingerprint,
    refreshGeneratedCatalogArtifactsIfNeeded,
    startArtifactRefreshLoop,
    main
};
