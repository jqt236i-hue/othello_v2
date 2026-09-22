import Core = require('../logic/core');
import { battleCardOptions, resolveBattleConfig, type BattleConfig } from '../../shared/battle/config';
import { cloneBattle, type CompleteBattlePosition } from '../../shared/battle/types';
const Cards: any = require('../logic/cards');
const Prng: any = require('../schema/prng');

/** Preserve the canonical creation and random-consumption order. */
export function createInitialBattlePosition(seed: number, options: any = {}, initialLayout?: BattleConfig['initialLayout']): CompleteBattlePosition {
    const rng = Prng.createPRNG(seed);
    const gameState = Core.createGameState(options.boardConfig);
    const cardState = Cards.createCardState(rng, options);
    if (initialLayout) {
        for (const row of gameState.board) row.fill(0);
        for (const row of cardState.stoneIdMap) row.fill(null);
        for (const [index, stone] of initialLayout.stones.entries()) {
            gameState.board[stone.row][stone.col] = stone.owner;
            cardState.stoneIdMap[stone.row][stone.col] = `s${index + 1}`;
        }
        cardState._nextStoneId = initialLayout.stones.length + 1;
        gameState.currentPlayer = initialLayout.currentPlayer ?? 1;
        // Number cells may not coexist with starting stones; do not reroll the RNG.
        for (const stone of initialLayout.stones) {
            const key = `${stone.row},${stone.col}`;
            delete cardState.boardBonusByCell[key];
        }
    }
    return { gameState, cardState: cloneBattle(cardState), prngState: rng.getState() };
}
export function prepareBattle(config: BattleConfig) {
    const resolved = resolveBattleConfig(config);
    return { config: resolved, position: createInitialBattlePosition(resolved.seed, battleCardOptions(resolved), resolved.initialLayout) };
}
