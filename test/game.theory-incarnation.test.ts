import * as Shared from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';
import * as Core from '../game/logic/core.js';
import * as TurnPipeline from '../game/turn/turn_pipeline.js';
import * as TheorySpawnImmediateEffects from '../game/turn/theory-spawn-immediate-effects';
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

function indexOfEventType(events: any[], type: string): number {
  return events.findIndex((event: any) => event && event.type === type);
}

function expectNoPendingTheoryAutoTurnEnd(cardState: any, playerKey: 'black' | 'white'): void {
  const flags = cardState && cardState._theoryIncarnationAutoTurnEndByPlayer;
  expect(!!(flags && flags[playerKey] === true)).toBe(false);
}

describe('理論の化身', () => {
  test('理論の化身は穴・封鎖・空凍結マスを理論数字マス化しない', () => {
    const prng = createPrng([0]);
    const cardState: any = CardLogic.createCardState(prng);
    const gameState = createGameState();
    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Shared.BLACK));
    gameState.board[0][0] = Shared.EMPTY;
    gameState.board[0][1] = Shared.EMPTY;
    gameState.board[0][2] = Shared.EMPTY;
    gameState.board[0][3] = Shared.EMPTY;
    cardState.hands.black = ['theory_incarnation_01'];
    cardState.charge.black = 0;
    cardState.numberCellCollectedTotalByPlayer.black = 42;
    CardLogic.addMarker(cardState, 'specialStone', 0, 0, 'black', { type: 'METEOR_HOLE' });
    CardLogic.addMarker(cardState, 'specialStone', 0, 1, 'black', { type: 'BLOCKADE', remainingOwnerTurns: 3 });
    CardLogic.addMarker(cardState, 'specialStone', 0, 2, 'black', { type: 'FREEZE', remainingOwnerTurns: 2 });
    const beforeBonus00 = cardState.boardBonusByCell && cardState.boardBonusByCell['0,0'];
    const beforeBonus01 = cardState.boardBonusByCell && cardState.boardBonusByCell['0,1'];
    const beforeBonus02 = cardState.boardBonusByCell && cardState.boardBonusByCell['0,2'];

    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', 'theory_incarnation_01', null, { prng })).toBe(true);
    const sessionId = cardState.theoryIncarnationStateByPlayer.black.sessionId;
    const cells = cardState.theoryNumberCellsBySession[sessionId].cells;

    expect(cells['0,0']).toBeUndefined();
    expect(cells['0,1']).toBeUndefined();
    expect(cells['0,2']).toBeUndefined();
    expect(cells['0,3']).toBeDefined();
    expect(cardState.boardBonusByCell['0,0']).toBe(beforeBonus00);
    expect(cardState.boardBonusByCell['0,1']).toBe(beforeBonus01);
    expect(cardState.boardBonusByCell['0,2']).toBe(beforeBonus02);
  });

  test('理論の化身ルーレットは穴・封鎖・空凍結の理論数字マスを候補にしない', () => {
    const prng = createPrng([0]);
    const cardState: any = CardLogic.createCardState(prng, { plainReversi: true });
    const gameState = createGameState();
    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Shared.BLACK));
    gameState.board[0][0] = Shared.EMPTY;
    gameState.board[0][1] = Shared.EMPTY;
    gameState.board[0][2] = Shared.EMPTY;
    gameState.board[0][3] = Shared.EMPTY;
    cardState.theoryIncarnationStateByPlayer = {
      black: { sessionId: 'theory_black_1', ownerKey: 'black', remainingSpawnCount: 5 },
      white: null
    };
    cardState.theoryNumberCellsBySession = {
      theory_black_1: {
        ownerKey: 'black',
        cells: {
          '0,0': { row: 0, col: 0, spawnType: 'SNIPER', sourceCardId: 'sniper_01', sourceCardType: 'SNIPER_WILL', markerData: { type: 'SNIPER', sourceType: 'THEORY_INCARNATION' } },
          '0,1': { row: 0, col: 1, spawnType: 'SNIPER', sourceCardId: 'sniper_01', sourceCardType: 'SNIPER_WILL', markerData: { type: 'SNIPER', sourceType: 'THEORY_INCARNATION' } },
          '0,2': { row: 0, col: 2, spawnType: 'SNIPER', sourceCardId: 'sniper_01', sourceCardType: 'SNIPER_WILL', markerData: { type: 'SNIPER', sourceType: 'THEORY_INCARNATION' } },
          '0,3': { row: 0, col: 3, spawnType: 'SNIPER', sourceCardId: 'sniper_01', sourceCardType: 'SNIPER_WILL', markerData: { type: 'SNIPER', sourceType: 'THEORY_INCARNATION' } }
        }
      }
    };
    CardLogic.addMarker(cardState, 'specialStone', 0, 0, 'black', { type: 'METEOR_HOLE' });
    CardLogic.addMarker(cardState, 'specialStone', 0, 1, 'black', { type: 'BLOCKADE', remainingOwnerTurns: 3 });
    CardLogic.addMarker(cardState, 'specialStone', 0, 2, 'black', { type: 'FREEZE', remainingOwnerTurns: 2 });
    CardLogic.addMarker(cardState, 'manifestStone', 3, 3, 'black', {
      type: 'THEORY_INCARNATION',
      remainingOwnerTurns: 5,
      absoluteProtected: true,
      sourceType: 'THEORY_INCARNATION',
      sessionId: 'theory_black_1'
    });

    const result = CardLogic.processTheoryIncarnationMarkerAtTurnStart(cardState, gameState, 'black', 3, 3, prng);

    expect(result.spawned).toEqual(expect.objectContaining({ row: 0, col: 3, type: 'SNIPER' }));
    expect(result.spawned.roulette.candidateCells).toEqual([{ row: 0, col: 3 }]);
    expect(gameState.board[0][3]).toBe(Shared.BLACK);
    expect(gameState.board[0][0]).toBe(Shared.EMPTY);
  });

  test('理論召喚は確定マスで挟める列があれば通常配置と同じ反転を行う', () => {
    const prng = createPrng([0]);
    const cardState: any = CardLogic.createCardState(prng, { plainReversi: true });
    const gameState = createGameState();
    gameState.currentPlayer = Shared.BLACK;
    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY));
    gameState.board[0][0] = Shared.EMPTY;
    gameState.board[0][1] = Shared.WHITE;
    gameState.board[0][2] = Shared.WHITE;
    gameState.board[0][3] = Shared.BLACK;
    cardState.charge.black = 0;
    cardState.numberCellCollectedTotalByPlayer.black = 42;
    cardState.boardBonusByCell = { '0,0': 5 };
    cardState.boardBonusConsumedByCell = {};
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
            value: 5,
            originalValue: 0,
            originalConsumed: false,
            spawnType: 'GHOST',
            sourceCardId: 'ghost_01',
            sourceCardType: 'GHOST_WILL',
            sourceCardCost: 5,
            markerData: {
              type: 'GHOST',
              remainingOwnerTurns: 8,
              sourceType: 'THEORY_INCARNATION',
              sourceCardId: 'ghost_01',
              sourceCardType: 'GHOST_WILL'
            }
          }
        }
      }
    };
    cardState.theoryIncarnationStateByPlayer = {
      black: { sessionId: 'theory_black_1', ownerKey: 'black', remainingSpawnCount: 5 },
      white: null
    };
    CardLogic.addMarker(cardState, 'manifestStone', 2, 2, 'black', {
      type: 'THEORY_INCARNATION',
      remainingOwnerTurns: 5,
      absoluteProtected: true,
      sourceType: 'THEORY_INCARNATION'
    });

    const result = CardLogic.processTheoryIncarnationMarkerAtTurnStart(cardState, gameState, 'black', 2, 2, prng);

    expect(result.spawned).toEqual(expect.objectContaining({
      row: 0,
      col: 0,
      type: 'GHOST',
      flips: [{ row: 0, col: 1 }, { row: 0, col: 2 }],
      chargeGained: 7
    }));
    expect(gameState.board[0][0]).toBe(Shared.BLACK);
    expect(gameState.board[0][1]).toBe(Shared.BLACK);
    expect(gameState.board[0][2]).toBe(Shared.BLACK);
    expect(gameState.board[0][3]).toBe(Shared.BLACK);
    expect(cardState.charge.black).toBe(7);
    expect(cardState.chargeGainedTotal.black).toBe(7);
    expect(cardState.numberCellCollectedTotalByPlayer.black).toBe(47);
    expect(cardState.boardBonusConsumedByCell['0,0']).toBe(true);
    expect(cardState.chargeDeltaEvents).toContainEqual(expect.objectContaining({
      player: 'black',
      delta: 7,
      popupKind: 'board',
      anchorRow: 0,
      anchorCol: 0,
      sourceType: 'theory_incarnation_spawn_gain'
    }));
  });

  test('理論召喚は挟める列がない確定マスでも従来通り特殊石を出現させる', () => {
    const prng = createPrng([0]);
    const cardState: any = CardLogic.createCardState(prng, { plainReversi: true });
    const gameState = createGameState();
    gameState.currentPlayer = Shared.BLACK;
    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY));
    gameState.board[0][0] = Shared.EMPTY;
    cardState.boardBonusByCell = { '0,0': 5 };
    cardState.boardBonusConsumedByCell = {};
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
            value: 5,
            originalValue: 0,
            originalConsumed: false,
            spawnType: 'GHOST',
            sourceCardId: 'ghost_01',
            sourceCardType: 'GHOST_WILL',
            sourceCardCost: 5,
            markerData: {
              type: 'GHOST',
              remainingOwnerTurns: 8,
              sourceType: 'THEORY_INCARNATION',
              sourceCardId: 'ghost_01',
              sourceCardType: 'GHOST_WILL'
            }
          }
        }
      }
    };
    cardState.theoryIncarnationStateByPlayer = {
      black: { sessionId: 'theory_black_1', ownerKey: 'black', remainingSpawnCount: 5 },
      white: null
    };
    CardLogic.addMarker(cardState, 'manifestStone', 2, 2, 'black', {
      type: 'THEORY_INCARNATION',
      remainingOwnerTurns: 5,
      absoluteProtected: true,
      sourceType: 'THEORY_INCARNATION'
    });

    const result = CardLogic.processTheoryIncarnationMarkerAtTurnStart(cardState, gameState, 'black', 2, 2, prng);

    expect(result.spawned).toEqual(expect.objectContaining({
      row: 0,
      col: 0,
      type: 'GHOST',
      flips: []
    }));
    expect(gameState.board[0][0]).toBe(Shared.BLACK);
    expect(cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        row: 0,
        col: 0,
        owner: 'black',
        data: expect.objectContaining({
          type: 'GHOST',
          sourceType: 'THEORY_INCARNATION'
        })
      })
    ]));
    expect(cardState.boardBonusConsumedByCell['0,0']).toBe(true);
    expect(cardState.charge.black).toBe(5);
    expect(cardState.chargeGainedTotal.black).toBe(5);
    expect(cardState.numberCellCollectedTotalByPlayer.black).toBe(5);
  });

  test('生成候補はカタログ上の特殊石カード型からマーカーを構築する', () => {
    const table = SpecialStoneMarkerFactory.buildTheoryIncarnationSpawnTable([
      { id: 'hard_01', type: 'PROTECTED_NEXT_STONE', cost: 1 },
      { id: 'perma_01', type: 'PERMA_PROTECT_NEXT_STONE', cost: 16 },
      { id: 'destroy_dragon_01', type: 'DESTROY_DRAGON_WILL', cost: 7 },
      { id: 'robot_vacuum_01', type: 'ROBOT_VACUUM_WILL', cost: 17 },
      { id: 'hyperactive_01', type: 'HYPERACTIVE_WILL', cost: 5 },
      { id: 'extreme_hyperactive_01', type: 'EXTREME_HYPERACTIVE_WILL', cost: 32 },
      { id: 'escape_01', type: 'ESCAPE_WILL', cost: 7 },
      { id: 'gluttonous_will_01', type: 'GLUTTONOUS_WILL', cost: 29 },
      { id: 'will_hunter_king_01', type: 'WILL_HUNTER_KING', cost: 33 },
      { id: 'udg_01', type: 'ULTIMATE_DESTROY_GOD', cost: 30 },
      { id: 'ultimate_hyperactive_01', type: 'ULTIMATE_HYPERACTIVE_GOD', cost: 28 },
      { id: 'stone_salvation_god_01', type: 'STONE_SALVATION_GOD', cost: 20 },
      { id: 'work_01', type: 'WORK_WILL', cost: 11 },
      { id: 'instant_hyperactive_01', type: 'INSTANT_HYPERACTIVE_WILL', cost: 2 },
      { id: 'time_bomb_01', type: 'TIME_BOMB', cost: 9 },
      { id: 'trap_01', type: 'TRAP_WILL', cost: 6 }
    ], {
      SpecialStoneRegistry,
      ownerKey: 'black',
      constants: {
        STRONG_WILL_PROMOTION_OWNER_TURNS: 20,
        ULTIMATE_DESTROY_GOD_TURNS: 6,
        ULTIMATE_HYPERACTIVE_TURNS: 12,
        STONE_SALVATION_GOD_TURNS: 12,
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
        cardCost: 16,
        markerData: expect.objectContaining({ type: 'PERMA_PROTECTED', strongWillPromotionThreshold: 20 })
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
        cardCost: 5,
        markerData: expect.objectContaining({ type: 'HYPERACTIVE', flipEvadeRemaining: 1 })
      }),
      expect.objectContaining({
        cardType: 'EXTREME_HYPERACTIVE_WILL',
        cardCost: 32,
        markerData: expect.objectContaining({ type: 'EXTREME_HYPERACTIVE', flipEvadeRemaining: 5, destroyEvadeRemaining: 5 })
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
        cardType: 'WILL_HUNTER_KING',
        cardCost: 33,
        markerData: expect.objectContaining({
          type: 'WILL_HUNTER_KING',
          remainingOwnerTurns: 8,
          flipEvadeRemaining: 2,
          destroyEvadeRemaining: 2
        })
      }),
      expect.objectContaining({
        cardType: 'ULTIMATE_DESTROY_GOD',
        cardCost: 30,
        markerData: expect.objectContaining({ type: 'ULTIMATE_DESTROY_GOD', remainingOwnerTurns: 6 })
      }),
      expect.objectContaining({
        cardType: 'ULTIMATE_HYPERACTIVE_GOD',
        cardCost: 28,
        markerData: expect.objectContaining({ type: 'ULTIMATE_HYPERACTIVE', remainingOwnerTurns: 12 })
      }),
      expect.objectContaining({
        cardType: 'STONE_SALVATION_GOD',
        cardCost: 20,
        markerData: expect.objectContaining({ type: 'STONE_SALVATION_GOD', remainingOwnerTurns: 12 })
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
    expect(marker.data).toEqual(expect.objectContaining({ remainingOwnerTurns: 5, absoluteProtected: true }));
    expect(CardLogic.isPlacementLockedForPlayer(cardState, 'black')).toBe(true);
    expect(CardLogic.isCardPlayLockedForPlayer(cardState, 'black')).toBe(true);
  });

  test('理論石顕現中の所有者は通常合法手があっても pass fallback で手番終了できる', () => {
    const prng = createPrng([0]);
    const cardState: any = CardLogic.createCardState(prng);
    const gameState = createGameState();
    gameState.currentPlayer = Shared.BLACK;
    expect(Core.getLegalMoves(gameState, Shared.BLACK)).not.toHaveLength(0);
    CardLogic.addMarker(cardState, 'manifestStone', 0, 0, 'black', {
      type: 'THEORY_INCARNATION',
      remainingOwnerTurns: 2,
      absoluteProtected: true,
      sourceType: 'THEORY_INCARNATION'
    });
    expect(CardLogic.isPlacementLockedForPlayer(cardState, 'black')).toBe(true);

    const result = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'pass' }, prng, { skipTurnStart: true });

    expect(result.events).toContainEqual(expect.objectContaining({ type: 'pass', player: 'black' }));
    expect(gameState.currentPlayer).toBe(Shared.WHITE);
  });

  test('理論石を配置した直後にも理論数字マスから特殊石を出現させ、残り5回を消費しない', () => {
    const prng = createPrng([0]);
    const cardState: any = CardLogic.createCardState(prng);
    const gameState = createGameState();
    cardState.hands.black = ['theory_incarnation_01'];
    cardState.charge.black = 0;
    cardState.numberCellCollectedTotalByPlayer.black = 42;

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', 'theory_incarnation_01', null, { prng });
    expect(used).toBe(true);

    cardState.pendingEffectByPlayer.black = { type: 'FREE_PLACEMENT', stage: 'awaitPlace' };
    gameState.currentPlayer = Shared.BLACK;
    const placed = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 2, col: 3 }, prng, { skipTurnStart: true });

    expect(placed.events).toContainEqual(expect.objectContaining({
      type: 'theory_incarnation_spawned',
      player: 'black',
      timing: 'on_manifest_placement',
      detail: expect.objectContaining({
        roulette: expect.objectContaining({
          durationMs: 2500,
          materializeMs: 2000,
          selectedCell: { row: 0, col: 0 },
          candidateCells: expect.arrayContaining([{ row: 0, col: 0 }])
        })
      })
    }));
    const spawnEvent = placed.presentationEvents.find((event: any) => (
      event && event.type === 'SPAWN' && event.reason === 'theory_incarnation_spawn'
    ));
    expect(spawnEvent).toEqual(expect.objectContaining({
      cause: 'THEORY_INCARNATION',
      row: 0,
      col: 0,
      meta: expect.objectContaining({
        theorySpawnRoulette: expect.objectContaining({
          selectedCell: { row: 0, col: 0 }
        })
      })
    }));
    expect(cardState.theoryIncarnationStateByPlayer.black.remainingSpawnCount).toBe(5);
    expect(cardState.boardBonusConsumedByCell['0,0']).toBe(true);
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
      black: { sessionId: 'theory_black_1', ownerKey: 'black', remainingSpawnCount: 5 },
      white: null
    };
    CardLogic.addMarker(cardState, 'manifestStone', 2, 2, 'black', {
      type: 'THEORY_INCARNATION',
      remainingOwnerTurns: 5,
      absoluteProtected: true,
      sourceType: 'THEORY_INCARNATION'
    });

    const result = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 0, col: 0 }, prng);

    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'theory_incarnation_spawned',
      detail: expect.objectContaining({
        roulette: expect.objectContaining({
          durationMs: 2500,
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
    expect(gameState.consecutivePasses).toBe(1);
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'pass',
      player: 'black',
      reason: 'theory_incarnation_auto_turn_end'
    }));
    expectNoPendingTheoryAutoTurnEnd(cardState, 'black');
  });

  test('理論の化身の自動終了は時間停止の連続手番中でもパス数を進める', () => {
    const prng = createPrng([0]);
    const cardState: any = CardLogic.createCardState(prng, { plainReversi: true });
    const gameState = createGameState();
    gameState.currentPlayer = Shared.BLACK;
    gameState.consecutivePasses = 0;
    cardState.timeStopConsecutiveTurnsRemainingByPlayer = { black: 2, white: 0 };
    cardState.theoryIncarnationStateByPlayer = {
      black: { sessionId: 'theory_black_empty', ownerKey: 'black', remainingSpawnCount: 0 },
      white: null
    };
    cardState.theoryNumberCellsBySession = {
      theory_black_empty: { ownerKey: 'black', cells: {} }
    };
    CardLogic.addMarker(cardState, 'manifestStone', 2, 2, 'black', {
      type: 'THEORY_INCARNATION',
      remainingOwnerTurns: 5,
      absoluteProtected: true,
      sourceType: 'THEORY_INCARNATION',
      sessionId: 'theory_black_empty'
    });

    const result = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 0, col: 0 }, prng);

    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'pass',
      player: 'black',
      reason: 'theory_incarnation_auto_turn_end'
    }));
    expect(gameState.currentPlayer).toBe(Shared.BLACK);
    expect(gameState.consecutivePasses).toBe(1);
    expect(cardState.timeStopConsecutiveTurnsRemainingByPlayer.black).toBe(1);
  });

  test('理論召喚で出た配置直後効果持ち特殊石は即時効果を発動する', () => {
    const prng = createPrng([0, 0]);
    const cardState: any = CardLogic.createCardState(prng, { plainReversi: true });
    const gameState = createGameState();
    gameState.currentPlayer = Shared.BLACK;
    gameState.board[0][0] = Shared.EMPTY;
    gameState.board[0][1] = Shared.WHITE;
    cardState.boardBonusByCell = { '0,0': 16 };
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
            value: 16,
            originalValue: 0,
            originalConsumed: false,
            spawnType: 'WILL_HUNTER_KING',
            sourceCardId: 'will_hunter_king_01',
            sourceCardType: 'WILL_HUNTER_KING',
            sourceCardCost: 16,
            markerData: {
              type: 'WILL_HUNTER_KING',
              remainingOwnerTurns: 4,
              flipEvadeRemaining: 2,
              destroyEvadeRemaining: 2,
              sourceType: 'THEORY_INCARNATION',
              sourceCardId: 'will_hunter_king_01',
              sourceCardType: 'WILL_HUNTER_KING'
            }
          }
        }
      }
    };
    cardState.theoryIncarnationStateByPlayer = {
      black: { sessionId: 'theory_black_1', ownerKey: 'black', remainingSpawnCount: 5 },
      white: null
    };
    CardLogic.addMarker(cardState, 'manifestStone', 2, 2, 'black', {
      type: 'THEORY_INCARNATION',
      remainingOwnerTurns: 5,
      absoluteProtected: true,
      sourceType: 'THEORY_INCARNATION'
    });

    const result = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 0, col: 0 }, prng);
    const spawnIndex = indexOfEventType(result.events, 'theory_incarnation_spawned');
    const destroyIndex = indexOfEventType(result.events, 'will_hunter_king_destroyed_immediate');
    const moveIndex = indexOfEventType(result.events, 'will_hunter_king_moved_immediate');
    expect(spawnIndex).toBeGreaterThanOrEqual(0);
    expect(destroyIndex).toBeGreaterThan(spawnIndex);
    expect(moveIndex).toBeGreaterThan(spawnIndex);

    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'theory_incarnation_spawned',
      detail: expect.objectContaining({
        type: 'WILL_HUNTER_KING',
        sourceCardType: 'WILL_HUNTER_KING'
      })
    }));
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'will_hunter_king_destroyed_immediate',
      details: expect.arrayContaining([
        expect.objectContaining({ row: 0, col: 1, sourceRow: 0, sourceCol: 0 })
      ])
    }));
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'will_hunter_king_moved_immediate',
      details: expect.arrayContaining([
        expect.objectContaining({
          from: { row: 0, col: 0 },
          to: { row: 0, col: 1 },
          specialType: 'WILL_HUNTER_KING'
        })
      ])
    }));
    expect(result.presentationEvents).toContainEqual(expect.objectContaining({
      type: 'SPECIAL_STONE_BUBBLE',
      special: 'WILL_HUNTER_KING',
      scenario: 'place',
      player: 'black',
      row: 0,
      col: 0
    }));
    expect(gameState.board[0][0]).toBe(Shared.EMPTY);
    expect(gameState.board[0][1]).toBe(Shared.BLACK);
    expect(cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        row: 0,
        col: 1,
        owner: 'black',
        data: expect.objectContaining({
          type: 'WILL_HUNTER_KING',
          sourceType: 'THEORY_INCARNATION'
        })
      })
    ]));
  });

  test('理論召喚で出た破壊神の即時破壊は救済神復活に渡されたPRNGを使う', () => {
    const prng = createPrng([0]);
    const cardState: any = CardLogic.createCardState(prng, { plainReversi: true });
    delete cardState._defaultRandomSource;
    const gameState = createGameState();
    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY));
    gameState.board[0][0] = Shared.BLACK;
    gameState.board[3][3] = Shared.BLACK;
    gameState.board[3][4] = Shared.WHITE;
    cardState.markers.push(
      { id: 1, kind: 'specialStone', row: 0, col: 0, owner: 'black', data: { type: 'STONE_SALVATION_GOD', remainingOwnerTurns: 12 } },
      { id: 2, kind: 'specialStone', row: 3, col: 3, owner: 'black', data: { type: 'ULTIMATE_DESTROY_GOD', remainingOwnerTurns: 6 } }
    );
    const events: any[] = [];

    expect(() => {
      TheorySpawnImmediateEffects.resolveTheorySpawnImmediateEffects({
        CardLogic,
        cardState,
        gameState,
        playerKey: 'black',
        events,
        spawned: { row: 3, col: 3, type: 'ULTIMATE_DESTROY_GOD' },
        prng
      });
    }).not.toThrow();

    expect(events).toContainEqual(expect.objectContaining({
      type: 'udg_destroyed_immediate',
      details: expect.arrayContaining([expect.objectContaining({ row: 3, col: 4 })])
    }));
    expect(cardState.presentationEvents).toContainEqual(expect.objectContaining({
      type: 'SPAWN',
      ownerAfter: 'black',
      cause: 'STONE_SALVATION_GOD',
      reason: 'stone_salvation_god_revive'
    }));
    expect(cardState.pendingStoneSalvationGodRevivesByPlayer.black).toEqual([]);
  });

  test('理論石配置直後の理論召喚でも配置直後効果を発動する', () => {
    const prng = createPrng([0, 0]);
    const cardState: any = CardLogic.createCardState(prng, { plainReversi: true });
    const gameState = createGameState();
    gameState.currentPlayer = Shared.BLACK;
    gameState.board[0][0] = Shared.EMPTY;
    gameState.board[0][1] = Shared.WHITE;
    cardState.hands.black = ['theory_incarnation_01'];
    cardState.charge.black = 0;
    cardState.numberCellCollectedTotalByPlayer.black = 42;

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', 'theory_incarnation_01', null, { prng });
    expect(used).toBe(true);
    const sessionId = cardState.theoryIncarnationStateByPlayer.black.sessionId;
    cardState.boardBonusByCell = { '0,0': 16 };
    cardState.boardBonusConsumedByCell = {};
    cardState.theoryNumberCellByCell = {
      '0,0': { sessionId, ownerKey: 'black' }
    };
    cardState.theoryNumberCellsBySession = {
      [sessionId]: {
        ownerKey: 'black',
        cells: {
          '0,0': {
            row: 0,
            col: 0,
            value: 16,
            originalValue: 0,
            originalConsumed: false,
            spawnType: 'WILL_HUNTER_KING',
            sourceCardId: 'will_hunter_king_01',
            sourceCardType: 'WILL_HUNTER_KING',
            sourceCardCost: 16,
            markerData: {
              type: 'WILL_HUNTER_KING',
              remainingOwnerTurns: 4,
              flipEvadeRemaining: 2,
              destroyEvadeRemaining: 2,
              sourceType: 'THEORY_INCARNATION',
              sourceCardId: 'will_hunter_king_01',
              sourceCardType: 'WILL_HUNTER_KING'
            }
          }
        }
      }
    };
    cardState.pendingEffectByPlayer.black = { type: 'FREE_PLACEMENT', stage: 'awaitPlace' };

    const result = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 2, col: 3 }, prng, { skipTurnStart: true });
    const spawnIndex = indexOfEventType(result.events, 'theory_incarnation_spawned');
    const destroyIndex = indexOfEventType(result.events, 'will_hunter_king_destroyed_immediate');
    const moveIndex = indexOfEventType(result.events, 'will_hunter_king_moved_immediate');
    expect(spawnIndex).toBeGreaterThanOrEqual(0);
    expect(destroyIndex).toBeGreaterThan(spawnIndex);
    expect(moveIndex).toBeGreaterThan(spawnIndex);

    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'theory_incarnation_spawned',
      player: 'black',
      timing: 'on_manifest_placement',
      detail: expect.objectContaining({
        type: 'WILL_HUNTER_KING',
        sourceCardType: 'WILL_HUNTER_KING'
      })
    }));
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'will_hunter_king_destroyed_immediate',
      details: expect.arrayContaining([
        expect.objectContaining({ row: 0, col: 1, sourceRow: 0, sourceCol: 0 })
      ])
    }));
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'will_hunter_king_moved_immediate',
      details: expect.arrayContaining([
        expect.objectContaining({
          from: { row: 0, col: 0 },
          to: { row: 0, col: 1 },
          specialType: 'WILL_HUNTER_KING'
        })
      ])
    }));
    expect(result.presentationEvents).toContainEqual(expect.objectContaining({
      type: 'SPECIAL_STONE_BUBBLE',
      special: 'WILL_HUNTER_KING',
      scenario: 'place',
      player: 'black',
      row: 0,
      col: 0
    }));
    expect(cardState.theoryIncarnationStateByPlayer.black.remainingSpawnCount).toBe(5);
    expect(gameState.board[0][0]).toBe(Shared.EMPTY);
    expect(gameState.board[0][1]).toBe(Shared.BLACK);
    expect(cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        row: 0,
        col: 1,
        owner: 'black',
        data: expect.objectContaining({
          type: 'WILL_HUNTER_KING',
          sourceType: 'THEORY_INCARNATION'
        })
      })
    ]));
  });

  test('理論生成のSPAWN presentation eventにroulette metadataを載せる', () => {
    const prng = createPrng([0]);
    const cardState: any = CardLogic.createCardState(prng, { plainReversi: true });
    const gameState = createGameState();
    gameState.currentPlayer = Shared.BLACK;
    cardState.boardBonusByCell = { '0,0': 33, '0,1': 33 };
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
            value: 33,
            originalValue: 0,
            originalConsumed: false,
            spawnType: 'WILL_HUNTER_KING',
            sourceCardId: 'will_hunter_king_01',
            sourceCardType: 'WILL_HUNTER_KING',
            sourceCardCost: 33,
            markerData: {
              type: 'WILL_HUNTER_KING',
              remainingOwnerTurns: 8,
              flipEvadeRemaining: 2,
              destroyEvadeRemaining: 2,
              sourceType: 'THEORY_INCARNATION',
              sourceCardId: 'will_hunter_king_01',
              sourceCardType: 'WILL_HUNTER_KING'
            }
          },
          '0,1': {
            row: 0,
            col: 1,
            value: 33,
            originalValue: 0,
            originalConsumed: false,
            spawnType: 'WILL_HUNTER_KING',
            sourceCardId: 'will_hunter_king_01',
            sourceCardType: 'WILL_HUNTER_KING',
            sourceCardCost: 33,
            markerData: {
              type: 'WILL_HUNTER_KING',
              remainingOwnerTurns: 8,
              flipEvadeRemaining: 2,
              destroyEvadeRemaining: 2,
              sourceType: 'THEORY_INCARNATION',
              sourceCardId: 'will_hunter_king_01',
              sourceCardType: 'WILL_HUNTER_KING'
            }
          }
        }
      }
    };
    cardState.theoryIncarnationStateByPlayer = {
      black: { sessionId: 'theory_black_1', ownerKey: 'black', remainingSpawnCount: 5 },
      white: null
    };
    CardLogic.addMarker(cardState, 'manifestStone', 2, 2, 'black', {
      type: 'THEORY_INCARNATION',
      remainingOwnerTurns: 5,
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
          durationMs: 2500,
          materializeMs: 2000,
          selectedCell: { row: 0, col: 0 },
          candidateCells: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
          spawnedMarkerType: 'WILL_HUNTER_KING'
        }),
        special: 'WILL_HUNTER_KING',
        timer: 8,
        flipEvadeRemaining: 2,
        destroyEvadeRemaining: 2
      })
    }));
  });

  test('理論石顕現中は5回の自ターン開始で連続して自動終了し、5回目に満了する', () => {
    const prng = createPrng([0, 0, 0, 0, 0]);
    const cardState: any = CardLogic.createCardState(prng, { plainReversi: true });
    const gameState = createGameState();
    gameState.currentPlayer = Shared.BLACK;
    cardState.boardBonusByCell = { '0,0': 5, '0,1': 5, '0,2': 5, '0,3': 5, '0,4': 5 };
    cardState.theoryNumberCellByCell = {
      '0,0': { sessionId: 'theory_black_1', ownerKey: 'black' },
      '0,1': { sessionId: 'theory_black_1', ownerKey: 'black' },
      '0,2': { sessionId: 'theory_black_1', ownerKey: 'black' },
      '0,3': { sessionId: 'theory_black_1', ownerKey: 'black' },
      '0,4': { sessionId: 'theory_black_1', ownerKey: 'black' }
    };
    cardState.theoryNumberCellsBySession = {
      theory_black_1: {
        ownerKey: 'black',
        cells: Object.fromEntries([0, 1, 2, 3, 4].map((col) => [
          `0,${col}`,
          {
            row: 0,
            col,
            value: 5,
            originalValue: 0,
            originalConsumed: false,
            spawnType: 'GHOST',
            sourceCardId: 'ghost_01',
            sourceCardType: 'GHOST_WILL',
            sourceCardCost: 5
          }
        ]))
      }
    };
    cardState.theoryIncarnationStateByPlayer = {
      black: { sessionId: 'theory_black_1', ownerKey: 'black', remainingSpawnCount: 5 },
      white: null
    };
    CardLogic.addMarker(cardState, 'manifestStone', 2, 2, 'black', {
      type: 'THEORY_INCARNATION',
      remainingOwnerTurns: 5,
      absoluteProtected: true,
      sourceType: 'THEORY_INCARNATION'
    });

    for (let turn = 1; turn <= 4; turn += 1) {
      gameState.currentPlayer = Shared.BLACK;
      const result = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 0, col: turn - 1 }, prng);
      expect(result.events).toContainEqual(expect.objectContaining({ type: 'theory_incarnation_auto_turn_end', player: 'black' }));
      expect(result.events.map((event: any) => event && event.type)).not.toContain('theory_incarnation_marker_expired');
      expect(cardState.theoryIncarnationStateByPlayer.black.remainingSpawnCount).toBe(5 - turn);
      expect(gameState.currentPlayer).toBe(Shared.WHITE);
    }

    gameState.currentPlayer = Shared.BLACK;
    const fifth = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 0, col: 4 }, prng);
    const eventTypes = fifth.events.map((event: any) => event && event.type);
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
    expect(cardState.markers.filter((entry: any) => entry && entry.data && entry.data.sourceType === 'THEORY_INCARNATION')).toHaveLength(5);
  });
});
