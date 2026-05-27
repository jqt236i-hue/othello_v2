import * as Shared from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';
import * as TurnPipelinePhases from '../game/turn/turn_pipeline_phases.js';
import * as Core from '../game/logic/core.js';

function createPrng() {
  return {
    shuffle: (arr: any[]) => arr,
    random: () => 0
  };
}

function createTurnStartCardState(markers: any[]) {
  return {
    lastTurnStartedFor: null,
    markers: markers.map((marker) => ({ ...marker, data: { ...(marker.data || {}) } })),
    presentationEvents: [],
    _presentationEventsPersist: [],
    pendingEffectByPlayer: { black: null, white: null },
    charge: { black: 0, white: 0 },
    prevOpponentTurnDestroyedStonesByPlayer: { black: [], white: [] }
  };
}

function createEmptyGameState() {
  return {
    board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  };
}

describe('turn-start marker ordering', () => {
  test('processes multiple turn-start special stones in createdSeq order', () => {
    const prng = createPrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
      currentPlayer: Shared.BLACK,
      turnNumber: 1,
      consecutivePasses: 0
    };

    gameState.board[4][4] = Shared.BLACK;
    gameState.board[4][5] = Shared.WHITE;
    gameState.board[1][1] = Shared.BLACK;
    gameState.board[1][2] = Shared.WHITE;

    cardState.markers.push(
      {
        id: 200,
        kind: 'specialStone',
        row: 4,
        col: 4,
        owner: 'black',
        createdSeq: 20,
        data: { type: 'DESTROY_DRAGON', remainingOwnerTurns: 3 }
      },
      {
        id: 100,
        kind: 'specialStone',
        row: 1,
        col: 1,
        owner: 'black',
        createdSeq: 10,
        data: { type: 'DESTROY_DRAGON', remainingOwnerTurns: 3 }
      }
    );

    const events: any[] = [];
    TurnPipelinePhases.applyTurnStartPhase(
      CardLogic,
      Core,
      cardState,
      gameState,
      'black',
      events,
      prng
    );

    const destroyEvents = events.filter((event) => event && event.type === 'destroy_dragon_destroyed_start');
    expect(destroyEvents).toHaveLength(2);
    expect(destroyEvents[0].details[0]).toMatchObject({ sourceRow: 1, sourceCol: 1, row: 1, col: 2 });
    expect(destroyEvents[1].details[0]).toMatchObject({ sourceRow: 4, sourceCol: 4, row: 4, col: 5 });
  });

  test('processes bombs and special stones through one createdSeq lane', () => {
    const prng = createPrng();
    const cardState = createTurnStartCardState([
      {
        id: 'dragon-late',
        kind: 'specialStone',
        row: 4,
        col: 4,
        owner: 'black',
        createdSeq: 20,
        data: { type: 'DESTROY_DRAGON', remainingOwnerTurns: 3 }
      },
      {
        id: 'bomb-early',
        kind: 'specialStone',
        row: 2,
        col: 2,
        owner: 'black',
        createdSeq: 10,
        data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 1 }
      }
    ]);
    const gameState = createEmptyGameState();
    const tickBombAt = jest.fn((_cardState, _gameState, marker) => ({
      exploded: [{ row: marker.row, col: marker.col, owner: marker.owner }]
    }));
    const processDestroyDragonEffectsAtTurnStartAnchor = jest.fn((_cardState, _gameState, playerKey, row, col) => ({
      destroyed: [{ sourceRow: row, sourceCol: col, row, col: col + 1, owner: playerKey }]
    }));
    const fakeCardLogic = {
      onTurnStart: jest.fn(() => null),
      tickBombAt,
      processDestroyDragonEffectsAtTurnStartAnchor,
      emitPresentationEvent: jest.fn()
    };

    const events: any[] = [];
    TurnPipelinePhases.applyTurnStartPhase(
      fakeCardLogic,
      {},
      cardState,
      gameState,
      'black',
      events,
      prng
    );

    expect(tickBombAt).toHaveBeenCalledTimes(1);
    expect(processDestroyDragonEffectsAtTurnStartAnchor).toHaveBeenCalledTimes(1);
    expect(tickBombAt.mock.invocationCallOrder[0]).toBeLessThan(
      processDestroyDragonEffectsAtTurnStartAnchor.mock.invocationCallOrder[0]
    );
    expect(events.filter((event) => event && event.type !== 'turn_start').map((event) => event.type)).toEqual([
      'bombs_exploded',
      'destroy_dragon_destroyed_start'
    ]);
  });

  test('does not process markers created during the same turn-start phase', () => {
    const prng = createPrng();
    const cardState = createTurnStartCardState([
      {
        id: 'dragon-origin',
        kind: 'specialStone',
        row: 1,
        col: 1,
        owner: 'black',
        createdSeq: 10,
        data: { type: 'DESTROY_DRAGON', remainingOwnerTurns: 3 }
      }
    ]);
    const gameState = createEmptyGameState();
    const processDestroyDragonEffectsAtTurnStartAnchor = jest.fn((nextCardState, _gameState, playerKey, row, col) => {
      nextCardState.markers.push({
        id: 'dragon-spawned-during-start',
        kind: 'specialStone',
        row: 5,
        col: 5,
        owner: playerKey,
        createdSeq: 99,
        data: { type: 'DESTROY_DRAGON', remainingOwnerTurns: 3 }
      });
      return {
        destroyed: [{ sourceRow: row, sourceCol: col, row, col: col + 1, owner: playerKey }]
      };
    });
    const fakeCardLogic = {
      onTurnStart: jest.fn(() => null),
      processDestroyDragonEffectsAtTurnStartAnchor,
      emitPresentationEvent: jest.fn()
    };

    const events: any[] = [];
    TurnPipelinePhases.applyTurnStartPhase(
      fakeCardLogic,
      {},
      cardState,
      gameState,
      'black',
      events,
      prng
    );

    expect(processDestroyDragonEffectsAtTurnStartAnchor).toHaveBeenCalledTimes(1);
    expect(cardState.markers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'dragon-origin' }),
        expect.objectContaining({ id: 'dragon-spawned-during-start' })
      ])
    );
    expect(events.filter((event) => event && event.type === 'destroy_dragon_destroyed_start')).toHaveLength(1);
  });
});
