import * as fs from 'fs';
import * as path from 'path';
import * as SharedConstants from '../shared-constants.js';

const CardLogic = require('../game/logic/cards.js');
const TurnPipeline = require('../game/turn/turn_pipeline.js');
const PipelineUIAdapter = require('../game/turn/pipeline_ui_adapter.js');
const PendingCoordinator = require('../game/turn/pending-coordinator.js');
const CardUseOutcome = require('../cards/card-interaction-card-use-outcome');

function createPrng(randomValue = 0) {
  return {
    random: () => randomValue,
    shuffle: (arr: any[]) => arr
  };
}

function createEmptyGameState() {
  return {
    board: Array.from({ length: 8 }, () => Array(8).fill(SharedConstants.EMPTY)),
    currentPlayer: SharedConstants.WHITE,
    turnNumber: 7,
    consecutivePasses: 0
  };
}

function createCardState() {
  const cardState = CardLogic.createCardState(createPrng());
  cardState.debugNoDraw = true;
  cardState.presentationEvents = [];
  return cardState;
}

function addSacrificeStone(cardState: any, gameState: any, owner = 'black', row = 2, col = 2) {
  gameState.board[row][col] = owner === 'black' ? SharedConstants.BLACK : SharedConstants.WHITE;
  cardState.markers.push({
    id: 20,
    kind: 'specialStone',
    row,
    col,
    owner,
    createdSeq: 10,
    data: { type: 'SACRIFICE', remainingOwnerTurns: 5 }
  });
}

describe('card use outcome: 犠牲の意志 nullification detection', () => {
  afterEach(() => {
    PendingCoordinator.clearPendingSelectionActionCache();
  });

  test('detects nullified card use from playback events for the matching owner and card', () => {
    const playbackEvents = [
      { type: 'log', targets: [] },
      {
        type: 'card_use_animation',
        targets: [{ player: 'white', owner: 'white', cardId: 'teleport_01', nullifiedBySacrificeWill: true }]
      }
    ];

    expect(CardUseOutcome.isCardUseNullifiedBySacrificeWill({
      playbackEvents,
      ownerKey: 'white',
      cardId: 'teleport_01'
    })).toBe(true);
    expect(CardUseOutcome.isCardUseNullifiedBySacrificeWill({
      playbackEvents,
      ownerKey: 'black',
      cardId: 'teleport_01'
    })).toBe(false);
    expect(CardUseOutcome.isCardUseNullifiedBySacrificeWill({
      playbackEvents,
      ownerKey: 'white',
      cardId: 'destroy_01'
    })).toBe(false);
  });

  test('normal card use playback is not treated as nullified', () => {
    expect(CardUseOutcome.isCardUseNullifiedBySacrificeWill({
      playbackEvents: [
        { type: 'card_use_animation', targets: [{ player: 'white', owner: 'white', cardId: 'teleport_01' }] }
      ],
      nextCardState: { presentationEvents: [{ type: 'CARD_USED', player: 'white', cardId: 'teleport_01', meta: {} }] },
      ownerKey: 'white',
      cardId: 'teleport_01'
    })).toBe(false);
    expect(CardUseOutcome.isCardUseNullifiedBySacrificeWill()).toBe(false);
  });

  test('falls back to CARD_USED presentation events kept on the next card state', () => {
    expect(CardUseOutcome.isCardUseNullifiedBySacrificeWill({
      playbackEvents: [],
      nextCardState: {
        _presentationEventsPersist: [
          { type: 'CARD_USED', player: 'white', cardId: 'teleport_01', meta: { owner: 'white', nullifiedBySacrificeWill: true } }
        ]
      },
      ownerKey: 'white',
      cardId: 'teleport_01'
    })).toBe(true);
  });

  test('テレポートが犠牲の意志で無効化された run result は pending を持たず、無効化として検出される', () => {
    const cardState = createCardState();
    const gameState = createEmptyGameState();
    addSacrificeStone(cardState, gameState, 'black', 2, 2);
    gameState.board[5][5] = SharedConstants.WHITE;

    cardState.hands.white = ['teleport_01'];
    cardState.charge.white = 99;

    const res = PipelineUIAdapter.runTurnWithAdapter(
      cardState,
      gameState,
      'white',
      { type: 'use_card', useCardId: 'teleport_01', useCardOwnerKey: 'white' },
      TurnPipeline
    );

    expect(res.ok).not.toBe(false);
    const nextCardState = res.nextCardState || cardState;
    const nextGameState = res.nextGameState || gameState;
    expect(nextCardState.hands.white).toEqual([]);
    expect(nextCardState.pendingEffectByPlayer.white).toBeNull();
    expect(nextGameState.board[2][2]).toBe(SharedConstants.EMPTY);

    const nullified = CardUseOutcome.isCardUseNullifiedBySacrificeWill({
      playbackEvents: res.playbackEvents,
      nextCardState,
      ownerKey: 'white',
      cardId: 'teleport_01'
    });
    expect(nullified).toBe(true);

    // A selection would not be honoured by the headless logic either.
    expect(CardLogic.applyTeleportWill(nextCardState, nextGameState, 'white', 5, 5, createPrng())).toMatchObject({
      applied: false,
      reason: 'not_pending'
    });
  });

  test('テレポートが通常どおり使えた run result は無効化として検出されない', () => {
    const cardState = createCardState();
    const gameState = createEmptyGameState();
    gameState.board[5][5] = SharedConstants.WHITE;

    cardState.hands.white = ['teleport_01'];
    cardState.charge.white = 99;

    const res = PipelineUIAdapter.runTurnWithAdapter(
      cardState,
      gameState,
      'white',
      { type: 'use_card', useCardId: 'teleport_01', useCardOwnerKey: 'white' },
      TurnPipeline
    );

    expect(res.ok).not.toBe(false);
    const nextCardState = res.nextCardState || cardState;
    expect(nextCardState.pendingEffectByPlayer.white).toMatchObject({ type: 'TELEPORT_WILL', stage: 'selectTarget' });
    expect(CardUseOutcome.isCardUseNullifiedBySacrificeWill({
      playbackEvents: res.playbackEvents,
      nextCardState,
      ownerKey: 'white',
      cardId: 'teleport_01'
    })).toBe(false);
  });

  test('card UI consults the nullification outcome before rebuilding a board target selection', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'cards', 'card-interaction.ts'), 'utf8');
    const fnStart = source.indexOf('function _ensureBoardPendingSelectionAfterCardUse(');
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = source.slice(fnStart, source.indexOf('\n}\n', fnStart));
    const gateIndex = fnBody.indexOf('_isCardUseNullifiedBySacrificeWillForRunResult(runResult, normalizedOwnerKey, cardId)');
    const rebuildIndex = fnBody.indexOf('createPendingEffectState(');
    expect(gateIndex).toBeGreaterThan(-1);
    expect(rebuildIndex).toBeGreaterThan(-1);
    expect(gateIndex).toBeLessThan(rebuildIndex);
    expect(source).toContain("requirePath: './card-interaction-card-use-outcome'");
  });
});
