import { GameState } from '../../../src/types';
interface WillHunterKingResult {
    moved: Array<any>;
    destroyed: Array<any>;
    proliferated: Array<any>;
    expired: Array<any>;
}
declare function processWillHunterKingEffectsAtTurnStartAnchor(cardState: any, gameState: GameState, playerKey: string, row: number, col: number, deps: any): WillHunterKingResult;
declare const _default: {
    processWillHunterKingEffectsAtTurnStartAnchor: typeof processWillHunterKingEffectsAtTurnStartAnchor;
};
export = _default;
//# sourceMappingURL=will_hunter_king.d.ts.map