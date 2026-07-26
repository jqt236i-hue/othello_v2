type CpuDecisionCardRiskConfig = {
    getCpuPolicyCore: () => any;
    getCardLogic: () => any;
    getCardState: () => any;
    buildCardUseDecisionContext: (playerKey: any, level: any, legalMovesCount: any, legalMoves?: any, usableCardIds?: any) => any;
    getBoardShapeForCpuBoard?: (board: any) => any;
    getCurrentCpuBoard: () => any;
    isPlayableBoard: (board: any) => any;
    buildLv6LookaheadOptions: (level: any, board: any, legalMovesCount: any, playerKey: any) => any;
    resolveLv6LookaheadTimeCaps: (playerKey: any) => any;
    createLookaheadMetaLogger: (playerKey: any, level: any, source: any) => any;
    getBoardBonusValueAt: (row: any, col: any) => any;
    isCornerCell: (row: any, col: any, board?: any) => any;
    isEdgeCell: (row: any, col: any, board?: any) => any;
    applyMoveByFlipsForCpu: (board: any, move: any, playerValue: any) => any;
    hasCornerMoveOnBoardForPlayer: (board: any, playerValue: any) => any;
    resolveCardType: (cardId: any, cardDef?: any) => any;
};

import { createCpuCardQuiescenceRequest } from './ai/cpu-card-quiescence';

const HIGH_VARIANCE_CARD_TYPES_FOR_QUIESCENCE = new Set([
    'TIME_BOMB',
    'METEOR_WILL',
    'METEOR_GOD',
    'BOARD_SHRINK_WILL',
    'BOARD_SHRINK_GOD',
    'SWAP_WITH_ENEMY',
    'POSITION_SWAP_WILL',
    'TEMPT_WILL',
    'CAPTURE_WILL',
    'TELEPORT_WILL',
    'CELL_TELEPORT_WILL',
    'BUOYANCY_WILL',
    'SUPER_BUOYANCY_WILL',
    'GRAVITY_WILL',
    'SUPER_GRAVITY_WILL',
    'SUPER_ATTRACTION_WILL'
]);

export function createCpuDecisionCardRisk(config: CpuDecisionCardRiskConfig): any {
    const cfg = (config && typeof config === 'object') ? config : {} as CpuDecisionCardRiskConfig;

    function resolveCpuPolicyCore(): any {
        return cfg.getCpuPolicyCore ? cfg.getCpuPolicyCore() : null;
    }

    function resolveCardLogic(): any {
        return cfg.getCardLogic ? cfg.getCardLogic() : null;
    }

    function hasQuiescenceRelevantCardType(usableCardTypes: any): boolean {
        if (!Array.isArray(usableCardTypes) || usableCardTypes.length === 0) return true;
        return usableCardTypes.some((value: any) => HIGH_VARIANCE_CARD_TYPES_FOR_QUIESCENCE.has(String(value || '').toUpperCase()));
    }

    function shouldBuildCardQuiescenceSnapshot(level: any, legalMoves: any, context: any, usableCardTypes?: any): boolean {
        if (!Number.isFinite(level) || level < 6) return false;
        if (!Array.isArray(legalMoves) || legalMoves.length <= 0) return false;
        if (!hasQuiescenceRelevantCardType(usableCardTypes)) return false;
        if (!context || context.forceUseCard === true || context.cornerEmergency === true) return false;
        if (Number(context.discDiff || 0) <= -8) return false;
        if (Number(context.handSize || 0) >= 4) return false;
        if (Number(context.ownCharge || 0) >= 24) return false;
        if (Number(context.legalMovesCount || 0) <= 2) return false;
        return true;
    }

    function buildQuiescenceSearchInputs(playerKey: any, level: any, legalMoves: any, context: any): any {
        if (!Number.isFinite(level) || level < 6) return null;
        if (!Array.isArray(legalMoves) || legalMoves.length <= 0) return null;
        const board = cfg.getCurrentCpuBoard ? cfg.getCurrentCpuBoard() : null;
        if (!cfg.isPlayableBoard(board)) return null;
        const playerValue = Number.isFinite(context && context.playerValue)
            ? (Number(context.playerValue) >= 0 ? 1 : -1)
            : (playerKey === 'black' ? 1 : -1);
        const lv6Lookahead = cfg.buildLv6LookaheadOptions(level, board, legalMoves.length, playerKey);
        const timeCaps = cfg.resolveLv6LookaheadTimeCaps(playerKey);
        const cardState = cfg.getCardState ? cfg.getCardState() : null;
        return {
            board,
            playerValue,
            search: {
                depth: Math.max(4, Math.min(7, Number(lv6Lookahead.depth) || 5)),
                maxBranch: Math.max(4, Math.min(8, Number(lv6Lookahead.maxBranch) || 6)),
                nodeBudget: Math.max(120_000, Math.min(800_000, Number(lv6Lookahead.nodeBudget) || 350_000)),
                maxTimeMs: Math.max(300, Math.min(timeCaps.quiescenceMoveCapMs, Number(lv6Lookahead.maxTimeMs) || 900)),
                endgameSolveEmpties: Math.max(12, Math.min(24, Number(lv6Lookahead.endgameSolveEmpties) || 18)),
                endgameDepth: Math.max(10, Math.min(20, Number(lv6Lookahead.endgameDepth) || 14)),
                endgameNodeBudget: Math.max(600_000, Math.min(3_000_000, Number(lv6Lookahead.endgameNodeBudget) || 1_500_000)),
                endgameMaxTimeMs: Math.max(
                    timeCaps.quiescenceEndgameMinMs,
                    Math.min(timeCaps.quiescenceEndgameCapMs, Number(lv6Lookahead.endgameMaxTimeMs) || 1_600)
                )
            },
            boardBonusByCell: (cardState && cardState.boardBonusByCell && typeof cardState.boardBonusByCell === 'object')
                ? cardState.boardBonusByCell
                : null,
            boardBonusConsumedByCell: (cardState && cardState.boardBonusConsumedByCell && typeof cardState.boardBonusConsumedByCell === 'object')
                ? cardState.boardBonusConsumedByCell
                : null
        };
    }

    function prepareCardQuiescenceRequest(playerKey: any, level: any, legalMoves: any, context: any, identity: any): any {
        const inputs = buildQuiescenceSearchInputs(playerKey, level, legalMoves, context);
        if (!inputs || !identity || typeof identity !== 'object') return null;
        const turnNumber = Number.isSafeInteger(identity.turnNumber) && Number(identity.turnNumber) >= 0
            ? Number(identity.turnNumber)
            : null;
        const requestId = `card-quiescence:${Number(identity.runId) || 0}:${Number(identity.decisionEpoch) || 0}`;
        return createCpuCardQuiescenceRequest({
            requestId,
            decisionEpoch: identity.decisionEpoch,
            stateVersion: identity.stateVersion,
            turnNumber,
            playerKey,
            level,
            playerValue: inputs.playerValue,
            board: inputs.board,
            boardShape: typeof cfg.getBoardShapeForCpuBoard === 'function'
                ? cfg.getBoardShapeForCpuBoard(inputs.board)
                : null,
            legalMoves,
            search: inputs.search,
            boardBonusByCell: inputs.boardBonusByCell,
            boardBonusConsumedByCell: inputs.boardBonusConsumedByCell
        });
    }

    function buildCardQuiescenceSnapshotFromBestMove(playerKey: any, context: any, bestMove: any): any {
        if (!bestMove) return null;
        const board = cfg.getCurrentCpuBoard ? cfg.getCurrentCpuBoard() : null;
        if (!cfg.isPlayableBoard(board)) return null;
        const playerValue = Number.isFinite(context && context.playerValue)
            ? (Number(context.playerValue) >= 0 ? 1 : -1)
            : (playerKey === 'black' ? 1 : -1);
        const bestMoveBonus = (Number.isInteger(bestMove.row) && Number.isInteger(bestMove.col))
            ? cfg.getBoardBonusValueAt(bestMove.row, bestMove.col)
            : 0;
        const bestMoveFlips = Array.isArray(bestMove.flips) ? bestMove.flips.length : 0;
        const bestMoveCorner = cfg.isCornerCell(Number(bestMove.row), Number(bestMove.col), board);
        const bestMoveEdge = !bestMoveCorner && cfg.isEdgeCell(Number(bestMove.row), Number(bestMove.col), board);
        const nextBoard = cfg.applyMoveByFlipsForCpu(board, bestMove, playerValue);
        const oppCornerAfterBest = nextBoard
            ? cfg.hasCornerMoveOnBoardForPlayer(nextBoard, -playerValue)
            : false;
        return {
            bestMove,
            bestMoveBonus,
            bestMoveFlips,
            bestMoveCorner,
            bestMoveEdge,
            oppCornerAfterBest
        };
    }

    function buildCardQuiescenceSnapshot(playerKey: any, level: any, legalMoves: any, context: any): any {
        const cpuPolicyCore = resolveCpuPolicyCore();
        if (!cpuPolicyCore || typeof cpuPolicyCore.chooseMoveByLookahead !== 'function') return null;
        const inputs = buildQuiescenceSearchInputs(playerKey, level, legalMoves, context);
        if (!inputs) return null;
        const onSearchMeta = cfg.createLookaheadMetaLogger(playerKey, level, 'card-quiescence');
        const bestMove = cpuPolicyCore.chooseMoveByLookahead(legalMoves, {
            board: inputs.board,
            playerValue: inputs.playerValue,
            level,
            ...inputs.search,
            onSearchMeta,
            boardBonusByCell: inputs.boardBonusByCell,
            boardBonusConsumedByCell: inputs.boardBonusConsumedByCell
        });
        return buildCardQuiescenceSnapshotFromBestMove(playerKey, context, bestMove);
    }

    function shouldHoldCardByQuiescence(playerKey: any, level: any, cardId: any, cardDef: any, context: any, snapshot: any): any {
        if (!Number.isFinite(level) || level < 6) return false;
        if (!cardId || !context || !snapshot || !snapshot.bestMove) return false;
        if (context.forceUseCard === true) return false;
        if (context.cornerEmergency === true) return false;
        if (Number(context.discDiff || 0) <= -8) return false;
        if (Number(context.handSize || 0) >= 4) return false;
        if (Number(context.ownCharge || 0) >= 24) return false;
        if (Number(context.legalMovesCount || 0) <= 2) return false;

        const cardType = cfg.resolveCardType(cardId, cardDef);
        if (!HIGH_VARIANCE_CARD_TYPES_FOR_QUIESCENCE.has(cardType)) return false;
        if (snapshot.oppCornerAfterBest === true) return false;

        const discDiff = Number(context.discDiff || 0);
        if (snapshot.bestMoveCorner === true && discDiff >= 0) return true;
        if (snapshot.bestMoveBonus >= 2 && discDiff >= 0) return true;
        if (snapshot.bestMoveFlips >= 6 && discDiff >= 4) return true;
        if (snapshot.bestMoveEdge === true && discDiff >= 10) return true;
        return false;
    }

    function isCardChoiceAllowedByRisk(playerKey: any, level: any, legalMovesCount: any, cardId: any, prebuiltContext: any): any {
        if (!cardId) return false;
        const cpuPolicyCore = resolveCpuPolicyCore();
        const cardLogic = resolveCardLogic();
        if (!cpuPolicyCore || typeof cpuPolicyCore.scoreCardUseDecision !== 'function' || !cardLogic) {
            return true;
        }
        try {
            const context = prebuiltContext || cfg.buildCardUseDecisionContext(playerKey, level, legalMovesCount);
            const decision = cpuPolicyCore.scoreCardUseDecision(
                cardId,
                cardLogic.getCardCost,
                cardLogic.getCardDef,
                context
            );
            if (!decision) return true;
            return decision.shouldUse === true;
        } catch (e) {
            return true;
        }
    }

    function isCardChoiceAllowedByHighConfidence(playerKey: any, level: any, legalMovesCount: any, cardId: any, prebuiltContext: any): any {
        if (!cardId) return false;
        if (!Number.isFinite(level) || level < 6) return true;
        const cpuPolicyCore = resolveCpuPolicyCore();
        const cardLogic = resolveCardLogic();
        if (!cpuPolicyCore || typeof cpuPolicyCore.scoreCardUseDecision !== 'function' || !cardLogic) {
            return true;
        }
        try {
            const context = prebuiltContext || cfg.buildCardUseDecisionContext(playerKey, level, legalMovesCount);
            if (context && context.forceUseCard === true) return true;

            const decision = cpuPolicyCore.scoreCardUseDecision(
                cardId,
                cardLogic.getCardCost,
                cardLogic.getCardDef,
                context
            );
            if (!decision) return true;

            let requiredMargin = 6;
            if (context && context.hasCornerMoveNow === true) requiredMargin += 10;
            if (context && context.highBonusMoveAvailable === true) requiredMargin += 3;
            if (context && Number.isFinite(context.discDiff) && context.discDiff >= 8) requiredMargin += 2;
            if (context && Number.isFinite(context.discDiff) && context.discDiff <= -10) requiredMargin -= 8;
            if (context && Number.isFinite(context.handSize) && context.handSize >= 5) requiredMargin -= 14;
            else if (context && Number.isFinite(context.handSize) && context.handSize >= 4) requiredMargin -= 10;
            else if (context && Number.isFinite(context.handSize) && context.handSize >= 3) requiredMargin -= 6;
            if (context && Number.isFinite(context.ownCharge) && context.ownCharge >= 24) requiredMargin -= 4;
            if (context && Number.isFinite(context.ownCharge) && context.ownCharge >= 36) requiredMargin -= 4;
            if (context && Number.isFinite(context.legalMovesCount) && context.legalMovesCount <= 3) requiredMargin -= 10;
            if (context && context.lowDiscEmergency === true) requiredMargin -= 6;
            if (context && context.criticalLowDiscEmergency === true) requiredMargin -= 10;
            if (context && context.whiteLv6Mode === true) requiredMargin -= 3;
            if (context && context.whiteLv6Mode === true && Number.isFinite(context.maxLegalFlips) && context.maxLegalFlips >= 4) requiredMargin -= 4;
            if (requiredMargin < 0) requiredMargin = 0;

            return Number(decision.score) >= (Number(decision.minUseScore) + requiredMargin);
        } catch (e) {
            return true;
        }
    }

    return {
        buildCardQuiescenceSnapshot,
        buildCardQuiescenceSnapshotFromBestMove,
        prepareCardQuiescenceRequest,
        shouldBuildCardQuiescenceSnapshot,
        shouldHoldCardByQuiescence,
        isCardChoiceAllowedByRisk,
        isCardChoiceAllowedByHighConfidence
    };
}

module.exports = {
    createCpuDecisionCardRisk
};
