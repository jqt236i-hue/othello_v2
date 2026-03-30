const Shared = require('../shared-constants');
const CardLogic = require('../game/logic/cards');
const BoardOps = require('../game/logic/board_ops');
const TurnPipeline = require('../game/turn/turn_pipeline');
const TurnPipelineUIAdapter = require('../game/turn/pipeline_ui_adapter');

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

  test('破壊神の破壊対象になっても selection は成立し、pending を消費して増殖する', () => {
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

  test('周囲に空きが無い時は通常どおり破壊される', () => {
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
  });
});
