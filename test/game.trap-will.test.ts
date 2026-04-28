import * as SharedConstants from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';
import * as Core from '../game/logic/core.js';
import * as TurnPipeline from '../game/turn/turn_pipeline.js';
import * as TurnPipelinePhases from '../game/turn/turn_pipeline_phases.js';
import * as BoardOps from '../game/logic/board_ops.js';

describe('TRAP_WILL (罠の意志)', () => {
  function makeState() {
    const prng = { shuffle: () => {}, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: 1,
      turnNumber: 1,
      consecutivePasses: 0
    };
    return { cardState, gameState };
  }

  test('can set trap on own stone and clear pending', () => {
    const trapDef = (SharedConstants.CARD_DEFS || []).find(d => d && d.type === 'TRAP_WILL');
    expect(trapDef).toBeTruthy();

    const { cardState, gameState } = makeState();
    gameState.board[2][2] = 1;
    cardState.hands.black = [trapDef.id];
    cardState.charge.black = trapDef.cost;

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', trapDef.id);
    expect(used).toBe(true);
    expect(cardState.pendingEffectByPlayer.black && cardState.pendingEffectByPlayer.black.type).toBe('TRAP_WILL');

    const applied = CardLogic.applyTrapWill(cardState, gameState, 'black', 2, 2);
    expect(applied && applied.applied).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();

    const trapMarker = (cardState.markers || []).find(m => m && m.row === 2 && m.col === 2 && m.data && m.data.type === 'TRAP');
    expect(trapMarker).toBeTruthy();
    expect(trapMarker.owner).toBe('black');
  });

  test('trap selection ends the turn without placing a stone', () => {
    const trapDef = (SharedConstants.CARD_DEFS || []).find(d => d && d.type === 'TRAP_WILL');
    const cardState = CardLogic.createCardState();
    const gameState = Core.createGameState();

    cardState.decks.black = [];
    cardState.hands.black = [trapDef.id];
    cardState.charge.black = trapDef.cost;

    const useResult = TurnPipeline.applyTurn(cardState, gameState, 'black', {
      type: 'use_card',
      useCardId: trapDef.id
    });

    expect(useResult.gameState.currentPlayer).toBe(Core.BLACK);
    expect(useResult.cardState.pendingEffectByPlayer.black).toMatchObject({ type: 'TRAP_WILL', stage: 'selectTarget' });

    const turnNumberBeforeTrapSelection = useResult.gameState.turnNumber || 0;

    const selectResult = TurnPipeline.applyTurn(useResult.cardState, useResult.gameState, 'black', {
      type: 'place',
      trapTarget: { row: 3, col: 4 }
    });

    expect(selectResult.cardState.pendingEffectByPlayer.black).toBeNull();
    expect(selectResult.gameState.currentPlayer).toBe(Core.WHITE);
    expect(selectResult.gameState.turnNumber).toBe(turnNumberBeforeTrapSelection + 1);
    expect(selectResult.gameState.board[3][4]).toBe(Core.BLACK);
    expect((selectResult.cardState.markers || [])).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 3, col: 4, owner: 'black', data: expect.objectContaining({ type: 'TRAP' }) })
    ]));

    const allPresentationEvents = [
      ...((selectResult.cardState && selectResult.cardState.presentationEvents) || []),
      ...((selectResult.cardState && selectResult.cardState._presentationEventsPersist) || [])
    ];
    const leakedStatus = allPresentationEvents.find((ev) => (
      ev &&
      ev.type === 'STATUS_APPLIED' &&
      ev.meta &&
      ev.meta.special === 'TRAP'
    ));
    expect(leakedStatus).toBeUndefined();
  });

  test('trap_selected raw event omits target coordinates', () => {
    const { cardState, gameState } = makeState();
    gameState.currentPlayer = Core.BLACK;
    gameState.board[3][4] = Core.BLACK;
    cardState.pendingEffectByPlayer.black = { type: 'TRAP_WILL', stage: 'selectTarget', cardId: 'trap_01' };

    const events = [];
    TurnPipelinePhases.applyActionPhase(
      CardLogic,
      Core,
      cardState,
      gameState,
      'black',
      { type: 'place', trapTarget: { row: 3, col: 4 } },
      events,
      { shuffle: (arr) => arr, random: () => 0.5 },
      BoardOps
    );

    const trapSelected = events.find((ev) => ev && ev.type === 'trap_selected');
    expect(trapSelected).toBeTruthy();
    expect(trapSelected).toMatchObject({ type: 'trap_selected', player: 'black', applied: true });
    expect(trapSelected && trapSelected.target).toBeUndefined();
    expect(gameState.currentPlayer).toBe(Core.WHITE);
  });

  test('trigger: steals up to 20 charge and destroys all victim hand cards', () => {
    const { cardState, gameState } = makeState();

    // Trap owned by black at C3 (2,2), currently flipped by white on white turn.
    gameState.board[2][2] = -1;
    cardState.markers.push({
      id: 11,
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'black',
      data: { type: 'TRAP', hidden: true }
    });
    cardState.charge.black = 5;
    cardState.charge.white = 34;
    cardState.hands.black = ['b1', 'b2', 'b3', 'b4'];
    cardState.hands.white = ['w1', 'w2', 'w3', 'w4'];
    cardState.decks.black = ['d0'];
    cardState.discard = [];

    const res = CardLogic.processTrapEffects(cardState, gameState, 'white', { expireOnOwnerTurnStart: false });
    expect(res.triggered.length).toBe(1);
    expect(res.expired.length).toBe(0);
    expect(res.disarmed.length).toBe(0);

    expect(cardState.charge.white).toBe(14);
    expect(cardState.charge.black).toBe(25);
    expect(cardState.hands.black).toEqual(['b1', 'b2', 'b3', 'b4']);
    expect(cardState.hands.white).toEqual([]);
    expect(cardState.decks.black).toEqual(['d0']);
    expect(cardState.discard).toEqual(['w1', 'w2', 'w3', 'w4']);

    expect(res.triggered[0].stolenCharge).toBe(20);
    expect(res.triggered[0].gainedCharge).toBe(20);
    expect(res.triggered[0].destroyedHandCount).toBe(4);
    expect(res.triggered[0].toHandCount).toBe(0);
    expect(res.triggered[0].toDeckCount).toBe(0);

    const remainingTrap = (cardState.markers || []).find(m => m && m.data && m.data.type === 'TRAP');
    expect(remainingTrap).toBeUndefined();
  });

  test('trigger: steals all remaining charge when victim has less than 20', () => {
    const { cardState, gameState } = makeState();

    gameState.board[2][2] = -1;
    cardState.markers.push({
      id: 13,
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'black',
      data: { type: 'TRAP', hidden: true }
    });
    cardState.charge.black = 3;
    cardState.charge.white = 16;
    cardState.hands.white = ['w1'];
    cardState.discard = [];

    const res = CardLogic.processTrapEffects(cardState, gameState, 'white', { expireOnOwnerTurnStart: false });

    expect(res.triggered).toHaveLength(1);
    expect(cardState.charge.white).toBe(0);
    expect(cardState.charge.black).toBe(19);
    expect(res.triggered[0].stolenCharge).toBe(16);
    expect(res.triggered[0].gainedCharge).toBe(16);
    expect(cardState.hands.white).toEqual([]);
    expect(cardState.discard).toEqual(['w1']);
  });

  test('expires on owner turn start if not triggered', () => {
    const { cardState, gameState } = makeState();
    gameState.board[3][3] = 1;
    cardState.markers.push({
      id: 12,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'TRAP', hidden: true }
    });

    const res = CardLogic.processTrapEffects(cardState, gameState, 'black', { expireOnOwnerTurnStart: true });
    expect(res.triggered.length).toBe(0);
    expect(res.expired.length).toBe(1);
    expect(gameState.board[3][3]).toBe(0);

    const remainingTrap = (cardState.markers || []).find(m => m && m.data && m.data.type === 'TRAP');
    expect(remainingTrap).toBeUndefined();
  });

  test('can set trap on own expansion stone', () => {
    const { cardState, gameState } = makeState();
    gameState.boardExpansion = {
      active: false,
      side: null,
      row: null,
      owner: SharedConstants.EMPTY,
      usedByPlayer: { black: false, white: false },
      cells: [{ side: 'left', row: 2, col: -1, owner: SharedConstants.BLACK }]
    };
    cardState.pendingEffectByPlayer.black = { type: 'TRAP_WILL', stage: 'selectTarget', cardId: 'trap_expansion_01' };

    const applied = CardLogic.applyTrapWill(cardState, gameState, 'black', 2, -1);

    expect(applied).toMatchObject({ applied: true, row: 2, col: -1 });
    expect(cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 2, col: -1, owner: 'black', data: expect.objectContaining({ type: 'TRAP' }) })
    ]));
  });

  test('trap on expansion cell triggers against opponent stone there', () => {
    const { cardState, gameState } = makeState();
    gameState.boardExpansion = {
      active: false,
      side: null,
      row: null,
      owner: SharedConstants.EMPTY,
      usedByPlayer: { black: false, white: false },
      cells: [{ side: 'left', row: 2, col: -1, owner: SharedConstants.WHITE }]
    };
    cardState.markers.push({
      id: 22,
      kind: 'specialStone',
      row: 2,
      col: -1,
      owner: 'black',
      data: { type: 'TRAP', hidden: true }
    });
    cardState.charge.black = 1;
    cardState.charge.white = 7;
    cardState.hands.white = ['w1', 'w2'];
    cardState.discard = [];

    const res = CardLogic.processTrapEffects(cardState, gameState, 'white', { expireOnOwnerTurnStart: false });

    expect(res.triggered).toHaveLength(1);
    expect(res.triggered[0]).toMatchObject({ row: 2, col: -1, victim: 'white', stolenCharge: 7, destroyedHandCount: 2 });
    expect(cardState.charge.white).toBe(0);
    expect(cardState.charge.black).toBe(8);
    expect(cardState.hands.white).toEqual([]);
    expect(cardState.discard).toEqual(['w1', 'w2']);
  });
});
