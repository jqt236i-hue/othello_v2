declare function getQueuedHandFadeInState(): {
    playerKey: any;
    count: number;
    token: any;
} | null;
declare function settleOwnerHandFadeIn(playerKey: any): boolean;
/**
 * 破壊アニメーション
 * Animate destruction at a single board cell (returns a Promise)
 * @param {number} row - 行
 * @param {number} col - 列
 * @returns {Promise<void>}
 */
declare function animateDestroyAt(row: any, col: any, options: any): Promise<void>;
/**
 * フェードアウトアニメーション（破壊用）
 * Animate fade-out at a single board cell (returns a Promise)
 * @param {number} row - 行
 * @param {number} col - 列
 * @returns {Promise<void>}
 */
declare function animateFadeOutAt(row: any, col: any, options: any): Promise<void>;
/**
 * 強い意志付与のフェードイン
 * @param {number} row
 * @param {number} col
 * @returns {Promise<void>}
 */
declare function animateStrongWillApply(row: any, col: any): Promise<void>;
/**
 * 石配置アニメーション
 * Play hand animation for stone placement
 * @param {number} player - プレイヤー (BLACK or WHITE)
 * @param {number} row - 行
 * @param {number} col - 列
 * @param {Function} onComplete - 完了コールバック
 */
declare function playHandAnimation(player: any, row: any, col: any, onComplete: any, visualOptions: any): any;
/**
 * 手札全消去アニメーション
 * @param {{player:string|number,count?:number,reason?:string}} payload
 * @returns {Promise<void>}
 */
declare function playClearHandAnimation(payload: any): Promise<void>;
declare function playCaptureToHandAnimation(payload: any): any;
/**
 * ドロー時のハンド演出
 * Hand carries a card from deck to hand area.
 * @param {{player:string|number, cardId?:string|null, count?:number}} payload
 * @returns {Promise<void>}
 */
declare function playDrawCardHandAnimation(payload: any): any;
declare function playDirectHandAddAnimation(payload: any): Promise<void>;
declare function playTrapPlacementFlash(row: any, col: any, playerKey: any): void;
/**
 * カード使用時のハンド搬送演出
 * Hand carries a used card from hand side to charge UI.
 * @param {{player?:string|number, owner?:string|number, cardId?:string|null, cost?:number|null, name?:string|null}} payload
 * @returns {Promise<void>}
 */
declare function playCardUseHandAnimation(payload: any): any;
/**
 * 多動石の移動アニメーション
 * Smoothly translate a disc from source cell to target cell.
 * @param {{row:number,col:number}} from
 * @param {{row:number,col:number}} to
 * @returns {Promise<void>}
 */
declare function animateHyperactiveMove(from: any, to: any, options: any): Promise<void>;
declare const AnimationUtils: {
    animateDestroyAt: typeof animateDestroyAt;
    animateFadeOutAt: typeof animateFadeOutAt;
    playHandAnimation: typeof playHandAnimation;
    playClearHandAnimation: typeof playClearHandAnimation;
    playDrawCardHandAnimation: typeof playDrawCardHandAnimation;
    playDirectHandAddAnimation: typeof playDirectHandAddAnimation;
    playCaptureToHandAnimation: typeof playCaptureToHandAnimation;
    playTrapPlacementFlash: typeof playTrapPlacementFlash;
    playCardUseHandAnimation: typeof playCardUseHandAnimation;
    animateHyperactiveMove: typeof animateHyperactiveMove;
    animateStrongWillApply: typeof animateStrongWillApply;
    getQueuedHandFadeInState: typeof getQueuedHandFadeInState;
    settleOwnerHandFadeIn: typeof settleOwnerHandFadeIn;
};
export = AnimationUtils;
//# sourceMappingURL=animation-utils.d.ts.map