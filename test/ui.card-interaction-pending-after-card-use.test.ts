import * as fs from 'fs';
import * as path from 'path';
import * as SharedConstants from '../shared-constants.js';

const CardLogic = require('../game/logic/cards.js');
const TurnPipeline = require('../game/turn/turn_pipeline.js');
const PipelineUIAdapter = require('../game/turn/pipeline_ui_adapter.js');
const PendingCoordinator = require('../game/turn/pending-coordinator.js');

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

function runTeleportUse(cardState: any, gameState: any) {
  cardState.hands.white = ['teleport_01'];
  cardState.charge.white = 99;
  return PipelineUIAdapter.runTurnWithAdapter(
    cardState,
    gameState,
    'white',
    { type: 'use_card', useCardId: 'teleport_01', useCardOwnerKey: 'white' },
    TurnPipeline
  );
}

describe('card use → board target selection: pending は pipeline の結果だけに従う', () => {
  afterEach(() => {
    PendingCoordinator.clearPendingSelectionActionCache();
  });

  test('犠牲の意志で無効化されたテレポートは pending を残さず、対象選択は成立しない', () => {
    const cardState = createCardState();
    const gameState = createEmptyGameState();
    addSacrificeStone(cardState, gameState, 'black', 2, 2);
    gameState.board[5][5] = SharedConstants.WHITE;

    const res = runTeleportUse(cardState, gameState);

    expect(res.ok).not.toBe(false);
    const nextCardState = res.nextCardState || cardState;
    const nextGameState = res.nextGameState || gameState;
    expect(nextCardState.hands.white).toEqual([]);
    expect(nextCardState.discard).toContain('teleport_01');
    expect(nextCardState.pendingEffectByPlayer.white).toBeNull();
    expect(nextGameState.board[2][2]).toBe(SharedConstants.EMPTY);
    expect(res.playbackEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'card_use_animation',
        targets: [expect.objectContaining({ cardId: 'teleport_01', nullifiedBySacrificeWill: true })]
      })
    ]));

    expect(CardLogic.applyTeleportWill(nextCardState, nextGameState, 'white', 5, 5, createPrng())).toMatchObject({
      applied: false,
      reason: 'not_pending'
    });
  });

  test('通常のテレポート使用は pipeline が対象選択の pending を残す', () => {
    const cardState = createCardState();
    const gameState = createEmptyGameState();
    gameState.board[5][5] = SharedConstants.WHITE;

    const res = runTeleportUse(cardState, gameState);

    expect(res.ok).not.toBe(false);
    const nextCardState = res.nextCardState || cardState;
    expect(nextCardState.pendingEffectByPlayer.white).toMatchObject({ type: 'TELEPORT_WILL', stage: 'selectTarget' });
    expect(res.playbackEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'card_use_animation',
        targets: [expect.objectContaining({ cardId: 'teleport_01', nullifiedBySacrificeWill: false })]
      })
    ]));
  });

  test('card UI は pending を作り直さず、pipeline の結果にある pending だけを同期する', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'cards', 'card-interaction.ts'), 'utf8');
    const fnStart = source.indexOf('function _ensureBoardPendingSelectionAfterCardUse(');
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = source.slice(fnStart, source.indexOf('\n}\n', fnStart));
    expect(fnBody).not.toContain('createPendingEffectState(');
    expect(fnBody).toContain("nextPending && nextPending.stage === 'selectTarget' ? nextPending : null");
    expect(source).not.toContain('createPendingEffectState(');
  });
});
