import * as Shared from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';
import * as TurnPipeline from '../game/turn/turn_pipeline.js';
import * as SpecialStoneMarkerFactory from '../game/logic/card-resolution/special-stone-marker-factory';
import * as SpecialStoneRegistry from '../shared/special-stone-registry.js';

function createPrng(values: number[] = [0]): any {
  let index = 0;
  return {
    shuffle: (arr: any[]) => arr,
    random: () => {
      const value = values[index] ?? values[values.length - 1] ?? 0;
      index += 1;
      return value;
    }
  };
}

function createGameState() {
  const gameState: any = {
    board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
    currentPlayer: Shared.BLACK,
    turnNumber: 42,
    consecutivePasses: 0
  };
  gameState.board[3][3] = Shared.WHITE;
  gameState.board[3][4] = Shared.BLACK;
  gameState.board[4][3] = Shared.BLACK;
  gameState.board[4][4] = Shared.WHITE;
  return gameState;
}

describe('理論の化身', () => {
  test('生成候補はカタログ上の特殊石カード型からマーカーを構築する', () => {
    const table = SpecialStoneMarkerFactory.buildTheoryIncarnationSpawnTable([
      { id: 'hard_01', type: 'PROTECTED_NEXT_STONE', cost: 1 },
      { id: 'perma_01', type: 'PERMA_PROTECT_NEXT_STONE', cost: 15 },
      { id: 'destroy_dragon_01', type: 'DESTROY_DRAGON_WILL', cost: 7 },
      { id: 'robot_vacuum_01', type: 'ROBOT_VACUUM_WILL', cost: 17 },
      { id: 'hyperactive_01', type: 'HYPERACTIVE_WILL', cost: 8 },
      { id: 'extreme_hyperactive_01', type: 'EXTREME_HYPERACTIVE_WILL', cost: 35 },
      { id: 'escape_01', type: 'ESCAPE_WILL', cost: 7 },
      { id: 'gluttonous_will_01', type: 'GLUTTONOUS_WILL', cost: 29 },
      { id: 'udg_01', type: 'ULTIMATE_DESTROY_GOD', cost: 25 },
      { id: 'ultimate_hyperactive_01', type: 'ULTIMATE_HYPERACTIVE_GOD', cost: 28 },
      { id: 'stone_salvation_god_01', type: 'STONE_SALVATION_GOD', cost: 20 },
      { id: 'work_01', type: 'WORK_WILL', cost: 11 },
      { id: 'instant_hyperactive_01', type: 'INSTANT_HYPERACTIVE_WILL', cost: 2 },
      { id: 'time_bomb_01', type: 'TIME_BOMB', cost: 9 },
      { id: 'trap_01', type: 'TRAP_WILL', cost: 4 }
    ], {
      SpecialStoneRegistry,
      ownerKey: 'black',
      constants: {
        STRONG_WILL_PROMOTION_OWNER_TURNS: 10,
        ULTIMATE_DESTROY_GOD_TURNS: 5,
        ULTIMATE_HYPERACTIVE_TURNS: 10,
        ROBOT_VACUUM_TURNS: 5
      }
    });

    expect(table).toEqual(expect.arrayContaining([
      expect.objectContaining({
        cardType: 'PROTECTED_NEXT_STONE',
        cardCost: 1,
        markerData: expect.objectContaining({ type: 'PROTECTED', expiresForPlayer: 'black' })
      }),
      expect.objectContaining({
        cardType: 'PERMA_PROTECT_NEXT_STONE',
        cardCost: 15,
        markerData: expect.objectContaining({ type: 'PERMA_PROTECTED', strongWillPromotionThreshold: 10 })
      }),
      expect.objectContaining({
        cardType: 'DESTROY_DRAGON_WILL',
        cardCost: 7,
        markerData: expect.objectContaining({ type: 'DESTROY_DRAGON' })
      }),
      expect.objectContaining({
        cardType: 'ROBOT_VACUUM_WILL',
        cardCost: 17,
        markerData: expect.objectContaining({ type: 'ROBOT_VACUUM' })
      }),
      expect.objectContaining({
        cardType: 'HYPERACTIVE_WILL',
        cardCost: 8,
        markerData: expect.objectContaining({ type: 'HYPERACTIVE', flipEvadeRemaining: 1 })
      }),
      expect.objectContaining({
        cardType: 'EXTREME_HYPERACTIVE_WILL',
        cardCost: 35,
        markerData: expect.objectContaining({ type: 'EXTREME_HYPERACTIVE', flipEvadeRemaining: 3, destroyEvadeRemaining: 1 })
      }),
      expect.objectContaining({
        cardType: 'ESCAPE_WILL',
        cardCost: 7,
        markerData: expect.objectContaining({ type: 'ESCAPE_HYPERACTIVE', flipEvadeRemaining: 1 })
      }),
      expect.objectContaining({
        cardType: 'GLUTTONOUS_WILL',
        cardCost: 29,
        markerData: expect.objectContaining({ type: 'GLUTTONOUS', gluttonousMissStreak: 0 })
      }),
      expect.objectContaining({
        cardType: 'ULTIMATE_DESTROY_GOD',
        cardCost: 25,
        markerData: expect.objectContaining({ type: 'ULTIMATE_DESTROY_GOD', remainingOwnerTurns: 5 })
      }),
      expect.objectContaining({
        cardType: 'ULTIMATE_HYPERACTIVE_GOD',
        cardCost: 28,
        markerData: expect.objectContaining({ type: 'ULTIMATE_HYPERACTIVE', remainingOwnerTurns: 10 })
      }),
      expect.objectContaining({
        cardType: 'STONE_SALVATION_GOD',
        cardCost: 20,
        markerData: expect.objectContaining({ type: 'STONE_SALVATION_GOD', remainingOwnerTurns: 10 })
      }),
      expect.objectContaining({
        cardType: 'WORK_WILL',
        cardCost: 11,
        markerData: expect.objectContaining({ type: 'WORK', ownerColor: 'black', workStage: 0 })
      })
    ]));
    expect(table.map((entry: any) => entry.cardType)).not.toEqual(expect.arrayContaining([
      'TIME_BOMB',
      'TRAP_WILL',
      'INSTANT_HYPERACTIVE_WILL'
    ]));
  });

  test('数字マス合計42で使用可能になり、演算の意志の2倍後の数字マス布石が進捗になる', () => {
    const prng = createPrng();
    const cardState: any = CardLogic.createCardState(prng);
    const gameState = createGameState();
    cardState.hands.black = ['theory_incarnation_01'];
    cardState.charge.black = 0;
    cardState.boardBonusByCell = { '2,3': 21, '2,4': 21 };
    cardState.pendingEffectByPlayer.black = { type: 'CRYSTAL_STONE', stage: 'awaitPlace' };
    gameState.board[2][4] = Shared.WHITE;
    gameState.board[2][5] = Shared.BLACK;

    TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 2, col: 3 }, prng, { skipTurnStart: true });

    expect(cardState.numberCellCollectedTotalByPlayer.black).toBe(42);
    expect(CardLogic.canUseTheoryIncarnation(cardState, 'black')).toBe(true);

    cardState.pendingEffectByPlayer.black = { type: 'FREE_PLACEMENT', stage: 'awaitPlace' };
    gameState.currentPlayer = Shared.BLACK;
    TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 2, col: 4 }, prng, { skipTurnStart: true });

    expect(cardState.numberCellCollectedTotalByPlayer.black).toBe(63);
    expect(CardLogic.canUseTheoryIncarnation(cardState, 'black')).toBe(true);
  });

  test('使用時に空きマスを理論数字マスへ書き換え、次の配置石を理論石にする', () => {
    const prng = createPrng([0]);
    const cardState: any = CardLogic.createCardState(prng);
    const gameState = createGameState();
    cardState.hands.black = ['theory_incarnation_01'];
    cardState.charge.black = 0;
    cardState.numberCellCollectedTotalByPlayer.black = 42;
    cardState.boardBonusByCell = { '0,0': 9 };

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', 'theory_incarnation_01', null, { prng });

    expect(used).toBe(true);
    expect(cardState.nextTheoryIncarnationStoneByPlayer.black).toEqual(expect.objectContaining({
      sourceType: 'THEORY_INCARNATION'
    }));
    expect(cardState.theoryNumberCellByCell['0,0']).toEqual(expect.objectContaining({
      ownerKey: 'black'
    }));
    expect(cardState.theoryNumberCellsBySession).toBeTruthy();
    expect(Object.keys(cardState.theoryNumberCellByCell).length).toBeGreaterThan(10);

    cardState.pendingEffectByPlayer.black = { type: 'FREE_PLACEMENT', stage: 'awaitPlace' };
    gameState.currentPlayer = Shared.BLACK;
    const placed = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 2, col: 3 }, prng, { skipTurnStart: true });

    expect(placed.events).toContainEqual(expect.objectContaining({ type: 'theory_incarnation_marker_applied' }));
    const marker = cardState.markers.find((entry: any) => entry && entry.data && entry.data.type === 'THEORY_INCARNATION');
    expect(marker).toEqual(expect.objectContaining({ row: 2, col: 3, owner: 'black', kind: 'manifestStone' }));
    expect(marker.data).toEqual(expect.objectContaining({ remainingOwnerTurns: 3, absoluteProtected: true }));
    expect(CardLogic.isPlacementLockedForPlayer(cardState, 'black')).toBe(true);
    expect(CardLogic.isCardPlayLockedForPlayer(cardState, 'black')).toBe(true);
  });

  test('理論石顕現中の自ターン開始で理論数字マスから特殊石を1体出し、ターンを自動終了する', () => {
    const prng = createPrng([0]);
    const cardState: any = CardLogic.createCardState(prng, { plainReversi: true });
    const gameState = createGameState();
    gameState.currentPlayer = Shared.BLACK;
    cardState.boardBonusByCell = { '0,0': 5 };
    cardState.theoryNumberCellByCell = {
      '0,0': { sessionId: 'theory_black_1', ownerKey: 'black' }
    };
    cardState.theoryNumberCellsBySession = {
      theory_black_1: {
        ownerKey: 'black',
        cells: {
          '0,0': {
            row: 0,
            col: 0,
            value: 8,
            originalValue: 0,
            originalConsumed: false,
            spawnType: 'HYPERACTIVE',
            sourceCardId: 'hyperactive_01',
            sourceCardType: 'HYPERACTIVE_WILL',
            sourceCardCost: 8,
            markerData: {
              type: 'HYPERACTIVE',
              flipEvadeRemaining: 1,
              sourceType: 'THEORY_INCARNATION',
              sourceCardId: 'hyperactive_01',
              sourceCardType: 'HYPERACTIVE_WILL'
            }
          }
        }
      }
    };
    cardState.theoryIncarnationStateByPlayer = {
      black: { sessionId: 'theory_black_1', ownerKey: 'black', remainingSpawnCount: 3 },
      white: null
    };
    CardLogic.addMarker(cardState, 'manifestStone', 2, 2, 'black', {
      type: 'THEORY_INCARNATION',
      remainingOwnerTurns: 3,
      absoluteProtected: true,
      sourceType: 'THEORY_INCARNATION'
    });

    const result = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 0, col: 0 }, prng);

    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'theory_incarnation_spawned',
      detail: expect.objectContaining({
        roulette: expect.objectContaining({
          durationMs: 2000,
          materializeMs: 2000,
          selectedCell: { row: 0, col: 0 },
          candidateCells: [{ row: 0, col: 0 }],
          spawnedMarkerType: 'HYPERACTIVE',
          sourceCardId: 'hyperactive_01',
          sourceCardType: 'HYPERACTIVE_WILL'
        })
      })
    }));
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'theory_incarnation_auto_turn_end', player: 'black' }));
    expect(gameState.board[0][0]).toBe(Shared.BLACK);
    expect(cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        row: 0,
        col: 0,
        owner: 'black',
        data: expect.objectContaining({
          type: 'HYPERACTIVE',
          hyperactiveSeq: 1,
          sourceCardType: 'HYPERACTIVE_WILL'
        })
      })
    ]));
    expect(cardState.boardBonusConsumedByCell['0,0']).toBe(true);
    expect(gameState.currentPlayer).toBe(Shared.WHITE);
  });

  test('理論生成のSPAWN presentation eventにroulette metadataを載せる', () => {
    const prng = createPrng([0]);
    const cardState: any = CardLogic.createCardState(prng, { plainReversi: true });
    const gameState = createGameState();
    gameState.currentPlayer = Shared.BLACK;
    cardState.boardBonusByCell = { '0,0': 5, '0,1': 5 };
    cardState.theoryNumberCellByCell = {
      '0,0': { sessionId: 'theory_black_1', ownerKey: 'black' },
      '0,1': { sessionId: 'theory_black_1', ownerKey: 'black' }
    };
    cardState.theoryNumberCellsBySession = {
      theory_black_1: {
        ownerKey: 'black',
        cells: {
          '0,0': {
            row: 0,
            col: 0,
            value: 5,
            originalValue: 0,
            originalConsumed: false,
            spawnType: 'GHOST',
            sourceCardId: 'ghost_01',
            sourceCardType: 'GHOST_WILL',
            sourceCardCost: 5
          },
          '0,1': {
            row: 0,
            col: 1,
            value: 5,
            originalValue: 0,
            originalConsumed: false,
            spawnType: 'GHOST',
            sourceCardId: 'ghost_01',
            sourceCardType: 'GHOST_WILL',
            sourceCardCost: 5
          }
        }
      }
    };
    cardState.theoryIncarnationStateByPlayer = {
      black: { sessionId: 'theory_black_1', ownerKey: 'black', remainingSpawnCount: 3 },
      white: null
    };
    CardLogic.addMarker(cardState, 'manifestStone', 2, 2, 'black', {
      type: 'THEORY_INCARNATION',
      remainingOwnerTurns: 3,
      absoluteProtected: true,
      sourceType: 'THEORY_INCARNATION'
    });

    const result = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 0, col: 0 }, prng);
    const spawnEvent = result.presentationEvents.find((event: any) => event && event.type === 'SPAWN' && event.reason === 'theory_incarnation_spawn');

    expect(spawnEvent).toEqual(expect.objectContaining({
      row: 0,
      col: 0,
      cause: 'THEORY_INCARNATION',
      meta: expect.objectContaining({
        theorySpawnRoulette: expect.objectContaining({
          durationMs: 2000,
          materializeMs: 2000,
          selectedCell: { row: 0, col: 0 },
          candidateCells: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
          spawnedMarkerType: 'GHOST'
        })
      })
    }));
  });

  test('理論石顕現中は複数回の自ターン開始で連続して自動終了する', () => {
    const prng = createPrng([0, 0, 0]);
    const cardState: any = CardLogic.createCardState(prng, { plainReversi: true });
    const gameState = createGameState();
    gameState.currentPlayer = Shared.BLACK;
    cardState.boardBonusByCell = { '0,0': 5, '0,1': 5, '0,2': 5 };
    cardState.theoryNumberCellByCell = {
      '0,0': { sessionId: 'theory_black_1', ownerKey: 'black' },
      '0,1': { sessionId: 'theory_black_1', ownerKey: 'black' },
      '0,2': { sessionId: 'theory_black_1', ownerKey: 'black' }
    };
    cardState.theoryNumberCellsBySession = {
      theory_black_1: {
        ownerKey: 'black',
        cells: {
          '0,0': {
            row: 0,
            col: 0,
            value: 5,
            originalValue: 0,
            originalConsumed: false,
            spawnType: 'GHOST',
            sourceCardId: 'ghost_01',
            sourceCardType: 'GHOST_WILL',
            sourceCardCost: 5
          },
          '0,1': {
            row: 0,
            col: 1,
            value: 5,
            originalValue: 0,
            originalConsumed: false,
            spawnType: 'GHOST',
            sourceCardId: 'ghost_01',
            sourceCardType: 'GHOST_WILL',
            sourceCardCost: 5
          },
          '0,2': {
            row: 0,
            col: 2,
            value: 5,
            originalValue: 0,
            originalConsumed: false,
            spawnType: 'GHOST',
            sourceCardId: 'ghost_01',
            sourceCardType: 'GHOST_WILL',
            sourceCardCost: 5
          }
        }
      }
    };
    cardState.theoryIncarnationStateByPlayer = {
      black: { sessionId: 'theory_black_1', ownerKey: 'black', remainingSpawnCount: 3 },
      white: null
    };
    CardLogic.addMarker(cardState, 'manifestStone', 2, 2, 'black', {
      type: 'THEORY_INCARNATION',
      remainingOwnerTurns: 3,
      absoluteProtected: true,
      sourceType: 'THEORY_INCARNATION'
    });

    const first = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 0, col: 0 }, prng);
    expect(first.events).toContainEqual(expect.objectContaining({ type: 'theory_incarnation_auto_turn_end', player: 'black' }));
    expect(gameState.currentPlayer).toBe(Shared.WHITE);

    gameState.currentPlayer = Shared.BLACK;
    const second = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 0, col: 1 }, prng);
    expect(second.events).toContainEqual(expect.objectContaining({ type: 'theory_incarnation_auto_turn_end', player: 'black' }));
    expect(gameState.currentPlayer).toBe(Shared.WHITE);
    expect(cardState.theoryIncarnationStateByPlayer.black.remainingSpawnCount).toBe(1);
    expect(cardState.markers.filter((entry: any) => entry && entry.data && entry.data.sourceType === 'THEORY_INCARNATION')).toHaveLength(3);

    gameState.currentPlayer = Shared.BLACK;
    const third = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 0, col: 2 }, prng);
    const eventTypes = third.events.map((event: any) => event && event.type);
    const spawnIndex = eventTypes.indexOf('theory_incarnation_spawned');
    const autoEndIndex = eventTypes.indexOf('theory_incarnation_auto_turn_end');
    const expiredIndex = eventTypes.indexOf('theory_incarnation_marker_expired');

    expect(spawnIndex).toBeGreaterThanOrEqual(0);
    expect(autoEndIndex).toBeGreaterThan(spawnIndex);
    expect(expiredIndex).toBeGreaterThan(autoEndIndex);
    expect(gameState.currentPlayer).toBe(Shared.WHITE);
    expect(cardState.theoryIncarnationStateByPlayer.black).toBeNull();
    expect(cardState.markers.some((entry: any) => (
      entry &&
      entry.kind === 'manifestStone' &&
      entry.data &&
      entry.data.type === 'THEORY_INCARNATION'
    ))).toBe(false);
    expect(cardState.markers.filter((entry: any) => entry && entry.data && entry.data.sourceType === 'THEORY_INCARNATION')).toHaveLength(3);
  });
});
