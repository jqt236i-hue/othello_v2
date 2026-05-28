import * as Shared from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';
import * as TurnPipelinePhases from '../game/turn/turn_pipeline_phases.js';
import * as Core from '../game/logic/core.js';
import * as BoardOps from '../game/logic/board_ops.js';

function createSequencePrng(sequence) {
  const values = Array.isArray(sequence) && sequence.length > 0 ? sequence.slice() : [0.5];
  let idx = 0;
  return {
    shuffle: (arr) => arr,
    random: () => {
      const useIndex = idx < values.length ? idx : values.length - 1;
      const raw = Number(values[useIndex]);
      idx += 1;
      if (!Number.isFinite(raw)) return 0.5;
      if (raw < 0) return 0;
      if (raw >= 1) return 0.999999;
      return raw;
    }
  };
}

function createStates(prng) {
  const cardState = CardLogic.createCardState(prng || createSequencePrng([0.5]));
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  };
  return { cardState, gameState };
}

describe('OBSERVER_WILL（盤理の観測者）', () => {
  const placementLines = [
    '今日も観測しますかっと',
    '盤理は観測するためにある',
    '観測最高！'
  ];
  const lostLine = '盤理観測してる場合じゃなかったわ';

  test('配置時に観測石マーカーを設置する', () => {
    const { cardState, gameState } = createStates();
    cardState.pendingEffectByPlayer.black = {
      type: 'OBSERVER_WILL',
      stage: null,
      cardId: 'observer_01'
    };

    const effects = CardLogic.applyPlacementEffects(cardState, gameState, 'black', 2, 3, 1);

    expect(effects && effects.observerPlaced).toBe(true);
    const marker = (cardState.markers || []).find((m) => (
      m &&
      m.kind === 'specialStone' &&
      m.row === 2 &&
      m.col === 3 &&
      m.owner === 'black' &&
      m.data &&
      m.data.type === 'OBSERVER'
    ));
    expect(marker).toBeTruthy();
    expect(marker.data.remainingOwnerTurns).toBe(CardLogic.OBSERVER_WILL_TURNS);
  });

  test('配置ターンでは観測成功しない（布石を獲得しない）', () => {
    const prng = createSequencePrng([0.1, 0.55]);
    const { cardState, gameState } = createStates(prng);

    gameState.board[3][3] = Core.WHITE;
    gameState.board[3][4] = Core.BLACK;
    cardState.pendingEffectByPlayer.black = {
      type: 'OBSERVER_WILL',
      stage: null,
      cardId: 'observer_01'
    };

    const events = [];
    TurnPipelinePhases.applyActionPhase(
      CardLogic,
      Core,
      cardState,
      gameState,
      'black',
      { type: 'place', row: 3, col: 2 },
      events,
      prng,
      BoardOps
    );

    const placementEvent = events.find((ev) => ev && ev.type === 'placement_effects');
    expect(placementEvent && placementEvent.effects && placementEvent.effects.observerPlaced).toBe(true);

    const triggered = events.find((ev) => ev && ev.type === 'observer_triggered');
    expect(triggered).toBeUndefined();

    const marker = (cardState.markers || []).find((m) => (
      m &&
      m.kind === 'specialStone' &&
      m.row === 3 &&
      m.col === 2 &&
      m.owner === 'black' &&
      m.data &&
      m.data.type === 'OBSERVER'
    ));
    expect(marker).toBeTruthy();
    expect(marker.data.remainingOwnerTurns).toBe(5);
    expect(cardState.charge.black).toBe(1);

    const pres = CardLogic.flushPresentationEvents(cardState) || [];
    const bubble = pres.find((ev) => ev && ev.type === 'OBSERVER_BUBBLE');
    expect(bubble).toBeTruthy();
    expect(placementLines).toContain(bubble.text);
  });

  test('所有者ターン開始時に30%成功で布石を獲得し、残りターンを減らす', () => {
    const prng = createSequencePrng([0.2, 0.9]);
    const { cardState, gameState } = createStates(prng);

    gameState.board[4][4] = Shared.BLACK;
    cardState.markers.push({
      id: 9001,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'OBSERVER', remainingOwnerTurns: 5 }
    });

    const out = CardLogic.processObserverWillEffectsAtTurnStartAnchor(cardState, gameState, 'black', 4, 4, prng);

    expect(out.triggered).toBe(true);
    expect(out.gained).toBe(5);
    expect(out.remainingOwnerTurns).toBe(4);
    expect(cardState.charge.black).toBe(5);
  });

  test('所有者ターン開始時に不発でも残りターンは減る', () => {
    const prng = createSequencePrng([0.8]);
    const { cardState, gameState } = createStates(prng);

    gameState.board[1][1] = Shared.BLACK;
    cardState.markers.push({
      id: 9002,
      kind: 'specialStone',
      row: 1,
      col: 1,
      owner: 'black',
      data: { type: 'OBSERVER', remainingOwnerTurns: 5 }
    });

    const out = CardLogic.processObserverWillEffectsAtTurnStartAnchor(cardState, gameState, 'black', 1, 1, prng);

    expect(out.triggered).toBe(false);
    expect(out.gained).toBe(0);
    expect(out.remainingOwnerTurns).toBe(4);
    expect(cardState.charge.black).toBe(0);
  });

  test('残りターン終了またはアンカー喪失で観測石を除去する', () => {
    const { cardState, gameState } = createStates(createSequencePrng([0.9]));

    gameState.board[5][5] = Shared.BLACK;
    cardState.markers.push({
      id: 9003,
      kind: 'specialStone',
      row: 5,
      col: 5,
      owner: 'black',
      data: { type: 'OBSERVER', remainingOwnerTurns: 1 }
    });

    const byDuration = CardLogic.processObserverWillEffectsAtTurnStartAnchor(cardState, gameState, 'black', 5, 5, createSequencePrng([0.9]));
    expect((byDuration.expired || [])[0]).toMatchObject({ row: 5, col: 5, reason: 'duration_end' });
    expect(cardState.markers.find((m) => m && m.id === 9003)).toBeUndefined();
    expect(gameState.board[5][5]).toBe(Shared.BLACK);
    expect(CardLogic.flushPresentationEvents(cardState) || []).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'STATUS_REMOVED',
        row: 5,
        col: 5,
        reason: 'duration_end',
        meta: expect.objectContaining({ special: 'OBSERVER' })
      })
    ]));

    gameState.board[6][6] = Shared.WHITE;
    cardState.markers.push({
      id: 9004,
      kind: 'specialStone',
      row: 6,
      col: 6,
      owner: 'black',
      data: { type: 'OBSERVER', remainingOwnerTurns: 5 }
    });

    const byLostAnchor = CardLogic.processObserverWillEffectsAtTurnStartAnchor(cardState, gameState, 'black', 6, 6, createSequencePrng([0.1]));
    expect((byLostAnchor.expired || [])[0]).toMatchObject({ row: 6, col: 6, reason: 'anchor_lost' });
    expect(cardState.markers.find((m) => m && m.id === 9004)).toBeUndefined();
    expect(gameState.board[6][6]).toBe(Shared.WHITE);
  });

  test('所有者ターン開始時に観測不発なら吹き出しを表示しない', () => {
    const prng = createSequencePrng([0.8]);
    const { cardState, gameState } = createStates(prng);

    gameState.currentPlayer = Shared.BLACK;
    gameState.board[4][4] = Shared.BLACK;
    cardState.markers.push({
      id: 9014,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'OBSERVER', remainingOwnerTurns: 5 }
    });

    cardState.lastTurnStartedFor = null;
    TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', [], prng);

    const pres = CardLogic.flushPresentationEvents(cardState) || [];
    const bubble = pres.find((ev) => ev && ev.type === 'OBSERVER_BUBBLE');
    expect(bubble).toBeUndefined();

    const gainBubble = pres.find((ev) => ev && ev.type === 'OBSERVER_TRIGGERED');
    expect(gainBubble).toBeUndefined();
  });

  test('観測石アンカー喪失時は固定セリフ吹き出しを優先表示する', () => {
    const prng = createSequencePrng([0.1]);
    const { cardState, gameState } = createStates(prng);

    gameState.currentPlayer = Shared.BLACK;
    gameState.board[6][6] = Shared.WHITE;
    cardState.markers.push({
      id: 9011,
      kind: 'specialStone',
      row: 6,
      col: 6,
      owner: 'black',
      data: { type: 'OBSERVER', remainingOwnerTurns: 5 }
    });
    cardState.lastTurnStartedFor = null;

    const events = [];
    TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', events, prng);

    const pres = CardLogic.flushPresentationEvents(cardState) || [];
    const bubble = pres.find((ev) => ev && ev.type === 'OBSERVER_BUBBLE');
    expect(bubble).toBeTruthy();
    expect(bubble.text).toBe(lostLine);

    const gainBubble = pres.find((ev) => ev && ev.type === 'OBSERVER_TRIGGERED');
    expect(gainBubble).toBeUndefined();
  });

  test('観測石が反転で消えたとき固定セリフ吹き出しを表示する', () => {
    const prng = createSequencePrng([0.5]);
    const { cardState, gameState } = createStates(prng);

    gameState.currentPlayer = Shared.WHITE;
    gameState.board[3][3] = Shared.BLACK;
    gameState.board[3][4] = Shared.WHITE;
    cardState.markers.push({
      id: 9012,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'OBSERVER', remainingOwnerTurns: 5 }
    });

    const events = [];
    TurnPipelinePhases.applyActionPhase(
      CardLogic,
      Core,
      cardState,
      gameState,
      'white',
      { type: 'place', row: 3, col: 2 },
      events,
      prng,
      BoardOps
    );

    expect(gameState.board[3][3]).toBe(Shared.WHITE);
    expect(cardState.markers.find((m) => m && m.id === 9012)).toBeUndefined();

    const pres = CardLogic.flushPresentationEvents(cardState) || [];
    const bubble = pres.find((ev) => ev && ev.type === 'OBSERVER_BUBBLE' && ev.text === lostLine);
    expect(bubble).toBeTruthy();
    expect(bubble.row).toBe(3);
    expect(bubble.col).toBe(3);
  });

  test('観測石が破壊で消えたとき固定セリフ吹き出しを表示する', () => {
    const prng = createSequencePrng([0.5]);
    const { cardState, gameState } = createStates(prng);

    gameState.currentPlayer = Shared.WHITE;
    gameState.board[2][2] = Shared.BLACK;
    cardState.markers.push({
      id: 9013,
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'black',
      data: { type: 'OBSERVER', remainingOwnerTurns: 5 }
    });
    cardState.pendingEffectByPlayer.white = {
      type: 'DESTROY_ONE_STONE',
      stage: null,
      cardId: 'destroy_one_01'
    };

    const events = [];
    TurnPipelinePhases.applyActionPhase(
      CardLogic,
      Core,
      cardState,
      gameState,
      'white',
      { type: 'place', destroyTarget: { row: 2, col: 2 } },
      events,
      prng,
      BoardOps
    );

    expect(gameState.board[2][2]).toBe(Shared.EMPTY);
    expect(cardState.markers.find((m) => m && m.id === 9013)).toBeUndefined();

    const pres = CardLogic.flushPresentationEvents(cardState) || [];
    const bubble = pres.find((ev) => ev && ev.type === 'OBSERVER_BUBBLE' && ev.text === lostLine);
    expect(bubble).toBeTruthy();
    expect(bubble.row).toBe(2);
    expect(bubble.col).toBe(2);
  });
});
