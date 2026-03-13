const adapter = require('../game/turn/pipeline_ui_adapter');

describe('pipeline_ui_adapter turn-start suppression', () => {
  test('passes skipTurnStart to applyTurnSafe for adapter-driven actions', () => {
    const turnPipeline = {
      applyTurnSafe: jest.fn(() => ({
        ok: true,
        gameState: { currentPlayer: 1 },
        cardState: { turnIndex: 5, presentationEvents: [] },
        events: [],
        presentationEvents: []
      }))
    };

    adapter.runTurnWithAdapter(
      { turnIndex: 5, presentationEvents: [] },
      { currentPlayer: 1 },
      'black',
      { type: 'use_card', useCardId: 'perma_01' },
      turnPipeline
    );

    expect(turnPipeline.applyTurnSafe).toHaveBeenCalledTimes(1);
    expect(turnPipeline.applyTurnSafe.mock.calls[0][5]).toEqual(expect.objectContaining({
      skipTurnStart: true,
      currentStateVersion: 5
    }));
  });
});