declare function showSpecialStoneInfoAt(row: any, col: any): boolean;
declare function attachBoardCellInteraction(cell: any, row: any, col: any): void;
/**
 * 盤面を初期化（最初の1回のみ全レンダリング）
 * Initialize board with full rendering (first time only)
 * @param {HTMLElement} boardEl - 盤面要素
 */
declare function initializeBoardDOM(boardEl: any): void;
/**
 * 現在のゲーム状態からセル状態を構築
 * Build cell state from current game state
 * @returns {Array<Array<CellState>>} 8x8セル状態配列
 */
declare function buildCurrentCellState(): never[][];
/**
 * 差分レンダリング実行
 * Execute differential rendering
 * @param {HTMLElement} boardEl - 盤面要素
 * @returns {number} 更新されたセル数
 */
declare function renderBoardDiff(boardEl: any): number;
/**
 * 強制的に全セルを再レンダリング
 * Force full re-render of all cells
 * @param {HTMLElement} boardEl - 盤面要素
 */
declare function forceFullRender(boardEl: any): void;
/**
 * レンダリング統計をリセット
 * Reset rendering statistics
 */
declare function resetRenderStats(): void;
declare const DiffRenderer: {
    initializeBoardDOM: typeof initializeBoardDOM;
    buildCurrentCellState: typeof buildCurrentCellState;
    renderBoardDiff: typeof renderBoardDiff;
    forceFullRender: typeof forceFullRender;
    resetRenderStats: typeof resetRenderStats;
    attachBoardCellInteraction: typeof attachBoardCellInteraction;
    showSpecialStoneInfoAt: typeof showSpecialStoneInfoAt;
};
export = DiffRenderer;
//# sourceMappingURL=diff-renderer.d.ts.map