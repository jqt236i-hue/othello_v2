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
const ExpansionFallbackModule = resolveTimeBombModuleOrGlobal('../cards-internal/expansion-fallback', 'CardExpansionFallback');

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

if (!ExpansionFallbackModule) {
    throw new Error('CardExpansionFallback missing required helpers');
}

interface BoardDims {
    rows: number;
    cols: number;
}

const resolveBoardDims = ExpansionFallbackModule.resolveBoardDims as (gameState: GameState) => BoardDims;

function getExpansionCells(gameState: GameState): any[] {
    if (BoardOpsModule && typeof BoardOpsModule.getExpansionDescriptors === 'function') {
        return BoardOpsModule.getExpansionDescriptors(gameState);
    }
    return ExpansionFallbackModule.getExpansionCells(gameState);
}

function getCellValue(gameState: GameState, row: number, col: number): any {
    if (BoardOpsModule && typeof BoardOpsModule.getCellValue === 'function') {
        return BoardOpsModule.getCellValue(gameState, row, col);
    }
    return ExpansionFallbackModule.getCellValue(gameState, row, col);
}

function setCellValue(gameState: GameState, row: number, col: number, value: any): boolean {
    if (BoardOpsModule && typeof BoardOpsModule.setCellValue === 'function') {
        return BoardOpsModule.setCellValue(gameState, row, col, value);
    }
    return ExpansionFallbackModule.setCellValue(gameState, row, col, value);
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
