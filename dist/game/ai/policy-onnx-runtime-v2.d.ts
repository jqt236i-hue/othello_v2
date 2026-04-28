export function loadModel(modelPath: any, metaPath: any): Promise<{
    session: any;
    meta: any;
}>;
export function evaluate(context: any): Promise<{
    policy: Map<any, any>;
    wdl: {
        win: number;
        draw: number;
        loss: number;
    };
    card: Map<any, any> | null;
    value: number;
}>;
export function chooseMove(candidateMoves: any, context: any): Promise<any>;
export function chooseCard(usableCardIds: any, context: any): Promise<any>;
export function getLastError(): any;
export function buildBoardTensor(board: any, playerKey: any): any;
export function buildAuxVector(context: any): any;
export function buildHandTensor(handCardIds: any): any;
//# sourceMappingURL=policy-onnx-runtime-v2.d.ts.map