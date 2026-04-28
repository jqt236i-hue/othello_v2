#!/usr/bin/env node
declare function parseArgs(argv: string[]): {
    laneDir: null;
    rootModelsDir: string;
    deployId: null;
    minStates: number;
    force: boolean;
    dryRun: boolean;
    help: boolean;
};
declare function deployLaneModelToRoot(options: any): {
    dryRun: boolean;
    deployId: any;
    laneDir: any;
    rootDir: any;
    laneStates: number;
    laneAbstract: number;
    rootStates: number;
    rootAbstract: number;
    wouldArchiveTo: string;
    wouldCopyModel: {
        from: string;
        to: string;
    };
    onnxFiles: {
        name: string;
        laneExists: boolean;
        rootExists: boolean;
    }[];
} | {
    schemaVersion: string;
    deployId: any;
    deployedAt: string;
    laneSource: any;
    sourcePromotionId: any;
    laneStates: number;
    laneAbstract: number;
    previousRootStates: number;
    previousRootAbstract: number;
    archiveDir: string;
    archived: {
        model: any;
    };
    onnxResults: {};
    forced: boolean;
};
declare const _default: {
    parseArgs: typeof parseArgs;
    deployLaneModelToRoot: typeof deployLaneModelToRoot;
};
export = _default;
//# sourceMappingURL=deploy-lane-model-to-root.d.ts.map