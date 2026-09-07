const Cards = require('../game/logic/cards');
const Prng = require('../game/schema/prng');

describe('anchor effect random replay', () => {
    test.each(['direct', 'options'])('%s RNG retains its owner and can resume after an effect', (shape) => {
        const rng = Prng.createPRNG(71001);
        const cs = Cards.createCardState({ random: () => 0.5, shuffle: (a) => a });
        const gs = { board: Array.from({ length: 8 }, () => Array(8).fill(0)), currentPlayer: 1,
            consecutivePasses: 0, turnNumber: 1 };
        gs.board[3][3] = 1;
        gs.board[1][1] = -1;
        gs.board[4][4] = -1;
        cs.markers.push({ id: 9101, kind: 'specialStone', row: 3, col: 3, owner: 'black',
            data: { type: 'LIGHTNING', remainingOwnerTurns: 6 } });
        const input = shape === 'direct' ? rng : { random: rng, decrementRemainingOwnerTurns: false };
        const result = Cards.processLightningWillEffectsAtTurnStartAnchor(cs, gs, 'black', 3, 3, input);
        expect(result.destroyed).toHaveLength(1);
        expect(rng.getState().calls).toBeGreaterThan(0);
        const restored = Prng.fromState(rng.getState());
        expect([rng.random(), rng.random(), rng.random()]).toEqual(
            [restored.random(), restored.random(), restored.random()]);
    });
});

export {};
