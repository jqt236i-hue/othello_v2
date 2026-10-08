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

// 01-rulebook.md §8.2: 2回目のパスが成立した時点で終局する。先にパスした側に行動が生まれていても数え直さない。
describe('連続パスの終局判定: 2回目のパスで必ず終局する', () => {
  test('先にパスした白に、その後の盤面変化で合法手が生まれていても、黒のパスで終局する', () => {
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
    expect(res.gameState.consecutivePasses).toBe(2);
    expect(Core.isGameOver(res.gameState)).toBe(true);
    const passEvent = res.events.find((event: any) => event && event.type === 'pass');
    expect(passEvent).toEqual({ type: 'pass', player: 'black' });
  });

  test('先にパスした白が使用可能カードを持っていても、黒のパスで終局する', () => {
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
    expect(CardLogic.hasUsableCard(cardState, { ...gameState, currentPlayer: Shared.WHITE }, 'white')).toBe(true);

    const res = TurnPipeline.applyTurnSafe(cardState, gameState, 'black', { type: 'pass', autoNoActionPass: true });
    expect(res.ok).toBe(true);
    expect(res.gameState.consecutivePasses).toBe(2);
    expect(Core.isGameOver(res.gameState)).toBe(true);
  });

  test('使用可能カードがあるのに選んだ任意のパスも1回として数え、2回目で終局する', () => {
    const cardState = makeCardStateWithoutHands();
    cardState.hands.black = ['chest_01'];
    cardState.charge.black = 99;
    CardLogic.ensureCardCopyState(cardState);
    const board = fullBoard(Shared.BLACK);
    board[0][0] = Shared.EMPTY;
    const gameState = {
      board,
      currentPlayer: Shared.BLACK,
      turnNumber: 10,
      consecutivePasses: 1
    };
    expect(CardLogic.hasUsableCard(cardState, gameState, 'black')).toBe(true);

    const res = TurnPipeline.applyTurnSafe(cardState, gameState, 'black', { type: 'pass' });
    expect(res.ok).toBe(true);
    expect(res.gameState.consecutivePasses).toBe(2);
    expect(Core.isGameOver(res.gameState)).toBe(true);
  });

  test('1回目のパスでは終局せず、パス以外で手番が終わると連続パス数は0に戻る', () => {
    const cardState = makeCardStateWithoutHands();
    const gameState = Core.createGameState();
    gameState.consecutivePasses = 0;
    const firstPass = TurnPipeline.applyTurnSafe(cardState, gameState, 'black', { type: 'pass', forcePass: true });
    expect(firstPass.ok).toBe(true);
    expect(firstPass.gameState.consecutivePasses).toBe(1);
    expect(Core.isGameOver(firstPass.gameState)).toBe(false);

    const whiteMove = Core.getLegalMoves(firstPass.gameState, Shared.WHITE, CardLogic.getCardContext(firstPass.cardState))[0];
    const placed = TurnPipeline.applyTurnSafe(firstPass.cardState, firstPass.gameState, 'white', { type: 'place', row: whiteMove.row, col: whiteMove.col });
    expect(placed.ok).toBe(true);
    expect(placed.gameState.consecutivePasses).toBe(0);
  });

  test('連続パスの数え直し用の記録を状態に持たない', () => {
    const cardState = makeCardStateWithoutHands();
    const board = fullBoard(Shared.BLACK);
    board[0][0] = Shared.EMPTY;
    const gameState: any = {
      board,
      currentPlayer: Shared.BLACK,
      turnNumber: 10,
      consecutivePasses: 0
    };
    const res = TurnPipeline.applyTurnSafe(cardState, gameState, 'black', { type: 'pass', autoNoActionPass: true });
    expect(res.ok).toBe(true);
    expect(res.gameState).not.toHaveProperty('lastPassWithoutAction');
    expect(Core.copyGameState({ ...res.gameState, lastPassWithoutAction: true })).not.toHaveProperty('lastPassWithoutAction');
  });
});
