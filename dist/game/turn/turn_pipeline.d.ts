/**
 * Apply a single action within a turn, following a fixed turn pipeline.
 * - action: { type: 'place' | 'pass' | 'use_card' | 'cancel_card' | 'destroy_hand_card', row?, col?, useCardId?, useCardOwnerKey?, destroyCardId?, destroyOptions?, debugOptions?, cancelOptions?, destroyTarget?: {row:number,col:number}, strongWindTarget?: {row:number,col:number}, superBuoyancyTarget?: {row:number,col:number}, superGravityTarget?: {row:number,col:number}, teleportTarget?: {row:number,col:number}, temptTarget?, captureTarget?: {row:number,col:number}, positionSwapTarget?: {row:number,col:number}, trapTarget?: {row:number,col:number}, bombTarget?: {row:number,col:number}, cloneTarget?: {row:number,col:number}, splitTarget?: {row:number,col:number}, blockadeTarget?: {row:number,col:number}, meteorTarget?: {row:number,col:number}, livingWillTarget?: {row:number,col:number} }
 * - If useCardId is provided it will be applied before placement (consuming charge/hand)
 * Returns { gameState, cardState, events }
 *
 * Note: Originally headless-only. Now UMD so the browser can call the same pipeline.
 */
export function applyTurn(cardState: any, gameState: any, playerKey: any, action: any, prng: any, options: any): {
    gameState: any;
    cardState: any;
    events: any[];
    presentationEvents: any;
};
/**
 * Safe wrapper for applyTurn for online/server usage.
 * - Never mutates input objects (clones before applying)
 * - Never throws; returns ok=false with a reason code instead
 * - Returns full Result schema with nextStateVersion
 *
 * @param {object} cardState
 * @param {object} gameState
 * @param {string} playerKey
 * @param {object} action
 * @param {object} prng
 * @param {object} [options] - Optional settings
 * @param {number} [options.currentStateVersion] - Current state version
 * @returns {{ ok: boolean, gameState: object, cardState: object, events: Array, nextStateVersion: number, rejectedReason?: string, errorMessage?: string }}
 */
export function applyTurnSafe(cardState: object, gameState: object, playerKey: string, action: object, prng: object, options?: {
    currentStateVersion?: number | undefined;
}): {
    ok: boolean;
    gameState: object;
    cardState: object;
    events: any[];
    nextStateVersion: number;
    rejectedReason?: string;
    errorMessage?: string;
};
//# sourceMappingURL=turn_pipeline.d.ts.map