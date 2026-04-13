const fs = require('fs');
const path = require('path');
const GachaHandCatalogShared = require('../shared/gacha-hand-catalog-shared.js');

const RARITY_ORDER = Object.freeze(['EXR', 'UR', 'SSR', 'SR', 'R', 'N']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function collectFilesRecursive(dirPath) {
    if (!fs.existsSync(dirPath)) return [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const out = [];
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

function collectCatalogItems(rootDir) {
    const baseDir = path.join(rootDir, 'assets', 'images', 'Gacha');
    const paths = [];

    RARITY_ORDER.forEach((rarity) => {
        const rarityDir = path.join(baseDir, rarity);
        const files = collectFilesRecursive(rarityDir)
            .filter((filePath) => IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase()))
            .sort((a, b) => path.parse(a).name.localeCompare(path.parse(b).name, 'ja'));

        files.forEach((filePath) => {
            paths.push(path.relative(rootDir, filePath).replace(/\\/g, '/'));
        });
    });

    if (GachaHandCatalogShared && typeof GachaHandCatalogShared.collectCatalogItemsFromPaths === 'function') {
        return GachaHandCatalogShared.collectCatalogItemsFromPaths(paths);
    }
    return [];
}

function buildCatalogModulePayload(catalog) {
    const payload = JSON.stringify(catalog, null, 4);
    return `(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.GachaHandCatalogModule = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const catalog = ${payload};
    const frozenItems = Array.isArray(catalog.items)
        ? catalog.items.map((item) => Object.freeze(item))
        : [];
    catalog.items = Object.freeze(frozenItems);
    return Object.freeze(catalog);
}));
`;
}

function writeCatalogFile(outPath, payload) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, payload, 'utf8');
}

function generateGachaHandCatalog(options = {}) {
    const projectRoot = options.root || path.resolve(__dirname, '..');
    const outPath = options.outPath || path.join(projectRoot, 'shared', 'gacha-hand-catalog.generated.js');
    const items = collectCatalogItems(projectRoot);
    const catalog = {
        version: 1,
        generatedAt: new Date().toISOString(),
        sourceDir: 'assets/images/Gacha',
        items
    };
    const payload = buildCatalogModulePayload(catalog);
    const shouldWrite = options.write !== false && options.persist !== false;
    if (shouldWrite) {
        writeCatalogFile(outPath, payload);
    }
    return {
        catalog,
        outPath,
        wroteFile: shouldWrite
    };
}

if (require.main === module) {
    try {
        const result = generateGachaHandCatalog();
        console.log('[gacha-hand-catalog] generated', result.outPath);
        process.exit(0);
    } catch (e) {
        console.error('[gacha-hand-catalog] failed', e);
        process.exit(2);
    }
}

module.exports = {
    generateGachaHandCatalog
};
