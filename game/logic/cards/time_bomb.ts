/**
 * @file time_bomb.ts
 * @description Time Bomb helpers (Shared between Browser and Headless)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';

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

function resolveTimeBombModuleOrGlobal(id: string, globalKey: string): any {
    if (typeof module === 'object' && module.exports) {
        return safeRequire(id) || getRuntimeGlobalValue(globalKey);
    }

    return getRuntimeGlobalValue(globalKey);
}

const SharedConstants = resolveTimeBombModuleOrGlobal('../../../shared-constants', 'SharedConstants');
const BoardOpsModule = resolveTimeBombModuleOrGlobal('../board_ops', 'BoardOps');
const CardMarkersModule = resolveTimeBombModuleOrGlobal('./markers', 'CardMarkers');

const { TIME_BOMB_TURNS } = SharedConstants || {};
const BOMB_CATEGORY = 'bomb';
const TIME_BOMB_DESTROY_CAUSE = 'TIME_BOMB';
const TIME_BOMB_DESTROY_REASON = 'bomb_explosion';
const TIME_BOMB_PROJECTILE_STONE = 'time_bomb';

function getCardMarkersModule(): any {
    if (CardMarkersModule) return CardMarkersModule;
    return getRuntimeGlobalValue('CardMarkers') || null;
}

function getBombMarkers(cardState: CardState): any[] {
    const cardMarkers = getCardMarkersModule();
    if (cardMarkers && typeof cardMarkers.getBombMarkers === 'function') {
        return cardMarkers.getBombMarkers(cardState);
    }
    const markers = (cardState && Array.isArray((cardState as any).markers)) ? (cardState as any).markers : [];
    return markers.filter((marker: any) => !!(
        marker &&
        (
            marker.kind === BOMB_CATEGORY ||
            (marker.kind === 'specialStone' && marker.data && (marker.data.category === BOMB_CATEGORY || marker.data.type === 'TIME_BOMB'))
        )
    ));
}

function isBombCategoryMarker(marker: any): boolean {
    const cardMarkers = getCardMarkersModule();
    if (cardMarkers && typeof cardMarkers.isBombCategoryMarker === 'function') {
        return cardMarkers.isBombCategoryMarker(marker);
    }
    return !!(
        marker &&
        (
            marker.kind === BOMB_CATEGORY ||
            (marker.kind === 'specialStone' && marker.data && (marker.data.category === BOMB_CATEGORY || marker.data.type === 'TIME_BOMB'))
        )
    );
}

function normalizeExpansionOwner(owner: any): number {
    return (owner === 1 || owner === -1) ? owner : 0;
}

interface BoardDims {
    rows: number;
    cols: number;
}

function resolveBoardDims(gameState: GameState): BoardDims {
    const board = gameState && Array.isArray((gameState as any).board) ? (gameState as any).board : null;
    const rows = board && board.length > 0 ? board.length : 8;
    const cols = board && Array.isArray(board[0]) && board[0].length > 0 ? board[0].length : rows;
    return { rows, cols };
}

function isMainBoardCell(row: number, col: number, gameState: GameState): boolean {
    const dims = resolveBoardDims(gameState);
    return Number.isInteger(row) && row >= 0 && row < dims.rows && Number.isInteger(col) && col >= 0 && col < dims.cols;
}

function resolveExpansionSide(side: any, row: number, col: number, gameState: GameState): string | null {
    if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
    const dims = resolveBoardDims(gameState);
    if (col === -1) return 'left';
    if (col === dims.cols) return 'right';
    if (row === -1) return 'top';
    if (row === dims.rows) return 'bottom';
    return null;
}

function isExpansionCoordinate(row: number, col: number, gameState: GameState): boolean {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    const dims = resolveBoardDims(gameState);
    if (row < -1 || row > dims.rows || col < -1 || col > dims.cols) return false;
    if (isMainBoardCell(row, col, gameState)) return false;
    return true;
}

function syncLegacyExpansionFields(expansion: any, gameState: GameState): void {
    if (!expansion || typeof expansion !== 'object') return;
    if (!Array.isArray(expansion.cells)) expansion.cells = [];
    const latest = expansion.cells.length > 0 ? expansion.cells[expansion.cells.length - 1] : null;
    expansion.active = !!latest;
    expansion.side = latest ? resolveExpansionSide(latest.side, latest.row, latest.col, gameState) : null;
    expansion.row = latest ? latest.row : null;
    expansion.owner = latest ? normalizeExpansionOwner(latest.owner) : 0;
}

function getExpansionCells(gameState: GameState): any[] {
    if (BoardOpsModule && typeof BoardOpsModule.getExpansionDescriptors === 'function') {
        return BoardOpsModule.getExpansionDescriptors(gameState);
    }
    const expansion = (gameState && (gameState as any).boardExpansion && typeof (gameState as any).boardExpansion === 'object')
        ? (gameState as any).boardExpansion
        : null;
    if (!expansion) return [];

    const cells: any[] = [];
    const pushCell = (source: any, legacyRow?: any, legacyOwner?: any) => {
        let side: any = null;
        let row: any = null;
        let col: any = null;
        let owner: any = legacyOwner;

        if (source && typeof source === 'object') {
            side = source.side;
            row = source.row;
            col = source.col;
            owner = source.owner;
            if (!Number.isInteger(col) && side === 'left') col = -1;
            if (!Number.isInteger(col) && side === 'right') col = resolveBoardDims(gameState).cols;
        } else {
            side = source;
            row = legacyRow;
            if (side === 'left') col = -1;
            if (side === 'right') col = resolveBoardDims(gameState).cols;
        }

        if (!isExpansionCoordinate(row, col, gameState)) return;
        if (cells.some((cell) => cell && cell.row === row && cell.col === col)) return;
        cells.push({
            side: resolveExpansionSide(side, row, col, gameState),
            row,
            col,
            owner: normalizeExpansionOwner(owner)
        });
    };

    if (Array.isArray(expansion.cells)) {
        for (const cell of expansion.cells) {
            if (!cell || typeof cell !== 'object') continue;
            pushCell(cell);
        }
    }

    if (cells.length === 0 && expansion.active === true) {
        pushCell(expansion);
    }

    return cells;
}

function ensureExpansionStateMutable(gameState: GameState): any {
    if (!(gameState as any).boardExpansion || typeof (gameState as any).boardExpansion !== 'object') {
        (gameState as any).boardExpansion = {
            active: false,
            side: null,
            row: null,
            owner: 0,
            usedByPlayer: { black: false, white: false },
            cells: []
        };
        return (gameState as any).boardExpansion;
    }
    const expansion = (gameState as any).boardExpansion;
    const cells = getExpansionCells(gameState);
    expansion.cells = cells.map((cell: any) => ({
        side: cell.side,
        row: cell.row,
        col: cell.col,
        owner: normalizeExpansionOwner(cell.owner)
    }));
    syncLegacyExpansionFields(expansion, gameState);
    return expansion;
}

function getCellValue(gameState: GameState, row: number, col: number): any {
    if (BoardOpsModule && typeof BoardOpsModule.getCellValue === 'function') {
        return BoardOpsModule.getCellValue(gameState, row, col);
    }
    if (isMainBoardCell(row, col, gameState)) return (gameState as any).board[row][col];
    const expansionCells = getExpansionCells(gameState);
    for (const expansion of expansionCells) {
        if (!expansion) continue;
        if (expansion.row === row && expansion.col === col) return expansion.owner;
    }
    return null;
}

function setCellValue(gameState: GameState, row: number, col: number, value: any): boolean {
    if (BoardOpsModule && typeof BoardOpsModule.setCellValue === 'function') {
        return BoardOpsModule.setCellValue(gameState, row, col, value);
    }
    if (isMainBoardCell(row, col, gameState)) {
        (gameState as any).board[row][col] = value;
        return true;
    }
    const expansionState = ensureExpansionStateMutable(gameState);
    if (!Array.isArray(expansionState.cells)) return false;
    const normalizedOwner = normalizeExpansionOwner(value);
    for (let i = 0; i < expansionState.cells.length; i++) {
        const cell = expansionState.cells[i];
        if (!cell) continue;
        const cellCol = Number.isInteger(cell.col)
            ? cell.col
            : (cell.side === 'left' ? -1 : (cell.side === 'right' ? resolveBoardDims(gameState).cols : null));
        if (cellCol === null) continue;
        if (cell.row === row && cellCol === col) {
            expansionState.cells[i] = {
                side: resolveExpansionSide(cell.side, cell.row, cellCol, gameState),
                row: cell.row,
                col: cellCol,
                owner: normalizedOwner
            };
            syncLegacyExpansionFields(expansionState, gameState);
            return true;
        }
    }
    return false;
}

function forEachNeighborCell(gameState: GameState, row: number, col: number, handler: (r: number, c: number, value: any) => void): void {
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const r = row + dr;
            const c = col + dc;
            const value = getCellValue(gameState, r, c);
            if (value === null) continue;
            handler(r, c, value);
        }
    }
}

function getExplosionTargetsSnapshot(gameState: GameState, row: number, col: number): Array<{ row: number; col: number }> {
    const targets: Array<{ row: number; col: number }> = [];
    forEachNeighborCell(gameState, row, col, (r, c, value) => {
        if (value === null || value === 0) return;
        targets.push({ row: r, col: c });
    });
    return targets;
}

function buildTimeBombDestroyMeta(bomb: any, forbiddenEvadeCells: Array<{ row: number; col: number }>): any {
    return {
        sourceRow: bomb && Number.isInteger(bomb.row) ? bomb.row : null,
        sourceCol: bomb && Number.isInteger(bomb.col) ? bomb.col : null,
        projectileOwner: bomb && bomb.owner ? bomb.owner : null,
        projectileStone: TIME_BOMB_PROJECTILE_STONE,
        forbiddenEvadeCells
    };
}

interface TimeBombDeps {
    addMarker?: (cs: CardState, kind: string, r: number, c: number, owner: PlayerKey, data: any) => { placed: boolean };
    getTimeBombTargets?: (cardState: CardState, gameState: GameState, playerKey: PlayerKey) => any[];
    removeMarkersAt?: (cardState: CardState, row: number, col: number, options?: any) => void;
    destroyAt?: (cardState: CardState, gameState: GameState, row: number, col: number) => boolean;
    BoardOps?: any;
    specialStoneKind?: string;
    emitPresentationEvent?: (cardState: CardState, event: any) => void;
}

function applyTimeBomb(cardState: CardState, playerKey: PlayerKey, row: number, col: number, deps: TimeBombDeps = {}): { placed: boolean; reason?: string } {
    const addMarker = deps.addMarker || ((cs: any, kind: string, r: number, c: number, owner: PlayerKey, data: any) => {
        const cardMarkers = getCardMarkersModule();
        if (cardMarkers && typeof cardMarkers.addMarker === 'function') {
            cardMarkers.addMarker(cs, kind, r, c, owner, { ...data });
            return { placed: true };
        }
        if (!cs.markers) cs.markers = [];
        if (typeof cs._nextMarkerId !== 'number') cs._nextMarkerId = 1;
        const id = cs._nextMarkerId++;
        if (typeof cs._nextCreatedSeq !== 'number') cs._nextCreatedSeq = 1;
        const createdSeq = cs._nextCreatedSeq++;
        cs.markers.push({
            id,
            row: r,
            col: c,
            kind: 'specialStone',
            owner,
            createdSeq,
            data: {
                type: 'TIME_BOMB',
                category: 'bomb',
                remainingTurns: data.remainingTurns,
                placedTurn: data.placedTurn
            }
        });
        return { placed: true };
    });

    const bombs = getBombMarkers(cardState);
    if (bombs.some((b: any) => b.row === row && b.col === col)) return { placed: false, reason: 'exists' };

    addMarker(cardState, 'specialStone', row, col, playerKey, {
        type: 'TIME_BOMB',
        category: 'bomb',
        remainingTurns: TIME_BOMB_TURNS,
        placedTurn: (cardState as any).turnIndex
    });
    return { placed: true };
}

function applyTimeBombWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: TimeBombDeps = {}): { applied: boolean; reason?: string; row?: number; col?: number } {
    const pending = cardState && (cardState as any).pendingEffectByPlayer && (cardState as any).pendingEffectByPlayer[playerKey];
    if (!pending || pending.type !== 'TIME_BOMB' || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'not_pending' };
    }

    const getTimeBombTargets = deps.getTimeBombTargets || (() => []);
    const targets = getTimeBombTargets(cardState, gameState, playerKey);
    const allowed = Array.isArray(targets) && targets.some((target: any) => target && target.row === row && target.col === col);
    if (!allowed) return { applied: false, reason: 'invalid_target' };

    const removeMarkersAt = deps.removeMarkersAt || (() => { });
    removeMarkersAt(cardState, row, col, { kind: deps.specialStoneKind || 'specialStone' });

    const placement = applyTimeBomb(cardState, playerKey, row, col, {
        addMarker: deps.addMarker
    });
    if (!placement || placement.placed !== true) {
        return { applied: false, reason: placement && placement.reason ? placement.reason : 'failed' };
    }

    if (typeof deps.emitPresentationEvent === 'function') {
        deps.emitPresentationEvent(cardState, {
            type: 'STATUS_APPLIED',
            row,
            col,
            meta: {
                special: 'TIME_BOMB',
                owner: playerKey,
                timer: TIME_BOMB_TURNS,
                reason: 'time_bomb_selected'
            }
        });
    }

    (cardState as any).pendingEffectByPlayer[playerKey] = null;
    return { applied: true, row, col };
}

interface TickResult {
    exploded: Array<{ row: number; col: number }>;
    destroyed: Array<{ row: number; col: number }>;
}

function tickBombs(cardState: CardState, gameState: GameState, playerKey: PlayerKey, deps: TimeBombDeps = {}): TickResult {
    const removeMarkersAt = deps.removeMarkersAt || ((cs: any, r: number, c: number, options?: any) => {
        const cardMarkers = getCardMarkersModule();
        if (cardMarkers && typeof cardMarkers.removeMarkersAt === 'function') {
            cardMarkers.removeMarkersAt(cs, r, c, options);
            return;
        }
        if (cs.markers) cs.markers = cs.markers.filter((m: any) => !(m.row === r && m.col === c));
    });
    const destroyAt = deps.destroyAt || ((cs: any, gs: GameState, r: number, c: number) => {
        const current = getCellValue(gs, r, c);
        if (current === null || current === 0) return false;
        removeMarkersAt(cs, r, c);
        setCellValue(gs, r, c, 0);
        return true;
    });

    const exploded: Array<{ row: number; col: number }> = [];
    const destroyed: Array<{ row: number; col: number }> = [];
    const activeKey = playerKey || (cardState as any).lastTurnStartedFor;
    const bombs = getBombMarkers(cardState);
    const removeIds = new Set<string | number>();

    for (const bomb of bombs) {
        if (activeKey && bomb.owner !== activeKey) {
            continue;
        }
        if (bomb.data && bomb.data.placedTurn === (cardState as any).turnIndex) {
            continue;
        }
        if (!bomb.data) bomb.data = {};
        bomb.data.remainingTurns = (typeof bomb.data.remainingTurns === 'number') ? bomb.data.remainingTurns - 1 : -1;
        if (bomb.data.remainingTurns <= 0) {
            exploded.push({ row: bomb.row, col: bomb.col });
            const targets = getExplosionTargetsSnapshot(gameState, bomb.row, bomb.col);
            const forbiddenEvadeCells: Array<{ row: number; col: number }> = [];
            forEachNeighborCell(gameState, bomb.row, bomb.col, (r, c, value) => {
                if (value === null) return;
                forbiddenEvadeCells.push({ row: r, col: c });
            });
            const destroyTargets = () => {
                for (const target of targets) {
                    if (!target) continue;
                    let destroyedRes = false;
                    if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                        const res = deps.BoardOps.destroyAt(
                            cardState,
                            gameState,
                            target.row,
                            target.col,
                            TIME_BOMB_DESTROY_CAUSE,
                            TIME_BOMB_DESTROY_REASON,
                            buildTimeBombDestroyMeta(bomb, forbiddenEvadeCells)
                        );
                        destroyedRes = !!(res && res.destroyed);
                    } else {
                        destroyedRes = destroyAt(cardState, gameState, target.row, target.col);
                    }
                    if (destroyedRes) {
                        destroyed.push({ row: target.row, col: target.col });
                    }
                }
            };
            if (deps.BoardOps && typeof deps.BoardOps.runDestroyBlock === 'function') {
                deps.BoardOps.runDestroyBlock(cardState, gameState, destroyTargets, {});
            } else {
                destroyTargets();
            }
            if (bomb.id !== undefined) {
                removeIds.add(bomb.id);
            } else {
                removeIds.add(`${bomb.row},${bomb.col},${bomb.owner}`);
            }
        }
    }

    if (removeIds.size > 0) {
        (cardState as any).markers = ((cardState as any).markers || []).filter((m: any) => {
            if (!isBombCategoryMarker(m)) return true;
            if (removeIds.has(m.id)) return false;
            return !removeIds.has(`${m.row},${m.col},${m.owner}`);
        });
    }
    return { exploded, destroyed };
}

interface TickBombAtResult {
    exploded: Array<{ row: number; col: number }>;
    destroyed: Array<{ row: number; col: number }>;
    removed: boolean;
}

function tickBombAt(cardState: CardState, gameState: GameState, bomb: any, activeKey: PlayerKey | undefined, deps: TimeBombDeps = {}): TickBombAtResult {
    if (!bomb) return { exploded: [], destroyed: [], removed: false };

    const removeMarkersAt = deps.removeMarkersAt || ((cs: any, r: number, c: number, options?: any) => {
        const cardMarkers = getCardMarkersModule();
        if (cardMarkers && typeof cardMarkers.removeMarkersAt === 'function') {
            cardMarkers.removeMarkersAt(cs, r, c, options);
            return;
        }
        if (cs.markers) cs.markers = cs.markers.filter((m: any) => !(m.row === r && m.col === c));
    });
    const destroyAt = deps.destroyAt || ((cs: any, gs: GameState, r: number, c: number) => {
        const current = getCellValue(gs, r, c);
        if (current === null || current === 0) return false;
        removeMarkersAt(cs, r, c);
        setCellValue(gs, r, c, 0);
        return true;
    });

    const bombs = getBombMarkers(cardState);
    const idx = bombs.findIndex((b: any) =>
        (bomb.id !== undefined && b.id === bomb.id) ||
        (b.row === bomb.row && b.col === bomb.col && b.owner === bomb.owner && b.createdSeq === bomb.createdSeq)
    );
    if (idx === -1) return { exploded: [], destroyed: [], removed: false };

    const b = bombs[idx];
    if (activeKey && b.owner !== activeKey) return { exploded: [], destroyed: [], removed: false };
    if (b.data && b.data.placedTurn === (cardState as any).turnIndex) return { exploded: [], destroyed: [], removed: false };

    if (!b.data) b.data = {};
    b.data.remainingTurns = (typeof b.data.remainingTurns === 'number') ? b.data.remainingTurns - 1 : -1;
    if (b.data.remainingTurns > 0) return { exploded: [], destroyed: [], removed: false };

    const exploded = [{ row: b.row, col: b.col }];
    const destroyed: Array<{ row: number; col: number }> = [];
    const targets = getExplosionTargetsSnapshot(gameState, b.row, b.col);
    const forbiddenEvadeCells: Array<{ row: number; col: number }> = [];
    forEachNeighborCell(gameState, b.row, b.col, (r, c, value) => {
        if (value === null) return;
        forbiddenEvadeCells.push({ row: r, col: c });
    });
    const destroyTargets = () => {
        for (const target of targets) {
            if (!target) continue;
            let destroyedRes = false;
            if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                const res = deps.BoardOps.destroyAt(
                    cardState,
                    gameState,
                    target.row,
                    target.col,
                    TIME_BOMB_DESTROY_CAUSE,
                    TIME_BOMB_DESTROY_REASON,
                    buildTimeBombDestroyMeta(b, forbiddenEvadeCells)
                );
                destroyedRes = !!(res && res.destroyed);
            } else {
                destroyedRes = destroyAt(cardState, gameState, target.row, target.col);
            }
            if (destroyedRes) destroyed.push({ row: target.row, col: target.col });
        }
    };
    if (deps.BoardOps && typeof deps.BoardOps.runDestroyBlock === 'function') {
        deps.BoardOps.runDestroyBlock(cardState, gameState, destroyTargets, {});
    } else {
        destroyTargets();
    }

    const cardMarkers = getCardMarkersModule();
    if (b.id !== undefined && cardMarkers && typeof cardMarkers.removeMarkerById === 'function') {
        cardMarkers.removeMarkerById(cardState, b.id);
    } else if (b.id !== undefined) {
        (cardState as any).markers = ((cardState as any).markers || []).filter((m: any) => m.id !== b.id);
    } else {
        removeMarkersAt(cardState, b.row, b.col, { category: 'bomb', owner: b.owner });
    }
    return { exploded, destroyed, removed: true };
}

export = {
    applyTimeBomb,
    applyTimeBombWill,
    tickBombs,
    tickBombAt
};
