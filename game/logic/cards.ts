/**
 * @file cards.ts
 * @description Core Card Logic (Shared between Browser and Headless)
 * Pure functions/state manipulation only. No UI dependencies.
 */

import type { CardState, GameState, PlayerKey } from '../../src/types';

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
    return null;
}

function requireOptionalCardLogicModule(id: string): any {
    try {
        return _require(id);
    } catch (e) {
        return null;
    }
}

function resolveCardLogicModuleOrGlobal(id: string, globalKey: string): any {
    return requireOptionalCardLogicModule(id) || getRuntimeGlobalValue(globalKey);
}

function resolveCardLogicGlobalOrModule(globalKey: string, id: string): any {
    return getRuntimeGlobalValue(globalKey) || requireOptionalCardLogicModule(id);
}

// Import dependencies
const SharedConstants = resolveCardLogicModuleOrGlobal('../../shared-constants', 'SharedConstants');
const DeckSpecHelpers = resolveCardLogicModuleOrGlobal('../../shared/deck-spec', 'DeckSpecHelpers');
const SharedBoardUtils = resolveCardLogicModuleOrGlobal('../../shared/shared-board-utils', 'SharedBoardUtils');
const CardRandomSource = resolveCardLogicModuleOrGlobal('./cards-internal/random-source', 'CardRandomSource');
const CardStateFactory = resolveCardLogicModuleOrGlobal('./cards-internal/state-factory', 'CardStateFactory');
const CardModuleResolver = resolveCardLogicModuleOrGlobal('./cards-internal/module-resolver', 'CardModuleResolver');
const CardPresentationHelpers = resolveCardLogicModuleOrGlobal('./cards-internal/presentation-helpers', 'CardPresentationHelpers');
const CardStateManager = resolveCardLogicModuleOrGlobal('../cards/state-manager', 'CardStateManager');
const CardEffectResolverModule = resolveCardLogicModuleOrGlobal('../cards/effect-resolver', 'CardEffectResolver');
const CardTimingProcessorModule = resolveCardLogicModuleOrGlobal('../cards/timing-processor', 'CardTimingProcessor');
const TargetResolver = resolveCardLogicModuleOrGlobal('../cards/target-resolver', 'CardTargetResolver');

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
    const BoardUtils = SharedBoardUtils || null;

    if (!CARD_DEFS) {
        throw new Error('SharedConstants not loaded');
    }

    if (!CardModuleResolver || typeof CardModuleResolver.resolveModule !== 'function') {
        throw new Error('CardModuleResolver not loaded');
    }
    if (!CardPresentationHelpers || typeof CardPresentationHelpers.getCellVisualPresentationMeta !== 'function') {
        throw new Error('CardPresentationHelpers not loaded');
    }

    const cardModuleRequire = (typeof require === 'function') ? require : null;

    function resolveCardModule(requirePath: any, globalName: any, required: any) {
        return CardModuleResolver.resolveModule({
            requirePath,
            globalName,
            required: required === true,
            label: globalName || requirePath,
            requireFn: cardModuleRequire
        });
    }

    function resolveRequiredCardModule(requirePath: any, globalName: any) {
        return resolveCardModule(requirePath, globalName, true);
    }

    function resolveOptionalCardModule(requirePath: any, globalName: any) {
        return CardModuleResolver.resolveModule({
            requirePath,
            globalName,
            required: false,
            label: globalName || requirePath,
            requireFn: cardModuleRequire,
            readLocal: () => getRuntimeGlobalValue(globalName),
            isValid: (value: any) => !!(value && typeof value === 'object' && Object.keys(value).length > 0)
        });
    }

    const DestroyOutcomeContract = resolveCardLogicModuleOrGlobal('../../shared/destroy-outcome-contract', 'DestroyOutcomeContract');
    const StoneStatusSnapshot = resolveCardLogicModuleOrGlobal('../../shared/stone-status-snapshot', 'StoneStatusSnapshot');
    const SpecialStoneRegistry = resolveCardLogicModuleOrGlobal('../../shared/special-stone-registry', 'SpecialStoneRegistry');

    function isOverlayOnlySpecialStoneType(type: any) {
        if (SpecialStoneRegistry && typeof SpecialStoneRegistry.isOverlayOnlySpecialStoneType === 'function') {
            return SpecialStoneRegistry.isOverlayOnlySpecialStoneType(type);
        }
        const typeUpper = String(type || '').toUpperCase();
        return typeUpper === 'GUARD' || typeUpper === 'INHERITED_HYPERACTIVE' || typeUpper === 'LIVING_WILL';
    }

    function resolveCardBoardConfig(boardOrConfig?: any) {
        if (BoardUtils && typeof BoardUtils.resolveBoardConfig === 'function') {
            return BoardUtils.resolveBoardConfig(boardOrConfig);
        }
        const board = Array.isArray(boardOrConfig)
            ? boardOrConfig
            : (boardOrConfig && Array.isArray(boardOrConfig.board)
                ? boardOrConfig.board
                : (boardOrConfig && Array.isArray(boardOrConfig.stoneIdMap) ? boardOrConfig.stoneIdMap : null));
        const rows = Array.isArray(board) && board.length > 0
            ? board.length
            : (Number.isInteger(BOARD_SIZE) ? BOARD_SIZE : 8);
        const cols = Array.isArray(board) && Array.isArray(board[0]) && board[0].length > 0
            ? board[0].length
            : rows;
        return {
            rows,
            cols,
            standard8x8: rows === 8 && cols === 8,
            baseBounds: { minRow: 0, maxRow: rows - 1, minCol: 0, maxCol: cols - 1 },
            outerBounds: { minRow: -1, maxRow: rows, minCol: -1, maxCol: cols }
        };
    }

    function createStoneIdBoard(boardOrConfig: any) {
        const config = resolveCardBoardConfig(boardOrConfig);
        if (BoardUtils && typeof BoardUtils.createEmptyBoard === 'function') {
            return BoardUtils.createEmptyBoard(config, null);
        }
        return Array.from({ length: config.rows }, () => Array.from({ length: config.cols }, () => null));
    }

    function getOpeningPlacementsForState(boardOrConfig: any) {
        if (BoardUtils && typeof BoardUtils.getOpeningPlacements === 'function') {
            return BoardUtils.getOpeningPlacements(boardOrConfig);
        }
        const config = resolveCardBoardConfig(boardOrConfig);
        const anchorRow = Math.floor((config.rows - 2) / 2);
        const anchorCol = Math.floor((config.cols - 2) / 2);
        if (config.rows === 7 && config.cols === 7) {
            const placements = [];
            for (let rowOffset = 0; rowOffset < 3; rowOffset += 1) {
                for (let colOffset = 0; colOffset < 3; colOffset += 1) {
                    if (rowOffset === 1 && colOffset === 1) continue;
                    placements.push({
                        row: anchorRow + rowOffset,
                        col: anchorCol + colOffset,
                        owner: ((rowOffset + colOffset) % 2 === 0) ? WHITE : BLACK
                    });
                }
            }
            return placements;
        }
        return [
            { row: anchorRow, col: anchorCol, owner: WHITE },
            { row: anchorRow, col: anchorCol + 1, owner: BLACK },
            { row: anchorRow + 1, col: anchorCol, owner: BLACK },
            { row: anchorRow + 1, col: anchorCol + 1, owner: WHITE }
        ];
    }

    function getOpeningCellsForState(boardOrConfig: any) {
        if (BoardUtils && typeof BoardUtils.getOpeningCells === 'function') {
            return BoardUtils.getOpeningCells(boardOrConfig);
        }
        return getOpeningPlacementsForState(boardOrConfig).map((stone: any) => ({
            row: stone.row,
            col: stone.col
        }));
    }

    function cloneSalvationDestroyedEntries(entries: any) {
        if (!Array.isArray(entries)) return [];
        return entries.map((entry: any) => ({
            row: entry && entry.row,
            col: entry && entry.col,
            owner: (entry && (entry.owner === 'black' || entry.owner === 'white')) ? entry.owner : null,
            wasSpecial: !!(entry && entry.wasSpecial === true)
        }));
    }

    function cloneSalvationDestroyedLedger(source: any) {
        const ledger = (source && typeof source === 'object') ? source : {};
        return {
            black: cloneSalvationDestroyedEntries(ledger.black),
            white: cloneSalvationDestroyedEntries(ledger.white)
        };
    }

    function ensureSalvationDestroyedLedger(cardState: any) {
        if (!cardState || typeof cardState !== 'object') return null;
        if (
            cardState.prevOpponentTurnDestroyedStonesByPlayer
            && typeof cardState.prevOpponentTurnDestroyedStonesByPlayer === 'object'
            && Array.isArray(cardState.prevOpponentTurnDestroyedStonesByPlayer.black)
            && Array.isArray(cardState.prevOpponentTurnDestroyedStonesByPlayer.white)
        ) {
            return cardState.prevOpponentTurnDestroyedStonesByPlayer;
        }
        cardState.prevOpponentTurnDestroyedStonesByPlayer = cloneSalvationDestroyedLedger(
            cardState.prevOpponentTurnDestroyedStonesByPlayer || cardState.prevOpponentTurnDestroyedNormalByPlayer
        );
        return cardState.prevOpponentTurnDestroyedStonesByPlayer;
    }

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
    const EXTREME_HYPERACTIVE_DESTROY_EVADE_LIMIT = 1;
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
    const SEED_WILL_TURNS = 5;
    const TRAP_WILL_STEAL_MAX = 20;
    const GUARD_WILL_TURNS = 3;
    const GUARDIAN_GOD_TURNS = 10;
    const RIBO_WILL_UNLOCK_TURN_INDEX = 19;
    const RIBO_WILL_INITIAL_GAIN = 30;
    const RIBO_WILL_REPAYMENT_AMOUNT = 4;
    const RIBO_WILL_OWNER_TURNS = 9;
    const RIBO_WILL_SHORTAGE_DESTROY_COUNT = 2;
    const REINFORCEMENT_WILL_SPAWN_COUNT = 1;
    const EQUALITY_WILL_MAX_SPAWNS = 3;
    const FLIP_CHARGE_MULTIPLIER_EFFECTS = Object.freeze({
        GOLD_STONE: { multiplier: 4, effectFlag: 'goldStoneUsed', destroyReason: 'gold_stone_sacrifice' },
        RAINBOW_STONE: { multiplier: 6, effectFlag: 'rainbowStoneUsed', destroyReason: 'rainbow_stone_sacrifice' },
        SILVER_STONE: { multiplier: 3, effectFlag: 'silverStoneUsed', destroyReason: 'silver_stone_sacrifice' }
    });
    const ENABLED_CARD_ID_SET = new Set((CARD_DEFS || []).reduce((out: any[], cardDef: any) => {
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
        GOLD_STONE: 'GOLD_STONE',
        SILVER_STONE: 'SILVER_STONE',
        RAINBOW_STONE: 'RAINBOW_STONE'
    });
    const NUMBER_CELL_CHARGE_MULTIPLIER_EFFECTS = Object.freeze({
        CRYSTAL_STONE: {
            multiplier: 2,
            effectFlag: 'crystalStoneUsed',
            gainField: 'crystalStoneGain'
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

    function addGeneratedProgressionCard(cardState: any, playerKey: any, sourceCardId: any, sourceCardType: any, configByType: any) {
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

    function addGeneratedThrowChainCard(cardState: any, playerKey: any, sourceCardId: any, sourceCardType: any) {
        return addGeneratedProgressionCard(cardState, playerKey, sourceCardId, sourceCardType, THROW_CHAIN_CONFIG_BY_TYPE);
    }

    function addGeneratedChainWillCard(cardState: any, playerKey: any, sourceCardId: any, sourceCardType: any) {
        return addGeneratedProgressionCard(cardState, playerKey, sourceCardId, sourceCardType, CHAIN_WILL_CONFIG_BY_TYPE);
    }

    function resolveChainWillMaxLinks(gameState: any, config: any) {
        if (!config) return 0;
        if (!config.infinite) {
            const extraLinks = Number(config.extraLinks);
            return Number.isFinite(extraLinks) && extraLinks > 0 ? Math.floor(extraLinks) : 0;
        }
        const board = gameState && Array.isArray(gameState.board) ? gameState.board : null;
        if (!board || !board.length) {
            const boardConfig = resolveCardBoardConfig(gameState);
            return Math.max(1, boardConfig.rows * boardConfig.cols);
        }
        const totalCells = board.reduce((sum: any, row: any) => sum + (Array.isArray(row) ? row.length : 0), 0);
        return Math.max(1, totalCells);
    }

    function isWorkDebugEnabled(cardState: any) {
        if (cardState && cardState.debugWorkLog === true) return true;
        return false;
    }

    function workDebugLog(cardState: any) {
        if (!isWorkDebugEnabled(cardState)) return;
        try { if (typeof console !== 'undefined' && console.log) console.log.apply(console, Array.prototype.slice.call(arguments, 1)); } catch (e) { /* ignore */ }
    }

    function workDebugError(cardState: any) {
        if (!isWorkDebugEnabled(cardState)) return;
        try { if (typeof console !== 'undefined' && console.error) console.error.apply(console, Array.prototype.slice.call(arguments, 1)); } catch (e) { /* ignore */ }
    }

    function destroyAt(cardState: any, gameState: any, row: any, col: any, meta?: any) {
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

    function isDestroyResolved(result: any) {
        if (DestroyOutcomeContract && typeof DestroyOutcomeContract.isDestroyOutcomeResolved === 'function') {
            return DestroyOutcomeContract.isDestroyOutcomeResolved(result);
        }
        return !!(result && (result.destroyed || result.regenerated || result.livingWillRevived || result.evaded || result.blockedByGhost || result.proliferated));
    }

    function createDestroyOutcome(kindOrResult?: any, details?: any) {
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

    function clearBombAt(cardState: any, row: any, col: any) {
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
        shuffle: (array: any) => array,
        random: () => {
            throw new Error('PRNG.random() called without injected PRNG. Inject a deterministic PRNG for rule logic.');
        }
    };

    function resolveDeterministicRandomSource(randomLike: any, fallbackLike: any, label: any) {
        if (CardRandomSource && typeof CardRandomSource.resolveRandomSource === 'function') {
            return CardRandomSource.resolveRandomSource(randomLike, fallbackLike, label);
        }
        if (randomLike && typeof randomLike.random === 'function') return randomLike;
        if (typeof randomLike === 'function') return { random: randomLike };
        if (fallbackLike && typeof fallbackLike.random === 'function') return fallbackLike;
        if (typeof fallbackLike === 'function') return { random: fallbackLike };
        throw new Error(`${String(label || 'CardLogic').trim() || 'CardLogic'} requires an injected deterministic PRNG.`);
    }

    function readDeterministicRandomUnit(randomLike: any, fallbackLike: any, label: any) {
        if (CardRandomSource && typeof CardRandomSource.readRandomUnit === 'function') {
            return CardRandomSource.readRandomUnit(randomLike, fallbackLike, label);
        }
        const randomSource = resolveDeterministicRandomSource(randomLike, fallbackLike, label);
        const raw = Number(randomSource.random());
        if (!Number.isFinite(raw)) {
            throw new Error(`${String(label || 'CardLogic').trim() || 'CardLogic'} received a PRNG that returned a non-finite value.`);
        }
        return Math.max(0, Math.min(0.999999, raw));
    }

    function resolveDeterministicRandomIndex(length: any, randomLike: any, fallbackLike: any, label: any) {
        if (CardRandomSource && typeof CardRandomSource.resolveRandomIndex === 'function') {
            return CardRandomSource.resolveRandomIndex(length, randomLike, fallbackLike, label);
        }
        if (!Number.isInteger(length) || length <= 0) return 0;
        return Math.floor(readDeterministicRandomUnit(randomLike, fallbackLike, label) * length);
    }

    function getDefaultDeckSize() {
        if (DeckSpecHelpers && typeof DeckSpecHelpers.getDefaultDeckSize === 'function') {
            return DeckSpecHelpers.getDefaultDeckSize();
        }
        return 30;
    }

    function buildDefaultDeckCardIds(prng: any) {
        if (!CardStateManager || typeof CardStateManager.createDefaultDeck !== 'function') {
            throw new Error('[cards.js] CardStateManager.createDefaultDeck not available');
        }
        return CardStateManager.createDefaultDeck(prng);
    }

    function expandInitialDeckSpec(deckSpec: any) {
        if (!deckSpec) return null;
        if (!DeckSpecHelpers || typeof DeckSpecHelpers.expandDeckSpec !== 'function') {
            throw new Error('DeckSpecHelpers is required for custom deck initialization');
        }
        return DeckSpecHelpers.expandDeckSpec(deckSpec);
    }

    function normalizeInitialDeckCardIds(deckCardIds: any) {
        if (!Array.isArray(deckCardIds)) return null;
        return deckCardIds.map((cardId: any, index: any) => {
            const normalizedCardId = String(cardId || '').trim();
            if (!normalizedCardId || !ENABLED_CARD_ID_SET.has(normalizedCardId)) {
                throw new Error(`Invalid initial deck card id at index ${index}: ${normalizedCardId || '(empty)'}`);
            }
            return normalizedCardId;
        });
    }

    function resolveExplicitInitialDeckCardIds(options: any, playerKey: any) {
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

        return deckSpec ? expandInitialDeckSpec(deckSpec) : null;
    }

    function resolveInitialDeckCardIdsByPlayer(options: any, prng: any) {
        const blackExplicitDeck = resolveExplicitInitialDeckCardIds(options, 'black');
        const whiteExplicitDeck = resolveExplicitInitialDeckCardIds(options, 'white');
        const sharedDefaultDeck = (!blackExplicitDeck && !whiteExplicitDeck)
            ? buildDefaultDeckCardIds(prng)
            : null;

        return {
            black: blackExplicitDeck
                ? blackExplicitDeck.slice()
                : (sharedDefaultDeck ? sharedDefaultDeck.slice() : buildDefaultDeckCardIds(prng)),
            white: whiteExplicitDeck
                ? whiteExplicitDeck.slice()
                : (sharedDefaultDeck ? sharedDefaultDeck.slice() : buildDefaultDeckCardIds(prng))
        };
    }

    const CardCostsModule = requireOptionalCardLogicModule('./cards/costs');
    const CardDefsModule = requireOptionalCardLogicModule('./cards/defs');
    const CardUtilsModule = requireOptionalCardLogicModule('./cards/utils');

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

    function setChargeValue(cardState: any, playerKey: any, nextValue: any, reason: any, meta?: any) {
        if (!CardStateManager || typeof CardStateManager.normalizeCharge !== 'function') {
            throw new Error('[cards.js] CardStateManager.normalizeCharge not available');
        }
        return CardStateManager.normalizeCharge(cardState, playerKey, nextValue, reason, meta);
    }

    const CardExpansionModule = resolveCardLogicGlobalOrModule('CardExpansion', './cards/expansion');
    const CardMarkersModule = resolveCardLogicGlobalOrModule('CardMarkers', './cards/markers');
    /** @type {any} */
    const CardMovementModule = resolveRequiredCardModule('./cards/movement', 'CardMovement');
    /** @type {any} */
    const CardTeleportModule = resolveRequiredCardModule('./cards/teleport', 'CardTeleport');
    /** @type {any} */
    const CardCloneModule = resolveRequiredCardModule('./cards/clone', 'CardClone');
    /** @type {any} */
    const CardMeteorModule = resolveRequiredCardModule('./cards/meteor', 'CardMeteor');
    /** @type {any} */
    const CardShrinkModule = resolveRequiredCardModule('./cards/shrink', 'CardShrink');
    /** @type {any} */
    const CardLivingWillModule = resolveRequiredCardModule('./cards/living_will', 'CardLivingWill');
    const CardTargetsModule = resolveCardLogicGlobalOrModule('CardTargets', './cards/targets');
    const CardFlipsModule = resolveRequiredCardModule('./cards/flips', 'CardFlips');
    const CardChainModule = resolveRequiredCardModule('./cards/chain', 'CardChain');
    const CardRegenModule = resolveRequiredCardModule('./cards/regen', 'CardRegen');
    const CardTimeBombModule = resolveRequiredCardModule('./cards/time_bomb', 'CardTimeBomb');
    /** @type {any} */
    const CardBreedingModule = resolveRequiredCardModule('./cards/breeding', 'CardBreeding');
    const CardHyperactiveModule = resolveRequiredCardModule('./cards/hyperactive', 'CardHyperactive');
    const CardUdgModule = resolveRequiredCardModule('./cards/udg', 'CardUdg');
    /** @type {any} */
    const CardSniperModule = resolveRequiredCardModule('./cards/sniper', 'CardSniper');
    const CardLightningModule = resolveRequiredCardModule('./cards/lightning', 'CardLightning');
    /** @type {any} */
    const CardWillHunterKingModule = resolveRequiredCardModule('./cards/will_hunter_king', 'CardWillHunterKing');
    /** @type {any} */
    const CardDestroyDragonModule = resolveRequiredCardModule('./cards/destroy_dragon', 'CardDestroyDragon');
    const DragonEffectsModule = resolveRequiredCardModule('./effects/dragon', 'DragonEffects');
    const DestroyOneStoneModule = resolveRequiredCardModule('./effects/destroy_one_stone', 'DestroyOneStoneEffects');
    const SwapWithEnemyModule = resolveRequiredCardModule('./effects/swap_with_enemy', 'SwapWithEnemyEffects');
    const CardProtectModule = resolveRequiredCardModule('../cards/effects/protect', 'CardProtectEffects');
    const CardTrapModule = resolveRequiredCardModule('../cards/effects/trap', 'CardTrapEffects');
    const CardOwnershipEffectsModule = resolveRequiredCardModule('../cards/effects/ownership', 'CardOwnershipEffects');
    const CardBoardExpansionApplyModule = resolveRequiredCardModule('../cards/effects/board-expansion-apply', 'CardBoardExpansionApply');
    const CardStatusCellsModule = resolveRequiredCardModule('../cards/effects/status-cells', 'CardStatusCellsEffects');
    const CardHandEffectsModule = resolveRequiredCardModule('../cards/effects/hand-effects', 'CardHandEffects');
    const CardPositionSwapModule = resolveRequiredCardModule('../cards/effects/position-swap', 'CardPositionSwapEffects');

    function addChargeValue(cardState: any, playerKey: any, amount: any, reason: any, meta?: any) {
        if (!CardStateManager || typeof CardStateManager.addCharge !== 'function') {
            throw new Error('[cards.js] CardStateManager.addCharge not available');
        }
        return CardStateManager.addCharge(cardState, playerKey, amount, reason, meta);
    }

    function ensureRiboRepaymentsByPlayer(cardState: any) {
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

    function isGuardProtectedCell(cardState: any, row: any, col: any) {
        return requireCardMarkersMethod('isGuardProtectedCell')(cardState, row, col);
    }

    function getRiboExpansionDescriptors(gameState: any) {
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
        const boardConfig = resolveCardBoardConfig(gameState);
        const out = [];
        for (const cell of sourceCells) {
            if (!cell || typeof cell !== 'object') continue;
            const row = Number(cell.row);
            let col = null;
            if (Number.isInteger(cell.col)) {
                col = cell.col;
            } else if (cell.side === 'left') {
                col = boardConfig.outerBounds.minCol;
            } else if (cell.side === 'right') {
                col = boardConfig.outerBounds.maxCol;
            }
            if (!Number.isInteger(row) || !Number.isInteger(col)) continue;
            out.push({ row, col, owner: cell.owner });
        }
        return out;
    }

    function collectRiboDestroyableOwnStonePositions(cardState: any, gameState: any, playerKey: any) {
        const out = [];
        const playerValue = playerKey === 'black' ? BLACK : WHITE;
        const boardConfig = resolveCardBoardConfig(gameState);
        const board = gameState && Array.isArray(gameState.board) ? gameState.board : [];

        for (let row = 0; row < boardConfig.rows; row++) {
            const boardRow = Array.isArray(board[row]) ? board[row] : [];
            for (let col = 0; col < boardConfig.cols; col++) {
                if (boardRow[col] !== playerValue) continue;
                if (isGuardProtectedCell(cardState, row, col)) continue;
                out.push({ row, col });
            }
        }

        const expansionCells = getRiboExpansionDescriptors(gameState);
        for (const cell of expansionCells) {
            if (!cell || cell.owner !== playerValue) continue;
            if (isGuardProtectedCell(cardState, cell.row, cell.col)) continue;
            out.push({ row: cell.row, col: cell.col });
        }

        return out;
    }

    function sampleRandomPositions(positions: any, count: any, prng: any) {
        if (!Array.isArray(positions) || positions.length === 0 || !Number.isFinite(count) || count <= 0) return [];
        const pool = positions.slice();
        const out = [];
        while (pool.length > 0 && out.length < count) {
            const index = resolveDeterministicRandomIndex(pool.length, prng, null, 'CardLogic.sampleRandomPositions');
            out.push(pool.splice(index, 1)[0]);
        }
        return out;
    }

    function collectTimeStopGodDestroyableOwnStonePositions(cardState: any, gameState: any, playerKey: any) {
        return collectRiboDestroyableOwnStonePositions(cardState, gameState, playerKey).filter((pos: any) => {
            if (!pos) return false;
            if (isFrozenCellForCard(cardState, pos.row, pos.col)) return false;
            const marker = findSpecialMarkerAt(cardState, pos.row, pos.col);
            const destroyEvadeRemaining = Number(marker && marker.data && marker.data.destroyEvadeRemaining);
            return !(Number.isFinite(destroyEvadeRemaining) && destroyEvadeRemaining > 0);
        });
    }

    function destroyCellWithPresentation(cardState: any, gameState: any, row: any, col: any, cause: any, reason: any, meta: any) {
        if (isMainBoardCellForCard(row, col, gameState) && BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function') {
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

    function revertSpecialStoneWithPresentation(cardState: any, gameState: any, row: any, col: any, specialType: any, ownerKey: any, cause: any, reason: any, meta: any) {
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

    function ensureTimeStopConsecutiveTurnsRemainingByPlayer(cardState: any) {
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

    function getTimeStopGodDestroyableCount(cardState: any, gameState: any, playerKey: any) {
        return collectTimeStopGodDestroyableOwnStonePositions(cardState, gameState, playerKey).length;
    }

    function canUseTimeStopGodForPlayer(cardState: any, gameState: any, playerKey: any) {
        if (!gameState || !Array.isArray(gameState.board)) return false;
        return getTimeStopGodDestroyableCount(cardState, gameState, playerKey) >= TIME_STOP_GOD_SELF_DESTROY_COUNT;
    }

    function resolveTimeStopGodUsage(cardState: any, gameState: any, playerKey: any, prng: any) {
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

    function reserveTimeStopConsecutiveTurns(cardState: any, playerKey: any, totalTurns: any) {
        const byPlayer = ensureTimeStopConsecutiveTurnsRemainingByPlayer(cardState);
        const requestedTurns = Number.isFinite(Number(totalTurns))
            ? Math.max(1, Math.floor(Number(totalTurns)))
            : TIME_STOP_GOD_CONSECUTIVE_TURNS;
        const current = Math.max(0, Number(byPlayer[playerKey]) || 0);
        const increment = current > 0 ? Math.max(0, requestedTurns - 1) : requestedTurns;
        byPlayer[playerKey] = current + increment;
        return byPlayer[playerKey];
    }

    function consumeTimeStopConsecutiveTurn(cardState: any, playerKey: any) {
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

    function processTimeStopEffectsAtTurnStartAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        const marker = findSpecialMarkerAt(cardState, row, col, 'TIME_STOP', playerKey);
        if (!marker) {
            return { triggered: [], fizzled: [] };
        }

        const playerValue = playerKey === 'black' ? BLACK : WHITE;
        const cellValue = getCellValueForCard(gameState, row, col);
        if (cellValue !== playerValue) {
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

    function armRiboWillEffect(cardState: any, playerKey: any) {
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

    function collectRandomBoardSpawnablePositions(cardState: any, gameState: any, predicate: any) {
        return getEmptyBoardShapeCellsForCard(cardState, gameState)
            .filter((cell: any) => {
                if (!cell) return false;
                if (isBlockedCell(cardState, cell.row, cell.col, gameState)) return false;
                if (typeof predicate === 'function' && predicate(cell) !== true) return false;
                return true;
            });
    }

    function resolveRandomBoardSpawnEffectUsage(cardState: any, gameState: any, playerKey: any, requestedCount: any, prng: any, cause: any, reason: any, options: any = {}) {
        const normalizedRequestedCount = Number.isFinite(Number(requestedCount))
            ? Math.max(0, Math.trunc(Number(requestedCount)))
            : 0;
        const targets = sampleRandomPositions(
            collectRandomBoardSpawnablePositions(cardState, gameState, options.targetFilter),
            normalizedRequestedCount,
            prng
        );
        const spawnMetaFactory = (typeof options.spawnMetaFactory === 'function')
            ? options.spawnMetaFactory
            : ((spawnIndex: any) =>({
                owner: playerKey,
                requestedCount: normalizedRequestedCount,
                spawnIndex
            }));
        const normalFlip = options.normalFlip === true;
        const player = playerKey === 'white' ? WHITE : BLACK;
        let spawned = [];
        let flipped = [];
        let usedSharedSpawnAndFlip = false;
        let sharedSpawnAndFlipBatch = null;
        let sharedSpawnCount = 0;

        if (normalFlip && BoardOpsModule && typeof BoardOpsModule.spawnAt === 'function' && typeof BoardOpsModule.changeAt === 'function') {
            if (CardBreedingModule && typeof CardBreedingModule.spawnAndFlipBatch === 'function') {
                sharedSpawnAndFlipBatch = CardBreedingModule.spawnAndFlipBatch;
            }
            if (sharedSpawnAndFlipBatch) {
                const batch = sharedSpawnAndFlipBatch(
                    cardState,
                    gameState,
                    playerKey,
                    player,
                    targets.filter(Boolean),
                    cause,
                    reason,
                    {
                        row: Number.isInteger(options.anchorRow) ? options.anchorRow : null,
                        col: Number.isInteger(options.anchorCol) ? options.anchorCol : null
                    },
                    {
                        getCardContext,
                        getFlipsWithContext: getFlipsWithContextLocal,
                        clearBombAt,
                        clearHyperactiveAtPositions,
                        changeCause: cause,
                        changeReason: options.flipReason || 'breeding_flip',
                        BoardOps: {
                            spawnAt: (innerCardState: any, innerGameState: any, row: any, col: any, ownerKey: any, spawnCause: any, spawnReason: any) => {
                                sharedSpawnCount += 1;
                                const spawnIndex = sharedSpawnCount;
                                return BoardOpsModule.spawnAt(
                                    innerCardState,
                                    innerGameState,
                                    row,
                                    col,
                                    ownerKey,
                                    spawnCause,
                                    spawnReason,
                                    spawnMetaFactory(spawnIndex, { row, col })
                                );
                            },
                            runSpawnBlock: BoardOpsModule && typeof BoardOpsModule.runSpawnBlock === 'function'
                                ? BoardOpsModule.runSpawnBlock
                                : null,
                            changeAt: (innerCardState: any, innerGameState: any, row: any, col: any, ownerKey: any, flipCause: any, flipReason: any, meta: any) => (
                                BoardOpsModule.changeAt(innerCardState, innerGameState, row, col, ownerKey, flipCause, flipReason, meta)
                            )
                        }
                    }
                );
                usedSharedSpawnAndFlip = true;
                spawned = Array.isArray(batch && batch.spawned) ? batch.spawned.slice() : [];
                flipped = Array.isArray(batch && batch.flipped) ? batch.flipped.slice() : [];
            }
        }

        if (!normalFlip || !usedSharedSpawnAndFlip) {
            spawned = [];
            flipped = [];
            const validTargets = targets.filter(Boolean);
            if (BoardOpsModule && typeof BoardOpsModule.spawnMany === 'function') {
                const batch = BoardOpsModule.spawnMany(
                    cardState,
                    gameState,
                    validTargets,
                    playerKey,
                    cause,
                    reason,
                    {
                        requestedCount: normalizedRequestedCount,
                        metaFactory: (spawnIndex: any, target: any) => spawnMetaFactory(spawnIndex, target)
                    }
                );
                spawned = Array.isArray(batch && batch.spawned) ? batch.spawned.slice() : [];
            } else {
                for (const target of validTargets) {
                    const spawnIndex: number = spawned.length + 1;
                    const spawnMeta: any = spawnMetaFactory(spawnIndex, target);
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
                        const playerValue = playerKey === 'white' ? WHITE : BLACK;
                        const wroteCell = setCellValueForCard(gameState, target.row, target.col, playerValue);
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
            }
        }

        return {
            applied: true,
            requestedCount: normalizedRequestedCount,
            spawnedCount: spawned.length,
            spawned,
            flippedCount: flipped.length,
            flipped
        };
    }

    function resolveEqualityWillUsage(cardState: any, gameState: any, playerKey: any, prng: any) {
        return resolveRandomBoardSpawnEffectUsage(
            cardState,
            gameState,
            playerKey,
            EQUALITY_WILL_MAX_SPAWNS,
            prng,
            'EQUALITY_WILL',
            'equality_will_spawn',
            {
                normalFlip: true,
                flipReason: 'equality_will_flip',
                spawnMetaFactory: (spawnIndex: any) => ({
                    owner: playerKey,
                    requestedCount: EQUALITY_WILL_MAX_SPAWNS,
                    spawnIndex
                })
            }
        );
    }

    function isInnerPlayableCellForReinforcement(cardState: any, gameState: any, row: any, col: any) {
        if (!hasBoardShapeCellForCard(cardState, gameState, row, col)) return false;
        const orthogonal = [
            [row - 1, col],
            [row + 1, col],
            [row, col - 1],
            [row, col + 1]
        ];
        return orthogonal.every((pos: any) => hasBoardShapeCellForCard(cardState, gameState, pos[0], pos[1]));
    }

    function isAdjacentToAnyStoneForReinforcement(cardState: any, gameState: any, row: any, col: any) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nextRow = row + dr;
                const nextCol = col + dc;
                if (!hasBoardShapeCellForCard(cardState, gameState, nextRow, nextCol)) continue;
                if (getCellValueForCard(gameState, nextRow, nextCol) !== EMPTY) return true;
            }
        }
        return false;
    }

    function getReinforcementWillTargets(cardState: any, gameState: any, playerKey: any) {
        return getReinforcementTargets(cardState, gameState, playerKey);
    }

    function canUseReinforcementWillForPlayer(cardState: any, gameState: any, playerKey: any) {
        return getReinforcementWillTargets(cardState, gameState, playerKey).length > 0;
    }

    function resolveReinforcementWillUsage(cardState: any, gameState: any, playerKey: any, prng: any) {
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'REINFORCEMENT_WILL') {
            return { applied: false, reason: 'not_pending', requestedCount: 0, spawnedCount: 0, spawned: [], flippedCount: 0, flipped: [] };
        }
        const targetSet = new Set(getReinforcementWillTargets(cardState, gameState, playerKey).map((cell: any) => `${cell.row},${cell.col}`));
        if (targetSet.size <= 0) {
            clearCardPendingEffect(cardState, playerKey);
            return { applied: false, reason: 'no_targets', requestedCount: REINFORCEMENT_WILL_SPAWN_COUNT, spawnedCount: 0, spawned: [], flippedCount: 0, flipped: [] };
        }
        const result = resolveRandomBoardSpawnEffectUsage(
            cardState,
            gameState,
            playerKey,
            REINFORCEMENT_WILL_SPAWN_COUNT,
            prng,
            'REINFORCEMENT_WILL',
            'reinforcement_will_spawn',
            {
                normalFlip: true,
                flipReason: 'reinforcement_will_flip',
                targetFilter: (cell: any) => targetSet.has(`${cell.row},${cell.col}`),
                spawnMetaFactory: (spawnIndex: any) => ({
                    owner: playerKey,
                    requestedCount: REINFORCEMENT_WILL_SPAWN_COUNT,
                    spawnIndex
                })
            }
        );
        clearCardPendingEffect(cardState, playerKey);
        return result;
    }

    function processRiboWillTurnStartEffects(cardState: any, gameState: any, playerKey: any, prng: any) {
        const riboByPlayer = ensureRiboRepaymentsByPlayer(cardState);
        const active = Array.isArray(riboByPlayer[playerKey]) ? riboByPlayer[playerKey] : [];
        const summary: { entries: any[]; totalRepaid: number; totalDestroyed: number; completedCount: number } = {
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
            const entry: {
                repaymentAmount: any; shortageDestroyCount: any; remainingOwnerTurnsBefore: number; remainingOwnerTurnsAfter: number;
                chargeBefore: number; chargeAfter: number; repaid: number; shortage: boolean; destroyed: any[]; destroyedCount: number; completed: boolean;
            } = {
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
                const destroyTargets = () => {
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
                };
                if (BoardOpsModule && typeof BoardOpsModule.runDestroyBlock === 'function') {
                    BoardOpsModule.runDestroyBlock(cardState, gameState, destroyTargets, { randomSource: prng });
                } else {
                    destroyTargets();
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

    /** @type {any} */
    const CardSelectorsModule = resolveCardLogicGlobalOrModule('CardSelectors', './cards/selectors');
    const CardUsagePrechecksModule = resolveCardLogicGlobalOrModule('CardUsagePrechecks', './cards-internal/card-usage-prechecks');
    const CardSelectorOrchestratorModule = resolveCardLogicGlobalOrModule('CardSelectorOrchestrator', './cards-internal/selector-orchestrator');
    const CardHandManagerModule = resolveCardLogicGlobalOrModule('CardHandManager', './cards-internal/hand-manager');
    const CardEffectTimingModule = resolveCardLogicGlobalOrModule('CardEffectTiming', './cards-internal/effect-timing');
    const CardWorkModule = resolveCardLogicGlobalOrModule('CardWork', './cards/work_will');
    let CardEffectTimingModules: any = null;

    function createCardEffectTimingModules() {
        const specialStoneKind = MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone';
        return Object.freeze({
            CardWorkModule,
            CardLivingWillModule,
            PlunderWillModule: Object.freeze({
                applyPlunderWill(cardState: any, playerKey: any, flipCount: any) {
                    const opponentKey = playerKey === 'black' ? 'white' : 'black';
                    const opponentCharge = (cardState && cardState.charge && Number.isFinite(Number(cardState.charge[opponentKey])))
                        ? Number(cardState.charge[opponentKey])
                        : 0;
                    const normalizedFlipCount = Number.isFinite(Number(flipCount))
                        ? Math.max(0, Math.trunc(Number(flipCount)))
                        : 0;
                    const stolen = Math.min(normalizedFlipCount, Math.max(0, opponentCharge));
                    if (stolen > 0) {
                        addChargeValue(cardState, opponentKey, -stolen, 'plunder_loss');
                    }
                    return { plundered: stolen };
                }
            }),
            ProtectedNextStoneModule: Object.freeze({
                applyProtectedNextStone(cardState: any, playerKey: any, row: any, col: any) {
                    addMarker(cardState, specialStoneKind, row, col, playerKey, {
                        type: 'PROTECTED',
                        expiresForPlayer: playerKey
                    });
                    return { applied: true };
                }
            }),
            PermaProtectNextStoneModule: Object.freeze({
                applyPermaProtectNextStone(cardState: any, playerKey: any, row: any, col: any) {
                    return applyStrongWill(cardState, playerKey, row, col);
                }
            }),
            BoardOpsModule
        });
    }

    function getCardEffectTimingModules() {
        if (!CardEffectTimingModules) {
            CardEffectTimingModules = createCardEffectTimingModules();
        }
        return CardEffectTimingModules;
    }

    function getLivingWillModuleContext() {
        return {
            readCardPendingEffect,
            clearCardPendingEffect,
            getLivingWillTargets: typeof getLivingWillTargets === 'function' ? getLivingWillTargets : (() => []),
            emitPresentationEvent,
            BoardOps: BoardOpsModule,
            random: defaultPrng,
            defaults: {
                regenReviveLimit: 3,
                breedingTurns: 5,
                proliferationTurns: 10,
                ultimateDragonTurns: ULTIMATE_DRAGON_TURNS,
                ultimateDestroyGodTurns: ULTIMATE_DESTROY_GOD_TURNS,
                sniperTurns: SNIPER_WILL_TURNS,
                observerTurns: OBSERVER_WILL_TURNS,
                ghostTurns: GHOST_WILL_TURNS,
                afterimageFlipEvadeLimit: AFTERIMAGE_WILL_FLIP_EVADE_LIMIT,
                afterimageDestroyEvadeLimit: AFTERIMAGE_WILL_DESTROY_EVADE_LIMIT,
                timeStopTurns: TIME_STOP_GOD_TURNS,
                willHunterKingTurns: WILL_HUNTER_KING_TURNS,
                destroyDragonTurns: DESTROY_DRAGON_TURNS,
                lightningTurns: LIGHTNING_WILL_TURNS,
                extremeHyperactiveFlipEvadeLimit: EXTREME_HYPERACTIVE_FLIP_EVADE_LIMIT,
                extremeHyperactiveDestroyEvadeLimit: EXTREME_HYPERACTIVE_DESTROY_EVADE_LIMIT,
                robotVacuumTurns: ROBOT_VACUUM_TURNS,
                inheritedHyperactiveTurns: INHERITED_HYPERACTIVE_TURNS,
                ultimateHyperactiveTurns: ULTIMATE_HYPERACTIVE_TURNS,
                ultimateHyperactiveFlipEvadeLimit: ULTIMATE_HYPERACTIVE_FLIP_EVADE_LIMIT,
                ultimateHyperactiveDestroyEvadeLimit: ULTIMATE_HYPERACTIVE_DESTROY_EVADE_LIMIT,
                guardTurns: GUARD_WILL_TURNS,
                guardianGodTurns: GUARDIAN_GOD_TURNS,
                workTurns: 5
            }
        };
    }

    const CardPendingStateManagerModule = requireOptionalCardLogicModule('./cards-internal/pending-state-manager');
    const PendingCoordinatorModule = requireOptionalCardLogicModule('../turn/pending-coordinator');
    const CardChargeLedgerModule = requireOptionalCardLogicModule('./cards-internal/charge-ledger');

    function readCardPendingEffect(cardState: any, playerKey: any) {
        if (PendingCoordinatorModule && typeof PendingCoordinatorModule.readPendingEffect === 'function') {
            return PendingCoordinatorModule.readPendingEffect(cardState, playerKey);
        }
        return (cardState && cardState.pendingEffectByPlayer) ? (cardState.pendingEffectByPlayer[playerKey] || null) : null;
    }

    function writeCardPendingEffect(cardState: any, playerKey: any, pendingEffect: any, options: any) {
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

    function clearCardPendingEffect(cardState: any, playerKey: any, options?: any) {
        if (PendingCoordinatorModule && typeof PendingCoordinatorModule.clearPendingEffect === 'function') {
            const result = PendingCoordinatorModule.clearPendingEffect(cardState, playerKey, options);
            return !!(result && result.ok);
        }
        if (!cardState || !cardState.pendingEffectByPlayer) return false;
        cardState.pendingEffectByPlayer[playerKey] = null;
        return true;
    }

    const BoardOpsModule = requireOptionalCardLogicModule('./board_ops');
    const MarkersAdapter = requireOptionalCardLogicModule('./markers_adapter');
    const MARKER_KINDS = (CardMarkersModule && CardMarkersModule.MARKER_KINDS)
        || (MarkersAdapter && MarkersAdapter.MARKER_KINDS);
    const MARKER_CATEGORIES = (CardMarkersModule && CardMarkersModule.MARKER_CATEGORIES)
        || (MarkersAdapter && MarkersAdapter.MARKER_CATEGORIES)
        || { BOMB: 'bomb' };

    function runBoardOpsDestroyBlock(cardState: any, gameState: any, fn: any, meta?: any) {
        if (BoardOpsModule && typeof BoardOpsModule.runDestroyBlock === 'function') {
            return BoardOpsModule.runDestroyBlock(cardState, gameState, fn, meta || {});
        }
        return (typeof fn === 'function') ? fn() : undefined;
    }

    function requireCardMarkersMethod(name: any) {
        const fn = CardMarkersModule && CardMarkersModule[name];
        if (typeof fn !== 'function') {
            throw new Error(`[cards.js] CardMarkers.${name} not available`);
        }
        return fn;
    }

    function ensureMarkers(cardState: any) {
        return requireCardMarkersMethod('ensureMarkers')(cardState);
    }

    function getMarkers(cardState: any) {
        if (!CardStateManager || typeof CardStateManager.getMarkers !== 'function') {
            throw new Error('[cards.js] CardStateManager.getMarkers not available');
        }
        return CardStateManager.getMarkers(cardState);
    }

    function getMarkerCategory(marker: any) {
        return requireCardMarkersMethod('getMarkerCategory')(marker);
    }

    function isBombCategoryMarker(marker: any) {
        return requireCardMarkersMethod('isBombCategoryMarker')(marker);
    }

    function getBombMarkerType(marker: any) {
        return requireCardMarkersMethod('getBombMarkerType')(marker);
    }

    function getSpecialMarkers(cardState: any) {
        return requireCardMarkersMethod('getSpecialMarkers')(cardState);
    }

    function getBombMarkers(cardState: any) {
        return requireCardMarkersMethod('getBombMarkers')(cardState);
    }

    function getBlockadeMarkers(cardState: any) {
        return requireCardMarkersMethod('getBlockadeMarkers')(cardState);
    }

    function getBlockingMarkers(cardState: any) {
        return requireCardMarkersMethod('getBlockingMarkers')(cardState);
    }

    function isFrozenCellForCard(cardState: any, row: any, col: any) {
        return requireCardMarkersMethod('isFrozenCellForCard')(cardState, row, col);
    }

    function isMeteorHoleCell(cardState: any, row: any, col: any) {
        return requireCardMarkersMethod('isMeteorHoleCell')(cardState, row, col);
    }

    function isMainBoardCellForCard(row: any, col: any, boardOrConfig: any) {
        if (CardExpansionModule && typeof CardExpansionModule.isMainBoardCellForCard === 'function') {
            return CardExpansionModule.isMainBoardCellForCard(row, col, boardOrConfig);
        }
        const config = resolveCardBoardConfig(boardOrConfig);
        return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < config.rows && col >= 0 && col < config.cols;
    }

    function resolveExpansionSideForCard(side: any, row: any, col: any, boardOrConfig: any) {
        if (CardExpansionModule && typeof CardExpansionModule.resolveExpansionSideForCard === 'function') {
            return CardExpansionModule.resolveExpansionSideForCard(side, row, col, boardOrConfig);
        }
        if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
        const config = resolveCardBoardConfig(boardOrConfig);
        if (col === config.outerBounds.minCol) return 'left';
        if (col === config.outerBounds.maxCol) return 'right';
        if (row === config.outerBounds.minRow) return 'top';
        if (row === config.outerBounds.maxRow) return 'bottom';
        return null;
    }

    function normalizeExpansionOwnerForCard(owner: any) {
        if (CardExpansionModule && typeof CardExpansionModule.normalizeExpansionOwnerForCard === 'function') {
            return CardExpansionModule.normalizeExpansionOwnerForCard(owner);
        }
        if (BoardUtils && typeof BoardUtils.normalizeOwner === 'function') {
            const normalizedOwner = BoardUtils.normalizeOwner(owner);
            return (normalizedOwner === BLACK || normalizedOwner === WHITE) ? normalizedOwner : EMPTY;
        }
        return (owner === BLACK || owner === WHITE) ? owner : EMPTY;
    }

    function isExpansionCoordinateForCard(row: any, col: any, boardOrConfig: any) {
        if (CardExpansionModule && typeof CardExpansionModule.isExpansionCoordinateForCard === 'function') {
            return CardExpansionModule.isExpansionCoordinateForCard(row, col, boardOrConfig);
        }
        if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
        const config = resolveCardBoardConfig(boardOrConfig);
        if (row < config.outerBounds.minRow || row > config.outerBounds.maxRow) return false;
        if (col < config.outerBounds.minCol || col > config.outerBounds.maxCol) return false;
        if (isMainBoardCellForCard(row, col, config)) return false;
        return true;
    }

    function getExpansionDescriptorsForCard(gameState: any) {
        if (CardExpansionModule && typeof CardExpansionModule.getExpansionDescriptorsForCard === 'function') {
            return CardExpansionModule.getExpansionDescriptorsForCard(gameState);
        }
        return [];
    }

    function syncLegacyExpansionFieldsForCard(expansion: any) {
        if (CardExpansionModule && typeof CardExpansionModule.syncLegacyExpansionFieldsForCard === 'function') {
            return CardExpansionModule.syncLegacyExpansionFieldsForCard(expansion, null);
        }
    }

    function ensureMutableBoardExpansionForCard(gameState: any) {
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

    function writeExpansionDescriptorsForCard(gameState: any, cells: any) {
        if (CardExpansionModule && typeof CardExpansionModule.writeExpansionDescriptorsForCard === 'function') {
            return CardExpansionModule.writeExpansionDescriptorsForCard(gameState, cells);
        }
        const boardExpansion = ensureMutableBoardExpansionForCard(gameState);
        if (!boardExpansion) return null;
        boardExpansion.cells = Array.isArray(cells) ? cells.slice() : [];
        return boardExpansion;
    }

    function getCellValueForCard(gameState: any, row: any, col: any) {
        if (CardExpansionModule && typeof CardExpansionModule.getCellValueForCard === 'function') {
            return CardExpansionModule.getCellValueForCard(gameState, row, col);
        }
        return (isMainBoardCellForCard(row, col, gameState) && gameState && Array.isArray(gameState.board) && Array.isArray(gameState.board[row]))
            ? gameState.board[row][col]
            : null;
    }

    function setCellValueForCard(gameState: any, row: any, col: any, value: any) {
        if (CardExpansionModule && typeof CardExpansionModule.setCellValueForCard === 'function') {
            return CardExpansionModule.setCellValueForCard(gameState, row, col, value);
        }
        if (isMainBoardCellForCard(row, col, gameState)) {
            if (!gameState || !Array.isArray(gameState.board) || !Array.isArray(gameState.board[row])) return false;
            gameState.board[row][col] = value;
            return true;
        }
        return false;
    }

    function clearStoneIdAtForCard(cardState: any, gameState: any, row: any, col: any) {
        return requireCardMarkersMethod('clearStoneIdAtForCard')(cardState, gameState, row, col);
    }

    function getStoneIdAtForCard(cardState: any, gameState: any, row: any, col: any) {
        return requireCardMarkersMethod('getStoneIdAtForCard')(cardState, gameState, row, col);
    }

    function setStoneIdAtForCard(cardState: any, gameState: any, row: any, col: any, stoneId: any) {
        return requireCardMarkersMethod('setStoneIdAtForCard')(cardState, gameState, row, col, stoneId);
    }

    function isBlockedCell(cardState: any, row: any, col: any, gameState: any) {
        const rowNum = Number(row);
        const colNum = Number(col);
        if (!Number.isInteger(rowNum) || !Number.isInteger(colNum)) return false;
        const isExpansionCell = getExpansionDescriptorsForCard(gameState)
            .some((desc: any) => desc && desc.row === rowNum && desc.col === colNum);
        if (!isExpansionCell && !isMainBoardCellForCard(rowNum, colNum, gameState)) return false;
        return getBlockingMarkers(cardState).some((m: any) => m.row === rowNum && m.col === colNum);
    }

    function toBoardCellKey(row: any, col: any) {
        return `${row},${col}`;
    }

    function hasMeteorHoleAtForCard(cardState: any, row: any, col: any) {
        return !!findSpecialMarkerAt(cardState, row, col, 'METEOR_HOLE');
    }

    function hasBoardShapeCellForCard(cardState: any, gameState: any, row: any, col: any) {
        const rowNum = Number(row);
        const colNum = Number(col);
        if (!Number.isInteger(rowNum) || !Number.isInteger(colNum)) return false;
        if (hasMeteorHoleAtForCard(cardState, rowNum, colNum)) return false;
        if (isMainBoardCellForCard(rowNum, colNum, gameState)) return true;
        return getExpansionDescriptorsForCard(gameState)
            .some((desc: any) => desc && desc.row === rowNum && desc.col === colNum);
    }

    function getCurrentBoardShapeCellsForCard(cardState: any, gameState: any) {
        const cells = [];
        const boardConfig = resolveCardBoardConfig(gameState);
        for (let row = 0; row < boardConfig.rows; row++) {
            for (let col = 0; col < boardConfig.cols; col++) {
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

    function getOccupiedBoardShapeCellsForCard(cardState: any, gameState: any) {
        return getCurrentBoardShapeCellsForCard(cardState, gameState)
            .filter((cell: any) => getCellValueForCard(gameState, cell.row, cell.col) !== EMPTY);
    }

    function getEmptyBoardShapeCellsForCard(cardState: any, gameState: any) {
        return getCurrentBoardShapeCellsForCard(cardState, gameState)
            .filter((cell: any) => getCellValueForCard(gameState, cell.row, cell.col) === EMPTY);
    }

    function selectRandomEmptyBoardShapeDestination(cardState: any, gameState: any, fromRow: any, fromCol: any, randomSource: any) {
        const candidates = getEmptyBoardShapeCellsForCard(cardState, gameState)
            .filter((cell: any) => {
                if (!cell) return false;
                if (cell.row === fromRow && cell.col === fromCol) return false;
                return !isBlockedCell(cardState, cell.row, cell.col, gameState);
            });
        if (!candidates.length) return null;
        const index = resolveDeterministicRandomIndex(
            candidates.length,
            randomSource,
            null,
            'CardLogic.selectRandomEmptyBoardShapeDestination'
        );
        return candidates[index] || candidates[0] || null;
    }

    function moveCoexistingSpecialMarkers(cardState: any, anchorEntry: any, fromRow: any, fromCol: any, toRow: any, toCol: any) {
        if (!Array.isArray(cardState && cardState.markers)) return;
        for (const marker of cardState.markers) {
            if (!marker || marker === anchorEntry) continue;
            if (marker.row !== fromRow || marker.col !== fromCol) continue;
            if (marker.kind === 'specialStone') {
                const markerTypeUpper = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
                if (
                    markerTypeUpper === 'BLOCKADE' ||
                    markerTypeUpper === 'METEOR_HOLE' ||
                    markerTypeUpper === 'FREEZE' ||
                    markerTypeUpper === 'SEED'
                ) continue;
            }
            marker.row = toRow;
            marker.col = toCol;
        }
    }

    function collectEmptyNeighborCellsForCard(cardState: any, gameState: any, row: any, col: any) {
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

    function getCurrentCornerCellsForCard(cardState: any, gameState: any) {
        const cells = getCurrentBoardShapeCellsForCard(cardState, gameState);
        if (cells.length === 0) return [];
        const cellKeys = new Set(cells.map((cell: any) => toBoardCellKey(cell.row, cell.col)));
        const quadrants = [
            { vertical: -1, horizontal: -1 },
            { vertical: -1, horizontal: 1 },
            { vertical: 1, horizontal: -1 },
            { vertical: 1, horizontal: 1 }
        ];

        return cells.filter((cell: any) => quadrants.some((quadrant: any) => {
            const verticalKey = toBoardCellKey(cell.row + quadrant.vertical, cell.col);
            const horizontalKey = toBoardCellKey(cell.row, cell.col + quadrant.horizontal);
            return !cellKeys.has(verticalKey) && !cellKeys.has(horizontalKey);
        }));
    }

    function countOccupiedCornersForPlayer(cardState: any, gameState: any, playerKey: any) {
        const playerValue = playerKey === 'white' ? WHITE : BLACK;
        return getCurrentCornerCellsForCard(cardState, gameState)
            .reduce((count: any, cell: any) => (
                getCellValueForCard(gameState, cell.row, cell.col) === playerValue ? count + 1 : count
            ), 0);
    }

    function countOpponentOccupiedCornersForPlayer(cardState: any, gameState: any, playerKey: any) {
        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        return countOccupiedCornersForPlayer(cardState, gameState, opponentKey);
    }

    function findSpecialMarkerAt(cardState: any, row: any, col: any, type?: any, owner?: any) {
        return requireCardMarkersMethod('findSpecialMarkerAt')(cardState, row, col, type, owner);
    }

    function findBombMarkerAt(cardState: any, row: any, col: any) {
        return requireCardMarkersMethod('findBombMarkerAt')(cardState, row, col);
    }

    function isPositionSwapProtectedCell(cardState: any, row: any, col: any) {
        return !!(
            findSpecialMarkerAt(cardState, row, col, 'GLUTTONOUS') ||
            findSpecialMarkerAt(cardState, row, col, 'ABSOLUTE_PROTECTED')
        );
    }

    function isFrozenCell(cardState: any, row: any, col: any) {
        return !!isFrozenCellForCard(cardState, row, col);
    }

    function isAbsoluteProtectedCell(cardState: any, row: any, col: any) {
        return !!findSpecialMarkerAt(cardState, row, col, 'ABSOLUTE_PROTECTED');
    }

    function hasSeedMarkerAt(cardState: any, row: any, col: any) {
        return !!findSpecialMarkerAt(cardState, row, col, 'SEED');
    }

    function removeMarkersAt(cardState: any, row: any, col: any, options?: any) {
        return requireCardMarkersMethod('removeMarkersAt')(cardState, row, col, options);
    }

    function swapCellCoordinates(cardState: any, gameState: any, posA: any, posB: any) {
        return requireCardMarkersMethod('swapCellCoordinates')(cardState, gameState, posA, posB);
    }

    function requireCardPresentationHelper(name: any) {
        const fn = CardPresentationHelpers && CardPresentationHelpers[name];
        if (typeof fn !== 'function') {
            throw new Error(`[cards.js] CardPresentationHelpers.${name} not available`);
        }
        return fn;
    }

    function getCardPresentationHelperContext() {
        return {
            constants: { BLACK, EMPTY },
            StoneStatusSnapshot,
            BoardOpsModule,
            getSpecialMarkers,
            findBombMarkerAt,
            getBombMarkerType,
            isOverlayOnlySpecialStoneType,
            getCellValueForCard,
            setCellValueForCard,
            swapCellCoordinates,
            getStoneIdAtForCard,
            emitPresentationEvent
        };
    }

    function compactPresentationMeta(meta: any) {
        return requireCardPresentationHelper('compactPresentationMeta')(meta);
    }

    function getCellVisualPresentationMeta(cardState: any, row: any, col: any) {
        return requireCardPresentationHelper('getCellVisualPresentationMeta')(
            cardState,
            row,
            col,
            getCardPresentationHelperContext()
        );
    }

    function swapOccupiedCellsWithPresentation(cardState: any, gameState: any, posA: any, posB: any, options : any = {}) {
        return requireCardPresentationHelper('swapOccupiedCellsWithPresentation')(
            cardState,
            gameState,
            posA,
            posB,
            options,
            getCardPresentationHelperContext()
        );
    }

    function buildInitialBoardBonusMap(prng: any, boardOrConfig: any) {
        if (CardExpansionModule && typeof CardExpansionModule.buildInitialBoardBonusMap === 'function') {
            return CardExpansionModule.buildInitialBoardBonusMap(prng, boardOrConfig);
        }
        const config = resolveCardBoardConfig(boardOrConfig);
        const openingCells = getOpeningCellsForState(config);
        const orthogonalDirs = [
            { dr: -1, dc: 0 },
            { dr: 1, dc: 0 },
            { dr: 0, dc: -1 },
            { dr: 0, dc: 1 }
        ];
        const blocked = new Set();
        for (const stone of openingCells) {
            blocked.add(`${stone.row},${stone.col}`);
            for (const dir of orthogonalDirs) {
                const nextRow = stone.row + dir.dr;
                const nextCol = stone.col + dir.dc;
                if (!isMainBoardCellForCard(nextRow, nextCol, config)) continue;
                blocked.add(`${nextRow},${nextCol}`);
            }
        }
        const cells = [];
        for (let row = 0; row < config.rows; row++) {
            for (let col = 0; col < config.cols; col++) {
                const key = `${row},${col}`;
                if (blocked.has(key)) continue;
                cells.push({ row, col });
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
        const baseConfig = resolveCardBoardConfig();
        const baseOpeningCells = getOpeningCellsForState(baseConfig);
        const baseBlocked = new Set();
        for (const stone of baseOpeningCells) {
            baseBlocked.add(`${stone.row},${stone.col}`);
            for (const dir of orthogonalDirs) {
                const nextRow = stone.row + dir.dr;
                const nextCol = stone.col + dir.dc;
                if (!isMainBoardCellForCard(nextRow, nextCol, baseConfig)) continue;
                baseBlocked.add(`${nextRow},${nextCol}`);
            }
        }
        const basePlayableCellCount = Math.max(
            1,
            (baseConfig.rows * baseConfig.cols) - baseBlocked.size
        );
        const baseBonusTotal = dist.reduce((sum: any, item: any) => {
            const count = Number(item && item.count);
            return sum + (Number.isInteger(count) && count > 0 ? count : 0);
        }, 0);
        const targetBonusTotal = Math.min(
            cells.length,
            Math.max(0, Math.round((cells.length * baseBonusTotal) / basePlayableCellCount))
        );
        const validDist = dist.reduce((out: any, item: any, index: any) => {
            if (!item) return out;
            const value = Number(item.value);
            const count = Number(item.count);
            if (!Number.isInteger(value) || value < 1 || value > 10) return out;
            if (!Number.isInteger(count) || count <= 0) return out;
            out.push({ value, count, index });
            return out;
        }, []);
        const validDistTotal = validDist.reduce((sum: any, item: any) => sum + item.count, 0);
        const scaledDist = validDist.map((item: any) => {
            const exact = validDistTotal > 0 ? ((item.count * targetBonusTotal) / validDistTotal) : 0;
            return {
                value: item.value,
                count: Math.floor(exact),
                fraction: exact - Math.floor(exact),
                index: item.index
            };
        });
        let remaining = Math.max(0, targetBonusTotal - scaledDist.reduce((sum: any, item: any) => sum + item.count, 0));
        const priority = scaledDist.slice().sort((a: any, b: any) => {
            if (b.fraction !== a.fraction) return b.fraction - a.fraction;
            return a.index - b.index;
        });
        for (let i = 0; i < priority.length && remaining > 0; i++) {
            priority[i].count += 1;
            remaining -= 1;
        }
        const bonusValues = [];
        for (const item of scaledDist) {
            for (let i = 0; i < item.count; i++) bonusValues.push(item.value);
        }
        prng.shuffle(cells);
        const values = bonusValues.slice();
        prng.shuffle(values);

        const assignCount = Math.min(cells.length, values.length);
        const out: Record<string, any> = {};
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
    function createCardState(prng: any, options: any) {
        if (!CardStateFactory || typeof CardStateFactory.createCardState !== 'function') {
            throw new Error('[cards.js] CardStateFactory.createCardState not available');
        }
        return CardStateFactory.createCardState(prng, options, getCardStateFactoryContext());
    }

    /**
     * Deep copy card state
     * @param {Object} cs - Original card state
     * @returns {Object} Copied card state
     */
    function copyCardState(cs: any) {
        if (!CardStateFactory || typeof CardStateFactory.copyCardState !== 'function') {
            throw new Error('[cards.js] CardStateFactory.copyCardState not available');
        }
        return CardStateFactory.copyCardState(cs, getCardStateFactoryContext());
    }

    /**
     * Deal initial hands
     * @param {Object} cardState
     * @param {Object} [prng]
     */
    function dealInitialHands(cardState: any, prng: any) {
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
    function initGame(prng: any, options: any) {
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
    function addMarker(cardState: any, kind: any, row: any, col: any, owner: any, data: any) {
        if (!CardStateManager || typeof CardStateManager.addMarker !== 'function') {
            throw new Error('[cards.js] CardStateManager.addMarker not available');
        }
        const markerData = attachMarkerOriginIfNeeded(cardState, kind, owner, data);
        return CardStateManager.addMarker(cardState, kind, row, col, owner, markerData);
    }

    /**
     * Remove a marker by id and sync to legacy arrays
     * @param {Object} cardState
     * @param {number} markerId
     * @returns {boolean} true if removed
     */
    function removeMarkerById(cardState: any, markerId: any) {
        if (!CardStateManager || typeof CardStateManager.removeMarker !== 'function') {
            throw new Error('[cards.js] CardStateManager.removeMarker not available');
        }
        return CardStateManager.removeMarker(cardState, markerId);
    }

    /**
     * Draw a card
     * @param {Object} cardState 
     * @param {string} playerKey - 'black' or 'white'
     * @param {Object} [prng] 
     * @returns {string|null} Drawn card ID
     */
    function commitDraw(cardState: any, playerKey: any, prng: any) {
        if (!CardStateManager || typeof CardStateManager.drawCard !== 'function') {
            throw new Error('[cards.js] CardStateManager.drawCard not available');
        }
        return CardStateManager.drawCard(cardState, playerKey, prng || defaultPrng);
    }

    function ensureCardCopyState(cardState: any) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.ensureCardCopyState !== 'function') {
            throw new Error('[cards.js] CardHandManager.ensureCardCopyState not available');
        }
        return CardHandManagerModule.ensureCardCopyState(cardState, getCardHandManagerContext());
    }

    function getHandCopyIdAt(cardState: any, playerKey: any, handIndex: any) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.getHandCopyIdAt !== 'function') {
            throw new Error('[cards.js] CardHandManager.getHandCopyIdAt not available');
        }
        return CardHandManagerModule.getHandCopyIdAt(cardState, playerKey, handIndex, getCardHandManagerContext());
    }

    function getHandCopyIds(cardState: any, playerKey: any) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.getHandCopyIds !== 'function') {
            throw new Error('[cards.js] CardHandManager.getHandCopyIds not available');
        }
        return CardHandManagerModule.getHandCopyIds(cardState, playerKey, getCardHandManagerContext());
    }

    function isCardCopyIdRevealedToViewer(cardState: any, viewerKey: any, cardCopyId: any) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.isCardCopyIdRevealedToViewer !== 'function') {
            throw new Error('[cards.js] CardHandManager.isCardCopyIdRevealedToViewer not available');
        }
        return CardHandManagerModule.isCardCopyIdRevealedToViewer(cardState, viewerKey, cardCopyId, getCardHandManagerContext());
    }

    function revealCurrentHandToViewer(cardState: any, viewerKey: any, ownerKey: any) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.revealCurrentHandToViewer !== 'function') {
            throw new Error('[cards.js] CardHandManager.revealCurrentHandToViewer not available');
        }
        return CardHandManagerModule.revealCurrentHandToViewer(cardState, viewerKey, ownerKey, getCardHandManagerContext());
    }

    function addCardToHand(cardState: any, playerKey: any, cardId: any, opts?: any) {
        if (!CardStateManager || typeof CardStateManager.addToHand !== 'function') {
            throw new Error('[cards.js] CardStateManager.addToHand not available');
        }
        return CardStateManager.addToHand(cardState, playerKey, cardId, opts);
    }

    function addCardToDiscard(cardState: any, cardId: any, cardCopyId: any) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.addCardToDiscard !== 'function') {
            throw new Error('[cards.js] CardHandManager.addCardToDiscard not available');
        }
        return CardHandManagerModule.addCardToDiscard(cardState, cardId, cardCopyId, getCardHandManagerContext());
    }

    function removeHandCardAt(cardState: any, playerKey: any, handIndex: any) {
        if (!CardStateManager || typeof CardStateManager.removeFromHand !== 'function') {
            throw new Error('[cards.js] CardStateManager.removeFromHand not available');
        }
        return CardStateManager.removeFromHand(cardState, playerKey, handIndex);
    }

    function clearHandToDiscard(cardState: any, playerKey: any) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.clearHandToDiscard !== 'function') {
            throw new Error('[cards.js] CardHandManager.clearHandToDiscard not available');
        }
        return CardHandManagerModule.clearHandToDiscard(cardState, playerKey, getCardHandManagerContext());
    }

    function moveDiscardCardToHandByCardId(cardState: any, playerKey: any, cardId: any, opts: any) {
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
    function getCardDef(cardId: any) {
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
    function getCardType(cardId: any) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.getCardType !== 'function') {
            throw new Error('[cards.js] CardHandManager.getCardType not available');
        }
        return CardHandManagerModule.getCardType(cardId, getCardHandManagerContext());
    }

    function getCardDisplayName(cardId: any) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.getCardDisplayName !== 'function') {
            throw new Error('[cards.js] CardHandManager.getCardDisplayName not available');
        }
        return CardHandManagerModule.getCardDisplayName(cardId, getCardHandManagerContext());
    }

    function getCardCodeName(displayName: any) {
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
    function getCardCost(cardId: any) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.getCardCost !== 'function') {
            throw new Error('[cards.js] CardHandManager.getCardCost not available');
        }
        return CardHandManagerModule.getCardCost(cardId, getCardHandManagerContext());
    }

    function getCardDefByType(cardType: any) {
        const normalizedType = String(cardType || '');
        if (!normalizedType) return null;
        for (const cardDef of CARD_DEFS || []) {
            if (cardDef && cardDef.type === normalizedType) return cardDef;
        }
        return null;
    }

    function getCardIdByType(cardType: any) {
        const cardDef = getCardDefByType(cardType);
        return cardDef && cardDef.id ? cardDef.id : null;
    }

    function resolveCaptureSourceTypeFromMarkerData(markerData: any) {
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

    function resolveCaptureSourceInfo(markerEntry: any) {
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

    function attachMarkerOriginIfNeeded(cardState: any, kind: any, owner: any, data: any) {
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
    function canUseCard(cardState: any, playerKey: any, cardId: any) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.canUseCard !== 'function') {
            throw new Error('[cards.js] CardHandManager.canUseCard not available');
        }
        return CardHandManagerModule.canUseCard(cardState, playerKey, cardId, getCardHandManagerContext());
    }

    function resolveCoreLogicForCards() {
        return requireOptionalCardLogicModule('./core') || resolveOptionalCardModule(null, 'Core');
    }

    function hasStandardLegalMoveForPlayer(cardState: any, gameState: any, playerKey: any) {
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
                for (const cell of getCurrentBoardShapeCellsForCard(cardState, gameState)) {
                    if (!cell) continue;
                    if (getCellValueForCard(gameState, cell.row, cell.col) !== EMPTY) continue;
                    if (isBlockedCell(cardState, cell.row, cell.col, gameState)) continue;
                    const flips = core.getFlipsWithContext(gameState, cell.row, cell.col, playerVal, context);
                    if (Array.isArray(flips) && flips.length > 0) return true;
                }
            } catch (e) {
                return false;
            }
        }

        return false;
    }

    function countDiscsForCardComparison(gameState: any) {
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

    function getDiscDisadvantageForPlayer(gameState: any, playerKey: any) {
        const counts = countDiscsForCardComparison(gameState);
        if (playerKey === 'white') return counts.black - counts.white;
        return counts.white - counts.black;
    }

    function getEqualityWillBoardCounts(gameState: any) {
        return countDiscsForCardComparison(gameState);
    }

    function hasFewerDiscsThanOpponentForPlayer(gameState: any, playerKey: any) {
        return getDiscDisadvantageForPlayer(gameState, playerKey) > 0;
    }

    function canUseLastResortForPlayer(cardState: any, gameState: any, playerKey: any) {
        if (!gameState || !Array.isArray(gameState.board)) return false;
        if (hasStandardLegalMoveForPlayer(cardState, gameState, playerKey)) return false;
        return hasFewerDiscsThanOpponentForPlayer(gameState, playerKey);
    }

    function canUseEqualityWillForPlayer(cardState: any, gameState: any, playerKey: any) {
        void cardState;
        if (!gameState || !Array.isArray(gameState.board)) return false;
        return getDiscDisadvantageForPlayer(gameState, playerKey) >= 10;
    }

    function getReinforcementWillTargetCount(cardState: any, gameState: any, playerKey: any) {
        return getReinforcementWillTargets(cardState, gameState, playerKey).length;
    }

    function _ensureHandDestroyFlags(cardState: any) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.ensureHandDestroyFlags !== 'function') {
            throw new Error('[cards.js] CardHandManager.ensureHandDestroyFlags not available');
        }
        return CardHandManagerModule.ensureHandDestroyFlags(cardState, getCardHandManagerContext());
    }

    function destroyHandCard(cardState: any, playerKey: any, cardId: any, opts: any) {
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
    function getUsableCardIds(cardState: any, gameState: any, playerKey: any, opts: any) {
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
    function hasUsableCard(cardState: any, gameState: any, playerKey: any) {
        if (!CardHandManagerModule || typeof CardHandManagerModule.hasUsableCard !== 'function') {
            throw new Error('[cards.js] CardHandManager.hasUsableCard not available');
        }
        return CardHandManagerModule.hasUsableCard(cardState, gameState, playerKey, getCardHandManagerContext());
    }

    function createDeterministicRandomSource(seedText: any) {
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

    function buildHeavenBlessingSeedHint(cardState: any, playerKey: any) {
        const normalizedPlayerKey = playerKey === 'white' ? 'white' : 'black';
        return `${normalizedPlayerKey}|${cardState && Number.isFinite(Number(cardState.turnIndex)) ? Number(cardState.turnIndex) : 0}|${(cardState && cardState.hands && Array.isArray(cardState.hands[normalizedPlayerKey])) ? cardState.hands[normalizedPlayerKey].length : 0}|${(cardState && cardState.charge && Number.isFinite(cardState.charge[normalizedPlayerKey])) ? cardState.charge[normalizedPlayerKey] : 0}`;
    }

    function buildHeavenBlessingOffers(cardIdToExclude: any, prng: any, seedHint: any) {
        const pool = (CARD_DEFS || [])
            .filter((c: any) => c && c.enabled !== false && c.id && c.id !== cardIdToExclude)
            .map((c: any) => c.id);
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

    function buildCondemnOffers(cardState: any, playerKey: any) {
        if (!cardState || !cardState.hands) return [];
        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        const hand = Array.isArray(cardState.hands[opponentKey]) ? cardState.hands[opponentKey] : [];
        return hand.map((cardId: any, handIndex: any) => ({ handIndex, cardId }));
    }

    /**
     * Apply card usage (Remove from hand, consume charge, set pending effect)
     * @param {Object} cardState
     * @param {string} playerKey
     * @param {string} cardId
     * @returns {boolean} success
     */
    function applyCardUsage(cardState: any, playerKey: any, cardId: any) {
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

        if (!CardEffectResolverModule || typeof CardEffectResolverModule.applyCardUsage !== 'function') {
            throw new Error('[cards.js] CardEffectResolver.applyCardUsage not available');
        }

        return CardEffectResolverModule.applyCardUsage(cardState, playerKey, cardId, {
            gameState,
            handOwnerKey,
            opts,
            getCardCost,
            getCardType,
            buildHeavenBlessingSeedHint,
            buildHeavenBlessingOffers,
            buildCondemnOffers,
            hasStandardLegalMoveForPlayer,
            canUseLastResortForPlayer,
            canUseEqualityWillForPlayer,
            canUseReinforcementWillForPlayer,
            canUseTimeStopGodForPlayer,
            countOpponentOccupiedCornersForPlayer,
            getDestroyTargets,
            getTemptWillTargets,
            getCaptureWillTargets,
            getStrongWindTargets,
            getBuoyancyTargets,
            getSuperBuoyancyTargets,
            getGravityTargets,
            getSuperGravityTargets,
            getSuperAttractionTargets,
            getTrapTargets,
            getGuardTargets,
            getLivingWillTargets,
            getHyperactiveInheritTargets,
            getExtendLifeTargets,
            getCorrosionTargets,
            getTimeBombTargets,
            getTeleportTargets,
            getCellTeleportTargets,
            getCloneTargets,
            getSwapTargets,
            getPositionSwapTargets: (nextCardState: any, nextGameState: any, nextPlayerKey: any) => getSelectableTargets({
                ...nextCardState,
                pendingEffectByPlayer: {
                    ...(nextCardState.pendingEffectByPlayer || { black: null, white: null }),
                    [nextPlayerKey]: { type: 'POSITION_SWAP_WILL', stage: 'selectTarget' }
                }
            }, nextGameState, nextPlayerKey),
            getBoardExpansionTargets,
            getBoardExpansionGodTargets,
            getBoardShrinkTargets,
            getBoardShrinkGodTargets,
            getBlockadeTargets,
            getMeteorTargets,
            getFreezeTargets,
            getSeedTargets,
            getTimeStopGodDestroyableCount,
            getLossWillRemovableCount,
            getSalvationWillTargetCount,
            getExecutionWillTargetCount,
            getReinforcementWillTargetCount,
            removeHandCardAt,
            addCardToDiscard,
            addChargeValue,
            writeCardPendingEffect,
            readCardPendingEffect,
            getBoardExpansionGodRequiredSelectionCount,
            getBoardShrinkSelectionCount,
            workDebugLog,
            emitPresentationEvent,
            addGeneratedThrowChainCard,
            addGeneratedChainWillCard,
            getCardDef,
            getCardDisplayName,
            CardPendingStateManagerModule,
            CardUsagePrechecksModule,
            TIME_STOP_GOD_SELF_DESTROY_COUNT,
            RIBO_WILL_UNLOCK_TURN_INDEX
        });
    }

    /**
     * Cancel a pending selection card (refund + return card to hand).
     * @param {Object} cardState
     * @param {string} playerKey
     * @param {Object} [opts] - { refundCost?: boolean, resetUsage?: boolean, noConsume?: boolean }
     * @returns {{canceled: boolean, reason?: string, cardId?: string}}
     */
    function cancelPendingSelection(cardState: any, playerKey: any, opts: any) {
        if (!CardEffectResolverModule || typeof CardEffectResolverModule.cancelPendingSelection !== 'function') {
            throw new Error('[cards.js] CardEffectResolver.cancelPendingSelection not available');
        }
        const result = CardEffectResolverModule.cancelPendingSelection(cardState, playerKey, opts, {
            CardPendingStateManagerModule,
            getCardDef,
            addChargeValue,
            moveDiscardCardToHandByCardId,
            readCardPendingEffect,
            clearCardPendingEffect
        });
        if (result && result.canceled) {
            clearCardPendingEffect(cardState, playerKey);
        }
        return result;
    }

    function getSpecialMarkerAt(cardState: any, row: any, col: any) {
        return requireCardMarkersMethod('getSpecialMarkerAt')(cardState, row, col);
    }

    function isSpecialStoneAt(cardState: any, row: any, col: any) {
        return requireCardMarkersMethod('isSpecialStoneAt')(cardState, row, col);
    }

    function getSpecialOwnerAt(cardState: any, row: any, col: any) {
        return requireCardMarkersMethod('getSpecialOwnerAt')(cardState, row, col);
    }

    function callCardModuleMethod(moduleRef: any, methodName: any, args: any) {
        if (!moduleRef || typeof moduleRef[methodName] !== 'function') {
            return { called: false, value: undefined };
        }
        try {
            return { called: true, value: moduleRef[methodName](...(Array.isArray(args) ? args : [])) };
        } catch (e) {
            return { called: false, value: undefined };
        }
    }

    function callCardTargetsMethod(methodName: any, args: any) {
        return callCardModuleMethod(CardTargetsModule, methodName, args);
    }

    function callCardSelectorsMethod(methodName: any, args: any) {
        return callCardModuleMethod(CardSelectorsModule, methodName, args);
    }

    function getTemptWillTargets(cardState: any, gameState: any, playerKey: any) {
        const delegated = callCardTargetsMethod('getTemptWillTargets', [cardState, gameState, playerKey]);
        if (delegated.called) return delegated.value;
        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        const res = [];
        const hasGuardMarkerAt = (row: any, col: any) => getSpecialMarkers(cardState).some((m: any) => (
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

    function getCaptureWillTargets(cardState: any, gameState: any, playerKey: any) {
        const targets = getTemptWillTargets(cardState, gameState, playerKey);
        return targets.filter((target: any) => !!resolveCaptureSourceInfo(getSpecialMarkerAt(cardState, target.row, target.col)));
    }

    function getTemptTargets(cardState: any, gameState: any, playerKey: any) {
        if (TargetResolver && typeof TargetResolver.getTemptTargets === 'function') {
            return TargetResolver.getTemptTargets(cardState, gameState, playerKey);
        }
        return [];
    }

    function getCaptureTargets(cardState: any, gameState: any, playerKey: any) {
        if (TargetResolver && typeof TargetResolver.getCaptureTargets === 'function') {
            return TargetResolver.getCaptureTargets(cardState, gameState, playerKey);
        }
        return [];
    }

    function getDestroyTargets(cardState: any, gameState: any) {
        if (TargetResolver && typeof TargetResolver.getDestroyTargets === 'function') {
            return TargetResolver.getDestroyTargets(cardState, gameState);
        }
        return [];
    }

    function getSwapTargets(cardState: any, gameState: any, playerKey: any) {
        if (TargetResolver && typeof TargetResolver.getSwapTargets === 'function') {
            return TargetResolver.getSwapTargets(cardState, gameState, playerKey);
        }
        return [];
    }

    function getPositionSwapTargets(cardState: any, gameState: any, playerKey: any, pending: any) {
        if (TargetResolver && typeof TargetResolver.getPositionSwapTargets === 'function') {
            return TargetResolver.getPositionSwapTargets(cardState, gameState, playerKey, pending);
        }
        return [];
    }

    function getBreedingTargets(cardState: any, gameState: any, playerKey: any) {
        if (TargetResolver && typeof TargetResolver.getBreedingTargets === 'function') {
            return TargetResolver.getBreedingTargets(cardState, gameState, playerKey);
        }
        return [];
    }

    function getSniperTargets(cardState: any, gameState: any, playerKey: any) {
        if (TargetResolver && typeof TargetResolver.getSniperTargets === 'function') {
            return TargetResolver.getSniperTargets(cardState, gameState, playerKey);
        }
        return [];
    }

    function getLightningTargets(cardState: any, gameState: any, playerKey: any) {
        if (TargetResolver && typeof TargetResolver.getLightningTargets === 'function') {
            return TargetResolver.getLightningTargets(cardState, gameState, playerKey);
        }
        return [];
    }

    function getCrossBombTargets(cardState: any, gameState: any, playerKey: any) {
        if (TargetResolver && typeof TargetResolver.getCrossBombTargets === 'function') {
            return TargetResolver.getCrossBombTargets(cardState, gameState, playerKey);
        }
        return [];
    }

    function getXBombTargets(cardState: any, gameState: any, playerKey: any) {
        if (TargetResolver && typeof TargetResolver.getXBombTargets === 'function') {
            return TargetResolver.getXBombTargets(cardState, gameState, playerKey);
        }
        return [];
    }

    function getReinforcementTargets(cardState: any, gameState: any, playerKey: any) {
        if (TargetResolver && typeof TargetResolver.getReinforcementTargets === 'function') {
            return TargetResolver.getReinforcementTargets(cardState, gameState, playerKey);
        }
        return [];
    }

    function getEqualityTargets(cardState: any, gameState: any, playerKey: any) {
        if (TargetResolver && typeof TargetResolver.getEqualityTargets === 'function') {
            return TargetResolver.getEqualityTargets(cardState, gameState, playerKey);
        }
        return [];
    }

    function getCornerTributeTargets(cardState: any, gameState: any, playerKey: any) {
        if (TargetResolver && typeof TargetResolver.getCornerTributeTargets === 'function') {
            return TargetResolver.getCornerTributeTargets(cardState, gameState, playerKey);
        }
        return [];
    }

    function getLastResortTargets(cardState: any, gameState: any, playerKey: any) {
        if (TargetResolver && typeof TargetResolver.getLastResortTargets === 'function') {
            return TargetResolver.getLastResortTargets(cardState, gameState, playerKey);
        }
        return [];
    }

    function getTrapTargets(cardState: any, gameState: any, playerKey: any) {
        if (TargetResolver && typeof TargetResolver.getTrapTargets === 'function') {
            return TargetResolver.getTrapTargets(cardState, gameState, playerKey);
        }
        return [];
    }

    function getGuardTargets(cardState: any, gameState: any, playerKey: any) {
        if (TargetResolver && typeof TargetResolver.getGuardTargets === 'function') {
            return TargetResolver.getGuardTargets(cardState, gameState, playerKey);
        }
        return [];
    }

    function getLivingWillTargets(cardState: any, gameState: any, playerKey: any) {
        const delegated = callCardSelectorsMethod('getLivingWillTargets', [cardState, gameState, playerKey]);
        if (delegated.called) return delegated.value;
        const playerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const res = [];
        for (const cell of getOccupiedBoardShapeCellsForCard(cardState, gameState)) {
            const row = cell.row;
            const col = cell.col;
            if (getCellValueForCard(gameState, row, col) !== playerVal) continue;
            const hasBomb = markers.some((m: any) => m && m.row === row && m.col === col && isBombCategoryMarker(m));
            if (hasBomb) continue;
            if (isAbsoluteProtectedCell(cardState, row, col)) continue;
            const hasLivingWill = markers.some((m: any) => (
                m &&
                m.row === row &&
                m.col === col &&
                m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') &&
                m.data &&
                m.data.type === 'LIVING_WILL'
            ));
            if (hasLivingWill) continue;
            res.push({ row, col });
        }
        return res;
    }

    function getHyperactiveInheritTargets(cardState: any, gameState: any, playerKey: any) {
        const delegated = callCardSelectorsMethod('getHyperactiveInheritTargets', [cardState, gameState, playerKey]);
        if (delegated.called) return delegated.value;
        return getGuardTargets(cardState, gameState, playerKey);
    }

    // Return targets: only your own special stones that have a numeric remainingOwnerTurns > 0
    function getExtendLifeTargets(cardState: any, gameState: any, playerKey: any) {
        const delegated = callCardSelectorsMethod('getExtendLifeTargets', [cardState, gameState, playerKey]);
        if (delegated.called) return delegated.value;
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const res: any[] = [];
        for (const m of markers) {
            if (!m || m.kind !== (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone')) continue;
            if (m.owner !== playerKey) continue;
            const rem: any = (m.data && Number.isFinite(m.data.remainingOwnerTurns)) ? Number(m.data.remainingOwnerTurns) : null;
            if (!Number.isFinite(rem) || rem <= 0) continue;
            res.push({ row: m.row, col: m.col });
        }
        return res;
    }

    // Return targets: all timed special stones that have a numeric remainingOwnerTurns > 0
    function getCorrosionTargets(cardState: any, gameState: any, playerKey: any) {
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const res: any[] = [];
        for (const m of markers) {
            if (!m || m.kind !== (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone')) continue;
            const rem: any = (m.data && Number.isFinite(m.data.remainingOwnerTurns)) ? Number(m.data.remainingOwnerTurns) : null;
            if (!Number.isFinite(rem) || rem <= 0) continue;
            res.push({ row: m.row, col: m.col });
        }
        return res;
    }

    function getTimeBombTargets(cardState: any, gameState: any, playerKey: any) {
        if (TargetResolver && typeof TargetResolver.getTimeBombTargets === 'function') {
            return TargetResolver.getTimeBombTargets(cardState, gameState, playerKey);
        }
        return [];
    }

    function getTeleportTargets(cardState: any, gameState: any) {
        if (TargetResolver && typeof TargetResolver.getTeleportTargets === 'function') {
            return TargetResolver.getTeleportTargets(cardState, gameState);
        }
        return [];
    }

    function getCloneTargets(cardState: any, gameState: any, playerKey: any) {
        if (TargetResolver && typeof TargetResolver.getCloneTargets === 'function') {
            return TargetResolver.getCloneTargets(cardState, gameState, playerKey);
        }
        return [];
    }

    function getBoardExpansionTargets(cardState: any, gameState: any, playerKey: any) {
        if (TargetResolver && typeof TargetResolver.getBoardExpansionTargets === 'function') {
            return TargetResolver.getBoardExpansionTargets(cardState, gameState, playerKey);
        }
        return [];
    }

    function getBoardExpansionGodCornerDescriptorsForCard(gameState: any) {
        if (CardExpansionModule && typeof CardExpansionModule.getBoardExpansionGodCornerDescriptorsForCard === 'function') {
            return CardExpansionModule.getBoardExpansionGodCornerDescriptorsForCard(gameState);
        }
        return [];
    }

    function getBoardExpansionGodPendingSelectionsForCard(pending: any) {
        if (CardExpansionModule && typeof CardExpansionModule.getBoardExpansionGodPendingSelectionsForCard === 'function') {
            return CardExpansionModule.getBoardExpansionGodPendingSelectionsForCard(pending);
        }
        return [];
    }

    function getBoardExpansionGodAdditionsForCard(row: any, col: any, gameState: any) {
        if (CardExpansionModule && typeof CardExpansionModule.getBoardExpansionGodAdditionsForCard === 'function') {
            return CardExpansionModule.getBoardExpansionGodAdditionsForCard(row, col, gameState);
        }
        return null;
    }

    function getBoardExpansionWillCellDescriptorsForCard(gameState: any) {
        if (CardExpansionModule && typeof CardExpansionModule.getBoardExpansionWillCellDescriptorsForCard === 'function') {
            return CardExpansionModule.getBoardExpansionWillCellDescriptorsForCard(gameState);
        }
        return [];
    }

    function ensureExpansionCellForCard(gameState: any, row: any, col: any, owner: any) {
        if (CardExpansionModule && typeof CardExpansionModule.ensureExpansionCellForCard === 'function') {
            return CardExpansionModule.ensureExpansionCellForCard(gameState, row, col, owner);
        }
        return false;
    }

    function getBoardExpansionGodTargets(cardState: any, gameState: any, playerKey: any) {
        const delegated = callCardSelectorsMethod('getBoardExpansionGodTargets', [cardState, gameState, playerKey]);
        if (delegated.called) return delegated.value;

        if (!gameState || !gameState.board) return [];

        const occupied = new Set(
            getExpansionDescriptorsForCard(gameState).map((cell: any) => `${cell.row},${cell.col}`)
        );
        const pending = readCardPendingEffect(cardState, playerKey);
        const selectedKeys = new Set(
            getBoardExpansionGodPendingSelectionsForCard(pending).map((target: any) => `${target.row},${target.col}`)
        );

        const res = [];
        for (const corner of getBoardExpansionGodCornerDescriptorsForCard(gameState)) {
            if (!corner || !Array.isArray(corner.cells)) continue;
            if (selectedKeys.has(`${corner.row},${corner.col}`)) continue;
            const hasOccupied = corner.cells.some((cell: any) => occupied.has(`${cell.row},${cell.col}`));
            if (hasOccupied) continue;
            res.push({ row: corner.row, col: corner.col });
        }
        return res;
    }

    function getBoardExpansionGodRequiredSelectionCount(cardState: any, gameState: any, playerKey: any) {
        const pending = readCardPendingEffect(cardState, playerKey);
        const selectedCount = getBoardExpansionGodPendingSelectionsForCard(pending).length;
        const availableCount = getBoardExpansionGodTargets(cardState, gameState, playerKey).length;
        const totalSelectableCount = selectedCount + availableCount;
        if (totalSelectableCount <= 0) return 0;
        return Math.min(2, totalSelectableCount);
    }

    function getBoardShrinkSelectionCount() {
        if (CardShrinkModule && Number.isFinite(Number(CardShrinkModule.BOARD_SHRINK_SELECTION_COUNT))) {
            return Math.max(1, Math.trunc(Number(CardShrinkModule.BOARD_SHRINK_SELECTION_COUNT)));
        }
        return 3;
    }

    function getBoardShrinkPendingSelectionsForCard(pending: any) {
        if (CardShrinkModule && typeof CardShrinkModule.getBoardShrinkPendingSelectionsForCard === 'function') {
            return CardShrinkModule.getBoardShrinkPendingSelectionsForCard(pending);
        }
        return [];
    }

    function getBoardShrinkTargets(cardState: any, gameState: any, playerKey: any) {
        if (TargetResolver && typeof TargetResolver.getBoardShrinkTargets === 'function') {
            return TargetResolver.getBoardShrinkTargets(cardState, gameState, playerKey);
        }
        return [];
    }

    function getBoardShrinkGodTargets(cardState: any, gameState: any, playerKey: any) {
        const delegated = callCardSelectorsMethod('getBoardShrinkGodTargets', [cardState, gameState, playerKey]);
        if (delegated.called) return delegated.value;
        return [];
    }

    function getCellTeleportDestinations(cardState: any, gameState: any) {
        const delegated = callCardSelectorsMethod('getCellTeleportDestinations', [cardState, gameState]);
        if (delegated.called) return delegated.value;

        if (!gameState || !gameState.board) return [];

        const activeByKey = new Map();
        for (const cell of getExpansionDescriptorsForCard(gameState)) {
            if (!cell) continue;
            activeByKey.set(`${cell.row},${cell.col}`, cell);
        }

        const res: any[] = [];
        const seen = new Set();
        const pushCandidate = (row: any, col: any, side: any) => {
            const key = `${row},${col}`;
            if (seen.has(key)) return;
            seen.add(key);
            const activeCell = activeByKey.get(key) || null;
            const owner = activeCell ? normalizeExpansionOwnerForCard(activeCell.owner) : EMPTY;
            if (owner !== EMPTY) return;
            if (isBlockedCell(cardState, row, col, gameState)) return;
            res.push({ row, col, side: resolveExpansionSideForCard(side, row, col, gameState), active: !!activeCell });
        };

        for (const cell of getBoardExpansionWillCellDescriptorsForCard(gameState)) {
            if (!cell) continue;
            pushCandidate(cell.row, cell.col, cell.side);
        }
        for (const corner of getBoardExpansionGodCornerDescriptorsForCard(gameState)) {
            if (!corner || !Array.isArray(corner.cells)) continue;
            for (const cell of corner.cells) {
                if (!cell) continue;
                pushCandidate(cell.row, cell.col, resolveExpansionSideForCard(null, cell.row, cell.col, gameState));
            }
        }

        return res;
    }

    function getCellTeleportTargets(cardState: any, gameState: any) {
        if (TargetResolver && typeof TargetResolver.getCellTeleportTargets === 'function') {
            return TargetResolver.getCellTeleportTargets(cardState, gameState);
        }
        return [];
    }

    function getBlockadeTargets(cardState: any, gameState: any, playerKey: any) {
        if (TargetResolver && typeof TargetResolver.getBlockadeTargets === 'function') {
            return TargetResolver.getBlockadeTargets(cardState, gameState, playerKey);
        }
        return [];
    }

    function getMeteorTargets(cardState: any, gameState: any, playerKey: any) {
        if (TargetResolver && typeof TargetResolver.getMeteorTargets === 'function') {
            return TargetResolver.getMeteorTargets(cardState, gameState, playerKey);
        }
        return [];
    }

    function getFreezeTargets(cardState: any, gameState: any, playerKey: any) {
        if (TargetResolver && typeof TargetResolver.getFreezeTargets === 'function') {
            return TargetResolver.getFreezeTargets(cardState, gameState, playerKey);
        }
        return [];
    }

    function getSeedTargets(cardState: any, gameState: any, playerKey: any) {
        if (TargetResolver && typeof TargetResolver.getSeedTargets === 'function') {
            return TargetResolver.getSeedTargets(cardState, gameState, playerKey);
        }
        return [];
    }

    function applyTrapWill(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        return CardTrapModule.applyTrapWill(cardState, gameState, playerKey, row, col, {
            readCardPendingEffect,
            getTrapTargets,
            isAbsoluteProtectedCell,
            removeMarkersAt,
            addMarker,
            clearCardPendingEffect,
            MARKER_KINDS
        });
    }

    function processTrapEffects(cardState: any, gameState: any, activePlayerKey: any, options: any) {
        return CardTrapModule.processTrapEffects(cardState, gameState, activePlayerKey, options, {
            getSpecialMarkers,
            getCellValueForCard,
            setCellValueForCard,
            removeMarkersAt,
            setChargeValue,
            addChargeWithTotal,
            clearHandToDiscard,
            destroyAt: BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function'
                ? (cs: any, gs: any, r: any, c: any, cause: any, reason: any, meta: any) => BoardOpsModule.destroyAt(cs, gs, r, c, cause, reason, meta)
                : null,
            emitPresentationEvent,
            MARKER_KINDS,
            EMPTY,
            TRAP_WILL_STEAL_MAX,
            BLACK,
            WHITE
        });
    }

    function applyTemptWill(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        return CardOwnershipEffectsModule.applyTemptWill(cardState, gameState, playerKey, row, col, {
            readCardPendingEffect,
            isSpecialStoneAt,
            getSpecialOwnerAt,
            getCellValueForCard,
            getSpecialMarkers,
            isAbsoluteProtectedCell,
            BoardOpsModule,
            setCellValueForCard,
            removeMarkersAt,
            emitPresentationEvent,
            clearCardPendingEffect,
            getMarkers,
            MARKER_KINDS
        });
    }

    function transferCellMarkerOwnership(cardState: any, row: any, col: any, playerKey: any) {
        return CardOwnershipEffectsModule.transferCellMarkerOwnership(cardState, row, col, playerKey, { getMarkers });
    }

    function applyCaptureWill(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        return CardOwnershipEffectsModule.applyCaptureWill(cardState, gameState, playerKey, row, col, {
            readCardPendingEffect,
            isSpecialStoneAt,
            getSpecialOwnerAt,
            getCellValueForCard,
            getSpecialMarkers,
            isAbsoluteProtectedCell,
            getSpecialMarkerAt,
            resolveCaptureSourceInfo,
            CardLivingWillModule,
            addCardToHand,
            getStoneIdAtForCard,
            clearStoneIdAtForCard,
            setCellValueForCard,
            removeMarkersAt,
            emitPresentationEvent,
            clearCardPendingEffect,
            getLivingWillModuleContext
        });
    }

    function applyGuardWill(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        return CardProtectModule.applyGuardWill(cardState, gameState, playerKey, row, col, {
            readCardPendingEffect,
            getGuardTargets,
            removeMarkersAt,
            addMarker,
            clearCardPendingEffect,
            MARKER_KINDS,
            GUARD_WILL_TURNS,
            GUARDIAN_GOD_TURNS
        });
    }

    function applyLivingWill(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        return CardLivingWillModule.applyLivingWill(
            cardState,
            gameState,
            playerKey,
            row,
            col,
            getLivingWillModuleContext()
        );
    }

    function applyHyperactiveInheritWill(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        return CardHyperactiveModule.applyHyperactiveInheritWill(cardState, gameState, playerKey, row, col, {
            readCardPendingEffect,
            clearCardPendingEffect,
            getHyperactiveInheritTargets,
            removeMarkersAt,
            addMarker,
            emitPresentationEvent,
            inheritedHyperactiveTurns: INHERITED_HYPERACTIVE_TURNS,
            MARKER_KINDS
        });
    }

    // Apply EXTEND_LIFE_WILL: double remainingOwnerTurns on chosen cell's own special markers (numeric remainingOwnerTurns only)
    function applyExtendLifeWill(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        return requireCardMarkersMethod('applyExtendLifeWill')(cardState, gameState, playerKey, row, col, {
            getExtendLifeTargets
        });
    }

    function applyExtendLifeGod(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        return requireCardMarkersMethod('applyExtendLifeGod')(cardState, gameState, playerKey, row, col, {
            getExtendLifeTargets
        });
    }

    function applyCorrosionWill(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        return requireCardMarkersMethod('applyCorrosionWill')(cardState, gameState, playerKey, row, col, {
            getCorrosionTargets
        });
    }

    function applyTimeBombWill(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        return CardTimeBombModule.applyTimeBombWill(cardState, gameState, playerKey, row, col, {
            getTimeBombTargets,
            removeMarkersAt,
            addMarker,
            emitPresentationEvent,
            specialStoneKind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone'
        });
    }

    function cloneMarkerData(data: any) {
        if (!data || typeof data !== 'object') return {};
        try {
            return JSON.parse(JSON.stringify(data));
        } catch (e) {
            return { ...data };
        }
    }

    function applyCloneWill(cardState: any, gameState: any, playerKey: any, row: any, col: any, prng: any) {
        return CardCloneModule.applyCloneWill(cardState, gameState, playerKey, row, col, prng, {
            getCloneTargets,
            getCellValueForCard,
            getSpecialMarkers,
            getBombMarkers,
            collectEmptyNeighborCellsForCard,
            spawnAt: BoardOpsModule && typeof BoardOpsModule.spawnAt === 'function'
                ? BoardOpsModule.spawnAt
                : null,
            runSpawnBlock: BoardOpsModule && typeof BoardOpsModule.runSpawnBlock === 'function'
                ? BoardOpsModule.runSpawnBlock
                : null,
            setCellValueForCard,
            addMarker
        });
    }

    function applyBoardExpansionWill(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        return CardBoardExpansionApplyModule.applyBoardExpansionWill(cardState, gameState, playerKey, row, col, {
            readCardPendingEffect,
            getBoardExpansionTargets,
            ensureMutableBoardExpansionForCard,
            getExpansionDescriptorsForCard,
            resolveExpansionSideForCard,
            normalizeExpansionOwnerForCard,
            syncLegacyExpansionFieldsForCard,
            clearCardPendingEffect
        });
    }

    function applyBoardExpansionGod(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        return CardBoardExpansionApplyModule.applyBoardExpansionGod(cardState, gameState, playerKey, row, col, {
            readCardPendingEffect,
            getBoardExpansionGodTargets,
            getBoardExpansionGodRequiredSelectionCount,
            getBoardExpansionGodPendingSelectionsForCard,
            ensureMutableBoardExpansionForCard,
            getExpansionDescriptorsForCard,
            getBoardExpansionGodAdditionsForCard,
            resolveExpansionSideForCard,
            normalizeExpansionOwnerForCard,
            syncLegacyExpansionFieldsForCard,
            clearCardPendingEffect
        });
    }

    function applyBoardShrinkWill(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        return CardShrinkModule.applyBoardShrinkWill(cardState, gameState, playerKey, row, col, {
            getBoardShrinkTargets,
            getCellValueForCard,
            destroyAt: BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function'
                ? BoardOpsModule.destroyAt
                : null,
            applyHoleAt: BoardOpsModule && typeof BoardOpsModule.applyHoleAt === 'function'
                ? BoardOpsModule.applyHoleAt
                : null,
            runCellRemovalBlock: BoardOpsModule && typeof BoardOpsModule.runCellRemovalBlock === 'function'
                ? BoardOpsModule.runCellRemovalBlock
                : null,
            isDestroyResolved,
            clearStoneIdAtForCard,
            setCellValueForCard,
            removeMarkersAt,
            addMarker,
            random: (cardState && cardState._defaultRandomSource) || defaultPrng,
            isAbsoluteProtectedCell,
            isFrozenCell
        });
    }

    function applyBoardShrinkGod(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        return CardShrinkModule.applyBoardShrinkGod(cardState, gameState, playerKey, row, col, {
            getBoardShrinkGodTargets,
            getCellValueForCard,
            destroyAt: BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function'
                ? BoardOpsModule.destroyAt
                : null,
            applyHoleAt: BoardOpsModule && typeof BoardOpsModule.applyHoleAt === 'function'
                ? BoardOpsModule.applyHoleAt
                : null,
            runCellRemovalBlock: BoardOpsModule && typeof BoardOpsModule.runCellRemovalBlock === 'function'
                ? BoardOpsModule.runCellRemovalBlock
                : null,
            isDestroyResolved,
            clearStoneIdAtForCard,
            setCellValueForCard,
            removeMarkersAt,
            addMarker,
            random: (cardState && cardState._defaultRandomSource) || defaultPrng,
            isAbsoluteProtectedCell,
            isFrozenCell
        });
    }

    function applyBlockadeWill(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        return CardStatusCellsModule.applyBlockadeWill(cardState, gameState, playerKey, row, col, {
            readCardPendingEffect,
            getBlockadeTargets,
            removeMarkersAt,
            addMarker,
            emitPresentationEvent,
            clearCardPendingEffect,
            MARKER_KINDS,
            BLOCKADE_TURNS
        });
    }

    function applyMeteorWill(cardState: any, gameState: any, playerKey: any, row: any, col: any, prng: any) {
        return CardMeteorModule.applyMeteorWill(cardState, gameState, playerKey, row, col, {
            getMeteorTargets,
            getCellValueForCard,
            destroyAt: BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function'
                ? BoardOpsModule.destroyAt
                : null,
            applyHoleAt: BoardOpsModule && typeof BoardOpsModule.applyHoleAt === 'function'
                ? BoardOpsModule.applyHoleAt
                : null,
            runCellRemovalBlock: BoardOpsModule && typeof BoardOpsModule.runCellRemovalBlock === 'function'
                ? BoardOpsModule.runCellRemovalBlock
                : null,
            isDestroyResolved,
            clearStoneIdAtForCard,
            setCellValueForCard,
            removeMarkersAt,
            addMarker,
            random: prng || defaultPrng
        });
    }

    function applyFreezeWill(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        return CardStatusCellsModule.applyFreezeWill(cardState, gameState, playerKey, row, col, {
            readCardPendingEffect,
            getFreezeTargets,
            removeMarkersAt,
            addMarker,
            emitPresentationEvent,
            clearCardPendingEffect,
            MARKER_KINDS,
            FREEZE_TURNS
        });
    }

    function applySeedWill(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        return CardStatusCellsModule.applySeedWill(cardState, gameState, playerKey, row, col, {
            readCardPendingEffect,
            getSeedTargets,
            removeMarkersAt,
            addMarker,
            emitPresentationEvent,
            clearCardPendingEffect,
            MARKER_KINDS,
            SEED_WILL_TURNS
        });
    }

    function getLossWillRemovableCount(cardState: any) {
        ensureMarkers(cardState);
        const specials = getSpecialMarkers(cardState);
        const guardedCells = new Set(
            specials
                .filter((marker: any) => (
                    marker &&
                    marker.data &&
                    marker.data.type === 'GUARD' &&
                    Number.isInteger(marker.row) &&
                    Number.isInteger(marker.col)
                ))
                .map((marker: any) => `${marker.row},${marker.col}`)
        );
        const removableSpecials = specials.filter((marker: any) => {
            if (!marker) return false;
            if (marker.data && marker.data.type === 'METEOR_HOLE') return false;
            if (marker.data && marker.data.type === 'ABSOLUTE_PROTECTED') return false;
            if (!Number.isInteger(marker.row) || !Number.isInteger(marker.col)) return true;
            return !guardedCells.has(`${marker.row},${marker.col}`);
        });
        const bombs = getBombMarkers(cardState);
        const removableBombs = bombs.filter((marker: any) => {
            if (!marker) return false;
            if (!Number.isInteger(marker.row) || !Number.isInteger(marker.col)) return true;
            if (isAbsoluteProtectedCell(cardState, marker.row, marker.col)) return false;
            return !guardedCells.has(`${marker.row},${marker.col}`);
        });
        return removableSpecials.length + removableBombs.length;
    }

    function applyLossWill(cardState: any, gameState: any, playerKey: any) {
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'LOSS_WILL') {
            return { applied: false, reason: 'not_pending', removedCount: 0, removed: [] };
        }

        ensureMarkers(cardState);
        const specials = getSpecialMarkers(cardState);
        const guardedCells = new Set(
            specials
                .filter((marker: any) => (
                    marker &&
                    marker.data &&
                    marker.data.type === 'GUARD' &&
                    Number.isInteger(marker.row) &&
                    Number.isInteger(marker.col)
                ))
                .map((marker: any) => `${marker.row},${marker.col}`)
        );

        const removableSpecials = specials.filter((marker: any) => {
            if (!marker) return false;
            if (marker.data && marker.data.type === 'METEOR_HOLE') return false;
            if (marker.data && marker.data.type === 'ABSOLUTE_PROTECTED') return false;
            if (!Number.isInteger(marker.row) || !Number.isInteger(marker.col)) return true;
            return !guardedCells.has(`${marker.row},${marker.col}`);
        });

        const bombs = getBombMarkers(cardState);
        const removableBombs = bombs.filter((marker: any) => {
            if (!marker) return false;
            if (!Number.isInteger(marker.row) || !Number.isInteger(marker.col)) return true;
            if (isAbsoluteProtectedCell(cardState, marker.row, marker.col)) return false;
            return !guardedCells.has(`${marker.row},${marker.col}`);
        });

        const removed = removableSpecials.map((marker: any) => ({
            row: marker.row,
            col: marker.col,
            owner: marker.owner || null,
            type: (marker.data && marker.data.type) || null
        })).concat(removableBombs.map((marker: any) => ({
            row: marker.row,
            col: marker.col,
            owner: marker.owner || null,
            type: (marker.data && marker.data.type) || 'TIME_BOMB'
        })));
        const livingWillRestores = new Map();
        for (const entry of removed) {
            if (!Number.isInteger(entry.row) || !Number.isInteger(entry.col)) continue;
            const key = `${entry.row},${entry.col}`;
            if (livingWillRestores.has(key)) continue;
            if (getCellValueForCard(gameState, entry.row, entry.col) === EMPTY) continue;
            const livingWillMarker = CardLivingWillModule.findLivingWillMarkerAt(cardState, entry.row, entry.col);
            if (livingWillMarker) livingWillRestores.set(key, livingWillMarker);
        }

        const specialKind = MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone';
        cardState.markers = cardState.markers.filter((marker: any) => {
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

        for (const livingWillMarker of livingWillRestores.values()) {
            CardLivingWillModule.restoreFromLivingWillSnapshot(
                cardState,
                gameState,
                livingWillMarker,
                {
                    triggerKind: 'loss_will',
                    sourceRow: livingWillMarker.row,
                    sourceCol: livingWillMarker.col,
                    cause: 'LOSS_WILL',
                    reason: 'loss_will_reset'
                },
                getLivingWillModuleContext()
            );
        }

        clearCardPendingEffect(cardState, playerKey);
        return { applied: true, removedCount: removed.length, removed };
    }

    function getSalvationWillTargetCount(cardState: any, playerKey: any) {
        const ledger = ensureSalvationDestroyedLedger(cardState);
        if (!ledger) return 0;
        const list = ledger[playerKey];
        return Array.isArray(list) ? list.length : 0;
    }

    function getExecutionWillTargetCount(cardState: any, playerKey: any) {
        const ledger = ensureSalvationDestroyedLedger(cardState);
        if (!ledger) return 0;
        const list = ledger[playerKey];
        if (!Array.isArray(list)) return 0;
        return list.filter((entry: any) => entry && entry.owner === playerKey).length;
    }

    function applySalvationWill(cardState: any, gameState: any, playerKey: any, prng: any) {
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'SALVATION_WILL') {
            return { applied: false, reason: 'not_pending', spawned: [], requestedCount: 0, spawnedCount: 0 };
        }
        const ledger = ensureSalvationDestroyedLedger(cardState);
        const tracked = ledger && Array.isArray(ledger[playerKey])
            ? ledger[playerKey].slice()
            : [];
        if (tracked.length === 0) {
            if (ledger) {
                ledger[playerKey] = [];
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
            'salvation_spawn',
            {
                normalFlip: true,
                flipReason: 'salvation_flip',
                spawnMetaFactory: (spawnIndex: any) => ({
                    owner: playerKey,
                    requestedCount,
                    spawnIndex
                })
            }
        );
        if (ledger) {
            ledger[playerKey] = [];
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
    function getFateWillControllerForTurnOwner(cardState: any, turnOwnerKey: any) {
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
    function applyFateWill(cardState: any, playerKey: any) {
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

    function getStrongWindTargets(cardState: any, gameState: any) {
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

    function _collectVerticalCrushMovePlan(cardState: any, gameState: any, row: any, col: any, dr: any) {
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

    function getSuperBuoyancyTargets(cardState: any, gameState: any) {
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

    function getBuoyancyTargets(cardState: any, gameState: any) {
        if (CardSelectorsModule && typeof CardSelectorsModule.getBuoyancyTargets === 'function') {
            return CardSelectorsModule.getBuoyancyTargets(cardState, gameState);
        }

        const res = [];
        for (const cell of getOccupiedBoardShapeCellsForCard(cardState, gameState)) {
            const option = _collectVerticalSlideMoveOption(cardState, gameState, cell.row, cell.col, -1);
            if (option) res.push({ row: cell.row, col: cell.col });
        }
        return res;
    }

    function getSuperGravityTargets(cardState: any, gameState: any) {
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

    function getSuperAttractionTargets(cardState: any, gameState: any, playerKey?: any, pending?: any) {
        if (CardSelectorsModule && typeof CardSelectorsModule.getSuperAttractionTargets === 'function') {
            return CardSelectorsModule.getSuperAttractionTargets(cardState, gameState, playerKey, pending);
        }
        return [];
    }

    function getGravityTargets(cardState: any, gameState: any) {
        if (CardSelectorsModule && typeof CardSelectorsModule.getGravityTargets === 'function') {
            return CardSelectorsModule.getGravityTargets(cardState, gameState);
        }

        const res = [];
        for (const cell of getOccupiedBoardShapeCellsForCard(cardState, gameState)) {
            const option = _collectVerticalSlideMoveOption(cardState, gameState, cell.row, cell.col, 1);
            if (option) res.push({ row: cell.row, col: cell.col });
        }
        return res;
    }

    function _getStrongWindMoveOptions(cardState: any, gameState: any, row: any, col: any) {
        const dirs = [
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

    function _collectVerticalSlideMoveOption(cardState: any, gameState: any, row: any, col: any, dr: any) {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
        if (dr !== -1 && dr !== 1) return null;
        const firstRow = row + dr;
        if (!hasBoardShapeCellForCard(cardState, gameState, firstRow, col)) return null;
        if (isBlockedCell(cardState, firstRow, col, gameState)) return null;
        if (getCellValueForCard(gameState, firstRow, col) !== EMPTY) return null;

        let targetRow = firstRow;
        for (let currentRow = firstRow + dr; hasBoardShapeCellForCard(cardState, gameState, currentRow, col); currentRow += dr) {
            if (isBlockedCell(cardState, currentRow, col, gameState)) break;
            if (getCellValueForCard(gameState, currentRow, col) !== EMPTY) break;
            targetRow = currentRow;
        }
        const distance = Math.abs(targetRow - row);
        if (distance <= 0) return null;
        return {
            direction: { dr, dc: 0 },
            target: { row: targetRow, col },
            distance
        };
    }

    function _getTeleportDestinations(cardState: any, gameState: any) {
        return getEmptyBoardShapeCellsForCard(cardState, gameState)
            .filter((cell: any) => !isBlockedCell(cardState, cell.row, cell.col, gameState));
    }

    function applyTeleportWill(cardState: any, gameState: any, playerKey: any, row: any, col: any, prng: any) {
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

    function applyCellTeleportWill(cardState: any, gameState: any, playerKey: any, row: any, col: any, prng: any) {
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
            applyHoleAt: BoardOpsModule && typeof BoardOpsModule.applyHoleAt === 'function'
                ? BoardOpsModule.applyHoleAt
                : null,
            getMarkers
        });
    }

    function applyStrongWindWill(cardState: any, gameState: any, playerKey: any, row: any, col: any, prng: any) {
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

    function applySuperBuoyancyWill(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        return CardMovementModule.applySuperBuoyancyWill(cardState, gameState, playerKey, row, col, {
            getSuperBuoyancyTargets,
            getCellValueForCard,
            hasBoardShapeCellForCard,
            isBlockedCell,
            findSpecialMarkerAt,
            destroyAt: BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function'
                ? BoardOpsModule.destroyAt
                : null,
            runDestroyBlock: BoardOpsModule && typeof BoardOpsModule.runDestroyBlock === 'function'
                ? BoardOpsModule.runDestroyBlock
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

    function applyBuoyancyWill(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        return CardMovementModule.applyBuoyancyWill(cardState, gameState, playerKey, row, col, {
            getBuoyancyTargets,
            getCellValueForCard,
            hasBoardShapeCellForCard,
            isBlockedCell,
            moveAt: BoardOpsModule && typeof BoardOpsModule.moveAt === 'function'
                ? BoardOpsModule.moveAt
                : null,
            setCellValueForCard,
            getMarkers
        });
    }

    function applySuperGravityWill(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        return CardMovementModule.applySuperGravityWill(cardState, gameState, playerKey, row, col, {
            getSuperGravityTargets,
            getCellValueForCard,
            hasBoardShapeCellForCard,
            isBlockedCell,
            findSpecialMarkerAt,
            destroyAt: BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function'
                ? BoardOpsModule.destroyAt
                : null,
            runDestroyBlock: BoardOpsModule && typeof BoardOpsModule.runDestroyBlock === 'function'
                ? BoardOpsModule.runDestroyBlock
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

    function applyGravityWill(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        return CardMovementModule.applyGravityWill(cardState, gameState, playerKey, row, col, {
            getGravityTargets,
            getCellValueForCard,
            hasBoardShapeCellForCard,
            isBlockedCell,
            moveAt: BoardOpsModule && typeof BoardOpsModule.moveAt === 'function'
                ? BoardOpsModule.moveAt
                : null,
            setCellValueForCard,
            getMarkers
        });
    }

    function applySuperAttractionWill(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        return CardMovementModule.applySuperAttractionWill(cardState, gameState, playerKey, row, col, {
            getSuperAttractionTargets,
            getCellValueForCard,
            hasBoardShapeCellForCard,
            isBlockedCell,
            findSpecialMarkerAt,
            destroyAt: BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function'
                ? BoardOpsModule.destroyAt
                : null,
            runDestroyBlock: BoardOpsModule && typeof BoardOpsModule.runDestroyBlock === 'function'
                ? BoardOpsModule.runDestroyBlock
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

    function getCardHandManagerContext() {
        if (!CardEffectResolverModule || typeof CardEffectResolverModule.getCardHandManagerContext !== 'function') {
            throw new Error('[cards.js] CardEffectResolver.getCardHandManagerContext not available');
        }
        return CardEffectResolverModule.getCardHandManagerContext({
            hasStandardLegalMoveForPlayer,
            canUseLastResortForPlayer,
            canUseEqualityWillForPlayer,
            canUseReinforcementWillForPlayer,
            canUseTimeStopGodForPlayer,
            countOpponentOccupiedCornersForPlayer,
            getDestroyTargets,
            getTemptWillTargets,
            getCaptureWillTargets,
            getStrongWindTargets,
            getBuoyancyTargets,
            getSuperBuoyancyTargets,
            getGravityTargets,
            getSuperGravityTargets,
            getSuperAttractionTargets,
            getTrapTargets,
            getGuardTargets,
            getLivingWillTargets,
            getHyperactiveInheritTargets,
            getExtendLifeTargets,
            getCorrosionTargets,
            getTimeBombTargets,
            getTeleportTargets,
            getCellTeleportTargets,
            getCloneTargets,
            getSwapTargets,
            getPositionSwapTargets,
            getReinforcementWillTargets,
            getOccupiedBoardShapeCellsForCard,
            getBoardExpansionTargets,
            getBoardExpansionGodTargets,
            getBoardShrinkTargets,
            getBoardShrinkGodTargets,
            getBlockadeTargets,
            getMeteorTargets,
            getFreezeTargets,
            getSeedTargets,
            CardDefsModule,
            CardCostsModule,
            CardSelectorsModule
        });
    }

    function getCardStateFactoryContext() {
        return {
            defaultPrng,
            constants: {
                RIBO_WILL_OWNER_TURNS,
                RIBO_WILL_REPAYMENT_AMOUNT,
                RIBO_WILL_SHORTAGE_DESTROY_COUNT
            },
            resolveCardBoardConfig,
            resolveInitialDeckCardIdsByPlayer,
            buildInitialBoardBonusMap,
            createStoneIdBoard,
            getOpeningPlacementsForState,
            cloneSalvationDestroyedLedger,
            ensureCardCopyState
        };
    }

    function getCardEffectTimingContext() {
        if (!CardEffectResolverModule || typeof CardEffectResolverModule.getCardEffectTimingContext !== 'function') {
            throw new Error('[cards.js] CardEffectResolver.getCardEffectTimingContext not available');
        }
        return CardEffectResolverModule.getCardEffectTimingContext({
            defaultPrng,
            _ensureHandDestroyFlags,
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
            clearStoneIdAtForCard,
            CardWorkModule,
            CardLivingWillModule,
            BoardOpsModule,
            ULTIMATE_DRAGON_TURNS,
            ULTIMATE_DESTROY_GOD_TURNS,
            ULTIMATE_HYPERACTIVE_TURNS,
            EXTREME_HYPERACTIVE_FLIP_EVADE_LIMIT,
            EXTREME_HYPERACTIVE_DESTROY_EVADE_LIMIT,
            AFTERIMAGE_WILL_FLIP_EVADE_LIMIT,
            AFTERIMAGE_WILL_DESTROY_EVADE_LIMIT,
            SNIPER_WILL_TURNS,
            DESTROY_DRAGON_TURNS,
            LIGHTNING_WILL_TURNS,
            OBSERVER_WILL_TURNS,
            GHOST_WILL_TURNS,
            SEED_WILL_TURNS,
            WILL_HUNTER_KING_TURNS,
            ROBOT_VACUUM_TURNS,
            TIME_STOP_GOD_TURNS,
            DOUBLE_PLACE_EXTRA,
            THROW_CHAIN_CONFIG_BY_TYPE,
            MARKER_KINDS,
            FLIP_CHARGE_MULTIPLIER_EFFECTS,
            NUMBER_CELL_CHARGE_MULTIPLIER_EFFECTS
        });
    }

    /**
     * Turn start processing
     * @param {Object} cardState
     * @param {string} playerKey
     * @param {Object} [prng]
     */
    function onTurnStart(cardState: any, playerKey: any, gameState: any, prng: any, options?: any) {
        if (!CardTimingProcessorModule || typeof CardTimingProcessorModule.onTurnStart !== 'function') {
            throw new Error('[cards.js] CardTimingProcessor.onTurnStart not available');
        }
        const opts = (options && typeof options === 'object') ? options : {};
        return CardTimingProcessorModule.onTurnStart(
            cardState,
            playerKey,
            gameState,
            prng,
            getCardEffectTimingContext()
        );
    }

    function consumeStoneSalvationGodRevives(cardState: any, gameState: any, playerKey: any, meta?: any) {
        if (!BoardOpsModule || typeof BoardOpsModule.consumeStoneSalvationGodRevives !== 'function') {
            return { revived: [], failed: [], requestedCount: 0, revivedCount: 0 };
        }
        return BoardOpsModule.consumeStoneSalvationGodRevives(cardState, gameState, playerKey, meta || {});
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
    function addChargeWithTotal(cardState: any, playerKey: any, amount: any, meta?: any) {
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

    function applyPlacementEffects(cardState: any, gameState: any, playerKey: any, row: any, col: any, flipCount: any) {
        if (!CardTimingProcessorModule || typeof CardTimingProcessorModule.applyPlacementEffects !== 'function') {
            throw new Error('[cards.js] CardTimingProcessor.applyPlacementEffects not available');
        }
        return CardTimingProcessorModule.applyPlacementEffects(
            cardState,
            gameState,
            playerKey,
            row,
            col,
            flipCount,
            getCardEffectTimingContext()
        );
    }

    function isNormalStoneForPlayer(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        if (CardUtilsModule && typeof CardUtilsModule.isNormalStoneForPlayer === 'function') {
            return CardUtilsModule.isNormalStoneForPlayer(cardState, gameState, playerKey, row, col);
        }
        const P_BLACK = BLACK || 1;
        const P_WHITE = WHITE || -1;
        const playerVal = playerKey === 'black' ? P_BLACK : P_WHITE;

        if (gameState.board[row][col] !== playerVal) return false;

        const specials = getSpecialMarkers(cardState);
        if (specials.some((s: any) => s.row === row && s.col === col)) return false;

        const bombs = getBombMarkers(cardState);
        if (bombs.some((b: any) => b.row === row && b.col === col)) return false;

        return true;
    }

    function applyStrongWill(cardState: any, playerKey: any, row: any, col: any) {
        return CardProtectModule.applyStrongWill(cardState, playerKey, row, col, {
            getSpecialMarkers,
            addMarker,
            STRONG_WILL_PROMOTION_OWNER_TURNS
        });
    }

    function applyAbsoluteProtect(cardState: any, playerKey: any, row: any, col: any) {
        return CardProtectModule.applyAbsoluteProtect(cardState, playerKey, row, col, {
            getSpecialMarkers,
            addMarker
        });
    }

    /**
     * Apply REGEN_WILL (next placed stone becomes regen stone)
     */
    function applyRegenWill(cardState: any, playerKey: any, row: any, col: any) {
        return CardRegenModule.applyRegenWill(cardState, playerKey, row, col, { addMarker, BLACK, WHITE });
    }


    /**
     * Resolve regen behavior for a set of flips (after board has been updated to newColor).
     * Delegates to cards/regen.js module.
     */
    function applyRegenAfterFlips(cardState: any, gameState: any, flips: any, flipperKey: any, skipCapture: any) {
        return CardRegenModule.applyRegenAfterFlips(cardState, gameState, flips, flipperKey, skipCapture, {
            getCardContext,
            clearBombAt,
            removeMarkersAt,
            BoardOps: BoardOpsModule
        });
    }

    function applyLivingWillAfterFlips(cardState: any, gameState: any, flips: any, flipperKey: any) {
        return CardLivingWillModule.applyLivingWillAfterFlips(
            cardState,
            gameState,
            flips,
            flipperKey,
            getLivingWillModuleContext()
        );
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
    function applyHeavenBlessingChoice(cardState: any, playerKey: any, selectedCardId: any) {
        return CardHandEffectsModule.applyHeavenBlessingChoice(cardState, playerKey, selectedCardId, {
            readCardPendingEffect,
            clearCardPendingEffect,
            addCardToHand,
            MAX_HAND_SIZE
        });
    }

    /**
     * Apply REVEAL_HAND_WILL (観測の意志)
     * Reveal the opponent hand as it exists at use time for the acting viewer only.
     * @param {Object} cardState
     * @param {string} playerKey
     * @returns {{applied:boolean, reason?:string, opponentKey?:string, revealedCount?:number}}
     */
    function applyRevealHandWill(cardState: any, playerKey: any) {
        return CardHandEffectsModule.applyRevealHandWill(cardState, playerKey, {
            readCardPendingEffect,
            clearCardPendingEffect,
            revealCurrentHandToViewer
        });
    }

    /**
     * Apply CONDEMN_WILL (断罪の意志)
     * Reveal opponent hand and destroy exactly one selected card.
     * @param {Object} cardState
     * @param {string} playerKey
     * @param {number} targetIndex
     * @returns {{applied:boolean, reason?:string, destroyedCardId?:string}}
     */
    function applyCondemnWill(cardState: any, playerKey: any, targetIndex: any) {
        return CardHandEffectsModule.applyCondemnWill(cardState, playerKey, targetIndex, {
            readCardPendingEffect,
            clearCardPendingEffect,
            removeHandCardAt,
            addCardToDiscard
        });
    }

    /**
     * Apply EXECUTION_WILL (執行の意志)
     * Destroy up to three random cards from the opponent hand.
     * @param {Object} cardState
     * @param {string} playerKey
     * @param {Object} prng
     * @returns {{applied:boolean, reason?:string, opponentKey?:string, requestedCount?:number, destroyedCount?:number, destroyedCardIds?:string[]}}
     */
    function applyExecutionWill(cardState: any, playerKey: any, prng: any) {
        return CardHandEffectsModule.applyExecutionWill(cardState, playerKey, prng, {
            readCardPendingEffect,
            clearCardPendingEffect,
            removeHandCardAt,
            addCardToDiscard,
            resolveDeterministicRandomIndex
        });
    }

    function getDirectionalChainFlips(gameState: any, row: any, col: any, ownerVal: any, dir: any, context: any) {
        return CardFlipsModule.getDirectionalChainFlips(gameState, row, col, ownerVal, dir, context);
    }

    function getTabooReverseDirectionalFlips(gameState: any, row: any, col: any, ownerVal: any, direction: any, context : any = {}) {
        const blockedCells = context.blockedCells || [];
        const absoluteProtectedStones = context.absoluteProtectedStones || [];

        const blockedSet = blockedCells.length
            ? new Set(blockedCells.map((p: any) => `${p.row},${p.col}`))
            : null;
        const absoluteSet = absoluteProtectedStones.length
            ? new Set(absoluteProtectedStones.map((p: any) => `${p.row},${p.col}`))
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

    function getTabooReverseCandidates(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        if (TargetResolver && typeof TargetResolver.getTabooReverseCandidates === 'function') {
            return TargetResolver.getTabooReverseCandidates(cardState, gameState, playerKey, row, col);
        }
        return [];
    }

    function pickTabooReverseFlips(cardState: any, gameState: any, playerKey: any, row: any, col: any, prng: any) {
        const candidates = getTabooReverseCandidates(cardState, gameState, playerKey, row, col);
        if (candidates.length === 0) {
            return { applied: false, flips: [], direction: null, score: 0 };
        }

        const maxScore = candidates.reduce((max: any, one: any) => Math.max(max, Number(one && one.score) || 0), 0);
        const topCandidates = candidates.filter((one: any) => (Number(one && one.score) || 0) === maxScore);

        const fallbackPrng = (cardState && cardState._boardOpsRandomSource && typeof cardState._boardOpsRandomSource.random === 'function')
            ? cardState._boardOpsRandomSource
            : (cardState && cardState._currentActionMeta && cardState._currentActionMeta.randomSource && typeof cardState._currentActionMeta.randomSource.random === 'function')
                ? cardState._currentActionMeta.randomSource
                : (cardState && cardState._defaultRandomSource && typeof cardState._defaultRandomSource.random === 'function')
                    ? cardState._defaultRandomSource
                    : null;
        const index = topCandidates.length === 1
            ? 0
            : resolveDeterministicRandomIndex(
                topCandidates.length,
                prng,
                fallbackPrng,
                'CardLogic.applyChainChoice'
            );
        const chosen = topCandidates[index] || topCandidates[0];

        return {
            applied: true,
            flips: (chosen.flips || []).map((pos: any) => ({ row: pos.row, col: pos.col })),
            direction: chosen.direction ? [chosen.direction[0], chosen.direction[1]] : null,
            score: Number(chosen.score) || 0
        };
    }


    function applyChainWillAfterMove(cardState: any, gameState: any, playerKey: any, primaryFlips: any, prng: any) {
        const pending = readCardPendingEffect(cardState, playerKey);
        const chainConfig = pending ? getChainWillConfig(pending.type) : null;
        if (!pending || !chainConfig) {
            return { applied: false, flips: [], chosen: null };
        }

        const playerValue = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const context = getCardContext(cardState);
        const p = prng || defaultPrng;

        function runChainLinks(findChainChoiceFn: any) {
            const appliedFlips = [];
            const chosenSteps = [];
            let sourceFlips = Array.isArray(primaryFlips) ? primaryFlips.slice() : [];
            const maxLinks = resolveChainWillMaxLinks(gameState, chainConfig);
            for (let i = 0; i < maxLinks; i++) {
                const res = findChainChoiceFn(gameState, sourceFlips, playerValue, context, p);
                if (!res || !res.applied || !Array.isArray(res.flips) || res.flips.length === 0) break;
                const chainLink = i + 1;
                const appliedThisLink = [];
                for (const pos of res.flips) {
                    let changed = true;
                    if (BoardOpsModule && typeof BoardOpsModule.changeAt === 'function') {
                        const changeRes = BoardOpsModule.changeAt(cardState, gameState, pos.row, pos.col, playerKey, CHAIN_WILL_EVENT_CAUSE, 'chain_flip', { chainLink });
                        changed = !!(changeRes && changeRes.changed);
                    } else {
                        gameState.board[pos.row][pos.col] = playerValue;
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

        return runChainLinks(CardChainModule.findChainChoice);
    }




    /**
    * Process Bomb countdowns
    * Delegates to cards/time_bomb.js module.
    */
    function tickBombs(cardState: any, gameState: any, playerKey: any) {
        if (!CardTimingProcessorModule || typeof CardTimingProcessorModule.tickBombs !== 'function') {
            throw new Error('[cards.js] CardTimingProcessor.tickBombs not available');
        }
        return CardTimingProcessorModule.tickBombs(cardState, gameState, playerKey, {
            BoardOpsModule,
            destroyAt
        });
    }

    /**
     * Tick a single bomb (by object) at turn start. Delegates to time_bomb_single if available.
     */
    function tickBombAt(cardState: any, gameState: any, bomb: any, activeKey: any) {
        if (!CardTimingProcessorModule || typeof CardTimingProcessorModule.tickBombAt !== 'function') {
            throw new Error('[cards.js] CardTimingProcessor.tickBombAt not available');
        }
        return CardTimingProcessorModule.tickBombAt(cardState, gameState, bomb, activeKey, {
            BoardOpsModule,
            destroyAt,
            removeMarkerById,
            removeMarkersAt,
            getBombMarkers,
            MARKER_CATEGORIES
        });
    }


    /**
     * Process Dragon effects
     * @param {Object} cardState
     * @param {Object} gameState
     * @param {string} playerKey - Current player
     * @returns {Object} { converted: [...], destroyed: [...] }
     */
    function processDragonEffects(cardState: any, gameState: any, playerKey: any) {
        if (!CardTimingProcessorModule || typeof CardTimingProcessorModule.processDragonEffects !== 'function') {
            throw new Error('[cards.js] CardTimingProcessor.processDragonEffects not available');
        }
        return CardTimingProcessorModule.processDragonEffects(cardState, gameState, playerKey, {
            BoardOpsModule,
            getCardContext,
            selectRandomEmptyBoardShapeDestination,
            moveCoexistingSpecialMarkers
        });
    }


    /**
     * Process a single DRAGON anchor immediately (placement-turn immediate fire).
     * Does NOT decrement remainingOwnerTurns (only owner turn starts decrement).
     * @returns {Object} { converted: [...], destroyed: [...] }
     */
    function processDragonEffectsAtAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        const dragonDeps = {
            BoardOps: BoardOpsModule,
            getCardContext,
            selectRandomEmptyBoardShapeDestination,
            moveCoexistingSpecialMarkers
        };
        return DragonEffectsModule.processDragonEffectsAtAnchor(cardState, gameState, playerKey, row, col, dragonDeps);
    }

    function processDragonEffectsAtTurnStartAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any, opts : any = {}) {
        const dragonDeps = Object.assign({
            BoardOps: BoardOpsModule,
            getCardContext,
            selectRandomEmptyBoardShapeDestination,
            moveCoexistingSpecialMarkers,
            randomSource: opts.randomSource ?? null
        }, opts);
        return DragonEffectsModule.processDragonEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, dragonDeps);
    }


    /**
     * Process ULTIMATE_DESTROY_GOD effects at owner turn start.
     * Delegates to cards/udg.js module.
     */
    function processUltimateDestroyGodEffects(cardState: any, gameState: any, playerKey: any) {
        if (!CardTimingProcessorModule || typeof CardTimingProcessorModule.processUltimateDestroyGodEffects !== 'function') {
            throw new Error('[cards.js] CardTimingProcessor.processUltimateDestroyGodEffects not available');
        }
        return CardTimingProcessorModule.processUltimateDestroyGodEffects(cardState, gameState, playerKey, {
            destroyAt,
            BoardOpsModule,
            selectRandomEmptyBoardShapeDestination,
            moveCoexistingSpecialMarkers
        });
    }


    /**
     * Immediate placement-turn activation for UDG anchor.
     * Delegates to cards/udg.js module.
     */
    function processUltimateDestroyGodEffectsAtAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any, opts : any = {}) {
        // Delegate to module
        const deps = Object.assign({
            destroyAt,
            BoardOps: BoardOpsModule,
            selectRandomEmptyBoardShapeDestination,
            moveCoexistingSpecialMarkers
        }, opts);
        return runBoardOpsDestroyBlock(cardState, gameState, () =>
            CardUdgModule.processUltimateDestroyGodEffectsAtAnchor(cardState, gameState, playerKey, row, col, deps),
            { randomSource: deps.random || opts.randomSource || opts.random }
        );
    }

    function processUltimateDestroyGodEffectsAtTurnStartAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any, opts : any = {}) {
        const deps = Object.assign({
            destroyAt,
            BoardOps: BoardOpsModule,
            selectRandomEmptyBoardShapeDestination,
            moveCoexistingSpecialMarkers
        }, opts);
        return runBoardOpsDestroyBlock(cardState, gameState, () =>
            CardUdgModule.processUltimateDestroyGodEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, deps),
            { randomSource: deps.random || opts.randomSource || opts.random }
        );
    }

    function processSniperWillEffects(cardState: any, gameState: any, playerKey: any, prng: any) {
        return CardSniperModule.processSniperWillEffects(cardState, gameState, playerKey, {
            destroyAt,
            BoardOps: BoardOpsModule,
            random: prng || defaultPrng
        });
    }

    function processSniperWillEffectsAtTurnStartAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any, prngOrOpts: any) {
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
        deps.random = resolveDeterministicRandomSource(
            randomCandidate,
            deps.random,
            'CardLogic.processSniperWillEffectsAtTurnStartAnchor'
        );

        return runBoardOpsDestroyBlock(cardState, gameState, () =>
            CardSniperModule.processSniperWillEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, deps),
            { randomSource: deps.random }
        );
    }
    function processLightningWillEffects(cardState: any, gameState: any, playerKey: any, prng: any) {
        return CardLightningModule.processLightningWillEffects(cardState, gameState, playerKey, {
            destroyAt,
            BoardOps: BoardOpsModule,
            random: prng || defaultPrng
        });
    }

    function processLightningWillEffectsAtAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any, prngOrOpts: any) {
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
        deps.random = resolveDeterministicRandomSource(
            randomCandidate,
            deps.random,
            'CardLogic.processLightningWillEffectsAtAnchor'
        );

        return runBoardOpsDestroyBlock(cardState, gameState, () =>
            CardLightningModule.processLightningWillEffectsAtAnchor(cardState, gameState, playerKey, row, col, deps),
            { randomSource: deps.random }
        );
    }

    function processLightningWillEffectsAtTurnStartAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any, prngOrOpts: any) {
        return processLightningWillEffectsAtAnchor(cardState, gameState, playerKey, row, col, prngOrOpts);
    }

    function processWillHunterKingEffectsAtTurnStartAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any, prngOrOpts: any) {
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
        deps.random = resolveDeterministicRandomSource(
            randomCandidate,
            deps.random,
            'CardLogic.processWillHunterKingEffectsAtTurnStartAnchor'
        );

        if (BoardOpsModule && typeof BoardOpsModule.runEffectBlock === 'function') {
            return CardWillHunterKingModule.processWillHunterKingEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, deps);
        }
        return runBoardOpsDestroyBlock(cardState, gameState, () =>
            CardWillHunterKingModule.processWillHunterKingEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, deps),
            { randomSource: deps.random }
        );
    }

    function processObserverWillEffectsAtTurnStartAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any, prngOrOpts: any) {
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
        opts.random = resolveDeterministicRandomSource(
            randomCandidate,
            opts.random,
            'CardLogic.processObserverWillEffectsAtTurnStartAnchor'
        );

        const result: {
            activated: boolean;
            triggered: boolean;
            gained: number;
            remainingOwnerTurns: number | null;
            expired: any[];
        } = {
            activated: false,
            triggered: false,
            gained: 0,
            remainingOwnerTurns: null,
            expired: []
        };

        if (!cardState || !gameState) return result;

        const marker = getSpecialMarkers(cardState).find((entry: any) => {
            if (!entry || entry.row !== row || entry.col !== col) return false;
            if (entry.owner !== playerKey) return false;
            const data = entry.data || {};
            return String(data.type || '').toUpperCase() === 'OBSERVER';
        });
        if (!marker) return result;

        const playerValue = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const boardRow = Array.isArray(gameState.board) ? gameState.board[row] : null;
        const cellValue = Array.isArray(boardRow) ? boardRow[col] : null;

        result.activated = true;
        if (cellValue !== playerValue) {
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

    function processDestroyDragonEffects(cardState: any, gameState: any, playerKey: any, prng: any) {
        return CardDestroyDragonModule.processDestroyDragonEffects(cardState, gameState, playerKey, {
            destroyAt,
            BoardOps: BoardOpsModule,
            random: prng || defaultPrng
        });
    }

    function processDestroyDragonEffectsAtAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any, opts : any = {}) {
        const deps = Object.assign({
            destroyAt,
            BoardOps: BoardOpsModule,
            random: defaultPrng
        }, opts || {});
        return runBoardOpsDestroyBlock(cardState, gameState, () =>
            CardDestroyDragonModule.processDestroyDragonEffectsAtAnchor(cardState, gameState, playerKey, row, col, deps),
            { randomSource: deps.random || opts.randomSource || opts.random }
        );
    }

    function processDestroyDragonEffectsAtTurnStartAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any, prng: any) {
        const deps = {
            destroyAt,
            BoardOps: BoardOpsModule,
            random: prng || defaultPrng
        };
        return runBoardOpsDestroyBlock(cardState, gameState, () =>
            CardDestroyDragonModule.processDestroyDragonEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, deps),
            { randomSource: deps.random }
        );
    }

    /**
      * Process Breeding effects (Stone spawning)
      * @param {Object} cardState
      * @param {Object} gameState
     * @param {string} playerKey
     * @param {Object} prng
     * @returns {Object} { spawned: [...], destroyed: [...], flipped: [...] }
    */
    function getFlipsWithContextLocal(state: any, row: any, col: any, player: any, context : any = {}) {
        return CardFlipsModule.getFlipsWithContext(state, row, col, player, context);
    }


    function clearHyperactiveAtPositions(cardState: any, positions: any) {
        const removeSet = new Set(positions.map((p: any) => `${p.row},${p.col}`));
        if (!cardState || !Array.isArray(cardState.markers)) return;
        cardState.markers = cardState.markers.filter((m: any) => {
            if (m.kind !== (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone')) return true;
            if (!m.data || (m.data.type !== 'HYPERACTIVE' && m.data.type !== 'ESCAPE_HYPERACTIVE' && m.data.type !== 'INHERITED_HYPERACTIVE' && m.data.type !== 'EXTREME_HYPERACTIVE' && m.data.type !== 'ROBOT_VACUUM' && m.data.type !== 'GLUTTONOUS' && m.data.type !== 'ULTIMATE_HYPERACTIVE' && m.data.type !== 'SNIPER' && m.data.type !== 'OBSERVER')) return true;
            if (findSpecialMarkerAt(cardState, m.row, m.col, 'GHOST')) return true;
            return !removeSet.has(`${m.row},${m.col}`);
        });
    }

    function moveHyperactiveOnce(cardState: any, gameState: any, entry: any, prng: any) {
        return CardHyperactiveModule.moveHyperactiveOnce(cardState, gameState, entry, prng, {
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


    function processHyperactiveMoves(cardState: any, gameState: any, prng: any) {
        if (!CardTimingProcessorModule || typeof CardTimingProcessorModule.processHyperactiveMoves !== 'function') {
            throw new Error('[cards.js] CardTimingProcessor.processHyperactiveMoves not available');
        }
        return CardTimingProcessorModule.processHyperactiveMoves(cardState, gameState, prng, {
            defaultPrng,
            getFlipsWithContextLocal,
            clearBombAt,
            clearHyperactiveAtPositions,
            isBlockedCell,
            getCardContext,
            BoardOpsModule,
            destroyAt
        });
    }


    function processHyperactiveMoveAtAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any, prng: any, options : any = {}) {
        return CardHyperactiveModule.processHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, {
            defaultPrng: defaultPrng,
            getFlipsWithContext: getFlipsWithContextLocal,
            clearBombAt,
            clearHyperactiveAtPositions,
            isBlockedCell,
            isAbsoluteProtectedCell,
            isFrozenCell,
            getCardContext,
            BoardOps: BoardOpsModule,
            swapOccupiedCellsWithPresentation,
            destroyAt,
            currentTurnPlayerKey: options.currentTurnPlayerKey || playerKey,
            inheritedHyperactiveTurns: INHERITED_HYPERACTIVE_TURNS,
            expectedSpecialType: options.expectedSpecialType || null
        });
    }

    function processRobotVacuumMoveAtAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any, prng: any, options : any = {}) {
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
        return runBoardOpsDestroyBlock(cardState, gameState, () =>
            CardHyperactiveModule.processRobotVacuumMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, deps),
            { randomSource: prng || defaultPrng }
        );
    }

    function processGluttonousMoveAtAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any, prng: any, options : any = {}) {
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
        return CardHyperactiveModule.processGluttonousMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, deps);
    }

    function resolveHyperactiveFlipEvasion(cardState: any, gameState: any, flipCells: any, ownerAfterKey: any, prng: any) {
        const fallbackFlips = (Array.isArray(flipCells) ? flipCells : []).map((cell: any) => {
            if (Array.isArray(cell) && Number.isInteger(cell[0]) && Number.isInteger(cell[1])) {
                return [cell[0], cell[1]];
            }
            if (cell && Number.isInteger(cell.row) && Number.isInteger(cell.col)) {
                return [cell.row, cell.col];
            }
            return null;
        }).filter((cell: any) => !!cell);

        return CardHyperactiveModule.resolveHyperactiveFlipEvasion(cardState, gameState, fallbackFlips, ownerAfterKey, prng, {
            defaultPrng: defaultPrng,
            clearHyperactiveAtPositions,
            isBlockedCell,
            BoardOps: BoardOpsModule,
            destroyAt
        });
    }

    function processInstantHyperactiveMoveAtAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any, prng: any) {
        return CardHyperactiveModule.processInstantHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, {
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

    function processUltimateHyperactiveMoveAtAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any, prng: any, options : any = {}) {
        return CardHyperactiveModule.processUltimateHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, {
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


    function processBreedingEffects(cardState: any, gameState: any, playerKey: any, prng: any) {
        return CardBreedingModule.processBreedingEffects(cardState, gameState, playerKey, prng, {
            defaultPrng: defaultPrng,
            getCardContext,
            getFlipsWithContext: getFlipsWithContextLocal,
            clearBombAt,
            clearHyperactiveAtPositions,
            BoardOps: BoardOpsModule,
            destroyAt
        });
    }


    /**
     * Process a single BREEDING anchor immediately (placement-turn immediate spawn).
     * Delegates to cards/breeding.js module.
     */
    function processBreedingEffectsAtAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any, prng: any) {
        return CardBreedingModule.processBreedingEffectsAtAnchor(cardState, gameState, playerKey, row, col, prng, {
            defaultPrng: defaultPrng,
            getCardContext,
            getFlipsWithContext: getFlipsWithContextLocal,
            clearBombAt,
            clearHyperactiveAtPositions,
            BoardOps: BoardOpsModule,
            destroyAt
        });
    }

    function processBreedingEffectsAtTurnStartAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any, prng: any) {
        return CardBreedingModule.processBreedingEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, prng, {
            defaultPrng: defaultPrng,
            getCardContext,
            getFlipsWithContext: getFlipsWithContextLocal,
            clearBombAt,
            clearHyperactiveAtPositions,
            BoardOps: BoardOpsModule,
            destroyAt
        });
    }


    /**
     * Apply DESTROY_ONE_STONE
     * Delegates to effects/destroy_one_stone.js module.
    */
    function applyDestroyEffectDetailed(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        return DestroyOneStoneModule.applyDestroyOneStone(cardState, gameState, playerKey, row, col, { BoardOps: BoardOpsModule, destroyAt });
    }

    function applyDestroyEffect(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        return isDestroyResolved(applyDestroyEffectDetailed(cardState, gameState, playerKey, row, col));
    }


    /**
     * Apply SWAP_WITH_ENEMY
     * Delegates to effects/swap_with_enemy.js module.
     */
    function applySwapEffect(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        const cardContext = getCardContext(cardState);
        const r = SwapWithEnemyModule.applySwapWithEnemy(cardState, gameState, playerKey, row, col, {
            BoardOps: BoardOpsModule,
            clearHyperactiveAtPositions,
            clearBombAt,
            emitPresentationEvent,
            cardContext,
            Core: resolveCoreLogicForCards()
        });
        return !!r.swapped;
    }

    function applyPositionSwapWill(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        return CardPositionSwapModule.applyPositionSwapWill(cardState, gameState, playerKey, row, col, {
            readCardPendingEffect,
            getCellValueForCard,
            isPositionSwapProtectedCell,
            swapOccupiedCellsWithPresentation,
            clearCardPendingEffect
        });
    }


    /**
     * Get context for core logic
     * @param {Object} cardState
    * @returns {Object} { protectedStones, permaProtectedStones, bombs, blockedCells }
     */
    function getCardContext(cardState: any) {
        if (!CardEffectResolverModule || typeof CardEffectResolverModule.getCardContext !== 'function') {
            throw new Error('[cards.js] CardEffectResolver.getCardContext not available');
        }
        return CardEffectResolverModule.getCardContext(cardState, {
            getSpecialMarkers,
            getBombMarkers,
            getBlockingMarkers,
            isFrozenCellForCard
        });
    }

    /**
     * Called when a turn ends (after move or pass)
     * @param {Object} cardState
     * @param {Object} gameState
     * @param {string} playerKey - 'black' or 'white'
     */
    function onTurnEnd(cardState: any, gameState: any, playerKey: any) {
        if (!CardTimingProcessorModule || typeof CardTimingProcessorModule.onTurnEnd !== 'function') {
            throw new Error('[cards.js] CardTimingProcessor.onTurnEnd not available');
        }
        return CardTimingProcessorModule.onTurnEnd(cardState, gameState, playerKey, {
            readCardPendingEffect,
            clearCardPendingEffect,
            isChainWillCardType
        });
    }

    /**
     * Check active pending effect
     * @param {Object} cardState
     * @param {string} playerKey
     * @returns {boolean}
     */
    function hasPendingEffect(cardState: any, playerKey: any) {
        return readCardPendingEffect(cardState, playerKey) !== null;
    }

    // Presentation event helpers (PoC)
    function allocateStoneId(cardState: any) {
        return requireCardPresentationHelper('allocateStoneId')(cardState, getCardPresentationHelperContext());
    }

    function emitPresentationEvent(cardState: any, ev: any) {
        return requireCardPresentationHelper('emitPresentationEvent')(cardState, ev, getCardPresentationHelperContext());
    }

    function flushPresentationEvents(cardState: any) {
        return requireCardPresentationHelper('flushPresentationEvents')(cardState, getCardPresentationHelperContext());
    }

    /**
     * Get pending effect type
     * @param {Object} cardState
     * @param {string} playerKey
     * @returns {string|null}
     */
    function getPendingEffectType(cardState: any, playerKey: any) {
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

    function isFreePlacementPendingType(pendingType: any) {
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
    function getSelectableTargets(cardState: any, gameState: any, playerKey: any) {
        if (TargetResolver && typeof TargetResolver.getSelectableTargets === 'function') {
            return TargetResolver.getSelectableTargets(cardState, gameState, playerKey);
        }
        return [];
    }

    
const cardsApi: any = {
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
        SEED_WILL_TURNS,
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
        buildHeavenBlessingSeedHint,
        buildHeavenBlessingOffers,
        buildCondemnOffers,
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
        consumeStoneSalvationGodRevives,
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
        applyHeavenBlessingChoice,
        applyRevealHandWill,
        applyCondemnWill,
        applyTemptWill,
        applyCaptureWill,
        applyExtendLifeWill,
        applyExtendLifeGod,
        applyCorrosionWill,
        applyGuardWill,
        applyLivingWill,
        applyHyperactiveInheritWill,
        applyTimeBombWill,
        applyTeleportWill,
        applyCellTeleportWill,
        applyCloneWill,
        applyBoardExpansionWill,
        applyBoardExpansionGod,
        applyBoardShrinkWill,
        applyBoardShrinkGod,
        applyBlockadeWill,
        applyMeteorWill,
        applyFreezeWill,
        applySeedWill,
        getEqualityWillBoardCounts,
        getReinforcementWillTargets,
        getReinforcementWillTargetCount,
        canUseReinforcementWillForPlayer,
        getLossWillRemovableCount,
        applyLossWill,
        getSalvationWillTargetCount,
        getExecutionWillTargetCount,
        applySalvationWill,
        applyExecutionWill,
        getFateWillControllerForTurnOwner,
        applyFateWill,
        applyStrongWindWill,
        applyBuoyancyWill,
        applySuperBuoyancyWill,
        applyGravityWill,
        applySuperGravityWill,
        applySuperAttractionWill,
        armRiboWillEffect,
        resolveEqualityWillUsage,
        resolveReinforcementWillUsage,
        getTimeStopGodDestroyableCount,
        resolveTimeStopGodUsage,
        consumeTimeStopConsecutiveTurn,
        applyRegenWill,
        applyRegenAfterFlips,
        applyLivingWillAfterFlips,
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
        getLivingWillTargets,
        getStrongWindTargets,
        getBuoyancyTargets,
        getSuperBuoyancyTargets,
        getGravityTargets,
        getSuperGravityTargets,
        getSuperAttractionTargets,
        getTabooReverseCandidates,
        pickTabooReverseFlips,
        cancelPendingSelection,
        getTemptWillTargets,
        getCaptureWillTargets,
        getTemptTargets,
        getCaptureTargets,
        getDestroyTargets,
        getSwapTargets,
        getPositionSwapTargets,
        getExtendLifeTargets,
        getCorrosionTargets,
        getGuardTargets,
        getHyperactiveInheritTargets,
        getTimeBombTargets,
        getTeleportTargets,
        getCellTeleportTargets,
        getCloneTargets,
        getBreedingTargets,
        getBoardExpansionTargets,
        getBoardExpansionGodTargets,
        getBoardShrinkTargets,
        getBoardShrinkGodTargets,
        getBlockadeTargets,
        getMeteorTargets,
        getFreezeTargets,
        getSeedTargets,
        getSniperTargets,
        getLightningTargets,
        getCrossBombTargets,
        getXBombTargets,
        getReinforcementTargets,
        getEqualityTargets,
        getCornerTributeTargets,
        getLastResortTargets,
        getCurrentCornerCellsForCard,
        countOccupiedCornersForPlayer,
        isBlockedCell,
        isAbsoluteProtectedCell,
        isFrozenCell,
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
        swapOccupiedCellsWithPresentation,
        // Presentation helpers (PoC)
        allocateStoneId,
        emitPresentationEvent,
        flushPresentationEvents
    };

export = cardsApi;
