import * as CardLogic from '../game/logic/cards.js';
import * as Core from '../game/logic/core.js';
import * as SharedConstants from '../shared-constants.js';
import * as BoardOps from '../game/logic/board_ops.js';

function createPrng() {
  return { shuffle: (items: any[]) => items, random: () => 0.5 };
}

function marker(cardState: any, type: string, row = 3, col = 3) {
  return (cardState.markers || []).find((item: any) => item && item.row === row && item.col === col && item.data && item.data.type === type);
}

describe('POISON_WILL（毒殺の意志）', () => {
  test('コスト8で毒マスを作り、石へ残り5の毒を即時付与する', () => {
    const def = (SharedConstants.CARD_DEFS || []).find((card: any) => card && card.type === 'POISON_WILL');
    expect(def).toMatchObject({ id: 'poison_will_01', cost: 8 });
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    gameState.board[3][3] = Core.BLACK;
    cardState.charge.black = 8;
    cardState.hands.black = [def!.id];

    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', def!.id)).toBe(true);
    expect(CardLogic.getPoisonTargets(cardState, gameState, 'black')).toContainEqual({ row: 3, col: 3 });
    expect(CardLogic.applyPoisonWill(cardState, gameState, 'black', 3, 3)).toMatchObject({ applied: true });
    expect(marker(cardState, 'POISON_CELL').data.remainingTurns).toBe(10);
    expect(marker(cardState, 'POISONED').data.remainingTurns).toBe(5);
    expect(cardState.charge.black).toBe(0);
  });

  test('付与手番は減らさず、その後5手番で通常破壊し毒マスは残す', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    gameState.turnNumber = 4;
    gameState.board[3][3] = Core.WHITE;
    cardState.pendingEffectByPlayer.black = { type: 'POISON_WILL', stage: 'selectTarget', cardId: 'poison_will_01' };
    CardLogic.applyPoisonWill(cardState, gameState, 'black', 3, 3);

    CardLogic.processPoisonTurnEnd(cardState, gameState, 4);
    expect(marker(cardState, 'POISONED').data.remainingTurns).toBe(5);
    for (let turn = 5; turn <= 8; turn += 1) CardLogic.processPoisonTurnEnd(cardState, gameState, turn);
    expect(marker(cardState, 'POISONED').data.remainingTurns).toBe(1);
    CardLogic.processPoisonTurnEnd(cardState, gameState, 9);
    expect(gameState.board[3][3]).toBe(Core.EMPTY);
    expect(marker(cardState, 'POISONED')).toBeFalsy();
    expect(marker(cardState, 'POISON_CELL')).toBeTruthy();
  });

  test('完全保護は毒を弾き、後付けされた場合も毒を解除する', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    gameState.board[3][3] = Core.BLACK;
    CardLogic.addMarker(cardState, 'specialStone', 3, 3, 'black', { type: 'POISON_CELL', remainingTurns: 10, appliedTurnNumber: 1 });
    CardLogic.addMarker(cardState, 'specialStone', 3, 3, 'black', { type: 'GUARD', remainingOwnerTurns: 3 });
    CardLogic.syncPoisonContacts(cardState, gameState, 1);
    expect(marker(cardState, 'POISONED')).toBeFalsy();

    cardState.markers = cardState.markers.filter((item: any) => !(item.row === 3 && item.col === 3 && item.data && item.data.type === 'GUARD'));
    CardLogic.syncPoisonContacts(cardState, gameState, 2);
    expect(marker(cardState, 'POISONED')).toBeTruthy();
    CardLogic.addMarker(cardState, 'specialStone', 3, 3, 'black', { type: 'GUARD', remainingOwnerTurns: 3 });
    CardLogic.syncPoisonContacts(cardState, gameState, 2);
    expect(marker(cardState, 'POISONED')).toBeFalsy();
  });

  test('再接触では毒を重複・リセットせず、毒マスは10手番後に消える', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    gameState.turnNumber = 10;
    gameState.board[3][3] = Core.BLACK;
    cardState.pendingEffectByPlayer.black = { type: 'POISON_WILL', stage: 'selectTarget', cardId: 'poison_will_01' };
    CardLogic.applyPoisonWill(cardState, gameState, 'black', 3, 3);
    marker(cardState, 'POISONED').data.remainingTurns = 3;
    CardLogic.syncPoisonContacts(cardState, gameState, 11);
    expect((cardState.markers || []).filter((item: any) => item.data && item.data.type === 'POISONED')).toHaveLength(1);
    expect(marker(cardState, 'POISONED').data.remainingTurns).toBe(3);

    gameState.board[3][3] = Core.EMPTY;
    CardLogic.syncPoisonContacts(cardState, gameState, 11);
    for (let turn = 11; turn <= 20; turn += 1) CardLogic.processPoisonTurnEnd(cardState, gameState, turn);
    expect(marker(cardState, 'POISON_CELL')).toBeFalsy();
  });

  test('石移動では毒状態だけが追従し、毒マスは元セルに残る', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    gameState.board[3][3] = Core.BLACK;
    CardLogic.addMarker(cardState, 'specialStone', 3, 3, 'black', { type: 'POISON_CELL', remainingTurns: 10, appliedTurnNumber: 1 });
    CardLogic.syncPoisonContacts(cardState, gameState, 1);
    expect(BoardOps.moveAt(cardState, gameState, 3, 3, 3, 2, 'TEST', 'poison_move').moved).toBe(true);
    expect(marker(cardState, 'POISON_CELL', 3, 3)).toBeTruthy();
    expect(marker(cardState, 'POISONED', 3, 2)).toBeTruthy();
    expect(marker(cardState, 'POISONED', 3, 3)).toBeFalsy();
  });

  test('不可侵の顕現石には毒を付与しない', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    CardLogic.addMarker(cardState, 'specialStone', 3, 3, 'black', { type: 'POISON_CELL', remainingTurns: 10, appliedTurnNumber: 1 });
    CardLogic.addMarker(cardState, 'manifestStone', 3, 3, 'black', { type: 'THEORY_INCARNATION', remainingOwnerTurns: 4 });
    CardLogic.syncPoisonContacts(cardState, gameState, 1);
    expect(marker(cardState, 'POISONED')).toBeFalsy();
  });

  test('毒の致死は既存の破壊回避を通り、試行済みの毒は解除される', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    gameState.board[3][3] = Core.BLACK;
    CardLogic.addMarker(cardState, 'specialStone', 3, 3, 'black', { type: 'POISONED', remainingTurns: 1, appliedTurnNumber: 0 });
    CardLogic.addMarker(cardState, 'specialStone', 3, 3, 'black', { type: 'AFTERIMAGE_WILL', flipEvadeRemaining: 3, destroyEvadeRemaining: 1 });
    const blackBefore = gameState.board.flat().filter((value: number) => value === Core.BLACK).length;
    CardLogic.processPoisonTurnEnd(cardState, gameState, 1);
    const blackAfter = gameState.board.flat().filter((value: number) => value === Core.BLACK).length;
    expect(blackAfter).toBe(blackBefore);
    expect((cardState.markers || []).some((item: any) => item.data && item.data.type === 'POISONED')).toBe(false);
  });
});
