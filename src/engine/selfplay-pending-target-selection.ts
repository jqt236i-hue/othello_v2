/* eslint-disable @typescript-eslint/no-explicit-any */

type SelfplayPendingTargetSelectionConfig = {
    PendingTargetSelector?: any;
    CardLogic?: any;
    Core?: any;
    deepClone?: (value: any) => any;
    evaluateBoardForPlayer?: (gameState: any, cardState: any, playerKey: any) => number;
    evaluatePositionValue?: (row: any, col: any, boardOrSize?: any) => number;
    getSelfplayBoard?: (gameState: any, cardState: any) => any;
    clonePrng?: (rng: any) => any;
};

function fallbackClone<T>(value: T): T {
    return value;
}

export function createSelfplayPendingTargetSelection(config?: SelfplayPendingTargetSelectionConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as SelfplayPendingTargetSelectionConfig;
    const pendingTargetSelector = cfg.PendingTargetSelector || null;
    const cardLogic = cfg.CardLogic || null;
    const core = cfg.Core || null;
    const deepClone = typeof cfg.deepClone === 'function' ? cfg.deepClone : fallbackClone;
    const evaluateBoardForPlayer = typeof cfg.evaluateBoardForPlayer === 'function'
        ? cfg.evaluateBoardForPlayer
        : (() => 0);
    const evaluatePositionValue = typeof cfg.evaluatePositionValue === 'function'
        ? cfg.evaluatePositionValue
        : (() => 0);
    const getSelfplayBoard = typeof cfg.getSelfplayBoard === 'function'
        ? cfg.getSelfplayBoard
        : (() => null);
    const clonePrng = typeof cfg.clonePrng === 'function' ? cfg.clonePrng : fallbackClone;

    function choosePendingTargetByScore(targets: any, scoreTarget: any) {
        const safeTargets = Array.isArray(targets)
            ? targets.filter((target: any) => target && Number.isInteger(target.row) && Number.isInteger(target.col))
            : [];
        if (!safeTargets.length) return null;

        if (
            pendingTargetSelector &&
            typeof pendingTargetSelector.choosePendingTargetWithPolicy === 'function'
        ) {
            return pendingTargetSelector.choosePendingTargetWithPolicy({
                targets: safeTargets,
                scoreTarget
            });
        }

        let best = null;
        let bestScore = Number.NEGATIVE_INFINITY;
        for (const target of safeTargets) {
            let score = Number.NEGATIVE_INFINITY;
            try {
                const rawScore = Number(scoreTarget(target));
                score = Number.isFinite(rawScore) ? rawScore : Number.NEGATIVE_INFINITY;
            } catch (e) {
                score = Number.NEGATIVE_INFINITY;
            }
            if (!best || score > bestScore || (score === bestScore && ((target.row < best.row) || (target.row === best.row && target.col < best.col)))) {
                best = target;
                bestScore = score;
            }
        }
        return best || safeTargets[0];
    }

    function resolvePendingTargetList(cardState: any, gameState: any, playerKey: any, targetGetterNames: any) {
        const getterNames = Array.isArray(targetGetterNames)
            ? targetGetterNames
            : [targetGetterNames];
        for (const getterName of getterNames) {
            if (!getterName || !cardLogic || typeof cardLogic[getterName] !== 'function') continue;
            const targets = cardLogic[getterName](cardState, gameState, playerKey);
            if (Array.isArray(targets) && targets.length > 0) {
                return targets;
            }
        }
        return (cardLogic && typeof cardLogic.getSelectableTargets === 'function')
            ? (cardLogic.getSelectableTargets(cardState, gameState, playerKey) || [])
            : [];
    }

    function chooseTargetBySimulation(
        gameState: any,
        cardState: any,
        playerKey: any,
        rng: any,
        applyEffectFn: any,
        fallbackScoreFn: any,
        scoreAdjustFn: any = null,
        targetGetterNames: any = null
    ) {
        const targets = resolvePendingTargetList(cardState, gameState, playerKey, targetGetterNames);
        if (!targets.length) return null;

        return choosePendingTargetByScore(targets, (target: any) => {
            let score = null;
            try {
                const simGameState = core && typeof core.copyGameState === 'function'
                    ? core.copyGameState(gameState)
                    : deepClone(gameState);
                const simCardState = (cardLogic && typeof cardLogic.copyCardState === 'function')
                    ? cardLogic.copyCardState(cardState)
                    : deepClone(cardState);
                const simRng = clonePrng(rng);
                const result = applyEffectFn(simCardState, simGameState, playerKey, target.row, target.col, simRng, target);
                if (result && result.applied === true) {
                    score = evaluateBoardForPlayer(simGameState, simCardState, playerKey);
                    if (typeof scoreAdjustFn === 'function') {
                        score += Number(scoreAdjustFn(target, result, simGameState, simCardState, gameState, cardState, playerKey) || 0);
                    }
                }
            } catch (e) { /* fallback score */ }

            if (!Number.isFinite(score)) {
                score = typeof fallbackScoreFn === 'function'
                    ? Number(fallbackScoreFn(target, gameState, cardState, playerKey) || 0)
                    : evaluatePositionValue(
                        target.row,
                        target.col,
                        getSelfplayBoard(gameState, cardState)
                    );
            }
            return score;
        });
    }

    return {
        choosePendingTargetByScore,
        resolvePendingTargetList,
        chooseTargetBySimulation
    };
}
