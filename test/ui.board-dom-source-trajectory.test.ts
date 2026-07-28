import { JSDOM } from 'jsdom';

function rect(left: number, top: number, width = 20, height = 20) {
  return { left, top, right: left + width, bottom: top + height, width, height };
}

function contextFor(events: readonly any[]) {
  return Object.freeze({
    token: Object.freeze({ id: 91, frameToken: 'local:dom-source', mode: 'local' }),
    strictNetworkPlayback: false,
    phaseScope: Object.freeze({ events, phaseKey: 'dom-source', stepIndex: 2 })
  });
}

function baseDeps(documentRef: Document, boardElement: HTMLElement, overrides: Record<string, unknown> = {}) {
  return {
    documentRef,
    boardElement,
    frame: null,
    isNoAnim: () => false,
    getFallbackCellClientRect: (row: unknown, col: unknown) => {
      const cell = boardElement.querySelector<HTMLElement>(`.cell[data-row="${row}"][data-col="${col}"]`);
      return cell ? cell.getBoundingClientRect() : null;
    },
    waitForAnimationFinish: async () => undefined,
    sleep: async () => undefined,
    timer: () => ({ setTimeout: (callback: () => void) => { callback(); return 1; }, clearTimeout: () => undefined }),
    playbackScope: null,
    transientOverlayBatch: null,
    createVisualRandom: () => () => 0.5,
    ...overrides
  };
}

describe('DOM board source trajectory ownership', () => {
  let dom: JSDOM;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    Object.defineProperty(dom.window, 'innerWidth', { configurable: true, value: 300 });
    Object.defineProperty(dom.window, 'innerHeight', { configurable: true, value: 300 });
  });

  afterEach(() => {
    jest.dontMock('../ui/animation-destroy-source-events');
    jest.resetModules();
    dom.window.close();
    delete (global as any).window;
    delete (global as any).document;
  });

  test('starts every raw source synchronously before target gates can commit', async () => {
    const log: string[] = [];
    const resolvers: Array<() => void> = [];
    jest.doMock('../ui/animation-destroy-source-events', () => ({
      animateSniperProjectile: jest.fn((target: any) => {
        log.push(`source:${target.r},${target.col}`);
        return new Promise<void>((resolve) => resolvers.push(resolve));
      })
    }));
    const board = document.getElementById('board') as HTMLElement;
    board.innerHTML = [
      '<div class="cell" data-row="1" data-col="1"></div>',
      '<div class="cell" data-row="2" data-col="2"></div>',
      '<div class="cell" data-row="3" data-col="3"></div>'
    ].join('');
    board.getBoundingClientRect = () => rect(80, 80, 180, 180) as DOMRect;
    const cells = Array.from(board.querySelectorAll<HTMLElement>('.cell'));
    cells[0].getBoundingClientRect = () => rect(100, 100) as DOMRect;
    cells[1].getBoundingClientRect = () => rect(160, 160) as DOMRect;
    cells[2].getBoundingClientRect = () => rect(210, 210) as DOMRect;
    const events = Object.freeze([
      Object.freeze({ type: 'destroy', targets: Object.freeze([{ r: 2, col: 2, sourceRow: 1, sourceCol: 1, ownerBefore: 'white', cause: 'SNIPER_WILL', reason: 'sniper_shot' }]) }),
      Object.freeze({ type: 'destroy', targets: Object.freeze([{ r: 3, col: 3, sourceRow: 1, sourceCol: 1, ownerBefore: 'white', cause: 'SNIPER_WILL', reason: 'sniper_shot' }]) })
    ]);
    const SourceTrajectory = require('../ui/board-dom-compat/source-trajectory');

    const run = SourceTrajectory.startDomBoardSourceTrajectoryBatch(
      events,
      contextFor(events),
      baseDeps(document, board)
    );

    expect(log).toEqual(['source:2,2', 'source:3,3']);
    let firstCommitted = false;
    const firstGate = run.waitForTarget('destroy', events[0].targets[0], events[0]).then(() => {
      firstCommitted = true;
    });
    await Promise.resolve();
    expect(firstCommitted).toBe(false);
    resolvers[0]();
    await firstGate;
    expect(firstCommitted).toBe(true);
    resolvers[1]();
    await run.settlement;
  });

  test('routes FIRE_WILL status through the board-owned flame beam and target gate', async () => {
    const animateDestroyDragonBreath = jest.fn(() => Promise.resolve());
    jest.doMock('../ui/animation-destroy-source-events', () => ({
      animateDestroyDragonBreath
    }));
    const board = document.getElementById('board') as HTMLElement;
    board.innerHTML = [
      '<div class="cell" data-row="1" data-col="1"></div>',
      '<div class="cell" data-row="4" data-col="5"></div>'
    ].join('');
    board.getBoundingClientRect = () => rect(60, 60, 200, 200) as DOMRect;
    const sourceCell = board.querySelector<HTMLElement>('.cell[data-row="1"][data-col="1"]')!;
    const targetCell = board.querySelector<HTMLElement>('.cell[data-row="4"][data-col="5"]')!;
    sourceCell.getBoundingClientRect = () => rect(90, 90) as DOMRect;
    targetCell.getBoundingClientRect = () => rect(190, 190) as DOMRect;
    const meta = Object.freeze({
      special: 'SCORCHED_CELL',
      cause: 'FIRE_WILL',
      reason: 'scorched_cell_applied',
      sourceRow: 1,
      sourceCol: 1,
      sourceTrajectoryProfile: 'fireWillFlameBeam'
    });
    const event = Object.freeze({
      type: 'status_applied',
      targets: Object.freeze([Object.freeze({
        r: 4,
        col: 5,
        sourceRow: 1,
        sourceCol: 1,
        cause: 'FIRE_WILL',
        reason: 'scorched_cell_applied',
        meta
      })])
    });
    const SourceTrajectory = require('../ui/board-dom-compat/source-trajectory');

    const run = SourceTrajectory.startDomBoardSourceTrajectoryBatch(
      [event],
      contextFor([event]),
      baseDeps(document, board)
    );

    await expect(run.waitForTarget('status_applied', event.targets[0], event)).resolves.toBeUndefined();
    expect(animateDestroyDragonBreath).toHaveBeenCalledTimes(1);
    expect(animateDestroyDragonBreath.mock.calls[0][1]).toMatchObject({
      suppressTargetImpact: true
    });
    expect(run.batch.requests[0]).toMatchObject({
      profileKey: 'fireWillFlameBeam',
      eventType: 'status_applied',
      source: { row: 1, col: 1 },
      target: { row: 4, col: 5 }
    });
  });

  test('routes GRASS_WILL seed status through the board-owned green beam and target gate', async () => {
    const animateDestroyDragonBreath = jest.fn(() => Promise.resolve());
    jest.doMock('../ui/animation-destroy-source-events', () => ({
      animateDestroyDragonBreath
    }));
    const board = document.getElementById('board') as HTMLElement;
    board.innerHTML = [
      '<div class="cell" data-row="1" data-col="1"></div>',
      '<div class="cell" data-row="4" data-col="5"></div>'
    ].join('');
    board.getBoundingClientRect = () => rect(60, 60, 200, 200) as DOMRect;
    const sourceCell = board.querySelector<HTMLElement>('.cell[data-row="1"][data-col="1"]')!;
    const targetCell = board.querySelector<HTMLElement>('.cell[data-row="4"][data-col="5"]')!;
    sourceCell.getBoundingClientRect = () => rect(90, 90) as DOMRect;
    targetCell.getBoundingClientRect = () => rect(190, 190) as DOMRect;
    const meta = Object.freeze({
      special: 'SEED',
      cause: 'GRASS_WILL',
      reason: 'grass_seeded',
      sourceRow: 1,
      sourceCol: 1,
      sourceTrajectoryProfile: 'grassWillSeedBeam'
    });
    const event = Object.freeze({
      type: 'status_applied',
      targets: Object.freeze([Object.freeze({
        r: 4,
        col: 5,
        sourceRow: 1,
        sourceCol: 1,
        cause: 'GRASS_WILL',
        reason: 'grass_seeded',
        meta
      })])
    });
    const SourceTrajectory = require('../ui/board-dom-compat/source-trajectory');

    const run = SourceTrajectory.startDomBoardSourceTrajectoryBatch(
      [event],
      contextFor([event]),
      baseDeps(document, board)
    );

    await expect(run.waitForTarget('status_applied', event.targets[0], event)).resolves.toBeUndefined();
    expect(animateDestroyDragonBreath).toHaveBeenCalledTimes(1);
    expect(animateDestroyDragonBreath.mock.calls[0][0]).toMatchObject({ meta });
    expect(animateDestroyDragonBreath.mock.calls[0][1]).toMatchObject({
      suppressTargetImpact: true
    });
    expect(run.batch.requests[0]).toMatchObject({
      profileKey: 'grassWillSeedBeam',
      eventType: 'status_applied',
      source: { row: 1, col: 1 },
      target: { row: 4, col: 5 }
    });
  });

  test('routes WATER_WILL healing status through the board-owned blue beam and target gate', async () => {
    const animateDestroyDragonBreath = jest.fn(() => Promise.resolve());
    jest.doMock('../ui/animation-destroy-source-events', () => ({
      animateDestroyDragonBreath
    }));
    const board = document.getElementById('board') as HTMLElement;
    board.innerHTML = [
      '<div class="cell" data-row="1" data-col="1"></div>',
      '<div class="cell" data-row="4" data-col="5"></div>'
    ].join('');
    board.getBoundingClientRect = () => rect(60, 60, 200, 200) as DOMRect;
    const sourceCell = board.querySelector<HTMLElement>('.cell[data-row="1"][data-col="1"]')!;
    const targetCell = board.querySelector<HTMLElement>('.cell[data-row="4"][data-col="5"]')!;
    sourceCell.getBoundingClientRect = () => rect(90, 90) as DOMRect;
    targetCell.getBoundingClientRect = () => rect(190, 190) as DOMRect;
    const meta = Object.freeze({
      special: 'HEALING_CELL',
      cause: 'WATER_WILL',
      reason: 'healing_cell_applied',
      sourceRow: 1,
      sourceCol: 1,
      sourceTrajectoryProfile: 'waterWillHealingBeam'
    });
    const event = Object.freeze({
      type: 'status_applied',
      targets: Object.freeze([Object.freeze({
        r: 4,
        col: 5,
        sourceRow: 1,
        sourceCol: 1,
        cause: 'WATER_WILL',
        reason: 'healing_cell_applied',
        meta
      })])
    });
    const SourceTrajectory = require('../ui/board-dom-compat/source-trajectory');
    const run = SourceTrajectory.startDomBoardSourceTrajectoryBatch(
      [event],
      contextFor([event]),
      baseDeps(document, board)
    );

    await expect(run.waitForTarget('status_applied', event.targets[0], event)).resolves.toBeUndefined();
    expect(animateDestroyDragonBreath).toHaveBeenCalledTimes(1);
    expect(animateDestroyDragonBreath.mock.calls[0][0]).toMatchObject({ meta });
    expect(animateDestroyDragonBreath.mock.calls[0][1]).toMatchObject({
      suppressTargetImpact: true
    });
    expect(run.batch.requests[0]).toMatchObject({
      profileKey: 'waterWillHealingBeam',
      eventType: 'status_applied',
      source: { row: 1, col: 1 },
      target: { row: 4, col: 5 }
    });
  });

  test('keeps full-scope ordinals while starting only the current playPhase launch', async () => {
    const board = document.getElementById('board') as HTMLElement;
    const events = Object.freeze([0, 1].map((index) => Object.freeze({
      type: 'destroy',
      targets: Object.freeze([Object.freeze({
        r: 2,
        col: 2 + index,
        sourceRow: 1,
        sourceCol: 1,
        ownerBefore: 'white',
        cause: 'SNIPER_WILL',
        reason: 'sniper_shot'
      })])
    })));
    const context = contextFor(events);
    const SourceTrajectory = require('../ui/board-dom-compat/source-trajectory');
    const first = SourceTrajectory.startDomBoardSourceTrajectoryBatch(
      [events[0]],
      context,
      baseDeps(document, board, { isNoAnim: () => true })
    );
    const second = SourceTrajectory.startDomBoardSourceTrajectoryBatch(
      [events[1]],
      context,
      baseDeps(document, board, { isNoAnim: () => true })
    );

    expect(first.batch.requests.map((request: any) => request.eventOrdinal)).toEqual([0]);
    expect(second.batch.requests.map((request: any) => request.eventOrdinal)).toEqual([1]);
    expect(first.batch.requests[0].trajectoryId).not.toBe(second.batch.requests[0].trajectoryId);
    await expect(first.waitForOptionalFlipTarget({ r: 7, col: 7 })).resolves.toBeUndefined();
    await expect(first.waitForTarget('destroy', events[1].targets[0], events[1])).rejects.toThrow(
      'DOM source trajectory membership is missing for destroy target'
    );
  });

  test('rejects an endpoint inside rectangular bounds but absent from sparse topology', () => {
    const event = Object.freeze({
      type: 'destroy',
      targets: Object.freeze([Object.freeze({
        r: 1,
        col: 1,
        sourceRow: 0,
        sourceCol: 0,
        ownerBefore: 'white',
        cause: 'SNIPER_WILL',
        reason: 'sniper_shot'
      })])
    });
    const topology = Object.freeze({
      minRow: 0,
      maxRow: 2,
      minCol: 0,
      maxCol: 2,
      existingKeys: Object.freeze(['0,0', '2,2'])
    });
    const frame = {
      model: { topology },
      layout: { camera: { viewportWidth: 60, viewportHeight: 60 } }
    } as any;
    const SourceTrajectory = require('../ui/board-dom-compat/source-trajectory');

    expect(() => SourceTrajectory.validateDomBoardSourceTrajectoryPhase(
      [event],
      contextFor([event]),
      frame
    )).toThrow('board_source_trajectory_endpoint_invalid:destroy');
  });

  test('clips the compatibility overlay to the actual board viewport while retaining logical endpoints', async () => {
    let finishAnimation!: () => void;
    const animate = jest.fn(() => ({ cancel: jest.fn() }));
    (dom.window.HTMLElement.prototype as any).animate = animate;
    const board = document.getElementById('board') as HTMLElement;
    const event = Object.freeze({
      type: 'destroy',
      targets: Object.freeze([{ r: 0, col: 2, sourceRow: 0, sourceCol: -2, ownerBefore: 'white', cause: 'SNIPER_WILL', reason: 'sniper_shot' }])
    });
    const events = Object.freeze([event]);
    const topology = Object.freeze({
      minRow: 0, maxRow: 0, minCol: -2, maxCol: 2,
      renderRows: 1, renderCols: 5, renderRowOffset: 0, renderColOffset: 2
    });
    const layout = Object.freeze({
      revision: 7,
      cellSize: 20,
      dpr: 1,
      stageScale: 1,
      cellScale: 1,
      orientation: 'normal',
      frameInset: Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 }),
      clientOrigin: Object.freeze({ x: 100, y: 50 }),
      visualViewport: Object.freeze({ scale: 1, offsetLeft: 0, offsetTop: 0 }),
      camera: Object.freeze({ scrollLeft: 40, scrollTop: 0, viewportWidth: 40, viewportHeight: 20 }),
      logicalWidth: 100,
      logicalHeight: 20,
      visibleWorldWindow: Object.freeze({ minRow: 0, maxRow: 0, minCol: 0, maxCol: 1 })
    });
    const frame = { frameToken: 'dom-source:frame', model: { topology, cells: [] }, layout } as any;
    const TransientOverlayBatch = require('../ui/transient-overlay-batch');
    const overlayBatch = TransientOverlayBatch.createTransientOverlayBatch({ documentRef: document });
    const SourceTrajectory = require('../ui/board-dom-compat/source-trajectory');
    const record = jest.fn();

    const run = SourceTrajectory.startDomBoardSourceTrajectoryBatch(events, contextFor(events), baseDeps(document, board, {
      frame,
      transientOverlayBatch: overlayBatch,
      record,
      waitForAnimationFinish: () => new Promise<void>((resolve) => { finishAnimation = resolve; })
    }));

    const root = document.querySelector<HTMLElement>('[data-board-source-trajectory-layer="true"]');
    expect(root).not.toBeNull();
    expect(root!.style.clipPath).toBe('inset(50px 160px 230px 100px)');
    expect(animate).toHaveBeenCalledWith([
      { transform: 'translate(0, 0)', opacity: 1 },
      { transform: 'translate(80px, 0px)', opacity: 1 }
    ], expect.objectContaining({ duration: 120, easing: 'linear' }));
    expect(record).toHaveBeenCalledWith('dom-source-trajectory:start', expect.objectContaining({
      source: { row: 0, col: -2 },
      target: { row: 0, col: 2 },
      direction: 'source-to-target',
      geometry: expect.objectContaining({
        sourceCenter: { x: 70, y: 60 },
        targetCenter: { x: 150, y: 60 },
        movementStart: { x: 70, y: 60 },
        movementEnd: { x: 150, y: 60 },
        visibleClip: expect.objectContaining({ left: 100, top: 50, right: 140, bottom: 70 }),
        pathIntersectsViewport: true
      })
    }));
    finishAnimation();
    await run.settlement;
    overlayBatch.cleanup();
  });

  test('a coordinate-merged zombie target waits every raw trajectory membership', async () => {
    const board = document.getElementById('board') as HTMLElement;
    board.getBoundingClientRect = () => rect(0, 0, 200, 200) as DOMRect;
    board.innerHTML = [
      '<div class="cell" data-row="1" data-col="1"></div>',
      '<div class="cell" data-row="2" data-col="2"></div>',
      '<div class="cell" data-row="3" data-col="3"></div>'
    ].join('');
    const cells = Array.from(board.querySelectorAll<HTMLElement>('.cell'));
    cells[0].getBoundingClientRect = () => rect(20, 20) as DOMRect;
    cells[1].getBoundingClientRect = () => rect(60, 60) as DOMRect;
    cells[2].getBoundingClientRect = () => rect(100, 100) as DOMRect;
    const events = Object.freeze([
      Object.freeze({ type: 'flip', targets: Object.freeze([{ r: 3, col: 3, sourceRow: 1, sourceCol: 1, cause: 'ZOMBIE', reason: 'zombie_infection' }]) }),
      Object.freeze({ type: 'flip', targets: Object.freeze([{ r: 3, col: 3, sourceRow: 2, sourceCol: 2, cause: 'ZOMBIE', reason: 'zombie_infection' }]) })
    ]);
    const SourceTrajectory = require('../ui/board-dom-compat/source-trajectory');
    const run = SourceTrajectory.startDomBoardSourceTrajectoryBatch(events, contextFor(events), baseDeps(document, board, {
      isNoAnim: () => true
    }));
    expect(run.batch.requests).toHaveLength(2);
    const secondId = run.batch.requests[1].trajectoryId;
    (run.trajectoryById as Map<string, Promise<void>>).delete(secondId);

    await expect(run.waitForTarget('flip', { r: 3, col: 3 })).rejects.toThrow(
      `DOM source trajectory Promise is missing: ${secondId}`
    );
  });

  test('NOANIM settles without requiring DOM or frame geometry', async () => {
    const event = Object.freeze({
      type: 'destroy',
      targets: Object.freeze([{
        r: 7,
        col: 7,
        sourceRow: 0,
        sourceCol: 0,
        ownerBefore: 'white',
        cause: 'SNIPER_WILL',
        reason: 'sniper_shot'
      }])
    });
    const events = Object.freeze([event]);
    const record = jest.fn();
    const SourceTrajectory = require('../ui/board-dom-compat/source-trajectory');
    const board = document.getElementById('board') as HTMLElement;
    const run = SourceTrajectory.startDomBoardSourceTrajectoryBatch(events, contextFor(events), baseDeps(document, board, {
      frame: null,
      isNoAnim: () => true,
      getFallbackCellClientRect: () => null,
      record
    }));

    await expect(run.settlement).resolves.toBeUndefined();
    await expect(run.waitForTarget('destroy', event.targets[0], event)).resolves.toBeUndefined();
    expect(record).toHaveBeenCalledWith('dom-source-trajectory:start', expect.objectContaining({
      profileKey: 'sniperShot',
      source: { row: 0, col: 0 },
      target: { row: 7, col: 7 },
      direction: 'source-to-target',
      geometry: null,
      visible: false
    }));
  });

  test('reduced motion skips zombie source objects without delaying its gate', async () => {
    const board = document.getElementById('board') as HTMLElement;
    board.getBoundingClientRect = () => rect(0, 0, 200, 200) as DOMRect;
    board.innerHTML = [
      '<div class="cell" data-row="1" data-col="1"></div>',
      '<div class="cell" data-row="2" data-col="2"></div>'
    ].join('');
    const cells = Array.from(board.querySelectorAll<HTMLElement>('.cell'));
    cells[0].getBoundingClientRect = () => rect(20, 20) as DOMRect;
    cells[1].getBoundingClientRect = () => rect(80, 80) as DOMRect;
    const event = Object.freeze({
      type: 'flip',
      targets: Object.freeze([{ r: 2, col: 2, sourceRow: 1, sourceCol: 1, cause: 'ZOMBIE', reason: 'zombie_infection' }])
    });
    const events = Object.freeze([event]);
    const sleep = jest.fn(async () => undefined);
    const SourceTrajectory = require('../ui/board-dom-compat/source-trajectory');
    const run = SourceTrajectory.startDomBoardSourceTrajectoryBatch(events, contextFor(events), baseDeps(document, board, {
      prefersReducedMotion: () => true,
      sleep
    }));

    await run.waitForTarget('flip', event.targets[0], event);
    expect(sleep).not.toHaveBeenCalled();
    expect(document.querySelector('[data-board-source-trajectory-layer="true"]')).toBeNull();
  });

  test('abort rejects the gate and releases legacy DOM animation objects', async () => {
    (dom.window.HTMLElement.prototype as any).animate = jest.fn(() => ({ cancel: jest.fn() }));
    const board = document.getElementById('board') as HTMLElement;
    board.getBoundingClientRect = () => rect(0, 0, 200, 200) as DOMRect;
    board.innerHTML = [
      '<div class="cell" data-row="1" data-col="1"></div>',
      '<div class="cell" data-row="2" data-col="2"></div>'
    ].join('');
    const cells = Array.from(board.querySelectorAll<HTMLElement>('.cell'));
    cells[0].getBoundingClientRect = () => rect(20, 20) as DOMRect;
    cells[1].getBoundingClientRect = () => rect(80, 80) as DOMRect;
    const events = Object.freeze([Object.freeze({
      type: 'destroy',
      targets: Object.freeze([{ r: 2, col: 2, sourceRow: 1, sourceCol: 1, ownerBefore: 'white', cause: 'SNIPER_WILL', reason: 'sniper_shot' }])
    })]);
    const abortController = new AbortController();
    const TransientOverlayBatch = require('../ui/transient-overlay-batch');
    const overlayBatch = TransientOverlayBatch.createTransientOverlayBatch({ documentRef: document });
    const SourceTrajectory = require('../ui/board-dom-compat/source-trajectory');
    const run = SourceTrajectory.startDomBoardSourceTrajectoryBatch(events, contextFor(events), baseDeps(document, board, {
      transientOverlayBatch: overlayBatch,
      abortSignal: abortController.signal,
      waitForAnimationFinish: () => new Promise<void>(() => undefined)
    }));
    const root = document.querySelector<HTMLElement>('[data-board-source-trajectory-layer="true"]');
    expect(root?.children).toHaveLength(1);
    const expected = expect(run.settlement).rejects.toThrow('context lost');

    abortController.abort(new Error('context lost'));

    await expected;
    expect(root?.children).toHaveLength(0);
    overlayBatch.cleanup();
  });
});
