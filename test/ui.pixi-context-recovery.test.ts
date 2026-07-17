import { createPixiContextRecovery } from '../ui/pixi/context-recovery';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(iterations = 8) {
  for (let index = 0; index < iterations; index += 1) {
    await Promise.resolve();
  }
}

function timerHarness() {
  const timers = new Map<number, () => void>();
  let sequence = 0;
  return {
    setTimeout: jest.fn((callback: () => void) => {
      const id = ++sequence;
      timers.set(id, callback);
      return id;
    }),
    clearTimeout: jest.fn((id: unknown) => timers.delete(Number(id))),
    fire() {
      const callbacks = Array.from(timers.values());
      timers.clear();
      callbacks.forEach((callback) => callback());
    },
    get size() { return timers.size; }
  };
}

describe('Pixi context recovery state machine', () => {
  test('prevents context loss and settles a restored checkpoint without fallback', async () => {
    const target = new EventTarget();
    const timers = timerHarness();
    const onContextLost = jest.fn();
    const onContextRestored = jest.fn(async () => true);
    const onFallbackRequired = jest.fn(async () => true);
    const recovery = createPixiContextRecovery({
      target,
      timeoutMs: 5000,
      onContextLost,
      onContextRestored,
      onFallbackRequired,
      setTimeout: timers.setTimeout,
      clearTimeout: timers.clearTimeout
    });
    const lost = new Event('webglcontextlost', { cancelable: true });

    target.dispatchEvent(lost);
    expect(lost.defaultPrevented).toBe(true);
    expect(onContextLost).toHaveBeenCalledTimes(1);
    expect(recovery.getDiagnostics()).toMatchObject({ state: 'lost', timerActive: true, lossCount: 1 });

    target.dispatchEvent(new Event('webglcontextrestored'));
    await flushMicrotasks();

    expect(onContextRestored).toHaveBeenCalledTimes(1);
    expect(onFallbackRequired).not.toHaveBeenCalled();
    expect(recovery.getDiagnostics()).toMatchObject({
      state: 'idle',
      restoreAttemptCount: 1,
      restoreSuccessCount: 1,
      timerActive: false
    });
  });

  test('switches to fallback exactly once when restore does not finish by the deadline', async () => {
    const target = new EventTarget();
    const timers = timerHarness();
    const restore = deferred<boolean>();
    const onFallbackRequired = jest.fn(async () => true);
    const recovery = createPixiContextRecovery({
      target,
      onContextLost: jest.fn(),
      onContextRestored: jest.fn(() => restore.promise),
      onFallbackRequired,
      setTimeout: timers.setTimeout,
      clearTimeout: timers.clearTimeout
    });

    target.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    target.dispatchEvent(new Event('webglcontextrestored'));
    await flushMicrotasks();
    expect(recovery.getDiagnostics().state).toBe('restoring');

    timers.fire();
    await flushMicrotasks();
    expect(onFallbackRequired).toHaveBeenCalledTimes(1);
    expect(recovery.getDiagnostics()).toMatchObject({
      state: 'idle',
      fallbackAttemptCount: 1,
      fallbackSuccessCount: 1
    });

    restore.resolve(true);
    target.dispatchEvent(new Event('webglcontextrestored'));
    timers.fire();
    await flushMicrotasks();
    expect(onFallbackRequired).toHaveBeenCalledTimes(1);
  });

  test('reports a terminal error only when DOM compatibility recovery also fails', async () => {
    const target = new EventTarget();
    const timers = timerHarness();
    const onRecoveryFailed = jest.fn();
    const recovery = createPixiContextRecovery({
      target,
      onContextLost: jest.fn(),
      onContextRestored: jest.fn(async () => false),
      onFallbackRequired: jest.fn(async () => { throw new Error('dom mount failed'); }),
      onRecoveryFailed,
      setTimeout: timers.setTimeout,
      clearTimeout: timers.clearTimeout
    });

    target.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    target.dispatchEvent(new Event('webglcontextrestored'));
    await flushMicrotasks();
    timers.fire();
    await flushMicrotasks();

    expect(onRecoveryFailed).toHaveBeenCalledWith(expect.objectContaining({ message: 'dom mount failed' }));
    expect(recovery.getDiagnostics()).toMatchObject({ state: 'failed', failureCount: 1 });
  });

  test('destroy removes listeners and cancels an active deadline', () => {
    const target = new EventTarget();
    const timers = timerHarness();
    const onContextLost = jest.fn();
    const recovery = createPixiContextRecovery({
      target,
      onContextLost,
      onContextRestored: jest.fn(async () => true),
      onFallbackRequired: jest.fn(async () => true),
      setTimeout: timers.setTimeout,
      clearTimeout: timers.clearTimeout
    });

    target.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    expect(timers.size).toBe(1);
    recovery.destroy();
    expect(timers.size).toBe(0);
    target.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    expect(onContextLost).toHaveBeenCalledTimes(1);
    expect(recovery.getDiagnostics().state).toBe('destroyed');
  });
});
