import { BattleMatch } from '../game/battle/match';
import Core = require('../game/logic/core');
const Cards: any = require('../game/logic/cards');
const Prng: any = require('../game/schema/prng');

function makeMatch(override: number | null, delta: number) {
    const rng = Prng.createPRNG(24);
    const cardState = Cards.createCardState(rng);
    cardState.debugNoDraw = true;
    cardState.hands.black = ['position_swap_01'];
    cardState.charge.black = 40;
    Cards.ensureCardCopyState(cardState);
    const copyId = cardState._handCopyIdsByPlayer.black[0];
    if (override !== null) Cards.setCardCostOverrideForCopyId(cardState, copyId, override, 'OBSERVER_WILL');
    if (delta) Cards.addCardCostModifierForCopyId(cardState, copyId, delta, 'test_modifier');
    const match = new BattleMatch({ cardState, gameState: Core.createGameState(), prngState: rng.getState() });
    match.startTurn();
    return { match, copyId };
}

describe('cancel_card payment receipt', () => {
    test.each([
        ['base cost', null, 0, 13],
        ['stolen zero-cost card', 0, 0, 0],
        ['observed +5 cost', null, 5, 18],
        ['other discount', null, -4, 9],
        ['override and additive modifier', 7, 3, 10]
    ])('%s refunds exactly the payment across repeated multi-stage cancellations', (_name, override, delta, payment) => {
        const { match, copyId } = makeMatch(override as number | null, delta as number);
        for (let attempt = 0; attempt < 3; attempt++) {
            expect(match.apply({ type: 'use_card', useCardId: 'position_swap_01' }).ok).toBe(true);
            expect(match.snapshot().cardState.pendingEffectByPlayer.black).toMatchObject({ paidCharge: payment, sourceCardCopyId: copyId });
            expect(match.snapshot().cardState.charge.black).toBe(40 - Number(payment));
            expect(match.apply({ type: 'place', positionSwapTarget: { row: 3, col: 3 } } as any).ok).toBe(true);
            expect(match.apply({ type: 'cancel_card' }).ok).toBe(true);
            const state = match.snapshot().cardState;
            expect(state.charge.black).toBe(40);
            expect(state.pendingEffectByPlayer.black).toBeNull();
            expect(state.hands.black).toEqual(['position_swap_01']);
            expect(state._handCopyIdsByPlayer.black).toEqual([copyId]);
            expect(state.hasUsedCardThisTurnByPlayer.black).toBe(false);
            expect(state.cardUseCountByPlayer.black).toBe(0);
        }
    });
});
