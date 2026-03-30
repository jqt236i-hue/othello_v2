const SharedConstants = require('../shared-constants');
const CardLogic = require('../game/logic/cards');
const TurnPipeline = require('../game/turn/turn_pipeline');
const PendingCoordinator = require('../game/turn/pending-coordinator');

describe('CardLogic applyCardUsage presentation event', () => {
  afterEach(() => {
    PendingCoordinator.clearPendingSelectionActionCache();
  });

  test('emits CARD_USED presentation event', () => {
    const defs = Array.isArray(SharedConstants.CARD_DEFS) ? SharedConstants.CARD_DEFS : [];
    const def = defs.find(d => d && d.id && d.type !== 'TEMPT_WILL');
    expect(def).toBeTruthy();

    const prng = { shuffle: () => {}, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    cardState.hands.black = [def.id];
    cardState.charge.black = Number.isFinite(def.cost) ? def.cost : 0;
    cardState.presentationEvents = [];

    const ok = CardLogic.applyCardUsage(cardState, 'black', def.id);
    expect(ok).toBe(true);
    expect(cardState.presentationEvents.some(ev => ev && ev.type === 'CARD_USED' && ev.cardId === def.id)).toBe(true);
    expect(cardState.cardUseCountByPlayer.black).toBe(1);
  });

  test('cancelPendingSelection reverts card use counter for cancellable cards', () => {
    const defs = Array.isArray(SharedConstants.CARD_DEFS) ? SharedConstants.CARD_DEFS : [];
    const def = defs.find(d => d && d.id && d.type === 'DESTROY_ONE_STONE');
    expect(def).toBeTruthy();

    const prng = { shuffle: () => {}, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)), currentPlayer: 1 };
    cardState.hands.black = [def.id];
    cardState.charge.black = Number.isFinite(def.cost) ? def.cost : 0;

    const ok = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
    expect(ok).toBe(true);
    expect(cardState.cardUseCountByPlayer.black).toBe(1);
    PendingCoordinator.storePendingSelectionAction(
      'black',
      { type: 'pending_selection', cardId: def.id, turnIndex: cardState.turnIndex || 0 },
      'DESTROY_ONE_STONE'
    );

    const canceled = CardLogic.cancelPendingSelection(cardState, 'black');
    expect(canceled && canceled.canceled).toBe(true);
    expect(cardState.cardUseCountByPlayer.black).toBe(0);
    expect(PendingCoordinator.readPendingSelectionAction('black')).toBeNull();
  });



  test('SELL_CARD_WILL sells one hand card and gains its cost', () => {
    const defs = Array.isArray(SharedConstants.CARD_DEFS) ? SharedConstants.CARD_DEFS : [];
    const sellDef = defs.find(d => d && d.id && d.type === 'SELL_CARD_WILL');
    const soldDef = defs.find(d => d && d.id && d.type === 'GOLD_STONE');
    expect(sellDef).toBeTruthy();
    expect(soldDef).toBeTruthy();

    const prng = { shuffle: () => {}, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)), currentPlayer: 1 };
    cardState.hands.black = [sellDef.id, soldDef.id];
    cardState.charge.black = Number.isFinite(sellDef.cost) ? sellDef.cost : 0;

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', sellDef.id);
    expect(used).toBe(true);
    expect(cardState.pendingEffectByPlayer.black && cardState.pendingEffectByPlayer.black.type).toBe('SELL_CARD_WILL');

    const sold = CardLogic.applySellCardWill(cardState, 'black', soldDef.id);
    expect(sold && sold.applied).toBe(true);
    expect(sold.gained).toBe(soldDef.cost);
    expect(cardState.hands.black.includes(soldDef.id)).toBe(false);
    expect(cardState.discard.includes(soldDef.id)).toBe(true);
    expect(cardState.charge.black).toBe(soldDef.cost);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('SELL_CARD_WILL cannot be used when no card remains to sell', () => {
    const defs = Array.isArray(SharedConstants.CARD_DEFS) ? SharedConstants.CARD_DEFS : [];
    const sellDef = defs.find(d => d && d.id && d.type === 'SELL_CARD_WILL');
    expect(sellDef).toBeTruthy();

    const prng = { shuffle: () => {}, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)), currentPlayer: 1 };
    cardState.hands.black = [sellDef.id];
    cardState.charge.black = Number.isFinite(sellDef.cost) ? sellDef.cost : 0;

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', sellDef.id);
    expect(used).toBe(false);
  });

});
