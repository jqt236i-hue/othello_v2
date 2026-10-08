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

  test('両者の持ち石が0でも即終局せず、先にパスされた側は最後の手番でカードを使ってからパスで終局する', () => {
    const { cardState, gameState } = makeState();
    cardState.stoneSupply.remainingByPlayer.black = 0;
    cardState.stoneSupply.remainingByPlayer.white = 0;
    cardState.charge.black = 99;
    cardState.charge.white = 99;
    cardState.hands.black = [];
    cardState.hands.white = ['chest_01'];
    gameState.currentPlayer = Shared.BLACK;
    gameState.consecutivePasses = 0;

    const blackPass = TurnPipeline.applyTurnSafe(cardState, gameState, 'black', { type: 'pass', autoNoActionPass: true }, PRNG, { skipTurnStart: true });
    expect(blackPass.ok).toBe(true);
    expect(blackPass.gameState.consecutivePasses).toBe(1);
    expect(Core.isGameOver(blackPass.gameState)).toBe(false);
    expect(CardLogic.hasUsableCard(blackPass.cardState, blackPass.gameState, 'white')).toBe(true);

    const whiteCard = TurnPipeline.applyTurnSafe(blackPass.cardState, blackPass.gameState, 'white', { type: 'use_card', useCardId: 'chest_01' }, PRNG, { skipTurnStart: true });
    expect(whiteCard.ok).toBe(true);
    expect(whiteCard.cardState.discard).toContain('chest_01');
    expect(Core.isGameOver(whiteCard.gameState)).toBe(false);

    // 01-rulebook.md §8.2: 2回目のパスで終局する（カード使用ではパス数は戻らない）。
    const whitePass = TurnPipeline.applyTurnSafe(whiteCard.cardState, whiteCard.gameState, 'white', { type: 'pass', autoNoActionPass: true }, PRNG, { skipTurnStart: true });
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

  // 01-rulebook.md §9: 置ける場所が無い手番に使えないのは、使っても何も起きないことが確実なカードだけ。
  function noLegalMoveState(hand: string[]) {
    const { cardState } = makeState();
    cardState.charge.black = 99;
    cardState.hands.black = [];
    cardState._handCopyIdsByPlayer = { black: [], white: [] };
    for (const cardId of hand) CardLogic.addCardToHand(cardState, 'black', cardId);
    const gameState: any = {
      board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
      currentPlayer: Shared.BLACK,
      turnNumber: 30,
      consecutivePasses: 0
    };
    gameState.board[0][0] = Shared.WHITE;
    gameState.board[0][1] = Shared.WHITE;
    gameState.board[1][0] = Shared.WHITE;
    gameState.board[1][1] = Shared.WHITE;
    gameState.board[7][5] = Shared.BLACK;
    gameState.board[7][6] = Shared.BLACK;
    gameState.board[7][7] = Shared.BLACK;
    return { cardState, gameState };
  }

  test('置ける場所が無いときは、効果ゼロが確実なカードだけ使えず、少しでも効果が出るカードは使える', () => {
    const ambiguousOrUseful = [
      'free_01', 'sniper_01', 'udr_01', 'udg_01', 'taboo_reverse_01',
      'double_01', 'triple_01', 'quad_01', 'double_chain_01', 'triple_chain_01', 'quad_chain_01',
      'time_stop_god_01', 'gluttonous_will_01', 'destroy_01', 'chest_01'
    ];
    const noEffect = ['hard_01', 'perma_01', 'infinite_01', 'infinite_chain_01', 'work_01', 'ultimate_work_god_01', 'crystal_stone', 'gold_stone', 'meteor_god_01'];
    // 手札は最大5枚なので、1枚ずつ別の盤面で確かめる。
    const usableWithoutLegalMove = (cardId: string) => {
      const { cardState, gameState } = noLegalMoveState([cardId]);
      expect(cardState.hands.black).toEqual([cardId]);
      expect(legalMovesFor(cardState, gameState, Shared.BLACK)).toHaveLength(0);
      return CardLogic.getUsableCardIds(cardState, gameState, 'black').includes(cardId);
    };
    for (const cardId of ambiguousOrUseful) expect([cardId, usableWithoutLegalMove(cardId)]).toEqual([cardId, true]);
    for (const cardId of noEffect) expect([cardId, usableWithoutLegalMove(cardId)]).toEqual([cardId, false]);

    // 置ける場所がある盤面なら同じカードは使える
    for (const cardId of noEffect) {
      const { cardState } = noLegalMoveState([cardId]);
      expect([cardId, CardLogic.getUsableCardIds(cardState, Core.createGameState(), 'black').includes(cardId)]).toEqual([cardId, true]);
    }
  });

  test('置ける場所が無いときに効果ゼロのカードだけを持っていれば、使えるカードは無い（自動パスになる）', () => {
    const { cardState, gameState } = noLegalMoveState(['hard_01', 'gold_stone']);
    expect(CardLogic.hasUsableCard(cardState, gameState, 'black')).toBe(false);
    const res = TurnPipeline.applyTurnSafe(cardState, gameState, 'black', { type: 'pass', autoNoActionPass: true }, PRNG, { skipTurnStart: true });
    expect(res.ok).toBe(true);
    expect(res.gameState.consecutivePasses).toBe(1);
  });

  test('効果ゼロの一覧は持ち石の一覧の内側にあり、曖昧なカードは含めない', () => {
    for (const type of StoneSupply.NO_EFFECT_WITHOUT_LEGAL_MOVE_CARD_TYPES) {
      expect(StoneSupply.isStonePlacementCardType(type)).toBe(true);
    }
    for (const type of [
      'LAST_RESORT', 'FREE_PLACEMENT', 'SNIPER_WILL', 'ULTIMATE_REVERSE_DRAGON', 'ULTIMATE_DESTROY_GOD', 'TABOO_REVERSE_WILL',
      'DOUBLE_PLACE', 'TRIPLE_PLACE', 'QUAD_PLACE', 'DOUBLE_CHAIN_WILL', 'TRIPLE_CHAIN_WILL', 'QUAD_CHAIN_WILL',
      'TIME_STOP_GOD', 'TIME_STOP_DEITY', 'GLUTTONOUS_WILL', 'BOARD_EXECUTOR', 'THEORY_INCARNATION'
    ]) {
      expect(StoneSupply.isNoEffectWithoutLegalMoveCardType(type)).toBe(false);
    }
    // 一覧に無いカード（新カードを含む）は既定で「使える」
    expect(StoneSupply.isNoEffectWithoutLegalMoveCardType('SOME_FUTURE_CARD')).toBe(false);
  });

  test('出稼ぎの意志の予約はパスで消え、後の手番の配置を出稼ぎ石にしない', () => {
    const run = (passFirst: boolean) => {
      const { cardState, gameState } = makeState();
      cardState.charge.black = 99;
      cardState.hands.black = [];
      cardState._handCopyIdsByPlayer = { black: [], white: [] };
      CardLogic.addCardToHand(cardState, 'black', 'work_01');
      const used = TurnPipeline.applyTurnSafe(cardState, gameState, 'black', { type: 'use_card', useCardId: 'work_01' }, PRNG, { skipTurnStart: true });
      expect(used.ok).toBe(true);
      expect(used.cardState.workNextPlacementArmedByPlayer.black).toBe(true);
      let cs = used.cardState;
      let gs = used.gameState;
      if (passFirst) {
        const blackPass = TurnPipeline.applyTurnSafe(cs, gs, 'black', { type: 'pass', forcePass: true, reason: 'timeout' }, PRNG, { skipTurnStart: true });
        expect(blackPass.ok).toBe(true);
        expect(blackPass.cardState.workNextPlacementArmedByPlayer.black).toBe(false);
        const whitePass = TurnPipeline.applyTurnSafe(blackPass.cardState, blackPass.gameState, 'white', { type: 'pass', forcePass: true }, PRNG, { skipTurnStart: true });
        cs = whitePass.cardState;
        gs = Core.copyGameState(whitePass.gameState);
        gs.consecutivePasses = 0;
        gs.currentPlayer = Shared.BLACK;
      }
      const move = legalMovesFor(cs, gs, Shared.BLACK)[0];
      const placed = TurnPipeline.applyTurnSafe(cs, gs, 'black', { type: 'place', row: move.row, col: move.col }, PRNG, { skipTurnStart: true });
      expect(placed.ok).toBe(true);
      return placed.cardState.workAnchorPosByPlayer ? placed.cardState.workAnchorPosByPlayer.black : null;
    };
    // パスせずに置けば出稼ぎ石になる（効果そのものは変わらない）
    expect(run(false)).toEqual(expect.objectContaining({ row: expect.any(Number), col: expect.any(Number) }));
    // パスを挟むと予約は破棄される（01-rulebook.md §9）
    expect(run(true)).toBeNull();
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
