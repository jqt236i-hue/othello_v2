declare function createEmptyResultPresentationState(): {
    lastResultVersionShown: null;
    resultShownForUnversioned: boolean;
};
declare function resetResultPresentationState(resultState: any): any;
declare function resolveObserverDuelResultOverride(counts: any, viewerKey: any): any;
declare function resolveCurrentMatchMode(): any;
declare function resolveCpuLevelForViewer(viewerKey: any): number;
declare function computeScoreSummaryForViewer(options: any): {
    version: 5;
    total: number;
    baseBonus: 0 | 5000 | 2000;
    speedBonus: number;
    monoBonus: number;
    supportBonus: number;
    supportBreakdown: {
        flipBonus: number;
        ownDiscBonus: number;
        total: number;
    };
    turnCount: number;
    localOutcomeKey: any;
    localKey: any;
    localDiscCount: any;
    opponentDiscCount: any;
    theoreticalMax: 11000;
};
declare function resolveObservationStoneRewardSummary(counts: any, viewerKey: any, localOutcomeKey: any): any;
declare function createObservationStoneLine(summary: any): HTMLDivElement | null | undefined;
declare function createObserverDuelDialogue(override: any): HTMLDivElement;
declare function dismissResultOverlayIfPresent(): void;
declare function syncResultPresentationFromSnapshot(options: any): boolean;
/**
 * 結果を表示
 * Show game result in log and overlay
 */
declare function showResult(): void;
/**
 * 結果オーバーレイを表示
 * Create or show a result overlay in the center of the screen
 */
declare function showResultOverlay(): void;
/**
 * モンスターの台詞を作成
 * Create monster dialogue based on game outcome
 * @param {Object} counts - 石の数 {black, white}
 * @param {string} [localOutcomeKey] - ローカル視点の勝敗キー
 * @returns {HTMLElement} ダイアログコンテナ
 */
declare function createMonsterDialogue(counts: any, localOutcomeKey: any): HTMLDivElement;
/**
 * モンスター台詞データ取得
 * Get monster dialogue data
 * @returns {Object} モンスター台詞データ
 */
declare function getMonsterDialogues(): {
    1: {
        win: string[];
        lose: string[];
        draw: string;
    };
    2: {
        win: string[];
        lose: string[];
        draw: string;
    };
    3: {
        win: string[];
        lose: string[];
        draw: string;
    };
    4: {
        win: string[];
        lose: string[];
        draw: string;
    };
    5: {
        win: string[];
        lose: string[];
        draw: string;
    };
    6: {
        win: string[];
        lose: string[];
        draw: string;
    };
};
declare const ResultOverlay: {
    showResult: typeof showResult;
    showResultOverlay: typeof showResultOverlay;
    syncResultPresentationFromSnapshot: typeof syncResultPresentationFromSnapshot;
    dismissResultOverlayIfPresent: typeof dismissResultOverlayIfPresent;
    createEmptyResultPresentationState: typeof createEmptyResultPresentationState;
    resetResultPresentationState: typeof resetResultPresentationState;
    createMonsterDialogue: typeof createMonsterDialogue;
    createObserverDuelDialogue: typeof createObserverDuelDialogue;
    getMonsterDialogues: typeof getMonsterDialogues;
    computeScoreSummaryForViewer: typeof computeScoreSummaryForViewer;
    resolveObservationStoneRewardSummary: typeof resolveObservationStoneRewardSummary;
    createObservationStoneLine: typeof createObservationStoneLine;
    resolveCpuLevelForViewer: typeof resolveCpuLevelForViewer;
    resolveCurrentMatchMode: typeof resolveCurrentMatchMode;
    resolveObserverDuelResultOverride: typeof resolveObserverDuelResultOverride;
};
export = ResultOverlay;
//# sourceMappingURL=result-overlay.d.ts.map