export function cpuMaybeDestroyHandCardWithPolicy(playerKey: any): boolean;
export function cpuMaybeUseCardWithPolicy(playerKey: any): boolean;
export function selectHandCardToDestroy(playerKey: any): any;
export function applyHandCardDestroy(playerKey: any, destroyChoice: any): boolean;
/**
 * カード使用判定・実行
 * @param {string} playerKey - 'black' または 'white'
 */
/**
 * Decide which card (if any) the CPU should use.
 * Pure function: inspects global state and returns a candidate object { cardId, cardDef } or null.
 * This function does NOT apply the card usage side effects; use `applyCardChoice` for that.
 * @param {string} playerKey - 'black' or 'white'
 * @returns {{cardId:string,cardDef:object}|null}
 */
export function selectCardToUse(playerKey: string): {
    cardId: string;
    cardDef: object;
} | null;
/**
 * Apply a chosen card. Performs state changes and emits UI hooks.
 * Side-effectful: mutates cardState/gameState and triggers emitters.
 * Returns true on success, false if application failed or card not in hand.
 */
export function applyCardChoice(playerKey: any, cardChoice: any): boolean;
/**
 * CPU手選択
 * @param {Array} candidateMoves - 合法手リスト
 * @param {string} playerKey - 'black' または 'white'
 * @returns {Object} 選択された手
 */
export function selectCpuMoveWithPolicy(candidateMoves: any[], playerKey: string): Object;
export function selectMoveFromOnnxPolicyAsync(candidateMoves: any, playerKey: any, level: any): Promise<any>;
export function selectCardFromOnnxPolicyAsync(playerKey: any, level: any, legalMovesCount: any, usableCardIds: any, legalMoves: any): Promise<{
    hold: boolean;
    cardId?: undefined;
    cardDef?: undefined;
} | {
    cardId: any;
    cardDef: any;
    hold?: undefined;
} | null>;
export function isCardChoiceAllowedByRisk(playerKey: any, level: any, legalMovesCount: any, cardId: any, prebuiltContext: any): boolean;
export function isCardChoiceAllowedByHighConfidence(playerKey: any, level: any, legalMovesCount: any, cardId: any, prebuiltContext: any): boolean;
export function hasPlanPressureProfileForCardType(cardType: any): boolean;
export function buildOnnxContext(playerKey: any, level: any, legalMovesCount: any, handCardIds: any, usableCardIds: any, candidateMoves: any): {
    playerKey: any;
    level: any;
    board: any;
    pendingType: any;
    legalMovesCount: any;
    ownCharge: any;
    oppCharge: any;
    deckCount: any;
    ownDeckCount: any;
    initialDeckSize: any;
    boardBonusByCell: any;
    boardBonusConsumedByCell: any;
    handCardIds: any[];
    usableCardIds: any[] | null;
    candidateMoves: any[];
    hasCornerMoveNow: boolean;
    hasEdgeMoveNow: boolean;
    maxLegalMoveBonus: number;
    highBonusMoveAvailable: boolean;
};
export function buildCardUseDecisionContext(playerKey: any, level: any, legalMovesCount: any, legalMoves: any, usableCardIds: any): {
    level: any;
    whiteLv6Mode: boolean;
    playerValue: any;
    legalMovesCount: any;
    discDiff: number;
    empties: number;
    ownCharge: any;
    oppCharge: any;
    oppHandSize: number;
    handSize: number;
    handCardIds: any[];
    deckRemaining: number | null;
    hasDestroyedCardThisTurn: boolean;
    forceUseCard: boolean;
    ownCorners: any;
    oppCorners: any;
    ownEdges: any;
    oppEdges: any;
    hasCornerMoveNow: boolean;
    hasEdgeMoveNow: boolean;
    cornerEmergency: boolean;
    cornerHoldMode: boolean;
    recoveryCostGap: number;
    highBonusMoveAvailable: boolean;
    maxLegalFlips: any;
    avgLegalFlips: any;
    maxLegalGain: any;
    maxLegalBoardBonus: any;
    cloneSplitEligibleSourceCount: number;
    ownSpecialCount: number;
    oppSpecialCount: number;
    ownGuardCount: number;
    oppGuardCount: number;
    usableCardIds: any[];
    cornerPlanState: {
        ownCorners: any;
        oppCorners: any;
        hasCornerMoveNow: boolean;
        hasEdgeMoveNow: boolean;
        cornerEmergency: boolean;
        cornerHoldMode: boolean;
        recoveryReady: boolean;
        recoveryCostGap: number;
        maxBoardBonusOnLegalMoves: number;
        highBonusMoveAvailable: boolean;
    };
};
/**
 * 破壊対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
export function cpuSelectDestroyWithPolicy(playerKey: string): Promise<void>;
/**
 * 天の恵み 候補選択
 * @param {string} playerKey - 'black' または 'white'
 */
export function cpuSelectHeavenBlessingWithPolicy(playerKey: string): Promise<void>;
/**
 * 断罪の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
export function cpuSelectCondemnWillWithPolicy(playerKey: string): Promise<void>;
/**
 * 交換の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
export function cpuSelectSwapWithEnemyWithPolicy(playerKey: string): Promise<void>;
/**
 * 入替の意志 対象選択（2段階）
 * @param {string} playerKey - 'black' または 'white'
 */
export function cpuSelectPositionSwapWillWithPolicy(playerKey: string): Promise<void>;
/**
 * 罠の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
export function cpuSelectTrapWillWithPolicy(playerKey: string): Promise<void>;
/**
 * 守る意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
export function cpuSelectGuardWillWithPolicy(playerKey: string): Promise<void>;
/**
 * 生きる意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
export function cpuSelectLivingWillWithPolicy(playerKey: string): Promise<void>;
/**
 * 捕獲の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
export function cpuSelectCaptureWillWithPolicy(playerKey: string): Promise<void>;
/**
 * 多動の継承 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
export function cpuSelectHyperactiveInheritWillWithPolicy(playerKey: string): Promise<void>;
/**
 * 延命系カード 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
export function cpuSelectExtendLifeWillWithPolicy(playerKey: string): Promise<void>;
/**
 * 腐食の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
export function cpuSelectCorrosionWillWithPolicy(playerKey: string): Promise<void>;
export function cpuSelectSuperBuoyancyWillWithPolicy(playerKey: any): Promise<void>;
export function cpuSelectSuperGravityWillWithPolicy(playerKey: any): Promise<void>;
/**
 * テレポート 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
export function cpuSelectTeleportWillWithPolicy(playerKey: string): Promise<void>;
/**
 * マステレポート 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
export function cpuSelectCellTeleportWillWithPolicy(playerKey: string): Promise<void>;
/**
 * 時限爆弾 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
export function cpuSelectTimeBombWithPolicy(playerKey: string): Promise<void>;
/**
 * 盤面拡張 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
export function cpuSelectBoardExpansionWillWithPolicy(playerKey: string): Promise<void>;
/**
 * 盤面縮小 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
export function cpuSelectBoardShrinkWithPolicy(playerKey: string): Promise<void>;
/**
 * 封鎖の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
export function cpuSelectBlockadeWillWithPolicy(playerKey: string): Promise<void>;
/**
 * 隕石 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
export function cpuSelectMeteorWillWithPolicy(playerKey: string): Promise<void>;
/**
 * 凍結の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
export function cpuSelectFreezeWillWithPolicy(playerKey: string): Promise<void>;
/**
 * 種まきの意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
export function cpuSelectSeedWillWithPolicy(playerKey: string): Promise<void>;
/**
 * 複製の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
export function cpuSelectCloneWillWithPolicy(playerKey: string): Promise<void>;
/**
 * 分裂の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
export function cpuSelectSplitWillWithPolicy(playerKey: string): Promise<void>;
/**
 * 誘惑の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
export function cpuSelectTemptWillWithPolicy(playerKey: string): Promise<void>;
export function computeCpuAction(playerKey: any): {
    type: string;
    cardId: string;
    cardDef: object;
    move?: undefined;
} | {
    type: string;
    cardId?: undefined;
    cardDef?: undefined;
    move?: undefined;
} | {
    type: string;
    move: Object;
    cardId?: undefined;
    cardDef?: undefined;
};
export function setCpuRng(rng: any): void;
export function setCpuTimerService(service: any): void;
export function setCpuExecutionMode(mode: any): void;
//# sourceMappingURL=cpu-decision.d.ts.map