/* eslint-disable @typescript-eslint/no-explicit-any */

type SelfplayBasicTargetChoosersConfig = {
    CardLogic?: any;
    choosePendingTargetByScore?: (targets: any, scoreTarget: any) => any;
    evaluatePositionValue?: (row: any, col: any, boardOrSize?: any) => number;
    toPlayerValue?: (playerKey: any) => any;
    getCellOwnerValueForSelfplay?: (gameState: any, cardState: any, row: any, col: any) => any;
    getSelfplayBoard?: (gameState: any, cardState: any) => any;
};

export function createSelfplayBasicTargetChoosers(config?: SelfplayBasicTargetChoosersConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as SelfplayBasicTargetChoosersConfig;
    const cardLogic = cfg.CardLogic || null;
    const choosePendingTargetByScore = typeof cfg.choosePendingTargetByScore === 'function'
        ? cfg.choosePendingTargetByScore
        : (() => null);
    const evaluatePositionValue = typeof cfg.evaluatePositionValue === 'function'
        ? cfg.evaluatePositionValue
        : (() => 0);
    const toPlayerValue = typeof cfg.toPlayerValue === 'function'
        ? cfg.toPlayerValue
        : (() => 0);
    const getCellOwnerValueForSelfplay = typeof cfg.getCellOwnerValueForSelfplay === 'function'
        ? cfg.getCellOwnerValueForSelfplay
        : (() => null);
    const getSelfplayBoard = typeof cfg.getSelfplayBoard === 'function'
        ? cfg.getSelfplayBoard
        : (() => null);

    function getSelectableTargets(cardState: any, gameState: any, playerKey: any) {
        return (cardLogic && typeof cardLogic.getSelectableTargets === 'function')
            ? (cardLogic.getSelectableTargets(cardState, gameState, playerKey) || [])
            : [];
    }

    function chooseSwapTarget(gameState: any, cardState: any, playerKey: any, rng: any) {
        const targets = getSelectableTargets(cardState, gameState, playerKey);
        if (!targets.length) return null;
        const board = getSelfplayBoard(gameState, cardState);
        return choosePendingTargetByScore(
            targets,
            (target: any) => evaluatePositionValue(target.row, target.col, board) + rng.random() * 0.01
        );
    }

    function choosePositionSwapTarget(gameState: any, cardState: any, playerKey: any, rng: any) {
        const targets = getSelectableTargets(cardState, gameState, playerKey);
        if (!targets.length) return null;
        const board = getSelfplayBoard(gameState, cardState);
        return choosePendingTargetByScore(
            targets,
            (target: any) => evaluatePositionValue(target.row, target.col, board) + rng.random() * 0.01
        );
    }

    function chooseDestroyTarget(gameState: any, cardState: any, playerKey: any, rng: any) {
        const targets = getSelectableTargets(cardState, gameState, playerKey);
        if (!targets.length) return null;
        const selfVal = toPlayerValue(playerKey);
        const board = getSelfplayBoard(gameState, cardState);
        return choosePendingTargetByScore(targets, (target: any) => {
            const occupant = getCellOwnerValueForSelfplay(gameState, cardState, target.row, target.col);
            const isEnemy = occupant === -selfVal;
            const base = evaluatePositionValue(target.row, target.col, board);
            return (isEnemy ? 2000 : 0) + base + rng.random() * 0.01;
        });
    }

    return {
        chooseSwapTarget,
        choosePositionSwapTarget,
        chooseDestroyTarget
    };
}
