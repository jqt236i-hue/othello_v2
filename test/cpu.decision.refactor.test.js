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
    delete global.TurnPipeline;
    delete global.TurnPipelineUIAdapter;
    delete global.CpuPolicyTableRuntime;
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

  test('selectCardToUse prefers learned use_card action when score exists', () => {
    global.cardState.hands.white = ['c_low', 'c_high'];
    global.CardLogic = {
      canUseCard: () => true,
      getCardDef: (id) => ({ name: id })
    };
    global.CpuPolicyTableRuntime = {
      getActionScoreForKey: jest.fn((key) => (key === 'use_card:c_high' ? 9999 : null))
    };

    const res = cpuDecision.selectCardToUse('white');
    expect(res).toBeDefined();
    expect(res.cardId).toBe('c_high');
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

  test('selectCpuMoveWithPolicy prefers policy-table runtime move when available', () => {
    const candidates = [{ row: 0, col: 0, flips: [] }, { row: 1, col: 1, flips: [] }];
    global.gameState = { board: [[0, 0], [0, 0]] };
    global.cpuSmartness.white = 6;
    global.CpuPolicyTableRuntime = {
      chooseMove: jest.fn(() => candidates[1])
    };

    const move = cpuDecision.selectCpuMoveWithPolicy(candidates, 'white');
    expect(move).toBe(candidates[1]);
    expect(global.CpuPolicyTableRuntime.chooseMove).toHaveBeenCalled();
  });

  test('applyCardChoice uses pipeline result and updates logs', () => {
    global.CardLogic = { applyCardUsage: jest.fn(() => true) };
    global.cardState.hands.white = ['c1'];
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        nextCardState: {
          ...global.cardState,
          hands: { ...global.cardState.hands, white: [] },
          hasUsedCardThisTurnByPlayer: { ...global.cardState.hasUsedCardThisTurnByPlayer, white: true }
        },
        nextGameState: global.gameState,
        playbackEvents: []
      }))
    };

    const ok = cpuDecision.applyCardChoice('white', { cardId: 'c1', cardDef: { name: 'C1' } });
    expect(ok).toBe(true);
    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalled();
    expect(CardLogic.applyCardUsage).not.toHaveBeenCalled();
    expect(emitLogAdded).toHaveBeenCalled();
  });

  test('cpuMaybeUseCardWithPolicy returns true when a card applied', () => {
    global.CardLogic = { applyCardUsage: jest.fn(() => true), canUseCard: () => true, getCardDef: (id) => ({ name: id }) };
    global.cardState.hands.white = ['c2'];
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        nextCardState: {
          ...global.cardState,
          hands: { ...global.cardState.hands, white: [] },
          hasUsedCardThisTurnByPlayer: { ...global.cardState.hasUsedCardThisTurnByPlayer, white: true }
        },
        nextGameState: global.gameState,
        playbackEvents: []
      }))
    };
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
    // two cards: first pipeline use is rejected, second is accepted
    global.cardState = { hands: { white: ['first', 'second'] }, pendingEffectByPlayer: { white: null }, hasUsedCardThisTurnByPlayer: { white: false } };
    global.CardLogic = { applyCardUsage: jest.fn(), canUseCard: () => true, getCardDef: (id) => ({ name: id }) };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn((_cs, _gs, _p, action) => {
        if (action && action.useCardId === 'first') return { ok: false };
        return {
          ok: true,
          nextCardState: {
            ...global.cardState,
            hands: { ...global.cardState.hands, white: ['first'] },
            hasUsedCardThisTurnByPlayer: { ...global.cardState.hasUsedCardThisTurnByPlayer, white: true }
          },
          nextGameState: global.gameState,
          playbackEvents: []
        };
      })
    };
    // AISystem suggests 'first'
    global.AISystem = { selectCardToUse: () => ({ cardId: 'first', cardDef: { name: 'first' } }) };

    const applied = cpuDecision.cpuMaybeUseCardWithPolicy('white');
    expect(applied).toBe(true);
    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledTimes(2);
    expect(global.CardLogic.applyCardUsage).not.toHaveBeenCalled();
  });

  test('cpuMaybeUseCardWithPolicy returns false when player already used card this turn', () => {
    global.cardState.hasUsedCardThisTurnByPlayer.white = true;
    const applied = cpuDecision.cpuMaybeUseCardWithPolicy('white');
    expect(applied).toBe(false);
  });

  test('cpuSelectSwapWithEnemyWithPolicy prefers pipeline adapter path', async () => {
    global.cardState.pendingEffectByPlayer.white = { type: 'SWAP_WITH_ENEMY', stage: 'selectTarget' };
    global.CardLogic = {
      getSelectableTargets: () => [{ row: 2, col: 3 }],
      applySwapEffect: jest.fn(() => true)
    };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        nextCardState: {
          ...global.cardState,
          pendingEffectByPlayer: { ...global.cardState.pendingEffectByPlayer, white: null }
        },
        nextGameState: global.gameState,
        playbackEvents: [{ type: 'dummy' }]
      }))
    };
    global.emitGameStateChange = jest.fn();

    await cpuDecision.cpuSelectSwapWithEnemyWithPolicy('white');

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalled();
    expect(global.CardLogic.applySwapEffect).not.toHaveBeenCalled();
    expect(global.emitCardStateChange).toHaveBeenCalled();
    expect(global.emitBoardUpdate).toHaveBeenCalled();
    expect(global.emitGameStateChange).toHaveBeenCalled();
  });

  test('cpuSelectSwapWithEnemyWithPolicy does not fallback when pipeline path rejects', async () => {
    global.cardState.pendingEffectByPlayer.white = { type: 'SWAP_WITH_ENEMY', stage: 'selectTarget' };
    global.CardLogic = {
      getSelectableTargets: () => [{ row: 4, col: 5 }],
      applySwapEffect: jest.fn(() => true)
    };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({ ok: false }))
    };
    global.emitGameStateChange = jest.fn();

    await cpuDecision.cpuSelectSwapWithEnemyWithPolicy('white');

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalled();
    expect(global.CardLogic.applySwapEffect).not.toHaveBeenCalled();
    expect(global.emitCardStateChange).not.toHaveBeenCalled();
    expect(global.emitBoardUpdate).not.toHaveBeenCalled();
    expect(global.emitGameStateChange).not.toHaveBeenCalled();
  });

  test('applyCardChoice uses pipeline path for immediate cards (treasure box)', () => {
    global.cardState = {
      hands: { white: ['treasure_01'], black: [] },
      pendingEffectByPlayer: { white: null, black: null },
      hasUsedCardThisTurnByPlayer: { white: false, black: false },
      charge: { white: 0, black: 0 },
      turnIndex: 7
    };
    global.gameState = { board: [], currentPlayer: -1 };
    global.CardLogic = { applyCardUsage: jest.fn(() => true) };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        nextCardState: {
          ...global.cardState,
          hands: { white: [], black: [] },
          hasUsedCardThisTurnByPlayer: { white: true, black: false },
          charge: { white: 2, black: 0 }
        },
        nextGameState: global.gameState,
        playbackEvents: []
      }))
    };
    global.emitGameStateChange = jest.fn();

    const ok = cpuDecision.applyCardChoice('white', { cardId: 'treasure_01', cardDef: { name: '宝箱', cost: 0 } });
    expect(ok).toBe(true);
    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalled();
    expect(global.CardLogic.applyCardUsage).not.toHaveBeenCalled();
    expect(global.cardState.charge.white).toBe(2);
    expect(global.emitLogAdded).toHaveBeenCalledWith(expect.stringContaining('カードを使用'));
  });

  test('applyCardChoice rejects when pipeline card-use fails', () => {
    global.cardState.hands.white = ['treasure_01'];
    global.CardLogic = { applyCardUsage: jest.fn(() => true) };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({ ok: false }))
    };

    const ok = cpuDecision.applyCardChoice('white', { cardId: 'treasure_01', cardDef: { name: '宝箱', cost: 0 } });
    expect(ok).toBe(false);
    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalled();
    expect(global.CardLogic.applyCardUsage).not.toHaveBeenCalled();
  });
});
