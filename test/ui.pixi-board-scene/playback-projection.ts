import * as EffectBounds from '../../ui/board-visual/effect-bounds';
import * as BoardScene from '../../ui/pixi/board-scene';
import {
  FakeDisplayObject,
  FakeContainer,
  FakeGraphics,
  renderedGraphicsBounds,
  createFakeRuntime,
  makeCell,
  makeTopology,
  makeFrame
} from '../helpers/pixi-board-scene-fixtures';

describe('Pixi board scene playback projection', () => {
  const blackStone = Object.freeze({
    owner: 'black' as const,
    value: 1,
    specialType: null,
    status: Object.freeze({})
  });
  const whiteStone = Object.freeze({
    owner: 'white' as const,
    value: -1,
    specialType: null,
    status: Object.freeze({})
  });

  test('keeps retained overrides through reflow and clears them only after a successful final apply', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 8, baseCols: 8 });
    const makeStoneFrame = (stone: typeof blackStone | typeof whiteStone, revision: number) => makeFrame({
      topology,
      modelRevision: revision,
      layoutRevision: revision,
      cells: topology.existingKeys.map((key) => makeCell(key, {
        stone: key === '3,3' ? stone : null
      }))
    });
    const first = makeStoneFrame(blackStone, 1);
    const second = makeStoneFrame(whiteStone, 2);
    scene.applyFrame(first);

    const scope = scene.beginPlaybackScope('writer:1');
    expect(scene.beginPlaybackScope('writer:1')).toBe(scope);
    scene.retainStoneOverride(scope, 3, 3, {
      offsetX: 7,
      offsetY: -5,
      scaleX: 0.4,
      scaleY: 1,
      rotation: 0.25,
      alpha: 0.6
    });
    scene.hideStone(scope, 3, 3);

    expect(scene.getRenderedCell(3, 3)).toMatchObject({
      stone: { owner: 'black', visible: false },
      playback: {
        hidden: true,
        overridden: true,
        offset: { x: 7, y: -5 },
        scale: { x: 0.4, y: 1 },
        rotation: 0.25,
        alpha: 0.6
      }
    });
    expect(() => scene.beginPlaybackScope('writer:2')).toThrow('still active');
    expect(() => scene.applyFrame(null as any)).toThrow('complete BoardVisualFrame');
    expect(scene.getDiagnostics()).toMatchObject({
      playbackScopeKey: 'writer:1',
      retainedStoneOverrideCount: 1,
      hiddenStoneCount: 1
    });

    scene.applyFrame(second, { preservePlaybackProjection: true });
    expect(scene.getRenderedCell(3, 3)).toMatchObject({
      stone: { owner: 'white', visible: false },
      playback: { hidden: true, overridden: true }
    });

    scene.applyFrame(second);
    expect(scene.getRenderedCell(3, 3)).toMatchObject({
      stone: { owner: 'white', visible: true },
      playback: {
        hidden: false,
        overridden: false,
        offset: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotation: 0,
        alpha: 1
      }
    });
    expect(scene.getDiagnostics()).toMatchObject({
      playbackScopeKey: null,
      retainedStoneOverrideCount: 0,
      hiddenStoneCount: 0
    });
  });

  test('pools event ghosts without increasing sparse cell materialization', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 16, baseCols: 16 });
    const frame = makeFrame({
      topology,
      visibleWindow: { minRow: 4, maxRow: 6, minCol: 4, maxCol: 6 }
    });
    scene.applyFrame(frame);
    const retainedCount = scene.getDiagnostics().activeViewCount;
    const scope = scene.beginPlaybackScope('writer:ghosts');
    const offscreen = scene.acquirePlaybackGhost(scope, {
      row: 15,
      col: 15,
      stone: blackStone
    });

    expect(scene.getPlaybackGhost(offscreen)).toMatchObject({
      row: 15,
      col: 15,
      visible: false,
      owner: 'black'
    });
    expect(scene.getDiagnostics()).toMatchObject({
      activeViewCount: retainedCount,
      activePlaybackGhostCount: 1,
      materializedPlaybackGhostCount: 0,
      createdPlaybackGhostCount: 0
    });
    expect(scene.layers.playback.children).toHaveLength(0);

    // MOVE keeps the ghost anchored to its source and animates in scene-space
    // offsets. Culling must follow that transformed position as it crosses
    // from an offscreen source into the materialized viewport.
    scene.updatePlaybackGhost(scope, offscreen, {
      offsetX: -10 * 32,
      offsetY: -10 * 32
    });
    expect(scene.getPlaybackGhost(offscreen)).toMatchObject({
      row: 15,
      col: 15,
      visible: true,
      position: { x: 96, y: 96 },
      offset: { x: -320, y: -320 }
    });
    expect(scene.getDiagnostics()).toMatchObject({
      materializedPlaybackGhostCount: 1,
      createdPlaybackGhostCount: 1
    });

    scene.updatePlaybackGhost(scope, offscreen, {
      row: 5.5,
      col: 5,
      offsetX: 3,
      offsetY: -4,
      scaleX: 0.5,
      scaleY: 1.2,
      rotation: 0.75,
      alpha: 0.4
    });
    expect(scene.getPlaybackGhost(offscreen)).toMatchObject({
      row: 5.5,
      col: 5,
      visible: true,
      position: { x: 99, y: 108 },
      offset: { x: 3, y: -4 },
      scale: { x: 0.5, y: 1.2 },
      rotation: 0.75,
      alpha: 0.4
    });

    scene.hideStone(scope, 5, 5);
    scene.releasePlaybackGhost(scope, offscreen);
    expect(scene.layers.playback.children).toHaveLength(0);
    expect(scene.getPlaybackGhost(offscreen)).toBeNull();
    expect(scene.getDiagnostics()).toMatchObject({
      hiddenStoneCount: 1,
      activePlaybackGhostCount: 0,
      materializedPlaybackGhostCount: 0,
      pooledPlaybackGhostCount: 1,
      pooledPlaybackStoneGhostCount: 1,
      pooledPlaybackMarkerGhostCount: 0
    });

    const reused = scene.acquirePlaybackGhost(scope, { row: 5, col: 5, stone: whiteStone });
    expect(scene.getDiagnostics()).toMatchObject({
      activePlaybackGhostCount: 1,
      materializedPlaybackGhostCount: 1,
      createdPlaybackGhostCount: 1,
      pooledPlaybackGhostCount: 0,
      createdPlaybackStoneGhostCount: 1,
      pooledPlaybackStoneGhostCount: 0
    });
    scene.applyFrame(frame);
    expect(scene.getPlaybackGhost(reused)).toBeNull();
    expect(scene.getDiagnostics()).toMatchObject({
      hiddenStoneCount: 0,
      playbackScopeKey: null,
      activePlaybackGhostCount: 0,
      materializedPlaybackGhostCount: 0,
      pooledPlaybackGhostCount: 1,
      pooledPlaybackStoneGhostCount: 1,
      pooledPlaybackMarkerGhostCount: 0
    });
  });

  test('materializes marker-only seed ghosts with the preloaded seed texture', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 8, baseCols: 8 });
    const seedTexture = { id: 'playback-seed-texture' };
    scene.applyFrame(makeFrame({ topology }), {
      textures: new Map([['special-stone:SEED:black', { texture: seedTexture }]])
    });
    const scope = scene.beginPlaybackScope('writer:seed-marker');
    const ghost = scene.acquirePlaybackGhost(scope, {
      row: 5,
      col: 5,
      stone: null,
      markers: [{
        kind: 'seed',
        owner: 'black',
        value: null,
        data: { type: 'SEED', remainingOwnerTurns: 5 }
      }]
    });

    expect(scene.getPlaybackGhost(ghost)).toMatchObject({
      row: 5,
      col: 5,
      visible: true,
      owner: 'black'
    });
    const markerRoot = scene.layers.playback.children[0];
    expect(markerRoot).toMatchObject({ label: 'pixi-cell-markers', visible: true });
    expect(markerRoot.children.find((child: any) => (
      child.label === 'pixi-marker-seed-texture'
    ))).toMatchObject({
      texture: seedTexture,
      visible: true
    });
    expect(markerRoot.children.find((child: any) => (
      child.label === 'pixi-marker-seed-fallback'
    ))).toBeUndefined();

    scene.releasePlaybackGhost(scope, ghost);
    expect(scene.layers.playback.children).toHaveLength(0);
    expect(scene.getDiagnostics()).toMatchObject({
      activePlaybackGhostCount: 0,
      materializedPlaybackGhostCount: 0,
      pooledPlaybackGhostCount: 1,
      createdPlaybackMarkerGhostCount: 1,
      pooledPlaybackStoneGhostCount: 0,
      pooledPlaybackMarkerGhostCount: 1
    });
  });

  test('applies ghost and effect transforms without repainting their static graphics', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 8, baseCols: 8 });
    scene.applyFrame(makeFrame({ topology, cellSize: 32 }));
    const scope = scene.beginPlaybackScope('writer:transform-only');
    const ghost = scene.acquirePlaybackGhost(scope, {
      row: 2,
      col: 2,
      stone: { owner: 'black', value: 1, specialType: null, status: {} }
    });
    const effect = scene.acquirePlaybackEffect(scope, {
      row: 2,
      col: 2,
      family: 'transform-only',
      kind: 'impact',
      tone: 'gold',
      label: '1'
    });
    const before = scene.getDiagnostics();

    for (let index = 0; index < 120; index += 1) {
      const progress = index / 119;
      scene.updatePlaybackGhost(scope, ghost, {
        alpha: 1 - progress * 0.5,
        scaleX: 1 + progress * 0.2,
        scaleY: 1 + progress * 0.2
      });
      scene.updatePlaybackEffect(scope, effect, {
        alpha: 1 - progress * 0.5,
        scale: 1 + progress * 0.2,
        rotation: progress * Math.PI
      });
    }
    const after = scene.getDiagnostics();

    expect(after.playbackGhostStaticPrepareCount).toBe(before.playbackGhostStaticPrepareCount);
    expect(after.playbackEffectStaticPaintCount).toBe(before.playbackEffectStaticPaintCount);
    expect(after.playbackGhostTransformApplyCount - before.playbackGhostTransformApplyCount).toBe(120);
    expect(after.playbackEffectTransformApplyCount - before.playbackEffectTransformApplyCount).toBe(120);
    scene.applyFrame(makeFrame({ topology, cellSize: 40, layoutRevision: 2 }), {
      preservePlaybackProjection: true
    });
    expect(scene.getDiagnostics()).toMatchObject({
      playbackGhostStaticPrepareCount: after.playbackGhostStaticPrepareCount + 1,
      playbackEffectStaticPaintCount: after.playbackEffectStaticPaintCount + 1
    });
    scene.releasePlaybackGhost(scope, ghost);
    scene.releasePlaybackEffect(scope, effect);
    scene.destroy();
  });

  test('bounds transient effect DisplayObjects by viewport while preserving offscreen logical records', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 16, baseCols: 16 });
    const firstFrame = makeFrame({
      topology,
      visibleWindow: { minRow: 0, maxRow: 1, minCol: 0, maxCol: 1 }
    });
    scene.applyFrame(firstFrame);
    const baselineDisplayObjectCount = scene.getDiagnostics().displayObjectCount;
    const scope = scene.beginPlaybackScope('writer:sparse-effects');
    const handles = topology.playableKeys.map((key) => {
      const [row, col] = key.split(',').map(Number);
      return scene.acquirePlaybackEffect(scope, {
        row,
        col,
        family: 'theory_incarnation',
        kind: 'pulse',
        tone: 'purple'
      });
    });
    const firstWindow = scene.getDiagnostics().materializationWindow!;
    const firstWindowArea = (firstWindow.maxRow - firstWindow.minRow + 1)
      * (firstWindow.maxCol - firstWindow.minCol + 1);

    expect(scene.getDiagnostics()).toMatchObject({
      activePlaybackEffectCount: 256,
      materializedPlaybackEffectCount: firstWindowArea,
      createdPlaybackEffectCount: firstWindowArea,
      pooledPlaybackEffectCount: 0
    });
    expect(scene.layers.effect.children.filter((child: FakeDisplayObject) => (
      child.label === 'pixi-playback-effect'
    ))).toHaveLength(firstWindowArea);
    expect(scene.getDiagnostics().displayObjectCount - baselineDisplayObjectCount)
      .toBe(firstWindowArea * 3);
    expect(scene.getPlaybackEffect(handles[0])).toMatchObject({ visible: true, row: 0, col: 0 });
    expect(scene.getPlaybackEffect(handles[handles.length - 1])).toMatchObject({
      visible: false,
      row: 15,
      col: 15
    });

    const lastFrame = makeFrame({
      topology,
      visibleWindow: { minRow: 14, maxRow: 15, minCol: 14, maxCol: 15 },
      layoutRevision: 2
    });
    scene.applyFrame(lastFrame, { preservePlaybackProjection: true });
    const lastWindow = scene.getDiagnostics().materializationWindow!;
    const lastWindowArea = (lastWindow.maxRow - lastWindow.minRow + 1)
      * (lastWindow.maxCol - lastWindow.minCol + 1);
    expect(lastWindowArea).toBe(firstWindowArea);
    expect(scene.getDiagnostics()).toMatchObject({
      activePlaybackEffectCount: 256,
      materializedPlaybackEffectCount: lastWindowArea,
      createdPlaybackEffectCount: firstWindowArea,
      pooledPlaybackEffectCount: 0
    });
    expect(scene.getPlaybackEffect(handles[0])).toMatchObject({ visible: false });
    expect(scene.getPlaybackEffect(handles[handles.length - 1])).toMatchObject({ visible: true });

    scene.applyFrame(firstFrame, { preservePlaybackProjection: true });
    expect(scene.getDiagnostics()).toMatchObject({
      activePlaybackEffectCount: 256,
      materializedPlaybackEffectCount: firstWindowArea,
      createdPlaybackEffectCount: firstWindowArea
    });
    expect(scene.getPlaybackEffect(handles[0])).toMatchObject({ visible: true });
    expect(scene.getPlaybackEffect(handles[handles.length - 1])).toMatchObject({ visible: false });

    for (const handle of handles) scene.releasePlaybackEffect(scope, handle);
    expect(scene.getDiagnostics()).toMatchObject({
      activePlaybackEffectCount: 0,
      materializedPlaybackEffectCount: 0,
      pooledPlaybackEffectCount: firstWindowArea
    });
    scene.destroy();
    expect(scene.getDiagnostics()).toMatchObject({
      pooledPlaybackEffectCount: 0,
      destroyedPlaybackEffectCount: firstWindowArea,
      displayObjectCount: 0
    });
  });

  test('keeps the rendered geometry of every board-local family inside the two-cell canvas gutter at all corners and edges', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 8, baseCols: 8 });
    const frame = makeFrame({ topology, cellSize: 32 });
    scene.applyFrame(frame);
    const scope = scene.beginPlaybackScope('writer:actual-effect-clipping');
    const gutterPx = scene.getDiagnostics().effectGutterCells * frame.layout.cellSize;
    const canvasWidth = frame.layout.camera.viewportWidth + gutterPx * 2;
    const canvasHeight = frame.layout.camera.viewportHeight + gutterPx * 2;
    const placements = [
      { name: 'top-left', row: 0, col: 0 },
      { name: 'top', row: 0, col: 3 },
      { name: 'top-right', row: 0, col: 7 },
      { name: 'right', row: 3, col: 7 },
      { name: 'bottom-right', row: 7, col: 7 },
      { name: 'bottom', row: 7, col: 3 },
      { name: 'bottom-left', row: 7, col: 0 },
      { name: 'left', row: 3, col: 0 }
    ];
    const effectShape = (family: string) => {
      if (family === 'board_shrink') {
        return { kind: 'topology' as const, scale: 1, rotation: 0 };
      }
      if (family === 'theory_incarnation_spawn_roulette') {
        return { kind: 'roulette' as const, scale: 1.08, rotation: 0 };
      }
      if (family === 'crossfade_stone') {
        return { kind: 'aura' as const, scale: 1.12, rotation: 0 };
      }
      if (family === 'destroy' || family === 'legacy_sacrifice_absorb_pulse') {
        return { kind: 'impact' as const, scale: 1.72, rotation: Math.PI * 0.36 };
      }
      return { kind: 'pulse' as const, scale: 1.4, rotation: 0 };
    };

    for (const family of EffectBounds.BOARD_LOCAL_EFFECT_FAMILIES) {
      const shape = effectShape(family);
      for (const placement of placements) {
        const handle = scene.acquirePlaybackEffect(scope, {
          row: placement.row,
          col: placement.col,
          family,
          kind: shape.kind,
          tone: 'purple',
          label: family === 'theory_incarnation_spawn_roulette' ? '19' : null,
          innerBoundaryEdges: family === 'board_shrink'
            ? ['top', 'right', 'bottom', 'left']
            : []
        });
        scene.updatePlaybackEffect(scope, handle, {
          alpha: 1,
          scale: shape.scale,
          rotation: shape.rotation
        });
        const root = scene.layers.effect.children.find((child: FakeDisplayObject) => (
          child.label === 'pixi-playback-effect'
        )) as FakeContainer;
        const graphics = root.children.find((child) => (
          child.label === 'pixi-playback-effect-graphics'
        )) as FakeGraphics;
        const bounds = renderedGraphicsBounds(root, graphics);
        expect({
          family,
          placement: placement.name,
          insideCanvasGutter: bounds.minX >= -0.001
            && bounds.minY >= -0.001
            && bounds.maxX <= canvasWidth + 0.001
            && bounds.maxY <= canvasHeight + 0.001
        }).toEqual({
          family,
          placement: placement.name,
          insideCanvasGutter: true
        });
        scene.releasePlaybackEffect(scope, handle);
      }
    }
  });

  test('renders transient cell highlights below stones and restores the previous tone on release', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 8, baseCols: 8 });
    const cells = topology.existingKeys.map((key) => makeCell(key));
    cells.find((cell) => cell.key === '2,2')!.stone = {
      owner: 'black', value: 1, specialType: null, status: {}
    };
    const frame = makeFrame({ topology, cells });
    scene.applyFrame(frame);
    const scope = scene.beginPlaybackScope('writer:highlight');
    const positive = scene.acquirePlaybackCellHighlight(scope, 2, 2, 'positive');
    const placement = scene.acquirePlaybackCellHighlight(scope, 2, 2, 'placement');

    expect(scene.getDiagnostics()).toMatchObject({
      activePlaybackHighlightLeaseCount: 2,
      renderedPlaybackHighlightCount: 1
    });
    const renderedHighlight = scene.layers.cell.children.find((child: FakeDisplayObject) => (
      child.label === 'pixi-playback-cell-highlight'
    )) as FakeGraphics;
    expect(scene.layers.stone.children).toHaveLength(1);
    expect(scene.root.children.indexOf(scene.layers.cell)).toBeLessThan(
      scene.root.children.indexOf(scene.layers.stone)
    );
    expect(scene.layers.effect.children).toHaveLength(0);
    expect(renderedHighlight.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({ op: 'fill', style: expect.objectContaining({ color: '#66a4ff' }) })
    ]));

    scene.releasePlaybackCellHighlight(scope, placement);
    expect(renderedHighlight.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({ op: 'fill', style: expect.objectContaining({ color: '#b466ff' }) })
    ]));
    expect(scene.getDiagnostics()).toMatchObject({
      activePlaybackHighlightLeaseCount: 1,
      renderedPlaybackHighlightCount: 1
    });

    scene.releasePlaybackCellHighlight(scope, positive);
    expect(scene.layers.cell.children.some((child: FakeDisplayObject) => (
      child.label === 'pixi-playback-cell-highlight'
    ))).toBe(false);
    expect(scene.getDiagnostics()).toMatchObject({
      activePlaybackHighlightLeaseCount: 0,
      renderedPlaybackHighlightCount: 0,
      pooledPlaybackHighlightCount: 1
    });

    scene.acquirePlaybackCellHighlight(scope, 2, 2, 'negative');
    scene.applyFrame(frame);
    expect(scene.layers.cell.children.some((child: FakeDisplayObject) => (
      child.label === 'pixi-playback-cell-highlight'
    ))).toBe(false);
    expect(scene.getDiagnostics()).toMatchObject({
      playbackScopeKey: null,
      activePlaybackHighlightLeaseCount: 0,
      renderedPlaybackHighlightCount: 0
    });
  });

  test('materializes transient highlights only while their cell is inside the viewport window', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 16, baseCols: 16 });
    const firstFrame = makeFrame({
      topology,
      visibleWindow: { minRow: 0, maxRow: 1, minCol: 0, maxCol: 1 }
    });
    scene.applyFrame(firstFrame);
    const scope = scene.beginPlaybackScope('writer:sparse-highlight');
    const handle = scene.acquirePlaybackCellHighlight(scope, 15, 15, 'positive');
    expect(scene.getDiagnostics()).toMatchObject({
      activePlaybackHighlightLeaseCount: 1,
      renderedPlaybackHighlightCount: 0,
      pooledPlaybackHighlightCount: 0
    });
    expect(scene.layers.cell.children.some((child: FakeDisplayObject) => (
      child.label === 'pixi-playback-cell-highlight'
    ))).toBe(false);

    scene.applyFrame(makeFrame({
      topology,
      visibleWindow: { minRow: 14, maxRow: 15, minCol: 14, maxCol: 15 },
      layoutRevision: 2
    }), { preservePlaybackProjection: true });
    expect(scene.getDiagnostics()).toMatchObject({
      activePlaybackHighlightLeaseCount: 1,
      renderedPlaybackHighlightCount: 1,
      pooledPlaybackHighlightCount: 0
    });
    expect(scene.layers.cell.children.some((child: FakeDisplayObject) => (
      child.label === 'pixi-playback-cell-highlight'
    ))).toBe(true);

    scene.applyFrame(firstFrame, { preservePlaybackProjection: true });
    expect(scene.getDiagnostics()).toMatchObject({
      activePlaybackHighlightLeaseCount: 1,
      renderedPlaybackHighlightCount: 0,
      pooledPlaybackHighlightCount: 1
    });
    expect(scene.layers.cell.children.some((child: FakeDisplayObject) => (
      child.label === 'pixi-playback-cell-highlight'
    ))).toBe(false);

    scene.releasePlaybackCellHighlight(scope, handle);
    expect(scene.getDiagnostics()).toMatchObject({
      activePlaybackHighlightLeaseCount: 0,
      renderedPlaybackHighlightCount: 0,
      pooledPlaybackHighlightCount: 1
    });
  });

  test('draws retained BOARD_FRAME playback topology without a generic X or internal seam', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 4, baseCols: 4 });
    scene.applyFrame(makeFrame({ topology, cellSize: 40 }));
    const scope = scene.beginPlaybackScope('writer:board-frame-hole');
    const handle = scene.acquirePlaybackEffect(scope, {
      row: 1,
      col: 1,
      family: 'board_shrink',
      kind: 'topology',
      innerBoundaryEdges: ['top', 'bottom']
    });

    expect(scene.getPlaybackEffect(handle)).toMatchObject({
      family: 'board_shrink',
      kind: 'topology',
      innerBoundaryEdges: ['top', 'bottom']
    });
    const effectRoot = scene.layers.effect.children.find((child: FakeDisplayObject) => (
      child.label === 'pixi-playback-effect'
    )) as FakeContainer;
    const graphics = effectRoot.children.find((child) => (
      child.label === 'pixi-playback-effect-graphics'
    )) as FakeGraphics;
    expect(graphics.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({ op: 'fill', style: expect.objectContaining({ color: '#080909' }) })
    ]));
    const segments: Array<{ from: number[]; to: number[] }> = [];
    let from: number[] | null = null;
    for (const command of graphics.commands) {
      if (command.op === 'moveTo') from = command.args as number[];
      if (command.op === 'lineTo' && from) {
        segments.push({ from, to: command.args as number[] });
        from = null;
      }
    }
    expect(segments.length).toBeGreaterThan(4);
    expect(segments.some(({ from: start, to }) => (
      (to[0] - start[0]) * (to[1] - start[1]) < 0
    ))).toBe(false);
    const edgeRects = graphics.commands.filter((command) => (
      command.op === 'rect' && command.args?.[2] === 40 && command.args?.[3] === 2.5
    ));
    expect(edgeRects).toHaveLength(2);

    scene.releasePlaybackEffect(scope, handle);
    expect(scene.getDiagnostics()).toMatchObject({
      activePlaybackEffectCount: 0,
      pooledPlaybackEffectCount: 1
    });
  });

  test('reset and destroy release playback objects and reject stale scope handles', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 4, baseCols: 4 });
    scene.applyFrame(makeFrame({ topology }));
    const scope = scene.beginPlaybackScope('writer:reset');
    const ghost = scene.acquirePlaybackGhost(scope, { row: 1, col: 1, stone: blackStone });
    scene.acquirePlaybackCellHighlight(scope, 1, 1, 'placement');
    scene.resetPlaybackProjection(scope);

    expect(scene.getDiagnostics()).toMatchObject({
      playbackScopeKey: null,
      activePlaybackGhostCount: 0,
      activePlaybackHighlightLeaseCount: 0
    });
    expect(() => scene.updatePlaybackGhost(scope, ghost, { alpha: 0 })).toThrow('scope is not active');

    const next = scene.beginPlaybackScope('writer:destroy');
    scene.acquirePlaybackGhost(next, { row: 1, col: 1, stone: whiteStone });
    scene.destroy();
    expect(scene.getDiagnostics()).toMatchObject({
      destroyed: true,
      activePlaybackGhostCount: 0,
      pooledPlaybackGhostCount: 0,
      destroyedPlaybackGhostCount: 1,
      destroyedPlaybackStoneGhostCount: 1,
      destroyedPlaybackMarkerGhostCount: 0,
      displayObjectCount: 0
    });
  });

  test('keeps topology reveal progress across reflow and clears pooled view alpha on reset', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({
      baseRows: 8,
      baseCols: 8,
      minRow: 0,
      maxRow: 7,
      minCol: 0,
      maxCol: 8
    });
    const cells = topology.existingKeys.map((key) => makeCell(key, {
      markers: key === '0,8'
        ? [{ kind: 'board-bonus', owner: null, value: 4, data: {} }]
        : []
    }));
    const frame = makeFrame({ topology, cells, cellSize: 32, layoutRevision: 1 });
    scene.applyFrame(frame);
    const handle = scene.beginTopologyReveal(['0,8']);
    expect(scene.getRenderedCell(0, 8)).toMatchObject({ topologyRevealAlpha: 0 });
    const markerContainer = scene.layers.surface.children.find((child: FakeDisplayObject) => (
      child.label === 'pixi-retained-cell-markers'
    )) as FakeDisplayObject;
    const markerRoot = markerContainer.children.find((child: FakeDisplayObject) => (
      child.label === 'pixi-cell-markers'
    )) as FakeDisplayObject;
    expect(markerRoot.alpha).toBe(0);

    scene.updateTopologyReveal(handle, 0.35);
    const beforeReflow = scene.getRenderedCell(0, 8)!;
    expect(beforeReflow.topologyRevealAlpha).toBeCloseTo(0.35);
    const staticPatch = scene.layers.surface.children.find((child: FakeDisplayObject) => (
      child.label === 'pixi-static-board-topology-patch'
    ));
    expect(staticPatch).toBeTruthy();
    expect(staticPatch.alpha).toBeCloseTo(0.35);
    expect(markerRoot.alpha).toBeCloseTo(0.35);
    const expectedRoots = [
      ['cell', 'pixi-cell-hint-surface'],
      ['hint', 'pixi-hint-view'],
      ['interaction', 'pixi-interaction-hit-area']
    ] as const;
    for (const [layer, label] of expectedRoots) {
      const visualOnlyGutter = layer === 'interaction'
        ? scene.getDiagnostics().effectGutterCells * frame.layout.cellSize
        : 0;
      const display = scene.layers[layer].children.find((child: FakeDisplayObject) => (
        child.label === label
        && child.position.x === beforeReflow.position.x - visualOnlyGutter
        && child.position.y === beforeReflow.position.y - visualOnlyGutter
      ));
      expect(display).toBeTruthy();
      expect(display.alpha).toBeCloseTo(0.35);
    }

    const reflow = makeFrame({ topology, cells, cellSize: 40, layoutRevision: 2 });
    scene.applyFrame(reflow, { preservePlaybackProjection: true });
    expect(scene.getRenderedCell(0, 8)).toMatchObject({ topologyRevealAlpha: 0.35 });
    expect(scene.getDiagnostics()).toMatchObject({
      activeTopologyRevealCount: 1,
      topologyRevealKeys: ['0,8']
    });

    scene.endTopologyReveal(handle);
    expect(scene.getRenderedCell(0, 8)).toMatchObject({ topologyRevealAlpha: 1 });
    expect(markerRoot.alpha).toBe(1);
    const createdBeforeReset = scene.getDiagnostics().createdViewCount;
    const resetHandle = scene.beginTopologyReveal(['0,8']);
    scene.updateTopologyReveal(resetHandle, 0.12);
    scene.reset();
    expect(scene.getDiagnostics()).toMatchObject({
      activeTopologyRevealCount: 0,
      topologyRevealKeys: []
    });

    scene.applyFrame(frame);
    expect(scene.getRenderedCell(0, 8)).toMatchObject({ topologyRevealAlpha: 1 });
    expect(scene.getDiagnostics().createdViewCount).toBe(createdBeforeReset);
  });
});
