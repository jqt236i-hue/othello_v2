const Cards = require('../game/logic/cards');
const StateManager = require('../game/cards/state-manager');
const { BattleMatch } = require('../game/battle/match');
const { createInitialBattlePosition } = require('../game/battle/initial');
const Position = require('../game/ai/cpu-lv10-position');

function observedState(observer = 'black') {
    const state = Cards.createCardState({ shuffle: (a) => a, random: () => 0.5 }, { plainReversi: true });
    Cards.addMarker(state, 'manifestStone', 3, 4, observer, { type: 'OBSERVER_WILL', remainingOwnerTurns: 4 });
    return state;
}

function expectObserved(state, owner, observer, added) {
    expect(Cards.isCardCopyIdRevealedToViewer(state, observer, added.cardCopyId)).toBe(true);
    expect(Cards.getEffectiveCardCostForCopy(state, added.cardId, added.cardCopyId))
        .toBe(Cards.getCardCost(added.cardId) + 5);
    expect(state.cardCostModifiersByCopyId[String(added.cardCopyId)])
        .toEqual([{ delta: 5, sourceType: 'OBSERVER_WILL' }]);
    expect(Cards.getHandCopyIds(state, owner)).toContain(added.cardCopyId);
}

describe('observer observes every hand acquisition', () => {
    test.each(['black', 'white'])('shared hand additions are observed for %s', (owner) => {
        const observer = owner === 'black' ? 'white' : 'black';
        const state = observedState(observer);
        const added = StateManager.addToHand(state, owner, 'guard_01');
        expectObserved(state, owner, observer, added);
        const second = Cards.addCardToHand(state, owner, 'silver_stone');
        expectObserved(state, owner, observer, second);
        expectObserved(state, owner, observer, added);
    });

    test('a generated throw-chain successor is observed immediately', () => {
        const state = observedState();
        const board = Array.from({ length: 8 }, () => Array(8).fill(0));
        board[3][3] = -1; board[3][4] = 1; board[4][3] = 1; board[4][4] = -1;
        const game = { board, currentPlayer: -1, turnNumber: 30 };
        Cards.addCardToHand(state, 'white', 'double_01');
        state.charge.white = 99;
        expect(Cards.applyCardUsage(state, game, 'white', 'double_01')).toBe(true);
        expect(state.hands.white).toEqual(['triple_01']);
        expectObserved(state, 'white', 'black', { cardId: 'triple_01', cardCopyId: Cards.getHandCopyIds(state, 'white')[0] });
    });

    test('returning the same copy from discard does not add a second observation tax', () => {
        const state = observedState();
        const added = Cards.addCardToHand(state, 'white', 'guard_01');
        const removed = Cards.removeHandCardAt(state, 'white', 0);
        Cards.addCardToDiscard(state, removed.cardId, removed.cardCopyId);
        const restored = Cards.moveDiscardCardToHandByCardId(state, 'white', 'guard_01');
        expect(restored.cardCopyId).toBe(added.cardCopyId);
        expectObserved(state, 'white', 'black', restored);
    });

    test.each(['observer_will_01', 'theory_incarnation_01', 'board_executor_01'])('special card %s is revealed without a tax', (cardId) => {
        const state = observedState();
        const added = Cards.addCardToHand(state, 'white', cardId);
        expect(Cards.isCardCopyIdRevealedToViewer(state, 'black', added.cardCopyId)).toBe(true);
        expect(Cards.getEffectiveCardCostForCopy(state, cardId, added.cardCopyId)).toBe(Cards.getCardCost(cardId));
        expect(state.cardCostModifiersByCopyId[String(added.cardCopyId)]).toBeUndefined();
    });

    test('inactive observers and the observer owner do not tax new cards', () => {
        const state = observedState();
        const own = Cards.addCardToHand(state, 'black', 'guard_01');
        expect(Cards.getEffectiveCardCostForCopy(state, own.cardId, own.cardCopyId)).toBe(Cards.getCardCost(own.cardId));
        state.markers[0].data.remainingOwnerTurns = 0;
        const other = Cards.addCardToHand(state, 'white', 'guard_01');
        expect(Cards.isCardCopyIdRevealedToViewer(state, 'black', other.cardCopyId)).toBe(false);
        expect(Cards.getEffectiveCardCostForCopy(state, other.cardId, other.cardCopyId)).toBe(Cards.getCardCost(other.cardId));
    });

    test('Heaven Blessing generation is taxed before an empty-deck consecutive turn can use it', () => {
        const initial = createInitialBattlePosition(23, {
            initialDeckCardIdsByPlayer: { black: ['guard_01'], white: ['heaven_01'] },
            initialChargeByPlayer: { black: 99, white: 99 }
        });
        initial.gameState.currentPlayer = -1;
        initial.gameState.turnNumber = 30;
        initial.cardState.timeStopConsecutiveTurnsRemainingByPlayer.white = 2;
        Cards.addMarker(initial.cardState, 'manifestStone', 3, 4, 'black', { type: 'OBSERVER_WILL', remainingOwnerTurns: 4 });
        const match = new BattleMatch(initial);
        expect(match.startTurn().ok).toBe(true);
        expect(match.apply({ type: 'use_card', useCardId: 'heaven_01', useCardHandIndex: 0, useCardOwnerKey: 'white' }, { skipTurnStart: true }, 'white').ok).toBe(true);
        const offers = match.snapshot().cardState.pendingEffectByPlayer.white.offers;
        expect(offers).toContain('strong_wind_01');
        expect(match.apply({ type: 'place', heavenBlessingCardId: 'strong_wind_01' }, { skipTurnStart: true }, 'white').ok).toBe(true);
        const placement = Position.enumerateLv10Actions(match.snapshot(), { allowCards: false }).find(a => a.type === 'place' && Number.isInteger(a.row));
        expect(match.apply(placement, { skipTurnStart: true }, 'white').ok).toBe(true);
        expect(match.owner).toBe('white');
        expect(match.startTurn().ok).toBe(true);
        const before = match.snapshot().cardState;
        expect(before.decks.white).toHaveLength(0);
        const copyId = Cards.getHandCopyIds(before, 'white')[0];
        expectObserved(before, 'white', 'black', { cardId: 'strong_wind_01', cardCopyId: copyId });
        expect(match.apply({ type: 'use_card', useCardId: 'strong_wind_01', useCardHandIndex: 0, useCardOwnerKey: 'white' }, { skipTurnStart: true }, 'white').ok).toBe(true);
        expect(before.charge.white - match.snapshot().cardState.charge.white).toBe(Cards.getCardCost('strong_wind_01') + 5);
    });
});

export {};
