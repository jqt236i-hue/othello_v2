'use strict';

import { CardState, GameState } from '../../../src/types';

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

const RandomSourceModule = ((typeof module === 'object' && module.exports)
    ? safeRequire('../cards-internal/random-source')
    : null) || (typeof self !== 'undefined' ? (self as any).CardRandomSource : null);

const BLACK = Number.isFinite(Number(SharedConstants && SharedConstants.BLACK))
    ? Number(SharedConstants.BLACK)
    : 1;
const WHITE = Number.isFinite(Number(SharedConstants && SharedConstants.WHITE))
    ? Number(SharedConstants.WHITE)
    : -1;

function resolveRandomSource(prng: any) {
    if (RandomSourceModule && typeof RandomSourceModule.resolveRandomSource === 'function') {
        return RandomSourceModule.resolveRandomSource(prng, null, 'CardClone');
    }
    if (prng && typeof prng.random === 'function')
        return prng;
    throw new Error('CardClone requires an injected deterministic PRNG.');
}

function resolveRandomIndex(randomSource: any, length: number): number {
    if (RandomSourceModule && typeof RandomSourceModule.resolveRandomIndex === 'function') {
        return RandomSourceModule.resolveRandomIndex(length, randomSource, null, 'CardClone');
    }
    if (!Number.isInteger(length) || length <= 0)
        return 0;
    const raw = Math.floor(randomSource.random() * length);
    if (!Number.isInteger(raw))
        return 0;
    return Math.max(0, Math.min(length - 1, raw));
}

function cloneMarkerData(data: any): any {
    if (!data || typeof data !== 'object')
        return {};
    try {
        return JSON.parse(JSON.stringify(data));
    }
    catch (_e) {
        return { ...data };
    }
}

function getPlayerValue(playerKey: string): number {
    return playerKey === 'black' ? BLACK : WHITE;
}

interface SpawnDeps {
    spawnAt?(cardState: CardState, gameState: GameState, row: number, col: number, playerKey: string, cause: string, reason: string, meta: any): any;
    setCellValueForCard?(gameState: GameState, row: number, col: number, value: number): boolean;
}

function applySpawnWithValidation(spawnAt: any, setCellValueForCard: any, cardState: CardState, gameState: GameState, target: {row: number; col: number}, playerKey: string, playerValue: number, cause: string, reason: string, meta: any) {
    if (typeof spawnAt === 'function') {
        const spawnResult = spawnAt(cardState, gameState, target.row, target.col, playerKey, cause, reason, meta);
        if (!spawnResult || spawnResult.spawned !== true) {
            return {
                applied: false,
                reason: (spawnResult && typeof spawnResult.reason === 'string' && spawnResult.reason)
                    ? spawnResult.reason
                    : 'spawn_failed'
            };
        }
        return { applied: true, spawnResult };
    }
    const wroteCell = setCellValueForCard(gameState, target.row, target.col, playerValue);
    if (wroteCell !== true) {
        return { applied: false, reason: 'spawn_failed' };
    }
    return { applied: true, spawnResult: null };
}

interface CloneDeps {
    getCloneTargets?(cardState: CardState, gameState: GameState, playerKey: string): Array<{row: number; col: number}>;
    getCellValueForCard?(gameState: GameState, row: number, col: number): number | null;
    getSpecialMarkers?(cardState: CardState): any[];
    getBombMarkers?(cardState: CardState): any[];
    collectEmptyNeighborCellsForCard?(cardState: CardState, gameState: GameState, row: number, col: number): Array<{row: number; col: number}>;
    spawnAt?(cardState: CardState, gameState: GameState, row: number, col: number, playerKey: string, cause: string, reason: string, meta: any): any;
    runSpawnBlock?(cardState: CardState, gameState: GameState, fn: () => any, meta?: any): any;
    setCellValueForCard?(gameState: GameState, row: number, col: number, value: number): boolean;
    addMarker?(cardState: CardState, kind: string, row: number, col: number, playerKey: string, data: any): boolean;
}

interface CloneResult {
    applied: boolean;
    reason?: string;
    source?: {row: number; col: number};
    spawned?: Array<{row: number; col: number}>;
    durationChanges?: Array<any>;
}

function applyCloneWill(cardState: CardState, gameState: GameState, playerKey: string, row: number, col: number, prng: any, deps: CloneDeps = {}): CloneResult {
    const cs = cardState as any;
    const pending = cs && cs.pendingEffectByPlayer ? cs.pendingEffectByPlayer[playerKey] : null;
    if (!pending || pending.type !== 'CLONE_WILL' || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'not_pending' };
    }
    const getCloneTargets = deps.getCloneTargets || (() => []);
    const getCellValueForCard = deps.getCellValueForCard || (() => null);
    const getSpecialMarkers = deps.getSpecialMarkers || (() => []);
    const getBombMarkers = deps.getBombMarkers || (() => []);
    const collectEmptyNeighborCellsForCard = deps.collectEmptyNeighborCellsForCard || (() => []);
    const spawnAt = deps.spawnAt || null;
    const runSpawnBlock = typeof deps.runSpawnBlock === 'function' ? deps.runSpawnBlock : null;
    const setCellValueForCard = deps.setCellValueForCard || (() => false);
    const addMarker = deps.addMarker || (() => false);
    const targets = getCloneTargets(cardState, gameState, playerKey);
    const allowed = Array.isArray(targets) && targets.some((target) => target && target.row === row && target.col === col);
    if (!allowed)
        return { applied: false, reason: 'invalid_target' };
    const sourceValue = getCellValueForCard(gameState, row, col);
    const playerValue = getPlayerValue(playerKey);
    if (sourceValue !== playerValue)
        return { applied: false, reason: 'not_owner_stone' };
    const sourceSpecials = getSpecialMarkers(cardState).filter((marker: any) => marker && marker.row === row && marker.col === col);
    const sourceBombs = getBombMarkers(cardState).filter((marker: any) => marker && marker.row === row && marker.col === col);
    const spawnTargets = collectEmptyNeighborCellsForCard(cardState, gameState, row, col);
    if (!spawnTargets.length)
        return { applied: false, reason: 'no_space' };
    const randomSource = resolveRandomSource(prng);
    const target = spawnTargets[resolveRandomIndex(randomSource, spawnTargets.length)] || spawnTargets[0];
    const spawned: Array<{row: number; col: number}> = [];
    const applyCloneSpawn = () => applySpawnWithValidation(spawnAt, setCellValueForCard, cardState, gameState, target, playerKey, playerValue, 'CLONE_WILL', 'clone_spawn', {
        fromRow: row,
        fromCol: col,
        cloneVisual: true,
        spawnIntent: 'clone_spawn'
    });
    const spawnOutcome = runSpawnBlock
        ? runSpawnBlock(cardState, gameState, applyCloneSpawn, { cause: 'CLONE_WILL', reason: 'clone_spawn', owner: playerKey })
        : applyCloneSpawn();
    if (!spawnOutcome.applied)
        return spawnOutcome as CloneResult;
    for (const special of sourceSpecials) {
        const owner = special.owner === 'white' ? 'white' : 'black';
        addMarker(cardState, 'specialStone', target.row, target.col, owner, cloneMarkerData(special.data || {}));
    }
    for (const bomb of sourceBombs) {
        const owner = bomb.owner === 'white' ? 'white' : 'black';
        addMarker(cardState, 'specialStone', target.row, target.col, owner, Object.assign({}, cloneMarkerData(bomb.data || {}), { category: 'bomb', type: (bomb.data && bomb.data.type) || 'TIME_BOMB' }));
    }
    spawned.push({ row: target.row, col: target.col });
    cs.pendingEffectByPlayer[playerKey] = null;
    return { applied: true, source: { row, col }, spawned };
}

export = {
    applyCloneWill
};
