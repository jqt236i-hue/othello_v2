/**
 * @file destroy_one_stone.ts
 * @description DESTROY_ONE_STONE helper - UMD module for browser and Node.js
 */
import { CardState, GameState } from '../../../src/types';
interface DestroyDeps {
    BoardOps?: any;
    destroyAt?(cardState: CardState, gameState: GameState, row: number, col: number, source?: string, tag?: string): boolean;
}
declare function applyDestroyOneStone(cardState: CardState, gameState: GameState, playerKey: string, row: number, col: number, deps?: DestroyDeps): any;
declare const _default: {
    applyDestroyOneStone: typeof applyDestroyOneStone;
};
export = _default;
//# sourceMappingURL=destroy_one_stone.d.ts.map