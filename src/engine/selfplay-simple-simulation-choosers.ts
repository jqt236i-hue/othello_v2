/* eslint-disable @typescript-eslint/no-explicit-any */

type SelfplaySimpleSimulationChoosersConfig = {
    CardLogic?: any;
    chooseTargetBySimulation?: (
        gameState: any,
        cardState: any,
        playerKey: any,
        rng: any,
        applyEffectFn: any,
        fallbackScoreFn: any,
        scoreAdjustFn?: any,
        targetGetterNames?: any
    ) => any;
    evaluatePositionValue?: (row: any, col: any, boardOrSize?: any) => number;
    readSelfplayPendingEffect?: (cardState: any, playerKey: any) => any;
    getSelfplayBoard?: (gameState: any, cardState: any) => any;
    getCornerProximity?: (row: any, col: any, boardOverride?: any) => any;
    getBoardCellValue?: (board: any, row: any, col: any) => any;
    isCorner?: (row: any, col: any, board?: any) => boolean;
    isEdge?: (row: any, col: any, board?: any) => boolean;
};

export function createSelfplaySimpleSimulationChoosers(config?: SelfplaySimpleSimulationChoosersConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as SelfplaySimpleSimulationChoosersConfig;
    const cardLogic = cfg.CardLogic || null;
    const chooseTargetBySimulation = typeof cfg.chooseTargetBySimulation === 'function'
        ? cfg.chooseTargetBySimulation
        : (() => null);
    const evaluatePositionValue = typeof cfg.evaluatePositionValue === 'function'
        ? cfg.evaluatePositionValue
        : (() => 0);
    const readSelfplayPendingEffect = typeof cfg.readSelfplayPendingEffect === 'function'
        ? cfg.readSelfplayPendingEffect
        : (() => null);
    const getSelfplayBoard = typeof cfg.getSelfplayBoard === 'function'
        ? cfg.getSelfplayBoard
        : (() => []);
    const getCornerProximity = typeof cfg.getCornerProximity === 'function'
        ? cfg.getCornerProximity
        : (() => null);
    const getBoardCellValue = typeof cfg.getBoardCellValue === 'function'
        ? cfg.getBoardCellValue
        : (() => null);
    const isCorner = typeof cfg.isCorner === 'function'
        ? cfg.isCorner
        : (() => false);
    const isEdge = typeof cfg.isEdge === 'function'
        ? cfg.isEdge
        : (() => false);

    function chooseGuardTarget(gameState: any, cardState: any, playerKey: any, rng: any) {
        return chooseTargetBySimulation(
            gameState,
            cardState,
            playerKey,
            rng,
            (simCardState: any, simGameState: any, onePlayerKey: any, row: any, col: any) =>
                cardLogic.applyGuardWill(simCardState, simGameState, onePlayerKey, row, col),
            (target: any, sourceGameState: any, sourceCardState: any) => (
                evaluatePositionValue(
                    target.row,
                    target.col,
                    getSelfplayBoard(sourceGameState, sourceCardState)
                ) * 1.4
            )
        );
    }

    function chooseLivingWillTarget(gameState: any, cardState: any, playerKey: any, rng: any) {
        return chooseTargetBySimulation(
            gameState,
            cardState,
            playerKey,
            rng,
            (simCardState: any, simGameState: any, onePlayerKey: any, row: any, col: any) =>
                cardLogic.applyLivingWill(simCardState, simGameState, onePlayerKey, row, col),
            (target: any, sourceGameState: any, sourceCardState: any) => (
                evaluatePositionValue(
                    target.row,
                    target.col,
                    getSelfplayBoard(sourceGameState, sourceCardState)
                ) * 1.2
            ),
            null,
            'getLivingWillTargets'
        );
    }

    function chooseBoardExpansionTarget(gameState: any, cardState: any, playerKey: any, rng: any) {
        const pending = readSelfplayPendingEffect(cardState, playerKey);
        const pendingType = pending && typeof pending.type === 'string' ? pending.type : 'BOARD_EXPANSION_WILL';
        return chooseTargetBySimulation(
            gameState,
            cardState,
            playerKey,
            rng,
            (simCardState: any, simGameState: any, onePlayerKey: any, row: any, col: any, _simRng: any, target: any) => {
                const simPending = (simCardState && simCardState.pendingEffectByPlayer)
                    ? simCardState.pendingEffectByPlayer[onePlayerKey]
                    : null;
                const simPendingType = simPending && typeof simPending.type === 'string' ? simPending.type : pendingType;
                if (simPendingType === 'BOARD_EXPANSION_GOD' && typeof cardLogic.applyBoardExpansionGod === 'function') {
                    return cardLogic.applyBoardExpansionGod(simCardState, simGameState, onePlayerKey, row, col, target && target.directionKey);
                }
                return cardLogic.applyBoardExpansionWill(simCardState, simGameState, onePlayerKey, row, col, target && target.directionKey);
            },
            (target: any, sourceGameState: any, sourceCardState: any) => {
                const board = getSelfplayBoard(sourceGameState, sourceCardState);
                if (isCorner(target.row, target.col, board)) return 9000;
                if (isEdge(target.row, target.col, board)) return 2200;
                return 600;
            }
        );
    }

    function chooseBoardShrinkTarget(gameState: any, cardState: any, playerKey: any, rng: any) {
        const pending = readSelfplayPendingEffect(cardState, playerKey);
        const pendingType = pending && typeof pending.type === 'string' ? pending.type : 'BOARD_SHRINK_WILL';
        const targetGetterName = pendingType === 'BOARD_SHRINK_GOD'
            ? 'getBoardShrinkGodTargets'
            : 'getBoardShrinkTargets';
        return chooseTargetBySimulation(
            gameState,
            cardState,
            playerKey,
            rng,
            (simCardState: any, simGameState: any, onePlayerKey: any, row: any, col: any) => {
                const simPending = (simCardState && simCardState.pendingEffectByPlayer)
                    ? simCardState.pendingEffectByPlayer[onePlayerKey]
                    : null;
                const simPendingType = simPending && typeof simPending.type === 'string' ? simPending.type : pendingType;
                if (simPendingType === 'BOARD_SHRINK_GOD' && typeof cardLogic.applyBoardShrinkGod === 'function') {
                    return cardLogic.applyBoardShrinkGod(simCardState, simGameState, onePlayerKey, row, col);
                }
                return cardLogic.applyBoardShrinkWill(simCardState, simGameState, onePlayerKey, row, col);
            },
            () => 0,
            null,
            targetGetterName
        );
    }

    function chooseBlockadeTarget(gameState: any, cardState: any, playerKey: any, rng: any) {
        return chooseTargetBySimulation(
            gameState,
            cardState,
            playerKey,
            rng,
            (simCardState: any, simGameState: any, onePlayerKey: any, row: any, col: any) =>
                cardLogic.applyBlockadeWill(simCardState, simGameState, onePlayerKey, row, col),
            (target: any, sourceGameState: any, sourceCardState: any) => (
                evaluatePositionValue(
                    target.row,
                    target.col,
                    getSelfplayBoard(sourceGameState, sourceCardState)
                ) * 1.3
            )
        );
    }

    function chooseFreezeTarget(gameState: any, cardState: any, playerKey: any, rng: any) {
        return chooseTargetBySimulation(
            gameState,
            cardState,
            playerKey,
            rng,
            (simCardState: any, simGameState: any, onePlayerKey: any, row: any, col: any) =>
                cardLogic.applyFreezeWill(simCardState, simGameState, onePlayerKey, row, col),
            (target: any, sourceGameState: any, sourceCardState: any) => (
                evaluatePositionValue(
                    target.row,
                    target.col,
                    getSelfplayBoard(sourceGameState, sourceCardState)
                ) * 1.1
            ),
            null,
            'getFreezeTargets'
        );
    }

    function chooseSeedTarget(gameState: any, cardState: any, playerKey: any, rng: any) {
        return chooseTargetBySimulation(
            gameState,
            cardState,
            playerKey,
            rng,
            (simCardState: any, simGameState: any, onePlayerKey: any, row: any, col: any) =>
                cardLogic.applySeedWill(simCardState, simGameState, onePlayerKey, row, col),
            (target: any, sourceGameState: any, sourceCardState: any) => {
                const board = getSelfplayBoard(sourceGameState, sourceCardState);
                const base = evaluatePositionValue(target.row, target.col, board) * 1.15;
                const nearCorner = getCornerProximity(target.row, target.col, board);
                if (nearCorner && Array.isArray(nearCorner.corner)) {
                    const cornerCell = getBoardCellValue(board, nearCorner.corner[0], nearCorner.corner[1]);
                    if (cornerCell === 0) {
                        return base + (nearCorner.kind === 'X' ? -900 : -280);
                    }
                }
                return base + (isEdge(target.row, target.col, board) ? 180 : 40);
            }
        );
    }

    function scorePositionFallback(target: any, sourceGameState: any, sourceCardState: any) {
        return evaluatePositionValue(
            target.row,
            target.col,
            getSelfplayBoard(sourceGameState, sourceCardState)
        );
    }

    function chooseReverseWillTarget(gameState: any, cardState: any, playerKey: any, rng: any) {
        return chooseTargetBySimulation(
            gameState,
            cardState,
            playerKey,
            rng,
            (simCardState: any, simGameState: any, onePlayerKey: any, row: any, col: any) =>
                cardLogic.applyReverseWill(simCardState, simGameState, onePlayerKey, row, col),
            scorePositionFallback,
            null,
            'getReverseWillTargets'
        );
    }

    function chooseReincarnationTarget(gameState: any, cardState: any, playerKey: any, rng: any) {
        return chooseTargetBySimulation(
            gameState,
            cardState,
            playerKey,
            rng,
            (simCardState: any, simGameState: any, onePlayerKey: any, row: any, col: any, simRng: any) =>
                cardLogic.applyReincarnationWill(simCardState, simGameState, onePlayerKey, row, col, simRng),
            scorePositionFallback,
            null,
            'getReincarnationTargets'
        );
    }

    function choosePoisonTarget(gameState: any, cardState: any, playerKey: any, rng: any) {
        return chooseTargetBySimulation(
            gameState,
            cardState,
            playerKey,
            rng,
            (simCardState: any, simGameState: any, onePlayerKey: any, row: any, col: any) =>
                cardLogic.applyPoisonWill(simCardState, simGameState, onePlayerKey, row, col),
            scorePositionFallback,
            null,
            'getPoisonTargets'
        );
    }

    function chooseCausalReplayTarget(gameState: any, cardState: any, playerKey: any, rng: any) {
        return chooseTargetBySimulation(
            gameState,
            cardState,
            playerKey,
            rng,
            (simCardState: any, simGameState: any, onePlayerKey: any, row: any, col: any) =>
                cardLogic.applyCausalReplayWill(simCardState, simGameState, onePlayerKey, row, col),
            scorePositionFallback,
            null,
            'getCausalReplayTargets'
        );
    }

    return {
        chooseGuardTarget,
        chooseLivingWillTarget,
        chooseBoardExpansionTarget,
        chooseBoardShrinkTarget,
        chooseBlockadeTarget,
        chooseFreezeTarget,
        chooseSeedTarget,
        chooseReverseWillTarget,
        chooseReincarnationTarget,
        choosePoisonTarget,
        chooseCausalReplayTarget
    };
}
