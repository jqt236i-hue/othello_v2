const ControllerModule = require('../ui/board-visual/controller');

function frame(frameToken: string, revision: number) {
  return {
    frameToken,
    model: { visualRevision: revision },
    layout: {},
    appearance: {},
    theme: {}
  } as any;
}

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function backend(kind: 'pixi' | 'dom' = 'pixi', overrides: any = {}) {
  return {
    kind,
    mount: jest.fn(),
    applyFrame: jest.fn(),
    playPhase: jest.fn(async () => undefined),
    getCellClientRect: jest.fn(() => null),
    resize: jest.fn(),
    restore: jest.fn(async () => undefined),
    destroy: jest.fn(),
    ...overrides
  };
}

describe('BoardVisualController context recovery', () => {
  test('restores the settled idle checkpoint without inventing playback', async () => {
    const visualBackend = backend();
    const controller = ControllerModule.createBoardVisualController({ backend: visualBackend });
    await controller.mount({} as HTMLElement);
    const checkpoint = frame('idle:checkpoint', 1);
    controller.submitFrame(checkpoint);
    await controller.waitForIdle();

    const recovery = controller.beginContextRecovery(new Error('context lost'));
    expect(controller.getMode()).toBe('recovering');
    expect(controller.isReady()).toBe(false);
    await controller.restoreContextRecovery();
    await recovery;

    expect(visualBackend.restore).toHaveBeenCalledWith(checkpoint);
    expect(visualBackend.playPhase).not.toHaveBeenCalled();
    expect(controller.getMode()).toBe('idle');
    expect(controller.isReady()).toBe(true);
  });

  test('replays completed and active board phases only, then resumes the original phase promise', async () => {
    const activePhase = deferred();
    const calls: Array<{ type: string; recoveryReplay: boolean }> = [];
    const visualBackend = backend('pixi', {
      playPhase: jest.fn((events: any[], context: any) => {
        const type = String(events[0]?.type || '');
        calls.push({ type, recoveryReplay: context.recoveryReplay === true });
        if (type === 'active' && context.recoveryReplay !== true) return activePhase.promise;
        return Promise.resolve();
      })
    });
    const controller = ControllerModule.createBoardVisualController({ backend: visualBackend });
    await controller.mount({} as HTMLElement);
    const checkpoint = frame('idle:before-playback', 2);
    controller.submitFrame(checkpoint);
    await controller.waitForIdle();
    const token = controller.claimWriter('local:context-replay', 'local');

    const completedScope = Object.freeze({ events: Object.freeze([{ type: 'completed' }]) });
    await controller.playPhase(token, [{ type: 'completed' }], completedScope);
    const activeScope = Object.freeze({ events: Object.freeze([{ type: 'active' }]) });
    let originalSettled = false;
    const active = controller.playPhase(token, [{ type: 'active' }], activeScope)
      .then(() => { originalSettled = true; });
    await Promise.resolve();

    const recovery = controller.beginContextRecovery(new Error('context lost'));
    activePhase.reject(new Error('context lost'));
    await Promise.resolve();
    expect(originalSettled).toBe(false);

    await controller.restoreContextRecovery();
    await recovery;
    await active;

    expect(visualBackend.restore).toHaveBeenCalledWith(checkpoint);
    expect(calls).toEqual([
      { type: 'completed', recoveryReplay: false },
      { type: 'active', recoveryReplay: false },
      { type: 'completed', recoveryReplay: true },
      { type: 'active', recoveryReplay: true }
    ]);
    expect(controller.getMode()).toBe('playback');
    expect(controller.releaseWriter(token)).toBe(true);
  });

  test('does not replay events after strict network handoff and permits committed apply afterward', async () => {
    const visualBackend = backend();
    const controller = ControllerModule.createBoardVisualController({ backend: visualBackend });
    await controller.mount({} as HTMLElement);
    const checkpoint = frame('idle:network-checkpoint', 3);
    controller.submitFrame(checkpoint);
    await controller.waitForIdle();
    const token = controller.claimWriter('network:context-commit', 'network');
    await controller.playPhase(token, [{ type: 'place' }], Object.freeze({ events: [] }));
    controller.beginAwaitingFrameCommit(token);
    const phaseCallCount = visualBackend.playPhase.mock.calls.length;

    const recovery = controller.beginContextRecovery(new Error('context lost'));
    await controller.restoreContextRecovery();
    await recovery;

    expect(visualBackend.restore).toHaveBeenCalledWith(checkpoint);
    expect(visualBackend.playPhase).toHaveBeenCalledTimes(phaseCallCount);
    expect(controller.getMode()).toBe('awaiting-frame-commit');
    await controller.applyCommittedFrame(token, frame('network:context-commit', 4));
    expect(controller.releaseWriter(token)).toBe(true);
  });

  test('restores a store-committed frame without replay when context loss interrupts its visual settlement', async () => {
    const committedSettlement = deferred();
    const committed = frame('network:committed-recovery', 5);
    let committedSettlementPending = true;
    const visualBackend = backend('pixi', {
      waitForVisualSettlement: jest.fn((value?: any) => (
        value === committed && committedSettlementPending
          ? committedSettlement.promise
          : Promise.resolve()
      ))
    });
    const controller = ControllerModule.createBoardVisualController({ backend: visualBackend });
    await controller.mount({} as HTMLElement);
    const checkpoint = frame('idle:before-committed-recovery', 4);
    controller.submitFrame(checkpoint);
    await controller.waitForIdle();
    const token = controller.claimWriter('network:committed-recovery', 'network');
    controller.beginAwaitingFrameCommit(token);
    const applying = controller.applyCommittedFrame(token, committed);
    await Promise.resolve();

    const recovery = controller.beginContextRecovery(new Error('context lost'));
    committedSettlement.reject(new Error('context lost'));
    await expect(applying).rejects.toThrow('context lost');
    committedSettlementPending = false;
    await controller.restoreContextRecovery();
    await recovery;

    expect(visualBackend.restore).toHaveBeenLastCalledWith(committed);
    expect(visualBackend.playPhase).not.toHaveBeenCalled();
    expect(controller.getMode()).toBe('awaiting-frame-commit');
    expect(controller.releaseWriter(token)).toBe(true);
  });

  test('switches exclusively to DOM and replays the same board checkpoint once', async () => {
    const activePhase = deferred();
    const order: string[] = [];
    const pixi = backend('pixi', {
      playPhase: jest.fn(() => activePhase.promise),
      destroy: jest.fn(() => { order.push('pixi:destroy'); })
    });
    const dom = backend('dom', {
      mount: jest.fn(() => { order.push('dom:mount'); }),
      restore: jest.fn(async () => { order.push('dom:restore'); }),
      playPhase: jest.fn(async (_events: unknown[], context: any) => {
        order.push(`dom:phase:${context.recoveryReplay === true}`);
      })
    });
    const controller = ControllerModule.createBoardVisualController({ backend: pixi });
    const host = {
      hasAttribute: jest.fn(() => false),
      setAttribute: jest.fn(),
      removeAttribute: jest.fn()
    } as unknown as HTMLElement;
    await controller.mount(host);
    const checkpoint = frame('idle:dom-fallback', 6);
    controller.submitFrame(checkpoint);
    await controller.waitForIdle();
    const token = controller.claimWriter('local:dom-fallback', 'local');
    const active = controller.playPhase(token, [{ type: 'move' }], Object.freeze({ events: [] }));
    await Promise.resolve();
    const recovery = controller.beginContextRecovery(new Error('context lost'));
    activePhase.reject(new Error('context lost'));

    await controller.replaceBackend(dom, { preserveContextRecovery: true });
    await controller.restoreContextRecovery({ backendAlreadyRestored: true });
    await recovery;
    await active;

    expect(order).toEqual(['pixi:destroy', 'dom:mount', 'dom:restore', 'dom:phase:true']);
    expect(controller.getBackendKind()).toBe('dom');
    expect(controller.getMode()).toBe('playback');
    expect(controller.releaseWriter(token)).toBe(true);
  });
});
