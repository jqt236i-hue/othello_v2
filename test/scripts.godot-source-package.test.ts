import fs = require('fs');
import path = require('path');
import os = require('os');
import cp = require('child_process');
import { collectModels, createGodotSourcePackage, isSourcePath, safeRelative, verifyGodotSourcePackage } from '../scripts/godot-source-package';
import { buildAssetInventory, sha256 } from '../scripts/godot-source/assets';
import { buildBattlePackage, collectDependencyNotices } from '../scripts/build-battle-package';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/abkAAAAASUVORK5CYII=', 'base64');
let root: string;
function put(relative: string, data: string | Buffer): void {
    const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data);
}
function seed(): void {
    put('package.json', JSON.stringify({ dependencies: {} })); put('package-lock.json', JSON.stringify({ lockfileVersion: 3 }));
    put('ui/view.ts', "export const image = 'assets/images/board/Tile.png';\n");
    put('assets/images/board/Tile.png', png); put('assets/images/board/_reference/unused.png', png);
    put('assets/images/special-cards/characters/observer_will_reference/observer_will_turnaround.png', png);
    put('assets/fonts/OFL.txt', 'font license'); put('assets/fonts/font-build-manifest.json', '{}');
    put('docs/asset-provenance.md', 'original declaration');
    cp.execFileSync('git', ['init', '--quiet', root]);
    cp.execFileSync('git', ['-C', root, 'add', '.']);
    cp.execFileSync('git', ['-C', root, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'base']);
    put('data/models/policy.onnx', 'test model'); put('data/models/policy.onnx.meta.json', '{"features":1}');
    put('data/models/model-assets.json', JSON.stringify({ schemaVersion: 'model_assets.v1', files: ['data/models/policy.onnx', 'data/models/policy.onnx.meta.json'] }));
}
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'godot-source-')); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

test('selected commit bytes exclude unrelated dirty changes and production material; explicit overlay is hashed', async () => {
    seed();
    put('ui/view.ts', "export const image = 'assets/images/board/Wrong.png';\n");
    put('docs/adopted.md', 'accepted addition');
    const out = path.join(root, 'output/adopted');
    const result = await createGodotSourcePackage({ root, ref: 'HEAD', out, modelsFrom: root,
        overlayFiles: [{ path: 'docs/adopted.md', sha256: sha256('accepted addition') }] });
    expect(result.assets).toBe(1);
    expect(fs.readFileSync(path.join(out, 'source/ui/view.ts'), 'utf8')).toContain('Tile.png');
    expect(fs.existsSync(path.join(out, 'source/assets/images/board/_reference/unused.png'))).toBe(false);
    expect(fs.existsSync(path.join(out, 'source/assets/images/special-cards/characters/observer_will_reference/observer_will_turnaround.png'))).toBe(false);
    expect(fs.readFileSync(path.join(root, 'ui/view.ts'), 'utf8')).toContain('Wrong.png');
    expect(verifyGodotSourcePackage(out)).toMatchObject({ ok: true });
    const inventory = JSON.parse(fs.readFileSync(path.join(out, 'ASSET-INVENTORY.json'), 'utf8'));
    expect(inventory.files[0]).toMatchObject({ image: { width: 1, height: 1, hasAlpha: true }, references: [{ source: 'ui/view.ts', kind: 'literal', line: 1 }] });
    fs.writeFileSync(path.join(out, 'source/data/models/policy.onnx'), 'broken');
    expect(verifyGodotSourcePackage(out).issues).toContain('hash mismatch: source/data/models/policy.onnx');
    fs.writeFileSync(path.join(out, 'runtime-assets/unexpected.txt'), 'not adopted');
    expect(verifyGodotSourcePackage(out).issues).toContain('unexpected: runtime-assets/unexpected.txt');
});

test('rejects stale overlay selection and cannot overwrite an existing collection', async () => {
    seed();
    await expect(createGodotSourcePackage({ root, ref: 'HEAD', out: 'output/stale', modelsFrom: root,
        overlayFiles: [{ path: 'ui/view.ts', sha256: 'incorrect' }] })).rejects.toThrow('Overlay changed');
    fs.mkdirSync(path.join(root, 'output/existing'), { recursive: true });
    await expect(createGodotSourcePackage({ root, ref: 'HEAD', out: 'output/existing', modelsFrom: root })).rejects.toThrow('already exists');
});

test('accepts an explicitly separated overlay file without adopting dirty edits from the same source path', async () => {
    seed();
    put('package.json', JSON.stringify({ dependencies: {}, unrelatedExperiment: 'Lv13' }));
    const adopted = JSON.stringify({ dependencies: {}, portingPreparation: true });
    put('output/selected-package.json', adopted);
    const out = path.join(root, 'output/separated');
    await createGodotSourcePackage({ root, ref: 'HEAD', out, modelsFrom: root,
        overlayFiles: [{ path: 'package.json', fromFile: 'output/selected-package.json', sha256: sha256(adopted) }] });
    expect(JSON.parse(fs.readFileSync(path.join(out, 'source/package.json'), 'utf8'))).toEqual({ dependencies: {}, portingPreparation: true });
    expect(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).unrelatedExperiment).toBe('Lv13');
});

test('rejects missing model files and missing ONNX feature metadata', () => {
    seed();
    fs.unlinkSync(path.join(root, 'data/models/policy.onnx'));
    expect(() => collectModels(root, path.join(root, 'output/missing'))).toThrow('Missing required regular runtime model');
    put('data/models/policy.onnx', 'test');
    put('data/models/model-assets.json', JSON.stringify({ schemaVersion: 'model_assets.v1', files: ['data/models/policy.onnx'] }));
    expect(() => collectModels(root, path.join(root, 'output/missing-meta'))).toThrow('Missing ONNX metadata');
});

test('rejects model path escape and secret or production overlays', () => {
    seed();
    put('data/models/model-assets.json', JSON.stringify({ schemaVersion: 'model_assets.v1', files: ['data/models/../../secret'] }));
    expect(() => collectModels(root, path.join(root, 'output/escape'))).toThrow('Unsafe collection path');
    for (const file of ['.env', '.env.local', 'assets/images/a.blend', 'data/runs/training.jsonl', 'assets/images/_reference/a.png',
        'assets/images/special-cards/characters/observer_will_reference/observer_will_turnaround.png',
        'assets/images/special-cards/characters/theory_incarnation_reference/theory_incarnation_turnaround.png', 'scripts/secret.json']) expect(isSourcePath(file)).toBe(false);
    expect(() => safeRelative('../outside')).toThrow();
    for (const file of ['public/runtime.js', 'examples/story-host/index.html', '.node-version']) expect(isSourcePath(file)).toBe(true);
});

test('reports literal references with missing files and case mismatches', async () => {
    put('ui/view.ts', "export const image = 'assets/images/board/tile.png';"); put('assets/images/board/Tile.png', png);
    await expect(buildAssetInventory(root)).rejects.toThrow('case mismatch');
    put('ui/view.ts', "export const image = 'assets/images/board/absent.png';");
    await expect(buildAssetInventory(root)).rejects.toThrow('absent.png');
});

test('preserves filename-prefix CPU faces through source inventory and the browser distribution', async () => {
    seed();
    put('ui/view.ts', "const CPU_FACE_ASSET_PREFIX = 'assets/images/cpu/face/level';\n"
        + 'export const face = (level: number) => `${CPU_FACE_ASSET_PREFIX}${level}.png`;\n'
        + "export const concatenated = (level: number) => CPU_FACE_ASSET_PREFIX + level + '.png';\n"
        + 'export const direct = (level: number) => `assets/images/cpu/face/level${level}.png`;\n');
    const faces = Array.from({ length: 9 }, (_, i) => `assets/images/cpu/face/level${i + 1}.png`);
    for (const face of faces) put(face, png);
    for (const other of ['assets/images/cpu/face/level1.webp', 'assets/images/cpu/face/unrelated.png',
        'assets/images/cpu/face/level/deep.png', 'assets/images/cpu/face/level1/deep.png', 'assets/images/cpu/face/level_reference/draft.png']) put(other, png);
    cp.execFileSync('git', ['-C', root, 'add', '.']);
    cp.execFileSync('git', ['-C', root, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'mobile faces']);
    const out = path.join(root, 'output/mobile');
    await createGodotSourcePackage({ root, ref: 'HEAD', out, modelsFrom: root });
    const inventory = JSON.parse(fs.readFileSync(path.join(out, 'ASSET-INVENTORY.json'), 'utf8'));
    expect(inventory.files.map((row: any) => row.path)).toEqual(faces);
    for (const face of faces) {
        expect(fs.readFileSync(path.join(out, 'runtime-assets', face))).toEqual(png);
        expect(inventory.files.find((row: any) => row.path === face).references)
            .toEqual(expect.arrayContaining([expect.objectContaining({ source: 'ui/view.ts', kind: 'dynamic-filename' })]));
    }
    const snapshot = 'output/mobile/source';
    put(`${snapshot}/dist/game/battle/index.js`, 'module.exports = {};');
    put(`${snapshot}/dist/ui/battle/host.d.ts`, 'export {};'); put(`${snapshot}/ui/battle/host.ts`, 'export {};');
    put(`${snapshot}/vite-dist/app.js`, ''); put(`${snapshot}/index.html`, '<html></html>');
    for (const name of ['ort.min.js', 'ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm']) {
        put(`${snapshot}/node_modules/onnxruntime-web/dist/${name}`, 'test');
    }
    const distribution = buildBattlePackage(path.join(root, snapshot));
    const manifest = JSON.parse(fs.readFileSync(path.join(distribution, 'PACKAGE-MANIFEST.json'), 'utf8'));
    for (const face of faces) {
        expect(fs.readFileSync(path.join(distribution, 'browser', face))).toEqual(png);
        expect(manifest.files[`browser/${face}`]).toBe(sha256(png));
    }
    expect(fs.existsSync(path.join(distribution, 'browser/assets/images/cpu/face/unrelated.png'))).toBe(false);
    fs.unlinkSync(path.join(root, snapshot, faces[8]));
    expect(() => buildBattlePackage(path.join(root, snapshot))).toThrow(`Missing required runtime asset: ${faces[8]}`);
});

test('reports an empty dynamic filename pool instead of silently treating it as unused', async () => {
    put('ui/view.ts', "const prefix = './assets/images/cpu/face/level'; export const face = (level: number) => `${prefix}${level}.png`;");
    await expect(buildAssetInventory(root)).rejects.toThrow('assets/images/cpu/face/level*.png');
    put('assets/images/cpu/face/level1.png', png);
    expect((await buildAssetInventory(root)).files.map((row: any) => row.path)).toEqual(['assets/images/cpu/face/level1.png']);
});

test('resolves effect filenames and records evaluated gain and loop defaults', async () => {
    put('sound-engine.ts', `export default { masterVolume: 1, effectBaseVolume: 0.56, effectDefaultVolumeScale: 0.35,
      effectVolumeScales: { cue: 10/7 }, effectBasePath: 'assets/audio/sound-effect/', effectSoundFiles: { cue: 'test.mp3' },
      playlist: [{file:'assets/audio/bgm/a.mp3',name:'A',loopStart:1.5,loopEnd:90*60/115}], resultBgmTracks:{},
      bgmVolume: 0.548625, bgmOutputVolumeScale:0.24752,currentTrackIndex:0,specialCardUseBgmMuteMs:3000 };`);
    put('assets/audio/sound-effect/test.mp3', 'audio'); put('assets/audio/bgm/a.mp3', 'audio');
    put('assets/audio/sound-effect/unused-production.mp3', 'audio');
    put('ui/gacha.ts', "export const path = 'assets/audio/other/gacha.mp3';"); put('assets/audio/other/gacha.mp3', 'audio');
    const result = await buildAssetInventory(root);
    expect(result.files.find((row: any) => row.path.endsWith('test.mp3')).playback[0]).toMatchObject({ key: 'cue', loop: false });
    expect(result.files.find((row: any) => row.path.endsWith('test.mp3')).playback[0].defaultGain).toBeCloseTo(0.8);
    expect(result.files.find((row: any) => row.path.endsWith('a.mp3')).playback[0]).toMatchObject({ loop: true, loopStartSeconds: 1.5, loopEndSeconds: 90 * 60 / 115 });
    expect(result.excludedUnreferenced).toContain('assets/audio/sound-effect/unused-production.mp3');
    expect(result.files.find((row: any) => row.path.endsWith('gacha.mp3')).provenance.declaration).toBe('unclassified audio; aggregate user declarations only, individual origin unmatched');
    expect(result.files.find((row: any) => row.path.endsWith('a.mp3')).provenance.declaration).toBe('personally produced BGM (user declaration)');
});

test('unknown missing library license text fails instead of silently emitting an empty notice', () => {
    put('package.json', JSON.stringify({ dependencies: { 'local-license-test': '1.0.0' } }));
    put('node_modules/local-license-test/package.json', JSON.stringify({ name: 'local-license-test', version: '1.0.0', license: 'MIT' }));
    expect(() => collectDependencyNotices(root)).toThrow('Missing dependency license text');
    put('node_modules/local-license-test/LICENSE.txt', 'preserved test license');
    expect(collectDependencyNotices(root)).toContain('preserved test license');
});

test('existing battle packager consumes snapshot identity without Git and rejects missing runtime models', () => {
    put('package.json', JSON.stringify({ dependencies: {} }));
    put('.godot-source.json', JSON.stringify({ schemaVersion: 1, sourceCommit: 'adopted-ref', sourceDirty: false, trackedFiles: [], runtimeAssets: [] }));
    put('dist/game/battle/index.js', 'module.exports = {};');
    put('dist/ui/battle/host.d.ts', 'export {};'); put('ui/battle/host.ts', 'export {};');
    put('vite-dist/app.js', ''); put('index.html', '<html></html>');
    for (const name of ['ort.min.js', 'ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm']) put(`node_modules/onnxruntime-web/dist/${name}`, 'test');
    put('data/models/model-assets.json', JSON.stringify({ schemaVersion: 'model_assets.v1', files: ['data/models/policy-table.json'] }));
    expect(() => buildBattlePackage(root)).toThrow('Missing required runtime model');
    put('data/models/policy-table.json', '{}');
    const out = buildBattlePackage(root);
    expect(JSON.parse(fs.readFileSync(path.join(out, 'PACKAGE-MANIFEST.json'), 'utf8'))).toMatchObject({ sourceCommit: 'adopted-ref', sourceDirty: false });
});

test('requires a declared adoption ref and a successful collection marker', async () => {
    seed();
    await expect(createGodotSourcePackage({ root, ref: '', out: 'output/x', modelsFrom: root })).rejects.toThrow('Explicit adopted');
    put('output/broken/INCOMPLETE.json', '{}');
    expect(() => verifyGodotSourcePackage(path.join(root, 'output/broken'))).toThrow('did not finish');
});
