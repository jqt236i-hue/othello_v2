import * as Shared from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';
import * as TurnPipeline from '../game/turn/turn_pipeline.js';
import * as TurnPipelinePhases from '../game/turn/turn_pipeline_phases.js';
import * as Core from '../game/logic/core.js';
import * as BoardOps from '../game/logic/board_ops.js';

function createPrng(randomValue = 0.5) {
  return {
    shuffle: (arr) => arr,
    random: () => randomValue
  };
}

function createStates(randomValue = 0.5) {
  const cardState = CardLogic.createCardState(createPrng(randomValue));
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  };
  return { cardState, gameState };
}

describe('METEOR_GOD（因果抹消神）', () => {
  test('カード定義と持続定数が正しい', () => {
    const def = (Shared.CARD_DEFS || []).find((card) => card && card.type === 'METEOR_GOD');
    expect(def).toBeTruthy();
    expect(def && def.id).toBe('meteor_god_01');
    expect(Number(def && def.cost)).toBe(40);
    expect(CardLogic.METEOR_GOD_TURNS).toBe(6);
  });

  test('配置時に合法手へ置けて、因果抹消神石マーカーが付く', () => {
    const prng = createPrng(0.1);
    const { cardState, gameState } = createStates(0.1);

    gameState.board[2][4] = Shared.WHITE;
    gameState.board[2][5] = Shared.BLACK;

    cardState.pendingEffectByPlayer.black = {
      type: 'METEOR_GOD',
      stage: null,
      cardId: 'meteor_god_01'
    };

    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 2, col: 3 }, prng);

    expect(gameState.board[2][3]).toBe(Shared.BLACK);
    const placement = (res.events || []).find((e) => e && e.type === 'placement_effects');
    expect(placement && placement.effects && placement.effects.meteorGodPlaced).toBe(true);
    expect(placement && placement.effects && placement.effects.freePlacementUsed).not.toBe(true);

    const marker = (cardState.markers || []).find((m) => (
      m &&
      m.kind === 'specialStone' &&
      m.row === 2 &&
      m.col === 3 &&
      m.owner === 'black' &&
      m.data &&
      m.data.type === 'METEOR_GOD'
    ));
    expect(marker).toBeTruthy();
    expect(marker.data.remainingOwnerTurns).toBe(6);
  });

  test('配置ターンに盤面上の敵石をランダム1個だけ即時穴化する', () => {
    const prng = createPrng(0.99);
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY)),
      currentPlayer: Core.BLACK,
      turnNumber: 1,
      consecutivePasses: 0
    };

    gameState.board[2][4] = Core.WHITE;
    gameState.board[2][5] = Core.BLACK;
    gameState.board[6][6] = Core.WHITE;

    cardState.pendingEffectByPlayer.black = {
      type: 'METEOR_GOD',
      stage: null,
      cardId: 'meteor_god_01'
    };

    const events = [];
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

    expect(gameState.board[2][3]).toBe(Core.BLACK);
    expect(gameState.board[2][4]).toBe(Core.BLACK);
    expect(gameState.board[6][6]).toBe(Core.EMPTY);
    expect((cardState.markers || []).some((m) => m && m.row === 6 && m.col === 6 && m.data && m.data.type === 'METEOR_HOLE')).toBe(true);
    expect(events.some((ev) => ev && ev.type === 'meteor_god_destroyed_immediate')).toBe(true);
  });

  test('自ターン開始時に敵石を1つ穴化して残りターンを減らす', () => {
    const { cardState, gameState } = createStates(0.75);

    gameState.board[3][3] = Shared.BLACK;
    gameState.board[1][1] = Shared.WHITE;
    gameState.board[4][4] = Shared.WHITE;

    cardState.markers.push({
      id: 9201,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'METEOR_GOD', remainingOwnerTurns: 6 }
    });

    const out = CardLogic.processMeteorGodEffectsAtTurnStartAnchor(cardState, gameState, 'black', 3, 3, createPrng(0.75));

    expect((out.destroyed || [])).toHaveLength(1);
    expect(gameState.board[1][1] === Shared.EMPTY || gameState.board[4][4] === Shared.EMPTY).toBe(true);
    expect((cardState.markers || []).some((m) => m && m.data && m.data.type === 'METEOR_HOLE')).toBe(true);

    const marker = cardState.markers.find((m) => m && m.id === 9201);
    expect(marker).toBeTruthy();
    expect(marker.data.remainingOwnerTurns).toBe(5);
  });

  test('不可侵の顕現石を因果抹消神の候補にしない', () => {
    const { cardState, gameState } = createStates(0);

    gameState.board[3][3] = Shared.BLACK;
    gameState.board[0][0] = Shared.WHITE;
    gameState.board[7][7] = Shared.WHITE;
    cardState.markers.push(
      {
        id: 9202,
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        data: { type: 'METEOR_GOD', remainingOwnerTurns: 6 }
      },
      {
        id: 9203,
        kind: 'manifestStone',
        row: 0,
        col: 0,
        owner: 'white',
        data: { type: 'THEORY_INCARNATION', remainingOwnerTurns: 4, inviolable: true }
      }
    );

    const out = CardLogic.processMeteorGodEffectsAtTurnStartAnchor(cardState, gameState, 'black', 3, 3, createPrng(0));

    expect((out.destroyed || [])).toEqual([expect.objectContaining({ row: 7, col: 7 })]);
    expect(gameState.board[0][0]).toBe(Shared.WHITE);
    expect(gameState.board[7][7]).toBe(Shared.EMPTY);
    expect((cardState.markers || []).some((m) => m && m.row === 0 && m.col === 0 && m.data && m.data.type === 'METEOR_HOLE')).toBe(false);
    expect((cardState.markers || []).some((m) => m && m.row === 7 && m.col === 7 && m.data && m.data.type === 'METEOR_HOLE')).toBe(true);
    expect(cardState.markers.find((m) => m && m.id === 9202).data.remainingOwnerTurns).toBe(5);
  });

  test('6回目の所有者ターン開始で因果抹消神石は通常石に戻る', () => {
    const { cardState, gameState } = createStates(0.3);

    gameState.board[4][4] = Shared.BLACK;
    cardState.markers.push({
      id: 9204,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'METEOR_GOD', remainingOwnerTurns: 6 }
    });

    for (let i = 0; i < 5; i++) {
      const out = CardLogic.processMeteorGodEffectsAtTurnStartAnchor(cardState, gameState, 'black', 4, 4, createPrng(0.3));
      expect((out.expired || [])).toHaveLength(0);
      const marker = cardState.markers.find((m) => m && m.id === 9204);
      expect(marker).toBeTruthy();
      expect(marker.data.remainingOwnerTurns).toBe(5 - i);
      expect(gameState.board[4][4]).toBe(Shared.BLACK);
    }

    const last = CardLogic.processMeteorGodEffectsAtTurnStartAnchor(cardState, gameState, 'black', 4, 4, createPrng(0.3));
    expect((last.expired || [])).toEqual([expect.objectContaining({ row: 4, col: 4, reason: 'anchor_expired' })]);
    expect(gameState.board[4][4]).toBe(Shared.BLACK);
    expect(cardState.markers.find((m) => m && m.id === 9204)).toBeUndefined();
  });

  test('因果抹消神石は反転無効リストに含まれる', () => {
    const { cardState, gameState } = createStates(0.3);

    gameState.board[1][1] = Shared.BLACK;
    cardState.markers.push({
      id: 9205,
      kind: 'specialStone',
      row: 1,
      col: 1,
      owner: 'black',
      data: { type: 'METEOR_GOD', remainingOwnerTurns: 6 }
    });

    const context = CardLogic.getCardContext(cardState);
    expect(Array.isArray(context.permaProtectedStones)).toBe(true);
    expect(context.permaProtectedStones.some((s) => s.row === 1 && s.col === 1 && s.owner === Shared.BLACK)).toBe(true);
  });
});
