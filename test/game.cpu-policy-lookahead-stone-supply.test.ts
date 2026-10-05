import { createCpuPolicyLookaheadNegamax } from '../game/ai/cpu-policy-lookahead-negamax';
import { createCpuPolicyLookaheadPrelude } from '../game/ai/cpu-policy-lookahead-prelude';
import { createCpuPolicyLookaheadEvaluation } from '../game/ai/cpu-policy-lookahead-evaluation';
import { createCpuPolicyLookaheadParity } from '../game/ai/cpu-policy-lookahead-parity';
import {
    areAllLookaheadStoneSuppliesExhausted,
    consumeLookaheadStoneSupply,
    normalizeLookaheadStoneSupply,
    resolveLookaheadRemainingPlacements,
    resolveLookaheadSupplyLastPlacementSignal
} from '../game/ai/cpu-policy-lookahead-stone-supply';
import { createCpuCardQuiescenceRequest, executeCpuCardQuiescenceRequest } from '../game/ai/cpu-card-quiescence';

const core = require('../game/ai/cpu-policy-core');
const StoneSupply = require('../shared/stone-supply');

function createTreeSearch(tree: Record<string, string[]>, values: Record<string, number>, terminal: Record<string, number> = {}) {
    let visited = 0;
    const transposition = new Map<string, number>();
    const helpers = createCpuPolicyLookaheadNegamax({
        evaluateBoardForLookahead: (board: any) => values[board.id] || 0,
        evaluateTerminalBoardForLookahead: (board: any) => terminal[board.id] || 0,
        buildBoardSearchKey: (board: any, player, depth, passed) => `${board.id}:${player}:${depth}:${passed}`,
        getLegalMovesBasic: (board: any) => (tree[board.id] || []).map((id, row) => ({ id, row, col: 0, flips: [] })),
        applyMoveToBoard: (_board: any, move: any) => ({ id: move.id })
    });
    return helpers.createNegamax({
        endgameMode: false, deadlineMs: null, readNowMs: () => 0,
        nodeBudget: 10000, readVisited: () => visited, incrementVisited: () => { visited += 1; },
        markBudgetHit: () => undefined, markTimeHit: () => undefined,
        transposition, transpositionLimit: 1000, level: 6, boardBonusByCell: null,
        branchLimit: null, shouldStop: () => false
    }).negamax;
}

describe('lookahead stone supply (rulebook 7.3)', () => {
    test('helpers keep the rule-off path as null and count placements by remaining supply', () => {
        expect(normalizeLookaheadStoneSupply(null)).toBeNull();
        expect(normalizeLookaheadStoneSupply({ black: 3 })).toBeNull();
        const supply = normalizeLookaheadStoneSupply({ black: 3.9, white: -2 });
        expect(supply).toEqual({ black: 3, white: 0 });
        expect(consumeLookaheadStoneSupply(supply, 1)).toEqual({ black: 2, white: 0 });
        expect(consumeLookaheadStoneSupply(null, 1)).toBeNull();
        expect(areAllLookaheadStoneSuppliesExhausted({ black: 0, white: 0 })).toBe(true);
        expect(resolveLookaheadRemainingPlacements(40, null)).toBe(40);
        expect(resolveLookaheadRemainingPlacements(40, { black: 5, white: 6 })).toBe(11);
        expect(resolveLookaheadRemainingPlacements(8, { black: 5, white: 6 })).toBe(8);
        // 持ち石が空きより先に尽きるとき、持ち石の多い側が最後に置く。同数なら手番でない側。
        expect(resolveLookaheadSupplyLastPlacementSignal(20, { black: 4, white: 2 }, 1)).toBe(1);
        expect(resolveLookaheadSupplyLastPlacementSignal(20, { black: 3, white: 3 }, 1)).toBe(-1);
        expect(resolveLookaheadSupplyLastPlacementSignal(4, { black: 3, white: 3 }, 1)).toBeNull();
    });

    test('shared helper exposes remaining supply only while the rule is on', () => {
        expect(StoneSupply.readStoneSupplyRemainingByPlayer({})).toBeNull();
        expect(StoneSupply.readStoneSupplyRemainingByPlayer({
            stoneSupply: { initial: 30, remainingByPlayer: { black: 4, white: 0 } }
        })).toEqual({ black: 4, white: 0 });
    });

    test('negamax treats an exhausted player as having no placement and ends when both are exhausted', () => {
        const negamax = createTreeSearch({ root: ['a'] }, { root: 3, a: -6 }, { a: 50 });
        // ルール無効: 通常どおり a へ進む。
        expect(negamax({ id: 'root' } as any, 1, 1, -Infinity, Infinity, false, {})).toBe(6);
        // 黒が持ち石切れ: 合法手 0 としてパスし、白手番で評価する。
        expect(negamax({ id: 'root' } as any, 1, 1, -Infinity, Infinity, false, {}, { black: 0, white: 5 })).toBe(-3);
        // 黒の最後の1個で黒白とも 0 → その配置直後に終局評価。
        expect(negamax({ id: 'root' } as any, 1, 4, -Infinity, Infinity, false, {}, { black: 1, white: 0 })).toBe(-50);
    });

    test('prelude switches to endgame search by remaining placements instead of empties', () => {
        const prelude = createCpuPolicyLookaheadPrelude({
            countBoardDiscsForPlayer: () => ({ empties: 40 }),
            resolveLookaheadEndgameDepth: (_opts: any, remaining: number) => remaining + 2,
            resolveLookaheadDepth: () => 4,
            getLegalMovesBasic: () => [{}]
        });
        const off = prelude.prepareLookaheadPrelude({ opts: { endgameSolveEmpties: 20 }, board: [] as any, playerValue: 1, level: 6 });
        expect(off.endgameMode).toBe(false);
        expect(off.stoneSupply).toBeNull();
        expect(off.remainingPlacements).toBe(40);
        const on = prelude.prepareLookaheadPrelude({
            opts: { endgameSolveEmpties: 20, stoneSupply: { black: 5, white: 6 } },
            board: [] as any,
            playerValue: 1,
            level: 6
        });
        expect(on.endgameMode).toBe(true);
        expect(on.remainingPlacements).toBe(11);
        expect(on.depth).toBe(13);
        expect(on.stoneSupply).toEqual({ black: 5, white: 6 });
    });

    test('evaluation does not count supply-exhausted no-move as mobility or forced pass', () => {
        const resolveForcedPassFeature = jest.fn(() => ({ signal: 1, score: 999 }));
        const parityCalls: any[] = [];
        const evaluation = createCpuPolicyLookaheadEvaluation({
            countBoardDiscsForPlayer: () => ({ own: 10, opp: 10, empties: 30 }),
            getLegalMovesBasic: () => [{ row: 3, col: 3 }, { row: 4, col: 4 }] as any,
            resolveForcedPassFeature,
            resolveLookaheadParityFeature: (...args: any[]) => { parityCalls.push(args); return { score: 0 }; }
        });
        const value = evaluation.evaluateBoardForLookahead([] as any, 1, { black: 3, white: 0 });
        expect(resolveForcedPassFeature).not.toHaveBeenCalled();
        expect(value).toBe(0);
        expect(parityCalls[0].slice(1)).toEqual([3, { black: 3, white: 0 }, 1]);
        evaluation.evaluateBoardForLookahead([] as any, 1);
        expect(resolveForcedPassFeature).toHaveBeenCalledWith(2, 2, 30);
        expect(parityCalls[1].slice(1)).toEqual([30]);
    });

    test('parity uses the supply-limited last placement when supplies end before empties', () => {
        const parity = createCpuPolicyLookaheadParity({});
        const board = Array.from({ length: 4 }, () => Array(4).fill(1));
        board[0][0] = 0;
        board[0][1] = 0;
        board[3][3] = 0;
        // 空き領域は 2 マスと 1 マス。奇数領域が 1 つなので空き基準では手番側が最後に置く。
        const regionOnly = parity.resolveLookaheadParityFeature(board as any, 3);
        expect(regionOnly.signal).toBe(1);
        // 黒白とも残り 1 個（計 2 < 空き 3）: 手番の黒が置き、白が最後に置く。
        const equalSupply = parity.resolveLookaheadParityFeature(board as any, 2, { black: 1, white: 1 }, 1);
        expect(equalSupply.signal).toBe(-1);
        expect(equalSupply.score).toBeLessThan(0);
        const moreOwnSupply = parity.resolveLookaheadParityFeature(board as any, 2, { black: 2, white: 0 }, 1);
        expect(moreOwnSupply.signal).toBe(1);
        // 持ち石合計が空き以上なら従来の空き領域偶奇に戻る。
        expect(parity.resolveLookaheadParityFeature(board as any, 3, { black: 2, white: 2 }, 1).signal).toBe(1);
    });

    test('core lookahead plays out the last stone for the best final count', () => {
        const board = Array.from({ length: 8 }, () => Array(8).fill(0));
        board[3][3] = -1;
        board[3][4] = -1;
        board[3][5] = -1;
        board[3][6] = 1;
        board[5][4] = -1;
        board[6][4] = 1;
        const single = { row: 4, col: 4, flips: [{ row: 5, col: 4 }] };
        const triple = { row: 3, col: 2, flips: [{ row: 3, col: 3 }, { row: 3, col: 4 }, { row: 3, col: 5 }] };
        const metas: any[] = [];
        const selected = core.chooseMoveByLookahead([single, triple], {
            board,
            playerValue: 1,
            level: 6,
            scoreMove: (move: any) => (move === single ? 50 : 0),
            stoneSupply: { black: 1, white: 0 },
            onSearchMeta: (meta: any) => metas.push(meta)
        });
        expect(selected).toEqual(triple);
        expect(metas[0].endgameMode).toBe(true);
    });

    test('card-quiescence requests carry stone supply only when the rule is on', () => {
        const base = {
            requestId: 'placement-lookahead:1:1',
            decisionEpoch: 1,
            stateVersion: 1,
            turnNumber: 1,
            playerKey: 'black',
            level: 6,
            playerValue: 1,
            board: [[0, 0], [0, 0]],
            boardShape: null,
            legalMoves: [{ row: 0, col: 0, flips: [] }],
            search: {
                depth: 4, maxBranch: 6, nodeBudget: 1000, maxTimeMs: 100,
                endgameSolveEmpties: 12, endgameDepth: 10, endgameNodeBudget: 1000, endgameMaxTimeMs: 100
            }
        };
        const off = createCpuCardQuiescenceRequest(base);
        expect(Object.prototype.hasOwnProperty.call(off, 'stoneSupply')).toBe(false);
        const on = createCpuCardQuiescenceRequest({ ...base, stoneSupply: { black: 2, white: 7 } });
        expect(on.stoneSupply).toEqual({ black: 2, white: 7 });
        expect(on.inputDigest).not.toBe(off.inputDigest);
        const seen: any[] = [];
        executeCpuCardQuiescenceRequest(on, (moves, options) => { seen.push(options.stoneSupply); return moves[0]; });
        executeCpuCardQuiescenceRequest(off, (moves, options) => { seen.push(options.stoneSupply); return moves[0]; });
        expect(seen).toEqual([{ black: 2, white: 7 }, undefined]);
        expect(() => createCpuCardQuiescenceRequest({ ...base, stoneSupply: { black: -1, white: 0 } })).toThrow();
    });
});
