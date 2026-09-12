(function (root: any, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.ObservationGachaCatalogSharedModule = factory();
    }
}(typeof self !== 'undefined' ? self : this as Record<string, unknown>, function () {
    'use strict';

    interface CatalogItem {
        id: string;
        label: string;
        note: string;
        rarity: string;
        kind: string;
        assetPath: string;
        imagePath: string;
        previewImagePath: string;
        soundPath: string;
    }

    interface CatalogParts {
        rarity: string;
        kind: string;
        label: string;
        assetPath: string;
        imagePath: string;
        previewImagePath: string;
        soundPath: string;
    }

    interface AssetManifest {
        files?: unknown[];
    }

    interface BuildCatalogOptions {
        generatedAt?: string;
    }

    interface CatalogResult {
        version: number;
        generatedAt: string;
        sourceDir: string;
        items: CatalogItem[];
    }

    const SOURCE_DIR = 'assets/images/Gacha';
    const RARITY_ORDER: readonly string[] = Object.freeze(['EXR', 'UR', 'SSR', 'SR', 'R', 'N']);
    const RARITY_INDEX: Readonly<Record<string, number>> = Object.freeze(RARITY_ORDER.reduce((acc: Record<string, number>, rarity, index) => {
        acc[rarity] = index;
        return acc;
    }, {}));
    const ITEM_KIND_HAND_SKIN = 'hand_skin';
    const ITEM_KIND_BACKGROUND_SKIN = 'background_skin';
    const ITEM_KIND_PLACEMENT_SOUND = 'placement_sound';
    const ITEM_KIND_ORDER: Readonly<Record<string, number>> = Object.freeze({
        [ITEM_KIND_HAND_SKIN]: 0,
        [ITEM_KIND_BACKGROUND_SKIN]: 1,
        [ITEM_KIND_PLACEMENT_SOUND]: 2
    });
    const IMAGE_EXTENSIONS: readonly string[] = Object.freeze(['.png', '.jpg', '.jpeg', '.webp', '.svg']);
    const SOUND_EXTENSIONS: readonly string[] = Object.freeze(['.mp3', '.ogg', '.wav', '.m4a']);
    const IMAGE_EXTENSION_SET = new Set(IMAGE_EXTENSIONS);
    const SOUND_EXTENSION_SET = new Set(SOUND_EXTENSIONS);
    const ITEM_KIND_PATH_ALIASES: Readonly<Record<string, string>> = Object.freeze({
        [ITEM_KIND_HAND_SKIN]: ITEM_KIND_HAND_SKIN,
        hand: ITEM_KIND_HAND_SKIN,
        hands: ITEM_KIND_HAND_SKIN,
        [ITEM_KIND_BACKGROUND_SKIN]: ITEM_KIND_BACKGROUND_SKIN,
        background: ITEM_KIND_BACKGROUND_SKIN,
        backgrounds: ITEM_KIND_BACKGROUND_SKIN,
        bg: ITEM_KIND_BACKGROUND_SKIN,
        [ITEM_KIND_PLACEMENT_SOUND]: ITEM_KIND_PLACEMENT_SOUND,
        sound: ITEM_KIND_PLACEMENT_SOUND,
        sounds: ITEM_KIND_PLACEMENT_SOUND,
        se: ITEM_KIND_PLACEMENT_SOUND,
        audio: ITEM_KIND_PLACEMENT_SOUND
    });
    const LEGACY_ITEM_ID_ALIASES: Readonly<Record<string, string>> = Object.freeze({
        'gacha__n__hand': 'gacha__n__人の手',
        'gacha__n__hand.png': 'gacha__n__人の手',
        'gacha__n__hand-swap': 'gacha__n__陽気な手',
        'gacha__n__hand-swap.png': 'gacha__n__陽気な手'
    });

    function normalizePath(value: unknown): string {
        return String(value || '').replace(/\\/g, '/').trim();
    }

    function normalizeRarity(value: unknown): string | null {
        const normalized = String(value || '').trim().toUpperCase();
        return Object.prototype.hasOwnProperty.call(RARITY_INDEX, normalized) ? normalized : null;
    }

    function normalizeCatalogItemKind(value: unknown): string | null {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized === ITEM_KIND_HAND_SKIN) return ITEM_KIND_HAND_SKIN;
        if (normalized === ITEM_KIND_BACKGROUND_SKIN) return ITEM_KIND_BACKGROUND_SKIN;
        if (normalized === ITEM_KIND_PLACEMENT_SOUND) return ITEM_KIND_PLACEMENT_SOUND;
        return null;
    }

    function normalizeCatalogItemKindAlias(value: unknown): string | null {
        const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
        if (!normalized) return null;
        return Object.prototype.hasOwnProperty.call(ITEM_KIND_PATH_ALIASES, normalized)
            ? ITEM_KIND_PATH_ALIASES[normalized]
            : null;
    }

    function normalizeCatalogItemId(value: unknown): string {
        const normalized = String(value || '').trim();
        if (!normalized) return '';
        return Object.prototype.hasOwnProperty.call(LEGACY_ITEM_ID_ALIASES, normalized)
            ? LEGACY_ITEM_ID_ALIASES[normalized]
            : normalized;
    }

    function createCatalogItemId(rarity: unknown, label: unknown, kind: unknown): string {
        const normalizedRarity = normalizeRarity(rarity);
        const normalizedLabel = String(label || '').trim();
        const normalizedKind = normalizeCatalogItemKind(kind || ITEM_KIND_HAND_SKIN);
        if (!normalizedRarity || !normalizedLabel || !normalizedKind) return '';
        if (normalizedKind === ITEM_KIND_HAND_SKIN) {
            return normalizeCatalogItemId(`gacha__${normalizedRarity.toLowerCase()}__${normalizedLabel}`.replace(/\s+/g, '_'));
        }
        if (normalizedKind === ITEM_KIND_BACKGROUND_SKIN) {
            return `gacha__${normalizedRarity.toLowerCase()}__background_skin__${normalizedLabel}`.replace(/\s+/g, '_');
        }
        return `gacha__${normalizedRarity.toLowerCase()}__placement_sound__${normalizedLabel}`.replace(/\s+/g, '_');
    }

    function resolveCatalogItemKindFromExtension(extension: unknown): string | null {
        const normalizedExtension = String(extension || '').trim().toLowerCase();
        if (IMAGE_EXTENSION_SET.has(normalizedExtension)) return ITEM_KIND_HAND_SKIN;
        if (SOUND_EXTENSION_SET.has(normalizedExtension)) return ITEM_KIND_PLACEMENT_SOUND;
        return null;
    }

    function resolveCatalogItemKindFromPathSegments(pathSegments: unknown[]): string | null {
        const safeSegments = Array.isArray(pathSegments) ? pathSegments : [];
        for (let index = 0; index < safeSegments.length; index += 1) {
            const normalizedKind = normalizeCatalogItemKindAlias(safeSegments[index]);
            if (normalizedKind) return normalizedKind;
        }
        return null;
    }

    function isImageCatalogItemKind(kind: unknown): boolean {
        const normalizedKind = normalizeCatalogItemKind(kind);
        return normalizedKind === ITEM_KIND_HAND_SKIN || normalizedKind === ITEM_KIND_BACKGROUND_SKIN;
    }

    function extractCatalogParts(assetPath: unknown): CatalogParts | null {
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

        const pathSegments = nestedPath.split('/').filter(Boolean);
        const fileName = pathSegments.pop() || '';
        const dotIndex = fileName.lastIndexOf('.');
        if (dotIndex <= 0) return null;

        const extension = fileName.slice(dotIndex).toLowerCase();
        const extensionKind = resolveCatalogItemKindFromExtension(extension);
        const explicitKind = resolveCatalogItemKindFromPathSegments(pathSegments);
        const kind = explicitKind || extensionKind;
        if (kind !== ITEM_KIND_HAND_SKIN || extensionKind !== ITEM_KIND_HAND_SKIN) return null;

        const label = fileName.slice(0, dotIndex).trim();
        if (!label) return null;

        return {
            rarity,
            kind,
            label,
            assetPath: normalizedPath,
            imagePath: isImageCatalogItemKind(kind) ? normalizedPath : '',
            previewImagePath: isImageCatalogItemKind(kind) ? normalizedPath : '',
            soundPath: ''
        };
    }

    function createCatalogItemFromAssetPath(assetPath: unknown): CatalogItem | null {
        const parts = extractCatalogParts(assetPath);
        if (!parts) return null;
        const noteSuffix = parts.kind === ITEM_KIND_PLACEMENT_SOUND
            ? ' / 配置音'
            : (parts.kind === ITEM_KIND_BACKGROUND_SKIN ? ' / 背景' : '');
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

    function compareCatalogItems(left: unknown, right: unknown): number {
        const leftRarity = normalizeRarity((left as CatalogItem | null)?.rarity);
        const rightRarity = normalizeRarity((right as CatalogItem | null)?.rarity);
        const leftIndex = leftRarity ? RARITY_INDEX[leftRarity] : Number.MAX_SAFE_INTEGER;
        const rightIndex = rightRarity ? RARITY_INDEX[rightRarity] : Number.MAX_SAFE_INTEGER;
        if (leftIndex !== rightIndex) return leftIndex - rightIndex;

        const leftKind = normalizeCatalogItemKind((left as CatalogItem | null)?.kind);
        const rightKind = normalizeCatalogItemKind((right as CatalogItem | null)?.kind);
        const leftKindIndex = Object.prototype.hasOwnProperty.call(ITEM_KIND_ORDER, leftKind || '') ? ITEM_KIND_ORDER[leftKind || ''] : Number.MAX_SAFE_INTEGER;
        const rightKindIndex = Object.prototype.hasOwnProperty.call(ITEM_KIND_ORDER, rightKind || '') ? ITEM_KIND_ORDER[rightKind || ''] : Number.MAX_SAFE_INTEGER;
        if (leftKindIndex !== rightKindIndex) return leftKindIndex - rightKindIndex;

        const leftLabel = String((left as CatalogItem | null)?.label || '');
        const rightLabel = String((right as CatalogItem | null)?.label || '');
        const labelCompare = leftLabel.localeCompare(rightLabel, 'ja');
        if (labelCompare !== 0) return labelCompare;

        const leftPath = normalizePath((left as CatalogItem | null)?.assetPath);
        const rightPath = normalizePath((right as CatalogItem | null)?.assetPath);
        return leftPath.localeCompare(rightPath, 'ja');
    }

    function collectCatalogItemsFromPaths(paths: unknown[]): CatalogItem[] {
        const safePaths = Array.isArray(paths) ? paths : [];
        const items: CatalogItem[] = [];
        const seenAssetPaths = new Set<string>();

        safePaths.forEach((entry) => {
            const candidatePath = normalizePath(entry && typeof entry === 'object' ? (entry as Record<string, unknown>).path : entry);
            const item = createCatalogItemFromAssetPath(candidatePath);
            if (!item) return;
            if (seenAssetPaths.has(item.assetPath)) return;
            seenAssetPaths.add(item.assetPath);
            items.push(item);
        });

        items.sort(compareCatalogItems);
        return items;
    }

    function filterCatalogItemsByKind(items: unknown[], kind: unknown): CatalogItem[] {
        const normalizedKind = normalizeCatalogItemKind(kind);
        if (!normalizedKind) return [];
        return (Array.isArray(items) ? items : []).filter((item) => normalizeCatalogItemKind(item && typeof item === 'object' ? (item as Record<string, unknown>).kind : null) === normalizedKind) as CatalogItem[];
    }

    function buildCatalogFromAssetManifest(manifest: unknown, options: unknown): CatalogResult {
        const opts = (options && typeof options === 'object') ? options as BuildCatalogOptions : {};
        const files = Array.isArray((manifest as AssetManifest | null)?.files) ? (manifest as AssetManifest).files : [];
        return {
            version: 1,
            generatedAt: opts.generatedAt ? String(opts.generatedAt) : new Date().toISOString(),
            sourceDir: SOURCE_DIR,
            items: collectCatalogItemsFromPaths(files as unknown[])
        };
    }

    return Object.freeze({
        SOURCE_DIR,
        RARITY_ORDER,
        IMAGE_EXTENSIONS,
        SOUND_EXTENSIONS,
        ITEM_KIND_HAND_SKIN,
        ITEM_KIND_BACKGROUND_SKIN,
        ITEM_KIND_PLACEMENT_SOUND,
        normalizeRarity,
        normalizeCatalogItemKind,
        normalizeCatalogItemKindAlias,
        normalizeCatalogItemId,
        createCatalogItemId,
        resolveCatalogItemKindFromExtension,
        resolveCatalogItemKindFromPathSegments,
        extractCatalogParts,
        createCatalogItemFromAssetPath,
        collectCatalogItemsFromPaths,
        filterCatalogItemsByKind,
        buildCatalogFromAssetManifest
    });
}));
