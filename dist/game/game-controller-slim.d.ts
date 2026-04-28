/**
 * ゲーム初期化
 * Initialize game on page load
 */
export function initializeGame(): void;
/**
 * 座標を表記法に変換
 * Convert coordinates to algebraic notation (e.g., a1, h8)
 * @param {number} row - 行 (0-7)
 * @param {number} col - 列 (0-7)
 * @returns {string} 表記 (例: 'a1', 'h8')
 */
export function posToNotation(row: number, col: number): string;
/**
 * @file game-controller-slim.js
 * @description ゲームコントローラーのコアモジュール（スリム版）
 * Core game controller orchestrating all modules
 *
 * このファイルは他のモジュールを統合し、グローバルAPIを提供します。
 * Integrates all modules and provides global game API
 */
export const CARD_TYPE_BY_ID: any;
//# sourceMappingURL=game-controller-slim.d.ts.map