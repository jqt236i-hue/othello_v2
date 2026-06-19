jest.mock('../workers/match-worker-runtime-preload.js', () => ({}), { virtual: true });

const { createWorkerTurnPipelineModule } = require('../workers/match-worker.ts');

test('worker TurnPipeline applyTurnSafe persists next prngState and returns a stateHash', () => {
  const CardLogic = {
    flushPresentationEvents: jest.fn(() => [])
  };
  const Core = {
    BLACK: 1,
    WHITE: -1
  };
  const TurnPipelinePhases = {
    applyTurnStartPhase: jest.fn(),
    applyCardUsagePhase: jest.fn(),
    applyActionPhase: jest.fn((_CardLogic: any, _Core: any, _cardState: any, _gameState: any, _playerKey: any, _action: any, _events: any, prng: any) => {
      if (prng && typeof prng.random === 'function') prng.random();
    })
  };
  const BoardOps = {
    setActionContext: jest.fn((cardState: any, meta: any) => {
      cardState._currentActionMeta = meta;
    }),
    clearActionContext: jest.fn((cardState: any) => {
      delete cardState._currentActionMeta;
    })
  };
  let calls = 0;
  const prng = {
    random: jest.fn(() => {
      calls += 1;
      return 0.25;
    }),
    getState: jest.fn(() => ({ seed: 123, calls }))
  };

  const TurnPipeline = createWorkerTurnPipelineModule(CardLogic, Core, TurnPipelinePhases, BoardOps);
  const result = TurnPipeline.applyTurnSafe(
    { markers: [], presentationEvents: [], _presentationEventsPersist: [] },
    { currentPlayer: 1, board: Array.from({ length: 8 }, () => Array(8).fill(0)) },
    'black',
    { type: 'pass', actionId: 'op_1' },
    prng,
    { currentStateVersion: 4 }
  );

  expect(result.ok).toBe(true);
  expect(result.cardState.prngState).toEqual({ seed: 123, calls: 1 });
  expect(result.stateHash).toEqual(expect.any(String));
  expect(result.stateHash).not.toBe('');
});
