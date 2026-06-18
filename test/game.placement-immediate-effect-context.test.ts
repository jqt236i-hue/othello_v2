import * as Shared from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';
import * as PlacementImmediateEffects from '../game/turn/action-phase/placement-immediate-effects';

function createPrng(value = 0) {
  return {
    shuffle: (arr: any[]) => arr,
    random: () => value
  };
}

function createGameState() {
  return {
    board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  } as any;
}

describe('placement immediate effect context', () => {
  test('placed ULTIMATE_DESTROY_GOD carries phase PRNG into salvation god rescue', () => {
    const prng = createPrng(0);
    const cardState: any = CardLogic.createCardState(prng, { plainReversi: true });
    delete cardState._defaultRandomSource;
    const gameState = createGameState();
    gameState.board[0][0] = Shared.BLACK;
    gameState.board[3][3] = Shared.BLACK;
    gameState.board[3][4] = Shared.WHITE;
    cardState.markers.push(
      {
        id: 1,
        kind: 'specialStone',
        row: 0,
        col: 0,
        owner: 'black',
        data: { type: 'STONE_SALVATION_GOD', remainingOwnerTurns: 12 }
      },
      {
        id: 2,
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        data: { type: 'ULTIMATE_DESTROY_GOD', remainingOwnerTurns: 6 }
      }
    );
    const events: any[] = [];

    expect(() => {
      PlacementImmediateEffects.resolvePlacementImmediateEffects({
        CardLogic,
        cardState,
        gameState,
        playerKey: 'black',
        action: { type: 'place', row: 3, col: 3 },
        events,
        effects: { ultimateDestroyGodPlaced: true },
        prng,
        othelloMode: true,
        boardBonusGained: 0,
        flipCount: 0,
        awardBoardChargeGain: () => undefined,
        applyPostFlipRevives: () => ({ regenRes: {}, livingWillRes: {} }),
        buildPlacementChargeBubblePayload: () => null,
        emitBoardChargeBubblePresentation: () => undefined,
        emitSpecialStonePlacementBubbleFromEffects: () => undefined,
        emitWorkBubblePresentation: () => undefined,
        pickRandomLine: () => null,
        workPlaceLines: [],
        pushTrapEvents: () => undefined,
        emitTrapHandRemoveEvents: () => undefined,
        debugLog: () => undefined
      });
    }).not.toThrow();

    expect(events).toContainEqual(expect.objectContaining({
      type: 'udg_destroyed_immediate',
      details: expect.arrayContaining([expect.objectContaining({ row: 3, col: 4 })])
    }));
    const revive = (cardState.presentationEvents || []).find((event: any) => (
      event &&
      event.type === 'SPAWN' &&
      event.reason === 'stone_salvation_god_revive'
    ));
    expect(revive).toEqual(expect.objectContaining({
      ownerAfter: 'black',
      cause: 'STONE_SALVATION_GOD'
    }));
  });
});
