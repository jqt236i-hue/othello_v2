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

  test('does not process markers born inside CardLogic.onTurnStart during the same turn-start', () => {
    const prng = createPrng();
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
    const gameState = createEmptyGameState();
    const processedSources: string[] = [];
    const fakeCardLogic = {
      onTurnStart: jest.fn((nextCardState) => {
        nextCardState.markers.push({
          id: 'born-during-on-turn-start',
          markerId: 'born-during-on-turn-start',
          kind: 'specialStone',
          row: 5,
          col: 5,
          owner: 'black',
          createdSeq: 99,
          data: { type: 'DESTROY_DRAGON', remainingOwnerTurns: 3 }
        });
        return null;
      }),
      processDestroyDragonEffectsAtTurnStartAnchor: jest.fn((_cardState, _gameState, playerKey, row, col) => {
        processedSources.push(`${row},${col}`);
        return {
          destroyed: [{ sourceRow: row, sourceCol: col, row, col: col + 1, owner: playerKey }]
        };
      }),
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

    expect(processedSources).toEqual(['1,1']);
    expect(cardState.markers.some((m: any) => m.markerId === 'born-during-on-turn-start')).toBe(true);
  });

  test('uses split turn-start hooks to draw after fixed marker anchors', () => {
    const prng = createPrng();
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
    const gameState = createEmptyGameState();
    const order: string[] = [];
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
      gameState,
      'black',
      [],
      prng
    );

    expect(order).toEqual(['beforeAnchors', 'anchor', 'draw']);
    expect(fakeCardLogic.onTurnStartBeforeAnchors).toHaveBeenCalledTimes(1);
    expect(fakeCardLogic.drawForTurnStart).toHaveBeenCalledTimes(1);
  });

  test('real CardLogic exposes and uses split turn-start hooks in the turn pipeline', () => {
    const RuntimeCardLogic = require('../game/logic/cards.js');
    const prng = createPrng();
    const cardState = RuntimeCardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    const beforeSpy = jest.spyOn(RuntimeCardLogic, 'onTurnStartBeforeAnchors');
    const drawSpy = jest.spyOn(RuntimeCardLogic, 'drawForTurnStart');

    try {
      TurnPipelinePhases.applyTurnStartPhase(
        RuntimeCardLogic,
        Core,
        cardState,
        gameState,
        'black',
        [],
        prng
      );

      expect(beforeSpy).toHaveBeenCalledTimes(1);
      expect(drawSpy).toHaveBeenCalledTimes(1);
      expect(beforeSpy.mock.invocationCallOrder[0]).toBeLessThan(drawSpy.mock.invocationCallOrder[0]);
    } finally {
      beforeSpy.mockRestore();
      drawSpy.mockRestore();
    }
  });

  test('applies post-flip revives after each hyperactive anchor before the next anchor', () => {
    const prng = createPrng();
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
    const gameState = createEmptyGameState();
    const order: string[] = [];
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
      gameState,
      'black',
      [],
      prng
    );

    expect(order).toEqual([
      'anchor:1,1',
      'living:1,2',
      'anchor:3,3',
      'living:3,4'
    ]);
    expect(fakeCardLogic.applyLivingWillAfterFlips).toHaveBeenCalledTimes(2);
  });

  test('emits status timer ticks inside each anchor lifecycle before the next anchor', () => {
    const prng = createPrng();
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
    const gameState = createEmptyGameState();
    const order: string[] = [];
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
      gameState,
      'black',
      [],
      prng
    );

    expect(order).toEqual([
      'anchor:1,1',
      'tick:1,1:2',
      'anchor:3,3',
      'tick:3,3:2'
    ]);
  });

  test('defers status duration expiration to createdSeq anchor order', () => {
    const prng = createPrng();
    const cardState = createTurnStartCardState([
      {
        id: 'dragon-A',
        markerId: 'dragon-A',
        kind: 'specialStone',
        row: 1,
        col: 1,
        owner: 'black',
        createdSeq: 10,
        data: { type: 'DESTROY_DRAGON', remainingOwnerTurns: 3 }
      },
      {
        id: 'guard-B',
        markerId: 'guard-B',
        kind: 'specialStone',
        row: 1,
        col: 2,
        owner: 'black',
        createdSeq: 20,
        data: { type: 'GUARD', remainingOwnerTurns: 1 }
      }
    ]);
    const gameState = createEmptyGameState();
    const order: string[] = [];
    const fakeCardLogic = {
      onTurnStartBeforeAnchors: jest.fn((_cardState, _playerKey, _gameState, _prng, options) => {
        if (!(options && options.deferStatusDurationUntilTurnStartMarkers === true)) {
          order.push('status-before-anchors');
        }
        return null;
      }),
      drawForTurnStart: jest.fn(),
      processDestroyDragonEffectsAtTurnStartAnchor: jest.fn((_cardState, _gameState, playerKey, row, col) => {
        order.push(`dragon:${row},${col}`);
        return {
          destroyed: [{ sourceRow: row, sourceCol: col, row, col: col + 1, owner: playerKey }]
        };
      }),
      processTurnStartStatusMarkerAnchor: jest.fn((_cardState, _gameState, _playerKey, marker) => {
        if (marker && marker.data && marker.data.type === 'GUARD') {
          order.push(`status:${marker.row},${marker.col}`);
          marker.data.remainingOwnerTurns = 0;
          return { processed: true, expired: [{ row: marker.row, col: marker.col, type: 'GUARD' }] };
        }
        return { processed: false };
      }),
      emitPresentationEvent: jest.fn()
    };

    TurnPipelinePhases.applyTurnStartPhase(
      fakeCardLogic,
      {},
      cardState,
      gameState,
      'black',
      [],
      prng
    );

    expect(order).toEqual([
      'dragon:1,1',
      'status:1,2'
    ]);
  });

  test('real CardLogic exposes turn-start status marker anchor processing', () => {
    const RuntimeCardLogic = require('../game/logic/cards.js');
    const cardState = createTurnStartCardState([
      {
        id: 'guard-anchor',
        markerId: 'guard-anchor',
        kind: 'specialStone',
        row: 1,
        col: 2,
        owner: 'black',
        createdSeq: 20,
        data: { type: 'GUARD', remainingOwnerTurns: 1 }
      }
    ]);
    const gameState = createEmptyGameState();
    gameState.board[1][2] = Shared.BLACK;

    expect(typeof RuntimeCardLogic.processTurnStartStatusMarkerAnchor).toBe('function');

    const result = RuntimeCardLogic.processTurnStartStatusMarkerAnchor(
      cardState,
      gameState,
      'black',
      cardState.markers[0],
      {}
    );

    expect(result.expired).toEqual([{ row: 1, col: 2, owner: 'black', type: 'GUARD' }]);
    expect(cardState.markers.some((marker: any) => marker && marker.data && marker.data.type === 'GUARD')).toBe(false);
  });

  test('applies seed generated flips inside the seed anchor before the next anchor', () => {
    const prng = createPrng();
    const cardState = createTurnStartCardState([
      {
        id: 'dragon-A',
        markerId: 'dragon-A',
        kind: 'specialStone',
        row: 1,
        col: 1,
        owner: 'black',
        createdSeq: 10,
        data: { type: 'DESTROY_DRAGON', remainingOwnerTurns: 3 }
      },
      {
        id: 'seed-B',
        markerId: 'seed-B',
        kind: 'specialStone',
        row: 2,
        col: 2,
        owner: 'black',
        createdSeq: 20,
        data: { type: 'SEED', remainingOwnerTurns: 1 }
      },
      {
        id: 'dragon-C',
        markerId: 'dragon-C',
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        createdSeq: 30,
        data: { type: 'DESTROY_DRAGON', remainingOwnerTurns: 3 }
      }
    ]);
    const gameState = createEmptyGameState();
    const order: string[] = [];
    const fakeCardLogic = {
      onTurnStartBeforeAnchors: jest.fn((_cardState, _playerKey, _gameState, _prng, options) => {
        if (!(options && options.deferStatusDurationUntilTurnStartMarkers === true)) {
          order.push('seed-before-anchors');
        }
        return null;
      }),
      drawForTurnStart: jest.fn(),
      processDestroyDragonEffectsAtTurnStartAnchor: jest.fn((_cardState, _gameState, playerKey, row, col) => {
        order.push(`dragon:${row},${col}`);
        return {
          destroyed: [{ sourceRow: row, sourceCol: col, row, col: col + 1, owner: playerKey }]
        };
      }),
      processTurnStartStatusMarkerAnchor: jest.fn((_cardState, _gameState, _playerKey, marker) => {
        if (marker && marker.data && marker.data.type === 'SEED') {
          order.push(`seed:${marker.row},${marker.col}`);
          return {
            processed: true,
            generatedSpawnFlipResults: [{
              ownerKey: 'black',
              cause: 'SEED_WILL',
              reason: 'seed_sprout',
              flipped: [{ row: marker.row, col: marker.col + 1, owner: 'black' }]
            }]
          };
        }
        return { processed: false };
      }),
      applyRegenAfterFlips: jest.fn(() => ({ regened: [], captureFlips: [] })),
      applyLivingWillAfterFlips: jest.fn((_cardState, _gameState, flips) => {
        const first = Array.isArray(flips) ? flips[0] : null;
        order.push(`seed-flip-revive:${first ? `${first.row},${first.col}` : 'none'}`);
        return { restored: [] };
      }),
      emitPresentationEvent: jest.fn()
    };

    TurnPipelinePhases.applyTurnStartPhase(
      fakeCardLogic,
      {},
      cardState,
      gameState,
      'black',
      [],
      prng
    );

    expect(order).toEqual([
      'dragon:1,1',
      'seed:2,2',
      'seed-flip-revive:2,3',
      'dragon:3,3'
    ]);
  });

  test('real CardLogic processes seed duration as a turn-start anchor', () => {
    const RuntimeCardLogic = require('../game/logic/cards.js');
    const cardState = createTurnStartCardState([
      {
        id: 'seed-anchor',
        markerId: 'seed-anchor',
        kind: 'specialStone',
        row: 2,
        col: 2,
        owner: 'black',
        createdSeq: 20,
        data: { type: 'SEED', remainingOwnerTurns: 1 }
      }
    ]);
    const gameState = createEmptyGameState();

    const result = RuntimeCardLogic.processTurnStartStatusMarkerAnchor(
      cardState,
      gameState,
      'black',
      cardState.markers[0],
      {}
    );

    expect(result.processed).toBe(true);
    expect(cardState.markers.some((marker: any) => marker && marker.data && marker.data.type === 'SEED')).toBe(false);
    expect(gameState.board[2][2]).toBe(Shared.BLACK);
  });

  test('skips a queued marker that was deleted by an earlier anchor', () => {
    const prng = createPrng();
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
      },
      {
        id: 'anchor-B',
        markerId: 'anchor-B',
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        createdSeq: 20,
        data: { type: 'DESTROY_DRAGON', remainingOwnerTurns: 3 }
      }
    ]);
    const gameState = createEmptyGameState();
    const processedSources: string[] = [];
    const fakeCardLogic = {
      onTurnStart: jest.fn(() => null),
      processDestroyDragonEffectsAtTurnStartAnchor: jest.fn((nextCardState, _gameState, playerKey, row, col) => {
        processedSources.push(`${row},${col}`);
        if (row === 1 && col === 1) {
          nextCardState.markers = nextCardState.markers.filter((marker: any) => marker.markerId !== 'anchor-B');
        }
        return {
          destroyed: [{ sourceRow: row, sourceCol: col, row, col: col + 1, owner: playerKey }]
        };
      }),
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

    expect(processedSources).toEqual(['1,1']);
    expect(events.filter((event) => event && event.type === 'destroy_dragon_destroyed_start')).toHaveLength(1);
  });

  test('does not replace a deleted queued marker with a new marker at the same coordinate and type', () => {
    const prng = createPrng();
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
      },
      {
        id: 'anchor-B',
        markerId: 'anchor-B',
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        createdSeq: 20,
        data: { type: 'DESTROY_DRAGON', remainingOwnerTurns: 3 }
      }
    ]);
    const gameState = createEmptyGameState();
    const processedSources: string[] = [];
    const fakeCardLogic = {
      onTurnStart: jest.fn(() => null),
      processDestroyDragonEffectsAtTurnStartAnchor: jest.fn((nextCardState, _gameState, playerKey, row, col) => {
        processedSources.push(`${row},${col}`);
        if (row === 1 && col === 1) {
          nextCardState.markers = nextCardState.markers.filter((marker: any) => marker.markerId !== 'anchor-B');
          nextCardState.markers.push({
            id: 'replacement-C',
            markerId: 'replacement-C',
            kind: 'specialStone',
            row: 3,
            col: 3,
            owner: 'black',
            createdSeq: 30,
            data: { type: 'DESTROY_DRAGON', remainingOwnerTurns: 3 }
          });
        }
        return {
          destroyed: [{ sourceRow: row, sourceCol: col, row, col: col + 1, owner: playerKey }]
        };
      }),
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

    expect(processedSources).toEqual(['1,1']);
    expect(cardState.markers.map((marker: any) => marker.markerId)).toContain('replacement-C');
  });

  test('uses canonical source order when createdSeq is missing or tied', () => {
    const prng = createPrng();
    const cardState = createTurnStartCardState([
      {
        id: 'first-source',
        markerId: 'first-source',
        kind: 'specialStone',
        row: 1,
        col: 1,
        owner: 'black',
        data: { type: 'DESTROY_DRAGON', remainingOwnerTurns: 3 }
      },
      {
        id: 'second-source',
        markerId: 'second-source',
        kind: 'specialStone',
        row: 2,
        col: 2,
        owner: 'black',
        createdSeq: 0,
        data: { type: 'DESTROY_DRAGON', remainingOwnerTurns: 3 }
      },
      {
        id: 'third-source',
        markerId: 'third-source',
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        createdSeq: 0,
        data: { type: 'DESTROY_DRAGON', remainingOwnerTurns: 3 }
      }
    ]);
    const gameState = createEmptyGameState();
    const processedSources: string[] = [];
    const fakeCardLogic = {
      onTurnStart: jest.fn(() => null),
      processDestroyDragonEffectsAtTurnStartAnchor: jest.fn((_cardState, _gameState, _playerKey, row, col) => {
        const source = cardState.markers.find((marker: any) => marker.row === row && marker.col === col);
        processedSources.push(source && source.markerId);
        return { destroyed: [{ sourceRow: row, sourceCol: col, row, col: col + 1 }] };
      }),
      emitPresentationEvent: jest.fn()
    };

    TurnPipelinePhases.applyTurnStartPhase(
      fakeCardLogic,
      {},
      cardState,
      gameState,
      'black',
      [],
      prng
    );

    expect(processedSources).toEqual(['first-source', 'second-source', 'third-source']);
  });
});
