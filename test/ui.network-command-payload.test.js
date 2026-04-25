const NetworkCommandPayloadModule = require('../ui/network/command-payload.js');

describe('NetworkCommandPayloadModule', () => {
  test('serializes action payload with actor, params, actionId, and turnIndex', () => {
    const payload = NetworkCommandPayloadModule.buildPublishCommandPayload({
      action: {
        type: 'place',
        playerKey: 'white',
        row: 2,
        col: 3,
        actionId: 'act_01',
        turnIndex: 9
      }
    }, {
      playerKey: 'white'
    });

    expect(payload).toEqual({
      actionType: 'place',
      actor: 'white',
      actionId: 'act_01',
      turnIndex: 9,
      params: {
        row: 2,
        col: 3
      }
    });
  });

  test('keeps deferred pending card identity inside pendingSelectionState only', () => {
    const payload = NetworkCommandPayloadModule.buildPublishCommandPayload({
      action: {
        type: 'place',
        playerKey: 'black',
        heavenBlessingCardId: 'offer_2',
        pendingSelectionState: {
          type: 'HEAVEN_BLESSING',
          stage: 'selectTarget',
          cardId: 'heaven_01'
        }
      }
    }, {
      playerKey: 'black'
    });

    expect(payload).toEqual({
      actionType: 'place',
      actor: 'black',
      params: {
        heavenBlessingCardId: 'offer_2',
        pendingSelectionState: {
          type: 'HEAVEN_BLESSING',
          stage: 'selectTarget',
          cardId: 'heaven_01'
        }
      }
    });
  });

  test('does not add top-level card use context from authoritative pendingSelectionState', () => {
    const payload = NetworkCommandPayloadModule.buildPublishCommandPayload({
      action: {
        type: 'place',
        playerKey: 'black',
        expansionTarget: { row: 7, col: 7 },
        pendingSelectionState: {
          type: 'BOARD_EXPANSION_GOD',
          stage: 'selectTarget',
          cardId: 'board_expand_god_01',
          selectedTargets: [{ row: 0, col: 0 }],
          selectedCount: 1,
          maxSelections: 2
        }
      }
    }, {
      playerKey: 'black'
    });

    expect(payload).toEqual({
      actionType: 'place',
      actor: 'black',
      params: {
        expansionTarget: { row: 7, col: 7 },
        pendingSelectionState: {
          type: 'BOARD_EXPANSION_GOD',
          stage: 'selectTarget',
          cardId: 'board_expand_god_01',
          selectedTargets: [{ row: 0, col: 0 }],
          selectedCount: 1,
          maxSelections: 2
        }
      }
    });
  });

  test('builds reset_game payload without explicit action object', () => {
    const payload = NetworkCommandPayloadModule.buildPublishCommandPayload({
      actionType: 'reset_game'
    }, {
      playerKey: 'black'
    });

    expect(payload).toEqual({
      actionType: 'reset_game',
      actor: 'black',
      params: {}
    });
  });
});
