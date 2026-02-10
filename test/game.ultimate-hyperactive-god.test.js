const CardLogic = require('../game/logic/cards');

describe('ULTIMATE_HYPERACTIVE_GOD', () => {
  function makeState() {
    const prng = { shuffle: (arr) => arr, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: 1
    };
    return { cardState, gameState };
  }

  test('applyPlacementEffects places ultimate hyperactive marker', () => {
    const { cardState, gameState } = makeState();
    gameState.board[3][3] = 1;
    cardState.pendingEffectByPlayer.black = {
      type: 'ULTIMATE_HYPERACTIVE_GOD',
      stage: null,
      cardId: 'ultimate_hyperactive_01'
    };

    const effects = CardLogic.applyPlacementEffects(cardState, gameState, 'black', 3, 3, 0);
    expect(effects && effects.ultimateHyperactivePlaced).toBe(true);

    const marker = (cardState.markers || []).find(m =>
      m &&
      m.kind === 'specialStone' &&
      m.row === 3 &&
      m.col === 3 &&
      m.owner === 'black' &&
      m.data &&
      m.data.type === 'ULTIMATE_HYPERACTIVE'
    );
    expect(marker).toBeTruthy();
  });

  test('moves exactly two times by one cell each when spaces remain', () => {
    const { cardState, gameState } = makeState();
    gameState.board[3][3] = 1;
    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'ULTIMATE_HYPERACTIVE' }
    });

    // First step: only (3,4) is empty around (3,3).
    for (const [r, c] of [[2,2], [2,3], [2,4], [3,2], [4,2], [4,3], [4,4]]) {
      gameState.board[r][c] = 1;
    }
    // Around (3,4), keep only (3,3) and (3,5) empty; choose (3,5) by PRNG.
    for (const [r, c] of [[2,5], [4,5]]) {
      gameState.board[r][c] = 1;
    }

    const seq = [0.0, 0.99];
    const prng = { random: () => (seq.length ? seq.shift() : 0.5) };
    const res = CardLogic.processUltimateHyperactiveMoveAtAnchor(cardState, gameState, 'black', 3, 3, prng);

    expect(res.destroyed).toEqual([]);
    expect(res.moved.length).toBe(2);
    for (const m of res.moved) {
      const manhattan = Math.abs(m.to.row - m.from.row) + Math.abs(m.to.col - m.from.col);
      expect(manhattan).toBe(1);
    }

    const marker = cardState.markers.find(m => m.kind === 'specialStone' && m.data && m.data.type === 'ULTIMATE_HYPERACTIVE');
    expect(marker.row).toBe(3);
    expect(marker.col).toBe(5);
    expect(gameState.board[3][5]).toBe(1);
  });

  test('self-destructs immediately when no adjacent empty cell exists', () => {
    const { cardState, gameState } = makeState();
    gameState.board[3][3] = 1;
    cardState.markers.push({
      id: 2,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'ULTIMATE_HYPERACTIVE' }
    });

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        gameState.board[3 + dr][3 + dc] = 1;
      }
    }

    const res = CardLogic.processUltimateHyperactiveMoveAtAnchor(cardState, gameState, 'black', 3, 3, { random: () => 0.1 });
    expect(res.moved).toEqual([]);
    expect(res.destroyed).toEqual([{ row: 3, col: 3 }]);
    expect(gameState.board[3][3]).toBe(0);
    const marker = cardState.markers.find(m => m.kind === 'specialStone' && m.data && m.data.type === 'ULTIMATE_HYPERACTIVE');
    expect(marker).toBeUndefined();
  });

  test('blows all adjacent enemies and gains +2 per successful blow (special/bomb included)', () => {
    const { cardState, gameState } = makeState();
    gameState.board[3][3] = 1;
    cardState.markers.push({
      id: 3,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'ULTIMATE_HYPERACTIVE' }
    });

    // Force first step destination to (3,4).
    for (const [r, c] of [[2,2], [2,3], [3,2], [4,2], [4,3]]) {
      gameState.board[r][c] = 1;
    }
    // Adjacent enemies at landing cell.
    gameState.board[2][4] = -1;
    gameState.board[4][4] = -1;
    // Blow options: (2,4) only up to (0,4), (4,4) only down to (6,4).
    gameState.board[2][5] = 1;
    gameState.board[4][5] = 1;
    gameState.board[1][4] = 0;
    gameState.board[0][4] = 0;
    gameState.board[5][4] = 0;
    gameState.board[6][4] = 0;

    cardState.markers.push({
      id: 31,
      kind: 'specialStone',
      row: 2,
      col: 4,
      owner: 'white',
      data: { type: 'WORK', remainingOwnerTurns: 2 }
    });
    cardState.markers.push({
      id: 32,
      kind: 'bomb',
      row: 4,
      col: 4,
      owner: 'white',
      data: { remainingTurns: 2 }
    });

    const res = CardLogic.processUltimateHyperactiveMoveAtAnchor(cardState, gameState, 'black', 3, 3, { random: () => 0.1 });
    const blownFrom = new Set((res.blown || []).map(b => `${b.from.row},${b.from.col}`));

    expect(blownFrom.has('2,4')).toBe(true);
    expect(blownFrom.has('4,4')).toBe(true);
    expect(res.chargeGain).toBeGreaterThanOrEqual(4);

    const movedSpecial = cardState.markers.find(m => m.id === 31);
    const movedBomb = cardState.markers.find(m => m.id === 32);
    expect(movedSpecial.row).toBe(0);
    expect(movedSpecial.col).toBe(4);
    expect(movedBomb.row).toBe(6);
    expect(movedBomb.col).toBe(4);
    expect(gameState.board[0][4]).toBe(-1);
    expect(gameState.board[6][4]).toBe(-1);
  });
});

