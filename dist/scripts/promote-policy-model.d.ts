#!/usr/bin/env node
declare function parseArgs(argv: string[]): {
    adoptionResultPath: null;
    candidateModelPath: null;
    candidateOnnxPath: null;
    candidateOnnxMetaPath: null;
    candidateCardOnnxPath: null;
    candidateCardOnnxMetaPath: null;
    candidateTargetOnnxPath: null;
    candidateTargetOnnxMetaPath: null;
    candidateValueOnnxPath: null;
    candidateValueOnnxMetaPath: null;
    targetModelPath: string;
    targetOnnxPath: string;
    targetOnnxMetaPath: string;
    targetCardOnnxPath: string;
    targetCardOnnxMetaPath: string;
    targetTargetOnnxPath: string;
    targetTargetOnnxMetaPath: string;
    targetValueOnnxPath: string;
    targetValueOnnxMetaPath: string;
    promotedDir: string;
    archiveDir: string;
    manifestPath: null;
    quickGatePayloadPath: null;
    qualityGatePayloadPath: null;
    finalGatePayloadPath: null;
    onnxGatePayloadPath: null;
    warehouseManifestPath: null;
    force: boolean;
    help: boolean;
};
declare function promoteModel(options: any): {
    targetModelPath: any;
    candidateModelPath: any;
    onnxPromotion: any;
    onnxMetaPromotion: any;
    cardOnnxPromotion: any;
    cardOnnxMetaPromotion: any;
    targetOnnxPromotion: any;
    targetOnnxMetaPromotion: any;
    valueOnnxPromotion: any;
    valueOnnxMetaPromotion: any;
    championPromotion: {
        model: any;
        onnx: any;
        onnxMeta: any;
        cardOnnx: any;
        cardOnnxMeta: any;
        targetOnnx: any;
        targetOnnxMeta: any;
        valueOnnx: any;
        valueOnnxMeta: any;
    };
    challengerSnapshot: {
        model: any;
        onnx: any;
        onnxMeta: any;
        cardOnnx: any;
        cardOnnxMeta: any;
        targetOnnx: any;
        targetOnnxMeta: any;
        valueOnnx: any;
        valueOnnxMeta: any;
    };
    archivedChampion: {
        model: any;
        onnx: any;
        onnxMeta: any;
        cardOnnx: any;
        cardOnnxMeta: any;
        targetOnnx: any;
        targetOnnxMeta: any;
        valueOnnx: any;
        valueOnnxMeta: any;
    };
    manifestPath: any;
    promotionId: any;
    rollback: {
        modelPath: any;
        onnxPath: any;
        onnxMetaPath: any;
        cardOnnxPath: any;
        cardOnnxMetaPath: any;
        targetOnnxPath: any;
        targetOnnxMetaPath: any;
        valueOnnxPath: any;
        valueOnnxMetaPath: any;
    };
    forced: boolean;
    promotedAt: any;
    deployTruthPath: any;
};
declare const _default: {
    parseArgs: typeof parseArgs;
    promoteModel: typeof promoteModel;
};
export = _default;
//# sourceMappingURL=promote-policy-model.d.ts.map