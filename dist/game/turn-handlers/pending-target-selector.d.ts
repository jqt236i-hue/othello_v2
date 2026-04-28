declare function createCancelCardAction(): void;
declare function choosePendingTargetWithPolicy(options: any): any;
declare function buildPendingSelectionAction(context: any): void | {
    [x: number]: {
        row: any;
        col: any;
    };
    type: string;
} | {
    type: string;
    heavenBlessingCardId: any;
} | {
    type: string;
    condemnTargetIndex: any;
};
declare const _default: {
    buildPendingSelectionAction: typeof buildPendingSelectionAction;
    createCancelCardAction: typeof createCancelCardAction;
    choosePendingTargetWithPolicy: typeof choosePendingTargetWithPolicy;
};
export = _default;
//# sourceMappingURL=pending-target-selector.d.ts.map