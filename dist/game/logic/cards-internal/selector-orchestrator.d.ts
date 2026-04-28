/**
 * @file selector-orchestrator.ts
 * @description Pending target selector orchestration shared between Browser and Headless.
 */
interface SelectorContext {
    cardState?: any;
    gameState?: any;
    playerKey?: string;
    pending?: any;
    constants?: any;
    helpers?: any;
    selectorsModule?: any;
    localSelectors?: any;
}
declare function getSelectableTargetsForPending(context: SelectorContext): any[];
declare const _default: {
    getSelectableTargetsForPending: typeof getSelectableTargetsForPending;
};
export = _default;
//# sourceMappingURL=selector-orchestrator.d.ts.map