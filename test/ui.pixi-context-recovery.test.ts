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

function originalTrajectoryEvents() {
  return Object.freeze([
    Object.freeze({
      type: 'destroy',
      targets: Object.freeze([Object.freeze({
        r: 3,
        col: 4,
        sourceRow: 3,
        sourceCol: 3,
        cause: 'SNIPER_WILL',
        reason: 'sniper_shot',
        ownerBefore: 'white'
      })])
    }),
    Object.freeze({
      type: 'flip',
      targets: Object.freeze([Object.freeze({
        r: 4,
        col: 3,
        ownerBefore: 'white',
        ownerAfter: 'black',
        cause: 'ZOMBIE',
        reason: 'zombie_infection',
        meta: Object.freeze({ sourceRow: 4, sourceCol: 4 })
      })])
    })
  ]);
}

function settleTrajectoryDigest(events: readonly any[]): string {
  const board: Record<string, string | null> = {
    '3,3': 'black',
    '3,4': 'white',
    '4,3': 'white',
    '4,4': 'black'
  };
  for (const event of events) {
    for (const target of event.targets || []) {
      const key = `${target.r},${target.col}`;
      if (event.type === 'destroy') board[key] = null;
      if (event.type === 'flip') board[key] = target.ownerAfter || null;
    }
  }
  return JSON.stringify(Object.fromEntries(Object.entries(board).sort(([left], [right]) => left.localeCompare(right))));
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

  test('switches an active original source trajectory to the exclusive DOM fallback exactly once', async () => {
    const target = new EventTarget();
    const timers = timerHarness();
    const restore = deferred<boolean>();
    const events = originalTrajectoryEvents();
    const expectedDigest = settleTrajectoryDigest(events);
    const sounds = ['zombie_will_bite'];
    const logs = ['context trajectory action'];
    let activePixiTrajectory = true;
    let canvasWriterCount = 1;
    let domWriterCount = 0;
    let maximumWriterCount = 1;
    let finalDigest: string | null = null;
    const onFallbackRequired = jest.fn(async () => {
      expect(activePixiTrajectory).toBe(false);
      expect(canvasWriterCount).toBe(0);
      domWriterCount = 1;
      maximumWriterCount = Math.max(maximumWriterCount, canvasWriterCount + domWriterCount);
      finalDigest = settleTrajectoryDigest(events);
      return true;
    });
    const recovery = createPixiContextRecovery({
      target,
      onContextLost: jest.fn(() => {
        activePixiTrajectory = false;
        canvasWriterCount = 0;
      }),
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
    expect(finalDigest).toBe(expectedDigest);
    expect(events.map((event) => event.type)).toEqual(['destroy', 'flip']);
    expect(sounds).toEqual(['zombie_will_bite']);
    expect(logs).toEqual(['context trajectory action']);
    expect(maximumWriterCount).toBe(1);
    expect(canvasWriterCount).toBe(0);
    expect(domWriterCount).toBe(1);

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
