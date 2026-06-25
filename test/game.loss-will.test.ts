import * as SharedConstants from '../shared-constants.js';
import * as TurnPipeline from '../game/turn/turn_pipeline.js';
import * as CardLogic from '../game/logic/cards.js';

const LOSS_WILL_DEF = (SharedConstants.CARD_DEFS || []).find((card) => card && card.id === 'loss_will_01');
const LOSS_WILL_COST = Number(LOSS_WILL_DEF && LOSS_WILL_DEF.cost);
if (!Number.isFinite(LOSS_WILL_COST)) {
  throw new Error('loss_will_01 cost missing');
}

describe('LOSS_WILL（意志の喪失）', () => {
  function makeState() {
    const prng = { shuffle: () => {}, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: 1,
      turnNumber: 1,
      consecutivePasses: 0
    };
    return { cardState, gameState };
  }

  test('use card: 完全保護マスは除外し、それ以外の特殊石と爆弾を通常石へ戻す', () => {
    const { cardState, gameState } = makeState();
    cardState.hands.black = ['loss_will_01'];
    cardState.charge.black = LOSS_WILL_COST;

    gameState.board[2][2] = 1;
    gameState.board[3][3] = -1;
    gameState.board[4][4] = 1;

    cardState.markers = [
      { id: 1, row: 2, col: 2, kind: 'specialStone', owner: 'black', createdSeq: 1, data: { type: 'GUARD', remainingOwnerTurns: 2 } },
      { id: 2, row: 2, col: 2, kind: 'specialStone', owner: 'black', createdSeq: 2, data: { type: 'WORK', remainingOwnerTurns: 4 } },
      { id: 3, row: 3, col: 3, kind: 'specialStone', owner: 'white', createdSeq: 3, data: { type: 'WORK', remainingOwnerTurns: 4 } },
      { id: 4, row: 4, col: 4, kind: 'specialStone', owner: 'black', createdSeq: 4, data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 2 } }
    ];
    cardState._nextMarkerId = 5;
    cardState._nextCreatedSeq = 5;
    cardState.presentationEvents = [];

    const action = { type: 'use_card', useCardId: 'loss_will_01' };
    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', action, { shuffle: () => {}, random: () => 0.5 });

    expect(res.events.some((e) => e && e.type === 'card_used' && e.cardId === 'loss_will_01')).toBe(true);
    expect(res.events.some((e) => e && e.type === 'loss_will_resolved' && e.removedCount === 2)).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();

    const specials = (cardState.markers || []).filter((m) => m && m.kind === 'specialStone' && (!m.data || m.data.category !== 'bomb'));
    const bombs = (cardState.markers || []).filter((m) => m && m.kind === 'specialStone' && m.data && m.data.category === 'bomb');
    expect(specials).toHaveLength(2);
    expect(specials.some((m) => m.row === 2 && m.col === 2 && m.data && m.data.type === 'GUARD')).toBe(true);
    expect(specials.some((m) => m.row === 2 && m.col === 2 && m.data && m.data.type === 'WORK')).toBe(true);
    expect(specials.some((m) => m.row === 3 && m.col === 3)).toBe(false);
    expect(bombs).toHaveLength(0);

    expect(gameState.board[2][2]).toBe(1);
    expect(gameState.board[3][3]).toBe(-1);
    expect(gameState.board[4][4]).toBe(1);

    const removedEvents = (res.presentationEvents || []).filter((e) => e && e.type === 'STATUS_REMOVED' && e.reason === 'loss_will_reset');
    expect(removedEvents).toHaveLength(2);
    expect(removedEvents.some((e) => e.row === 3 && e.col === 3)).toBe(true);
    expect(removedEvents.some((e) => e.row === 4 && e.col === 4)).toBe(true);
    expect(removedEvents.every((e) => e.cause === 'LOSS_WILL')).toBe(true);
  });

  test('use card: 特殊石が無い場合でも爆弾は解除される', () => {
    const { cardState, gameState } = makeState();
    cardState.hands.black = ['loss_will_01'];
    cardState.charge.black = LOSS_WILL_COST;

    gameState.board[4][4] = 1;
    cardState.markers = [
      { id: 1, row: 4, col: 4, kind: 'specialStone', owner: 'black', createdSeq: 1, data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 2 } }
    ];
    cardState._nextMarkerId = 2;
    cardState._nextCreatedSeq = 2;

    const action = { type: 'use_card', useCardId: 'loss_will_01' };
    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', action, { shuffle: () => {}, random: () => 0.5 });

    expect(res.events.some((e) => e && e.type === 'loss_will_resolved' && e.removedCount === 1)).toBe(true);
    const removedEvents = (res.presentationEvents || []).filter((e) => e && e.type === 'STATUS_REMOVED' && e.reason === 'loss_will_reset');
    expect(removedEvents).toHaveLength(1);
    expect((cardState.markers || []).filter((m) => m && m.kind === 'specialStone' && m.data && m.data.category === 'bomb')).toHaveLength(0);
  });

  test('use card: 使用後に特殊カード以外の自分手札をすべて破壊する', () => {
    const { cardState, gameState } = makeState();
    cardState.hands.black = ['loss_will_01', 'observer_will_01', 'gold_stone', 'silver_stone'];
    cardState.charge.black = LOSS_WILL_COST;
    cardState.debugNoDraw = true;

    gameState.board[3][3] = -1;
    cardState.markers = [
      { id: 31, row: 3, col: 3, kind: 'specialStone', owner: 'white', createdSeq: 31, data: { type: 'WORK', remainingOwnerTurns: 4 } }
    ];
    cardState._nextMarkerId = 32;
    cardState._nextCreatedSeq = 32;

    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'use_card', useCardId: 'loss_will_01' }, { shuffle: () => {}, random: () => 0.5 });

    expect(cardState.hands.black).toEqual(['observer_will_01']);
    expect(cardState.discard).toEqual(expect.arrayContaining(['loss_will_01', 'gold_stone', 'silver_stone']));
    expect(cardState.discard).not.toContain('observer_will_01');
    expect(res.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'loss_will_resolved', player: 'black', removedCount: 1 }),
      expect.objectContaining({ type: 'loss_will_hand_destroyed', player: 'black', destroyedCount: 2 })
    ]));
    expect(res.presentationEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'HAND_CLEAR', player: 'black', reason: 'loss_will', count: 2 })
    ]));
  });

  test('use card: 破壊対象の通常手札がない場合でも盤面解除は成立する', () => {
    const { cardState, gameState } = makeState();
    cardState.hands.black = ['loss_will_01', 'observer_will_01'];
    cardState.charge.black = LOSS_WILL_COST;
    cardState.debugNoDraw = true;

    gameState.board[5][5] = -1;
    cardState.markers = [
      { id: 41, row: 5, col: 5, kind: 'specialStone', owner: 'white', createdSeq: 41, data: { type: 'WORK', remainingOwnerTurns: 4 } }
    ];
    cardState._nextMarkerId = 42;
    cardState._nextCreatedSeq = 42;

    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'use_card', useCardId: 'loss_will_01' }, { shuffle: () => {}, random: () => 0.5 });

    expect(cardState.hands.black).toEqual(['observer_will_01']);
    expect(cardState.discard).toContain('loss_will_01');
    expect(cardState.discard).not.toContain('observer_will_01');
    expect(res.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'loss_will_resolved', player: 'black', removedCount: 1 }),
      expect.objectContaining({ type: 'loss_will_hand_destroyed', player: 'black', destroyedCount: 0 })
    ]));
    expect(res.presentationEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'HAND_CLEAR', player: 'black', reason: 'loss_will', count: 0 })
    ]));
  });

  test('use card: 罠・幽体・復活石は解除し、守る石・盤面マーカー・顕現石は解除しない', () => {
    const { cardState, gameState } = makeState();
    cardState.hands.black = ['loss_will_01'];
    cardState.charge.black = LOSS_WILL_COST;

    gameState.board[1][1] = 1;
    gameState.board[1][2] = 1;
    gameState.board[1][3] = -1;
    gameState.board[1][4] = 1;
    gameState.board[1][5] = -1;
    gameState.board[1][6] = 1;
    gameState.board[1][7] = -1;

    cardState.markers = [
      { id: 11, row: 1, col: 1, kind: 'specialStone', owner: 'black', createdSeq: 11, data: { type: 'WORK', remainingOwnerTurns: 4 } },
      { id: 12, row: 1, col: 2, kind: 'specialStone', owner: 'black', createdSeq: 12, data: { type: 'GUARD', remainingOwnerTurns: 3 } },
      { id: 13, row: 1, col: 3, kind: 'specialStone', owner: 'white', createdSeq: 13, data: { type: 'TRAP', hidden: true } },
      { id: 14, row: 1, col: 4, kind: 'specialStone', owner: 'black', createdSeq: 14, data: { type: 'BLOCKADE', remainingOwnerTurns: 2 } },
      { id: 15, row: 1, col: 4, kind: 'specialStone', owner: 'black', createdSeq: 15, data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 2 } },
      { id: 16, row: 1, col: 5, kind: 'specialStone', owner: 'white', createdSeq: 16, data: { type: 'GHOST', remainingOwnerTurns: 5 } },
      { id: 17, row: 1, col: 6, kind: 'specialStone', owner: 'black', createdSeq: 17, data: { type: 'REGEN', regenRemaining: 1 } },
      { id: 18, row: 1, col: 7, kind: 'manifestStone', owner: 'white', createdSeq: 18, data: { type: 'THEORY_INCARNATION', remainingOwnerTurns: 4, inviolable: true } }
    ];
    cardState._nextMarkerId = 19;
    cardState._nextCreatedSeq = 19;

    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'use_card', useCardId: 'loss_will_01' }, { shuffle: () => {}, random: () => 0.5 });

    expect(res.events.some((e) => e && e.type === 'loss_will_resolved' && e.removedCount === 5)).toBe(true);
    expect((cardState.markers || []).some((m) => m && m.data && m.data.type === 'WORK')).toBe(false);
    expect((cardState.markers || []).some((m) => m && m.data && m.data.type === 'TIME_BOMB')).toBe(false);
    expect((cardState.markers || []).some((m) => m && m.data && m.data.type === 'TRAP')).toBe(false);
    expect((cardState.markers || []).some((m) => m && m.data && m.data.type === 'GHOST')).toBe(false);
    expect((cardState.markers || []).some((m) => m && m.data && m.data.type === 'REGEN')).toBe(false);
    expect((cardState.markers || []).some((m) => m && m.data && m.data.type === 'GUARD')).toBe(true);
    expect((cardState.markers || []).some((m) => m && m.data && m.data.type === 'BLOCKADE')).toBe(true);
    expect((cardState.markers || []).some((m) => m && m.kind === 'manifestStone' && m.data && m.data.type === 'THEORY_INCARNATION')).toBe(true);
  });

  test('LOSS_WILL keeps removing traps and bombs but not living will or guard', () => {
    const { cardState, gameState } = makeState();
    cardState.pendingEffectByPlayer.black = { type: 'LOSS_WILL', stage: null, cardId: 'loss_will_01' };
    cardState.markers.push(
      { id: 51, kind: 'specialStone', row: 2, col: 1, owner: 'white', data: { type: 'TRAP', hidden: true } },
      { id: 52, kind: 'specialStone', row: 2, col: 2, owner: 'white', data: { type: 'TIME_BOMB', category: 'bomb' } },
      { id: 53, kind: 'specialStone', row: 2, col: 3, owner: 'white', data: { type: 'LIVING_WILL' } },
      { id: 54, kind: 'specialStone', row: 2, col: 4, owner: 'white', data: { type: 'GUARD' } }
    );

    const res = CardLogic.applyLossWill(cardState, gameState, 'black');

    expect(res.removed.map((entry) => entry.type).sort()).toEqual(['TIME_BOMB', 'TRAP']);
    expect(cardState.markers.some((marker) => marker.data && marker.data.type === 'LIVING_WILL')).toBe(true);
    expect(cardState.markers.some((marker) => marker.data && marker.data.type === 'GUARD')).toBe(true);
  });

  test('特殊石も爆弾もない場合は使用できない', () => {
    const { cardState, gameState } = makeState();
    cardState.hands.black = ['loss_will_01', 'gold_stone'];
    cardState.charge.black = LOSS_WILL_COST;
    cardState.debugNoDraw = true;
    cardState.markers = [];

    const action = { type: 'use_card', useCardId: 'loss_will_01' };
    expect(() => {
      TurnPipeline.applyTurn(cardState, gameState, 'black', action, { shuffle: () => {}, random: () => 0.5 });
    }).toThrow('applyCardUsage failed');

    // Card was not consumed
    expect(cardState.hands.black).toEqual(['loss_will_01', 'gold_stone']);
    expect(cardState.discard).not.toEqual(expect.arrayContaining(['loss_will_01', 'gold_stone']));
    expect(cardState.charge.black).toBe(LOSS_WILL_COST);
  });

  test('全特殊石がGUARD保護下で除去対象ゼロの場合は使用できない', () => {
    const { cardState, gameState } = makeState();
    cardState.hands.black = ['loss_will_01'];
    cardState.charge.black = LOSS_WILL_COST;
    gameState.board[2][2] = 1;

    // GUARD on (2,2) protects the WORK on the same cell
    cardState.markers = [
      { id: 1, row: 2, col: 2, kind: 'specialStone', owner: 'black', createdSeq: 1, data: { type: 'GUARD', remainingOwnerTurns: 2 } },
      { id: 2, row: 2, col: 2, kind: 'specialStone', owner: 'black', createdSeq: 2, data: { type: 'WORK', remainingOwnerTurns: 4 } }
    ];
    cardState._nextMarkerId = 3;
    cardState._nextCreatedSeq = 3;

    const action = { type: 'use_card', useCardId: 'loss_will_01' };
    expect(() => {
      TurnPipeline.applyTurn(cardState, gameState, 'black', action, { shuffle: () => {}, random: () => 0.5 });
    }).toThrow('applyCardUsage failed');

    expect(cardState.hands.black).toContain('loss_will_01');
  });
});
