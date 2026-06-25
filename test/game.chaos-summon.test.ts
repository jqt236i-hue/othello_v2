import * as ChaosSummon from '../game/logic/card-resolution/chaos-summon';
import * as SpecialStoneMarkerFactory from '../game/logic/card-resolution/special-stone-marker-factory';
import * as SpecialStoneRegistry from '../shared/special-stone-registry';
import * as EffectResolver from '../game/cards/effect-resolver';
import * as CardHandManager from '../game/logic/cards-internal/hand-manager';

function createDeps(overrides: any = {}) {
  return {
    EMPTY: 0,
    BLACK: 1,
    WHITE: 2,
    MARKER_KINDS: { SPECIAL_STONE: 'specialStone' },
    CARD_DEFS: [
      { id: 'trap_01', type: 'TRAP_WILL', cost: 2 },
      { id: 'bomb_01', type: 'TIME_BOMB', cost: 5 },
      { id: 'hyperactive_01', type: 'HYPERACTIVE_WILL', cost: 6 }
    ],
    SpecialStoneMarkerFactory,
    SpecialStoneRegistry,
    BoardOps: {},
    Core: {},
    getCellValueForCard: (gameState: any, row: number, col: number) => gameState.board[row][col],
    isBlockedCell: jest.fn(() => false),
    sampleRandomPositions: jest.fn((items: any[]) => [items[0]]),
    spawnAndFlipPlacement: jest.fn(() => ({
      spawned: true,
      appliedFlips: [[0, 1]]
    })),
    addChargeWithTotal: jest.fn(() => 1),
    addMarker: jest.fn(() => ({ id: 'marker-1' })),
    resolveSafeCardContext: jest.fn(() => ({ protectedStones: [], permaProtectedStones: [] })),
    resolveHyperactiveFlipEvasion: jest.fn(() => null),
    ...overrides
  };
}

describe('混沌召喚', () => {
  test('理論の化身候補を流用し、罠石と時限爆弾を候補から除外する', () => {
    const deps = createDeps();

    const entries = ChaosSummon.buildChaosSummonEntries(deps.CARD_DEFS, deps, 'black');

    expect(entries.map((entry: any) => entry.cardType)).toEqual(['HYPERACTIVE_WILL']);
    expect(entries[0].markerData).toEqual(expect.objectContaining({
      type: 'HYPERACTIVE',
      sourceType: 'CHAOS_SUMMON',
      sourceCardId: 'hyperactive_01',
      sourceCardType: 'HYPERACTIVE_WILL'
    }));
  });

  test('ランダム空きマスに特殊石を出現させ、理論数字 value なしのルーレット payload を渡す', () => {
    const deps = createDeps();
    const cardState: any = {};
    const gameState: any = {
      board: [
        [0, 0],
        [0, 0]
      ]
    };

    const result = ChaosSummon.applyChaosSummonUsage(cardState, gameState, 'black', { random: () => 0 }, deps);

    expect(result).toEqual(expect.objectContaining({
      applied: true,
      row: 0,
      col: 0,
      type: 'HYPERACTIVE',
      sourceCardId: 'hyperactive_01',
      sourceCardType: 'HYPERACTIVE_WILL',
      chargeGained: 1
    }));
    expect(deps.spawnAndFlipPlacement).toHaveBeenCalledWith(expect.objectContaining({
      allowZeroFlips: true,
      spawnCause: 'CHAOS_SUMMON',
      spawnReason: 'chaos_summon_spawn',
      flipCause: 'CHAOS_SUMMON',
      flipReason: 'chaos_summon_flip',
      spawnMeta: expect.objectContaining({
        special: 'HYPERACTIVE',
        sourceCardId: 'hyperactive_01',
        sourceCardType: 'HYPERACTIVE_WILL',
        theorySpawnRoulette: expect.objectContaining({
          selectedCell: { row: 0, col: 0 },
          sourceCardId: 'hyperactive_01',
          sourceCardType: 'HYPERACTIVE_WILL'
        })
      })
    }));
    const spawnArg = deps.spawnAndFlipPlacement.mock.calls[0][0];
    expect(spawnArg.spawnMeta.theorySpawnRoulette.candidateCells).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 0 },
      { row: 1, col: 1 }
    ]);
    expect(spawnArg.spawnMeta.theorySpawnRoulette.candidateCells.some((cell: any) => 'value' in cell)).toBe(false);
    expect(deps.addMarker).toHaveBeenCalledWith(
      cardState,
      'specialStone',
      0,
      0,
      'black',
      expect.objectContaining({
        type: 'HYPERACTIVE',
        sourceType: 'CHAOS_SUMMON'
      })
    );
    expect(deps.addChargeWithTotal).toHaveBeenCalledWith(
      cardState,
      'black',
      1,
      expect.objectContaining({ sourceType: 'chaos_summon_flip_gain' })
    );
  });

  test('理論数字マスが候補に含まれてもルーレット payload に value を含めない', () => {
    const deps = createDeps();
    const cardState: any = {
      boardBonusByCell: {
        '0,1': 42
      }
    };
    const gameState: any = {
      board: [
        [0, 0],
        [0, 0]
      ]
    };

    ChaosSummon.applyChaosSummonUsage(cardState, gameState, 'black', { random: () => 0 }, deps);

    const spawnArg = deps.spawnAndFlipPlacement.mock.calls[0][0];
    expect(spawnArg.spawnMeta.theorySpawnRoulette.candidateCells).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 0 },
      { row: 1, col: 1 }
    ]);
    expect(spawnArg.spawnMeta.theorySpawnRoulette.candidateCells.some((cell: any) => 'value' in cell)).toBe(false);
  });

  test('カード使用 resolver から混沌召喚解決処理を呼ぶ', () => {
    const cardState: any = {
      hands: { black: ['chaos_summon_01'], white: [] },
      charge: { black: 15, white: 0 },
      pendingEffectByPlayer: {},
      lastUsedCardByPlayer: { black: null, white: null },
      selectedCardId: null,
      selectedCardOwnerKey: null
    };
    const applyChaosSummonUsage = jest.fn(() => ({ applied: true }));

    const applied = EffectResolver.applyCardUsage(cardState, 'black', 'chaos_summon_01', {
      gameState: { board: [[0]] },
      opts: { prng: { random: () => 0 }, noConsume: true },
      getCardCost: () => 15,
      getCardType: () => 'CHAOS_SUMMON',
      getCardDef: () => ({ id: 'chaos_summon_01', type: 'CHAOS_SUMMON', name: '混沌召喚' }),
      getHandCopyIdAt: () => null,
      getEffectiveCardCostForCopy: () => 15,
      canUseChaosSummon: () => true,
      applyChaosSummonUsage,
      writeCardPendingEffect: (state: any, owner: string, pending: any) => {
        state.pendingEffectByPlayer[owner] = pending;
      }
    });

    expect(applied).toBe(true);
    expect(applyChaosSummonUsage).toHaveBeenCalledWith(cardState, { board: [[0]] }, 'black', expect.any(Object));
    expect(cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({
      type: 'CHAOS_SUMMON',
      cardId: 'chaos_summon_01'
    }));
  });

  test('混沌召喚が使用前条件を満たさない場合は手札と布石を消費しない', () => {
    const cardState: any = {
      hands: { black: ['chaos_summon_01'], white: [] },
      charge: { black: 15, white: 0 },
      discardPile: [],
      pendingEffectByPlayer: {},
      lastUsedCardByPlayer: { black: null, white: null },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      selectedCardId: null,
      selectedCardOwnerKey: null
    };
    const applyChaosSummonUsage = jest.fn(() => ({ applied: false, reason: 'no_empty_cell' }));
    const removeHandCardAt = jest.fn((state: any, owner: string, index: number) => {
      const [cardId] = state.hands[owner].splice(index, 1);
      return { cardId, handIndex: index, cardCopyId: null };
    });
    const addChargeValue = jest.fn((state: any, owner: string, amount: number) => {
      state.charge[owner] += amount;
    });

    const applied = EffectResolver.applyCardUsage(cardState, 'black', 'chaos_summon_01', {
      gameState: { board: [[1]] },
      opts: { prng: { random: () => 0 } },
      getCardCost: () => 15,
      getCardType: () => 'CHAOS_SUMMON',
      getCardDef: () => ({ id: 'chaos_summon_01', type: 'CHAOS_SUMMON', name: '混沌召喚' }),
      getHandCopyIdAt: () => null,
      getEffectiveCardCostForCopy: () => 15,
      canUseChaosSummon: () => false,
      applyChaosSummonUsage,
      removeHandCardAt,
      addChargeValue,
      writeCardPendingEffect: (state: any, owner: string, pending: any) => {
        state.pendingEffectByPlayer[owner] = pending;
      }
    });

    expect(applied).toBe(false);
    expect(cardState.hands.black).toEqual(['chaos_summon_01']);
    expect(cardState.charge.black).toBe(15);
    expect(cardState.hasUsedCardThisTurnByPlayer.black).toBe(false);
    expect(removeHandCardAt).not.toHaveBeenCalled();
    expect(addChargeValue).not.toHaveBeenCalled();
    expect(applyChaosSummonUsage).not.toHaveBeenCalled();
  });

  test('使用可能カード一覧でも混沌召喚の使用前条件を反映する', () => {
    const cardState: any = {
      hands: { black: ['chaos_summon_01'], white: [] },
      charge: { black: 15, white: 0 },
      turnIndex: 0
    };
    const gameState: any = { board: [[1]] };
    const context: any = {
      constants: {
        CARD_DEFS: [
          { id: 'chaos_summon_01', type: 'CHAOS_SUMMON', cost: 15, name: '混沌召喚' }
        ],
        CARD_TYPE_BY_ID: { chaos_summon_01: 'CHAOS_SUMMON' },
        MAX_HAND_SIZE: 5,
        RIBO_WILL_UNLOCK_TURN_INDEX: 19
      },
      helpers: {
        canUseChaosSummon: jest.fn(() => false)
      }
    };

    const usable = CardHandManager.getUsableCardIds(cardState, gameState, 'black', context);

    expect(usable).toEqual([]);
    expect(context.helpers.canUseChaosSummon).toHaveBeenCalledWith(cardState, gameState, 'black');
  });
});
