const ControllerModule = require('../ui/board-visual/controller');

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function frame(frameToken: string, revision: number) {
  return {
    frameToken,
    model: { visualRevision: revision },
    layout: {},
    appearance: { revision },
    theme: {}
  } as any;
}

function backend(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'pixi',
    mount: jest.fn(),
    prepareFrame: jest.fn(async () => undefined),
    applyFrame: jest.fn(),
    playPhase: jest.fn(async () => undefined),
    waitForVisualSettlement: jest.fn(async () => undefined),
    getCellClientRect: jest.fn(() => null),
    resize: jest.fn(),
    restore: jest.fn(async () => undefined),
    destroy: jest.fn(),
    ...overrides
  } as any;
}

describe('BoardVisualController async visual settlement', () => {
  test('prepares only the latest queued initial frame before readiness', async () => {
    const mountGate = deferred();
    const firstPrepare = deferred();
    const prepared: string[] = [];
    const visualBackend = backend({
      mount: jest.fn(() => mountGate.promise),
      prepareFrame: jest.fn((value: any) => {
        prepared.push(value.frameToken);
        return value.frameToken === 'idle:first' ? firstPrepare.promise : Promise.resolve();
      })
    });
    const controller = ControllerModule.createBoardVisualController({ backend: visualBackend });
    const mounting = controller.mount({} as HTMLElement);
    controller.submitFrame(frame('idle:first', 1));
    mountGate.resolve();
    await Promise.resolve();
    await Promise.resolve();
    controller.submitFrame(frame('idle:latest', 2));
    firstPrepare.resolve();

    await mounting;
    await controller.waitUntilReady();
    expect(prepared).toEqual(['idle:first', 'idle:latest']);
    expect(visualBackend.applyFrame).toHaveBeenCalledTimes(1);
    expect(visualBackend.applyFrame).toHaveBeenCalledWith(frame('idle:latest', 2));
    expect(controller.getSnapshot().lastAppliedFrameToken).toBe('idle:latest');
  });

  test('does not report a strict committed frame successful before visual settlement', async () => {
    const settlement = deferred();
    let waitForCommitted = false;
    const visualBackend = backend({
      waitForVisualSettlement: jest.fn((value?: any) => (
        waitForCommitted && value?.frameToken === 'network:21' ? settlement.promise : Promise.resolve()
      ))
    });
    const controller = ControllerModule.createBoardVisualController({ backend: visualBackend });
    await controller.mount({} as HTMLElement);
    const token = controller.claimWriter('network:21', 'network');
    controller.beginAwaitingFrameCommit(token);
    waitForCommitted = true;
    let resolved = false;
    const applying = controller.applyCommittedFrame(token, frame('network:21', 21)).then(() => {
      resolved = true;
    });
    await Promise.resolve();

    expect(resolved).toBe(false);
    expect(controller.getMode()).toBe('awaiting-frame-commit');
    expect(() => controller.releaseWriter(token)).toThrow(/awaiting-frame-commit|successful committed frame apply/i);

    settlement.resolve();
    await applying;
    expect(resolved).toBe(true);
    expect(controller.releaseWriter(token)).toBe(true);
  });

  test('retains strict writer ownership when visual settlement fails', async () => {
    let failSettlement = false;
    const visualBackend = backend({
      waitForVisualSettlement: jest.fn(async (value?: any) => {
        if (failSettlement && value?.frameToken === 'network:failed-settlement') {
          throw new Error('texture upload failed');
        }
      })
    });
    const controller = ControllerModule.createBoardVisualController({ backend: visualBackend });
    await controller.mount({} as HTMLElement);
    const token = controller.claimWriter('network:failed-settlement', 'network');
    controller.beginAwaitingFrameCommit(token);
    failSettlement = true;

    await expect(controller.applyCommittedFrame(
      token,
      frame('network:failed-settlement', 22)
    )).rejects.toThrow('texture upload failed');
    expect(controller.getMode()).toBe('recovering');
    expect(controller.getSnapshot().activeFrameToken).toBe('network:failed-settlement');
    expect(controller.isReady()).toBe(false);
  });

  test('waitForIdle includes backend resource settlement after local writer release', async () => {
    const settlement = deferred();
    let waitAtIdle = false;
    const visualBackend = backend({
      waitForVisualSettlement: jest.fn((value?: any) => (
        waitAtIdle && !value ? settlement.promise : Promise.resolve()
      ))
    });
    const controller = ControllerModule.createBoardVisualController({ backend: visualBackend });
    await controller.mount({} as HTMLElement);
    const token = controller.claimWriter('local:resources', 'local');
    controller.submitFrame(frame('local:resources', 3));
    waitAtIdle = true;
    controller.releaseWriter(token);
    let idle = false;
    const waiting = controller.waitForIdle().then(() => { idle = true; });
    await Promise.resolve();
    expect(idle).toBe(false);

    settlement.resolve();
    await waiting;
    expect(idle).toBe(true);
  });
});
