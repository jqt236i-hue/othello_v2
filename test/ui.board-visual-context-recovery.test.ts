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

function sourceTrajectoryEvents() {
  return Object.freeze([
    Object.freeze({
      type: 'destroy',
      phase: 2,
      actionId: 'context-trajectory',
      effectBlockId: 'context-trajectory-destroy',
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
      phase: 2,
      actionId: 'context-trajectory',
      effectBlockId: 'context-trajectory-flip',
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

function trajectoryFrame(frameToken: string, revision: number, settled: boolean) {
  const signatures = settled
    ? ['black:source', 'empty:destroyed', 'black:zombie', 'black:zombie-source']
    : ['black:source', 'white:target', 'white:target', 'black:zombie-source'];
  return {
    frameToken,
    model: {
      visualRevision: revision,
      topology: {
        baseRows: 8,
        baseCols: 8,
        minRow: 0,
        maxRow: 7,
        minCol: 0,
        maxCol: 7,
        renderRowOffset: 0,
        renderColOffset: 0,
        renderRows: 8,
        renderCols: 8,
        existingKeys: ['3,3', '3,4', '4,3', '4,4'],
        playableKeys: ['3,3', '3,4', '4,3', '4,4'],
        holeKeys: []
      },
      cells: ['3,3', '3,4', '4,3', '4,4'].map((key, index) => ({
        key,
        visualSignature: signatures[index]
      })),
      keyboardCursorKey: null,
      viewerContext: 'black',
      currentPlayer: 'black',
      canControlCurrentTurn: true,
      isHumanTurn: true
    },
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
        if (type === 'destroy' && context.recoveryReplay !== true) return activePhase.promise;
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
    const activeEvents = sourceTrajectoryEvents();
    const activeScope = Object.freeze({
      events: activeEvents,
      phaseKey: 'context-trajectory-restore',
      stepIndex: 0
    });
    const soundEvents = ['stone_destroy'];
    const logEvents = ['context trajectory action'];
    let originalSettled = false;
    const active = controller.playPhase(token, activeEvents, activeScope)
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
      { type: 'destroy', recoveryReplay: false },
      { type: 'completed', recoveryReplay: true },
      { type: 'destroy', recoveryReplay: true }
    ]);
    expect(soundEvents).toEqual(['stone_destroy']);
    expect(logEvents).toEqual(['context trajectory action']);
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

  test('switches an active original source trajectory exclusively to DOM with identical final digest', async () => {
    const activePhase = deferred();
    const order: string[] = [];
    let canvasWriterCount = 0;
    let domWriterCount = 0;
    let maximumWriterCount = 0;
    const observeWriters = () => {
      maximumWriterCount = Math.max(maximumWriterCount, canvasWriterCount + domWriterCount);
    };
    const originalEvents = sourceTrajectoryEvents();
    const soundEvents = ['zombie_will_bite'];
    const logEvents = ['context trajectory action'];
    const pixi = backend('pixi', {
      mount: jest.fn(() => {
        canvasWriterCount = 1;
        observeWriters();
      }),
      playPhase: jest.fn((events: readonly any[]) => {
        expect(events).toEqual(originalEvents);
        return activePhase.promise;
      }),
      destroy: jest.fn(() => {
        canvasWriterCount = 0;
        order.push('pixi:destroy');
        observeWriters();
      })
    });
    const dom = backend('dom', {
      mount: jest.fn(() => {
        domWriterCount = 1;
        order.push('dom:mount');
        observeWriters();
      }),
      restore: jest.fn(async () => { order.push('dom:restore'); }),
      playPhase: jest.fn(async (events: readonly any[], context: any) => {
        expect(events).toEqual(originalEvents);
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
    const checkpoint = trajectoryFrame('idle:dom-fallback', 6, false);
    controller.submitFrame(checkpoint);
    await controller.waitForIdle();
    const token = controller.claimWriter('local:dom-fallback', 'local');
    const phaseScope = Object.freeze({
      events: originalEvents,
      phaseKey: 'context-trajectory-fallback',
      stepIndex: 0
    });
    const active = controller.playPhase(token, originalEvents, phaseScope);
    await Promise.resolve();
    const recovery = controller.beginContextRecovery(new Error('context lost'));
    activePhase.reject(new Error('context lost'));

    await controller.replaceBackend(dom, { preserveContextRecovery: true });
    await controller.restoreContextRecovery({ backendAlreadyRestored: true });
    await recovery;
    await active;

    expect(order).toEqual(['pixi:destroy', 'dom:mount', 'dom:restore', 'dom:phase:true']);
    expect(maximumWriterCount).toBe(1);
    expect(canvasWriterCount).toBe(0);
    expect(domWriterCount).toBe(1);
    expect(soundEvents).toEqual(['zombie_will_bite']);
    expect(logEvents).toEqual(['context trajectory action']);
    expect(controller.getBackendKind()).toBe('dom');
    expect(controller.getMode()).toBe('playback');
    const finalFrame = trajectoryFrame('local:dom-fallback', 7, true);
    expect(controller.releaseWriter(token, finalFrame)).toBe(true);
    await controller.waitForIdle();

    const baselineBackend = backend('dom');
    const baselineController = ControllerModule.createBoardVisualController({ backend: baselineBackend });
    await baselineController.mount({} as HTMLElement);
    baselineController.submitFrame(finalFrame);
    await baselineController.waitForIdle();
    expect(controller.getVisualFrameDigest()).toBe(baselineController.getVisualFrameDigest());
    baselineController.destroy();
  });
});
