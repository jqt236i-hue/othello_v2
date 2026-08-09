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
  test('publishes a frame to input consumers only after visual settlement commits', async () => {
    const settlement = deferred();
    const visualBackend = backend({
      waitForVisualSettlement: jest.fn(() => settlement.promise)
    });
    const controller = ControllerModule.createBoardVisualController({ backend: visualBackend });
    const settled: any[] = [];
    controller.subscribeSettledFrame((value: any) => settled.push(value));
    await controller.mount({} as HTMLElement);
    const value = frame('idle:settled-input', 1);

    expect(controller.submitFrame(value)).toBe(true);
    expect(controller.getSettledFrame()).toBeNull();
    expect(settled).toEqual([]);

    settlement.resolve();
    await controller.waitForIdle();
    await Promise.resolve();

    expect(controller.getSettledFrame()).toBe(value);
    expect(settled).toEqual([value]);
  });

  test('coalesces equivalent idle metadata while one identical backend frame is settling', async () => {
    const settlement = deferred();
    const visualBackend = backend({
      waitForVisualSettlement: jest.fn(() => settlement.promise)
    });
    const controller = ControllerModule.createBoardVisualController({ backend: visualBackend });
    await controller.mount({} as HTMLElement);
    const completeFrame = (token: string) => ({
      ...frame(token, 3),
      layout: { revision: 2 },
      appearance: { revision: 4 },
      theme: { revision: 5 },
      renderSessionId: 'board-render-session:coalesced-idle'
    }) as any;
    const first = completeFrame('idle:coalesced-1');
    const latest = completeFrame('idle:coalesced-2');

    expect(controller.submitFrame(first)).toBe(true);
    expect(controller.submitFrame(latest)).toBe(true);
    expect(visualBackend.applyFrame).toHaveBeenCalledTimes(1);
    expect(controller.getSettledFrame()).toBeNull();

    settlement.resolve();
    await controller.waitForIdle();
    await Promise.resolve();

    expect(visualBackend.applyFrame).toHaveBeenCalledTimes(1);
    expect(controller.getSettledFrame()).toBe(latest);
    expect(controller.getSnapshot().lastAppliedFrameToken).toBe('idle:coalesced-2');
  });

  test('does not publish a frame whose visual settlement rolls back', async () => {
    const settlement = deferred();
    const visualBackend = backend({
      waitForVisualSettlement: jest.fn(() => settlement.promise)
    });
    const controller = ControllerModule.createBoardVisualController({ backend: visualBackend });
    const listener = jest.fn();
    controller.subscribeSettledFrame(listener);
    await controller.mount({} as HTMLElement);
    const value = frame('idle:failed-input', 2);

    controller.submitFrame(value);
    settlement.reject(new Error('settlement failed'));
    await expect(controller.waitForIdle()).rejects.toThrow('settlement failed');
    await Promise.resolve();

    expect(controller.getSettledFrame()).toBeNull();
    expect(listener).not.toHaveBeenCalled();
  });

  test('prepares only the latest synchronous playback frame without applying it', async () => {
    const visualBackend = backend();
    const controller = ControllerModule.createBoardVisualController({ backend: visualBackend });
    await controller.mount({} as HTMLElement);
    const token = controller.claimWriter('local:latest-only', 'local');
    const first = frame('local:latest-only', 1);
    const latest = frame('local:latest-only', 2);

    controller.submitFrame(first);
    controller.submitFrame(latest);
    await Promise.resolve();
    await Promise.resolve();

    expect(visualBackend.prepareFrame).toHaveBeenCalledTimes(1);
    expect(visualBackend.prepareFrame).toHaveBeenCalledWith(latest);
    expect(visualBackend.applyFrame).not.toHaveBeenCalled();

    await expect(controller.settleLocalWriter(token)).resolves.toBe(true);
    expect(visualBackend.applyFrame).toHaveBeenCalledTimes(1);
    expect(visualBackend.applyFrame).toHaveBeenCalledWith(latest);
  });

  test('ignores a stale preparation rejection after a newer playback frame prepares', async () => {
    const stalePreparation = deferred();
    const latest = frame('local:stale-prepare', 2);
    const visualBackend = backend({
      prepareFrame: jest.fn((value: any) => (
        value.model.visualRevision === 1 ? stalePreparation.promise : Promise.resolve()
      ))
    });
    const controller = ControllerModule.createBoardVisualController({ backend: visualBackend });
    await controller.mount({} as HTMLElement);
    const token = controller.claimWriter('local:stale-prepare', 'local');

    controller.submitFrame(frame('local:stale-prepare', 1));
    await Promise.resolve();
    controller.submitFrame(latest);
    await Promise.resolve();
    stalePreparation.reject(new Error('stale texture failed'));
    await Promise.resolve();
    await Promise.resolve();

    await expect(controller.settleLocalWriter(token)).resolves.toBe(true);
    expect(visualBackend.prepareFrame).toHaveBeenCalledTimes(2);
    expect(visualBackend.applyFrame).toHaveBeenCalledTimes(1);
    expect(visualBackend.applyFrame).toHaveBeenCalledWith(latest);
    expect(controller.getMode()).toBe('idle');
  });

  test('retains local ownership until latest preparation, apply, and visual settlement finish', async () => {
    const settlement = deferred();
    const order: string[] = [];
    const latest = frame('local:delayed-settlement', 4);
    const visualBackend = backend({
      prepareFrame: jest.fn(async () => { order.push('prepare'); }),
      applyFrame: jest.fn(() => { order.push('apply'); }),
      waitForVisualSettlement: jest.fn((value?: any) => {
        if (value === latest) {
          order.push('wait');
          return settlement.promise;
        }
        return Promise.resolve();
      })
    });
    const controller = ControllerModule.createBoardVisualController({ backend: visualBackend });
    await controller.mount({} as HTMLElement);
    const token = controller.claimWriter('local:delayed-settlement', 'local');
    controller.submitFrame(latest);

    let released = false;
    const settling = controller.settleLocalWriter(token).then(() => { released = true; });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(order).toEqual(['prepare', 'apply', 'wait']);
    expect(released).toBe(false);
    expect(controller.getMode()).toBe('playback');
    expect(() => controller.reclaimWriter(token, 'network:during-settlement', 'network'))
      .toThrow('Cannot reclaim a board writer during async local settlement');
    expect(controller.getSnapshot()).toMatchObject({
      activeFrameToken: 'local:delayed-settlement',
      pendingFrameToken: 'local:delayed-settlement'
    });

    settlement.resolve();
    await settling;
    expect(released).toBe(true);
    expect(controller.getMode()).toBe('idle');
    expect(controller.getSnapshot().activeFrameToken).toBeNull();
  });

  test('keeps the local token and latest frame in recovery after settlement failure, then retries', async () => {
    let failSettlement = true;
    const visualBackend = backend({
      waitForVisualSettlement: jest.fn(async (value?: any) => {
        if (value && failSettlement) throw new Error('local texture commit failed');
      })
    });
    const controller = ControllerModule.createBoardVisualController({ backend: visualBackend });
    await controller.mount({} as HTMLElement);
    const token = controller.claimWriter('local:settlement-retry', 'local');
    const failed = frame('local:settlement-retry', 5);
    controller.submitFrame(failed);

    await expect(controller.settleLocalWriter(token)).rejects.toThrow('local texture commit failed');
    expect(controller.getMode()).toBe('recovering');
    expect(controller.isReady()).toBe(false);
    expect(controller.getActiveWriterToken()).toBe(token);
    expect(controller.getSnapshot()).toMatchObject({
      activeFrameToken: 'local:settlement-retry',
      pendingFrameToken: 'local:settlement-retry'
    });

    failSettlement = false;
    const retry = frame('local:settlement-retry', 6);
    expect(controller.submitFrame(retry)).toBe(false);
    await expect(controller.settleLocalWriter(token)).resolves.toBe(true);
    expect(visualBackend.applyFrame).toHaveBeenLastCalledWith(retry);
    expect(controller.getMode()).toBe('idle');
    expect(controller.isReady()).toBe(true);
    expect(controller.getSnapshot().activeFrameToken).toBeNull();
  });

  test('settles a DOM-style backend without optional resource hooks', async () => {
    const visualBackend = backend();
    delete visualBackend.prepareFrame;
    delete visualBackend.waitForVisualSettlement;
    const controller = ControllerModule.createBoardVisualController({ backend: visualBackend });
    await controller.mount({} as HTMLElement);
    const token = controller.claimWriter('local:dom-settlement', 'local');
    const finalFrame = frame('local:dom-settlement', 7);
    controller.submitFrame(finalFrame);

    await expect(controller.settleLocalWriter(token)).resolves.toBe(true);
    expect(visualBackend.applyFrame).toHaveBeenCalledTimes(1);
    expect(visualBackend.applyFrame).toHaveBeenCalledWith(finalFrame);
    expect(controller.getMode()).toBe('idle');
  });

  test('cancels queued playback preparation before strict committed apply ordering', async () => {
    const order: string[] = [];
    const visualBackend = backend({
      prepareFrame: jest.fn(async () => { order.push('prepare'); }),
      applyFrame: jest.fn(() => { order.push('apply'); }),
      waitForVisualSettlement: jest.fn(async (value?: any) => {
        if (value) order.push('settle');
      })
    });
    const controller = ControllerModule.createBoardVisualController({ backend: visualBackend });
    await controller.mount({} as HTMLElement);
    const token = controller.claimWriter('network:strict-order', 'network');
    controller.submitFrame(frame('network:strict-order', 1));
    controller.beginAwaitingFrameCommit(token);

    await controller.applyCommittedFrame(token, frame('network:strict-order', 2));
    await Promise.resolve();

    expect(order).toEqual(['apply', 'settle']);
    expect(visualBackend.prepareFrame).not.toHaveBeenCalled();
    expect(controller.releaseWriter(token)).toBe(true);
  });

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

  test('retains the strict writer after original trajectory events until committed-frame visual settlement', async () => {
    const trajectoryPhase = deferred();
    const settlement = deferred();
    let waitForCommitted = false;
    const originalEvents = Object.freeze([
      Object.freeze({
        type: 'destroy',
        phase: 4,
        sequenceIndex: 0,
        actionId: 'op_21',
        effectBlockId: 'op_21:destroy',
        targets: Object.freeze([Object.freeze({
          r: 0,
          col: 0,
          sourceRow: 1,
          sourceCol: 1,
          cause: 'SNIPER_WILL',
          reason: 'sniper_shot'
        })])
      }),
      Object.freeze({
        type: 'flip',
        phase: 5,
        sequenceIndex: 1,
        actionId: 'op_21',
        effectBlockId: 'op_21:zombie',
        targets: Object.freeze([Object.freeze({
          r: 2,
          col: 3,
          cause: 'ZOMBIE',
          reason: 'zombie_infection',
          meta: Object.freeze({ sourceRow: 3, sourceCol: 3 })
        })])
      })
    ]);
    const visualBackend = backend({
      playPhase: jest.fn(() => trajectoryPhase.promise),
      waitForVisualSettlement: jest.fn((value?: any) => (
        waitForCommitted && value?.frameToken === 'network:21' ? settlement.promise : Promise.resolve()
      ))
    });
    const controller = ControllerModule.createBoardVisualController({ backend: visualBackend });
    await controller.mount({} as HTMLElement);
    const token = controller.claimWriter('network:21', 'network');
    const playing = controller.playPhase(token, originalEvents);
    await Promise.resolve();

    expect(visualBackend.playPhase).toHaveBeenCalledTimes(1);
    expect(visualBackend.playPhase.mock.calls[0][0]).toBe(originalEvents);
    expect(visualBackend.playPhase.mock.calls[0][0].map((event: any) => event.type)).toEqual(['destroy', 'flip']);
    expect(controller.getMode()).toBe('playback');
    expect(controller.getSnapshot().activeFrameToken).toBe('network:21');

    trajectoryPhase.resolve();
    await playing;
    expect(controller.getMode()).toBe('playback');
    expect(controller.getSnapshot().activeFrameToken).toBe('network:21');

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

  test('does not allow playback to claim across a pending idle frame settlement', async () => {
    const settlement = deferred();
    const idleFrame = frame('idle:claim-boundary', 30);
    const visualBackend = backend({
      waitForVisualSettlement: jest.fn((value?: any) => (
        value === idleFrame ? settlement.promise : Promise.resolve()
      ))
    });
    const controller = ControllerModule.createBoardVisualController({ backend: visualBackend });
    await controller.mount({} as HTMLElement);

    expect(controller.submitFrame(idleFrame)).toBe(true);
    expect(() => controller.claimWriter('local:must-wait', 'local'))
      .toThrow(/idle visual settlement completes/i);
    expect(controller.getMode()).toBe('idle');
    expect(controller.getActiveWriterToken()).toBeNull();

    const idle = controller.waitForIdle();
    settlement.resolve();
    await idle;

    const token = controller.claimWriter('local:after-idle', 'local');
    expect(controller.getMode()).toBe('playback');
    expect(controller.releaseWriter(token)).toBe(true);
  });

  test('queues a newer frame without an active token while initial fallback is mounting', async () => {
    const initial = frame('idle:fallback-initial', 40);
    const latest = frame('idle:fallback-latest', 41);
    const failedBackend = backend({
      mount: jest.fn(async () => { throw new Error('pixi init failed'); })
    });
    const controller = ControllerModule.createBoardVisualController({ backend: failedBackend });
    const host = {
      hasAttribute: jest.fn(() => false),
      setAttribute: jest.fn(),
      removeAttribute: jest.fn()
    } as unknown as HTMLElement;
    const mounting = controller.mount(host);
    expect(controller.submitFrame(initial)).toBe(false);
    await expect(mounting).rejects.toThrow('pixi init failed');
    expect(controller.getMode()).toBe('recovering');
    expect(controller.getActiveWriterToken()).toBeNull();

    const fallbackMount = deferred();
    const fallbackBackend = backend({
      kind: 'dom',
      mount: jest.fn(() => fallbackMount.promise)
    });
    const replacing = controller.replaceBackend(fallbackBackend);
    expect(controller.submitFrame(latest)).toBe(false);
    expect(controller.getSnapshot().pendingFrameToken).toBe('idle:fallback-latest');

    fallbackMount.resolve();
    await replacing;

    expect(fallbackBackend.restore).toHaveBeenCalledTimes(1);
    expect(fallbackBackend.restore).toHaveBeenCalledWith(latest);
    expect(fallbackBackend.applyFrame).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toMatchObject({
      pendingFrameToken: null,
      lastAppliedFrameToken: 'idle:fallback-latest'
    });
    expect(controller.getMode()).toBe('idle');
  });

  test('keeps applying recovery frames until pending reference and version stay stable', async () => {
    const restoreGate = deferred();
    const secondSettlement = deferred();
    const first = frame('local:recovery-latest-loop', 50);
    const second = frame('local:recovery-latest-loop', 51);
    const latest = frame('local:recovery-latest-loop', 52);
    const visualBackend = backend({
      restore: jest.fn((value: any) => (
        value === first ? restoreGate.promise : Promise.resolve()
      )),
      waitForVisualSettlement: jest.fn((value?: any) => (
        value === second ? secondSettlement.promise : Promise.resolve()
      ))
    });
    const controller = ControllerModule.createBoardVisualController({ backend: visualBackend });
    await controller.mount({} as HTMLElement);
    const token = controller.claimWriter('local:recovery-latest-loop', 'local');
    controller.submitFrame(first);
    controller.enterRecovery(token, new Error('context lost'));

    const restoring = controller.restore();
    await Promise.resolve();
    expect(visualBackend.restore).toHaveBeenCalledWith(first);
    expect(controller.submitFrame(second)).toBe(false);
    restoreGate.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(visualBackend.applyFrame).toHaveBeenCalledWith(second);

    expect(controller.submitFrame(latest)).toBe(false);
    secondSettlement.resolve();
    await restoring;

    expect(visualBackend.applyFrame.mock.calls.map((call: any[]) => call[0]))
      .toEqual([second, latest]);
    expect(controller.getSnapshot()).toMatchObject({
      pendingFrameToken: null,
      lastAppliedFrameToken: 'local:recovery-latest-loop'
    });
    expect(controller.getMode()).toBe('playback');
    expect(controller.getActiveWriterToken()).toBe(token);
    expect(controller.releaseWriter(token)).toBe(true);
  });

  test('turns an idle async settlement failure into recovery and exposes the same failure to waitForIdle', async () => {
    const settlement = deferred();
    const failure = new Error('idle texture commit failed');
    const order: string[] = [];
    const idleFrame = frame('idle:async-failure', 31);
    const visualBackend = backend({
      applyFrame: jest.fn(() => { order.push('apply'); }),
      waitForVisualSettlement: jest.fn((value?: any) => {
        if (value === idleFrame) {
          order.push('wait');
          return settlement.promise;
        }
        return Promise.resolve();
      })
    });
    const controller = ControllerModule.createBoardVisualController({ backend: visualBackend });
    await controller.mount({} as HTMLElement);

    expect(controller.submitFrame(idleFrame)).toBe(true);
    const waiting = controller.waitForIdle().then(
      () => null,
      (error: Error) => error
    );
    expect(order).toEqual(['apply', 'wait']);

    settlement.reject(failure);
    expect(await waiting).toBe(failure);
    expect(controller.getMode()).toBe('recovering');
    expect(controller.isReady()).toBe(false);
    expect(controller.getSnapshot()).toMatchObject({
      pendingFrameToken: 'idle:async-failure',
      lastAppliedFrameToken: null
    });
  });

  test('rolls back controller-authorized DOM presentation after idle settlement failure', async () => {
    const settlement = deferred();
    const order: string[] = [];
    const source = frame('idle:presentation-rollback', 32);
    const presented = { ...source, layout: { live: true } } as any;
    const visualBackend = backend({
      applyFrame: jest.fn((original: any, live?: any) => {
        order.push('apply');
        expect(original).toBe(source);
        expect(live).toBe(presented);
      }),
      waitForVisualSettlement: jest.fn((value?: any) => {
        if (value === source) {
          order.push('wait');
          return settlement.promise;
        }
        return Promise.resolve();
      })
    });
    const controller = ControllerModule.createBoardVisualController({
      backend: visualBackend,
      beginApplyFrame(value: any) {
        order.push('present');
        expect(value).toBe(source);
        return {
          frame: presented,
          rollback() { order.push('rollback'); }
        };
      }
    });
    await controller.mount({} as HTMLElement);

    controller.submitFrame(source);
    const waiting = controller.waitForIdle();
    settlement.reject(new Error('render failed after apply'));
    await expect(waiting).rejects.toThrow('render failed after apply');

    expect(order).toEqual(['present', 'apply', 'wait', 'rollback']);
    expect(controller.getSnapshot().lastAppliedFrameToken).toBeNull();
  });

  test('rejects a layout-only presentation that replaces the render-session identity', async () => {
    const source = {
      ...frame('idle:session-identity', 34),
      renderSessionId: 'match:source'
    } as any;
    const presented = {
      ...source,
      renderSessionId: 'match:replacement',
      layout: { live: true }
    } as any;
    const rollback = jest.fn();
    const visualBackend = backend();
    const controller = ControllerModule.createBoardVisualController({
      backend: visualBackend,
      beginApplyFrame() {
        return { frame: presented, rollback };
      }
    });
    await controller.mount({} as HTMLElement);

    expect(() => controller.submitFrame(source)).toThrow(
      'Presented board frame may only replace live viewport layout'
    );
    expect(rollback).toHaveBeenCalledTimes(1);
    expect(visualBackend.applyFrame).not.toHaveBeenCalled();
    expect(controller.getMode()).toBe('recovering');
  });

  test('destroy during local async settlement cannot resurrect controller recovery or ownership', async () => {
    const settlement = deferred();
    const target = frame('local:destroy-during-settlement', 33);
    const visualBackend = backend({
      waitForVisualSettlement: jest.fn((value?: any) => (
        value === target ? settlement.promise : Promise.resolve()
      ))
    });
    const controller = ControllerModule.createBoardVisualController({ backend: visualBackend });
    await controller.mount({} as HTMLElement);
    const token = controller.claimWriter('local:destroy-during-settlement', 'local');
    controller.submitFrame(target);
    const settling = controller.settleLocalWriter(token);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    controller.destroy();
    settlement.resolve();

    await expect(settling).rejects.toThrow(/destroyed/i);
    expect(controller.getMode()).toBe('destroyed');
    expect(controller.isReady()).toBe(false);
    expect(controller.getSnapshot().activeFrameToken).toBeNull();
  });
});
