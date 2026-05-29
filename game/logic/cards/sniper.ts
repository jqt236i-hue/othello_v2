type SniperOwnerValue = number;
type SniperSeatKey = 'black' | 'white';
type SniperExpansionSide = 'left' | 'right' | 'top' | 'bottom';

interface SniperSharedConstants {
    BLACK: SniperOwnerValue;
    WHITE: SniperOwnerValue;
    EMPTY: SniperOwnerValue;
}

interface SniperBoardDims {
    rows: number;
    cols: number;
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
    getExpansionDescriptors?: (gameState: SniperGameState) => SniperExpansionCell[];
    getCellValue?: (gameState: SniperGameState, row: number, col: number) => SniperOwnerValue | null;
    setCellValue?: (gameState: SniperGameState, row: number, col: number, value: SniperOwnerValue) => boolean;
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
    BoardOps?: SniperBoardOpsModule | null;
    CardRandomSource?: SniperRandomSourceModule | null;
    CardSniper?: SniperModuleApi;
}

const CardSniper = /**
 * @file sniper.js
 * @description Sniper Will effect helpers
 */

(function (root: SniperRoot, factory: (constants: SniperSharedConstants, boardOps: SniperBoardOpsModule | null, randomSource: SniperRandomSourceModule | null) => SniperModuleApi) {
    if (root && root.SharedConstants) {
        return root.CardSniper = factory(root.SharedConstants, root.BoardOps || null, root.CardRandomSource || null);
    }
    if (typeof module === 'object' && module.exports) {
        return module.exports = factory(require('../../../shared-constants'), require('../board_ops'), require('../cards-internal/random-source'));
    } else {
        if (!root.SharedConstants) throw new Error('SharedConstants missing required values');
        return root.CardSniper = factory(root.SharedConstants, root.BoardOps || null, root.CardRandomSource || null);
    }
}(typeof self !== 'undefined' ? self as unknown as SniperRoot : globalThis as unknown as SniperRoot, function (SharedConstants: SniperSharedConstants, BoardOpsModule: SniperBoardOpsModule | null, RandomSourceModule: SniperRandomSourceModule | null) {
    'use strict';

    const { BLACK, WHITE, EMPTY } = SharedConstants || {};

    if (BLACK === undefined || WHITE === undefined || EMPTY === undefined) {
        throw new Error('SharedConstants missing required values');
    }

    function normalizeExpansionOwner(owner: unknown): SniperOwnerValue {
        return (owner === BLACK || owner === WHITE) ? owner : EMPTY;
    }

    function resolveBoardDims(gameState: SniperGameState): SniperBoardDims {
        const board = gameState && Array.isArray(gameState.board) ? gameState.board : null;
        const rows = board && board.length > 0 ? board.length : 8;
        const cols = board && Array.isArray(board[0]) && board[0].length > 0 ? board[0].length : rows;
        return { rows, cols };
    }

    function isMainBoardCell(row: number, col: number, gameState: SniperGameState): boolean {
        const dims = resolveBoardDims(gameState);
        return Number.isInteger(row) && row >= 0 && row < dims.rows && Number.isInteger(col) && col >= 0 && col < dims.cols;
    }

    function resolveExpansionSide(side: unknown, row: number, col: number, gameState: SniperGameState): SniperExpansionSide | null {
        if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
        const dims = resolveBoardDims(gameState);
        if (col === -1) return 'left';
        if (col === dims.cols) return 'right';
        if (row === -1) return 'top';
        if (row === dims.rows) return 'bottom';
        return null;
    }

    function isExpansionCoordinate(row: unknown, col: unknown, gameState: SniperGameState): boolean {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
        const numericRow = Number(row);
        const numericCol = Number(col);
        const dims = resolveBoardDims(gameState);
        if (numericRow < -1 || numericRow > dims.rows || numericCol < -1 || numericCol > dims.cols) return false;
        if (isMainBoardCell(numericRow, numericCol, gameState)) return false;
        return true;
    }

    function syncLegacyExpansionFields(expansion: SniperExpansionState | null | undefined, gameState: SniperGameState): void {
        if (!expansion || typeof expansion !== 'object') return;
        if (!Array.isArray(expansion.cells)) expansion.cells = [];
        const latest = expansion.cells.length > 0 ? expansion.cells[expansion.cells.length - 1] : null;
        expansion.active = !!latest;
        expansion.side = latest ? resolveExpansionSide(latest.side, latest.row, latest.col, gameState) : null;
        expansion.row = latest ? latest.row : null;
        expansion.owner = latest ? normalizeExpansionOwner(latest.owner) : EMPTY;
    }

    function getExpansionCells(gameState: SniperGameState): SniperExpansionCell[] {
        if (BoardOpsModule && typeof BoardOpsModule.getExpansionDescriptors === 'function') {
            return BoardOpsModule.getExpansionDescriptors(gameState);
        }
        const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
            ? gameState.boardExpansion
            : null;
        if (!expansion) return [];

        const cells: SniperExpansionCell[] = [];
        const pushCell = (
            source: SniperExpansionCell | SniperExpansionState | SniperExpansionSide | null | undefined,
            legacyRow?: number | null,
            legacyOwner?: unknown
        ): void => {
            let side: unknown = null;
            let row: number | null | undefined = null;
            let col: number | null | undefined = null;
            let owner = legacyOwner;

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
            const normalizedRow = Number(row);
            const normalizedCol = Number(col);
            if (cells.some((cell) => cell && cell.row === normalizedRow && cell.col === normalizedCol)) return;
            cells.push({
                side: resolveExpansionSide(side, normalizedRow, normalizedCol, gameState),
                row: normalizedRow,
                col: normalizedCol,
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

    function ensureExpansionStateMutable(gameState: SniperGameState): SniperExpansionState {
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
        const expansion = gameState.boardExpansion;
        const cells = getExpansionCells(gameState);
        expansion.cells = cells.map((cell) => ({
            side: cell.side,
            row: cell.row,
            col: cell.col,
            owner: normalizeExpansionOwner(cell.owner)
        }));
        syncLegacyExpansionFields(expansion, gameState);
        return expansion;
    }

    function getCellValue(gameState: SniperGameState, row: number, col: number): SniperOwnerValue | null {
        if (BoardOpsModule && typeof BoardOpsModule.getCellValue === 'function') {
            return BoardOpsModule.getCellValue(gameState, row, col);
        }
        if (isMainBoardCell(row, col, gameState) && gameState.board) return gameState.board[row][col];
        const expansionCells = getExpansionCells(gameState);
        for (const expansion of expansionCells) {
            if (!expansion) continue;
            if (expansion.row === row && expansion.col === col) return expansion.owner;
        }
        return null;
    }

    function setCellValue(gameState: SniperGameState, row: number, col: number, value: SniperOwnerValue): boolean {
        if (BoardOpsModule && typeof BoardOpsModule.setCellValue === 'function') {
            return BoardOpsModule.setCellValue(gameState, row, col, value);
        }
        if (isMainBoardCell(row, col, gameState) && gameState.board) {
            gameState.board[row][col] = value;
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

    function pickNearestEnemyTarget(gameState: SniperGameState, sourceRow: number, sourceCol: number, enemyValue: SniperOwnerValue, randomFn: () => number): SniperEffectTarget | null {
        const candidates: SniperEffectTarget[] = [];
        const dims = resolveBoardDims(gameState);
        for (let r = 0; r < dims.rows; r++) {
            for (let c = 0; c < dims.cols; c++) {
                if (!gameState.board) continue;
                if (gameState.board[r][c] !== enemyValue) continue;
                const dr = r - sourceRow;
                const dc = c - sourceCol;
                const distSq = (dr * dr) + (dc * dc);
                candidates.push({ row: r, col: c, distSq });
            }
        }

        const expansionCells = getExpansionCells(gameState);
        for (const expansion of expansionCells) {
            if (!expansion || expansion.owner !== enemyValue) continue;
            const dr = expansion.row - sourceRow;
            const dc = expansion.col - sourceCol;
            const distSq = (dr * dr) + (dc * dc);
            candidates.push({ row: expansion.row, col: expansion.col, distSq });
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
            const current = getCellValue(gs, r, c);
            if (current === null || current === EMPTY) return false;
            if (cs.markers) cs.markers = cs.markers.filter((m) => !(m.row === r && m.col === c));
            setCellValue(gs, r, c, EMPTY);
            return true;
        });

        const snipers = (cardState.markers || []).filter((m) => (
            m.kind === 'specialStone' &&
            m.data &&
            m.data.type === 'SNIPER' &&
            m.owner === playerKey
        ));

        if (!snipers.length) return { destroyed, anchors, expired };

        for (const sniper of snipers) {
            if (getCellValue(gameState, sniper.row, sniper.col) !== playerValue) {
                if (sniper.data) sniper.data.remainingOwnerTurns = -1;
                continue;
            }

            const target = pickNearestEnemyTarget(gameState, sniper.row, sniper.col, enemyValue, randomFn);
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
            const current = getCellValue(gs, r, c);
            if (current === null || current === EMPTY) return false;
            if (cs.markers) cs.markers = cs.markers.filter((m) => !(m.row === r && m.col === c));
            setCellValue(gs, r, c, EMPTY);
            return true;
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
        if (getCellValue(gameState, row, col) !== playerValue) {
            if (sniper.data) sniper.data.remainingOwnerTurns = -1;
            cleanupExpiredSnipers(cardState);
            return { destroyed, expired };
        }

        const resolveAnchor = (): SniperTurnStartResult => {
        const target = pickNearestEnemyTarget(gameState, row, col, enemyValue, randomFn);
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
