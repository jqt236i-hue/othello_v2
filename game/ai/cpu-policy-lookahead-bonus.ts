import type { CpuPolicyMove, CpuPolicyPosition } from './cpu-policy-core-types';

type CpuPolicyBonusConsumedMap = Record<string, boolean | number>;

type CpuPolicyLookaheadBonusDeps = {
    isFiniteNumber?: (value: unknown) => boolean;
    getBoardBonusAtCell?: (
        boardBonusByCell: Record<string, number> | null | undefined,
        consumedMap: Record<string, boolean> | null | undefined,
        row: number,
        col: number
    ) => number;
};

function fallbackIsFiniteNumber(value: unknown): boolean {
    return Number.isFinite(Number(value));
}

function fallbackGetBoardBonusAtCell(
    boardBonusByCell: Record<string, number> | null | undefined,
    consumedMap: Record<string, boolean> | null | undefined,
    row: number,
    col: number
): number {
    const key = `${row},${col}`;
    if (consumedMap && consumedMap[key] === true) return 0;
    const raw = boardBonusByCell && Object.prototype.hasOwnProperty.call(boardBonusByCell, key)
        ? Number(boardBonusByCell[key])
        : 0;
    return Number.isFinite(raw) ? raw : 0;
}

export function createCpuPolicyLookaheadBonus(deps?: CpuPolicyLookaheadBonusDeps) {
    const isFiniteNumber = typeof deps?.isFiniteNumber === 'function' ? deps.isFiniteNumber : fallbackIsFiniteNumber;
    const getBoardBonusAtCell = typeof deps?.getBoardBonusAtCell === 'function'
        ? deps.getBoardBonusAtCell
        : fallbackGetBoardBonusAtCell;

    function hashBonusCellCoord(row: number, col: number): number {
        const r = (Number(row) | 0) + 1;
        const c = (Number(col) | 0) + 1;
        const mixed = Math.imul(r, 0x9e3779b1) ^ Math.imul(c, 0x85ebca6b);
        return mixed >>> 0;
    }

    function parseBonusCellKey(key: string): CpuPolicyPosition | null {
        const raw = String(key || '');
        const sep = raw.indexOf(',');
        if (sep <= 0 || sep >= raw.length - 1) return null;
        const row = Number(raw.slice(0, sep));
        const col = Number(raw.slice(sep + 1));
        if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
        return { row, col };
    }

    function createConsumedBonusMap(boardBonusConsumedByCell: Record<string, boolean> | CpuPolicyBonusConsumedMap | null | undefined): CpuPolicyBonusConsumedMap {
        const out: CpuPolicyBonusConsumedMap = Object.create(null);
        out.__bonusHash = 0;
        out.__bonusCount = 0;
        if (!boardBonusConsumedByCell || typeof boardBonusConsumedByCell !== 'object') return out;
        for (const key of Object.keys(boardBonusConsumedByCell)) {
            if (boardBonusConsumedByCell[key] !== true) continue;
            const parsed = parseBonusCellKey(key);
            if (!parsed) continue;
            out[key] = true;
            out.__bonusHash = (Number(out.__bonusHash) ^ hashBonusCellCoord(parsed.row, parsed.col)) >>> 0;
            out.__bonusCount = (Number(out.__bonusCount) || 0) + 1;
        }
        return out;
    }

    function consumeBonusCell(consumedMap: CpuPolicyBonusConsumedMap | null | undefined, row: number, col: number): CpuPolicyBonusConsumedMap {
        const key = `${row},${col}`;
        if (consumedMap && consumedMap[key] === true) return consumedMap || Object.create(null);
        const next: CpuPolicyBonusConsumedMap = Object.assign(Object.create(null), consumedMap || null);
        next[key] = true;
        const prevHash = Number(consumedMap && consumedMap.__bonusHash) >>> 0;
        const prevCount = Math.max(0, Number(consumedMap && consumedMap.__bonusCount) || 0);
        next.__bonusHash = (prevHash ^ hashBonusCellCoord(row, col)) >>> 0;
        next.__bonusCount = prevCount + 1;
        return next;
    }

    function getMoveChargeGain(
        move: CpuPolicyMove | null | undefined,
        boardBonusByCell: Record<string, number> | null | undefined,
        consumedMap: Record<string, boolean> | CpuPolicyBonusConsumedMap | null | undefined
    ): number {
        if (!move) return 0;
        const flips = Array.isArray(move.flips) ? move.flips.length : 0;
        const row = isFiniteNumber(move.row) ? Number(move.row) : -1;
        const col = isFiniteNumber(move.col) ? Number(move.col) : -1;
        const bonus = getBoardBonusAtCell(boardBonusByCell, consumedMap as Record<string, boolean>, row, col);
        return flips + bonus;
    }

    return {
        hashBonusCellCoord,
        parseBonusCellKey,
        createConsumedBonusMap,
        consumeBonusCell,
        getMoveChargeGain
    };
}
