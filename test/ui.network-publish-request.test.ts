import * as NetworkPublishRequestModule from '../ui/network/publish-request.js';

describe('NetworkPublishRequestModule', () => {
  test('builds request payload from command payload result', () => {
    const result = NetworkPublishRequestModule.buildPublishRequest({
      action: {
        type: 'place',
        playerKey: 'black',
        row: 4,
        col: 5
      }
    }, {
      playerKey: 'black',
      roomId: 'ROOM123',
      seatKey: 'black',
      seatToken: 'seat-token',
      operationId: 'op_123',
      baseVersion: 42,
      buildPublishCommandPayload: () => ({
        actionType: 'place',
        actor: 'black',
        params: { row: 4, col: 5 }
      })
    });

    expect(result).toEqual({
      commandPayload: {
        actionType: 'place',
        actor: 'black',
        params: { row: 4, col: 5 }
      },
      queuedActionType: 'place',
      requestPayload: {
        roomId: 'ROOM123',
        seatKey: 'black',
        seatToken: 'seat-token',
        playerKey: 'black',
        actionType: 'place',
        operationId: 'op_123',
        baseVersion: 42,
        actor: 'black',
        params: { row: 4, col: 5 },
        action: {
          type: 'place',
          playerKey: 'black',
          row: 4,
          col: 5
        }
      }
    });
  });

  test('returns null when no command payload can be built', () => {
    const result = NetworkPublishRequestModule.buildPublishRequest({}, {
      playerKey: 'black',
      buildPublishCommandPayload: () => null
    });

    expect(result).toBeNull();
  });

  test('prefers explicit request turnIndex over stale action turnIndex', () => {
    const result = NetworkPublishRequestModule.buildPublishRequest({
      action: {
        type: 'place',
        playerKey: 'black',
        row: 4,
        col: 5,
        turnIndex: 10
      }
    }, {
      playerKey: 'black',
      roomId: 'ROOM123',
      seatKey: 'black',
      seatToken: 'seat-token',
      operationId: 'op_123',
      baseVersion: 42,
      turnIndex: 25,
      buildPublishCommandPayload: () => ({
        actionType: 'place',
        actor: 'black',
        params: { row: 4, col: 5 },
        turnIndex: 10
      })
    });

    expect(result.requestPayload.baseVersion).toBe(42);
    expect(result.requestPayload.turnIndex).toBe(25);
  });

  test('does not downgrade use_card turnIndex when live publish state is stale', () => {
    const result = NetworkPublishRequestModule.buildPublishRequest({
      action: {
        type: 'use_card',
        playerKey: 'black',
        useCardId: 'meteor_god_01',
        useCardOwnerKey: 'black',
        turnIndex: 4
      }
    }, {
      playerKey: 'black',
      roomId: 'ROOM123',
      seatKey: 'black',
      seatToken: 'seat-token',
      operationId: 'op_meteor_god_use',
      baseVersion: 42,
      turnIndex: 3,
      buildPublishCommandPayload: () => ({
        actionType: 'use_card',
        actor: 'black',
        params: {
          useCardId: 'meteor_god_01',
          useCardOwnerKey: 'black'
        },
        turnIndex: 4
      })
    });

    expect(result.requestPayload.actionType).toBe('use_card');
    expect(result.requestPayload.turnIndex).toBe(4);
  });

  test('uses command turnIndex for pending selection publish', () => {
    const result = NetworkPublishRequestModule.buildPublishRequest({
      action: {
        type: 'place',
        playerKey: 'black',
        swapTarget: { row: 3, col: 3 },
        pendingSelectionState: {
          type: 'SWAP_WITH_ENEMY',
          stage: 'selectTarget',
          cardId: 'swap_01'
        },
        turnIndex: 1
      }
    }, {
      playerKey: 'black',
      roomId: 'ROOM123',
      seatKey: 'black',
      seatToken: 'seat-token',
      operationId: 'op_123',
      baseVersion: 3,
      turnIndex: 2,
      buildPublishCommandPayload: () => ({
        actionType: 'place',
        actor: 'black',
        params: {
          player: 'black',
          swapTarget: { row: 3, col: 3 },
          pendingSelectionState: {
            type: 'SWAP_WITH_ENEMY',
            stage: 'selectTarget',
            cardId: 'swap_01'
          }
        },
        turnIndex: 1
      })
    });

    expect(result.requestPayload.baseVersion).toBe(3);
    expect(result.requestPayload.turnIndex).toBe(1);
  });
});
