declare function parseAuditArgs(argv: string[]): {
    games: number;
    seed: number;
    maxPlies: number;
    allowCardUsage: boolean;
    cardUsageRate: number;
    types: null;
    out: null;
    help: boolean;
};
declare function compareContexts(liveContext: any, selfplayContext: any, fieldNames?: string[]): {};
declare function createTypeBucket(): {
    count: number;
    contextMismatchCount: number;
    scoreMismatchCount: number;
    useDiffCount: number;
    retentionDiffCount: number;
    maxUseDiff: number;
    maxRetentionDiff: number;
    ctxDiffFieldCounts: any;
    sample: null;
};
declare function createAuditReport(config: any): {
    config: any;
    auditedTurns: number;
    totalCardComparisons: number;
    byType: any;
    examples: never[];
};
declare function recordComparison(report: any, comparison: any): void;
declare function finalizeAuditReport(report: any): {
    config: any;
    auditedTurns: any;
    totalCardComparisons: any;
    summary: {
        type: string;
        count: any;
        contextMismatchCount: any;
        scoreMismatchCount: any;
        useDiffCount: any;
        retentionDiffCount: any;
        maxUseDiff: any;
        maxRetentionDiff: any;
        ctxDiffFieldCounts: any;
        sample: any;
    }[];
    examples: any;
};
declare function runCardContextParityAudit(options: any): Promise<{
    config: any;
    auditedTurns: any;
    totalCardComparisons: any;
    summary: {
        type: string;
        count: any;
        contextMismatchCount: any;
        scoreMismatchCount: any;
        useDiffCount: any;
        retentionDiffCount: any;
        maxUseDiff: any;
        maxRetentionDiff: any;
        ctxDiffFieldCounts: any;
        sample: any;
    }[];
    examples: any;
}>;
declare const _default: {
    FIELD_NAMES: string[];
    parseAuditArgs: typeof parseAuditArgs;
    compareContexts: typeof compareContexts;
    createTypeBucket: typeof createTypeBucket;
    createAuditReport: typeof createAuditReport;
    recordComparison: typeof recordComparison;
    finalizeAuditReport: typeof finalizeAuditReport;
    runCardContextParityAudit: typeof runCardContextParityAudit;
};
export = _default;
//# sourceMappingURL=audit-card-context-parity.d.ts.map