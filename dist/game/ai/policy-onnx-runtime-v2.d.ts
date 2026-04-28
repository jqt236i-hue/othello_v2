declare function buildHandTensor(handCardIds: any): any;
declare function buildBoardTensor(board: any, playerKey: any): any;
declare function buildAuxVector(context: any): any;
declare function loadModel(modelPath: any, metaPath: any): Promise<{
    session: any;
    meta: any;
}>;
declare function evaluate(context: any): Promise<{
    policy: Map<any, any>;
    wdl: {
        win: number;
        draw: number;
        loss: number;
    };
    card: Map<any, any> | null;
    value: number;
}>;
declare function chooseMove(candidateMoves: any, context: any): Promise<any>;
declare function chooseCard(usableCardIds: any, context: any): Promise<any>;
declare function getLastError(): any;
declare const _default: {
    loadModel: typeof loadModel;
    evaluate: typeof evaluate;
    chooseMove: typeof chooseMove;
    chooseCard: typeof chooseCard;
    getLastError: typeof getLastError;
    buildBoardTensor: typeof buildBoardTensor;
    buildAuxVector: typeof buildAuxVector;
    buildHandTensor: typeof buildHandTensor;
};
export = _default;
//# sourceMappingURL=policy-onnx-runtime-v2.d.ts.map