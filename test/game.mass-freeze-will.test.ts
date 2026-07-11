import * as SharedConstants from '../shared-constants.js';
import * as TurnPipeline from '../game/turn/turn_pipeline.js';
import * as CardLogic from '../game/logic/cards.js';
import * as PipelineUIAdapter from '../game/turn/pipeline_ui_adapter.js';

const CARD_DEF = (SharedConstants.CARD_DEFS || []).find((card) => card && card.id === 'mass_freeze_will_01');
const CARD_COST = Number(CARD_DEF && CARD_DEF.cost);

function createPrng() {
  return { shuffle: (values) => values, random: () => 0.5 };
}

function makeState() {
  const cardState = CardLogic.createCardState(createPrng());
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(0)),
    currentPlayer: 1,
    turnNumber: 1,
    consecutivePasses: 0
  };
  cardState.debugNoDraw = true;
  return { cardState, gameState };
}

describe('MASS_FREEZE_WILL（意志の凍結）', () => {
  test('catalog entry has the specified id, type, cost, and display category', () => {
    expect(CARD_DEF).toEqual(expect.objectContaining({
      id: 'mass_freeze_will_01',
      name: '意志の凍結',
      type: 'MASS_FREEZE_WILL',
      cost: 11,
      display_type_ja: '特殊'
    }));
    expect(CARD_COST).toBe(11);
  });

  test('freezes every unique eligible special-stone cell without clearing the remaining hand', () => {
    const { cardState, gameState } = makeState();
    cardState.hands.black = ['mass_freeze_will_01', 'gold_stone'];
    cardState.charge.black = CARD_COST;
    for (const [row, col, value] of [
      [2, 2, 1], [3, 3, -1], [4, 4, -1], [5, 5, 1], [6, 6, -1], [1, 1, 1], [7, 7, 1]
    ]) gameState.board[row][col] = value;

    cardState.markers = [
      { id: 1, kind: 'specialStone', row: 2, col: 2, owner: 'black', data: { type: 'WORK', remainingOwnerTurns: 4 } },
      { id: 2, kind: 'specialStone', row: 3, col: 3, owner: 'white', data: { type: 'GHOST', remainingOwnerTurns: 4 } },
      { id: 3, kind: 'specialStone', row: 4, col: 4, owner: 'white', data: { type: 'TRAP', hidden: true, remainingOwnerTurns: 2 } },
      { id: 4, kind: 'specialStone', row: 5, col: 5, owner: 'black', data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 3 } },
      { id: 5, kind: 'specialStone', row: 6, col: 6, owner: 'white', data: { type: 'GUARD', remainingOwnerTurns: 2 } },
      { id: 6, kind: 'specialStone', row: 6, col: 6, owner: 'white', data: { type: 'WORK', remainingOwnerTurns: 3 } },
      { id: 7, kind: 'specialStone', row: 1, col: 1, owner: 'black', data: { type: 'WORK', remainingOwnerTurns: 2 } },
      { id: 8, kind: 'specialStone', row: 1, col: 1, owner: 'black', data: { type: 'FREEZE', remainingOwnerTurns: 2 } },
      { id: 9, kind: 'specialStone', row: 7, col: 7, owner: 'black', data: { type: 'LIVING_WILL', remainingOwnerTurns: 2 } },
      { id: 10, kind: 'manifestStone', row: 0, col: 0, owner: 'white', data: { type: 'THEORY_INCARNATION', remainingOwnerTurns: 4 } }
    ];
    cardState._nextMarkerId = 11;
    cardState._nextCreatedSeq = 11;

    const result = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'use_card', useCardId: 'mass_freeze_will_01' },
      createPrng()
    );

    expect(result.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'mass_freeze_will_resolved', player: 'black', frozenCount: 5 })
    ]));
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(cardState.hands.black).toEqual(['gold_stone']);
    expect(cardState.discard).toContain('mass_freeze_will_01');
    expect(cardState.discard).not.toContain('gold_stone');

    const freezes = cardState.markers.filter((marker) => marker && marker.data && marker.data.type === 'FREEZE');
    const newFreezes = freezes.filter((marker) => marker.id !== 8);
    expect(newFreezes).toHaveLength(5);
    expect(newFreezes.map((marker) => `${marker.row},${marker.col}`)).toEqual(['2,2', '3,3', '4,4', '6,6', '5,5']);
    expect(newFreezes.every((marker) => marker.owner === 'black' && marker.data.remainingOwnerTurns === 5)).toBe(true);
    expect(cardState.markers.some((marker) => marker && marker.data && marker.data.type === 'GUARD')).toBe(true);
    expect(cardState.markers.some((marker) => marker && marker.data && marker.data.type === 'TRAP')).toBe(true);
    expect(cardState.markers.some((marker) => marker && marker.data && marker.data.type === 'TIME_BOMB')).toBe(true);

    const appliedEvents = result.presentationEvents.filter((event) => (
      event && event.type === 'STATUS_APPLIED' && event.meta && event.meta.reason === 'mass_freeze_will'
    ));
    expect(appliedEvents).toHaveLength(5);
    const playback = PipelineUIAdapter.mapToPlaybackEvents(result.presentationEvents, cardState, gameState);
    const freezePlayback = playback.filter((event) => (
      event && event.type === 'status_applied' && event.meta && event.meta.reason === 'mass_freeze_will'
    ));
    expect(freezePlayback).toHaveLength(5);
    expect(new Set(freezePlayback.map((event) => event.phase)).size).toBe(1);

    const orderedPlayback = PipelineUIAdapter.appendSoundEffectPlaybackEvents(
      playback,
      result.events,
      result.presentationEvents
    );
    const cardUsePlayback = orderedPlayback.find((event) => event && event.type === 'card_use_animation');
    expect(cardUsePlayback.targets[0].disappearSoundKey).toBe('freeze_select');
    expect(cardUsePlayback.targets[0].disappearPlaybackEvents).toHaveLength(5);
    expect(orderedPlayback.filter((event) => (
      event && event.type === 'status_applied' && event.meta && event.meta.reason === 'mass_freeze_will'
    ))).toHaveLength(0);
  });

  test('does not expose an opponent hidden trap through card usability', () => {
    const { cardState, gameState } = makeState();
    cardState.hands.black = ['mass_freeze_will_01'];
    cardState.charge.black = CARD_COST;
    gameState.board[2][2] = -1;
    cardState.markers = [
      { id: 1, kind: 'specialStone', row: 2, col: 2, owner: 'white', data: { type: 'TRAP', hidden: true } }
    ];

    expect(CardLogic.getUsableCardIds(cardState, gameState, 'black')).not.toContain('mass_freeze_will_01');
    expect(() => TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'use_card', useCardId: 'mass_freeze_will_01' },
      createPrng()
    )).toThrow('applyCardUsage failed');
    expect(cardState.hands.black).toContain('mass_freeze_will_01');
    expect(cardState.charge.black).toBe(CARD_COST);
  });

  test('includes an opponent hidden trap in canonical resolution once a visible target makes usage legal', () => {
    const { cardState, gameState } = makeState();
    cardState.hands.black = ['mass_freeze_will_01'];
    cardState.charge.black = CARD_COST;
    gameState.board[2][2] = -1;
    gameState.board[3][3] = -1;
    cardState.markers = [
      { id: 1, kind: 'specialStone', row: 2, col: 2, owner: 'white', data: { type: 'TRAP', hidden: true } },
      { id: 2, kind: 'specialStone', row: 3, col: 3, owner: 'white', data: { type: 'WORK', remainingOwnerTurns: 3 } }
    ];

    const result = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'use_card', useCardId: 'mass_freeze_will_01' },
      createPrng()
    );

    expect(result.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'mass_freeze_will_resolved', frozenCount: 2 })
    ]));
    expect(cardState.markers.filter((marker) => marker.data && marker.data.type === 'FREEZE')).toHaveLength(2);
  });

  test('is unusable when every special-stone cell is already frozen', () => {
    const { cardState, gameState } = makeState();
    cardState.hands.black = ['mass_freeze_will_01'];
    cardState.charge.black = CARD_COST;
    gameState.board[1][1] = 1;
    cardState.markers = [
      { id: 1, kind: 'specialStone', row: 1, col: 1, owner: 'black', data: { type: 'WORK', remainingOwnerTurns: 3 } },
      { id: 2, kind: 'specialStone', row: 1, col: 1, owner: 'black', data: { type: 'FREEZE', remainingOwnerTurns: 2 } }
    ];

    expect(CardLogic.getUsableCardIds(cardState, gameState, 'black')).not.toContain('mass_freeze_will_01');
  });

  test('new freeze markers tick only on the card user turn and pause target duration', () => {
    const { cardState, gameState } = makeState();
    cardState.hands.black = ['mass_freeze_will_01'];
    cardState.charge.black = CARD_COST;
    gameState.board[2][2] = -1;
    cardState.markers = [
      { id: 1, kind: 'specialStone', row: 2, col: 2, owner: 'white', data: { type: 'WORK', remainingOwnerTurns: 3 } }
    ];

    TurnPipeline.applyTurn(cardState, gameState, 'black', {
      type: 'use_card', useCardId: 'mass_freeze_will_01'
    }, createPrng());

    CardLogic.onTurnStart(cardState, 'white', gameState, createPrng());
    let freeze = cardState.markers.find((marker) => marker.data && marker.data.type === 'FREEZE');
    let work = cardState.markers.find((marker) => marker.data && marker.data.type === 'WORK');
    expect(freeze.data.remainingOwnerTurns).toBe(5);
    expect(work.data.remainingOwnerTurns).toBe(3);

    CardLogic.onTurnStart(cardState, 'black', gameState, createPrng());
    freeze = cardState.markers.find((marker) => marker.data && marker.data.type === 'FREEZE');
    work = cardState.markers.find((marker) => marker.data && marker.data.type === 'WORK');
    expect(freeze.data.remainingOwnerTurns).toBe(4);
    expect(work.data.remainingOwnerTurns).toBe(3);
  });
});
