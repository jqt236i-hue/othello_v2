import * as SharedConstants from '../shared-constants.js';

const CardLogic = require('../game/logic/cards.js');
const PipelineUIAdapter = require('../game/turn/pipeline_ui_adapter.js');
const PendingCoordinator = require('../game/turn/pending-coordinator.js');
const SacrificeWill = require('../game/logic/cards/sacrifice_will.js');
const SpecialCardRegistry = require('../shared/special-card-registry.js');

function createPrng(randomValue = 0) {
  return {
    random: () => randomValue,
    shuffle: (arr: any[]) => arr
  };
}

function createEmptyGameState() {
  return {
    board: Array.from({ length: 8 }, () => Array(8).fill(SharedConstants.EMPTY)),
    currentPlayer: SharedConstants.WHITE,
    turnNumber: 7,
    consecutivePasses: 0
  };
}

function createCardState() {
  const cardState = CardLogic.createCardState(createPrng());
  cardState.debugNoDraw = true;
  cardState.presentationEvents = [];
  return cardState;
}

function addSacrificeStone(cardState: any, gameState: any, owner = 'black', row = 2, col = 2, id = 20, createdSeq = 10) {
  gameState.board[row][col] = owner === 'black' ? SharedConstants.BLACK : SharedConstants.WHITE;
  cardState.markers.push({
    id,
    kind: 'specialStone',
    row,
    col,
    owner,
    createdSeq,
    data: { type: 'SACRIFICE', remainingOwnerTurns: 5 }
  });
}

function markerTypes(cardState: any) {
  return cardState.markers.map((marker: any) => String(marker && marker.data && marker.data.type || '').toUpperCase());
}

describe('犠牲の意志 card nullification', () => {
  afterEach(() => {
    PendingCoordinator.clearPendingSelectionActionCache();
  });

  test('opponent normal card is consumed, nullified, and destroys the sacrifice stone without pending effect', () => {
    const cardState = createCardState();
    const gameState = createEmptyGameState();
    addSacrificeStone(cardState, gameState, 'black', 2, 2);

    cardState.hands.white = ['destroy_01'];
    cardState.charge.white = 99;

    const ok = CardLogic.applyCardUsage(cardState, gameState, 'white', 'destroy_01');

    expect(ok).toBe(true);
    expect(cardState.hands.white).toEqual([]);
    expect(cardState.discard).toContain('destroy_01');
    expect(cardState.charge.white).toBeLessThan(99);
    expect(cardState.cardUseCountByPlayer.white).toBe(1);
    expect(cardState.lastUsedCardByPlayer.white).toBe('destroy_01');
    expect(cardState.pendingEffectByPlayer.white).toBeNull();
    expect(gameState.board[2][2]).toBe(SharedConstants.EMPTY);
    expect(markerTypes(cardState)).not.toContain('SACRIFICE');

    expect(cardState.presentationEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'CARD_USED',
        cardId: 'destroy_01',
        player: 'white',
        meta: expect.objectContaining({
          nullifiedBySacrificeWill: true,
          cardUseVanishEffect: 'sacrifice_seal_burn',
          sacrificeWill: {
            row: 2,
            col: 2,
            owner: 'black',
            special: 'SACRIFICE'
          }
        })
      }),
      expect.objectContaining({
        type: 'DESTROY',
        row: 2,
        col: 2,
        cause: 'SACRIFICE_WILL',
        reason: 'card_nullified'
      }),
      expect.objectContaining({
        type: 'SPECIAL_STONE_BUBBLE',
        special: 'SACRIFICE',
        scenario: 'card_nullified',
        row: 2,
        col: 2,
        text: 'その一手は、ここで断つ。'
      })
    ]));
  });

  test('nullification clears deferred pending selection action cache for the card user', () => {
    const cardState = createCardState();
    const gameState = createEmptyGameState();
    addSacrificeStone(cardState, gameState, 'black', 2, 2);

    cardState.hands.white = ['destroy_01'];
    cardState.charge.white = 99;
    PendingCoordinator.storePendingSelectionAction(
      'white',
      { type: 'pending_selection', cardId: 'destroy_01', turnIndex: cardState.turnIndex || 0 },
      'DESTROY_ONE_STONE'
    );

    const ok = CardLogic.applyCardUsage(cardState, gameState, 'white', 'destroy_01');

    expect(ok).toBe(true);
    expect(cardState.pendingEffectByPlayer.white).toBeNull();
    expect(PendingCoordinator.readPendingSelectionAction('white')).toBeNull();
  });

  test('special cards are excluded from sacrifice nullification', () => {
    expect(SacrificeWill.shouldSacrificeNullifyCard('observer_will_01', 'OBSERVER_WILL', {
      SpecialCardRegistry
    })).toBe(false);
    expect(SacrificeWill.shouldSacrificeNullifyCard('destroy_01', 'DESTROY_ONE_STONE', {
      SpecialCardRegistry
    })).toBe(true);
  });

  test('oldest opposing sacrifice marker is selected deterministically', () => {
    const cardState = createCardState();
    const gameState = createEmptyGameState();
    addSacrificeStone(cardState, gameState, 'black', 5, 5, 20, 3);
    addSacrificeStone(cardState, gameState, 'black', 6, 6, 10, 3);
    addSacrificeStone(cardState, gameState, 'black', 1, 1, 1, 9);
    addSacrificeStone(cardState, gameState, 'white', 0, 0, 1, 0);

    const found = SacrificeWill.findTriggeringSacrificeMarker(cardState, 'white', {
      gameState,
      MARKER_KINDS: { SPECIAL_STONE: 'specialStone' }
    });

    expect(found).toMatchObject({
      row: 6,
      col: 6,
      owner: 'black',
      marker: expect.objectContaining({ id: 10, createdSeq: 3 })
    });
  });

  test('finds occupied expansion sacrifice stones and rejects meteor-hole markers', () => {
    const cardState = createCardState();
    const gameState = createEmptyGameState();
    gameState.boardExpansion = {
      cells: [{ side: 'right', row: 0, col: 8, owner: SharedConstants.BLACK }]
    };
    gameState.board[0][0] = SharedConstants.BLACK;
    cardState.markers.push(
      {
        id: 1,
        kind: 'specialStone',
        row: 0,
        col: 0,
        owner: 'black',
        createdSeq: 1,
        data: { type: 'SACRIFICE', remainingOwnerTurns: 5 }
      },
      {
        id: 2,
        kind: 'specialStone',
        row: 0,
        col: 0,
        data: { type: 'METEOR_HOLE' }
      },
      {
        id: 3,
        kind: 'specialStone',
        row: 0,
        col: 8,
        owner: 'black',
        createdSeq: 2,
        data: { type: 'SACRIFICE', remainingOwnerTurns: 5 }
      }
    );

    expect(SacrificeWill.findTriggeringSacrificeMarker(cardState, 'white', {
      gameState,
      MARKER_KINDS: { SPECIAL_STONE: 'specialStone' }
    })).toMatchObject({
      row: 0,
      col: 8,
      owner: 'black',
      marker: expect.objectContaining({ id: 3 })
    });
  });

  test('playback maps nullified card use to seal-burn effect before sacrifice destroy', () => {
    const pres = [
      {
        type: 'CARD_USED',
        player: 'white',
        cardId: 'destroy_01',
        meta: {
          owner: 'white',
          cost: 8,
          name: '破壊の意志',
          cardType: 'DESTROY_ONE_STONE',
          nullifiedBySacrificeWill: true,
          cardUseVanishEffect: 'sacrifice_seal_burn',
          sacrificeWill: {
            row: 2,
            col: 2,
            owner: 'black',
            special: 'SACRIFICE'
          }
        }
      },
      {
        type: 'DESTROY',
        row: 2,
        col: 2,
        ownerBefore: 'black',
        cause: 'SACRIFICE_WILL',
        reason: 'card_nullified',
        meta: { owner: 'black', special: 'SACRIFICE', reason: 'card_nullified' }
      },
      {
        type: 'SPECIAL_STONE_BUBBLE',
        special: 'SACRIFICE',
        scenario: 'card_nullified',
        player: 'black',
        row: 2,
        col: 2,
        text: 'その一手は、ここで断つ。',
        meta: { owner: 'black', reason: 'card_nullified' }
      }
    ];

    const playback = PipelineUIAdapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array.from({ length: 8 }, () => Array(8).fill(0)) }
    );

    const cardUse = playback.find((event: any) => event && event.type === 'card_use_animation');
    const destroy = playback.find((event: any) => event && event.type === 'destroy');
    expect(cardUse).toBeTruthy();
    expect(destroy).toBeTruthy();
    expect(cardUse.targets[0]).toMatchObject({
      nullifiedBySacrificeWill: true,
      cardUseVanishEffect: 'sacrifice_seal_burn',
      sacrificeWill: {
        row: 2,
        col: 2,
        owner: 'black',
        special: 'SACRIFICE'
      }
    });
    expect(destroy.phase).toBeGreaterThan(cardUse.phase);
  });

  test('effect log contains sacrifice nullification wording without actor prefix', () => {
    const logs = PipelineUIAdapter.mapEffectLogsFromPipeline([], [
      {
        type: 'SPECIAL_STONE_BUBBLE',
        special: 'SACRIFICE',
        scenario: 'card_nullified',
        player: 'black',
        row: 2,
        col: 2,
        text: 'その一手は、ここで断つ。',
        meta: { owner: 'black', reason: 'card_nullified' }
      }
    ], 'white');

    expect(logs).toContain('犠牲の意志がカードを無効化');
  });
});
