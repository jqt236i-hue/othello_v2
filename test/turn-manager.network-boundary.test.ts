describe('turn-manager network boundary', () => {
  beforeEach(() => {
    jest.resetModules();
    (global as any).BLACK = 1;
    (global as any).WHITE = -1;
    (global as any).gameState = { currentPlayer: 1 };
    (global as any).cardState = {
      fateWillControllerByTurnOwner: {},
      pendingEffectByPlayer: { black: null, white: null }
    };
    (global as any).NetworkMatchClient = {
      isSpectator: jest.fn(() => true),
      getSeatKey: jest.fn(() => 'black')
    };
  });

  afterEach(() => {
    delete (global as any).BLACK;
    delete (global as any).WHITE;
    delete (global as any).gameState;
    delete (global as any).cardState;
    delete (global as any).NetworkMatchClient;
  });

  test('does not discover root NetworkMatchClient from the game layer', () => {
    const turnManager = require('../game/turn-manager.js');
    const emitStatus = jest.fn();

    turnManager.setUIImpl({
      getRuntimeRoot: () => global,
      readMatchMode: () => 'network',
      LOCAL_PLAYER_KEY: 'black',
      emitStatus
    });

    expect(turnManager.canLocalUserOperateCurrentTurn()).toBe(true);
    expect((global as any).NetworkMatchClient.isSpectator).not.toHaveBeenCalled();
    expect((global as any).NetworkMatchClient.getSeatKey).not.toHaveBeenCalled();
    expect(emitStatus).not.toHaveBeenCalled();
  });

  test('uses injected isNetworkSpectator bridge for read-only spectator status', () => {
    const turnManager = require('../game/turn-manager.js');
    const emitStatus = jest.fn();

    turnManager.setUIImpl({
      getRuntimeRoot: () => global,
      readMatchMode: () => 'network',
      LOCAL_PLAYER_KEY: 'black',
      isNetworkSpectator: () => true,
      emitStatus
    });

    expect(turnManager.canLocalUserOperateCurrentTurn()).toBe(false);
    expect(emitStatus).toHaveBeenCalledWith('観測中は操作できません', true);
  });
});
