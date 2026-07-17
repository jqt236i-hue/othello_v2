jest.mock('../workers/match-worker-runtime-preload.js', () => ({}), { virtual: true });

const { createWorkerTurnPipelineModule } = require('../workers/match-worker.ts');

const runtimeScope = globalThis as typeof globalThis & {
  TurnSubPlacementContinuation?: {
    isSubPlacementTurnActive: (cardState: unknown, playerKey: unknown) => boolean;
  };
};
const originalSubPlacementContinuation = runtimeScope.TurnSubPlacementContinuation;

beforeEach(() => {
  runtimeScope.TurnSubPlacementContinuation = {
    isSubPlacementTurnActive: () => false
  };
});

afterEach(() => {
  if (originalSubPlacementContinuation === undefined) {
    delete runtimeScope.TurnSubPlacementContinuation;
    return;
  }
  runtimeScope.TurnSubPlacementContinuation = originalSubPlacementContinuation;
});

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

test('worker TurnPipeline applyTurnSafe shares root expectedStateVersion rejection guard', () => {
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
    applyActionPhase: jest.fn()
  };

  const TurnPipeline = createWorkerTurnPipelineModule(CardLogic, Core, TurnPipelinePhases, {});
  const result = TurnPipeline.applyTurnSafe(
    { markers: [], presentationEvents: [] },
    { currentPlayer: 1, board: Array.from({ length: 8 }, () => Array(8).fill(0)) },
    'black',
    { type: 'pass', actionId: 'op_2' },
    null,
    { currentStateVersion: 4, expectedStateVersion: 3 }
  );

  expect(result.ok).toBe(false);
  expect(result.rejectedReason).toBe('VERSION_MISMATCH');
  expect(TurnPipelinePhases.applyActionPhase).not.toHaveBeenCalled();
});
