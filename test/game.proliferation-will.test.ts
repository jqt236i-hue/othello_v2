import * as Shared from '../shared-constants.js';
const CardLogic = require('../game/logic/cards.js');
const BoardOps = require('../game/logic/board_ops.js');
const TurnPipeline = require('../game/turn/turn_pipeline.js');
const TurnPipelineUIAdapter = require('../game/turn/pipeline_ui_adapter.js');
const PROLIFERATION_DURATION = 10;

function createPrng(randomValues = [0]) {
  const values = Array.isArray(randomValues) && randomValues.length ? randomValues.slice() : [0];
  let index = 0;
  return {
    shuffle: (arr) => arr,
    random: () => {
      const value = values[Math.min(index, values.length - 1)];
      index += 1;
      return value;
    }
  };
}

function createState(randomValues = [0]) {
  const prng = createPrng(randomValues);
  const cardState = CardLogic.createCardState(prng);
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  };
  return { cardState, gameState, prng };
}

function findProliferationMarker(cardState, row, col) {
  return (cardState.markers || []).find((marker) => (
    marker &&
    marker.kind === 'specialStone' &&
    marker.row === row &&
    marker.col === col &&
    marker.data &&
    marker.data.type === 'PROLIFERATION'
  )) || null;
}

function expectNoGeneratedSpawnFlipTransientState(cardState) {
  expect(Object.keys(cardState)).not.toEqual(expect.arrayContaining([
    '_deferredGeneratedSpawnFlipQueue',
    '_resolvedGeneratedSpawnFlipResults'
  ]));
  const serialized = JSON.stringify(cardState);
  expect(serialized).not.toContain('_deferredGeneratedSpawnFlipQueue');
  expect(serialized).not.toContain('_resolvedGeneratedSpawnFlipResults');
}

describe('PROLIFERATION_WILL（増殖の意志）', () => {
  test('配置時に増殖石マーカーが付く', () => {
    const { cardState, gameState } = createState();

    gameState.board[3][3] = Shared.BLACK;
    cardState.pendingEffectByPlayer.black = {
      type: 'PROLIFERATION_WILL',
      stage: null,
      cardId: 'proliferation_01'
    };

    const effects = CardLogic.applyPlacementEffects(cardState, gameState, 'black', 3, 3, 0);
    const marker = findProliferationMarker(cardState, 3, 3);

    expect(effects && effects.proliferationPlaced).toBe(true);
    expect(marker).toBeTruthy();
    expect(marker.data.remainingOwnerTurns).toBe(PROLIFERATION_DURATION);
  });

  test('owner turn starts decrement proliferation for 10 turns and expiry reverts it to a normal stone', () => {
    const { cardState, gameState, prng } = createState();

    cardState.debugNoDraw = true;
    gameState.board[4][4] = Shared.BLACK;
    cardState.markers.push({
      id: 1051,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'PROLIFERATION', remainingOwnerTurns: PROLIFERATION_DURATION }
    });

    CardLogic.onTurnStart(cardState, 'white', gameState, prng);
    expect(findProliferationMarker(cardState, 4, 4)?.data.remainingOwnerTurns).toBe(PROLIFERATION_DURATION);

    for (let remaining = PROLIFERATION_DURATION - 1; remaining >= 1; remaining -= 1) {
      CardLogic.onTurnStart(cardState, 'black', gameState, prng);
      expect(findProliferationMarker(cardState, 4, 4)).toEqual(expect.objectContaining({
        data: expect.objectContaining({ remainingOwnerTurns: remaining })
      }));
    }

    CardLogic.flushPresentationEvents(cardState);
    CardLogic.onTurnStart(cardState, 'black', gameState, prng);

    expect(gameState.board[4][4]).toBe(Shared.BLACK);
    expect(findProliferationMarker(cardState, 4, 4)).toBeFalsy();
    expect(CardLogic.flushPresentationEvents(cardState)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'STATUS_REMOVED',
        row: 4,
        col: 4,
        reason: 'duration_end',
        meta: expect.objectContaining({
          special: 'PROLIFERATION',
          owner: 'black',
          reason: 'duration_end'
        })
      })
    ]));
  });

  test('破壊対象になると元の石を残したまま隣接空きへ1個増殖する', () => {
    const { cardState, gameState, prng } = createState([0]);

    for (let row = 2; row <= 4; row++) {
      for (let col = 2; col <= 4; col++) {
        gameState.board[row][col] = Shared.WHITE;
      }
    }
    gameState.board[3][3] = Shared.BLACK;
    gameState.board[2][2] = Shared.EMPTY;
    gameState.board[2][4] = Shared.BLACK;
    cardState.markers.push({
      id: 1101,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'PROLIFERATION' }
    });

    const out = BoardOps.destroyAt(
      cardState,
      gameState,
      3,
      3,
      'DESTROY_ONE_STONE',
      'destroy_one_stone',
      { randomSource: prng }
    );

    expect(out).toMatchObject({
      kind: 'proliferated',
      destroyed: false,
      proliferated: true,
      reason: 'proliferation_triggered',
      from: { row: 3, col: 3 },
      to: { row: 2, col: 2 }
    });
    expect(gameState.board[3][3]).toBe(Shared.BLACK);
    expect(gameState.board[2][2]).toBe(Shared.BLACK);
    expect(gameState.board[2][3]).toBe(Shared.BLACK);
    expect(findProliferationMarker(cardState, 3, 3)).toBeTruthy();
    expect(findProliferationMarker(cardState, 2, 2)).toBeTruthy();

    const presentationEvents = CardLogic.flushPresentationEvents(cardState) || [];
    const destroyEvent = presentationEvents.find((event) => (
      event &&
      event.type === 'DESTROY' &&
      event.row === 3 &&
      event.col === 3
    ));
    const spawnEvent = presentationEvents.find((event) => (
      event &&
      event.type === 'SPAWN' &&
      event.row === 2 &&
      event.col === 2
    ));
    expect(destroyEvent).toBeTruthy();
    expect(destroyEvent.meta).toEqual(expect.objectContaining({
      special: 'PROLIFERATION',
      owner: 'black',
      proliferated: true,
      proliferationOriginRow: 3,
      proliferationOriginCol: 3,
      proliferationDestinationRow: 2,
      proliferationDestinationCol: 2
    }));
    expect(spawnEvent).toBeTruthy();
    expect(spawnEvent.meta).toEqual(expect.objectContaining({
      special: 'PROLIFERATION',
      owner: 'black',
      proliferationOriginRow: 3,
      proliferationOriginCol: 3
    }));
    expect(presentationEvents.indexOf(destroyEvent)).toBeLessThan(presentationEvents.indexOf(spawnEvent));
  });

  test('turn pipeline 経由の増殖反転は生成石の持ち主に布石を入れる', () => {
    const { cardState, gameState, prng } = createState([0]);

    gameState.currentPlayer = Shared.WHITE;
    gameState.turnNumber = 4;
    cardState.charge.black = 0;
    cardState.charge.white = 0;
    cardState.chargeGainedTotal.black = 0;
    cardState.chargeGainedTotal.white = 0;

    for (let row = 2; row <= 4; row++) {
      for (let col = 2; col <= 4; col++) {
        gameState.board[row][col] = Shared.WHITE;
      }
    }
    gameState.board[3][3] = Shared.BLACK;
    gameState.board[2][2] = Shared.EMPTY;
    gameState.board[2][4] = Shared.BLACK;
    cardState.markers.push({
      id: 1102,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'PROLIFERATION' }
    });
    cardState.pendingEffectByPlayer.white = {
      type: 'DESTROY_ONE_STONE',
      stage: 'selectTarget',
      cardId: 'destroy_one_stone_01'
    };

    const result = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'white',
      { type: 'place', destroyTarget: { row: 3, col: 3 } },
      prng,
      { skipTurnStart: true }
    );

    expect(result.gameState.board[2][2]).toBe(Shared.BLACK);
    expect(result.gameState.board[2][3]).toBe(Shared.BLACK);
    expect(result.cardState.charge.black).toBe(1);
    expect(result.cardState.chargeGainedTotal.black).toBe(1);
    expect(result.cardState.charge.white).toBe(0);
  });

  test('周囲に空きが無い時は最も近い空きへ増殖する', () => {
    const { cardState, gameState, prng } = createState([0]);

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        gameState.board[row][col] = Shared.WHITE;
      }
    }
    gameState.board[3][3] = Shared.BLACK;
    gameState.board[1][6] = Shared.EMPTY;
    gameState.board[6][1] = Shared.EMPTY;
    cardState.markers.push({
      id: 1151,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'PROLIFERATION' }
    });

    const out = BoardOps.destroyAt(cardState, gameState, 3, 3, 'SYSTEM', 'nearest_empty_destroy', { randomSource: prng });

    expect(out).toMatchObject({
      kind: 'proliferated',
      destroyed: false,
      proliferated: true,
      from: { row: 3, col: 3 },
      to: { row: 1, col: 6 }
    });
    expect(gameState.board[3][3]).toBe(Shared.BLACK);
    expect(gameState.board[1][6]).toBe(Shared.BLACK);
    expect(gameState.board[6][1]).toBe(Shared.EMPTY);

    const presentationEvents = CardLogic.flushPresentationEvents(cardState) || [];
    const destroyEvent = presentationEvents.find((event) => event && event.type === 'DESTROY' && event.row === 3 && event.col === 3);
    const spawnEvent = presentationEvents.find((event) => event && event.type === 'SPAWN' && event.row === 1 && event.col === 6);
    expect(destroyEvent && destroyEvent.meta).toEqual(expect.objectContaining({
      proliferationDestinationRow: 1,
      proliferationDestinationCol: 6
    }));
    expect(spawnEvent && spawnEvent.meta).toEqual(expect.objectContaining({
      proliferationOriginRow: 3,
      proliferationOriginCol: 3
    }));
  });

  test('盤面形状の単一列挙で拡張空きマスを選び、拡張上の穴は候補にしない', () => {
    const { cardState, gameState, prng } = createState([0]);

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        gameState.board[row][col] = Shared.WHITE;
      }
    }
    gameState.board[3][7] = Shared.BLACK;
    (gameState as any).boardExpansion = {
      active: false,
      side: null,
      row: null,
      owner: Shared.EMPTY,
      usedByPlayer: { black: true, white: false },
      cells: [
        { side: 'right', row: 3, col: 8, owner: Shared.EMPTY },
        { side: 'right', row: 4, col: 8, owner: Shared.EMPTY }
      ]
    };
    cardState.markers.push(
      {
        id: 1161,
        kind: 'specialStone',
        row: 3,
        col: 7,
        owner: 'black',
        data: { type: 'PROLIFERATION' }
      },
      {
        id: 1162,
        kind: 'specialStone',
        row: 4,
        col: 8,
        owner: 'black',
        data: { type: 'METEOR_HOLE' }
      }
    );

    const out = BoardOps.destroyAt(
      cardState,
      gameState,
      3,
      7,
      'SYSTEM',
      'expansion_candidate_destroy',
      { randomSource: prng }
    );

    expect(out).toMatchObject({
      kind: 'proliferated',
      proliferated: true,
      to: { row: 3, col: 8 }
    });
    expect((gameState as any).boardExpansion.cells.find((cell) => cell.row === 3 && cell.col === 8).owner).toBe(Shared.BLACK);
    expect((gameState as any).boardExpansion.cells.find((cell) => cell.row === 4 && cell.col === 8).owner).toBe(Shared.EMPTY);
  });

  test('最短距離の空きが複数ある時はランダムで1マス選ぶ', () => {
    const first = createState([0]);

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        first.gameState.board[row][col] = Shared.WHITE;
      }
    }
    first.gameState.board[3][3] = Shared.BLACK;
    first.gameState.board[1][3] = Shared.EMPTY;
    first.gameState.board[3][5] = Shared.EMPTY;
    first.cardState.markers.push({
      id: 1171,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'PROLIFERATION' }
    });

    const firstOut = BoardOps.destroyAt(first.cardState, first.gameState, 3, 3, 'SYSTEM', 'equal_distance_first', { randomSource: first.prng });
    expect(firstOut.to).toEqual({ row: 1, col: 3 });

    const second = createState([0.99]);

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        second.gameState.board[row][col] = Shared.WHITE;
      }
    }
    second.gameState.board[3][3] = Shared.BLACK;
    second.gameState.board[1][3] = Shared.EMPTY;
    second.gameState.board[3][5] = Shared.EMPTY;
    second.cardState.markers.push({
      id: 1172,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'PROLIFERATION' }
    });

    const secondOut = BoardOps.destroyAt(second.cardState, second.gameState, 3, 3, 'SYSTEM', 'equal_distance_second', { randomSource: second.prng });
    expect(secondOut.to).toEqual({ row: 3, col: 5 });
  });

  test('増殖して生まれた石も後続の破壊で再度増殖する', () => {
    const { cardState, gameState, prng } = createState([0, 0]);

    for (let row = 1; row <= 3; row++) {
      for (let col = 1; col <= 3; col++) {
        gameState.board[row][col] = Shared.WHITE;
      }
    }
    gameState.board[2][2] = Shared.BLACK;
    gameState.board[1][1] = Shared.EMPTY;
    cardState.markers.push({
      id: 1201,
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'black',
      data: { type: 'PROLIFERATION', remainingOwnerTurns: 1 }
    });

    const first = BoardOps.destroyAt(cardState, gameState, 2, 2, 'SYSTEM', 'first_destroy', { randomSource: prng });
    expect(first.proliferated).toBe(true);
    expect(gameState.board[1][1]).toBe(Shared.BLACK);
    expect(findProliferationMarker(cardState, 2, 2)?.data.remainingOwnerTurns).toBe(1);
    expect(findProliferationMarker(cardState, 1, 1)).toEqual(expect.objectContaining({
      data: expect.objectContaining({ remainingOwnerTurns: PROLIFERATION_DURATION })
    }));

    for (let row = 0; row <= 2; row++) {
      for (let col = 0; col <= 2; col++) {
        if (row === 1 && col === 1) continue;
        gameState.board[row][col] = Shared.WHITE;
      }
    }
    gameState.board[0][0] = Shared.EMPTY;
    gameState.board[1][1] = Shared.BLACK;
    gameState.board[2][2] = Shared.BLACK;

    const second = BoardOps.destroyAt(cardState, gameState, 1, 1, 'SYSTEM', 'second_destroy', { randomSource: prng });

    expect(second).toMatchObject({
      kind: 'proliferated',
      destroyed: false,
      proliferated: true,
      to: { row: 0, col: 0 }
    });
    expect(gameState.board[1][1]).toBe(Shared.BLACK);
    expect(gameState.board[0][0]).toBe(Shared.BLACK);
    expect(findProliferationMarker(cardState, 0, 0)).toBeTruthy();
  });

  test('破壊の意志の破壊対象になっても selection は成立し、pending を消費して増殖する', () => {
    const { cardState, gameState, prng } = createState([0]);

    for (let row = 2; row <= 4; row++) {
      for (let col = 2; col <= 4; col++) {
        gameState.board[row][col] = Shared.WHITE;
      }
    }
    gameState.board[3][3] = Shared.BLACK;
    gameState.board[2][2] = Shared.EMPTY;
    cardState.markers.push({
      id: 1251,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'PROLIFERATION' }
    });
    cardState.pendingEffectByPlayer.black = {
      type: 'DESTROY_ONE_STONE',
      stage: 'selectTarget',
      cardId: 'destroy_one_stone_01'
    };

    const detailed = CardLogic.applyDestroyEffectDetailed(cardState, gameState, 'black', 3, 3);

    expect(detailed).toMatchObject({
      kind: 'proliferated',
      destroyed: false,
      proliferated: true,
      reason: 'proliferation_triggered',
      to: { row: 2, col: 2 }
    });
    expect(cardState.pendingEffectByPlayer.black).toBeNull();

    const second = createState([0]);
    second.gameState.board[3][3] = Shared.BLACK;
    second.gameState.board[2][2] = Shared.EMPTY;
    second.cardState.markers.push({
      id: 1252,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'PROLIFERATION' }
    });
    second.cardState.pendingEffectByPlayer.black = {
      type: 'DESTROY_ONE_STONE',
      stage: 'selectTarget',
      cardId: 'destroy_one_stone_01'
    };

    expect(CardLogic.applyDestroyEffect(second.cardState, second.gameState, 'black', 3, 3)).toBe(true);
    expect(second.cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('盤面全体に空きが無い時は通常どおり破壊される', () => {
    const { cardState, gameState } = createState();

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        gameState.board[row][col] = Shared.BLACK;
      }
    }
    cardState.markers.push({
      id: 1301,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'PROLIFERATION' }
    });

    const out = BoardOps.destroyAt(cardState, gameState, 4, 4, 'SYSTEM', 'no_space_destroy');

    expect(out.destroyed).toBe(true);
    expect(out.kind).toBe('destroyed');
    expect(out.proliferated).toBe(false);
    expect(gameState.board[4][4]).toBe(Shared.EMPTY);
    expect(findProliferationMarker(cardState, 4, 4)).toBeFalsy();
  });

  test('通常反転されると増殖状態を失って相手色の通常石になる', () => {
    const { cardState, gameState } = createState();

    gameState.board[4][4] = Shared.BLACK;
    cardState.markers.push({
      id: 1401,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'PROLIFERATION' }
    });

    const out = BoardOps.changeAt(cardState, gameState, 4, 4, 'white', 'SYSTEM', 'standard_flip');

    expect(out.changed).toBe(true);
    expect(gameState.board[4][4]).toBe(Shared.WHITE);
    expect(findProliferationMarker(cardState, 4, 4)).toBeFalsy();

    const changeEvent = (cardState._presentationEventsPersist || []).find((event) => (
      event &&
      event.type === 'CHANGE' &&
      event.row === 4 &&
      event.col === 4
    ));
    expect(changeEvent).toBeTruthy();
    expect(changeEvent.meta && changeEvent.meta.special).toBeUndefined();
  });

  test('proliferation spawn presentation is adapted into clone-like playback and sound cue', () => {
    const { cardState, gameState, prng } = createState([0]);

    gameState.board[3][3] = Shared.BLACK;
    gameState.board[2][2] = Shared.EMPTY;
    cardState.markers.push({
      id: 1451,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'PROLIFERATION' }
    });
    cardState.pendingEffectByPlayer.black = {
      type: 'DESTROY_ONE_STONE',
      stage: 'selectTarget',
      cardId: 'destroy_one_stone_01'
    };

    const result = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 0, col: 0, destroyTarget: { row: 3, col: 3 } },
      prng
    );

    const destroySelected = (result.events || []).find((event) => event && event.type === 'destroy_selected');
    expect(destroySelected).toMatchObject({
      applied: true,
      kind: 'proliferated',
      destroyed: false,
      proliferated: true
    });

    const speechBubbles = (result.presentationEvents || []).filter((event) => (
      event &&
      event.type === 'SPECIAL_STONE_BUBBLE' &&
      event.special === 'PROLIFERATION'
    ));
    expect(speechBubbles).toEqual(expect.arrayContaining([
      expect.objectContaining({
        row: 3,
        col: 3,
        scenario: 'proliferation_triggered'
      })
    ]));
    expect(speechBubbles.some((event) => event.row === 3 && event.col === 3 && event.scenario === 'destroy')).toBe(false);

    const playbackEvents = TurnPipelineUIAdapter.appendSoundEffectPlaybackEvents(
      TurnPipelineUIAdapter.normalizePlaybackEvents(
        TurnPipelineUIAdapter.mapToPlaybackEvents(
          result.presentationEvents || [],
          result.cardState,
          result.gameState
        )
      ),
      result.events || [],
      result.presentationEvents || []
    );

    const playbackDestroy = playbackEvents.find((event) => (
      event &&
      event.type === 'destroy' &&
      Array.isArray(event.targets) &&
      event.targets.some((target) => (
        target &&
        target.r === 3 &&
        target.col === 3 &&
        target.meta &&
        target.meta.proliferated === true
      ))
    ));
    expect(playbackDestroy).toBeTruthy();

    const playbackMove = playbackEvents.find((event) => (
      event &&
      event.type === 'move' &&
      Array.isArray(event.targets) &&
      event.targets.some((target) => target && target.cause === 'PROLIFERATION_WILL' && target.clone === true)
    ));
    expect(playbackMove).toBeTruthy();
    expect(playbackDestroy.phase).toBeLessThan(playbackMove.phase);

    const soundCue = playbackEvents.find((event) => (
      event &&
      event.type === 'sound_effect' &&
      Array.isArray(event.targets) &&
      event.targets.some((target) => target && target.soundKey === 'clone_spawn')
    ));
    expect(soundCue).toBeTruthy();
    expectNoGeneratedSpawnFlipTransientState(result.cardState);
  });

  test('DESTROY_ONE_STONE on a proliferation stone consumes pending and keeps the same placement turn', () => {
    const { cardState, gameState, prng } = createState([0]);

    gameState.currentPlayer = Shared.WHITE;
    gameState.turnNumber = 7;
    gameState.board[2][3] = Shared.BLACK;
    gameState.board[2][4] = Shared.EMPTY;
    cardState.markers.push({
      id: 1501,
      kind: 'specialStone',
      row: 2,
      col: 3,
      owner: 'black',
      data: { type: 'PROLIFERATION', remainingOwnerTurns: PROLIFERATION_DURATION }
    });
    cardState.pendingEffectByPlayer.white = {
      type: 'DESTROY_ONE_STONE',
      stage: 'selectTarget',
      cardId: 'destroy_01'
    };

    const result = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'white',
      { type: 'place', destroyTarget: { row: 2, col: 3 } },
      prng,
      { skipTurnStart: true }
    );

    const destroySelected = (result.events || []).find((event) => event && event.type === 'destroy_selected');
    expect(destroySelected).toMatchObject({
      applied: true,
      kind: 'proliferated',
      proliferated: true,
      from: { row: 2, col: 3 }
    });
    expect(destroySelected.to).toEqual(expect.objectContaining({
      row: expect.any(Number),
      col: expect.any(Number)
    }));
    expect(
      Math.max(
        Math.abs(destroySelected.to.row - 2),
        Math.abs(destroySelected.to.col - 3)
      )
    ).toBeLessThanOrEqual(1);
    expect(result.gameState.currentPlayer).toBe(Shared.WHITE);
    expect(result.gameState.turnNumber).toBe(7);
    expect(result.cardState.pendingEffectByPlayer.white).toBeNull();
    expect(result.gameState.board[2][3]).toBe(Shared.BLACK);
    expect(result.gameState.board[destroySelected.to.row][destroySelected.to.col]).toBe(Shared.BLACK);
    expect(findProliferationMarker(result.cardState, 2, 3)).toBeTruthy();
    expect(findProliferationMarker(result.cardState, destroySelected.to.row, destroySelected.to.col)).toBeTruthy();
  });
});
