import * as Shared from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';
import * as Core from '../game/logic/core.js';
import * as TurnPipeline from '../game/turn/turn_pipeline.js';
import * as StoneSupply from '../shared/stone-supply';

const PRNG = { shuffle: (arr) => arr, random: () => 0.5 };

function makeState(options: any = { stoneSupplyEnabled: true }) {
  const cardState = CardLogic.createCardState(PRNG, options);
  cardState.debugNoDraw = true;
  const gameState = Core.createGameState(options && options.boardConfig);
  return { cardState, gameState };
}

function makeChainBoardState(rowCount: number) {
  const { cardState } = makeState();
  const gameState = {
    board: Array(8).fill(null).map(() => Array(8).fill(0)),
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  };
  for (let row = 1; row <= rowCount; row += 1) {
    gameState.board[row][0] = Shared.BLACK;
    for (let col = 1; col <= 5; col += 1) {
      gameState.board[row][col] = Shared.WHITE;
    }
  }
  return { cardState, gameState };
}

function legalMovesFor(cardState: any, gameState: any, player: number) {
  return Core.getLegalMoves(gameState, player, CardLogic.getCardContext(cardState));
}

describe('持ち石ルール', () => {
  test('初期値は 盤面マス数の半分 − 自分の初期配置石数', () => {
    expect(makeState().cardState.stoneSupply).toEqual({
      initial: 30,
      remainingByPlayer: { black: 30, white: 30 }
    });
    expect(makeState({ stoneSupplyEnabled: true, boardConfig: { rows: 4, cols: 4 } }).cardState.stoneSupply.initial).toBe(6);
    expect(makeState({ stoneSupplyEnabled: true, boardConfig: { rows: 7, cols: 7 } }).cardState.stoneSupply.initial).toBe(20);
    expect(makeState({ stoneSupplyEnabled: true, boardConfig: { rows: 5, cols: 7 } }).cardState.stoneSupply.initial).toBe(15);
  });

  test('円形盤面では円内の使用マスだけで持ち石数を決める', () => {
    const SharedBoardUtils = require('../shared/shared-board-utils');
    const boardConfig = SharedBoardUtils.buildBoardConfig(8, 8, 'circle');
    const cellCount = SharedBoardUtils.collectMainBoardCoordinates(boardConfig).length;
    expect(cellCount).toBeLessThan(64);
    const { cardState } = makeState({ stoneSupplyEnabled: true, boardConfig });
    expect(cardState.stoneSupply.initial).toBe(Math.floor(cellCount / 2) - 2);
  });

  test('オプション未指定の headless 生成ではルール無効', () => {
    const { cardState, gameState } = makeState({});
    expect(cardState).not.toHaveProperty('stoneSupply');
    expect(StoneSupply.getStoneSupplyRemaining(cardState, 'black')).toBeNull();
    expect(legalMovesFor(cardState, gameState, Shared.BLACK).length).toBeGreaterThan(0);
  });

  test('エントリ用の既定値は明示 false 以外 ON', () => {
    expect(StoneSupply.resolveStoneSupplyEnabledOption(undefined)).toBe(true);
    expect(StoneSupply.resolveStoneSupplyEnabledOption(true)).toBe(true);
    expect(StoneSupply.resolveStoneSupplyEnabledOption(false)).toBe(false);
  });

  test('通常配置で手番プレイヤーの持ち石だけが1個減り、コピーでも保持される', () => {
    const { cardState, gameState } = makeState();
    const move = legalMovesFor(cardState, gameState, Shared.BLACK)[0];
    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: move.row, col: move.col }, PRNG, { skipTurnStart: true });
    expect(res.cardState.stoneSupply.remainingByPlayer).toEqual({ black: 29, white: 30 });
    expect(CardLogic.copyCardState(res.cardState).stoneSupply).toEqual(res.cardState.stoneSupply);
  });

  test('持ち石0では合法手が無くなり、配置は拒否され、パスはできる', () => {
    const { cardState, gameState } = makeState();
    cardState.stoneSupply.remainingByPlayer.black = 0;
    expect(legalMovesFor(cardState, gameState, Shared.BLACK)).toEqual([]);
    expect(legalMovesFor(cardState, gameState, Shared.WHITE).length).toBeGreaterThan(0);
    expect(CardLogic.isPlacementLockedForPlayer(cardState, 'black')).toBe(true);
    expect(CardLogic.isPlacementLockedForPlayer(cardState, 'white')).toBe(false);

    const rejected = TurnPipeline.applyTurnSafe(cardState, gameState, 'black', { type: 'place', row: 2, col: 3 }, PRNG, { skipTurnStart: true });
    expect(rejected.ok).toBe(false);

    const passed = TurnPipeline.applyTurnSafe(cardState, gameState, 'black', { type: 'pass' }, PRNG, { skipTurnStart: true });
    expect(passed.ok).toBe(true);
    expect(passed.gameState.currentPlayer).toBe(Shared.WHITE);
  });

  test('投石連鎖は持ち石が尽きた時点で追加配置を終える', () => {
    const { cardState, gameState } = makeChainBoardState(2);
    cardState.stoneSupply.remainingByPlayer.black = 1;
    cardState.pendingEffectByPlayer.black = { type: 'DOUBLE_PLACE', stage: 'awaitPlace' };

    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 1, col: 6 }, PRNG, { skipTurnStart: true });
    expect(res.cardState.stoneSupply.remainingByPlayer.black).toBe(0);
    expect(res.cardState.extraPlaceRemainingByPlayer.black).toBe(0);
    expect(res.gameState.currentPlayer).toBe(Shared.WHITE);
  });

  test('持ち石0では次に置く石へ効果を付けるカードも使えないが、対象選択カードは使える', () => {
    const { cardState, gameState } = makeState();
    cardState.charge.black = 99;
    cardState.hands.black = ['hard_01', 'gold_stone', 'destroy_01'];
    cardState.stoneSupply.remainingByPlayer.black = 0;
    const usable = CardLogic.getUsableCardIds(cardState, gameState, 'black');
    expect(usable).not.toContain('hard_01');
    expect(usable).not.toContain('gold_stone');
    expect(usable).toContain('destroy_01');
  });

  test('両者の持ち石が0になった配置では即終局せず、両者とも合法手0になる', () => {
    const { cardState, gameState } = makeState();
    cardState.stoneSupply.remainingByPlayer.black = 1;
    cardState.stoneSupply.remainingByPlayer.white = 1;
    const blackMove = legalMovesFor(cardState, gameState, Shared.BLACK)[0];
    const afterBlack = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: blackMove.row, col: blackMove.col }, PRNG, { skipTurnStart: true });
    expect(afterBlack.cardState.stoneSupply.remainingByPlayer).toEqual({ black: 0, white: 1 });
    expect(Core.isGameOver(afterBlack.gameState)).toBe(false);

    const whiteMove = legalMovesFor(afterBlack.cardState, afterBlack.gameState, Shared.WHITE)[0];
    const afterWhite = TurnPipeline.applyTurn(afterBlack.cardState, afterBlack.gameState, 'white', { type: 'place', row: whiteMove.row, col: whiteMove.col }, PRNG, { skipTurnStart: true });
    expect(afterWhite.cardState.stoneSupply.remainingByPlayer).toEqual({ black: 0, white: 0 });
    expect(afterWhite.gameState.consecutivePasses).toBe(0);
    expect(Core.isGameOver(afterWhite.gameState)).toBe(false);
    expect(afterWhite.gameState.endedByStoneSupply).toBeUndefined();
    expect(afterWhite.events).toContainEqual(expect.objectContaining({ type: 'stone_supply_exhausted_all', player: 'white' }));
    expect(afterBlack.events).not.toContainEqual(expect.objectContaining({ type: 'stone_supply_exhausted_all' }));
    expect(legalMovesFor(afterWhite.cardState, afterWhite.gameState, Shared.BLACK)).toHaveLength(0);
    expect(legalMovesFor(afterWhite.cardState, afterWhite.gameState, Shared.WHITE)).toHaveLength(0);
  });

  test('両者の持ち石が0でも、使用可能カードが無くなるまでは連続パスで終局しない', () => {
    const { cardState, gameState } = makeState();
    cardState.stoneSupply.remainingByPlayer.black = 0;
    cardState.stoneSupply.remainingByPlayer.white = 0;
    cardState.charge.black = 99;
    cardState.charge.white = 99;
    cardState.hands.black = [];
    cardState.hands.white = ['destroy_01'];
    gameState.currentPlayer = Shared.BLACK;
    gameState.consecutivePasses = 1;

    const blackPass = TurnPipeline.applyTurnSafe(cardState, gameState, 'black', { type: 'pass', autoNoActionPass: true }, PRNG, { skipTurnStart: true });
    expect(blackPass.ok).toBe(true);
    expect(blackPass.gameState.consecutivePasses).toBe(1);
    expect(Core.isGameOver(blackPass.gameState)).toBe(false);

    blackPass.cardState.hands.white = [];
    const whitePass = TurnPipeline.applyTurnSafe(blackPass.cardState, blackPass.gameState, 'white', { type: 'pass', autoNoActionPass: true }, PRNG, { skipTurnStart: true });
    expect(whitePass.ok).toBe(true);
    expect(whitePass.gameState.consecutivePasses).toBe(2);
    expect(Core.isGameOver(whitePass.gameState)).toBe(true);
  });

  test('使用後に配置待ちになるカードは、すべて持ち石切れで使用不可の一覧に含まれる', () => {
    const SeededPRNG = require('../game/schema/prng');
    const catalog = require('../cards/catalog.json');
    const cards = Array.isArray(catalog) ? catalog : (catalog.cards || Object.values(catalog));
    // 使用時に即解決し、配置を待たないが pending を一時的に残すカード
    const resolvesWithoutPlacement = new Set(['CHAOS_SUMMON']);
    const catalogTypes = new Set<string>();
    const awaitingPlacement: string[] = [];
    for (const card of cards) {
      if (!card || !card.type || catalogTypes.has(card.type)) continue;
      catalogTypes.add(card.type);
      const prng = SeededPRNG.createPRNG(7);
      const cardState = CardLogic.createCardState(prng, {});
      cardState.debugNoDraw = true;
      cardState.charge.black = 99;
      cardState.turnIndex = 50;
      cardState.hands.black = [card.id];
      const res = TurnPipeline.applyTurnSafe(cardState, Core.createGameState(), 'black', { type: 'use_card', useCardId: card.id, useCardOwnerKey: 'black' }, prng, { skipTurnStart: true });
      const pending = res.ok ? res.cardState.pendingEffectByPlayer.black : null;
      if (pending && pending.stage !== 'selectTarget' && !resolvesWithoutPlacement.has(card.type)) {
        awaitingPlacement.push(card.type);
      }
    }
    expect(awaitingPlacement.length).toBeGreaterThan(0);
    expect(awaitingPlacement.filter((type) => !StoneSupply.isStonePlacementCardType(type))).toEqual([]);
    expect(Array.from(StoneSupply.STONE_PLACEMENT_CARD_TYPES).filter((type) => !catalogTypes.has(type))).toEqual([]);
  });

  test('通常合法手が無いときは、次に置く石へ効果を付けるカードは使えないが、自由配置と対象選択カードは使える', () => {
    const { cardState } = makeState();
    cardState.charge.black = 99;
    cardState.hands.black = ['hard_01', 'double_01', 'free_01', 'destroy_01'];
    const gameState: any = {
      board: Array.from({ length: 8 }, () => Array(8).fill(Shared.WHITE)),
      currentPlayer: Shared.BLACK,
      turnNumber: 1,
      consecutivePasses: 0
    };
    gameState.board[0][0] = Shared.EMPTY;
    expect(legalMovesFor(cardState, gameState, Shared.BLACK)).toHaveLength(0);
    const usable = CardLogic.getUsableCardIds(cardState, gameState, 'black');
    expect(usable).not.toContain('hard_01');
    expect(usable).not.toContain('double_01');
    expect(usable).toContain('free_01');
    expect(usable).toContain('destroy_01');

    // 合法手がある盤面なら同じ手札をすべて使える
    const openState = Core.createGameState();
    const usableOpen = CardLogic.getUsableCardIds(cardState, openState, 'black');
    expect(usableOpen).toContain('hard_01');
    expect(usableOpen).toContain('double_01');
  });

  test('両者の持ち石が0になった後はターン開始時にドローしない', () => {
    const TurnPipelinePhases = require('../game/turn/turn_pipeline_phases.js');
    const { cardState, gameState } = makeState();
    cardState.debugNoDraw = false;
    cardState.decks.black = ['chest_01', 'chest_01'];
    cardState.hands.black = [];
    cardState.stoneSupply.remainingByPlayer.black = 0;
    cardState.stoneSupply.remainingByPlayer.white = 1;
    TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', [], PRNG);
    expect(cardState.hands.black).toHaveLength(1);

    cardState.stoneSupply.remainingByPlayer.white = 0;
    cardState.lastTurnStartedFor = null;
    TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', [], PRNG);
    expect(cardState.hands.black).toHaveLength(1);
    expect(cardState.decks.black).toHaveLength(1);
  });

  test('持ち石0では石を置くカードを使用できない', () => {
    const { cardState, gameState } = makeState();
    cardState.charge.black = 99;
    cardState.hands.black = ['double_01'];
    expect(CardLogic.getUsableCardIds(cardState, gameState, 'black')).toContain('double_01');

    cardState.stoneSupply.remainingByPlayer.black = 0;
    expect(CardLogic.getUsableCardIds(cardState, gameState, 'black')).not.toContain('double_01');
    expect(CardLogic.applyCardUsage(cardState, 'black', 'double_01')).toBe(false);
  });
});
