import * as fs from 'fs';
import * as path from 'path';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const ObservationGachaCatalogShared = require('../shared/observation-gacha-catalog-shared.js');
const GachaHandCatalogShared = require('../shared/gacha-hand-catalog-shared.js');

const RARITY_ORDER: string[] = ObservationGachaCatalogShared.RARITY_ORDER;
const SUPPORTED_EXTENSIONS = new Set<string>(
    []
        .concat(ObservationGachaCatalogShared.IMAGE_EXTENSIONS || [])
        .concat(ObservationGachaCatalogShared.SOUND_EXTENSIONS || [])
);

interface CatalogOptions {
    root?: string;
    observationOutPath?: string;
    handAdapterOutPath?: string;
    genericOutPath?: string;
    outPath?: string;
    write?: boolean;
    persist?: boolean;
}

interface CatalogResult {
    observationCatalog: any;
    handCatalog: any;
    observationOutPath: string;
    handAdapterOutPath: string;
    wroteFiles: boolean;
    catalog: any;
    outPath: string;
    genericOutPath: string;
    wroteFile: boolean;
}

function collectFilesRecursive(dirPath: string): string[] {
    if (!fs.existsSync(dirPath)) return [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const out: string[] = [];
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            out.push(...collectFilesRecursive(fullPath));
            continue;
        }
        out.push(fullPath);
    }
    return out;
}

function collectCatalogAssetPaths(rootDir: string): string[] {
    const baseDir = path.join(rootDir, 'assets', 'images', 'Gacha');
    const paths: string[] = [];

    RARITY_ORDER.forEach((rarity: string) => {
        const rarityDir = path.join(baseDir, rarity);
        const files = collectFilesRecursive(rarityDir)
            .filter((filePath: string) => SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase()))
            .sort((a: string, b: string) => path.parse(a).name.localeCompare(path.parse(b).name, 'ja'));

        files.forEach((filePath: string) => {
            paths.push(path.relative(rootDir, filePath).replace(/\\/g, '/'));
        });
    });
    return paths;
}

function buildCatalogModulePayload(catalog: any, globalName: string): string {
    const payload = JSON.stringify(catalog, null, 4);
    return `(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.${globalName} = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const catalog = ${payload};
    const frozenItems = Array.isArray(catalog.items)
        ? catalog.items.map((item: any) => Object.freeze(item))
        : [];
    catalog.items = Object.freeze(frozenItems);
    return Object.freeze(catalog);
}));
`;
}

function writeCatalogFile(outPath: string, payload: string) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, payload, 'utf8');
}

function generateObservationGachaCatalogs(options: CatalogOptions = {}): CatalogResult {
    const projectRoot = options.root || path.resolve(__dirname, '..');
    const observationOutPath = options.observationOutPath || options.genericOutPath || path.join(projectRoot, 'shared', 'observation-gacha-catalog.generated.js');
    const handAdapterOutPath = options.handAdapterOutPath || options.outPath || path.join(projectRoot, 'shared', 'gacha-hand-catalog.generated.js');
    const assetPaths = collectCatalogAssetPaths(projectRoot);
    const observationItems = ObservationGachaCatalogShared && typeof ObservationGachaCatalogShared.collectCatalogItemsFromPaths === 'function'
        ? ObservationGachaCatalogShared.collectCatalogItemsFromPaths(assetPaths)
        : [];
    const handItems = GachaHandCatalogShared && typeof GachaHandCatalogShared.collectCatalogItemsFromPaths === 'function'
        ? GachaHandCatalogShared.collectCatalogItemsFromPaths(assetPaths)
        : [];
    const observationCatalog = {
        version: 1,
        generatedAt: new Date().toISOString(),
        sourceDir: 'assets/images/Gacha',
        items: observationItems
    };
    const handCatalog = {
        version: observationCatalog.version,
        generatedAt: observationCatalog.generatedAt,
        sourceDir: observationCatalog.sourceDir,
        items: handItems
    };
    const observationPayload = buildCatalogModulePayload(observationCatalog, 'ObservationGachaCatalogModule');
    const handAdapterPayload = buildCatalogModulePayload(handCatalog, 'GachaHandCatalogModule');
    const shouldWrite = options.write !== false && options.persist !== false;
    if (shouldWrite) {
        writeCatalogFile(observationOutPath, observationPayload);
        writeCatalogFile(handAdapterOutPath, handAdapterPayload);
    }
    return {
        observationCatalog,
        handCatalog,
        observationOutPath,
        handAdapterOutPath,
        wroteFiles: shouldWrite,
        catalog: handCatalog,
        outPath: handAdapterOutPath,
        genericOutPath: observationOutPath,
        wroteFile: shouldWrite
    };
}

if (require.main === module) {
    try {
        const result = generateObservationGachaCatalogs();
        console.log('[observation-gacha-catalog] generated', result.observationOutPath);
        console.log('[observation-gacha-catalog] generated', result.handAdapterOutPath);
        process.exit(0);
    } catch (e) {
        console.error('[observation-gacha-catalog] failed', e);
        process.exit(2);
    }
}

export = { 
    generateObservationGachaCatalogs
 } as any;
