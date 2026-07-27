import * as fs from 'fs';
import * as path from 'path';

interface GenerateCardArtMapOptions {
    root?: string;
    write?: boolean;
}

interface GenerateCardArtMapResult {
    map: Record<string, string>;
    pathMap: Record<string, string>;
    source: string;
    outPath: string;
    wroteFile: boolean;
}

function normalizeCardName(value: unknown): string {
    return String(value || '').trim();
}

function collectCardArtByName(cardArtDir: string): Map<string, string> {
    const result = new Map<string, string>();
    const entries = fs.existsSync(cardArtDir) ? fs.readdirSync(cardArtDir) : [];
    for (const filename of entries) {
        const match = /^(\d{2})_(.+)\.png$/u.exec(filename);
        if (!match) continue;
        const cardName = match[2];
        if (result.has(cardName)) {
            throw new Error(`Duplicate card art name "${cardName}" in ${cardArtDir}`);
        }
        result.set(cardName, filename);
    }
    return result;
}

function normalizeLogicalAssetPath(value: unknown): string {
    return String(value || '').trim().replace(/\\/gu, '/');
}

function buildCardArtMaps(projectRoot: string): { filenameMap: Record<string, string>; pathMap: Record<string, string> } {
    const catalogPath = path.join(projectRoot, 'cards', 'catalog.json');
    const cardArtDir = path.join(projectRoot, 'assets', 'images', 'card');
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    const cards = Array.isArray(catalog.cards) ? catalog.cards : [];
    const artByName = collectCardArtByName(cardArtDir);
    const filenameMap: Record<string, string> = {};
    const pathMap: Record<string, string> = {};
    for (const card of cards) {
        const id = normalizeCardName(card && card.id);
        const name = normalizeCardName((card && card.name_ja) || (card && card.name));
        if (!id || !name) continue;
        const explicitPath = normalizeLogicalAssetPath(card && card.card_face_art_path);
        if (explicitPath) {
            if (path.isAbsolute(explicitPath) || explicitPath.startsWith('../') || explicitPath.includes('/../')) {
                throw new Error(`Invalid card_face_art_path for ${id}: ${explicitPath}`);
            }
            if (!fs.existsSync(path.join(projectRoot, ...explicitPath.split('/')))) {
                throw new Error(`Missing explicit card art for ${id} (${name}): ${explicitPath}`);
            }
            pathMap[id] = explicitPath;
            continue;
        }
        const filename = artByName.get(name);
        if (!filename) {
            throw new Error(`Missing card art for ${id} (${name})`);
        }
        filenameMap[id] = filename;
        pathMap[id] = `assets/images/card/${filename}`;
    }
    return { filenameMap, pathMap };
}

function buildCardArtMap(projectRoot: string): Record<string, string> {
    return buildCardArtMaps(projectRoot).filenameMap;
}

function renderRecordBody(map: Record<string, string>): string {
    return Object.entries(map)
        .map(([id, filename]) => `    ${JSON.stringify(id)}: ${JSON.stringify(filename)}`)
        .join(',\n');
}

function renderCardArtMapSource(map: Record<string, string>, pathMap?: Record<string, string>): string {
    const resolvedPathMap = pathMap || Object.fromEntries(
        Object.entries(map).map(([id, filename]) => [id, `assets/images/card/${filename}`])
    );
    return [
        '// Auto-generated from cards/catalog.json and declared card art assets - do not edit directly.',
        '// Use: node scripts/generate-card-art-map.js to regenerate.',
        'export const CARD_FACE_ART_FILENAME_BY_ID: Record<string, string> = Object.freeze({',
        renderRecordBody(map),
        '});',
        '',
        'export const CARD_FACE_ART_PATH_BY_ID: Record<string, string> = Object.freeze({',
        renderRecordBody(resolvedPathMap),
        '});',
        '',
        'export default CARD_FACE_ART_FILENAME_BY_ID;',
        ''
    ].join('\n');
}

function writeGeneratedFile(outPath: string, source: string): boolean {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    if (fs.existsSync(outPath) && fs.readFileSync(outPath, 'utf8') === source) {
        return false;
    }
    fs.writeFileSync(outPath, source, 'utf8');
    return true;
}

function generateCardArtMap(options: GenerateCardArtMapOptions = {}): GenerateCardArtMapResult {
    const projectRoot = options.root || process.cwd();
    const { filenameMap: map, pathMap } = buildCardArtMaps(projectRoot);
    const source = renderCardArtMapSource(map, pathMap);
    const outPath = path.join(projectRoot, 'cards', 'card-art-map.generated.ts');
    const shouldWrite = options.write !== false;
    const wroteFile = shouldWrite ? writeGeneratedFile(outPath, source) : false;
    return { map, pathMap, source, outPath, wroteFile };
}

if (require.main === module) {
    try {
        const result = generateCardArtMap();
        console.log('Generated', result.outPath);
    } catch (error) {
        console.error('[card-art-map] failed', error);
        process.exit(1);
    }
}

export = { generateCardArtMap, buildCardArtMap, buildCardArtMaps, renderCardArtMapSource } as any;
