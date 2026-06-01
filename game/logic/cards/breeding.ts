type BreedingOwnerValue = number;
type BreedingSeatKey = 'black' | 'white';
type BreedingExpansionSide = 'left' | 'right' | 'top' | 'bottom';

interface BreedingSharedConstants {
    BLACK: BreedingOwnerValue;
    WHITE: BreedingOwnerValue;
    EMPTY: BreedingOwnerValue;
}

interface BreedingBoardBounds {
    minRow: number;
    maxRow: number;
    minCol: number;
    maxCol: number;
}

interface BreedingPosition {
    row: number;
    col: number;
}

interface BreedingExpansionCell extends BreedingPosition {
    side?: BreedingExpansionSide | null;
    owner?: BreedingOwnerValue;
}

interface BreedingExpansionState {
    active?: boolean;
    side?: BreedingExpansionSide | null;
    row?: number | null;
    col?: number | null;
    owner?: BreedingOwnerValue;
    cells?: BreedingExpansionCell[];
}

interface BreedingGameState {
    board?: BreedingOwnerValue[][];
    boardExpansion?: BreedingExpansionState | null;
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
    resolveBoardBounds?: (board: BreedingOwnerValue[][] | undefined) => BreedingBoardBounds | null;
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
    [key: string]: unknown;
}

interface BreedingSpawnResult {
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

interface BreedingModuleApi {
    processBreedingEffects(cardState: BreedingCardState, gameState: BreedingGameState, playerKey: BreedingSeatKey, prng: BreedingRandomLike, deps?: BreedingProcessDeps): BreedingProcessResult;
    processBreedingEffectsAtAnchor(cardState: BreedingCardState, gameState: BreedingGameState, playerKey: BreedingSeatKey, row: number, col: number, prng: BreedingRandomLike, deps?: BreedingProcessDeps): BreedingImmediateResult;
    processBreedingEffectsAtTurnStartAnchor(cardState: BreedingCardState, gameState: BreedingGameState, playerKey: BreedingSeatKey, row: number, col: number, prng: BreedingRandomLike, deps?: BreedingProcessDeps): BreedingProcessResult;
    spawnAndFlipBatch(cardState: BreedingCardState, gameState: BreedingGameState, playerKey: BreedingSeatKey, player: BreedingOwnerValue, targets: BreedingPosition[], cause: string, reason: string, anchorPos: BreedingPosition, deps: BreedingProcessDeps): BreedingBatchResult;
}

interface BreedingSpawnAndFlipModule {
    spawnAndFlipBatch?: (cardState: BreedingCardState, gameState: BreedingGameState, playerKey: BreedingSeatKey, player: BreedingOwnerValue, targets: BreedingPosition[], cause: string, reason: string, anchorPos: BreedingPosition, deps: BreedingProcessDeps) => BreedingBatchResult;
}

interface BreedingRoot {
    SharedConstants?: BreedingSharedConstants;
    SharedBoardUtils?: BreedingSharedBoardUtilsModule | null;
    CardRandomSource?: BreedingRandomSourceModule | null;
    CardSpawnAndFlip?: BreedingSpawnAndFlipModule | null;
    CardBreeding?: BreedingModuleApi;
}

function _resolveSpawnAndFlipRuntimeModule(root: BreedingRoot): BreedingSpawnAndFlipModule | null {
    if (root && root.CardSpawnAndFlip && typeof root.CardSpawnAndFlip.spawnAndFlipBatch === 'function') {
        return root.CardSpawnAndFlip;
    }
    try {
        if (typeof require === 'function') {
            const requiredModule = require('../cards-internal/spawn-and-flip');
            if (requiredModule && typeof requiredModule.spawnAndFlipBatch === 'function') {
                return requiredModule;
            }
        }
    } catch (_error) { /* ignore */ }
    return null;
}

const CardBreeding = /**
 * @file breeding.js
 * @description Breeding effect helpers (Shared between Browser and Headless)
 */

(function (root: BreedingRoot, factory: (constants: BreedingSharedConstants, boardUtils: BreedingSharedBoardUtilsModule | null, randomSource: BreedingRandomSourceModule | null, spawnAndFlipModule: BreedingSpawnAndFlipModule | null) => BreedingModuleApi) {
    if (root && root.SharedConstants) {
        return root.CardBreeding = factory(root.SharedConstants, root.SharedBoardUtils || null, root.CardRandomSource || null, _resolveSpawnAndFlipRuntimeModule(root));
    }
    if (typeof module === 'object' && module.exports) {
        return module.exports = factory(
            require('../../../shared-constants'),
            require('../../../shared/shared-board-utils'),
            require('../cards-internal/random-source'),
            require('../cards-internal/spawn-and-flip')
        );
    } else {
        if (!root.SharedConstants) throw new Error('SharedConstants missing required values');
        return root.CardBreeding = factory(root.SharedConstants, root.SharedBoardUtils || null, root.CardRandomSource || null, _resolveSpawnAndFlipRuntimeModule(root));
    }
}(typeof self !== 'undefined' ? self as unknown as BreedingRoot : globalThis as unknown as BreedingRoot, function (SharedConstants: BreedingSharedConstants, SharedBoardUtils: BreedingSharedBoardUtilsModule | null, RandomSourceModule: BreedingRandomSourceModule | null, SpawnAndFlipModule: BreedingSpawnAndFlipModule | null) {
    'use strict';

    const { BLACK, WHITE, EMPTY } = SharedConstants || {};
    const sharedSpawnAndFlipBatch = SpawnAndFlipModule && typeof SpawnAndFlipModule.spawnAndFlipBatch === 'function'
        ? SpawnAndFlipModule.spawnAndFlipBatch
        : null;

    if (BLACK === undefined || WHITE === undefined || EMPTY === undefined) {
        throw new Error('SharedConstants missing required values');
    }

    function _resolveBoardBounds(gameState: BreedingGameState): BreedingBoardBounds | null {
        if (SharedBoardUtils && typeof SharedBoardUtils.resolveBoardBounds === 'function') {
            return SharedBoardUtils.resolveBoardBounds(gameState && gameState.board);
        }
        const board = gameState && gameState.board;
        if (!Array.isArray(board) || board.length <= 0) return null;
        let maxCol = -1;
        for (const row of board) {
            if (Array.isArray(row) && row.length > 0) {
                maxCol = Math.max(maxCol, row.length - 1);
            }
        }
        if (maxCol < 0) return null;
        return { minRow: 0, maxRow: board.length - 1, minCol: 0, maxCol };
    }

    function _isMainBoardCell(gameState: BreedingGameState, row: number, col: number): boolean {
        const bounds = _resolveBoardBounds(gameState);
        return !!(
            bounds &&
            Number.isInteger(row) &&
            Number.isInteger(col) &&
            row >= bounds.minRow &&
            row <= bounds.maxRow &&
            col >= bounds.minCol &&
            col <= bounds.maxCol
        );
    }

    function _resolveExpansionSide(side: unknown, row: number, col: number, gameState: BreedingGameState): BreedingExpansionSide | null {
        const bounds = _resolveBoardBounds(gameState);
        if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
        if (!bounds) return null;
        if (col === -1) return 'left';
        if (col === (bounds.maxCol + 1)) return 'right';
        if (row === -1) return 'top';
        if (row === (bounds.maxRow + 1)) return 'bottom';
        return null;
    }

    function _getExpansionCellRef(gameState: BreedingGameState, row: number, col: number): { expansion: BreedingExpansionState; index: number; cell: BreedingExpansionCell | BreedingExpansionState; legacy: boolean } | null {
        const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
            ? gameState.boardExpansion
            : null;
        if (!expansion) return null;

        if (Array.isArray(expansion.cells)) {
            for (let index = 0; index < expansion.cells.length; index++) {
                const cell = expansion.cells[index];
                if (!cell || typeof cell !== 'object') continue;
                const bounds = _resolveBoardBounds(gameState);
                const cellCol = Number.isInteger(cell.col)
                    ? cell.col
                    : (cell.side === 'left' ? -1 : (cell.side === 'right' && bounds ? bounds.maxCol + 1 : null));
                if (!Number.isInteger(cellCol)) continue;
                if (cell.row === row && cellCol === col) {
                    return { expansion, index, cell, legacy: false };
                }
            }
        }

        if (expansion.active === true) {
            const bounds = _resolveBoardBounds(gameState);
            const legacyCol = Number.isInteger(expansion.col)
                ? expansion.col
                : (expansion.side === 'left' ? -1 : (expansion.side === 'right' && bounds ? bounds.maxCol + 1 : null));
            if (expansion.row === row && legacyCol === col) {
                return { expansion, index: -1, cell: expansion, legacy: true };
            }
        }

        return null;
    }

    function _getBoardCell(gameState: BreedingGameState, row: number, col: number): BreedingOwnerValue | null {
        if (_isMainBoardCell(gameState, row, col)) {
            if (!gameState || !Array.isArray(gameState.board)) return null;
            const boardRow = gameState.board[row];
            if (!Array.isArray(boardRow)) return null;
            return boardRow[col];
        }
        const ref = _getExpansionCellRef(gameState, row, col);
        return ref ? Number(ref.cell.owner) : null;
    }

    function _setBoardCell(gameState: BreedingGameState, row: number, col: number, value: BreedingOwnerValue): boolean {
        if (_isMainBoardCell(gameState, row, col)) {
            if (!gameState || !Array.isArray(gameState.board)) return false;
            const boardRow = gameState.board[row];
            if (!Array.isArray(boardRow)) return false;
            boardRow[col] = value;
            return true;
        }

        const ref = _getExpansionCellRef(gameState, row, col);
        if (!ref) return false;
        const normalizedOwner = (value === BLACK || value === WHITE) ? value : EMPTY;

        if (!ref.legacy) {
            if (!Array.isArray(ref.expansion.cells)) return false;
            ref.expansion.cells[ref.index] = {
                side: _resolveExpansionSide(ref.cell.side, row, col, gameState),
                row,
                col,
                owner: normalizedOwner
            };
            return true;
        }

        ref.expansion.side = _resolveExpansionSide(ref.cell.side, row, col, gameState);
        ref.expansion.row = row;
        ref.expansion.col = col;
        ref.expansion.owner = normalizedOwner;
        return true;
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
                return deps.isBlockedCell(cardState, row, col, gameState) === true;
            } catch (e) { /* ignore and fallback */ }
        }
        const rowNum = Number(row);
        const colNum = Number(col);
        if (!Number.isInteger(rowNum) || !Number.isInteger(colNum)) return false;
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.some((marker) => {
            if (!marker || marker.kind !== 'specialStone') return false;
            if (!marker.data || marker.data.type !== 'BLOCKADE') return false;
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
                    if (_getBoardCell(gameState, r, c) !== EMPTY) continue;
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
            const context = getCardContext(cardState);
            const flips = getFlipsWithContext(gameState, target.row, target.col, player, context);

            let spawnRes = null;
            if (deps.BoardOps && typeof deps.BoardOps.spawnAt === 'function') {
                spawnRes = deps.BoardOps.spawnAt(cardState, gameState, target.row, target.col, playerKey, cause, reason);
            } else {
                _setBoardCell(gameState, target.row, target.col, player);
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
                    _setBoardCell(gameState, fr, fc, player);
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
        if (_getBoardCell(gameState, row, col) !== player) {
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
        const brokenFrontier = previousFrontier.some(p => _getBoardCell(gameState, p.row, p.col) !== player);
        const origins = previousFrontier.length === 0 || brokenFrontier
            ? [{ row, col }]
            : previousFrontier;
        const targets = _collectEmptyNeighborTargets(cardState, gameState, origins, deps);
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
        if (_getBoardCell(gameState, row, col) !== player) return { spawned, destroyed, flipped };

        const targets = _collectEmptyNeighborTargets(cardState, gameState, [{ row, col }], deps);
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
}));

export = CardBreeding;
