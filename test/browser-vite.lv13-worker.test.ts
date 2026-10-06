jest.mock('../game/ai/cpu-lv13-search', () => ({ searchLv13: jest.fn() }));
import { searchLv13 } from '../game/ai/cpu-lv13-search';
import { executeLv13WorkerMessage } from '../browser-vite/cpu-worker/lv13-worker-entry';
import { CPU_WORKER_OPERATIONS, CPU_WORKER_PROTOCOL_VERSION, parseCpuWorkerResponse } from '../browser-vite/cpu-worker/protocol';

function request() {
  return { kind: 'request', protocolVersion: CPU_WORKER_PROTOCOL_VERSION,
    requestId: 'lv13-test-1', operation: CPU_WORKER_OPERATIONS.LV13_ADVISE,
    decisionEpoch: 2, stateVersion: 3, turnNumber: 12,
    payload: { observation: { schema: 'cpu_lv10_observation.v1', player: 'black',
      gameState: { turnNumber: 12 }, cardState: {} },
      publicRecipes: { black: ['destroy_01'] }, excludedActions: [{ type: 'pass' }] }
  };
}

test('Lv13 transport uses the evaluated policy with a live clock and no search budget override', () => {
  const result = { version: 'test', transitions: 4096, continuation: [], action: { type: 'pass' } };
  (searchLv13 as jest.Mock).mockReturnValue(result);
  const input = request();
  const response = executeLv13WorkerMessage(input)!;
  expect(parseCpuWorkerResponse(response)).toMatchObject({ ok: true, result,
    requestId: input.requestId, operation: CPU_WORKER_OPERATIONS.LV13_ADVISE });
  const [observation, options] = (searchLv13 as jest.Mock).mock.calls.at(-1)!;
  expect(observation).toEqual(input.payload.observation);
  expect(Object.keys(options).sort()).toEqual(['excludedActions', 'now', 'publicRecipes']);
  expect(options.publicRecipes).toEqual(input.payload.publicRecipes);
  expect(options.excludedActions).toEqual(input.payload.excludedActions);
  const before = performance.now();
  expect(options.now()).toBeGreaterThanOrEqual(before);
  expect(options.now()).toBeLessThanOrEqual(performance.now());
});

test('private deck state is rejected before Lv13 search', () => {
  (searchLv13 as jest.Mock).mockClear();
  const input = request();
  (input.payload.observation.cardState as any).decks = { black: ['destroy_01'] };
  expect(() => executeLv13WorkerMessage(input)).toThrow(/Private state/);
  expect(searchLv13).not.toHaveBeenCalled();
});

test('search exceptions produce an explicit failure and cancellation does not search', () => {
  (searchLv13 as jest.Mock).mockImplementation(() => { throw new Error('test failure'); });
  expect(executeLv13WorkerMessage(request())).toMatchObject({ ok: false,
    error: { code: 'LV13_SEARCH_FAILED', message: 'test failure', recoverable: true } });
  (searchLv13 as jest.Mock).mockClear();
  expect(executeLv13WorkerMessage({ kind: 'cancel' })).toBeNull();
  expect(searchLv13).not.toHaveBeenCalled();
});
