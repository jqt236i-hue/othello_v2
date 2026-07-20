import * as CardLogic from '../game/logic/cards.js';
import * as Core from '../game/logic/core.js';

function createPrng() {
  return {
    shuffle: (values: any[]) => values,
    random: () => 0.5
  };
}

describe('CardLogic usability analysis public compatibility', () => {
  test('analysis and ID compatibility API preserve hand order and duplicate copies', () => {
    const cardState: any = CardLogic.createCardState(createPrng());
    const gameState: any = Core.createGameState();
    cardState.hands.black = ['chest_01', 'chest_01'];
    cardState.charge.black = 99;
    cardState.hasUsedCardThisTurnByPlayer.black = false;
    CardLogic.ensureCardCopyState(cardState);

    const analysis: any = CardLogic.analyzeCardUsability(cardState, gameState, 'black');

    expect(analysis.usableCardIds).toEqual(['chest_01', 'chest_01']);
    expect(analysis.usableCardTypes).toEqual(['TREASURE_BOX', 'TREASURE_BOX']);
    expect(analysis.usableSlots.map((slot: any) => slot.handIndex)).toEqual([0, 1]);
    expect(analysis.usableSlots[0].cardCopyId).not.toBe(analysis.usableSlots[1].cardCopyId);
    expect(CardLogic.getUsableCardIds(cardState, gameState, 'black')).toEqual(analysis.usableCardIds);
    expect(CardLogic.hasUsableCard(cardState, gameState, 'black')).toBe(true);
  });
});
