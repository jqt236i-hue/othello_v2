import type { CpuPolicyBoard } from './cpu-policy-core-types';

type CpuPolicySearchKeyDeps = {
    SharedBoardUtils?: any;
};

type CpuPolicyBonusConsumedMap = Record<string, boolean | number>;

export function createCpuPolicySearchKey(deps?: CpuPolicySearchKeyDeps) {
    const SharedBoardUtils = deps?.SharedBoardUtils || null;

    function buildBoardSearchKey(
        board: CpuPolicyBoard,
        currentPlayer: number,
        depthLeft: number,
        passed: boolean,
        consumedMap: CpuPolicyBonusConsumedMap | null | undefined
    ): string {
        let out = currentPlayer > 0 ? '1' : '2';
        out += `:${depthLeft}:${passed ? 1 : 0}:`;
        if (SharedBoardUtils && typeof SharedBoardUtils.encodeBoard === 'function') {
            out += SharedBoardUtils.encodeBoard(board);
        } else {
            if (!Array.isArray(board)) {
                throw new Error('SharedBoardUtils.encodeBoard is required for compact CPU boards');
            }
            for (let r = 0; r < board.length; r++) {
                const row = Array.isArray(board[r]) ? board[r] : [];
                for (let c = 0; c < row.length; c++) {
                    const v = row[c];
                    if (v === 1) out += '1';
                    else if (v === -1) out += '2';
                    else out += '0';
                }
            }
        }
        const consumedHash = Number(consumedMap && consumedMap.__bonusHash) >>> 0;
        const consumedCount = Math.max(0, Number(consumedMap && consumedMap.__bonusCount) || 0);
        out += `:${consumedHash.toString(36)}:${consumedCount}`;
        return out;
    }

    return {
        buildBoardSearchKey
    };
}
