/**
 * 合法手リストを取得
 * @param {Object} state - ゲーム状態
 * @param {Array} protectedStones - 保護石リスト
 * @param {Array} permaProtectedStones - 永久保護石リスト
 * @returns {Array} 合法手リスト
 */
declare function getLegalMoves(state: any, protectedStones: any, permaProtectedStones: any): any;
/**
 * プレイヤーの手を生成（カード効果考慮）
 */
declare function generateMovesForPlayer(player: any, pending: any, protection: any, perma: any): any;
/**
 * 自由配置モードの手を生成
 */
declare function generateFreePlacementMoves(player: any, protection: any, perma: any, effectType: any): {
    row: any;
    col: any;
    flips: any;
    effectUsed: any;
    player: any;
    playerValue: any;
}[];
/**
 * スワップモードの手を生成
 */
declare function generateSwapMoves(player: any, legal: any, protection: any, perma: any): {
    row: any;
    col: any;
    flips: any;
    effectUsed: string;
    player: any;
    playerValue: any;
}[];
/**
 * 特定セルの手を検索
 */
declare function findMoveForCell(player: any, row: any, col: any, pending: any, protection: any, perma: any): any;
/**
 * 座標を表記法に変換
 */
declare function posToNotation(row: any, col: any): any;
/**
 * 角かどうか判定
 */
declare function isCorner(row: any, col: any, boardOrRows: any): any;
/**
 * 辺かどうか判定
 */
declare function isEdge(row: any, col: any, boardOrRows: any): any;
declare const _default: {
    getLegalMoves: typeof getLegalMoves;
    generateMovesForPlayer: typeof generateMovesForPlayer;
    generateFreePlacementMoves: typeof generateFreePlacementMoves;
    generateSwapMoves: typeof generateSwapMoves;
    findMoveForCell: typeof findMoveForCell;
    posToNotation: typeof posToNotation;
    isCorner: typeof isCorner;
    isEdge: typeof isEdge;
};
export = _default;
//# sourceMappingURL=move-generator.d.ts.map