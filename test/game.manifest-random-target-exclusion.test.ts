import * as Shared from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';

function createPrng(values: number | number[] = 0) {
  const sequence = Array.isArray(values) ? values.slice() : [values];
  let index = 0;
  return {
    shuffle: (arr: any[]) => arr,
    random: () => {
      const value = sequence[Math.min(index, sequence.length - 1)];
      index += 1;
      return value;
    },
    get calls() {
      return index;
    }
  };
}

function createStates(randomValue: number | number[] = 0) {
  const prng = createPrng(randomValue);
  const cardState = CardLogic.createCardState(prng);
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  };
  return { cardState, gameState, prng };
}

function addManifestStone(cardState: any, gameState: any, row: number, col: number, owner: 'black' | 'white' = 'white', kind = 'manifestStone') {
  gameState.board[row][col] = owner === 'black' ? Shared.BLACK : Shared.WHITE;
  cardState.markers.push({
    id: `manifest-${row}-${col}`,
    kind,
    row,
    col,
    owner,
    data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 3 }
  });
}

describe('manifest stones are excluded from random stone targets', () => {
  test('LIGHTNING_WILL skips manifestation stones when choosing a random enemy', () => {
    const { cardState, gameState, prng } = createStates(0);
    gameState.board[0][0] = Shared.BLACK;
    addManifestStone(cardState, gameState, 1, 1);
    gameState.board[2][2] = Shared.WHITE;
    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 0,
      col: 0,
      owner: 'black',
      data: { type: 'LIGHTNING', remainingOwnerTurns: 6 }
    });

    const out = CardLogic.processLightningWillEffectsAtTurnStartAnchor(cardState, gameState, 'black', 0, 0, prng);

    expect(out.destroyed).toEqual([expect.objectContaining({ row: 2, col: 2 })]);
    expect(gameState.board[1][1]).toBe(Shared.WHITE);
    expect(gameState.board[2][2]).toBe(Shared.EMPTY);
  });

  test('LIGHTNING_WILL skips legacy specialStone manifestation markers', () => {
    const { cardState, gameState, prng } = createStates(0);
    gameState.board[0][0] = Shared.BLACK;
    addManifestStone(cardState, gameState, 1, 1, 'white', 'specialStone');
    gameState.board[2][2] = Shared.WHITE;
    cardState.markers.push({
      id: 11,
      kind: 'specialStone',
      row: 0,
      col: 0,
      owner: 'black',
      data: { type: 'LIGHTNING', remainingOwnerTurns: 6 }
    });

    const out = CardLogic.processLightningWillEffectsAtTurnStartAnchor(cardState, gameState, 'black', 0, 0, prng);

    expect(out.destroyed).toEqual([expect.objectContaining({ row: 2, col: 2 })]);
    expect(gameState.board[1][1]).toBe(Shared.WHITE);
    expect(gameState.board[2][2]).toBe(Shared.EMPTY);
  });

  test('METEOR_GOD skips manifestation stones when choosing a random enemy to hole', () => {
    const { cardState, gameState, prng } = createStates(0);
    gameState.board[0][0] = Shared.BLACK;
    addManifestStone(cardState, gameState, 1, 1);
    gameState.board[2][2] = Shared.WHITE;
    cardState.markers.push({
      id: 2,
      kind: 'specialStone',
      row: 0,
      col: 0,
      owner: 'black',
      data: { type: 'METEOR_GOD', remainingOwnerTurns: 6 }
    });

    const out = CardLogic.processMeteorGodEffectsAtTurnStartAnchor(cardState, gameState, 'black', 0, 0, prng);

    expect(out.destroyed).toEqual([expect.objectContaining({ row: 2, col: 2 })]);
    expect(gameState.board[1][1]).toBe(Shared.WHITE);
    expect(gameState.board[2][2]).toBe(Shared.EMPTY);
    expect((cardState.markers || []).some((m: any) => m && m.row === 2 && m.col === 2 && m.data && m.data.type === 'METEOR_HOLE')).toBe(true);
  });

  test('DESTROY_DRAGON skips adjacent manifestation stones and targets another adjacent enemy', () => {
    const { cardState, gameState, prng } = createStates(0);
    gameState.board[3][3] = Shared.BLACK;
    addManifestStone(cardState, gameState, 2, 2);
    gameState.board[2][3] = Shared.WHITE;
    cardState.markers.push({
      id: 3,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'DESTROY_DRAGON', remainingOwnerTurns: 3 }
    });

    const out = CardLogic.processDestroyDragonEffectsAtTurnStartAnchor(cardState, gameState, 'black', 3, 3, prng);

    expect(out.destroyed).toEqual([expect.objectContaining({ row: 2, col: 3 })]);
    expect(gameState.board[2][2]).toBe(Shared.WHITE);
    expect(gameState.board[2][3]).toBe(Shared.EMPTY);
  });

  test('SNIPER skips the nearest manifestation stone and targets the nearest normal enemy', () => {
    const { cardState, gameState, prng } = createStates(0);
    gameState.board[3][3] = Shared.BLACK;
    addManifestStone(cardState, gameState, 3, 4);
    gameState.board[3][5] = Shared.WHITE;
    cardState.markers.push({
      id: 4,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'SNIPER', remainingOwnerTurns: 6 }
    });

    const out = CardLogic.processSniperWillEffectsAtTurnStartAnchor(cardState, gameState, 'black', 3, 3, prng);

    expect(out.destroyed).toEqual([expect.objectContaining({ row: 3, col: 5 })]);
    expect(gameState.board[3][4]).toBe(Shared.WHITE);
    expect(gameState.board[3][5]).toBe(Shared.EMPTY);
  });

  test('ULTIMATE_DESTROY_GOD skips manifestation stones in adjacent destroy waves', () => {
    const { cardState, gameState } = createStates(0);
    gameState.board[3][3] = Shared.BLACK;
    addManifestStone(cardState, gameState, 2, 2);
    gameState.board[2][3] = Shared.WHITE;
    cardState.markers.push({
      id: 5,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'ULTIMATE_DESTROY_GOD', remainingOwnerTurns: 6 }
    });

    const out = CardLogic.processUltimateDestroyGodEffectsAtAnchor(cardState, gameState, 'black', 3, 3, {
      decrementRemainingOwnerTurns: false
    });

    expect(out.destroyed).toEqual([expect.objectContaining({ row: 2, col: 3 })]);
    expect(gameState.board[2][2]).toBe(Shared.WHITE);
    expect(gameState.board[2][3]).toBe(Shared.EMPTY);
  });

  test('WILL_HUNTER_KING does not treat manifestation stones as priority special targets', () => {
    const { cardState, gameState, prng } = createStates(0);
    gameState.board[3][3] = Shared.BLACK;
    addManifestStone(cardState, gameState, 3, 4);
    gameState.board[3][5] = Shared.WHITE;
    cardState.markers.push({
      id: 6,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: {
        type: 'WILL_HUNTER_KING',
        remainingOwnerTurns: 8,
        flipEvadeRemaining: 2,
        destroyEvadeRemaining: 2
      }
    });

    const out = CardLogic.processWillHunterKingEffectsAtTurnStartAnchor(cardState, gameState, 'black', 3, 3, prng);

    expect(out.destroyed).toEqual([expect.objectContaining({ row: 3, col: 5 })]);
    expect(out.moved).toEqual([expect.objectContaining({ to: { row: 3, col: 5 } })]);
    expect(gameState.board[3][4]).toBe(Shared.WHITE);
    expect(gameState.board[3][5]).toBe(Shared.BLACK);
  });

  test('ROBOT_VACUUM excludes manifestation stones before random suction selection', () => {
    const { cardState, gameState } = createStates(0);
    const prng = createPrng([0, 0]);
    gameState.board[3][3] = Shared.BLACK;
    addManifestStone(cardState, gameState, 2, 2);
    gameState.board[2][3] = Shared.WHITE;
    cardState.markers.push({
      id: 7,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'ROBOT_VACUUM', remainingOwnerTurns: 5 }
    });

    const out = CardLogic.processRobotVacuumMoveAtAnchor(cardState, gameState, 'black', 3, 3, prng, {
      currentTurnPlayerKey: 'black'
    });

    expect(out.sucked).toEqual([expect.objectContaining({ row: 2, col: 3 })]);
    expect(gameState.board[2][2]).toBe(Shared.WHITE);
    expect(gameState.board[2][3]).toBe(Shared.EMPTY);
    expect(prng.calls).toBe(1);
  });

  test('GLUTTONOUS excludes manifestation stones before random eating selection', () => {
    const { cardState, gameState } = createStates(0);
    const prng = createPrng(0);
    gameState.board[3][3] = Shared.BLACK;
    addManifestStone(cardState, gameState, 2, 2);
    gameState.board[2][3] = Shared.WHITE;
    cardState.markers.push({
      id: 8,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'GLUTTONOUS', gluttonousMissStreak: 0 }
    });

    const out = CardLogic.processGluttonousMoveAtAnchor(cardState, gameState, 'black', 3, 3, prng);

    expect(out.ate).toEqual([expect.objectContaining({ row: 2, col: 3 })]);
    expect(gameState.board[2][2]).toBe(Shared.WHITE);
    expect(gameState.board[2][3]).toBe(Shared.BLACK);
    expect(prng.calls).toBe(1);
  });
});
