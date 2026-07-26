/* eslint-disable @typescript-eslint/no-explicit-any */

type SelfplayAdvancedSimulationChoosersConfig = {
    CardLogic?: any;
    SharedBoardUtils?: any;
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
    toPlayerValue?: (playerKey: any) => any;
    getCellOwnerValueForSelfplay?: (gameState: any, cardState: any, row: any, col: any) => any;
    getSelfplayBoard?: (gameState: any, cardState: any) => any;
    isCorner?: (row: any, col: any, board?: any) => boolean;
    isEdge?: (row: any, col: any, board?: any) => boolean;
    isXSquare?: (row: any, col: any, board?: any) => boolean;
    getBoardBonusAtCell?: (cardState: any, row: any, col: any) => number;
};

function getExtendLifeMarkerPriority(marker: any) {
    if (!marker || !marker.data || typeof marker.data.type !== 'string') return 0;
    const type = marker.data.type;
    if (type === 'WORK') return 3800;
    if (type === 'GUARD') return 3200;
    if (type === 'BLOCKADE') return 2800;
    if (type === 'REGEN') return 2200;
    if (type === 'ULTIMATE_DESTROY_GOD') return 2600;
    if (type === 'ULTIMATE_HYPERACTIVE') return 2200;
    if (type === 'SNIPER') return 1800;
    return 800;
}

function getSpecialMarkerAt(cardState: any, row: any, col: any, ownerKey: any = null) {
    const markers = cardState && Array.isArray(cardState.markers) ? cardState.markers : [];
    return markers.find((marker: any) => (
        marker &&
        marker.kind === 'specialStone' &&
        marker.row === row &&
        marker.col === col &&
        (!ownerKey || marker.owner === ownerKey)
    )) || null;
}

export function createSelfplayAdvancedSimulationChoosers(config?: SelfplayAdvancedSimulationChoosersConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as SelfplayAdvancedSimulationChoosersConfig;
    const cardLogic = cfg.CardLogic || null;
    const sharedBoardUtils = cfg.SharedBoardUtils || null;
    const chooseTargetBySimulation = typeof cfg.chooseTargetBySimulation === 'function'
        ? cfg.chooseTargetBySimulation
        : (() => null);
    const evaluatePositionValue = typeof cfg.evaluatePositionValue === 'function'
        ? cfg.evaluatePositionValue
        : (() => 0);
    const toPlayerValue = typeof cfg.toPlayerValue === 'function'
        ? cfg.toPlayerValue
        : ((playerKey: any) => playerKey);
    const getCellOwnerValueForSelfplay = typeof cfg.getCellOwnerValueForSelfplay === 'function'
        ? cfg.getCellOwnerValueForSelfplay
        : (() => 0);
    const getSelfplayBoard = typeof cfg.getSelfplayBoard === 'function'
        ? cfg.getSelfplayBoard
        : (() => null);
    const isCorner = typeof cfg.isCorner === 'function'
        ? cfg.isCorner
        : (() => false);
    const isEdge = typeof cfg.isEdge === 'function'
        ? cfg.isEdge
        : (() => false);
    const isXSquare = typeof cfg.isXSquare === 'function'
        ? cfg.isXSquare
        : (() => false);
    const getBoardBonusAtCell = typeof cfg.getBoardBonusAtCell === 'function'
        ? cfg.getBoardBonusAtCell
        : (() => 0);

    function isExpansionCell(board: any, row: any, col: any) {
        if (
            !sharedBoardUtils ||
            typeof sharedBoardUtils.buildBoardTopology !== 'function' ||
            typeof sharedBoardUtils.toBoardCellKey !== 'function'
        ) {
            return false;
        }
        const topology = sharedBoardUtils.buildBoardTopology(board);
        return topology.expansionKeys.has(sharedBoardUtils.toBoardCellKey(row, col));
    }

    function chooseStrongWindTarget(gameState: any, cardState: any, playerKey: any, rng: any) {
        return chooseTargetBySimulation(
            gameState,
            cardState,
            playerKey,
            rng,
            (simCardState: any, simGameState: any, onePlayerKey: any, row: any, col: any, simRng: any) =>
                cardLogic.applyStrongWindWill(simCardState, simGameState, onePlayerKey, row, col, simRng),
            (target: any, sourceGameState: any, sourceCardState: any, onePlayerKey: any) => {
                const board = getSelfplayBoard(sourceGameState, sourceCardState);
                const selfVal = toPlayerValue(onePlayerKey);
                const occupant = getCellOwnerValueForSelfplay(sourceGameState, sourceCardState, target.row, target.col);
                const base = evaluatePositionValue(target.row, target.col, board);
                return occupant === selfVal ? (base * -0.4) : (base * -1.2);
            },
            (target: any, result: any, simGameState: any, simCardState: any, sourceGameState: any, sourceCardState: any, onePlayerKey: any) => {
                const sourceBoard = getSelfplayBoard(sourceGameState, sourceCardState);
                const resultBoard = getSelfplayBoard(simGameState, simCardState);
                const selfVal = toPlayerValue(onePlayerKey);
                const fromVal = getCellOwnerValueForSelfplay(sourceGameState, sourceCardState, target.row, target.col);
                const isOwnStone = fromVal === selfVal;
                let extra = 0;
                if (isCorner(target.row, target.col, sourceBoard) && !isOwnStone) extra += 7000;
                if (isCorner(target.row, target.col, sourceBoard) && isOwnStone) extra -= 8000;
                if (result && result.to) {
                    if (isCorner(result.to.row, result.to.col, resultBoard)) extra += isOwnStone ? 6500 : -5000;
                    if (isEdge(result.to.row, result.to.col, resultBoard) && !isCorner(result.to.row, result.to.col, resultBoard)) {
                        extra += isOwnStone ? 1800 : -900;
                    }
                    extra += getBoardBonusAtCell(sourceCardState, result.to.row, result.to.col) * 800;
                }
                return extra;
            }
        );
    }

    function chooseSuperBuoyancyTarget(gameState: any, cardState: any, playerKey: any, rng: any) {
        return chooseTargetBySimulation(
            gameState,
            cardState,
            playerKey,
            rng,
            (simCardState: any, simGameState: any, onePlayerKey: any, row: any, col: any) =>
                cardLogic.applySuperBuoyancyWill(simCardState, simGameState, onePlayerKey, row, col),
            (target: any, sourceGameState: any, sourceCardState: any, onePlayerKey: any) => {
                const board = getSelfplayBoard(sourceGameState, sourceCardState);
                const selfVal = toPlayerValue(onePlayerKey);
                const occupant = getCellOwnerValueForSelfplay(sourceGameState, sourceCardState, target.row, target.col);
                const isEnemy = occupant === -selfVal;
                const base = evaluatePositionValue(target.row, target.col, board);
                return isEnemy ? (base * 1.5) + 1200 : (base * -0.35);
            },
            (_target: any, result: any, simGameState: any, simCardState: any, _sourceGameState: any, sourceCardState: any) => {
                const board = getSelfplayBoard(simGameState, simCardState);
                let extra = 0;
                const destroyedCount = Number(result && result.destroyedCount);
                if (Number.isFinite(destroyedCount) && destroyedCount > 0) {
                    extra += destroyedCount * 520;
                }
                if (result && result.to) {
                    if (isCorner(result.to.row, result.to.col, board)) extra += 5600;
                    if (isEdge(result.to.row, result.to.col, board) && !isCorner(result.to.row, result.to.col, board)) extra += 1400;
                    extra += getBoardBonusAtCell(sourceCardState, result.to.row, result.to.col) * 900;
                }
                return extra;
            }
        );
    }

    function chooseSuperGravityTarget(gameState: any, cardState: any, playerKey: any, rng: any) {
        return chooseTargetBySimulation(
            gameState,
            cardState,
            playerKey,
            rng,
            (simCardState: any, simGameState: any, onePlayerKey: any, row: any, col: any) =>
                cardLogic.applySuperGravityWill(simCardState, simGameState, onePlayerKey, row, col),
            (target: any, sourceGameState: any, sourceCardState: any, onePlayerKey: any) => {
                const board = getSelfplayBoard(sourceGameState, sourceCardState);
                const selfVal = toPlayerValue(onePlayerKey);
                const occupant = getCellOwnerValueForSelfplay(sourceGameState, sourceCardState, target.row, target.col);
                const isEnemy = occupant === -selfVal;
                const base = evaluatePositionValue(target.row, target.col, board);
                return isEnemy ? (base * 1.5) + 1200 : (base * -0.35);
            },
            (_target: any, result: any, simGameState: any, simCardState: any, _sourceGameState: any, sourceCardState: any) => {
                const board = getSelfplayBoard(simGameState, simCardState);
                let extra = 0;
                const destroyedCount = Number(result && result.destroyedCount);
                if (Number.isFinite(destroyedCount) && destroyedCount > 0) {
                    extra += destroyedCount * 520;
                }
                if (result && result.to) {
                    if (isCorner(result.to.row, result.to.col, board)) extra += 5600;
                    if (isEdge(result.to.row, result.to.col, board) && !isCorner(result.to.row, result.to.col, board)) extra += 1400;
                    extra += getBoardBonusAtCell(sourceCardState, result.to.row, result.to.col) * 900;
                }
                return extra;
            }
        );
    }

    function chooseMeteorTarget(gameState: any, cardState: any, playerKey: any, rng: any) {
        return chooseTargetBySimulation(
            gameState,
            cardState,
            playerKey,
            rng,
            (simCardState: any, simGameState: any, onePlayerKey: any, row: any, col: any, simRng: any) =>
                cardLogic.applyMeteorWill(simCardState, simGameState, onePlayerKey, row, col, simRng),
            (target: any, sourceGameState: any, sourceCardState: any) => (
                evaluatePositionValue(target.row, target.col, getSelfplayBoard(sourceGameState, sourceCardState)) * 1.35
            )
        );
    }

    function chooseTrapTarget(gameState: any, cardState: any, playerKey: any, rng: any) {
        return chooseTargetBySimulation(
            gameState,
            cardState,
            playerKey,
            rng,
            (simCardState: any, simGameState: any, onePlayerKey: any, row: any, col: any) =>
                cardLogic.applyTrapWill(simCardState, simGameState, onePlayerKey, row, col),
            (target: any, sourceGameState: any, sourceCardState: any) => (
                evaluatePositionValue(target.row, target.col, getSelfplayBoard(sourceGameState, sourceCardState)) * 1.1
            )
        );
    }

    function chooseCloneTarget(gameState: any, cardState: any, playerKey: any, rng: any) {
        return chooseTargetBySimulation(
            gameState,
            cardState,
            playerKey,
            rng,
            (simCardState: any, simGameState: any, onePlayerKey: any, row: any, col: any, simRng: any) =>
                cardLogic.applyCloneWill(simCardState, simGameState, onePlayerKey, row, col, simRng),
            (target: any, sourceGameState: any, sourceCardState: any) => (
                evaluatePositionValue(target.row, target.col, getSelfplayBoard(sourceGameState, sourceCardState)) * 1.25
            )
        );
    }

    function chooseHyperactiveInheritTarget(gameState: any, cardState: any, playerKey: any, rng: any) {
        return chooseTargetBySimulation(
            gameState,
            cardState,
            playerKey,
            rng,
            (simCardState: any, simGameState: any, onePlayerKey: any, row: any, col: any) =>
                cardLogic.applyHyperactiveInheritWill(simCardState, simGameState, onePlayerKey, row, col),
            (target: any, sourceGameState: any, sourceCardState: any) => (
                evaluatePositionValue(target.row, target.col, getSelfplayBoard(sourceGameState, sourceCardState)) * 1.15
            ),
            (target: any, _result: any, sourceGameState: any, sourceCardState: any, _origGameState: any, _origCardState: any, onePlayerKey: any) => {
                const board = getSelfplayBoard(sourceGameState, sourceCardState);
                const selfVal = toPlayerValue(onePlayerKey);
                const occupant = getCellOwnerValueForSelfplay(sourceGameState, sourceCardState, target.row, target.col);
                let extra = 0;
                if (occupant === selfVal && isCorner(target.row, target.col, board)) extra += 1200;
                if (occupant === selfVal && !isCorner(target.row, target.col, board) && isEdge(target.row, target.col, board)) extra += 600;
                if (isXSquare(target.row, target.col, board)) extra -= 350;
                return extra;
            }
        );
    }

    function chooseTeleportTarget(gameState: any, cardState: any, playerKey: any, rng: any) {
        return chooseTargetBySimulation(
            gameState,
            cardState,
            playerKey,
            rng,
            (simCardState: any, simGameState: any, onePlayerKey: any, row: any, col: any, simRng: any) =>
                cardLogic.applyTeleportWill(simCardState, simGameState, onePlayerKey, row, col, simRng),
            (target: any, sourceGameState: any, sourceCardState: any, onePlayerKey: any) => {
                const board = getSelfplayBoard(sourceGameState, sourceCardState);
                const selfVal = toPlayerValue(onePlayerKey);
                const occupant = getCellOwnerValueForSelfplay(sourceGameState, sourceCardState, target.row, target.col);
                const isEnemy = occupant === -selfVal;
                const base = evaluatePositionValue(target.row, target.col, board);
                if (isEnemy) return (base * 1.4) + 900;
                return (base * -0.45);
            }
        );
    }

    function chooseCellTeleportTarget(gameState: any, cardState: any, playerKey: any, rng: any) {
        return chooseTargetBySimulation(
            gameState,
            cardState,
            playerKey,
            rng,
            (simCardState: any, simGameState: any, onePlayerKey: any, row: any, col: any, simRng: any) =>
                cardLogic.applyCellTeleportWill(simCardState, simGameState, onePlayerKey, row, col, simRng),
            (target: any, sourceGameState: any, sourceCardState: any, onePlayerKey: any) => {
                const board = getSelfplayBoard(sourceGameState, sourceCardState);
                const selfVal = toPlayerValue(onePlayerKey);
                const occupant = getCellOwnerValueForSelfplay(sourceGameState, sourceCardState, target.row, target.col);
                const isEnemy = occupant === -selfVal;
                const base = evaluatePositionValue(target.row, target.col, board);
                if (isEnemy) return (base * 1.6) + 1500;
                return (base * -0.55) - 120;
            },
            (_target: any, result: any, simGameState: any, simCardState: any, _sourceGameState: any, sourceCardState: any) => {
                const board = getSelfplayBoard(simGameState, simCardState);
                let extra = 0;
                if (result && result.to) {
                    const toOuter = isExpansionCell(board, result.to.row, result.to.col);
                    const toOuterCorner = toOuter && isCorner(result.to.row, result.to.col, board);
                    if (toOuter) extra += 1800;
                    if (toOuterCorner) extra += 1600;
                    extra += getBoardBonusAtCell(sourceCardState, result.to.row, result.to.col) * 900;
                }
                return extra;
            }
        );
    }

    function chooseExtendLifeTarget(gameState: any, cardState: any, playerKey: any, rng: any) {
        return chooseTargetBySimulation(
            gameState,
            cardState,
            playerKey,
            rng,
            (simCardState: any, simGameState: any, onePlayerKey: any, row: any, col: any) =>
                cardLogic.applyExtendLifeWill(simCardState, simGameState, onePlayerKey, row, col),
            (target: any, sourceGameState: any, sourceCardState: any) => {
                const marker = getSpecialMarkerAt(cardState, target.row, target.col, playerKey);
                const board = getSelfplayBoard(sourceGameState, sourceCardState);
                return (evaluatePositionValue(target.row, target.col, board) * 0.6) + getExtendLifeMarkerPriority(marker);
            },
            (target: any, _result: any, _simGameState: any, _simCardState: any, sourceGameState: any, sourceCardState: any, onePlayerKey: any) => {
                const board = getSelfplayBoard(sourceGameState, sourceCardState);
                const marker = getSpecialMarkerAt(sourceCardState, target.row, target.col, onePlayerKey);
                const occupant = getCellOwnerValueForSelfplay(sourceGameState, sourceCardState, target.row, target.col);
                const selfVal = toPlayerValue(onePlayerKey);
                let extra = getExtendLifeMarkerPriority(marker);
                if (occupant === selfVal && isCorner(target.row, target.col, board)) extra += 1600;
                if (occupant === selfVal && !isCorner(target.row, target.col, board) && isEdge(target.row, target.col, board)) extra += 700;
                return extra;
            }
        );
    }

    return {
        chooseStrongWindTarget,
        chooseSuperBuoyancyTarget,
        chooseSuperGravityTarget,
        chooseMeteorTarget,
        chooseTrapTarget,
        chooseCloneTarget,
        chooseHyperactiveInheritTarget,
        chooseTeleportTarget,
        chooseCellTeleportTarget,
        chooseExtendLifeTarget
    };
}
