#!/usr/bin/env node

'use strict';

import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';
import { spawn } from 'child_process';
import _generate_asset_manifest from './generate-asset-manifest';
const { generateManifest } = _generate_asset_manifest;
import _generate_observation_gacha_catalog from './generate-observation-gacha-catalog';
const { generateObservationGachaCatalogs } = _generate_observation_gacha_catalog;
import _sync_browser_script_versions from './sync-browser-script-versions';
const { syncBrowserScriptVersions } = _sync_browser_script_versions;

declare const __non_webpack_require__: NodeRequire | undefined;

interface ServeArgs {
    root: string;
    host: string;
    preferredPort: number;
    cacheSeconds: number;
    maxAttempts: number;
    passThrough: string[];
    help: boolean;
}

interface ArtifactRefreshState {
    lastAssetSourceFingerprint: string;
    lastBrowserScriptFingerprint: string;
}

interface ArtifactRefreshOptions {
    intervalMs?: number;
}

type BrowserScriptRefreshResult =
    | { skipped: true; reason: string }
    | {
        html: string;
        indexPath: string;
        wroteFile: boolean;
        updates: Array<{ relativePath: string; version: string; changed: boolean }>;
    };

const LOCAL_MODEL_ASSET_MANIFEST_PATH = path.join('data', 'models', 'model-assets.json');
const LOCAL_MODEL_ASSET_CANDIDATES = Object.freeze([
    'data/models/policy-net.onnx',
    'data/models/policy-net.onnx.meta.json',
    'data/models/policy-target.onnx',
    'data/models/policy-target.onnx.meta.json',
    'data/models/policy-value.onnx',
    'data/models/policy-value.onnx.meta.json',
    'data/models/policy-table.json',
    'data/models/othello/policy-value.onnx',
    'data/models/othello/policy-value.onnx.meta.json',
    'data/models/othello/policy-table.json',
    'data/models/othello/value-table.json'
]);

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function parseInteger(value: unknown, label: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
        throw new Error(`${label} must be a non-negative integer`);
    }
    return parsed;
}

function parseArgs(argv: string[]): ServeArgs {
    const args: ServeArgs = {
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

function resolveHttpServerEntrypoint(): string {
    try {
        return require.resolve('http-server/bin/http-server');
    } catch (error) {
        throw new Error('http-server is not installed. Run npm install before starting the local server.');
    }
}

function checkPortAvailable(port: number, host: string): Promise<number | null> {
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

async function chooseServePort(options: Pick<ServeArgs, 'host' | 'preferredPort' | 'maxAttempts'>): Promise<number> {
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
        if (available !== null && Number.isFinite(available)) {
            return available;
        }
    }
    const ephemeral = await checkPortAvailable(0, host);
    if (ephemeral !== null && Number.isFinite(ephemeral)) {
        return ephemeral;
    }
    throw new Error(`no available port found for host ${host}`);
}

function buildHttpServerArgs(entrypoint: string, options: ServeArgs, selectedPort: number): string[] {
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

    generateLocalModelAssetManifest(resolvedRoot);
}

function generateLocalModelAssetManifest(rootPath: string) {
    const resolvedRoot = path.resolve(String(rootPath || '.'));
    const files = LOCAL_MODEL_ASSET_CANDIDATES
        .filter((relativePath) => fs.existsSync(path.join(resolvedRoot, relativePath)))
        .sort();
    const payload = {
        schemaVersion: 'model_assets.v1',
        generatedAt: new Date().toISOString(),
        files
    };
    const outPath = path.join(resolvedRoot, LOCAL_MODEL_ASSET_MANIFEST_PATH);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
    return { outPath, files };
}

function computeBrowserScriptFingerprint(rootPath: string) {
    const resolvedRoot = path.resolve(String(rootPath || '.'));
    const trackedFiles = [
        path.join(resolvedRoot, 'entry-browser.js'),
        path.join(resolvedRoot, 'public', 'module-registry.js')
    ];
    const entries: string[] = [];
    for (const filePath of trackedFiles) {
        if (!fs.existsSync(filePath)) continue;
        const stats = fs.statSync(filePath);
        const relativePath = path.relative(resolvedRoot, filePath).replace(/\\/g, '/');
        entries.push(`${relativePath}:${Math.floor(stats.mtimeMs)}:${stats.size}`);
    }
    entries.sort();
    return JSON.stringify(entries);
}

function refreshBrowserScriptVersions(rootPath: string): BrowserScriptRefreshResult {
    const resolvedRoot = path.resolve(String(rootPath || '.'));
    const entryBrowserPath = path.join(resolvedRoot, 'entry-browser.js');
    const runtimePath = path.join(resolvedRoot, 'public', 'runtime.js');
    const moduleRegistryPath = path.join(resolvedRoot, 'public', 'module-registry.js');
    if (!fs.existsSync(entryBrowserPath) || !fs.existsSync(runtimePath) || !fs.existsSync(moduleRegistryPath)) {
        return { skipped: true, reason: 'classic-runtime-files-missing' };
    }
    const requiredScripts = ['public/runtime.js', 'public/module-registry.js', 'entry-browser.js'];
    const indexPath = [
        path.join(resolvedRoot, 'index.classic.html'),
        path.join(resolvedRoot, 'index.html')
    ].find((candidate) => {
        if (!fs.existsSync(candidate)) return false;
        const html = fs.readFileSync(candidate, 'utf8');
        return requiredScripts.every((relativePath) => html.includes(relativePath));
    });
    if (!indexPath) {
        return { skipped: true, reason: 'classic-entry-missing' };
    }
    return syncBrowserScriptVersions({ rootDir: resolvedRoot, indexPath, write: true });
}

function collectAssetSourceEntries(dirPath: string, basePath: string, entries: string[]): void {
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
    const entries: string[] = [];
    collectAssetSourceEntries(assetsDir, resolvedRoot, entries);
    entries.sort();
    return JSON.stringify(entries);
}

function refreshGeneratedCatalogArtifactsIfNeeded(rootPath: string, state: ArtifactRefreshState) {
    const resolvedRoot = path.resolve(String(rootPath || '.'));
    const nextFingerprint = computeAssetSourceFingerprint(resolvedRoot);
    if (state.lastAssetSourceFingerprint === nextFingerprint) {
        return { changed: false, fingerprint: nextFingerprint };
    }
    refreshGeneratedCatalogArtifacts(resolvedRoot);
    state.lastAssetSourceFingerprint = nextFingerprint;
    return { changed: true, fingerprint: nextFingerprint };
}

function refreshBrowserScriptVersionsIfNeeded(rootPath: string, state: ArtifactRefreshState) {
    const resolvedRoot = path.resolve(String(rootPath || '.'));
    const nextFingerprint = computeBrowserScriptFingerprint(resolvedRoot);
    if (state.lastBrowserScriptFingerprint === nextFingerprint) {
        return { changed: false, fingerprint: nextFingerprint };
    }
    refreshBrowserScriptVersions(resolvedRoot);
    state.lastBrowserScriptFingerprint = nextFingerprint;
    return { changed: true, fingerprint: nextFingerprint };
}

function startArtifactRefreshLoop(rootPath: string, options: ArtifactRefreshOptions = {}) {
    const resolvedRoot = path.resolve(String(rootPath || '.'));
    const intervalMs = Number.isFinite(Number(options.intervalMs))
        ? Math.max(250, Math.floor(Number(options.intervalMs)))
        : 500;
    const state = {
        lastAssetSourceFingerprint: computeAssetSourceFingerprint(resolvedRoot),
        lastBrowserScriptFingerprint: computeBrowserScriptFingerprint(resolvedRoot)
    };
    const tick = () => {
        try {
            const assetResult = refreshGeneratedCatalogArtifactsIfNeeded(resolvedRoot, state);
            const browserResult = refreshBrowserScriptVersionsIfNeeded(resolvedRoot, state);
            return { assetResult, browserResult };
        } catch (error) {
            const message = error instanceof Error ? error.message : error;
            console.warn('[serve] asset refresh failed:', message);
            return {
                assetResult: { changed: false, fingerprint: state.lastAssetSourceFingerprint, error },
                browserResult: { changed: false, fingerprint: state.lastBrowserScriptFingerprint, error }
            };
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
    refreshBrowserScriptVersions(resolvedRoot);
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
    generateLocalModelAssetManifest,
    refreshBrowserScriptVersions,
    refreshGeneratedCatalogArtifactsIfNeeded,
    startArtifactRefreshLoop,
    main
};
