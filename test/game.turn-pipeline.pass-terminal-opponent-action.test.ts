import * as Shared from '../shared-constants.js';
import * as Core from '../game/logic/core.js';
import * as CardLogic from '../game/logic/cards.js';
import * as TurnPipeline from '../game/turn/turn_pipeline.js';

function makeCardStateWithoutHands() {
  const cardState = CardLogic.createCardState({ shuffle: (arr) => arr });
  cardState.hands.black = [];
  cardState.hands.white = [];
  return cardState;
}

function fullBoard(value) {
  return Array.from({ length: 8 }, () => Array(8).fill(value));
}

describe('連続パスの終局判定: 先にパスした側が行動できるなら終局しない', () => {
  test('黒が合法手なしでパスしても、白に合法手があれば連続パス2にならず対局が続く', () => {
    const cardState = makeCardStateWithoutHands();
    // 白が先にパスした後、ターン開始効果で盤面が変わり白に合法手が生まれた状況を再現する。
    const board = fullBoard(Shared.WHITE);
    board[3][3] = Shared.BLACK;
    board[3][4] = Shared.EMPTY;
    const gameState = {
      board,
      currentPlayer: Shared.BLACK,
      turnNumber: 10,
      consecutivePasses: 1
    };
    const ctx = CardLogic.getCardContext(cardState);
    expect(Core.getLegalMoves(gameState, Shared.BLACK, ctx)).toHaveLength(0);
    expect(Core.getLegalMoves(gameState, Shared.WHITE, ctx).length).toBeGreaterThan(0);

    const res = TurnPipeline.applyTurnSafe(cardState, gameState, 'black', { type: 'pass', autoNoActionPass: true });
    expect(res.ok).toBe(true);
    expect(res.gameState.currentPlayer).toBe(Shared.WHITE);
    expect(res.gameState.consecutivePasses).toBe(1);
    expect(Core.isGameOver(res.gameState)).toBe(false);
    expect(res.events).toContainEqual(expect.objectContaining({ type: 'pass', player: 'black', terminalPassDeferred: true }));
  });

  test('黒がパスし、白にも合法手も使用可能カードも無ければ連続パス2で終局する', () => {
    const cardState = makeCardStateWithoutHands();
    const board = fullBoard(Shared.BLACK);
    board[0][0] = Shared.EMPTY;
    const gameState = {
      board,
      currentPlayer: Shared.BLACK,
      turnNumber: 10,
      consecutivePasses: 1
    };
    const ctx = CardLogic.getCardContext(cardState);
    expect(Core.getLegalMoves(gameState, Shared.BLACK, ctx)).toHaveLength(0);
    expect(Core.getLegalMoves(gameState, Shared.WHITE, ctx)).toHaveLength(0);

    const res = TurnPipeline.applyTurnSafe(cardState, gameState, 'black', { type: 'pass', autoNoActionPass: true });
    expect(res.ok).toBe(true);
    expect(res.gameState.consecutivePasses).toBe(2);
    expect(Core.isGameOver(res.gameState)).toBe(true);
    expect(res.events).toContainEqual(expect.objectContaining({ type: 'pass', player: 'black' }));
    expect(res.events).not.toContainEqual(expect.objectContaining({ type: 'pass', terminalPassDeferred: true }));
  });

  test('白に合法手は無くても使用可能カードがあれば終局しない', () => {
    const cardState = makeCardStateWithoutHands();
    cardState.hands.white = ['chest_01'];
    cardState.charge.white = 99;
    CardLogic.ensureCardCopyState(cardState);
    const board = fullBoard(Shared.BLACK);
    board[0][0] = Shared.EMPTY;
    const gameState = {
      board,
      currentPlayer: Shared.BLACK,
      turnNumber: 10,
      consecutivePasses: 1
    };
    const whiteCanUseCard = CardLogic.hasUsableCard(cardState, { ...gameState, currentPlayer: Shared.WHITE }, 'white');
    expect(whiteCanUseCard).toBe(true);

    const res = TurnPipeline.applyTurnSafe(cardState, gameState, 'black', { type: 'pass', autoNoActionPass: true });
    expect(res.ok).toBe(true);
    expect(res.gameState.consecutivePasses).toBe(1);
    expect(Core.isGameOver(res.gameState)).toBe(false);
  });
});
