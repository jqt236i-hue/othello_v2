import Cards = require('../game/logic/cards');
import Pipeline = require('../game/turn/turn_pipeline');
import BoardOps = require('../game/logic/board_ops');
import { createInitialBattlePosition } from '../game/battle/initial';
import { flushTurnStartPostFlipRevives } from '../game/turn/turn-start/post-processing';

const random = { random: () => 0, shuffle: (xs: any[]) => xs };

function setup(type = 'REGEN', attacker = 'black') {
    const attackValue = attacker === 'black' ? 1 : -1;
    const defender = attacker === 'black' ? 'white' : 'black';
    const position = createInitialBattlePosition(77, {}, {
        stones: [
            { row: 3, col: 0, owner: -attackValue },
            { row: 3, col: 2, owner: -attackValue },
            { row: 3, col: 3, owner: attackValue }
        ], currentPlayer: attackValue
    });
    const cs: any = position.cardState;
    cs.boardBonusByCell = {};
    cs.charge = { black: 0, white: 0 };
    cs.chargeGainedTotal = { black: 0, white: 0 };
    cs.lastTurnStartedFor = attacker;
    Cards.applyRegenWill(cs, defender, 3, 2);
    if (type === 'ZOMBIE') {
        const marker = cs.markers.find((m: any) => m.data.type === 'REGEN');
        marker.data.type = 'ZOMBIE';
        marker.data.regenRemaining = 1;
        delete marker.data.remainingOwnerTurns;
    }
    return { cs, gs: position.gameState, defender, attackValue };
}

function place(cs: any, gs: any, attacker = 'black') {
    const result = Pipeline.applyTurnSafe(cs, gs, attacker, { type: 'place', row: 3, col: 1 }, random, { skipTurnStart: true });
    expect(result.ok).toBe(true);
    return result;
}

describe('revival capture charge belongs to the reviving stone', () => {
    test.each(['REGEN', 'ZOMBIE'])('%s capture is not counted as an attacking placement flip', (type) => {
        const { cs, gs } = setup(type);
        const result = place(cs, gs);
        expect(result.gameState.board[3].slice(0, 4)).toEqual([-1, -1, -1, 1]);
        expect(result.cardState.charge).toEqual({ black: 1, white: 1 });
        expect(result.cardState.chargeGainedTotal).toEqual({ black: 1, white: 1 });
        expect(result.presentationEvents).toContainEqual(expect.objectContaining({
            type: 'CHARGE_BUBBLE', player: 'white', row: 3, col: 2, gained: 1
        }));
        expect(result.cardState.chargeDeltaEvents).toContainEqual(expect.objectContaining({
            player: 'white', delta: 1,
            popupKind: 'board', anchorRow: 3, anchorCol: 2
        }));
    });

    test('uses each actual owner\'s multiplier and caps the defender\'s gain', () => {
        const { cs, gs } = setup('REGEN', 'white');
        cs.chargeGainMultiplierByPlayer = { black: 3, white: 2 };
        cs.charge.black = 98;
        const result = place(cs, gs, 'white');
        expect(result.cardState.charge).toEqual({ black: 99, white: 2 });
        expect(result.cardState.chargeGainedTotal).toEqual({ black: 1, white: 2 });
    });

    test('does not pass revival captures to the attacker\'s chain', () => {
        const { cs, gs } = setup();
        cs.pendingEffectByPlayer.black = { type: 'DOUBLE_CHAIN_WILL', cardId: 'chain_01', stage: null };
        const original = Cards.applyChainWillAfterMove;
        const chain = jest.spyOn(Cards, 'applyChainWillAfterMove').mockImplementation((...args: any[]) => {
            expect(args[3]).toEqual([[3, 2]]);
            return original(...args);
        });
        try {
            const result = place(cs, gs);
            expect(chain).toHaveBeenCalledTimes(1);
            expect(result.cardState.charge).toEqual({ black: 1, white: 1 });
        } finally { chain.mockRestore(); }
    });

    test('chain-triggered revival captures are credited separately from the chain', () => {
        const { cs, gs } = setup();
        // Main placement flips (2,1); its chain flips the white REGEN at (3,2).
        gs.board[3][2] = -1;
        gs.board[3][3] = 0;
        gs.board[2][1] = -1;
        gs.board[1][1] = 1;
        gs.board[3][1] = 0;
        cs.pendingEffectByPlayer.black = { type: 'DOUBLE_CHAIN_WILL', cardId: 'chain_01', stage: null };
        const chain = jest.spyOn(Cards, 'applyChainWillAfterMove').mockImplementation((state: any, game: any) => {
            BoardOps.changeAt(state, game, 3, 2, 'black', 'CHAIN_WILL', 'chain_flip');
            return { applied: true, flips: [{ row: 3, col: 2 }] };
        });
        try {
            const result = place(cs, gs);
            expect(result.cardState.charge).toEqual({ black: 2, white: 1 });
        } finally { chain.mockRestore(); }
    });

    test('alternating revival chains credit each reaction, not the final colours', () => {
        const { cs, gs } = setup();
        gs.board[3][1] = 1;
        gs.board[3][2] = 1; // just flipped by black
        gs.board[3][0] = 0; // retain black (3,1) as the black revival's endpoint
        gs.board[3][4] = -1;
        Cards.applyRegenWill(cs, 'black', 3, 3);
        const result = Cards.applyPostFlipRevives(cs, gs, [{ row: 3, col: 2 }], 'black');
        expect(result.regenRes.captureFlips).toHaveLength(6);
        expect(cs.charge).toEqual({ black: 3, white: 3 });
        expect(cs.chargeGainedTotal).toEqual({ black: 3, white: 3 });
    });

    test('destroy-triggered revival uses the same charge ledger without a pipeline caller', () => {
        const { cs, gs } = setup();
        gs.board[3][1] = 1;
        cs.chargeGainMultiplierByPlayer = { black: 1, white: 3 };
        const result = BoardOps.destroyAt(cs, gs, 3, 2, 'DESTROY_ONE_STONE', 'test');
        expect(result.regenerated).toBe(true);
        expect(cs.charge).toEqual({ black: 0, white: 3 });
        expect(cs.chargeGainedTotal).toEqual({ black: 0, white: 3 });
    });

    test('turn-start followups do not award a second gain to the original flipper', () => {
        const { cs, gs } = setup();
        gs.board[3][1] = 1;
        gs.board[3][2] = 1;
        const award = jest.fn();
        flushTurnStartPostFlipRevives({
            CardLogic: Cards, cardState: cs, gameState: gs, events: [],
            flippedByOwner: { black: [{ row: 3, col: 2 }], white: [] },
            applyPostFlipRevives: (logic, state, game, flips, owner) => logic.applyPostFlipRevives(state, game, flips, owner),
            awardBoardChargeGain: award
        });
        expect(cs.charge).toEqual({ black: 0, white: 1 });
        expect(award).not.toHaveBeenCalled();
    });

    test('swap followups do not credit the swapping player for revival captures', () => {
        const { cs, gs } = setup();
        gs.board[3][1] = -1;
        cs.pendingEffectByPlayer.black = { type: 'SWAP_WITH_ENEMY' };
        const result = Cards.applySwapEffectDetailed(cs, gs, 'black', 3, 1);
        expect(result.swapped).toBe(true);
        expect(cs.charge).toEqual({ black: 2, white: 1 });
    });

    test('reverse-will followups do not credit the original reverse owner', () => {
        const { cs, gs } = setup();
        gs.board[3][1] = 1;
        cs.pendingEffectByPlayer.black = { type: 'REVERSE_WILL', cardId: 'reverse_will_01', stage: 'selectTarget' };
        const result = Pipeline.applyTurnSafe(cs, gs, 'black', {
            type: 'place', reverseWillTarget: { row: 3, col: 3 }
        }, random, { skipTurnStart: true });
        expect(result.ok).toBe(true);
        expect(result.cardState.charge).toEqual({ black: 1, white: 1 });
    });
});
