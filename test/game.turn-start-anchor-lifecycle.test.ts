import * as Shared from '../shared-constants.js';
import * as TurnPipelinePhases from '../game/turn/turn_pipeline_phases.js';

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

describe('turn-start anchor lifecycle', () => {
  test('draw happens after fixed turn-start anchors', () => {
    const order: string[] = [];
    const cardState = createTurnStartCardState([
      {
        id: 'anchor-A',
        markerId: 'anchor-A',
        kind: 'specialStone',
        row: 1,
        col: 1,
        owner: 'black',
        createdSeq: 10,
        data: { type: 'DESTROY_DRAGON', remainingOwnerTurns: 3 }
      }
    ]);

    const fakeCardLogic = {
      onTurnStartBeforeAnchors: jest.fn(() => {
        order.push('beforeAnchors');
        return null;
      }),
      drawForTurnStart: jest.fn(() => {
        order.push('draw');
      }),
      processDestroyDragonEffectsAtTurnStartAnchor: jest.fn((_cardState, _gameState, playerKey, row, col) => {
        order.push('anchor');
        return {
          destroyed: [{ sourceRow: row, sourceCol: col, row, col: col + 1, owner: playerKey }]
        };
      }),
      emitPresentationEvent: jest.fn()
    };

    TurnPipelinePhases.applyTurnStartPhase(
      fakeCardLogic,
      {},
      cardState,
      createEmptyGameState(),
      'black',
      [],
      createPrng()
    );

    expect(order).toEqual(['beforeAnchors', 'anchor', 'draw']);
  });

  test('post-flip immediate reactions run inside each anchor before the next anchor', () => {
    const order: string[] = [];
    const cardState = createTurnStartCardState([
      {
        id: 'hyper-A',
        markerId: 'hyper-A',
        kind: 'specialStone',
        row: 1,
        col: 1,
        owner: 'black',
        createdSeq: 10,
        data: { type: 'HYPERACTIVE', remainingOwnerTurns: 3 }
      },
      {
        id: 'hyper-B',
        markerId: 'hyper-B',
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        createdSeq: 20,
        data: { type: 'HYPERACTIVE', remainingOwnerTurns: 3 }
      }
    ]);

    const fakeCardLogic = {
      onTurnStart: jest.fn(() => null),
      processHyperactiveMoveAtAnchor: jest.fn((_cardState, _gameState, owner, row, col) => {
        order.push(`anchor:${row},${col}`);
        return {
          moved: [],
          destroyed: [],
          flipped: [{ row, col: col + 1, owner }]
        };
      }),
      applyRegenAfterFlips: jest.fn(() => ({ regened: [], captureFlips: [] })),
      applyLivingWillAfterFlips: jest.fn((_cardState, _gameState, flips) => {
        const first = Array.isArray(flips) ? flips[0] : null;
        order.push(`living:${first ? `${first.row},${first.col}` : 'none'}`);
        return { restored: [] };
      }),
      clearHyperactiveAtPositions: jest.fn(),
      emitPresentationEvent: jest.fn()
    };

    TurnPipelinePhases.applyTurnStartPhase(
      fakeCardLogic,
      {},
      cardState,
      createEmptyGameState(),
      'black',
      [],
      createPrng()
    );

    expect(order).toEqual([
      'anchor:1,1',
      'living:1,2',
      'anchor:3,3',
      'living:3,4'
    ]);
  });

  test('status timer presentation is emitted inside the source anchor lifecycle', () => {
    const order: string[] = [];
    const cardState = createTurnStartCardState([
      {
        id: 'hyper-A',
        markerId: 'hyper-A',
        kind: 'specialStone',
        row: 1,
        col: 1,
        owner: 'black',
        createdSeq: 10,
        data: { type: 'HYPERACTIVE', remainingOwnerTurns: 3 }
      },
      {
        id: 'hyper-B',
        markerId: 'hyper-B',
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        createdSeq: 20,
        data: { type: 'HYPERACTIVE', remainingOwnerTurns: 3 }
      }
    ]);

    const fakeCardLogic = {
      onTurnStart: jest.fn(() => null),
      processHyperactiveMoveAtAnchor: jest.fn((nextCardState, _gameState, _owner, row, col) => {
        order.push(`anchor:${row},${col}`);
        const marker = nextCardState.markers.find((entry: any) => entry.row === row && entry.col === col);
        marker.data.remainingOwnerTurns -= 1;
        return { moved: [], destroyed: [], flipped: [] };
      }),
      clearHyperactiveAtPositions: jest.fn(),
      emitPresentationEvent: jest.fn((nextCardState, event) => {
        order.push(`tick:${event.row},${event.col}:${event.meta.timer}`);
        nextCardState.presentationEvents.push(event);
      })
    };

    TurnPipelinePhases.applyTurnStartPhase(
      fakeCardLogic,
      {},
      cardState,
      createEmptyGameState(),
      'black',
      [],
      createPrng()
    );

    expect(order).toEqual([
      'anchor:1,1',
      'tick:1,1:2',
      'anchor:3,3',
      'tick:3,3:2'
    ]);
  });
});
