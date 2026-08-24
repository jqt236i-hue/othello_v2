import SharedConstantsImport = require('../../../shared-constants');
import SharedBoardUtilsImport = require('../../../shared/shared-board-utils');
import RandomSourceImport = require('../cards-internal/random-source');
import SpawnAndFlipImport = require('../cards-internal/spawn-and-flip-core');

type BreedingOwnerValue = number;
type BreedingSeatKey = 'black' | 'white';
interface BreedingSharedConstants {
    BLACK: BreedingOwnerValue;
    WHITE: BreedingOwnerValue;
    EMPTY: BreedingOwnerValue;
}

interface BreedingPosition {
    row: number;
    col: number;
}

interface BreedingGameState {
    board?: BreedingOwnerValue[][];
    [key: string]: unknown;
}

interface BreedingMarkerData {
    type?: string;
    category?: string;
    remainingOwnerTurns?: number;
    [key: string]: unknown;
}

interface BreedingMarker extends BreedingPosition {
    id?: string | number;
    kind?: string;
    owner?: unknown;
    data?: BreedingMarkerData | null;
    [key: string]: unknown;
}

interface BreedingCardState {
    markers?: BreedingMarker[];
    turnIndex?: number;
    breedingFrontierByAnchorId?: Record<string, BreedingPosition[]>;
    breedingSproutByOwner?: Record<BreedingSeatKey, BreedingPosition[]>;
    _breedingSproutClearedTokenByOwner?: Record<BreedingSeatKey, string | null>;
    [key: string]: unknown;
}

interface BreedingRuntimeCardState extends BreedingCardState {
    breedingFrontierByAnchorId: Record<string, BreedingPosition[]>;
    breedingSproutByOwner: Record<BreedingSeatKey, BreedingPosition[]>;
    _breedingSproutClearedTokenByOwner: Record<BreedingSeatKey, string | null>;
}

interface BreedingSharedBoardUtilsModule {
    createBoardContext?: (gameState: BreedingGameState, cardState: BreedingCardState) => any;
    getCellValue?: (boardContext: any, row: number, col: number) => BreedingOwnerValue | null;
    setCellValue?: (boardContext: any, row: number, col: number, value: BreedingOwnerValue) => boolean;
    collectBoardCoordinates?: (boardContext: any) => BreedingPosition[];
}

interface BreedingRandomLike {
    random: () => number;
}

interface BreedingRandomSourceModule {
    resolveRandomIndex?: (length: number, randomLike: BreedingRandomLike, fallback: unknown, label: string) => number;
}

interface BreedingCardContext {
    protectedStones?: unknown[];
    permaProtectedStones?: unknown[];
    cardState?: BreedingCardState;
    [key: string]: unknown;
}

interface BreedingSpawnResult {
    spawned?: boolean;
    stoneId?: unknown;
}

interface BreedingChangeResult {
    changed?: boolean;
}

interface BreedingBoardOpsModule {
    spawnAt?: (cardState: BreedingCardState, gameState: BreedingGameState, row: number, col: number, playerKey: BreedingSeatKey, cause: string, reason: string) => BreedingSpawnResult | null | undefined;
    changeAt?: (cardState: BreedingCardState, gameState: BreedingGameState, row: number, col: number, playerKey: BreedingSeatKey, cause: string, reason: string) => BreedingChangeResult | null | undefined;
    revertSpecialStoneAt?: (cardState: BreedingCardState, gameState: BreedingGameState, row: number, col: number, specialType: string, playerKey: BreedingSeatKey, cause: string, reason: string) => unknown;
    runSpawnBlock?: (cardState: BreedingCardState, gameState: BreedingGameState, fn: () => void, meta: Record<string, unknown>) => unknown;
}

interface BreedingProcessDeps {
    BoardOps?: BreedingBoardOpsModule | null;
    isBlockedCell?: (cardState: BreedingCardState, row: number, col: number, gameState: BreedingGameState) => boolean;
    getCardContext?: (cardState: BreedingCardState) => BreedingCardContext;
    getFlipsWithContext?: (gameState: BreedingGameState, row: number, col: number, playerValue: BreedingOwnerValue, context: BreedingCardContext) => Array<[number, number]>;
    clearBombAt?: (cardState: BreedingCardState, row: number, col: number) => void;
    clearHyperactiveAtPositions?: (cardState: BreedingCardState, positions: BreedingPosition[]) => void;
    changeCause?: string;
    changeReason?: string;
}

interface BreedingSpawnedPosition extends BreedingPosition {
    anchorRow: number;
    anchorCol: number;
    stoneId?: unknown;
}

interface BreedingDestroyedPosition extends BreedingPosition {
    owner: BreedingSeatKey;
    reason: string;
}

interface BreedingAnchorPosition extends BreedingPosition {
    remainingNow: number;
}

interface BreedingBatchResult {
    spawned: BreedingSpawnedPosition[];
    flipped: BreedingPosition[];
}

interface BreedingProcessResult extends BreedingBatchResult {
    destroyed: BreedingDestroyedPosition[];
    anchors: BreedingAnchorPosition[];
}

interface BreedingImmediateResult extends BreedingBatchResult {
    destroyed: BreedingDestroyedPosition[];
}

interface BreedingSpawnAndFlipModule {
    spawnAndFlipBatch?: (cardState: BreedingCardState, gameState: BreedingGameState, playerKey: BreedingSeatKey, player: BreedingOwnerValue, targets: BreedingPosition[], cause: string, reason: string, anchorPos: BreedingPosition, deps: BreedingProcessDeps) => BreedingBatchResult;
}

const CardBreeding = /**
 * @file breeding.js
 * @description Breeding effect helpers (Shared between Browser and Headless)
 */

(function (SharedConstants: BreedingSharedConstants, SharedBoardUtils: BreedingSharedBoardUtilsModule | null, RandomSourceModule: BreedingRandomSourceModule | null, SpawnAndFlipModule: BreedingSpawnAndFlipModule | null) {
    'use strict';

    const { BLACK, WHITE, EMPTY } = SharedConstants || {};
    const sharedSpawnAndFlipBatch = SpawnAndFlipModule && typeof SpawnAndFlipModule.spawnAndFlipBatch === 'function'
        ? SpawnAndFlipModule.spawnAndFlipBatch
        : null;

    if (BLACK === undefined || WHITE === undefined || EMPTY === undefined) {
        throw new Error('SharedConstants missing required values');
    }

    function _requireBoardUtils(): Required<BreedingSharedBoardUtilsModule> {
        if (
            !SharedBoardUtils ||
            typeof SharedBoardUtils.createBoardContext !== 'function' ||
            typeof SharedBoardUtils.getCellValue !== 'function' ||
            typeof SharedBoardUtils.setCellValue !== 'function' ||
            typeof SharedBoardUtils.collectBoardCoordinates !== 'function'
        ) {
            throw new Error('SharedBoardUtils BoardContext APIs are required by CardBreeding');
        }
        return SharedBoardUtils as Required<BreedingSharedBoardUtilsModule>;
    }

    function _createBoardContext(cardState: BreedingCardState, gameState: BreedingGameState): any {
        return _requireBoardUtils().createBoardContext(gameState, cardState);
    }

    function _getBoardCell(cardState: BreedingCardState, gameState: BreedingGameState, row: number, col: number): BreedingOwnerValue | null {
        const boardUtils = _requireBoardUtils();
        return boardUtils.getCellValue(_createBoardContext(cardState, gameState), row, col);
    }

    function _setBoardCell(cardState: BreedingCardState, gameState: BreedingGameState, row: number, col: number, value: BreedingOwnerValue): boolean {
        const boardUtils = _requireBoardUtils();
        return boardUtils.setCellValue(_createBoardContext(cardState, gameState), row, col, value);
    }

    function _collectBoardCoordinates(cardState: BreedingCardState, gameState: BreedingGameState): BreedingPosition[] {
        const boardUtils = _requireBoardUtils();
        return boardUtils.collectBoardCoordinates(_createBoardContext(cardState, gameState));
    }

    function _posKey(row: number, col: number): string {
        return `${row},${col}`;
    }

    function _normalizePositions(positions: unknown): BreedingPosition[] {
        const out: BreedingPosition[] = [];
        const seen = new Set<string>();
        const src = Array.isArray(positions) ? positions : [];
        for (const p of src) {
            if (!p || !Number.isInteger(p.row) || !Number.isInteger(p.col)) continue;
            const key = _posKey(p.row, p.col);
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ row: p.row, col: p.col });
        }
        return out;
    }

    function _ensureBreedingRuntime(cardState: BreedingCardState): asserts cardState is BreedingRuntimeCardState {
        if (!cardState || typeof cardState !== 'object') return;
        if (!cardState.breedingFrontierByAnchorId || typeof cardState.breedingFrontierByAnchorId !== 'object') {
            cardState.breedingFrontierByAnchorId = {};
        }
        if (!cardState.breedingSproutByOwner || typeof cardState.breedingSproutByOwner !== 'object') {
            cardState.breedingSproutByOwner = { black: [], white: [] };
        }
        if (!Array.isArray(cardState.breedingSproutByOwner.black)) cardState.breedingSproutByOwner.black = [];
        if (!Array.isArray(cardState.breedingSproutByOwner.white)) cardState.breedingSproutByOwner.white = [];
        if (!cardState._breedingSproutClearedTokenByOwner || typeof cardState._breedingSproutClearedTokenByOwner !== 'object') {
            cardState._breedingSproutClearedTokenByOwner = { black: null, white: null };
        }
    }

    function _getFrontier(cardState: BreedingCardState, anchorId: unknown): BreedingPosition[] {
        _ensureBreedingRuntime(cardState);
        const key = String(anchorId);
        const frontier = cardState.breedingFrontierByAnchorId[key];
        return _normalizePositions(frontier);
    }

    function _setFrontier(cardState: BreedingCardState, anchorId: unknown, positions: unknown): void {
        _ensureBreedingRuntime(cardState);
        const key = String(anchorId);
        cardState.breedingFrontierByAnchorId[key] = _normalizePositions(positions);
    }

    function _clearFrontier(cardState: BreedingCardState, anchorId: unknown): void {
        _ensureBreedingRuntime(cardState);
        delete cardState.breedingFrontierByAnchorId[String(anchorId)];
    }

    function _replaceSprouts(cardState: BreedingCardState, playerKey: BreedingSeatKey, positions: unknown): void {
        _ensureBreedingRuntime(cardState);
        cardState.breedingSproutByOwner[playerKey] = _normalizePositions(positions);
    }

    function _mergeSprouts(cardState: BreedingCardState, playerKey: BreedingSeatKey, positions: unknown): void {
        _ensureBreedingRuntime(cardState);
        const base = cardState.breedingSproutByOwner[playerKey] || [];
        cardState.breedingSproutByOwner[playerKey] = _normalizePositions(base.concat(_normalizePositions(positions)));
    }

    function _clearSproutsOnceAtTurn(cardState: BreedingCardState, playerKey: BreedingSeatKey): void {
        _ensureBreedingRuntime(cardState);
        const token = `${playerKey}:${Number.isFinite(cardState.turnIndex) ? cardState.turnIndex : 0}`;
        if (cardState._breedingSproutClearedTokenByOwner[playerKey] !== token) {
            cardState._breedingSproutClearedTokenByOwner[playerKey] = token;
            _replaceSprouts(cardState, playerKey, []);
        }
    }

    function _isBlockedByBlockade(cardState: BreedingCardState, row: number, col: number, gameState: BreedingGameState, deps: BreedingProcessDeps): boolean {
        if (deps && typeof deps.isBlockedCell === 'function') {
            try {
                if (deps.isBlockedCell(cardState, row, col, gameState) === true) return true;
            } catch (e) { /* ignore and fallback */ }
        }
        const rowNum = Number(row);
        const colNum = Number(col);
        if (!Number.isInteger(rowNum) || !Number.isInteger(colNum)) return false;
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.some((marker) => {
            if (!marker || marker.kind !== 'specialStone') return false;
            const type = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
            if (type !== 'BLOCKADE' && type !== 'METEOR_HOLE' && type !== 'FREEZE') return false;
            return Number(marker.row) === rowNum && Number(marker.col) === colNum;
        });
    }

    function _collectEmptyNeighborTargets(cardState: BreedingCardState, gameState: BreedingGameState, origins: unknown, deps: BreedingProcessDeps = {}): BreedingPosition[] {
        const targets: BreedingPosition[] = [];
        const seen = new Set<string>();
        const src = _normalizePositions(origins);
        for (const origin of src) {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const r = origin.row + dr;
                    const c = origin.col + dc;
                    if (_getBoardCell(cardState, gameState, r, c) !== EMPTY) continue;
                    if (_isBlockedByBlockade(cardState, r, c, gameState, deps)) continue;
                    const key = _posKey(r, c);
                    if (seen.has(key)) continue;
                    seen.add(key);
                    targets.push({ row: r, col: c });
                }
            }
        }
        return targets;
    }

    function _collectAllEmptyTargets(cardState: BreedingCardState, gameState: BreedingGameState, deps: BreedingProcessDeps = {}): BreedingPosition[] {
        const targets: BreedingPosition[] = [];
        const seen = new Set<string>();
        const addTarget = (row: number, col: number): void => {
            if (!Number.isInteger(row) || !Number.isInteger(col)) return;
            if (_getBoardCell(cardState, gameState, row, col) !== EMPTY) return;
            if (_isBlockedByBlockade(cardState, row, col, gameState, deps)) return;
            const key = _posKey(row, col);
            if (seen.has(key)) return;
            seen.add(key);
            targets.push({ row, col });
        };

        for (const cell of _collectBoardCoordinates(cardState, gameState)) {
            addTarget(cell.row, cell.col);
        }

        return targets;
    }

    function _chebyshevDistance(a: BreedingPosition, b: BreedingPosition): number {
        return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
    }

    function _collectNearestEmptyTargets(cardState: BreedingCardState, gameState: BreedingGameState, origins: unknown, deps: BreedingProcessDeps = {}): BreedingPosition[] {
        const src = _normalizePositions(origins);
        if (src.length === 0) return [];
        const allTargets = _collectAllEmptyTargets(cardState, gameState, deps);
        if (allTargets.length === 0) return [];

        let bestDistance = Number.POSITIVE_INFINITY;
        const nearest: BreedingPosition[] = [];
        for (const target of allTargets) {
            let targetDistance = Number.POSITIVE_INFINITY;
            for (const origin of src) {
                targetDistance = Math.min(targetDistance, _chebyshevDistance(origin, target));
            }
            if (targetDistance < bestDistance) {
                bestDistance = targetDistance;
                nearest.length = 0;
                nearest.push(target);
            } else if (targetDistance === bestDistance) {
                nearest.push(target);
            }
        }
        return nearest;
    }

    function _collectBreedingTargets(cardState: BreedingCardState, gameState: BreedingGameState, origins: unknown, deps: BreedingProcessDeps = {}): BreedingPosition[] {
        const neighborTargets = _collectEmptyNeighborTargets(cardState, gameState, origins, deps);
        if (neighborTargets.length > 0) return neighborTargets;
        return _collectNearestEmptyTargets(cardState, gameState, origins, deps);
    }

    function _pickRandomTarget(targets: BreedingPosition[], prng: BreedingRandomLike): BreedingPosition | null {
        const list = Array.isArray(targets) ? targets : [];
        if (list.length === 0) return null;
        const idx = (RandomSourceModule && typeof RandomSourceModule.resolveRandomIndex === 'function')
            ? RandomSourceModule.resolveRandomIndex(list.length, prng, null, 'CardBreeding')
            : Math.floor(prng.random() * list.length);
        return list[Math.max(0, Math.min(list.length - 1, idx))];
    }

    function _spawnAndFlipBatchLocal(cardState: BreedingCardState, gameState: BreedingGameState, playerKey: BreedingSeatKey, player: BreedingOwnerValue, targets: BreedingPosition[], cause: string, reason: string, anchorPos: BreedingPosition, deps: BreedingProcessDeps): BreedingBatchResult {
        const spawned: BreedingSpawnedPosition[] = [];
        const flipped: BreedingPosition[] = [];
        const flippedSet = new Set<string>();
        const getCardContext = deps.getCardContext || (() => ({ protectedStones: [], permaProtectedStones: [] }));
        const getFlipsWithContext = deps.getFlipsWithContext || ((gs, r, c, playerVal, ctx) => []);
        const clearBombAt = deps.clearBombAt || ((cs: BreedingCardState, r: number, c: number) => { if (cs.markers) cs.markers = cs.markers.filter(m => !(m.kind === 'specialStone' && m.data && m.data.category === 'bomb' && m.row === r && m.col === c)); });
        const clearHyperactiveAtPositions = deps.clearHyperactiveAtPositions;
        const changeCause = deps.changeCause || 'BREEDING';
        const changeReason = deps.changeReason || 'breeding_flip';

        const applyBatch = (): void => { for (const target of targets) {
            const context = { ...(getCardContext(cardState) || {}), cardState };
            const flips = getFlipsWithContext(gameState, target.row, target.col, player, context);

            let spawnRes = null;
            let usedBoardOpsSpawn = false;
            let spawnedSuccessfully = false;
            if (deps.BoardOps && typeof deps.BoardOps.spawnAt === 'function') {
                usedBoardOpsSpawn = true;
                spawnRes = deps.BoardOps.spawnAt(cardState, gameState, target.row, target.col, playerKey, cause, reason);
                spawnedSuccessfully = !!(spawnRes && spawnRes.spawned === true);
            } else {
                spawnedSuccessfully = _setBoardCell(cardState, gameState, target.row, target.col, player);
            }
            if (!spawnedSuccessfully || (usedBoardOpsSpawn && (!spawnRes || spawnRes.spawned !== true))) {
                continue;
            }
            spawned.push({
                row: target.row,
                col: target.col,
                anchorRow: anchorPos.row,
                anchorCol: anchorPos.col,
                stoneId: spawnRes ? spawnRes.stoneId : undefined
            });

            for (const [fr, fc] of flips) {
                let changed = true;
                if (deps.BoardOps && typeof deps.BoardOps.changeAt === 'function') {
                    const changeRes = deps.BoardOps.changeAt(cardState, gameState, fr, fc, playerKey, changeCause, changeReason);
                    changed = !!(changeRes && changeRes.changed);
                } else {
                    changed = _setBoardCell(cardState, gameState, fr, fc, player);
                }
                if (!changed) continue;
                clearBombAt(cardState, fr, fc);
                const key = _posKey(fr, fc);
                if (!flippedSet.has(key)) {
                    flippedSet.add(key);
                    flipped.push({ row: fr, col: fc });
                }
            }
        } };

        if (deps.BoardOps && typeof deps.BoardOps.runSpawnBlock === 'function') {
            deps.BoardOps.runSpawnBlock(cardState, gameState, applyBatch, {
                cause,
                reason,
                owner: playerKey
            });
        } else {
            applyBatch();
        }

        if (flipped.length > 0 && typeof clearHyperactiveAtPositions === 'function') {
            clearHyperactiveAtPositions(cardState, flipped);
        }
        return { spawned, flipped };
    }

    function spawnAndFlipBatch(cardState: BreedingCardState, gameState: BreedingGameState, playerKey: BreedingSeatKey, player: BreedingOwnerValue, targets: BreedingPosition[], cause: string, reason: string, anchorPos: BreedingPosition, deps: BreedingProcessDeps): BreedingBatchResult {
        if (sharedSpawnAndFlipBatch) {
            return sharedSpawnAndFlipBatch(cardState, gameState, playerKey, player, targets, cause, reason, anchorPos, deps);
        }
        return _spawnAndFlipBatchLocal(cardState, gameState, playerKey, player, targets, cause, reason, anchorPos, deps);
    }

    function _processTurnStartAnchor(cardState: BreedingCardState, gameState: BreedingGameState, playerKey: BreedingSeatKey, row: number, col: number, prng: BreedingRandomLike, deps: BreedingProcessDeps = {}): BreedingProcessResult {
        const player = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const spawned: BreedingSpawnedPosition[] = [];
        const destroyed: BreedingDestroyedPosition[] = [];
        const flipped: BreedingPosition[] = [];
        const anchors: BreedingAnchorPosition[] = [];
        _ensureBreedingRuntime(cardState);
        _clearSproutsOnceAtTurn(cardState, playerKey);

        const anchor = (cardState.markers || []).find(s =>
            s.kind === 'specialStone' && s.data && s.data.type === 'BREEDING' && s.owner === playerKey && s.row === row && s.col === col
        );
        if (!anchor) return { spawned, destroyed, flipped, anchors };
        if (_getBoardCell(cardState, gameState, row, col) !== player) {
            if (anchor.data) anchor.data.remainingOwnerTurns = -1;
            _clearFrontier(cardState, anchor.id);
            return { spawned, destroyed, flipped, anchors };
        }

        const before = (anchor.data && (anchor.data.remainingOwnerTurns !== undefined && anchor.data.remainingOwnerTurns !== null))
            ? anchor.data.remainingOwnerTurns
            : 0;
        const afterDec = before - 1;
        if (anchor.data) anchor.data.remainingOwnerTurns = afterDec;
        if (afterDec < 0) return { spawned, destroyed, flipped, anchors };
        anchors.push({ row, col, remainingNow: afterDec });

        const previousFrontier = _getFrontier(cardState, anchor.id);
        const brokenFrontier = previousFrontier.some(p => _getBoardCell(cardState, gameState, p.row, p.col) !== player);
        const origins = previousFrontier.length === 0 || brokenFrontier
            ? [{ row, col }]
            : previousFrontier;
        const targets = _collectBreedingTargets(cardState, gameState, origins, deps);
        const picked = _pickRandomTarget(targets, prng);

        const batch = spawnAndFlipBatch(cardState, gameState, playerKey, player, picked ? [picked] : [], 'BREEDING', 'breeding_spawned', { row, col }, deps);
        spawned.push(...batch.spawned);
        flipped.push(...batch.flipped);

        if (spawned.length > 0) _setFrontier(cardState, anchor.id, spawned);
        else if (previousFrontier.length === 0 || brokenFrontier) _setFrontier(cardState, anchor.id, []);

        _mergeSprouts(cardState, playerKey, spawned);

        if (afterDec === 0) {
            destroyed.push({ row, col, owner: playerKey, reason: 'anchor_expired' });
            if (deps.BoardOps && typeof deps.BoardOps.revertSpecialStoneAt === 'function') {
                deps.BoardOps.revertSpecialStoneAt(cardState, gameState, row, col, 'BREEDING', playerKey, 'BREEDING', 'anchor_expired');
            } else {
                if (cardState.markers) {
                    cardState.markers = cardState.markers.filter(m => !(m.kind === 'specialStone' && m.data && m.data.type === 'BREEDING' && m.row === row && m.col === col && m.owner === playerKey));
                }
            }
            if (anchor.data) anchor.data.remainingOwnerTurns = -1;
            _clearFrontier(cardState, anchor.id);
        }

        return { spawned, destroyed, flipped, anchors };
    }

    function processBreedingEffects(cardState: BreedingCardState, gameState: BreedingGameState, playerKey: BreedingSeatKey, prng: BreedingRandomLike, deps: BreedingProcessDeps = {}): BreedingProcessResult {
        const spawned: BreedingSpawnedPosition[] = [];
        const destroyed: BreedingDestroyedPosition[] = [];
        const flipped: BreedingPosition[] = [];
        const anchors: BreedingAnchorPosition[] = [];
        _ensureBreedingRuntime(cardState);
        _replaceSprouts(cardState, playerKey, []);

        const anchorsForOwner = (cardState.markers || []).filter(s =>
            s.kind === 'specialStone' && s.data && s.data.type === 'BREEDING' && s.owner === playerKey
        );
        for (const anchor of anchorsForOwner) {
            const one = _processTurnStartAnchor(cardState, gameState, playerKey, anchor.row, anchor.col, prng, deps);
            if (one.spawned && one.spawned.length) spawned.push(...one.spawned);
            if (one.destroyed && one.destroyed.length) destroyed.push(...one.destroyed);
            if (one.flipped && one.flipped.length) flipped.push(...one.flipped);
            if (one.anchors && one.anchors.length) anchors.push(...one.anchors);
        }

        return { spawned, destroyed, flipped, anchors };
    }

    function processBreedingEffectsAtAnchor(cardState: BreedingCardState, gameState: BreedingGameState, playerKey: BreedingSeatKey, row: number, col: number, prng: BreedingRandomLike, deps: BreedingProcessDeps = {}): BreedingImmediateResult {
        const player = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const spawned: BreedingSpawnedPosition[] = [];
        const destroyed: BreedingDestroyedPosition[] = [];
        const flipped: BreedingPosition[] = [];
        _ensureBreedingRuntime(cardState);

        const anchor = (cardState.markers || []).find(s =>
            s.kind === 'specialStone' && s.data && s.data.type === 'BREEDING' && s.owner === playerKey && s.row === row && s.col === col
        );
        if (!anchor) return { spawned, destroyed, flipped };
        if (_getBoardCell(cardState, gameState, row, col) !== player) return { spawned, destroyed, flipped };

        const targets = _collectBreedingTargets(cardState, gameState, [{ row, col }], deps);
        const picked = _pickRandomTarget(targets, prng);
        const batch = spawnAndFlipBatch(cardState, gameState, playerKey, player, picked ? [picked] : [], 'BREEDING', 'breeding_spawn_immediate', { row, col }, deps);
        spawned.push(...batch.spawned);
        flipped.push(...batch.flipped);
        _setFrontier(cardState, anchor.id, spawned);
        _mergeSprouts(cardState, playerKey, spawned);

        return { spawned, destroyed, flipped };
    }

    function processBreedingEffectsAtTurnStartAnchor(cardState: BreedingCardState, gameState: BreedingGameState, playerKey: BreedingSeatKey, row: number, col: number, prng: BreedingRandomLike, deps: BreedingProcessDeps = {}): BreedingProcessResult {
        return _processTurnStartAnchor(cardState, gameState, playerKey, row, col, prng, deps);
    }

    return {
        processBreedingEffects,
        processBreedingEffectsAtAnchor,
        processBreedingEffectsAtTurnStartAnchor,
        spawnAndFlipBatch
    };
})(
    SharedConstantsImport,
    SharedBoardUtilsImport,
    RandomSourceImport,
    SpawnAndFlipImport as unknown as BreedingSpawnAndFlipModule
);

export = CardBreeding;
