import * as SharedConstants from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';
import * as Core from '../game/logic/core.js';
import * as TurnPipelinePhases from '../game/turn/turn_pipeline_phases.js';

function isBombMarker(marker) {
  return !!(
    marker &&
    marker.kind === 'specialStone' &&
    marker.data &&
    marker.data.category === 'bomb'
  );
}

function createStates() {
  const prng = { shuffle: (arr) => arr, random: () => 0.5 };
  const cardState = CardLogic.createCardState(prng);
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(0)),
    currentPlayer: 1,
    turnNumber: 0,
    consecutivePasses: 0
  };
  return { cardState, gameState };
}

describe('TIME_BOMB selection behavior', () => {
  test('card use requires at least one own stone target', () => {
    const def = SharedConstants.CARD_DEFS.find((d) => d && d.type === 'TIME_BOMB');
    expect(def).toBeTruthy();

    const { cardState, gameState } = createStates();
    cardState.hands.black = [def.id];
    cardState.charge.black = def.cost;

    const okWithoutOwnStone = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
    expect(okWithoutOwnStone).toBe(false);

    gameState.board[3][3] = 1;
    const okWithOwnStone = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
    expect(okWithOwnStone).toBe(true);
    expect(cardState.pendingEffectByPlayer.black && cardState.pendingEffectByPlayer.black.type).toBe('TIME_BOMB');
    expect(cardState.pendingEffectByPlayer.black && cardState.pendingEffectByPlayer.black.stage).toBe('selectTarget');
  });

  test('applyTimeBombWill converts selected own stone to bomb and clears pending', () => {
    const { cardState, gameState } = createStates();
    gameState.board[2][2] = 1;
    cardState.pendingEffectByPlayer.black = { type: 'TIME_BOMB', stage: 'selectTarget', cardId: 'bomb_01' };

    const applied = CardLogic.applyTimeBombWill(cardState, gameState, 'black', 2, 2);
    expect(applied && applied.applied).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();

    const bomb = (cardState.markers || []).find((m) => isBombMarker(m) && m.row === 2 && m.col === 2 && m.owner === 'black');
    expect(bomb).toBeTruthy();
    expect(bomb.data && typeof bomb.data.remainingTurns).toBe('number');
    expect(bomb.data && bomb.data.type).toBe('TIME_BOMB');
  });

  test.each(['FREEZE', 'POISON_CELL', 'SCORCHED_CELL', 'HEALING_CELL'])('bomb conversion preserves the %s cell effect and its timer', (type) => {
    const { cardState, gameState } = createStates();
    gameState.board[2][2] = SharedConstants.BLACK;
    CardLogic.addMarker(cardState, 'specialStone', 2, 2, 'black', { type: 'BREEDING', remainingOwnerTurns: 3 });
    CardLogic.addMarker(cardState, 'specialStone', 2, 2, 'white', { type, remainingOwnerTurns: 4 });
    const cellMarker = cardState.markers.find((marker) => marker.data.type === type);
    const cellBefore = JSON.parse(JSON.stringify(cellMarker));
    cardState.pendingEffectByPlayer.black = { type: 'TIME_BOMB', stage: 'selectTarget', cardId: 'bomb_01' };
    expect(CardLogic.getTimeBombTargets(cardState, gameState, 'black')).toContainEqual({ row: 2, col: 2 });

    const result = CardLogic.applyTimeBombWill(cardState, gameState, 'black', 2, 2);

    expect(result.applied).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(gameState.board[2][2]).toBe(SharedConstants.BLACK);
    expect(cardState.markers.find((marker) => marker.id === cellBefore.id)).toEqual(cellBefore);
    expect(cardState.markers.filter((marker) => isBombMarker(marker))).toHaveLength(1);
    expect(cardState.markers.some((marker) => marker.data.type === 'BREEDING')).toBe(false);
  });

  test('a frozen stone stays unflippable and its bomb countdown stays paused after conversion', () => {
    const { cardState, gameState } = createStates();
    cardState.debugNoDraw = true;
    gameState.turnNumber = 10;
    gameState.board[2][2] = SharedConstants.BLACK;
    gameState.board[2][3] = SharedConstants.WHITE;
    CardLogic.addMarker(cardState, 'specialStone', 2, 2, 'white', { type: 'FREEZE', remainingOwnerTurns: 4 });
    cardState.pendingEffectByPlayer.black = { type: 'TIME_BOMB', stage: 'selectTarget', cardId: 'bomb_01' };
    expect(CardLogic.applyTimeBombWill(cardState, gameState, 'black', 2, 2).applied).toBe(true);
    const bomb = cardState.markers.find(isBombMarker);
    bomb.data.remainingTurns = 1;
    bomb.data.placedTurn = -1;

    expect(Core.getFlipsWithContext(gameState, 2, 1, SharedConstants.WHITE, CardLogic.getCardContext(cardState))).toEqual([]);
    const events = [];
    TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', events, { random: () => 0.5 });

    expect(cardState.markers.find(isBombMarker).data.remainingTurns).toBe(1);
    expect(events.some((event) => event.type === 'bombs_exploded')).toBe(false);
    expect(gameState.board[2][2]).toBe(SharedConstants.BLACK);
    expect(gameState.board[2][3]).toBe(SharedConstants.WHITE);
  });

  test('placement effects no longer place bomb from TIME_BOMB pending', () => {
    const { cardState, gameState } = createStates();
    gameState.board[4][4] = 1;
    cardState.pendingEffectByPlayer.black = { type: 'TIME_BOMB', stage: 'selectTarget', cardId: 'bomb_01' };

    const effects = CardLogic.applyPlacementEffects(cardState, gameState, 'black', 4, 4, 1);
    expect(effects.bombPlaced).toBeFalsy();
    const bomb = (cardState.markers || []).find((m) => isBombMarker(m) && m.row === 4 && m.col === 4);
    expect(bomb).toBeFalsy();
  });

  test('turn-start bomb destroy presentation carries bomb source metadata', () => {
    const { cardState, gameState } = createStates();
    cardState.turnIndex = 10;
    gameState.board[3][3] = 1;
    gameState.board[3][4] = -1;
    cardState.markers.push({
      id: 'bomb-a',
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      createdSeq: 1,
      data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 1, placedTurn: 1 }
    });

    const result = CardLogic.tickBombAt(cardState, gameState, cardState.markers[0], 'black');
    const destroyEvent = (cardState.presentationEvents || []).find((ev) => ev && ev.type === 'DESTROY');

    expect(result.destroyed.length).toBeGreaterThan(0);
    expect(destroyEvent).toBeTruthy();
    expect(destroyEvent.meta).toMatchObject({
      sourceRow: 3,
      sourceCol: 3,
      projectileOwner: 'black',
      projectileStone: 'time_bomb'
    });
  });
});
