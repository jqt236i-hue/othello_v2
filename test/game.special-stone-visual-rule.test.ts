import * as Shared from '../shared-constants.js';
const CardUtils = require('../game/logic/cards/utils.js');
const CardLogic = require('../game/logic/cards.js');
function createCardState() {
  return {
    markers: [],
    pendingEffectByPlayer: { black: null, white: null }
  };
}

function createGameState() {
  return {
    board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
    currentPlayer: Shared.BLACK
  };
}

describe('special stone visual rule', () => {
  test('顕現石は特殊石本体ではないが絶対保護として扱われる', () => {
    const CardMarkers = require('../game/logic/cards/markers');
    const cardState = {
      markers: [
        { id: 1, kind: 'manifestStone', row: 2, col: 2, owner: 'black', data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 4, absoluteProtected: true } },
        { id: 2, kind: 'specialStone', row: 3, col: 3, owner: 'white', data: { type: 'DRAGON', remainingOwnerTurns: 5 } }
      ]
    };

    expect(CardMarkers.isManifestStoneAt(cardState, 2, 2)).toBe(true);
    expect(CardMarkers.isSpecialStoneAt(cardState, 2, 2)).toBe(false);
    expect(CardMarkers.isTrueSpecialStoneAt(cardState, 2, 2)).toBe(false);
    expect(CardMarkers.isAbsoluteProtectedCell(cardState, 2, 2)).toBe(true);
    expect(CardMarkers.isSpecialStoneAt(cardState, 3, 3)).toBe(true);
  });

  test('isSpecialStoneAt は通常石画像を使わない石を盤面上の特殊見た目として扱う', () => {
    const cardState = createCardState();
    cardState.markers.push(
      {
        id: 1,
        kind: 'specialStone',
        row: 1,
        col: 1,
        owner: 'white',
        data: { type: 'HYPERACTIVE', remainingOwnerTurns: 4 }
      },
      {
        id: 2,
        kind: 'specialStone',
        row: 1,
        col: 2,
        owner: 'white',
        data: { type: 'PROTECTED', remainingOwnerTurns: 2 }
      },
      {
        id: 3,
        kind: 'specialStone',
        row: 1,
        col: 3,
        owner: 'white',
        data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 3 }
      }
    );

    expect(CardUtils.isSpecialStoneAt(cardState, 1, 1)).toBe(true);
    expect(CardUtils.isNonNormalStoneVisualAt(cardState, 1, 1)).toBe(true);
    expect(CardUtils.getSpecialOwnerAt(cardState, 1, 1)).toBe('white');
    expect(CardUtils.isSpecialStoneAt(cardState, 1, 2)).toBe(true);
    expect(CardUtils.isNonNormalStoneVisualAt(cardState, 1, 2)).toBe(true);
    expect(CardUtils.getSpecialOwnerAt(cardState, 1, 2)).toBe('white');
    expect(CardUtils.isSpecialStoneAt(cardState, 1, 3)).toBe(true);
    expect(CardUtils.isNonNormalStoneVisualAt(cardState, 1, 3)).toBe(true);
    expect(CardUtils.getSpecialOwnerAt(cardState, 1, 3)).toBe('white');
  });

  test('盤面では通常石見た目の hidden trap は特殊石扱いしない', () => {
    const cardState = createCardState();
    cardState.markers.push({
      id: 4,
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'white',
      data: { type: 'TRAP', hidden: true }
    });

    expect(CardUtils.isSpecialStoneAt(cardState, 2, 2)).toBe(false);
    expect(CardUtils.isNonNormalStoneVisualAt(cardState, 2, 2)).toBe(false);
    expect(CardUtils.getSpecialOwnerAt(cardState, 2, 2)).toBe(null);
  });

  test('GUARD は特殊見た目として扱い、BLOCKADE と METEOR_HOLE は特殊見た目として扱わない', () => {
    const cardState = createCardState();
    cardState.markers.push(
      {
        id: 7,
        kind: 'specialStone',
        row: 2,
        col: 3,
        owner: 'white',
        data: { type: 'GUARD', remainingOwnerTurns: 3 }
      },
      {
        id: 8,
        kind: 'specialStone',
        row: 2,
        col: 4,
        owner: 'white',
        data: { type: 'BLOCKADE', remainingOwnerTurns: 3 }
      },
      {
        id: 9,
        kind: 'specialStone',
        row: 2,
        col: 5,
        owner: 'white',
        data: { type: 'METEOR_HOLE' }
      }
    );

    expect(CardUtils.isSpecialStoneAt(cardState, 2, 3)).toBe(true);
    expect(CardUtils.getSpecialOwnerAt(cardState, 2, 3)).toBe('white');
    expect(CardUtils.isSpecialStoneAt(cardState, 2, 4)).toBe(false);
    expect(CardUtils.isSpecialStoneAt(cardState, 2, 5)).toBe(false);
  });

  test('isNormalStoneForPlayer は hidden trap を通常石扱いする', () => {
    const cardState = createCardState();
    const gameState = createGameState();
    gameState.board[3][3] = Shared.BLACK;
    cardState.markers.push({
      id: 5,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'TRAP', hidden: true }
    });

    expect(CardUtils.isNormalStoneForPlayer(cardState, gameState, 'black', 3, 3)).toBe(true);
  });

  test('TEMPT_WILL は hidden trap を対象にでき、罠の所有者も変える', () => {
    const prng = { shuffle: (arr) => arr, random: () => 0 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = createGameState();
    gameState.board[4][4] = Shared.WHITE;
    cardState.pendingEffectByPlayer.black = { type: 'TEMPT_WILL', stage: 'selectTarget', cardId: 'tempt_01' };
    cardState.markers.push({
      id: 6,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'white',
      data: { type: 'TRAP', hidden: true }
    });

    expect(CardLogic.getTemptWillTargets(cardState, gameState, 'black')).toEqual([{ row: 4, col: 4 }]);

    const res = CardLogic.applyTemptWill(cardState, gameState, 'black', 4, 4);
    expect(res).toMatchObject({ applied: true });
    expect(gameState.board[4][4]).toBe(Shared.BLACK);
    expect(cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 4, col: 4, owner: 'black', data: expect.objectContaining({ type: 'TRAP' }) })
    ]));
  });

  test('TEMPT_WILL は時限爆弾・生きる意志を対象にでき、完全保護と配置時効果は対象外にする', () => {
    const prng = { shuffle: (arr) => arr, random: () => 0 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = createGameState();
    gameState.board[2][2] = Shared.WHITE;
    gameState.board[2][3] = Shared.WHITE;
    gameState.board[2][4] = Shared.WHITE;
    gameState.board[2][5] = Shared.WHITE;
    cardState.pendingEffectByPlayer.black = { type: 'TEMPT_WILL', stage: 'selectTarget', cardId: 'tempt_01' };
    cardState.markers.push(
      {
        id: 7,
        kind: 'specialStone',
        row: 2,
        col: 2,
        owner: 'white',
        data: { type: 'TIME_BOMB', category: 'bomb' }
      },
      {
        id: 8,
        kind: 'specialStone',
        row: 2,
        col: 3,
        owner: 'white',
        data: { type: 'GUARD', remainingOwnerTurns: 3 }
      },
      {
        id: 9,
        kind: 'specialStone',
        row: 2,
        col: 4,
        owner: 'white',
        data: { type: 'HYPERACTIVE', instantPlacementOnly: true }
      },
      {
        id: 10,
        kind: 'specialStone',
        row: 2,
        col: 5,
        owner: 'white',
        data: { type: 'LIVING_WILL', remainingOwnerTurns: 1 }
      }
    );

    expect(CardLogic.getTemptWillTargets(cardState, gameState, 'black')).toEqual([
      { row: 2, col: 2 },
      { row: 2, col: 5 }
    ]);

    const bombRes = CardLogic.applyTemptWill(cardState, gameState, 'black', 2, 2);
    expect(bombRes).toMatchObject({ applied: true });
    expect(gameState.board[2][2]).toBe(Shared.BLACK);
    expect(cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 2, col: 2, owner: 'black', data: expect.objectContaining({ type: 'TIME_BOMB' }) })
    ]));

    cardState.pendingEffectByPlayer.black = { type: 'TEMPT_WILL', stage: 'selectTarget', cardId: 'tempt_01' };
    const livingRes = CardLogic.applyTemptWill(cardState, gameState, 'black', 2, 5);
    expect(livingRes).toMatchObject({ applied: true });
    expect(gameState.board[2][5]).toBe(Shared.BLACK);
    expect(cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 2, col: 5, owner: 'black', data: expect.objectContaining({ type: 'LIVING_WILL' }) })
    ]));

    cardState.pendingEffectByPlayer.black = { type: 'TEMPT_WILL', stage: 'selectTarget', cardId: 'tempt_01' };
    expect(CardLogic.applyTemptWill(cardState, gameState, 'black', 2, 3)).toMatchObject({ applied: false, reason: 'guarded' });
    expect(CardLogic.applyTemptWill(cardState, gameState, 'black', 2, 4)).toMatchObject({ applied: false, reason: 'not_special' });
  });

  test('TEMPT_WILL は弱い石・強い石を特殊石対象にし、絶対保護石は対象一覧から除外する', () => {
    const prng = { shuffle: (arr) => arr, random: () => 0 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = createGameState();
    gameState.board[5][1] = Shared.WHITE;
    gameState.board[5][2] = Shared.WHITE;
    gameState.board[5][3] = Shared.WHITE;
    cardState.pendingEffectByPlayer.black = { type: 'TEMPT_WILL', stage: 'selectTarget', cardId: 'tempt_01' };
    cardState.markers.push(
      {
        id: 20,
        kind: 'specialStone',
        row: 5,
        col: 1,
        owner: 'white',
        data: { type: 'PROTECTED', sourceType: 'PROTECTED_NEXT_STONE', sourceCardId: 'hard_01' }
      },
      {
        id: 21,
        kind: 'specialStone',
        row: 5,
        col: 2,
        owner: 'white',
        data: { type: 'PERMA_PROTECTED', sourceType: 'PERMA_PROTECT_NEXT_STONE', sourceCardId: 'perma_01' }
      },
      {
        id: 22,
        kind: 'specialStone',
        row: 5,
        col: 3,
        owner: 'white',
        data: { type: 'ABSOLUTE_PROTECTED', sourceType: 'PERMA_PROTECT_NEXT_STONE', sourceCardId: 'perma_01' }
      }
    );

    expect(CardUtils.isTrueSpecialStoneAt(cardState, 5, 1)).toBe(true);
    expect(CardUtils.isTrueSpecialStoneAt(cardState, 5, 2)).toBe(true);
    expect(CardUtils.isTrueSpecialStoneAt(cardState, 5, 3)).toBe(true);
    expect(CardUtils.isAbsoluteProtectedStoneAt(cardState, 5, 3)).toBe(true);
    expect(CardLogic.getTemptWillTargets(cardState, gameState, 'black')).toEqual([
      { row: 5, col: 1 },
      { row: 5, col: 2 }
    ]);

    expect(CardLogic.applyTemptWill(cardState, gameState, 'black', 5, 3)).toMatchObject({
      applied: false,
      reason: 'absolute_protected'
    });
  });

  test('TEMPT_WILL は幽体を対象にでき、幽体のまま自分側へ変える', () => {
    const prng = { shuffle: (arr) => arr, random: () => 0 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = createGameState();
    gameState.board[6][1] = Shared.WHITE;
    cardState.pendingEffectByPlayer.black = { type: 'TEMPT_WILL', stage: 'selectTarget', cardId: 'tempt_01' };
    cardState.markers.push({
      id: 30,
      kind: 'specialStone',
      row: 6,
      col: 1,
      owner: 'white',
      data: { type: 'GHOST', remainingOwnerTurns: 5 }
    });

    expect(CardLogic.getTemptWillTargets(cardState, gameState, 'black')).toEqual(expect.arrayContaining([{ row: 6, col: 1 }]));
    const res = CardLogic.applyTemptWill(cardState, gameState, 'black', 6, 1);
    expect(res).toMatchObject({ applied: true });
    expect(res.blockedByGhost).toBeUndefined();
    expect(gameState.board[6][1]).toBe(Shared.BLACK);
    expect(cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 6, col: 1, owner: 'black', data: expect.objectContaining({ type: 'GHOST' }) })
    ]));
  });
});
