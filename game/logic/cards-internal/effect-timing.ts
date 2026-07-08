/**
 * @file effect-timing.ts
 * @description Turn-start and placement-effect orchestration shared between Browser and Headless.
 */

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

function getRuntimeGlobalValue(key: string): any {
    if (typeof globalThis !== 'undefined' && (globalThis as any)[key]) {
        return (globalThis as any)[key];
    }
    if (typeof self !== 'undefined' && (self as any)[key]) {
        return (self as any)[key];
    }
    return null;
}

const EvasionStatus = safeRequire('../../../shared/evasion-status') || getRuntimeGlobalValue('EvasionStatus');
const SpecialStoneMarkerFactory = safeRequire('../card-resolution/special-stone-marker-factory');
const SpecialStoneRegistry = safeRequire('../../../shared/special-stone-registry') || getRuntimeGlobalValue('SpecialStoneRegistry');

interface Context {
    constants?: any;
    helpers?: any;
    modules?: any;
    defaultPrng?: any;
}

interface Constants {
    BLACK: number;
    WHITE: number;
    EMPTY: number;
    DRAW_INTERVAL: number;
    FLIP_CHARGE_MULTIPLIER_EFFECTS: Record<string, any>;
    NUMBER_CELL_CHARGE_MULTIPLIER_EFFECTS: Record<string, any>;
    ULTIMATE_DRAGON_TURNS: any;
    ULTIMATE_DESTROY_GOD_TURNS: any;
    ULTIMATE_HYPERACTIVE_TURNS: any;
    STONE_SALVATION_GOD_TURNS: any;
    EXTREME_HYPERACTIVE_FLIP_EVADE_LIMIT: number;
    EXTREME_HYPERACTIVE_DESTROY_EVADE_LIMIT: number;
    ULTIMATE_HYPERACTIVE_FLIP_EVADE_LIMIT: number;
    ULTIMATE_HYPERACTIVE_DESTROY_EVADE_LIMIT: number;
    AFTERIMAGE_WILL_FLIP_EVADE_LIMIT: number;
    AFTERIMAGE_WILL_DESTROY_EVADE_LIMIT: number;
    SNIPER_WILL_TURNS: any;
    DESTROY_DRAGON_TURNS: any;
    LIGHTNING_WILL_TURNS: any;
    METEOR_GOD_TURNS: any;
    GHOST_WILL_TURNS: any;
    SACRIFICE_WILL_TURNS: any;
    PROLIFERATION_WILL_TURNS: any;
    SEED_WILL_TURNS: number;
    WILL_HUNTER_KING_TURNS: any;
    ROBOT_VACUUM_TURNS: any;
    TIME_STOP_GOD_TURNS: number;
    TIME_STOP_DEITY_TURNS: number;
    DOUBLE_PLACE_EXTRA: any;
    THROW_CHAIN_CONFIG_BY_TYPE: Record<string, any>;
    MARKER_KINDS: any;
}

interface PlacementEffects {
    chargeGained: number;
    freePlacementUsed?: boolean;
    [key: string]: any;
}

interface TurnStartSummary {
    ribo: {
        entries: any[];
        totalRepaid: number;
        totalDestroyed: number;
        completedCount: number;
    };
    observerWill: {
        entries: any[];
        totalRepaid: number;
        totalDestroyed: number;
        completedCount: number;
    };
    boardExecutor?: {
        applied: boolean;
        player?: string;
        lost: number;
        handCount: number;
    };
    generatedSpawnFlipResults?: any[];
}

function getFlipEvadeDefault(type: string, fallback: number, mode: 'runtime' | 'info' | 'visual' = 'runtime'): number {
    if (EvasionStatus && typeof EvasionStatus.getFlipEvadeDefault === 'function') {
        const value = EvasionStatus.getFlipEvadeDefault(type, { mode });
        if (Number.isFinite(Number(value))) {
            return Number(value);
        }
    }
    return fallback;
}

function getDestroyEvadeDefault(type: string, fallback: number, mode: 'runtime' | 'info' | 'visual' = 'runtime'): number {
    if (EvasionStatus && typeof EvasionStatus.getDestroyEvadeDefault === 'function') {
        const value = EvasionStatus.getDestroyEvadeDefault(type, { mode });
        if (Number.isFinite(Number(value))) {
            return Number(value);
        }
    }
    return fallback;
}

function getConstants(context: Context): Constants {
    const constants = (context && context.constants) || {};
    return {
        BLACK: Number.isFinite(Number(constants.BLACK)) ? Number(constants.BLACK) : 1,
        WHITE: Number.isFinite(Number(constants.WHITE)) ? Number(constants.WHITE) : -1,
        EMPTY: Number.isFinite(Number(constants.EMPTY)) ? Number(constants.EMPTY) : 0,
        DRAW_INTERVAL: Number.isFinite(Number(constants.DRAW_INTERVAL)) ? Number(constants.DRAW_INTERVAL) : 1,
        FLIP_CHARGE_MULTIPLIER_EFFECTS: constants.FLIP_CHARGE_MULTIPLIER_EFFECTS || {},
        NUMBER_CELL_CHARGE_MULTIPLIER_EFFECTS: constants.NUMBER_CELL_CHARGE_MULTIPLIER_EFFECTS || {},
        ULTIMATE_DRAGON_TURNS: constants.ULTIMATE_DRAGON_TURNS,
        ULTIMATE_DESTROY_GOD_TURNS: constants.ULTIMATE_DESTROY_GOD_TURNS,
        ULTIMATE_HYPERACTIVE_TURNS: constants.ULTIMATE_HYPERACTIVE_TURNS,
        STONE_SALVATION_GOD_TURNS: constants.STONE_SALVATION_GOD_TURNS,
        EXTREME_HYPERACTIVE_FLIP_EVADE_LIMIT: Number.isFinite(Number(constants.EXTREME_HYPERACTIVE_FLIP_EVADE_LIMIT))
            ? Number(constants.EXTREME_HYPERACTIVE_FLIP_EVADE_LIMIT)
            : 5,
        EXTREME_HYPERACTIVE_DESTROY_EVADE_LIMIT: Number.isFinite(Number(constants.EXTREME_HYPERACTIVE_DESTROY_EVADE_LIMIT))
            ? Number(constants.EXTREME_HYPERACTIVE_DESTROY_EVADE_LIMIT)
            : 5,
        ULTIMATE_HYPERACTIVE_FLIP_EVADE_LIMIT: Number.isFinite(Number(constants.ULTIMATE_HYPERACTIVE_FLIP_EVADE_LIMIT))
            ? Number(constants.ULTIMATE_HYPERACTIVE_FLIP_EVADE_LIMIT)
            : 5,
        ULTIMATE_HYPERACTIVE_DESTROY_EVADE_LIMIT: Number.isFinite(Number(constants.ULTIMATE_HYPERACTIVE_DESTROY_EVADE_LIMIT))
            ? Number(constants.ULTIMATE_HYPERACTIVE_DESTROY_EVADE_LIMIT)
            : 2,
        AFTERIMAGE_WILL_FLIP_EVADE_LIMIT: Number.isFinite(Number(constants.AFTERIMAGE_WILL_FLIP_EVADE_LIMIT))
            ? Number(constants.AFTERIMAGE_WILL_FLIP_EVADE_LIMIT)
            : 3,
        AFTERIMAGE_WILL_DESTROY_EVADE_LIMIT: Number.isFinite(Number(constants.AFTERIMAGE_WILL_DESTROY_EVADE_LIMIT))
            ? Number(constants.AFTERIMAGE_WILL_DESTROY_EVADE_LIMIT)
            : 3,
        SNIPER_WILL_TURNS: constants.SNIPER_WILL_TURNS,
        DESTROY_DRAGON_TURNS: constants.DESTROY_DRAGON_TURNS,
        LIGHTNING_WILL_TURNS: constants.LIGHTNING_WILL_TURNS,
        METEOR_GOD_TURNS: constants.METEOR_GOD_TURNS,
        GHOST_WILL_TURNS: constants.GHOST_WILL_TURNS,
        SACRIFICE_WILL_TURNS: constants.SACRIFICE_WILL_TURNS,
        PROLIFERATION_WILL_TURNS: constants.PROLIFERATION_WILL_TURNS,
        SEED_WILL_TURNS: Number.isFinite(Number(constants.SEED_WILL_TURNS))
            ? Number(constants.SEED_WILL_TURNS)
            : 5,
        WILL_HUNTER_KING_TURNS: constants.WILL_HUNTER_KING_TURNS,
        ROBOT_VACUUM_TURNS: constants.ROBOT_VACUUM_TURNS,
        TIME_STOP_GOD_TURNS: Number.isFinite(Number(constants.TIME_STOP_GOD_TURNS))
            ? Number(constants.TIME_STOP_GOD_TURNS)
            : 3,
        TIME_STOP_DEITY_TURNS: Number.isFinite(Number(constants.TIME_STOP_DEITY_TURNS))
            ? Number(constants.TIME_STOP_DEITY_TURNS)
            : 5,
        DOUBLE_PLACE_EXTRA: constants.DOUBLE_PLACE_EXTRA,
        THROW_CHAIN_CONFIG_BY_TYPE: constants.THROW_CHAIN_CONFIG_BY_TYPE || {},
        MARKER_KINDS: constants.MARKER_KINDS || null
    };
}

function getThrowChainConfig(constants: Constants, type: string): any {
    const key = String(type || '');
    return key ? (constants.THROW_CHAIN_CONFIG_BY_TYPE[key] || null) : null;
}

function getHelpers(context: Context): any {
    return (context && context.helpers) || {};
}

function getBoardOps(context: Context): any {
    return context && context.modules ? context.modules.BoardOpsModule : null;
}

function getModules(context: Context): any {
    return (context && context.modules && typeof context.modules === 'object')
        ? context.modules
        : {};
}

function getWorkModule(context: Context): any {
    const modules = getModules(context);
    return modules.CardWorkModule || modules.WorkModule || null;
}

function getProtectedNextStoneModule(context: Context): any {
    const modules = getModules(context);
    return modules.ProtectedNextStoneModule || null;
}

function getPermaProtectNextStoneModule(context: Context): any {
    const modules = getModules(context);
    return modules.PermaProtectNextStoneModule || null;
}

function getLivingWillModule(context: Context): any {
    const modules = getModules(context);
    return modules.CardLivingWillModule || modules.LivingWillModule || null;
}

function getSpawnAndFlipModule(context: Context): any {
    const modules = getModules(context);
    return modules.CardSpawnAndFlipModule || modules.SpawnAndFlipModule || null;
}

function getLivingWillRestoreDeps(context: Context, constants: Constants): any {
    const helpers = getHelpers(context);
    return {
        BoardOps: getBoardOps(context),
        getCardContext: helpers.getCardContext,
        getOccupiedOriginFlipsWithContext: helpers.getOccupiedOriginFlipsWithContext,
        clearBombAt: helpers.clearBombAt,
        clearHyperactiveAtPositions: helpers.clearHyperactiveAtPositions,
        addChargeWithTotal: helpers.addChargeWithTotal,
        random: context && context.defaultPrng,
        defaults: {
            regenReviveLimit: 3,
            breedingTurns: 5,
            proliferationTurns: Number.isFinite(Number(constants && constants.PROLIFERATION_WILL_TURNS))
                ? Number(constants.PROLIFERATION_WILL_TURNS)
                : 10,
            ultimateDragonTurns: constants && constants.ULTIMATE_DRAGON_TURNS,
            ultimateDestroyGodTurns: constants && constants.ULTIMATE_DESTROY_GOD_TURNS,
            sniperTurns: constants && constants.SNIPER_WILL_TURNS,
            ghostTurns: constants && constants.GHOST_WILL_TURNS,
            afterimageFlipEvadeLimit: getFlipEvadeDefault('AFTERIMAGE_WILL', constants && constants.AFTERIMAGE_WILL_FLIP_EVADE_LIMIT),
            afterimageDestroyEvadeLimit: getDestroyEvadeDefault('AFTERIMAGE_WILL', constants && constants.AFTERIMAGE_WILL_DESTROY_EVADE_LIMIT),
            timeStopTurns: constants && constants.TIME_STOP_GOD_TURNS,
            willHunterKingTurns: constants && constants.WILL_HUNTER_KING_TURNS,
            destroyDragonTurns: constants && constants.DESTROY_DRAGON_TURNS,
            lightningTurns: constants && constants.LIGHTNING_WILL_TURNS,
            meteorGodTurns: constants && constants.METEOR_GOD_TURNS,
            extremeHyperactiveFlipEvadeLimit: getFlipEvadeDefault('EXTREME_HYPERACTIVE', constants && constants.EXTREME_HYPERACTIVE_FLIP_EVADE_LIMIT),
            extremeHyperactiveDestroyEvadeLimit: getDestroyEvadeDefault('EXTREME_HYPERACTIVE', constants && constants.EXTREME_HYPERACTIVE_DESTROY_EVADE_LIMIT),
            robotVacuumTurns: constants && constants.ROBOT_VACUUM_TURNS,
            ultimateHyperactiveTurns: constants && constants.ULTIMATE_HYPERACTIVE_TURNS,
            ultimateHyperactiveFlipEvadeLimit: getFlipEvadeDefault('ULTIMATE_HYPERACTIVE', constants && constants.ULTIMATE_HYPERACTIVE_FLIP_EVADE_LIMIT),
            ultimateHyperactiveDestroyEvadeLimit: getDestroyEvadeDefault('ULTIMATE_HYPERACTIVE', constants && constants.ULTIMATE_HYPERACTIVE_DESTROY_EVADE_LIMIT),
            guardTurns: 3,
            guardianGodTurns: 10,
            workTurns: 5
        }
    };
}

function getTrackedLivingWillMarker(cardState: any, row: number, col: number, specialType: string, context: Context): any {
    const livingWillModule = getLivingWillModule(context);
    if (!livingWillModule ||
        typeof livingWillModule.findLivingWillMarkerAt !== 'function' ||
        typeof livingWillModule.shouldTriggerForSpecialLoss !== 'function') {
        return null;
    }
    const livingWillMarker = livingWillModule.findLivingWillMarkerAt(cardState, row, col);
    if (!livingWillMarker) return null;
    return livingWillModule.shouldTriggerForSpecialLoss(livingWillMarker, specialType)
        ? livingWillMarker
        : null;
}

function restoreTrackedLivingWill(cardState: any, gameState: any, livingWillMarker: any, row: number, col: number, specialType: string, cause: string | null, reason: string | null, context: Context, constants: Constants): any {
    const livingWillModule = getLivingWillModule(context);
    if (!livingWillMarker || !livingWillModule || typeof livingWillModule.restoreFromLivingWillSnapshot !== 'function') {
        return null;
    }
    return livingWillModule.restoreFromLivingWillSnapshot(
        cardState,
        gameState,
        livingWillMarker,
        {
            triggerKind: 'special_loss',
            sourceRow: row,
            sourceCol: col,
            cause: cause || null,
            reason: reason || null,
            removedSpecialType: specialType || null
        },
        getLivingWillRestoreDeps(context, constants)
    );
}

function applyProtectedNextStoneEffect(cardState: any, playerKey: string, row: number, col: number, moduleApi: any): { applied: boolean } {
    if (!moduleApi || typeof moduleApi.applyProtectedNextStone !== 'function') {
        return { applied: false };
    }
    return moduleApi.applyProtectedNextStone(cardState, playerKey, row, col) || { applied: false };
}

function applyPermaProtectNextStoneEffect(cardState: any, playerKey: string, row: number, col: number, moduleApi: any): { applied: boolean } {
    if (!moduleApi || typeof moduleApi.applyPermaProtectNextStone !== 'function') {
        return { applied: false };
    }
    return moduleApi.applyPermaProtectNextStone(cardState, playerKey, row, col) || { applied: false };
}

function applyArmedWorkPlacement(cardState: any, gameState: any, playerKey: string, row: number, col: number, context: Context): { applied: boolean; consumed: boolean; result?: any; error?: any } {
    const helpers = getHelpers(context);
    const workMod = getWorkModule(context);
    if (!workMod || typeof workMod.placeWorkStone !== 'function') {
        if (typeof helpers.workDebugLog === 'function') {
            helpers.workDebugLog(cardState, '[WORK_DEBUG] workMod.placeWorkStone not available, workMod:', !!workMod);
        }
        return { applied: false, consumed: false };
    }

    try {
        if (typeof helpers.workDebugLog === 'function') {
            helpers.workDebugLog(cardState, '[WORK_DEBUG] Calling placeWorkStone for', playerKey, row, col);
        }
        const result = workMod.placeWorkStone(cardState, gameState, playerKey, row, col, {
            addMarker: helpers.addMarker
        });
        const applied = !!(result && result.placed === true);
        if (!applied) {
            if (typeof helpers.workDebugLog === 'function') {
                helpers.workDebugLog(cardState, '[WORK_DEBUG] placeWorkStone returned not placed for', playerKey, row, col);
            }
            return { applied: false, consumed: false, result };
        }
        try {
            if (cardState && typeof cardState === 'object') {
                cardState._lastWorkPlaced = { playerKey, row, col };
            }
        } catch (e) { /* ignore */ }
        return { applied: true, consumed: true, result };
    } catch (e) {
        if (typeof helpers.workDebugError === 'function') {
            helpers.workDebugError(cardState, '[WORK_DEBUG] placeWorkStone threw', e && (e as any).message ? (e as any).message : e);
        }
        return { applied: false, consumed: false, error: e };
    }
}

function getSpecialStoneKind(constants: Constants): string {
    return constants.MARKER_KINDS ? constants.MARKER_KINDS.SPECIAL_STONE : 'specialStone';
}

function getProliferationOwnerTurns(constants: Constants): number {
    const raw = Number(constants && constants.PROLIFERATION_WILL_TURNS);
    return Number.isFinite(raw) ? Math.max(1, Math.trunc(raw)) : 10;
}

function normalizeMarkerOwnerKey(owner: any): string {
    return owner === 'white' || owner === -1 ? 'white' : 'black';
}

function canSeedOccupyCell(cardState: any, gameState: any, helpers: any, row: number, col: number): boolean {
    if (typeof helpers.hasBoardShapeCellForCard === 'function') {
        return !!helpers.hasBoardShapeCellForCard(cardState, gameState, row, col);
    }
    return true;
}

function getSeedCellValue(helpers: any, gameState: any, row: number, col: number): number | null {
    if (typeof helpers.getCellValueForCard === 'function') {
        return helpers.getCellValueForCard(gameState, row, col);
    }
    if (!gameState || !Array.isArray(gameState.board) || !Array.isArray(gameState.board[row])) return null;
    return gameState.board[row][col];
}

function clearSeedMarker(cardState: any, helpers: any, specialStoneKind: string, marker: any): void {
    if (typeof helpers.removeMarkersAt !== 'function' || !marker) return;
    helpers.removeMarkersAt(cardState, marker.row, marker.col, {
        kind: specialStoneKind,
        type: 'SEED',
        owner: marker.owner
    });
}

function resolveSeedExpiration(cardState: any, gameState: any, marker: any, helpers: any, BoardOpsModule: any, constants: Constants, specialStoneKind: string, context: Context): { sprouted: boolean; reason?: string; spawnRes?: any; flipBatch?: any } {
    if (!marker || !Number.isInteger(marker.row) || !Number.isInteger(marker.col)) return { sprouted: false };
    const row = marker.row;
    const col = marker.col;
    const ownerKey = normalizeMarkerOwnerKey(marker.owner);

    emitDurationEndStatusRemoved(cardState, helpers, marker, marker.data || { type: 'SEED' });
    clearSeedMarker(cardState, helpers, specialStoneKind, marker);

    if (!canSeedOccupyCell(cardState, gameState, helpers, row, col)) {
        return { sprouted: false, reason: 'cell_unavailable' };
    }
    if (getSeedCellValue(helpers, gameState, row, col) !== constants.EMPTY) {
        return { sprouted: false, reason: 'occupied' };
    }

    const spawnAndFlipModule = getSpawnAndFlipModule(context);
    const spawnAndFlipBatch = spawnAndFlipModule && typeof spawnAndFlipModule.spawnAndFlipBatch === 'function'
        ? spawnAndFlipModule.spawnAndFlipBatch
        : null;
    if (
        spawnAndFlipBatch &&
        BoardOpsModule &&
        typeof BoardOpsModule.spawnAt === 'function' &&
        typeof helpers.getCardContext === 'function' &&
        typeof helpers.getFlipsWithContext === 'function'
    ) {
        const playerValue = ownerKey === 'white' ? constants.WHITE : constants.BLACK;
        const flipBatch = spawnAndFlipBatch(
            cardState,
            gameState,
            ownerKey,
            playerValue,
            [{ row, col }],
            'SEED_WILL',
            'seed_sprout',
            { row, col },
            {
                BoardOps: BoardOpsModule,
                getCardContext: helpers.getCardContext,
                getFlipsWithContext: helpers.getFlipsWithContext,
                clearBombAt: helpers.clearBombAt,
                clearHyperactiveAtPositions: helpers.clearHyperactiveAtPositions,
                changeCause: 'SEED_WILL',
                changeReason: 'seed_sprout_flip',
                spawnMeta: {
                    seedSprout: true,
                    seedOwner: ownerKey
                }
            }
        );
        return {
            sprouted: !!(flipBatch && Array.isArray(flipBatch.spawned) && flipBatch.spawned.length > 0),
            spawnRes: flipBatch,
            flipBatch
        };
    }

    if (BoardOpsModule && typeof BoardOpsModule.spawnAt === 'function') {
        const spawnRes = BoardOpsModule.spawnAt(
            cardState,
            gameState,
            row,
            col,
            ownerKey,
            'SEED_WILL',
            'seed_sprout',
            {
                seedSprout: true,
                seedOwner: ownerKey
            }
        );
        return { sprouted: !!(spawnRes && spawnRes.spawned), spawnRes };
    }

    if (typeof helpers.clearStoneIdAtForCard === 'function') {
        helpers.clearStoneIdAtForCard(cardState, gameState, row, col);
    }
    if (typeof helpers.setCellValueForCard === 'function') {
        helpers.setCellValueForCard(gameState, row, col, ownerKey === 'black' ? constants.BLACK : constants.WHITE);
        return { sprouted: true };
    }

    return { sprouted: false, reason: 'spawn_unavailable' };
}

function emitDurationEndStatusRemoved(cardState: any, helpers: any, marker: any, data: any): void {
    if (typeof helpers.emitPresentationEvent !== 'function' || !marker || !data) return;
    helpers.emitPresentationEvent(cardState, {
        type: 'STATUS_REMOVED',
        row: marker.row,
        col: marker.col,
        reason: 'duration_end',
        meta: {
            special: data.type,
            owner: marker.owner,
            reason: 'duration_end'
        }
    });
}

const DEFERRED_TURN_START_STATUS_EXPIRATIONS_KEY = '_deferredTurnStartStatusExpirations';

function queueDeferredTurnStartStatusExpiration(cardState: any, marker: any): void {
    if (!cardState || !marker) return;
    const state = cardState as any;
    if (!Array.isArray(state[DEFERRED_TURN_START_STATUS_EXPIRATIONS_KEY])) {
        state[DEFERRED_TURN_START_STATUS_EXPIRATIONS_KEY] = [];
    }
    state[DEFERRED_TURN_START_STATUS_EXPIRATIONS_KEY].push({
        id: marker.id,
        row: marker.row,
        col: marker.col,
        owner: marker.owner,
        kind: marker.kind,
        type: marker.data && marker.data.type
    });
}

function findDeferredStatusMarker(cardState: any, entry: any): any {
    const markers = cardState && Array.isArray(cardState.markers) ? cardState.markers : [];
    if (!entry) return null;
    if (entry.id !== undefined && entry.id !== null) {
        const byId = markers.find((marker: any) => marker && marker.id === entry.id);
        if (byId) return byId;
    }
    return markers.find((marker: any) => (
        marker &&
        marker.row === entry.row &&
        marker.col === entry.col &&
        marker.owner === entry.owner &&
        marker.kind === entry.kind &&
        marker.data &&
        String(marker.data.type || '').toUpperCase() === String(entry.type || '').toUpperCase()
    )) || null;
}

function flushDeferredTurnStartStatusExpirations(cardState: any, gameState: any, context: Context): any[] {
    const state = cardState as any;
    const queue = state && Array.isArray(state[DEFERRED_TURN_START_STATUS_EXPIRATIONS_KEY])
        ? state[DEFERRED_TURN_START_STATUS_EXPIRATIONS_KEY].splice(0)
        : [];
    if (state) delete state[DEFERRED_TURN_START_STATUS_EXPIRATIONS_KEY];
    if (!queue.length) return [];

    const helpers = getHelpers(context);
    const constants = getConstants(context);
    const specialStoneKind = getSpecialStoneKind(constants);
    const expired: any[] = [];

    for (const entry of queue) {
        const marker = findDeferredStatusMarker(cardState, entry);
        const data = marker && marker.data ? marker.data : null;
        if (!marker || !data) continue;
        if (String(data.type || '').toUpperCase() !== 'GUARD') continue;
        if (typeof data.remainingOwnerTurns === 'number' && data.remainingOwnerTurns > 0) continue;
        if (typeof helpers.removeMarkersAt !== 'function') continue;

        emitDurationEndStatusRemoved(cardState, helpers, marker, data);
        const livingWillMarker = getTrackedLivingWillMarker(cardState, marker.row, marker.col, data.type, context);
        helpers.removeMarkersAt(cardState, marker.row, marker.col, {
            kind: specialStoneKind,
            type: data.type,
            owner: marker.owner
        });
        restoreTrackedLivingWill(cardState, gameState, livingWillMarker, marker.row, marker.col, data.type, 'SYSTEM', 'duration_end', context, constants);
        expired.push({ row: marker.row, col: marker.col, owner: marker.owner, type: data.type });
    }

    return expired;
}

const ANCHOR_SCOPED_STATUS_DURATION_TYPES = new Set([
    'SEED',
    'GUARD',
    'BLOCKADE',
    'FREEZE',
    'GHOST',
    'SACRIFICE',
    'PROLIFERATION',
    'STONE_SALVATION_GOD'
]);

function isAnchorScopedStatusDurationType(dataType: any): boolean {
    return ANCHOR_SCOPED_STATUS_DURATION_TYPES.has(String(dataType || '').toUpperCase());
}

function processTurnStartStatusMarkerAnchor(cardState: any, gameState: any, playerKey: string, marker: any, context: Context): any {
    const helpers = getHelpers(context);
    const constants = getConstants(context);
    const BoardOpsModule = getBoardOps(context);
    const data = marker && marker.data ? marker.data : null;
    const dataType = String(data && data.type ? data.type : '').toUpperCase();
    const expired: any[] = [];

    if (!marker || !data || !isAnchorScopedStatusDurationType(dataType)) {
        return { processed: false, expired };
    }
    if (marker.owner !== playerKey || typeof data.remainingOwnerTurns !== 'number') {
        return { processed: false, expired };
    }

    const frozenCellsActiveAtTurnStart = (cardState as any)._frozenCellsActiveAtTurnStart;
    if (
        dataType !== 'FREEZE' &&
        frozenCellsActiveAtTurnStart &&
        typeof frozenCellsActiveAtTurnStart.has === 'function' &&
        frozenCellsActiveAtTurnStart.has(`${marker.row},${marker.col}`)
    ) {
        return { processed: false, skipped: 'frozen', expired };
    }

    data.remainingOwnerTurns -= 1;
    if (data.remainingOwnerTurns > 0 || typeof helpers.removeMarkersAt !== 'function') {
        return { processed: true, expired };
    }

    const specialStoneKind = getSpecialStoneKind(constants);
    if (dataType === 'SEED') {
        const seedExpiration = resolveSeedExpiration(cardState, gameState, marker, helpers, BoardOpsModule, constants, specialStoneKind, context);
        expired.push({ row: marker.row, col: marker.col, owner: marker.owner, type: data.type });
        const generatedSpawnFlipResults = (seedExpiration && seedExpiration.sprouted && seedExpiration.flipBatch)
            ? [Object.assign({
                ownerKey: normalizeMarkerOwnerKey(marker.owner),
                cause: 'SEED_WILL',
                reason: 'seed_sprout'
            }, seedExpiration.flipBatch)]
            : [];
        return { processed: true, expired, generatedSpawnFlipResults };
    }

    if (dataType === 'GHOST') {
        if (BoardOpsModule && typeof BoardOpsModule.revertSpecialStoneAt === 'function') {
            const revertRes = BoardOpsModule.revertSpecialStoneAt(
                cardState,
                gameState,
                marker.row,
                marker.col,
                'GHOST',
                marker.owner,
                'SYSTEM',
                'duration_end',
                {
                    special: data.type,
                    owner: marker.owner,
                    timer: 0
                }
            );
            if (revertRes && revertRes.reverted) {
                expired.push({ row: marker.row, col: marker.col, owner: marker.owner, type: data.type });
                return { processed: true, expired };
            }
        }
    }

    if (dataType === 'STONE_SALVATION_GOD' && BoardOpsModule && typeof BoardOpsModule.revertSpecialStoneAt === 'function') {
        const revertRes = BoardOpsModule.revertSpecialStoneAt(
            cardState,
            gameState,
            marker.row,
            marker.col,
            'STONE_SALVATION_GOD',
            marker.owner,
            'SYSTEM',
            'duration_end',
            {
                special: data.type,
                owner: marker.owner,
                timer: 0
            }
        );
        if (revertRes && revertRes.reverted) {
            expired.push({ row: marker.row, col: marker.col, owner: marker.owner, type: data.type });
            return { processed: true, expired };
        }
    }

    emitDurationEndStatusRemoved(cardState, helpers, marker, data);
    const livingWillMarker = getTrackedLivingWillMarker(cardState, marker.row, marker.col, data.type, context);
    helpers.removeMarkersAt(cardState, marker.row, marker.col, {
        kind: specialStoneKind,
        type: data.type,
        owner: marker.owner
    });
    restoreTrackedLivingWill(cardState, gameState, livingWillMarker, marker.row, marker.col, data.type, 'SYSTEM', 'duration_end', context, constants);
    expired.push({ row: marker.row, col: marker.col, owner: marker.owner, type: data.type });
    return { processed: true, expired };
}

function drawForTurnStart(cardState: any, playerKey: string, prng: any, context: Context): void {
    const helpers = getHelpers(context);
    const constants = getConstants(context);
    const p = prng || (context && context.defaultPrng);
    const turnCount = cardState
        && cardState.turnCountByPlayer
        ? Number(cardState.turnCountByPlayer[playerKey])
        : NaN;
    if (cardState && (cardState as any).debugNoDraw !== true && Number.isFinite(turnCount) && turnCount % constants.DRAW_INTERVAL === 0) {
        if (typeof helpers.commitDraw === 'function') {
            helpers.commitDraw(cardState, playerKey, p);
        }
    }
}

function onTurnStartBeforeAnchors(cardState: any, playerKey: string, gameState: any, prng: any, context: Context): TurnStartSummary {
    const helpers = getHelpers(context);
    const constants = getConstants(context);
    const BoardOpsModule = getBoardOps(context);
    const p = prng || (context && context.defaultPrng);
    const summary: TurnStartSummary = {
        ribo: {
            entries: [],
            totalRepaid: 0,
            totalDestroyed: 0,
            completedCount: 0
        },
        observerWill: {
            entries: [],
            totalRepaid: 0,
            totalDestroyed: 0,
            completedCount: 0
        }
    };

    (cardState as any).turnCountByPlayer[playerKey]++;
    (cardState as any).turnIndex++;
    (cardState as any).lastTurnStartedFor = playerKey;

    if (!cardState.breedingSproutByOwner || typeof cardState.breedingSproutByOwner !== 'object') {
        (cardState as any).breedingSproutByOwner = { black: [], white: [] };
    }
    if (!Array.isArray(cardState.breedingSproutByOwner.black)) (cardState as any).breedingSproutByOwner.black = [];
    if (!Array.isArray(cardState.breedingSproutByOwner.white)) (cardState as any).breedingSproutByOwner.white = [];
    if (!cardState._breedingSproutClearedTokenByOwner || typeof cardState._breedingSproutClearedTokenByOwner !== 'object') {
        (cardState as any)._breedingSproutClearedTokenByOwner = { black: null, white: null };
    }
    const breedingSproutToken = `${playerKey}:${Number.isFinite(cardState.turnIndex) ? cardState.turnIndex : 0}`;
    if ((cardState as any)._breedingSproutClearedTokenByOwner[playerKey] !== breedingSproutToken) {
        (cardState as any)._breedingSproutClearedTokenByOwner[playerKey] = breedingSproutToken;
        (cardState as any).breedingSproutByOwner[playerKey] = [];
    }

    (cardState as any).hasUsedCardThisTurnByPlayer[playerKey] = false;
    if (typeof helpers.ensureHandDestroyFlags === 'function') {
        helpers.ensureHandDestroyFlags(cardState);
    }
    (cardState as any).hasDestroyedCardThisTurnByPlayer[playerKey] = false;
    (cardState as any).extraPlaceRemainingByPlayer[playerKey] = 0;
    if (!cardState.infinitePlaceActiveByPlayer) (cardState as any).infinitePlaceActiveByPlayer = { black: false, white: false };
    if (!cardState.multiPlaceSourceTypeByPlayer) (cardState as any).multiPlaceSourceTypeByPlayer = { black: null, white: null };
    (cardState as any).infinitePlaceActiveByPlayer[playerKey] = false;
    (cardState as any).multiPlaceSourceTypeByPlayer[playerKey] = null;

    if (typeof helpers.processRiboWillTurnStartEffects === 'function') {
        summary.ribo = helpers.processRiboWillTurnStartEffects(cardState, gameState, playerKey, p);
    }
    if (typeof helpers.processObserverWillRepaymentsAtTurnStart === 'function') {
        summary.observerWill = helpers.processObserverWillRepaymentsAtTurnStart(cardState, gameState, playerKey, p);
    }
    if (typeof helpers.processBoardExecutorHandTaxAtTurnStart === 'function') {
        summary.boardExecutor = helpers.processBoardExecutorHandTaxAtTurnStart(cardState, gameState, playerKey, p);
    }

    const specialMarkers = typeof helpers.getSpecialMarkers === 'function'
        ? helpers.getSpecialMarkers(cardState)
        : [];
    const frozenCellsActiveAtTurnStart = new Set(
        specialMarkers
            .filter((marker: any) => marker && marker.data && marker.data.type === 'FREEZE')
            .map((marker: any) => `${marker.row},${marker.col}`)
    );
    (cardState as any)._frozenCellsActiveAtTurnStart = frozenCellsActiveAtTurnStart;

    const specialStoneKind = getSpecialStoneKind(constants);
    for (const marker of specialMarkers) {
        const data = marker.data || {};
        const dataType = String(data.type || '').toUpperCase();
        if (
            context &&
            (context as any).deferStatusDurationUntilTurnStartMarkers === true &&
            marker.owner === playerKey &&
            typeof data.remainingOwnerTurns === 'number' &&
            isAnchorScopedStatusDurationType(dataType)
        ) {
            continue;
        }
        if (data.expiresForPlayer === playerKey) {
            if (dataType === 'GOLD' || dataType === 'SILVER') {
                if (BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function') {
                    BoardOpsModule.destroyAt(cardState, gameState, marker.row, marker.col, 'SYSTEM', 'gold_silver_expired');
                } else {
                    if (gameState && gameState.board) (gameState as any).board[marker.row][marker.col] = constants.EMPTY;
                    if (typeof helpers.removeMarkersAt === 'function') {
                        helpers.removeMarkersAt(cardState, marker.row, marker.col, { kind: specialStoneKind, type: data.type, owner: marker.owner });
                    }
                }
            } else if (typeof helpers.removeMarkersAt === 'function') {
                const livingWillMarker = getTrackedLivingWillMarker(cardState, marker.row, marker.col, data.type, context);
                helpers.removeMarkersAt(cardState, marker.row, marker.col, { kind: specialStoneKind, type: data.type, owner: marker.owner });
                restoreTrackedLivingWill(cardState, gameState, livingWillMarker, marker.row, marker.col, data.type, 'SYSTEM', 'duration_end', context, constants);
            }
            continue;
        }
        if (typeof data.remainingOwnerTurns === 'number' && data.remainingOwnerTurns <= 0 && dataType !== 'SEED') {
            if (dataType === 'PROLIFERATION') {
                emitDurationEndStatusRemoved(cardState, helpers, marker, data);
            }
            if (typeof helpers.removeMarkersAt === 'function') {
                const livingWillMarker = getTrackedLivingWillMarker(cardState, marker.row, marker.col, data.type, context);
                helpers.removeMarkersAt(cardState, marker.row, marker.col, { kind: specialStoneKind, type: data.type, owner: marker.owner });
                restoreTrackedLivingWill(cardState, gameState, livingWillMarker, marker.row, marker.col, data.type, 'SYSTEM', 'duration_end', context, constants);
            }
            continue;
        }
        if (data.type === 'REGEN' && (data.regenRemaining || 0) <= 0) {
            if (typeof helpers.removeMarkersAt === 'function') {
                const livingWillMarker = getTrackedLivingWillMarker(cardState, marker.row, marker.col, data.type, context);
                helpers.removeMarkersAt(cardState, marker.row, marker.col, { kind: specialStoneKind, type: data.type, owner: marker.owner });
                restoreTrackedLivingWill(cardState, gameState, livingWillMarker, marker.row, marker.col, data.type, 'SYSTEM', 'duration_end', context, constants);
            }
        }
        if (data.type !== 'FREEZE' && frozenCellsActiveAtTurnStart.has(`${marker.row},${marker.col}`)) {
            continue;
        }
        if (dataType === 'SEED' && marker.owner === playerKey && typeof data.remainingOwnerTurns === 'number') {
            data.remainingOwnerTurns -= 1;
            if (data.remainingOwnerTurns <= 0) {
                const seedExpiration = resolveSeedExpiration(cardState, gameState, marker, helpers, BoardOpsModule, constants, specialStoneKind, context);
                if (seedExpiration && seedExpiration.sprouted && seedExpiration.flipBatch) {
                    summary.generatedSpawnFlipResults = summary.generatedSpawnFlipResults || [];
                    summary.generatedSpawnFlipResults.push(Object.assign({
                        ownerKey: normalizeMarkerOwnerKey(marker.owner),
                        cause: 'SEED_WILL',
                        reason: 'seed_sprout'
                    }, seedExpiration.flipBatch));
                }
            }
            continue;
        }
        if ((dataType === 'GUARD' || dataType === 'BLOCKADE' || dataType === 'FREEZE' || dataType === 'GHOST' || dataType === 'SACRIFICE' || dataType === 'PROLIFERATION' || dataType === 'STONE_SALVATION_GOD') && marker.owner === playerKey && typeof data.remainingOwnerTurns === 'number') {
            data.remainingOwnerTurns -= 1;
            if (data.remainingOwnerTurns <= 0 && typeof helpers.removeMarkersAt === 'function') {
                if (dataType === 'GUARD' && context && (context as any).deferGuardDurationEndUntilAfterTurnStartMarkers === true) {
                    queueDeferredTurnStartStatusExpiration(cardState, marker);
                    continue;
                }
                if (dataType === 'GHOST') {
                    if (BoardOpsModule && typeof BoardOpsModule.revertSpecialStoneAt === 'function') {
                        const revertRes = BoardOpsModule.revertSpecialStoneAt(
                            cardState,
                            gameState,
                            marker.row,
                            marker.col,
                            'GHOST',
                            marker.owner,
                            'SYSTEM',
                            'duration_end',
                            {
                                special: data.type,
                                owner: marker.owner,
                                timer: 0
                            }
                        );
                        if (revertRes && revertRes.reverted) {
                            continue;
                        }
                    }
                    emitDurationEndStatusRemoved(cardState, helpers, marker, data);
                    const livingWillMarker = getTrackedLivingWillMarker(cardState, marker.row, marker.col, data.type, context);
                    helpers.removeMarkersAt(cardState, marker.row, marker.col, {
                        kind: specialStoneKind,
                        type: data.type,
                        owner: marker.owner
                    });
                    restoreTrackedLivingWill(cardState, gameState, livingWillMarker, marker.row, marker.col, data.type, 'SYSTEM', 'duration_end', context, constants);
                    continue;
                }
                if (dataType === 'STONE_SALVATION_GOD' && BoardOpsModule && typeof BoardOpsModule.revertSpecialStoneAt === 'function') {
                    const revertRes = BoardOpsModule.revertSpecialStoneAt(
                        cardState,
                        gameState,
                        marker.row,
                        marker.col,
                        'STONE_SALVATION_GOD',
                        marker.owner,
                        'SYSTEM',
                        'duration_end',
                        {
                            special: data.type,
                            owner: marker.owner,
                            timer: 0
                        }
                    );
                    if (revertRes && revertRes.reverted) {
                        continue;
                    }
                }
                emitDurationEndStatusRemoved(cardState, helpers, marker, data);
                const livingWillMarker = getTrackedLivingWillMarker(cardState, marker.row, marker.col, data.type, context);
                helpers.removeMarkersAt(cardState, marker.row, marker.col, {
                    kind: specialStoneKind,
                    type: data.type,
                    owner: marker.owner
                });
                restoreTrackedLivingWill(cardState, gameState, livingWillMarker, marker.row, marker.col, data.type, 'SYSTEM', 'duration_end', context, constants);
            }
        }
    }

    const workMod = getWorkModule(context);
    if (workMod && typeof workMod.processWorkEffects === 'function') {
        try {
            const workDeps = typeof helpers.addChargeWithTotal === 'function'
                ? { addChargeWithTotal: helpers.addChargeWithTotal }
                : null;
            const res = workDeps
                ? workMod.processWorkEffects(cardState, gameState, playerKey, workDeps)
                : workMod.processWorkEffects(cardState, gameState, playerKey);
            if (!cardState.presentationEvents) (cardState as any).presentationEvents = [];
            const workEntries = Array.isArray(res && res.entries) && res.entries.length > 0
                ? res.entries
                : (res ? [res] : []);
            for (const entry of workEntries) {
                const row = Number.isInteger(entry && entry.row) ? entry.row : null;
                const col = Number.isInteger(entry && entry.col) ? entry.col : null;
                const removedReason = (entry && typeof entry.removedReason === 'string' && entry.removedReason)
                    ? entry.removedReason
                    : null;
                const incomeStep = Number.isFinite(Number(entry && entry.incomeStep))
                    ? Number(entry.incomeStep)
                    : null;
                if (entry && entry.gained && entry.gained > 0 && typeof helpers.emitPresentationEvent === 'function') {
                    helpers.emitPresentationEvent(cardState, {
                        type: 'WORK_INCOME',
                        player: playerKey,
                        row,
                        col,
                        gained: entry.gained,
                        removed: !!entry.removed,
                        reason: removedReason,
                        meta: { reason: removedReason, incomeStep }
                    });
                } else if (entry && entry.removed && typeof helpers.emitPresentationEvent === 'function') {
                    helpers.emitPresentationEvent(cardState, {
                        type: 'WORK_REMOVED',
                        player: playerKey,
                        row,
                        col,
                        removed: true,
                        reason: removedReason,
                        meta: { reason: removedReason }
                    });
                }
            }
        } catch (e) {
            // swallow to avoid breaking turn start in environments without module
        }
    }

    return summary;
}

function onTurnStart(cardState: any, playerKey: string, gameState: any, prng: any, context: Context): TurnStartSummary {
    const summary = onTurnStartBeforeAnchors(cardState, playerKey, gameState, prng, context);
    drawForTurnStart(cardState, playerKey, prng, context);
    return summary;
}

function applyPlacementEffects(cardState: any, gameState: any, playerKey: string, row: number, col: number, flipCount: number, context: Context): PlacementEffects {
    const helpers = getHelpers(context);
    const constants = getConstants(context);
    const BoardOpsModule = getBoardOps(context);
    const effects: PlacementEffects = { chargeGained: 0 };
    const pending = (cardState as any).pendingEffectByPlayer[playerKey];
    if (pending && (pending.type === 'FREE_PLACEMENT' || pending.type === 'SNIPER_WILL' || pending.type === 'LAST_RESORT')) {
        effects.freePlacementUsed = true;
    }
    const specialStoneKind = getSpecialStoneKind(constants);
    const buildMarkerDataForCardType = SpecialStoneMarkerFactory && typeof SpecialStoneMarkerFactory.buildMarkerDataForCardType === 'function'
        ? SpecialStoneMarkerFactory.buildMarkerDataForCardType
        : null;

    let chargeGain = flipCount;

    const flipMultiplierConfig = pending ? constants.FLIP_CHARGE_MULTIPLIER_EFFECTS[pending.type] : null;
    const numberCellMultiplierConfig = pending ? constants.NUMBER_CELL_CHARGE_MULTIPLIER_EFFECTS[pending.type] : null;
    const chargeMultiplierConfig = flipMultiplierConfig || numberCellMultiplierConfig;
    if (flipMultiplierConfig) {
        chargeGain = flipCount * flipMultiplierConfig.multiplier;
        effects[flipMultiplierConfig.effectFlag] = true;
        if (BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function') {
            BoardOpsModule.destroyAt(cardState, gameState, row, col, 'SYSTEM', flipMultiplierConfig.destroyReason);
        } else {
            (gameState as any).board[row][col] = constants.EMPTY;
        }
    } else if (numberCellMultiplierConfig) {
        // Number-cell multipliers only modify the board-bonus gain.
        // Non-number cells should behave like a normal placement.
    }

    let actualChargeGained = chargeGain;
    if (typeof helpers.addChargeWithTotal === 'function') {
        let actualGeneratedGain = 0;
        if (chargeGain > 0) {
            actualGeneratedGain = helpers.addChargeWithTotal(cardState, playerKey, chargeGain, (flipCount > 0) ? {
                popupKind: 'board',
                sourceType: 'placement_flip_gain',
                anchorRow: row,
                anchorCol: col
            } : null);
        }
        actualChargeGained = Number.isFinite(Number(actualGeneratedGain)) ? Number(actualGeneratedGain) : chargeGain;
    }
    effects.chargeGained = Number.isFinite(Number(actualChargeGained))
        ? Number(actualChargeGained)
        : chargeGain;
    if (pending && pending.type === 'PROTECTED_NEXT_STONE') {
        const res = applyProtectedNextStoneEffect(cardState, playerKey, row, col, getProtectedNextStoneModule(context));
        if (res && res.applied) effects.protected = true;
    }

    if (pending && pending.type === 'PERMA_PROTECT_NEXT_STONE') {
        const res = applyPermaProtectNextStoneEffect(cardState, playerKey, row, col, getPermaProtectNextStoneModule(context));
        if (res && res.applied) effects.permaProtected = true;
    }

    if (pending && pending.type === 'REGEN_WILL' && typeof helpers.applyRegenWill === 'function') {
        helpers.applyRegenWill(cardState, playerKey, row, col);
        effects.regenPlaced = true;
    }

    try {
        if (typeof helpers.workDebugLog === 'function') {
            helpers.workDebugLog(cardState, '[WORK_DEBUG] workNextPlacementArmedByPlayer state:', cardState.workNextPlacementArmedByPlayer, 'playerKey:', playerKey, 'row:', row, 'col:', col);
        }
        if (cardState.workNextPlacementArmedByPlayer && (cardState as any).workNextPlacementArmedByPlayer[playerKey]) {
            const workPlacement = applyArmedWorkPlacement(cardState, gameState, playerKey, row, col, context);
            if (workPlacement.applied) {
                effects.workPlaced = true;
            }
            if (workPlacement.consumed) {
                (cardState as any).workNextPlacementArmedByPlayer[playerKey] = false;
            }
        }
    } catch (e) { /* defensive */ }

    if (pending && pending.type === 'ULTIMATE_REVERSE_DRAGON') {
        if (typeof helpers.addMarker === 'function') {
            helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
                type: 'DRAGON',
                remainingOwnerTurns: constants.ULTIMATE_DRAGON_TURNS
            });
            effects.dragonPlaced = true;
        }
    }

    if (pending && pending.type === 'BREEDING_WILL' && typeof helpers.addMarker === 'function') {
        helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
            type: 'BREEDING',
            remainingOwnerTurns: 5
        });
        effects.breedingPlaced = true;
    }

    if (pending && pending.type === 'PROLIFERATION_WILL' && typeof helpers.addMarker === 'function') {
        helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
            type: 'PROLIFERATION',
            remainingOwnerTurns: getProliferationOwnerTurns(constants)
        });
        effects.proliferationPlaced = true;
    }

    if (pending && pending.type === 'ULTIMATE_DESTROY_GOD' && typeof helpers.addMarker === 'function') {
        helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
            type: 'ULTIMATE_DESTROY_GOD',
            remainingOwnerTurns: constants.ULTIMATE_DESTROY_GOD_TURNS
        });
        effects.ultimateDestroyGodPlaced = true;
    }

    if (pending && pending.type === 'STONE_SALVATION_GOD' && typeof helpers.addMarker === 'function') {
        helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
            type: 'STONE_SALVATION_GOD',
            remainingOwnerTurns: constants.STONE_SALVATION_GOD_TURNS
        });
        effects.stoneSalvationGodPlaced = true;
    }

    if (pending && pending.type === 'SNIPER_WILL' && typeof helpers.addMarker === 'function') {
        helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
            type: 'SNIPER',
            remainingOwnerTurns: constants.SNIPER_WILL_TURNS
        });
        effects.sniperPlaced = true;
    }

    if (pending && pending.type === 'GHOST_WILL' && typeof helpers.addMarker === 'function') {
        helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
            type: 'GHOST',
            remainingOwnerTurns: constants.GHOST_WILL_TURNS
        });
        effects.ghostPlaced = true;
    }

    if (pending && pending.type === 'SACRIFICE_WILL' && typeof helpers.addMarker === 'function') {
        const remainingOwnerTurns = Number.isFinite(Number(constants.SACRIFICE_WILL_TURNS))
            ? Math.max(1, Math.trunc(Number(constants.SACRIFICE_WILL_TURNS)))
            : 5;
        helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
            type: 'SACRIFICE',
            remainingOwnerTurns
        });
        effects.sacrificePlaced = true;
    }

    if (pending && pending.type === 'AFTERIMAGE_WILL' && typeof helpers.addMarker === 'function') {
        helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
            type: 'AFTERIMAGE_WILL',
            flipEvadeRemaining: getFlipEvadeDefault('AFTERIMAGE_WILL', constants.AFTERIMAGE_WILL_FLIP_EVADE_LIMIT),
            destroyEvadeRemaining: getDestroyEvadeDefault('AFTERIMAGE_WILL', constants.AFTERIMAGE_WILL_DESTROY_EVADE_LIMIT)
        });
        effects.afterimagePlaced = true;
    }

    if (pending && pending.type === 'ZOMBIE_WILL' && typeof helpers.addMarker === 'function') {
        helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
            type: 'ZOMBIE',
            ownerColor: playerKey === 'black' ? constants.BLACK : constants.WHITE,
            turnsUntilInfection: 3,
            regenRemaining: 1
        });
        effects.zombiePlaced = true;
    }

    if (pending && (pending.type === 'TIME_STOP_GOD' || pending.type === 'TIME_STOP_DEITY') && typeof helpers.addMarker === 'function') {
        const isDeity = pending.type === 'TIME_STOP_DEITY';
        const turnsSource = isDeity ? constants.TIME_STOP_DEITY_TURNS : constants.TIME_STOP_GOD_TURNS;
        const remainingOwnerTurns = Number.isFinite(Number(turnsSource))
            ? Math.max(1, Math.trunc(Number(turnsSource)))
            : (isDeity ? 5 : 3);
        const markerType = isDeity ? 'TIME_STOP_DEITY' : 'TIME_STOP';
        helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
            type: markerType,
            remainingOwnerTurns
        });
        effects.timeStopPlaced = true;
        effects.timeStopDeityPlaced = isDeity;
    }

    if (pending && pending.type === 'WILL_HUNTER_KING' && typeof helpers.addMarker === 'function') {
        const markerData = buildMarkerDataForCardType ? buildMarkerDataForCardType('WILL_HUNTER_KING', {
            ownerKey: playerKey,
            constants,
            SpecialStoneRegistry
        }) : {
            type: 'WILL_HUNTER_KING',
            remainingOwnerTurns: constants.WILL_HUNTER_KING_TURNS,
            flipEvadeRemaining: getFlipEvadeDefault('WILL_HUNTER_KING', 2),
            destroyEvadeRemaining: getDestroyEvadeDefault('WILL_HUNTER_KING', 2)
        };
        helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, markerData);
        effects.willHunterKingPlaced = true;
    }

    if (pending && pending.type === 'DESTROY_DRAGON_WILL' && typeof helpers.addMarker === 'function') {
        helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
            type: 'DESTROY_DRAGON',
            remainingOwnerTurns: constants.DESTROY_DRAGON_TURNS
        });
        effects.destroyDragonPlaced = true;
    }

    if (pending && pending.type === 'LIGHTNING_WILL' && typeof helpers.addMarker === 'function') {
        helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
            type: 'LIGHTNING',
            remainingOwnerTurns: constants.LIGHTNING_WILL_TURNS
        });
        effects.lightningPlaced = true;
    }

    if (pending && pending.type === 'METEOR_GOD' && typeof helpers.addMarker === 'function') {
        helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
            type: 'METEOR_GOD',
            remainingOwnerTurns: constants.METEOR_GOD_TURNS
        });
        effects.meteorGodPlaced = true;
    }

    if (pending && pending.type === 'HYPERACTIVE_WILL' && typeof helpers.addMarker === 'function') {
        (cardState as any).hyperactiveSeqCounter = (cardState.hyperactiveSeqCounter || 0) + 1;
        helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
            type: 'HYPERACTIVE',
            flipEvadeRemaining: getFlipEvadeDefault('HYPERACTIVE', 1),
            hyperactiveSeq: (cardState as any).hyperactiveSeqCounter
        });
        effects.hyperactivePlaced = true;
    }

    if (pending && pending.type === 'EXTREME_HYPERACTIVE_WILL' && typeof helpers.addMarker === 'function') {
        (cardState as any).hyperactiveSeqCounter = (cardState.hyperactiveSeqCounter || 0) + 1;
        helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
            type: 'EXTREME_HYPERACTIVE',
            flipEvadeRemaining: getFlipEvadeDefault('EXTREME_HYPERACTIVE', constants.EXTREME_HYPERACTIVE_FLIP_EVADE_LIMIT),
            destroyEvadeRemaining: getDestroyEvadeDefault('EXTREME_HYPERACTIVE', constants.EXTREME_HYPERACTIVE_DESTROY_EVADE_LIMIT),
            hyperactiveSeq: (cardState as any).hyperactiveSeqCounter
        });
        effects.hyperactivePlaced = true;
        effects.extremeHyperactivePlaced = true;
    }

    if (pending && pending.type === 'ESCAPE_WILL' && typeof helpers.addMarker === 'function') {
        (cardState as any).hyperactiveSeqCounter = (cardState.hyperactiveSeqCounter || 0) + 1;
        helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
            type: 'ESCAPE_HYPERACTIVE',
            flipEvadeRemaining: getFlipEvadeDefault('ESCAPE_HYPERACTIVE', 1),
            hyperactiveSeq: (cardState as any).hyperactiveSeqCounter
        });
        effects.hyperactivePlaced = true;
        effects.escapeHyperactivePlaced = true;
    }

    if (pending && pending.type === 'ROBOT_VACUUM_WILL' && typeof helpers.addMarker === 'function') {
        (cardState as any).hyperactiveSeqCounter = (cardState.hyperactiveSeqCounter || 0) + 1;
        helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
            type: 'ROBOT_VACUUM',
            hyperactiveSeq: (cardState as any).hyperactiveSeqCounter,
            remainingOwnerTurns: constants.ROBOT_VACUUM_TURNS
        });
        effects.hyperactivePlaced = true;
        effects.robotVacuumPlaced = true;
    }

    if (pending && pending.type === 'GLUTTONOUS_WILL' && typeof helpers.addMarker === 'function') {
        (cardState as any).hyperactiveSeqCounter = (cardState.hyperactiveSeqCounter || 0) + 1;
        helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
            type: 'GLUTTONOUS',
            hyperactiveSeq: (cardState as any).hyperactiveSeqCounter,
            gluttonousMissStreak: 0
        });
        effects.hyperactivePlaced = true;
        effects.gluttonousPlaced = true;
    }

    if (pending && pending.type === 'INSTANT_HYPERACTIVE_WILL' && typeof helpers.addMarker === 'function') {
        (cardState as any).hyperactiveSeqCounter = (cardState.hyperactiveSeqCounter || 0) + 1;
        helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
            type: 'HYPERACTIVE',
            hyperactiveSeq: (cardState as any).hyperactiveSeqCounter,
            instantPlacementOnly: true
        });
        effects.hyperactivePlaced = true;
        effects.instantHyperactivePlaced = true;
    }

    if (pending && pending.type === 'ULTIMATE_HYPERACTIVE_GOD' && typeof helpers.addMarker === 'function') {
        helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
            type: 'ULTIMATE_HYPERACTIVE',
            remainingOwnerTurns: constants.ULTIMATE_HYPERACTIVE_TURNS,
            flipEvadeRemaining: getFlipEvadeDefault('ULTIMATE_HYPERACTIVE', constants.ULTIMATE_HYPERACTIVE_FLIP_EVADE_LIMIT),
            destroyEvadeRemaining: getDestroyEvadeDefault('ULTIMATE_HYPERACTIVE', constants.ULTIMATE_HYPERACTIVE_DESTROY_EVADE_LIMIT)
        });
        effects.ultimateHyperactivePlaced = true;
    }

    function explodeCells(cells: any[], cause: string, reason: string): number {
        const targetMap = new Map<string, { row: number; col: number }>();
        for (const pos of cells) {
            const targetRow = Number(pos && pos.row);
            const targetCol = Number(pos && pos.col);
            if (!Number.isInteger(targetRow) || !Number.isInteger(targetCol)) continue;
            if (typeof helpers.hasBoardShapeCellForCard === 'function' && !helpers.hasBoardShapeCellForCard(cardState, gameState, targetRow, targetCol)) continue;
            const key = `${targetRow},${targetCol}`;
            if (!targetMap.has(key)) {
                targetMap.set(key, { row: targetRow, col: targetCol });
            }
        }
        const validTargets = Array.from(targetMap.values());
        const forbiddenEvadeCells = validTargets.map((pos) => ({ row: pos.row, col: pos.col }));
        let destroyedCount = 0;
        const destroyTargets = () => {
            for (const pos of validTargets) {
                const prev = (BoardOpsModule && typeof BoardOpsModule.getCellValue === 'function')
                    ? BoardOpsModule.getCellValue(gameState, pos.row, pos.col)
                    : (typeof helpers.getCellValueForCard === 'function' ? helpers.getCellValueForCard(gameState, pos.row, pos.col) : null);
                if (prev === constants.EMPTY || prev === null) continue;
                if (BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function') {
                    const res = BoardOpsModule.destroyAt(cardState, gameState, pos.row, pos.col, cause, reason, {
                        forbiddenEvadeCells
                    });
                    if (res && res.destroyed) destroyedCount++;
                } else {
                    if (typeof helpers.removeMarkersAt === 'function') {
                        helpers.removeMarkersAt(cardState, pos.row, pos.col);
                    }
                    if (typeof helpers.setCellValueForCard !== 'function' || !helpers.setCellValueForCard(gameState, pos.row, pos.col, constants.EMPTY)) continue;
                    if (typeof helpers.clearStoneIdAtForCard === 'function') {
                        helpers.clearStoneIdAtForCard(cardState, gameState, pos.row, pos.col);
                    }
                    destroyedCount++;
                }
            }
        };
        if (BoardOpsModule && typeof BoardOpsModule.runDestroyBlock === 'function') {
            BoardOpsModule.runDestroyBlock(cardState, gameState, destroyTargets, {});
        } else {
            destroyTargets();
        }
        return destroyedCount;
    }

    if (pending && (pending.type === 'CROSS_BOMB' || pending.type === 'X_BOMB')) {
        const targets = [{ row, col }];
        for (const dist of [1, 2]) {
            if (pending.type === 'CROSS_BOMB') {
                targets.push(
                    { row: row - dist, col },
                    { row: row + dist, col },
                    { row, col: col - dist },
                    { row, col: col + dist }
                );
            } else {
                targets.push(
                    { row: row - dist, col: col - dist },
                    { row: row - dist, col: col + dist },
                    { row: row + dist, col: col - dist },
                    { row: row + dist, col: col + dist }
                );
            }
        }

        if (pending.type === 'CROSS_BOMB') {
            const destroyedCount = explodeCells(targets, 'CROSS_BOMB', 'cross_bomb_explosion');
            effects.crossBombExploded = true;
            effects.crossBombDestroyed = destroyedCount;
        } else {
            const destroyedCount = explodeCells(targets, 'X_BOMB', 'x_bomb_explosion');
            effects.xBombExploded = true;
            effects.xBombDestroyed = destroyedCount;
        }
    }

    const throwChainConfig = pending ? getThrowChainConfig(constants, pending.type) : null;
    if (pending && throwChainConfig) {
        if (!cardState.extraPlaceRemainingByPlayer) (cardState as any).extraPlaceRemainingByPlayer = {};
        if (!cardState.infinitePlaceActiveByPlayer) (cardState as any).infinitePlaceActiveByPlayer = { black: false, white: false };
        if (!cardState.multiPlaceSourceTypeByPlayer) (cardState as any).multiPlaceSourceTypeByPlayer = { black: null, white: null };

        (cardState as any).extraPlaceRemainingByPlayer[playerKey] = throwChainConfig.extraPlacements;
        (cardState as any).infinitePlaceActiveByPlayer[playerKey] = throwChainConfig.infinite === true;
        (cardState as any).multiPlaceSourceTypeByPlayer[playerKey] = pending.type;

        effects.doublePlaceActivated = true;
        effects.multiPlaceActivatedType = pending.type;
        effects.multiPlaceActivatedName = throwChainConfig.name || pending.type;
        effects.multiPlaceRemaining = throwChainConfig.infinite === true ? null : throwChainConfig.extraPlacements;
        effects.multiPlaceInfinite = throwChainConfig.infinite === true;
    }

    if (pending && pending.type === 'LAST_RESORT') {
        const remainingBefore = Number.isFinite(Number(pending.placementsRemaining))
            ? Math.max(0, Math.floor(Number(pending.placementsRemaining)))
            : 3;
        const remainingAfter = Math.max(0, remainingBefore - 1);
        pending.placementsRemaining = remainingAfter;

        if (remainingBefore > 1) {
            if (!cardState.extraPlaceRemainingByPlayer) (cardState as any).extraPlaceRemainingByPlayer = {};
            const currentExtra = Math.max(0, Number((cardState as any).extraPlaceRemainingByPlayer[playerKey] || 0));
            const extraGrant = Number.isFinite(Number(constants.DOUBLE_PLACE_EXTRA))
                ? Math.max(1, Math.floor(Number(constants.DOUBLE_PLACE_EXTRA)))
                : 1;
            (cardState as any).extraPlaceRemainingByPlayer[playerKey] = currentExtra + extraGrant;
            effects.lastResortContinues = true;
        } else {
            effects.lastResortCompleted = true;
        }
    }

    if (!(pending && pending.type === 'LAST_RESORT' && Number(pending.placementsRemaining || 0) > 0)) {
        (cardState as any).pendingEffectByPlayer[playerKey] = null;
    }

    return effects;
}

export = {
    onTurnStart,
    onTurnStartBeforeAnchors,
    drawForTurnStart,
    flushDeferredTurnStartStatusExpirations,
    processTurnStartStatusMarkerAnchor,
    applyPlacementEffects
};
