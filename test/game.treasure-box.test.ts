import * as TurnPipeline from '../game/turn/turn_pipeline.js';
import * as CardLogic from '../game/logic/cards.js';
import * as PendingCoordinator from '../game/turn/pending-coordinator.js';

describe('TREASURE_BOX (宝箱)', () => {
  afterEach(() => {
    PendingCoordinator.clearPendingSelectionAction('black');
    PendingCoordinator.clearPendingSelectionAction('white');
    delete global.ActionManager;
  });

  function makeState() {
    const prng = { shuffle: () => {}, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: 1,
      turnNumber: 1,
      consecutivePasses: 0
    };
    return { cardState, gameState };
  }

  test('use card: gains 1 when rng=0.0 and clears pending immediately', () => {
    const { cardState, gameState } = makeState();
    cardState.hands.black = ['chest_01'];
    cardState.charge.black = 0;

    const prng = { shuffle: () => {}, random: () => 0.0 };
    const action = { type: 'use_card', useCardId: 'chest_01' };
    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', action, prng);

    expect(res.events.some(e => e && e.type === 'card_used' && e.cardId === 'chest_01')).toBe(true);
    expect(res.events.some(e => e && e.type === 'treasure_box_gain' && e.gained === 1)).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(cardState.charge.black).toBe(1);
  });

  test('use card: gains 6 when rng is high', () => {
    const { cardState, gameState } = makeState();
    cardState.hands.black = ['chest_01'];
    cardState.charge.black = 0;

    const prng = { shuffle: () => {}, random: () => 0.9999 };
    const action = { type: 'use_card', useCardId: 'chest_01' };
    TurnPipeline.applyTurn(cardState, gameState, 'black', action, prng);

    expect(cardState.charge.black).toBe(6);
  });

  test('use card: clears cached pending selection action together with pending state', () => {
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    const { cardState, gameState } = makeState();
    cardState.hands.black = ['chest_01'];
    PendingCoordinator.createPendingSelectionAction(
      'black',
      'TREASURE_BOX',
      { cardId: 'chest_01' },
      { cardState }
    );

    TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'use_card', useCardId: 'chest_01' }, { shuffle: () => {}, random: () => 0.0 });

    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(PendingCoordinator.readPendingSelectionAction('black')).toBeNull();
  });
});
