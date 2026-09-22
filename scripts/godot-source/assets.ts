import fs = require('fs');
import path = require('path');
import crypto = require('crypto');
import vm = require('vm');
import ts = require('typescript');
import sharp = require('sharp');
import { checkAssetFileCase } from '../check-asset-file-case';

export const sha256 = (data: Buffer | string): string => crypto.createHash('sha256').update(data).digest('hex');
export const mediaPattern = /\.(?:png|webp|jpe?g|gif|svg|mp3|ogg|wav|woff2?|ttf|otf)$/i;
export const forbiddenAsset = /(?:^|\/)(?:[^/]*_reference|archive|blender|node_modules|\.git)(?:\/|$)|\.(?:blend|psd|kra|bak|tmp)$/i;

export function listFiles(root: string, prefix = ''): string[] {
    if (!fs.existsSync(path.join(root, prefix))) return [];
    return fs.readdirSync(path.join(root, prefix), { withFileTypes: true }).flatMap(entry => {
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isSymbolicLink()) throw new Error(`Symbolic link is not allowed in source collection: ${relative}`);
        return entry.isDirectory() ? listFiles(root, relative) : [relative];
    }).sort();
}

export interface AssetReference { source: string; line: number; kind: 'literal' | 'dynamic-directory' | 'sound-config'; }
export interface AssetReferences { references: Map<string, AssetReference[]>; unresolved: string[]; }

/** Discover from runtime source, never from an asset directory listing alone or the old asset manifest. */
export function discoverAssetReferences(root: string, available: string[]): AssetReferences {
    const references = new Map<string, AssetReference[]>();
    const unresolved: string[] = [];
    const media = available.filter(file => /^assets\/(?:images|audio|fonts)\//.test(file) && mediaPattern.test(file) && !forbiddenAsset.test(file));
    const mediaSet = new Set(media);
    const add = (file: string, reference: AssetReference) => {
        const rows = references.get(file) || [];
        if (!rows.some(row => row.source === reference.source && row.line === reference.line && row.kind === reference.kind)) rows.push(reference);
        references.set(file, rows);
    };
    const sourceFiles = listFiles(root).filter(file => /^(?:ui|browser-vite|shared|cards|constants|game|utils)\//.test(file)
        ? /\.(ts|js|json)$/.test(file) && !/\/(?:__tests__|test)\//.test(file)
        : !file.includes('/') && /\.(?:ts|js|css|html)$/.test(file));
    for (const source of sourceFiles) {
        if (source.endsWith('.js') && fs.existsSync(path.join(root, source.replace(/\.js$/, '.ts')))) continue;
        const code = fs.readFileSync(path.join(root, source), 'utf8');
        const literals: { text: string; line: number; dynamic?: boolean }[] = [];
        if (/\.(?:ts|js|json)$/.test(source)) {
            const tree = ts.createSourceFile(source, code, ts.ScriptTarget.Latest, true);
            const walk = (node: ts.Node) => {
                if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node)) {
                    literals.push({ text: node.text, line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1,
                        dynamic: ts.isTemplateHead(node) });
                }
                ts.forEachChild(node, walk);
            };
            walk(tree);
        } else {
            for (const match of code.matchAll(/(?:url\(\s*['"]?|(?:src|href)=["'])([^"'()\r\n]+)["']?\)?/g)) {
                literals.push({ text: match[1], line: code.slice(0, match.index).split('\n').length });
            }
        }
        for (const literal of literals) {
            const value = literal.text.replace(/^(?:\.\/|\/)/, '').split(/[?#]/)[0];
            if (!/^assets\/(?:images|audio|fonts)\//.test(value)) continue;
            if (forbiddenAsset.test(value)) throw new Error(`Runtime source references excluded production material: ${source}:${literal.line} -> ${value}`);
            if (mediaPattern.test(value) && !literal.dynamic) {
                if (!mediaSet.has(value)) unresolved.push(`${source}:${literal.line} -> ${value}`);
                add(value, { source, line: literal.line, kind: 'literal' });
            } else {
                // SoundEngine's directory strings are concatenation/legacy-replacement bases, not a playlist enumeration.
                // The resolved effect map and explicit playlist/manifest tracks below are the actual references.
                if (source === 'sound-engine.ts' && value.startsWith('assets/audio/')) continue;
                // A named runtime directory is an enumerable selector pool. Broad assets/images is not one.
                const prefix = literal.dynamic ? value : value.replace(/\/$/, '') + '/';
                if (prefix.split('/').filter(Boolean).length < 3) continue;
                for (const file of media.filter(file => file.startsWith(prefix))) add(file, { source, line: literal.line, kind: 'dynamic-directory' });
            }
        }
    }
    const soundFile = path.join(root, 'sound-engine.ts');
    if (fs.existsSync(soundFile)) {
        const sound = readSoundConfiguration(root);
        for (const [key, filename] of Object.entries(sound.effectSoundFiles) as [string, string][]) {
            const file = filename.startsWith('assets/') ? filename : sound.effectBasePath + filename;
            add(file, { source: 'sound-engine.ts', line: 1, kind: 'sound-config' });
            if (!mediaSet.has(file)) unresolved.push(`sound-engine.ts effectSoundFiles.${key} -> ${file}`);
        }
    }
    return { references, unresolved: [...new Set(unresolved)].sort() };
}

/** Read the local source object's defaults without initializing Audio, timers, DOM, or network. */
export function readSoundConfiguration(root: string): any {
    const code = ts.transpileModule(fs.readFileSync(path.join(root, 'sound-engine.ts'), 'utf8'),
        { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const context = { exports: {} as any, require: () => { throw new Error('Unexpected sound configuration dependency'); } };
    vm.runInNewContext(code, context, { timeout: 1000 });
    return context.exports.default;
}

function readManifestPresentations(root: string): any[] {
    const filename = path.join(root, 'shared/special-card-registry.ts');
    if (!fs.existsSync(filename)) return [];
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'),
        { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const context = { module: { exports: {} as any } };
    vm.runInNewContext(code, context, { timeout: 1000 });
    const registry = context.module.exports;
    return registry.getInviolableSpecialCardIds().map((id: string) => registry.getSpecialCardPresentation(id));
}

function audioSettings(file: string, sound: any, presentations: any[]): any[] {
    if (!sound) return [];
    const rows: any[] = [];
    const gain = sound.bgmVolume * sound.bgmOutputVolumeScale;
    for (const [index, track] of sound.playlist.entries()) if (track.file === file) rows.push({ role: 'playlist', index, name: track.name,
        loop: true, loopStartSeconds: track.loopStart || 0, loopEndSeconds: track.loopEnd ?? null, defaultGain: gain,
        defaultSelected: index === sound.currentTrackIndex, gainFormula: 'clamp01(bgmVolume * bgmOutputVolumeScale * masterVolume)' });
    for (const [outcome, track] of Object.entries(sound.resultBgmTracks) as [string, any][]) if (track.file === file) rows.push({ role: 'result', outcome,
        loop: track.loop, loopStartSeconds: track.loopStart || 0, loopEndSeconds: track.loopEnd ?? null, defaultGain: gain,
        gainFormula: 'clamp01(bgmVolume * bgmOutputVolumeScale * masterVolume)' });
    for (const [key, filename] of Object.entries(sound.effectSoundFiles) as [string, string][]) {
        if ((filename.startsWith('assets/') ? filename : sound.effectBasePath + filename) !== file) continue;
        const scale = sound.effectVolumeScales[key] ?? sound.effectDefaultVolumeScale;
        rows.push({ role: 'effect', key, loop: false, baseVolume: sound.effectBaseVolume, volumeScale: scale,
            defaultGain: Math.min(1, sound.effectBaseVolume * scale), gainFormula: 'clamp01(effectBaseVolume * volumeScale * masterVolume)',
            override: 'call-site volumeScale overrides the key scale; mute/masterVolume are user settings' });
    }
    for (const presentation of presentations) {
        const track = presentation.manifestBgmTrack;
        if (track?.file === file) rows.push({ role: 'manifest-stone-bgm', cardId: presentation.cardId, key: presentation.manifestBgmKey,
            loop: true, loopStartSeconds: track.loopStart || 0, loopEndSeconds: track.loopEnd ?? null, defaultGain: gain,
            settingsSource: 'shared/special-card-registry.ts', gainFormula: 'clamp01(bgmVolume * bgmOutputVolumeScale * masterVolume)' });
    }
    if (file === 'assets/audio/other/gacha.mp3') rows.push({ role: 'gacha', loop: false, defaultGain: sound.effectBaseVolume,
        settingsSource: 'ui/gacha/gacha-reveal-audio.ts', gainFormula: 'clamp01(effectBaseVolume * masterVolume * (isMuted ? 0 : 1))' });
    if (/^assets\/audio\/sound-effect-skin\//.test(file) && !rows.length) rows.push({ role: 'placement-sound-skin', loop: false,
        key: 'stone_place', baseVolume: sound.effectBaseVolume, volumeScale: sound.effectVolumeScales.stone_place ?? sound.effectDefaultVolumeScale,
        defaultGain: Math.min(1, sound.effectBaseVolume * (sound.effectVolumeScales.stone_place ?? sound.effectDefaultVolumeScale)),
        settingsSource: 'sound-engine.ts resolveStonePlaceEffectPath / getEffectVolume' });
    return rows;
}

export async function buildAssetInventory(root: string, available = listFiles(root, 'assets')): Promise<any> {
    const discovered = discoverAssetReferences(root, available);
    const casing = checkAssetFileCase({ rootDir: root, trackedPaths: [...discovered.references.keys()], assetRoots: ['assets'] });
    if (discovered.unresolved.length || !casing.ok) throw new Error(`Invalid runtime asset references:\n${[...discovered.unresolved, ...casing.issues.map(issue => issue.message)].join('\n')}`);
    const sound = fs.existsSync(path.join(root, 'sound-engine.ts')) ? readSoundConfiguration(root) : null;
    const presentations = readManifestPresentations(root);
    const files: any[] = [];
    for (const [file, references] of [...discovered.references].sort(([a], [b]) => a < b ? -1 : 1)) {
        const buffer = fs.readFileSync(path.join(root, file));
        const kind = file.startsWith('assets/images/') ? 'image' : file.startsWith('assets/fonts/') ? 'font' : 'audio';
        const image = kind === 'image' ? await sharp(buffer).metadata() : null;
        const playback = kind === 'audio' ? audioSettings(file, sound, presentations) : [];
        const isBgm = playback.some(row => ['playlist', 'result', 'manifest-stone-bgm'].includes(row.role));
        const isEffect = playback.some(row => ['effect', 'placement-sound-skin'].includes(row.role));
        files.push({ path: file, kind, bytes: buffer.length, sha256: sha256(buffer), references,
            ...(image ? { image: { format: image.format, width: image.width, height: image.height, hasAlpha: image.hasAlpha, channels: image.channels } } : {}),
            ...(kind === 'audio' ? { playback, otherPlaybackSources: references.map(row => `${row.source}:${row.line}`),
                emptyPlaybackMeaning: 'See the recorded runtime reference for dynamic manifest/gacha/skin settings; no inferred gain or loop.' } : {}),
            provenance: kind === 'image' ? { declaration: 'GPT image generation', individualVerification: 'unmatched', source: 'docs/asset-provenance.md' }
                : kind === 'font' ? { declaration: 'bundled font metadata', individualVerification: 'font-build-manifest.json and OFL.txt', source: 'assets/fonts/font-build-manifest.json' }
                : { declaration: isBgm ? 'personally produced BGM (user declaration)' : isEffect ? 'Springin’ Sound Stock or イワシロ音楽素材; individual provider unmatched'
                    : 'unclassified audio; aggregate user declarations only, individual origin unmatched',
                    individualVerification: 'unmatched', source: 'docs/asset-provenance.md' } });
    }
    return { schemaVersion: 1, discovery: 'runtime-source literals, named dynamic selector directories, and resolved sound effect map; not a claim that every selectable asset is used in one battle',
        playbackDefaults: sound ? { masterVolume: sound.masterVolume, masterVolumeRange: [0, 2], effectBaseVolume: sound.effectBaseVolume,
            effectDefaultVolumeScale: sound.effectDefaultVolumeScale, bgmVolume: sound.bgmVolume, bgmOutputVolumeScale: sound.bgmOutputVolumeScale,
            specialCardUseBgmMuteMs: sound.specialCardUseBgmMuteMs, loopEndNull: 'decoded audio duration' } : null,
        files, excludedUnreferenced: available.filter(file => mediaPattern.test(file) && !discovered.references.has(file)).sort() };
}
