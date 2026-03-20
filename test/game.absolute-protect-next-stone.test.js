/* eslint-env jest */
/**
 * Regression tests for ABSOLUTE_PROTECT_NEXT_STONE (最強の意志) / ABSOLUTE_PROTECTED stone.
 *
 * Covers:
 *  1. Card spec wiring in SharedConstants and catalog.json
 *  2. Placing a stone after using the card creates ABSOLUTE_PROTECTED marker and clears pending
 *  3. Stone resists flip (changeAt), destroy (destroyAt), and move (moveAt) via BoardOps
 *  4. ABSOLUTE_PROTECTED marker persists across turn starts (permanent)
 */

const SharedConstants = require('../shared-constants');
const Core = require('../game/logic/core');
const TurnPipeline = require('../game/turn/turn_pipeline');
const CardLogic = require('../game/logic/cards');
const BoardOps = require('../game/logic/board_ops');
const catalog = require('../cards/catalog.json');

function createPrng(randomValue = 0.5) {
  return {
    shuffle: (arr) => arr,
    random: () => randomValue
  };
}

function createEmptyGameState() {
  const gameState = Core.createGameState();
  gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
  gameState.currentPlayer = Core.BLACK;
  gameState.turnNumber = 1;
  gameState.consecutivePasses = 0;
  return gameState;
}

function getAbsoluteProtectDef() {
  return (SharedConstants.CARD_DEFS || []).find(
    (card) => card && card.type === 'ABSOLUTE_PROTECT_NEXT_STONE'
  );
}

function findAbsoluteProtectedMarker(cardState, row, col) {
  return (cardState.markers || []).find(
    (m) =>
      m &&
      m.kind === 'specialStone' &&
      m.row === row &&
      m.col === col &&
      m.data &&
      m.data.type === 'ABSOLUTE_PROTECTED'
  );
}

describe('ABSOLUTE_PROTECT_NEXT_STONE（最強の意志）', () => {
  // ── 1. Spec wiring ──────────────────────────────────────────────────────────

  test('card definition exists in SharedConstants.CARD_DEFS with correct type/cost', () => {
    const def = getAbsoluteProtectDef();
    expect(def).toBeTruthy();
    expect(def.id).toBe('absolute_protect_01');
    expect(def.type).toBe('ABSOLUTE_PROTECT_NEXT_STONE');
    expect(Number(def.cost)).toBe(30);
  });

  test('catalog.json contains absolute_protect_01 with correct spec', () => {
    const byId = new Map((catalog.cards || []).map((c) => [c.id, c]));
    const card = byId.get('absolute_protect_01');
    expect(card).toBeTruthy();
    expect(card.type).toBe('ABSOLUTE_PROTECT_NEXT_STONE');
    expect(Number(card.cost)).toBe(30);
    expect(card.name_ja).toBe('最強の意志');
  });

  // ── 2. Use card → place → ABSOLUTE_PROTECTED marker + pending cleared ───────

  test('use card sets pending, placing stone creates ABSOLUTE_PROTECTED marker and clears pending', () => {
    const def = getAbsoluteProtectDef();
    expect(def).toBeTruthy();

    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    cardState.debugNoDraw = true;
    cardState.hands.black = [def.id];
    cardState.charge.black = def.cost;

    // Row setup: white at [2][4], black at [2][5] — black can place at [2][3] to flip [2][4]
    gameState.board[2][4] = Core.WHITE;
    gameState.board[2][5] = Core.BLACK;

    // Use the card
    const useRes = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'use_card', useCardId: def.id, useCardOwnerKey: 'black' },
      prng,
      { skipTurnStart: true }
    );

    expect(useRes.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'card_used', player: 'black', cardId: def.id })
      ])
    );
    expect(cardState.pendingEffectByPlayer.black).toEqual(
      expect.objectContaining({ type: 'ABSOLUTE_PROTECT_NEXT_STONE' })
    );

    // Place a stone — should consume pending and create ABSOLUTE_PROTECTED marker
    const placeRes = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 2, col: 3 },
      prng,
      { skipTurnStart: true }
    );

    expect(placeRes.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'placement_effects',
          player: 'black',
          effects: expect.objectContaining({ absoluteProtected: true })
        })
      ])
    );
    expect(cardState.pendingEffectByPlayer.black).toBeNull();

    const marker = findAbsoluteProtectedMarker(cardState, 2, 3);
    expect(marker).toBeTruthy();
    expect(marker.owner).toBe('black');
  });

  // ── 3. Resistance paths via BoardOps ─────────────────────────────────────────

  test('changeAt (flip) is blocked by ABSOLUTE_PROTECTED and returns absolute_protected reason', () => {
    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    gameState.board[3][3] = Core.BLACK;

    cardState.markers.push({
      id: 999,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'ABSOLUTE_PROTECTED' }
    });

    const result = BoardOps.changeAt(cardState, gameState, 3, 3, 'white', 'card', 'test');
    expect(result.changed).toBe(false);
    expect(result.reason).toBe('absolute_protected');
    // Stone must remain black
    expect(BoardOps.getCellValue(gameState, 3, 3)).toBe(Core.BLACK);
  });

  test('destroyAt is blocked by ABSOLUTE_PROTECTED and returns absolute_protected reason', () => {
    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    gameState.board[4][4] = Core.WHITE;

    cardState.markers.push({
      id: 998,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'white',
      data: { type: 'ABSOLUTE_PROTECTED' }
    });

    const result = BoardOps.destroyAt(cardState, gameState, 4, 4, 'card', 'test');
    expect(result.destroyed).toBe(false);
    expect(result.reason).toBe('absolute_protected');
    // Stone must still be on board
    expect(BoardOps.getCellValue(gameState, 4, 4)).toBe(Core.WHITE);
  });

  test('moveAt source is blocked by ABSOLUTE_PROTECTED and returns absolute_protected_source reason', () => {
    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    gameState.board[2][2] = Core.BLACK;
    // Destination is empty

    cardState.markers.push({
      id: 997,
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'black',
      data: { type: 'ABSOLUTE_PROTECTED' }
    });

    const result = BoardOps.moveAt(cardState, gameState, 2, 2, 2, 5, 'card', 'test');
    expect(result.moved).toBe(false);
    expect(result.reason).toBe('absolute_protected_source');
    // Stone stays at original position
    expect(BoardOps.getCellValue(gameState, 2, 2)).toBe(Core.BLACK);
    expect(BoardOps.getCellValue(gameState, 2, 5)).toBe(Core.EMPTY);
  });

  // ── 4. Permanence: marker persists across turn starts ───────────────────────

  test('ABSOLUTE_PROTECTED marker persists across multiple turn starts (permanent)', () => {
    const def = getAbsoluteProtectDef();
    expect(def).toBeTruthy();

    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    cardState.debugNoDraw = true;
    cardState.hands.black = [def.id];
    cardState.charge.black = def.cost;

    gameState.board[2][4] = Core.WHITE;
    gameState.board[2][5] = Core.BLACK;

    TurnPipeline.applyTurn(
      cardState, gameState, 'black',
      { type: 'use_card', useCardId: def.id, useCardOwnerKey: 'black' },
      prng, { skipTurnStart: true }
    );
    TurnPipeline.applyTurn(
      cardState, gameState, 'black',
      { type: 'place', row: 2, col: 3 },
      prng, { skipTurnStart: true }
    );

    // Simulate several full turn-start cycles
    for (let i = 0; i < 6; i++) {
      CardLogic.onTurnStart(cardState, i % 2 === 0 ? 'white' : 'black', gameState, prng);
    }

    const marker = findAbsoluteProtectedMarker(cardState, 2, 3);
    expect(marker).toBeTruthy();
  });

  // ── 5. applyAbsoluteProtect marks cell and is idempotent ────────────────────

  test('applyAbsoluteProtect marks the cell and is idempotent (no duplicate markers)', () => {
    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);

    const r1 = CardLogic.applyAbsoluteProtect(cardState, 'black', 5, 5);
    expect(r1).toEqual(expect.objectContaining({ applied: true }));

    const marker = findAbsoluteProtectedMarker(cardState, 5, 5);
    expect(marker).toBeTruthy();
    expect(marker.owner).toBe('black');

    // Calling again should not add a duplicate marker
    CardLogic.applyAbsoluteProtect(cardState, 'black', 5, 5);
    const markerCount = (cardState.markers || []).filter(
      (m) =>
        m &&
        m.row === 5 &&
        m.col === 5 &&
        m.data &&
        m.data.type === 'ABSOLUTE_PROTECTED'
    ).length;
    expect(markerCount).toBe(1);
  });

  // ── 6. isAbsoluteProtectedCell correctly identifies the cell ─────────────────

  test('isAbsoluteProtectedCell returns true only for the protected cell', () => {
    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);

    cardState.markers.push({
      id: 996,
      kind: 'specialStone',
      row: 1,
      col: 1,
      owner: 'white',
      data: { type: 'ABSOLUTE_PROTECTED' }
    });

    expect(CardLogic.isAbsoluteProtectedCell(cardState, 1, 1)).toBe(true);
    expect(CardLogic.isAbsoluteProtectedCell(cardState, 1, 2)).toBe(false);
    expect(CardLogic.isAbsoluteProtectedCell(cardState, 0, 0)).toBe(false);
  });
});
