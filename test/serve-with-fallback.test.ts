import * as net from 'net';
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    parseArgs,
    chooseServePort,
    buildHttpServerArgs,
    computeAssetSourceFingerprint,
    generateLocalModelAssetManifest,
    refreshBrowserScriptVersions
} = require('../scripts/serve-with-fallback');

function listenOnce(server, options) {
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(options, () => resolve(server.address()));
    });
}

describe('serve-with-fallback', () => {
    test('parseArgs keeps explicit root and port', () => {
        const args = parseArgs(['worker-public', '--port', '9000', '--host', '127.0.0.1']);
        expect(args.root).toBe('worker-public');
        expect(args.preferredPort).toBe(9000);
        expect(args.host).toBe('127.0.0.1');
    });

    test('chooseServePort skips an occupied port', async () => {
        const server = net.createServer();
        const address = await listenOnce(server, { host: '127.0.0.1', port: 0 });

        try {
            const selectedPort = await chooseServePort({
                host: '127.0.0.1',
                preferredPort: address.port,
                maxAttempts: 5
            });
            expect(selectedPort).not.toBe(address.port);

            const probe = net.createServer();
            await listenOnce(probe, { host: '127.0.0.1', port: selectedPort });
            await new Promise((resolve) => probe.close(resolve));
        } finally {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    test('buildHttpServerArgs includes selected port and cache flag', () => {
        const args = buildHttpServerArgs('http-server-entry.js', {
            root: '.',
            host: '0.0.0.0',
            cacheSeconds: -1,
            passThrough: ['--cors']
        }, 8012);

        expect(args).toContain('http-server-entry.js');
        expect(args).toContain('-p');
        expect(args).toContain('8012');
        expect(args).toContain('-a');
        expect(args).toContain('0.0.0.0');
        expect(args).toContain('-c-1');
        expect(args).toContain('--cors');
    });

    test('computeAssetSourceFingerprint ignores generated asset-manifest and reacts to new gacha assets', () => {
        const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-assets-'));
        const assetsDir = path.join(tmpRoot, 'assets');
        const gachaDir = path.join(assetsDir, 'images', 'Gacha', 'N');
        fs.mkdirSync(gachaDir, { recursive: true });
        fs.writeFileSync(path.join(gachaDir, 'sample.png'), 'sample');
        fs.writeFileSync(path.join(assetsDir, 'asset-manifest.json'), '{"stale":true}');

        try {
            const beforeManifestEdit = computeAssetSourceFingerprint(tmpRoot);
            fs.writeFileSync(path.join(assetsDir, 'asset-manifest.json'), '{"stale":false}');
            const afterManifestEdit = computeAssetSourceFingerprint(tmpRoot);
            expect(afterManifestEdit).toBe(beforeManifestEdit);

            const exrDir = path.join(assetsDir, 'images', 'Gacha', 'EXR');
            fs.mkdirSync(exrDir, { recursive: true });
            fs.writeFileSync(path.join(exrDir, '意志.png'), 'exr');
            const afterAssetAdd = computeAssetSourceFingerprint(tmpRoot);
            expect(afterAssetAdd).not.toBe(beforeManifestEdit);
        } finally {
            fs.rmSync(tmpRoot, { recursive: true, force: true });
        }
    });

    test('generateLocalModelAssetManifest writes available root model assets for local probes', () => {
        const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-model-assets-'));
        const othelloDir = path.join(tmpRoot, 'data', 'models', 'othello');
        fs.mkdirSync(othelloDir, { recursive: true });
        fs.writeFileSync(path.join(othelloDir, 'policy-value.onnx'), 'onnx');
        fs.writeFileSync(path.join(othelloDir, 'policy-value.onnx.meta.json'), '{}');

        try {
            const result = generateLocalModelAssetManifest(tmpRoot);
            const manifestPath = path.join(tmpRoot, 'data', 'models', 'model-assets.json');
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

            expect(result.files).toEqual(manifest.files);
            expect(manifest.schemaVersion).toBe('model_assets.v1');
            expect(manifest.files).toEqual([
                'data/models/othello/policy-value.onnx',
                'data/models/othello/policy-value.onnx.meta.json'
            ]);
            expect(manifest.files).not.toContain('data/models/policy-target.onnx');
            expect(manifest.files).not.toContain('data/models/policy-value.onnx');
            expect(manifest.files).not.toContain('data/models/policy-table.json');
        } finally {
            fs.rmSync(tmpRoot, { recursive: true, force: true });
        }
    });

    test('refreshBrowserScriptVersions updates the classic entry without requiring classic tags in Vite index', () => {
        const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-browser-entry-'));
        const publicDir = path.join(tmpRoot, 'public');
        fs.mkdirSync(publicDir, { recursive: true });
        fs.writeFileSync(path.join(tmpRoot, 'entry-browser.js'), 'entry');
        fs.writeFileSync(path.join(publicDir, 'runtime.js'), 'runtime');
        fs.writeFileSync(path.join(publicDir, 'module-registry.js'), 'registry');
        const viteHtml = '<!doctype html><script type="module" src="./vite-dist/app.js"></script>';
        const classicHtml = [
            '<!doctype html>',
            '<script src="public/runtime.js"></script>',
            '<script src="public/module-registry.js"></script>',
            '<script src="entry-browser.js"></script>'
        ].join('\n');
        fs.writeFileSync(path.join(tmpRoot, 'index.html'), viteHtml);
        fs.writeFileSync(path.join(tmpRoot, 'index.classic.html'), classicHtml);

        try {
            const result = refreshBrowserScriptVersions(tmpRoot);
            expect(result.indexPath).toBe(path.join(tmpRoot, 'index.classic.html'));
            expect(fs.readFileSync(path.join(tmpRoot, 'index.html'), 'utf8')).toBe(viteHtml);
            expect(fs.readFileSync(path.join(tmpRoot, 'index.classic.html'), 'utf8')).toMatch(
                /public\/runtime\.js\?v=\d+/
            );
        } finally {
            fs.rmSync(tmpRoot, { recursive: true, force: true });
        }
    });
});
