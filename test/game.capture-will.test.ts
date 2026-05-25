import * as SharedConstants from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';

describe('CAPTURE_WILL (捕獲の意志)', () => {
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

  test('applyCardUsage keeps source hand index and captures enemy special stone back into that slot', () => {
    const captureDef = SharedConstants.CARD_DEFS.find((def) => def && def.type === 'CAPTURE_WILL');
    const trapDef = SharedConstants.CARD_DEFS.find((def) => def && def.type === 'TRAP_WILL');
    const doubleDef = SharedConstants.CARD_DEFS.find((def) => def && def.type === 'DOUBLE_CHAIN_WILL');
    const dragonDef = SharedConstants.CARD_DEFS.find((def) => def && def.type === 'ULTIMATE_REVERSE_DRAGON');

    expect(captureDef).toBeTruthy();
    expect(dragonDef).toBeTruthy();

    const { cardState, gameState } = makeState();
    gameState.board[3][3] = -1;
    cardState.hands.black = [trapDef.id, captureDef.id, doubleDef.id];
    cardState.charge.black = captureDef.cost;
    cardState.markers.push({
      id: 401,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'white',
      data: {
        type: 'DRAGON',
        remainingOwnerTurns: 10,
        sourceType: 'ULTIMATE_REVERSE_DRAGON',
        sourceCardId: dragonDef.id
      }
    });

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', captureDef.id);
    expect(used).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toMatchObject({
      type: 'CAPTURE_WILL',
      stage: 'selectTarget',
      sourceHandIndex: 1
    });

    const res = CardLogic.applyCaptureWill(cardState, gameState, 'black', 3, 3);
    expect(res).toMatchObject({
      applied: true,
      capturedCardId: dragonDef.id,
      capturedCardType: 'ULTIMATE_REVERSE_DRAGON',
      capturedCardName: dragonDef.name,
      insertIndex: 1
    });
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(gameState.board[3][3]).toBe(0);
    expect((cardState.markers || []).some((marker) => marker && marker.row === 3 && marker.col === 3)).toBe(false);
    expect(cardState.hands.black).toEqual([trapDef.id, dragonDef.id, doubleDef.id]);

    const presentationEvents = cardState.presentationEvents || [];
    const statusRemovedEvent = presentationEvents.find((ev) => ev && ev.type === 'STATUS_REMOVED');
    expect(statusRemovedEvent).toBeTruthy();
    expect(statusRemovedEvent).toMatchObject({
      row: 3,
      col: 3,
      cause: 'CAPTURE_WILL',
      reason: 'captured_to_hand',
      meta: expect.objectContaining({
        special: 'DRAGON',
        owner: 'white',
        reason: 'captured_to_hand'
      })
    });

    const handAddEvent = presentationEvents.find((ev) => ev && ev.type === 'HAND_ADD' && ev.reason === 'capture_will');
    expect(handAddEvent).toBeTruthy();
    expect(handAddEvent).toMatchObject({
      player: 'black',
      cardId: dragonDef.id,
      reason: 'capture_will',
      meta: expect.objectContaining({
        sourceType: 'ULTIMATE_REVERSE_DRAGON',
        sourceCardId: dragonDef.id,
        sourceSpecialType: 'DRAGON',
        sourceRow: 3,
        sourceCol: 3,
        insertIndex: 1
      })
    });
    expect(presentationEvents.indexOf(statusRemovedEvent)).toBeLessThan(presentationEvents.indexOf(handAddEvent));
  });

  test('capturing WORK keeps WORK_REMOVED semantics without adding STATUS_REMOVED', () => {
    const captureDef = SharedConstants.CARD_DEFS.find((def) => def && def.type === 'CAPTURE_WILL');

    expect(captureDef).toBeTruthy();

    const { cardState, gameState } = makeState();
    gameState.board[2][4] = -1;
    cardState.hands.black = [captureDef.id];
    cardState.charge.black = captureDef.cost;
    cardState.workAnchorPosByPlayer = {
      black: null,
      white: { row: 2, col: 4 }
    };
    cardState.markers.push({
      id: 404,
      kind: 'specialStone',
      row: 2,
      col: 4,
      owner: 'white',
      data: {
        type: 'WORK',
        remainingOwnerTurns: 2,
        sourceType: 'WORKER_WILL',
        sourceCardId: 'worker_will_01'
      }
    });

    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', captureDef.id)).toBe(true);
    const res = CardLogic.applyCaptureWill(cardState, gameState, 'black', 2, 4);

    expect(res).toMatchObject({
      applied: true,
      sourceSpecialType: 'WORK',
      insertIndex: 0
    });

    const presentationEvents = cardState.presentationEvents || [];
    const workRemovedEvent = presentationEvents.find((ev) => ev && ev.type === 'WORK_REMOVED');
    expect(workRemovedEvent).toBeTruthy();
    expect(workRemovedEvent).toMatchObject({
      row: 2,
      col: 4,
      cause: 'CAPTURE_WILL',
      reason: 'captured_to_hand'
    });
    expect(presentationEvents.some((ev) => (
      ev
      && ev.type === 'STATUS_REMOVED'
      && ev.row === 2
      && ev.col === 4
      && ev.reason === 'captured_to_hand'
    ))).toBe(false);
  });

  test('capture target list excludes guarded enemy special stones', () => {
    const { cardState, gameState } = makeState();
    gameState.board[4][4] = -1;
    cardState.markers.push(
      {
        id: 402,
        kind: 'specialStone',
        row: 4,
        col: 4,
        owner: 'white',
        data: { type: 'DRAGON', remainingOwnerTurns: 4, sourceType: 'ULTIMATE_REVERSE_DRAGON', sourceCardId: 'ultimate_reverse_dragon_01' }
      },
      {
        id: 403,
        kind: 'specialStone',
        row: 4,
        col: 4,
        owner: 'white',
        data: { type: 'GUARD', remainingOwnerTurns: 3, sourceType: 'GUARD_WILL', sourceCardId: 'guard_01' }
      }
    );

    const targets = CardLogic.getCaptureWillTargets(cardState, gameState, 'black');
    expect(targets.some((target) => target.row === 4 && target.col === 4)).toBe(false);
  });

  test('capture target list accepts legacy dragon markers without source metadata', () => {
    const captureDef = SharedConstants.CARD_DEFS.find((def) => def && def.type === 'CAPTURE_WILL');
    const dragonDef = SharedConstants.CARD_DEFS.find((def) => def && def.type === 'ULTIMATE_REVERSE_DRAGON');
    const { cardState, gameState } = makeState();
    gameState.board[3][4] = -1;
    cardState.hands.black = [captureDef.id];
    cardState.charge.black = captureDef.cost;
    cardState.markers.push({
      id: 405,
      kind: 'specialStone',
      row: 3,
      col: 4,
      owner: 'white',
      data: { type: 'DRAGON', remainingOwnerTurns: 4 }
    });

    const targets = CardLogic.getCaptureWillTargets(cardState, gameState, 'black');
    expect(targets).toEqual(expect.arrayContaining([{ row: 3, col: 4 }]));

    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', captureDef.id)).toBe(true);
    const res = CardLogic.applyCaptureWill(cardState, gameState, 'black', 3, 4);

    expect(res).toMatchObject({
      applied: true,
      capturedCardId: dragonDef.id,
      capturedCardType: 'ULTIMATE_REVERSE_DRAGON'
    });
    expect(cardState.hands.black).toEqual([dragonDef.id]);
    expect(gameState.board[3][4]).toBe(0);
  });

  test('newly created guard markers retain source card metadata for future capture restore', () => {
    const { cardState, gameState } = makeState();
    const guardianDef = SharedConstants.CARD_DEFS.find((def) => def && def.type === 'GUARDIAN_GOD');
    gameState.board[2][2] = 1;
    cardState.hands.black = [guardianDef.id];
    cardState.charge.black = guardianDef.cost;

    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', guardianDef.id)).toBe(true);
    const applied = CardLogic.applyGuardWill(cardState, gameState, 'black', 2, 2);
    expect(applied && applied.applied).toBe(true);

    const guardMarker = (cardState.markers || []).find((marker) => marker && marker.row === 2 && marker.col === 2 && marker.data && marker.data.type === 'GUARD');
    expect(guardMarker).toBeTruthy();
    expect(guardMarker.data.sourceType).toBe('GUARDIAN_GOD');
    expect(guardMarker.data.sourceCardId).toBe(guardianDef.id);
  });
});
