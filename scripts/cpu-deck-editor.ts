#!/usr/bin/env node
/**
 * Local developer tool for the per-CPU decks (01-rulebook.md 2.x "CPUの固有デッキ").
 * `npm run cpu-decks:editor` serves tools/cpu-deck-editor/index.html. "反映" rewrites
 * shared/cpu-opponent-decks.ts (the source of truth) and runs `npm run build:vite`
 * so the normal local game picks the decks up after a reload. Binds 127.0.0.1 only.
 */
import fs = require('node:fs');
import path = require('node:path');
import http = require('node:http');
import os = require('node:os');
import { spawn } from 'node:child_process';
import { resolveCardRoles, listCardRoles } from './cpu-deck-card-roles';

export const CPU_DECKS_SOURCE = 'shared/cpu-opponent-decks.ts';
/** Hypothetical-world search rejects public recipes above this size (LV10_POSITION_LIMITS.maxDeck). */
export const CPU_DECK_MAX_CARDS = 512;

export type CpuDeckProfileInfo = { id: string; level: number; name: string; editable: boolean; portraitSrc?: string };
export type CpuDeckMap = Record<string, string[] | null>;

/** Lv9 keeps its all-cards deck; every other CPU profile has an editable deck. */
export function isEditableCpuDeckProfile(profile: { id: string; level: number }): boolean {
    return profile.level !== 9;
}

/** Validates a requested deck map. A deck is null (default random deck) or 1..512 enabled card ids;
 * copies of one card and the deck size are otherwise unrestricted. */
export function validateCpuDecks(input: unknown, profiles: readonly CpuDeckProfileInfo[], enabledCardIds: ReadonlySet<string>): CpuDeckMap {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('デッキの形式が正しくありません');
    const editable = new Map(profiles.filter(profile => profile.editable).map(profile => [profile.id, profile]));
    const result: CpuDeckMap = {};
    for (const [id, deck] of Object.entries(input as Record<string, unknown>)) {
        const profile = editable.get(id);
        if (!profile) throw new Error(`編集できないCPUです: ${id}`);
        if (deck === null) { result[id] = null; continue; }
        if (!Array.isArray(deck)) throw new Error(`Lv${profile.level} のデッキの形式が正しくありません`);
        if (deck.length < 1 || deck.length > CPU_DECK_MAX_CARDS) throw new Error(`Lv${profile.level} のデッキは1〜${CPU_DECK_MAX_CARDS}枚にしてください（現在 ${deck.length}枚）`);
        const unknown = deck.find(cardId => typeof cardId !== 'string' || !enabledCardIds.has(cardId));
        if (unknown !== undefined) throw new Error(`Lv${profile.level} のデッキに使えないカードがあります: ${String(unknown)}`);
        result[id] = deck.slice() as string[];
    }
    return result;
}

const DATA_BEGIN = '/* cpu-decks:begin */', DATA_END = '/* cpu-decks:end */';

/** Deterministic source text: profiles in menu order, cards in catalog order. The data
 * between the markers is plain JSON so the tool can read it back without the build. */
export function formatCpuDecksSource(decks: CpuDeckMap, profiles: readonly CpuDeckProfileInfo[], cardOrder: readonly string[]): string {
    const rank = new Map(cardOrder.map((id, index) => [id, index]));
    const entries = profiles.filter(profile => profile.editable && Object.prototype.hasOwnProperty.call(decks, profile.id));
    const body = entries.map((profile, index) => {
        const deck = decks[profile.id];
        const comma = index < entries.length - 1 ? ',' : '';
        if (deck === null) return `    ${JSON.stringify(profile.id)}: null${comma}`;
        const sorted = deck.slice().sort((a, b) => (rank.get(a) ?? 1e9) - (rank.get(b) ?? 1e9) || a.localeCompare(b));
        const rows: string[] = [];
        for (let at = 0; at < sorted.length; at += 6) rows.push('        ' + sorted.slice(at, at + 6).map(id => JSON.stringify(id)).join(', ') + (at + 6 < sorted.length ? ',' : ''));
        return `    ${JSON.stringify(profile.id)}: [\n${rows.join('\n')}\n    ]${comma}`;
    });
    const names = entries.map(profile => `//   ${profile.id}: Lv${profile.level} ${profile.name}`);
    return [
        "'use strict';",
        '',
        '// CPUごとの固定デッキ（カードID。同じカードを何枚でも入れられる）。01-rulebook.md「CPUの固有デッキ」。',
        '// CPUデッキ調整ツール（npm run cpu-decks:editor）の「反映」で書き換える。手で編集する場合も印の間はJSONのまま保つ。',
        '// null はデフォルトデッキ（対局ごとにランダムな30枚）。Lv9 終焉の冥灰は全種デッキ固定のためここに含めない。',
        ...names,
        `const CPU_OPPONENT_DECK_DATA: Record<string, string[] | null> = ${DATA_BEGIN}{`,
        ...body,
        `}${DATA_END};`,
        '',
        'const CPU_OPPONENT_DECKS: Readonly<Record<string, readonly string[] | null>> = (() => {',
        '    const decks: Record<string, readonly string[] | null> = {};',
        '    for (const id of Object.keys(CPU_OPPONENT_DECK_DATA)) {',
        '        const deck = CPU_OPPONENT_DECK_DATA[id];',
        '        decks[id] = deck ? Object.freeze(deck.slice()) : null;',
        '    }',
        '    return Object.freeze(decks);',
        '})();',
        '',
        'export = { CPU_OPPONENT_DECKS };',
        ''
    ].join('\n');
}

/** Reads the JSON block written by formatCpuDecksSource. */
export function parseCpuDecksSource(text: string): CpuDeckMap {
    const begin = text.indexOf(DATA_BEGIN), end = text.indexOf(DATA_END);
    if (begin < 0 || end < begin) throw new Error(`${CPU_DECKS_SOURCE} にデッキデータの印が見つかりません`);
    return JSON.parse(text.slice(begin + DATA_BEGIN.length, end));
}

type EditorContext = { root: string; profiles: CpuDeckProfileInfo[]; cards: any[]; enabledCardIds: Set<string>; cardOrder: string[];
    readDecks: () => CpuDeckMap; lv9Deck: string[]; defaultDeckSample: string[] };

function loadContext(root: string): EditorContext {
    const dist = (rel: string) => path.join(root, 'dist', rel);
    for (const key of Object.keys(require.cache)) if (key.startsWith(path.join(root, 'dist'))) delete require.cache[key];
    const Profiles = require(dist('shared/cpu-opponent-profiles.js'));
    const DeckSpec = require(dist('shared/deck-spec.js'));
    const Art = require(dist('cards/card-art-map.generated.js'));
    const SpecialStones = require(dist('shared/special-stone-registry-static.js'));
    const catalog = JSON.parse(fs.readFileSync(path.join(root, 'cards/catalog.json'), 'utf8')).cards as any[];
    const enabledCardIds = new Set<string>(DeckSpec.getEnabledCardIds());
    const cards = catalog.filter(card => enabledCardIds.has(card.id)).map(card => ({ id: card.id, name: card.name_ja, type: card.type,
        cost: card.cost, desc: card.desc_ja, kind: card.display_type_ja || '', image: Art.CARD_FACE_ART_PATH_BY_ID?.[card.id] || null,
        // Same judgment as the game: the card turns a stone into a special stone.
        specialStone: !!SpecialStones.getMarkerTypeForSpecialStoneCard(card.type),
        roles: resolveCardRoles(card.type, !!SpecialStones.getMarkerTypeForSpecialStoneCard(card.type)) }));
    const profiles = (Profiles.getCpuOpponentProfiles() as any[]).map(profile => ({ id: profile.id, level: profile.level, name: profile.name,
        editable: isEditableCpuDeckProfile(profile), portraitSrc: profile.portraitSrc }));
    return { root, profiles, cards, enabledCardIds, cardOrder: catalog.map(card => card.id),
        readDecks: () => parseCpuDecksSource(fs.readFileSync(path.join(root, CPU_DECKS_SOURCE), 'utf8')),
        lv9Deck: DeckSpec.getCpuLv9EndingAshDeckCardIds(), defaultDeckSample: DeckSpec.sampleDefaultDeckCardIds(null) };
}

const STATIC_TYPES: Record<string, string> = { '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

type BuildState = { status: 'idle' | 'running' | 'done' | 'failed'; startedAt: string | null; finishedAt: string | null; log: string };

export function createCpuDeckEditorServer(root: string) {
    let context = loadContext(root);
    const build: BuildState = { status: 'idle', startedAt: null, finishedAt: null, log: '' };
    /** Rebuilds the playable game, then refreshes the Godot CPU golden whose
     * profile startup options include every CPU deck (test/fixtures/godot-cpu-search.json). */
    const runBuild = () => {
        Object.assign(build, { status: 'running', startedAt: new Date().toISOString(), finishedAt: null, log: '' });
        const append = (chunk: Buffer | string) => { build.log = (build.log + chunk.toString()).slice(-20000); };
        const finish = (ok: boolean) => {
            build.status = ok ? 'done' : 'failed'; build.finishedAt = new Date().toISOString();
            if (ok) context = loadContext(root);
        };
        const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build:vite'], { cwd: root, shell: process.platform === 'win32' });
        child.stdout.on('data', append); child.stderr.on('data', append);
        child.on('close', code => {
            if (code !== 0) return finish(false);
            const temp = path.join(os.tmpdir(), `godot-cpu-search-${process.pid}-${Date.now()}.json`);
            const golden = spawn(process.execPath, [path.join(root, 'dist/scripts/godot-cpu-benchmark.js'), 'generate', temp], { cwd: root });
            golden.stdout.on('data', append); golden.stderr.on('data', append);
            golden.on('close', goldenCode => {
                try {
                    if (goldenCode !== 0) return finish(false);
                    fs.copyFileSync(temp, path.join(root, 'test/fixtures/godot-cpu-search.json'));
                    fs.rmSync(temp, { force: true });
                    finish(true);
                } catch (error) { append(String(error)); finish(false); }
            });
        });
    };
    const send = (res: http.ServerResponse, status: number, body: unknown, type = 'application/json; charset=utf-8') => {
        res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
        res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
    };
    const page = path.join(root, 'tools/cpu-deck-editor/index.html');
    return http.createServer((req, res) => {
        const url = new URL(req.url || '/', 'http://127.0.0.1');
        try {
            if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) return send(res, 200, fs.readFileSync(page), 'text/html; charset=utf-8');
            if (req.method === 'GET' && url.pathname === '/api/state') {
                return send(res, 200, { profiles: context.profiles, cards: context.cards, roles: listCardRoles(), decks: context.readDecks(),
                    lv9Deck: context.lv9Deck, defaultDeckSample: context.defaultDeckSample, maxCards: CPU_DECK_MAX_CARDS, build });
            }
            if (req.method === 'GET' && url.pathname === '/api/build') return send(res, 200, build);
            if (req.method === 'POST' && url.pathname === '/api/decks') {
                if (build.status === 'running') return send(res, 409, { error: 'ビルド中です。完了してからもう一度反映してください' });
                let raw = '';
                req.on('data', chunk => { raw += chunk; if (raw.length > 2_000_000) req.destroy(); });
                req.on('end', () => {
                    try {
                        const requested = validateCpuDecks(JSON.parse(raw).decks, context.profiles, context.enabledCardIds);
                        const merged = { ...context.readDecks(), ...requested };
                        fs.writeFileSync(path.join(root, CPU_DECKS_SOURCE), formatCpuDecksSource(merged, context.profiles, context.cardOrder));
                        runBuild();
                        send(res, 200, { ok: true, decks: merged, build });
                    } catch (error) { send(res, 400, { error: error instanceof Error ? error.message : String(error) }); }
                });
                return;
            }
            // The page reuses the game's own stylesheets, fonts and images (read-only).
            const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
            if (req.method === 'GET' && (/^styles-[\w-]+\.css$/.test(relative) || relative.startsWith('assets/'))) {
                const file = path.resolve(root, relative);
                const type = STATIC_TYPES[path.extname(file).toLowerCase()];
                if (!file.startsWith(root + path.sep) || !type || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, 'not found', 'text/plain');
                res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'max-age=3600' });
                return res.end(fs.readFileSync(file));
            }
            send(res, 404, 'not found', 'text/plain');
        } catch (error) { send(res, 500, { error: error instanceof Error ? error.message : String(error) }); }
    });
}

if (require.main === module) {
    const root = path.resolve(__dirname, '../..');
    const port = Number(process.env.CPU_DECK_EDITOR_PORT || 8095);
    createCpuDeckEditorServer(root).listen(port, '127.0.0.1', () => {
        console.log(`CPUデッキ調整ツール: http://127.0.0.1:${port}/  （終了は Ctrl+C）`);
    });
}
