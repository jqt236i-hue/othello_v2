export function getCardHandManagerContext(deps: any): {
    constants: {
        CARD_DEFS: any;
        CARD_TYPE_BY_ID: any;
        MAX_HAND_SIZE: number;
        RIBO_WILL_UNLOCK_TURN_INDEX: number;
    };
    helpers: {
        hasStandardLegalMoveForPlayer: any;
        canUseLastResortForPlayer: any;
        canUseEqualityWillForPlayer: any;
        canUseReinforcementWillForPlayer: any;
        canUseTimeStopGodForPlayer: any;
        countOpponentOccupiedCornersForPlayer: any;
        getTemptWillTargets: any;
        getCaptureWillTargets: any;
        getStrongWindTargets: any;
        getSuperBuoyancyTargets: any;
        getSuperGravityTargets: any;
        getTrapTargets: any;
        getGuardTargets: any;
        getLivingWillTargets: any;
        getHyperactiveInheritTargets: any;
        getExtendLifeTargets: any;
        getCorrosionTargets: any;
        getTimeBombTargets: any;
        getTeleportTargets: any;
        getCellTeleportTargets: any;
        getCloneTargets: any;
        getSplitTargets: any;
        getReinforcementWillTargets: any;
        getOccupiedBoardShapeCellsForCard: any;
        getBoardExpansionTargets: any;
        getBoardExpansionGodTargets: any;
        getBoardShrinkTargets: any;
        getBoardShrinkGodTargets: any;
        getBlockadeTargets: any;
        getMeteorTargets: any;
        getFreezeTargets: any;
    };
    modules: {
        CardDefsModule: any;
        CardCostsModule: any;
        CardSelectorsModule: any;
    };
};
export function getCardEffectTimingContext(deps: any): {
    defaultPrng: any;
    constants: {
        BLACK: any;
        WHITE: any;
        EMPTY: any;
        DRAW_INTERVAL: number;
        FLIP_CHARGE_MULTIPLIER_EFFECTS: any;
        NUMBER_CELL_CHARGE_MULTIPLIER_EFFECTS: any;
        ULTIMATE_DRAGON_TURNS: any;
        ULTIMATE_DESTROY_GOD_TURNS: any;
        ULTIMATE_HYPERACTIVE_TURNS: any;
        EXTREME_HYPERACTIVE_FLIP_EVADE_LIMIT: any;
        EXTREME_HYPERACTIVE_DESTROY_EVADE_LIMIT: any;
        AFTERIMAGE_WILL_FLIP_EVADE_LIMIT: any;
        AFTERIMAGE_WILL_DESTROY_EVADE_LIMIT: any;
        SNIPER_WILL_TURNS: any;
        DESTROY_DRAGON_TURNS: any;
        LIGHTNING_WILL_TURNS: any;
        OBSERVER_WILL_TURNS: any;
        GHOST_WILL_TURNS: any;
        SEED_WILL_TURNS: any;
        WILL_HUNTER_KING_TURNS: any;
        ROBOT_VACUUM_TURNS: any;
        TIME_STOP_GOD_TURNS: any;
        DOUBLE_PLACE_EXTRA: any;
        THROW_CHAIN_CONFIG_BY_TYPE: any;
        MARKER_KINDS: any;
    };
    helpers: {
        ensureHandDestroyFlags: any;
        processRiboWillTurnStartEffects: any;
        commitDraw: any;
        getSpecialMarkers: any;
        getCardContext: any;
        removeMarkersAt: any;
        isFrozenCellForCard: any;
        emitPresentationEvent: any;
        addChargeValue: any;
        addChargeWithTotal: any;
        addMarker: any;
        applyStrongWill: any;
        applyAbsoluteProtect: any;
        applyRegenWill: any;
        workDebugLog: any;
        workDebugError: any;
        hasBoardShapeCellForCard: any;
        getCellValueForCard: any;
        setCellValueForCard: any;
        clearStoneIdAtForCard: any;
    };
    modules: {
        CardWorkModule: any;
        CardLivingWillModule: any;
        PlunderWillModule: {
            applyPlunderWill(cardState: any, playerKey: any, flipCount: any): {
                plundered: number;
            };
        };
        ProtectedNextStoneModule: {
            applyProtectedNextStone(cardState: any, playerKey: any, row: any, col: any): {
                applied: boolean;
            };
        };
        PermaProtectNextStoneModule: {
            applyPermaProtectNextStone(cardState: any, playerKey: any, row: any, col: any): any;
        };
        BoardOpsModule: any;
    };
};
export function getCardContext(cardState: any, deps: any): {
    protectedStones: any;
    absoluteProtectedStones: any;
    permaProtectedStones: any;
    bombs: any;
    blockedCells: any;
};
/**
 * Apply card usage (Remove from hand, consume charge, set pending effect)
 */
export function applyCardUsage(cardState: any, playerKey: any, cardId: any, deps: any): boolean;
/**
 * Cancel a pending selection card (refund + return card to hand).
 */
export function cancelPendingSelection(cardState: any, playerKey: any, opts: any, deps: any): any;
//# sourceMappingURL=effect-resolver.d.ts.map