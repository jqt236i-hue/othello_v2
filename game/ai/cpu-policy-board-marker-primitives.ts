/**
 * @file cpu-policy-board-marker-primitives.ts
 * @description Extracted board and marker primitive helpers used by CPU decision
 *              scoring. Pure helpers (`getBoardCellValueSafe`,
 *              `countAdjacentCellsByValue`, `getMarkerPriorityValue`) do not
 *              read any module-level state. Marker profile helpers
 *              (`getTimedMarkerProfileAt`, `getMarkerProfileAt`) take the
 *              active `cardState` as an explicit argument so they remain
 *              deterministic and free of hidden module-scope reads.
 *
 *              The signatures and observable behavior intentionally match
 *              the pre-extraction helpers that lived in `game/cpu-decision.ts`.
 *              `getBoardCellValueSafe` returns the underlying cell value (or
 *              `undefined` when out of bounds) to match the original behavior.
 */

type AnyCardState = {
    markers?: unknown;
} | null | undefined;

type AnyMarker = {
    kind?: unknown;
    row?: unknown;
    col?: unknown;
    owner?: unknown;
    data?: { type?: unknown; remainingOwnerTurns?: unknown } | null;
};

export function getBoardCellValueSafe(sharedBoardUtils: any, board: any, row: any, col: any): any {
    if (sharedBoardUtils && typeof sharedBoardUtils.getCellValue === 'function') {
        return sharedBoardUtils.getCellValue(board, row, col);
    }
    if (!Array.isArray(board)) return null;
    if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
    if (!Array.isArray(board[row])) return null;
    return board[row][col];
}

export function countAdjacentCellsByValue(sharedBoardUtils: any, board: any, row: any, col: any, value: any): any {
    if (!board || typeof board !== 'object') return 0;
    let count = 0;
    for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
            if (dr === 0 && dc === 0) continue;
            const r = row + dr;
            const c = col + dc;
            const cell = getBoardCellValueSafe(sharedBoardUtils, board, r, c);
            if (cell === value) count += 1;
        }
    }
    return count;
}

export function getMarkerPriorityValue(type: any): any {
    const t = String(type || '').toUpperCase();
    if (!t) return 120;
    if (t === 'GUARD') return 280;
    if (t === 'WORK') return 320;
    if (t.includes('ULTIMATE')) return 260;
    if (t === 'SNIPER' || t === 'ROBOT_VACUUM') return 240;
    if (t === 'TRAP') return 180;
    return 140;
}

function readMarkerList(cardState: AnyCardState): AnyMarker[] {
    if (!cardState || !Array.isArray((cardState as { markers?: unknown }).markers)) return [];
    return (cardState as { markers: AnyMarker[] }).markers;
}

export function getTimedMarkerProfileAt(cardState: AnyCardState, playerKey: any, row: any, col: any): any {
    const markers = readMarkerList(cardState);
    const out = {
        ownTimedCount: 0,
        oppTimedCount: 0,
        ownTimedScore: 0,
        oppTimedScore: 0,
        ownRemainingSum: 0,
        oppRemainingSum: 0,
        ownCriticalCount: 0,
        oppCriticalCount: 0
    };
    for (const m of markers) {
        if (!m || m.kind !== 'specialStone' || m.row !== row || m.col !== col) continue;
        const remaining = Number(m.data && m.data.remainingOwnerTurns);
        if (!Number.isFinite(remaining) || remaining <= 0) continue;
        const weight = getMarkerPriorityValue(m.data && m.data.type) + (Math.min(6, remaining) * 28);
        if (m.owner === playerKey) {
            out.ownTimedCount += 1;
            out.ownTimedScore += weight;
            out.ownRemainingSum += remaining;
            if (remaining <= 2) out.ownCriticalCount += 1;
        } else {
            out.oppTimedCount += 1;
            out.oppTimedScore += weight;
            out.oppRemainingSum += remaining;
            if (remaining <= 2) out.oppCriticalCount += 1;
        }
    }
    return out;
}

export function getMarkerProfileAt(cardState: AnyCardState, playerKey: any, row: any, col: any): any {
    const markers = readMarkerList(cardState);
    const out = {
        ownSpecialScore: 0,
        oppSpecialScore: 0,
        ownBombCount: 0,
        oppBombCount: 0
    };
    for (const m of markers) {
        if (!m || m.row !== row || m.col !== col) continue;
        if (m.kind === 'bomb') {
            if (m.owner === playerKey) out.ownBombCount += 1;
            else out.oppBombCount += 1;
            continue;
        }
        if (m.kind !== 'specialStone') continue;
        const priority = getMarkerPriorityValue(m.data && m.data.type);
        if (m.owner === playerKey) out.ownSpecialScore += priority;
        else out.oppSpecialScore += priority;
    }
    return out;
}
