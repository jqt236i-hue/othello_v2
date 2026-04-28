#!/usr/bin/env node
declare function parseArgs(argv: string[]): {
    games: number;
    seed: number;
    maxPlies: number;
    out: string;
    workers: number;
    seedStride: number;
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
    policyModelPath: null;
    policyModelPoolPaths: never[];
    policyPoolSampling: any;
    policyPoolRecencyDecay: any;
    policyCurrentAnchorRate: any;
    keepParts: boolean;
    verbose: boolean;
    help: boolean;
};
declare function splitGames(totalGames: any, workers: any): number[];
declare function mergeNdjson(partFiles: any, outPath: any): void;
declare const _default: {
    parseArgs: typeof parseArgs;
    splitGames: typeof splitGames;
    mergeNdjson: typeof mergeNdjson;
};
export = _default;
//# sourceMappingURL=generate-selfplay-data-parallel.d.ts.map