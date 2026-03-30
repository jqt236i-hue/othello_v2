/**
 * @file cards.js
 * @description Core Card Logic (Shared between Browser and Headless)
 * Pure functions/state manipulation only. No UI dependencies.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        // Node.js
        module.exports = factory(require('../../shared-constants'), require('../../shared/deck-spec'));
    } else {
        // Browser
        root.CardLogic = factory(root.SharedConstants, root.DeckSpecHelpers);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants, DeckSpecHelpers) {
    'use strict';

    const {
        CARD_DEFS,
        CARD_TYPE_BY_ID,
        BLACK,
        WHITE,
        EMPTY,
        DIRECTIONS,
        BOARD_SIZE,
        CHARGE_MAX,
        INITIAL_BOARD_BONUS_DISTRIBUTION,
        STRONG_WILL_PROMOTION_OWNER_TURNS: SHARED_STRONG_WILL_PROMOTION_OWNER_TURNS,
        TIME_STOP_GOD_TURNS: SHARED_TIME_STOP_GOD_TURNS,
        TIME_STOP_GOD_CONSECUTIVE_TURNS: SHARED_TIME_STOP_GOD_CONSECUTIVE_TURNS,
        TIME_STOP_GOD_SELF_DESTROY_COUNT: SHARED_TIME_STOP_GOD_SELF_DESTROY_COUNT
    } = SharedConstants || {};

    if (!CARD_DEFS) {
        throw new Error('SharedConstants not loaded');
    }

    const DestroyOutcomeContract = (() => {
        if (typeof require === 'function') {
            try {
                return require('../../shared/destroy-outcome-contract');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.DestroyOutcomeContract || null;
    })();

    // Constants
    // Policy: no initial draw at game start.
    const INITIAL_HAND_SIZE = 0;
    const MAX_HAND_SIZE = 5;
    const DRAW_INTERVAL = 1; // Draw every turn (turn 1, 2, 3, ...)
    const DOUBLE_PLACE_EXTRA = 1;
    const CHAIN_WILL_EVENT_CAUSE = 'CHAIN_WILL';
    const HEAVEN_BLESSING_OFFER_COUNT = 5;
    const TIME_BOMB_TURNS = 3;
    const TIME_STOP_GOD_TURNS = Number.isFinite(Number(SHARED_TIME_STOP_GOD_TURNS))
        ? Math.max(1, Math.floor(Number(SHARED_TIME_STOP_GOD_TURNS)))
        : 3;
    const TIME_STOP_GOD_CONSECUTIVE_TURNS = Number.isFinite(Number(SHARED_TIME_STOP_GOD_CONSECUTIVE_TURNS))
        ? Math.max(1, Math.floor(Number(SHARED_TIME_STOP_GOD_CONSECUTIVE_TURNS)))
        : 2;
    const TIME_STOP_GOD_SELF_DESTROY_COUNT = Number.isFinite(Number(SHARED_TIME_STOP_GOD_SELF_DESTROY_COUNT))
        ? Math.max(1, Math.floor(Number(SHARED_TIME_STOP_GOD_SELF_DESTROY_COUNT)))
        : 3;
    const STRONG_WILL_PROMOTION_OWNER_TURNS = Number.isFinite(Number(SHARED_STRONG_WILL_PROMOTION_OWNER_TURNS))
        ? Math.max(1, Math.floor(Number(SHARED_STRONG_WILL_PROMOTION_OWNER_TURNS)))
        : 10;
    const ULTIMATE_DRAGON_TURNS = 5;
    const ULTIMATE_DESTROY_GOD_TURNS = 5;
    const ULTIMATE_HYPERACTIVE_TURNS = 10;
    const EXTREME_HYPERACTIVE_FLIP_EVADE_LIMIT = 3;
    const ULTIMATE_HYPERACTIVE_FLIP_EVADE_LIMIT = 3;
    const ULTIMATE_HYPERACTIVE_DESTROY_EVADE_LIMIT = 1;
    const AFTERIMAGE_WILL_FLIP_EVADE_LIMIT = 3;
    const AFTERIMAGE_WILL_DESTROY_EVADE_LIMIT = 3;
    const SNIPER_WILL_TURNS = 5;
    const DESTROY_DRAGON_TURNS = 3;
    const LIGHTNING_WILL_TURNS = 5;
    const OBSERVER_WILL_TURNS = 5;
    const GHOST_WILL_TURNS = 5;
    const WILL_HUNTER_KING_TURNS = 8;
    const ROBOT_VACUUM_TURNS = 5;
    const INHERITED_HYPERACTIVE_TURNS = 10;
    const BLOCKADE_TURNS = 3;
    const FREEZE_TURNS = 5;
    const TRAP_WILL_STEAL_MAX = 20;
    const GUARD_WILL_TURNS = 3;
    const GUARDIAN_GOD_TURNS = 10;
    const RIBO_WILL_UNLOCK_TURN_INDEX = 19;
    const RIBO_WILL_INITIAL_GAIN = 30;
    const RIBO_WILL_REPAYMENT_AMOUNT = 4;
    const RIBO_WILL_OWNER_TURNS = 9;
    const RIBO_WILL_SHORTAGE_DESTROY_COUNT = 2;
    const EQUALITY_WILL_MAX_SPAWNS = 3;
    const FLIP_CHARGE_MULTIPLIER_EFFECTS = Object.freeze({
        GOLD_STONE: { multiplier: 4, effectFlag: 'goldStoneUsed', destroyReason: 'gold_stone_sacrifice' },
        RAINBOW_STONE: { multiplier: 6, effectFlag: 'rainbowStoneUsed', destroyReason: 'rainbow_stone_sacrifice' },
        SILVER_STONE: { multiplier: 3, effectFlag: 'silverStoneUsed', destroyReason: 'silver_stone_sacrifice' }
    });
    const ENABLED_CARD_ID_SET = new Set((CARD_DEFS || []).reduce((out, cardDef) => {
        if (cardDef && cardDef.id && cardDef.enabled !== false) {
            out.push(cardDef.id);
        }
        return out;
    }, []));
    const CAPTURE_SOURCE_CARD_TYPE_BY_SPECIAL_TYPE = Object.freeze({
        TRAP: 'TRAP_WILL',
        PROTECTED: 'PROTECTED_NEXT_STONE',
        PERMA_PROTECTED: 'PERMA_PROTECT_NEXT_STONE',
        ABSOLUTE_PROTECTED: 'PERMA_PROTECT_NEXT_STONE',
        TIME_BOMB: 'TIME_BOMB',
        TIME_STOP: 'TIME_STOP_GOD',
        ULTIMATE_REVERSE_DRAGON: 'ULTIMATE_REVERSE_DRAGON',
        BREEDING: 'BREEDING_WILL',
        PROLIFERATION: 'PROLIFERATION_WILL',
        HYPERACTIVE: 'HYPERACTIVE_WILL',
        INHERITED_HYPERACTIVE: 'HYPERACTIVE_INHERIT_WILL',
        EXTREME_HYPERACTIVE: 'EXTREME_HYPERACTIVE_WILL',
        ESCAPE_HYPERACTIVE: 'ESCAPE_WILL',
        ROBOT_VACUUM: 'ROBOT_VACUUM_WILL',
        GLUTTONOUS: 'GLUTTONOUS_WILL',
        ULTIMATE_HYPERACTIVE: 'ULTIMATE_HYPERACTIVE_GOD',
        REGEN: 'REGEN_WILL',
        WORK: 'WORK_WILL',
        BLOCKADE: 'BLOCKADE_WILL',
        FREEZE: 'FREEZE_WILL',
        OBSERVER: 'OBSERVER_WILL',
        DESTROY_DRAGON: 'DESTROY_DRAGON_WILL',
        LIGHTNING: 'LIGHTNING_WILL',
        GHOST: 'GHOST_WILL',
        AFTERIMAGE: 'AFTERIMAGE_WILL',
        WILL_HUNTER_KING: 'WILL_HUNTER_KING',
        CRYSTAL_STONE: 'CRYSTAL_STONE',
        GOLD_STONE: 'GOLD_STONE',
        SILVER_STONE: 'SILVER_STONE',
        RAINBOW_STONE: 'RAINBOW_STONE'
    });
    const NUMBER_CELL_CHARGE_MULTIPLIER_EFFECTS = Object.freeze({
        CRYSTAL_STONE: {
            multiplier: 4,
            effectFlag: 'crystalStoneUsed',
            gainField: 'crystalStoneGain',
            destroyReason: 'crystal_stone_sacrifice'
        }
    });
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

    function buildCardProgressionConfigByType(sequence) {
        return Object.freeze((Array.isArray(sequence) ? sequence : []).reduce((map, entry) => {
            const cardDef = (CARD_DEFS || []).find((one) => one && one.type === entry.type) || null;
            const nextDef = entry.nextType
                ? ((CARD_DEFS || []).find((one) => one && one.type === entry.nextType) || null)
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
    const CHAIN_WILL_CARD_TYPES = Object.freeze(CHAIN_WILL_SEQUENCE.map((entry) => entry.type));
    const CHAIN_WILL_CARD_TYPE_SET = new Set(CHAIN_WILL_CARD_TYPES);

    function getThrowChainConfig(cardType) {
        const type = String(cardType || '');
        return type ? (THROW_CHAIN_CONFIG_BY_TYPE[type] || null) : null;
    }

    function getChainWillConfig(cardType) {
        const type = String(cardType || '');
        return type ? (CHAIN_WILL_CONFIG_BY_TYPE[type] || null) : null;
    }

    function isChainWillCardType(cardType) {
        return CHAIN_WILL_CARD_TYPE_SET.has(String(cardType || ''));
    }

    function addGeneratedProgressionCard(cardState, playerKey, sourceCardId, sourceCardType, configByType) {
        const type = String(sourceCardType || '');
        const config = type ? (configByType[type] || null) : null;
        if (!config || !config.nextCardId) return null;
        const added = addCardToHand(cardState, playerKey, config.nextCardId);
        if (!added) return null;
        try {
            emitPresentationEvent(cardState, {
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
        } catch (e) { /* ignore presentation emission failures */ }
        return config.nextCardId;
    }

    function addGeneratedThrowChainCard(cardState, playerKey, sourceCardId, sourceCardType) {
        return addGeneratedProgressionCard(cardState, playerKey, sourceCardId, sourceCardType, THROW_CHAIN_CONFIG_BY_TYPE);
    }

    function addGeneratedChainWillCard(cardState, playerKey, sourceCardId, sourceCardType) {
        return addGeneratedProgressionCard(cardState, playerKey, sourceCardId, sourceCardType, CHAIN_WILL_CONFIG_BY_TYPE);
    }

    function resolveChainWillMaxLinks(gameState, config) {
        if (!config) return 0;
        if (!config.infinite) {
            const extraLinks = Number(config.extraLinks);
            return Number.isFinite(extraLinks) && extraLinks > 0 ? Math.floor(extraLinks) : 0;
        }
        const board = gameState && Array.isArray(gameState.board) ? gameState.board : null;
        if (!board || !board.length) return BOARD_SIZE * BOARD_SIZE;
        const totalCells = board.reduce((sum, row) => sum + (Array.isArray(row) ? row.length : 0), 0);
        return Math.max(1, totalCells);
    }

    function isWorkDebugEnabled(cardState) {
        if (cardState && cardState.debugWorkLog === true) return true;
        try {
            if (typeof globalThis !== 'undefined' && globalThis.DEBUG_WORK_LOG === true) return true;
        } catch (e) { /* ignore */ }
        return false;
    }

    function workDebugLog(cardState) {
        if (!isWorkDebugEnabled(cardState)) return;
        try { if (typeof console !== 'undefined' && console.log) console.log.apply(console, Array.prototype.slice.call(arguments, 1)); } catch (e) { /* ignore */ }
    }

    function workDebugError(cardState) {
        if (!isWorkDebugEnabled(cardState)) return;
        try { if (typeof console !== 'undefined' && console.error) console.error.apply(console, Array.prototype.slice.call(arguments, 1)); } catch (e) { /* ignore */ }
    }

    function destroyAt(cardState, gameState, row, col, meta) {
        if (BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function') {
            const res = BoardOpsModule.destroyAt(
                cardState,
                gameState,
                row,
                col,
                'SYSTEM',
                'legacy_fallback',
                (meta && typeof meta === 'object') ? meta : {}
            );
            return !!res.destroyed;
        }

        if (getCellValueForCard(gameState, row, col) === EMPTY) return false;

        removeMarkersAt(cardState, row, col);

        return setCellValueForCard(gameState, row, col, EMPTY);
    }

    function isDestroyResolved(result) {
        if (DestroyOutcomeContract && typeof DestroyOutcomeContract.isDestroyOutcomeResolved === 'function') {
            return DestroyOutcomeContract.isDestroyOutcomeResolved(result);
        }
        return !!(result && (result.destroyed || result.regenerated || result.evaded || result.blockedByGhost || result.proliferated));
    }

    function createDestroyOutcome(kindOrResult, details) {
        if (DestroyOutcomeContract && typeof DestroyOutcomeContract.createDestroyOutcome === 'function') {
            return DestroyOutcomeContract.createDestroyOutcome(kindOrResult, details);
        }
        const source = (typeof kindOrResult === 'string')
            ? Object.assign({}, (details && typeof details === 'object') ? details : {}, { kind: kindOrResult })
            : Object.assign({}, (kindOrResult && typeof kindOrResult === 'object') ? kindOrResult : {});
        return Object.assign({
            destroyed: false,
            regenerated: false,
            evaded: false,
            blockedByGhost: false,
            proliferated: false
        }, source);
    }

    function clearBombAt(cardState, row, col) {
        if (!cardState) return false;
        if (findSpecialMarkerAt(cardState, row, col, 'GHOST')) return false;
        const beforeLen = getBombMarkers(cardState).length;
        removeMarkersAt(cardState, row, col, { category: MARKER_CATEGORIES.BOMB });
        return getBombMarkers(cardState).length !== beforeLen;
    }

    // PRNG must be provided for reproducibility in online/replay mode.
    // Default methods: shuffle is pass-through (so existing tests that build decks don't break),
    // but random() will throw to force DI of a deterministic PRNG for rule logic.
    const defaultPrng = {
        shuffle: (array) => array,
        random: () => {
            throw new Error('PRNG.random() called without injected PRNG. Inject a deterministic PRNG for rule logic.');
        }
    };

    function buildStandardDeckCardIds() {
        if (DeckSpecHelpers && typeof DeckSpecHelpers.getStandardDeckCardIds === 'function') {
            return DeckSpecHelpers.getStandardDeckCardIds();
        }

        const seen = new Set();
        const deck = [];
        (CARD_DEFS || []).forEach((cardDef) => {
            if (!cardDef || !cardDef.id || cardDef.enabled === false) return;
            if (seen.has(cardDef.id)) return;
            seen.add(cardDef.id);
            deck.push(cardDef.id);
        });
        return deck;
    }

    function expandInitialDeckSpec(deckSpec) {
        if (!deckSpec) return buildStandardDeckCardIds();
        if (!DeckSpecHelpers || typeof DeckSpecHelpers.expandDeckSpec !== 'function') {
            throw new Error('DeckSpecHelpers is required for custom deck initialization');
        }
        return DeckSpecHelpers.expandDeckSpec(deckSpec);
    }

    function normalizeInitialDeckCardIds(deckCardIds) {
        if (!Array.isArray(deckCardIds)) return null;
        return deckCardIds.map((cardId, index) => {
            const normalizedCardId = String(cardId || '').trim();
            if (!normalizedCardId || !ENABLED_CARD_ID_SET.has(normalizedCardId)) {
                throw new Error(`Invalid initial deck card id at index ${index}: ${normalizedCardId || '(empty)'}`);
            }
            return normalizedCardId;
        });
    }

    function resolveInitialDeckCardIds(options, playerKey) {
        const opts = (options && typeof options === 'object') ? options : {};
        const deckCardIdsByPlayer = (opts.initialDeckCardIdsByPlayer && typeof opts.initialDeckCardIdsByPlayer === 'object')
            ? opts.initialDeckCardIdsByPlayer
            : null;
        const playerDeckCardIds = deckCardIdsByPlayer && Array.isArray(deckCardIdsByPlayer[playerKey])
            ? deckCardIdsByPlayer[playerKey]
            : null;
        const deckCardIds = playerDeckCardIds || (Array.isArray(opts.initialDeckCardIds) ? opts.initialDeckCardIds : null);
        if (deckCardIds) {
            return normalizeInitialDeckCardIds(deckCardIds);
        }

        const byPlayer = (opts.initialDeckSpecByPlayer && typeof opts.initialDeckSpecByPlayer === 'object')
            ? opts.initialDeckSpecByPlayer
            : null;
        const playerDeckSpec = byPlayer ? byPlayer[playerKey] : null;
        const deckSpec = playerDeckSpec || opts.initialDeckSpec || null;

        return deckSpec ? expandInitialDeckSpec(deckSpec) : buildStandardDeckCardIds();
    }

    const CardCostsModule = (() => {
        if (typeof require === 'function') {
            try {
                return require('./cards/costs');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.CardCosts || null;
    })();

    const CardDefsModule = (() => {
        if (typeof require === 'function') {
            try {
                return require('./cards/defs');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.CardDefs || null;
    })();

    const CardUtilsModule = (() => {
        if (typeof require === 'function') {
            try {
                return require('./cards/utils');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.CardUtils || null;
    })();

    function getChargeLedgerContext() {
        return {
            helpers: {
                chargeMax: CHARGE_MAX || 99,
                setChargeWithDelta: CardUtilsModule && typeof CardUtilsModule.setChargeWithDelta === 'function'
                    ? CardUtilsModule.setChargeWithDelta
                    : null,
                addChargeWithDelta: CardUtilsModule && typeof CardUtilsModule.addChargeWithDelta === 'function'
                    ? CardUtilsModule.addChargeWithDelta
                    : null
            }
        };
    }

    function setChargeValue(cardState, playerKey, nextValue, reason, meta) {
        if (CardChargeLedgerModule && typeof CardChargeLedgerModule.setChargeValue === 'function') {
            return CardChargeLedgerModule.setChargeValue(cardState, playerKey, nextValue, reason, getChargeLedgerContext(), meta);
        }
        if (CardUtilsModule && typeof CardUtilsModule.setChargeWithDelta === 'function') {
            return CardUtilsModule.setChargeWithDelta(cardState, playerKey, nextValue, reason, meta);
        }
        if (!cardState) return { changed: false, before: 0, after: 0, delta: 0 };
        if (!cardState.charge) cardState.charge = { black: 0, white: 0 };
        const before = Number(cardState.charge[playerKey] || 0);
        const safeBefore = Number.isFinite(before) ? before : 0;
        const requested = Number(nextValue);
        const safeRequested = Number.isFinite(requested) ? requested : safeBefore;
        const after = Math.max(0, Math.min(CHARGE_MAX || 99, safeRequested));
        cardState.charge[playerKey] = after;
        return { changed: after !== safeBefore, before: safeBefore, after, delta: after - safeBefore };
    }

    const CardExpansionModule = (() => {
        if (typeof require === 'function') {
            try {
                return require('./cards/expansion');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.CardExpansion || null;
    })();

    const CardMarkersModule = (() => {
        if (typeof require === 'function') {
            try {
                return require('./cards/markers');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.CardMarkers || null;
    })();

    const CardMovementModule = (() => {
        if (typeof require === 'function') {
            try {
                return require('./cards/movement');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.CardMovement || null;
    })();

    const CardTeleportModule = (() => {
        if (typeof require === 'function') {
            try {
                return require('./cards/teleport');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.CardTeleport || null;
    })();

    const CardCloneModule = (() => {
        if (typeof require === 'function') {
            try {
                return require('./cards/clone');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.CardClone || null;
    })();

    const CardMeteorModule = (() => {
        if (typeof require === 'function') {
            try {
                return require('./cards/meteor');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.CardMeteor || null;
    })();

    function addChargeValue(cardState, playerKey, amount, reason, meta) {
        if (CardChargeLedgerModule && typeof CardChargeLedgerModule.addChargeValue === 'function') {
            return CardChargeLedgerModule.addChargeValue(cardState, playerKey, amount, reason, getChargeLedgerContext(), meta);
        }
        if (CardUtilsModule && typeof CardUtilsModule.addChargeWithDelta === 'function') {
            return CardUtilsModule.addChargeWithDelta(cardState, playerKey, amount, reason, meta);
        }
        if (!cardState) return { changed: false, before: 0, after: 0, delta: 0 };
        if (!cardState.charge) cardState.charge = { black: 0, white: 0 };
        const before = Number(cardState.charge[playerKey] || 0);
        const safeBefore = Number.isFinite(before) ? before : 0;
        const add = Number(amount);
        const safeAdd = Number.isFinite(add) ? add : 0;
        return setChargeValue(cardState, playerKey, safeBefore + safeAdd, reason, meta);
    }

    function ensureRiboRepaymentsByPlayer(cardState) {
        if (!cardState || typeof cardState !== 'object') {
            return { black: [], white: [] };
        }
        if (!cardState.riboRepaymentsByPlayer || typeof cardState.riboRepaymentsByPlayer !== 'object') {
            cardState.riboRepaymentsByPlayer = { black: [], white: [] };
        }
        if (!Array.isArray(cardState.riboRepaymentsByPlayer.black)) cardState.riboRepaymentsByPlayer.black = [];
        if (!Array.isArray(cardState.riboRepaymentsByPlayer.white)) cardState.riboRepaymentsByPlayer.white = [];
        return cardState.riboRepaymentsByPlayer;
    }

    function isGuardProtectedCell(cardState, row, col) {
        if (CardMarkersModule && typeof CardMarkersModule.isGuardProtectedCell === 'function') {
            return CardMarkersModule.isGuardProtectedCell(cardState, row, col);
        }
        return Array.isArray(cardState && cardState.markers) && cardState.markers.some((marker) => (
            marker &&
            marker.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') &&
            marker.row === row &&
            marker.col === col &&
            marker.data &&
            marker.data.type === 'GUARD'
        ));
    }

    function getRiboExpansionDescriptors(gameState) {
        if (BoardOpsModule && typeof BoardOpsModule.getExpansionDescriptors === 'function') {
            return BoardOpsModule.getExpansionDescriptors(gameState);
        }
        const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
            ? gameState.boardExpansion
            : null;
        if (!expansion) return [];
        const sourceCells = Array.isArray(expansion.cells)
            ? expansion.cells
            : (expansion.active ? [expansion] : []);
        const out = [];
        for (const cell of sourceCells) {
            if (!cell || typeof cell !== 'object') continue;
            const row = Number(cell.row);
            let col = null;
            if (Number.isInteger(cell.col)) {
                col = cell.col;
            } else if (cell.side === 'left') {
                col = -1;
            } else if (cell.side === 'right') {
                col = 8;
            }
            if (!Number.isInteger(row) || !Number.isInteger(col)) continue;
            out.push({ row, col, owner: cell.owner });
        }
        return out;
    }

    function collectRiboDestroyableOwnStonePositions(cardState, gameState, playerKey) {
        const out = [];
        const ownerValue = playerKey === 'black' ? BLACK : WHITE;
        const boardSize = Number.isInteger(BOARD_SIZE) ? BOARD_SIZE : 8;
        const board = gameState && Array.isArray(gameState.board) ? gameState.board : [];

        for (let row = 0; row < boardSize; row++) {
            const boardRow = Array.isArray(board[row]) ? board[row] : [];
            for (let col = 0; col < boardSize; col++) {
                if (boardRow[col] !== ownerValue) continue;
                if (isGuardProtectedCell(cardState, row, col)) continue;
                out.push({ row, col });
            }
        }

        const expansionCells = getRiboExpansionDescriptors(gameState);
        for (const cell of expansionCells) {
            if (!cell || cell.owner !== ownerValue) continue;
            if (isGuardProtectedCell(cardState, cell.row, cell.col)) continue;
            out.push({ row: cell.row, col: cell.col });
        }

        return out;
    }

    function sampleRandomPositions(positions, count, prng) {
        if (!Array.isArray(positions) || positions.length === 0 || !Number.isFinite(count) || count <= 0) return [];
        const randomSource = () => {
            if (prng && typeof prng.random === 'function') {
                try {
                    return prng.random();
                } catch (e) {
                    return Math.random();
                }
            }
            return Math.random();
        };
        const pool = positions.slice();
        const out = [];
        while (pool.length > 0 && out.length < count) {
            const rnd = Math.max(0, Math.min(0.999999, Number(randomSource()) || 0));
            const index = Math.floor(rnd * pool.length);
            out.push(pool.splice(index, 1)[0]);
        }
        return out;
    }

    function collectTimeStopGodDestroyableOwnStonePositions(cardState, gameState, playerKey) {
        return collectRiboDestroyableOwnStonePositions(cardState, gameState, playerKey).filter((pos) => {
            if (!pos) return false;
            if (isFrozenCellForCard(cardState, pos.row, pos.col)) return false;
            const marker = findSpecialMarkerAt(cardState, pos.row, pos.col);
            const destroyEvadeRemaining = Number(marker && marker.data && marker.data.destroyEvadeRemaining);
            return !(Number.isFinite(destroyEvadeRemaining) && destroyEvadeRemaining > 0);
        });
    }

    function destroyCellWithPresentation(cardState, gameState, row, col, cause, reason, meta) {
        if (isMainBoardCellForCard(row, col) && BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function') {
            return BoardOpsModule.destroyAt(
                cardState,
                gameState,
                row,
                col,
                cause || 'SYSTEM',
                reason || 'legacy_fallback',
                (meta && typeof meta === 'object') ? meta : {}
            );
        }

        const prev = getCellValueForCard(gameState, row, col);
        if (prev === EMPTY) return { destroyed: false };
        if (prev === null) return { destroyed: false, reason: 'out_of_board' };

        const stoneId = getStoneIdAtForCard(cardState, gameState, row, col);
        clearStoneIdAtForCard(cardState, gameState, row, col);
        removeMarkersAt(cardState, row, col);
        setCellValueForCard(gameState, row, col, EMPTY);
        emitPresentationEvent(cardState, {
            type: 'DESTROY',
            stoneId,
            row,
            col,
            ownerBefore: prev === BLACK ? 'black' : 'white',
            cause: cause || null,
            reason: reason || null,
            meta: (meta && typeof meta === 'object') ? meta : {}
        });
        return { destroyed: true, evaded: false };
    }

    function revertSpecialStoneWithPresentation(cardState, gameState, row, col, specialType, ownerKey, cause, reason, meta) {
        if (BoardOpsModule && typeof BoardOpsModule.revertSpecialStoneAt === 'function') {
            return BoardOpsModule.revertSpecialStoneAt(
                cardState,
                gameState,
                row,
                col,
                specialType,
                ownerKey,
                cause || 'SYSTEM',
                reason || 'duration_end',
                (meta && typeof meta === 'object') ? meta : {}
            );
        }

        const prev = getCellValueForCard(gameState, row, col);
        if (prev === EMPTY) return { reverted: false, reason: 'empty_cell' };
        if (prev === null) return { reverted: false, reason: 'out_of_board' };

        removeMarkersAt(cardState, row, col, {
            kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone',
            type: specialType,
            owner: ownerKey
        });
        emitPresentationEvent(cardState, {
            type: 'STATUS_REMOVED',
            row,
            col,
            cause: cause || null,
            reason: reason || null,
            meta: Object.assign({}, (meta && typeof meta === 'object') ? meta : {}, {
                special: specialType,
                owner: ownerKey,
                reason: reason || null,
                reverted: true
            })
        });
        return { reverted: true };
    }

    function ensureTimeStopConsecutiveTurnsRemainingByPlayer(cardState) {
        if (!cardState.timeStopConsecutiveTurnsRemainingByPlayer || typeof cardState.timeStopConsecutiveTurnsRemainingByPlayer !== 'object') {
            cardState.timeStopConsecutiveTurnsRemainingByPlayer = { black: 0, white: 0 };
        }
        if (!Number.isFinite(Number(cardState.timeStopConsecutiveTurnsRemainingByPlayer.black))) {
            cardState.timeStopConsecutiveTurnsRemainingByPlayer.black = 0;
        }
        if (!Number.isFinite(Number(cardState.timeStopConsecutiveTurnsRemainingByPlayer.white))) {
            cardState.timeStopConsecutiveTurnsRemainingByPlayer.white = 0;
        }
        cardState.timeStopConsecutiveTurnsRemainingByPlayer.black = Math.max(0, Math.floor(Number(cardState.timeStopConsecutiveTurnsRemainingByPlayer.black)));
        cardState.timeStopConsecutiveTurnsRemainingByPlayer.white = Math.max(0, Math.floor(Number(cardState.timeStopConsecutiveTurnsRemainingByPlayer.white)));
        return cardState.timeStopConsecutiveTurnsRemainingByPlayer;
    }

    function getTimeStopGodDestroyableCount(cardState, gameState, playerKey) {
        return collectTimeStopGodDestroyableOwnStonePositions(cardState, gameState, playerKey).length;
    }

    function canUseTimeStopGodForPlayer(cardState, gameState, playerKey) {
        if (!gameState || !Array.isArray(gameState.board)) return false;
        return getTimeStopGodDestroyableCount(cardState, gameState, playerKey) >= TIME_STOP_GOD_SELF_DESTROY_COUNT;
    }

    function resolveTimeStopGodUsage(cardState, gameState, playerKey, prng) {
        const targets = sampleRandomPositions(
            collectTimeStopGodDestroyableOwnStonePositions(cardState, gameState, playerKey),
            TIME_STOP_GOD_SELF_DESTROY_COUNT,
            prng
        );
        const destroyed = [];

        for (const target of targets) {
            if (!target) continue;
            const destroyRes = destroyCellWithPresentation(
                cardState,
                gameState,
                target.row,
                target.col,
                'TIME_STOP_GOD',
                'time_stop_god_cost',
                { owner: playerKey }
            );
            if (destroyRes && destroyRes.destroyed) {
                destroyed.push({ row: target.row, col: target.col });
            }
        }

        return {
            applied: true,
            requestedCount: TIME_STOP_GOD_SELF_DESTROY_COUNT,
            destroyedCount: destroyed.length,
            destroyed
        };
    }

    function reserveTimeStopConsecutiveTurns(cardState, playerKey, totalTurns) {
        const byPlayer = ensureTimeStopConsecutiveTurnsRemainingByPlayer(cardState);
        const requestedTurns = Number.isFinite(Number(totalTurns))
            ? Math.max(1, Math.floor(Number(totalTurns)))
            : TIME_STOP_GOD_CONSECUTIVE_TURNS;
        const current = Math.max(0, Number(byPlayer[playerKey]) || 0);
        const increment = current > 0 ? Math.max(0, requestedTurns - 1) : requestedTurns;
        byPlayer[playerKey] = current + increment;
        return byPlayer[playerKey];
    }

    function consumeTimeStopConsecutiveTurn(cardState, playerKey) {
        const byPlayer = ensureTimeStopConsecutiveTurnsRemainingByPlayer(cardState);
        const current = Math.max(0, Number(byPlayer[playerKey]) || 0);
        if (current <= 0) {
            return { consumed: false, remaining: 0, continueTurn: false };
        }
        byPlayer[playerKey] = current - 1;
        return {
            consumed: true,
            remaining: byPlayer[playerKey],
            continueTurn: byPlayer[playerKey] > 0
        };
    }

    function processTimeStopEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col) {
        const marker = findSpecialMarkerAt(cardState, row, col, 'TIME_STOP', playerKey);
        if (!marker) {
            return { triggered: [], fizzled: [] };
        }

        const ownerValue = playerKey === 'black' ? BLACK : WHITE;
        const cellValue = getCellValueForCard(gameState, row, col);
        if (cellValue !== ownerValue) {
            if (marker.id !== undefined && marker.id !== null) {
                removeMarkerById(cardState, marker.id);
            } else {
                removeMarkersAt(cardState, row, col, { kind: MARKER_KINDS.SPECIAL_STONE, type: 'TIME_STOP', owner: playerKey });
            }
            return {
                triggered: [],
                fizzled: [{ row, col, owner: playerKey, reason: 'anchor_lost' }]
            };
        }

        if (!marker.data) marker.data = {};
        const remainingOwnerTurns = Number.isFinite(Number(marker.data.remainingOwnerTurns))
            ? Math.max(0, Math.floor(Number(marker.data.remainingOwnerTurns)))
            : TIME_STOP_GOD_TURNS;
        const remainingAfter = Math.max(0, remainingOwnerTurns - 1);
        marker.data.remainingOwnerTurns = remainingAfter;
        if (remainingAfter > 0) {
            return { triggered: [], fizzled: [] };
        }

        revertSpecialStoneWithPresentation(cardState, gameState, row, col, 'TIME_STOP', playerKey, 'TIME_STOP', 'duration_end', {
            owner: playerKey,
            timer: 0
        });
        const totalReservedTurns = reserveTimeStopConsecutiveTurns(cardState, playerKey, TIME_STOP_GOD_CONSECUTIVE_TURNS);
        return {
            triggered: [{ row, col, owner: playerKey, totalReservedTurns }],
            fizzled: []
        };
    }

    function armRiboWillEffect(cardState, playerKey) {
        const riboByPlayer = ensureRiboRepaymentsByPlayer(cardState);
        const entry = {
            remainingOwnerTurns: RIBO_WILL_OWNER_TURNS,
            repaymentAmount: RIBO_WILL_REPAYMENT_AMOUNT,
            shortageDestroyCount: RIBO_WILL_SHORTAGE_DESTROY_COUNT
        };
        riboByPlayer[playerKey].push(entry);
        const gained = addChargeWithTotal(cardState, playerKey, RIBO_WILL_INITIAL_GAIN);
        return {
            applied: true,
            gained,
            repaymentAmount: entry.repaymentAmount,
            remainingOwnerTurns: entry.remainingOwnerTurns,
            shortageDestroyCount: entry.shortageDestroyCount,
            activeCount: riboByPlayer[playerKey].length
        };
    }

    function collectRandomBoardSpawnablePositions(cardState, gameState) {
        return getEmptyBoardShapeCellsForCard(cardState, gameState)
            .filter((cell) => !isBlockedCell(cardState, cell.row, cell.col, gameState));
    }

    function resolveRandomBoardSpawnEffectUsage(cardState, gameState, playerKey, requestedCount, prng, cause, reason) {
        const normalizedRequestedCount = Number.isFinite(Number(requestedCount))
            ? Math.max(0, Math.trunc(Number(requestedCount)))
            : 0;
        const targets = sampleRandomPositions(
            collectRandomBoardSpawnablePositions(cardState, gameState),
            normalizedRequestedCount,
            prng
        );
        const spawned = [];

        for (const target of targets) {
            if (!target) continue;
            const spawnIndex = spawned.length + 1;
            const spawnMeta = {
                owner: playerKey,
                requestedCount: normalizedRequestedCount,
                spawnIndex
            };
            let spawnRes = null;
            if (BoardOpsModule && typeof BoardOpsModule.spawnAt === 'function') {
                spawnRes = BoardOpsModule.spawnAt(
                    cardState,
                    gameState,
                    target.row,
                    target.col,
                    playerKey,
                    cause,
                    reason,
                    spawnMeta
                );
            } else {
                const ownerValue = playerKey === 'white' ? WHITE : BLACK;
                const wroteCell = setCellValueForCard(gameState, target.row, target.col, ownerValue);
                if (wroteCell) {
                    const stoneId = allocateStoneId(cardState);
                    setStoneIdAtForCard(cardState, gameState, target.row, target.col, stoneId);
                    emitPresentationEvent(cardState, {
                        type: 'SPAWN',
                        stoneId,
                        row: target.row,
                        col: target.col,
                        ownerAfter: playerKey,
                        cause,
                        reason,
                        meta: spawnMeta
                    });
                    spawnRes = { spawned: true, stoneId };
                }
            }
            if (!(spawnRes && spawnRes.spawned)) continue;
            spawned.push({
                row: target.row,
                col: target.col,
                stoneId: spawnRes.stoneId || null
            });
        }

        return {
            applied: true,
            requestedCount: normalizedRequestedCount,
            spawnedCount: spawned.length,
            spawned
        };
    }

    function resolveEqualityWillUsage(cardState, gameState, playerKey, prng) {
        return resolveRandomBoardSpawnEffectUsage(
            cardState,
            gameState,
            playerKey,
            EQUALITY_WILL_MAX_SPAWNS,
            prng,
            'EQUALITY_WILL',
            'equality_will_spawn'
        );
    }

    function processRiboWillTurnStartEffects(cardState, gameState, playerKey, prng) {
        const riboByPlayer = ensureRiboRepaymentsByPlayer(cardState);
        const active = Array.isArray(riboByPlayer[playerKey]) ? riboByPlayer[playerKey] : [];
        const summary = {
            entries: [],
            totalRepaid: 0,
            totalDestroyed: 0,
            completedCount: 0
        };
        if (active.length === 0) return summary;

        const next = [];
        for (const rawEntry of active) {
            const remainingOwnerTurns = Number.isFinite(Number(rawEntry && rawEntry.remainingOwnerTurns))
                ? Math.max(0, Math.floor(Number(rawEntry.remainingOwnerTurns)))
                : 0;
            if (remainingOwnerTurns <= 0) continue;

            const repaymentAmount = Number.isFinite(Number(rawEntry && rawEntry.repaymentAmount))
                ? Math.max(0, Math.floor(Number(rawEntry.repaymentAmount)))
                : RIBO_WILL_REPAYMENT_AMOUNT;
            const shortageDestroyCount = Number.isFinite(Number(rawEntry && rawEntry.shortageDestroyCount))
                ? Math.max(0, Math.floor(Number(rawEntry.shortageDestroyCount)))
                : RIBO_WILL_SHORTAGE_DESTROY_COUNT;
            const chargeBefore = Number.isFinite(Number(cardState && cardState.charge && cardState.charge[playerKey]))
                ? Number(cardState.charge[playerKey])
                : 0;
            const remainingAfter = Math.max(0, remainingOwnerTurns - 1);
            const entry = {
                repaymentAmount,
                shortageDestroyCount,
                remainingOwnerTurnsBefore: remainingOwnerTurns,
                remainingOwnerTurnsAfter: remainingAfter,
                chargeBefore,
                chargeAfter: chargeBefore,
                repaid: 0,
                shortage: false,
                destroyed: [],
                destroyedCount: 0,
                completed: remainingAfter <= 0
            };

            if (chargeBefore >= repaymentAmount) {
                const deltaRes = addChargeValue(cardState, playerKey, -repaymentAmount, 'ribo_will_repayment');
                entry.repaid = Math.max(0, -(Number(deltaRes && deltaRes.delta) || 0));
                entry.chargeAfter = Number.isFinite(Number(deltaRes && deltaRes.after))
                    ? Number(deltaRes.after)
                    : Math.max(0, chargeBefore - repaymentAmount);
                summary.totalRepaid += entry.repaid;
            } else {
                entry.shortage = true;
                const targets = sampleRandomPositions(
                    collectRiboDestroyableOwnStonePositions(cardState, gameState, playerKey),
                    shortageDestroyCount,
                    prng
                );
                for (const target of targets) {
                    if (!target) continue;
                    let destroyed = false;
                    if (BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function') {
                        const destroyRes = BoardOpsModule.destroyAt(
                            cardState,
                            gameState,
                            target.row,
                            target.col,
                            'RIBO_WILL',
                            'ribo_repayment_shortage',
                            { owner: playerKey }
                        );
                        destroyed = !!(destroyRes && destroyRes.destroyed);
                    } else {
                        destroyed = destroyAt(cardState, gameState, target.row, target.col);
                    }
                    if (!destroyed) continue;
                    entry.destroyed.push({ row: target.row, col: target.col });
                }
                entry.destroyedCount = entry.destroyed.length;
                summary.totalDestroyed += entry.destroyedCount;
            }

            if (entry.completed) {
                summary.completedCount += 1;
            } else {
                next.push({
                    remainingOwnerTurns: remainingAfter,
                    repaymentAmount,
                    shortageDestroyCount
                });
            }
            summary.entries.push(entry);
        }

        riboByPlayer[playerKey] = next;
        return summary;
    }

    const CardSelectorsModule = (() => {
        if (typeof require === 'function') {
            try {
                return require('./cards/selectors');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.CardSelectors || null;
    })();

    const CardUsagePrechecksModule = (() => {
        if (typeof require === 'function') {
            try {
                return require('./cards-internal/card-usage-prechecks');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.CardUsagePrechecks || null;
    })();

    const CardSelectorOrchestratorModule = (() => {
        if (typeof require === 'function') {
            try {
                return require('./cards-internal/selector-orchestrator');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.CardSelectorOrchestrator || null;
    })();

    const CardHandManagerModule = (() => {
        if (typeof require === 'function') {
            try {
                return require('./cards-internal/hand-manager');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.CardHandManager || null;
    })();

    const CardEffectTimingModule = (() => {
        if (typeof require === 'function') {
            try {
                return require('./cards-internal/effect-timing');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.CardEffectTiming || null;
    })();

    const CardPendingStateManagerModule = (() => {
        if (typeof require === 'function') {
            try {
                return require('./cards-internal/pending-state-manager');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.CardPendingStateManager || null;
    })();

    const PendingCoordinatorModule = (() => {
        if (typeof require === 'function') {
            try {
                return require('../turn/pending-coordinator');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.PendingCoordinator || null;
    })();

    const CardChargeLedgerModule = (() => {
        if (typeof require === 'function') {
            try {
                return require('./cards-internal/charge-ledger');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.CardChargeLedger || null;
    })();

    function readCardPendingEffect(cardState, playerKey) {
        if (PendingCoordinatorModule && typeof PendingCoordinatorModule.readPendingEffect === 'function') {
            return PendingCoordinatorModule.readPendingEffect(cardState, playerKey);
        }
        return (cardState && cardState.pendingEffectByPlayer) ? (cardState.pendingEffectByPlayer[playerKey] || null) : null;
    }

    function writeCardPendingEffect(cardState, playerKey, pendingEffect, options) {
        if (PendingCoordinatorModule && typeof PendingCoordinatorModule.writePendingEffect === 'function') {
            const result = PendingCoordinatorModule.writePendingEffect(cardState, playerKey, pendingEffect, options);
            return result && result.ok ? result.pendingEffect : null;
        }
        if (!cardState || typeof cardState !== 'object') return null;
        if (!cardState.pendingEffectByPlayer || typeof cardState.pendingEffectByPlayer !== 'object') {
            cardState.pendingEffectByPlayer = { black: null, white: null };
        }
        cardState.pendingEffectByPlayer[playerKey] = pendingEffect || null;
        return cardState.pendingEffectByPlayer[playerKey];
    }

    function clearCardPendingEffect(cardState, playerKey, options) {
        if (PendingCoordinatorModule && typeof PendingCoordinatorModule.clearPendingEffect === 'function') {
            const result = PendingCoordinatorModule.clearPendingEffect(cardState, playerKey, options);
            return !!(result && result.ok);
        }
        if (!cardState || !cardState.pendingEffectByPlayer) return false;
        cardState.pendingEffectByPlayer[playerKey] = null;
        return true;
    }

    const BoardOpsModule = (() => {
        if (typeof require === 'function') {
            try {
                return require('./board_ops');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.BoardOps || null;
    })();

    const MarkersAdapter = (() => {
        if (typeof require === 'function') {
            try {
                return require('./markers_adapter');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.MarkersAdapter || null;
    })();
    const MARKER_KINDS = MarkersAdapter && MarkersAdapter.MARKER_KINDS;
    const MARKER_CATEGORIES = (MarkersAdapter && MarkersAdapter.MARKER_CATEGORIES)
        ? MarkersAdapter.MARKER_CATEGORIES
        : { BOMB: 'bomb' };

    function ensureMarkers(cardState) {
        if (CardMarkersModule && typeof CardMarkersModule.ensureMarkers === 'function') {
            CardMarkersModule.ensureMarkers(cardState);
            return;
        }
        if (MarkersAdapter && typeof MarkersAdapter.ensureMarkers === 'function') {
            MarkersAdapter.ensureMarkers(cardState);
            return;
        }
        if (!cardState) return;
        if (!Array.isArray(cardState.markers)) cardState.markers = [];
        if (typeof cardState._nextMarkerId !== 'number') cardState._nextMarkerId = 1;
        if (typeof cardState._nextCreatedSeq !== 'number') cardState._nextCreatedSeq = 1;
    }

    function getMarkers(cardState) {
        if (CardMarkersModule && typeof CardMarkersModule.getMarkers === 'function') {
            return CardMarkersModule.getMarkers(cardState);
        }
        return (MarkersAdapter && typeof MarkersAdapter.getMarkers === 'function')
            ? MarkersAdapter.getMarkers(cardState)
            : (cardState && Array.isArray(cardState.markers) ? cardState.markers : []);
    }

    function getMarkerCategory(marker) {
        if (CardMarkersModule && typeof CardMarkersModule.getMarkerCategory === 'function') {
            return CardMarkersModule.getMarkerCategory(marker);
        }
        if (MarkersAdapter && typeof MarkersAdapter.getMarkerCategory === 'function') {
            return MarkersAdapter.getMarkerCategory(marker);
        }
        if (!marker || !marker.data) return null;
        if (marker.kind === MARKER_CATEGORIES.BOMB) return MARKER_CATEGORIES.BOMB;
        return (typeof marker.data.category === 'string' && marker.data.category)
            ? marker.data.category
            : null;
    }

    function isBombCategoryMarker(marker) {
        if (CardMarkersModule && typeof CardMarkersModule.isBombCategoryMarker === 'function') {
            return CardMarkersModule.isBombCategoryMarker(marker);
        }
        if (MarkersAdapter && typeof MarkersAdapter.isBombCategoryMarker === 'function') {
            return MarkersAdapter.isBombCategoryMarker(marker);
        }
        return getMarkerCategory(marker) === MARKER_CATEGORIES.BOMB;
    }

    function getBombMarkerType(marker) {
        if (CardMarkersModule && typeof CardMarkersModule.getBombMarkerType === 'function') {
            return CardMarkersModule.getBombMarkerType(marker);
        }
        if (MarkersAdapter && typeof MarkersAdapter.getBombMarkerType === 'function') {
            return MarkersAdapter.getBombMarkerType(marker);
        }
        if (!isBombCategoryMarker(marker)) return null;
        return marker && marker.data && marker.data.type ? marker.data.type : 'TIME_BOMB';
    }

    function normalizeMarkerInput(kind, data) {
        if (CardMarkersModule && typeof CardMarkersModule.normalizeMarkerInput === 'function') {
            return CardMarkersModule.normalizeMarkerInput(kind, data);
        }
        if (MarkersAdapter && typeof MarkersAdapter.normalizeMarkerInput === 'function') {
            return MarkersAdapter.normalizeMarkerInput(kind, data);
        }
        const normalizedData = (data && typeof data === 'object') ? { ...data } : {};
        const requestedKind = (typeof kind === 'string' && kind)
            ? kind
            : (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone');
        const isBombInput =
            requestedKind === MARKER_CATEGORIES.BOMB ||
            normalizedData.category === MARKER_CATEGORIES.BOMB ||
            normalizedData.type === 'TIME_BOMB';
        if (isBombInput) {
            normalizedData.category = MARKER_CATEGORIES.BOMB;
            if (!normalizedData.type) normalizedData.type = 'TIME_BOMB';
            return {
                kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone',
                data: normalizedData
            };
        }
        return {
            kind: requestedKind,
            data: normalizedData
        };
    }

    function getSpecialMarkers(cardState) {
        if (CardMarkersModule && typeof CardMarkersModule.getSpecialMarkers === 'function') {
            return CardMarkersModule.getSpecialMarkers(cardState);
        }
        return (MarkersAdapter && typeof MarkersAdapter.getSpecialMarkers === 'function')
            ? MarkersAdapter.getSpecialMarkers(cardState)
            : getMarkers(cardState).filter(m => (
                m &&
                m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') &&
                !isBombCategoryMarker(m)
            ));
    }

    function getBombMarkers(cardState) {
        if (CardMarkersModule && typeof CardMarkersModule.getBombMarkers === 'function') {
            return CardMarkersModule.getBombMarkers(cardState);
        }
        return (MarkersAdapter && typeof MarkersAdapter.getBombMarkers === 'function')
            ? MarkersAdapter.getBombMarkers(cardState)
            : getMarkers(cardState).filter(m => isBombCategoryMarker(m));
    }

    function getBlockadeMarkers(cardState) {
        if (CardMarkersModule && typeof CardMarkersModule.getBlockadeMarkers === 'function') {
            return CardMarkersModule.getBlockadeMarkers(cardState);
        }
        return getSpecialMarkers(cardState).filter(m => m && m.data && m.data.type === 'BLOCKADE');
    }

    function getBlockingMarkers(cardState) {
        if (CardMarkersModule && typeof CardMarkersModule.getBlockingMarkers === 'function') {
            return CardMarkersModule.getBlockingMarkers(cardState);
        }
        return getSpecialMarkers(cardState).filter(m => (
            m &&
            m.data &&
            (m.data.type === 'BLOCKADE' || m.data.type === 'METEOR_HOLE' || m.data.type === 'FREEZE')
        ));
    }

    function isFrozenCellForCard(cardState, row, col) {
        if (CardMarkersModule && typeof CardMarkersModule.isFrozenCellForCard === 'function') {
            return CardMarkersModule.isFrozenCellForCard(cardState, row, col);
        }
        return getSpecialMarkers(cardState).some((m) => (
            m &&
            m.row === row &&
            m.col === col &&
            m.data &&
            m.data.type === 'FREEZE'
        ));
    }

    function isMeteorHoleCell(cardState, row, col) {
        if (CardMarkersModule && typeof CardMarkersModule.isMeteorHoleCell === 'function') {
            return CardMarkersModule.isMeteorHoleCell(cardState, row, col);
        }
        return getSpecialMarkers(cardState).some((m) => (
            m &&
            m.row === row &&
            m.col === col &&
            m.data &&
            m.data.type === 'METEOR_HOLE'
        ));
    }

    function isMainBoardCellForCard(row, col) {
        if (CardExpansionModule && typeof CardExpansionModule.isMainBoardCellForCard === 'function') {
            return CardExpansionModule.isMainBoardCellForCard(row, col);
        }
        return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < 8 && col >= 0 && col < 8;
    }

    function resolveExpansionSideForCard(side, row, col) {
        if (CardExpansionModule && typeof CardExpansionModule.resolveExpansionSideForCard === 'function') {
            return CardExpansionModule.resolveExpansionSideForCard(side, row, col);
        }
        if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
        if (col === -1) return 'left';
        if (col === 8) return 'right';
        if (row === -1) return 'top';
        if (row === 8) return 'bottom';
        return null;
    }

    function normalizeExpansionOwnerForCard(owner) {
        if (CardExpansionModule && typeof CardExpansionModule.normalizeExpansionOwnerForCard === 'function') {
            return CardExpansionModule.normalizeExpansionOwnerForCard(owner);
        }
        return (owner === BLACK || owner === WHITE) ? owner : EMPTY;
    }

    function isExpansionCoordinateForCard(row, col) {
        if (CardExpansionModule && typeof CardExpansionModule.isExpansionCoordinateForCard === 'function') {
            return CardExpansionModule.isExpansionCoordinateForCard(row, col);
        }
        if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
        if (row < -1 || row > 8 || col < -1 || col > 8) return false;
        if (isMainBoardCellForCard(row, col)) return false;
        return true;
    }

    function getExpansionDescriptorsForCard(gameState) {
        if (CardExpansionModule && typeof CardExpansionModule.getExpansionDescriptorsForCard === 'function') {
            return CardExpansionModule.getExpansionDescriptorsForCard(gameState);
        }
        return [];
    }

    function syncLegacyExpansionFieldsForCard(expansion) {
        if (CardExpansionModule && typeof CardExpansionModule.syncLegacyExpansionFieldsForCard === 'function') {
            return CardExpansionModule.syncLegacyExpansionFieldsForCard(expansion);
        }
    }

    function ensureMutableBoardExpansionForCard(gameState) {
        if (CardExpansionModule && typeof CardExpansionModule.ensureMutableBoardExpansionForCard === 'function') {
            return CardExpansionModule.ensureMutableBoardExpansionForCard(gameState);
        }
        if (!gameState || typeof gameState !== 'object') return null;
        if (!gameState.boardExpansion || typeof gameState.boardExpansion !== 'object') {
            gameState.boardExpansion = {
                active: false,
                side: null,
                row: null,
                owner: EMPTY,
                usedByPlayer: { black: false, white: false },
                cells: []
            };
            return gameState.boardExpansion;
        }

        return gameState.boardExpansion;
    }

    function writeExpansionDescriptorsForCard(gameState, cells) {
        if (CardExpansionModule && typeof CardExpansionModule.writeExpansionDescriptorsForCard === 'function') {
            return CardExpansionModule.writeExpansionDescriptorsForCard(gameState, cells);
        }
        const boardExpansion = ensureMutableBoardExpansionForCard(gameState);
        if (!boardExpansion) return null;
        boardExpansion.cells = Array.isArray(cells) ? cells.slice() : [];
        return boardExpansion;
    }

    function getCellValueForCard(gameState, row, col) {
        if (CardExpansionModule && typeof CardExpansionModule.getCellValueForCard === 'function') {
            return CardExpansionModule.getCellValueForCard(gameState, row, col);
        }
        return (isMainBoardCellForCard(row, col) && gameState && Array.isArray(gameState.board) && Array.isArray(gameState.board[row]))
            ? gameState.board[row][col]
            : null;
    }

    function setCellValueForCard(gameState, row, col, value) {
        if (CardExpansionModule && typeof CardExpansionModule.setCellValueForCard === 'function') {
            return CardExpansionModule.setCellValueForCard(gameState, row, col, value);
        }
        if (isMainBoardCellForCard(row, col)) {
            if (!gameState || !Array.isArray(gameState.board) || !Array.isArray(gameState.board[row])) return false;
            gameState.board[row][col] = value;
            return true;
        }
        return false;
    }

    function clearStoneIdAtForCard(cardState, gameState, row, col) {
        if (CardMarkersModule && typeof CardMarkersModule.clearStoneIdAtForCard === 'function') {
            return CardMarkersModule.clearStoneIdAtForCard(cardState, gameState, row, col);
        }
        if (!cardState) return;
        if (isMainBoardCellForCard(row, col)) {
            if (cardState.stoneIdMap && cardState.stoneIdMap[row]) {
                cardState.stoneIdMap[row][col] = null;
            }
            return;
        }
        const isExpansion = getExpansionDescriptorsForCard(gameState)
            .some((desc) => desc && desc.row === row && desc.col === col);
        if (!isExpansion) return;
        if (cardState.expansionStoneIdByCell && typeof cardState.expansionStoneIdByCell === 'object') {
            delete cardState.expansionStoneIdByCell[`${row},${col}`];
        }
    }

    function getStoneIdAtForCard(cardState, gameState, row, col) {
        if (CardMarkersModule && typeof CardMarkersModule.getStoneIdAtForCard === 'function') {
            return CardMarkersModule.getStoneIdAtForCard(cardState, gameState, row, col);
        }
        if (!cardState) return null;
        if (isMainBoardCellForCard(row, col)) {
            return (cardState.stoneIdMap && cardState.stoneIdMap[row])
                ? (cardState.stoneIdMap[row][col] || null)
                : null;
        }
        const isExpansion = getExpansionDescriptorsForCard(gameState)
            .some((desc) => desc && desc.row === row && desc.col === col);
        if (!isExpansion) return null;
        if (!cardState.expansionStoneIdByCell || typeof cardState.expansionStoneIdByCell !== 'object') return null;
        return cardState.expansionStoneIdByCell[`${row},${col}`] || null;
    }

    function setStoneIdAtForCard(cardState, gameState, row, col, stoneId) {
        if (CardMarkersModule && typeof CardMarkersModule.setStoneIdAtForCard === 'function') {
            return CardMarkersModule.setStoneIdAtForCard(cardState, gameState, row, col, stoneId);
        }
        if (!cardState) return false;
        if (isMainBoardCellForCard(row, col)) {
            if (!Array.isArray(cardState.stoneIdMap)) {
                cardState.stoneIdMap = Array.from({ length: 8 }, () => Array(8).fill(null));
            }
            if (!Array.isArray(cardState.stoneIdMap[row])) {
                cardState.stoneIdMap[row] = Array(8).fill(null);
            }
            cardState.stoneIdMap[row][col] = stoneId || null;
            return true;
        }
        const isExpansion = getExpansionDescriptorsForCard(gameState)
            .some((desc) => desc && desc.row === row && desc.col === col);
        if (!isExpansion) return false;
        if (!cardState.expansionStoneIdByCell || typeof cardState.expansionStoneIdByCell !== 'object') {
            cardState.expansionStoneIdByCell = {};
        }
        const key = `${row},${col}`;
        if (stoneId == null) {
            delete cardState.expansionStoneIdByCell[key];
        } else {
            cardState.expansionStoneIdByCell[key] = stoneId;
        }
        return true;
    }

    function isBlockedCell(cardState, row, col, gameState) {
        const rowNum = Number(row);
        const colNum = Number(col);
        if (!Number.isInteger(rowNum) || !Number.isInteger(colNum)) return false;
        const isExpansionCell = getExpansionDescriptorsForCard(gameState)
            .some((desc) => desc && desc.row === rowNum && desc.col === colNum);
        if (!isExpansionCell && !isMainBoardCellForCard(rowNum, colNum)) return false;
        return getBlockingMarkers(cardState).some(m => m.row === rowNum && m.col === colNum);
    }

    function toBoardCellKey(row, col) {
        return `${row},${col}`;
    }

    function hasMeteorHoleAtForCard(cardState, row, col) {
        return !!findSpecialMarkerAt(cardState, row, col, 'METEOR_HOLE');
    }

    function hasBoardShapeCellForCard(cardState, gameState, row, col) {
        const rowNum = Number(row);
        const colNum = Number(col);
        if (!Number.isInteger(rowNum) || !Number.isInteger(colNum)) return false;
        if (hasMeteorHoleAtForCard(cardState, rowNum, colNum)) return false;
        if (isMainBoardCellForCard(rowNum, colNum)) return true;
        return getExpansionDescriptorsForCard(gameState)
            .some((desc) => desc && desc.row === rowNum && desc.col === colNum);
    }

    function getCurrentBoardShapeCellsForCard(cardState, gameState) {
        const cells = [];
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if (!hasBoardShapeCellForCard(cardState, gameState, row, col)) continue;
                cells.push({ row, col });
            }
        }
        for (const desc of getExpansionDescriptorsForCard(gameState)) {
            if (!desc || !Number.isInteger(desc.row) || !Number.isInteger(desc.col)) continue;
            if (!hasBoardShapeCellForCard(cardState, gameState, desc.row, desc.col)) continue;
            cells.push({ row: desc.row, col: desc.col });
        }
        return cells;
    }

    function getOccupiedBoardShapeCellsForCard(cardState, gameState) {
        return getCurrentBoardShapeCellsForCard(cardState, gameState)
            .filter((cell) => getCellValueForCard(gameState, cell.row, cell.col) !== EMPTY);
    }

    function getEmptyBoardShapeCellsForCard(cardState, gameState) {
        return getCurrentBoardShapeCellsForCard(cardState, gameState)
            .filter((cell) => getCellValueForCard(gameState, cell.row, cell.col) === EMPTY);
    }

    function selectRandomEmptyBoardShapeDestination(cardState, gameState, fromRow, fromCol, randomSource) {
        const candidates = getEmptyBoardShapeCellsForCard(cardState, gameState)
            .filter((cell) => {
                if (!cell) return false;
                if (cell.row === fromRow && cell.col === fromCol) return false;
                return !isBlockedCell(cardState, cell.row, cell.col, gameState);
            });
        if (!candidates.length) return null;
        const rng = randomSource && typeof randomSource.random === 'function'
            ? randomSource
            : { random: () => 0 };
        const rawIndex = Math.floor(rng.random() * candidates.length);
        const index = Math.max(0, Math.min(candidates.length - 1, rawIndex));
        return candidates[index] || candidates[0] || null;
    }

    function moveCoexistingSpecialMarkers(cardState, anchorEntry, fromRow, fromCol, toRow, toCol) {
        if (!Array.isArray(cardState && cardState.markers)) return;
        for (const marker of cardState.markers) {
            if (!marker || marker === anchorEntry) continue;
            if (marker.row !== fromRow || marker.col !== fromCol) continue;
            if (marker.kind === 'specialStone') {
                const markerTypeUpper = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
                if (markerTypeUpper === 'BLOCKADE' || markerTypeUpper === 'METEOR_HOLE') continue;
            }
            marker.row = toRow;
            marker.col = toCol;
        }
    }

    function collectEmptyNeighborCellsForCard(cardState, gameState, row, col) {
        const neighbors = [];
        const seen = new Set();
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const targetRow = row + dr;
                const targetCol = col + dc;
                if (!hasBoardShapeCellForCard(cardState, gameState, targetRow, targetCol)) continue;
                if (getCellValueForCard(gameState, targetRow, targetCol) !== EMPTY) continue;
                if (isBlockedCell(cardState, targetRow, targetCol, gameState)) continue;
                const key = `${targetRow},${targetCol}`;
                if (seen.has(key)) continue;
                seen.add(key);
                neighbors.push({ row: targetRow, col: targetCol });
            }
        }
        return neighbors;
    }

    function getCurrentCornerCellsForCard(cardState, gameState) {
        const cells = getCurrentBoardShapeCellsForCard(cardState, gameState);
        if (cells.length === 0) return [];
        const cellKeys = new Set(cells.map((cell) => toBoardCellKey(cell.row, cell.col)));
        const quadrants = [
            { vertical: -1, horizontal: -1 },
            { vertical: -1, horizontal: 1 },
            { vertical: 1, horizontal: -1 },
            { vertical: 1, horizontal: 1 }
        ];

        return cells.filter((cell) => quadrants.some((quadrant) => {
            const verticalKey = toBoardCellKey(cell.row + quadrant.vertical, cell.col);
            const horizontalKey = toBoardCellKey(cell.row, cell.col + quadrant.horizontal);
            return !cellKeys.has(verticalKey) && !cellKeys.has(horizontalKey);
        }));
    }

    function countOccupiedCornersForPlayer(cardState, gameState, playerKey) {
        const ownerVal = playerKey === 'white' ? WHITE : BLACK;
        return getCurrentCornerCellsForCard(cardState, gameState)
            .reduce((count, cell) => (
                getCellValueForCard(gameState, cell.row, cell.col) === ownerVal ? count + 1 : count
            ), 0);
    }

    function countOpponentOccupiedCornersForPlayer(cardState, gameState, playerKey) {
        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        return countOccupiedCornersForPlayer(cardState, gameState, opponentKey);
    }

    function findSpecialMarkerAt(cardState, row, col, type, owner) {
        if (CardMarkersModule && typeof CardMarkersModule.findSpecialMarkerAt === 'function') {
            return CardMarkersModule.findSpecialMarkerAt(cardState, row, col, type, owner);
        }
        if (MarkersAdapter && typeof MarkersAdapter.findSpecialMarkerAt === 'function') {
            return MarkersAdapter.findSpecialMarkerAt(cardState, row, col, type, owner);
        }
        return getMarkers(cardState).find(m => (
            m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') &&
            m.row === row &&
            m.col === col &&
            (type ? (m.data && m.data.type === type) : true) &&
            (owner ? m.owner === owner : true)
        ));
    }

    function findBombMarkerAt(cardState, row, col) {
        if (CardMarkersModule && typeof CardMarkersModule.findBombMarkerAt === 'function') {
            return CardMarkersModule.findBombMarkerAt(cardState, row, col);
        }
        if (MarkersAdapter && typeof MarkersAdapter.findBombMarkerAt === 'function') {
            return MarkersAdapter.findBombMarkerAt(cardState, row, col);
        }
        return getMarkers(cardState).find(m => isBombCategoryMarker(m) && m.row === row && m.col === col);
    }

    function isPositionSwapProtectedCell(cardState, row, col) {
        return !!(
            findSpecialMarkerAt(cardState, row, col, 'GLUTTONOUS') ||
            findSpecialMarkerAt(cardState, row, col, 'ABSOLUTE_PROTECTED')
        );
    }

    function isAbsoluteProtectedCell(cardState, row, col) {
        return !!findSpecialMarkerAt(cardState, row, col, 'ABSOLUTE_PROTECTED');
    }

    function removeMarkersAt(cardState, row, col, options) {
        if (CardMarkersModule && typeof CardMarkersModule.removeMarkersAt === 'function') {
            CardMarkersModule.removeMarkersAt(cardState, row, col, options);
            return;
        }
        if (MarkersAdapter && typeof MarkersAdapter.removeMarkersAt === 'function') {
            MarkersAdapter.removeMarkersAt(cardState, row, col, options);
            return;
        }
        if (!cardState || !Array.isArray(cardState.markers)) return;
        const opts = options || {};
        cardState.markers = cardState.markers.filter(m => {
            if (m.row !== row || m.col !== col) return true;
            if (opts.kind === MARKER_CATEGORIES.BOMB && !isBombCategoryMarker(m)) return true;
            if (opts.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') && (m.kind !== opts.kind || isBombCategoryMarker(m))) return true;
            if (opts.kind && opts.kind !== MARKER_CATEGORIES.BOMB && opts.kind !== (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') && m.kind !== opts.kind) return true;
            if (opts.category && getMarkerCategory(m) !== opts.category) return true;
            if (opts.type && (!m.data || m.data.type !== opts.type)) return true;
            if (opts.owner && m.owner !== opts.owner) return true;
            return false;
        });
    }

    function swapCellCoordinates(cardState, gameState, posA, posB) {
        if (CardMarkersModule && typeof CardMarkersModule.swapCellCoordinates === 'function') {
            CardMarkersModule.swapCellCoordinates(cardState, gameState, posA, posB);
            return;
        }
        if (!cardState || !gameState || !posA || !posB) return;

        const aRow = Number(posA.row);
        const aCol = Number(posA.col);
        const bRow = Number(posB.row);
        const bCol = Number(posB.col);
        if (!Number.isInteger(aRow) || !Number.isInteger(aCol) || !Number.isInteger(bRow) || !Number.isInteger(bCol)) return;

        const stoneA = getStoneIdAtForCard(cardState, gameState, aRow, aCol);
        const stoneB = getStoneIdAtForCard(cardState, gameState, bRow, bCol);
        setStoneIdAtForCard(cardState, gameState, aRow, aCol, stoneB);
        setStoneIdAtForCard(cardState, gameState, bRow, bCol, stoneA);

        const markers = getMarkers(cardState);
        for (const m of markers) {
            if (!m) continue;
            if (m.row === aRow && m.col === aCol) {
                m.row = bRow;
                m.col = bCol;
            } else if (m.row === bRow && m.col === bCol) {
                m.row = aRow;
                m.col = aCol;
            }
        }

        const swapPoint = (p) => {
            if (!p || !Number.isInteger(p.row) || !Number.isInteger(p.col)) return p;
            if (p.row === aRow && p.col === aCol) return { row: bRow, col: bCol };
            if (p.row === bRow && p.col === bCol) return { row: aRow, col: aCol };
            return p;
        };

        if (cardState.workAnchorPosByPlayer) {
            cardState.workAnchorPosByPlayer.black = swapPoint(cardState.workAnchorPosByPlayer.black);
            cardState.workAnchorPosByPlayer.white = swapPoint(cardState.workAnchorPosByPlayer.white);
        }
        if (cardState.breedingSproutByOwner) {
            for (const owner of ['black', 'white']) {
                const arr = Array.isArray(cardState.breedingSproutByOwner[owner]) ? cardState.breedingSproutByOwner[owner] : [];
                cardState.breedingSproutByOwner[owner] = arr.map(swapPoint);
            }
        }
        if (cardState.breedingFrontierByAnchorId && typeof cardState.breedingFrontierByAnchorId === 'object') {
            for (const key of Object.keys(cardState.breedingFrontierByAnchorId)) {
                const arr = Array.isArray(cardState.breedingFrontierByAnchorId[key]) ? cardState.breedingFrontierByAnchorId[key] : [];
                cardState.breedingFrontierByAnchorId[key] = arr.map(swapPoint);
            }
        }
    }

    function buildInitialBoardBonusMap(prng) {
        if (CardExpansionModule && typeof CardExpansionModule.buildInitialBoardBonusMap === 'function') {
            return CardExpansionModule.buildInitialBoardBonusMap(prng);
        }
        const boardSize = Number.isInteger(BOARD_SIZE) ? BOARD_SIZE : 8;
        const center = Math.floor(boardSize / 2);
        const initialStoneCells = [
            { row: center - 1, col: center - 1 },
            { row: center - 1, col: center },
            { row: center, col: center - 1 },
            { row: center, col: center }
        ];
        const orthogonalDirs = [
            { dr: -1, dc: 0 },
            { dr: 1, dc: 0 },
            { dr: 0, dc: -1 },
            { dr: 0, dc: 1 }
        ];

        const blocked = new Set();
        for (const stone of initialStoneCells) {
            blocked.add(`${stone.row},${stone.col}`);
            for (const dir of orthogonalDirs) {
                const nextRow = stone.row + dir.dr;
                const nextCol = stone.col + dir.dc;
                if (nextRow < 0 || nextRow >= boardSize || nextCol < 0 || nextCol >= boardSize) continue;
                blocked.add(`${nextRow},${nextCol}`);
            }
        }

        const allEmptyCells = [];
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                const key = `${row},${col}`;
                if (blocked.has(key)) continue;
                allEmptyCells.push({ row, col });
            }
        }

        const dist = Array.isArray(INITIAL_BOARD_BONUS_DISTRIBUTION) && INITIAL_BOARD_BONUS_DISTRIBUTION.length > 0
            ? INITIAL_BOARD_BONUS_DISTRIBUTION
            : [
                { value: 1, count: 9 },
                { value: 2, count: 8 },
                { value: 3, count: 6 },
                { value: 4, count: 5 },
                { value: 5, count: 4 },
                { value: 6, count: 3 },
                { value: 7, count: 2 },
                { value: 8, count: 1 },
                { value: 9, count: 1 },
                { value: 10, count: 1 }
            ];

        const bonusValues = [];
        for (const item of dist) {
            if (!item) continue;
            const value = Number(item.value);
            const count = Number(item.count);
            if (!Number.isInteger(value) || value < 1 || value > 10) continue;
            if (!Number.isInteger(count) || count <= 0) continue;
            for (let i = 0; i < count; i++) bonusValues.push(value);
        }

        const cells = allEmptyCells.slice();
        prng.shuffle(cells);
        const values = bonusValues.slice();
        prng.shuffle(values);

        const assignCount = Math.min(cells.length, values.length);
        const out = {};
        for (let i = 0; i < assignCount; i++) {
            const pos = cells[i];
            out[`${pos.row},${pos.col}`] = values[i];
        }
        return out;
    }

    /**
     * Create initial card state
     * @param {Object} [prng] - PRNG object (optional)
     * @param {Object} [options] - Card initialization options
     * @returns {Object} cardState
     */
    function createCardState(prng, options) {
        const p = prng || defaultPrng;

        const buildDeck = (playerKey) => {
            const deck = resolveInitialDeckCardIds(options, playerKey).slice();
            p.shuffle(deck);
            return deck;
        };

        const blackDeck = buildDeck('black');
        const whiteDeck = buildDeck('white');
        const boardBonusByCell = buildInitialBoardBonusMap(p);

        const cardState = {
            // Per-player decks (non-shared)
            decks: {
                black: blackDeck,
                white: whiteDeck
            },
            // Legacy compatibility field. Do not use in new code.
            deck: blackDeck.slice(),
            discard: [],
            initialDeckSize: blackDeck.length,
            initialDeckSizeByPlayer: { black: blackDeck.length, white: whiteDeck.length },
            reshuffleRequiresFullCycle: false,
             hands: { black: [], white: [] },
             turnIndex: 0,
             lastTurnStartedFor: null,
             _activeTurnPlayer: null,
             turnCountByPlayer: { black: 0, white: 0 },
              timeStopConsecutiveTurnsRemainingByPlayer: { black: 0, white: 0 },
              observerTriviaBaseByPlayer: { black: null, white: null },
            observerTriviaCursorByPlayer: { black: null, white: null },
            _nextCardCopySeq: 1,
            _handCopyIdsByPlayer: { black: [], white: [] },
            _deckCopyIdsByPlayer: { black: [], white: [] },
            _discardCopyIds: [],
            _revealedHandCopyIdsByViewer: { black: [], white: [] },

            // Card usage state
            selectedCardId: null,
            hasUsedCardThisTurnByPlayer: { black: false, white: false },
            hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
            pendingEffectByPlayer: { black: null, white: null },
            activeEffectsByPlayer: { black: [], white: [] },

            // Special effects state - unified markers array (future primary storage)
            // Format: { id, row, col, kind, owner, data: {...} }
            markers: [],
            _nextMarkerId: 1,
            _nextCreatedSeq: 1,

            // Presentation event support (PoC)
            presentationEvents: [],   // [{type, stoneId, row, col, ownerBefore, ownerAfter, cause, reason, meta, actionId, turnIndex, plyIndex}]
            _nextStoneId: 5, // s1-s4 are initial stones
            stoneIdMap: (function () {
                const m = Array(8).fill(null).map(() => Array(8).fill(null));
                m[3][3] = 's1'; m[3][4] = 's2'; m[4][3] = 's3'; m[4][4] = 's4';
                return m;
            })(),
            expansionStoneIdByCell: {},
            hyperactiveSeqCounter: 0,

            // Recent usage
            lastUsedCardByPlayer: { black: null, white: null },
            cardUseCountByPlayer: { black: 0, white: 0 },
            totalFlipCountByPlayer: { black: 0, white: 0 },
            cornerCaptureCountByPlayer: { black: 0, white: 0 },

            // Resources
            charge: { black: 0, white: 0 },
            chargeGainedTotal: { black: 0, white: 0 },
            chargeDeltaEvents: [],
            _nextChargeDeltaSeq: 1,
            riboRepaymentsByPlayer: { black: [], white: [] },

            // Extra actions
            extraPlaceRemainingByPlayer: { black: 0, white: 0 },
            infinitePlaceActiveByPlayer: { black: false, white: false },
            multiPlaceSourceTypeByPlayer: { black: null, white: null },

            // Board bonus tiles (generated once at game start)
            boardBonusByCell,
            boardBonusConsumedByCell: {},

            // Work Will state
            workAnchorPosByPlayer: { black: null, white: null },
            workNextPlacementArmedByPlayer: { black: false, white: false },

            // Breeding runtime state
            // - frontier: next breeding origins per anchor id
            // - sprout: one-turn visual tags for stones spawned by breeding
            breedingFrontierByAnchorId: {},
            breedingSproutByOwner: { black: [], white: [] },
            _breedingSproutClearedTokenByOwner: { black: null, white: null },

            // SALVATION_WILL: per-player list of {row, col} for normal stones destroyed on the
            // immediately previous opponent turn. Reset at the start of each player's turn for
            // the opponent (victim) key. Only normal stones (no specialStone marker) are recorded.
            prevOpponentTurnDestroyedNormalByPlayer: { black: [], white: [] },

            // FATE_WILL: maps turn-owner key to the controller key (the player who used the card).
            // When non-null for a given turn owner, that upcoming opponent turn is operated by the
            // controller instead. Cleared at the start of the controller's next turn (i.e. after
            // the single controlled turn ends). Stacking/nesting is blocked.
            fateWillControllerByTurnOwner: { black: null, white: null }
        };
        ensureCardCopyState(cardState);
        return cardState;
    }

    /**
     * Deep copy card state
     * @param {Object} cs - Original card state
     * @returns {Object} Copied card state
     */
    function copyCardState(cs) {
        const legacyDeck = Array.isArray(cs.deck) ? cs.deck.slice() : [];
        const decks = (cs.decks && typeof cs.decks === 'object')
            ? {
                black: Array.isArray(cs.decks.black) ? cs.decks.black.slice() : legacyDeck.slice(),
                white: Array.isArray(cs.decks.white) ? cs.decks.white.slice() : legacyDeck.slice()
            }
            : { black: legacyDeck.slice(), white: legacyDeck.slice() };
        const initialDeckSizeByPlayer = (cs.initialDeckSizeByPlayer && typeof cs.initialDeckSizeByPlayer === 'object')
            ? {
                black: Number.isFinite(cs.initialDeckSizeByPlayer.black) ? cs.initialDeckSizeByPlayer.black : decks.black.length,
                white: Number.isFinite(cs.initialDeckSizeByPlayer.white) ? cs.initialDeckSizeByPlayer.white : decks.white.length
            }
            : {
                black: Number.isFinite(cs.initialDeckSize) ? cs.initialDeckSize : decks.black.length,
                white: Number.isFinite(cs.initialDeckSize) ? cs.initialDeckSize : decks.white.length
            };
        const nextState = {
            decks,
            // Legacy compatibility field. Do not use in new code.
            deck: decks.black.slice(),
            discard: cs.discard.slice(),
            hands: {
                black: cs.hands.black.slice(),
                white: cs.hands.white.slice()
             },
             turnIndex: cs.turnIndex,
             lastTurnStartedFor: cs.lastTurnStartedFor,
             _activeTurnPlayer: (typeof cs._activeTurnPlayer === 'string') ? cs._activeTurnPlayer : null,
             turnCountByPlayer: { ...cs.turnCountByPlayer },
             timeStopConsecutiveTurnsRemainingByPlayer: {
                 black: Number.isFinite(Number(cs && cs.timeStopConsecutiveTurnsRemainingByPlayer && cs.timeStopConsecutiveTurnsRemainingByPlayer.black))
                    ? Math.max(0, Math.floor(Number(cs.timeStopConsecutiveTurnsRemainingByPlayer.black)))
                    : 0,
                white: Number.isFinite(Number(cs && cs.timeStopConsecutiveTurnsRemainingByPlayer && cs.timeStopConsecutiveTurnsRemainingByPlayer.white))
                    ? Math.max(0, Math.floor(Number(cs.timeStopConsecutiveTurnsRemainingByPlayer.white)))
                    : 0
            },
            observerTriviaBaseByPlayer: (cs.observerTriviaBaseByPlayer && typeof cs.observerTriviaBaseByPlayer === 'object')
                ? {
                    black: Number.isFinite(Number(cs.observerTriviaBaseByPlayer.black)) ? Number(cs.observerTriviaBaseByPlayer.black) : null,
                    white: Number.isFinite(Number(cs.observerTriviaBaseByPlayer.white)) ? Number(cs.observerTriviaBaseByPlayer.white) : null
                }
                : { black: null, white: null },
            observerTriviaCursorByPlayer: (cs.observerTriviaCursorByPlayer && typeof cs.observerTriviaCursorByPlayer === 'object')
                ? {
                    black: Number.isFinite(Number(cs.observerTriviaCursorByPlayer.black)) ? Number(cs.observerTriviaCursorByPlayer.black) : null,
                    white: Number.isFinite(Number(cs.observerTriviaCursorByPlayer.white)) ? Number(cs.observerTriviaCursorByPlayer.white) : null
                }
                : { black: null, white: null },
            _nextCardCopySeq: Number.isFinite(Number(cs._nextCardCopySeq))
                ? Math.max(1, Math.floor(Number(cs._nextCardCopySeq)))
                : 1,
            _handCopyIdsByPlayer: (cs._handCopyIdsByPlayer && typeof cs._handCopyIdsByPlayer === 'object')
                ? {
                    black: Array.isArray(cs._handCopyIdsByPlayer.black) ? cs._handCopyIdsByPlayer.black.slice() : [],
                    white: Array.isArray(cs._handCopyIdsByPlayer.white) ? cs._handCopyIdsByPlayer.white.slice() : []
                }
                : { black: [], white: [] },
            _deckCopyIdsByPlayer: (cs._deckCopyIdsByPlayer && typeof cs._deckCopyIdsByPlayer === 'object')
                ? {
                    black: Array.isArray(cs._deckCopyIdsByPlayer.black) ? cs._deckCopyIdsByPlayer.black.slice() : [],
                    white: Array.isArray(cs._deckCopyIdsByPlayer.white) ? cs._deckCopyIdsByPlayer.white.slice() : []
                }
                : { black: [], white: [] },
            _discardCopyIds: Array.isArray(cs._discardCopyIds) ? cs._discardCopyIds.slice() : [],
            _revealedHandCopyIdsByViewer: (cs._revealedHandCopyIdsByViewer && typeof cs._revealedHandCopyIdsByViewer === 'object')
                ? {
                    black: Array.isArray(cs._revealedHandCopyIdsByViewer.black) ? cs._revealedHandCopyIdsByViewer.black.slice() : [],
                    white: Array.isArray(cs._revealedHandCopyIdsByViewer.white) ? cs._revealedHandCopyIdsByViewer.white.slice() : []
                }
                : { black: [], white: [] },

            selectedCardId: cs.selectedCardId,
            hasUsedCardThisTurnByPlayer: { ...cs.hasUsedCardThisTurnByPlayer },
            hasDestroyedCardThisTurnByPlayer: {
                black: !!(cs.hasDestroyedCardThisTurnByPlayer && cs.hasDestroyedCardThisTurnByPlayer.black),
                white: !!(cs.hasDestroyedCardThisTurnByPlayer && cs.hasDestroyedCardThisTurnByPlayer.white)
            },
            pendingEffectByPlayer: {
                black: cs.pendingEffectByPlayer.black ? { ...cs.pendingEffectByPlayer.black } : null,
                white: cs.pendingEffectByPlayer.white ? { ...cs.pendingEffectByPlayer.white } : null
            },
            activeEffectsByPlayer: {
                black: cs.activeEffectsByPlayer.black.map(e => ({ ...e })),
                white: cs.activeEffectsByPlayer.white.map(e => ({ ...e }))
            },

            // Unified markers (new primary storage)
            markers: (cs.markers || []).map(m => ({ ...m, data: { ...(m.data || {}) } })),
            _nextMarkerId: cs._nextMarkerId || 1,
            _nextCreatedSeq: cs._nextCreatedSeq || 1,
            stoneIdMap: (cs.stoneIdMap || Array(8).fill(null).map(() => Array(8).fill(null))).map(row => row.slice()),
            expansionStoneIdByCell: (cs.expansionStoneIdByCell && typeof cs.expansionStoneIdByCell === 'object')
                ? { ...cs.expansionStoneIdByCell }
                : {},
            hyperactiveSeqCounter: cs.hyperactiveSeqCounter || 0,

            lastUsedCardByPlayer: { ...cs.lastUsedCardByPlayer },
            cardUseCountByPlayer: { ...(cs.cardUseCountByPlayer || { black: 0, white: 0 }) },
            totalFlipCountByPlayer: { ...(cs.totalFlipCountByPlayer || { black: 0, white: 0 }) },
            cornerCaptureCountByPlayer: { ...(cs.cornerCaptureCountByPlayer || { black: 0, white: 0 }) },
            charge: { ...cs.charge },
            chargeGainedTotal: { ...(cs.chargeGainedTotal || { black: 0, white: 0 }) },
            chargeDeltaEvents: Array.isArray(cs.chargeDeltaEvents) ? cs.chargeDeltaEvents.map(e => ({ ...e })) : [],
            _nextChargeDeltaSeq: (typeof cs._nextChargeDeltaSeq === 'number') ? cs._nextChargeDeltaSeq : 1,
            riboRepaymentsByPlayer: {
                black: (cs.riboRepaymentsByPlayer && Array.isArray(cs.riboRepaymentsByPlayer.black))
                    ? cs.riboRepaymentsByPlayer.black.map((entry) => ({
                        remainingOwnerTurns: Number.isFinite(Number(entry && entry.remainingOwnerTurns))
                            ? Math.max(0, Math.floor(Number(entry.remainingOwnerTurns)))
                            : RIBO_WILL_OWNER_TURNS,
                        repaymentAmount: Number.isFinite(Number(entry && entry.repaymentAmount))
                            ? Math.max(0, Math.floor(Number(entry.repaymentAmount)))
                            : RIBO_WILL_REPAYMENT_AMOUNT,
                        shortageDestroyCount: Number.isFinite(Number(entry && entry.shortageDestroyCount))
                            ? Math.max(0, Math.floor(Number(entry.shortageDestroyCount)))
                            : RIBO_WILL_SHORTAGE_DESTROY_COUNT
                    }))
                    : [],
                white: (cs.riboRepaymentsByPlayer && Array.isArray(cs.riboRepaymentsByPlayer.white))
                    ? cs.riboRepaymentsByPlayer.white.map((entry) => ({
                        remainingOwnerTurns: Number.isFinite(Number(entry && entry.remainingOwnerTurns))
                            ? Math.max(0, Math.floor(Number(entry.remainingOwnerTurns)))
                            : RIBO_WILL_OWNER_TURNS,
                        repaymentAmount: Number.isFinite(Number(entry && entry.repaymentAmount))
                            ? Math.max(0, Math.floor(Number(entry.repaymentAmount)))
                            : RIBO_WILL_REPAYMENT_AMOUNT,
                        shortageDestroyCount: Number.isFinite(Number(entry && entry.shortageDestroyCount))
                            ? Math.max(0, Math.floor(Number(entry.shortageDestroyCount)))
                            : RIBO_WILL_SHORTAGE_DESTROY_COUNT
                    }))
                    : []
            },
            extraPlaceRemainingByPlayer: { ...cs.extraPlaceRemainingByPlayer },
            infinitePlaceActiveByPlayer: {
                black: !!(cs.infinitePlaceActiveByPlayer && cs.infinitePlaceActiveByPlayer.black),
                white: !!(cs.infinitePlaceActiveByPlayer && cs.infinitePlaceActiveByPlayer.white)
            },
            multiPlaceSourceTypeByPlayer: {
                black: (cs.multiPlaceSourceTypeByPlayer && typeof cs.multiPlaceSourceTypeByPlayer.black === 'string') ? cs.multiPlaceSourceTypeByPlayer.black : null,
                white: (cs.multiPlaceSourceTypeByPlayer && typeof cs.multiPlaceSourceTypeByPlayer.white === 'string') ? cs.multiPlaceSourceTypeByPlayer.white : null
            },
            boardBonusByCell: (cs.boardBonusByCell && typeof cs.boardBonusByCell === 'object')
                ? { ...cs.boardBonusByCell }
                : {},
            boardBonusConsumedByCell: (cs.boardBonusConsumedByCell && typeof cs.boardBonusConsumedByCell === 'object')
                ? { ...cs.boardBonusConsumedByCell }
                : {},
            initialDeckSize: Number.isFinite(cs.initialDeckSize) ? cs.initialDeckSize : decks.black.length,
            initialDeckSizeByPlayer,
            reshuffleRequiresFullCycle: cs.reshuffleRequiresFullCycle !== false,

            // Breeding runtime state
            breedingFrontierByAnchorId: (cs.breedingFrontierByAnchorId && typeof cs.breedingFrontierByAnchorId === 'object')
                ? Object.fromEntries(Object.entries(cs.breedingFrontierByAnchorId).map(([k, arr]) => [
                    String(k),
                    Array.isArray(arr) ? arr.map(p => ({ row: p.row, col: p.col })) : []
                ]))
                : {},
            breedingSproutByOwner: {
                black: (cs.breedingSproutByOwner && Array.isArray(cs.breedingSproutByOwner.black))
                    ? cs.breedingSproutByOwner.black.map(p => ({ row: p.row, col: p.col }))
                    : [],
                white: (cs.breedingSproutByOwner && Array.isArray(cs.breedingSproutByOwner.white))
                    ? cs.breedingSproutByOwner.white.map(p => ({ row: p.row, col: p.col }))
                    : []
            },
            _breedingSproutClearedTokenByOwner: (cs._breedingSproutClearedTokenByOwner && typeof cs._breedingSproutClearedTokenByOwner === 'object')
                ? {
                    black: cs._breedingSproutClearedTokenByOwner.black || null,
                    white: cs._breedingSproutClearedTokenByOwner.white || null
                }
                : { black: null, white: null },

            prevOpponentTurnDestroyedNormalByPlayer: (cs.prevOpponentTurnDestroyedNormalByPlayer && typeof cs.prevOpponentTurnDestroyedNormalByPlayer === 'object')
                ? {
                    black: Array.isArray(cs.prevOpponentTurnDestroyedNormalByPlayer.black)
                        ? cs.prevOpponentTurnDestroyedNormalByPlayer.black.map(p => ({ row: p.row, col: p.col }))
                        : [],
                    white: Array.isArray(cs.prevOpponentTurnDestroyedNormalByPlayer.white)
                        ? cs.prevOpponentTurnDestroyedNormalByPlayer.white.map(p => ({ row: p.row, col: p.col }))
                        : []
                }
                : { black: [], white: [] },

            fateWillControllerByTurnOwner: (cs.fateWillControllerByTurnOwner && typeof cs.fateWillControllerByTurnOwner === 'object')
                ? {
                    black: cs.fateWillControllerByTurnOwner.black || null,
                    white: cs.fateWillControllerByTurnOwner.white || null
                }
                : { black: null, white: null }
        };
        ensureCardCopyState(nextState);
        return nextState;
    }

    /**
     * Deal initial hands
     * @param {Object} cardState
     * @param {Object} [prng]
     */
    function dealInitialHands(cardState, prng) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.dealInitialHands !== 'function') {
            throw new Error('[cards.js] CardHandManager.dealInitialHands not available');
        }
        return CardHandManagerModule.dealInitialHands(cardState, prng || defaultPrng, getCardHandManagerContext());
    }

    /**
     * Initialize a complete game state with deterministic PRNG.
     * This function ensures that PRNG consumption order is fixed:
     * 1. Deck generation (shuffle for guaranteed cards per type)
     * 2. Deck final shuffle
     * 3. No initial hand draw (policy)
     * 
     * For online/replay, both client and server should call this with the same seed.
     * 
     * @param {Object} prng - PRNG object (required for determinism)
     * @returns {{ cardState: Object, prngState: Object }}
     */
    function initGame(prng, options) {
        if (!prng || typeof prng.shuffle !== 'function') {
            throw new Error('initGame requires a PRNG object for deterministic initialization');
        }

        // Step 1: Create card state (consumes PRNG for deck generation)
        const cardState = createCardState(prng, options);

        // Step 2: Apply start-of-game hand policy (currently no initial draw)
        dealInitialHands(cardState, prng);

        // Return card state and PRNG state for serialization
        return {
            cardState,
            prngState: typeof prng.getState === 'function' ? prng.getState() : null
        };
    }

    /**
     * Add a marker to the unified markers array and sync to legacy arrays.
     * This is the primary method for adding special stones and bombs.
     * 
     * @param {Object} cardState - Card state
     * @param {string} kind - 'specialStone' or 'bomb'
     * @param {number} row
     * @param {number} col
     * @param {string} owner - 'black' or 'white'
     * @param {Object} data - Additional data (type, remainingTurns, etc.)
     * @returns {Object} The created marker
     */
    function addMarker(cardState, kind, row, col, owner, data) {
        const markerData = attachMarkerOriginIfNeeded(cardState, kind, owner, data);
        if (CardMarkersModule && typeof CardMarkersModule.addMarker === 'function') {
            return CardMarkersModule.addMarker(cardState, kind, row, col, owner, markerData);
        }
        ensureMarkers(cardState);
        const id = cardState._nextMarkerId || 1;
        cardState._nextMarkerId = id + 1;

        // Ensure createdSeq counter exists
        if (typeof cardState._nextCreatedSeq === 'undefined') cardState._nextCreatedSeq = 1;
        const createdSeq = cardState._nextCreatedSeq++;

        const normalized = normalizeMarkerInput(kind, markerData);
        const marker = {
            id,
            row,
            col,
            kind: normalized.kind,
            owner,
            createdSeq,
            data: normalized.data
        };

        cardState.markers.push(marker);

        // Emit a presentation event so UI can apply special visuals immediately.
        // This avoids "one-turn late" visuals when render is skipped during playback.
        try {
            var BoardPresentation = (typeof require === 'function') ? require('./presentation') : null;
            let special = null;
            let timer = null;
            let flipEvadeRemaining = null;
            let destroyEvadeRemaining = null;
            if (isBombCategoryMarker(marker)) {
                special = getBombMarkerType(marker) || 'TIME_BOMB';
                timer = (marker.data && typeof marker.data.remainingTurns === 'number') ? marker.data.remainingTurns : null;
            } else if (marker.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone')) {
                special = marker.data && marker.data.type ? marker.data.type : null;
                timer = (marker.data && typeof marker.data.remainingOwnerTurns === 'number') ? marker.data.remainingOwnerTurns : null;
                flipEvadeRemaining = Number.isFinite(Number(marker.data && marker.data.flipEvadeRemaining))
                    ? Math.max(0, Math.trunc(Number(marker.data.flipEvadeRemaining)))
                    : null;
                destroyEvadeRemaining = Number.isFinite(Number(marker.data && marker.data.destroyEvadeRemaining))
                    ? Math.max(0, Math.trunc(Number(marker.data.destroyEvadeRemaining)))
                    : null;
            }
            const markerMeta = { special, timer, owner };
            if (flipEvadeRemaining !== null) markerMeta.flipEvadeRemaining = flipEvadeRemaining;
            if (destroyEvadeRemaining !== null) markerMeta.destroyEvadeRemaining = destroyEvadeRemaining;
            if (special && BoardPresentation && typeof BoardPresentation.emitPresentationEvent === 'function') {
                BoardPresentation.emitPresentationEvent(cardState, { type: 'STATUS_APPLIED', row, col, meta: markerMeta });
            }

            // Fix: When a marker is created as part of placement effects, it can occur AFTER the SPAWN event
            // for the placed disc (BoardOps.spawnAt). In that case, the UI may briefly show a normal disc
            // until STATUS_APPLIED runs and finds the disc.
            //
            // Per 03-visual-rulebook.v2 §1.6, a placed special stone must show its final PNG look immediately.
            // Backfill the most recent matching SPAWN event's meta so the disc is created already-special.
            if (special && cardState) {
                const currentActionId = (cardState._currentActionMeta && cardState._currentActionMeta.actionId) || null;
                const persist = Array.isArray(cardState._presentationEventsPersist) ? cardState._presentationEventsPersist : [];
                const live = Array.isArray(cardState.presentationEvents) ? cardState.presentationEvents : [];
                const patchSpawnMeta = (arr) => {
                    for (let i = arr.length - 1; i >= 0; i--) {
                        const ev = arr[i];
                        if (!ev || ev.type !== 'SPAWN') continue;
                        if (ev.row !== row || ev.col !== col) continue;
                        if (currentActionId && ev.actionId && ev.actionId !== currentActionId) continue;
                        ev.meta = Object.assign({}, ev.meta || {}, markerMeta);
                        return true;
                    }
                    return false;
                };
                // Patch persisted buffer first (usually the one the UI consumes), then the live buffer (may be same refs).
                if (!patchSpawnMeta(persist)) patchSpawnMeta(live);
            }
        } catch (e) { /* ignore presentation failures */ }

        return marker;
    }

    /**
     * Remove a marker by id and sync to legacy arrays
     * @param {Object} cardState
     * @param {number} markerId
     * @returns {boolean} true if removed
     */
    function removeMarkerById(cardState, markerId) {
        if (CardMarkersModule && typeof CardMarkersModule.removeMarkerById === 'function') {
            return CardMarkersModule.removeMarkerById(cardState, markerId);
        }
        if (!cardState.markers) return false;

        const index = cardState.markers.findIndex(m => m.id === markerId);
        if (index === -1) return false;

        const marker = cardState.markers[index];
        cardState.markers.splice(index, 1);

        return true;
    }

    /**
     * Draw a card
     * @param {Object} cardState 
     * @param {string} playerKey - 'black' or 'white'
     * @param {Object} [prng] 
     * @returns {string|null} Drawn card ID
     */
    function commitDraw(cardState, playerKey, prng) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.commitDraw !== 'function') {
            throw new Error('[cards.js] CardHandManager.commitDraw not available');
        }
        return CardHandManagerModule.commitDraw(cardState, playerKey, prng || defaultPrng, getCardHandManagerContext());
    }

    function ensureCardCopyState(cardState) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.ensureCardCopyState !== 'function') {
            throw new Error('[cards.js] CardHandManager.ensureCardCopyState not available');
        }
        return CardHandManagerModule.ensureCardCopyState(cardState, getCardHandManagerContext());
    }

    function getHandCopyIdAt(cardState, playerKey, handIndex) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.getHandCopyIdAt !== 'function') {
            throw new Error('[cards.js] CardHandManager.getHandCopyIdAt not available');
        }
        return CardHandManagerModule.getHandCopyIdAt(cardState, playerKey, handIndex, getCardHandManagerContext());
    }

    function getHandCopyIds(cardState, playerKey) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.getHandCopyIds !== 'function') {
            throw new Error('[cards.js] CardHandManager.getHandCopyIds not available');
        }
        return CardHandManagerModule.getHandCopyIds(cardState, playerKey, getCardHandManagerContext());
    }

    function isCardCopyIdRevealedToViewer(cardState, viewerKey, cardCopyId) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.isCardCopyIdRevealedToViewer !== 'function') {
            throw new Error('[cards.js] CardHandManager.isCardCopyIdRevealedToViewer not available');
        }
        return CardHandManagerModule.isCardCopyIdRevealedToViewer(cardState, viewerKey, cardCopyId, getCardHandManagerContext());
    }

    function revealCurrentHandToViewer(cardState, viewerKey, ownerKey) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.revealCurrentHandToViewer !== 'function') {
            throw new Error('[cards.js] CardHandManager.revealCurrentHandToViewer not available');
        }
        return CardHandManagerModule.revealCurrentHandToViewer(cardState, viewerKey, ownerKey, getCardHandManagerContext());
    }

    function addCardToHand(cardState, playerKey, cardId, opts) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.addCardToHand !== 'function') {
            throw new Error('[cards.js] CardHandManager.addCardToHand not available');
        }
        return CardHandManagerModule.addCardToHand(cardState, playerKey, cardId, getCardHandManagerContext(), opts);
    }

    function addCardToDiscard(cardState, cardId, cardCopyId) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.addCardToDiscard !== 'function') {
            throw new Error('[cards.js] CardHandManager.addCardToDiscard not available');
        }
        return CardHandManagerModule.addCardToDiscard(cardState, cardId, cardCopyId, getCardHandManagerContext());
    }

    function removeHandCardAt(cardState, playerKey, handIndex) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.removeHandCardAt !== 'function') {
            throw new Error('[cards.js] CardHandManager.removeHandCardAt not available');
        }
        return CardHandManagerModule.removeHandCardAt(cardState, playerKey, handIndex, getCardHandManagerContext());
    }

    function clearHandToDiscard(cardState, playerKey) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.clearHandToDiscard !== 'function') {
            throw new Error('[cards.js] CardHandManager.clearHandToDiscard not available');
        }
        return CardHandManagerModule.clearHandToDiscard(cardState, playerKey, getCardHandManagerContext());
    }

    function moveDiscardCardToHandByCardId(cardState, playerKey, cardId, opts) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.moveDiscardCardToHandByCardId !== 'function') {
            throw new Error('[cards.js] CardHandManager.moveDiscardCardToHandByCardId not available');
        }
        return CardHandManagerModule.moveDiscardCardToHandByCardId(cardState, playerKey, cardId, getCardHandManagerContext(), opts);
    }

    /**
     * Get card definition
     * @param {string} cardId
     * @returns {Object|null}
     */
    function getCardDef(cardId) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.getCardDef !== 'function') {
            throw new Error('[cards.js] CardHandManager.getCardDef not available');
        }
        return CardHandManagerModule.getCardDef(cardId, getCardHandManagerContext());
    }

    /**
     * Get card type
     * @param {string} cardId
     * @returns {string|null}
     */
    function getCardType(cardId) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.getCardType !== 'function') {
            throw new Error('[cards.js] CardHandManager.getCardType not available');
        }
        return CardHandManagerModule.getCardType(cardId, getCardHandManagerContext());
    }

    function getCardDisplayName(cardId) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.getCardDisplayName !== 'function') {
            throw new Error('[cards.js] CardHandManager.getCardDisplayName not available');
        }
        return CardHandManagerModule.getCardDisplayName(cardId, getCardHandManagerContext());
    }

    function getCardCodeName(displayName) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.getCardCodeName !== 'function') {
            throw new Error('[cards.js] CardHandManager.getCardCodeName not available');
        }
        return CardHandManagerModule.getCardCodeName(displayName, getCardHandManagerContext());
    }

    /**
     * Get card cost
     * @param {string} cardId
     * @returns {number}
     */
    function getCardCost(cardId) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.getCardCost !== 'function') {
            throw new Error('[cards.js] CardHandManager.getCardCost not available');
        }
        return CardHandManagerModule.getCardCost(cardId, getCardHandManagerContext());
    }

    function getCardDefByType(cardType) {
        const normalizedType = String(cardType || '');
        if (!normalizedType) return null;
        for (const cardDef of CARD_DEFS || []) {
            if (cardDef && cardDef.type === normalizedType) return cardDef;
        }
        return null;
    }

    function getCardIdByType(cardType) {
        const cardDef = getCardDefByType(cardType);
        return cardDef && cardDef.id ? cardDef.id : null;
    }

    function resolveCaptureSourceTypeFromMarkerData(markerData) {
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
        return specialType ? (CAPTURE_SOURCE_CARD_TYPE_BY_SPECIAL_TYPE[specialType] || null) : null;
    }

    function resolveCaptureSourceInfo(markerEntry) {
        const marker = markerEntry && markerEntry.marker ? markerEntry.marker : null;
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

    function attachMarkerOriginIfNeeded(cardState, kind, owner, data) {
        const normalizedKind = String(kind || '');
        const markerData = (data && typeof data === 'object') ? { ...data } : {};
        const isSpecialMarker =
            normalizedKind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') ||
            normalizedKind === (MARKER_CATEGORIES ? MARKER_CATEGORIES.BOMB : 'bomb') ||
            typeof markerData.type === 'string';
        if (!isSpecialMarker || !markerData.type) return markerData;
        if (markerData.sourceType && markerData.sourceCardId) return markerData;

        const pending = readCardPendingEffect(cardState, owner);
        const pendingType = pending && typeof pending.type === 'string' ? pending.type : null;
        if (!markerData.sourceType && pendingType) {
            markerData.sourceType = pendingType;
        }
        if (!markerData.sourceCardId && markerData.sourceType) {
            markerData.sourceCardId = getCardIdByType(markerData.sourceType);
        }
        return markerData;
    }

    /**
     * Check if card can be used
     * @param {Object} cardState
     * @param {string} playerKey
     * @param {string} cardId
     * @returns {boolean}
     */
    function canUseCard(cardState, playerKey, cardId) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.canUseCard !== 'function') {
            throw new Error('[cards.js] CardHandManager.canUseCard not available');
        }
        return CardHandManagerModule.canUseCard(cardState, playerKey, cardId, getCardHandManagerContext());
    }

    function resolveCoreLogicForCards() {
        if (typeof require === 'function') {
            try {
                return require('./core');
            } catch (e) {
                // fall through
            }
        }
        try {
            if (typeof CoreLogic !== 'undefined' && CoreLogic) return CoreLogic;
        } catch (e) { /* ignore */ }
        try {
            if (typeof Core !== 'undefined' && Core) return Core;
        } catch (e) { /* ignore */ }
        return null;
    }

    function hasStandardLegalMoveForPlayer(cardState, gameState, playerKey) {
        if (!gameState || !Array.isArray(gameState.board)) return false;

        const core = resolveCoreLogicForCards();
        const playerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const context = getCardContext(cardState);

        if (core && typeof core.hasLegalMove === 'function') {
            try {
                return !!core.hasLegalMove(gameState, playerVal, context);
            } catch (e) {
                // fall through
            }
        }

        if (core && typeof core.getLegalMoves === 'function') {
            try {
                const legal = core.getLegalMoves(gameState, playerVal, context);
                return Array.isArray(legal) && legal.length > 0;
            } catch (e) {
                // fall through
            }
        }

        if (core && typeof core.getFlipsWithContext === 'function') {
            try {
                for (let row = 0; row < 8; row++) {
                    for (let col = 0; col < 8; col++) {
                        if (getCellValueForCard(gameState, row, col) !== EMPTY) continue;
                        if (isBlockedCell(cardState, row, col, gameState)) continue;
                        const flips = core.getFlipsWithContext(gameState, row, col, playerVal, context);
                        if (Array.isArray(flips) && flips.length > 0) return true;
                    }
                }
                const expansions = getExpansionDescriptorsForCard(gameState);
                for (const expansion of expansions) {
                    if (!expansion || !Number.isInteger(expansion.row) || !Number.isInteger(expansion.col)) continue;
                    if (getCellValueForCard(gameState, expansion.row, expansion.col) !== EMPTY) continue;
                    if (isBlockedCell(cardState, expansion.row, expansion.col, gameState)) continue;
                    const flips = core.getFlipsWithContext(gameState, expansion.row, expansion.col, playerVal, context);
                    if (Array.isArray(flips) && flips.length > 0) return true;
                }
            } catch (e) {
                return false;
            }
        }

        return false;
    }

    function countDiscsForCardComparison(gameState) {
        const fallback = { black: 0, white: 0 };
        if (!gameState || !Array.isArray(gameState.board)) return fallback;

        const core = resolveCoreLogicForCards();
        if (core && typeof core.countDiscs === 'function') {
            try {
                const counted = core.countDiscs(gameState);
                if (
                    counted &&
                    Number.isFinite(Number(counted.black)) &&
                    Number.isFinite(Number(counted.white))
                ) {
                    return {
                        black: Number(counted.black),
                        white: Number(counted.white)
                    };
                }
            } catch (e) {
                // fall through
            }
        }

        let black = 0;
        let white = 0;
        for (let row = 0; row < gameState.board.length; row++) {
            const line = Array.isArray(gameState.board[row]) ? gameState.board[row] : [];
            for (let col = 0; col < line.length; col++) {
                if (line[col] === BLACK) black += 1;
                else if (line[col] === WHITE) white += 1;
            }
        }

        const expansions = getExpansionDescriptorsForCard(gameState);
        for (const expansion of expansions) {
            if (!expansion) continue;
            if (expansion.owner === BLACK) black += 1;
            else if (expansion.owner === WHITE) white += 1;
        }

        return { black, white };
    }

    function getDiscDisadvantageForPlayer(gameState, playerKey) {
        const counts = countDiscsForCardComparison(gameState);
        if (playerKey === 'white') return counts.black - counts.white;
        return counts.white - counts.black;
    }

    function getEqualityWillBoardCounts(gameState) {
        return countDiscsForCardComparison(gameState);
    }

    function hasFewerDiscsThanOpponentForPlayer(gameState, playerKey) {
        return getDiscDisadvantageForPlayer(gameState, playerKey) > 0;
    }

    function canUseLastResortForPlayer(cardState, gameState, playerKey) {
        if (!gameState || !Array.isArray(gameState.board)) return false;
        if (hasStandardLegalMoveForPlayer(cardState, gameState, playerKey)) return false;
        return hasFewerDiscsThanOpponentForPlayer(gameState, playerKey);
    }

    function canUseEqualityWillForPlayer(cardState, gameState, playerKey) {
        void cardState;
        if (!gameState || !Array.isArray(gameState.board)) return false;
        return getDiscDisadvantageForPlayer(gameState, playerKey) >= 10;
    }

    function _ensureHandDestroyFlags(cardState) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.ensureHandDestroyFlags !== 'function') {
            throw new Error('[cards.js] CardHandManager.ensureHandDestroyFlags not available');
        }
        return CardHandManagerModule.ensureHandDestroyFlags(cardState, getCardHandManagerContext());
    }

    function destroyHandCard(cardState, playerKey, cardId, opts) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.destroyHandCard !== 'function') {
            throw new Error('[cards.js] CardHandManager.destroyHandCard not available');
        }
        return CardHandManagerModule.destroyHandCard(cardState, playerKey, cardId, opts, getCardHandManagerContext());
    }

    /**
     * Get list of usable card ids for current state (including target availability).
     * @param {Object} cardState
     * @param {Object} gameState
     * @param {string} playerKey
     * @returns {string[]}
     */
    function getUsableCardIds(cardState, gameState, playerKey, opts) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.getUsableCardIds !== 'function') {
            throw new Error('[cards.js] CardHandManager.getUsableCardIds not available');
        }
        return CardHandManagerModule.getUsableCardIds(cardState, gameState, playerKey, getCardHandManagerContext(), opts);
    }

    /**
     * Check if player has any usable card right now.
     * @param {Object} cardState
     * @param {Object} gameState
     * @param {string} playerKey
     * @returns {boolean}
     */
    function hasUsableCard(cardState, gameState, playerKey) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.hasUsableCard !== 'function') {
            throw new Error('[cards.js] CardHandManager.hasUsableCard not available');
        }
        return CardHandManagerModule.hasUsableCard(cardState, gameState, playerKey, getCardHandManagerContext());
    }

    function createDeterministicRandomSource(seedText) {
        const text = String(seedText || '');
        let state = 2166136261 >>> 0;
        for (let i = 0; i < text.length; i++) {
            state ^= text.charCodeAt(i);
            state = Math.imul(state, 16777619) >>> 0;
        }
        return {
            random: function () {
                state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
                return state / 0x100000000;
            }
        };
    }

    function buildHeavenBlessingOffers(cardIdToExclude, prng, seedHint) {
        const pool = (CARD_DEFS || [])
            .filter(c => c && c.enabled !== false && c.id && c.id !== cardIdToExclude)
            .map(c => c.id);
        if (pool.length === 0) return [];

        const randomSource = (prng && typeof prng.random === 'function')
            ? prng
            : createDeterministicRandomSource(`heaven:${String(cardIdToExclude || '')}:${String(seedHint || '')}:${pool.length}`);
        const out = [];
        while (pool.length > 0 && out.length < HEAVEN_BLESSING_OFFER_COUNT) {
            const idx = Math.floor(randomSource.random() * pool.length);
            out.push(pool[idx]);
            pool.splice(idx, 1);
        }
        return out;
    }

    function buildCondemnOffers(cardState, playerKey) {
        if (!cardState || !cardState.hands) return [];
        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        const hand = Array.isArray(cardState.hands[opponentKey]) ? cardState.hands[opponentKey] : [];
        return hand.map((cardId, handIndex) => ({ handIndex, cardId }));
    }

    /**
     * Apply card usage (Remove from hand, consume charge, set pending effect)
     * @param {Object} cardState
     * @param {string} playerKey
     * @param {string} cardId
     * @returns {boolean} success
     */
    function applyCardUsage(cardState, playerKey, cardId) {
        // Backward-compatible signature: (cardState, gameState, playerKey, cardId)
        // Detect if gameState is provided as 2nd argument.
        let gameState = null;
        let handOwnerKey = arguments[3];
        let opts = arguments[4];
        if (typeof playerKey === 'object' && playerKey && typeof cardId === 'string') {
            gameState = playerKey;
            playerKey = arguments[2];
            cardId = arguments[3];
            handOwnerKey = arguments[4];
            opts = arguments[5];
        }

        const chargeOwnerKey = playerKey;
        const handKey = (typeof handOwnerKey === 'string' && handOwnerKey) ? handOwnerKey : playerKey;

        const idx = cardState.hands[handKey].indexOf(cardId);
        if (idx === -1) return false;

        const cost = getCardCost(cardId);
        if (!(opts && opts.ignoreCost)) {
            if (cardState.charge[chargeOwnerKey] < cost) return false;
        }

        // Set pending effect (pre-checks must happen before mutating state)
        const cardType = getCardType(cardId);
        const heavenSeedHint = `${chargeOwnerKey}|${cardState.turnIndex || 0}|${(cardState.hands && Array.isArray(cardState.hands[chargeOwnerKey])) ? cardState.hands[chargeOwnerKey].length : 0}|${(cardState.charge && Number.isFinite(cardState.charge[chargeOwnerKey])) ? cardState.charge[chargeOwnerKey] : 0}`;
        const usagePrecheck = CardUsagePrechecksModule && typeof CardUsagePrechecksModule.validateCardUsagePreconditions === 'function'
            ? CardUsagePrechecksModule.validateCardUsagePreconditions({
                cardType,
                cardId,
                cardState,
                gameState,
                playerKey: chargeOwnerKey,
                handKey,
                turnIndex: cardState.turnIndex,
                riboUnlockTurnIndex: RIBO_WILL_UNLOCK_TURN_INDEX,
                prng: opts && opts.prng,
                heavenSeedHint,
                hasStandardLegalMoveForPlayer,
                canUseLastResortForPlayer,
                canUseEqualityWillForPlayer,
                canUseTimeStopGodForPlayer,
                countOpponentOccupiedCornersForPlayer,
                buildHeavenBlessingOffers,
                buildCondemnOffers,
                getTemptWillTargets,
                getCaptureWillTargets,
                getStrongWindTargets,
                getSuperBuoyancyTargets,
                getSuperGravityTargets,
                getTrapTargets,
                getGuardTargets,
                getHyperactiveInheritTargets,
                getExtendLifeTargets,
                getCorrosionTargets,
                getTimeBombTargets,
                getTeleportTargets,
                getCellTeleportTargets,
                getCloneTargets,
                getSplitTargets,
                getPositionSwapTargets: (nextCardState, nextGameState, nextPlayerKey) => getSelectableTargets({
                    ...nextCardState,
                    pendingEffectByPlayer: {
                        ...(nextCardState.pendingEffectByPlayer || { black: null, white: null }),
                        [nextPlayerKey]: { type: 'POSITION_SWAP_WILL', stage: 'selectTarget' }
                    }
                }, nextGameState, nextPlayerKey),
                getBoardExpansionTargets,
                getBoardExpansionGodTargets,
                getBlockadeTargets,
                getMeteorTargets,
                getFreezeTargets,
                getTimeStopGodDestroyableCount,
                timeStopGodSelfDestroyCount: TIME_STOP_GOD_SELF_DESTROY_COUNT,
                getLossWillRemovableCount,
                getSalvationWillTargetCount
            })
            : null;
        if (!usagePrecheck || usagePrecheck.ok !== true) return false;
        const heavenOffers = Array.isArray(usagePrecheck.heavenOffers) ? usagePrecheck.heavenOffers : null;
        const condemnOffers = Array.isArray(usagePrecheck.condemnOffers) ? usagePrecheck.condemnOffers : null;

        let removedCard = null;
        if (!(opts && opts.noConsume)) {
            removedCard = removeHandCardAt(cardState, handKey, idx);
            if (!removedCard || removedCard.cardId !== cardId) return false;
            addCardToDiscard(cardState, removedCard.cardId, removedCard.cardCopyId);
            // Consume charge
            addChargeValue(cardState, chargeOwnerKey, -cost, 'card_use_cost');
            // Set used flag
            cardState.hasUsedCardThisTurnByPlayer[chargeOwnerKey] = true;
            cardState.cardUseCountByPlayer = cardState.cardUseCountByPlayer || { black: 0, white: 0 };
            cardState.cardUseCountByPlayer[chargeOwnerKey] = (cardState.cardUseCountByPlayer[chargeOwnerKey] || 0) + 1;
        }
        cardState.lastUsedCardByPlayer[chargeOwnerKey] = cardId;

        const pendingOffers = heavenOffers || condemnOffers || undefined;
        const needsSelection =
            CardPendingStateManagerModule && typeof CardPendingStateManagerModule.requiresTargetSelection === 'function'
                ? CardPendingStateManagerModule.requiresTargetSelection(cardType)
                : (
                    cardType === 'DESTROY_ONE_STONE' ||
                    cardType === 'STRONG_WIND_WILL' ||
                    cardType === 'SUPER_BUOYANCY_WILL' ||
                    cardType === 'SUPER_GRAVITY_WILL' ||
                    cardType === 'SELL_CARD_WILL' ||
                    cardType === 'HEAVEN_BLESSING' ||
                    cardType === 'CONDEMN_WILL' ||
                    cardType === 'SWAP_WITH_ENEMY' ||
                    cardType === 'POSITION_SWAP_WILL' ||
                    cardType === 'TRAP_WILL' ||
                    cardType === 'TEMPT_WILL' ||
                    cardType === 'CAPTURE_WILL' ||
                    cardType === 'GUARD_WILL' ||
                    cardType === 'GUARDIAN_GOD' ||
                    cardType === 'HYPERACTIVE_INHERIT_WILL' ||
                    cardType === 'EXTEND_LIFE_WILL' ||
                    cardType === 'EXTEND_LIFE_GOD' ||
                    cardType === 'CORROSION_WILL' ||
                    cardType === 'TIME_BOMB' ||
                    cardType === 'TELEPORT_WILL' ||
                    cardType === 'CELL_TELEPORT_WILL' ||
                    cardType === 'CLONE_WILL' ||
                    cardType === 'SPLIT_WILL' ||
                    cardType === 'BOARD_EXPANSION_WILL' ||
                    cardType === 'BOARD_EXPANSION_GOD' ||
                    cardType === 'BLOCKADE_WILL' ||
                    cardType === 'METEOR_WILL' ||
                    cardType === 'FREEZE_WILL'
                );
        writeCardPendingEffect(
            cardState,
            chargeOwnerKey,
            CardPendingStateManagerModule && typeof CardPendingStateManagerModule.createPendingEffectState === 'function'
                ? CardPendingStateManagerModule.createPendingEffectState({
                    cardType,
                    cardId,
                    sourceHandIndex: removedCard ? removedCard.handIndex : undefined,
                    needsSelection,
                    offers: pendingOffers
                })
                : {
                    type: cardType,
                    cardId,
                    sourceHandIndex: removedCard ? removedCard.handIndex : undefined,
                    stage: needsSelection ? 'selectTarget' : null,
                    offers: pendingOffers,
                    selectedCount: cardType === 'BOARD_EXPANSION_GOD' ? 0 : undefined,
                    maxSelections: cardType === 'BOARD_EXPANSION_GOD' ? 2 : undefined,
                    selectedTargets: cardType === 'BOARD_EXPANSION_GOD' ? [] : undefined,
                    placementsRemaining: cardType === 'LAST_RESORT' ? 3 : undefined
                }
        );

        if (cardType === 'BOARD_EXPANSION_GOD' && readCardPendingEffect(cardState, chargeOwnerKey)) {
            const boardExpansionGodPending = readCardPendingEffect(cardState, chargeOwnerKey);
            const requiredSelections = getBoardExpansionGodRequiredSelectionCount(cardState, gameState, chargeOwnerKey);
            boardExpansionGodPending.selectedCount = 0;
            boardExpansionGodPending.maxSelections = requiredSelections > 0 ? requiredSelections : 1;
            boardExpansionGodPending.selectedTargets = Array.isArray(boardExpansionGodPending.selectedTargets)
                ? boardExpansionGodPending.selectedTargets
                : [];
        }

        // Special handling for WORK_WILL: arm next placement for this player
        if (cardType === 'WORK_WILL') {
            if (!cardState.workNextPlacementArmedByPlayer) cardState.workNextPlacementArmedByPlayer = { black: false, white: false };
            cardState.workNextPlacementArmedByPlayer[chargeOwnerKey] = true;
            workDebugLog(cardState, '[WORK_DEBUG] Card played: WORK_WILL armed for', chargeOwnerKey);
        }

        const usedCardDef = getCardDef(cardId);

        // Emit a presentation event for card-use transport animation (UI playback).
        try {
            emitPresentationEvent(cardState, {
                type: 'CARD_USED',
                player: chargeOwnerKey,
                cardId: cardId,
                meta: {
                    owner: handKey,
                    cost: Number.isFinite(cost) ? cost : null,
                    name: (usedCardDef && usedCardDef.name) ? usedCardDef.name : null,
                    cardType: (usedCardDef && usedCardDef.type) ? usedCardDef.type : null
                }
            });
        } catch (e) { /* ignore presentation emission failures */ }

        addGeneratedThrowChainCard(cardState, handKey, cardId, cardType);
        addGeneratedChainWillCard(cardState, handKey, cardId, cardType);

        return true;
    }

    /**
     * Cancel a pending selection card (refund + return card to hand).
     * @param {Object} cardState
     * @param {string} playerKey
     * @param {Object} [opts] - { refundCost?: boolean, resetUsage?: boolean, noConsume?: boolean }
     * @returns {{canceled: boolean, reason?: string, cardId?: string}}
     */
    function cancelPendingSelection(cardState, playerKey, opts) {
        if (CardPendingStateManagerModule && typeof CardPendingStateManagerModule.cancelPendingSelection === 'function') {
            const result = CardPendingStateManagerModule.cancelPendingSelection(cardState, playerKey, opts, {
                helpers: {
                    getCardDef,
                    addChargeValue,
                    moveDiscardCardToHandByCardId
                }
            });
            if (result && result.canceled) {
                clearCardPendingEffect(cardState, playerKey);
            }
            return result;
        }
        if (!cardState || !cardState.pendingEffectByPlayer) return { canceled: false, reason: 'no_state' };
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.stage !== 'selectTarget') return { canceled: false, reason: 'not_pending' };
        if (pending.type !== 'DESTROY_ONE_STONE' && pending.type !== 'POSITION_SWAP_WILL' && pending.type !== 'BOARD_EXPANSION_WILL' && pending.type !== 'BOARD_EXPANSION_GOD' && pending.type !== 'BLOCKADE_WILL' && pending.type !== 'METEOR_WILL' && pending.type !== 'FREEZE_WILL') {
            return { canceled: false, reason: 'not_cancellable' };
        }

        const cardId = pending.cardId;
        const cardDef = cardId ? getCardDef(cardId) : null;
        const cost = cardDef ? cardDef.cost : 0;
        const refundCost = !(opts && opts.refundCost === false);
        const resetUsage = !(opts && opts.resetUsage === false);
        const noConsume = !!(opts && opts.noConsume);

        if (refundCost && !noConsume) {
            addChargeValue(cardState, playerKey, cost, 'card_cancel_refund');
        }
        if (resetUsage && !noConsume) {
            cardState.hasUsedCardThisTurnByPlayer[playerKey] = false;
        }
        if (!noConsume) {
            cardState.cardUseCountByPlayer = cardState.cardUseCountByPlayer || { black: 0, white: 0 };
            cardState.cardUseCountByPlayer[playerKey] = Math.max(0, (cardState.cardUseCountByPlayer[playerKey] || 0) - 1);
        }

        if (cardId) {
            const handKey = cardState.hands[playerKey] ? playerKey : 'black';
            moveDiscardCardToHandByCardId(cardState, handKey, cardId, { ignoreHandLimit: true });
        }

        clearCardPendingEffect(cardState, playerKey);
        return { canceled: true, cardId };
    }

    function getSpecialMarkerAt(cardState, row, col) {
        if (CardMarkersModule && typeof CardMarkersModule.getSpecialMarkerAt === 'function') {
            return CardMarkersModule.getSpecialMarkerAt(cardState, row, col);
        }
        if (CardUtilsModule && typeof CardUtilsModule.getSpecialMarkerAt === 'function') {
            return CardUtilsModule.getSpecialMarkerAt(cardState, row, col);
        }
        const special = findSpecialMarkerAt(cardState, row, col);
        if (special) return { kind: 'specialStone', marker: special };
        const bomb = findBombMarkerAt(cardState, row, col);
        if (bomb) return { kind: 'specialStone', category: MARKER_CATEGORIES.BOMB, marker: bomb };
        return null;
    }

    function isSpecialStoneAt(cardState, row, col) {
        if (CardUtilsModule && typeof CardUtilsModule.isSpecialStoneAt === 'function') {
            return CardUtilsModule.isSpecialStoneAt(cardState, row, col);
        }
        return !!getSpecialMarkerAt(cardState, row, col);
    }

    function getSpecialOwnerAt(cardState, row, col) {
        if (CardUtilsModule && typeof CardUtilsModule.getSpecialOwnerAt === 'function') {
            return CardUtilsModule.getSpecialOwnerAt(cardState, row, col);
        }
        const entry = getSpecialMarkerAt(cardState, row, col);
        if (!entry) return null;
        return entry.marker && entry.marker.owner ? entry.marker.owner : null;
    }

    function getTemptWillTargets(cardState, gameState, playerKey) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardTargets)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/targets') : globalThis.CardTargets;
                if (mod && typeof mod.getTemptWillTargets === 'function') {
                    return mod.getTemptWillTargets(cardState, gameState, playerKey);
                }
            } catch (e) {
                // fall through to local implementation
            }
        }
        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        const res = [];
        const hasGuardMarkerAt = (row, col) => getSpecialMarkers(cardState).some(m => (
            m &&
            m.row === row &&
            m.col === col &&
            m.data &&
            m.data.type === 'GUARD'
        ));
        for (const cell of getOccupiedBoardShapeCellsForCard(cardState, gameState)) {
            const row = cell.row;
            const col = cell.col;
            if (hasGuardMarkerAt(row, col)) continue;
            if (!isSpecialStoneAt(cardState, row, col)) continue;
            if (getSpecialOwnerAt(cardState, row, col) !== opponentKey) continue;
            if (getCellValueForCard(gameState, row, col) === EMPTY) continue;
            res.push({ row, col });
        }
        return res;
    }

    function getCaptureWillTargets(cardState, gameState, playerKey) {
        const targets = getTemptWillTargets(cardState, gameState, playerKey);
        return targets.filter((target) => !!resolveCaptureSourceInfo(getSpecialMarkerAt(cardState, target.row, target.col)));
    }

    function getTrapTargets(cardState, gameState, playerKey) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardSelectors)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/selectors') : globalThis.CardSelectors;
                if (mod && typeof mod.getTrapTargets === 'function') {
                    return mod.getTrapTargets(cardState, gameState, playerKey);
                }
            } catch (e) {
                // fall through to local implementation
            }
        }
        const P_BLACK = BLACK || 1;
        const P_WHITE = WHITE || -1;
        const playerVal = playerKey === 'black' ? P_BLACK : P_WHITE;
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const res = [];
        for (const cell of getOccupiedBoardShapeCellsForCard(cardState, gameState)) {
            const row = cell.row;
            const col = cell.col;
            if (getCellValueForCard(gameState, row, col) !== playerVal) continue;
            const hasBomb = markers.some(m => m && m.row === row && m.col === col && isBombCategoryMarker(m));
            if (hasBomb) continue;
            if (isAbsoluteProtectedCell(cardState, row, col)) continue;
            const hasOwnTrap = markers.some(m => (
                m &&
                m.row === row &&
                m.col === col &&
                m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') &&
                m.owner === playerKey &&
                m.data &&
                m.data.type === 'TRAP'
            ));
            if (hasOwnTrap) continue;
            res.push({ row, col });
        }
        return res;
    }

    function getGuardTargets(cardState, gameState, playerKey) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardSelectors)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/selectors') : globalThis.CardSelectors;
                if (mod && typeof mod.getGuardTargets === 'function') {
                    return mod.getGuardTargets(cardState, gameState, playerKey);
                }
            } catch (e) {
                // fall through to local implementation
            }
        }
        const P_BLACK = BLACK || 1;
        const P_WHITE = WHITE || -1;
        const playerVal = playerKey === 'black' ? P_BLACK : P_WHITE;
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const res = [];
        for (const cell of getOccupiedBoardShapeCellsForCard(cardState, gameState)) {
            const row = cell.row;
            const col = cell.col;
            if (getCellValueForCard(gameState, row, col) !== playerVal) continue;
            const hasBomb = markers.some(m => m && m.row === row && m.col === col && isBombCategoryMarker(m));
            if (hasBomb) continue;
            if (isAbsoluteProtectedCell(cardState, row, col)) continue;
            res.push({ row, col });
        }
        return res;
    }

    function getHyperactiveInheritTargets(cardState, gameState, playerKey) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardSelectors)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/selectors') : globalThis.CardSelectors;
                if (mod && typeof mod.getHyperactiveInheritTargets === 'function') {
                    return mod.getHyperactiveInheritTargets(cardState, gameState, playerKey);
                }
            } catch (e) {
                // fall through to local implementation
            }
        }
        return getGuardTargets(cardState, gameState, playerKey);
    }

    // Return targets: only your own special stones that have a numeric remainingOwnerTurns > 0
    function getExtendLifeTargets(cardState, gameState, playerKey) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardSelectors)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/selectors') : globalThis.CardSelectors;
                if (mod && typeof mod.getExtendLifeTargets === 'function') {
                    return mod.getExtendLifeTargets(cardState, gameState, playerKey);
                }
            } catch (e) {
                // fall through
            }
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const res = [];
        for (const m of markers) {
            if (!m || m.kind !== (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone')) continue;
            if (m.owner !== playerKey) continue;
            const rem = (m.data && Number.isFinite(m.data.remainingOwnerTurns)) ? Number(m.data.remainingOwnerTurns) : null;
            if (!Number.isFinite(rem) || rem <= 0) continue;
            res.push({ row: m.row, col: m.col });
        }
        return res;
    }

    // Return targets: all timed special stones that have a numeric remainingOwnerTurns > 0
    function getCorrosionTargets(cardState, gameState, playerKey) {
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const res = [];
        for (const m of markers) {
            if (!m || m.kind !== (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone')) continue;
            const rem = (m.data && Number.isFinite(m.data.remainingOwnerTurns)) ? Number(m.data.remainingOwnerTurns) : null;
            if (!Number.isFinite(rem) || rem <= 0) continue;
            res.push({ row: m.row, col: m.col });
        }
        return res;
    }

    function getTimeBombTargets(cardState, gameState, playerKey) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardSelectors)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/selectors') : globalThis.CardSelectors;
                if (mod && typeof mod.getTimeBombTargets === 'function') {
                    return mod.getTimeBombTargets(cardState, gameState, playerKey);
                }
            } catch (e) {
                // fall through to local implementation
            }
        }
        return getGuardTargets(cardState, gameState, playerKey);
    }

    function getTeleportTargets(cardState, gameState) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardSelectors)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/selectors') : globalThis.CardSelectors;
                if (mod && typeof mod.getTeleportTargets === 'function') {
                    return mod.getTeleportTargets(cardState, gameState);
                }
            } catch (e) {
                // fall through to local implementation
            }
        }

        const destinations = getEmptyBoardShapeCellsForCard(cardState, gameState)
            .filter((cell) => !isBlockedCell(cardState, cell.row, cell.col, gameState));
        const hasDestination = destinations.length > 0;
        if (!hasDestination) return [];

        return getOccupiedBoardShapeCellsForCard(cardState, gameState)
            .filter((cell) => !isAbsoluteProtectedCell(cardState, cell.row, cell.col));
    }

    function getCloneTargets(cardState, gameState, playerKey) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardSelectors)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/selectors') : globalThis.CardSelectors;
                if (mod && typeof mod.getCloneTargets === 'function') {
                    return mod.getCloneTargets(cardState, gameState, playerKey);
                }
            } catch (e) {
                // fall through to local implementation
            }
        }

        const playerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const res = [];
        for (const cell of getOccupiedBoardShapeCellsForCard(cardState, gameState)) {
            if (getCellValueForCard(gameState, cell.row, cell.col) !== playerVal) continue;
            if (collectEmptyNeighborCellsForCard(cardState, gameState, cell.row, cell.col).length === 0) continue;
            res.push({ row: cell.row, col: cell.col });
        }

        return res;
    }

    function getSplitTargets(cardState, gameState, playerKey) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardSelectors)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/selectors') : globalThis.CardSelectors;
                if (mod && typeof mod.getSplitTargets === 'function') {
                    return mod.getSplitTargets(cardState, gameState, playerKey);
                }
            } catch (e) {
                // fall through to local implementation
            }
        }

        return getCloneTargets(cardState, gameState, playerKey);
    }

    function getBoardExpansionTargets(cardState, gameState, playerKey) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardSelectors)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/selectors') : globalThis.CardSelectors;
                if (mod && typeof mod.getBoardExpansionTargets === 'function') {
                    return mod.getBoardExpansionTargets(cardState, gameState, playerKey);
                }
            } catch (e) {
                // fall through to local implementation
            }
        }

        if (!gameState || !gameState.board || gameState.board.length !== 8) return [];

        const blockedEdgeTargets = new Set();
        const expansionCells = getExpansionDescriptorsForCard(gameState);
        for (const cell of expansionCells) {
            if (!cell) continue;
            if (cell.col === -1 && Number.isInteger(cell.row) && cell.row >= 0 && cell.row < 8) {
                blockedEdgeTargets.add(`${cell.row},0`);
            }
            if (cell.col === 8 && Number.isInteger(cell.row) && cell.row >= 0 && cell.row < 8) {
                blockedEdgeTargets.add(`${cell.row},7`);
            }
        }

        const res = [];
        for (let r = 0; r < 8; r++) {
            if (!blockedEdgeTargets.has(`${r},0`)) {
                res.push({ row: r, col: 0, side: 'left' });
            }
            if (!blockedEdgeTargets.has(`${r},7`)) {
                res.push({ row: r, col: 7, side: 'right' });
            }
        }
        return res;
    }

    function getBoardExpansionGodCornerDescriptorsForCard() {
        if (CardExpansionModule && typeof CardExpansionModule.getBoardExpansionGodCornerDescriptorsForCard === 'function') {
            return CardExpansionModule.getBoardExpansionGodCornerDescriptorsForCard();
        }
        return [];
    }

    function getBoardExpansionGodPendingSelectionsForCard(pending) {
        if (CardExpansionModule && typeof CardExpansionModule.getBoardExpansionGodPendingSelectionsForCard === 'function') {
            return CardExpansionModule.getBoardExpansionGodPendingSelectionsForCard(pending);
        }
        return [];
    }

    function getBoardExpansionGodAdditionsForCard(row, col) {
        if (CardExpansionModule && typeof CardExpansionModule.getBoardExpansionGodAdditionsForCard === 'function') {
            return CardExpansionModule.getBoardExpansionGodAdditionsForCard(row, col);
        }
        return null;
    }

    function getBoardExpansionWillCellDescriptorsForCard() {
        if (CardExpansionModule && typeof CardExpansionModule.getBoardExpansionWillCellDescriptorsForCard === 'function') {
            return CardExpansionModule.getBoardExpansionWillCellDescriptorsForCard();
        }
        return [];
    }

    function ensureExpansionCellForCard(gameState, row, col, owner) {
        if (CardExpansionModule && typeof CardExpansionModule.ensureExpansionCellForCard === 'function') {
            return CardExpansionModule.ensureExpansionCellForCard(gameState, row, col, owner);
        }
        return false;
    }

    function getBoardExpansionGodTargets(cardState, gameState, playerKey) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardSelectors)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/selectors') : globalThis.CardSelectors;
                if (mod && typeof mod.getBoardExpansionGodTargets === 'function') {
                    return mod.getBoardExpansionGodTargets(cardState, gameState, playerKey);
                }
            } catch (e) {
                // fall through to local implementation
            }
        }

        if (!gameState || !gameState.board || gameState.board.length !== 8) return [];

        const occupied = new Set(
            getExpansionDescriptorsForCard(gameState).map((cell) => `${cell.row},${cell.col}`)
        );
        const pending = readCardPendingEffect(cardState, playerKey);
        const selectedKeys = new Set(
            getBoardExpansionGodPendingSelectionsForCard(pending).map((target) => `${target.row},${target.col}`)
        );

        const res = [];
        for (const corner of getBoardExpansionGodCornerDescriptorsForCard()) {
            if (!corner || !Array.isArray(corner.cells)) continue;
            if (selectedKeys.has(`${corner.row},${corner.col}`)) continue;
            const hasOccupied = corner.cells.some((cell) => occupied.has(`${cell.row},${cell.col}`));
            if (hasOccupied) continue;
            res.push({ row: corner.row, col: corner.col });
        }
        return res;
    }

    function getBoardExpansionGodRequiredSelectionCount(cardState, gameState, playerKey) {
        const pending = readCardPendingEffect(cardState, playerKey);
        const selectedCount = getBoardExpansionGodPendingSelectionsForCard(pending).length;
        const availableCount = getBoardExpansionGodTargets(cardState, gameState, playerKey).length;
        const totalSelectableCount = selectedCount + availableCount;
        if (totalSelectableCount <= 0) return 0;
        return Math.min(2, totalSelectableCount);
    }

    function getCellTeleportDestinations(cardState, gameState) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardSelectors)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/selectors') : globalThis.CardSelectors;
                if (mod && typeof mod.getCellTeleportDestinations === 'function') {
                    return mod.getCellTeleportDestinations(cardState, gameState);
                }
            } catch (e) {
                // fall through to local implementation
            }
        }

        if (!gameState || !gameState.board || gameState.board.length !== 8) return [];

        const activeByKey = new Map();
        for (const cell of getExpansionDescriptorsForCard(gameState)) {
            if (!cell) continue;
            activeByKey.set(`${cell.row},${cell.col}`, cell);
        }

        const res = [];
        const seen = new Set();
        const pushCandidate = (row, col, side) => {
            const key = `${row},${col}`;
            if (seen.has(key)) return;
            seen.add(key);
            const activeCell = activeByKey.get(key) || null;
            const owner = activeCell ? normalizeExpansionOwnerForCard(activeCell.owner) : EMPTY;
            if (owner !== EMPTY) return;
            if (isBlockedCell(cardState, row, col, gameState)) return;
            res.push({ row, col, side: resolveExpansionSideForCard(side, row, col), active: !!activeCell });
        };

        for (const cell of getBoardExpansionWillCellDescriptorsForCard()) {
            if (!cell) continue;
            pushCandidate(cell.row, cell.col, cell.side);
        }
        for (const corner of getBoardExpansionGodCornerDescriptorsForCard()) {
            if (!corner || !Array.isArray(corner.cells)) continue;
            for (const cell of corner.cells) {
                if (!cell) continue;
                pushCandidate(cell.row, cell.col, resolveExpansionSideForCard(null, cell.row, cell.col));
            }
        }

        return res;
    }

    function getCellTeleportTargets(cardState, gameState) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardSelectors)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/selectors') : globalThis.CardSelectors;
                if (mod && typeof mod.getCellTeleportTargets === 'function') {
                    return mod.getCellTeleportTargets(cardState, gameState);
                }
            } catch (e) {
                // fall through to local implementation
            }
        }

        const destinations = getCellTeleportDestinations(cardState, gameState);
        if (!destinations.length) return [];

        const res = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (gameState.board[r][c] === EMPTY) continue;
                res.push({ row: r, col: c });
            }
        }

        const expansionCells = getExpansionDescriptorsForCard(gameState);
        for (const cell of expansionCells) {
            if (!cell) continue;
            if (normalizeExpansionOwnerForCard(cell.owner) === EMPTY) continue;
            if (isMeteorHoleCell(cardState, cell.row, cell.col)) continue;
            res.push({ row: cell.row, col: cell.col });
        }
        return res;
    }

    function getBlockadeTargets(cardState, gameState, playerKey) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardSelectors)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/selectors') : globalThis.CardSelectors;
                if (mod && typeof mod.getBlockadeTargets === 'function') {
                    return mod.getBlockadeTargets(cardState, gameState, playerKey);
                }
            } catch (e) {
                // fall through to local implementation
            }
        }

        if (!gameState || !gameState.board || gameState.board.length !== 8) return [];
        const res = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (gameState.board[r][c] !== EMPTY) continue;
                if (isBlockedCell(cardState, r, c, gameState)) continue;
                res.push({ row: r, col: c });
            }
        }
        const expansionCells = getExpansionDescriptorsForCard(gameState);
        for (const cell of expansionCells) {
            if (!cell || Number(cell.owner) !== EMPTY) continue;
            if (isBlockedCell(cardState, cell.row, cell.col, gameState)) continue;
            res.push({ row: cell.row, col: cell.col });
        }
        return res;
    }

    function getMeteorTargets(cardState, gameState, playerKey) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardSelectors)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/selectors') : globalThis.CardSelectors;
                if (mod && typeof mod.getMeteorTargets === 'function') {
                    return mod.getMeteorTargets(cardState, gameState, playerKey);
                }
            } catch (e) {
                // fall through to local implementation
            }
        }

        if (!gameState || !gameState.board || gameState.board.length !== 8) return [];
        const res = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (isMeteorHoleCell(cardState, r, c)) continue;
                if (isAbsoluteProtectedCell(cardState, r, c)) continue;
                res.push({ row: r, col: c });
            }
        }
        const expansionCells = getExpansionDescriptorsForCard(gameState);
        for (const cell of expansionCells) {
            if (!cell) continue;
            if (isMeteorHoleCell(cardState, cell.row, cell.col)) continue;
            if (isAbsoluteProtectedCell(cardState, cell.row, cell.col)) continue;
            res.push({ row: cell.row, col: cell.col });
        }
        return res;
    }

    function getFreezeTargets(cardState, gameState, playerKey) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardSelectors)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/selectors') : globalThis.CardSelectors;
                if (mod && typeof mod.getFreezeTargets === 'function') {
                    return mod.getFreezeTargets(cardState, gameState, playerKey);
                }
            } catch (e) {
                // fall through to local implementation
            }
        }

        if (!gameState || !gameState.board || gameState.board.length !== 8) return [];
        const res = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (isBlockedCell(cardState, r, c, gameState)) continue;
                res.push({ row: r, col: c });
            }
        }
        const expansionCells = getExpansionDescriptorsForCard(gameState);
        for (const cell of expansionCells) {
            if (!cell) continue;
            if (isBlockedCell(cardState, cell.row, cell.col, gameState)) continue;
            res.push({ row: cell.row, col: cell.col });
        }
        return res;
    }

    function applyTrapWill(cardState, gameState, playerKey, row, col) {
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'TRAP_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }
        const targets = getTrapTargets(cardState, gameState, playerKey);
        const allowed = targets.some(t => t.row === row && t.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };
        if (isAbsoluteProtectedCell(cardState, row, col)) return { applied: false, reason: 'absolute_protected' };

        // Trap replaces any existing special marker at the target cell.
        removeMarkersAt(cardState, row, col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone' });

        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        addMarker(cardState, 'specialStone', row, col, playerKey, {
            type: 'TRAP',
            armedForPlayer: opponentKey,
            hidden: true
        });

        clearCardPendingEffect(cardState, playerKey);
        return { applied: true, row, col };
    }

    function processTrapEffects(cardState, gameState, activePlayerKey, options) {
        const opts = options || {};
        const expireOnOwnerTurnStart = !!opts.expireOnOwnerTurnStart;
        const res = { triggered: [], expired: [], disarmed: [] };
        if (!cardState || !gameState || !gameState.board) return res;

        const P_BLACK = BLACK || 1;
        const P_WHITE = WHITE || -1;
        const specials = getSpecialMarkers(cardState).filter(m => m && m.data && m.data.type === 'TRAP');
        if (!specials.length) return res;

        for (const trap of specials) {
            const row = trap.row;
            const col = trap.col;
            const ownerKey = trap.owner === 'white' ? 'white' : 'black';
            const opponentKey = ownerKey === 'black' ? 'white' : 'black';
            const ownerVal = ownerKey === 'black' ? P_BLACK : P_WHITE;
            const activeVal = activePlayerKey === 'black' ? P_BLACK : P_WHITE;
            const cellVal = getCellValueForCard(gameState, row, col);

            if (cellVal === EMPTY) {
                removeMarkersAt(cardState, row, col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', type: 'TRAP', owner: ownerKey });
                res.disarmed.push({ row, col, owner: ownerKey, reason: 'empty' });
                continue;
            }

            if (cellVal === ownerVal) {
                if (expireOnOwnerTurnStart && activePlayerKey === ownerKey) {
                    // Reveal just before destroy so both sides can read the trap icon at expiry.
                    emitPresentationEvent(cardState, {
                        type: 'STATUS_APPLIED',
                        row,
                        col,
                        meta: { special: 'TRAP_REVEAL', owner: ownerKey, reason: 'trap_expired_reveal' }
                    });
                    if (BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function') {
                        BoardOpsModule.destroyAt(cardState, gameState, row, col, 'TRAP_WILL', 'trap_expired', { special: 'TRAP_REVEAL', owner: ownerKey });
                    } else {
                        setCellValueForCard(gameState, row, col, EMPTY);
                        removeMarkersAt(cardState, row, col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', type: 'TRAP', owner: ownerKey });
                    }
                    res.expired.push({ row, col, owner: ownerKey });
                }
                continue;
            }

            if (activePlayerKey === opponentKey && cellVal === activeVal) {
                const victimKey = opponentKey;
                const victimCharge = Math.max(0, Number(cardState.charge[victimKey] || 0));
                const stolenCharge = Math.min(TRAP_WILL_STEAL_MAX, victimCharge);
                const remainingCharge = Math.max(0, victimCharge - stolenCharge);
                setChargeValue(cardState, victimKey, remainingCharge, 'trap_stolen_charge');
                const gainedCharge = addChargeWithTotal(cardState, ownerKey, stolenCharge);

                const clearResult = clearHandToDiscard(cardState, victimKey);
                const destroyedCards = Array.isArray(clearResult && clearResult.destroyedCards)
                    ? clearResult.destroyedCards
                    : [];
                const destroyedCount = destroyedCards.length;

                removeMarkersAt(cardState, row, col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', type: 'TRAP', owner: ownerKey });
                res.triggered.push({
                    row,
                    col,
                    owner: ownerKey,
                    victim: victimKey,
                    stolenCharge,
                    gainedCharge,
                    stolenHandCount: destroyedCount,
                    destroyedHandCount: destroyedCount,
                    destroyedCardIds: destroyedCards.slice(),
                    toHandCount: 0,
                    toDeckCount: 0
                });
                continue;
            }

            removeMarkersAt(cardState, row, col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', type: 'TRAP', owner: ownerKey });
            res.disarmed.push({ row, col, owner: ownerKey, reason: 'changed_without_trigger' });
        }

        return res;
    }

    function applyTemptWill(cardState, gameState, playerKey, row, col) {
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'TEMPT_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }

        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        if (!isSpecialStoneAt(cardState, row, col)) return { applied: false, reason: 'not_special' };
        if (getSpecialOwnerAt(cardState, row, col) !== opponentKey) return { applied: false, reason: 'not_opponent_special' };
        if (getCellValueForCard(gameState, row, col) === EMPTY) return { applied: false, reason: 'empty' };
        const guarded = getSpecialMarkers(cardState).some(m => (
            m &&
            m.row === row &&
            m.col === col &&
            m.data &&
            m.data.type === 'GUARD'
        ));
        if (guarded) return { applied: false, reason: 'guarded' };
        if (isAbsoluteProtectedCell(cardState, row, col)) return { applied: false, reason: 'absolute_protected' };

        // Use BoardOps.changeAt if available
        if (BoardOpsModule && typeof BoardOpsModule.changeAt === 'function') {
            BoardOpsModule.changeAt(cardState, gameState, row, col, playerKey, 'TEMPT_WILL', 'tempt_applied');
        } else {
            const playerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
            setCellValueForCard(gameState, row, col, playerVal);
        }

        // Transfer ownership metadata while preserving remaining turns/counters.
        const transferResult = transferCellMarkerOwnership(cardState, row, col, playerKey);
        const wasWork = !!(transferResult && transferResult.hadWork);

        // If this was a WORK anchor, STEAL ends the effect immediately.
        if (wasWork) {
            // Clear anchor position for previous owner
            if (cardState.workAnchorPosByPlayer && cardState.workAnchorPosByPlayer[opponentKey]) {
                cardState.workAnchorPosByPlayer[opponentKey] = null;
            }
            // Remove special WORK entries and any unified markers
            removeMarkersAt(cardState, row, col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', type: 'WORK' });
            // Use centralized presentation event emission so action meta is filled consistently
            emitPresentationEvent(cardState, {
                type: 'WORK_REMOVED',
                row,
                col,
                ownerBefore: opponentKey,
                ownerAfter: playerKey,
                cause: 'TEMPT_WILL',
                reason: 'anchor_lost',
                removed: true,
                meta: { reason: 'anchor_lost' }
            });
        }

        clearCardPendingEffect(cardState, playerKey);
        return { applied: true };
    }

    function transferCellMarkerOwnership(cardState, row, col, playerKey) {
        const ownerKey = playerKey === 'white' ? 'white' : 'black';
        const ownerColor = ownerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const markersAtCell = getMarkers(cardState).filter((marker) => (
            marker &&
            marker.row === row &&
            marker.col === col
        ));
        let transferred = false;
        let hadWork = false;

        for (const marker of markersAtCell) {
            transferred = true;
            marker.owner = ownerKey;
            const markerData = (marker.data && typeof marker.data === 'object') ? marker.data : null;
            if (!markerData) continue;
            if (String(markerData.type || '').toUpperCase() === 'WORK') {
                hadWork = true;
            }
            if (Object.prototype.hasOwnProperty.call(markerData, 'expiresForPlayer')) {
                markerData.expiresForPlayer = ownerKey;
            }
            if (Object.prototype.hasOwnProperty.call(markerData, 'ownerColor')) {
                markerData.ownerColor = typeof markerData.ownerColor === 'number'
                    ? ownerColor
                    : ownerKey;
            }
        }

        return { transferred, hadWork };
    }

    function applyCaptureWill(cardState, gameState, playerKey, row, col) {
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'CAPTURE_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }

        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        if (!isSpecialStoneAt(cardState, row, col)) return { applied: false, reason: 'not_special' };
        if (getSpecialOwnerAt(cardState, row, col) !== opponentKey) return { applied: false, reason: 'not_opponent_special' };
        if (getCellValueForCard(gameState, row, col) === EMPTY) return { applied: false, reason: 'empty' };
        const guarded = getSpecialMarkers(cardState).some(m => (
            m &&
            m.row === row &&
            m.col === col &&
            m.data &&
            m.data.type === 'GUARD'
        ));
        if (guarded) return { applied: false, reason: 'guarded' };
        if (isAbsoluteProtectedCell(cardState, row, col)) return { applied: false, reason: 'absolute_protected' };

        const markerEntry = getSpecialMarkerAt(cardState, row, col);
        const captureSource = resolveCaptureSourceInfo(markerEntry);
        if (!captureSource || !captureSource.sourceCardId) {
            return { applied: false, reason: 'missing_source_card' };
        }

        const insertIndex = Number.isInteger(pending.sourceHandIndex)
            ? Math.max(0, pending.sourceHandIndex)
            : ((cardState && cardState.hands && Array.isArray(cardState.hands[playerKey])) ? cardState.hands[playerKey].length : 0);
        const added = addCardToHand(cardState, playerKey, captureSource.sourceCardId, {
            insertIndex,
            ignoreHandLimit: true
        });
        if (!added) return { applied: false, reason: 'hand_add_failed' };

        const stoneId = getStoneIdAtForCard(cardState, gameState, row, col);
        const targetValue = getCellValueForCard(gameState, row, col);
        const ownerBefore = targetValue === (BLACK || 1) ? 'black' : 'white';
        const wasWork = !!(markerEntry && markerEntry.marker && markerEntry.marker.data && markerEntry.marker.data.type === 'WORK');

        clearStoneIdAtForCard(cardState, gameState, row, col);
        setCellValueForCard(gameState, row, col, EMPTY);
        removeMarkersAt(cardState, row, col);

        if (wasWork && cardState.workAnchorPosByPlayer && cardState.workAnchorPosByPlayer[opponentKey]) {
            cardState.workAnchorPosByPlayer[opponentKey] = null;
            emitPresentationEvent(cardState, {
                type: 'WORK_REMOVED',
                row,
                col,
                ownerBefore: opponentKey,
                ownerAfter: playerKey,
                cause: 'CAPTURE_WILL',
                reason: 'captured_to_hand',
                removed: true,
                meta: { reason: 'captured_to_hand' }
            });
        }

        emitPresentationEvent(cardState, {
            type: 'HAND_ADD',
            player: playerKey,
            cardId: captureSource.sourceCardId,
            count: 1,
            reason: 'capture_will',
            meta: {
                owner: playerKey,
                reason: 'capture_will',
                sourceType: captureSource.sourceCardType || null,
                sourceCardId: captureSource.sourceCardId,
                sourceName: captureSource.sourceCardName || null,
                sourceSpecialType: captureSource.sourceSpecialType || null,
                sourceRow: row,
                sourceCol: col,
                sourceOwner: ownerBefore,
                stoneId: stoneId || null,
                insertIndex: added.handIndex
            }
        });

        clearCardPendingEffect(cardState, playerKey);
        return {
            applied: true,
            target: { row, col },
            capturedCardId: captureSource.sourceCardId,
            capturedCardType: captureSource.sourceCardType || null,
            capturedCardName: captureSource.sourceCardName || null,
            sourceSpecialType: captureSource.sourceSpecialType || null,
            stoneId: stoneId || null,
            insertIndex: added.handIndex
        };
    }

    function applyGuardWill(cardState, gameState, playerKey, row, col) {
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || (pending.type !== 'GUARD_WILL' && pending.type !== 'GUARDIAN_GOD') || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }
        const targets = getGuardTargets(cardState, gameState, playerKey);
        const allowed = targets.some(t => t.row === row && t.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        const remainingOwnerTurns = pending.type === 'GUARDIAN_GOD'
            ? GUARDIAN_GOD_TURNS
            : GUARD_WILL_TURNS;

        removeMarkersAt(cardState, row, col, {
            kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone',
            type: 'GUARD',
            owner: playerKey
        });
        addMarker(cardState, 'specialStone', row, col, playerKey, {
            type: 'GUARD',
            remainingOwnerTurns
        });
        clearCardPendingEffect(cardState, playerKey);
        return { applied: true, row, col };
    }

    function applyHyperactiveInheritWill(cardState, gameState, playerKey, row, col) {
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'HYPERACTIVE_INHERIT_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }
        const targets = getHyperactiveInheritTargets(cardState, gameState, playerKey);
        const allowed = targets.some(t => t.row === row && t.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        removeMarkersAt(cardState, row, col, {
            kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone',
            type: 'INHERITED_HYPERACTIVE',
            owner: playerKey
        });

        cardState.hyperactiveSeqCounter = (cardState.hyperactiveSeqCounter || 0) + 1;
        addMarker(cardState, 'specialStone', row, col, playerKey, {
            type: 'INHERITED_HYPERACTIVE',
            remainingOwnerTurns: INHERITED_HYPERACTIVE_TURNS,
            flipEvadeRemaining: 1,
            destroyEvadeRemaining: 1,
            hyperactiveSeq: cardState.hyperactiveSeqCounter
        });

        clearCardPendingEffect(cardState, playerKey);
        return { applied: true, row, col, remainingOwnerTurns: INHERITED_HYPERACTIVE_TURNS };
    }

    function applyExtendLifeSelection(cardState, gameState, playerKey, row, col, options) {
        const settings = options && typeof options === 'object' ? options : {};
        const pendingType = settings.pendingType || 'EXTEND_LIFE_WILL';
        const multiplier = Number.isFinite(settings.multiplier) ? Number(settings.multiplier) : 2;
        const getTargets = typeof settings.getTargets === 'function' ? settings.getTargets : getExtendLifeTargets;
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== pendingType || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }
        const targets = getTargets(cardState, gameState, playerKey);
        const allowed = targets.some(t => t.row === row && t.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        const specialsAtCell = getSpecialMarkers(cardState).filter((marker) => (
            marker &&
            marker.row === row &&
            marker.col === col &&
            marker.owner === playerKey &&
            marker.data &&
            Number.isFinite(marker.data.remainingOwnerTurns) &&
            Number(marker.data.remainingOwnerTurns) > 0
        ));
        if (!specialsAtCell.length) {
            return { applied: false, reason: 'no_duration' };
        }

        const primaryMarker = specialsAtCell.find((marker) => {
            const type = marker && marker.data ? marker.data.type : null;
            return type !== 'GUARD';
        }) || specialsAtCell[0];

        let prev = 0;
        let next = 0;
        for (const special of specialsAtCell) {
            const onePrev = Number(special.data.remainingOwnerTurns || 0);
            const oneNext = Math.max(1, Math.trunc(onePrev * multiplier));
            special.data.remainingOwnerTurns = oneNext;
            if (special === primaryMarker) {
                prev = onePrev;
                next = oneNext;
            }
        }

        clearCardPendingEffect(cardState, playerKey);
        return {
            applied: true,
            row,
            col,
            previousRemainingOwnerTurns: prev,
            newRemainingOwnerTurns: next,
            multiplier,
            cardType: pendingType
        };
    }

    // Apply EXTEND_LIFE_WILL: double remainingOwnerTurns on chosen cell's own special markers (numeric remainingOwnerTurns only)
    function applyExtendLifeWill(cardState, gameState, playerKey, row, col) {
        if (CardMarkersModule && typeof CardMarkersModule.applyExtendLifeWill === 'function') {
            return CardMarkersModule.applyExtendLifeWill(cardState, gameState, playerKey, row, col, {
                getExtendLifeTargets
            });
        }
        return applyExtendLifeSelection(cardState, gameState, playerKey, row, col, {
            pendingType: 'EXTEND_LIFE_WILL',
            multiplier: 2,
            getTargets: getExtendLifeTargets
        });
    }

    function applyExtendLifeGod(cardState, gameState, playerKey, row, col) {
        if (CardMarkersModule && typeof CardMarkersModule.applyExtendLifeGod === 'function') {
            return CardMarkersModule.applyExtendLifeGod(cardState, gameState, playerKey, row, col, {
                getExtendLifeTargets
            });
        }
        return applyExtendLifeSelection(cardState, gameState, playerKey, row, col, {
            pendingType: 'EXTEND_LIFE_GOD',
            multiplier: 4,
            getTargets: getExtendLifeTargets
        });
    }

    function applyCorrosionWill(cardState, gameState, playerKey, row, col) {
        if (CardMarkersModule && typeof CardMarkersModule.applyCorrosionWill === 'function') {
            return CardMarkersModule.applyCorrosionWill(cardState, gameState, playerKey, row, col, {
                getCorrosionTargets
            });
        }
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'CORROSION_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending', affectedCount: 0, details: [] };
        }

        const targets = getCorrosionTargets(cardState, gameState, playerKey);
        const allowed = targets.some(t => t.row === row && t.col === col);
        if (!allowed) {
            return { applied: false, reason: 'invalid_target', affectedCount: 0, details: [] };
        }

        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const details = [];
        for (const marker of markers) {
            if (!marker || marker.kind !== (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone')) continue;
            if (marker.row !== row || marker.col !== col) continue;
            if (!marker.data || !Number.isFinite(marker.data.remainingOwnerTurns)) continue;

            const before = Number(marker.data.remainingOwnerTurns);
            if (before <= 0) continue;

            const after = Math.max(1, Math.trunc(before / 2));
            marker.data.remainingOwnerTurns = after;
            details.push({
                row: marker.row,
                col: marker.col,
                owner: marker.owner || null,
                special: marker.data && marker.data.type ? marker.data.type : null,
                previousRemainingOwnerTurns: before,
                newRemainingOwnerTurns: after
            });
        }

        clearCardPendingEffect(cardState, playerKey);
        return { applied: true, affectedCount: details.length, details };
    }

    function applyTimeBombWill(cardState, gameState, playerKey, row, col) {
        if (typeof module === 'object' && module.exports) {
            try {
                const mod = require('./cards/time_bomb');
                if (mod && typeof mod.applyTimeBombWill === 'function') {
                    return mod.applyTimeBombWill(cardState, gameState, playerKey, row, col, {
                        getTimeBombTargets,
                        removeMarkersAt,
                        addMarker,
                        specialStoneKind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone'
                    });
                }
            } catch (e) {
                // ignore and fall back to inline implementation
            }
        }
        if (typeof CardTimeBomb !== 'undefined' && typeof CardTimeBomb.applyTimeBombWill === 'function') {
            return CardTimeBomb.applyTimeBombWill(cardState, gameState, playerKey, row, col, {
                getTimeBombTargets,
                removeMarkersAt,
                addMarker,
                specialStoneKind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone'
            });
        }
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'TIME_BOMB' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }
        const targets = getTimeBombTargets(cardState, gameState, playerKey);
        const allowed = targets.some(t => t.row === row && t.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };
        if (isAbsoluteProtectedCell(cardState, row, col)) return { applied: false, reason: 'absolute_protected' };
        removeMarkersAt(cardState, row, col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone' });
        const existingBomb = findBombMarkerAt(cardState, row, col);
        if (existingBomb) return { applied: false, reason: 'exists' };

        addMarker(cardState, 'specialStone', row, col, playerKey, {
            type: 'TIME_BOMB',
            category: MARKER_CATEGORIES.BOMB,
            remainingTurns: TIME_BOMB_TURNS,
            placedTurn: cardState.turnIndex
        });

        clearCardPendingEffect(cardState, playerKey);
        return { applied: true, row, col };
    }

    function cloneMarkerData(data) {
        if (!data || typeof data !== 'object') return {};
        try {
            return JSON.parse(JSON.stringify(data));
        } catch (e) {
            return { ...data };
        }
    }

    function applyCloneWill(cardState, gameState, playerKey, row, col, prng) {
        if (CardCloneModule && typeof CardCloneModule.applyCloneWill === 'function') {
            return CardCloneModule.applyCloneWill(cardState, gameState, playerKey, row, col, prng, {
                getCloneTargets,
                getCellValueForCard,
                getSpecialMarkers,
                getBombMarkers,
                collectEmptyNeighborCellsForCard,
                spawnAt: BoardOpsModule && typeof BoardOpsModule.spawnAt === 'function'
                    ? BoardOpsModule.spawnAt
                    : null,
                setCellValueForCard,
                addMarker
            });
        }
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'CLONE_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }

        const targets = getCloneTargets(cardState, gameState, playerKey);
        const allowed = targets.some(t => t.row === row && t.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        const sourceVal = getCellValueForCard(gameState, row, col);
        const playerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        if (sourceVal !== playerVal) return { applied: false, reason: 'not_owner_stone' };

        const sourceSpecials = getSpecialMarkers(cardState).filter(m => m && m.row === row && m.col === col);
        const sourceBombs = getBombMarkers(cardState).filter(m => m && m.row === row && m.col === col);

        const spawnTargets = collectEmptyNeighborCellsForCard(cardState, gameState, row, col);

        if (!spawnTargets.length) return { applied: false, reason: 'no_space' };

        const p = (prng && typeof prng.random === 'function') ? prng : { random: Math.random };
        const randomIndexRaw = Math.floor(p.random() * spawnTargets.length);
        const randomIndex = Number.isInteger(randomIndexRaw)
            ? Math.max(0, Math.min(spawnTargets.length - 1, randomIndexRaw))
            : 0;
        const selectedTarget = spawnTargets[randomIndex] || spawnTargets[0];

        const spawned = [];
        const target = selectedTarget;
        if (BoardOpsModule && typeof BoardOpsModule.spawnAt === 'function') {
            BoardOpsModule.spawnAt(cardState, gameState, target.row, target.col, playerKey, 'CLONE_WILL', 'clone_spawn', {
                fromRow: row,
                fromCol: col,
                cloneVisual: true
            });
        } else {
            setCellValueForCard(gameState, target.row, target.col, playerVal);
        }

        for (const sm of sourceSpecials) {
            const owner = sm.owner === 'white' ? 'white' : 'black';
            addMarker(cardState, 'specialStone', target.row, target.col, owner, cloneMarkerData(sm.data || {}));
        }
        for (const bm of sourceBombs) {
            const owner = bm.owner === 'white' ? 'white' : 'black';
            addMarker(cardState, 'specialStone', target.row, target.col, owner, Object.assign(
                {},
                cloneMarkerData(bm.data || {}),
                { category: MARKER_CATEGORIES.BOMB, type: (bm.data && bm.data.type) || 'TIME_BOMB' }
            ));
        }
        spawned.push({ row: target.row, col: target.col });

        clearCardPendingEffect(cardState, playerKey);
        return { applied: true, source: { row, col }, spawned };
    }

    function halveDurationValueForSplit(value) {
        const current = Number(value);
        if (!Number.isFinite(current) || current <= 0) return value;
        return Math.max(1, Math.trunc(current / 2));
    }

    function halveDurationOnMarkerDataForSplit(data, markerCategory) {
        if (!data || typeof data !== 'object') return null;
        if (markerCategory === 'specialStone') {
            if (!Number.isFinite(Number(data.remainingOwnerTurns)) || Number(data.remainingOwnerTurns) <= 0) return null;
            const previous = Number(data.remainingOwnerTurns);
            const next = halveDurationValueForSplit(previous);
            data.remainingOwnerTurns = next;
            return {
                durationKey: 'remainingOwnerTurns',
                previousDuration: previous,
                nextDuration: next
            };
        }
        if (markerCategory === MARKER_CATEGORIES.BOMB) {
            if (!Number.isFinite(Number(data.remainingTurns)) || Number(data.remainingTurns) <= 0) return null;
            const previous = Number(data.remainingTurns);
            const next = halveDurationValueForSplit(previous);
            data.remainingTurns = next;
            return {
                durationKey: 'remainingTurns',
                previousDuration: previous,
                nextDuration: next
            };
        }
        return null;
    }

    function applySplitWill(cardState, gameState, playerKey, row, col, prng) {
        if (CardCloneModule && typeof CardCloneModule.applySplitWill === 'function') {
            return CardCloneModule.applySplitWill(cardState, gameState, playerKey, row, col, prng, {
                getSplitTargets,
                getCellValueForCard,
                getSpecialMarkers,
                getBombMarkers,
                collectEmptyNeighborCellsForCard,
                spawnAt: BoardOpsModule && typeof BoardOpsModule.spawnAt === 'function'
                    ? BoardOpsModule.spawnAt
                    : null,
                setCellValueForCard,
                addMarker
            });
        }
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'SPLIT_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }

        const targets = getSplitTargets(cardState, gameState, playerKey);
        const allowed = targets.some(t => t.row === row && t.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        const sourceVal = getCellValueForCard(gameState, row, col);
        const playerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        if (sourceVal !== playerVal) return { applied: false, reason: 'not_owner_stone' };

        const sourceSpecials = getSpecialMarkers(cardState).filter(m => m && m.row === row && m.col === col);
        const sourceBombs = getBombMarkers(cardState).filter(m => m && m.row === row && m.col === col);

        const spawnTargets = collectEmptyNeighborCellsForCard(cardState, gameState, row, col);

        if (!spawnTargets.length) return { applied: false, reason: 'no_space' };

        const p = (prng && typeof prng.random === 'function') ? prng : { random: Math.random };
        const randomIndexRaw = Math.floor(p.random() * spawnTargets.length);
        const randomIndex = Number.isInteger(randomIndexRaw)
            ? Math.max(0, Math.min(spawnTargets.length - 1, randomIndexRaw))
            : 0;
        const selectedTarget = spawnTargets[randomIndex] || spawnTargets[0];

        const spawned = [];
        const target = selectedTarget;
        if (BoardOpsModule && typeof BoardOpsModule.spawnAt === 'function') {
            BoardOpsModule.spawnAt(cardState, gameState, target.row, target.col, playerKey, 'SPLIT_WILL', 'split_spawn', {
                fromRow: row,
                fromCol: col,
                cloneVisual: true
            });
        } else {
            setCellValueForCard(gameState, target.row, target.col, playerVal);
        }

        const durationChanges = [];
        for (const sm of sourceSpecials) {
            const owner = sm.owner === 'white' ? 'white' : 'black';
            const sourceData = cloneMarkerData(sm.data || {});
            const duration = halveDurationOnMarkerDataForSplit(sourceData, 'specialStone');
            sm.data = sourceData;
            addMarker(cardState, 'specialStone', target.row, target.col, owner, cloneMarkerData(sourceData));
            if (duration) {
                durationChanges.push({
                    row,
                    col,
                    owner,
                    special: sourceData.type || null,
                    durationKey: duration.durationKey,
                    previousDuration: duration.previousDuration,
                    nextDuration: duration.nextDuration
                });
            }
        }
        for (const bm of sourceBombs) {
            const owner = bm.owner === 'white' ? 'white' : 'black';
            const sourceData = cloneMarkerData(bm.data || {});
            const duration = halveDurationOnMarkerDataForSplit(sourceData, MARKER_CATEGORIES.BOMB);
            bm.data = sourceData;
            addMarker(cardState, 'specialStone', target.row, target.col, owner, Object.assign(
                {},
                cloneMarkerData(sourceData),
                { category: MARKER_CATEGORIES.BOMB, type: (sourceData && sourceData.type) || 'TIME_BOMB' }
            ));
            if (duration) {
                durationChanges.push({
                    row,
                    col,
                    owner,
                    special: 'TIME_BOMB',
                    durationKey: duration.durationKey,
                    previousDuration: duration.previousDuration,
                    nextDuration: duration.nextDuration
                });
            }
        }
        spawned.push({ row: target.row, col: target.col });

        clearCardPendingEffect(cardState, playerKey);
        return { applied: true, source: { row, col }, spawned, durationChanges };
    }

    function applyBoardExpansionWill(cardState, gameState, playerKey, row, col) {
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'BOARD_EXPANSION_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }
        const targets = getBoardExpansionTargets(cardState, gameState, playerKey);
        const allowed = targets.some(t => t.row === row && t.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        const side = col === 0 ? 'left' : (col === 7 ? 'right' : null);
        if (!side || !Number.isInteger(row) || row < 0 || row >= 8) {
            return { applied: false, reason: 'invalid_target' };
        }

        const boardExpansion = ensureMutableBoardExpansionForCard(gameState);
        const cells = getExpansionDescriptorsForCard(gameState);
        const targetCol = side === 'left' ? -1 : 8;
        const alreadyExists = cells.some((cell) => cell && cell.row === row && cell.col === targetCol);
        if (alreadyExists) return { applied: false, reason: 'already_expanded' };

        cells.push({ side, row, col: targetCol, owner: EMPTY });

        boardExpansion.cells = cells.map((cell) => ({
            side: resolveExpansionSideForCard(cell.side, cell.row, cell.col),
            row: cell.row,
            col: cell.col,
            owner: normalizeExpansionOwnerForCard(cell.owner)
        }));
        syncLegacyExpansionFieldsForCard(boardExpansion);

        boardExpansion.usedByPlayer[playerKey] = true;

        clearCardPendingEffect(cardState, playerKey);
        return { applied: true, side, row, col: targetCol };
    }

    function applyBoardExpansionGod(cardState, gameState, playerKey, row, col) {
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'BOARD_EXPANSION_GOD' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }

        const targets = getBoardExpansionGodTargets(cardState, gameState, playerKey);
        const allowed = targets.some((target) => target && target.row === row && target.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        const maxSelections = getBoardExpansionGodRequiredSelectionCount(cardState, gameState, playerKey);
        if (maxSelections <= 0) return { applied: false, reason: 'invalid_target' };
        const selectedTargets = getBoardExpansionGodPendingSelectionsForCard(pending);
        const nextSelections = selectedTargets.concat({ row, col }).map((target) => ({ row: target.row, col: target.col }));

        if (nextSelections.length < maxSelections) {
            pending.selectedTargets = nextSelections;
            pending.selectedCount = pending.selectedTargets.length;
            pending.maxSelections = maxSelections;
            return {
                applied: true,
                completed: false,
                selectedCount: pending.selectedCount,
                maxSelections,
                remainingSelections: maxSelections - pending.selectedCount,
                target: { row, col },
                selectedTargets: pending.selectedTargets.map((target) => ({ row: target.row, col: target.col }))
            };
        }

        const boardExpansion = ensureMutableBoardExpansionForCard(gameState);
        const cells = getExpansionDescriptorsForCard(gameState);
        const occupied = new Set(cells.map((cell) => `${cell.row},${cell.col}`));
        const additions = [];
        const additionKeys = new Set();
        for (const target of nextSelections) {
            const targetAdditions = getBoardExpansionGodAdditionsForCard(target.row, target.col);
            if (!targetAdditions || targetAdditions.length !== 3) {
                return { applied: false, reason: 'invalid_target' };
            }
            for (const cell of targetAdditions) {
                const key = `${cell.row},${cell.col}`;
                if (occupied.has(key) || additionKeys.has(key)) {
                    return { applied: false, reason: 'already_expanded' };
                }
                additionKeys.add(key);
                additions.push({ row: cell.row, col: cell.col });
            }
        }

        for (const cell of additions) {
            cells.push({
                side: resolveExpansionSideForCard(null, cell.row, cell.col),
                row: cell.row,
                col: cell.col,
                owner: EMPTY
            });
        }

        boardExpansion.cells = cells.map((cell) => ({
            side: resolveExpansionSideForCard(cell.side, cell.row, cell.col),
            row: cell.row,
            col: cell.col,
            owner: normalizeExpansionOwnerForCard(cell.owner)
        }));
        syncLegacyExpansionFieldsForCard(boardExpansion);

        boardExpansion.usedByPlayer[playerKey] = true;

        clearCardPendingEffect(cardState, playerKey);
        return {
            applied: true,
            completed: true,
            source: { row, col },
            sources: nextSelections.map((target) => ({ row: target.row, col: target.col })),
            selectedTargets: nextSelections.map((target) => ({ row: target.row, col: target.col })),
            added: additions.map((cell) => ({ row: cell.row, col: cell.col }))
        };
    }

    function applyBlockadeWill(cardState, gameState, playerKey, row, col) {
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'BLOCKADE_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }
        const targets = getBlockadeTargets(cardState, gameState, playerKey);
        const allowed = targets.some(t => t.row === row && t.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        removeMarkersAt(cardState, row, col, {
            kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone',
            type: 'BLOCKADE'
        });
        addMarker(cardState, 'specialStone', row, col, playerKey, {
            type: 'BLOCKADE',
            remainingOwnerTurns: BLOCKADE_TURNS
        });

        clearCardPendingEffect(cardState, playerKey);
        return { applied: true, row, col };
    }

    function applyMeteorWill(cardState, gameState, playerKey, row, col) {
        if (CardMeteorModule && typeof CardMeteorModule.applyMeteorWill === 'function') {
            return CardMeteorModule.applyMeteorWill(cardState, gameState, playerKey, row, col, {
                getMeteorTargets,
                getCellValueForCard,
                destroyAt: BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function'
                    ? BoardOpsModule.destroyAt
                    : null,
                isDestroyResolved,
                clearStoneIdAtForCard,
                setCellValueForCard,
                removeMarkersAt,
                addMarker
            });
        }
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'METEOR_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }
        const targets = getMeteorTargets(cardState, gameState, playerKey);
        const allowed = targets.some(t => t.row === row && t.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        if (isAbsoluteProtectedCell(cardState, row, col)) return { applied: false, reason: 'absolute_protected' };

        const cellValue = getCellValueForCard(gameState, row, col);
        if (cellValue === null) return { applied: false, reason: 'out_of_board' };

        let destroyed = false;
        if (cellValue !== EMPTY) {
            if (BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function') {
                const res = BoardOpsModule.destroyAt(
                    cardState,
                    gameState,
                    row,
                    col,
                    'METEOR_WILL',
                    'meteor_cell_destroy',
                    { ignoreGuard: true }
                );
                destroyed = isDestroyResolved(res);
                if (res && res.reason === 'out_of_board') {
                    return { applied: false, reason: 'out_of_board' };
                }
            }
            if (!destroyed) {
                clearStoneIdAtForCard(cardState, gameState, row, col);
                setCellValueForCard(gameState, row, col, EMPTY);
                removeMarkersAt(cardState, row, col);
                destroyed = true;
            }
        } else {
            clearStoneIdAtForCard(cardState, gameState, row, col);
            setCellValueForCard(gameState, row, col, EMPTY);
            removeMarkersAt(cardState, row, col);
        }

        // Full erase first, then leave a permanent hole marker.
        removeMarkersAt(cardState, row, col);
        addMarker(cardState, 'specialStone', row, col, playerKey, {
            type: 'METEOR_HOLE'
        });

        clearCardPendingEffect(cardState, playerKey);
        return { applied: true, row, col, destroyed };
    }

    function applyFreezeWill(cardState, gameState, playerKey, row, col) {
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'FREEZE_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }
        const targets = getFreezeTargets(cardState, gameState, playerKey);
        const allowed = targets.some(t => t.row === row && t.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        removeMarkersAt(cardState, row, col, {
            kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone',
            type: 'FREEZE'
        });
        addMarker(cardState, 'specialStone', row, col, playerKey, {
            type: 'FREEZE',
            remainingOwnerTurns: FREEZE_TURNS
        });

        clearCardPendingEffect(cardState, playerKey);
        return { applied: true, row, col };
    }

    function getLossWillRemovableCount(cardState) {
        ensureMarkers(cardState);
        const specials = getSpecialMarkers(cardState);
        const guardedCells = new Set(
            specials
                .filter((marker) => (
                    marker &&
                    marker.data &&
                    marker.data.type === 'GUARD' &&
                    Number.isInteger(marker.row) &&
                    Number.isInteger(marker.col)
                ))
                .map((marker) => `${marker.row},${marker.col}`)
        );
        const removableSpecials = specials.filter((marker) => {
            if (!marker) return false;
            if (marker.data && marker.data.type === 'METEOR_HOLE') return false;
            if (marker.data && marker.data.type === 'ABSOLUTE_PROTECTED') return false;
            if (!Number.isInteger(marker.row) || !Number.isInteger(marker.col)) return true;
            return !guardedCells.has(`${marker.row},${marker.col}`);
        });
        const bombs = getBombMarkers(cardState);
        const removableBombs = bombs.filter((marker) => {
            if (!marker) return false;
            if (!Number.isInteger(marker.row) || !Number.isInteger(marker.col)) return true;
            if (isAbsoluteProtectedCell(cardState, marker.row, marker.col)) return false;
            return !guardedCells.has(`${marker.row},${marker.col}`);
        });
        return removableSpecials.length + removableBombs.length;
    }

    function applyLossWill(cardState, gameState, playerKey) {
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'LOSS_WILL') {
            return { applied: false, reason: 'not_pending', removedCount: 0, removed: [] };
        }

        ensureMarkers(cardState);
        const specials = getSpecialMarkers(cardState);
        const guardedCells = new Set(
            specials
                .filter((marker) => (
                    marker &&
                    marker.data &&
                    marker.data.type === 'GUARD' &&
                    Number.isInteger(marker.row) &&
                    Number.isInteger(marker.col)
                ))
                .map((marker) => `${marker.row},${marker.col}`)
        );

        const removableSpecials = specials.filter((marker) => {
            if (!marker) return false;
            if (marker.data && marker.data.type === 'METEOR_HOLE') return false;
            if (marker.data && marker.data.type === 'ABSOLUTE_PROTECTED') return false;
            if (!Number.isInteger(marker.row) || !Number.isInteger(marker.col)) return true;
            return !guardedCells.has(`${marker.row},${marker.col}`);
        });

        const bombs = getBombMarkers(cardState);
        const removableBombs = bombs.filter((marker) => {
            if (!marker) return false;
            if (!Number.isInteger(marker.row) || !Number.isInteger(marker.col)) return true;
            if (isAbsoluteProtectedCell(cardState, marker.row, marker.col)) return false;
            return !guardedCells.has(`${marker.row},${marker.col}`);
        });

        const removed = removableSpecials.map((marker) => ({
            row: marker.row,
            col: marker.col,
            owner: marker.owner || null,
            type: (marker.data && marker.data.type) || null
        })).concat(removableBombs.map((marker) => ({
            row: marker.row,
            col: marker.col,
            owner: marker.owner || null,
            type: (marker.data && marker.data.type) || 'TIME_BOMB'
        })));

        const specialKind = MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone';
        cardState.markers = cardState.markers.filter((marker) => {
            if (!(marker && (marker.kind === specialKind || isBombCategoryMarker(marker)))) return true;
            if (!isBombCategoryMarker(marker)) {
                if (marker.data && marker.data.type === 'METEOR_HOLE') return true;
                if (marker.data && marker.data.type === 'ABSOLUTE_PROTECTED') return true;
                if (!Number.isInteger(marker.row) || !Number.isInteger(marker.col)) return false;
                return guardedCells.has(`${marker.row},${marker.col}`);
            }
            if (!Number.isInteger(marker.row) || !Number.isInteger(marker.col)) return false;
            if (isAbsoluteProtectedCell(cardState, marker.row, marker.col)) return true;
            return guardedCells.has(`${marker.row},${marker.col}`);
        });

        for (const entry of removed) {
            if (!Number.isInteger(entry.row) || !Number.isInteger(entry.col)) continue;
            if (!gameState || !Array.isArray(gameState.board)) continue;
            if (!Array.isArray(gameState.board[entry.row])) continue;
            if (gameState.board[entry.row][entry.col] === EMPTY) continue;

            emitPresentationEvent(cardState, {
                type: 'STATUS_REMOVED',
                row: entry.row,
                col: entry.col,
                cause: 'LOSS_WILL',
                reason: 'loss_will_reset',
                meta: {
                    special: entry.type,
                    owner: entry.owner,
                    reason: 'loss_will_reset'
                }
            });
        }

        clearCardPendingEffect(cardState, playerKey);
        return { applied: true, removedCount: removed.length, removed };
    }

    function getSalvationWillTargetCount(cardState, playerKey) {
        if (!cardState || !cardState.prevOpponentTurnDestroyedNormalByPlayer) return 0;
        const list = cardState.prevOpponentTurnDestroyedNormalByPlayer[playerKey];
        return Array.isArray(list) ? list.length : 0;
    }

    function applySalvationWill(cardState, gameState, playerKey, prng) {
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'SALVATION_WILL') {
            return { applied: false, reason: 'not_pending', spawned: [], requestedCount: 0, spawnedCount: 0 };
        }
        const tracked = (cardState.prevOpponentTurnDestroyedNormalByPlayer && Array.isArray(cardState.prevOpponentTurnDestroyedNormalByPlayer[playerKey]))
            ? cardState.prevOpponentTurnDestroyedNormalByPlayer[playerKey].slice()
            : [];
        if (tracked.length === 0) {
            if (cardState.prevOpponentTurnDestroyedNormalByPlayer) {
                cardState.prevOpponentTurnDestroyedNormalByPlayer[playerKey] = [];
            }
            clearCardPendingEffect(cardState, playerKey);
            return { applied: false, reason: 'no_tracked_stones', spawned: [], requestedCount: 0, spawnedCount: 0 };
        }
        const requestedCount = tracked.length;
        const result = resolveRandomBoardSpawnEffectUsage(
            cardState,
            gameState,
            playerKey,
            requestedCount,
            prng,
            'SALVATION_WILL',
            'salvation_spawn'
        );
        if (cardState.prevOpponentTurnDestroyedNormalByPlayer) {
            cardState.prevOpponentTurnDestroyedNormalByPlayer[playerKey] = [];
        }
        clearCardPendingEffect(cardState, playerKey);
        return result;
    }

    /**
     * Returns the controller key for a given turn owner if FATE_WILL is active.
     * @param {Object} cardState
     * @param {string} turnOwnerKey - 'black' or 'white'
     * @returns {string|null} controller key or null
     */
    function getFateWillControllerForTurnOwner(cardState, turnOwnerKey) {
        if (!cardState || !cardState.fateWillControllerByTurnOwner) return null;
        const key = String(turnOwnerKey || '');
        if (key !== 'black' && key !== 'white') return null;
        return cardState.fateWillControllerByTurnOwner[key] || null;
    }

    /**
     * Resolve FATE_WILL usage: arm the controller override for the opponent's next turn.
     * If stacking (effect already active for opponent, or current turn is already controlled),
     * the card is consumed but has no additional control effect per spec.
     */
    function applyFateWill(cardState, playerKey) {
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'FATE_WILL') {
            return { applied: false, reason: 'not_pending' };
        }
        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        if (!cardState.fateWillControllerByTurnOwner) {
            cardState.fateWillControllerByTurnOwner = { black: null, white: null };
        }
        // Prevent stacking/nesting: if opponent already has a controller, or if this
        // player's own turn is currently being controlled, treat as no additional effect.
        const opponentAlreadyControlled = !!cardState.fateWillControllerByTurnOwner[opponentKey];
        const currentTurnIsControlled = !!cardState.fateWillControllerByTurnOwner[playerKey];
        const alreadyActive = opponentAlreadyControlled || currentTurnIsControlled;
        if (!alreadyActive) {
            cardState.fateWillControllerByTurnOwner[opponentKey] = playerKey;
        }
        clearCardPendingEffect(cardState, playerKey);
        return { applied: true, stacked: alreadyActive, controllerKey: playerKey, turnOwnerKey: opponentKey };
    }

    function getStrongWindTargets(cardState, gameState) {
        if (CardSelectorsModule && typeof CardSelectorsModule.getStrongWindTargets === 'function') {
            return CardSelectorsModule.getStrongWindTargets(cardState, gameState);
        }
        const res = [];
        for (const cell of getOccupiedBoardShapeCellsForCard(cardState, gameState)) {
            const hasMove = _getStrongWindMoveOptions(cardState, gameState, cell.row, cell.col).length > 0;
            if (hasMove) res.push({ row: cell.row, col: cell.col });
        }
        return res;
    }

    function _collectVerticalCrushMovePlan(cardState, gameState, row, col, dr) {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
        if (dr !== -1 && dr !== 1) return null;

        const firstRow = row + dr;
        if (!hasBoardShapeCellForCard(cardState, gameState, firstRow, col)) return null;

        const destroyed = [];
        let to = null;
        for (let r = firstRow; hasBoardShapeCellForCard(cardState, gameState, r, col); r += dr) {
            if (isBlockedCell(cardState, r, col, gameState)) break;

            if (getCellValueForCard(gameState, r, col) !== EMPTY) {
                const guard = findSpecialMarkerAt(cardState, r, col, 'GUARD');
                if (guard) break;
                destroyed.push({ row: r, col });
                const ghost = findSpecialMarkerAt(cardState, r, col, 'GHOST');
                if (!ghost) {
                    to = { row: r, col };
                }
                continue;
            }

            to = { row: r, col };
        }

        if (!to) return null;
        const movedDistance = Math.abs(to.row - row) + Math.abs(to.col - col);
        if (movedDistance <= 0) return null;

        return {
            from: { row, col },
            to,
            destroyed,
            direction: { dr, dc: 0 },
            movedDistance
        };
    }

    function getSuperBuoyancyTargets(cardState, gameState) {
        if (CardSelectorsModule && typeof CardSelectorsModule.getSuperBuoyancyTargets === 'function') {
            return CardSelectorsModule.getSuperBuoyancyTargets(cardState, gameState);
        }

        const res = [];
        for (const cell of getOccupiedBoardShapeCellsForCard(cardState, gameState)) {
            const plan = _collectVerticalCrushMovePlan(cardState, gameState, cell.row, cell.col, -1);
            if (plan) res.push({ row: cell.row, col: cell.col });
        }
        return res;
    }

    function getSuperGravityTargets(cardState, gameState) {
        if (CardSelectorsModule && typeof CardSelectorsModule.getSuperGravityTargets === 'function') {
            return CardSelectorsModule.getSuperGravityTargets(cardState, gameState);
        }

        const res = [];
        for (const cell of getOccupiedBoardShapeCellsForCard(cardState, gameState)) {
            const plan = _collectVerticalCrushMovePlan(cardState, gameState, cell.row, cell.col, 1);
            if (plan) res.push({ row: cell.row, col: cell.col });
        }
        return res;
    }

    function _getStrongWindMoveOptions(cardState, gameState, row, col) {
        const dirs = [
            { dr: -1, dc: 0 },
            { dr: 1, dc: 0 },
            { dr: 0, dc: -1 },
            { dr: 0, dc: 1 }
        ];
        const options = [];
        for (const d of dirs) {
            const nr = row + d.dr;
            const nc = col + d.dc;
            if (!hasBoardShapeCellForCard(cardState, gameState, nr, nc)) continue;
            if (getCellValueForCard(gameState, nr, nc) !== EMPTY) continue;
            if (isBlockedCell(cardState, nr, nc, gameState)) continue;

            let tr = nr;
            let tc = nc;
            while (true) {
                const rr = tr + d.dr;
                const cc = tc + d.dc;
                if (!hasBoardShapeCellForCard(cardState, gameState, rr, cc)) break;
                if (getCellValueForCard(gameState, rr, cc) !== EMPTY) break;
                if (isBlockedCell(cardState, rr, cc, gameState)) break;
                tr = rr;
                tc = cc;
            }
            const distance = Math.abs(tr - row) + Math.abs(tc - col);
            options.push({ direction: d, target: { row: tr, col: tc }, distance });
        }
        return options;
    }

    function _moveMarkersForStrongWind(cardState, fromRow, fromCol, toRow, toCol) {
        const markers = getMarkers(cardState);
        for (const m of markers) {
            if (!m) continue;
            if (m.row !== fromRow || m.col !== fromCol) continue;
            m.row = toRow;
            m.col = toCol;
        }
    }

    function _getTeleportDestinations(cardState, gameState) {
        return getEmptyBoardShapeCellsForCard(cardState, gameState)
            .filter((cell) => !isBlockedCell(cardState, cell.row, cell.col, gameState));
    }

    function _moveMarkersForTeleport(cardState, fromRow, fromCol, toRow, toCol) {
        const markers = getMarkers(cardState);
        for (const m of markers) {
            if (!m) continue;
            if (m.row !== fromRow || m.col !== fromCol) continue;
            m.row = toRow;
            m.col = toCol;
        }
    }

    function _leaveMeteorHoleAt(cardState, gameState, playerKey, row, col) {
        clearStoneIdAtForCard(cardState, gameState, row, col);
        setCellValueForCard(gameState, row, col, EMPTY);
        removeMarkersAt(cardState, row, col);
        addMarker(cardState, 'specialStone', row, col, playerKey, {
            type: 'METEOR_HOLE'
        });
    }

    function applyTeleportWill(cardState, gameState, playerKey, row, col, prng) {
        if (CardTeleportModule && typeof CardTeleportModule.applyTeleportWill === 'function') {
            return CardTeleportModule.applyTeleportWill(cardState, gameState, playerKey, row, col, prng, {
                getTeleportTargets,
                getTeleportDestinations: _getTeleportDestinations,
                getCellValueForCard,
                setCellValueForCard,
                moveAt: BoardOpsModule && typeof BoardOpsModule.moveAt === 'function'
                    ? BoardOpsModule.moveAt
                    : null,
                getMarkers
            });
        }
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'TELEPORT_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }
        const cellValue = getCellValueForCard(gameState, row, col);
        if (cellValue === null) return { applied: false, reason: 'out_of_board' };
        if (cellValue === EMPTY) return { applied: false, reason: 'empty' };

        const targets = getTeleportTargets(cardState, gameState);
        const allowed = targets.some(t => t.row === row && t.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        const destinations = _getTeleportDestinations(cardState, gameState);
        if (!destinations.length) return { applied: false, reason: 'no_destination' };

        const p = (prng && typeof prng.random === 'function') ? prng : { random: Math.random };
        const indexRaw = Math.floor(p.random() * destinations.length);
        const index = Number.isInteger(indexRaw)
            ? Math.max(0, Math.min(destinations.length - 1, indexRaw))
            : 0;
        const to = destinations[index] || destinations[0];

        _moveMarkersForTeleport(cardState, row, col, to.row, to.col);

        if (BoardOpsModule && typeof BoardOpsModule.moveAt === 'function') {
            const res = BoardOpsModule.moveAt(cardState, gameState, row, col, to.row, to.col, 'TELEPORT_WILL', 'teleport_move');
            if (!res || !res.moved) {
                return { applied: false, reason: 'move_failed' };
            }
        } else {
            const cleared = setCellValueForCard(gameState, row, col, EMPTY);
            const placed = setCellValueForCard(gameState, to.row, to.col, cellValue);
            if (!cleared || !placed) {
                return { applied: false, reason: 'move_failed' };
            }
        }

        clearCardPendingEffect(cardState, playerKey);
        return { applied: true, from: { row, col }, to };
    }

    function applyCellTeleportWill(cardState, gameState, playerKey, row, col, prng) {
        if (CardTeleportModule && typeof CardTeleportModule.applyCellTeleportWill === 'function') {
            return CardTeleportModule.applyCellTeleportWill(cardState, gameState, playerKey, row, col, prng, {
                getCellTeleportTargets,
                getCellTeleportDestinations,
                getCellValueForCard,
                ensureExpansionCellForCard,
                moveAt: BoardOpsModule && typeof BoardOpsModule.moveAt === 'function'
                    ? BoardOpsModule.moveAt
                    : null,
                setCellValueForCard,
                getStoneIdAtForCard,
                clearStoneIdAtForCard,
                setStoneIdAtForCard,
                removeMarkersAt,
                addMarker,
                getMarkers
            });
        }
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'CELL_TELEPORT_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }

        const targets = getCellTeleportTargets(cardState, gameState);
        const allowed = targets.some((target) => target && target.row === row && target.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        const cellValue = getCellValueForCard(gameState, row, col);
        if (cellValue === null) return { applied: false, reason: 'out_of_board' };
        if (cellValue === EMPTY) return { applied: false, reason: 'empty' };

        const destinations = getCellTeleportDestinations(cardState, gameState)
            .filter((target) => !(target && target.row === row && target.col === col));
        if (!destinations.length) return { applied: false, reason: 'no_destination' };

        const p = (prng && typeof prng.random === 'function') ? prng : { random: Math.random };
        const indexRaw = Math.floor(p.random() * destinations.length);
        const index = Number.isInteger(indexRaw)
            ? Math.max(0, Math.min(destinations.length - 1, indexRaw))
            : 0;
        const to = destinations[index] || destinations[0];
        const createdDestination = !to.active;

        if (!ensureExpansionCellForCard(gameState, to.row, to.col, EMPTY)) {
            return { applied: false, reason: 'invalid_destination' };
        }

        let moved = false;
        if (BoardOpsModule && typeof BoardOpsModule.moveAt === 'function') {
            const res = BoardOpsModule.moveAt(cardState, gameState, row, col, to.row, to.col, 'CELL_TELEPORT_WILL', 'teleport_move');
            if (res && res.reason === 'out_of_board') {
                return { applied: false, reason: 'move_failed' };
            }
            moved = !!(res && res.moved);
        }

        if (!moved) {
            const sourceStoneId = getStoneIdAtForCard(cardState, gameState, row, col);
            const cleared = setCellValueForCard(gameState, row, col, EMPTY);
            const placed = setCellValueForCard(gameState, to.row, to.col, cellValue);
            if (!cleared || !placed) {
                return { applied: false, reason: 'move_failed' };
            }
            clearStoneIdAtForCard(cardState, gameState, row, col);
            setStoneIdAtForCard(cardState, gameState, to.row, to.col, sourceStoneId);
        }

        _moveMarkersForTeleport(cardState, row, col, to.row, to.col);
        _leaveMeteorHoleAt(cardState, gameState, playerKey, row, col);

        clearCardPendingEffect(cardState, playerKey);
        return {
            applied: true,
            from: { row, col },
            to: { row: to.row, col: to.col },
            createdDestination
        };
    }

    function applyStrongWindWill(cardState, gameState, playerKey, row, col, prng) {
        if (CardMovementModule && typeof CardMovementModule.applyStrongWindWill === 'function') {
            return CardMovementModule.applyStrongWindWill(cardState, gameState, playerKey, row, col, prng, {
                getCellValueForCard,
                hasBoardShapeCellForCard,
                isBlockedCell,
                setCellValueForCard,
                moveAt: BoardOpsModule && typeof BoardOpsModule.moveAt === 'function'
                    ? BoardOpsModule.moveAt
                    : null,
                getMarkers
            });
        }
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'STRONG_WIND_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }
        const cellValue = getCellValueForCard(gameState, row, col);
        if (cellValue === null) return { applied: false, reason: 'out_of_board' };
        if (cellValue === EMPTY) return { applied: false, reason: 'empty' };

        const options = _getStrongWindMoveOptions(cardState, gameState, row, col);
        if (!options.length) return { applied: false, reason: 'no_move_options' };

        const maxDistance = options.reduce((m, o) => Math.max(m, Number(o && o.distance) || 0), 0);
        const bestOptions = options.filter(o => (Number(o && o.distance) || 0) === maxDistance);
        const p = (prng && typeof prng.random === 'function') ? prng : { random: Math.random };
        const pick = bestOptions[Math.floor(p.random() * bestOptions.length)];
        const to = pick.target;
        const movedDistance = Math.abs(to.row - row) + Math.abs(to.col - col);

        _moveMarkersForStrongWind(cardState, row, col, to.row, to.col);

        if (BoardOpsModule && typeof BoardOpsModule.moveAt === 'function') {
            const res = BoardOpsModule.moveAt(cardState, gameState, row, col, to.row, to.col, 'STRONG_WIND_WILL', 'strong_wind_move');
            if (!res || !res.moved) {
                return { applied: false, reason: 'move_failed' };
            }
        } else {
            const cleared = setCellValueForCard(gameState, row, col, EMPTY);
            const placed = setCellValueForCard(gameState, to.row, to.col, cellValue);
            if (!cleared || !placed) {
                return { applied: false, reason: 'move_failed' };
            }
        }

        clearCardPendingEffect(cardState, playerKey);
        return { applied: true, from: { row, col }, to, direction: pick.direction, movedDistance, chargeGained: 0 };
    }

    function _applyVerticalCrushWill(cardState, gameState, playerKey, row, col, config) {
        const cfg = config || {};
        const pendingType = String(cfg.pendingType || '');
        const direction = Number(cfg.direction);
        const moveReason = String(cfg.moveReason || '').trim();
        const destroyReason = String(cfg.destroyReason || '').trim();
        const targetGetter = typeof cfg.targetGetter === 'function' ? cfg.targetGetter : null;

        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== pendingType || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }
        const cellValue = getCellValueForCard(gameState, row, col);
        if (cellValue === null) return { applied: false, reason: 'out_of_board' };
        if (cellValue === EMPTY) return { applied: false, reason: 'empty' };

        const targets = targetGetter ? targetGetter(cardState, gameState) : [];
        const allowed = targets.some((t) => t && t.row === row && t.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        const plan = _collectVerticalCrushMovePlan(cardState, gameState, row, col, direction);
        if (!plan) return { applied: false, reason: 'no_move_options' };

        const totalTravelDistance = Number(plan.movedDistance) || Math.abs(plan.to.row - row) || 1;
        const destroyed = [];
        for (let i = 0; i < plan.destroyed.length; i++) {
            const target = plan.destroyed[i];
            if (!target) continue;

            const collisionDistance = Math.abs(target.row - row);
            const collisionProgress = Math.max(0, Math.min(1, collisionDistance / totalTravelDistance));

            if (BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function') {
                const res = BoardOpsModule.destroyAt(
                    cardState,
                    gameState,
                    target.row,
                    target.col,
                    pendingType,
                    destroyReason,
                    {
                        sourceRow: row,
                        sourceCol: col,
                        collisionIndex: i + 1,
                        collisionCount: plan.destroyed.length,
                        collisionProgress,
                        travelDistance: totalTravelDistance,
                        travelToRow: plan.to.row,
                        travelToCol: plan.to.col
                    }
                );
                if (!isDestroyResolved(res)) {
                    return { applied: false, reason: 'destroy_failed', failedAt: { row: target.row, col: target.col } };
                }
            } else {
                const destroyedOk = destroyAt(cardState, gameState, target.row, target.col);
                if (!destroyedOk) {
                    return { applied: false, reason: 'destroy_failed', failedAt: { row: target.row, col: target.col } };
                }
            }

            destroyed.push({ row: target.row, col: target.col });
        }

        _moveMarkersForStrongWind(cardState, row, col, plan.to.row, plan.to.col);

        if (BoardOpsModule && typeof BoardOpsModule.moveAt === 'function') {
            const res = BoardOpsModule.moveAt(
                cardState,
                gameState,
                row,
                col,
                plan.to.row,
                plan.to.col,
                pendingType,
                moveReason,
                {
                    collisionCount: destroyed.length,
                    travelDistance: totalTravelDistance
                }
            );
            if (!res || !res.moved) {
                return { applied: false, reason: 'move_failed' };
            }
        } else {
            const cleared = setCellValueForCard(gameState, row, col, EMPTY);
            const placed = setCellValueForCard(gameState, plan.to.row, plan.to.col, cellValue);
            if (!cleared || !placed) {
                return { applied: false, reason: 'move_failed' };
            }
        }

        clearCardPendingEffect(cardState, playerKey);
        return {
            applied: true,
            from: { row, col },
            to: plan.to,
            destroyed,
            destroyedCount: destroyed.length,
            movedDistance: plan.movedDistance,
            direction: plan.direction
        };
    }

    function applySuperBuoyancyWill(cardState, gameState, playerKey, row, col) {
        if (CardMovementModule && typeof CardMovementModule.applySuperBuoyancyWill === 'function') {
            return CardMovementModule.applySuperBuoyancyWill(cardState, gameState, playerKey, row, col, {
                getSuperBuoyancyTargets,
                getCellValueForCard,
                hasBoardShapeCellForCard,
                isBlockedCell,
                findSpecialMarkerAt,
                destroyAt: BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function'
                    ? BoardOpsModule.destroyAt
                    : null,
                isDestroyResolved,
                destroyAtLegacy: destroyAt,
                moveAt: BoardOpsModule && typeof BoardOpsModule.moveAt === 'function'
                    ? BoardOpsModule.moveAt
                    : null,
                setCellValueForCard,
                getMarkers
            });
        }
        return _applyVerticalCrushWill(cardState, gameState, playerKey, row, col, {
            pendingType: 'SUPER_BUOYANCY_WILL',
            direction: -1,
            moveReason: 'super_buoyancy_move',
            destroyReason: 'super_buoyancy_collision',
            targetGetter: getSuperBuoyancyTargets
        });
    }

    function applySuperGravityWill(cardState, gameState, playerKey, row, col) {
        if (CardMovementModule && typeof CardMovementModule.applySuperGravityWill === 'function') {
            return CardMovementModule.applySuperGravityWill(cardState, gameState, playerKey, row, col, {
                getSuperGravityTargets,
                getCellValueForCard,
                hasBoardShapeCellForCard,
                isBlockedCell,
                findSpecialMarkerAt,
                destroyAt: BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function'
                    ? BoardOpsModule.destroyAt
                    : null,
                isDestroyResolved,
                destroyAtLegacy: destroyAt,
                moveAt: BoardOpsModule && typeof BoardOpsModule.moveAt === 'function'
                    ? BoardOpsModule.moveAt
                    : null,
                setCellValueForCard,
                getMarkers
            });
        }
        return _applyVerticalCrushWill(cardState, gameState, playerKey, row, col, {
            pendingType: 'SUPER_GRAVITY_WILL',
            direction: 1,
            moveReason: 'super_gravity_move',
            destroyReason: 'super_gravity_collision',
            targetGetter: getSuperGravityTargets
        });
    }

    function getCardHandManagerContext() {
        return {
            constants: {
                CARD_DEFS,
                CARD_TYPE_BY_ID,
                MAX_HAND_SIZE,
                RIBO_WILL_UNLOCK_TURN_INDEX
            },
            helpers: {
                hasStandardLegalMoveForPlayer,
                canUseLastResortForPlayer,
                canUseEqualityWillForPlayer,
                canUseTimeStopGodForPlayer,
                countOpponentOccupiedCornersForPlayer,
                getTemptWillTargets,
                getCaptureWillTargets,
                getStrongWindTargets,
                getSuperBuoyancyTargets,
                getSuperGravityTargets,
                getTrapTargets,
                getGuardTargets,
                getHyperactiveInheritTargets,
                getExtendLifeTargets,
                getCorrosionTargets,
                getTimeBombTargets,
                getTeleportTargets,
                getCellTeleportTargets,
                getCloneTargets,
                getSplitTargets,
                getOccupiedBoardShapeCellsForCard,
                getBoardExpansionTargets,
                getBoardExpansionGodTargets,
                getBlockadeTargets,
                getMeteorTargets,
                getFreezeTargets
            },
            modules: {
                CardDefsModule,
                CardCostsModule,
                CardSelectorsModule
            }
        };
    }

    function getCardEffectTimingContext() {
        return {
            defaultPrng,
            constants: {
                BLACK,
                WHITE,
                EMPTY,
                DRAW_INTERVAL,
                FLIP_CHARGE_MULTIPLIER_EFFECTS,
                NUMBER_CELL_CHARGE_MULTIPLIER_EFFECTS,
                ULTIMATE_DRAGON_TURNS,
                ULTIMATE_DESTROY_GOD_TURNS,
                ULTIMATE_HYPERACTIVE_TURNS,
                EXTREME_HYPERACTIVE_FLIP_EVADE_LIMIT,
                ULTIMATE_HYPERACTIVE_FLIP_EVADE_LIMIT,
                ULTIMATE_HYPERACTIVE_DESTROY_EVADE_LIMIT,
                AFTERIMAGE_WILL_FLIP_EVADE_LIMIT,
                AFTERIMAGE_WILL_DESTROY_EVADE_LIMIT,
                SNIPER_WILL_TURNS,
                DESTROY_DRAGON_TURNS,
                LIGHTNING_WILL_TURNS,
                OBSERVER_WILL_TURNS,
                GHOST_WILL_TURNS,
                WILL_HUNTER_KING_TURNS,
                ROBOT_VACUUM_TURNS,
                TIME_STOP_GOD_TURNS,
                DOUBLE_PLACE_EXTRA,
                THROW_CHAIN_CONFIG_BY_TYPE,
                MARKER_KINDS
            },
            helpers: {
                ensureHandDestroyFlags: _ensureHandDestroyFlags,
                processRiboWillTurnStartEffects,
                commitDraw,
                getSpecialMarkers,
                getCardContext,
                removeMarkersAt,
                isFrozenCellForCard,
                emitPresentationEvent,
                addChargeValue,
                addChargeWithTotal,
                addMarker,
                applyStrongWill,
                applyAbsoluteProtect,
                applyRegenWill,
                workDebugLog,
                workDebugError,
                hasBoardShapeCellForCard,
                getCellValueForCard,
                setCellValueForCard,
                clearStoneIdAtForCard
            },
            modules: {
                BoardOpsModule
            }
        };
    }

    /**
     * Turn start processing
     * @param {Object} cardState
     * @param {string} playerKey
     * @param {Object} [prng]
     */
    function onTurnStart(cardState, playerKey, gameState, prng) {
        if (!CardEffectTimingModule || typeof CardEffectTimingModule.onTurnStart !== 'function') {
            throw new Error('[cards.js] CardEffectTiming.onTurnStart not available');
        }
        return CardEffectTimingModule.onTurnStart(
            cardState,
            playerKey,
            gameState,
            prng,
            getCardEffectTimingContext()
        );
    }

    /**
     * Apply effects after placement
     * @param {Object} cardState
     * @param {Object} gameState
     * @param {string} playerKey
     * @param {number} row
     * @param {number} col
     * @param {number} flipCount
     * @returns {Object} Applied effects info
     */
    function addChargeWithTotal(cardState, playerKey, amount, meta) {
        if (CardChargeLedgerModule && typeof CardChargeLedgerModule.addChargeWithTotal === 'function') {
            return CardChargeLedgerModule.addChargeWithTotal(cardState, playerKey, amount, getChargeLedgerContext(), meta);
        }
        if (!cardState || !amount) return 0;
        if (!cardState.charge) cardState.charge = { black: 0, white: 0 };
        if (!cardState.chargeGainedTotal) cardState.chargeGainedTotal = { black: 0, white: 0 };

        const deltaRes = addChargeValue(cardState, playerKey, amount, 'placement_or_effect_gain', meta);
        const added = Number(deltaRes.delta) || 0;
        if (added > 0) {
            cardState.chargeGainedTotal[playerKey] = (cardState.chargeGainedTotal[playerKey] || 0) + added;
        }

        return added;
    }

    function applyPlacementEffects(cardState, gameState, playerKey, row, col, flipCount) {
        if (!CardEffectTimingModule || typeof CardEffectTimingModule.applyPlacementEffects !== 'function') {
            throw new Error('[cards.js] CardEffectTiming.applyPlacementEffects not available');
        }
        return CardEffectTimingModule.applyPlacementEffects(
            cardState,
            gameState,
            playerKey,
            row,
            col,
            flipCount,
            getCardEffectTimingContext()
        );
    }

    function isNormalStoneForPlayer(cardState, gameState, playerKey, row, col) {
        if (CardUtilsModule && typeof CardUtilsModule.isNormalStoneForPlayer === 'function') {
            return CardUtilsModule.isNormalStoneForPlayer(cardState, gameState, playerKey, row, col);
        }
        const P_BLACK = BLACK || 1;
        const P_WHITE = WHITE || -1;
        const playerVal = playerKey === 'black' ? P_BLACK : P_WHITE;

        if (gameState.board[row][col] !== playerVal) return false;

        const specials = getSpecialMarkers(cardState);
        if (specials.some(s => s.row === row && s.col === col)) return false;

        const bombs = getBombMarkers(cardState);
        if (bombs.some(b => b.row === row && b.col === col)) return false;

        return true;
    }

    function applyStrongWill(cardState, playerKey, row, col) {
        const existingMarker = getSpecialMarkers(cardState).find((marker) => (
            marker &&
            marker.row === row &&
            marker.col === col &&
            marker.data &&
            (marker.data.type === 'PERMA_PROTECTED' || marker.data.type === 'ABSOLUTE_PROTECTED')
        ));
        if (existingMarker && existingMarker.data && existingMarker.data.type === 'ABSOLUTE_PROTECTED') {
            return { applied: true, alreadyAbsolute: true };
        }

        const markerData = existingMarker && existingMarker.data ? { ...existingMarker.data } : {};
        markerData.type = 'PERMA_PROTECTED';
        markerData.strongWillPromotionOwnerTurnStarts = Number.isFinite(Number(markerData.strongWillPromotionOwnerTurnStarts))
            ? Math.max(0, Math.trunc(Number(markerData.strongWillPromotionOwnerTurnStarts)))
            : 0;
        markerData.strongWillPromotionThreshold = STRONG_WILL_PROMOTION_OWNER_TURNS;

        if (existingMarker) {
            existingMarker.owner = playerKey;
            existingMarker.data = markerData;
            return { applied: true };
        }

        addMarker(cardState, 'specialStone', row, col, playerKey, markerData);
        return { applied: true };
    }

    function applyAbsoluteProtect(cardState, playerKey, row, col) {
        const existingMarker = getSpecialMarkers(cardState).find((marker) => (
            marker &&
            marker.row === row &&
            marker.col === col &&
            marker.data &&
            (marker.data.type === 'ABSOLUTE_PROTECTED' || marker.data.type === 'PERMA_PROTECTED')
        ));
        if (existingMarker) {
            const markerData = existingMarker.data ? { ...existingMarker.data } : {};
            markerData.type = 'ABSOLUTE_PROTECTED';
            delete markerData.strongWillPromotionOwnerTurnStarts;
            delete markerData.strongWillPromotionThreshold;
            existingMarker.owner = playerKey;
            existingMarker.data = markerData;
        } else {
            addMarker(cardState, 'specialStone', row, col, playerKey, {
                type: 'ABSOLUTE_PROTECTED'
            });
        }
        return { applied: true };
    }

    /**
     * Apply REGEN_WILL (next placed stone becomes regen stone)
     */
    function applyRegenWill(cardState, playerKey, row, col) {
        // Delegate to module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/regen');
            return mod.applyRegenWill(cardState, playerKey, row, col, { addMarker, BLACK, WHITE });
        }
        // Browser: use global
        if (typeof CardRegen !== 'undefined' && typeof CardRegen.applyRegenWill === 'function') {
            return CardRegen.applyRegenWill(cardState, playerKey, row, col, { addMarker, BLACK, WHITE });
        }
        console.warn('[cards.js] CardRegen.applyRegenWill not available');
        return { applied: false };
    }


    /**
     * Resolve regen behavior for a set of flips (after board has been updated to newColor).
     * Delegates to cards/regen.js module.
     */
    function applyRegenAfterFlips(cardState, gameState, flips, flipperKey, skipCapture) {
        // Delegate to module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/regen');
            return mod.applyRegenAfterFlips(cardState, gameState, flips, flipperKey, skipCapture, {
                getCardContext,
                clearBombAt,
                removeMarkersAt,
                BoardOps: BoardOpsModule
            });
        }
        // Browser: use global
        if (typeof CardRegen !== 'undefined' && typeof CardRegen.applyRegenAfterFlips === 'function') {
            return CardRegen.applyRegenAfterFlips(cardState, gameState, flips, flipperKey, skipCapture, {
                getCardContext,
                clearBombAt,
                removeMarkersAt,
                BoardOps: BoardOpsModule
            });
        }
        console.warn('[cards.js] CardRegen module not available');
        return { regened: [], captureFlips: [] };
    }


    /**
     * Apply SELL_CARD_WILL (売却の意志)
     * Sell exactly one card from own hand and gain charge equal to its cost.
     * @param {Object} cardState
     * @param {string} playerKey
     * @param {string} soldCardId
     * @returns {{applied:boolean, reason?:string, gained?:number}}
     */
    function applySellCardWill(cardState, playerKey, soldCardId) {
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'SELL_CARD_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'pending_not_found' };
        }
        if (!soldCardId || !cardState.hands || !Array.isArray(cardState.hands[playerKey])) {
            return { applied: false, reason: 'invalid_target' };
        }
        const idx = cardState.hands[playerKey].indexOf(soldCardId);
        if (idx === -1) {
            return { applied: false, reason: '手札にないカードは売却できません' };
        }

        const removed = removeHandCardAt(cardState, playerKey, idx);
        if (!removed) {
            return { applied: false, reason: '手札にないカードは売却できません' };
        }
        addCardToDiscard(cardState, removed.cardId, removed.cardCopyId);

        const gainBase = getCardCost(soldCardId);
        const gained = addChargeWithTotal(cardState, playerKey, gainBase);
        clearCardPendingEffect(cardState, playerKey);
        return { applied: true, soldCardId, gained };
    }

    /**
     * Apply HEAVEN_BLESSING (天の恵み)
     * Select exactly one offered card and add it to hand.
     * Non-selected offers are removed (not discarded).
     * @param {Object} cardState
     * @param {string} playerKey
     * @param {string} selectedCardId
     * @returns {{applied:boolean, reason?:string, selectedCardId?:string, vanished?:string[]}}
     */
    function applyHeavenBlessingChoice(cardState, playerKey, selectedCardId) {
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'HEAVEN_BLESSING' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'pending_not_found' };
        }

        const offers = Array.isArray(pending.offers) ? pending.offers.slice() : [];
        if (!offers.length) {
            clearCardPendingEffect(cardState, playerKey);
            return { applied: false, reason: 'offers_not_found' };
        }
        if (!selectedCardId || !offers.includes(selectedCardId)) {
            return { applied: false, reason: 'invalid_target' };
        }
        if (!cardState.hands || !Array.isArray(cardState.hands[playerKey])) {
            return { applied: false, reason: 'invalid_hand' };
        }
        if (cardState.hands[playerKey].length >= MAX_HAND_SIZE) {
            return { applied: false, reason: 'hand_full' };
        }

        const added = addCardToHand(cardState, playerKey, selectedCardId);
        if (!added) {
            return { applied: false, reason: 'hand_full' };
        }
        const vanished = offers.filter(id => id !== selectedCardId);
        clearCardPendingEffect(cardState, playerKey);
        return { applied: true, selectedCardId, vanished };
    }

    /**
     * Apply REVEAL_HAND_WILL (観測の意志)
     * Reveal the opponent hand as it exists at use time for the acting viewer only.
     * @param {Object} cardState
     * @param {string} playerKey
     * @returns {{applied:boolean, reason?:string, opponentKey?:string, revealedCount?:number}}
     */
    function applyRevealHandWill(cardState, playerKey) {
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'REVEAL_HAND_WILL' || pending.stage !== null) {
            return { applied: false, reason: 'pending_not_found' };
        }

        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        const opponentHand = (cardState.hands && Array.isArray(cardState.hands[opponentKey])) ? cardState.hands[opponentKey] : null;
        if (!opponentHand) {
            return { applied: false, reason: 'invalid_hand' };
        }
        if (opponentHand.length <= 0) {
            clearCardPendingEffect(cardState, playerKey);
            return { applied: false, reason: 'opponent_hand_empty', opponentKey, revealedCount: 0 };
        }

        const revealedCopyIds = revealCurrentHandToViewer(cardState, playerKey, opponentKey);
        clearCardPendingEffect(cardState, playerKey);
        return {
            applied: true,
            opponentKey,
            revealedCount: revealedCopyIds.length
        };
    }

    /**
     * Apply CONDEMN_WILL (断罪の意志)
     * Reveal opponent hand and destroy exactly one selected card.
     * @param {Object} cardState
     * @param {string} playerKey
     * @param {number} targetIndex
     * @returns {{applied:boolean, reason?:string, destroyedCardId?:string}}
     */
    function applyCondemnWill(cardState, playerKey, targetIndex) {
        const parseHiddenHandToken = (value) => {
            if (typeof value !== 'string') return null;
            const m = /^__hidden_hand__:(black|white):(\d+)$/.exec(value);
            if (!m) return null;
            return { owner: m[1], handIndex: Number(m[2]) };
        };
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'CONDEMN_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'pending_not_found' };
        }

        const offers = Array.isArray(pending.offers) ? pending.offers.slice() : [];
        if (!offers.length) {
            clearCardPendingEffect(cardState, playerKey);
            return { applied: false, reason: 'offers_not_found' };
        }

        if (!Number.isInteger(targetIndex)) {
            return { applied: false, reason: 'invalid_target' };
        }
        const offer = offers.find(o => o && Number.isInteger(o.handIndex) && o.handIndex === targetIndex);
        if (!offer || !offer.cardId) {
            return { applied: false, reason: 'invalid_target' };
        }

        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        const opponentHand = (cardState.hands && Array.isArray(cardState.hands[opponentKey])) ? cardState.hands[opponentKey] : null;
        if (!opponentHand) {
            return { applied: false, reason: 'invalid_hand' };
        }
        if (targetIndex < 0 || targetIndex >= opponentHand.length) {
            return { applied: false, reason: 'invalid_target' };
        }
        const removed = removeHandCardAt(cardState, opponentKey, targetIndex);
        if (!removed) {
            return { applied: false, reason: 'invalid_target' };
        }
        const handCardId = removed.cardId;
        const handToken = parseHiddenHandToken(handCardId);
        const offerToken = parseHiddenHandToken(offer.cardId);
        const destroyedCardId = handToken && !offerToken ? offer.cardId : handCardId;
        addCardToDiscard(cardState, handCardId, removed.cardCopyId);
        clearCardPendingEffect(cardState, playerKey);

        return { applied: true, destroyedCardId };
    }

    function getDirectionalChainFlips(gameState, row, col, ownerVal, dir, context) {
        // Delegate to module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/flips');
            return mod.getDirectionalChainFlips(gameState, row, col, ownerVal, dir, context);
        }
        // Browser: use global
        if (typeof CardFlips !== 'undefined' && typeof CardFlips.getDirectionalChainFlips === 'function') {
            return CardFlips.getDirectionalChainFlips(gameState, row, col, ownerVal, dir, context);
        }
        console.warn('[cards.js] CardFlips.getDirectionalChainFlips not available');
        return [];
    }

    function getTabooReverseDirectionalFlips(gameState, row, col, ownerVal, direction, context = {}) {
        const blockedCells = context.blockedCells || [];
        const absoluteProtectedStones = context.absoluteProtectedStones || [];

        const blockedSet = blockedCells.length
            ? new Set(blockedCells.map(p => `${p.row},${p.col}`))
            : null;
        const absoluteSet = absoluteProtectedStones.length
            ? new Set(absoluteProtectedStones.map((p) => `${p.row},${p.col}`))
            : null;

        const [dr, dc] = direction;
        const flips = [];
        let r = row + dr;
        let c = col + dc;

        while (getCellValueForCard(gameState, r, c) === -ownerVal) {
            const key = `${r},${c}`;
            if (blockedSet && blockedSet.has(key)) {
                return [];
            }
            if (!(absoluteSet && absoluteSet.has(key))) {
                flips.push({ row: r, col: c });
            }
            r += dr;
            c += dc;
        }

        const tail = getCellValueForCard(gameState, r, c);
        if (blockedSet && blockedSet.has(`${r},${c}`)) {
            return [];
        }
        if (tail === ownerVal) {
            return [];
        }

        return flips;
    }

    function getTabooReverseCandidates(cardState, gameState, playerKey, row, col) {
        if (!gameState || !Array.isArray(gameState.board)) return [];
        if (!Number.isInteger(row) || !Number.isInteger(col)) return [];

        const targetValue = getCellValueForCard(gameState, row, col);
        if (targetValue !== EMPTY) return [];

        const context = getCardContext(cardState);
        const blockedCells = (context && Array.isArray(context.blockedCells)) ? context.blockedCells : [];
        const blockedSet = blockedCells.length
            ? new Set(blockedCells.map((p) => `${p.row},${p.col}`))
            : null;
        if (blockedSet && blockedSet.has(`${row},${col}`)) return [];

        const ownerKey = playerKey === 'white' ? 'white' : 'black';
        const ownerVal = ownerKey === 'black' ? (BLACK || 1) : (WHITE || -1);

        const candidates = [];
        for (const direction of (DIRECTIONS || [])) {
            if (!Array.isArray(direction) || direction.length !== 2) continue;
            const flips = getTabooReverseDirectionalFlips(gameState, row, col, ownerVal, direction, context);
            if (!Array.isArray(flips) || flips.length === 0) continue;
            candidates.push({
                direction: [direction[0], direction[1]],
                flips,
                score: flips.length
            });
        }
        return candidates;
    }

    function pickTabooReverseFlips(cardState, gameState, playerKey, row, col, prng) {
        const candidates = getTabooReverseCandidates(cardState, gameState, playerKey, row, col);
        if (candidates.length === 0) {
            return { applied: false, flips: [], direction: null, score: 0 };
        }

        const maxScore = candidates.reduce((max, one) => Math.max(max, Number(one && one.score) || 0), 0);
        const topCandidates = candidates.filter((one) => (Number(one && one.score) || 0) === maxScore);

        const randomSource = (prng && typeof prng.random === 'function') ? prng : { random: Math.random };
        const rawIndex = Math.floor(randomSource.random() * topCandidates.length);
        const index = Number.isInteger(rawIndex)
            ? Math.max(0, Math.min(topCandidates.length - 1, rawIndex))
            : 0;
        const chosen = topCandidates[index] || topCandidates[0];

        return {
            applied: true,
            flips: (chosen.flips || []).map((pos) => ({ row: pos.row, col: pos.col })),
            direction: chosen.direction ? [chosen.direction[0], chosen.direction[1]] : null,
            score: Number(chosen.score) || 0
        };
    }


    function applyChainWillAfterMove(cardState, gameState, playerKey, primaryFlips, prng) {
        const pending = readCardPendingEffect(cardState, playerKey);
        const chainConfig = pending ? getChainWillConfig(pending.type) : null;
        if (!pending || !chainConfig) {
            return { applied: false, flips: [], chosen: null };
        }

        const ownerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const context = getCardContext(cardState);
        const p = prng || defaultPrng;

        function runChainLinks(findChainChoiceFn) {
            const appliedFlips = [];
            const chosenSteps = [];
            let sourceFlips = Array.isArray(primaryFlips) ? primaryFlips.slice() : [];
            const maxLinks = resolveChainWillMaxLinks(gameState, chainConfig);
            for (let i = 0; i < maxLinks; i++) {
                const res = findChainChoiceFn(gameState, sourceFlips, ownerVal, context, p);
                if (!res || !res.applied || !Array.isArray(res.flips) || res.flips.length === 0) break;
                const chainLink = i + 1;
                const appliedThisLink = [];
                for (const pos of res.flips) {
                    let changed = true;
                    if (BoardOpsModule && typeof BoardOpsModule.changeAt === 'function') {
                        const changeRes = BoardOpsModule.changeAt(cardState, gameState, pos.row, pos.col, playerKey, CHAIN_WILL_EVENT_CAUSE, 'chain_flip', { chainLink });
                        changed = !!(changeRes && changeRes.changed);
                    } else {
                        gameState.board[pos.row][pos.col] = ownerVal;
                    }
                    if (!changed) continue;
                    clearBombAt(cardState, pos.row, pos.col);
                    const appliedPos = { row: pos.row, col: pos.col };
                    appliedThisLink.push(appliedPos);
                    appliedFlips.push(appliedPos);
                }
                if (appliedThisLink.length > 0) {
                    clearHyperactiveAtPositions(cardState, appliedThisLink);
                    chosenSteps.push(res.chosen || null);
                }
                sourceFlips = appliedThisLink;
                if (sourceFlips.length === 0) break;
            }
            if (appliedFlips.length === 0) return { applied: false, flips: [], chosen: null, chosenSteps: [] };
            return { applied: true, flips: appliedFlips, chosen: chosenSteps[chosenSteps.length - 1] || null, chosenSteps };
        }

        // Delegate to chain module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/chain');
            if (mod && typeof mod.findChainChoice === 'function') {
                return runChainLinks(mod.findChainChoice);
            }
        }
        // Browser: use global
        if (typeof CardChain !== 'undefined' && typeof CardChain.findChainChoice === 'function') {
            return runChainLinks(CardChain.findChainChoice);
        }
        console.warn('[cards.js] CardChain module not available');
        return { applied: false, flips: [], chosen: null };
    }




    /**
    * Process Bomb countdowns
    * Delegates to cards/time_bomb.js module.
    */
    function tickBombs(cardState, gameState, playerKey) {
        // Delegate to module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/time_bomb');
            return mod.tickBombs(cardState, gameState, playerKey, { BoardOps: BoardOpsModule, destroyAt });
        }
        // Browser: use global
        if (typeof CardTimeBomb !== 'undefined' && typeof CardTimeBomb.tickBombs === 'function') {
            return CardTimeBomb.tickBombs(cardState, gameState, playerKey, { BoardOps: BoardOpsModule, destroyAt });
        }
        console.warn('[cards.js] CardTimeBomb module not available');
        return { exploded: [], destroyed: [] };
    }

    /**
     * Tick a single bomb (by object) at turn start. Delegates to time_bomb_single if available.
     */
    function tickBombAt(cardState, gameState, bomb, activeKey) {
        if (!bomb) return { exploded: [], destroyed: [], removed: false };
        if (typeof module === 'object' && module.exports) {
            try {
                const mod = require('./cards/time_bomb');
                if (mod && typeof mod.tickBombAt === 'function') return mod.tickBombAt(cardState, gameState, bomb, activeKey, { BoardOps: BoardOpsModule, destroyAt });
            } catch (e) { /* ignore */ }
        }
        if (typeof CardTimeBomb !== 'undefined' && typeof CardTimeBomb.tickBombAt === 'function') {
            return CardTimeBomb.tickBombAt(cardState, gameState, bomb, activeKey, { BoardOps: BoardOpsModule, destroyAt });
        }
        // Fallback: emulate tick for single bomb
        const bombs = getBombMarkers(cardState);
        const idx = bombs.findIndex(b => (bomb.id && b.id === bomb.id) || (b.row === bomb.row && b.col === bomb.col && b.owner === bomb.owner && b.createdSeq === bomb.createdSeq));
        if (idx === -1) return { exploded: [], destroyed: [], removed: false };
        const b = bombs[idx];
        if (activeKey && b.owner !== activeKey) return { exploded: [], destroyed: [], removed: false };
        if (b.data && b.data.placedTurn === cardState.turnIndex) return { exploded: [], destroyed: [], removed: false };
        if (!b.data) b.data = {};
        b.data.remainingTurns = (typeof b.data.remainingTurns === 'number') ? b.data.remainingTurns - 1 : -1;
        if (b.data.remainingTurns <= 0) {
            const exploded = [{ row: b.row, col: b.col }];
            const destroyed = [];
            const targets = [];
            const forbiddenEvadeCells = [];
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const r = b.row + dr;
                    const c = b.col + dc;
                    if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
                    forbiddenEvadeCells.push({ row: r, col: c });
                    if (gameState.board[r][c] === EMPTY) continue;
                    targets.push({ row: r, col: c });
                }
            }
            for (const target of targets) {
                let destroyedRes = false;
                if (BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function') {
                    const res = BoardOpsModule.destroyAt(cardState, gameState, target.row, target.col, 'TIME_BOMB', 'bomb_explosion', {
                        forbiddenEvadeCells
                    });
                    destroyedRes = !!(res && res.destroyed);
                } else {
                    destroyedRes = destroyAt(cardState, gameState, target.row, target.col);
                }
                if (destroyedRes) destroyed.push({ row: target.row, col: target.col });
            }
            if (typeof removeMarkerById === 'function' && b.id !== undefined) {
                removeMarkerById(cardState, b.id);
            } else {
                removeMarkersAt(cardState, b.row, b.col, { category: MARKER_CATEGORIES.BOMB, owner: b.owner });
            }
            return { exploded, destroyed, removed: true };
        }
        return { exploded: [], destroyed: [], removed: false };
    }


    /**
     * Process Dragon effects
     * @param {Object} cardState
     * @param {Object} gameState
     * @param {string} playerKey - Current player
     * @returns {Object} { converted: [...], destroyed: [...] }
     */
    function processDragonEffects(cardState, gameState, playerKey) {
        const dragonDeps = {
            BoardOps: BoardOpsModule,
            getCardContext,
            selectRandomEmptyBoardShapeDestination,
            moveCoexistingSpecialMarkers
        };
        // Delegate to effects module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./effects/dragon');
            return mod.processDragonEffects(cardState, gameState, playerKey, dragonDeps);
        }
        // Browser: use global
        if (typeof DragonEffects !== 'undefined' && typeof DragonEffects.processDragonEffects === 'function') {
            return DragonEffects.processDragonEffects(cardState, gameState, playerKey, dragonDeps);
        }
        // Fallback: no-op
        console.warn('[cards.js] DragonEffects module not available');
        return { converted: [], destroyed: [], anchors: [] };
    }


    /**
     * Process a single DRAGON anchor immediately (placement-turn immediate fire).
     * Does NOT decrement remainingOwnerTurns (only owner turn starts decrement).
     * @returns {Object} { converted: [...], destroyed: [...] }
     */
    function processDragonEffectsAtAnchor(cardState, gameState, playerKey, row, col) {
        const dragonDeps = {
            BoardOps: BoardOpsModule,
            getCardContext,
            selectRandomEmptyBoardShapeDestination,
            moveCoexistingSpecialMarkers
        };
        // Delegate to effects module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./effects/dragon');
            return mod.processDragonEffectsAtAnchor(cardState, gameState, playerKey, row, col, dragonDeps);
        }
        // Browser: use global
        if (typeof DragonEffects !== 'undefined' && typeof DragonEffects.processDragonEffectsAtAnchor === 'function') {
            return DragonEffects.processDragonEffectsAtAnchor(cardState, gameState, playerKey, row, col, dragonDeps);
        }
        // Fallback: no-op
        console.warn('[cards.js] DragonEffects module not available');
        return { converted: [], destroyed: [] };
    }

    function processDragonEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, opts = {}) {
        const dragonDeps = Object.assign({
            BoardOps: BoardOpsModule,
            getCardContext,
            selectRandomEmptyBoardShapeDestination,
            moveCoexistingSpecialMarkers
        }, opts);
        if (typeof module === 'object' && module.exports) {
            try {
                const mod = require('./effects/dragon');
                if (mod && typeof mod.processDragonEffectsAtTurnStartAnchor === 'function') {
                    return mod.processDragonEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, dragonDeps);
                }
            } catch (e) { /* ignore */ }
        }
        if (typeof DragonEffects !== 'undefined' && typeof DragonEffects.processDragonEffectsAtTurnStartAnchor === 'function') {
            return DragonEffects.processDragonEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, dragonDeps);
        }
        console.warn('[cards.js] DragonEffects turn-start anchor processor not available');
        return { moved: [], converted: [], destroyed: [], anchors: [] };
    }


    /**
     * Process ULTIMATE_DESTROY_GOD effects at owner turn start.
     * Delegates to cards/udg.js module.
     */
    function processUltimateDestroyGodEffects(cardState, gameState, playerKey) {
        const deps = {
            destroyAt,
            BoardOps: BoardOpsModule,
            selectRandomEmptyBoardShapeDestination,
            moveCoexistingSpecialMarkers
        };
        // Delegate to module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/udg');
            return mod.processUltimateDestroyGodEffects(cardState, gameState, playerKey, deps);
        }
        // Browser: use global
        if (typeof CardUdG !== 'undefined' && typeof CardUdG.processUltimateDestroyGodEffects === 'function') {
            return CardUdG.processUltimateDestroyGodEffects(cardState, gameState, playerKey, deps);
        }
        console.warn('[cards.js] CardUdG module not available');
        return { destroyed: [], anchors: [], expired: [] };
    }


    /**
     * Immediate placement-turn activation for UDG anchor.
     * Delegates to cards/udg.js module.
     */
    function processUltimateDestroyGodEffectsAtAnchor(cardState, gameState, playerKey, row, col, opts = {}) {
        // Delegate to module
        const deps = Object.assign({
            destroyAt,
            BoardOps: BoardOpsModule,
            selectRandomEmptyBoardShapeDestination,
            moveCoexistingSpecialMarkers
        }, opts);
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/udg');
            return mod.processUltimateDestroyGodEffectsAtAnchor(cardState, gameState, playerKey, row, col, deps);
        }
        // Browser: use global
        if (typeof CardUdG !== 'undefined' && typeof CardUdG.processUltimateDestroyGodEffectsAtAnchor === 'function') {
            return CardUdG.processUltimateDestroyGodEffectsAtAnchor(cardState, gameState, playerKey, row, col, deps);
        }
        console.warn('[cards.js] CardUdG module not available');
        return { destroyed: [] };
    }

    function processUltimateDestroyGodEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, opts = {}) {
        const deps = Object.assign({
            destroyAt,
            BoardOps: BoardOpsModule,
            selectRandomEmptyBoardShapeDestination,
            moveCoexistingSpecialMarkers
        }, opts);
        if (typeof module === 'object' && module.exports) {
            try {
                const mod = require('./cards/udg');
                if (mod && typeof mod.processUltimateDestroyGodEffectsAtTurnStartAnchor === 'function') {
                    return mod.processUltimateDestroyGodEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, deps);
                }
            } catch (e) { /* ignore */ }
        }
        if (typeof CardUdG !== 'undefined' && typeof CardUdG.processUltimateDestroyGodEffectsAtTurnStartAnchor === 'function') {
            return CardUdG.processUltimateDestroyGodEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, deps);
        }
        console.warn('[cards.js] CardUdG turn-start anchor processor not available');
        return { moved: [], destroyed: [], anchors: [], expired: [] };
    }

    let cachedSniperModule = undefined;
    function resolveSniperModule() {
        if (cachedSniperModule !== undefined) return cachedSniperModule;
        cachedSniperModule = null;
        if (!(typeof module === 'object' && module.exports && typeof require === 'function')) {
            return cachedSniperModule;
        }

        const normalize = (mod) => {
            if (!mod || typeof mod !== 'object') return null;
            if (mod.default && typeof mod.default === 'object') {
                mod = Object.assign({}, mod.default, mod);
            }
            if (
                typeof mod.processSniperWillEffects === 'function' ||
                typeof mod.processSniperWillEffectsAtTurnStartAnchor === 'function'
            ) {
                return mod;
            }
            return null;
        };

        try {
            cachedSniperModule = normalize(require('./cards/sniper'));
        } catch (e) {
            cachedSniperModule = null;
        }
        if (cachedSniperModule) return cachedSniperModule;

        try {
            const pathMod = require('path');
            const absPath = pathMod.resolve(__dirname, 'cards', 'sniper.js');
            cachedSniperModule = normalize(require(absPath));
        } catch (e) {
            cachedSniperModule = null;
        }
        return cachedSniperModule;
    }

    function processSniperWillEffects(cardState, gameState, playerKey, prng) {
        const mod = resolveSniperModule();
        if (mod && typeof mod.processSniperWillEffects === 'function') {
            return mod.processSniperWillEffects(cardState, gameState, playerKey, {
                destroyAt,
                BoardOps: BoardOpsModule,
                random: prng || defaultPrng
            });
        }
        if (typeof CardSniper !== 'undefined' && typeof CardSniper.processSniperWillEffects === 'function') {
            return CardSniper.processSniperWillEffects(cardState, gameState, playerKey, {
                destroyAt,
                BoardOps: BoardOpsModule,
                random: prng || defaultPrng
            });
        }
        console.warn('[cards.js] CardSniper module not available');
        return { destroyed: [], anchors: [], expired: [] };
    }

    function processSniperWillEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, prngOrOpts) {
        const normalizeRandomSource = (value, fallback) => {
            if (value && typeof value.random === 'function') return value;
            if (typeof value === 'function') return { random: value };
            return fallback;
        };
        const fallbackRandom = { random: Math.random };
        const hasOptionShape = !!(prngOrOpts && typeof prngOrOpts === 'object' && (
            Object.prototype.hasOwnProperty.call(prngOrOpts, 'random') ||
            Object.prototype.hasOwnProperty.call(prngOrOpts, 'decrementRemainingOwnerTurns') ||
            Object.prototype.hasOwnProperty.call(prngOrOpts, 'destroyAt') ||
            Object.prototype.hasOwnProperty.call(prngOrOpts, 'BoardOps')
        ));
        const deps = hasOptionShape
            ? Object.assign({ destroyAt, BoardOps: BoardOpsModule, random: defaultPrng }, prngOrOpts)
            : { destroyAt, BoardOps: BoardOpsModule, random: prngOrOpts || defaultPrng };
        const randomCandidate = (
            hasOptionShape &&
            prngOrOpts &&
            Object.prototype.hasOwnProperty.call(prngOrOpts, 'random')
        )
            ? prngOrOpts.random
            : prngOrOpts;
        deps.random = normalizeRandomSource(randomCandidate, fallbackRandom);

        const mod = resolveSniperModule();
        if (mod && typeof mod.processSniperWillEffectsAtTurnStartAnchor === 'function') {
            return mod.processSniperWillEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, deps);
        }
        if (typeof CardSniper !== 'undefined' && typeof CardSniper.processSniperWillEffectsAtTurnStartAnchor === 'function') {
            return CardSniper.processSniperWillEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, deps);
        }
        console.warn('[cards.js] CardSniper turn-start anchor processor not available');
        return { destroyed: [], expired: [] };
    }
    let cachedLightningModule = undefined;
    function resolveLightningModule() {
        if (cachedLightningModule !== undefined) return cachedLightningModule;
        cachedLightningModule = null;
        if (!(typeof module === 'object' && module.exports && typeof require === 'function')) {
            return cachedLightningModule;
        }

        const normalize = (mod) => {
            if (!mod || typeof mod !== 'object') return null;
            if (mod.default && typeof mod.default === 'object') {
                mod = Object.assign({}, mod.default, mod);
            }
            if (
                typeof mod.processLightningWillEffects === 'function' ||
                typeof mod.processLightningWillEffectsAtAnchor === 'function' ||
                typeof mod.processLightningWillEffectsAtTurnStartAnchor === 'function'
            ) {
                return mod;
            }
            return null;
        };

        try {
            cachedLightningModule = normalize(require('./cards/lightning'));
        } catch (e) {
            cachedLightningModule = null;
        }
        if (cachedLightningModule) return cachedLightningModule;

        try {
            const pathMod = require('path');
            const absPath = pathMod.resolve(__dirname, 'cards', 'lightning.js');
            cachedLightningModule = normalize(require(absPath));
        } catch (e) {
            cachedLightningModule = null;
        }
        return cachedLightningModule;
    }

    function processLightningWillEffects(cardState, gameState, playerKey, prng) {
        const mod = resolveLightningModule();
        if (mod && typeof mod.processLightningWillEffects === 'function') {
            return mod.processLightningWillEffects(cardState, gameState, playerKey, {
                destroyAt,
                BoardOps: BoardOpsModule,
                random: prng || defaultPrng
            });
        }
        if (typeof CardLightning !== 'undefined' && typeof CardLightning.processLightningWillEffects === 'function') {
            return CardLightning.processLightningWillEffects(cardState, gameState, playerKey, {
                destroyAt,
                BoardOps: BoardOpsModule,
                random: prng || defaultPrng
            });
        }
        console.warn('[cards.js] CardLightning module not available');
        return { destroyed: [], anchors: [], expired: [] };
    }

    function processLightningWillEffectsAtAnchor(cardState, gameState, playerKey, row, col, prngOrOpts) {
        const normalizeRandomSource = (value, fallback) => {
            if (value && typeof value.random === 'function') return value;
            if (typeof value === 'function') return { random: value };
            return fallback;
        };
        const fallbackRandom = { random: Math.random };
        const hasOptionShape = !!(prngOrOpts && typeof prngOrOpts === 'object' && (
            Object.prototype.hasOwnProperty.call(prngOrOpts, 'random') ||
            Object.prototype.hasOwnProperty.call(prngOrOpts, 'decrementRemainingOwnerTurns') ||
            Object.prototype.hasOwnProperty.call(prngOrOpts, 'destroyAt') ||
            Object.prototype.hasOwnProperty.call(prngOrOpts, 'BoardOps')
        ));
        const deps = hasOptionShape
            ? Object.assign({ destroyAt, BoardOps: BoardOpsModule, random: defaultPrng }, prngOrOpts)
            : { destroyAt, BoardOps: BoardOpsModule, random: prngOrOpts || defaultPrng };
        const randomCandidate = (
            hasOptionShape &&
            prngOrOpts &&
            Object.prototype.hasOwnProperty.call(prngOrOpts, 'random')
        )
            ? prngOrOpts.random
            : prngOrOpts;
        deps.random = normalizeRandomSource(randomCandidate, fallbackRandom);

        const mod = resolveLightningModule();
        if (mod && typeof mod.processLightningWillEffectsAtAnchor === 'function') {
            return mod.processLightningWillEffectsAtAnchor(cardState, gameState, playerKey, row, col, deps);
        }
        if (mod && typeof mod.processLightningWillEffectsAtTurnStartAnchor === 'function') {
            return mod.processLightningWillEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, deps);
        }
        if (typeof CardLightning !== 'undefined' && typeof CardLightning.processLightningWillEffectsAtAnchor === 'function') {
            return CardLightning.processLightningWillEffectsAtAnchor(cardState, gameState, playerKey, row, col, deps);
        }
        if (typeof CardLightning !== 'undefined' && typeof CardLightning.processLightningWillEffectsAtTurnStartAnchor === 'function') {
            return CardLightning.processLightningWillEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, deps);
        }
        console.warn('[cards.js] CardLightning anchor processor not available');
        return { destroyed: [], expired: [] };
    }

    function processLightningWillEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, prngOrOpts) {
        return processLightningWillEffectsAtAnchor(cardState, gameState, playerKey, row, col, prngOrOpts);
    }

    let cachedWillHunterKingModule = undefined;
    function resolveWillHunterKingModule() {
        if (cachedWillHunterKingModule !== undefined) return cachedWillHunterKingModule;
        cachedWillHunterKingModule = null;
        if (!(typeof module === 'object' && module.exports && typeof require === 'function')) {
            return cachedWillHunterKingModule;
        }

        const normalize = (mod) => {
            if (!mod || typeof mod !== 'object') return null;
            if (mod.default && typeof mod.default === 'object') {
                mod = Object.assign({}, mod.default, mod);
            }
            if (typeof mod.processWillHunterKingEffectsAtTurnStartAnchor === 'function') {
                return mod;
            }
            return null;
        };

        try {
            cachedWillHunterKingModule = normalize(require('./cards/will_hunter_king'));
        } catch (e) {
            cachedWillHunterKingModule = null;
        }
        if (cachedWillHunterKingModule) return cachedWillHunterKingModule;

        try {
            const pathMod = require('path');
            const absPath = pathMod.resolve(__dirname, 'cards', 'will_hunter_king.js');
            cachedWillHunterKingModule = normalize(require(absPath));
        } catch (e) {
            cachedWillHunterKingModule = null;
        }
        return cachedWillHunterKingModule;
    }

    function processWillHunterKingEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, prngOrOpts) {
        const normalizeRandomSource = (value, fallback) => {
            if (value && typeof value.random === 'function') return value;
            if (typeof value === 'function') return { random: value };
            return fallback;
        };
        const fallbackRandom = { random: Math.random };
        const hasOptionShape = !!(prngOrOpts && typeof prngOrOpts === 'object' && (
            Object.prototype.hasOwnProperty.call(prngOrOpts, 'random') ||
            Object.prototype.hasOwnProperty.call(prngOrOpts, 'decrementRemainingOwnerTurns') ||
            Object.prototype.hasOwnProperty.call(prngOrOpts, 'BoardOps')
        ));
        const deps = hasOptionShape
            ? Object.assign({ BoardOps: BoardOpsModule, random: defaultPrng, decrementRemainingOwnerTurns: true }, prngOrOpts)
            : { BoardOps: BoardOpsModule, random: prngOrOpts || defaultPrng, decrementRemainingOwnerTurns: true };
        const randomCandidate = (
            hasOptionShape &&
            prngOrOpts &&
            Object.prototype.hasOwnProperty.call(prngOrOpts, 'random')
        )
            ? prngOrOpts.random
            : prngOrOpts;
        deps.random = normalizeRandomSource(randomCandidate, fallbackRandom);

        const mod = resolveWillHunterKingModule();
        if (mod && typeof mod.processWillHunterKingEffectsAtTurnStartAnchor === 'function') {
            return mod.processWillHunterKingEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, deps);
        }
        if (typeof CardWillHunterKing !== 'undefined' && typeof CardWillHunterKing.processWillHunterKingEffectsAtTurnStartAnchor === 'function') {
            return CardWillHunterKing.processWillHunterKingEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, deps);
        }
        console.warn('[cards.js] CardWillHunterKing turn-start anchor processor not available');
        return { moved: [], destroyed: [], expired: [] };
    }

    function processObserverWillEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, prngOrOpts) {
        const normalizeRandomSource = (value, fallback) => {
            if (value && typeof value.random === 'function') return value;
            if (typeof value === 'function') return { random: value };
            return fallback;
        };
        const fallbackRandom = { random: Math.random };
        const hasOptionShape = !!(prngOrOpts && typeof prngOrOpts === 'object' && (
            Object.prototype.hasOwnProperty.call(prngOrOpts, 'random') ||
            Object.prototype.hasOwnProperty.call(prngOrOpts, 'decrementRemainingOwnerTurns')
        ));
        const opts = hasOptionShape
            ? Object.assign({ random: defaultPrng, decrementRemainingOwnerTurns: true }, prngOrOpts)
            : { random: prngOrOpts || defaultPrng, decrementRemainingOwnerTurns: true };
        const randomCandidate = (
            hasOptionShape &&
            prngOrOpts &&
            Object.prototype.hasOwnProperty.call(prngOrOpts, 'random')
        )
            ? prngOrOpts.random
            : prngOrOpts;
        opts.random = normalizeRandomSource(randomCandidate, fallbackRandom);

        const result = {
            activated: false,
            triggered: false,
            gained: 0,
            remainingOwnerTurns: null,
            expired: []
        };

        if (!cardState || !gameState) return result;

        const marker = getSpecialMarkers(cardState).find((entry) => {
            if (!entry || entry.row !== row || entry.col !== col) return false;
            if (entry.owner !== playerKey) return false;
            const data = entry.data || {};
            return String(data.type || '').toUpperCase() === 'OBSERVER';
        });
        if (!marker) return result;

        const ownerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const boardRow = Array.isArray(gameState.board) ? gameState.board[row] : null;
        const cellValue = Array.isArray(boardRow) ? boardRow[col] : null;

        result.activated = true;
        if (cellValue !== ownerVal) {
            removeMarkersAt(cardState, row, col, {
                kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone',
                type: 'OBSERVER',
                owner: playerKey
            });
            result.remainingOwnerTurns = 0;
            result.expired.push({ row, col, owner: playerKey, reason: 'anchor_lost' });
            return result;
        }

        const randomSource = (() => {
            if (opts && typeof opts.random === 'function') {
                return { random: opts.random };
            }
            if (opts && opts.random && typeof opts.random.random === 'function') {
                return opts.random;
            }
            return defaultPrng;
        })();
        const procRoll = Number(randomSource.random());
        if (procRoll < 0.3) {
            const gainRoll = Number(randomSource.random());
            const gain = 1 + Math.floor(Math.max(0, Math.min(0.999999, gainRoll)) * 5);
            const added = addChargeWithTotal(cardState, playerKey, gain);
            result.triggered = true;
            result.gained = added;
        }

        const shouldDecrement = opts.decrementRemainingOwnerTurns !== false;
        const markerData = marker.data || {};
        if (shouldDecrement && typeof markerData.remainingOwnerTurns === 'number') {
            markerData.remainingOwnerTurns -= 1;
            result.remainingOwnerTurns = markerData.remainingOwnerTurns;
            if (markerData.remainingOwnerTurns <= 0) {
                const revertRes = revertSpecialStoneWithPresentation(
                    cardState,
                    gameState,
                    row,
                    col,
                    'OBSERVER',
                    playerKey,
                    'OBSERVER_WILL',
                    'duration_end',
                    {
                        owner: playerKey,
                        timer: 0
                    }
                );
                if (revertRes && revertRes.reverted) {
                    result.remainingOwnerTurns = 0;
                    result.expired.push({ row, col, owner: playerKey, reason: 'duration_end' });
                }
            }
        } else {
            result.remainingOwnerTurns = (typeof markerData.remainingOwnerTurns === 'number')
                ? markerData.remainingOwnerTurns
                : null;
        }

        return result;
    }

    function processDestroyDragonEffects(cardState, gameState, playerKey, prng) {
        if (typeof module === 'object' && module.exports) {
            try {
                const mod = require('./cards/destroy_dragon');
                if (mod && typeof mod.processDestroyDragonEffects === 'function') {
                    return mod.processDestroyDragonEffects(cardState, gameState, playerKey, {
                        destroyAt,
                        BoardOps: BoardOpsModule,
                        random: prng || defaultPrng
                    });
                }
            } catch (e) { /* ignore */ }
        }
        if (typeof CardDestroyDragon !== 'undefined' && typeof CardDestroyDragon.processDestroyDragonEffects === 'function') {
            return CardDestroyDragon.processDestroyDragonEffects(cardState, gameState, playerKey, {
                destroyAt,
                BoardOps: BoardOpsModule,
                random: prng || defaultPrng
            });
        }
        console.warn('[cards.js] CardDestroyDragon module not available');
        return { destroyed: [], anchors: [], expired: [] };
    }

    function processDestroyDragonEffectsAtAnchor(cardState, gameState, playerKey, row, col, opts = {}) {
        const deps = Object.assign({
            destroyAt,
            BoardOps: BoardOpsModule,
            random: defaultPrng
        }, opts || {});
        if (typeof module === 'object' && module.exports) {
            try {
                const mod = require('./cards/destroy_dragon');
                if (mod && typeof mod.processDestroyDragonEffectsAtAnchor === 'function') {
                    return mod.processDestroyDragonEffectsAtAnchor(cardState, gameState, playerKey, row, col, deps);
                }
            } catch (e) { /* ignore */ }
        }
        if (typeof CardDestroyDragon !== 'undefined' && typeof CardDestroyDragon.processDestroyDragonEffectsAtAnchor === 'function') {
            return CardDestroyDragon.processDestroyDragonEffectsAtAnchor(cardState, gameState, playerKey, row, col, deps);
        }
        console.warn('[cards.js] CardDestroyDragon anchor processor not available');
        return { destroyed: [], expired: [] };
    }

    function processDestroyDragonEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, prng) {
        if (typeof module === 'object' && module.exports) {
            try {
                const mod = require('./cards/destroy_dragon');
                if (mod && typeof mod.processDestroyDragonEffectsAtTurnStartAnchor === 'function') {
                    return mod.processDestroyDragonEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, {
                        destroyAt,
                        BoardOps: BoardOpsModule,
                        random: prng || defaultPrng
                    });
                }
            } catch (e) { /* ignore */ }
        }
        if (typeof CardDestroyDragon !== 'undefined' && typeof CardDestroyDragon.processDestroyDragonEffectsAtTurnStartAnchor === 'function') {
            return CardDestroyDragon.processDestroyDragonEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, {
                destroyAt,
                BoardOps: BoardOpsModule,
                random: prng || defaultPrng
            });
        }
        console.warn('[cards.js] CardDestroyDragon turn-start anchor processor not available');
        return { destroyed: [], expired: [] };
    }


    /**
      * Process Breeding effects (Stone spawning)
      * @param {Object} cardState
      * @param {Object} gameState
     * @param {string} playerKey
     * @param {Object} prng
     * @returns {Object} { spawned: [...], destroyed: [...], flipped: [...] }
     */
    function getFlipsWithContextLocal(state, row, col, player, context = {}) {
        // Delegate to module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/flips');
            return mod.getFlipsWithContext(state, row, col, player, context);
        }
        // Browser: use global
        if (typeof CardFlips !== 'undefined' && typeof CardFlips.getFlipsWithContext === 'function') {
            return CardFlips.getFlipsWithContext(state, row, col, player, context);
        }
        console.warn('[cards.js] CardFlips module not available');
        return [];
    }


    function clearHyperactiveAtPositions(cardState, positions) {
        const removeSet = new Set(positions.map(p => `${p.row},${p.col}`));
        if (!cardState || !Array.isArray(cardState.markers)) return;
        cardState.markers = cardState.markers.filter(m => {
            if (m.kind !== (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone')) return true;
            if (!m.data || (m.data.type !== 'HYPERACTIVE' && m.data.type !== 'ESCAPE_HYPERACTIVE' && m.data.type !== 'INHERITED_HYPERACTIVE' && m.data.type !== 'EXTREME_HYPERACTIVE' && m.data.type !== 'ROBOT_VACUUM' && m.data.type !== 'GLUTTONOUS' && m.data.type !== 'ULTIMATE_HYPERACTIVE' && m.data.type !== 'SNIPER' && m.data.type !== 'OBSERVER')) return true;
            if (findSpecialMarkerAt(cardState, m.row, m.col, 'GHOST')) return true;
            return !removeSet.has(`${m.row},${m.col}`);
        });
    }

    function moveHyperactiveOnce(cardState, gameState, entry, prng) {
        // Delegate to module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/hyperactive');
            return mod.moveHyperactiveOnce(cardState, gameState, entry, prng, {
                defaultPrng: defaultPrng,
                getFlipsWithContext: getFlipsWithContextLocal,
                clearHyperactiveAtPositions,
                clearBombAt,
                isBlockedCell,
                getCardContext,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }
        // Browser: use global
        if (typeof CardHyperactive !== 'undefined' && typeof CardHyperactive.moveHyperactiveOnce === 'function') {
            return CardHyperactive.moveHyperactiveOnce(cardState, gameState, entry, prng, {
                defaultPrng: defaultPrng,
                getFlipsWithContext: getFlipsWithContextLocal,
                clearHyperactiveAtPositions,
                clearBombAt,
                isBlockedCell,
                getCardContext,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }
        console.warn('[cards.js] CardHyperactive module not available');
        return { moved: [], destroyed: [], flipped: [], ownerKey: entry ? entry.owner : 'black' };
    }


    function processHyperactiveMoves(cardState, gameState, prng) {
        // Delegate to module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/hyperactive');
            return mod.processHyperactiveMoves(cardState, gameState, prng, {
                defaultPrng: defaultPrng,
                getFlipsWithContext: getFlipsWithContextLocal,
                clearBombAt,
                clearHyperactiveAtPositions,
                isBlockedCell,
                getCardContext,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }
        // Browser: use global
        if (typeof CardHyperactive !== 'undefined' && typeof CardHyperactive.processHyperactiveMoves === 'function') {
            return CardHyperactive.processHyperactiveMoves(cardState, gameState, prng, {
                defaultPrng: defaultPrng,
                getFlipsWithContext: getFlipsWithContextLocal,
                clearBombAt,
                clearHyperactiveAtPositions,
                isBlockedCell,
                getCardContext,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }
        console.warn('[cards.js] CardHyperactive module not available');
        return { moved: [], destroyed: [], flipped: [], flippedByOwner: { black: [], white: [] } };
    }


    function processHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, options = {}) {
        // Delegate to module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/hyperactive');
            return mod.processHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, {
                defaultPrng: defaultPrng,
                getFlipsWithContext: getFlipsWithContextLocal,
                clearBombAt,
                clearHyperactiveAtPositions,
                isBlockedCell,
                getCardContext,
                BoardOps: BoardOpsModule,
                destroyAt,
                currentTurnPlayerKey: options.currentTurnPlayerKey || playerKey,
                inheritedHyperactiveTurns: INHERITED_HYPERACTIVE_TURNS,
                expectedSpecialType: options.expectedSpecialType || null
            });
        }
        // Browser: use global
        if (typeof CardHyperactive !== 'undefined' && typeof CardHyperactive.processHyperactiveMoveAtAnchor === 'function') {
            return CardHyperactive.processHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, {
                defaultPrng: defaultPrng,
                getFlipsWithContext: getFlipsWithContextLocal,
                clearBombAt,
                clearHyperactiveAtPositions,
                isBlockedCell,
                getCardContext,
                BoardOps: BoardOpsModule,
                destroyAt,
                currentTurnPlayerKey: options.currentTurnPlayerKey || playerKey,
                inheritedHyperactiveTurns: INHERITED_HYPERACTIVE_TURNS,
                expectedSpecialType: options.expectedSpecialType || null
            });
        }
        console.warn('[cards.js] CardHyperactive module not available');
        return { moved: [], destroyed: [], flipped: [] };
    }

    function processRobotVacuumMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, options = {}) {
        const deps = {
            defaultPrng: defaultPrng,
            getFlipsWithContext: getFlipsWithContextLocal,
            clearBombAt,
            clearHyperactiveAtPositions,
            isBlockedCell,
            getCardContext,
            BoardOps: BoardOpsModule,
            destroyAt,
            currentTurnPlayerKey: options.currentTurnPlayerKey || playerKey,
            robotVacuumTurns: ROBOT_VACUUM_TURNS
        };
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/hyperactive');
            if (mod && typeof mod.processRobotVacuumMoveAtAnchor === 'function') {
                return mod.processRobotVacuumMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, deps);
            }
        }
        if (typeof CardHyperactive !== 'undefined' && typeof CardHyperactive.processRobotVacuumMoveAtAnchor === 'function') {
            return CardHyperactive.processRobotVacuumMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, deps);
        }
        console.warn('[cards.js] CardHyperactive robot-vacuum module not available');
        return { moved: [], destroyed: [], flipped: [], ownerKey: playerKey, sucked: [], expired: [], suckedCount: 0 };
    }

    function processGluttonousMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, options = {}) {
        const deps = {
            defaultPrng: defaultPrng,
            getFlipsWithContext: getFlipsWithContextLocal,
            clearBombAt,
            clearHyperactiveAtPositions,
            isBlockedCell,
            getCardContext,
            BoardOps: BoardOpsModule,
            destroyAt,
            currentTurnPlayerKey: options.currentTurnPlayerKey || playerKey
        };
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/hyperactive');
            if (mod && typeof mod.processGluttonousMoveAtAnchor === 'function') {
                return mod.processGluttonousMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, deps);
            }
        }
        if (typeof CardHyperactive !== 'undefined' && typeof CardHyperactive.processGluttonousMoveAtAnchor === 'function') {
            return CardHyperactive.processGluttonousMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, deps);
        }
        console.warn('[cards.js] CardHyperactive gluttonous module not available');
        return { moved: [], destroyed: [], flipped: [], ownerKey: playerKey, ate: [] };
    }

    function resolveHyperactiveFlipEvasion(cardState, gameState, flipCells, ownerAfterKey, prng) {
        const fallbackFlips = (Array.isArray(flipCells) ? flipCells : []).map((cell) => {
            if (Array.isArray(cell) && Number.isInteger(cell[0]) && Number.isInteger(cell[1])) {
                return [cell[0], cell[1]];
            }
            if (cell && Number.isInteger(cell.row) && Number.isInteger(cell.col)) {
                return [cell.row, cell.col];
            }
            return null;
        }).filter((cell) => !!cell);

        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/hyperactive');
            if (mod && typeof mod.resolveHyperactiveFlipEvasion === 'function') {
                return mod.resolveHyperactiveFlipEvasion(cardState, gameState, fallbackFlips, ownerAfterKey, prng, {
                    defaultPrng: defaultPrng,
                    clearHyperactiveAtPositions,
                    isBlockedCell,
                    BoardOps: BoardOpsModule,
                    destroyAt
                });
            }
        }

        if (typeof CardHyperactive !== 'undefined' && typeof CardHyperactive.resolveHyperactiveFlipEvasion === 'function') {
            return CardHyperactive.resolveHyperactiveFlipEvasion(cardState, gameState, fallbackFlips, ownerAfterKey, prng, {
                defaultPrng: defaultPrng,
                clearHyperactiveAtPositions,
                isBlockedCell,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }

        console.warn('[cards.js] CardHyperactive flip-evasion module not available');
        return { remainingFlips: fallbackFlips, moved: [], destroyed: [], evaded: [] };
    }

    function processInstantHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng) {
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/hyperactive');
            return mod.processInstantHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, {
                defaultPrng: defaultPrng,
                getFlipsWithContext: getFlipsWithContextLocal,
                clearBombAt,
                clearHyperactiveAtPositions,
                isBlockedCell,
                getCardContext,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }
        if (typeof CardHyperactive !== 'undefined' && typeof CardHyperactive.processInstantHyperactiveMoveAtAnchor === 'function') {
            return CardHyperactive.processInstantHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, {
                defaultPrng: defaultPrng,
                getFlipsWithContext: getFlipsWithContextLocal,
                clearBombAt,
                clearHyperactiveAtPositions,
                isBlockedCell,
                getCardContext,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }
        console.warn('[cards.js] CardHyperactive instant module not available');
        return { moved: [], destroyed: [], flipped: [], ownerKey: playerKey };
    }

    function processUltimateHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, options = {}) {
        // Delegate to module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/hyperactive');
            return mod.processUltimateHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, {
                defaultPrng: defaultPrng,
                currentTurnPlayerKey: options.currentTurnPlayerKey || playerKey,
                ultimateHyperactiveTurns: ULTIMATE_HYPERACTIVE_TURNS,
                clearUltimateAtPositions: clearHyperactiveAtPositions,
                clearHyperactiveAtPositions,
                clearBombAt,
                isBlockedCell,
                getFlipsWithContext: getFlipsWithContextLocal,
                getCardContext,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }
        // Browser: use global
        if (typeof CardHyperactive !== 'undefined' && typeof CardHyperactive.processUltimateHyperactiveMoveAtAnchor === 'function') {
            return CardHyperactive.processUltimateHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, {
                defaultPrng: defaultPrng,
                currentTurnPlayerKey: options.currentTurnPlayerKey || playerKey,
                ultimateHyperactiveTurns: ULTIMATE_HYPERACTIVE_TURNS,
                clearUltimateAtPositions: clearHyperactiveAtPositions,
                clearHyperactiveAtPositions,
                clearBombAt,
                isBlockedCell,
                getFlipsWithContext: getFlipsWithContextLocal,
                getCardContext,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }
        console.warn('[cards.js] CardHyperactive ultimate module not available');
        return { moved: [], destroyed: [], flipped: [], ownerKey: playerKey };
    }


    function processBreedingEffects(cardState, gameState, playerKey, prng) {
        // Delegate to cards/breeding.js module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/breeding');
            return mod.processBreedingEffects(cardState, gameState, playerKey, prng, {
                defaultPrng: defaultPrng,
                getCardContext,
                getFlipsWithContext: getFlipsWithContextLocal,
                clearBombAt,
                clearHyperactiveAtPositions,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }
        // Browser: use global
        if (typeof CardBreeding !== 'undefined' && typeof CardBreeding.processBreedingEffects === 'function') {
            return CardBreeding.processBreedingEffects(cardState, gameState, playerKey, prng, {
                defaultPrng: defaultPrng,
                getCardContext,
                getFlipsWithContext: getFlipsWithContextLocal,
                clearBombAt,
                clearHyperactiveAtPositions,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }
        console.warn('[cards.js] CardBreeding module not available');
        return { spawned: [], destroyed: [], flipped: [], anchors: [] };
    }


    /**
     * Process a single BREEDING anchor immediately (placement-turn immediate spawn).
     * Delegates to cards/breeding.js module.
     */
    function processBreedingEffectsAtAnchor(cardState, gameState, playerKey, row, col, prng) {
        // Delegate to module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/breeding');
            return mod.processBreedingEffectsAtAnchor(cardState, gameState, playerKey, row, col, prng, {
                defaultPrng: defaultPrng,
                getCardContext,
                getFlipsWithContext: getFlipsWithContextLocal,
                clearBombAt,
                clearHyperactiveAtPositions,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }
        // Browser: use global
        if (typeof CardBreeding !== 'undefined' && typeof CardBreeding.processBreedingEffectsAtAnchor === 'function') {
            return CardBreeding.processBreedingEffectsAtAnchor(cardState, gameState, playerKey, row, col, prng, {
                defaultPrng: defaultPrng,
                getCardContext,
                getFlipsWithContext: getFlipsWithContextLocal,
                clearBombAt,
                clearHyperactiveAtPositions,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }
        console.warn('[cards.js] CardBreeding module not available');
        return { spawned: [], destroyed: [], flipped: [] };
    }

    function processBreedingEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, prng) {
        if (typeof module === 'object' && module.exports) {
            try {
                const mod = require('./cards/breeding');
                if (mod && typeof mod.processBreedingEffectsAtTurnStartAnchor === 'function') {
                    return mod.processBreedingEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, prng, {
                        defaultPrng: defaultPrng,
                        getCardContext,
                        getFlipsWithContext: getFlipsWithContextLocal,
                        clearBombAt,
                        clearHyperactiveAtPositions,
                        BoardOps: BoardOpsModule,
                        destroyAt
                    });
                }
            } catch (e) { /* ignore */ }
        }
        if (typeof CardBreeding !== 'undefined' && typeof CardBreeding.processBreedingEffectsAtTurnStartAnchor === 'function') {
            return CardBreeding.processBreedingEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, prng, {
                defaultPrng: defaultPrng,
                getCardContext,
                getFlipsWithContext: getFlipsWithContextLocal,
                clearBombAt,
                clearHyperactiveAtPositions,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }
        console.warn('[cards.js] CardBreeding turn-start anchor processor not available');
        return { spawned: [], destroyed: [], flipped: [], anchors: [] };
    }


    /**
     * Apply DESTROY_ONE_STONE
     * Delegates to effects/destroy_one_stone.js module.
     */
    function applyDestroyEffectDetailed(cardState, gameState, playerKey, row, col) {
        // Delegate to effect module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./effects/destroy_one_stone');
            return mod.applyDestroyOneStone(cardState, gameState, playerKey, row, col, { BoardOps: BoardOpsModule, destroyAt });
        }
        // Browser: use global
        if (typeof DestroyOneStone !== 'undefined' && typeof DestroyOneStone.applyDestroyOneStone === 'function') {
            return DestroyOneStone.applyDestroyOneStone(cardState, gameState, playerKey, row, col, { BoardOps: BoardOpsModule, destroyAt });
        }
        console.warn('[cards.js] DestroyOneStone module not available');
        return createDestroyOutcome();
    }

    function applyDestroyEffect(cardState, gameState, playerKey, row, col) {
        return isDestroyResolved(applyDestroyEffectDetailed(cardState, gameState, playerKey, row, col));
    }


    /**
     * Apply SWAP_WITH_ENEMY
     * Delegates to effects/swap_with_enemy.js module.
     */
    function applySwapEffect(cardState, gameState, playerKey, row, col) {
        const cardContext = getCardContext(cardState);
        // Delegate to effect module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./effects/swap_with_enemy');
            const core = require('./core');
            const r = mod.applySwapWithEnemy(cardState, gameState, playerKey, row, col, {
                BoardOps: BoardOpsModule,
                clearHyperactiveAtPositions,
                clearBombAt,
                emitPresentationEvent,
                cardContext,
                Core: core
            });
            return !!r.swapped;
        }
        // Browser: use global
        if (typeof SwapWithEnemy !== 'undefined' && typeof SwapWithEnemy.applySwapWithEnemy === 'function') {
            const browserCore = (typeof CoreLogic !== 'undefined')
                ? CoreLogic
                : (typeof Core !== 'undefined' ? Core : null);
            const r = SwapWithEnemy.applySwapWithEnemy(cardState, gameState, playerKey, row, col, {
                BoardOps: BoardOpsModule,
                clearHyperactiveAtPositions,
                clearBombAt,
                emitPresentationEvent,
                cardContext,
                Core: browserCore
            });
            return !!r.swapped;
        }
        console.warn('[cards.js] SwapWithEnemy module not available');
        return false;
    }

    function applyPositionSwapWill(cardState, gameState, playerKey, row, col) {
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'POSITION_SWAP_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }
        const cellValue = getCellValueForCard(gameState, row, col);
        if (cellValue === null) return { applied: false, reason: 'out_of_board' };
        if (cellValue === EMPTY) return { applied: false, reason: 'empty' };
        if (isPositionSwapProtectedCell(cardState, row, col)) return { applied: false, reason: 'swap_protected' };

        const first = pending.firstTarget ? { row: pending.firstTarget.row, col: pending.firstTarget.col } : null;
        if (!first) {
            pending.firstTarget = { row, col };
            return { applied: true, completed: false, firstTarget: { row, col } };
        }

        if (first.row === row && first.col === col) {
            return { applied: false, reason: 'same_target' };
        }
        const firstValue = getCellValueForCard(gameState, first.row, first.col);
        if (firstValue === null) {
            pending.firstTarget = { row, col };
            return { applied: true, completed: false, firstTarget: { row, col } };
        }
        if (firstValue === EMPTY) {
            pending.firstTarget = { row, col };
            return { applied: true, completed: false, firstTarget: { row, col } };
        }
        if (isPositionSwapProtectedCell(cardState, first.row, first.col)) {
            pending.firstTarget = { row, col };
            return { applied: true, completed: false, firstTarget: { row, col } };
        }

        const stoneIdA = getStoneIdAtForCard(cardState, gameState, first.row, first.col);
        const stoneIdB = getStoneIdAtForCard(cardState, gameState, row, col);
        const ownerBeforeA = firstValue === (BLACK || 1) ? 'black' : 'white';
        const ownerBeforeB = cellValue === (BLACK || 1) ? 'black' : 'white';

        setCellValueForCard(gameState, first.row, first.col, cellValue);
        setCellValueForCard(gameState, row, col, firstValue);

        swapCellCoordinates(cardState, gameState, first, { row, col });
        clearCardPendingEffect(cardState, playerKey);

        emitPresentationEvent(cardState, {
            type: 'MOVE',
            stoneId: stoneIdA,
            row,
            col,
            prevRow: first.row,
            prevCol: first.col,
            ownerBefore: ownerBeforeA,
            ownerAfter: ownerBeforeA,
            cause: 'POSITION_SWAP_WILL',
            reason: 'position_swap'
        });
        emitPresentationEvent(cardState, {
            type: 'MOVE',
            stoneId: stoneIdB,
            row: first.row,
            col: first.col,
            prevRow: row,
            prevCol: col,
            ownerBefore: ownerBeforeB,
            ownerAfter: ownerBeforeB,
            cause: 'POSITION_SWAP_WILL',
            reason: 'position_swap'
        });

        return { applied: true, completed: true, from: first, to: { row, col } };
    }


    /**
     * Get context for core logic
     * @param {Object} cardState
    * @returns {Object} { protectedStones, permaProtectedStones, bombs, blockedCells }
     */
    function getCardContext(cardState) {
        const specials = getSpecialMarkers(cardState);
        const protectedStones = specials
            .filter(s => s.data && s.data.type === 'PROTECTED')
            .map(s => ({ row: s.row, col: s.col, owner: s.owner }));
        const absoluteProtectedStones = specials
            .filter((s) => s.data && s.data.type === 'ABSOLUTE_PROTECTED')
            .map((s) => ({
                row: s.row,
                col: s.col,
                owner: s.owner === 'black' ? (BLACK || 1) : (WHITE || -1)
            }));

        // PERMA_PROTECTED, ABSOLUTE_PROTECTED, DRAGON, BREEDING, UDG, LIGHTNING, GLUTTONOUS, and GUARD stones are immune to flipping.
        const permaProtectedStones = specials
            .filter(s => {
                if (!s.data) return false;
                if (
                    s.data.type === 'ABSOLUTE_PROTECTED' ||
                    s.data.type === 'PERMA_PROTECTED' ||
                    s.data.type === 'DRAGON' ||
                    s.data.type === 'BREEDING' ||
                    s.data.type === 'DESTROY_DRAGON' ||
                    s.data.type === 'LIGHTNING' ||
                    s.data.type === 'GLUTTONOUS' ||
                    s.data.type === 'ULTIMATE_DESTROY_GOD' ||
                    s.data.type === 'GUARD' ||
                    s.data.type === 'FREEZE'
                ) {
                    return true;
                }
                if (isFrozenCellForCard(cardState, s.row, s.col)) return true;
                return false;
            })
            .map(s => ({
                row: s.row,
                col: s.col,
                owner: s.owner === 'black' ? BLACK : WHITE
            }));

        const bombs = getBombMarkers(cardState).map(b => ({
            row: b.row,
            col: b.col,
            remainingTurns: b.data ? b.data.remainingTurns : undefined,
            owner: b.owner,
            placedTurn: b.data ? b.data.placedTurn : undefined,
            createdSeq: b.createdSeq
        }));

        const blockedCells = getBlockingMarkers(cardState).map(m => ({
            row: m.row,
            col: m.col,
            type: m.data ? m.data.type : null,
            remainingOwnerTurns: m.data ? m.data.remainingOwnerTurns : undefined,
            owner: m.owner
        }));

        return {
            protectedStones,
            absoluteProtectedStones,
            permaProtectedStones,
            bombs,
            blockedCells
        };
    }

    /**
     * Called when a turn ends (after move or pass)
     * @param {Object} cardState
     * @param {Object} gameState
     * @param {string} playerKey - 'black' or 'white'
     */
    function onTurnEnd(cardState, gameState, playerKey) {
        // Protection expiration is now handled exclusively in onTurnStart
        // to ensure it lasts until the start of the owner's next turn.
        const pending = readCardPendingEffect(cardState, playerKey);
        if (pending && isChainWillCardType(pending.type)) {
            clearCardPendingEffect(cardState, playerKey);
        }
    }

    /**
     * Check active pending effect
     * @param {Object} cardState
     * @param {string} playerKey
     * @returns {boolean}
     */
    function hasPendingEffect(cardState, playerKey) {
        return readCardPendingEffect(cardState, playerKey) !== null;
    }

    // Presentation event helpers (PoC)
    function allocateStoneId(cardState) {
        if (!cardState) return null;
        if (cardState._nextStoneId === undefined || cardState._nextStoneId === null) cardState._nextStoneId = 1;
        const id = 's' + String(cardState._nextStoneId++);
        return id;
    }

    function emitPresentationEvent(cardState, ev) {
        if (!cardState) return;
        // BoardOps central emitter fills action meta (actionId, turnIndex, plyIndex)
        if (BoardOpsModule && typeof BoardOpsModule.emitPresentationEvent === 'function') {
            BoardOpsModule.emitPresentationEvent(cardState, ev);
            return;
        }
        // BoardOps not available; rely on centralized presentation helper to warn once if needed.
    }

    function flushPresentationEvents(cardState) {
        if (!cardState || !cardState.presentationEvents) return [];
        const out = cardState.presentationEvents.slice();
        // Persist only when BoardOps is not available (BoardOps already persists on emit).
        if (!(BoardOpsModule && typeof BoardOpsModule.emitPresentationEvent === 'function')) {
            if (!cardState._presentationEventsPersist) cardState._presentationEventsPersist = [];
            cardState._presentationEventsPersist.push(...out);
        }
        cardState.presentationEvents.length = 0;
        return out;
    }

    /**
     * Get pending effect type
     * @param {Object} cardState
     * @param {string} playerKey
     * @returns {string|null}
     */
    function getPendingEffectType(cardState, playerKey) {
        const pending = readCardPendingEffect(cardState, playerKey);
        return pending ? pending.type : null;
    }

    const FREE_PLACEMENT_PENDING_TYPES = new Set([
        'FREE_PLACEMENT',
        'SNIPER_WILL',
        'LAST_RESORT',
        'ULTIMATE_REVERSE_DRAGON',
        'ULTIMATE_DESTROY_GOD'
    ]);

    function isFreePlacementPendingType(pendingType) {
        const type = String(pendingType || '');
        return !!type && FREE_PLACEMENT_PENDING_TYPES.has(type);
    }

    /**
     * Get selectable friendly stone cells for the current pending effect (UI highlight helper).
     * @param {Object} cardState 
     * @param {Object} gameState 
     * @param {string} playerKey - 'black'|'white'
     * @returns {Array<{row:number,col:number}>}
     */
    function getSelectableTargets(cardState, gameState, playerKey) {
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending) return [];
        if (!CardSelectorOrchestratorModule || typeof CardSelectorOrchestratorModule.getSelectableTargetsForPending !== 'function') {
            return [];
        }

        return CardSelectorOrchestratorModule.getSelectableTargetsForPending({
            cardState,
            gameState,
            playerKey,
            pending,
            selectorsModule: CardSelectorsModule,
            constants: { BLACK, WHITE, EMPTY },
            helpers: {
                getCurrentBoardShapeCellsForCard,
                getCellValueForCard,
                getExpansionDescriptorsForCard,
                isPositionSwapProtectedCell
            },
            localSelectors: {
                getStrongWindTargets,
                getSuperBuoyancyTargets,
                getSuperGravityTargets,
                getTemptWillTargets,
                getCaptureWillTargets,
                getTrapTargets,
                getGuardTargets,
                getHyperactiveInheritTargets,
                getTimeBombTargets,
                getTeleportTargets,
                getCellTeleportTargets,
                getCloneTargets,
                getSplitTargets,
                getBoardExpansionTargets,
                getBoardExpansionGodTargets,
                getExtendLifeTargets,
                getCorrosionTargets,
                getBlockadeTargets,
                getMeteorTargets,
                getFreezeTargets
            }
        });
    }

    return {
        // Constants
        INITIAL_HAND_SIZE,
        TIME_BOMB_TURNS,
        ULTIMATE_DRAGON_TURNS,
        ULTIMATE_DESTROY_GOD_TURNS,
        ULTIMATE_HYPERACTIVE_TURNS,
        SNIPER_WILL_TURNS,
        DESTROY_DRAGON_TURNS,
        LIGHTNING_WILL_TURNS,
        OBSERVER_WILL_TURNS,
        GHOST_WILL_TURNS,
        WILL_HUNTER_KING_TURNS,
        NUMBER_CELL_CHARGE_MULTIPLIER_EFFECTS,
        THROW_CHAIN_CONFIG_BY_TYPE,
        CHAIN_WILL_CONFIG_BY_TYPE,

        // State factories
        createCardState,
        copyCardState,
        dealInitialHands,
        initGame,
        addMarker,
        removeMarkerById,

        // Core operations
        commitDraw,
        getCardDef,
        getCardType,
        getCardDisplayName,
        getCardCodeName,
        getCardCost,
        getThrowChainConfig,
        getChainWillConfig,
        canUseCard,
        destroyHandCard,
        ensureCardCopyState,
        getHandCopyIdAt,
        getHandCopyIds,
        isCardCopyIdRevealedToViewer,
        revealCurrentHandToViewer,
        addCardToHand,
        addCardToDiscard,
        removeHandCardAt,
        clearHandToDiscard,
        moveDiscardCardToHandByCardId,
        getUsableCardIds,
        hasUsableCard,
        applyCardUsage,
        destroyAt,
        clearBombAt,
        processBreedingEffects,
        processUltimateDestroyGodEffects,
        processSniperWillEffects,
        processDestroyDragonEffects,
        processLightningWillEffects,

        // Game flow
        onTurnStart,
        onTurnEnd,
        applyPlacementEffects,
        tickBombs,
        tickBombAt,
        processDragonEffects,
        processDragonEffectsAtTurnStartAnchor,
        processDragonEffectsAtAnchor,
        applyDestroyEffect,
        applyDestroyEffectDetailed,
        applySwapEffect,
        applyPositionSwapWill,
        applyStrongWill,
        applyAbsoluteProtect,
        applySellCardWill,
        applyHeavenBlessingChoice,
        applyRevealHandWill,
        applyCondemnWill,
        applyTemptWill,
        applyCaptureWill,
        applyExtendLifeWill,
        applyExtendLifeGod,
        applyCorrosionWill,
        applyGuardWill,
        applyHyperactiveInheritWill,
        applyTimeBombWill,
        applyTeleportWill,
        applyCellTeleportWill,
        applyCloneWill,
        applySplitWill,
        applyBoardExpansionWill,
        applyBoardExpansionGod,
        applyBlockadeWill,
        applyMeteorWill,
        applyFreezeWill,
        getEqualityWillBoardCounts,
        getLossWillRemovableCount,
        applyLossWill,
        getSalvationWillTargetCount,
        applySalvationWill,
        getFateWillControllerForTurnOwner,
        applyFateWill,
        applyStrongWindWill,
        applySuperBuoyancyWill,
        applySuperGravityWill,
        armRiboWillEffect,
        resolveEqualityWillUsage,
        getTimeStopGodDestroyableCount,
        resolveTimeStopGodUsage,
        consumeTimeStopConsecutiveTurn,
        applyRegenWill,
        applyRegenAfterFlips,
        applyChainWillAfterMove,
        processTimeStopEffectsAtTurnStartAnchor,
        processBreedingEffectsAtTurnStartAnchor,
        processBreedingEffectsAtAnchor,
        processUltimateDestroyGodEffectsAtTurnStartAnchor,
        processUltimateDestroyGodEffectsAtAnchor,
        processSniperWillEffectsAtTurnStartAnchor,
        processLightningWillEffectsAtTurnStartAnchor,
        processLightningWillEffectsAtAnchor,
        processWillHunterKingEffectsAtTurnStartAnchor,
        processObserverWillEffectsAtTurnStartAnchor,
        processDestroyDragonEffectsAtAnchor,
        processDestroyDragonEffectsAtTurnStartAnchor,

        // Helpers
        getCardContext,
        transferCellMarkerOwnership,
        hasPendingEffect,
        getPendingEffectType,
        isFreePlacementPendingType,
        getSelectableTargets,
        getStrongWindTargets,
        getSuperBuoyancyTargets,
        getSuperGravityTargets,
        getTabooReverseCandidates,
        pickTabooReverseFlips,
        cancelPendingSelection,
        getTemptWillTargets,
        getCaptureWillTargets,
        getExtendLifeTargets,
        getCorrosionTargets,
        getGuardTargets,
        getHyperactiveInheritTargets,
        getTimeBombTargets,
        getTeleportTargets,
        getCellTeleportTargets,
        getCloneTargets,
        getSplitTargets,
        getBoardExpansionTargets,
        getBoardExpansionGodTargets,
        getBlockadeTargets,
        getMeteorTargets,
        getFreezeTargets,
        getCurrentCornerCellsForCard,
        countOccupiedCornersForPlayer,
        isBlockedCell,
        isAbsoluteProtectedCell,
        getTrapTargets,
        applyTrapWill,
        processTrapEffects,
        clearHyperactiveAtPositions,
        resolveHyperactiveFlipEvasion,
        processHyperactiveMoves,
        processHyperactiveMoveAtAnchor,
        processGluttonousMoveAtAnchor,
        processRobotVacuumMoveAtAnchor,
        processInstantHyperactiveMoveAtAnchor,
        processUltimateHyperactiveMoveAtAnchor,
        // Presentation helpers (PoC)
        allocateStoneId,
        emitPresentationEvent,
        flushPresentationEvents
    };
}));
