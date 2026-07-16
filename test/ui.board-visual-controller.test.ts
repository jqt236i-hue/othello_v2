const ControllerModule = require('../ui/board-visual/controller');
const DiagnosticsModule = require('../ui/board-visual/diagnostics');
const { JSDOM } = require('jsdom');

function frame(frameToken: string, revision: number) {
  return {
    frameToken,
    model: { visualRevision: revision },
    layout: {},
    appearance: {},
    theme: {}
  } as any;
}

function createBackend(overrides: any = {}) {
  const applied: any[] = [];
  const backend = {
    kind: 'dom',
    mount: jest.fn(),
    applyFrame: jest.fn((value) => applied.push(value)),
    playPhase: jest.fn(async () => {}),
    getRenderedCell: jest.fn(() => null),
    getCellClientRect: jest.fn(() => null),
    resize: jest.fn(),
    restore: jest.fn(),
    destroy: jest.fn(),
    ...overrides
  };
  return { backend, applied };
}

function diagnosticFrame(frameToken: string, revision: number) {
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
        existingKeys: ['1,2'],
        playableKeys: ['1,2'],
        holeKeys: []
      },
      cells: [{
        key: '1,2',
        row: 1,
        col: 2,
        kind: 'playable',
        markers: [{ kind: 'guard', data: { remainingTurns: 2 } }],
        interaction: { legal: true },
        visualSignature: 'cell:1,2:legal'
      }],
      keyboardCursorKey: null,
      viewerContext: 'black'
    },
    layout: { revision, cellSize: 48, orientation: 'normal' },
    appearance: { revision, boardSkinId: 'default-board' },
    theme: { revision, surfaceColor: '#008000' }
  } as any;
}

describe('BoardVisualController', () => {
  test('mounts one backend and applies idle frames immediately', async () => {
    const { backend, applied } = createBackend();
    const controller = ControllerModule.createBoardVisualController({ backend });
    const host = {} as HTMLElement;
    await controller.mount(host);
    expect(controller.submitFrame(frame('idle:1', 1))).toBe(true);
    expect(applied.map((value) => value.model.visualRevision)).toEqual([1]);
    await controller.mount(host);
    expect(backend.mount).toHaveBeenCalledTimes(1);
  });

  test('coalesces only the active playback token and applies latest before release', async () => {
    const { backend, applied } = createBackend();
    const controller = ControllerModule.createBoardVisualController({ backend });
    await controller.mount({} as HTMLElement);
    const token = controller.claimWriter('batch:1', 'local');
    expect(controller.submitFrame(frame('batch:1', 1))).toBe(false);
    expect(controller.submitFrame(frame('batch:1', 2))).toBe(false);
    expect(applied).toHaveLength(0);
    expect(() => controller.submitFrame(frame('batch:2', 3))).toThrow(/different playback token/i);
    expect(controller.releaseWriter(token)).toBe(true);
    expect(applied.map((value) => value.model.visualRevision)).toEqual([2]);
    expect(controller.getMode()).toBe('idle');
    expect(() => controller.releaseWriter(token)).toThrow(/does not own/i);
  });

  test('strict committed apply failure retains writer ownership in recovery', async () => {
    let fail = true;
    const { backend } = createBackend({
      applyFrame: jest.fn(() => {
        if (fail) throw new Error('context lost');
      }),
      restore: jest.fn()
    });
    const controller = ControllerModule.createBoardVisualController({ backend });
    await controller.mount({} as HTMLElement);
    const token = controller.claimWriter('network:7', 'network');
    controller.beginAwaitingFrameCommit(token);
    await expect(controller.applyCommittedFrame(token, frame('network:7', 7))).rejects.toThrow('context lost');
    expect(controller.getMode()).toBe('recovering');
    expect(controller.getSnapshot().activeFrameToken).toBe('network:7');
    fail = false;
    const committedFrame = frame('network:7', 7);
    await controller.restoreCommittedFrame(token, committedFrame);
    expect(controller.getMode()).toBe('awaiting-frame-commit');
    expect(controller.releaseWriter(token)).toBe(true);
  });

  test('queues the latest initial frame and rejects writer claims until async backend readiness', async () => {
    let resolveMount!: () => void;
    const { backend } = createBackend({
      mount: jest.fn(() => new Promise<void>((resolve) => { resolveMount = resolve; }))
    });
    const controller = ControllerModule.createBoardVisualController({ backend });
    const mounting = controller.mount({} as HTMLElement);
    const first = frame('idle:first', 7);
    const latest = frame('idle:latest', 8);
    expect(controller.submitFrame(first)).toBe(false);
    expect(controller.submitFrame(latest)).toBe(false);
    expect(() => controller.claimWriter('network:async', 'network')).toThrow(/before backend readiness/i);

    let settled = false;
    const ready = controller.ready.then(() => { settled = true; });
    await Promise.resolve();

    expect(backend.applyFrame).not.toHaveBeenCalled();
    expect(settled).toBe(false);
    expect(controller.getMode()).toBe('idle');
    expect(controller.getSnapshot().activeFrameToken).toBeNull();

    resolveMount();
    await mounting;
    await ready;

    expect(backend.applyFrame).toHaveBeenCalledTimes(1);
    expect(backend.applyFrame).toHaveBeenCalledWith(latest);
    expect(controller.getSnapshot().lastAppliedFrameToken).toBe('idle:latest');
    const token = controller.claimWriter('network:async', 'network');
    controller.beginAwaitingFrameCommit(token);
    await controller.applyCommittedFrame(token, frame('network:async', 9));
    expect(controller.releaseWriter(token)).toBe(true);
    expect(controller.getMode()).toBe('idle');
  });

  test('rejects ready and idle waiters when the queued initial frame fails to apply', async () => {
    let fail = true;
    let finishMount: (() => void) | null = null;
    const initial = frame('idle:initial', 1);
    const dom = new JSDOM('<!doctype html><div id="board"></div>');
    const host = dom.window.document.getElementById('board') as HTMLElement;
    const { backend } = createBackend({
      mount: jest.fn(() => new Promise<void>((resolve) => { finishMount = resolve; })),
      applyFrame: jest.fn(() => {
        if (fail) throw new Error('initial apply failed');
      })
    });
    const controller = ControllerModule.createBoardVisualController({ backend });
    const readyResult = controller.ready.then(
      () => 'resolved',
      (error: Error) => error.message
    );
    const mounting = controller.mount(host);
    expect(controller.submitFrame(initial)).toBe(false);
    const idleResult = controller.waitForIdle().then(
      () => 'resolved',
      (error: Error) => error.message
    );
    finishMount && finishMount();

    await expect(mounting).rejects.toThrow('initial apply failed');
    expect(await readyResult).toBe('initial apply failed');
    expect(await idleResult).toBe('initial apply failed');
    expect(controller.getMode()).toBe('recovering');
    expect(controller.isReady()).toBe(false);
    expect(host.getAttribute('data-board-renderer')).toBe('dom');
    expect(() => controller.claimWriter('local:blocked', 'local')).toThrow(/before backend readiness/i);

    fail = false;
    await controller.restore(initial);
    expect(controller.getMode()).toBe('idle');
    expect(controller.isReady()).toBe(true);
    expect(host.getAttribute('data-board-renderer')).toBe('dom');
    controller.destroy();
    dom.window.close();
  });

  test('enters recovery when backend mount fails and permits replacement on the retained host lease', async () => {
    const dom = new JSDOM('<!doctype html><div id="board"></div>');
    const host = dom.window.document.getElementById('board') as HTMLElement;
    const failedBackend = createBackend({
      kind: 'pixi',
      mount: jest.fn(async () => {
        throw new Error('backend mount failed');
      })
    }).backend;
    const controller = ControllerModule.createBoardVisualController({ backend: failedBackend });
    const initialReadyPromise = controller.ready;
    const readyResult = initialReadyPromise.then(
      () => 'resolved',
      (error: Error) => error.message
    );
    const mounting = controller.mount(host);
    const idleResult = controller.waitForIdle().then(
      () => 'resolved',
      (error: Error) => error.message
    );

    await expect(mounting).rejects.toThrow('backend mount failed');
    expect(await readyResult).toBe('backend mount failed');
    expect(await idleResult).toBe('backend mount failed');
    expect(controller.getMode()).toBe('recovering');
    expect(controller.isReady()).toBe(false);
    expect(host.hasAttribute('data-board-renderer')).toBe(false);

    let resolveFallbackMount!: () => void;
    const recoveredBackend = createBackend({
      kind: 'dom',
      mount: jest.fn(() => new Promise<void>((resolve) => { resolveFallbackMount = resolve; }))
    }).backend;
    const replacing = controller.replaceBackend(recoveredBackend);
    const fallbackReadyPromise = controller.waitUntilReady();
    expect(controller.ready).toBe(fallbackReadyPromise);
    expect(controller.ready).not.toBe(initialReadyPromise);
    let fallbackReady = false;
    fallbackReadyPromise.then(() => { fallbackReady = true; });
    await Promise.resolve();
    expect(fallbackReady).toBe(false);

    resolveFallbackMount();
    await replacing;
    await fallbackReadyPromise;
    expect(controller.getMode()).toBe('idle');
    expect(controller.isReady()).toBe(true);
    expect(host.getAttribute('data-board-renderer')).toBe('dom');
    controller.destroy();
    dom.window.close();
  });

  test('enters recovery when an idle frame apply fails and restores that checkpoint', async () => {
    let fail = false;
    const failedFrame = frame('idle:failed', 3);
    const { backend } = createBackend({
      applyFrame: jest.fn(() => {
        if (fail) throw new Error('idle apply failed');
      })
    });
    const controller = ControllerModule.createBoardVisualController({ backend });
    await controller.mount({} as HTMLElement);
    fail = true;

    expect(() => controller.submitFrame(failedFrame)).toThrow('idle apply failed');
    expect(controller.getMode()).toBe('recovering');
    expect(controller.isReady()).toBe(false);
    await expect(controller.waitForIdle()).rejects.toThrow('idle apply failed');

    fail = false;
    await controller.restore();
    expect(backend.restore).toHaveBeenCalledWith(failedFrame);
    expect(controller.getMode()).toBe('idle');
    expect(controller.isReady()).toBe(true);
  });

  test('leases one host/backend exclusively and releases the data marker on destroy', async () => {
    const dom = new JSDOM('<!doctype html><div id="board"></div>');
    const host = dom.window.document.getElementById('board') as HTMLElement;
    const first = ControllerModule.createBoardVisualController({ backend: createBackend().backend });
    const second = ControllerModule.createBoardVisualController({ backend: createBackend().backend });
    const secondReady = second.ready.catch((error: Error) => error);

    await first.mount(host);
    expect(host.getAttribute('data-board-renderer')).toBe('dom');
    await expect(second.mount(host)).rejects.toThrow(/active backend lease/i);
    await expect(secondReady).resolves.toBeInstanceOf(Error);

    first.destroy();
    expect(host.hasAttribute('data-board-renderer')).toBe(false);

    const third = ControllerModule.createBoardVisualController({ backend: createBackend().backend });
    await third.mount(host);
    expect(host.getAttribute('data-board-renderer')).toBe('dom');
    third.destroy();
    second.destroy();
    dom.window.close();
  });

  test('releases the host lease even when backend destroy throws', async () => {
    const dom = new JSDOM('<!doctype html><div id="board"></div>');
    const host = dom.window.document.getElementById('board') as HTMLElement;
    const failedDestroy = createBackend({
      destroy: jest.fn(() => {
        throw new Error('destroy failed');
      })
    }).backend;
    const first = ControllerModule.createBoardVisualController({ backend: failedDestroy });
    await first.mount(host);

    expect(() => first.destroy()).toThrow('destroy failed');
    expect(first.getMode()).toBe('destroyed');
    expect(host.hasAttribute('data-board-renderer')).toBe(false);

    const second = ControllerModule.createBoardVisualController({ backend: createBackend().backend });
    await second.mount(host);
    expect(host.getAttribute('data-board-renderer')).toBe('dom');
    second.destroy();
    dom.window.close();
  });

  test('rejects cross-token frames during recovery and only restores the active writer checkpoint', async () => {
    const { backend } = createBackend();
    const controller = ControllerModule.createBoardVisualController({ backend });
    await controller.mount({} as HTMLElement);
    const token = controller.claimWriter('local:active', 'local');
    const activeFrame = frame('local:active', 2);
    controller.submitFrame(activeFrame);
    expect(() => controller.enterRecovery({ ...token } as any, new Error('wrong owner'))).toThrow(/does not own/i);
    controller.enterRecovery(token, new Error('context lost'));

    expect(() => controller.submitFrame(frame('local:other', 3))).toThrow(/does not match the active writer token/i);
    await expect(controller.restore(frame('local:other', 3))).rejects.toThrow(/does not match the active writer token/i);
    await controller.restore(activeFrame);
    expect(controller.getMode()).toBe('playback');
    expect(controller.releaseWriter(token)).toBe(true);
  });

  test('requires awaiting-frame-commit and a successful committed apply before network release', async () => {
    const { backend } = createBackend();
    const controller = ControllerModule.createBoardVisualController({ backend });
    await controller.mount({} as HTMLElement);
    const token = controller.claimWriter('network:guarded', 'network');

    expect(() => controller.releaseWriter(token)).toThrow(/successful committed frame apply/i);
    controller.beginAwaitingFrameCommit(token);
    expect(() => controller.releaseWriter(token)).toThrow(/awaiting-frame-commit/i);
    await expect(controller.abortWriterBeforeHandoff(token)).rejects.toThrow(/pre-handoff network playback/i);
    await controller.applyCommittedFrame(token, frame('network:guarded', 4));
    expect(controller.releaseWriter(token)).toBe(true);
  });

  test('ignores normal renders after committed apply and does not apply a second frame on release', async () => {
    const { backend } = createBackend();
    const controller = ControllerModule.createBoardVisualController({ backend });
    await controller.mount({} as HTMLElement);
    const token = controller.claimWriter('network:single-commit-apply', 'network');
    controller.beginAwaitingFrameCommit(token);
    const committed = frame('network:single-commit-apply', 8);

    await expect(controller.applyCommittedFrame(token, committed)).resolves.toBe(true);
    const applyCountAfterCommit = backend.applyFrame.mock.calls.length;
    expect(controller.submitFrame(frame('network:single-commit-apply', 9))).toBe(false);
    expect(controller.releaseWriter(token)).toBe(true);

    expect(backend.applyFrame).toHaveBeenCalledTimes(applyCountAfterCommit);
    expect(controller.getMode()).toBe('idle');
  });

  test('restores a saved committed frame only through the matching active token', async () => {
    let fail = true;
    const committedFrame = frame('network:restore-commit', 5);
    const { backend } = createBackend({
      applyFrame: jest.fn(() => {
        if (fail) throw new Error('context lost');
      })
    });
    const controller = ControllerModule.createBoardVisualController({ backend });
    await controller.mount({} as HTMLElement);
    const token = controller.claimWriter('network:restore-commit', 'network');
    controller.beginAwaitingFrameCommit(token);
    await expect(controller.applyCommittedFrame(token, committedFrame)).rejects.toThrow('context lost');

    fail = false;
    await expect(controller.restore()).rejects.toThrow(/restoreCommittedFrame/);
    await expect(controller.restoreCommittedFrame(
      { ...token } as any,
      committedFrame
    )).rejects.toThrow(/does not own/i);
    await expect(controller.restoreCommittedFrame(
      token,
      frame('network:other', 5)
    )).rejects.toThrow(/token mismatch/i);
    await controller.restoreCommittedFrame(token);
    expect(backend.restore).toHaveBeenCalledWith(committedFrame);
    expect(controller.getMode()).toBe('awaiting-frame-commit');
    expect(controller.releaseWriter(token)).toBe(true);
  });

  test('retains committed recovery ownership when backend restore fails and permits retry', async () => {
    let failApply = true;
    let failRestore = true;
    const committedFrame = frame('network:restore-retry', 6);
    const { backend } = createBackend({
      applyFrame: jest.fn(() => {
        if (failApply) throw new Error('committed apply failed');
      }),
      restore: jest.fn(async () => {
        if (failRestore) throw new Error('committed restore failed');
      })
    });
    const controller = ControllerModule.createBoardVisualController({ backend });
    await controller.mount({} as HTMLElement);
    const token = controller.claimWriter('network:restore-retry', 'network');
    controller.beginAwaitingFrameCommit(token);
    await expect(controller.applyCommittedFrame(token, committedFrame)).rejects.toThrow('committed apply failed');

    failApply = false;
    await expect(controller.restoreCommittedFrame(token)).rejects.toThrow('committed restore failed');
    expect(controller.getMode()).toBe('recovering');
    expect(controller.getSnapshot().activeFrameToken).toBe('network:restore-retry');
    expect(controller.isReady()).toBe(false);

    failRestore = false;
    await expect(controller.restoreCommittedFrame(token)).resolves.toBe(true);
    expect(controller.getMode()).toBe('awaiting-frame-commit');
    expect(controller.releaseWriter(token)).toBe(true);
  });

  test('aborts pre-handoff network playback only after restoring its checkpoint', async () => {
    const checkpoint = frame('idle:checkpoint', 10);
    const { backend } = createBackend();
    const controller = ControllerModule.createBoardVisualController({ backend });
    await controller.mount({} as HTMLElement);
    controller.submitFrame(checkpoint);
    const token = controller.claimWriter('network:abort', 'network');
    const idle = controller.waitForIdle();

    await expect(controller.abortWriterBeforeHandoff({ ...token } as any)).rejects.toThrow(/does not own/i);
    expect(controller.getMode()).toBe('playback');
    await expect(controller.abortWriterBeforeHandoff(token)).resolves.toBe(true);
    await expect(idle).resolves.toBeUndefined();
    expect(backend.restore).toHaveBeenCalledWith(checkpoint);
    expect(controller.getMode()).toBe('idle');
    expect(controller.getSnapshot().activeFrameToken).toBeNull();
  });

  test('retains pre-handoff network ownership when checkpoint restore fails', async () => {
    const checkpoint = frame('idle:abort-failure', 11);
    const { backend } = createBackend({
      restore: jest.fn(async () => {
        throw new Error('checkpoint restore failed');
      })
    });
    const controller = ControllerModule.createBoardVisualController({ backend });
    await controller.mount({} as HTMLElement);
    controller.submitFrame(checkpoint);
    const token = controller.claimWriter('network:abort-failure', 'network');
    const idleResult = controller.waitForIdle().then(
      () => 'resolved',
      (error: Error) => error.message
    );

    await expect(controller.abortWriterBeforeHandoff(token)).rejects.toThrow('checkpoint restore failed');
    expect(await idleResult).toBe('checkpoint restore failed');
    expect(controller.getMode()).toBe('recovering');
    expect(controller.getSnapshot().activeFrameToken).toBe('network:abort-failure');
    expect(controller.isReady()).toBe(false);
  });

  test('cancels a post-handoff strict writer only after restoring its writer checkpoint', async () => {
    const checkpoint = frame('idle:post-handoff-checkpoint', 12);
    const { backend } = createBackend();
    const controller = ControllerModule.createBoardVisualController({ backend });
    await controller.mount({} as HTMLElement);
    controller.submitFrame(checkpoint);
    const token = controller.claimWriter('network:post-handoff-cancel', 'network');
    controller.beginAwaitingFrameCommit(token);

    await expect(controller.cancelWriterAfterHandoff({ ...token } as any)).rejects.toThrow(/does not own/i);
    expect(controller.getMode()).toBe('awaiting-frame-commit');
    await expect(controller.cancelWriterAfterHandoff(token)).resolves.toBe(true);

    expect(backend.restore).toHaveBeenCalledWith(checkpoint);
    expect(controller.getMode()).toBe('idle');
    expect(controller.getSnapshot().activeFrameToken).toBeNull();
    expect(controller.isReady()).toBe(true);
  });

  test('retains post-handoff ownership when checkpoint restore fails and permits cancel retry', async () => {
    let failRestore = true;
    const checkpoint = frame('idle:post-handoff-retry', 13);
    const { backend } = createBackend({
      restore: jest.fn(async () => {
        if (failRestore) throw new Error('post-handoff restore failed');
      })
    });
    const controller = ControllerModule.createBoardVisualController({ backend });
    await controller.mount({} as HTMLElement);
    controller.submitFrame(checkpoint);
    const token = controller.claimWriter('network:post-handoff-retry', 'network');
    controller.beginAwaitingFrameCommit(token);

    await expect(controller.cancelWriterAfterHandoff(token)).rejects.toThrow('post-handoff restore failed');
    expect(controller.getMode()).toBe('recovering');
    expect(controller.getSnapshot().activeFrameToken).toBe('network:post-handoff-retry');
    expect(controller.isReady()).toBe(false);

    failRestore = false;
    const recoveredReady = controller.cancelWriterAfterHandoff(token);
    await expect(controller.waitUntilReady()).resolves.toBeUndefined();
    await expect(recoveredReady).resolves.toBe(true);
    expect(backend.restore).toHaveBeenCalledTimes(2);
    expect(controller.getMode()).toBe('idle');
    expect(controller.getSnapshot().activeFrameToken).toBeNull();
  });

  test('can cancel after a committed strict frame was applied but before writer settlement', async () => {
    const checkpoint = frame('idle:committed-cancel-checkpoint', 14);
    const { backend } = createBackend();
    const controller = ControllerModule.createBoardVisualController({ backend });
    await controller.mount({} as HTMLElement);
    controller.submitFrame(checkpoint);
    const token = controller.claimWriter('network:committed-cancel', 'network');
    controller.beginAwaitingFrameCommit(token);
    await controller.applyCommittedFrame(token, frame('network:committed-cancel', 15));

    expect(controller.getMode()).toBe('awaiting-frame-commit');
    await expect(controller.cancelWriterAfterHandoff(token)).resolves.toBe(true);
    expect(backend.restore).toHaveBeenCalledWith(checkpoint);
    expect(controller.getMode()).toBe('idle');
    expect(controller.getSnapshot().activeFrameToken).toBeNull();
  });

  test('enters recovery and rejects idle waiters when backend replacement fails, then permits retry', async () => {
    const initialBackend = createBackend().backend;
    const controller = ControllerModule.createBoardVisualController({ backend: initialBackend });
    const dom = new JSDOM('<!doctype html><div id="board"></div>');
    const host = dom.window.document.getElementById('board') as HTMLElement;
    await controller.mount(host);
    controller.submitFrame(frame('idle:checkpoint', 6));

    let rejectMount!: (error: Error) => void;
    const failedBackend = createBackend({
      kind: 'pixi',
      mount: jest.fn(() => new Promise<void>((_resolve, reject) => { rejectMount = reject; }))
    }).backend;
    const replacing = controller.replaceBackend(failedBackend);
    const idleResult = controller.waitForIdle().then(
      () => 'resolved',
      (error: Error) => error.message
    );
    rejectMount(new Error('replacement mount failed'));

    await expect(replacing).rejects.toThrow('replacement mount failed');
    expect(await idleResult).toBe('replacement mount failed');
    expect(controller.getMode()).toBe('recovering');
    expect(controller.isReady()).toBe(false);
    expect(host.hasAttribute('data-board-renderer')).toBe(false);

    const recoveredBackend = createBackend({ kind: 'dom' }).backend;
    await controller.replaceBackend(recoveredBackend);
    expect(recoveredBackend.restore).toHaveBeenCalledWith(frame('idle:checkpoint', 6));
    expect(controller.getMode()).toBe('idle');
    expect(controller.isReady()).toBe(true);
    expect(host.getAttribute('data-board-renderer')).toBe('dom');
    controller.destroy();
    dom.window.close();
  });

  test('enters recovery when replacement cannot destroy the active backend, then permits retry', async () => {
    let failDestroy = true;
    const initialBackend = createBackend({
      destroy: jest.fn(() => {
        if (failDestroy) throw new Error('active backend destroy failed');
      })
    }).backend;
    const controller = ControllerModule.createBoardVisualController({ backend: initialBackend });
    const dom = new JSDOM('<!doctype html><div id="board"></div>');
    const host = dom.window.document.getElementById('board') as HTMLElement;
    await controller.mount(host);
    controller.submitFrame(frame('idle:destroy-checkpoint', 7));
    const replacement = createBackend({ kind: 'pixi' }).backend;

    await expect(controller.replaceBackend(replacement)).rejects.toThrow('active backend destroy failed');
    expect(controller.getMode()).toBe('recovering');
    expect(controller.isReady()).toBe(false);
    expect(host.getAttribute('data-board-renderer')).toBe('dom');
    expect(replacement.mount).not.toHaveBeenCalled();

    failDestroy = false;
    await controller.replaceBackend(replacement);
    expect(replacement.restore).toHaveBeenCalledWith(frame('idle:destroy-checkpoint', 7));
    expect(controller.getMode()).toBe('idle');
    expect(controller.isReady()).toBe(true);
    expect(host.getAttribute('data-board-renderer')).toBe('pixi');
    controller.destroy();
    dom.window.close();
  });

  test('installs only the gated immutable read-only diagnostics contract', async () => {
    const disabledRoot: any = {};
    const disabledDiagnostics = DiagnosticsModule.createBoardVisualDiagnostics({ enabled: false });
    expect(DiagnosticsModule.installBoardVisualDebugContract(disabledRoot, disabledDiagnostics, null as any)).toBe(false);
    expect(disabledRoot.__boardVisualDebug).toBeUndefined();

    const { backend } = createBackend({
      getRenderedCell: jest.fn((row: number, col: number) => (
        row === 1 && col === 2 ? diagnosticFrame('backend-diagnostic', 1).model.cells[0] : null
      )),
      getCellClientRect: jest.fn(() => ({
        left: 10,
        top: 20,
        right: 58,
        bottom: 68,
        width: 48,
        height: 48,
        layoutRevision: 3
      })),
      getDisplayObjectCounts: jest.fn(() => ({ total: 3, sprites: 2, renderer: {} })),
      getTextureLeaseCounts: jest.fn(() => ({ total: 4, leased: 1 })),
      captureDebugFramePngDataUrl: jest.fn(() => 'data:image/png;base64,AA=='),
      getDiagnostics: jest.fn(() => ({ tickerRunning: false, pool: { activePlaybackGhostCount: 0 } }))
    });
    const diagnostics = DiagnosticsModule.createBoardVisualDiagnostics({ enabled: true });
    const controller = ControllerModule.createBoardVisualController({ backend, diagnostics });
    await controller.mount({} as HTMLElement);
    expect(controller.submitFrame(diagnosticFrame('private-frame-token:1', 1))).toBe(true);

    const root: any = {};
    expect(DiagnosticsModule.installBoardVisualDebugContract(root, diagnostics, controller)).toBe(true);
    const debug = root.__boardVisualDebug;
    expect(Object.isFrozen(debug)).toBe(true);
    expect(Object.keys(debug).sort()).toEqual([
      'getBackendDiagnostics',
      'getBackendKind',
      'getCellClientRect',
      'getDisplayObjectCounts',
      'getRenderedCell',
      'getTextureLeaseCounts',
      'getVisualFrameDigest',
      'getWriterMode',
      'waitForIdle'
    ]);
    expect(debug.getBackendKind()).toBe('dom');
    expect(debug.getBackendDiagnostics()).toEqual({
      pool: { activePlaybackGhostCount: 0 },
      tickerRunning: false
    });
    expect(debug.getWriterMode()).toBe('idle');
    expect(debug.getVisualFrameDigest()).toMatch(/^fnv1a32:[a-f0-9]{8}$/);
    expect(controller.captureDebugFramePngDataUrl()).toBe('data:image/png;base64,AA==');

    const firstDigest = debug.getVisualFrameDigest();
    expect(controller.submitFrame(diagnosticFrame('private-frame-token:2', 2))).toBe(true);
    expect(debug.getVisualFrameDigest()).toBe(firstDigest);

    const renderedCell = debug.getRenderedCell(1, 2);
    expect(renderedCell).toMatchObject({ key: '1,2', row: 1, col: 2, visualSignature: 'cell:1,2:legal' });
    expect(Object.isFrozen(renderedCell)).toBe(true);
    expect(Object.isFrozen(renderedCell.markers)).toBe(true);
    expect(Object.isFrozen(renderedCell.markers[0].data)).toBe(true);
    expect(Reflect.set(renderedCell, 'key', 'changed')).toBe(false);
    expect(debug.getRenderedCell(1, 2).key).toBe('1,2');
    expect(debug.getRenderedCell(99, 99)).toBeNull();

    const clientRect = debug.getCellClientRect(1, 2);
    expect(clientRect).toEqual({
      bottom: 68,
      height: 48,
      layoutRevision: 3,
      left: 10,
      right: 58,
      top: 20,
      width: 48
    });
    expect(Object.isFrozen(clientRect)).toBe(true);
    expect(debug.getDisplayObjectCounts()).toEqual({ sprites: 2, total: 3 });
    expect(debug.getTextureLeaseCounts()).toEqual({ leased: 1, total: 4 });
    expect(Object.isFrozen(debug.getDisplayObjectCounts())).toBe(true);
    expect(() => debug.getRenderedCell(Number.NaN, 0)).toThrow(/finite numbers/i);

    const token = controller.claimWriter('local:diagnostics', 'local');
    let idleResolved = false;
    const waiting = debug.waitForIdle().then(() => { idleResolved = true; });
    await Promise.resolve();
    expect(idleResolved).toBe(false);
    controller.releaseWriter(token);
    await waiting;
    expect(idleResolved).toBe(true);
    expect(debug.getWriterMode()).toBe('idle');
  });

  test('delegates rendered-cell diagnostics to the active backend materialization', async () => {
    const materialized = Object.freeze({
      key: '4,5',
      row: 4,
      col: 5,
      kind: 'offscreen',
      semanticKind: 'playable',
      rendered: false
    });
    const { backend } = createBackend({
      getRenderedCell: jest.fn(() => materialized)
    });
    const controller = ControllerModule.createBoardVisualController({ backend });
    await controller.mount({} as HTMLElement);

    expect(controller.getRenderedCell(4, 5)).toBe(materialized);
    expect(backend.getRenderedCell).toHaveBeenCalledWith(4, 5);
  });
});
