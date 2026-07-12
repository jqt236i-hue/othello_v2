import * as SharedConstants from '../shared-constants.js';
const Core = require('../game/logic/core.js');
const CardLogic = require('../game/logic/cards.js');
const BoardOps = require('../game/logic/board_ops.js');
const TurnPipeline = require('../game/turn/turn_pipeline.js');
const TurnPipelinePhases = require('../game/turn/turn_pipeline_phases.js');
const TurnPresentationHelpers = require('../game/turn/presentation-helpers.js');
const SpeechCatalog = require('../game/turn/turn_pipeline_phase_helpers.js');
const CORE_API = { BLACK: SharedConstants.BLACK, WHITE: SharedConstants.WHITE };

function createPrng(randomValue = 0) {
  return {
    shuffle: (arr) => arr,
    random: () => randomValue
  };
}

function createEmptyGameState() {
  const gameState = Core.createGameState();
  gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
  gameState.currentPlayer = Core.BLACK;
  gameState.turnNumber = 1;
  gameState.consecutivePasses = 0;
  return gameState;
}

function getCardDef(type) {
  return (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === type);
}

function getSpecialStoneBubbles(presentationEvents) {
  return (presentationEvents || []).filter((event) => event && event.type === 'SPECIAL_STONE_BUBBLE');
}

describe('special stone speech rollout', () => {
  test('ghost placement emits a generic place speech bubble', () => {
    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    const def = getCardDef('GHOST_WILL');

    cardState.debugNoDraw = true;
    cardState.hands.black = [def.id];
    cardState.charge.black = def.cost;

    gameState.board[2][4] = Core.WHITE;
    gameState.board[2][5] = Core.BLACK;
    gameState.board[2][6] = Core.WHITE;

    TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'use_card', useCardId: def.id, useCardOwnerKey: 'black' },
      prng,
      { skipTurnStart: true }
    );

    const placeRes = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 2, col: 3 },
      prng,
      { skipTurnStart: true }
    );

    expect(getSpecialStoneBubbles(placeRes.presentationEvents)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        special: 'GHOST',
        scenario: 'place',
        row: 2,
        col: 3
      })
    ]));
  });

  test('ghost-protected flip emits a ghost_protected speech bubble', () => {
    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    gameState.currentPlayer = Core.WHITE;

    gameState.board[2][3] = Core.BLACK;
    gameState.board[2][4] = Core.BLACK;
    gameState.board[2][5] = Core.BLACK;
    gameState.board[2][6] = Core.WHITE;
    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 2,
      col: 3,
      owner: 'black',
      data: { type: 'GHOST', remainingOwnerTurns: 5 }
    });

    const res = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'white',
      { type: 'place', row: 2, col: 2 },
      prng,
      { skipTurnStart: true }
    );

    expect(getSpecialStoneBubbles(res.presentationEvents)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        special: 'GHOST',
        scenario: 'ghost_protected',
        row: 2,
        col: 3
      })
    ]));
  });

  test('time stop activation emits a time_stop_triggered speech bubble', () => {
    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    const events = [];

    cardState.debugNoDraw = true;
    gameState.board[3][3] = Core.BLACK;
    cardState.markers.push({
      id: 9101,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'TIME_STOP', remainingOwnerTurns: 1 }
    });

    TurnPipelinePhases.applyTurnStartPhase(CardLogic, CORE_API, cardState, gameState, 'black', events, prng);

    expect(getSpecialStoneBubbles(CardLogic.flushPresentationEvents(cardState))).toEqual(expect.arrayContaining([
      expect.objectContaining({
        special: 'TIME_STOP',
        scenario: 'time_stop_triggered',
        row: 3,
        col: 3
      })
    ]));
  });

  test('time-stop deity activation keeps its own scenario', () => {
    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    gameState.board[3][3] = Core.BLACK;
    cardState.markers.push({
      id: 9102, kind: 'specialStone', row: 3, col: 3, owner: 'black',
      data: { type: 'TIME_STOP_DEITY', remainingOwnerTurns: 1 }
    });

    TurnPipelinePhases.applyTurnStartPhase(CardLogic, CORE_API, cardState, gameState, 'black', [], prng);

    expect(getSpecialStoneBubbles(CardLogic.flushPresentationEvents(cardState))).toEqual(expect.arrayContaining([
      expect.objectContaining({ special: 'TIME_STOP_DEITY', scenario: 'time_stop_deity_triggered', row: 3, col: 3 })
    ]));
  });

  test('zombie infection speaks once from the source cell', () => {
    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    gameState.board[1][1] = Core.BLACK;
    gameState.board[1][2] = Core.WHITE;
    cardState.markers.push({
      id: 9201, kind: 'specialStone', row: 1, col: 1, owner: 'black', createdSeq: 1,
      data: { type: 'ZOMBIE', ownerColor: Core.BLACK, turnsUntilInfection: 1, regenRemaining: 1 }
    });

    TurnPipelinePhases.applyTurnStartPhase(CardLogic, CORE_API, cardState, gameState, 'black', [], prng);

    const bubbles = getSpecialStoneBubbles(CardLogic.flushPresentationEvents(cardState));
    expect(bubbles.filter((event) => event.scenario === 'zombie_infection')).toEqual([
      expect.objectContaining({ special: 'ZOMBIE', row: 1, col: 1 })
    ]);
    expect(bubbles.some((event) => event.scenario === 'place' && event.row === 1 && event.col === 2)).toBe(false);
  });

  test('regen revival emits regen_triggered without an extra destroy bubble', () => {
    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    gameState.currentPlayer = Core.WHITE;

    gameState.board[2][3] = Core.BLACK;
    gameState.board[2][4] = Core.BLACK;
    gameState.board[2][5] = Core.BLACK;
    gameState.board[2][6] = Core.WHITE;
    cardState.markers.push({
      id: 41,
      kind: 'specialStone',
      row: 2,
      col: 3,
      owner: 'black',
      data: { type: 'REGEN', remainingOwnerTurns: 3, regenRemaining: 1 }
    });

    const res = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'white',
      { type: 'place', row: 2, col: 2 },
      prng,
      { skipTurnStart: true }
    );

    const regenBubbles = getSpecialStoneBubbles(res.presentationEvents).filter((event) => (
      event.special === 'REGEN' &&
      event.row === 2 &&
      event.col === 3
    ));

    expect(regenBubbles).toEqual(expect.arrayContaining([
      expect.objectContaining({
        special: 'REGEN',
        scenario: 'regen_triggered',
        row: 2,
        col: 3
      })
    ]));
    expect(regenBubbles.some((event) => event.scenario === 'destroy' || event.scenario === 'duration_end')).toBe(false);
  });

  test.each([
    ['STONE_SALVATION_GOD', 'STONE_SALVATION_GOD'],
    ['METEOR_GOD', 'METEOR_GOD'],
    ['AFTERIMAGE_WILL', 'AFTERIMAGE_WILL'],
    ['PERMA_PROTECT_NEXT_STONE', 'PERMA_PROTECTED'],
    ['ZOMBIE_WILL', 'ZOMBIE'],
    ['WORK_WILL', 'WORK']
  ])('%s placement emits a generic place speech bubble', (cardType, specialType) => {
    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    const def = getCardDef(cardType);

    cardState.debugNoDraw = true;
    cardState.hands.black = [def.id];
    cardState.charge.black = def.cost;

    gameState.board[2][4] = Core.WHITE;
    gameState.board[2][5] = Core.BLACK;
    gameState.board[2][6] = Core.WHITE;

    TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'use_card', useCardId: def.id, useCardOwnerKey: 'black' },
      prng,
      { skipTurnStart: true }
    );

    const placeRes = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 2, col: 3 },
      prng,
      { skipTurnStart: true }
    );

    expect(getSpecialStoneBubbles(placeRes.presentationEvents)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        special: specialType,
        scenario: 'place',
        row: 2,
        col: 3
      })
    ]));
  });

  test('zombie revival emits zombie_revived without an extra destroy bubble', () => {
    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    gameState.currentPlayer = Core.WHITE;
    gameState.board[2][3] = Core.BLACK;
    gameState.board[2][4] = Core.BLACK;
    gameState.board[2][5] = Core.BLACK;
    gameState.board[2][6] = Core.WHITE;
    cardState.markers.push({
      id: 42, kind: 'specialStone', row: 2, col: 3, owner: 'black',
      data: { type: 'ZOMBIE', ownerColor: Core.BLACK, turnsUntilInfection: 2, regenRemaining: 1 }
    });

    const res = TurnPipeline.applyTurn(
      cardState, gameState, 'white', { type: 'place', row: 2, col: 2 }, prng, { skipTurnStart: true }
    );
    const bubbles = getSpecialStoneBubbles(res.presentationEvents).filter((event) => (
      event.special === 'ZOMBIE' && event.row === 2 && event.col === 3
    ));

    expect(bubbles).toEqual([expect.objectContaining({ scenario: 'zombie_revived' })]);
  });

  test('no-candidate robot reversion is classified as normal_revert', () => {
    const removal = {
      type: 'STATUS_REMOVED', row: 3, col: 3, player: 'black', special: 'ROBOT_VACUUM',
      reason: 'no_candidates_revert', meta: { special: 'ROBOT_VACUUM', reason: 'no_candidates_revert' }
    };
    const cardState: any = { markers: [], presentationEvents: [removal] };
    const emitter = { emitPresentationEvent: (_state, event) => cardState.presentationEvents.push(event) };
    const deps = {
      CardUtilsModule: null,
      OwnerHelpersModule: { normalizePlayerKeyOptional: (value) => value },
      MarkersAdapter: { getMarkers: (state) => state.markers },
      MARKER_KINDS: { SPECIAL_STONE: 'specialStone' },
      getSpecialStoneBubbleSpeechLines: SpeechCatalog.getSpecialStoneBubbleSpeechLines,
      pickSpecialStoneBubbleSpeechLine: SpeechCatalog.pickSpecialStoneBubbleSpeechLine,
      resolveWorkIncomeLine: SpeechCatalog.resolveWorkIncomeLine
    };

    TurnPresentationHelpers.emitSpecialStoneBubblesFromPhase(emitter, cardState, {
      presentationEvents: [removal], events: [], beforeSnapshot: [], prng: createPrng(0), fallbackPlayer: 'black'
    }, deps);

    expect(getSpecialStoneBubbles(cardState.presentationEvents)).toEqual([
      expect.objectContaining({ special: 'ROBOT_VACUUM', scenario: 'normal_revert', row: 3, col: 3 })
    ]);
  });
});

