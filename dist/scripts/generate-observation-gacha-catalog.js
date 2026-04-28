"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
const ObservationGachaCatalogShared = require('../shared/observation-gacha-catalog-shared.js');
const GachaHandCatalogShared = require('../shared/gacha-hand-catalog-shared.js');
const RARITY_ORDER = ObservationGachaCatalogShared.RARITY_ORDER;
const SUPPORTED_EXTENSIONS = new Set([]
    .concat(ObservationGachaCatalogShared.IMAGE_EXTENSIONS || [])
    .concat(ObservationGachaCatalogShared.SOUND_EXTENSIONS || []));
function collectFilesRecursive(dirPath) {
    if (!fs.existsSync(dirPath))
        return [];
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
function collectCatalogAssetPaths(rootDir) {
    const baseDir = path.join(rootDir, 'assets', 'images', 'Gacha');
    const paths = [];
    RARITY_ORDER.forEach((rarity) => {
        const rarityDir = path.join(baseDir, rarity);
        const files = collectFilesRecursive(rarityDir)
            .filter((filePath) => SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase()))
            .sort((a, b) => path.parse(a).name.localeCompare(path.parse(b).name, 'ja'));
        files.forEach((filePath) => {
            paths.push(path.relative(rootDir, filePath).replace(/\\/g, '/'));
        });
    });
    return paths;
}
function buildCatalogModulePayload(catalog, globalName) {
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
function writeCatalogFile(outPath, payload) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, payload, 'utf8');
}
function generateObservationGachaCatalogs(options = {}) {
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
    }
    catch (e) {
        console.error('[observation-gacha-catalog] failed', e);
        process.exit(2);
    }
}
module.exports = {
    generateObservationGachaCatalogs
};
//# sourceMappingURL=generate-observation-gacha-catalog.js.map