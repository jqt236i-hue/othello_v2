import * as path from 'path';

const phases = require(path.resolve(__dirname, '..', 'game', 'turn', 'turn_pipeline_phases.js'));

describe('turn pipeline phase mode DI', () => {
  beforeEach(() => {
    phases.setTurnPipelinePhasesRuntime(null);
    delete global.MATCH_MODE;
    delete global.__MATCH_MODE;
  });

  afterEach(() => {
    phases.setTurnPipelinePhasesRuntime(null);
    delete global.MATCH_MODE;
    delete global.__MATCH_MODE;
  });

  test('turn start uses injected reversi mode before legacy global cpu mode', () => {
    global.MATCH_MODE = 'cpu';
    const onTurnStart = jest.fn(() => null);
    const cardState = {
      lastTurnStartedFor: null,
      markers: [],
      presentationEvents: [],
      hands: { black: [], white: [] },
      pendingEffectByPlayer: { black: null, white: null }
    };
    const gameState = {
      currentPlayer: 1,
      roundNumber: 1,
      turnNumber: 1
    };
    const events: any[] = [];

    phases.setTurnPipelinePhasesRuntime({
      readMatchMode: () => 'reversi'
    });

    const result = phases.applyTurnStartPhase(
      { onTurnStart },
      {},
      cardState,
      gameState,
      'black',
      events,
      null
    );

    expect(result.ok).toBe(true);
    expect(events).toContainEqual({ type: 'turn_start', player: 'black' });
    expect(onTurnStart).not.toHaveBeenCalled();
  });

  test('turn start ignores legacy global reversi mode without injected runtime', () => {
    global.MATCH_MODE = 'reversi';
    const onTurnStart = jest.fn(() => null);
    const cardState = {
      lastTurnStartedFor: null,
      markers: [],
      presentationEvents: [],
      hands: { black: [], white: [] },
      pendingEffectByPlayer: { black: null, white: null }
    };
    const gameState = {
      currentPlayer: 1,
      roundNumber: 1,
      turnNumber: 1
    };
    const events: any[] = [];

    phases.applyTurnStartPhase(
      { onTurnStart },
      {},
      cardState,
      gameState,
      'black',
      events,
      null
    );

    expect(onTurnStart).toHaveBeenCalledTimes(1);
  });
});
