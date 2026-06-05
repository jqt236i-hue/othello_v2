import type { CardDef } from '../../../src/types';

declare const __non_webpack_require__: NodeRequire | undefined;

function _require(id: string): any {
    if (typeof __non_webpack_require__ !== 'undefined') {
        return __non_webpack_require__(id);
    }
    if (typeof require === 'function') {
        return require(id);
    }
    throw new Error('Unable to require ' + id);
}

function getRuntimeGlobalValue(key: string): any {
    if (typeof self !== 'undefined' && (self as any)[key]) {
        return (self as any)[key];
    }
    return undefined;
}

function safeRequire(id: string): any {
    try {
        return _require(id);
    } catch (e) {
        return null;
    }
}

function resolveModuleOrGlobal(id: string, globalKey: string): any {
    if (typeof module === 'object' && module.exports) {
        return safeRequire(id) || getRuntimeGlobalValue(globalKey);
    }
    return getRuntimeGlobalValue(globalKey);
}

const SharedConstants = resolveModuleOrGlobal('../../../shared-constants', 'SharedConstants');
const { CARD_DEFS, CARD_TYPE_BY_ID } = SharedConstants || {};

const CAPTURE_SOURCE_CARD_TYPE_BY_SPECIAL_TYPE = Object.freeze({
    TRAP: 'TRAP_WILL',
    PROTECTED: 'PROTECTED_NEXT_STONE',
    PERMA_PROTECTED: 'PERMA_PROTECT_NEXT_STONE',
    ABSOLUTE_PROTECTED: 'PERMA_PROTECT_NEXT_STONE',
    TIME_BOMB: 'TIME_BOMB',
    TIME_STOP: 'TIME_STOP_GOD',
    DRAGON: 'ULTIMATE_REVERSE_DRAGON',
    ULTIMATE_REVERSE_DRAGON: 'ULTIMATE_REVERSE_DRAGON',
    BREEDING: 'BREEDING_WILL',
    PROLIFERATION: 'PROLIFERATION_WILL',
    HYPERACTIVE: 'HYPERACTIVE_WILL',
    EXTREME_HYPERACTIVE: 'EXTREME_HYPERACTIVE_WILL',
    ESCAPE_HYPERACTIVE: 'ESCAPE_WILL',
    ROBOT_VACUUM: 'ROBOT_VACUUM_WILL',
    GLUTTONOUS: 'GLUTTONOUS_WILL',
    ULTIMATE_HYPERACTIVE: 'ULTIMATE_HYPERACTIVE_GOD',
    REGEN: 'REGEN_WILL',
    WORK: 'WORK_WILL',
    BLOCKADE: 'BLOCKADE_WILL',
    FREEZE: 'FREEZE_WILL',
    DESTROY_DRAGON: 'DESTROY_DRAGON_WILL',
    LIGHTNING: 'LIGHTNING_WILL',
    GHOST: 'GHOST_WILL',
    AFTERIMAGE: 'AFTERIMAGE_WILL',
    WILL_HUNTER_KING: 'WILL_HUNTER_KING',
    GOLD_STONE: 'GOLD_STONE',
    SILVER_STONE: 'SILVER_STONE',
    RAINBOW_STONE: 'RAINBOW_STONE'
});

function getCardDefByType(cardType: any): CardDef | null {
    const normalizedType = String(cardType || '');
    if (!normalizedType) return null;
    for (const cardDef of CARD_DEFS || []) {
        if (cardDef && cardDef.type === normalizedType) return cardDef;
    }
    return null;
}

function getCardDef(cardId: any): CardDef | null {
    const normalizedId = String(cardId || '');
    if (!normalizedId) return null;
    for (const cardDef of CARD_DEFS || []) {
        if (cardDef && cardDef.id === normalizedId) return cardDef;
    }
    return null;
}

function getCardIdByType(cardType: any): string | null {
    const cardDef = getCardDefByType(cardType);
    return cardDef && cardDef.id ? cardDef.id : null;
}

function getCardType(cardId: any): string | null {
    const normalizedId = String(cardId || '');
    if (!normalizedId) return null;
    if (CARD_TYPE_BY_ID && typeof CARD_TYPE_BY_ID === 'object' && CARD_TYPE_BY_ID[normalizedId]) {
        return String(CARD_TYPE_BY_ID[normalizedId]);
    }
    const cardDef = getCardDef(normalizedId);
    return cardDef && cardDef.type ? String(cardDef.type) : null;
}

function resolveCaptureSourceTypeFromMarkerData(markerData: any): string | null {
    if (!markerData || typeof markerData !== 'object') return null;
    if (typeof markerData.sourceType === 'string' && markerData.sourceType) {
        return markerData.sourceType;
    }
    if (typeof markerData.sourceCardId === 'string' && markerData.sourceCardId) {
        return getCardType(markerData.sourceCardId);
    }
    const specialType = (typeof markerData.type === 'string' && markerData.type)
        ? markerData.type
        : null;
    return specialType ? ((CAPTURE_SOURCE_CARD_TYPE_BY_SPECIAL_TYPE as Record<string, string | undefined>)[specialType] || null) : null;
}

function unwrapMarker(markerEntry: any): any | null {
    if (!markerEntry || typeof markerEntry !== 'object') return null;
    if (markerEntry.marker && typeof markerEntry.marker === 'object') return markerEntry.marker;
    return markerEntry;
}

function resolveCaptureSourceInfo(markerEntry: any): {
    sourceCardId: string;
    sourceCardType: string | null;
    sourceCardDef: CardDef | null;
    sourceCardName: string | null;
    sourceSpecialType: string | null;
} | null {
    const marker = unwrapMarker(markerEntry);
    const markerData = marker && marker.data ? marker.data : null;
    if (!marker || !markerData) return null;
    const sourceType = resolveCaptureSourceTypeFromMarkerData(markerData);
    const sourceCardId = (typeof markerData.sourceCardId === 'string' && markerData.sourceCardId)
        ? markerData.sourceCardId
        : getCardIdByType(sourceType);
    if (!sourceCardId) return null;
    const sourceCardType = sourceType || getCardType(sourceCardId);
    const sourceCardDef = getCardDef(sourceCardId);
    return {
        sourceCardId,
        sourceCardType,
        sourceCardDef,
        sourceCardName: sourceCardDef && sourceCardDef.name ? sourceCardDef.name : null,
        sourceSpecialType: (typeof markerData.type === 'string' && markerData.type) ? markerData.type : null
    };
}

export = {
    CAPTURE_SOURCE_CARD_TYPE_BY_SPECIAL_TYPE,
    resolveCaptureSourceTypeFromMarkerData,
    resolveCaptureSourceInfo
};
