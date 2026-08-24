/**
 * @file living_will.ts
 * @description Public Living Will compatibility facade with its default board port.
 */

import LivingWillCore = require('./living-will-core');
import BoardOps = require('../board_ops');

function withDefaultBoardOps(deps: any): any {
    if (deps && deps.BoardOps) return deps;
    return Object.assign({}, deps || {}, { BoardOps });
}

const CardLivingWill: any = {
    applyLivingWill(cardState: any, gameState: any, playerKey: any, row: any, col: any, deps?: any) {
        return LivingWillCore.applyLivingWill(
            cardState,
            gameState,
            playerKey,
            row,
            col,
            withDefaultBoardOps(deps)
        );
    },
    applyLivingWillAfterFlips(cardState: any, gameState: any, flips: any, flipperKey: any, deps?: any) {
        return LivingWillCore.applyLivingWillAfterFlips(
            cardState,
            gameState,
            flips,
            flipperKey,
            withDefaultBoardOps(deps)
        );
    },
    findLivingWillMarkerAt: LivingWillCore.findLivingWillMarkerAt,
    shouldTriggerForSpecialLoss: LivingWillCore.shouldTriggerForSpecialLoss,
    restoreFromLivingWillSnapshot(cardState: any, gameState: any, marker: any, trigger: any, deps?: any) {
        return LivingWillCore.restoreFromLivingWillSnapshot(
            cardState,
            gameState,
            marker,
            trigger,
            withDefaultBoardOps(deps)
        );
    }
};

export = CardLivingWill;
