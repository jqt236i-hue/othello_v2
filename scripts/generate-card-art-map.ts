import * as fs from 'fs';
import * as path from 'path';

interface GenerateCardArtMapOptions {
    root?: string;
    write?: boolean;
}

interface GenerateCardArtMapResult {
    map: Record<string, string>;
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

function buildCardArtMap(projectRoot: string): Record<string, string> {
    const catalogPath = path.join(projectRoot, 'cards', 'catalog.json');
    const cardArtDir = path.join(projectRoot, 'assets', 'images', 'card');
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    const cards = Array.isArray(catalog.cards) ? catalog.cards : [];
    const artByName = collectCardArtByName(cardArtDir);
    const map: Record<string, string> = {};
    for (const card of cards) {
        const id = normalizeCardName(card && card.id);
        const name = normalizeCardName((card && card.name_ja) || (card && card.name));
        if (!id || !name) continue;
        const filename = artByName.get(name);
        if (!filename) {
            throw new Error(`Missing card art for ${id} (${name})`);
        }
        map[id] = filename;
    }
    return map;
}

function renderCardArtMapSource(map: Record<string, string>): string {
    const body = Object.entries(map)
        .map(([id, filename]) => `    ${JSON.stringify(id)}: ${JSON.stringify(filename)}`)
        .join(',\n');
    return [
        '// Auto-generated from cards/catalog.json and assets/images/card - do not edit directly.',
        '// Use: node scripts/generate-card-art-map.js to regenerate.',
        'export const CARD_FACE_ART_FILENAME_BY_ID: Record<string, string> = Object.freeze({',
        body,
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
    const map = buildCardArtMap(projectRoot);
    const source = renderCardArtMapSource(map);
    const outPath = path.join(projectRoot, 'cards', 'card-art-map.generated.ts');
    const shouldWrite = options.write !== false;
    const wroteFile = shouldWrite ? writeGeneratedFile(outPath, source) : false;
    return { map, source, outPath, wroteFile };
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

export = { generateCardArtMap, buildCardArtMap, renderCardArtMapSource } as any;
