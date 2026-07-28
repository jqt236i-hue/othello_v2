import * as Shared from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';
import * as TurnPipelinePhases from '../game/turn/turn_pipeline_phases.js';
import * as Core from '../game/logic/core.js';
import * as BoardOps from '../game/logic/board_ops.js';
import * as TheorySpawnImmediateEffects from '../game/turn/theory-spawn-immediate-effects';

function createPrng(randomValue = 0) {
  return {
    shuffle: (items: any[]) => items,
    random: jest.fn(() => randomValue)
  };
}

function createEmptyBoard() {
  return Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
}

function createStates(randomValue = 0) {
  const cardState = CardLogic.createCardState(createPrng(randomValue));
  const gameState = Core.createGameState();
  gameState.turnNumber = 1;
  return { cardState, gameState };
}

function marker(cardState: any, type: string, row?: number, col?: number) {
  return (cardState.markers || []).find((item: any) => (
    item &&
    item.data &&
    item.data.type === type &&
    (row === undefined || item.row === row) &&
    (col === undefined || item.col === col)
  ));
}

describe('GRASS_WILL（草の意志）', () => {
  test('カード定義・背景・持続定数が正しい', () => {
    const def = (Shared.CARD_DEFS || []).find((card: any) => card && card.type === 'GRASS_WILL');
    expect(def).toMatchObject({
      id: 'grass_will_01',
      name: '草の意志',
      cost: 20,
      display_type_ja: '繁栄',
      card_face_art_path: 'assets/images/special-cards/backgrounds/grass_will_background.png'
    });
    expect(CardLogic.GRASS_WILL_TURNS).toBe(10);
    expect(CardLogic.SEED_WILL_TURNS).toBe(5);
  });

  test('配置時に草石を作り、寿命を減らさず種を1つまく', () => {
    const prng = createPrng(0);
    const { cardState, gameState } = createStates(0);
    gameState.board[2][4] = Shared.WHITE;
    gameState.board[2][5] = Shared.BLACK;
    cardState.pendingEffectByPlayer.black = {
      type: 'GRASS_WILL',
      stage: null,
      cardId: 'grass_will_01'
    };
    const events: any[] = [];

    TurnPipelinePhases.applyActionPhase(
      CardLogic,
      Core,
      cardState,
      gameState,
      'black',
      { type: 'place', row: 2, col: 3 },
      events,
      prng,
      BoardOps
    );

    expect(marker(cardState, 'GRASS', 2, 3)).toEqual(expect.objectContaining({
      owner: 'black',
      data: expect.objectContaining({ remainingOwnerTurns: 10 })
    }));
    expect(marker(cardState, 'SEED', 0, 0)).toEqual(expect.objectContaining({
      owner: 'black',
      data: expect.objectContaining({
        remainingOwnerTurns: 5,
        sourceCardType: 'GRASS_WILL'
      })
    }));
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'grass_seeded_immediate' })
    ]));
    expect(cardState._presentationEventsPersist).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'STATUS_APPLIED',
        row: 0,
        col: 0,
        meta: expect.objectContaining({
          special: 'SEED',
          cause: 'GRASS_WILL',
          reason: 'grass_seeded',
          sourceRow: 2,
          sourceCol: 3,
          sourceTrajectoryProfile: 'grassWillSeedBeam'
        })
      })
    ]));
    expect(prng.random).toHaveBeenCalledTimes(1);
  });

  test('10回目の所有者ターン開始も先に播種してから通常石へ戻る', () => {
    const { cardState, gameState } = createStates(0.25);
    gameState.board[4][4] = Shared.BLACK;
    CardLogic.addMarker(cardState, 'specialStone', 4, 4, 'black', {
      type: 'GRASS',
      remainingOwnerTurns: 1
    });

    const result = CardLogic.processGrassWillEffectsAtTurnStartAnchor(
      cardState,
      gameState,
      'black',
      4,
      4,
      createPrng(0.25)
    );

    expect(result.seeded).toHaveLength(1);
    expect(result.expired).toEqual([
      expect.objectContaining({ row: 4, col: 4, reason: 'anchor_expired' })
    ]);
    expect(marker(cardState, 'GRASS', 4, 4)).toBeFalsy();
    expect(marker(cardState, 'SEED')).toBeTruthy();
    expect(gameState.board[4][4]).toBe(Shared.BLACK);
  });

  test('相手ターンでは播種も寿命減算も行わない', () => {
    const prng = createPrng(0);
    const { cardState, gameState } = createStates(0);
    gameState.board[4][4] = Shared.BLACK;
    CardLogic.addMarker(cardState, 'specialStone', 4, 4, 'black', {
      type: 'GRASS',
      remainingOwnerTurns: 10
    });
    const events: any[] = [];

    TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'white', events, prng);

    expect(marker(cardState, 'GRASS', 4, 4)?.data.remainingOwnerTurns).toBe(10);
    expect(marker(cardState, 'SEED')).toBeFalsy();
    expect(prng.random).not.toHaveBeenCalled();
  });

  test('所有者ターン開始で新たにまいた種は同じ開始処理では減算しない', () => {
    const prng = createPrng(0);
    const { cardState, gameState } = createStates(0);
    gameState.board = createEmptyBoard();
    gameState.board[4][4] = Shared.BLACK;
    CardLogic.addMarker(cardState, 'specialStone', 4, 4, 'black', {
      type: 'GRASS',
      remainingOwnerTurns: 10
    });
    const events: any[] = [];

    TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', events, prng);

    expect(marker(cardState, 'GRASS', 4, 4)?.data.remainingOwnerTurns).toBe(9);
    expect(marker(cardState, 'SEED', 0, 0)?.data.remainingOwnerTurns).toBe(5);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'grass_seeded_start' })
    ]));
    expect(cardState._presentationEventsPersist).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'STATUS_APPLIED',
        row: 0,
        col: 0,
        meta: expect.objectContaining({
          special: 'SEED',
          cause: 'GRASS_WILL',
          reason: 'grass_seeded',
          sourceRow: 4,
          sourceCol: 4,
          sourceTrajectoryProfile: 'grassWillSeedBeam'
        })
      })
    ]));
  });

  test('播種候補がない場合は乱数を消費せず寿命だけ進む', () => {
    const prng = createPrng(0.5);
    const { cardState, gameState } = createStates(0.5);
    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Shared.WHITE));
    gameState.board[4][4] = Shared.BLACK;
    CardLogic.addMarker(cardState, 'specialStone', 4, 4, 'black', {
      type: 'GRASS',
      remainingOwnerTurns: 7
    });

    const result = CardLogic.processGrassWillEffectsAtTurnStartAnchor(
      cardState,
      gameState,
      'black',
      4,
      4,
      prng
    );

    expect(result.seeded).toEqual([]);
    expect(marker(cardState, 'GRASS', 4, 4)?.data.remainingOwnerTurns).toBe(6);
    expect(prng.random).not.toHaveBeenCalled();
  });

  test('複数の草石は登場順に処理し、更新後の候補から別々の種をまく', () => {
    const prng = createPrng(0);
    const { cardState, gameState } = createStates(0);
    gameState.board = createEmptyBoard();
    gameState.board[4][4] = Shared.BLACK;
    gameState.board[5][5] = Shared.BLACK;
    CardLogic.addMarker(cardState, 'specialStone', 4, 4, 'black', {
      type: 'GRASS',
      remainingOwnerTurns: 10
    });
    CardLogic.addMarker(cardState, 'specialStone', 5, 5, 'black', {
      type: 'GRASS',
      remainingOwnerTurns: 10
    });

    const result = CardLogic.processGrassWillEffects(cardState, gameState, 'black', prng);

    expect(result.seeded.map((entry: any) => [entry.row, entry.col])).toEqual([[0, 0], [0, 1]]);
    expect(marker(cardState, 'SEED', 0, 0)).toBeTruthy();
    expect(marker(cardState, 'SEED', 0, 1)).toBeTruthy();
    expect(prng.random).toHaveBeenCalledTimes(2);
  });

  test('理論の化身から出現した草石も配置時に播種する', () => {
    const prng = createPrng(0);
    const { cardState, gameState } = createStates(0);
    gameState.board = createEmptyBoard();
    gameState.board[4][4] = Shared.BLACK;
    CardLogic.addMarker(cardState, 'specialStone', 4, 4, 'black', {
      type: 'GRASS',
      remainingOwnerTurns: 10
    });
    const events: any[] = [];

    TheorySpawnImmediateEffects.resolveTheorySpawnImmediateEffects({
      CardLogic,
      cardState,
      gameState,
      playerKey: 'black',
      events,
      spawned: { row: 4, col: 4, type: 'GRASS' },
      prng
    });

    expect(marker(cardState, 'GRASS', 4, 4)?.data.remainingOwnerTurns).toBe(10);
    expect(marker(cardState, 'SEED', 0, 0)?.data.sourceCardType).toBe('GRASS_WILL');
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'grass_seeded_immediate' })
    ]));
  });

  test('草由来の種は5回目に通常石として芽生え、通常反転する', () => {
    const prng = createPrng(0);
    const { cardState, gameState } = createStates(0);
    cardState.debugNoDraw = true;
    cardState.charge.black = 0;
    cardState.chargeGainedTotal.black = 0;
    gameState.board = createEmptyBoard();
    gameState.board[3][0] = Shared.BLACK;
    gameState.board[3][1] = Shared.WHITE;
    CardLogic.addMarker(cardState, 'specialStone', 3, 2, 'black', {
      type: 'SEED',
      remainingOwnerTurns: 1,
      sourceCardType: 'GRASS_WILL'
    });
    const events: any[] = [];

    TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', events, prng);

    expect(marker(cardState, 'SEED', 3, 2)).toBeFalsy();
    expect(gameState.board[3][2]).toBe(Shared.BLACK);
    expect(gameState.board[3][1]).toBe(Shared.BLACK);
    expect(cardState.charge.black).toBe(1);
    expect((cardState.presentationEvents || []).some((event: any) => (
      event &&
      event.type === 'SPAWN' &&
      event.cause === 'GRASS_WILL' &&
      event.reason === 'seed_sprout'
    ))).toBe(true);
  });

  test('草石は反転保護されるが通常の破壊対象になる', () => {
    const { cardState, gameState } = createStates(0);
    gameState.board[1][1] = Shared.BLACK;
    CardLogic.addMarker(cardState, 'specialStone', 1, 1, 'black', {
      type: 'GRASS',
      remainingOwnerTurns: 10
    });

    const context = CardLogic.getCardContext(cardState);
    expect(context.permaProtectedStones).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 1, col: 1, owner: Shared.BLACK })
    ]));

    const destroyed = BoardOps.destroyAt(cardState, gameState, 1, 1, 'TEST', 'grass_destroyed');
    expect(destroyed.destroyed).toBe(true);
    expect(gameState.board[1][1]).toBe(Shared.EMPTY);
    expect(marker(cardState, 'GRASS', 1, 1)).toBeFalsy();
  });

  test('草石が破壊されても、既にまかれた種は独立して残る', () => {
    const { cardState, gameState } = createStates(0);
    gameState.board[1][1] = Shared.BLACK;
    CardLogic.addMarker(cardState, 'specialStone', 1, 1, 'black', {
      type: 'GRASS',
      remainingOwnerTurns: 10
    });
    CardLogic.addMarker(cardState, 'specialStone', 6, 6, 'black', {
      type: 'SEED',
      remainingOwnerTurns: 5,
      sourceCardType: 'GRASS_WILL'
    });

    BoardOps.destroyAt(cardState, gameState, 1, 1, 'TEST', 'grass_destroyed');

    expect(marker(cardState, 'GRASS', 1, 1)).toBeFalsy();
    expect(marker(cardState, 'SEED', 6, 6)).toEqual(expect.objectContaining({
      owner: 'black',
      data: expect.objectContaining({
        remainingOwnerTurns: 5,
        sourceCardType: 'GRASS_WILL'
      })
    }));
  });
});
