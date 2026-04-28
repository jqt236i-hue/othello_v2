export function getPlayerKey(player: any): any;
export function getPlayerDisplayName(player: any): "黒" | "白";
export function getOwner(player: any): any;
/**
 * 指定プレイヤーのアクティブな保護石リストを取得
 * @param {number} player - BLACK (1) or WHITE (-1)
 * @returns {Array} 保護石リスト [{row, col, remainingTurns}]
 */
export function getActiveProtectionForPlayer(player: number): any[];
/**
 * Map special stone type to visual effect key
 * @param {string} type - Special stone type
 * @returns {string|null} Effect key for applyStoneVisualEffect
 */
export function getEffectKeyForType(type: string): string | null;
//# sourceMappingURL=helpers.d.ts.map