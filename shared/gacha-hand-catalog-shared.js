(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.GachaHandCatalogSharedModule = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const SOURCE_DIR = 'assets/images/Gacha';
    const RARITY_ORDER = Object.freeze(['EXR', 'UR', 'SSR', 'SR', 'R', 'N']);
    const RARITY_INDEX = Object.freeze(RARITY_ORDER.reduce((acc, rarity, index) => {
        acc[rarity] = index;
        return acc;
    }, {}));
    const IMAGE_EXTENSIONS = Object.freeze(['.png', '.jpg', '.jpeg', '.webp']);
    const IMAGE_EXTENSION_SET = new Set(IMAGE_EXTENSIONS);
    const LEGACY_ITEM_ID_ALIASES = Object.freeze({
        'gacha__n__hand': 'gacha__n__人の手',
        'gacha__n__hand.png': 'gacha__n__人の手',
        'gacha__n__hand-swap': 'gacha__n__陽気な手',
        'gacha__n__hand-swap.png': 'gacha__n__陽気な手'
    });

    function normalizePath(value) {
        return String(value || '').replace(/\\/g, '/').trim();
    }

    function normalizeRarity(value) {
        const normalized = String(value || '').trim().toUpperCase();
        return Object.prototype.hasOwnProperty.call(RARITY_INDEX, normalized) ? normalized : null;
    }

    function normalizeCatalogItemId(value) {
        const normalized = String(value || '').trim();
        if (!normalized) return '';
        return Object.prototype.hasOwnProperty.call(LEGACY_ITEM_ID_ALIASES, normalized)
            ? LEGACY_ITEM_ID_ALIASES[normalized]
            : normalized;
    }

    function createCatalogItemId(rarity, label) {
        const normalizedRarity = normalizeRarity(rarity);
        const normalizedLabel = String(label || '').trim();
        if (!normalizedRarity || !normalizedLabel) return '';
        return normalizeCatalogItemId(`gacha__${normalizedRarity.toLowerCase()}__${normalizedLabel}`.replace(/\s+/g, '_'));
    }

    function extractCatalogParts(assetPath) {
        const normalizedPath = normalizePath(assetPath);
        if (!normalizedPath) return null;
        const prefix = `${SOURCE_DIR}/`;
        if (normalizedPath.indexOf(prefix) !== 0) return null;

        const remainder = normalizedPath.slice(prefix.length);
        const slashIndex = remainder.indexOf('/');
        if (slashIndex <= 0) return null;

        const rarity = normalizeRarity(remainder.slice(0, slashIndex));
        if (!rarity) return null;

        const nestedPath = remainder.slice(slashIndex + 1);
        if (!nestedPath || nestedPath.endsWith('/')) return null;

        const fileName = nestedPath.split('/').pop();
        const dotIndex = fileName.lastIndexOf('.');
        if (dotIndex <= 0) return null;

        const extension = fileName.slice(dotIndex).toLowerCase();
        if (!IMAGE_EXTENSION_SET.has(extension)) return null;

        const label = fileName.slice(0, dotIndex).trim();
        if (!label) return null;

        return {
            rarity,
            label,
            imagePath: normalizedPath
        };
    }

    function createCatalogItemFromAssetPath(assetPath) {
        const parts = extractCatalogParts(assetPath);
        if (!parts) return null;
        return {
            id: createCatalogItemId(parts.rarity, parts.label),
            label: parts.label,
            note: `レアリティ ${parts.rarity}`,
            rarity: parts.rarity,
            imagePath: parts.imagePath
        };
    }

    function compareCatalogItems(left, right) {
        const leftRarity = normalizeRarity(left && left.rarity);
        const rightRarity = normalizeRarity(right && right.rarity);
        const leftIndex = leftRarity ? RARITY_INDEX[leftRarity] : Number.MAX_SAFE_INTEGER;
        const rightIndex = rightRarity ? RARITY_INDEX[rightRarity] : Number.MAX_SAFE_INTEGER;
        if (leftIndex !== rightIndex) return leftIndex - rightIndex;

        const leftLabel = String(left && left.label || '');
        const rightLabel = String(right && right.label || '');
        const labelCompare = leftLabel.localeCompare(rightLabel, 'ja');
        if (labelCompare !== 0) return labelCompare;

        const leftPath = normalizePath(left && left.imagePath);
        const rightPath = normalizePath(right && right.imagePath);
        return leftPath.localeCompare(rightPath, 'ja');
    }

    function collectCatalogItemsFromPaths(paths) {
        const safePaths = Array.isArray(paths) ? paths : [];
        const items = [];
        const seenImagePaths = new Set();

        safePaths.forEach((entry) => {
            const candidatePath = normalizePath(entry && typeof entry === 'object' ? entry.path : entry);
            const item = createCatalogItemFromAssetPath(candidatePath);
            if (!item) return;
            if (seenImagePaths.has(item.imagePath)) return;
            seenImagePaths.add(item.imagePath);
            items.push(item);
        });

        items.sort(compareCatalogItems);
        return items;
    }

    function buildCatalogFromAssetManifest(manifest, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const files = Array.isArray(manifest && manifest.files) ? manifest.files : [];
        return {
            version: 1,
            generatedAt: opts.generatedAt ? String(opts.generatedAt) : new Date().toISOString(),
            sourceDir: SOURCE_DIR,
            items: collectCatalogItemsFromPaths(files)
        };
    }

    return Object.freeze({
        SOURCE_DIR,
        RARITY_ORDER,
        IMAGE_EXTENSIONS,
        normalizeRarity,
        normalizeCatalogItemId,
        createCatalogItemId,
        extractCatalogParts,
        createCatalogItemFromAssetPath,
        collectCatalogItemsFromPaths,
        buildCatalogFromAssetManifest
    });
}));
