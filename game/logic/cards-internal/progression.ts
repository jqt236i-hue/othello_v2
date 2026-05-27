export {};

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

function safeRequire(id: string): any {
    try {
        return _require(id);
    } catch (e) {
        return null;
    }
}

const SharedConstants = ((typeof module === 'object' && module.exports)
    ? safeRequire('../../../shared-constants')
    : null) || (typeof self !== 'undefined' ? (self as any).SharedConstants : undefined);

const { CARD_DEFS } = SharedConstants || {};

if (!CARD_DEFS) {
    throw new Error('SharedConstants.CARD_DEFS required');
}

const THROW_CHAIN_SEQUENCE = Object.freeze([
    Object.freeze({ type: 'DOUBLE_PLACE', totalPlacements: 2, nextType: 'TRIPLE_PLACE' }),
    Object.freeze({ type: 'TRIPLE_PLACE', totalPlacements: 3, nextType: 'QUAD_PLACE' }),
    Object.freeze({ type: 'QUAD_PLACE', totalPlacements: 4, nextType: 'INFINITE_PLACE' }),
    Object.freeze({ type: 'INFINITE_PLACE', totalPlacements: Infinity, nextType: null })
]);

const CHAIN_WILL_SEQUENCE = Object.freeze([
    Object.freeze({ type: 'DOUBLE_CHAIN_WILL', totalChains: 2, extraLinks: 1, nextType: 'TRIPLE_CHAIN_WILL' }),
    Object.freeze({ type: 'TRIPLE_CHAIN_WILL', totalChains: 3, extraLinks: 2, nextType: 'QUAD_CHAIN_WILL' }),
    Object.freeze({ type: 'QUAD_CHAIN_WILL', totalChains: 4, extraLinks: 3, nextType: 'INFINITE_CHAIN_WILL' }),
    Object.freeze({ type: 'INFINITE_CHAIN_WILL', totalChains: Infinity, extraLinks: Infinity, nextType: null })
]);

function buildCardProgressionConfigByType(sequence: any) {
    return Object.freeze((Array.isArray(sequence) ? sequence : []).reduce((map: any, entry: any) => {
        const cardDef = (CARD_DEFS || []).find((one: any) => one && one.type === entry.type) || null;
        const nextDef = entry.nextType
            ? ((CARD_DEFS || []).find((one: any) => one && one.type === entry.nextType) || null)
            : null;
        map[entry.type] = Object.freeze(Object.assign({}, entry, {
            infinite: entry.totalPlacements === Infinity || entry.totalChains === Infinity || entry.extraLinks === Infinity,
            extraPlacements: Number.isFinite(entry.totalPlacements) ? Math.max(0, entry.totalPlacements - 1) : 0,
            cardId: cardDef && cardDef.id ? cardDef.id : null,
            name: cardDef && cardDef.name ? cardDef.name : entry.type,
            nextType: entry.nextType || null,
            nextCardId: nextDef && nextDef.id ? nextDef.id : null,
            nextName: nextDef && nextDef.name ? nextDef.name : null
        }));
        return map;
    }, {}));
}

const THROW_CHAIN_CONFIG_BY_TYPE = buildCardProgressionConfigByType(THROW_CHAIN_SEQUENCE);
const CHAIN_WILL_CONFIG_BY_TYPE = buildCardProgressionConfigByType(CHAIN_WILL_SEQUENCE);
const CHAIN_WILL_CARD_TYPES = Object.freeze(CHAIN_WILL_SEQUENCE.map((entry: any) => entry.type));
const CHAIN_WILL_CARD_TYPE_SET: Set<string> = new Set(CHAIN_WILL_CARD_TYPES);

type ProgressionDeps = {
    addCardToHand?: (cardState: any, playerKey: any, cardId: any) => any;
    emitPresentationEvent?: (cardState: any, event: any) => any;
    resolveCardBoardConfig?: (gameState: any) => any;
};

function getThrowChainConfig(cardType: any) {
    const type = String(cardType || '');
    return type ? (THROW_CHAIN_CONFIG_BY_TYPE[type] || null) : null;
}

function getChainWillConfig(cardType: any) {
    const type = String(cardType || '');
    return type ? (CHAIN_WILL_CONFIG_BY_TYPE[type] || null) : null;
}

function isChainWillCardType(cardType: any) {
    return CHAIN_WILL_CARD_TYPE_SET.has(String(cardType || ''));
}

function addGeneratedProgressionCard(cardState: any, playerKey: any, sourceCardId: any, sourceCardType: any, configByType: any, deps: ProgressionDeps = {}) {
    const type = String(sourceCardType || '');
    const config = type ? (configByType[type] || null) : null;
    if (!config || !config.nextCardId || typeof deps.addCardToHand !== 'function') return null;
    const added = deps.addCardToHand(cardState, playerKey, config.nextCardId);
    if (!added) return null;
    try {
        if (typeof deps.emitPresentationEvent === 'function') {
            deps.emitPresentationEvent(cardState, {
                type: 'HAND_ADD',
                player: playerKey,
                cardId: config.nextCardId,
                count: 1,
                reason: 'generated_throw_chain',
                meta: {
                    owner: playerKey,
                    reason: 'generated_throw_chain',
                    sourceCardId: sourceCardId || null,
                    sourceType: sourceCardType || null,
                    sourceName: config.name || null,
                    generatedType: config.nextType || null,
                    generatedName: config.nextName || null
                }
            });
        }
    } catch (e) { /* ignore presentation emission failures */ }
    return config.nextCardId;
}

function addGeneratedThrowChainCard(cardState: any, playerKey: any, sourceCardId: any, sourceCardType: any, deps: ProgressionDeps = {}) {
    return addGeneratedProgressionCard(cardState, playerKey, sourceCardId, sourceCardType, THROW_CHAIN_CONFIG_BY_TYPE, deps);
}

function addGeneratedChainWillCard(cardState: any, playerKey: any, sourceCardId: any, sourceCardType: any, deps: ProgressionDeps = {}) {
    return addGeneratedProgressionCard(cardState, playerKey, sourceCardId, sourceCardType, CHAIN_WILL_CONFIG_BY_TYPE, deps);
}

function resolveChainWillMaxLinks(gameState: any, config: any, deps: ProgressionDeps = {}) {
    if (!config) return 0;
    if (!config.infinite) {
        const extraLinks = Number(config.extraLinks);
        return Number.isFinite(extraLinks) && extraLinks > 0 ? Math.floor(extraLinks) : 0;
    }
    const board = gameState && Array.isArray(gameState.board) ? gameState.board : null;
    if (!board || !board.length) {
        const boardConfig = (typeof deps.resolveCardBoardConfig === 'function')
            ? deps.resolveCardBoardConfig(gameState)
            : { rows: 8, cols: 8 };
        return Math.max(1, boardConfig.rows * boardConfig.cols);
    }
    const totalCells = board.reduce((sum: any, row: any) => sum + (Array.isArray(row) ? row.length : 0), 0);
    return Math.max(1, totalCells);
}

module.exports = {
    THROW_CHAIN_CONFIG_BY_TYPE,
    CHAIN_WILL_CONFIG_BY_TYPE,
    CHAIN_WILL_CARD_TYPES,
    getThrowChainConfig,
    getChainWillConfig,
    isChainWillCardType,
    addGeneratedThrowChainCard,
    addGeneratedChainWillCard,
    resolveChainWillMaxLinks
};
