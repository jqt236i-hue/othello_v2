import fs = require('fs');
import path = require('path');
import crypto = require('crypto');
import cp = require('child_process');
import ts = require('typescript');
import { createRequire } from 'module';

/** Run after build:vite. Only explicit runtime roots and tracked art are shipped. */
export function buildBattlePackage(root = process.cwd(), destination = path.join(root, 'output/battle-package')) {
    const out = path.resolve(destination);
    if (!out.startsWith(path.resolve(root, 'output') + path.sep)) throw new Error('Package output must stay inside output/');
    fs.mkdirSync(out, { recursive: true });
    const entries = new Map<string, string>();
    const put = (relative: string, data: string | Buffer) => {
        const target = path.join(out, relative);
        fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, data);
        entries.set(relative.replace(/\\/g, '/'), crypto.createHash('sha256').update(data).digest('hex'));
    };
    const copy = (source: string, relative: string) => put(relative, fs.readFileSync(source));
    const visited = new Set<string>();
    const notices: string[] = [], noticed = new Set<string>();
    const includeNotice = (name: string, from = root) => {
        if (noticed.has(name)) return; noticed.add(name);
        const resolver = createRequire(path.join(from, '__battle-license.cjs'));
        const metadataFile = (resolver.resolve.paths(name) || []).map(base => path.join(base, name, 'package.json')).find(file => fs.existsSync(file));
        if (!metadataFile) throw new Error(`Missing dependency license metadata: ${name}`);
        const directory = path.dirname(metadataFile);
        const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
        const licenses = fs.readdirSync(directory).filter(file => /^(?:licen[sc]e|notice)(?:\.|$)/i.test(file));
        notices.push(`${metadata.name}@${metadata.version} (${metadata.license || 'see license'})\n`
            + licenses.map(file => fs.readFileSync(path.join(directory, file), 'utf8')).join('\n'));
        for (const child of Object.keys(metadata.dependencies || {})) includeNotice(child, directory);
    };
    for (const name of Object.keys(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).dependencies || {})) includeNotice(name);
    put('THIRD-PARTY-NOTICES.txt', notices.join('\n\n----------------------------------------\n\n'));
    const dependency = (relative: string) => {
        const normalized = relative.replace(/\\/g, '/');
        if (visited.has(normalized)) return; visited.add(normalized);
        const source = path.resolve(root, 'dist', normalized);
        if (!source.startsWith(path.resolve(root, 'dist') + path.sep) || !fs.existsSync(source)) throw new Error(`Missing dependency: ${relative}`);
        copy(source, `lib/${normalized}`);
        if (!/\.(js|ts)$/.test(relative)) return;
        const code = fs.readFileSync(source, 'utf8');
        for (const match of code.matchAll(/(?:\b(?:_require|require)\s*\(\s*|\bfrom\s+|\bimport\s*)['"](\.[^'"]+)['"]/g)) {
            const base = path.posix.normalize(path.posix.join(path.posix.dirname(normalized), match[1]));
            const candidates = base.endsWith('.js') ? [base] : [base + '.js', base + '/index.js', base];
            const found = candidates.find(name => fs.existsSync(path.join(root, 'dist', name)) && fs.statSync(path.join(root, 'dist', name)).isFile());
            if (!found) throw new Error(`Missing dependency: ${relative} -> ${match[1]}`);
            dependency(found);
        }
        if (normalized.endsWith('.js')) {
            const declaration = normalized.replace(/\.js$/, '.d.ts');
            if (fs.existsSync(path.join(root, 'dist', declaration))) dependency(declaration);
        }
    };
    dependency('game/battle/index.js');
    // Host declaration imports only public battle types; preserve its relative paths.
    copy(path.join(root, 'dist/ui/battle/host.d.ts'), 'lib/ui/battle/host.d.ts');
    const host = ts.transpileModule(fs.readFileSync(path.join(root, 'ui/battle/host.ts'), 'utf8'),
        { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2020 } });
    put('host.mjs', host.outputText);
    const tracked = cp.execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0');
    const art = tracked.filter(file => /^assets\/(images|audio|fonts)\//.test(file)
        && !/(?:_reference\/|\/blender|\.blend$|\.psd$|\.kra$)/i.test(file));
    for (const file of [...art, ...tracked.filter(file => /^styles[^/]*\.css$/.test(file)), 'assets/asset-manifest.json']) {
        if (fs.existsSync(path.join(root, file))) copy(path.join(root, file), `browser/${file}`);
    }
    const copyTree = (dir: string, prefix: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.name.startsWith('.')) continue;
            const source = path.join(dir, entry.name), target = `${prefix}/${entry.name}`;
            if (entry.isDirectory()) copyTree(source, target); else copy(source, target);
        }
    };
    copyTree(path.join(root, 'vite-dist'), 'browser/vite-dist');
    for (const name of ['ort.min.js', 'ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm',
        'ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm']) {
        const relative = `node_modules/onnxruntime-web/dist/${name}`;
        copy(path.join(root, relative), `browser/${relative}`);
    }
    put('browser/index.html', fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace('<base href="../">', '<base href="./">'));
    // CPU models are explicitly selected by the shipping model manifest.
    const modelManifest = path.join(root, 'data/models/model-assets.json');
    if (fs.existsSync(modelManifest)) {
        copy(modelManifest, 'browser/data/models/model-assets.json');
        const content = fs.readFileSync(modelManifest, 'utf8');
        for (const match of content.matchAll(/"(data\/models\/[^"\s]+)"/g)) {
            if (fs.existsSync(path.join(root, match[1]))) copy(path.join(root, match[1]), `browser/${match[1]}`);
        }
    }
    put('package.json', JSON.stringify({ name: '@card-reversi/battle', version: '0.1.0', private: true,
        main: './lib/game/battle/index.js', types: './lib/game/battle/index.d.ts',
        exports: { '.': { types: './lib/game/battle/index.d.ts', default: './lib/game/battle/index.js' },
            './host': { types: './lib/ui/battle/host.d.ts', import: './host.mjs' }, './browser/*': './browser/*' },
        files: ['lib', 'host.mjs', 'browser', 'PACKAGE-MANIFEST.json', 'README.md', 'THIRD-PARTY-NOTICES.txt'] }, null, 2));
    put('README.md', '# Card Reversi Battle 0.1.0\n\nPrivate integration artifact. Serve browser/ at a same-origin directory and use the host export. Full rules, saves and lifecycle contracts: docs/battle-integration.md in the source repository. Art rights must be reviewed before commercial redistribution. No Steam integration or publishing is included.\n');
    // Remove only stale files within this exact generated package, never the enclosing output/.
    const prune = (dir: string) => {
        for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
            const absolute = path.join(dir, item.name);
            if (item.isDirectory()) prune(absolute);
            else if (!entries.has(path.relative(out, absolute).replace(/\\/g, '/'))) fs.unlinkSync(absolute);
        }
    };
    prune(out);
    const manifest = { version: 1, sourceCommit: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
        sourceDirty: !!cp.execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(),
        files: Object.fromEntries([...entries].sort(([a], [b]) => a.localeCompare(b))) };
    put('PACKAGE-MANIFEST.json', JSON.stringify(manifest, null, 2));
    console.log(`Battle package: ${out} (${entries.size} files)`);
    return out;
}
if (require.main === module) buildBattlePackage();
