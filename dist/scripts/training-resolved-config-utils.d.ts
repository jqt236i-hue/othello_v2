#!/usr/bin/env node
declare function loadResolvedTrainingConfig(filePath: string): any;
declare function buildTrainCycleArgMap(resolved: any): any;
declare function applySelfplayArgsFromResolvedConfig(target: any, specified: any, resolved: any): void;
declare function applyAdoptionArgsFromResolvedConfig(target: any, specified: any, resolved: any): void;
declare function applyOnnxGateArgsFromResolvedConfig(target: any, specified: any, resolved: any): void;
declare const _default: {
    loadResolvedTrainingConfig: typeof loadResolvedTrainingConfig;
    buildTrainCycleArgMap: typeof buildTrainCycleArgMap;
    applySelfplayArgsFromResolvedConfig: typeof applySelfplayArgsFromResolvedConfig;
    applyAdoptionArgsFromResolvedConfig: typeof applyAdoptionArgsFromResolvedConfig;
    applyOnnxGateArgsFromResolvedConfig: typeof applyOnnxGateArgsFromResolvedConfig;
};
export = _default;
//# sourceMappingURL=training-resolved-config-utils.d.ts.map