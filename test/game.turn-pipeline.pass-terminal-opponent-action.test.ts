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

// 黒は置けず、白だけが (3,4) に置ける盤面。白が先にパスした後、ターン開始効果で白に合法手が生まれた状況を表す。
function boardWhereOnlyWhiteCanPlace() {
  const board = fullBoard(Shared.WHITE);
  board[3][3] = Shared.BLACK;
  board[3][4] = Shared.EMPTY;
  return board;
}

// 黒も白も置けない盤面（白石が無い）。
function boardWhereNobodyCanPlace() {
  const board = fullBoard(Shared.BLACK);
  board[0][0] = Shared.EMPTY;
  return board;
}

// 01-rulebook.md §8.2: 終局は両者とも行動できないことを確かめてから。
describe('連続パスの終局判定: 先にパスした側が今は行動できるなら終局しない', () => {
  test('白が行動の無いパスをした後に合法手が生まれていたら、黒のパスで終局せず白の手番に戻る', () => {
    const cardState = makeCardStateWithoutHands();
    const gameState = { board: boardWhereOnlyWhiteCanPlace(), currentPlayer: Shared.BLACK, turnNumber: 10, consecutivePasses: 1 };
    const ctx = CardLogic.getCardContext(cardState);
    expect(Core.getLegalMoves(gameState, Shared.BLACK, ctx)).toHaveLength(0);
    expect(Core.getLegalMoves(gameState, Shared.WHITE, ctx).length).toBeGreaterThan(0);

    const res = TurnPipeline.applyTurnSafe(cardState, gameState, 'black', { type: 'pass', autoNoActionPass: true });
    expect(res.ok).toBe(true);
    expect(res.gameState.currentPlayer).toBe(Shared.WHITE);
    expect(res.gameState.consecutivePasses).toBe(1);
    expect(Core.isGameOver(res.gameState)).toBe(false);
    expect(res.events).toContainEqual({ type: 'pass', player: 'black' });
  });

  test('白に合法手は無くても使用可能カードがあれば、黒のパスで終局しない', () => {
    const cardState = makeCardStateWithoutHands();
    cardState.hands.white = ['chest_01'];
    cardState.charge.white = 99;
    CardLogic.ensureCardCopyState(cardState);
    const gameState = { board: boardWhereNobodyCanPlace(), currentPlayer: Shared.BLACK, turnNumber: 10, consecutivePasses: 1 };
    expect(CardLogic.hasUsableCard(cardState, { ...gameState, currentPlayer: Shared.WHITE }, 'white')).toBe(true);

    const res = TurnPipeline.applyTurnSafe(cardState, gameState, 'black', { type: 'pass', autoNoActionPass: true });
    expect(res.ok).toBe(true);
    expect(res.gameState.currentPlayer).toBe(Shared.WHITE);
    expect(res.gameState.consecutivePasses).toBe(1);
    expect(Core.isGameOver(res.gameState)).toBe(false);
  });

  test('黒がパスし、白にも合法手も使用可能カードも無ければ終局する', () => {
    const cardState = makeCardStateWithoutHands();
    const gameState = { board: boardWhereNobodyCanPlace(), currentPlayer: Shared.BLACK, turnNumber: 10, consecutivePasses: 1 };

    const res = TurnPipeline.applyTurnSafe(cardState, gameState, 'black', { type: 'pass', autoNoActionPass: true });
    expect(res.ok).toBe(true);
    expect(res.gameState.consecutivePasses).toBe(2);
    expect(Core.isGameOver(res.gameState)).toBe(true);
    expect(res.events).toContainEqual({ type: 'pass', player: 'black' });
  });

  test('白が行動を持ったままパスを選んでいた場合は、白が今行動できても黒のパスで終局する', () => {
    const cardState = makeCardStateWithoutHands();
    const gameState = {
      board: boardWhereOnlyWhiteCanPlace(),
      currentPlayer: Shared.BLACK,
      turnNumber: 10,
      consecutivePasses: 1,
      lastPassHadAction: true
    };
    expect(Core.getLegalMoves(gameState, Shared.WHITE, CardLogic.getCardContext(cardState)).length).toBeGreaterThan(0);

    const res = TurnPipeline.applyTurnSafe(cardState, gameState, 'black', { type: 'pass', autoNoActionPass: true });
    expect(res.ok).toBe(true);
    expect(res.gameState.consecutivePasses).toBe(2);
    expect(Core.isGameOver(res.gameState)).toBe(true);
    // 黒のパスは行動の無いパスなので記録は消える。
    expect(res.gameState).not.toHaveProperty('lastPassHadAction');
  });

  test('使用可能カードがあるのに選んだパスは行動ありとして記録し、相手の次のパスで終局する', () => {
    const cardState = makeCardStateWithoutHands();
    cardState.hands.black = ['chest_01'];
    cardState.charge.black = 99;
    CardLogic.ensureCardCopyState(cardState);
    const gameState = { board: boardWhereNobodyCanPlace(), currentPlayer: Shared.BLACK, turnNumber: 10, consecutivePasses: 0 };
    expect(CardLogic.hasUsableCard(cardState, gameState, 'black')).toBe(true);

    const blackPass = TurnPipeline.applyTurnSafe(cardState, gameState, 'black', { type: 'pass' });
    expect(blackPass.ok).toBe(true);
    expect(blackPass.gameState.consecutivePasses).toBe(1);
    expect(blackPass.gameState.lastPassHadAction).toBe(true);
    expect(Core.copyGameState(blackPass.gameState).lastPassHadAction).toBe(true);

    // 白は行動が無い。黒はまだカードを使えるが、自分でパスを選んでいたので数え直さない。
    const whitePass = TurnPipeline.applyTurnSafe(blackPass.cardState, blackPass.gameState, 'white', { type: 'pass', autoNoActionPass: true });
    expect(whitePass.ok).toBe(true);
    expect(whitePass.gameState.consecutivePasses).toBe(2);
    expect(Core.isGameOver(whitePass.gameState)).toBe(true);
  });

  test('合法手があるのに時間切れでパスした場合も行動ありとして記録する', () => {
    const cardState = makeCardStateWithoutHands();
    const gameState = Core.createGameState();
    expect(Core.getLegalMoves(gameState, Shared.BLACK, CardLogic.getCardContext(cardState)).length).toBeGreaterThan(0);

    const res = TurnPipeline.applyTurnSafe(cardState, gameState, 'black', { type: 'pass', forcePass: true });
    expect(res.ok).toBe(true);
    expect(res.gameState.lastPassHadAction).toBe(true);
  });

  test('行動の無いパスは記録を残さない', () => {
    const cardState = makeCardStateWithoutHands();
    const gameState = { board: boardWhereNobodyCanPlace(), currentPlayer: Shared.BLACK, turnNumber: 10, consecutivePasses: 0, lastPassHadAction: true };

    const res = TurnPipeline.applyTurnSafe(cardState, gameState, 'black', { type: 'pass', autoNoActionPass: true });
    expect(res.ok).toBe(true);
    expect(res.gameState.consecutivePasses).toBe(1);
    expect(res.gameState).not.toHaveProperty('lastPassHadAction');
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
});

describe('時間停止中のパス: 同じプレイヤーが続けたパスは連続に数えない', () => {
  test('時間停止中に黒だけが2回パスしても終局せず、白に手番が回る', () => {
    const cardState = makeCardStateWithoutHands();
    cardState.timeStopConsecutiveTurnsRemainingByPlayer = { black: 2, white: 0 };
    const board = fullBoard(Shared.WHITE);
    board[0][0] = Shared.EMPTY;
    board[0][1] = Shared.BLACK;
    const gameState = { board, currentPlayer: Shared.BLACK, turnNumber: 20, consecutivePasses: 0 };
    const ctx = CardLogic.getCardContext(cardState);
    expect(Core.getLegalMoves(gameState, Shared.BLACK, ctx)).toHaveLength(0);
    expect(Core.getLegalMoves(gameState, Shared.WHITE, ctx).length).toBeGreaterThan(0);

    const first = TurnPipeline.applyTurnSafe(cardState, gameState, 'black', { type: 'pass', autoNoActionPass: true });
    expect(first.ok).toBe(true);
    expect(first.gameState.currentPlayer).toBe(Shared.BLACK);
    expect(first.gameState.consecutivePasses).toBe(0);

    const second = TurnPipeline.applyTurnSafe(first.cardState, first.gameState, 'black', { type: 'pass', autoNoActionPass: true });
    expect(second.ok).toBe(true);
    expect(Core.isGameOver(second.gameState)).toBe(false);
    expect(second.gameState.currentPlayer).toBe(Shared.WHITE);
    expect(second.gameState.consecutivePasses).toBe(1);
  });

  test('白のパスの後、時間停止中の黒のパスは白が行動できなければそのまま終局する', () => {
    const cardState = makeCardStateWithoutHands();
    cardState.timeStopConsecutiveTurnsRemainingByPlayer = { black: 2, white: 0 };
    const gameState = { board: boardWhereNobodyCanPlace(), currentPlayer: Shared.BLACK, turnNumber: 20, consecutivePasses: 1 };

    const res = TurnPipeline.applyTurnSafe(cardState, gameState, 'black', { type: 'pass', autoNoActionPass: true });
    expect(res.ok).toBe(true);
    expect(res.gameState.consecutivePasses).toBe(2);
    expect(Core.isGameOver(res.gameState)).toBe(true);
  });
});

describe('終局が決まったパスでは盤面を止める', () => {
  function stateWithLethalPoison(consecutivePasses: number) {
    const cardState = makeCardStateWithoutHands();
    const gameState = { board: boardWhereNobodyCanPlace(), currentPlayer: Shared.BLACK, turnNumber: 10, consecutivePasses };
    CardLogic.addMarker(cardState, 'specialStone', 3, 3, 'black', { type: 'POISONED', remainingTurns: 1, appliedTurnNumber: 0 });
    return { cardState, gameState };
  }

  test('終局しないパスでは、ターン終わりの毒で石が壊れる', () => {
    const { cardState, gameState } = stateWithLethalPoison(0);
    const res = TurnPipeline.applyTurnSafe(cardState, gameState, 'black', { type: 'pass', autoNoActionPass: true });
    expect(res.ok).toBe(true);
    expect(Core.isGameOver(res.gameState)).toBe(false);
    expect(res.gameState.board[3][3]).toBe(Shared.EMPTY);
  });

  test('2回目のパスで終局する時は、ターン終わりの毒を処理せずパスした時点の盤面で止める', () => {
    const { cardState, gameState } = stateWithLethalPoison(1);
    const res = TurnPipeline.applyTurnSafe(cardState, gameState, 'black', { type: 'pass', autoNoActionPass: true });
    expect(res.ok).toBe(true);
    expect(Core.isGameOver(res.gameState)).toBe(true);
    expect(res.gameState.board[3][3]).toBe(Shared.BLACK);
    expect(res.gameState.board).toEqual(gameState.board);
  });
});
