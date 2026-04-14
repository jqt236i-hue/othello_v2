const CardLogic = require('../game/logic/cards');
const Core = require('../game/logic/core');
const TurnPipeline = require('../game/turn/turn_pipeline');
const PipelineUiAdapter = require('../game/turn/pipeline_ui_adapter');

describe('INSTANT_HYPERACTIVE_WILL（瞬間多動）', () => {
  function makePrng() {
    return {
      shuffle: (arr) => arr,
      random: () => 0
    };
  }

  test('applyPlacementEffects で瞬間多動フラグと多動石マーカーを付与する', () => {
    const prng = makePrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)), currentPlayer: 1 };

    gameState.board[3][3] = 1;
    cardState.pendingEffectByPlayer.black = {
      type: 'INSTANT_HYPERACTIVE_WILL',
      stage: null,
      cardId: 'instant_hyperactive_01'
    };

    const effects = CardLogic.applyPlacementEffects(cardState, gameState, 'black', 3, 3, 0);
    expect(effects && effects.hyperactivePlaced).toBe(true);
    expect(effects && effects.instantHyperactivePlaced).toBe(true);

    const marker = (cardState.markers || []).find(m =>
      m &&
      m.kind === 'specialStone' &&
      m.row === 3 &&
      m.col === 3 &&
      m.owner === 'black' &&
      m.data &&
      m.data.type === 'HYPERACTIVE'
    );
    expect(marker).toBeTruthy();
  });

  test('配置ターン内で3回移動し、最後に破壊で消滅する', () => {
    const prng = makePrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = Core.createGameState();

    // 1回目の移動先 (1,2) から右方向に挟みを作る
    gameState.board[1][3] = Core.WHITE;
    gameState.board[1][4] = Core.BLACK;

    cardState.pendingEffectByPlayer.black = {
      type: 'INSTANT_HYPERACTIVE_WILL',
      stage: null,
      cardId: 'instant_hyperactive_01'
    };

    const res = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 2, col: 3 },
      prng
    );

    const moved = (res.events || []).find(ev => ev && ev.type === 'hyperactive_moved_immediate');
    const flipped = (res.events || []).find(ev => ev && ev.type === 'hyperactive_flipped_immediate');
    const destroyed = (res.events || []).find(ev => ev && ev.type === 'hyperactive_destroyed_immediate');

    expect(moved && moved.details).toBeTruthy();
    expect(moved.details.length).toBe(3);
    expect(destroyed && destroyed.details).toBeTruthy();
    expect(destroyed.details.length).toBe(1);
    expect(flipped && flipped.details && flipped.details.length).toBeGreaterThanOrEqual(1);

    const marker = (cardState.markers || []).find(m =>
      m && m.kind === 'specialStone' && m.data && m.data.type === 'HYPERACTIVE'
    );
    expect(marker).toBeUndefined();
  });

  test('移動反転の布石ポップアップは最後の移動先をアンカーにする', () => {
    const prng = makePrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = Core.createGameState();

    gameState.board[1][3] = Core.WHITE;
    gameState.board[1][4] = Core.BLACK;

    cardState.pendingEffectByPlayer.black = {
      type: 'INSTANT_HYPERACTIVE_WILL',
      stage: null,
      cardId: 'instant_hyperactive_01'
    };

    const res = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 2, col: 3 },
      prng
    );

    const moved = (res.events || []).find(ev => ev && ev.type === 'hyperactive_moved_immediate');
    const bubble = (res.presentationEvents || []).find(ev => ev && ev.type === 'CHARGE_BUBBLE' && ev.meta && ev.meta.sourceType === 'instant_hyperactive_immediate');
    const lastMove = moved && Array.isArray(moved.details) ? moved.details[moved.details.length - 1] : null;

    expect(lastMove && lastMove.to).toBeTruthy();
    expect(bubble).toBeTruthy();
    expect({ row: bubble.row, col: bubble.col }).toEqual(lastMove.to);
  });

  test('playback move metadata keeps the hyperactive visual during immediate movement', () => {
    const prng = makePrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = Core.createGameState();

    gameState.board[1][3] = Core.WHITE;
    gameState.board[1][4] = Core.BLACK;

    cardState.pendingEffectByPlayer.black = {
      type: 'INSTANT_HYPERACTIVE_WILL',
      stage: null,
      cardId: 'instant_hyperactive_01'
    };

    const res = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 2, col: 3 },
      prng
    );

    const movePresentationEvents = (res.presentationEvents || []).filter((ev) => ev && ev.type === 'MOVE');
    expect(movePresentationEvents).toHaveLength(3);
    for (const ev of movePresentationEvents) {
      expect(ev.meta).toEqual(expect.objectContaining({
        special: 'HYPERACTIVE',
        owner: 'black'
      }));
    }

    const playback = PipelineUiAdapter.mapToPlaybackEvents(
      res.presentationEvents || [],
      cardState,
      gameState
    );
    const movePlaybackEvents = playback.filter((ev) => ev && ev.type === 'move');
    expect(movePlaybackEvents).toHaveLength(3);
    for (const ev of movePlaybackEvents) {
      expect(ev.targets[0].after).toMatchObject({
        color: Core.BLACK,
        special: 'HYPERACTIVE',
        owner: 'black'
      });
    }
  });

  test('通常の多動の意志は配置ターンで即時移動しない', () => {
    const prng = makePrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = Core.createGameState();

    cardState.pendingEffectByPlayer.black = {
      type: 'HYPERACTIVE_WILL',
      stage: null,
      cardId: 'hyperactive_01'
    };

    const res = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 2, col: 3 },
      prng
    );

    const movedImmediate = (res.events || []).find(ev => ev && ev.type === 'hyperactive_moved_immediate');
    expect(movedImmediate).toBeUndefined();

    const marker = (cardState.markers || []).find(m =>
      m && m.kind === 'specialStone' && m.row === 2 && m.col === 3 && m.data && m.data.type === 'HYPERACTIVE'
    );
    expect(marker).toBeTruthy();
  });
});
