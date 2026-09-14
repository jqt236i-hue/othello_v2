jest.mock('../game/ai/cpu-lv11-search', () => ({ searchLv11: jest.fn() }));
import { searchLv11 } from '../game/ai/cpu-lv11-search';
import { executeLv11WorkerMessage } from '../browser-vite/cpu-worker/lv11-worker-entry';
import { CPU_WORKER_OPERATIONS, CPU_WORKER_PROTOCOL_VERSION, parseCpuWorkerResponse } from '../browser-vite/cpu-worker/protocol';

function request() {
  return { kind: 'request', protocolVersion: CPU_WORKER_PROTOCOL_VERSION,
    requestId: 'lv11-test-1', operation: CPU_WORKER_OPERATIONS.LV11_ADVISE,
    decisionEpoch: 2, stateVersion: 3, turnNumber: 12,
    payload: { observation: { schema: 'cpu_lv10_observation.v1', player: 'black',
      gameState: { turnNumber: 12 }, cardState: {} },
      publicRecipes: { black: ['destroy_01'] }, excludedActions: [{ type: 'pass' }] }
  };
}

test('Lv11 transport uses the evaluated policy with a live clock and no search budget override', () => {
  const result = { version: 'test', transitions: 4096, continuation: [], action: { type: 'pass' } };
  (searchLv11 as jest.Mock).mockReturnValue(result);
  const input = request();
  const response = executeLv11WorkerMessage(input)!;
  expect(parseCpuWorkerResponse(response)).toMatchObject({ ok: true, result,
    requestId: input.requestId, operation: CPU_WORKER_OPERATIONS.LV11_ADVISE });
  const [observation, options] = (searchLv11 as jest.Mock).mock.calls.at(-1)!;
  expect(observation).toEqual(input.payload.observation);
  expect(Object.keys(options).sort()).toEqual(['excludedActions', 'now', 'publicRecipes']);
  expect(options.publicRecipes).toEqual(input.payload.publicRecipes);
  expect(options.excludedActions).toEqual(input.payload.excludedActions);
  const before = performance.now();
  expect(options.now()).toBeGreaterThanOrEqual(before);
  expect(options.now()).toBeLessThanOrEqual(performance.now());
});

test('private deck state is rejected before Lv11 search', () => {
  (searchLv11 as jest.Mock).mockClear();
  const input = request();
  (input.payload.observation.cardState as any).decks = { black: ['destroy_01'] };
  expect(() => executeLv11WorkerMessage(input)).toThrow(/Private state/);
  expect(searchLv11).not.toHaveBeenCalled();
});

test('search exceptions produce an explicit failure and cancellation does not search', () => {
  (searchLv11 as jest.Mock).mockImplementation(() => { throw new Error('test failure'); });
  expect(executeLv11WorkerMessage(request())).toMatchObject({ ok: false,
    error: { code: 'LV11_SEARCH_FAILED', message: 'test failure', recoverable: true } });
  (searchLv11 as jest.Mock).mockClear();
  expect(executeLv11WorkerMessage({ kind: 'cancel' })).toBeNull();
  expect(searchLv11).not.toHaveBeenCalled();
});
