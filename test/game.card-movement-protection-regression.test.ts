import * as CardLogic from '../game/logic/cards.js';
import * as Core from '../game/logic/core.js';
import Movement = require('../game/logic/cards/movement');

const prng = { shuffle: (cards: any[]) => cards, random: () => 0 };
function makeState() {
    const cardState = CardLogic.createCardState(prng);
    const gameState = Core.createGameState();
    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(0));
    gameState.board[3][3] = -1;
    return { cardState, gameState };
}
function protect(cardState: any, type: string, owner = 'white') {
    cardState.markers.push({ id: 'source-protection', kind: 'specialStone', row: 3, col: 3, owner,
        data: { type, remainingOwnerTurns: 3 } });
}
const movements = [
    ['STRONG_WIND_WILL', 'strong_wind_01', 'getStrongWindTargets', 'applyStrongWindWill'],
    ['BUOYANCY_WILL', 'buoyancy_01', 'getBuoyancyTargets', 'applyBuoyancyWill'],
    ['SUPER_BUOYANCY_WILL', 'super_buoyancy_01', 'getSuperBuoyancyTargets', 'applySuperBuoyancyWill'],
    ['GRAVITY_WILL', 'gravity_01', 'getGravityTargets', 'applyGravityWill'],
    ['SUPER_GRAVITY_WILL', 'super_gravity_01', 'getSuperGravityTargets', 'applySuperGravityWill'],
    ['SUPER_ATTRACTION_WILL', 'super_attraction_01', 'getSuperAttractionTargets', 'applySuperAttractionWill'],
    ['TELEPORT_WILL', 'teleport_01', 'getTeleportTargets', 'applyTeleportWill']
];

describe('card-forced movement protection', () => {
    test.each(movements)('%s excludes frozen sources before charging', (type, cardId, getTargets) => {
        const { cardState, gameState } = makeState();
        protect(cardState, 'FREEZE');
        cardState.hands.black = [cardId];
        cardState.charge.black = 100;
        expect((CardLogic as any)[getTargets](cardState, gameState, 'black')).toEqual([]);
        expect(CardLogic.applyCardUsage(cardState, gameState, 'black', cardId)).toBe(false);
        expect(cardState.hands.black).toEqual([cardId]);
        expect(cardState.charge.black).toBe(100);
        expect(cardState.pendingEffectByPlayer.black).toBeNull();
    });

    test.each(movements)('%s rejects a newly frozen source without any side effect', (type, _cardId, _getTargets, apply) => {
        const { cardState, gameState } = makeState();
        // Both vertical crush directions have a collision which must not be destroyed.
        gameState.board[1][3] = 1;
        gameState.board[5][3] = 1;
        cardState.pendingEffectByPlayer.black = { type, stage: 'selectTarget' };
        protect(cardState, 'FREEZE');
        const before = JSON.stringify({ cardState, gameState });
        expect((CardLogic as any)[apply](cardState, gameState, 'black', 3, 3, prng).applied).toBe(false);
        expect(JSON.stringify({ cardState, gameState })).toBe(before);
    });

    test.each(['FREEZE', 'GUARD'])('super attraction rechecks the first source after %s is applied', (protection) => {
        const { cardState, gameState } = makeState();
        gameState.board[1][3] = 1;
        cardState.pendingEffectByPlayer.black = { type: 'SUPER_ATTRACTION_WILL', stage: 'selectTarget' };
        expect(CardLogic.applySuperAttractionWill(cardState, gameState, 'black', 3, 3, prng)).toMatchObject({ applied: true, completed: false });
        protect(cardState, protection);
        expect(CardLogic.getSuperAttractionTargets(cardState, gameState, 'black', cardState.pendingEffectByPlayer.black)).toEqual([]);
        const before = JSON.stringify({ cardState, gameState });
        expect(CardLogic.applySuperAttractionWill(cardState, gameState, 'black', 0, 3, prng).applied).toBe(false);
        expect(JSON.stringify({ cardState, gameState })).toBe(before);
    });

    test.each(['black', 'white'])('GUARD blocks card-forced movement of %s stones, including their owner\'s cards', (owner) => {
        for (const [type, , getTargets, apply] of movements) {
            const { cardState, gameState } = makeState();
            gameState.board[3][3] = owner === 'black' ? 1 : -1;
            protect(cardState, 'GUARD', owner);
            cardState.pendingEffectByPlayer.black = { type, stage: 'selectTarget' };
            expect((CardLogic as any)[getTargets](cardState, gameState, 'black')).not.toContainEqual({ row: 3, col: 3 });
            const before = JSON.stringify({ cardState, gameState });
            expect((CardLogic as any)[apply](cardState, gameState, 'black', 3, 3, prng).applied).toBe(false);
            expect(JSON.stringify({ cardState, gameState })).toBe(before);
        }
    });

    test.each(['FREEZE', 'GUARD'])('position swap rejects %s as either source, without mutation', (protection) => {
        const { cardState, gameState } = makeState();
        gameState.board[4][4] = 1;
        cardState.pendingEffectByPlayer.black = { type: 'POSITION_SWAP_WILL', stage: 'selectTarget' };
        protect(cardState, protection);
        expect(CardLogic.getPositionSwapTargets(cardState, gameState, 'black', cardState.pendingEffectByPlayer.black)).not.toContainEqual({ row: 3, col: 3 });
        let before = JSON.stringify({ cardState, gameState });
        expect(CardLogic.applyPositionSwapWill(cardState, gameState, 'black', 3, 3).applied).toBe(false);
        expect(JSON.stringify({ cardState, gameState })).toBe(before);
        cardState.pendingEffectByPlayer.black.firstTarget = { row: 3, col: 3 };
        before = JSON.stringify({ cardState, gameState });
        expect(CardLogic.applyPositionSwapWill(cardState, gameState, 'black', 4, 4).applied).toBe(false);
        expect(JSON.stringify({ cardState, gameState })).toBe(before);
    });

    test('execution protects frozen crush sources even if an injected target resolver is stale', () => {
        const { cardState, gameState } = makeState();
        protect(cardState, 'FREEZE');
        cardState.pendingEffectByPlayer.black = { type: 'SUPER_BUOYANCY_WILL', stage: 'selectTarget' };
        const destroyAt = jest.fn();
        const moveAt = jest.fn();
        expect(Movement.applySuperBuoyancyWill(cardState, gameState, 'black', 3, 3, {
            getCellValueForCard: (state: any, row: number, col: number) => state.board[row][col],
            getSuperBuoyancyTargets: () => [{ row: 3, col: 3 }], destroyAt, moveAt
        })).toMatchObject({ applied: false });
        expect(destroyAt).not.toHaveBeenCalled();
        expect(moveAt).not.toHaveBeenCalled();
    });
});
