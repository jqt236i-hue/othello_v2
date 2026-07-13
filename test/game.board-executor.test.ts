import * as Shared from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';
import * as TurnPipeline from '../game/turn/turn_pipeline.js';
import * as BoardCharge from '../game/turn/board-charge.js';
import * as PipelineUiAdapter from '../game/turn/pipeline_ui_adapter.js';

function createPrng(): any {
  return {
    shuffle: (arr: any[]) => arr,
    random: () => 0
  };
}

function createGameState(): any {
  return {
    board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  };
}

function setupOpeningBoard(gameState: any): void {
  gameState.board[3][3] = Shared.WHITE;
  gameState.board[3][4] = Shared.BLACK;
  gameState.board[4][3] = Shared.BLACK;
  gameState.board[4][4] = Shared.WHITE;
}

function addStone(cardState: any, gameState: any, row: number, col: number, owner: 'black' | 'white', type: string, kind = 'specialStone', data: any = {}): void {
  gameState.board[row][col] = owner === 'black' ? Shared.BLACK : Shared.WHITE;
  cardState.markers.push({
    id: `${type}_${row}_${col}`,
    kind,
    row,
    col,
    owner,
    data: { type, ...data }
  });
}

function addBoardExecutorRequirementStones(cardState: any, gameState: any): void {
  addStone(cardState, gameState, 0, 0, 'black', 'PROTECTED');
  addStone(cardState, gameState, 0, 1, 'white', 'TRAP', 'specialStone', { hidden: true });
  addStone(cardState, gameState, 0, 2, 'black', 'TIME_BOMB', 'bomb', { category: 'bomb', remainingTurns: 2 });
}

function hasMarker(cardState: any, type: string): boolean {
  return (cardState.markers || []).some((marker: any) => marker && marker.data && marker.data.type === type);
}

const PREVIOUS_BOARD_EXECUTOR_FLIP_GAIN_SOURCE_TYPES = [
  'placement_flip_gain',
  'reverse_will_flip_gain',
  'dragon_immediate',
  'dragon_turn_start',
  'breeding_immediate',
  'breeding_turn_start',
  'hyperactive_turn_start',
  'robot_vacuum_turn_start',
  'ultimate_hyperactive_turn_start',
  'instant_hyperactive_immediate',
  'regen_capture_immediate',
  'regen_capture_turn_start',
  'seed_turn_start',
  'proliferation_turn_start',
  'stone_salvation_god_turn_start',
  'generated_spawn_turn_start',
  'clone_will_selection',
  'proliferation_immediate',
  'stone_salvation_god_immediate',
  'generated_spawn_immediate',
  'equality_will_immediate',
  'reinforcement_will_immediate',
  'support_troops_will_immediate',
  'salvation_will_immediate'
];

describe('盤界の執行者', () => {
  test('手札上の使用可否に、所有者を問わない特殊石3個条件を反映する', () => {
    const prng = createPrng();
    const cardState: any = CardLogic.createCardState(prng);
    const gameState = createGameState();
    cardState.hands.black = ['board_executor_01'];
    cardState.charge.black = 0;

    expect(CardLogic.canUseCard(cardState, 'black', 'board_executor_01')).toBe(false);

    addStone(cardState, gameState, 0, 0, 'black', 'PROTECTED');
    addStone(cardState, gameState, 0, 1, 'white', 'TRAP', 'specialStone', { hidden: true });

    expect(CardLogic.canUseCard(cardState, 'black', 'board_executor_01')).toBe(false);

    addStone(cardState, gameState, 0, 2, 'black', 'TIME_BOMB', 'bomb', { category: 'bomb', remainingTurns: 2 });

    expect(CardLogic.canUseCard(cardState, 'black', 'board_executor_01')).toBe(true);
  });

  test('特殊石が3個未満では使用できず、3個になると使用できる', () => {
    const prng = createPrng();
    const cardState: any = CardLogic.createCardState(prng);
    const gameState = createGameState();
    cardState.hands.black = ['board_executor_01'];
    cardState.charge.black = 0;

    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', 'board_executor_01', null, { prng })).toBe(false);

    cardState.hands.black = ['board_executor_01'];
    addBoardExecutorRequirementStones(cardState, gameState);

    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', 'board_executor_01', null, { prng })).toBe(true);
  });

  test('使用時に罠・爆弾・強い石を含む全特殊石を穴にする', () => {
    const prng = createPrng();
    const cardState: any = CardLogic.createCardState(prng);
    const gameState = createGameState();
    cardState.hands.black = ['board_executor_01'];
    cardState.charge.black = 0;

    addStone(cardState, gameState, 1, 1, 'black', 'PROTECTED');
    addStone(cardState, gameState, 2, 2, 'white', 'PERMA_PROTECTED');
    addStone(cardState, gameState, 3, 3, 'white', 'TRAP', 'specialStone', { hidden: true });
    addStone(cardState, gameState, 4, 4, 'white', 'TIME_BOMB', 'bomb', { category: 'bomb', remainingTurns: 2 });

    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', 'board_executor_01', null, { prng })).toBe(true);

    for (const [row, col] of [[1, 1], [2, 2], [3, 3], [4, 4]]) {
      expect(gameState.board[row][col]).toBe(Shared.EMPTY);
    }
    expect(hasMarker(cardState, 'PROTECTED')).toBe(false);
    expect(hasMarker(cardState, 'PERMA_PROTECTED')).toBe(false);
    expect(hasMarker(cardState, 'TRAP')).toBe(false);
    expect(hasMarker(cardState, 'TIME_BOMB')).toBe(false);
    expect((cardState.markers || []).filter((marker: any) => marker && marker.data && marker.data.type === 'METEOR_HOLE')).toHaveLength(4);
  });

  test('使用演出の後に特殊石穴化の再生イベントを出す', () => {
    const prng = createPrng();
    const cardState: any = CardLogic.createCardState(prng);
    const gameState = createGameState();
    cardState.hands.black = ['board_executor_01'];
    cardState.charge.black = 99;
    addBoardExecutorRequirementStones(cardState, gameState);

    const result = PipelineUiAdapter.runTurnWithAdapter(
      cardState,
      gameState,
      'black',
      { type: 'use_card', useCardId: 'board_executor_01', useCardOwnerKey: 'black' },
      TurnPipeline
    );

    expect(result.ok).toBe(true);
    const cardUse = result.playbackEvents.find((event: any) => event && event.type === 'card_use_animation');
    const cinematic = result.playbackEvents.find((event: any) => event && event.type === 'special_card_cinematic');
    const holeEvents = result.playbackEvents.filter((event: any) => (
      event &&
      (event.type === 'destroy' || event.type === 'status_applied') &&
      (
        String(event.meta && event.meta.cellRemovalCause || '').toUpperCase() === 'BOARD_EXECUTOR' ||
        (Array.isArray(event.targets) && event.targets.some((target: any) => (
          target &&
          (
            String(target.cause || '').toUpperCase() === 'BOARD_EXECUTOR' ||
            String(target.meta && target.meta.cellRemovalCause || '').toUpperCase() === 'BOARD_EXECUTOR'
          )
        )))
      )
    ));

    expect(cardUse).toBeTruthy();
    expect(cinematic).toBeTruthy();
    expect(holeEvents.length).toBeGreaterThan(0);
    expect(holeEvents.every((event: any) => Number(event.phase) > Number(cinematic.phase))).toBe(true);
  });

  test('使用後の次配置で4ターン不可侵の顕現石になり、両者の手札カード使用を封じる', () => {
    const prng = createPrng();
    const cardState: any = CardLogic.createCardState(prng);
    const gameState = createGameState();
    cardState.hands.black = ['board_executor_01'];
    cardState.hands.white = ['guard_01'];
    cardState.charge.black = 0;
    cardState.charge.white = 10;
    addBoardExecutorRequirementStones(cardState, gameState);

    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', 'board_executor_01', null, { prng })).toBe(true);
    expect(cardState.nextBoardExecutorStoneByPlayer.black).toEqual(expect.objectContaining({ sourceType: 'BOARD_EXECUTOR' }));

    cardState.pendingEffectByPlayer.black = { type: 'FREE_PLACEMENT', stage: 'awaitPlace' };
    gameState.currentPlayer = Shared.BLACK;
    const placed = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 2, col: 3 }, prng, { skipTurnStart: true });

    expect(placed.events).toContainEqual(expect.objectContaining({ type: 'board_executor_marker_applied' }));
    const marker = cardState.markers.find((entry: any) => entry && entry.data && entry.data.type === 'BOARD_EXECUTOR');
    expect(marker).toEqual(expect.objectContaining({ kind: 'manifestStone', row: 2, col: 3, owner: 'black' }));
    expect(marker.data).toEqual(expect.objectContaining({ remainingOwnerTurns: 4, inviolable: true }));
    expect(CardLogic.canUseCard(cardState, 'black', 'guard_01')).toBe(false);
    expect(CardLogic.canUseCard(cardState, 'white', 'guard_01')).toBe(false);
  });

  test('使用直後の通常配置で顕現石を置ける', () => {
    const prng = createPrng();
    const cardState: any = CardLogic.createCardState(prng);
    const gameState = createGameState();
    setupOpeningBoard(gameState);
    cardState.hands.black = ['board_executor_01'];
    cardState.charge.black = 0;
    addBoardExecutorRequirementStones(cardState, gameState);

    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', 'board_executor_01', null, { prng })).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();

    gameState.currentPlayer = Shared.BLACK;
    const placed = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 2, col: 3 }, prng, { skipTurnStart: true });

    expect(placed.events).toContainEqual(expect.objectContaining({ type: 'board_executor_marker_applied' }));
    const marker = cardState.markers.find((entry: any) => entry && entry.data && entry.data.type === 'BOARD_EXECUTOR');
    expect(marker).toEqual(expect.objectContaining({ kind: 'manifestStone', row: 2, col: 3, owner: 'black' }));
  });

  test('両者のターン開始時にドロー前の手札枚数を基準に布石を失う', () => {
    const prng = createPrng();
    const cardState: any = CardLogic.createCardState(prng);
    const gameState = createGameState();
    cardState.debugNoDraw = false;
    cardState.charge.black = 30;
    cardState.charge.white = 30;
    cardState.hands.black = ['c1', 'c2', 'c3'];
    cardState.hands.white = ['w1', 'w2'];
    cardState.decks.black = ['drawn_black'];
    cardState.decks.white = ['drawn_white'];
    cardState.turnCountByPlayer.black = 0;
    cardState.turnCountByPlayer.white = 0;
    cardState.markers.push({
      id: 'executor',
      kind: 'manifestStone',
      row: 0,
      col: 0,
      owner: 'black',
      data: { type: 'BOARD_EXECUTOR', remainingOwnerTurns: 4, inviolable: true }
    });

    CardLogic.onTurnStart(cardState, 'white', gameState, prng);
    expect(cardState.charge.white).toBe(29);
    expect(cardState.hands.white).toHaveLength(3);

    CardLogic.onTurnStart(cardState, 'black', gameState, prng);
    expect(cardState.charge.black).toBe(26);
    expect(cardState.hands.black).toHaveLength(4);
  });

  test('ターン開始時の手札税はmax(0, N-1)^2で増える', () => {
    const prng = createPrng();
    const gameState = createGameState();
    const cases = [
      { handCount: 0, expectedLost: 0 },
      { handCount: 1, expectedLost: 0 },
      { handCount: 2, expectedLost: 1 },
      { handCount: 3, expectedLost: 4 },
      { handCount: 4, expectedLost: 9 },
      { handCount: 5, expectedLost: 16 }
    ];

    for (const { handCount, expectedLost } of cases) {
      const cardState: any = CardLogic.createCardState(prng);
      cardState.charge.black = 30;
      cardState.hands.black = Array.from({ length: handCount }, (_, index) => `c${index}`);
      cardState.markers.push({
        id: `executor_${handCount}`,
        kind: 'manifestStone',
        row: 0,
        col: 0,
        owner: 'black',
        data: { type: 'BOARD_EXECUTOR', remainingOwnerTurns: 4, inviolable: true }
      });

      const res = CardLogic.processBoardExecutorHandTaxAtTurnStart(cardState, gameState, 'black', prng);

      expect(res).toEqual(expect.objectContaining({
        applied: true,
        handCount,
        lost: expectedLost
      }));
      expect(cardState.charge.black).toBe(30 - expectedLost);
    }
  });

  test('所有者の反転布石を倍化せず、数字マス布石も通常どおり獲得する', () => {
    const prng = createPrng();
    const cardState: any = CardLogic.createCardState(prng);
    const gameState = createGameState();
    cardState.charge.black = 0;
    cardState.charge.white = 0;
    cardState.markers.push({
      id: 'executor',
      kind: 'manifestStone',
      row: 0,
      col: 0,
      owner: 'black',
      data: { type: 'BOARD_EXECUTOR', remainingOwnerTurns: 4, inviolable: true }
    });

    const placementEffects = CardLogic.applyPlacementEffects(cardState, gameState, 'black', 2, 3, 3, prng);
    expect(placementEffects.chargeGained).toBe(3);
    expect(cardState.charge.black).toBe(3);

    const boardBonusGained = BoardCharge.applyPlacementBoardBonusGain(CardLogic, cardState, 'black', 2, 3, 5, 0, {
      CardUtilsModule: {
        addChargeWithDelta: CardLogic.addChargeValue
      },
      chargeMax: 99,
      emitBoardChargeBubblePresentation: jest.fn()
    } as any);
    expect(boardBonusGained).toBe(5);
    expect(cardState.charge.black).toBe(8);

    const opponentEffects = CardLogic.applyPlacementEffects(cardState, gameState, 'white', 2, 4, 3, prng);
    expect(opponentEffects.chargeGained).toBe(3);
    expect(cardState.charge.white).toBe(3);
  });

  test.each(PREVIOUS_BOARD_EXECUTOR_FLIP_GAIN_SOURCE_TYPES)(
    '旧倍化対象の盤面布石イベントを倍化しない: %s',
    (sourceType) => {
      const prng = createPrng();
      const cardState: any = CardLogic.createCardState(prng);
      const emitted = jest.fn();
      cardState.charge.black = 0;
      cardState.markers.push({
        id: `executor_${sourceType}`,
        kind: 'manifestStone',
        row: 0,
        col: 0,
        owner: 'black',
        data: { type: 'BOARD_EXECUTOR', remainingOwnerTurns: 4, inviolable: true }
      });

      const gained = BoardCharge.awardBoardChargeGain(CardLogic, cardState, 'black', 2, {
        targetRow: 2,
        targetCol: 3,
        sourceType
      }, {
        CardUtilsModule: {
          addChargeWithDelta: CardLogic.addChargeValue
        },
        chargeMax: 99,
        emitBoardChargeBubblePresentation: emitted
      } as any);

      expect(gained).toBe(2);
      expect(cardState.charge.black).toBe(2);
      expect(cardState.chargeGainedTotal.black).toBe(2);
      expect(emitted).toHaveBeenCalledWith(CardLogic, cardState, expect.objectContaining({
        player: 'black',
        row: 2,
        col: 3,
        gained: 2,
        sourceType
      }));
    }
  );
});
