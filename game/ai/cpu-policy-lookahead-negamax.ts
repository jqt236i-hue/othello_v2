import type { CpuPolicyBoard, CpuPolicyMove } from './cpu-policy-core-types';
import {
    areAllLookaheadStoneSuppliesExhausted,
    consumeLookaheadStoneSupply,
    encodeLookaheadStoneSupplyKey,
    isLookaheadStoneSupplyExhausted,
    type CpuLookaheadStoneSupply
} from './cpu-policy-lookahead-stone-supply';

type CpuPolicyBonusConsumedMap = Record<string, boolean | number>;

type CpuPolicyLookaheadNegamaxDeps = {
    evaluateBoardForLookahead?: (board: CpuPolicyBoard | null | undefined, playerValue: number, stoneSupply?: CpuLookaheadStoneSupply | null) => number;
    evaluateTerminalBoardForLookahead?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => number;
    buildBoardSearchKey?: (
        board: CpuPolicyBoard,
        currentPlayer: number,
        depthLeft: number,
        passed: boolean,
        consumedMap: CpuPolicyBonusConsumedMap | null | undefined
    ) => string;
    getLegalMovesBasic?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => CpuPolicyMove[];
    buildSearchMoveOrder?: (moves: CpuPolicyMove[], params: Record<string, unknown>) => CpuPolicyMove[];
    getMoveChargeGain?: (move: CpuPolicyMove | null | undefined, boardBonusByCell: Record<string, number> | null | undefined, consumedMap: CpuPolicyBonusConsumedMap | null | undefined) => number;
    getBoardBonusAtCell?: (
        boardBonusByCell: Record<string, number> | null | undefined,
        consumedMap: CpuPolicyBonusConsumedMap | null | undefined,
        row: number,
        col: number
    ) => number;
    consumeBonusCell?: (consumedMap: CpuPolicyBonusConsumedMap | null | undefined, row: number, col: number) => CpuPolicyBonusConsumedMap;
    applyMoveToBoard?: (board: CpuPolicyBoard | null | undefined, move: CpuPolicyMove | null | undefined, playerValue: number) => CpuPolicyBoard;
};

type CpuPolicyLookaheadNegamaxInput = {
    endgameMode: boolean;
    deadlineMs: number | null;
    readNowMs: () => number;
    nodeBudget: number;
    readVisited: () => number;
    incrementVisited: () => void;
    markBudgetHit: () => void;
    markTimeHit: () => void;
    transposition: Map<string, number>;
    transpositionLimit: number;
    level: number;
    boardBonusByCell: Record<string, number> | null;
    branchLimit: number | null;
    shouldStop?: () => boolean;
};

function fallbackEvaluateBoardForLookahead(): number {
    return 0;
}

function fallbackBuildBoardSearchKey(): string {
    return '';
}

export function createCpuPolicyLookaheadNegamax(deps?: CpuPolicyLookaheadNegamaxDeps) {
    const evaluateBoardForLookahead = typeof deps?.evaluateBoardForLookahead === 'function'
        ? deps.evaluateBoardForLookahead
        : fallbackEvaluateBoardForLookahead;
    const evaluateTerminalBoardForLookahead = typeof deps?.evaluateTerminalBoardForLookahead === 'function'
        ? deps.evaluateTerminalBoardForLookahead
        : fallbackEvaluateBoardForLookahead;
    const buildBoardSearchKey = typeof deps?.buildBoardSearchKey === 'function'
        ? deps.buildBoardSearchKey
        : fallbackBuildBoardSearchKey;
    const getLegalMovesBasic = typeof deps?.getLegalMovesBasic === 'function' ? deps.getLegalMovesBasic : (() => []);
    const buildSearchMoveOrder = typeof deps?.buildSearchMoveOrder === 'function' ? deps.buildSearchMoveOrder : ((moves: CpuPolicyMove[]) => moves);
    const getMoveChargeGain = typeof deps?.getMoveChargeGain === 'function' ? deps.getMoveChargeGain : (() => 0);
    const getBoardBonusAtCell = typeof deps?.getBoardBonusAtCell === 'function' ? deps.getBoardBonusAtCell : (() => 0);
    const consumeBonusCell = typeof deps?.consumeBonusCell === 'function'
        ? deps.consumeBonusCell
        : ((consumedMap: CpuPolicyBonusConsumedMap | null | undefined) => (consumedMap || Object.create(null)) as CpuPolicyBonusConsumedMap);
    const applyMoveToBoard = typeof deps?.applyMoveToBoard === 'function' ? deps.applyMoveToBoard : ((board: any) => board);

    function createNegamax(input: CpuPolicyLookaheadNegamaxInput) {
        let stopped = false;
        function storeTransposition(key: string, value: number): number {
            if (stopped || (typeof input.shouldStop === 'function' && input.shouldStop()) || !key || !Number.isFinite(value)) return value;
            if (input.transposition.size >= input.transpositionLimit) input.transposition.clear();
            input.transposition.set(key, value);
            return value;
        }

        function negamax(
            boardNode: CpuPolicyBoard,
            currentPlayer: number,
            depthLeft: number,
            alpha: number,
            beta: number,
            passed: boolean,
            consumedMap: CpuPolicyBonusConsumedMap,
            // 持ち石ルール有効時だけ渡す。null は従来どおり盤面だけで読む。
            stoneSupply: CpuLookaheadStoneSupply | null = null
        ): number {
            if (stopped || (typeof input.shouldStop === 'function' && input.shouldStop())) {
                stopped = true;
                return evaluateBoardForLookahead(boardNode, currentPlayer, stoneSupply);
            }
            if (input.deadlineMs !== null && input.readNowMs() >= input.deadlineMs) {
                stopped = true;
                input.markTimeHit();
                return evaluateBoardForLookahead(boardNode, currentPlayer, stoneSupply);
            }
            if (input.readVisited() >= input.nodeBudget) {
                stopped = true;
                input.markBudgetHit();
                return evaluateBoardForLookahead(boardNode, currentPlayer, stoneSupply);
            }
            input.incrementVisited();
            const originalAlpha = alpha;
            // This cache stores exact values only; cutoffs and failed-low bounds must be re-searched.
            const storeExact = (key: string, score: number): number => (
                score > originalAlpha && score < beta ? storeTransposition(key, score) : score
            );

            // 黒白とも持ち石 0 は、その配置の直後に確定する終局（01-rulebook.md §7.3 / §8.2）。
            if (areAllLookaheadStoneSuppliesExhausted(stoneSupply)) {
                return evaluateTerminalBoardForLookahead(boardNode, currentPlayer);
            }

            if (depthLeft <= 0) {
                return evaluateBoardForLookahead(boardNode, currentPlayer, stoneSupply);
            }

            const transpositionKey = buildBoardSearchKey(boardNode, currentPlayer, depthLeft, passed, consumedMap)
                + encodeLookaheadStoneSupplyKey(stoneSupply);
            if (input.transposition.has(transpositionKey)) {
                const cached = input.transposition.get(transpositionKey);
                if (cached !== undefined) return cached;
            }

            // 持ち石切れの手番は通常合法手 0 として扱う。
            const legal = isLookaheadStoneSupplyExhausted(stoneSupply, currentPlayer)
                ? []
                : getLegalMovesBasic(boardNode, currentPlayer);
            if (!Array.isArray(legal) || legal.length <= 0) {
                if (passed) {
                    const terminalScore = input.endgameMode
                        ? evaluateTerminalBoardForLookahead(boardNode, currentPlayer)
                        : evaluateBoardForLookahead(boardNode, currentPlayer, stoneSupply);
                    return storeTransposition(transpositionKey, terminalScore);
                }
                const passedScore: number = -negamax(boardNode, -currentPlayer, depthLeft - 1, -beta, -alpha, true, consumedMap, stoneSupply);
                return storeExact(transpositionKey, passedScore);
            }
            const nextStoneSupply = consumeLookaheadStoneSupply(stoneSupply, currentPlayer);

            const ordered = buildSearchMoveOrder(legal, {
                level: input.level,
                board: boardNode,
                playerValue: currentPlayer,
                boardBonusByCell: input.boardBonusByCell,
                boardBonusConsumedByCell: consumedMap,
                branchLimit: input.branchLimit
            });

            let best = Number.NEGATIVE_INFINITY;
            for (const move of ordered) {
                const immediate = getMoveChargeGain(move, input.boardBonusByCell, consumedMap) * 70;
                const bonusAtCell = getBoardBonusAtCell(input.boardBonusByCell, consumedMap, Number(move.row), Number(move.col));
                const nextConsumed = bonusAtCell > 0
                    ? consumeBonusCell(consumedMap, Number(move.row), Number(move.col))
                    : consumedMap;
                const nextBoard = applyMoveToBoard(boardNode, move, currentPlayer);
                // Parent score = immediate - child, so both child bounds include immediate.
                const child = -negamax(nextBoard, -currentPlayer, depthLeft - 1, immediate - beta, immediate - alpha, false, nextConsumed, nextStoneSupply);
                const score = immediate + child;
                if (score > best) best = score;
                if (score > alpha) alpha = score;
                if (alpha >= beta || stopped || (typeof input.shouldStop === 'function' && input.shouldStop())) break;
            }
            return storeExact(transpositionKey, best);
        }

        return {
            negamax,
            storeTransposition
        };
    }

    return {
        createNegamax
    };
}
