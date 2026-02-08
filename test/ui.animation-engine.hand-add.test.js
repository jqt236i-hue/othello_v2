describe('animation-engine hand_add', () => {
  beforeEach(() => {
    jest.resetModules();
    global.window = {
      __telemetry__: { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 },
      playDrawCardHandAnimation: jest.fn(() => Promise.resolve()),
      playCardUseHandAnimation: jest.fn(() => Promise.resolve())
    };
    global.document = {
      getElementById: () => ({
        classList: { add() {}, remove() {} },
        querySelector: () => null
      })
    };
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
  });

  test('delegates hand_add to draw-hand animation helper', async () => {
    const engine = require('../ui/animation-engine');
    await engine.executeEvent({
      type: 'hand_add',
      targets: [{ player: 'black', cardId: 'card_1', count: 1 }]
    });

    expect(global.window.playDrawCardHandAnimation).toHaveBeenCalledTimes(1);
    expect(global.window.playDrawCardHandAnimation).toHaveBeenCalledWith(
      expect.objectContaining({ player: 'black', cardId: 'card_1', count: 1 })
    );
  });

  test('delegates card_use_animation to card-use hand animation helper', async () => {
    const engine = require('../ui/animation-engine');
    await engine.executeEvent({
      type: 'card_use_animation',
      targets: [{ player: 'black', owner: 'black', cardId: 'card_2', cost: 5, name: 'X' }]
    });

    expect(global.window.playCardUseHandAnimation).toHaveBeenCalledTimes(1);
    expect(global.window.playCardUseHandAnimation).toHaveBeenCalledWith(
      expect.objectContaining({ player: 'black', owner: 'black', cardId: 'card_2', cost: 5, name: 'X' })
    );
  });
});
