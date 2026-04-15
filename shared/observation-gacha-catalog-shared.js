(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.ObservationGachaCatalogSharedModule = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const SOURCE_DIR = 'assets/images/Gacha';
    const RARITY_ORDER = Object.freeze(['EXR', 'UR', 'SSR', 'SR', 'R', 'N']);
    const RARITY_INDEX = Object.freeze(RARITY_ORDER.reduce((acc, rarity, index) => {
        acc[rarity] = index;
        return acc;
    }, {}));
    const ITEM_KIND_HAND_SKIN = 'hand_skin';
    const ITEM_KIND_PLACEMENT_SOUND = 'placement_sound';
    const ITEM_KIND_ORDER = Object.freeze({
        [ITEM_KIND_HAND_SKIN]: 0,
        [ITEM_KIND_PLACEMENT_SOUND]: 1
    });
    const IMAGE_EXTENSIONS = Object.freeze(['.png', '.jpg', '.jpeg', '.webp']);
    const SOUND_EXTENSIONS = Object.freeze(['.mp3', '.ogg', '.wav', '.m4a']);
    const IMAGE_EXTENSION_SET = new Set(IMAGE_EXTENSIONS);
    const SOUND_EXTENSION_SET = new Set(SOUND_EXTENSIONS);
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

    function normalizeCatalogItemKind(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized === ITEM_KIND_HAND_SKIN) return ITEM_KIND_HAND_SKIN;
        if (normalized === ITEM_KIND_PLACEMENT_SOUND) return ITEM_KIND_PLACEMENT_SOUND;
        return null;
    }

    function normalizeCatalogItemId(value) {
        const normalized = String(value || '').trim();
        if (!normalized) return '';
        return Object.prototype.hasOwnProperty.call(LEGACY_ITEM_ID_ALIASES, normalized)
            ? LEGACY_ITEM_ID_ALIASES[normalized]
            : normalized;
    }

    function createCatalogItemId(rarity, label, kind) {
        const normalizedRarity = normalizeRarity(rarity);
        const normalizedLabel = String(label || '').trim();
        const normalizedKind = normalizeCatalogItemKind(kind || ITEM_KIND_HAND_SKIN);
        if (!normalizedRarity || !normalizedLabel || !normalizedKind) return '';
        if (normalizedKind === ITEM_KIND_HAND_SKIN) {
            return normalizeCatalogItemId(`gacha__${normalizedRarity.toLowerCase()}__${normalizedLabel}`.replace(/\s+/g, '_'));
        }
        return `gacha__${normalizedRarity.toLowerCase()}__placement_sound__${normalizedLabel}`.replace(/\s+/g, '_');
    }

    function resolveCatalogItemKindFromExtension(extension) {
        const normalizedExtension = String(extension || '').trim().toLowerCase();
        if (IMAGE_EXTENSION_SET.has(normalizedExtension)) return ITEM_KIND_HAND_SKIN;
        if (SOUND_EXTENSION_SET.has(normalizedExtension)) return ITEM_KIND_PLACEMENT_SOUND;
        return null;
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
        const kind = resolveCatalogItemKindFromExtension(extension);
        if (!kind) return null;

        const label = fileName.slice(0, dotIndex).trim();
        if (!label) return null;

        return {
            rarity,
            kind,
            label,
            assetPath: normalizedPath,
            imagePath: kind === ITEM_KIND_HAND_SKIN ? normalizedPath : '',
            previewImagePath: kind === ITEM_KIND_HAND_SKIN ? normalizedPath : '',
            soundPath: kind === ITEM_KIND_PLACEMENT_SOUND ? normalizedPath : ''
        };
    }

    function createCatalogItemFromAssetPath(assetPath) {
        const parts = extractCatalogParts(assetPath);
        if (!parts) return null;
        const noteSuffix = parts.kind === ITEM_KIND_PLACEMENT_SOUND ? ' / 配置音' : '';
        return {
            id: createCatalogItemId(parts.rarity, parts.label, parts.kind),
            label: parts.label,
            note: `レアリティ ${parts.rarity}${noteSuffix}`,
            rarity: parts.rarity,
            kind: parts.kind,
            assetPath: parts.assetPath,
            imagePath: parts.imagePath,
            previewImagePath: parts.previewImagePath,
            soundPath: parts.soundPath
        };
    }

    function compareCatalogItems(left, right) {
        const leftRarity = normalizeRarity(left && left.rarity);
        const rightRarity = normalizeRarity(right && right.rarity);
        const leftIndex = leftRarity ? RARITY_INDEX[leftRarity] : Number.MAX_SAFE_INTEGER;
        const rightIndex = rightRarity ? RARITY_INDEX[rightRarity] : Number.MAX_SAFE_INTEGER;
        if (leftIndex !== rightIndex) return leftIndex - rightIndex;

        const leftKind = normalizeCatalogItemKind(left && left.kind);
        const rightKind = normalizeCatalogItemKind(right && right.kind);
        const leftKindIndex = Object.prototype.hasOwnProperty.call(ITEM_KIND_ORDER, leftKind) ? ITEM_KIND_ORDER[leftKind] : Number.MAX_SAFE_INTEGER;
        const rightKindIndex = Object.prototype.hasOwnProperty.call(ITEM_KIND_ORDER, rightKind) ? ITEM_KIND_ORDER[rightKind] : Number.MAX_SAFE_INTEGER;
        if (leftKindIndex !== rightKindIndex) return leftKindIndex - rightKindIndex;

        const leftLabel = String(left && left.label || '');
        const rightLabel = String(right && right.label || '');
        const labelCompare = leftLabel.localeCompare(rightLabel, 'ja');
        if (labelCompare !== 0) return labelCompare;

        const leftPath = normalizePath(left && left.assetPath);
        const rightPath = normalizePath(right && right.assetPath);
        return leftPath.localeCompare(rightPath, 'ja');
    }

    function collectCatalogItemsFromPaths(paths) {
        const safePaths = Array.isArray(paths) ? paths : [];
        const items = [];
        const seenAssetPaths = new Set();

        safePaths.forEach((entry) => {
            const candidatePath = normalizePath(entry && typeof entry === 'object' ? entry.path : entry);
            const item = createCatalogItemFromAssetPath(candidatePath);
            if (!item) return;
            if (seenAssetPaths.has(item.assetPath)) return;
            seenAssetPaths.add(item.assetPath);
            items.push(item);
        });

        items.sort(compareCatalogItems);
        return items;
    }

    function filterCatalogItemsByKind(items, kind) {
        const normalizedKind = normalizeCatalogItemKind(kind);
        if (!normalizedKind) return [];
        return (Array.isArray(items) ? items : []).filter((item) => normalizeCatalogItemKind(item && item.kind) === normalizedKind);
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
        SOUND_EXTENSIONS,
        ITEM_KIND_HAND_SKIN,
        ITEM_KIND_PLACEMENT_SOUND,
        normalizeRarity,
        normalizeCatalogItemKind,
        normalizeCatalogItemId,
        createCatalogItemId,
        resolveCatalogItemKindFromExtension,
        extractCatalogParts,
        createCatalogItemFromAssetPath,
        collectCatalogItemsFromPaths,
        filterCatalogItemsByKind,
        buildCatalogFromAssetManifest
    });
}));
