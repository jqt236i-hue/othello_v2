declare function parseArgs(argv: any): {
    games: number;
    seed: number;
    maxPlies: number;
    out: any;
    hardcaseOut: null;
    allowCardUsage: boolean;
    cardUsageRate: number;
    policyMixRate: any;
    cardUsageRateJitter: number;
    tacticalWeightMin: any;
    tacticalWeightMax: any;
    tacticalDepthOpening: any;
    tacticalDepthMid: any;
    tacticalDepthEnd: any;
    tacticalBeamWidth: any;
    teacherCommitteeWeightMin: any;
    teacherCommitteeWeightMax: any;
    teacherCommitteeConsensusBonusMin: any;
    teacherCommitteeConsensusBonusMax: any;
    policyScoreWeightMin: any;
    policyScoreWeightMax: any;
    heuristicWeightMin: any;
    heuristicWeightMax: any;
    jobs: number;
    workerRetries: number;
    resumeChunkSize: number;
    reuseCompletedChunks: boolean;
    policyModelPath: null;
    policyModelPoolPaths: never[];
    policyPoolSampling: any;
    policyPoolRecencyDecay: any;
    policyCurrentAnchorRate: any;
    seedFamily: string;
    dataLane: null;
    resolvedConfigPath: null;
    verbose: boolean;
    help: boolean;
};
declare function createShardPlan(totalGames: any, baseSeed: any, jobs: any, gameIndexOffset: any): {
    shardIndex: number;
    games: number;
    seed: number;
    gameIndexOffset: number;
}[];
declare function createChunkPlan(totalGames: any, baseSeed: any, chunkSize: any, gameIndexOffset: any): {
    chunkIndex: number;
    games: number;
    seed: number;
    gameIndexOffset: number;
}[];
declare function buildChunkArtifactDir(outPath: any): any;
declare function buildChunkArtifactPaths(chunkDir: any, chunkIndex: any, includeHardcase: any): {
    outPath: any;
    hardcaseOutPath: any;
    summaryPath: any;
};
declare function runShardWorker(task: any, options: any): Promise<unknown>;
declare function isRetriableWorkerFailure(err: any): boolean;
declare function runSelfPlayParallel(args: any, options: any): Promise<{
    summary: {
        schemaVersion: any;
        totalGames: number;
        totalPlies: number;
        avgPlies: number;
        hardcaseRecords: number;
        wins: {
            black: number;
            white: number;
            draw: number;
        };
    };
    outPath: any;
    hardcaseOutPath: any;
}>;
declare function runSelfPlayWithResumeChunks(args: any): Promise<{
    summary: any;
    outPath: any;
    hardcaseOutPath: any;
}>;
declare const _default: {
    parseArgs: typeof parseArgs;
    createShardPlan: typeof createShardPlan;
    createChunkPlan: typeof createChunkPlan;
    buildChunkArtifactDir: typeof buildChunkArtifactDir;
    buildChunkArtifactPaths: typeof buildChunkArtifactPaths;
    runShardWorker: typeof runShardWorker;
    runSelfPlayParallel: typeof runSelfPlayParallel;
    runSelfPlayWithResumeChunks: typeof runSelfPlayWithResumeChunks;
    isRetriableWorkerFailure: typeof isRetriableWorkerFailure;
};
export = _default;
//# sourceMappingURL=generate-selfplay-data.d.ts.map