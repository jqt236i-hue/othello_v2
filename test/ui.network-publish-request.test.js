const NetworkPublishRequestModule = require('../ui/network/publish-request.js');

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
});
