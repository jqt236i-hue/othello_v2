jest.mock('../game/ai/cpu-lv12-search', () => ({ searchLv12: jest.fn() }));
import { searchLv12 } from '../game/ai/cpu-lv12-search';
import { executeLv12WorkerMessage } from '../browser-vite/cpu-worker/lv12-worker-entry';
import { CPU_WORKER_OPERATIONS, CPU_WORKER_PROTOCOL_VERSION, parseCpuWorkerResponse } from '../browser-vite/cpu-worker/protocol';

function request() {
  return { kind: 'request', protocolVersion: CPU_WORKER_PROTOCOL_VERSION,
    requestId: 'lv12-test-1', operation: CPU_WORKER_OPERATIONS.LV12_ADVISE,
    decisionEpoch: 2, stateVersion: 3, turnNumber: 12,
    payload: { observation: { schema: 'cpu_lv10_observation.v1', player: 'black',
      gameState: { turnNumber: 12 }, cardState: {} },
      publicRecipes: { black: ['destroy_01'] }, excludedActions: [{ type: 'pass' }] }
  };
}

test('Lv12 transport uses the evaluated policy with a live clock and no search budget override', () => {
  const result = { version: 'test', transitions: 4096, continuation: [], action: { type: 'pass' } };
  (searchLv12 as jest.Mock).mockReturnValue(result);
  const input = request();
  const response = executeLv12WorkerMessage(input)!;
  expect(parseCpuWorkerResponse(response)).toMatchObject({ ok: true, result,
    requestId: input.requestId, operation: CPU_WORKER_OPERATIONS.LV12_ADVISE });
  const [observation, options] = (searchLv12 as jest.Mock).mock.calls.at(-1)!;
  expect(observation).toEqual(input.payload.observation);
  expect(Object.keys(options).sort()).toEqual(['excludedActions', 'now', 'publicRecipes']);
  expect(options.publicRecipes).toEqual(input.payload.publicRecipes);
  expect(options.excludedActions).toEqual(input.payload.excludedActions);
  const before = performance.now();
  expect(options.now()).toBeGreaterThanOrEqual(before);
  expect(options.now()).toBeLessThanOrEqual(performance.now());
});

test('private deck state is rejected before Lv12 search', () => {
  (searchLv12 as jest.Mock).mockClear();
  const input = request();
  (input.payload.observation.cardState as any).decks = { black: ['destroy_01'] };
  expect(() => executeLv12WorkerMessage(input)).toThrow(/Private state/);
  expect(searchLv12).not.toHaveBeenCalled();
});

test('search exceptions produce an explicit failure and cancellation does not search', () => {
  (searchLv12 as jest.Mock).mockImplementation(() => { throw new Error('test failure'); });
  expect(executeLv12WorkerMessage(request())).toMatchObject({ ok: false,
    error: { code: 'LV12_SEARCH_FAILED', message: 'test failure', recoverable: true } });
  (searchLv12 as jest.Mock).mockClear();
  expect(executeLv12WorkerMessage({ kind: 'cancel' })).toBeNull();
  expect(searchLv12).not.toHaveBeenCalled();
});
