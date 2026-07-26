type SniperOwnerValue = number;
type SniperSeatKey = 'black' | 'white';
type SniperExpansionSide = 'left' | 'right' | 'top' | 'bottom';

interface SniperSharedConstants {
    BLACK: SniperOwnerValue;
    WHITE: SniperOwnerValue;
    EMPTY: SniperOwnerValue;
}

interface SniperExpansionCell {
    side: SniperExpansionSide | null;
    row: number;
    col: number;
    owner: SniperOwnerValue;
}

interface SniperExpansionState {
    active?: boolean;
    side?: SniperExpansionSide | null;
    row?: number | null;
    col?: number | null;
    owner?: SniperOwnerValue;
    usedByPlayer?: Record<string, boolean>;
    cells?: SniperExpansionCell[];
}

interface SniperGameState {
    board?: SniperOwnerValue[][];
    boardExpansion?: SniperExpansionState | null;
    [key: string]: unknown;
}

interface SniperMarkerData {
    type?: string;
    remainingOwnerTurns?: number;
    [key: string]: unknown;
}

interface SniperMarker {
    kind?: string;
    row: number;
    col: number;
    owner?: unknown;
    data?: SniperMarkerData | null;
    [key: string]: unknown;
}

interface SniperCardState {
    markers?: SniperMarker[];
    [key: string]: unknown;
}

interface SniperDestroyMeta {
    sourceRow: number;
    sourceCol: number;
    projectileOwner: SniperSeatKey;
    projectileStone: string;
}

interface SniperBoardOpsModule {
    getExpansionDescriptors?: (gameState: SniperGameState, cardState?: SniperCardState | null) => SniperExpansionCell[];
    getCellValue?: (gameState: SniperGameState, row: number, col: number, cardState?: SniperCardState | null) => SniperOwnerValue | null;
    setCellValue?: (gameState: SniperGameState, row: number, col: number, value: SniperOwnerValue, cardState?: SniperCardState | null) => boolean;
    destroyAt?: (
        cardState: SniperCardState,
        gameState: SniperGameState,
        row: number,
        col: number,
        cause: string,
        reason: string,
        meta: SniperDestroyMeta
    ) => { destroyed?: boolean } | null | undefined;
    revertSpecialStoneAt?: (
        cardState: SniperCardState,
        gameState: SniperGameState,
        row: number,
        col: number,
        specialType: string,
        playerKey: SniperSeatKey,
        cause: string,
        reason: string
    ) => { reverted?: boolean } | null | undefined;
    runEffectBlock?: <T>(cardState: SniperCardState, gameState: SniperGameState, meta: Record<string, unknown>, fn: () => T) => T;
}

interface SniperRandomSourceModule {
    resolveRandomFunction?: (randomLike: SniperRandomLike | null | undefined, fallback: unknown, label: string) => () => number;
}

type SniperRandomLike = (() => number) | { random: () => number };
type SniperDestroyAt = (cardState: SniperCardState, gameState: SniperGameState, row: number, col: number) => boolean;

interface SniperProcessDeps {
    random?: SniperRandomLike | null;
    destroyAt?: SniperDestroyAt;
    BoardOps?: SniperBoardOpsModule | null;
    decrementRemainingOwnerTurns?: boolean;
}

interface SniperEffectTarget {
    row: number;
    col: number;
    distSq: number;
}

interface SniperEffectPosition {
    row: number;
    col: number;
}

interface SniperDestroyedPosition extends SniperEffectPosition {
    sourceRow: number;
    sourceCol: number;
    ownerBefore?: SniperSeatKey;
}

interface SniperExpiredPosition extends SniperEffectPosition {
    owner: SniperSeatKey;
    reason: string;
}

interface SniperTurnStartResult {
    destroyed: SniperDestroyedPosition[];
    expired: SniperExpiredPosition[];
}

interface SniperProcessResult extends SniperTurnStartResult {
    anchors: Array<SniperEffectPosition & { remainingNow: number }>;
}

interface SniperModuleApi {
    processSniperWillEffects(cardState: SniperCardState, gameState: SniperGameState, playerKey: SniperSeatKey, deps?: SniperProcessDeps): SniperProcessResult;
    processSniperWillEffectsAtTurnStartAnchor(cardState: SniperCardState, gameState: SniperGameState, playerKey: SniperSeatKey, row: number, col: number, deps?: SniperProcessDeps): SniperTurnStartResult;
}

interface SniperRoot {
    SharedConstants?: SniperSharedConstants;
    SharedBoardUtils?: any;
    BoardOps?: SniperBoardOpsModule | null;
    CardRandomSource?: SniperRandomSourceModule | null;
    CardSniper?: SniperModuleApi;
}

const CardSniper = /**
 * @file sniper.js
 * @description Sniper Will effect helpers
 */

(function (root: SniperRoot, factory: (constants: SniperSharedConstants, boardOps: SniperBoardOpsModule | null, randomSource: SniperRandomSourceModule | null, boardUtils: any) => SniperModuleApi) {
    if (root && root.SharedConstants) {
        return root.CardSniper = factory(root.SharedConstants, root.BoardOps || null, root.CardRandomSource || null, root.SharedBoardUtils || null);
    }
    if (typeof module === 'object' && module.exports) {
        return module.exports = factory(require('../../../shared-constants'), require('../board_ops'), require('../cards-internal/random-source'), require('../../../shared/shared-board-utils'));
    } else {
        if (!root.SharedConstants) throw new Error('SharedConstants missing required values');
        return root.CardSniper = factory(root.SharedConstants, root.BoardOps || null, root.CardRandomSource || null, root.SharedBoardUtils || null);
    }
}(typeof self !== 'undefined' ? self as unknown as SniperRoot : globalThis as unknown as SniperRoot, function (SharedConstants: SniperSharedConstants, BoardOpsModule: SniperBoardOpsModule | null, RandomSourceModule: SniperRandomSourceModule | null, BoardUtils: any) {
    'use strict';

    const { BLACK, WHITE, EMPTY } = SharedConstants || {};
    const CardMarkersModule = (() => {
        try {
            if (typeof require === 'function') {
                return require('./markers');
            }
        } catch (_error) { /* ignore */ }
        return null;
    })();

    if (BLACK === undefined || WHITE === undefined || EMPTY === undefined) {
        throw new Error('SharedConstants missing required values');
    }
    const MANIFEST_STONE_TYPES = new Set(['THEORY_INCARNATION', 'BOARD_EXECUTOR', 'OBSERVER_WILL']);

    if (!BoardUtils ||
        typeof BoardUtils.createBoardContext !== 'function' ||
        typeof BoardUtils.collectBoardCoordinates !== 'function' ||
        typeof BoardUtils.getCellValue !== 'function' ||
        typeof BoardUtils.setCellValue !== 'function') {
        throw new Error('SharedBoardUtils BoardContext access is required by CardSniper');
    }

    function createBoardContext(gameState: SniperGameState, cardState: SniperCardState): any {
        return BoardUtils.createBoardContext(gameState, cardState);
    }

    function collectBoardCells(gameState: SniperGameState, cardState: SniperCardState): Array<{ row: number; col: number; owner: SniperOwnerValue | null }> {
        const context = createBoardContext(gameState, cardState);
        return BoardUtils.collectBoardCoordinates(context).map((cell: { row: number; col: number }) => ({
            row: cell.row,
            col: cell.col,
            owner: BoardUtils.getCellValue(context, cell.row, cell.col)
        }));
    }

    function getCellValue(gameState: SniperGameState, row: number, col: number, cardState: SniperCardState): SniperOwnerValue | null {
        return BoardUtils.getCellValue(createBoardContext(gameState, cardState), row, col);
    }

    function setCellValue(gameState: SniperGameState, row: number, col: number, value: SniperOwnerValue, cardState: SniperCardState): boolean {
        return BoardUtils.setCellValue(createBoardContext(gameState, cardState), row, col, value);
    }

    function cleanupExpiredSnipers(cardState: SniperCardState): void {
        const markers = cardState.markers;
        if (!Array.isArray(markers)) return;
        cardState.markers = markers.filter((m) => (
            m.kind !== 'specialStone' ||
            !m.data ||
            m.data.type !== 'SNIPER' ||
            (Number.isFinite(Number(m.data.remainingOwnerTurns)) && Number(m.data.remainingOwnerTurns) >= 0)
        ));
    }

    function resolveRandomFn(randomLike: SniperRandomLike | null | undefined): () => number {
        if (RandomSourceModule && typeof RandomSourceModule.resolveRandomFunction === 'function') {
            return RandomSourceModule.resolveRandomFunction(randomLike, null, 'CardSniper');
        }
        if (typeof randomLike === 'function') return randomLike;
        if (randomLike && typeof randomLike.random === 'function') {
            return function (): number { return randomLike.random(); };
        }
        throw new Error('CardSniper requires an injected deterministic PRNG.');
    }

    function getOpponentKey(playerKey: SniperSeatKey): SniperSeatKey {
        return playerKey === 'black' ? 'white' : 'black';
    }

    function isManifestTarget(cardState: SniperCardState, row: number, col: number): boolean {
        if (CardMarkersModule && typeof CardMarkersModule.isManifestStoneAt === 'function') {
            return CardMarkersModule.isManifestStoneAt(cardState, row, col) === true;
        }
        return (cardState.markers || []).some((marker) => (
            marker &&
            marker.row === row &&
            marker.col === col &&
            (marker.kind === 'manifestStone' || marker.kind === 'specialStone') &&
            MANIFEST_STONE_TYPES.has(String(marker.data && marker.data.type || '').toUpperCase())
        ));
    }

    function pickNearestEnemyTarget(cardState: SniperCardState, gameState: SniperGameState, sourceRow: number, sourceCol: number, enemyValue: SniperOwnerValue, randomFn: () => number): SniperEffectTarget | null {
        const candidates: SniperEffectTarget[] = [];
        for (const cell of collectBoardCells(gameState, cardState)) {
            if (cell.owner !== enemyValue) continue;
            if (isManifestTarget(cardState, cell.row, cell.col)) continue;
            const dr = cell.row - sourceRow;
            const dc = cell.col - sourceCol;
            const distSq = (dr * dr) + (dc * dc);
            candidates.push({ row: cell.row, col: cell.col, distSq });
        }

        if (!candidates.length) return null;
        let minDistSq = Infinity;
        for (const c of candidates) {
            if (c.distSq < minDistSq) minDistSq = c.distSq;
        }

        const nearest = candidates.filter((c) => c.distSq === minDistSq);
        if (nearest.length <= 1) return nearest[0];
        const raw = Number(randomFn());
        if (!Number.isFinite(raw)) {
            throw new Error('CardSniper received a PRNG that returned a non-finite value.');
        }
        const normalized = Math.max(0, Math.min(0.999999, raw));
        const idx = Math.max(0, Math.min(nearest.length - 1, Math.floor(normalized * nearest.length)));
        return nearest[idx];
    }

    function processSniperWillEffects(cardState: SniperCardState, gameState: SniperGameState, playerKey: SniperSeatKey, deps?: SniperProcessDeps): SniperProcessResult {
        const options = deps || {};
        const randomFn = resolveRandomFn(options.random);
        const destroyed: SniperDestroyedPosition[] = [];
        const anchors: Array<SniperEffectPosition & { remainingNow: number }> = [];
        const expired: SniperExpiredPosition[] = [];

        const playerValue = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const enemyValue = -playerValue;
        const enemyOwnerKey = getOpponentKey(playerKey);

        const destroyAt: SniperDestroyAt = options.destroyAt || ((cs: SniperCardState, gs: SniperGameState, r: number, c: number): boolean => {
            const current = getCellValue(gs, r, c, cs);
            if (current === null || current === EMPTY) return false;
            if (cs.markers) cs.markers = cs.markers.filter((m) => !(m.row === r && m.col === c));
            return setCellValue(gs, r, c, EMPTY, cs);
        });

        const snipers = (cardState.markers || []).filter((m) => (
            m.kind === 'specialStone' &&
            m.data &&
            m.data.type === 'SNIPER' &&
            m.owner === playerKey
        ));

        if (!snipers.length) return { destroyed, anchors, expired };

        for (const sniper of snipers) {
            if (getCellValue(gameState, sniper.row, sniper.col, cardState) !== playerValue) {
                if (sniper.data) sniper.data.remainingOwnerTurns = -1;
                continue;
            }

            const target = pickNearestEnemyTarget(cardState, gameState, sniper.row, sniper.col, enemyValue, randomFn);
            if (target) {
                let destroyedRes = false;
                const destroyMeta: SniperDestroyMeta = {
                    sourceRow: sniper.row,
                    sourceCol: sniper.col,
                    projectileOwner: playerKey,
                    projectileStone: 'normal'
                };
                if (options.BoardOps && typeof options.BoardOps.destroyAt === 'function') {
                    const res = options.BoardOps.destroyAt(cardState, gameState, target.row, target.col, 'SNIPER_WILL', 'sniper_shot', destroyMeta);
                    destroyedRes = !!(res && res.destroyed);
                } else {
                    destroyedRes = destroyAt(cardState, gameState, target.row, target.col);
                }
                if (destroyedRes) {
                    destroyed.push({
                        row: target.row,
                        col: target.col,
                        sourceRow: sniper.row,
                        sourceCol: sniper.col,
                        ownerBefore: enemyOwnerKey
                    });
                }
            }

            const before = (sniper.data && Number.isFinite(Number(sniper.data.remainingOwnerTurns)))
                ? Number(sniper.data.remainingOwnerTurns)
                : 0;
            const afterDec = before - 1;
            if (sniper.data) sniper.data.remainingOwnerTurns = afterDec;
            if (afterDec < 0) continue;

            anchors.push({ row: sniper.row, col: sniper.col, remainingNow: afterDec });

            if (afterDec === 0) {
                let revertedRes = false;
                if (options.BoardOps && typeof options.BoardOps.revertSpecialStoneAt === 'function') {
                    const res = options.BoardOps.revertSpecialStoneAt(cardState, gameState, sniper.row, sniper.col, 'SNIPER', playerKey, 'SNIPER_WILL', 'anchor_expired');
                    revertedRes = !!(res && res.reverted);
                } else {
                    if (cardState.markers) {
                        cardState.markers = cardState.markers.filter((entry) => !(
                            entry &&
                            entry.kind === 'specialStone' &&
                            entry.row === sniper.row &&
                            entry.col === sniper.col &&
                            entry.owner === playerKey &&
                            entry.data &&
                            entry.data.type === 'SNIPER'
                        ));
                    }
                    revertedRes = true;
                }
                if (revertedRes) {
                    expired.push({ row: sniper.row, col: sniper.col, owner: playerKey, reason: 'anchor_expired' });
                }
                if (sniper.data) sniper.data.remainingOwnerTurns = -1;
            }
        }

        cleanupExpiredSnipers(cardState);
        return { destroyed, anchors, expired };
    }

    function processSniperWillEffectsAtTurnStartAnchor(cardState: SniperCardState, gameState: SniperGameState, playerKey: SniperSeatKey, row: number, col: number, deps?: SniperProcessDeps): SniperTurnStartResult {
        const options = deps || {};
        const randomFn = resolveRandomFn(options.random);
        const destroyed: SniperDestroyedPosition[] = [];
        const expired: SniperExpiredPosition[] = [];

        const playerValue = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const enemyValue = -playerValue;
        const enemyOwnerKey = getOpponentKey(playerKey);

        const destroyAt: SniperDestroyAt = options.destroyAt || ((cs: SniperCardState, gs: SniperGameState, r: number, c: number): boolean => {
            const current = getCellValue(gs, r, c, cs);
            if (current === null || current === EMPTY) return false;
            if (cs.markers) cs.markers = cs.markers.filter((m) => !(m.row === r && m.col === c));
            return setCellValue(gs, r, c, EMPTY, cs);
        });

        const sniper = (cardState.markers || []).find((m) => (
            m.kind === 'specialStone' &&
            m.data &&
            m.data.type === 'SNIPER' &&
            m.owner === playerKey &&
            m.row === row &&
            m.col === col
        ));

        if (!sniper) return { destroyed, expired };
        if (getCellValue(gameState, row, col, cardState) !== playerValue) {
            if (sniper.data) sniper.data.remainingOwnerTurns = -1;
            cleanupExpiredSnipers(cardState);
            return { destroyed, expired };
        }

        const resolveAnchor = (): SniperTurnStartResult => {
        const target = pickNearestEnemyTarget(cardState, gameState, row, col, enemyValue, randomFn);
        if (target) {
            let destroyedRes = false;
            const destroyMeta: SniperDestroyMeta = {
                sourceRow: row,
                sourceCol: col,
                projectileOwner: playerKey,
                projectileStone: 'normal'
            };
            if (options.BoardOps && typeof options.BoardOps.destroyAt === 'function') {
                const res = options.BoardOps.destroyAt(cardState, gameState, target.row, target.col, 'SNIPER_WILL', 'sniper_shot', destroyMeta);
                destroyedRes = !!(res && res.destroyed);
            } else {
                destroyedRes = destroyAt(cardState, gameState, target.row, target.col);
            }
            if (destroyedRes) {
                destroyed.push({
                    row: target.row,
                    col: target.col,
                    sourceRow: row,
                    sourceCol: col,
                    ownerBefore: enemyOwnerKey
                });
            }
        }

        const shouldDecrement = options.decrementRemainingOwnerTurns !== false;
        const before = (sniper.data && Number.isFinite(Number(sniper.data.remainingOwnerTurns)))
            ? Number(sniper.data.remainingOwnerTurns)
            : 0;
        const afterDec = shouldDecrement ? (before - 1) : before;
        if (sniper.data) sniper.data.remainingOwnerTurns = afterDec;

        if (shouldDecrement && afterDec === 0) {
            let revertedRes = false;
            if (options.BoardOps && typeof options.BoardOps.revertSpecialStoneAt === 'function') {
                const res = options.BoardOps.revertSpecialStoneAt(cardState, gameState, row, col, 'SNIPER', playerKey, 'SNIPER_WILL', 'anchor_expired');
                revertedRes = !!(res && res.reverted);
            } else {
                if (cardState.markers) {
                    cardState.markers = cardState.markers.filter((entry) => !(
                        entry &&
                        entry.kind === 'specialStone' &&
                        entry.row === row &&
                        entry.col === col &&
                        entry.owner === playerKey &&
                        entry.data &&
                        entry.data.type === 'SNIPER'
                    ));
                }
                revertedRes = true;
            }
            if (revertedRes) {
                expired.push({ row, col, owner: playerKey, reason: 'anchor_expired' });
            }
            if (sniper.data) sniper.data.remainingOwnerTurns = -1;
        }

        if (shouldDecrement && afterDec < 0) {
            if (sniper.data) sniper.data.remainingOwnerTurns = -1;
        }

        cleanupExpiredSnipers(cardState);
        return { destroyed, expired };
        };

        if (options.BoardOps && typeof options.BoardOps.runEffectBlock === 'function') {
            return options.BoardOps.runEffectBlock(cardState, gameState, {
                kind: 'anchor_effect',
                cause: 'SNIPER_WILL',
                reason: 'sniper_shot',
                owner: playerKey,
                sourceRow: row,
                sourceCol: col,
                randomSource: options.random || null
            }, resolveAnchor);
        }
        return resolveAnchor();
    }

    return {
        processSniperWillEffects,
        processSniperWillEffectsAtTurnStartAnchor
    };
}));

export = CardSniper;
