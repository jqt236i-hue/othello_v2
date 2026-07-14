import { detachOnnxWorkerExecutor } from '../browser-vite/cpu-worker/main-thread-fallback';

describe('browser CPU Worker ONNX fallback', () => {
  test('detaches both ONNX runtimes before clearing Worker globals', () => {
    const othelloConfigure = jest.fn();
    const othelloClear = jest.fn();
    const policyConfigure = jest.fn();
    const policyClear = jest.fn();
    const root: any = {
      __CARD_REVERSI_CPU_WORKER_CLIENT__: { id: 'client' },
      __CARD_REVERSI_ONNX_WORKER_EXECUTOR__: { id: 'executor' },
      require: jest.fn((moduleKey: string) => {
        if (moduleKey === 'game/ai/othello-onnx-runtime') {
          return { configure: othelloConfigure, clearModel: othelloClear };
        }
        if (moduleKey === 'game/ai/policy-onnx-runtime') {
          return { configure: policyConfigure, clearModel: policyClear };
        }
        throw new Error(`unexpected module: ${moduleKey}`);
      })
    };

    const result = detachOnnxWorkerExecutor(root);

    expect(result).toEqual({ hadWorkerExecutor: true, errors: [] });
    expect(othelloConfigure).toHaveBeenCalledWith({ inferenceExecutor: null });
    expect(policyConfigure).toHaveBeenCalledWith({ inferenceExecutor: null });
    expect(othelloConfigure.mock.invocationCallOrder[0]).toBeLessThan(othelloClear.mock.invocationCallOrder[0]);
    expect(policyConfigure.mock.invocationCallOrder[0]).toBeLessThan(policyClear.mock.invocationCallOrder[0]);
    expect(root.__CARD_REVERSI_CPU_WORKER_CLIENT__).toBeUndefined();
    expect(root.__CARD_REVERSI_ONNX_WORKER_EXECUTOR__).toBeUndefined();
  });

  test('reports a missing compatibility runtime while still clearing stale globals', () => {
    const root: any = {
      __CARD_REVERSI_CPU_WORKER_CLIENT__: { id: 'client' },
      __CARD_REVERSI_ONNX_WORKER_EXECUTOR__: { id: 'executor' }
    };

    const result = detachOnnxWorkerExecutor(root);

    expect(result.hadWorkerExecutor).toBe(true);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('compatibility runtime is unavailable');
    expect(root.__CARD_REVERSI_CPU_WORKER_CLIENT__).toBeUndefined();
    expect(root.__CARD_REVERSI_ONNX_WORKER_EXECUTOR__).toBeUndefined();
  });
});
