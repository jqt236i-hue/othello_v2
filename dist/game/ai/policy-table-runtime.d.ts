declare const POLICY_TABLE_MODEL_SCHEMA_VERSION: "policy_table.v2";
export const DEFAULT_MODEL_URL: "data/models/policy-table.json";
export function configure(config: any): {
    enabled: boolean;
    minLevel: number;
    loaded: boolean;
    schemaVersion: any;
    statesCount: number;
    sourceUrl: string;
    lastError: any;
};
export function getStatus(): {
    enabled: boolean;
    minLevel: number;
    loaded: boolean;
    schemaVersion: any;
    statesCount: number;
    sourceUrl: string;
    lastError: any;
};
export function setModel(model: any, options: any): boolean;
export function clearModel(): void;
export function hasModel(): boolean;
export function loadFromUrl(url: any, fetchImpl: any): Promise<boolean>;
export function chooseMove(candidateMoves: any, context: any): any;
export function chooseMoveFromModel(model: any, candidateMoves: any, context: any): any;
export function getActionScore(move: any, context: any): number | null;
export function getActionScoreFromModel(model: any, move: any, context: any): number | null;
export function getActionScoreForKey(actionKey: any, context: any): number | null;
export function makeStateKey(playerKey: any, board: any, pendingType: any, legalMovesCount: any): string;
export function makeActionKeyFromMove(move: any): string;
export function canonicalizeBoard(board: any): any;
export function encodeBoard(board: any): any;
export { POLICY_TABLE_MODEL_SCHEMA_VERSION as MODEL_SCHEMA_VERSION };
//# sourceMappingURL=policy-table-runtime.d.ts.map