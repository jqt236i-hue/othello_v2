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
    if (typeof globalThis !== 'undefined' && (globalThis as any)[key]) {
        return (globalThis as any)[key];
    }
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
const SpecialCardRegistry = resolveCardLogicModuleOrGlobal('../../shared/special-card-registry', 'SpecialCardRegistry');
const ManifestStoneRegistry = resolveCardLogicModuleOrGlobal('../../shared/manifest-stone-registry', 'ManifestStoneRegistry');
const EvasionStatus = resolveCardLogicModuleOrGlobal('../../shared/evasion-status', 'EvasionStatus');
const SharedBoardUtils = resolveCardLogicModuleOrGlobal('../../shared/shared-board-utils', 'SharedBoardUtils');
const CardRandomSource = resolveCardLogicModuleOrGlobal('./cards-internal/random-source', 'CardRandomSource');
const CardStateFactory = resolveCardLogicModuleOrGlobal('./cards-internal/state-factory', 'CardStateFactory');
const CardModuleResolver = resolveCardLogicModuleOrGlobal('./cards-internal/module-resolver', 'CardModuleResolver');
const CardPresentationHelpers = resolveCardLogicModuleOrGlobal('./cards-internal/presentation-helpers', 'CardPresentationHelpers');
const CardStateManager = resolveCardLogicModuleOrGlobal('../cards/state-manager', 'CardStateManager');
const CardEffectResolverModule = resolveCardLogicModuleOrGlobal('../cards/effect-resolver', 'CardEffectResolver');
const CardTimingProcessorModule = resolveCardLogicModuleOrGlobal('../cards/timing-processor', 'CardTimingProcessor');
const TargetResolver = resolveCardLogicModuleOrGlobal('../cards/target-resolver', 'CardTargetResolver');
const CardCaptureSourceModule = resolveCardLogicModuleOrGlobal('./cards-internal/capture-source', 'CardCaptureSource');
const CardProgressionModule = resolveCardLogicModuleOrGlobal('./cards-internal/progression', 'CardProgression');
const CardRandomBoardSpawnModule = resolveCardLogicModuleOrGlobal('./cards-internal/random-board-spawn', 'CardRandomBoardSpawn');
const CardSpawnAndFlipModule = resolveCardLogicModuleOrGlobal('./cards-internal/spawn-and-flip', 'CardSpawnAndFlip');
const CardRiboTimeStopModule = resolveCardLogicModuleOrGlobal('./cards-internal/ribo-time-stop', 'CardRiboTimeStop');
const CardTargetAccessModule = resolveCardLogicModuleOrGlobal('./cards-internal/target-access', 'CardTargetAccess');
const CardContextBuildersModule = resolveCardLogicModuleOrGlobal('./cards-internal/context-builders', 'CardContextBuilders');
const CardTheoryIncarnationBindings = resolveCardLogicModuleOrGlobal('./cards-internal/theory-incarnation-bindings', 'CardTheoryIncarnationBindings');
const CardDeckSetupModule = resolveCardLogicModuleOrGlobal('./cards-internal/deck-setup', 'CardDeckSetup');
const CardHandAccessModule = resolveCardLogicModuleOrGlobal('./cards-internal/hand-access', 'CardHandAccess');
const CardAvailabilityModule = resolveCardLogicModuleOrGlobal('./cards-internal/card-availability', 'CardAvailability');
const CardOfferBuildersModule = resolveCardLogicModuleOrGlobal('./cards-internal/offer-builders', 'CardOfferBuilders');
const CardEffectTargetCountsModule = resolveCardLogicModuleOrGlobal('./cards-internal/effect-target-counts', 'CardEffectTargetCounts');
const CardSalvationEffectModule = resolveCardLogicModuleOrGlobal('./cards-internal/salvation-effect', 'CardSalvationEffect');
const CardLossEffectModule = resolveCardLogicModuleOrGlobal('./cards-internal/loss-effect', 'CardLossEffect');
const CardFateEffectModule = resolveCardLogicModuleOrGlobal('./cards-internal/fate-effect', 'CardFateEffect');
const CardBoardShapeAccessModule = resolveCardLogicModuleOrGlobal('./cards-internal/board-shape-access', 'CardBoardShapeAccess');
const CardFlipsModule = resolveCardLogicModuleOrGlobal('./cards/flips', 'CardFlips');

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

    function isInviolableSpecialCardId(cardId: unknown): boolean {
        return !!(
            SpecialCardRegistry &&
            typeof SpecialCardRegistry.isInviolableSpecialCardId === 'function' &&
            SpecialCardRegistry.isInviolableSpecialCardId(cardId)
        );
    }

    function isOverlayOnlySpecialStoneType(type: any) {
        if (SpecialStoneRegistry && typeof SpecialStoneRegistry.isOverlayOnlySpecialStoneType === 'function') {
            return SpecialStoneRegistry.isOverlayOnlySpecialStoneType(type);
        }
        const typeUpper = String(type || '').toUpperCase();
        return typeUpper === 'GUARD' || typeUpper === 'LIVING_WILL';
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
        return CardSalvationEffectModule.cloneSalvationDestroyedEntries(entries);
    }

    function cloneSalvationDestroyedLedger(source: any) {
        return CardSalvationEffectModule.cloneSalvationDestroyedLedger(source);
    }

    function ensureSalvationDestroyedLedger(cardState: any) {
        return CardSalvationEffectModule.ensureSalvationDestroyedLedger(cardState);
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
    const ULTIMATE_DRAGON_TURNS = 8;
    const ULTIMATE_DESTROY_GOD_TURNS = 6;
    const ULTIMATE_HYPERACTIVE_TURNS = 12;
    const STONE_SALVATION_GOD_TURNS = 12;
    const EXTREME_HYPERACTIVE_FLIP_EVADE_LIMIT = 5;
    const EXTREME_HYPERACTIVE_DESTROY_EVADE_LIMIT = 5;
    const ULTIMATE_HYPERACTIVE_FLIP_EVADE_LIMIT = 5;
    const ULTIMATE_HYPERACTIVE_DESTROY_EVADE_LIMIT = 2;
    const AFTERIMAGE_WILL_FLIP_EVADE_LIMIT = 3;
    const AFTERIMAGE_WILL_DESTROY_EVADE_LIMIT = 3;
    const SNIPER_WILL_TURNS = 6;
    const DESTROY_DRAGON_TURNS = 3;
    const LIGHTNING_WILL_TURNS = 6;
    const METEOR_GOD_TURNS = 6;
    const GHOST_WILL_TURNS = 8;
    const PROLIFERATION_WILL_TURNS = 10;
    const WILL_HUNTER_KING_TURNS = 8;
    const ROBOT_VACUUM_TURNS = 5;
    const BLOCKADE_TURNS = 3;
    const FREEZE_TURNS = 5;
    const SEED_WILL_TURNS = 5;
    const TRAP_WILL_STEAL_MAX = 10;
    const GUARD_WILL_TURNS = 3;
    const GUARDIAN_GOD_TURNS = 10;
    const RIBO_WILL_UNLOCK_TURN_INDEX = 19;
    const RIBO_WILL_INITIAL_GAIN = 30;
    const RIBO_WILL_REPAYMENT_AMOUNT = 4;
    const RIBO_WILL_OWNER_TURNS = 9;
    const RIBO_WILL_SHORTAGE_DESTROY_COUNT = 4;
    const REINFORCEMENT_WILL_SPAWN_COUNT = 1;
    const SUPPORT_TROOPS_WILL_SPAWN_COUNT = 3;
    const EQUALITY_WILL_STEAL_MAX = 10;
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
    const NUMBER_CELL_CHARGE_MULTIPLIER_EFFECTS = Object.freeze({
        CRYSTAL_STONE: {
            multiplier: 2,
            effectFlag: 'crystalStoneUsed',
            gainField: 'crystalStoneGain'
        }
    });
    if (!CardProgressionModule || typeof CardProgressionModule.getThrowChainConfig !== 'function') {
        throw new Error('CardProgressionModule not loaded');
    }

    const THROW_CHAIN_CONFIG_BY_TYPE = CardProgressionModule.THROW_CHAIN_CONFIG_BY_TYPE || {};
    const CHAIN_WILL_CONFIG_BY_TYPE = CardProgressionModule.CHAIN_WILL_CONFIG_BY_TYPE || {};
    const CHAIN_WILL_CARD_TYPES = CardProgressionModule.CHAIN_WILL_CARD_TYPES || [];

    function getThrowChainConfig(cardType: any) {
        return CardProgressionModule.getThrowChainConfig(cardType);
    }

    function getChainWillConfig(cardType: any) {
        return CardProgressionModule.getChainWillConfig(cardType);
    }

    function isChainWillCardType(cardType: any) {
        return CardProgressionModule.isChainWillCardType(cardType);
    }

    function addGeneratedThrowChainCard(cardState: any, playerKey: any, sourceCardId: any, sourceCardType: any) {
        return CardProgressionModule.addGeneratedThrowChainCard(cardState, playerKey, sourceCardId, sourceCardType, {
            addCardToHand,
            emitPresentationEvent
        });
    }

    function addGeneratedChainWillCard(cardState: any, playerKey: any, sourceCardId: any, sourceCardType: any) {
        return CardProgressionModule.addGeneratedChainWillCard(cardState, playerKey, sourceCardId, sourceCardType, {
            addCardToHand,
            emitPresentationEvent
        });
    }

    function resolveChainWillMaxLinks(gameState: any, config: any) {
        return CardProgressionModule.resolveChainWillMaxLinks(gameState, config, {
            resolveCardBoardConfig
        });
    }

    function getCardRandomBoardSpawnDeps() {
        return {
            getEmptyBoardShapeCellsForCard,
            isBlockedCell,
            sampleRandomPositions,
            BoardOpsModule,
            CardBreedingModule,
            spawnAndFlipBatch: CardSpawnAndFlipModule && typeof CardSpawnAndFlipModule.spawnAndFlipBatch === 'function'
                ? CardSpawnAndFlipModule.spawnAndFlipBatch
                : null,
            getCardContext,
            getFlipsWithContextLocal,
            clearBombAt,
            clearHyperactiveAtPositions,
            BLACK,
            WHITE,
            setCellValueForCard,
            allocateStoneId,
            setStoneIdAtForCard,
            emitPresentationEvent,
            getReinforcementWillTargets,
            readCardPendingEffect,
            clearCardPendingEffect,
            reinforcementWillSpawnCount: REINFORCEMENT_WILL_SPAWN_COUNT,
            supportTroopsWillSpawnCount: SUPPORT_TROOPS_WILL_SPAWN_COUNT
        };
    }

    function getCardRiboTimeStopDeps() {
        return {
            BLACK,
            WHITE,
            BoardOpsModule,
            resolveCardBoardConfig,
            isGuardProtectedCell,
            isAbsoluteProtectedCell,
            getCellValueForCard,
            isFrozenCellForCard,
            findSpecialMarkerAt,
            getMarkers,
            EvasionStatus,
            removeMarkerById,
            removeMarkersAt,
            sampleRandomPositions,
            destroyCellWithPresentation,
            revertSpecialStoneWithPresentation,
            addChargeValue: addChargeValueWithDelta,
            addChargeWithTotal,
            destroyAt,
            runBoardOpsDestroyBlock,
            specialStoneKind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone',
            constants: {
                RIBO_WILL_OWNER_TURNS,
                RIBO_WILL_INITIAL_GAIN,
                RIBO_WILL_REPAYMENT_AMOUNT,
                RIBO_WILL_SHORTAGE_DESTROY_COUNT,
                TIME_STOP_GOD_TURNS,
                TIME_STOP_GOD_CONSECUTIVE_TURNS,
                TIME_STOP_GOD_SELF_DESTROY_COUNT
            }
        };
    }

    function ensureGeneratedSpawnFlipResolver(cardState: any) {
        if (!cardState || typeof cardState !== 'object') return cardState;
        if (cardState._generatedSpawnFlipResolverInstalled === true && typeof cardState._generatedSpawnFlipResolver === 'function') {
            return cardState;
        }
        const resolveGeneratedFlipBatch = CardSpawnAndFlipModule && typeof CardSpawnAndFlipModule.resolveGeneratedFlipBatch === 'function'
            ? CardSpawnAndFlipModule.resolveGeneratedFlipBatch
            : null;
        const generatedSpawnFlipResolver = (nextCardState: any, nextGameState: any, entries: any[]) => {
            if (!resolveGeneratedFlipBatch || !Array.isArray(entries) || entries.length === 0) return [];
            const results: any[] = [];
            for (const entry of entries) {
                if (!entry || !Number.isInteger(entry.row) || !Number.isInteger(entry.col)) continue;
                const ownerKey = entry.ownerKey === 'white' ? 'white' : 'black';
                const ownerValue = ownerKey === 'white' ? WHITE : BLACK;
                const flipped = resolveGeneratedFlipBatch(
                    nextCardState,
                    nextGameState,
                    ownerKey,
                    ownerValue,
                    [{ row: entry.row, col: entry.col }],
                    {
                        BoardOps: BoardOpsModule,
                        getCardContext,
                        getFlipsWithContext: getFlipsWithContextLocal,
                        clearBombAt,
                        changeCause: entry.changeCause || entry.cause || 'SYSTEM',
                        changeReason: entry.changeReason || `${String(entry.reason || 'generated_spawn').toLowerCase()}_flip`,
                        changeMeta: entry.changeMeta || null
                    }
                );
                if (flipped.length > 0 && typeof clearHyperactiveAtPositions === 'function') {
                    clearHyperactiveAtPositions(nextCardState, flipped);
                }
                results.push({
                    ownerKey,
                    cause: entry.cause || null,
                    reason: entry.reason || null,
                    spawned: [{ row: entry.row, col: entry.col }],
                    flipped
                });
            }
            return results;
        };
        Object.defineProperty(cardState, '_generatedSpawnFlipResolver', {
            value: generatedSpawnFlipResolver,
            configurable: true,
            writable: true,
            enumerable: false
        });
        Object.defineProperty(cardState, '_generatedSpawnFlipResolverInstalled', {
            value: true,
            configurable: true,
            writable: true,
            enumerable: false
        });
        return cardState;
    }

    function consumeGeneratedSpawnFlipResults(cardState: any) {
        if (!BoardOpsModule || typeof BoardOpsModule.consumeResolvedGeneratedSpawnFlipResults !== 'function') {
            return [];
        }
        return BoardOpsModule.consumeResolvedGeneratedSpawnFlipResults(cardState);
    }

    function spawnAndFlipPlacement(options: any) {
        if (!CardSpawnAndFlipModule || typeof CardSpawnAndFlipModule.spawnAndFlipPlacement !== 'function') {
            throw new Error('[cards.js] CardSpawnAndFlip.spawnAndFlipPlacement not available');
        }
        return CardSpawnAndFlipModule.spawnAndFlipPlacement(options);
    }

    function getCardTargetAccessDeps() {
        return {
            CardTargetsModule,
            CardSelectorsModule,
            TargetResolver,
            CardExpansionModule,
            CardShrinkModule,
            readCardPendingEffect
        };
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
        return requireCardDeckSetup().getDefaultDeckSize();
    }

    function buildDefaultDeckCardIds(prng: any) {
        return requireCardDeckSetup().buildDefaultDeckCardIds(prng);
    }

    function expandInitialDeckSpec(deckSpec: any) {
        return requireCardDeckSetup().expandInitialDeckSpec(deckSpec);
    }

    function normalizeInitialDeckCardIds(deckCardIds: any) {
        return requireCardDeckSetup().normalizeInitialDeckCardIds(deckCardIds);
    }

    function resolveExplicitInitialDeckCardIds(options: any, playerKey: any) {
        return requireCardDeckSetup().resolveExplicitInitialDeckCardIds(options, playerKey);
    }

    function resolveInitialDeckCardIdsByPlayer(options: any, prng: any) {
        return requireCardDeckSetup().resolveInitialDeckCardIdsByPlayer(options, prng);
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

    const CardExpansionModule = resolveRequiredCardModule('./cards/expansion', 'CardExpansion');
    const CardMarkersModule = resolveRequiredCardModule('./cards/markers', 'CardMarkers');
    /** @type {any} */
    const CardMovementModule = resolveRequiredCardModule('./cards/movement', 'CardMovement');
    /** @type {any} */
    const CardTeleportModule = resolveRequiredCardModule('./cards/teleport', 'CardTeleport');
    /** @type {any} */
    const CardCloneModule = resolveRequiredCardModule('./cards/clone', 'CardClone');
    /** @type {any} */
    const CardMeteorModule = resolveRequiredCardModule('./cards/meteor', 'CardMeteor');
    const CardMeteorGodModule = resolveRequiredCardModule('./cards/meteor_god', 'CardMeteorGod');
    /** @type {any} */
    const CardShrinkModule = resolveRequiredCardModule('./cards/shrink', 'CardShrink');
    /** @type {any} */
    const CardLivingWillModule = resolveRequiredCardModule('./cards/living_will', 'CardLivingWill');
    const CardTargetsModule = resolveRequiredCardModule('./cards/targets', 'CardTargets');
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
    const CardProtectModule = resolveRequiredCardModule('./card-resolution/protect', 'CardProtectEffects');
    const CardTrapModule = resolveRequiredCardModule('./card-resolution/trap', 'CardTrapEffects');
    const CardOwnershipEffectsModule = resolveRequiredCardModule('./card-resolution/ownership', 'CardOwnershipEffects');
    const CardBoardExpansionApplyModule = resolveRequiredCardModule('./card-resolution/board-expansion-apply', 'CardBoardExpansionApply');
    const CardStatusCellsModule = resolveRequiredCardModule('./card-resolution/status-cells', 'CardStatusCellsEffects');
    const CardHandEffectsModule = resolveRequiredCardModule('./card-resolution/hand-effects', 'CardHandEffects');
    const CardObserverWillResolutionModule = resolveRequiredCardModule('./card-resolution/observer-will', 'CardObserverWillResolution');
    const CardTheoryIncarnationResolutionModule = resolveRequiredCardModule('./card-resolution/theory-incarnation', 'CardTheoryIncarnationResolution');
    const CardBoardExecutorResolutionModule = resolveRequiredCardModule('./card-resolution/board-executor', 'CardBoardExecutorResolution');
    const SpecialStoneMarkerFactoryModule = resolveRequiredCardModule('./card-resolution/special-stone-marker-factory', 'SpecialStoneMarkerFactory');
    const CardPositionSwapModule = resolveRequiredCardModule('./card-resolution/position-swap', 'CardPositionSwapEffects');

    function addChargeValue(cardState: any, playerKey: any, amount: any, reason: any, meta?: any) {
        if (!CardStateManager || typeof CardStateManager.addCharge !== 'function') {
            throw new Error('[cards.js] CardStateManager.addCharge not available');
        }
        return CardStateManager.addCharge(cardState, playerKey, amount, reason, meta);
    }

    function addChargeValueWithDelta(cardState: any, playerKey: any, amount: any, reason: any, meta?: any) {
        if (CardUtilsModule && typeof CardUtilsModule.addChargeWithDelta === 'function') {
            return CardUtilsModule.addChargeWithDelta(cardState, playerKey, amount, reason, meta);
        }
        return addChargeValue(cardState, playerKey, amount, reason, meta);
    }

    function isGuardProtectedCell(cardState: any, row: any, col: any) {
        return requireCardMarkersMethod('isGuardProtectedCell')(cardState, row, col);
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

    function getTimeStopGodDestroyableCount(cardState: any, gameState: any, playerKey: any) {
        return CardRiboTimeStopModule.getTimeStopGodDestroyableCount(cardState, gameState, playerKey, getCardRiboTimeStopDeps());
    }

    function canUseTimeStopGodForPlayer(cardState: any, gameState: any, playerKey: any) {
        return CardRiboTimeStopModule.canUseTimeStopGodForPlayer(cardState, gameState, playerKey, getCardRiboTimeStopDeps());
    }

    function resolveTimeStopGodUsage(cardState: any, gameState: any, playerKey: any, prng: any) {
        return CardRiboTimeStopModule.resolveTimeStopGodUsage(cardState, gameState, playerKey, prng, getCardRiboTimeStopDeps());
    }

    function consumeTimeStopConsecutiveTurn(cardState: any, playerKey: any) {
        return CardRiboTimeStopModule.consumeTimeStopConsecutiveTurn(cardState, playerKey);
    }

    function processTimeStopEffectsAtTurnStartAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        return CardRiboTimeStopModule.processTimeStopEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, getCardRiboTimeStopDeps());
    }

    function armRiboWillEffect(cardState: any, playerKey: any) {
        return CardRiboTimeStopModule.armRiboWillEffect(cardState, playerKey, getCardRiboTimeStopDeps());
    }

    function collectRandomBoardSpawnablePositions(cardState: any, gameState: any, predicate: any) {
        return CardRandomBoardSpawnModule.collectRandomBoardSpawnablePositions(cardState, gameState, predicate, getCardRandomBoardSpawnDeps());
    }

    function resolveRandomBoardSpawnEffectUsage(cardState: any, gameState: any, playerKey: any, requestedCount: any, prng: any, cause: any, reason: any, options: any = {}) {
        return CardRandomBoardSpawnModule.resolveRandomBoardSpawnEffectUsage(
            cardState,
            gameState,
            playerKey,
            requestedCount,
            prng,
            cause,
            reason,
            options,
            getCardRandomBoardSpawnDeps()
        );
    }

    function normalizeEqualityWillPlayerKey(playerKey: any) {
        return playerKey === 'white' || playerKey === WHITE ? 'white' : 'black';
    }

    function readEqualityWillCharge(cardState: any, playerKey: any) {
        const normalized = normalizeEqualityWillPlayerKey(playerKey);
        const raw = Number(cardState && cardState.charge && cardState.charge[normalized]);
        return Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
    }

    function resolveEqualityWillUsage(cardState: any, gameState: any, playerKey: any) {
        void gameState;
        if (!cardState || typeof cardState !== 'object') {
            return { applied: false, reason: 'invalid_state' };
        }
        const ownerKey = normalizeEqualityWillPlayerKey(playerKey);
        const opponentKey = ownerKey === 'white' ? 'black' : 'white';
        const playerChargeBefore = readEqualityWillCharge(cardState, ownerKey);
        const opponentChargeBefore = readEqualityWillCharge(cardState, opponentKey);
        if (playerChargeBefore !== 0) {
            return {
                applied: false,
                reason: 'own_charge_not_zero',
                player: ownerKey,
                opponent: opponentKey,
                requestedAmount: EQUALITY_WILL_STEAL_MAX,
                stolenAmount: 0,
                playerChargeBefore,
                playerChargeAfter: playerChargeBefore,
                opponentChargeBefore,
                opponentChargeAfter: opponentChargeBefore
            };
        }
        const playerRoom = Math.max(0, (Number(CHARGE_MAX) || 99) - playerChargeBefore);
        const requestedAmount = EQUALITY_WILL_STEAL_MAX;
        const movable = Math.min(requestedAmount, opponentChargeBefore, playerRoom);
        let stolenAmount = 0;

        if (movable > 0) {
            const gainRes = addChargeValueWithDelta(cardState, ownerKey, movable, 'equality_will_gain');
            stolenAmount = Math.max(0, Number(gainRes && gainRes.delta) || 0);
            if (stolenAmount > 0) {
                if (!cardState.chargeGainedTotal || typeof cardState.chargeGainedTotal !== 'object') {
                    cardState.chargeGainedTotal = { black: 0, white: 0 };
                }
                cardState.chargeGainedTotal[ownerKey] = (Number(cardState.chargeGainedTotal[ownerKey]) || 0) + stolenAmount;
                addChargeValueWithDelta(cardState, opponentKey, -stolenAmount, 'equality_will_loss');
            }
        }

        return {
            applied: true,
            player: ownerKey,
            opponent: opponentKey,
            requestedAmount,
            stolenAmount,
            playerChargeBefore,
            playerChargeAfter: readEqualityWillCharge(cardState, ownerKey),
            opponentChargeBefore,
            opponentChargeAfter: readEqualityWillCharge(cardState, opponentKey)
        };
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

    function getSupportTroopsWillTargets(cardState: any, gameState: any, playerKey: any) {
        return getReinforcementTargets(cardState, gameState, playerKey);
    }

    function canUseReinforcementWillForPlayer(cardState: any, gameState: any, playerKey: any) {
        return CardRandomBoardSpawnModule.canUseReinforcementWillForPlayer(cardState, gameState, playerKey, getCardRandomBoardSpawnDeps());
    }

    function canUseSupportTroopsWillForPlayer(cardState: any, gameState: any, playerKey: any) {
        return CardRandomBoardSpawnModule.canUseSupportTroopsWillForPlayer(cardState, gameState, playerKey, getCardRandomBoardSpawnDeps());
    }

    function resolveReinforcementWillUsage(cardState: any, gameState: any, playerKey: any, prng: any) {
        return CardRandomBoardSpawnModule.resolveReinforcementWillUsage(cardState, gameState, playerKey, prng, getCardRandomBoardSpawnDeps());
    }

    function resolveSupportTroopsWillUsage(cardState: any, gameState: any, playerKey: any, prng: any) {
        return CardRandomBoardSpawnModule.resolveSupportTroopsWillUsage(cardState, gameState, playerKey, prng, getCardRandomBoardSpawnDeps());
    }

    function processRiboWillTurnStartEffects(cardState: any, gameState: any, playerKey: any, prng: any) {
        return CardRiboTimeStopModule.processRiboWillTurnStartEffects(cardState, gameState, playerKey, prng, getCardRiboTimeStopDeps());
    }

    /** @type {any} */
    const CardSelectorsModule = resolveRequiredCardModule('./cards/selectors', 'CardSelectors');
    const CardUsagePrechecksModule = resolveRequiredCardModule('./cards-internal/card-usage-prechecks', 'CardUsagePrechecks');
    const CardHandManagerModule = resolveRequiredCardModule('./cards-internal/hand-manager', 'CardHandManager');
    const CardWorkModule = resolveRequiredCardModule('./cards/work_will', 'CardWork');
    let CardEffectTimingModules: any = null;

    function createCardEffectTimingModules() {
        const specialStoneKind = MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone';
        return Object.freeze({
            CardWorkModule,
            CardLivingWillModule,
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
            BoardOpsModule,
            CardBoardExecutorResolutionModule
        });
    }

    function getCardEffectTimingModules() {
        if (!CardEffectTimingModules) {
            CardEffectTimingModules = createCardEffectTimingModules();
        }
        return CardEffectTimingModules;
    }

    let CardContextBuildersCache: any = null;
    let CardDeckSetupCache: any = null;
    let CardHandAccessCache: any = null;
    let CardAvailabilityCache: any = null;
    let CardOfferBuildersCache: any = null;
    let CardEffectTargetCountsCache: any = null;
    let CardSalvationEffectCache: any = null;
    let CardLossEffectCache: any = null;
    let CardFateEffectCache: any = null;

    function getCardContextBuilders() {
        if (CardContextBuildersCache) return CardContextBuildersCache;
        if (!CardContextBuildersModule || typeof CardContextBuildersModule.createCardContextBuilders !== 'function') {
            return null;
        }
        CardContextBuildersCache = CardContextBuildersModule.createCardContextBuilders({
            CardEffectResolverModule,
            defaultPrng,
            constants: {
                BLACK,
                EMPTY,
                RIBO_WILL_OWNER_TURNS,
                RIBO_WILL_REPAYMENT_AMOUNT,
                RIBO_WILL_SHORTAGE_DESTROY_COUNT,
                ULTIMATE_DRAGON_TURNS,
                ULTIMATE_DESTROY_GOD_TURNS,
                ULTIMATE_HYPERACTIVE_TURNS,
                STONE_SALVATION_GOD_TURNS,
                EXTREME_HYPERACTIVE_FLIP_EVADE_LIMIT,
                EXTREME_HYPERACTIVE_DESTROY_EVADE_LIMIT,
                AFTERIMAGE_WILL_FLIP_EVADE_LIMIT,
                AFTERIMAGE_WILL_DESTROY_EVADE_LIMIT,
                SNIPER_WILL_TURNS,
                DESTROY_DRAGON_TURNS,
                LIGHTNING_WILL_TURNS,
                METEOR_GOD_TURNS,
                GHOST_WILL_TURNS,
                SEED_WILL_TURNS,
                WILL_HUNTER_KING_TURNS,
                ROBOT_VACUUM_TURNS,
                TIME_STOP_GOD_TURNS,
                DOUBLE_PLACE_EXTRA,
                THROW_CHAIN_CONFIG_BY_TYPE,
                MARKER_KINDS,
                FLIP_CHARGE_MULTIPLIER_EFFECTS,
                NUMBER_CELL_CHARGE_MULTIPLIER_EFFECTS,
                ULTIMATE_HYPERACTIVE_FLIP_EVADE_LIMIT,
                ULTIMATE_HYPERACTIVE_DESTROY_EVADE_LIMIT,
                GUARD_WILL_TURNS,
                GUARDIAN_GOD_TURNS
            },
            modules: {
                CardDefsModule,
                CardCostsModule,
                CardSelectorsModule,
                CardWorkModule,
                CardLivingWillModule,
                CardSpawnAndFlipModule,
                CardBoardExecutorResolutionModule,
                BoardOpsModule,
                StoneStatusSnapshot
            },
            helpers: {
                hasStandardLegalMoveForPlayer,
                canUseLastResortForPlayer,
                canUseEqualityWillForPlayer,
                canUseReinforcementWillForPlayer,
                canUseSupportTroopsWillForPlayer,
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
                getExtendLifeTargets,
                getCorrosionTargets,
                getTimeBombTargets,
                getTeleportTargets,
                getCellTeleportTargets,
                getCloneTargets,
                getSwapTargets,
                getPositionSwapTargets,
                getReverseWillTargets,
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
                resolveCardBoardConfig,
                resolveInitialDeckCardIdsByPlayer,
                buildInitialBoardBonusMap,
                createStoneIdBoard,
                getOpeningPlacementsForState,
                cloneSalvationDestroyedLedger,
                ensureCardCopyState,
                ensureHandDestroyFlags: _ensureHandDestroyFlags,
                processRiboWillTurnStartEffects,
                processObserverWillRepaymentsAtTurnStart,
                processBoardExecutorHandTaxAtTurnStart,
                commitDraw,
                getSpecialMarkers,
                getCardContext,
                getFlipsWithContext: getFlipsWithContextLocal,
                getOccupiedOriginFlipsWithContext: CardFlipsModule && typeof CardFlipsModule.getOccupiedOriginFlipsWithContext === 'function'
                    ? CardFlipsModule.getOccupiedOriginFlipsWithContext
                    : null,
                removeMarkersAt,
                isFrozenCellForCard,
                emitPresentationEvent,
                addChargeValue,
                addChargeWithTotal,
                addMarker,
                clearBombAt,
                clearHyperactiveAtPositions,
                applyStrongWill,
                applyAbsoluteProtect,
                applyRegenWill,
                workDebugLog,
                workDebugError,
                hasBoardShapeCellForCard,
                getCellValueForCard,
                setCellValueForCard,
                clearStoneIdAtForCard,
                readCardPendingEffect,
                clearCardPendingEffect,
                findBombMarkerAt,
                getBombMarkerType,
                isOverlayOnlySpecialStoneType,
                swapCellCoordinates,
                getStoneIdAtForCard
            }
        });
        return CardContextBuildersCache;
    }

    function requireCardContextBuilders() {
        const cardContextBuilders = getCardContextBuilders();
        if (!cardContextBuilders) {
            throw new Error('[cards.js] CardContextBuilders not available');
        }
        return cardContextBuilders;
    }

    function getCardDeckSetup() {
        if (CardDeckSetupCache) return CardDeckSetupCache;
        if (!CardDeckSetupModule || typeof CardDeckSetupModule.createCardDeckSetup !== 'function') {
            return null;
        }
        CardDeckSetupCache = CardDeckSetupModule.createCardDeckSetup({
            DeckSpecHelpers,
            CardStateManager,
            enabledCardIdSet: ENABLED_CARD_ID_SET
        });
        return CardDeckSetupCache;
    }

    function requireCardDeckSetup() {
        const cardDeckSetup = getCardDeckSetup();
        if (!cardDeckSetup) {
            throw new Error('[cards.js] CardDeckSetup not available');
        }
        return cardDeckSetup;
    }

    function getCardHandAccess() {
        if (CardHandAccessCache) return CardHandAccessCache;
        if (!CardHandAccessModule || typeof CardHandAccessModule.createCardHandAccess !== 'function') {
            return null;
        }
        CardHandAccessCache = CardHandAccessModule.createCardHandAccess({
            CardHandManagerModule,
            CardStateManager,
            defaultPrng,
            getCardHandManagerContext
        });
        return CardHandAccessCache;
    }

    function requireCardHandAccess() {
        const cardHandAccess = getCardHandAccess();
        if (!cardHandAccess) {
            throw new Error('[cards.js] CardHandAccess not available');
        }
        return cardHandAccess;
    }

    function getCardAvailability() {
        if (CardAvailabilityCache) return CardAvailabilityCache;
        if (!CardAvailabilityModule || typeof CardAvailabilityModule.createCardAvailability !== 'function') {
            return null;
        }
        CardAvailabilityCache = CardAvailabilityModule.createCardAvailability({
            constants: { BLACK, WHITE },
            resolveCoreLogicForCards,
            getExpansionDescriptorsForCard,
            hasStandardLegalMoveForPlayer,
            getReinforcementWillTargets
        });
        return CardAvailabilityCache;
    }

    function requireCardAvailability() {
        const cardAvailability = getCardAvailability();
        if (!cardAvailability) {
            throw new Error('[cards.js] CardAvailability not available');
        }
        return cardAvailability;
    }

    function getCardOfferBuilders() {
        if (CardOfferBuildersCache) return CardOfferBuildersCache;
        if (!CardOfferBuildersModule || typeof CardOfferBuildersModule.createOfferBuilders !== 'function') {
            return null;
        }
        CardOfferBuildersCache = CardOfferBuildersModule.createOfferBuilders({
            cardDefs: CARD_DEFS,
            heavenBlessingOfferCount: HEAVEN_BLESSING_OFFER_COUNT,
            isInviolableSpecialCardId
        });
        return CardOfferBuildersCache;
    }

    function requireCardOfferBuilders() {
        const cardOfferBuilders = getCardOfferBuilders();
        if (!cardOfferBuilders) {
            throw new Error('[cards.js] CardOfferBuilders not available');
        }
        return cardOfferBuilders;
    }

    function getCardEffectTargetCounts() {
        if (CardEffectTargetCountsCache) return CardEffectTargetCountsCache;
        if (!CardEffectTargetCountsModule || typeof CardEffectTargetCountsModule.createEffectTargetCounts !== 'function') {
            return null;
        }
        CardEffectTargetCountsCache = CardEffectTargetCountsModule.createEffectTargetCounts({
            ensureMarkers,
            getSpecialMarkers,
            getBombMarkers,
            getMarkerRuleClass,
            canLossWillRevertMarker: requireCardMarkersMethod('canLossWillRevertMarker'),
            isAbsoluteProtectedCell,
            ensureSalvationDestroyedLedger
        });
        return CardEffectTargetCountsCache;
    }

    function requireCardEffectTargetCounts() {
        const cardEffectTargetCounts = getCardEffectTargetCounts();
        if (!cardEffectTargetCounts) {
            throw new Error('[cards.js] CardEffectTargetCounts not available');
        }
        return cardEffectTargetCounts;
    }

    function getCardSalvationEffect() {
        if (CardSalvationEffectCache) return CardSalvationEffectCache;
        if (!CardSalvationEffectModule || typeof CardSalvationEffectModule.createCardSalvationEffect !== 'function') {
            return null;
        }
        CardSalvationEffectCache = CardSalvationEffectModule.createCardSalvationEffect({
            readCardPendingEffect,
            ensureSalvationDestroyedLedger,
            clearCardPendingEffect,
            resolveRandomBoardSpawnEffectUsage
        });
        return CardSalvationEffectCache;
    }

    function requireCardSalvationEffect() {
        const cardSalvationEffect = getCardSalvationEffect();
        if (!cardSalvationEffect) {
            throw new Error('[cards.js] CardSalvationEffect not available');
        }
        return cardSalvationEffect;
    }

    function getCardLossEffect() {
        if (CardLossEffectCache) return CardLossEffectCache;
        if (!CardLossEffectModule || typeof CardLossEffectModule.createCardLossEffect !== 'function') {
            return null;
        }
        CardLossEffectCache = CardLossEffectModule.createCardLossEffect({
            readCardPendingEffect,
            clearCardPendingEffect,
            collectLossWillRemovals: (cardState: any) => requireCardEffectTargetCounts().collectLossWillRemovals(cardState),
            getCellValueForCard,
            emitPresentationEvent,
            findLivingWillMarkerAt: CardLivingWillModule && typeof CardLivingWillModule.findLivingWillMarkerAt === 'function'
                ? CardLivingWillModule.findLivingWillMarkerAt
                : null,
            restoreFromLivingWillSnapshot: CardLivingWillModule && typeof CardLivingWillModule.restoreFromLivingWillSnapshot === 'function'
                ? CardLivingWillModule.restoreFromLivingWillSnapshot
                : null,
            getLivingWillModuleContext,
            emptyValue: EMPTY
        });
        return CardLossEffectCache;
    }

    function requireCardLossEffect() {
        const cardLossEffect = getCardLossEffect();
        if (!cardLossEffect) {
            throw new Error('[cards.js] CardLossEffect not available');
        }
        return cardLossEffect;
    }

    function getCardFateEffect() {
        if (CardFateEffectCache) return CardFateEffectCache;
        if (!CardFateEffectModule || typeof CardFateEffectModule.createCardFateEffect !== 'function') {
            return null;
        }
        CardFateEffectCache = CardFateEffectModule.createCardFateEffect({
            readCardPendingEffect,
            clearCardPendingEffect
        });
        return CardFateEffectCache;
    }

    function requireCardFateEffect() {
        const cardFateEffect = getCardFateEffect();
        if (!cardFateEffect) {
            throw new Error('[cards.js] CardFateEffect not available');
        }
        return cardFateEffect;
    }

    function getLivingWillModuleContext() {
        return requireCardContextBuilders().getLivingWillModuleContext();
    }

    const CardPendingStateManagerModule = resolveCardLogicGlobalOrModule('CardPendingStateManager', './cards-internal/pending-state-manager');
    const PendingCoordinatorModule = resolveCardLogicGlobalOrModule('TurnPendingCoordinator', '../turn/pending-coordinator');
    const CardChargeLedgerModule = resolveCardLogicGlobalOrModule('CardChargeLedger', './cards-internal/charge-ledger');

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

    const BoardOpsModule = resolveCardLogicGlobalOrModule('BoardOps', './board_ops');
    const MarkersAdapter = resolveCardLogicGlobalOrModule('MarkersAdapter', './markers_adapter');
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

    function getManifestMarkers(cardState: any) {
        return requireCardMarkersMethod('getManifestMarkers')(cardState);
    }

    function getActiveManifestMarkers(cardState: any) {
        return requireCardMarkersMethod('getActiveManifestMarkers')(cardState);
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
        return CardExpansionModule.isMainBoardCellForCard(row, col, boardOrConfig);
    }

    function resolveExpansionSideForCard(side: any, row: any, col: any, boardOrConfig: any) {
        return CardExpansionModule.resolveExpansionSideForCard(side, row, col, boardOrConfig);
    }

    function normalizeExpansionOwnerForCard(owner: any) {
        return CardExpansionModule.normalizeExpansionOwnerForCard(owner);
    }

    function isExpansionCoordinateForCard(row: any, col: any, boardOrConfig: any) {
        return CardExpansionModule.isExpansionCoordinateForCard(row, col, boardOrConfig);
    }

    function getExpansionDescriptorsForCard(gameState: any) {
        return CardExpansionModule.getExpansionDescriptorsForCard(gameState);
    }

    function syncLegacyExpansionFieldsForCard(expansion: any, boardOrConfig?: any) {
        return CardExpansionModule.syncLegacyExpansionFieldsForCard(expansion, boardOrConfig || null);
    }

    function ensureMutableBoardExpansionForCard(gameState: any) {
        return CardExpansionModule.ensureMutableBoardExpansionForCard(gameState);
    }

    function writeExpansionDescriptorsForCard(gameState: any, cells: any) {
        return CardExpansionModule.writeExpansionDescriptorsForCard(gameState, cells);
    }

    function getCellValueForCard(gameState: any, row: any, col: any) {
        return CardExpansionModule.getCellValueForCard(gameState, row, col);
    }

    function setCellValueForCard(gameState: any, row: any, col: any, value: any) {
        return CardExpansionModule.setCellValueForCard(gameState, row, col, value);
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

    const CardBoardShapeAccess = (CardBoardShapeAccessModule && typeof CardBoardShapeAccessModule.createCardBoardShapeAccess === 'function')
        ? CardBoardShapeAccessModule.createCardBoardShapeAccess({
            emptyValue: EMPTY,
            blackValue: BLACK,
            whiteValue: WHITE,
            resolveCardBoardConfig,
            getExpansionDescriptorsForCard,
            isMainBoardCellForCard,
            getCellValueForCard,
            getBlockingMarkers,
            findSpecialMarkerAt,
            resolveDeterministicRandomIndex
        })
        : null;

    function requireCardBoardShapeAccessMethod(name: any) {
        const fn = CardBoardShapeAccess && CardBoardShapeAccess[name];
        if (typeof fn !== 'function') {
            throw new Error(`CardBoardShapeAccess.${String(name)} not loaded`);
        }
        return fn;
    }

    function isBlockedCell(cardState: any, row: any, col: any, gameState: any) {
        return requireCardBoardShapeAccessMethod('isBlockedCell')(cardState, row, col, gameState);
    }

    function toBoardCellKey(row: any, col: any) {
        return requireCardBoardShapeAccessMethod('toBoardCellKey')(row, col);
    }

    function hasMeteorHoleAtForCard(cardState: any, row: any, col: any) {
        return requireCardBoardShapeAccessMethod('hasMeteorHoleAtForCard')(cardState, row, col);
    }

    function hasBoardShapeCellForCard(cardState: any, gameState: any, row: any, col: any) {
        return requireCardBoardShapeAccessMethod('hasBoardShapeCellForCard')(cardState, gameState, row, col);
    }

    function getCurrentBoardShapeCellsForCard(cardState: any, gameState: any) {
        return requireCardBoardShapeAccessMethod('getCurrentBoardShapeCellsForCard')(cardState, gameState);
    }

    function getOccupiedBoardShapeCellsForCard(cardState: any, gameState: any) {
        return requireCardBoardShapeAccessMethod('getOccupiedBoardShapeCellsForCard')(cardState, gameState);
    }

    function getEmptyBoardShapeCellsForCard(cardState: any, gameState: any) {
        return requireCardBoardShapeAccessMethod('getEmptyBoardShapeCellsForCard')(cardState, gameState);
    }

    function selectRandomEmptyBoardShapeDestination(cardState: any, gameState: any, fromRow: any, fromCol: any, randomSource: any) {
        return requireCardBoardShapeAccessMethod('selectRandomEmptyBoardShapeDestination')(cardState, gameState, fromRow, fromCol, randomSource);
    }

    function moveCoexistingSpecialMarkers(cardState: any, anchorEntry: any, fromRow: any, fromCol: any, toRow: any, toCol: any) {
        return requireCardBoardShapeAccessMethod('moveCoexistingSpecialMarkers')(cardState, anchorEntry, fromRow, fromCol, toRow, toCol);
    }

    function collectEmptyNeighborCellsForCard(cardState: any, gameState: any, row: any, col: any) {
        return requireCardBoardShapeAccessMethod('collectEmptyNeighborCellsForCard')(cardState, gameState, row, col);
    }

    function getCurrentCornerCellsForCard(cardState: any, gameState: any) {
        return requireCardBoardShapeAccessMethod('getCurrentCornerCellsForCard')(cardState, gameState);
    }

    function countOccupiedCornersForPlayer(cardState: any, gameState: any, playerKey: any) {
        return requireCardBoardShapeAccessMethod('countOccupiedCornersForPlayer')(cardState, gameState, playerKey);
    }

    function countOpponentOccupiedCornersForPlayer(cardState: any, gameState: any, playerKey: any) {
        return requireCardBoardShapeAccessMethod('countOpponentOccupiedCornersForPlayer')(cardState, gameState, playerKey);
    }

    function findSpecialMarkerAt(cardState: any, row: any, col: any, type?: any, owner?: any) {
        return requireCardMarkersMethod('findSpecialMarkerAt')(cardState, row, col, type, owner);
    }

    function findManifestMarkerAt(cardState: any, row: any, col: any, type?: any, owner?: any) {
        return requireCardMarkersMethod('findManifestMarkerAt')(cardState, row, col, type, owner);
    }

    function findBombMarkerAt(cardState: any, row: any, col: any) {
        return requireCardMarkersMethod('findBombMarkerAt')(cardState, row, col);
    }

    function isPositionSwapProtectedCell(cardState: any, row: any, col: any) {
        return !!(
            isFrozenCellForCard(cardState, row, col) ||
            findSpecialMarkerAt(cardState, row, col, 'GLUTTONOUS') ||
            findSpecialMarkerAt(cardState, row, col, 'ABSOLUTE_PROTECTED')
        );
    }

    function isFrozenCell(cardState: any, row: any, col: any) {
        return !!isFrozenCellForCard(cardState, row, col);
    }

    function isAbsoluteProtectedCell(cardState: any, row: any, col: any) {
        const fn = CardMarkersModule && CardMarkersModule.isAbsoluteProtectedCell;
        if (typeof fn === 'function') {
            return !!fn(cardState, row, col);
        }
        return !!findSpecialMarkerAt(cardState, row, col, 'ABSOLUTE_PROTECTED');
    }

    function isManifestStoneMarker(marker: any) {
        return requireCardMarkersMethod('isManifestStoneMarker')(marker);
    }

    function isManifestStoneAt(cardState: any, row: any, col: any) {
        return requireCardMarkersMethod('isManifestStoneAt')(cardState, row, col);
    }

    function isCardPlayLockedForPlayer(cardState: any, playerKey: any) {
        return requireCardMarkersMethod('isCardPlayLockedForPlayer')(cardState, playerKey);
    }

    function isPlacementLockedForPlayer(cardState: any, playerKey: any) {
        return requireCardMarkersMethod('isPlacementLockedForPlayer')(cardState, playerKey);
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
        return requireCardContextBuilders().getCardPresentationHelperContext();
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
        return CardExpansionModule.buildInitialBoardBonusMap(prng, boardOrConfig);
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
        return ensureGeneratedSpawnFlipResolver(
            CardStateFactory.createCardState(prng, options, getCardStateFactoryContext())
        );
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
        return ensureGeneratedSpawnFlipResolver(
            CardStateFactory.copyCardState(cs, getCardStateFactoryContext())
        );
    }

    /**
     * Deal initial hands
     * @param {Object} cardState
     * @param {Object} [prng]
     */
    function dealInitialHands(cardState: any, prng: any) {
        return requireCardHandAccess().dealInitialHands(cardState, prng);
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

    function getObserverWillResolutionDeps() {
        return {
            MARKER_KINDS,
            BLACK,
            WHITE,
            addMarker,
            getMarkers,
            getManifestMarkers,
            getActiveManifestMarkers,
            isManifestStoneMarker,
            removeMarkerById,
            getCellValueForCard,
            isAbsoluteProtectedCell,
            isGuardProtectedCell,
            isFrozenCellForCard,
            sampleRandomPositions,
            destroyCellWithPresentation,
            isMainBoardCellForCard,
            revertSpecialStoneWithPresentation,
            revealCurrentHandToViewer,
            addCardCostModifierForCopyId,
            isInviolableSpecialCardId,
            ManifestStoneRegistry,
            addChargeValue: addChargeValueWithDelta
        };
    }

    function applyObserverWillStoneReservation(cardState: any, playerKey: any, row: any, col: any) {
        return CardObserverWillResolutionModule.applyObserverWillStoneReservation(
            cardState,
            playerKey,
            row,
            col,
            getObserverWillResolutionDeps()
        );
    }

    function hasActiveObserverWillReveal(cardState: any, viewerKey: any, ownerKey: any) {
        return CardObserverWillResolutionModule.hasActiveObserverWillReveal(
            cardState,
            viewerKey,
            ownerKey,
            getObserverWillResolutionDeps()
        );
    }

    function processObserverWillMarkerAtTurnStart(cardState: any, gameState: any, playerKey: any, row: any, col: any, prng?: any) {
        return CardObserverWillResolutionModule.processObserverWillMarkerAtTurnStart(
            cardState,
            gameState,
            playerKey,
            row,
            col,
            prng,
            getObserverWillResolutionDeps()
        );
    }

    function processObserverWillRepaymentsAtTurnStart(cardState: any, gameState: any, playerKey: any, prng: any) {
        return CardObserverWillResolutionModule.processObserverWillRepaymentsAtTurnStart(
            cardState,
            gameState,
            playerKey,
            prng,
            getObserverWillResolutionDeps()
        );
    }

    function observeActiveObserverWillHandForOwner(cardState: any, ownerKey: any) {
        return CardObserverWillResolutionModule.observeActiveObserverWillHandForOwner(
            cardState,
            ownerKey,
            getObserverWillResolutionDeps()
        );
    }

    function applyObserverWillObservedCostTax(cardState: any, ownerKey: any, observedCopyIds: any, exemptCopyId?: any) {
        return CardObserverWillResolutionModule.applyObserverWillObservedCostTax(
            cardState,
            ownerKey,
            observedCopyIds,
            getObserverWillResolutionDeps(),
            exemptCopyId
        );
    }

    function clearObserverWillObservationCost(cardState: any, cardCopyId: any) {
        return CardObserverWillResolutionModule.clearObserverWillObservationCost(cardState, cardCopyId);
    }

    function getTheoryIncarnationResolutionDeps() {
        if (!CardTheoryIncarnationBindings || typeof CardTheoryIncarnationBindings.buildTheoryIncarnationResolutionDeps !== 'function') {
            throw new Error('CardTheoryIncarnationBindings not loaded');
        }
        return CardTheoryIncarnationBindings.buildTheoryIncarnationResolutionDeps({
            MARKER_KINDS,
            BLACK,
            WHITE,
            EMPTY,
            CARD_DEFS,
            constants: {
                GHOST_WILL_TURNS,
                AFTERIMAGE_WILL_FLIP_EVADE_LIMIT,
                AFTERIMAGE_WILL_DESTROY_EVADE_LIMIT,
                PROLIFERATION_WILL_TURNS,
                ULTIMATE_DRAGON_TURNS,
                ULTIMATE_DESTROY_GOD_TURNS,
                ULTIMATE_HYPERACTIVE_TURNS,
                STONE_SALVATION_GOD_TURNS,
                SNIPER_WILL_TURNS,
                DESTROY_DRAGON_TURNS,
                LIGHTNING_WILL_TURNS,
                METEOR_GOD_TURNS,
                WILL_HUNTER_KING_TURNS,
                ROBOT_VACUUM_TURNS
            },
            SpecialStoneRegistry,
            ManifestStoneRegistry,
            SpecialStoneMarkerFactory: SpecialStoneMarkerFactoryModule,
            Core: resolveCoreLogicForCards(),
            BoardOps: BoardOpsModule,
            spawnAndFlipPlacement,
            resolveSafeCardContext: getCardContext,
            resolveHyperactiveFlipEvasion,
            clearBombAt,
            clearHyperactiveAtPositions,
            addMarker,
            getMarkers,
            removeMarkerById,
            getCellValueForCard,
            setCellValueForCard,
            isBlockedCell,
            sampleRandomPositions,
            revertSpecialStoneWithPresentation,
            addChargeWithTotal,
            spawnAt: BoardOpsModule && typeof BoardOpsModule.spawnAt === 'function'
                ? BoardOpsModule.spawnAt
                : null
        });
    }

    function getBoardExecutorResolutionDeps() {
        return {
            MARKER_KINDS,
            BLACK,
            WHITE,
            EMPTY,
            ManifestStoneRegistry,
            addMarker,
            getMarkers,
            removeMarkerById,
            getCellValueForCard,
            isMainBoardCellForCard,
            revertSpecialStoneWithPresentation,
            applyCellRemovalAt: BoardOpsModule && typeof BoardOpsModule.applyCellRemovalAt === 'function'
                ? BoardOpsModule.applyCellRemovalAt
                : null,
            runCellRemovalBlock: BoardOpsModule && typeof BoardOpsModule.runCellRemovalBlock === 'function'
                ? BoardOpsModule.runCellRemovalBlock
                : null,
            addChargeValue: addChargeValueWithDelta
        };
    }

    function addNumberCellCollectedTotal(cardState: any, playerKey: any, amount: any) {
        return CardTheoryIncarnationResolutionModule.addNumberCellCollectedTotal(cardState, playerKey, amount);
    }

    function canUseBoardExecutor(cardState: any, playerKey: any) {
        return CardBoardExecutorResolutionModule.canUseBoardExecutor(cardState, playerKey, getBoardExecutorResolutionDeps());
    }

    function applyBoardExecutorUsage(cardState: any, gameState: any, playerKey: any, prng: any) {
        return CardBoardExecutorResolutionModule.applyBoardExecutorUsage(
            cardState,
            gameState,
            playerKey,
            prng,
            getBoardExecutorResolutionDeps()
        );
    }

    function applyBoardExecutorStoneReservation(cardState: any, playerKey: any, row: any, col: any) {
        return CardBoardExecutorResolutionModule.applyBoardExecutorStoneReservation(
            cardState,
            playerKey,
            row,
            col,
            getBoardExecutorResolutionDeps()
        );
    }

    function processBoardExecutorHandTaxAtTurnStart(cardState: any, gameState: any, playerKey: any, prng: any) {
        return CardBoardExecutorResolutionModule.processBoardExecutorHandTaxAtTurnStart(
            cardState,
            playerKey,
            getBoardExecutorResolutionDeps()
        );
    }

    function processBoardExecutorMarkerAtTurnStart(cardState: any, gameState: any, playerKey: any, row: any, col: any, prng?: any) {
        return CardBoardExecutorResolutionModule.processBoardExecutorMarkerAtTurnStart(
            cardState,
            gameState,
            playerKey,
            row,
            col,
            prng,
            getBoardExecutorResolutionDeps()
        );
    }

    function canUseTheoryIncarnation(cardState: any, playerKey: any) {
        return CardTheoryIncarnationResolutionModule.canUseTheoryIncarnation(cardState, playerKey);
    }

    function applyTheoryIncarnationUsage(cardState: any, gameState: any, playerKey: any, prng: any) {
        return CardTheoryIncarnationResolutionModule.applyTheoryIncarnationUsage(
            cardState,
            gameState,
            playerKey,
            prng,
            getTheoryIncarnationResolutionDeps()
        );
    }

    function applyTheoryIncarnationStoneReservation(cardState: any, playerKey: any, row: any, col: any) {
        return CardTheoryIncarnationResolutionModule.applyTheoryIncarnationStoneReservation(
            cardState,
            playerKey,
            row,
            col,
            getTheoryIncarnationResolutionDeps()
        );
    }

    function processTheoryIncarnationMarkerAtPlacement(cardState: any, gameState: any, playerKey: any, prng?: any) {
        return CardTheoryIncarnationResolutionModule.processTheoryIncarnationMarkerAtPlacement(
            cardState,
            gameState,
            playerKey,
            prng,
            getTheoryIncarnationResolutionDeps()
        );
    }

    function processTheoryIncarnationMarkerAtTurnStart(cardState: any, gameState: any, playerKey: any, row: any, col: any, prng?: any) {
        return CardTheoryIncarnationResolutionModule.processTheoryIncarnationMarkerAtTurnStart(
            cardState,
            gameState,
            playerKey,
            row,
            col,
            prng,
            getTheoryIncarnationResolutionDeps()
        );
    }

    function processTheoryIncarnationMarkerAfterOwnerPlacement(cardState: any, gameState: any, playerKey: any, prng?: any) {
        return CardTheoryIncarnationResolutionModule.processTheoryIncarnationMarkerAfterOwnerPlacement(
            cardState,
            gameState,
            playerKey,
            prng,
            getTheoryIncarnationResolutionDeps()
        );
    }

    function processTheoryIncarnationOwnerPass(cardState: any, gameState: any, playerKey: any, prng?: any) {
        return CardTheoryIncarnationResolutionModule.processTheoryIncarnationOwnerPass(
            cardState,
            gameState,
            playerKey,
            prng,
            getTheoryIncarnationResolutionDeps()
        );
    }

    /**
     * Draw a card
     * @param {Object} cardState 
     * @param {string} playerKey - 'black' or 'white'
     * @param {Object} [prng] 
     * @returns {string|null} Drawn card ID
     */
    function commitDraw(cardState: any, playerKey: any, prng: any) {
        const drawn = requireCardHandAccess().commitDraw(cardState, playerKey, prng);
        if (drawn) {
            observeActiveObserverWillHandForOwner(cardState, playerKey);
        }
        return drawn;
    }

    function ensureCardCopyState(cardState: any) {
        return requireCardHandAccess().ensureCardCopyState(cardState);
    }

    function getHandCopyIdAt(cardState: any, playerKey: any, handIndex: any) {
        return requireCardHandAccess().getHandCopyIdAt(cardState, playerKey, handIndex);
    }

    function getHandCopyIds(cardState: any, playerKey: any) {
        return requireCardHandAccess().getHandCopyIds(cardState, playerKey);
    }

    function isCardCopyIdRevealedToViewer(cardState: any, viewerKey: any, cardCopyId: any) {
        return requireCardHandAccess().isCardCopyIdRevealedToViewer(cardState, viewerKey, cardCopyId);
    }

    function revealCurrentHandToViewer(cardState: any, viewerKey: any, ownerKey: any) {
        return requireCardHandAccess().revealCurrentHandToViewer(cardState, viewerKey, ownerKey);
    }

    function setCardCostOverrideForCopyId(cardState: any, cardCopyId: any, cost: any, sourceType?: any) {
        return requireCardHandAccess().setCardCostOverrideForCopyId(cardState, cardCopyId, cost, sourceType);
    }

    function addCardCostModifierForCopyId(cardState: any, cardCopyId: any, delta: any, sourceType?: any) {
        return requireCardHandAccess().addCardCostModifierForCopyId(cardState, cardCopyId, delta, sourceType);
    }

    function getEffectiveCardCostForCopy(cardState: any, cardId: any, cardCopyId: any) {
        return requireCardHandAccess().getEffectiveCardCostForCopy(cardState, cardId, cardCopyId);
    }

    function addCardToHand(cardState: any, playerKey: any, cardId: any, opts?: any) {
        return requireCardHandAccess().addCardToHand(cardState, playerKey, cardId, opts);
    }

    function addCardToDiscard(cardState: any, cardId: any, cardCopyId: any) {
        return requireCardHandAccess().addCardToDiscard(cardState, cardId, cardCopyId);
    }

    function removeHandCardAt(cardState: any, playerKey: any, handIndex: any) {
        return requireCardHandAccess().removeHandCardAt(cardState, playerKey, handIndex);
    }

    function clearHandToDiscard(cardState: any, playerKey: any, opts?: any) {
        return requireCardHandAccess().clearHandToDiscard(cardState, playerKey, {
            ...(opts || {}),
            isInviolableSpecialCardId
        });
    }

    function moveDiscardCardToHandByCardId(cardState: any, playerKey: any, cardId: any, opts: any) {
        return requireCardHandAccess().moveDiscardCardToHandByCardId(cardState, playerKey, cardId, opts);
    }

    /**
     * Get card definition
     * @param {string} cardId
     * @returns {Object|null}
     */
    function getCardDef(cardId: any) {
        return requireCardHandAccess().getCardDef(cardId);
    }

    /**
     * Get card type
     * @param {string} cardId
     * @returns {string|null}
     */
    function getCardType(cardId: any) {
        return requireCardHandAccess().getCardType(cardId);
    }

    function getCardDisplayName(cardId: any) {
        return requireCardHandAccess().getCardDisplayName(cardId);
    }

    function getCardCodeName(displayName: any) {
        return requireCardHandAccess().getCardCodeName(displayName);
    }

    /**
     * Get card cost
     * @param {string} cardId
     * @returns {number}
     */
    function getCardCost(cardId: any) {
        return requireCardHandAccess().getCardCost(cardId);
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

    function resolveCaptureSourceInfo(markerEntry: any) {
        if (CardCaptureSourceModule && typeof CardCaptureSourceModule.resolveCaptureSourceInfo === 'function') {
            return CardCaptureSourceModule.resolveCaptureSourceInfo(markerEntry);
        }
        return null;
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
    function canUseCard(cardState: any, playerKey: any, cardId: any, opts?: any) {
        return requireCardHandAccess().canUseCard(cardState, playerKey, cardId, opts);
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
        return requireCardAvailability().countDiscsForCardComparison(gameState);
    }

    function getDiscDisadvantageForPlayer(gameState: any, playerKey: any) {
        return requireCardAvailability().getDiscDisadvantageForPlayer(gameState, playerKey);
    }

    function getEqualityWillBoardCounts(gameState: any) {
        return requireCardAvailability().getEqualityWillBoardCounts(gameState);
    }

    function getEqualityWillChargeState(cardState: any, playerKey: any) {
        return requireCardAvailability().getEqualityWillChargeState(cardState, playerKey);
    }

    function hasFewerDiscsThanOpponentForPlayer(gameState: any, playerKey: any) {
        return requireCardAvailability().hasFewerDiscsThanOpponentForPlayer(gameState, playerKey);
    }

    function canUseLastResortForPlayer(cardState: any, gameState: any, playerKey: any) {
        return requireCardAvailability().canUseLastResortForPlayer(cardState, gameState, playerKey);
    }

    function canUseEqualityWillForPlayer(cardState: any, gameState: any, playerKey: any) {
        return requireCardAvailability().canUseEqualityWillForPlayer(cardState, gameState, playerKey);
    }

    function getReinforcementWillTargetCount(cardState: any, gameState: any, playerKey: any) {
        return requireCardAvailability().getReinforcementWillTargetCount(cardState, gameState, playerKey);
    }

    function getSupportTroopsWillTargetCount(cardState: any, gameState: any, playerKey: any) {
        return requireCardAvailability().getSupportTroopsWillTargetCount(cardState, gameState, playerKey);
    }

    function _ensureHandDestroyFlags(cardState: any) {
        return requireCardHandAccess().ensureHandDestroyFlags(cardState);
    }

    function destroyHandCard(cardState: any, playerKey: any, cardId: any, opts: any) {
        return requireCardHandAccess().destroyHandCard(cardState, playerKey, cardId, {
            ...(opts || {}),
            isInviolableSpecialCardId
        });
    }

    /**
     * Get list of usable card ids for current state (including target availability).
     * @param {Object} cardState
     * @param {Object} gameState
     * @param {string} playerKey
     * @returns {string[]}
     */
    function getUsableCardIds(cardState: any, gameState: any, playerKey: any, opts: any) {
        return requireCardHandAccess().getUsableCardIds(cardState, gameState, playerKey, opts);
    }

    /**
     * Check if player has any usable card right now.
     * @param {Object} cardState
     * @param {Object} gameState
     * @param {string} playerKey
     * @returns {boolean}
     */
    function hasUsableCard(cardState: any, gameState: any, playerKey: any) {
        return requireCardHandAccess().hasUsableCard(cardState, gameState, playerKey);
    }

    function buildHeavenBlessingSeedHint(cardState: any, playerKey: any) {
        return requireCardOfferBuilders().buildHeavenBlessingSeedHint(cardState, playerKey);
    }

    function buildHeavenBlessingOffers(cardIdToExclude: any, prng: any, seedHint: any) {
        return requireCardOfferBuilders().buildHeavenBlessingOffers(cardIdToExclude, prng, seedHint);
    }

    function buildCondemnOffers(cardState: any, playerKey: any) {
        return requireCardOfferBuilders().buildCondemnOffers(cardState, playerKey);
    }

    function buildObserverWillOffers(cardState: any, playerKey: any) {
        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        const opponentHand = cardState && cardState.hands && Array.isArray(cardState.hands[opponentKey])
            ? cardState.hands[opponentKey]
            : [];
        return opponentHand
            .map((cardId: any, handIndex: number) => ({
                handIndex,
                cardId,
                cardCopyId: getHandCopyIdAt(cardState, opponentKey, handIndex)
            }))
            .filter((offer: any) => !isInviolableSpecialCardId(offer.cardId));
    }

    /**
     * Apply card usage (Remove from hand, consume charge, set pending effect)
     * @param {Object} cardState
     * @param {string} playerKey
     * @param {string} cardId
     * @returns {boolean} success
     */
    function applyCardUsage(cardState: any, playerKey: any, cardId: any) {
        ensureGeneratedSpawnFlipResolver(cardState);
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
            getHandCopyIdAt,
            getEffectiveCardCostForCopy,
            getCardType,
            buildHeavenBlessingSeedHint,
            buildHeavenBlessingOffers,
            buildCondemnOffers,
            buildObserverWillOffers,
            applyTheoryIncarnationUsage,
            applyBoardExecutorUsage,
            hasStandardLegalMoveForPlayer,
            canUseLastResortForPlayer,
            canUseEqualityWillForPlayer,
            canUseReinforcementWillForPlayer,
            canUseSupportTroopsWillForPlayer,
            canUseTimeStopGodForPlayer,
            countOpponentOccupiedCornersForPlayer,
            getDestroyTargets,
            getReverseWillTargets,
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
            getExtendLifeTargets,
            getCorrosionTargets,
            getTimeBombTargets,
            getTeleportTargets,
            getCellTeleportTargets,
            getCloneTargets,
            getSwapTargets,
            getPositionSwapTargets: (nextCardState: any, nextGameState: any, nextPlayerKey: any) => getPositionSwapTargets(
                nextCardState,
                nextGameState,
                nextPlayerKey,
                { type: 'POSITION_SWAP_WILL', stage: 'selectTarget' }
            ),
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
            getSupportTroopsWillTargetCount,
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
            isCardPlayLockedForPlayer,
            CardPendingStateManagerModule,
            CardUsagePrechecksModule,
            CardBoardExecutorResolutionModule,
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

    function getMarkerRuleClass(marker: any) {
        return requireCardMarkersMethod('getMarkerRuleClass')(marker);
    }

    function getTrueSpecialStoneMarkerAt(cardState: any, row: any, col: any) {
        return requireCardMarkersMethod('getTrueSpecialStoneMarkerAt')(cardState, row, col);
    }

    function isTrueSpecialStoneAt(cardState: any, row: any, col: any) {
        return requireCardMarkersMethod('isTrueSpecialStoneAt')(cardState, row, col);
    }

    function isTemptTargetableMarker(marker: any) {
        return requireCardMarkersMethod('isTemptTargetableMarker')(marker);
    }

    function isCaptureTargetableMarker(marker: any) {
        return requireCardMarkersMethod('isCaptureTargetableMarker')(marker);
    }

    function blocksTemptAt(cardState: any, row: any, col: any) {
        return requireCardMarkersMethod('blocksTemptAt')(cardState, row, col);
    }

    function getTrueSpecialStoneOwnerAt(cardState: any, row: any, col: any) {
        return requireCardMarkersMethod('getTrueSpecialStoneOwnerAt')(cardState, row, col);
    }

    function getTemptWillTargets(cardState: any, gameState: any, playerKey: any) {
        return CardTargetAccessModule.getTemptWillTargets(cardState, gameState, playerKey, getCardTargetAccessDeps());
    }

    function getCaptureWillTargets(cardState: any, gameState: any, playerKey: any) {
        return CardTargetAccessModule.getCaptureWillTargets(cardState, gameState, playerKey, getCardTargetAccessDeps());
    }

    function getTemptTargets(cardState: any, gameState: any, playerKey: any) {
        return CardTargetAccessModule.getTemptTargets(cardState, gameState, playerKey, getCardTargetAccessDeps());
    }

    function getCaptureTargets(cardState: any, gameState: any, playerKey: any) {
        return CardTargetAccessModule.getCaptureTargets(cardState, gameState, playerKey, getCardTargetAccessDeps());
    }

    function getDestroyTargets(cardState: any, gameState: any) {
        return CardTargetAccessModule.getDestroyTargets(cardState, gameState, getCardTargetAccessDeps());
    }

    function getSwapTargets(cardState: any, gameState: any, playerKey: any) {
        return CardTargetAccessModule.getSwapTargets(cardState, gameState, playerKey, getCardTargetAccessDeps());
    }

    function getPositionSwapTargets(cardState: any, gameState: any, playerKey: any, pending: any) {
        return CardTargetAccessModule.getPositionSwapTargets(cardState, gameState, playerKey, pending, getCardTargetAccessDeps());
    }

    function getBreedingTargets(cardState: any, gameState: any, playerKey: any) {
        return CardTargetAccessModule.getBreedingTargets(cardState, gameState, playerKey, getCardTargetAccessDeps());
    }

    function getSniperTargets(cardState: any, gameState: any, playerKey: any) {
        return CardTargetAccessModule.getSniperTargets(cardState, gameState, playerKey, getCardTargetAccessDeps());
    }

    function getLightningTargets(cardState: any, gameState: any, playerKey: any) {
        return CardTargetAccessModule.getLightningTargets(cardState, gameState, playerKey, getCardTargetAccessDeps());
    }

    function getCrossBombTargets(cardState: any, gameState: any, playerKey: any) {
        return CardTargetAccessModule.getCrossBombTargets(cardState, gameState, playerKey, getCardTargetAccessDeps());
    }

    function getXBombTargets(cardState: any, gameState: any, playerKey: any) {
        return CardTargetAccessModule.getXBombTargets(cardState, gameState, playerKey, getCardTargetAccessDeps());
    }

    function getReinforcementTargets(cardState: any, gameState: any, playerKey: any) {
        return CardTargetAccessModule.getReinforcementTargets(cardState, gameState, playerKey, getCardTargetAccessDeps());
    }

    function getEqualityTargets(cardState: any, gameState: any, playerKey: any) {
        return CardTargetAccessModule.getEqualityTargets(cardState, gameState, playerKey, getCardTargetAccessDeps());
    }

    function getLastResortTargets(cardState: any, gameState: any, playerKey: any) {
        return CardTargetAccessModule.getLastResortTargets(cardState, gameState, playerKey, getCardTargetAccessDeps());
    }

    function getTrapTargets(cardState: any, gameState: any, playerKey: any) {
        return CardTargetAccessModule.getTrapTargets(cardState, gameState, playerKey, getCardTargetAccessDeps());
    }

    function getGuardTargets(cardState: any, gameState: any, playerKey: any) {
        return CardTargetAccessModule.getGuardTargets(cardState, gameState, playerKey, getCardTargetAccessDeps());
    }

    function getLivingWillTargets(cardState: any, gameState: any, playerKey: any) {
        return CardTargetAccessModule.getLivingWillTargets(cardState, gameState, playerKey, getCardTargetAccessDeps());
    }

    // Return targets: own true special stones / stone statuses with remainingOwnerTurns > 0
    function getExtendLifeTargets(cardState: any, gameState: any, playerKey: any) {
        return CardTargetAccessModule.getExtendLifeTargets(cardState, gameState, playerKey, getCardTargetAccessDeps());
    }

    // Return targets: all true special stones / stone statuses with remainingOwnerTurns > 0
    function getCorrosionTargets(cardState: any, gameState: any, playerKey: any) {
        return CardTargetAccessModule.getCorrosionTargets(cardState, gameState, playerKey, getCardTargetAccessDeps());
    }

    function getTimeBombTargets(cardState: any, gameState: any, playerKey: any) {
        return CardTargetAccessModule.getTimeBombTargets(cardState, gameState, playerKey, getCardTargetAccessDeps());
    }

    function getTeleportTargets(cardState: any, gameState: any) {
        return CardTargetAccessModule.getTeleportTargets(cardState, gameState, getCardTargetAccessDeps());
    }

    function getCloneTargets(cardState: any, gameState: any, playerKey: any) {
        return CardTargetAccessModule.getCloneTargets(cardState, gameState, playerKey, getCardTargetAccessDeps());
    }

    function getBoardExpansionTargets(cardState: any, gameState: any, playerKey: any) {
        return CardTargetAccessModule.getBoardExpansionTargets(cardState, gameState, playerKey, getCardTargetAccessDeps());
    }

    function getBoardExpansionGodCornerDescriptorsForCard(gameState: any) {
        return CardTargetAccessModule.getBoardExpansionGodCornerDescriptorsForCard(gameState, getCardTargetAccessDeps());
    }

    function getBoardExpansionGodPendingSelectionsForCard(pending: any) {
        return CardTargetAccessModule.getBoardExpansionGodPendingSelectionsForCard(pending, getCardTargetAccessDeps());
    }

    function getBoardExpansionGodAdditionsForCard(row: any, col: any, gameState: any) {
        return CardTargetAccessModule.getBoardExpansionGodAdditionsForCard(row, col, gameState, getCardTargetAccessDeps());
    }

    function getBoardExpansionWillCellDescriptorsForCard(gameState: any) {
        return CardTargetAccessModule.getBoardExpansionWillCellDescriptorsForCard(gameState, getCardTargetAccessDeps());
    }

    function ensureExpansionCellForCard(gameState: any, row: any, col: any, owner: any) {
        return CardTargetAccessModule.ensureExpansionCellForCard(gameState, row, col, owner, getCardTargetAccessDeps());
    }

    function getBoardExpansionGodTargets(cardState: any, gameState: any, playerKey: any) {
        return CardTargetAccessModule.getBoardExpansionGodTargets(cardState, gameState, playerKey, getCardTargetAccessDeps());
    }

    function getBoardExpansionGodRequiredSelectionCount(cardState: any, gameState: any, playerKey: any) {
        return CardTargetAccessModule.getBoardExpansionGodRequiredSelectionCount(cardState, gameState, playerKey, getCardTargetAccessDeps());
    }

    function getBoardShrinkSelectionCount() {
        return CardTargetAccessModule.getBoardShrinkSelectionCount(getCardTargetAccessDeps());
    }

    function getBoardShrinkPendingSelectionsForCard(pending: any) {
        return CardTargetAccessModule.getBoardShrinkPendingSelectionsForCard(pending, getCardTargetAccessDeps());
    }

    function getBoardShrinkTargets(cardState: any, gameState: any, playerKey: any) {
        return CardTargetAccessModule.getBoardShrinkTargets(cardState, gameState, playerKey, getCardTargetAccessDeps());
    }

    function getBoardShrinkGodTargets(cardState: any, gameState: any, playerKey: any) {
        return CardTargetAccessModule.getBoardShrinkGodTargets(cardState, gameState, playerKey, getCardTargetAccessDeps());
    }

    function getCellTeleportDestinations(cardState: any, gameState: any) {
        return CardTargetAccessModule.getCellTeleportDestinations(cardState, gameState, getCardTargetAccessDeps());
    }

    function getCellTeleportTargets(cardState: any, gameState: any) {
        return CardTargetAccessModule.getCellTeleportTargets(cardState, gameState, getCardTargetAccessDeps());
    }

    function getBlockadeTargets(cardState: any, gameState: any, playerKey: any) {
        return CardTargetAccessModule.getBlockadeTargets(cardState, gameState, playerKey, getCardTargetAccessDeps());
    }

    function getMeteorTargets(cardState: any, gameState: any, playerKey: any) {
        return CardTargetAccessModule.getMeteorTargets(cardState, gameState, playerKey, getCardTargetAccessDeps());
    }

    function getFreezeTargets(cardState: any, gameState: any, playerKey: any) {
        return CardTargetAccessModule.getFreezeTargets(cardState, gameState, playerKey, getCardTargetAccessDeps());
    }

    function getSeedTargets(cardState: any, gameState: any, playerKey: any) {
        return CardTargetAccessModule.getSeedTargets(cardState, gameState, playerKey, getCardTargetAccessDeps());
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
            isTemptTargetableMarker,
            blocksTemptAt,
            getCellValueForCard,
            getSpecialMarkers,
            isAbsoluteProtectedCell,
            BoardOpsModule,
            setCellValueForCard,
            removeMarkersAt,
            emitPresentationEvent,
            clearCardPendingEffect,
            getMarkers,
            shouldTransferMarkerOwnership: isTemptTargetableMarker,
            MARKER_KINDS
        });
    }

    function transferCellMarkerOwnership(cardState: any, row: any, col: any, playerKey: any) {
        return CardOwnershipEffectsModule.transferCellMarkerOwnership(cardState, row, col, playerKey, { getMarkers });
    }

    function applyCaptureWill(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        return CardOwnershipEffectsModule.applyCaptureWill(cardState, gameState, playerKey, row, col, {
            readCardPendingEffect,
            isTrueSpecialStoneAt,
            getTrueSpecialStoneOwnerAt,
            isCaptureTargetableMarker,
            getCellValueForCard,
            getSpecialMarkers,
            isAbsoluteProtectedCell,
            getTrueSpecialStoneMarkerAt,
            BoardOpsModule,
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
            BoardOps: BoardOpsModule,
            spawnAndFlipBatch: CardSpawnAndFlipModule && typeof CardSpawnAndFlipModule.spawnAndFlipBatch === 'function'
                ? CardSpawnAndFlipModule.spawnAndFlipBatch
                : null,
            getCardContext,
            getFlipsWithContext: getFlipsWithContextLocal,
            clearBombAt,
            clearHyperactiveAtPositions,
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
            resolveCardBoardConfig,
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
            applyCellRemovalAt: BoardOpsModule && typeof BoardOpsModule.applyCellRemovalAt === 'function'
                ? BoardOpsModule.applyCellRemovalAt
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
            isAbsoluteProtectedCell
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
            applyCellRemovalAt: BoardOpsModule && typeof BoardOpsModule.applyCellRemovalAt === 'function'
                ? BoardOpsModule.applyCellRemovalAt
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
            isAbsoluteProtectedCell
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
            applyCellRemovalAt: BoardOpsModule && typeof BoardOpsModule.applyCellRemovalAt === 'function'
                ? BoardOpsModule.applyCellRemovalAt
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
        return requireCardEffectTargetCounts().getLossWillRemovableCount(cardState);
    }

    function applyLossWill(cardState: any, gameState: any, playerKey: any) {
        return requireCardLossEffect().applyLossWill(cardState, gameState, playerKey);
    }

    function getSalvationWillTargetCount(cardState: any, playerKey: any) {
        return requireCardEffectTargetCounts().getSalvationWillTargetCount(cardState, playerKey);
    }

    function getExecutionWillTargetCount(cardState: any, playerKey: any) {
        return requireCardEffectTargetCounts().getExecutionWillTargetCount(cardState, playerKey);
    }

    function applySalvationWill(cardState: any, gameState: any, playerKey: any, prng: any) {
        return requireCardSalvationEffect().applySalvationWill(cardState, gameState, playerKey, prng);
    }

    /**
     * Returns the controller key for a given turn owner if FATE_WILL is active.
     * @param {Object} cardState
     * @param {string} turnOwnerKey - 'black' or 'white'
     * @returns {string|null} controller key or null
     */
    function getFateWillControllerForTurnOwner(cardState: any, turnOwnerKey: any) {
        return requireCardFateEffect().getFateWillControllerForTurnOwner(cardState, turnOwnerKey);
    }

    /**
     * Resolve FATE_WILL usage: arm the controller override for the opponent's next turn.
     * If stacking (effect already active for opponent, or current turn is already controlled),
     * the card is consumed but has no additional control effect per spec.
     */
    function applyFateWill(cardState: any, playerKey: any) {
        return requireCardFateEffect().applyFateWill(cardState, playerKey);
    }

    function getStrongWindTargets(cardState: any, gameState: any) {
        return CardTargetAccessModule.getStrongWindTargets(cardState, gameState, getCardTargetAccessDeps());
    }

    function getSuperBuoyancyTargets(cardState: any, gameState: any) {
        return CardTargetAccessModule.getSuperBuoyancyTargets(cardState, gameState, getCardTargetAccessDeps());
    }

    function getBuoyancyTargets(cardState: any, gameState: any) {
        return CardTargetAccessModule.getBuoyancyTargets(cardState, gameState, getCardTargetAccessDeps());
    }

    function getSuperGravityTargets(cardState: any, gameState: any) {
        return CardTargetAccessModule.getSuperGravityTargets(cardState, gameState, getCardTargetAccessDeps());
    }

    function getSuperAttractionTargets(cardState: any, gameState: any, playerKey?: any, pending?: any) {
        return CardTargetAccessModule.getSuperAttractionTargets(cardState, gameState, playerKey, pending, getCardTargetAccessDeps());
    }

    function getSuperAttractionPathPreview(cardState: any, gameState: any, from: any, to: any) {
        return CardTargetAccessModule.getSuperAttractionPathPreview(cardState, gameState, from, to, getCardTargetAccessDeps());
    }

    function getGravityTargets(cardState: any, gameState: any) {
        return CardTargetAccessModule.getGravityTargets(cardState, gameState, getCardTargetAccessDeps());
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
            applyCellRemovalAt: BoardOpsModule && typeof BoardOpsModule.applyCellRemovalAt === 'function'
                ? BoardOpsModule.applyCellRemovalAt
                : null,
            runCellRemovalBlock: BoardOpsModule && typeof BoardOpsModule.runCellRemovalBlock === 'function'
                ? BoardOpsModule.runCellRemovalBlock
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

    function applySuperAttractionWill(cardState: any, gameState: any, playerKey: any, row: any, col: any, prng: any) {
        return CardMovementModule.applySuperAttractionWill(cardState, gameState, playerKey, row, col, prng, {
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
        return requireCardContextBuilders().getCardHandManagerContext();
    }

    function ownerKeyFromValue(value: any): PlayerKey | null {
        if (value === BLACK) return 'black';
        if (value === WHITE) return 'white';
        return null;
    }

    function normalizeFlipPositions(flips: any): Array<{ row: number; col: number }> {
        if (!Array.isArray(flips)) return [];
        return flips.map((entry: any) => {
            if (Array.isArray(entry)) return { row: entry[0], col: entry[1] };
            return { row: entry && entry.row, col: entry && entry.col };
        }).filter((entry: any) => Number.isInteger(entry.row) && Number.isInteger(entry.col));
    }

    function normalizeReverseWillCell(row: any, col: any) {
        const normalizedRow = Number(row);
        const normalizedCol = Number(col);
        if (!Number.isInteger(normalizedRow) || !Number.isInteger(normalizedCol)) return null;
        return { row: normalizedRow, col: normalizedCol };
    }

    function getReverseWillFlips(cardState: any, gameState: any, row: any, col: any) {
        const ownerValue = getCellValueForCard(gameState, row, col);
        const ownerKey = ownerKeyFromValue(ownerValue);
        if (!ownerKey) return { ownerKey: null, ownerValue, flips: [] };
        const getOccupiedOriginFlips = CardFlipsModule && typeof CardFlipsModule.getOccupiedOriginFlipsWithContext === 'function'
            ? CardFlipsModule.getOccupiedOriginFlipsWithContext
            : null;
        const rawFlips = getOccupiedOriginFlips
            ? getOccupiedOriginFlips(gameState, row, col, ownerValue, getCardContext(cardState))
            : [];
        return {
            ownerKey,
            ownerValue,
            flips: normalizeFlipPositions(rawFlips)
        };
    }

    function getReverseWillTargets(cardState: any, gameState: any) {
        if (TargetResolver && typeof TargetResolver.getReverseWillTargets === 'function') {
            const targets = TargetResolver.getReverseWillTargets(cardState, gameState);
            if (Array.isArray(targets)) return targets;
        }
        const targets: any[] = [];
        for (const cell of getOccupiedBoardShapeCellsForCard(cardState, gameState)) {
            if (!cell || !Number.isInteger(cell.row) || !Number.isInteger(cell.col)) continue;
            const res = getReverseWillFlips(cardState, gameState, cell.row, cell.col);
            if (!res.ownerKey || res.flips.length <= 0) continue;
            targets.push({
                row: cell.row,
                col: cell.col,
                owner: res.ownerKey,
                flipCount: res.flips.length,
                flips: res.flips
            });
        }
        return targets;
    }

    function hasUsableFlipEvadeMarkerAt(cardState: any, row: any, col: any) {
        const markers = cardState && Array.isArray(cardState.markers) ? cardState.markers : [];
        return markers.some((marker: any) => {
            if (!marker || marker.row !== row || marker.col !== col) return false;
            if (EvasionStatus && typeof EvasionStatus.canUseFlipEvade === 'function') {
                return EvasionStatus.canUseFlipEvade(marker) === true;
            }
            const typeUpper = String(marker.data && marker.data.type || '').trim().toUpperCase();
            if (!['HYPERACTIVE', 'ESCAPE_HYPERACTIVE', 'EXTREME_HYPERACTIVE', 'ULTIMATE_HYPERACTIVE', 'AFTERIMAGE_WILL', 'WILL_HUNTER_KING'].includes(typeUpper)) {
                return false;
            }
            const remaining = Number(marker.data && marker.data.flipEvadeRemaining);
            return !Number.isFinite(remaining) || remaining > 0;
        });
    }

    function getCurrentActionRandomSource(cardState: any) {
        if (cardState && cardState._boardOpsRandomSource && typeof cardState._boardOpsRandomSource.random === 'function') {
            return cardState._boardOpsRandomSource;
        }
        const currentMeta = cardState && cardState._currentActionMeta;
        if (currentMeta && currentMeta.randomSource && typeof currentMeta.randomSource.random === 'function') {
            return currentMeta.randomSource;
        }
        if (cardState && cardState._defaultRandomSource && typeof cardState._defaultRandomSource.random === 'function') {
            return cardState._defaultRandomSource;
        }
        return defaultPrng;
    }

    function applyReverseWill(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        const targetCell = normalizeReverseWillCell(row, col);
        const invalidTarget = targetCell || { row, col };
        if (!targetCell) {
            return { applied: false, reason: 'invalid_target', owner: null, target: invalidTarget, flipped: [], blocked: [], logicalFlipCount: 0, flipCount: 0 };
        }
        const matchingTarget = getReverseWillTargets(cardState, gameState).find((target: any) => (
            target &&
            target.row === targetCell.row &&
            target.col === targetCell.col &&
            Array.isArray(target.flips) &&
            target.flips.length > 0
        ));
        if (!matchingTarget) {
            return { applied: false, reason: 'invalid_target', owner: null, target: targetCell, flipped: [], blocked: [], logicalFlipCount: 0, flipCount: 0 };
        }
        const reverse = getReverseWillFlips(cardState, gameState, targetCell.row, targetCell.col);
        if (!reverse.ownerKey || reverse.flips.length <= 0) {
            return { applied: false, reason: 'no_flips', owner: reverse.ownerKey, target: targetCell, flipped: [], blocked: [], logicalFlipCount: 0, flipCount: 0 };
        }
        const appliedFlips: Array<{ row: number; col: number }> = [];
        const blockedFlips: Array<{ row: number; col: number; reason?: string }> = [];
        let blockedByGhost = false;
        let remainingFlips: Array<{ row: number; col: number }> = reverse.flips;
        if (reverse.flips.some((pos: any) => hasUsableFlipEvadeMarkerAt(cardState, pos.row, pos.col))) {
            const flipEvadeResult = resolveHyperactiveFlipEvasion(
                cardState,
                gameState,
                reverse.flips,
                reverse.ownerKey,
                getCurrentActionRandomSource(cardState)
            );
            if (flipEvadeResult && Array.isArray(flipEvadeResult.remainingFlips)) {
                remainingFlips = flipEvadeResult.remainingFlips.map((cell: any) => {
                    if (Array.isArray(cell) && Number.isInteger(cell[0]) && Number.isInteger(cell[1])) {
                        return { row: cell[0], col: cell[1] };
                    }
                    if (cell && Number.isInteger(cell.row) && Number.isInteger(cell.col)) {
                        return { row: cell.row, col: cell.col };
                    }
                    return null;
                }).filter((cell: any) => !!cell);
            }
        }
        for (const pos of remainingFlips) {
            let changed = true;
            if (BoardOpsModule && typeof BoardOpsModule.changeAt === 'function') {
                const changeRes = BoardOpsModule.changeAt(
                    cardState,
                    gameState,
                    pos.row,
                    pos.col,
                    reverse.ownerKey,
                    'REVERSE_WILL',
                    'reverse_will_flip',
                    { sourceRow: targetCell.row, sourceCol: targetCell.col, cardUser: playerKey }
                );
                changed = !!(changeRes && changeRes.changed);
                if (!changed) {
                    if (changeRes && changeRes.blockedByGhost === true) blockedByGhost = true;
                    blockedFlips.push({
                        row: pos.row,
                        col: pos.col,
                        reason: changeRes && changeRes.reason ? String(changeRes.reason) : 'unchanged'
                    });
                }
            } else {
                changed = setCellValueForCard(gameState, pos.row, pos.col, reverse.ownerValue);
                if (!changed) blockedFlips.push({ row: pos.row, col: pos.col, reason: 'unchanged' });
            }
            if (!changed) continue;
            clearBombAt(cardState, pos.row, pos.col);
            appliedFlips.push({ row: pos.row, col: pos.col });
        }
        if (appliedFlips.length > 0) {
            clearHyperactiveAtPositions(cardState, appliedFlips);
            addChargeWithTotal(cardState, reverse.ownerKey, appliedFlips.length, {
                popupKind: 'board',
                sourceType: 'reverse_will_flip_gain',
                anchorRow: targetCell.row,
                anchorCol: targetCell.col
            });
        }
        clearCardPendingEffect(cardState, playerKey);
        return {
            applied: true,
            owner: reverse.ownerKey,
            target: targetCell,
            flipped: appliedFlips,
            blocked: blockedFlips,
            blockedByGhost,
            logicalFlipCount: reverse.flips.length,
            flipCount: appliedFlips.length
        };
    }

    function getCardStateFactoryContext() {
        return requireCardContextBuilders().getCardStateFactoryContext();
    }

    function getCardEffectTimingContext() {
        return requireCardContextBuilders().getCardEffectTimingContext();
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
        ensureGeneratedSpawnFlipResolver(cardState);
        const opts = (options && typeof options === 'object') ? options : {};
        const timingContext = Object.assign({}, getCardEffectTimingContext(), opts);
        return CardTimingProcessorModule.onTurnStart(
            cardState,
            playerKey,
            gameState,
            prng,
            timingContext
        );
    }

    function onTurnStartBeforeAnchors(cardState: any, playerKey: any, gameState: any, prng: any, options?: any) {
        if (!CardTimingProcessorModule || typeof CardTimingProcessorModule.onTurnStartBeforeAnchors !== 'function') {
            throw new Error('[cards.js] CardTimingProcessor.onTurnStartBeforeAnchors not available');
        }
        ensureGeneratedSpawnFlipResolver(cardState);
        const opts = (options && typeof options === 'object') ? options : {};
        const timingContext = Object.assign({}, getCardEffectTimingContext(), opts);
        return CardTimingProcessorModule.onTurnStartBeforeAnchors(
            cardState,
            playerKey,
            gameState,
            prng,
            timingContext
        );
    }

    function drawForTurnStart(cardState: any, playerKey: any, prng: any, options?: any) {
        if (!CardTimingProcessorModule || typeof CardTimingProcessorModule.drawForTurnStart !== 'function') {
            throw new Error('[cards.js] CardTimingProcessor.drawForTurnStart not available');
        }
        const opts = (options && typeof options === 'object') ? options : {};
        const timingContext = Object.assign({}, getCardEffectTimingContext(), opts);
        return CardTimingProcessorModule.drawForTurnStart(
            cardState,
            playerKey,
            prng,
            timingContext
        );
    }

    function flushDeferredTurnStartStatusExpirations(cardState: any, gameState: any, options?: any) {
        if (!CardTimingProcessorModule || typeof CardTimingProcessorModule.flushDeferredTurnStartStatusExpirations !== 'function') {
            return [];
        }
        const opts = (options && typeof options === 'object') ? options : {};
        return CardTimingProcessorModule.flushDeferredTurnStartStatusExpirations(
            cardState,
            gameState,
            Object.assign({}, getCardEffectTimingContext(), opts)
        );
    }

    function processTurnStartStatusMarkerAnchor(cardState: any, gameState: any, playerKey: any, marker: any, options?: any) {
        if (!CardTimingProcessorModule || typeof CardTimingProcessorModule.processTurnStartStatusMarkerAnchor !== 'function') {
            return { processed: false, expired: [] };
        }
        const opts = (options && typeof options === 'object') ? options : {};
        return CardTimingProcessorModule.processTurnStartStatusMarkerAnchor(
            cardState,
            gameState,
            playerKey,
            marker,
            Object.assign({}, getCardEffectTimingContext(), opts)
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

        const source = cardState.chargeGainMultiplierByPlayer && typeof cardState.chargeGainMultiplierByPlayer === 'object'
            ? cardState.chargeGainMultiplierByPlayer
            : {};
        const rawMultiplier = meta && typeof meta === 'object' && meta.disableChargeGainMultiplier === true
            ? 1
            : Number(source[playerKey]);
        const multiplier = Number.isFinite(rawMultiplier) && rawMultiplier > 1 ? Math.floor(rawMultiplier) : 1;
        const requestedAmount = Number.isFinite(Number(amount)) && Number(amount) > 0
            ? Number(amount) * multiplier
            : Number(amount) || 0;
        const deltaRes = addChargeValue(cardState, playerKey, requestedAmount, 'placement_or_effect_gain', meta);
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
        ensureGeneratedSpawnFlipResolver(cardState);
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
            addCardToDiscard,
            isInviolableSpecialCardId
        });
    }

    function applyObserverWillChoice(cardState: any, gameState: any, playerKey: any, targetIndex: any) {
        return CardHandEffectsModule.applyObserverWillChoice(cardState, gameState, playerKey, targetIndex, {
            readCardPendingEffect,
            clearCardPendingEffect,
            removeHandCardAt,
            addCardToHand,
            setCardCostOverrideForCopyId,
            applyObserverWillObservedCostTax,
            clearObserverWillObservationCost,
            getCardCost,
            revealCurrentHandToViewer,
            isInviolableSpecialCardId
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
            resolveDeterministicRandomIndex,
            isInviolableSpecialCardId
        });
    }

    function getDirectionalChainFlips(gameState: any, row: any, col: any, ownerVal: any, dir: any, context: any) {
        return CardFlipsModule.getDirectionalChainFlips(gameState, row, col, ownerVal, dir, context);
    }

    function getTabooReverseCandidates(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        if (TargetResolver && typeof TargetResolver.getTabooReverseCandidates === 'function') {
            return TargetResolver.getTabooReverseCandidates(cardState, gameState, playerKey, row, col);
        }
        return [];
    }

    function pickTabooReverseFlips(cardState: any, gameState: any, playerKey: any, row: any, col: any, prng: any) {
        if (TargetResolver && typeof TargetResolver.pickTabooReverseFlips === 'function') {
            return TargetResolver.pickTabooReverseFlips(cardState, gameState, playerKey, row, col, prng, {
                getTabooReverseCandidates,
                resolveDeterministicRandomIndex
            });
        }
        return { applied: false, flips: [], direction: null, score: 0 };
    }


    function applyChainWillAfterMove(cardState: any, gameState: any, playerKey: any, primaryFlips: any, prng: any) {
        return CardChainModule.applyChainWillAfterMove(cardState, gameState, playerKey, primaryFlips, prng, {
            readCardPendingEffect,
            getChainWillConfig,
            blackValue: BLACK,
            whiteValue: WHITE,
            getCardContext,
            defaultPrng,
            resolveChainWillMaxLinks,
            findChainChoice: CardChainModule.findChainChoice,
            BoardOpsModule,
            eventCause: CHAIN_WILL_EVENT_CAUSE,
            clearBombAt,
            clearHyperactiveAtPositions
        });
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
            isManifestStoneAt,
            selectRandomEmptyBoardShapeDestination,
            moveCoexistingSpecialMarkers
        });
    }


    /**
     * Immediate placement-turn activation for UDG anchor.
     * Delegates to cards/udg.js module.
     */
    function processUltimateDestroyGodEffectsAtAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any, opts : any = {}, maybeOpts?: any) {
        const mergedOpts = mergeAnchorEffectOptions(opts, maybeOpts);
        const deps = normalizeAnchorEffectOptions(mergedOpts, [
            'decrementRemainingOwnerTurns',
            'destroyAt',
            'BoardOps',
            'isManifestStoneAt',
            'selectRandomEmptyBoardShapeDestination',
            'moveCoexistingSpecialMarkers'
        ], {
            destroyAt,
            BoardOps: BoardOpsModule,
            isManifestStoneAt,
            selectRandomEmptyBoardShapeDestination,
            moveCoexistingSpecialMarkers
        }, 'CardLogic.processUltimateDestroyGodEffectsAtAnchor');
        return runBoardOpsDestroyBlock(cardState, gameState, () =>
            CardUdgModule.processUltimateDestroyGodEffectsAtAnchor(cardState, gameState, playerKey, row, col, deps),
            { randomSource: deps.randomSource }
        );
    }

    function processUltimateDestroyGodEffectsAtTurnStartAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any, opts : any = {}, maybeOpts?: any) {
        const mergedOpts = mergeAnchorEffectOptions(opts, maybeOpts);
        const deps = normalizeAnchorEffectOptions(mergedOpts, [
            'decrementRemainingOwnerTurns',
            'destroyAt',
            'BoardOps',
            'isManifestStoneAt',
            'selectRandomEmptyBoardShapeDestination',
            'moveCoexistingSpecialMarkers'
        ], {
            destroyAt,
            BoardOps: BoardOpsModule,
            isManifestStoneAt,
            selectRandomEmptyBoardShapeDestination,
            moveCoexistingSpecialMarkers
        }, 'CardLogic.processUltimateDestroyGodEffectsAtTurnStartAnchor');
        return runBoardOpsDestroyBlock(cardState, gameState, () =>
            CardUdgModule.processUltimateDestroyGodEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, deps),
            { randomSource: deps.randomSource }
        );
    }

    function processSniperWillEffects(cardState: any, gameState: any, playerKey: any, prng: any) {
        return CardSniperModule.processSniperWillEffects(cardState, gameState, playerKey, {
            destroyAt,
            BoardOps: BoardOpsModule,
            random: prng || defaultPrng
        });
    }

    function hasTurnStartRandomOptionOverrides(prngOrOpts: any, extraKeys: string[]) {
        if (!prngOrOpts || typeof prngOrOpts !== 'object' || !Array.isArray(extraKeys)) {
            return false;
        }
        return extraKeys.some((key) => Object.prototype.hasOwnProperty.call(prngOrOpts, key));
    }

    function normalizeAnchorEffectOptions(prngOrOpts: any, extraKeys: string[], defaults: any, label: string) {
        const optionKeys = Array.isArray(extraKeys)
            ? extraKeys.concat(['random', 'randomSource'])
            : ['random', 'randomSource'];
        const hasOptionShape = hasTurnStartRandomOptionOverrides(prngOrOpts, optionKeys);
        const sourceOptions = hasOptionShape ? (prngOrOpts || {}) : {};
        const defaultOptions = defaults || {};
        const hasRandomSource = Object.prototype.hasOwnProperty.call(sourceOptions, 'randomSource');
        const hasRandom = Object.prototype.hasOwnProperty.call(sourceOptions, 'random');
        const hasDirectRandomArgument = !hasOptionShape && (
            (prngOrOpts && typeof prngOrOpts.random === 'function') ||
            typeof prngOrOpts === 'function'
        );
        const hasExplicitRandom = hasRandomSource || hasRandom || hasDirectRandomArgument;
        const randomCandidate = hasRandomSource
            ? sourceOptions.randomSource
            : (hasRandom ? sourceOptions.random : prngOrOpts);
        const fallbackCandidate = (hasRandom ? sourceOptions.random : null)
            || (hasRandomSource ? sourceOptions.randomSource : null)
            || defaultOptions.random
            || defaultOptions.randomSource
            || defaultPrng;
        const randomSource = resolveDeterministicRandomSource(
            randomCandidate,
            fallbackCandidate,
            label
        );
        return Object.assign({}, defaultOptions, sourceOptions, {
            random: randomSource,
            randomSource: hasExplicitRandom ? randomSource : sourceOptions.randomSource
        });
    }

    function mergeAnchorEffectOptions(prngOrOpts: any, maybeOpts: any) {
        if (maybeOpts === undefined) return prngOrOpts;
        const optionOverrides = (maybeOpts && typeof maybeOpts === 'object') ? maybeOpts : {};
        const isRandomLike = (
            (prngOrOpts && typeof prngOrOpts.random === 'function') ||
            typeof prngOrOpts === 'function'
        );
        if (isRandomLike) {
            const merged = Object.assign({}, optionOverrides);
            if (!Object.prototype.hasOwnProperty.call(merged, 'random')) {
                merged.random = prngOrOpts;
            }
            if (!Object.prototype.hasOwnProperty.call(merged, 'randomSource')) {
                merged.randomSource = prngOrOpts;
            }
            return merged;
        }
        if (prngOrOpts && typeof prngOrOpts === 'object') {
            return Object.assign({}, prngOrOpts, optionOverrides);
        }
        return optionOverrides;
    }

    function processSniperWillEffectsAtTurnStartAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any, prngOrOpts: any) {
        const deps = normalizeAnchorEffectOptions(prngOrOpts, [
            'decrementRemainingOwnerTurns',
            'destroyAt',
            'BoardOps'
        ], {
            destroyAt,
            BoardOps: BoardOpsModule,
            random: defaultPrng
        }, 'CardLogic.processSniperWillEffectsAtTurnStartAnchor');

        return runBoardOpsDestroyBlock(cardState, gameState, () =>
            CardSniperModule.processSniperWillEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, deps),
            { randomSource: deps.randomSource }
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
        const deps = normalizeAnchorEffectOptions(prngOrOpts, [
            'decrementRemainingOwnerTurns',
            'destroyAt',
            'BoardOps'
        ], {
            destroyAt,
            BoardOps: BoardOpsModule,
            random: defaultPrng
        }, 'CardLogic.processLightningWillEffectsAtAnchor');

        return runBoardOpsDestroyBlock(cardState, gameState, () =>
            CardLightningModule.processLightningWillEffectsAtAnchor(cardState, gameState, playerKey, row, col, deps),
            { randomSource: deps.randomSource }
        );
    }

    function processLightningWillEffectsAtTurnStartAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any, prngOrOpts: any) {
        return processLightningWillEffectsAtAnchor(cardState, gameState, playerKey, row, col, prngOrOpts);
    }

    function processMeteorGodEffects(cardState: any, gameState: any, playerKey: any, prng: any) {
        return CardMeteorGodModule.processMeteorGodEffects(cardState, gameState, playerKey, {
            BoardOps: BoardOpsModule,
            applyCellRemovalAt: BoardOpsModule && typeof BoardOpsModule.applyCellRemovalAt === 'function'
                ? BoardOpsModule.applyCellRemovalAt
                : null,
            runCellRemovalBlock: BoardOpsModule && typeof BoardOpsModule.runCellRemovalBlock === 'function'
                ? BoardOpsModule.runCellRemovalBlock
                : null,
            random: prng || defaultPrng
        });
    }

    function processMeteorGodEffectsAtAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any, prngOrOpts: any) {
        const deps = normalizeAnchorEffectOptions(prngOrOpts, [
            'decrementRemainingOwnerTurns',
            'BoardOps',
            'applyCellRemovalAt',
            'runCellRemovalBlock'
        ], {
            BoardOps: BoardOpsModule,
            applyCellRemovalAt: BoardOpsModule && typeof BoardOpsModule.applyCellRemovalAt === 'function'
                ? BoardOpsModule.applyCellRemovalAt
                : null,
            runCellRemovalBlock: BoardOpsModule && typeof BoardOpsModule.runCellRemovalBlock === 'function'
                ? BoardOpsModule.runCellRemovalBlock
                : null,
            random: defaultPrng
        }, 'CardLogic.processMeteorGodEffectsAtAnchor');

        return CardMeteorGodModule.processMeteorGodEffectsAtAnchor(cardState, gameState, playerKey, row, col, deps);
    }

    function processMeteorGodEffectsAtTurnStartAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any, prngOrOpts: any) {
        return processMeteorGodEffectsAtAnchor(cardState, gameState, playerKey, row, col, prngOrOpts);
    }

    function processWillHunterKingEffectsAtTurnStartAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any, prngOrOpts: any) {
        const deps = normalizeAnchorEffectOptions(prngOrOpts, [
            'decrementRemainingOwnerTurns',
            'BoardOps'
        ], {
            BoardOps: BoardOpsModule,
            random: defaultPrng,
            decrementRemainingOwnerTurns: true
        }, 'CardLogic.processWillHunterKingEffectsAtTurnStartAnchor');

        if (BoardOpsModule && typeof BoardOpsModule.runEffectBlock === 'function') {
            return CardWillHunterKingModule.processWillHunterKingEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, deps);
        }
        return runBoardOpsDestroyBlock(cardState, gameState, () =>
            CardWillHunterKingModule.processWillHunterKingEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, deps),
            { randomSource: deps.randomSource }
        );
    }

    function processDestroyDragonEffects(cardState: any, gameState: any, playerKey: any, prng: any) {
        return CardDestroyDragonModule.processDestroyDragonEffects(cardState, gameState, playerKey, {
            destroyAt,
            BoardOps: BoardOpsModule,
            random: prng || defaultPrng
        });
    }

    function processDestroyDragonEffectsAtAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any, opts : any = {}) {
        const deps = normalizeAnchorEffectOptions(opts, [
            'decrementRemainingOwnerTurns',
            'destroyAt',
            'BoardOps'
        ], {
            destroyAt,
            BoardOps: BoardOpsModule,
            random: defaultPrng
        }, 'CardLogic.processDestroyDragonEffectsAtAnchor');
        return runBoardOpsDestroyBlock(cardState, gameState, () =>
            CardDestroyDragonModule.processDestroyDragonEffectsAtAnchor(cardState, gameState, playerKey, row, col, deps),
            { randomSource: deps.randomSource }
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
            if (!m.data || (m.data.type !== 'HYPERACTIVE' && m.data.type !== 'ESCAPE_HYPERACTIVE' && m.data.type !== 'EXTREME_HYPERACTIVE' && m.data.type !== 'ROBOT_VACUUM' && m.data.type !== 'GLUTTONOUS' && m.data.type !== 'ULTIMATE_HYPERACTIVE' && m.data.type !== 'SNIPER' && m.data.type !== 'AFTERIMAGE_WILL' && m.data.type !== 'WILL_HUNTER_KING')) return true;
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
        const randomSource = resolveDeterministicRandomSource(prng, defaultPrng, 'CardLogic.processHyperactiveMoveAtAnchor');
        const deps = {
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
            randomSource,
            currentTurnPlayerKey: options.currentTurnPlayerKey || playerKey,
            expectedSpecialType: options.expectedSpecialType || null
        };
        return runBoardOpsDestroyBlock(cardState, gameState, () =>
            CardHyperactiveModule.processHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, deps),
            { randomSource }
        );
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
            isManifestStoneAt,
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
            isManifestStoneAt,
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
        const randomSource = resolveDeterministicRandomSource(prng, defaultPrng, 'CardLogic.processInstantHyperactiveMoveAtAnchor');
        const deps = {
            defaultPrng: defaultPrng,
            getFlipsWithContext: getFlipsWithContextLocal,
            clearBombAt,
            clearHyperactiveAtPositions,
            isBlockedCell,
            getCardContext,
            BoardOps: BoardOpsModule,
            randomSource,
            destroyAt
        };
        return runBoardOpsDestroyBlock(cardState, gameState, () =>
            CardHyperactiveModule.processInstantHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, deps),
            { randomSource }
        );
    }

    function processUltimateHyperactiveMoveAtAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any, prng: any, options : any = {}) {
        const randomSource = resolveDeterministicRandomSource(prng, defaultPrng, 'CardLogic.processUltimateHyperactiveMoveAtAnchor');
        const deps = {
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
            randomSource,
            destroyAt
        };
        return runBoardOpsDestroyBlock(cardState, gameState, () =>
            CardHyperactiveModule.processUltimateHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, deps),
            { randomSource }
        );
    }


    function processBreedingEffects(cardState: any, gameState: any, playerKey: any, prng: any) {
        return CardBreedingModule.processBreedingEffects(cardState, gameState, playerKey, prng, {
            defaultPrng: defaultPrng,
            getCardContext,
            getFlipsWithContext: getFlipsWithContextLocal,
            clearBombAt,
            clearHyperactiveAtPositions,
            isBlockedCell,
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
            isBlockedCell,
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
            isBlockedCell,
            BoardOps: BoardOpsModule,
            destroyAt
        });
    }


    /**
     * Apply DESTROY_ONE_STONE
     * Delegates to effects/destroy_one_stone.js module.
    */
    function applyDestroyEffectDetailed(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        ensureGeneratedSpawnFlipResolver(cardState);
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
            getManifestMarkers,
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
        return CardTargetAccessModule.getSelectableTargets(cardState, gameState, playerKey, getCardTargetAccessDeps());
    }

    
const cardsApi: any = {
        // Constants
        INITIAL_HAND_SIZE,
        TIME_BOMB_TURNS,
        ULTIMATE_DRAGON_TURNS,
        ULTIMATE_DESTROY_GOD_TURNS,
        ULTIMATE_HYPERACTIVE_TURNS,
        STONE_SALVATION_GOD_TURNS,
        SNIPER_WILL_TURNS,
        DESTROY_DRAGON_TURNS,
        LIGHTNING_WILL_TURNS,
        METEOR_GOD_TURNS,
        GHOST_WILL_TURNS,
        STRONG_WILL_PROMOTION_OWNER_TURNS,
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
        getManifestMarkers,
        getActiveManifestMarkers,
        isManifestStoneMarker,
        isManifestStoneAt,
        applyObserverWillStoneReservation,
        applyTheoryIncarnationStoneReservation,
        applyBoardExecutorStoneReservation,
        processTheoryIncarnationMarkerAtPlacement,
        processTheoryIncarnationMarkerAtTurnStart,
        processTheoryIncarnationMarkerAfterOwnerPlacement,
        processTheoryIncarnationOwnerPass,
        addNumberCellCollectedTotal,
        canUseTheoryIncarnation,
        canUseBoardExecutor,
        processBoardExecutorMarkerAtTurnStart,
        processBoardExecutorHandTaxAtTurnStart,
        processObserverWillMarkerAtTurnStart,
        processObserverWillRepaymentsAtTurnStart,
        hasActiveObserverWillReveal,

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
        setCardCostOverrideForCopyId,
        addCardCostModifierForCopyId,
        getEffectiveCardCostForCopy,
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
        processMeteorGodEffects,

        // Game flow
        onTurnStart,
        onTurnStartBeforeAnchors,
        drawForTurnStart,
        flushDeferredTurnStartStatusExpirations,
        processTurnStartStatusMarkerAnchor,
        consumeStoneSalvationGodRevives,
        consumeGeneratedSpawnFlipResults,
        spawnAndFlipPlacement,
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
        applyObserverWillChoice,
        applyTemptWill,
        applyCaptureWill,
        applyExtendLifeWill,
        applyExtendLifeGod,
        applyCorrosionWill,
        applyGuardWill,
        applyLivingWill,
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
        getEqualityWillChargeState,
        getReinforcementWillTargets,
        getSupportTroopsWillTargets,
        getReinforcementWillTargetCount,
        getSupportTroopsWillTargetCount,
        canUseReinforcementWillForPlayer,
        canUseSupportTroopsWillForPlayer,
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
        resolveSupportTroopsWillUsage,
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
        processMeteorGodEffectsAtTurnStartAnchor,
        processMeteorGodEffectsAtAnchor,
        processWillHunterKingEffectsAtTurnStartAnchor,
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
        getSuperAttractionPathPreview,
        getTabooReverseCandidates,
        pickTabooReverseFlips,
        getReverseWillTargets,
        applyReverseWill,
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
        getLastResortTargets,
        getCurrentCornerCellsForCard,
        countOccupiedCornersForPlayer,
        isBlockedCell,
        findManifestMarkerAt,
        isAbsoluteProtectedCell,
        isCardPlayLockedForPlayer,
        isPlacementLockedForPlayer,
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
