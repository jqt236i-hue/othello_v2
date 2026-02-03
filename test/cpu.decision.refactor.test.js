const path = require('path');
const cpuDecision = require(path.resolve(__dirname, '..', 'game', 'cpu-decision.js'));

describe('cpu decision refactor helpers', () => {
  beforeEach(() => {
    // reset globals
    global.gameState = {};
    global.cardState = { hands: { white: [] }, pendingEffectByPlayer: { white: null }, hasUsedCardThisTurnByPlayer: { white: false } };
    global.getActiveProtectionForPlayer = () => [];
    global.getLegalMoves = () => [];
    global.cpuSmartness = { white: 1, black: 1 };
    global.BLACK = 1; global.WHITE = -1;
    // spies
    global.emitCardStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.emitLogAdded = jest.fn();
  });

  test('selectCardToUse returns AISystem suggestion when present', () => {
    global.cardState.hands.white = ['card_a'];
    global.AISystem = { selectCardToUse: () => ({ cardId: 'card_a', cardDef: { name: 'A' } }) };

    const res = cpuDecision.selectCardToUse('white');
    expect(res).toBeDefined();
    expect(res.cardId).toBe('card_a');
  });

  test('selectCardToUse falls back to selectCardFallback when AISystem absent', () => {
    global.AISystem = null;
    // mock CardLogic to allow fallback
    global.CardLogic = {
      canUseCard: () => true,
      getCardDef: (id) => ({ name: id })
    };
    global.cardState.hands.white = ['fallback_card'];
    // force selection by using a deterministic rng
    cpuDecision.setCpuRng({ random: () => 0.0 });

    const res = cpuDecision.selectCardToUse('white');
    expect(res).not.toBeNull();
    expect(res.cardId).toBeDefined();
  });

  test('selectCardToUse catches AISystem exceptions and falls back', () => {
    global.AISystem = { selectCardToUse: () => { throw new Error('boom'); } };
    global.CardLogic = { canUseCard: () => true, getCardDef: id => ({ name: id }) };
    global.cardState.hands.white = ['fallback2'];
    cpuDecision.setCpuRng({ random: () => 0.0 });

    const res = cpuDecision.selectCardToUse('white');
    expect(res).not.toBeNull();
    expect(res.cardId).toBeDefined();
  });

  test('selectCpuMoveWithPolicy falls back to random when AISystem.selectMove throws', () => {
    // deterministic random to pick first candidate
    cpuDecision.setCpuRng({ random: () => 0.0 });
    const candidates = [{row:0,col:0,flips:[]}, {row:1,col:1,flips:[]}];
    global.AISystem = { selectMove: () => { throw new Error('crash'); } };

    const move = cpuDecision.selectCpuMoveWithPolicy(candidates, 'white');
    expect(move).toBeDefined();
    // With rng=0.0, random-based fallback returns index 0
    expect(move.row).toBe(0);
  });

  test('applyCardChoice applies via CardLogic and triggers UI update hooks', () => {
    global.CardLogic = { applyCardUsage: jest.fn(() => true) };
    global.cardState.hands.white = ['c1'];

    const ok = cpuDecision.applyCardChoice('white', { cardId: 'c1', cardDef: { name: 'C1' } });
    expect(ok).toBe(true);
    expect(CardLogic.applyCardUsage).toHaveBeenCalledWith(cardState, gameState, 'white', 'c1');
    expect(emitCardStateChange).toHaveBeenCalled();
    expect(emitBoardUpdate).toHaveBeenCalled();
    expect(emitLogAdded).toHaveBeenCalled();
  });

  test('cpuMaybeUseCardWithPolicy returns true when a card applied', () => {
    global.CardLogic = { applyCardUsage: jest.fn(() => true), canUseCard: () => true, getCardDef: (id) => ({ name: id }) };
    global.cardState.hands.white = ['c2'];
    // ensure AISystem returns our card
    global.AISystem = { selectCardToUse: () => ({ cardId: 'c2', cardDef: { name: 'C2' } }) };

    const applied = cpuDecision.cpuMaybeUseCardWithPolicy('white');
    expect(applied).toBe(true);
  });

  test('cpuMaybeUseCardWithPolicy is defensive when cardState is missing', () => {
    // remove/omit cardState
    delete global.cardState;
    const applied = cpuDecision.cpuMaybeUseCardWithPolicy('white');
    expect(applied).toBe(false);
  });

  test('cpuMaybeUseCardWithPolicy tries other usable cards when first apply fails', () => {
    // two cards: first will fail to apply, second will succeed
    global.cardState = { hands: { white: ['first', 'second'] }, pendingEffectByPlayer: { white: null }, hasUsedCardThisTurnByPlayer: { white: false } };
    const applyMock = jest.fn((cs, gs, p, id) => id === 'second');
    global.CardLogic = { applyCardUsage: applyMock, canUseCard: () => true, getCardDef: (id) => ({ name: id }) };
    // AISystem suggests 'first'
    global.AISystem = { selectCardToUse: () => ({ cardId: 'first', cardDef: { name: 'first' } }) };

    const applied = cpuDecision.cpuMaybeUseCardWithPolicy('white');
    expect(applied).toBe(true);
    // both were attempted: first failed, second succeeded
    expect(applyMock).toHaveBeenCalledWith(global.cardState, global.gameState, 'white', 'first');
    expect(applyMock).toHaveBeenCalledWith(global.cardState, global.gameState, 'white', 'second');
  });

  test('cpuMaybeUseCardWithPolicy returns false when player already used card this turn', () => {
    global.cardState.hasUsedCardThisTurnByPlayer.white = true;
    const applied = cpuDecision.cpuMaybeUseCardWithPolicy('white');
    expect(applied).toBe(false);
  });
});