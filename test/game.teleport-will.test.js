const CardLogic = require('../game/logic/cards');
const Core = require('../game/logic/core');
const SharedConstants = require('../shared-constants');

function createPrng(randomValue = 0.5) {
  return {
    shuffle: (arr) => arr,
    random: () => randomValue
  };
}

describe('TELEPORT_WILL（テレポート）', () => {
  test('カード定義が存在し、コスト10である', () => {
    const def = (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'TELEPORT_WILL');
    expect(def).toBeTruthy();
    expect(def.cost).toBe(10);
  });

  test('対象は敵味方を問わず盤面の全石。移動先が無い場合は対象がない', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.board[1][1] = Core.BLACK;
    gameState.board[2][2] = Core.WHITE;

    const targets = CardLogic.getTeleportTargets(cardState, gameState);
    expect(targets).toEqual([{ row: 1, col: 1 }, { row: 2, col: 2 }]);

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.BLACK));
    const noTargets = CardLogic.getTeleportTargets(cardState, gameState);
    expect(noTargets).toEqual([]);
  });

  test('選んだ石をランダム空きマスへ移動し、マーカーも追従する（反転なし）', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.WHITE));
    gameState.board[4][4] = Core.BLACK;
    gameState.board[1][1] = Core.EMPTY;
    gameState.board[2][2] = Core.EMPTY;

    // 1,1 は封鎖中にして移動先候補から除外
    cardState.markers.push({
      id: 'blockade_1',
      kind: 'specialStone',
      row: 1,
      col: 1,
      owner: 'black',
      data: { type: 'BLOCKADE', remainingOwnerTurns: 3 }
    });

    cardState.markers.push({
      id: 'bomb_1',
      kind: 'bomb',
      row: 4,
      col: 4,
      owner: 'black',
      data: { remainingTurns: 2 }
    });

    cardState.stoneIdMap[4][4] = 'tp1';
    cardState.stoneIdMap[2][2] = null;

    cardState.pendingEffectByPlayer.black = {
      type: 'TELEPORT_WILL',
      stage: 'selectTarget',
      cardId: 'teleport_01'
    };

    const res = CardLogic.applyTeleportWill(cardState, gameState, 'black', 4, 4, createPrng(0));

    expect(res && res.applied).toBe(true);
    expect(res.from).toEqual({ row: 4, col: 4 });
    expect(res.to).toEqual({ row: 2, col: 2 });

    expect(gameState.board[4][4]).toBe(Core.EMPTY);
    expect(gameState.board[2][2]).toBe(Core.BLACK);

    expect(cardState.stoneIdMap[4][4]).toBeNull();
    expect(cardState.stoneIdMap[2][2]).toBe('tp1');

    const movedBomb = cardState.markers.find((m) => m && m.id === 'bomb_1');
    expect(movedBomb).toBeTruthy();
    expect(movedBomb.row).toBe(2);
    expect(movedBomb.col).toBe(2);

    const moveEvents = (cardState._presentationEventsPersist || []).filter((ev) => ev && ev.type === 'MOVE');
    expect(moveEvents.length).toBeGreaterThanOrEqual(1);
    expect(moveEvents[0].cause).toBe('TELEPORT_WILL');
    expect(moveEvents[0].reason).toBe('teleport_move');

    expect(cardState.pendingEffectByPlayer.black).toBeNull();
  });
});
