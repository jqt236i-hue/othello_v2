import * as Shared from '../shared-constants';
import * as Core from '../game/logic/core';
import * as CardLogic from '../game/logic/cards';
import * as BoardOps from '../game/logic/board_ops';
import * as SpecialStoneRegistry from '../shared/special-stone-registry';
import * as TurnPipelinePhases from '../game/turn/turn_pipeline_phases';
import * as TurnStartSpecialStonePhase from '../game/turn/turn-start/special-stone-phase';

const MATERIALS = ['FIRE', 'WATER', 'GRASS', 'LIGHTNING'] as const;

function createPrng(values: number[] = [0]) {
  let index = 0;
  return {
    shuffle: (items: any[]) => items,
    random: jest.fn(() => values[Math.min(index++, values.length - 1)] ?? 0)
  };
}

function createEmptyStates(prng = createPrng()) {
  const cardState = CardLogic.createCardState(prng);
  const gameState = Core.createGameState();
  gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY));
  gameState.turnNumber = 1;
  return { cardState, gameState };
}

function addMaterials(cardState: any, gameState: any, positions: Array<[number, number]>, owner: 'black' | 'white' = 'black') {
  const ownerValue = owner === 'black' ? Shared.BLACK : Shared.WHITE;
  MATERIALS.forEach((type, index) => {
    const [row, col] = positions[index];
    gameState.board[row][col] = ownerValue;
    CardLogic.addMarker(cardState, 'specialStone', row, col, owner, {
      type,
      remainingOwnerTurns: 6
    });
  });
}

function shinraMarker(cardState: any) {
  return (cardState.markers || []).find((marker: any) => (
    marker?.kind === 'specialStone'
    && marker?.data?.type === 'SHINRA_BANSHO_GOD'
  ));
}

function addShinraGroup(
  cardState: any,
  gameState: any,
  owner: 'black' | 'white',
  row = 0,
  col = 0
) {
  const ownerValue = owner === 'black' ? Shared.BLACK : Shared.WHITE;
  for (const [cellRow, cellCol] of [
    [row, col],
    [row, col + 1],
    [row + 1, col],
    [row + 1, col + 1]
  ]) {
    gameState.board[cellRow][cellCol] = ownerValue;
  }
  return CardLogic.addMarker(cardState, 'specialStone', row, col, owner, {
    type: 'SHINRA_BANSHO_GOD',
    footprint: 'square_2x2.v1',
    permanent: true
  });
}

describe('森羅万象神', () => {
  test('同色4属性を自動融合し、空き優先の2×2へ1グループとして召喚する', () => {
    const prng = createPrng([0]);
    const { cardState, gameState } = createEmptyStates(prng);
    addMaterials(cardState, gameState, [[6, 0], [6, 2], [6, 4], [6, 6]]);

    const result = CardLogic.resolveShinraBanshoGodFusions(cardState, gameState, prng);

    expect(result.summoned).toEqual([
      expect.objectContaining({
        summoned: true,
        owner: 'black',
        row: 0,
        col: 0,
        footprint: [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
          { row: 1, col: 0 },
          { row: 1, col: 1 }
        ]
      })
    ]);
    expect(prng.random).toHaveBeenCalledTimes(1);
    expect(shinraMarker(cardState)).toEqual(expect.objectContaining({
      row: 0,
      col: 0,
      owner: 'black',
      data: expect.objectContaining({
        type: 'SHINRA_BANSHO_GOD',
        footprint: 'square_2x2.v1',
        permanent: true
      })
    }));
    expect((cardState.markers || []).filter((marker: any) => MATERIALS.includes(marker?.data?.type))).toHaveLength(0);
    expect([
      gameState.board[0][0],
      gameState.board[0][1],
      gameState.board[1][0],
      gameState.board[1][1]
    ]).toEqual([Shared.BLACK, Shared.BLACK, Shared.BLACK, Shared.BLACK]);
    expect([
      gameState.board[6][0],
      gameState.board[6][2],
      gameState.board[6][4],
      gameState.board[6][6]
    ]).toEqual([Shared.EMPTY, Shared.EMPTY, Shared.EMPTY, Shared.EMPTY]);
  });

  test('空き2×2がなくても、最も素材を多く含む候補を選び石を除去して場所を作る', () => {
    const prng = createPrng([0]);
    const { cardState, gameState } = createEmptyStates(prng);
    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Shared.BLACK));
    addMaterials(cardState, gameState, [[0, 0], [0, 3], [3, 0], [3, 3]]);

    const result = CardLogic.resolveShinraBanshoGodFusions(cardState, gameState, prng);

    expect(result.summoned[0]).toMatchObject({
      row: 0,
      col: 0,
      clearedCount: 3
    });
    const fusionDestroyEvents = (cardState.presentationEvents || []).filter((event: any) => (
      event?.type === 'DESTROY'
      && event?.meta?.bypassNormalDestroyAccounting === true
    ));
    expect(fusionDestroyEvents).toHaveLength(7);
    expect(gameState.board.flat().filter((value: number) => value === Shared.BLACK)).toHaveLength(61);
  });

  test('4占有マスすべてが不可侵になり、単マスの反転・破壊・移動・入替・対象選択を拒否する', () => {
    const prng = createPrng([0]);
    const { cardState, gameState } = createEmptyStates(prng);
    addMaterials(cardState, gameState, [[6, 0], [6, 2], [6, 4], [6, 6]]);
    CardLogic.resolveShinraBanshoGodFusions(cardState, gameState, prng);
    gameState.board[2][2] = Shared.WHITE;
    gameState.board[3][3] = Shared.BLACK;
    gameState.board[4][4] = Shared.WHITE;

    const context = CardLogic.getCardContext(cardState);
    expect(context.inviolableStones).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 0, col: 0 }),
      expect.objectContaining({ row: 0, col: 1 }),
      expect.objectContaining({ row: 1, col: 0 }),
      expect.objectContaining({ row: 1, col: 1 })
    ]));
    for (const [row, col] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
      expect(CardLogic.isInviolableCell(cardState, row, col)).toBe(true);
    }
    expect(BoardOps.destroyAt(cardState, gameState, 1, 1, 'TEST', 'destroy'))
      .toMatchObject({ destroyed: false, reason: 'inviolable' });
    expect(BoardOps.changeAt(cardState, gameState, 0, 1, 'white', 'TEST', 'flip'))
      .toMatchObject({ changed: false, reason: 'inviolable' });
    expect(BoardOps.moveAt(cardState, gameState, 1, 0, 2, 0, 'TEST', 'move'))
      .toMatchObject({ moved: false, reason: 'inviolable_source' });
    expect(BoardOps.swapOccupiedCells(cardState, gameState, { row: 0, col: 0 }, { row: 4, col: 4 }))
      .toMatchObject({ swapped: false, reason: 'inviolable_source' });
    const footprintKeys = new Set(['0,0', '0,1', '1,0', '1,1']);
    const targetCollections = [
      CardLogic.getDestroyTargets(cardState, gameState),
      CardLogic.getSwapTargets(cardState, gameState, 'white'),
      CardLogic.getPositionSwapTargets(cardState, gameState, 'black', null),
      CardLogic.getTeleportTargets(cardState, gameState),
      CardLogic.getSuperAttractionTargets(cardState, gameState, 'black', null),
      CardLogic.getSuperBuoyancyTargets(cardState, gameState),
      CardLogic.getSuperGravityTargets(cardState, gameState),
      CardLogic.getReverseWillTargets(cardState, gameState),
      CardLogic.getMeteorTargets(cardState, gameState, 'white'),
      CardLogic.getFreezeTargets(cardState, gameState, 'white')
    ];
    for (const targets of targetCollections) {
      expect(targets.some((cell: any) => footprintKeys.has(`${cell.row},${cell.col}`))).toBe(false);
    }
  });

  test('不可侵により占有マスのセル消滅を拒否し、4マス全体を維持する', () => {
    const prng = createPrng([0]);
    const { cardState, gameState } = createEmptyStates(prng);
    addMaterials(cardState, gameState, [[6, 0], [6, 2], [6, 4], [6, 6]]);
    CardLogic.resolveShinraBanshoGodFusions(cardState, gameState, prng);
    cardState.presentationEvents.length = 0;

    const result = BoardOps.applyCellRemovalAt(
      cardState,
      gameState,
      1,
      1,
      'white',
      'METEOR_WILL',
      'meteor_cell_destroy',
      { removalKind: 'meteor_hole' }
    );

    expect(result).toMatchObject({
      applied: false,
      reason: 'inviolable',
      destroyed: false
    });
    expect(shinraMarker(cardState)).toBeTruthy();
    expect([
      gameState.board[0][0],
      gameState.board[0][1],
      gameState.board[1][0],
      gameState.board[1][1]
    ]).toEqual([Shared.BLACK, Shared.BLACK, Shared.BLACK, Shared.BLACK]);
    expect((cardState.presentationEvents || []).filter((event: any) => (
      event?.type === 'DESTROY'
    ))).toHaveLength(0);
    expect((cardState.markers || []).some((marker: any) => (
      marker?.row === 1
      && marker?.col === 1
      && marker?.data?.type === 'METEOR_HOLE'
    ))).toBe(false);
  });

  test('所有者ターン開始は火→水→草→雷を各1回発動し、永続マーカーを減算しない', () => {
    const prng = createPrng([0, 0, 0, 0]);
    const { cardState, gameState } = createEmptyStates(prng);
    addMaterials(cardState, gameState, [[6, 0], [6, 2], [6, 4], [6, 6]]);
    CardLogic.resolveShinraBanshoGodFusions(cardState, gameState, prng);
    prng.random.mockClear();
    gameState.board[7][7] = Shared.WHITE;

    const result = CardLogic.processShinraBanshoGodAtTurnStartAnchor(
      cardState,
      gameState,
      'black',
      0,
      0,
      prng
    );

    expect(result.fire.scorched).toHaveLength(1);
    expect(result.water.healingCells).toHaveLength(1);
    expect(result.grass.seeded).toHaveLength(1);
    expect(result.lightning.destroyed).toEqual([
      expect.objectContaining({ row: 7, col: 7, sourceRow: 0, sourceCol: 0 })
    ]);
    expect(prng.random).toHaveBeenCalledTimes(4);
    expect(shinraMarker(cardState)?.data).not.toHaveProperty('remainingOwnerTurns');
  });

  test('大凍結は不可侵の神を対象外にし、他の特殊石だけを凍結する', () => {
    const prng = createPrng([0]);
    const { cardState, gameState } = createEmptyStates(prng);
    addMaterials(cardState, gameState, [[6, 0], [6, 2], [6, 4], [6, 6]]);
    CardLogic.resolveShinraBanshoGodFusions(cardState, gameState, prng);
    gameState.board[4][4] = Shared.WHITE;
    CardLogic.addMarker(cardState, 'specialStone', 4, 4, 'white', {
      type: 'SNIPER',
      remainingOwnerTurns: 4
    });
    cardState.pendingEffectByPlayer.white = {
      type: 'MASS_FREEZE_WILL',
      cardId: 'mass_freeze_will_01',
      stage: null
    };

    const result = CardLogic.applyMassFreezeWill(cardState, gameState, 'white');
    const freezes = (cardState.markers || []).filter((marker: any) => marker?.data?.type === 'FREEZE');

    expect(result).toMatchObject({
      applied: true,
      frozenCount: 1,
      frozenCellCount: 1
    });
    expect(freezes.map((marker: any) => `${marker.row},${marker.col}`)).toEqual(['4,4']);
    expect(SpecialStoneRegistry.markerOccupiesCell(shinraMarker(cardState), 1, 1)).toBe(true);
  });

  test('互換状態に凍結マーカーが残っていても不可侵の神は4属性効果を発動する', () => {
    const prng = createPrng([0]);
    const { cardState, gameState } = createEmptyStates(prng);
    const marker = addShinraGroup(cardState, gameState, 'black');
    CardLogic.addMarker(cardState, 'specialStone', 1, 1, 'white', {
      type: 'FREEZE',
      remainingOwnerTurns: 5
    });
    const processShinra = jest.fn(() => ({
      fire: { scorched: [] },
      water: { healingCells: [] },
      grass: { seeded: [] },
      lightning: { destroyed: [] }
    }));

    TurnStartSpecialStonePhase.processTurnStartSpecialStone({
      CardLogic: { processShinraBanshoGodAtTurnStartAnchor: processShinra },
      cardState,
      gameState,
      playerKey: 'black',
      events: [],
      prng,
      markerAnchor: { marker },
      isFrozenCell: () => true,
      awardBoardChargeGain: () => undefined,
      processingState: TurnStartSpecialStonePhase.createTurnStartSpecialStoneProcessingState()
    });

    expect(processShinra).toHaveBeenCalledTimes(1);
  });

  test('通常配置で成立した融合は手番引継ぎ前に解決する', () => {
    const prng = createPrng([0]);
    const cardState = CardLogic.createCardState(prng);
    const gameState = Core.createGameState();
    gameState.currentPlayer = Shared.BLACK;
    gameState.turnNumber = 1;
    addMaterials(cardState, gameState, [[0, 0], [0, 2], [7, 5], [7, 7]]);
    const observedPlayers: number[] = [];
    const cardLogic = {
      ...CardLogic,
      resolveShinraBanshoGodFusions: (...args: any[]) => {
        observedPlayers.push(gameState.currentPlayer);
        return CardLogic.resolveShinraBanshoGodFusions(...args as [any, any, any]);
      }
    };

    TurnPipelinePhases.applyActionPhase(
      cardLogic,
      Core,
      cardState,
      gameState,
      'black',
      { type: 'place', row: 2, col: 3 },
      [],
      prng,
      BoardOps
    );

    expect(observedPlayers[0]).toBe(Shared.BLACK);
    expect(gameState.currentPlayer).toBe(Shared.WHITE);
    expect(shinraMarker(cardState)).toBeTruthy();
  });

  test('不可侵は毒・意志狩り・ゾンビ感染の旧候補列挙にも4マス投影される', () => {
    const poisonPrng = createPrng([0]);
    const poisonState = createEmptyStates(poisonPrng);
    addShinraGroup(poisonState.cardState, poisonState.gameState, 'black');
    CardLogic.addMarker(poisonState.cardState, 'specialStone', 1, 1, 'white', {
      type: 'POISON_CELL',
      remainingTurns: 10
    });

    CardLogic.syncPoisonContacts(poisonState.cardState, poisonState.gameState, 1);

    expect((poisonState.cardState.markers || []).some((marker: any) => (
      marker?.row === 1
      && marker?.col === 1
      && marker?.data?.type === 'POISONED'
    ))).toBe(false);

    const hunterPrng = createPrng([0]);
    const hunterState = createEmptyStates(hunterPrng);
    addShinraGroup(hunterState.cardState, hunterState.gameState, 'white');
    hunterState.gameState.board[3][3] = Shared.BLACK;
    hunterState.gameState.board[7][7] = Shared.WHITE;
    CardLogic.addMarker(hunterState.cardState, 'specialStone', 3, 3, 'black', {
      type: 'WILL_HUNTER_KING',
      remainingOwnerTurns: 8
    });

    const hunterResult = CardLogic.processWillHunterKingEffectsAtTurnStartAnchor(
      hunterState.cardState,
      hunterState.gameState,
      'black',
      3,
      3,
      hunterPrng
    );

    expect(hunterResult.destroyed).toEqual([
      expect.objectContaining({ row: 7, col: 7 })
    ]);
    expect(hunterState.gameState.board[1][1]).toBe(Shared.WHITE);

    const zombiePrng = createPrng([0]);
    const zombieState = createEmptyStates(zombiePrng);
    addShinraGroup(zombieState.cardState, zombieState.gameState, 'white');
    zombieState.gameState.board[2][2] = Shared.BLACK;
    CardLogic.addMarker(zombieState.cardState, 'specialStone', 2, 2, 'black', {
      type: 'ZOMBIE',
      ownerColor: Shared.BLACK,
      turnsUntilInfection: 1,
      regenRemaining: 1
    });

    const zombieResult = CardLogic.processZombieEffectsAtTurnStartAnchor(
      zombieState.cardState,
      zombieState.gameState,
      'black',
      2,
      2,
      zombiePrng
    );

    expect(zombieResult.infected).toEqual([]);
    expect(zombieState.gameState.board[1][1]).toBe(Shared.WHITE);
    expect((zombieState.cardState.markers || []).filter((marker: any) => (
      marker?.data?.type === 'ZOMBIE'
    ))).toHaveLength(1);
  });

  test('盤界の執行者は使用条件では1体に数えるが、不可侵により絶対執行しない', () => {
    const prng = createPrng([0]);
    const { cardState, gameState } = createEmptyStates(prng);
    addShinraGroup(cardState, gameState, 'black');
    gameState.board[4][4] = Shared.BLACK;
    gameState.board[5][5] = Shared.WHITE;
    CardLogic.addMarker(cardState, 'specialStone', 4, 4, 'black', {
      type: 'SNIPER',
      remainingOwnerTurns: 4
    });
    CardLogic.addMarker(cardState, 'specialStone', 5, 5, 'white', {
      type: 'DRAGON',
      remainingOwnerTurns: 4
    });
    cardState.hands.black = ['board_executor_01'];
    cardState.charge.black = 99;

    expect(CardLogic.canUseBoardExecutor(cardState, 'black')).toBe(true);
    expect(CardLogic.applyCardUsage(
      cardState,
      gameState,
      'black',
      'board_executor_01',
      null,
      { prng }
    )).toBe(true);

    const holeKeys = new Set((cardState.markers || [])
      .filter((marker: any) => marker?.data?.type === 'METEOR_HOLE')
      .map((marker: any) => `${marker.row},${marker.col}`));
    expect(holeKeys).toEqual(new Set(['4,4', '5,5']));
    expect(shinraMarker(cardState)).toBeTruthy();
    expect([
      gameState.board[0][0],
      gameState.board[0][1],
      gameState.board[1][0],
      gameState.board[1][1]
    ]).toEqual([Shared.BLACK, Shared.BLACK, Shared.BLACK, Shared.BLACK]);
  });
});
