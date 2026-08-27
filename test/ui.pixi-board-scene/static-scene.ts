import * as fs from 'fs';
import * as path from 'path';

import * as Theme from '../../ui/board-visual/theme';
import * as BoardScene from '../../ui/pixi/board-scene';
import {
  FakeGraphics,
  createFakeRuntime,
  makeCell,
  rectangleKeys,
  makeTopology,
  makeFrame
} from '../helpers/pixi-board-scene-fixtures';

describe('Pixi static board scene', () => {
  test('uses the fixed layer order, one static sprite, sparse stones, and four 8x8 star points', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime, stage: fixture.stage });
    const topology = makeTopology({ baseRows: 8, baseCols: 8 });
    const cells = topology.existingKeys.map((key) => makeCell(key));
    cells.find((cell) => cell.key === '3,3')!.stone = {
      owner: 'black', value: 1, specialType: null, status: {}
    };
    const frame = makeFrame({ topology, cells });
    const textures = new Map<string, any>([
      ['board', { texture: { id: 'board-texture' } }],
      ['black-stone', { texture: { id: 'black-texture' } }]
    ]);

    const first = scene.applyFrame(frame, { textures, textureRevision: 1 });
    const second = scene.applyFrame(frame, { textures, textureRevision: 1 });

    expect(fixture.stage.children).toEqual([scene.root]);
    expect(scene.root.eventMode).toBe('passive');
    expect(scene.root.children.map((layer: any) => layer.label)).toEqual(
      BoardScene.PIXI_BOARD_SCENE_LAYER_ORDER.map((name) => `pixi-board-layer:${name}`)
    );
    expect(scene.root.children
      .filter((layer: any) => layer !== scene.layers.interaction)
      .every((layer: any) => layer.eventMode === 'none')).toBe(true);
    expect(scene.layers.interaction).toMatchObject({ eventMode: 'static' });
    expect(scene.layers.interaction.hitArea).toMatchObject({ x: 0, y: 0, width: 256, height: 256 });
    expect(scene.layers.interaction.hitArea.contains(255.99, 255.99)).toBe(true);
    expect(scene.layers.interaction.hitArea.contains(256, 0)).toBe(false);
    expect(first).toMatchObject({ materializedCount: 64, createdViews: 64, updatedViews: 64 });
    expect(second).toMatchObject({ materializedCount: 64, createdViews: 0, updatedViews: 0, skippedViews: 64 });
    expect(scene.getDiagnostics()).toMatchObject({
      activeViewCount: 64,
      createdViewCount: 64,
      starPointCount: 4,
      boardTextureMode: 'single-surface',
      boardSurfaceUpdateCount: 1,
      boardSurfaceSkippedCount: 1,
      surfaceBoardTextureCount: 1,
      cellBoardTextureCount: 0,
      textureBackedStoneCount: 1,
      activeStoneViewCount: 1,
      staticBakeCount: 1,
      staticBakeSkipCount: 1,
      staticAttachedObjectCount: 1,
      staticTemporaryObjectCount: 0,
      canvasCount: 0,
      domNodeCount: 0,
      layerOrder: BoardScene.PIXI_BOARD_SCENE_LAYER_ORDER
    });
    expect(scene.getRenderedCell(3, 3)).toMatchObject({
      kind: 'playable',
      cell: { usesBoardTexture: false },
      stone: { textureBacked: true, texturePurpose: 'black-stone' }
    });
    expect(scene.layers.surface.children[0]).toMatchObject({
      label: 'pixi-static-board-texture',
      visible: true,
      width: 320,
      height: 320
    });
    expect(scene.layers.surface.children).toHaveLength(1);
  });

  test('clips persistent board layers to the physical viewport without clipping playback or effect gutter', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 16, baseCols: 16 });
    const frame = makeFrame({
      topology,
      visibleWindow: { minRow: 4, maxRow: 11, minCol: 4, maxCol: 11 }
    });

    scene.applyFrame(frame, {
      canvasViewport: { sceneOffsetX: 64, sceneOffsetY: 64 }
    });

    const maskRoot = scene.layers.interaction.children.find((child: any) => (
      child.label === 'pixi-board-viewport-masks'
    ));
    expect(maskRoot).toBeDefined();
    expect(maskRoot.eventMode).toBe('none');
    expect(maskRoot.children.map((child: any) => child.label)).toEqual(
      BoardScene.PIXI_BOARD_VIEWPORT_CLIPPED_LAYER_NAMES.map(
        (name) => `pixi-board-viewport-mask:${name}`
      )
    );
    for (const name of BoardScene.PIXI_BOARD_VIEWPORT_CLIPPED_LAYER_NAMES) {
      const mask = scene.layers[name].mask as FakeGraphics;
      expect(mask.parent).toBe(maskRoot);
      expect(mask.commands).toEqual([
        { op: 'rect', args: [64, 64, 256, 256] },
        { op: 'fill', style: { color: '#ffffff', alpha: 1 } }
      ]);
    }
    expect(scene.layers.playback.mask).toBeUndefined();
    expect(scene.layers.effect.mask).toBeUndefined();
    expect(scene.getDiagnostics()).toMatchObject({
      viewportClippedLayerNames: ['surface', 'cell', 'marker', 'stone', 'hint'],
      viewportClipRect: { x: 64, y: 64, width: 256, height: 256 },
      effectGutterCells: 2
    });

    scene.reset();
    expect(scene.getDiagnostics().viewportClipRect).toBeNull();
    for (const name of BoardScene.PIXI_BOARD_VIEWPORT_CLIPPED_LAYER_NAMES) {
      expect((scene.layers[name].mask as FakeGraphics).commands).toEqual([]);
    }

    scene.applyFrame(frame, {
      canvasViewport: { sceneOffsetX: 48, sceneOffsetY: 40 }
    });
    expect(scene.getDiagnostics().viewportClipRect).toEqual({
      x: 48,
      y: 40,
      width: 256,
      height: 256
    });
    scene.destroy();
  });

  test('unmasks only an attached expansion cell outside the fixed base viewport', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const baseKeys = rectangleKeys(0, 7, 0, 6);
    const topology = makeTopology({
      baseRows: 8,
      baseCols: 7,
      minCol: -1,
      maxCol: 6,
      baseKeys,
      existingKeys: [...baseKeys, '7,-1']
    });
    const cells = topology.existingKeys.map((key) => {
      const [row, col] = key.split(',').map(Number);
      return makeCell(key, {
        renderRow: row + topology.renderRowOffset,
        renderCol: col + topology.renderColOffset,
        expansionSide: col < 0 ? 'left' : null
      });
    });
    const frame = makeFrame({
      topology,
      cells,
      cellSize: 32,
      visibleWindow: { minRow: 0, maxRow: 7, minCol: 0, maxCol: 6 }
    });

    scene.applyFrame(frame, {
      canvasViewport: { sceneOffsetX: 64, sceneOffsetY: 64 }
    });

    for (const name of BoardScene.PIXI_BOARD_VIEWPORT_CLIPPED_LAYER_NAMES) {
      const mask = scene.layers[name].mask as FakeGraphics;
      expect(mask.commands).toEqual([
        { op: 'rect', args: [64, 64, 224, 256] },
        { op: 'fill', style: { color: '#ffffff', alpha: 1 } },
        { op: 'rect', args: [32, 288, 32, 32] },
        { op: 'fill', style: { color: '#ffffff', alpha: 1 } }
      ]);
    }
    expect(scene.getRenderedCell(0, 0)).toMatchObject({ position: { x: 64, y: 64 } });
    expect(scene.getRenderedCell(7, -1)).toMatchObject({ position: { x: 32, y: 288 } });
    scene.destroy();
  });

  test('ignores transaction generation when stable surface and stone resource identities are unchanged', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 8, baseCols: 8 });
    const frame = makeFrame({ topology });
    const textures = new Map<string, any>([
      ['board', { texture: { id: 'board-texture' } }],
      ['black-stone', { texture: { id: 'black-texture' } }]
    ]);
    const stableLanes = {
      surfaceTextureRevision: '[["board","board:stable"]]',
      stoneTextureRevision: '[["black-stone","black-stone:stable"]]'
    };

    scene.applyFrame(frame, { textures, textureRevision: 1, ...stableLanes });
    const generationOnly = scene.applyFrame(frame, { textures, textureRevision: 2, ...stableLanes });

    expect(generationOnly).toMatchObject({
      updatedCellViews: 0,
      updatedStoneViews: 0,
      updatedHintViews: 0,
      skippedViews: 64
    });
    expect(scene.getDiagnostics()).toMatchObject({
      boardSurfaceUpdateCount: 1,
      boardSurfaceSkippedCount: 1
    });

    expect(scene.applyFrame(frame, {
      textures,
      textureRevision: 3,
      surfaceTextureRevision: '[["board","board:next"]]',
      stoneTextureRevision: stableLanes.stoneTextureRevision
    })).toMatchObject({ updatedCellViews: 64, updatedStoneViews: 0 });
    expect(scene.applyFrame(frame, {
      textures,
      textureRevision: 4,
      surfaceTextureRevision: '[["board","board:next"]]',
      stoneTextureRevision: '[["black-stone","black-stone:next"]]'
    })).toMatchObject({ updatedCellViews: 0, updatedStoneViews: 0 });
  });

  test('keeps the single board texture on the base board and textures expansion cells separately', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({
      baseRows: 4,
      baseCols: 4,
      minRow: -1,
      maxRow: 3,
      minCol: 0,
      maxCol: 3
    });
    const cells = topology.existingKeys.map((key) => {
      const row = Number(key.split(',')[0]);
      return makeCell(key, {
        renderRow: row + topology.renderRowOffset,
        renderCol: Number(key.split(',')[1]) + topology.renderColOffset,
        expansionSide: row < 0 ? 'top' : null
      });
    });
    const boardTexture = { id: 'board-texture' };
    const frame = makeFrame({ topology, cells, cellSize: 32 });

    scene.applyFrame(frame, {
      textures: new Map([['board', { texture: boardTexture }]]),
      textureRevision: 1
    });

    expect(scene.layers.surface.children).toHaveLength(1);
    expect(scene.layers.surface.children[0]).toMatchObject({
      label: 'pixi-static-board-texture',
      visible: true
    });
    expect(scene.getRenderedCell(0, 0)?.cell.usesBoardTexture).toBe(false);
    expect(scene.getRenderedCell(-1, 0)?.cell.usesBoardTexture).toBe(true);
    expect(scene.getDiagnostics()).toMatchObject({
      boardTextureMode: 'single-surface',
      surfaceBoardTextureCount: 1,
      cellBoardTextureCount: 4
    });
  });

  test('hides 8x8 stars for base voids and only suppresses theory-number intersections', () => {
    const voidFixture = createFakeRuntime();
    const voidScene = BoardScene.createPixiBoardScene({ runtime: voidFixture.runtime });
    const voidKeys = rectangleKeys(0, 7, 0, 7).filter((key) => key !== '0,0');
    const voidTopology = makeTopology({ baseRows: 8, baseCols: 8, existingKeys: voidKeys });
    voidScene.applyFrame(makeFrame({ topology: voidTopology }));
    expect(voidScene.getDiagnostics().starPointCount).toBe(0);

    const theoryFixture = createFakeRuntime();
    const theoryScene = BoardScene.createPixiBoardScene({ runtime: theoryFixture.runtime });
    const topology = makeTopology({ baseRows: 8, baseCols: 8 });
    const cells = topology.existingKeys.map((key) => makeCell(key, {
      markers: key === '2,6'
        ? [{ kind: 'theory-number-cell', owner: null, value: true, data: { active: true } }]
        : []
    }));
    theoryScene.applyFrame(makeFrame({ topology, cells }));
    expect(theoryScene.getDiagnostics().starPointCount).toBe(3);
    expect(theoryScene.getDiagnostics()).toMatchObject({
      staticBakeCount: 1,
      staticAttachedObjectCount: 1
    });
  });

  test('rebakes only base-surface dependencies and reuses the retained texture', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 8, baseCols: 8 });
    const baseTheme = Theme.createBoardVisualThemeDescriptor({ revision: 1, surfaceColor: '#112233' });
    scene.applyFrame(makeFrame({ topology, theme: baseTheme }));
    const initialBakeCount = scene.getDiagnostics().staticBakeCount;

    scene.applyFrame(makeFrame({
      topology,
      theme: Object.freeze({ ...baseTheme, revision: 99, markerColor: '#abcdef' })
    }));
    expect(scene.getDiagnostics().staticBakeCount).toBe(initialBakeCount);

    scene.applyFrame(makeFrame({
      topology,
      theme: Object.freeze({ ...baseTheme, revision: 99, surfaceColor: '#445566' })
    }));
    expect(scene.getDiagnostics()).toMatchObject({
      staticBakeCount: initialBakeCount + 1,
      starPointCount: 4,
      staticTemporaryObjectCount: 0,
      staticTextureAllocationCount: 1,
      staticTextureReuseCount: 1
    });
  });

  test('updates a sparse cell marker without rebaking the base board', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 8, baseCols: 8 });
    const cells = topology.existingKeys.map((key) => makeCell(key, {
      markers: key === '1,1'
        ? [{ kind: 'board-bonus', owner: null, value: 12, data: {} }]
        : []
    }));
    scene.applyFrame(makeFrame({ topology, cells, modelRevision: 1 }));
    const initialBakeCount = scene.getDiagnostics().staticBakeCount;
    const changedCells = topology.existingKeys.map((key) => makeCell(key, {
      markers: key === '1,1'
        ? [{ kind: 'board-bonus', owner: null, value: 10, data: {} }]
        : []
    }));

    expect(scene.applyFrame(makeFrame({
      topology,
      cells: changedCells,
      modelRevision: 2
    }))).toMatchObject({
      updatedCellViews: 0,
      updatedMarkerViews: 1,
      updatedStoneViews: 0,
      updatedHintViews: 0,
      skippedViews: 63
    });
    expect(scene.getDiagnostics()).toMatchObject({
      staticBakeCount: initialBakeCount,
      activeCellMarkerViewCount: 1,
      activeStaticBaseViewCount: 64
    });
    expect(scene.getRenderedCell(1, 1)).toMatchObject({
      cell: {
        markerCount: 1,
        renderedMarkerKinds: ['board-bonus'],
        markerLabels: ['10']
      }
    });
  });

  test('updates only the view whose semantic or appearance dependency changed', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 8, baseCols: 8 });
    const firstFrame = makeFrame({ topology });
    scene.applyFrame(firstFrame);

    const changedCells = topology.existingKeys.map((key) => makeCell(key, {
      interaction: key === '4,4' ? { legal: true } : undefined
    }));
    const visualChanged = scene.applyFrame(makeFrame({ topology, cells: changedCells, modelRevision: 2 }));
    expect(visualChanged).toMatchObject({
      updatedViews: 1,
      updatedCellViews: 0,
      updatedStoneViews: 0,
      updatedHintViews: 1,
      skippedViews: 63
    });

    const themeChanged = scene.applyFrame(makeFrame({
      topology,
      cells: changedCells,
      modelRevision: 2,
      theme: Theme.createBoardVisualThemeDescriptor({ revision: 2, surfaceColor: '#123456' })
    }));
    expect(themeChanged).toMatchObject({
      updatedViews: 64,
      updatedCellViews: 64,
      updatedStoneViews: 0,
      updatedHintViews: 0,
      skippedViews: 0
    });

    const appearanceChanged = scene.applyFrame(makeFrame({
      topology,
      cells: changedCells,
      modelRevision: 2,
      appearanceRevision: 2,
      appearance: { boardImageUrl: 'https://example.test/board-next.png' },
      theme: Theme.createBoardVisualThemeDescriptor({ revision: 2, surfaceColor: '#123456' })
    }));
    expect(appearanceChanged).toMatchObject({
      updatedViews: 64,
      updatedCellViews: 64,
      updatedStoneViews: 0,
      updatedHintViews: 0
    });

    const stoneAppearanceChanged = scene.applyFrame(makeFrame({
      topology,
      cells: changedCells,
      modelRevision: 2,
      appearanceRevision: 3,
      appearance: {
        boardImageUrl: 'https://example.test/board-next.png',
        blackStoneImageUrl: 'https://example.test/black-next.png'
      },
      theme: Theme.createBoardVisualThemeDescriptor({ revision: 2, surfaceColor: '#123456' })
    }));
    expect(stoneAppearanceChanged).toMatchObject({
      updatedViews: 0,
      updatedCellViews: 0,
      updatedStoneViews: 0,
      updatedHintViews: 0
    });

    const layoutChanged = scene.applyFrame(makeFrame({
      topology,
      cells: changedCells,
      modelRevision: 2,
      appearanceRevision: 3,
      appearance: {
        boardImageUrl: 'https://example.test/board-next.png',
        blackStoneImageUrl: 'https://example.test/black-next.png'
      },
      layoutRevision: 2,
      orientation: 'rotated-180',
      theme: Theme.createBoardVisualThemeDescriptor({ revision: 2, surfaceColor: '#123456' })
    }));
    expect(layoutChanged).toMatchObject({
      updatedViews: 64,
      updatedCellViews: 64,
      updatedStoneViews: 0,
      updatedHintViews: 64
    });

    const identical = scene.applyFrame(makeFrame({
      topology,
      cells: changedCells,
      modelRevision: 99,
      appearanceRevision: 99,
      appearance: {
        boardImageUrl: 'https://example.test/board-next.png',
        blackStoneImageUrl: 'https://example.test/black-next.png'
      },
      layoutRevision: 99,
      orientation: 'rotated-180',
      theme: Theme.createBoardVisualThemeDescriptor({ revision: 99, surfaceColor: '#123456' })
    }));
    expect(identical).toMatchObject({
      updatedViews: 0,
      updatedCellViews: 0,
      updatedStoneViews: 0,
      updatedHintViews: 0,
      skippedViews: 64
    });
    expect(scene.getDiagnostics()).toMatchObject({ boardSurfaceSkippedCount: expect.any(Number) });
  });

  test('applies lock-only frame changes once at the interaction layer', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 8, baseCols: 8 });
    const cells = topology.existingKeys.map((key) => makeCell(key, {
      interaction: { legal: key === '2,3' || key === '3,2' }
    }));

    const initial = scene.applyFrame(makeFrame({ topology, cells, modelRevision: 1 }));
    expect(initial).toMatchObject({
      updatedCellViews: 64,
      updatedStoneViews: 0,
      hintPaintCount: 64,
      hintInputSyncCount: 64
    });

    const locked = scene.applyFrame(makeFrame({
      topology,
      cells,
      modelRevision: 2,
      overlay: { interactionLocked: true }
    }));
    expect(locked).toMatchObject({
      updatedCellViews: 0,
      updatedStoneViews: 0,
      updatedHintViews: 0,
      hintPaintCount: 0,
      hintInputSyncCount: 0,
      skippedViews: 64
    });
    expect(scene.layers.interaction).toMatchObject({ eventMode: 'none', hitArea: null });

    const unlocked = scene.applyFrame(makeFrame({
      topology,
      cells,
      modelRevision: 3,
      overlay: { interactionLocked: false }
    }));
    expect(unlocked).toMatchObject({
      updatedCellViews: 0,
      updatedStoneViews: 0,
      updatedHintViews: 0,
      hintPaintCount: 0,
      hintInputSyncCount: 0,
      skippedViews: 64
    });
    expect(scene.layers.interaction).toMatchObject({
      eventMode: 'static',
      hitArea: { width: 256, height: 256 }
    });
    expect(scene.getDiagnostics()).toMatchObject({
      cumulativeUpdatedCellViewCount: 64,
      cumulativeUpdatedStoneViewCount: 0,
      cumulativeUpdatedHintViewCount: 64,
      cumulativeHintPaintCount: 64,
      cumulativeHintInputSyncCount: 64
    });
  });

  test('partitions surface, stone, hint, and font theme dependencies', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 8, baseCols: 8 });
    const baseTheme = Theme.createBoardVisualThemeDescriptor({ revision: 1 });
    scene.applyFrame(makeFrame({ topology, theme: baseTheme }));

    const hintTheme = Object.freeze({
      ...baseTheme,
      revision: 2,
      legalHint: Object.freeze({ ...baseTheme.legalHint, ringColor: '#123456' })
    });
    expect(scene.applyFrame(makeFrame({ topology, theme: hintTheme }))).toMatchObject({
      updatedCellViews: 0,
      updatedStoneViews: 0,
      updatedHintViews: 64
    });

    const stoneTheme = Object.freeze({ ...hintTheme, revision: 3, hintColor: '#abcdef' });
    expect(scene.applyFrame(makeFrame({ topology, theme: stoneTheme }))).toMatchObject({
      updatedCellViews: 0,
      updatedStoneViews: 0,
      updatedHintViews: 0
    });

    const fontTheme = Object.freeze({ ...stoneTheme, revision: 4, fontReadyEpoch: stoneTheme.fontReadyEpoch + 1 });
    expect(scene.applyFrame(makeFrame({ topology, theme: fontTheme }))).toMatchObject({
      updatedCellViews: 0,
      updatedStoneViews: 0,
      updatedHintViews: 64
    });
  });

  test('keeps 8x8 initial and full-board display objects within the sparse budgets', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 8, baseCols: 8 });
    const initialCells = topology.existingKeys.map((key) => makeCell(key, {
      stone: ['3,3', '3,4', '4,3', '4,4'].includes(key)
        ? { owner: key === '3,3' || key === '4,4' ? 'white' : 'black', value: 1, specialType: null, status: {} }
        : null
    }));

    scene.applyFrame(makeFrame({ topology, cells: initialCells }));
    expect(scene.getDiagnostics()).toMatchObject({
      activeStoneViewCount: 4,
      staticAttachedObjectCount: 1,
      staticTemporaryObjectCount: 0
    });
    expect(scene.getDiagnostics().displayObjectCount).toBeLessThan(500);

    const fullCells = topology.existingKeys.map((key, index) => makeCell(key, {
      stone: { owner: index % 2 ? 'white' : 'black', value: 1, specialType: null, status: {} }
    }));
    scene.applyFrame(makeFrame({ topology, cells: fullCells, modelRevision: 2 }));
    expect(scene.getDiagnostics().activeStoneViewCount).toBe(64);
    expect(scene.getDiagnostics().displayObjectCount).toBeLessThan(1000);
  });

  test('bounds 16x16 materialization to visible + one overscan + two-cell gutter and reuses offscreen views', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 16, baseCols: 16 });
    const first = makeFrame({
      topology,
      visibleWindow: { minRow: 4, maxRow: 6, minCol: 4, maxCol: 6 }
    });
    const firstResult = scene.applyFrame(first);
    expect(firstResult).toMatchObject({
      materializedCount: 81,
      createdViews: 81,
      materializationWindow: { minRow: 1, maxRow: 9, minCol: 1, maxCol: 9 }
    });

    const second = makeFrame({
      topology,
      visibleWindow: { minRow: 9, maxRow: 11, minCol: 9, maxCol: 11 },
      layoutRevision: 2
    });
    const secondResult = scene.applyFrame(second);
    expect(secondResult).toMatchObject({
      materializedCount: 81,
      createdViews: 0,
      reusedViews: 65,
      releasedViews: 65,
      materializationWindow: { minRow: 6, maxRow: 14, minCol: 6, maxCol: 14 }
    });
    expect(scene.getDiagnostics()).toMatchObject({ activeViewCount: 81, createdViewCount: 81 });
    expect(scene.getRenderedCell(1, 1)).toBeNull();

    scene.reset();
    expect(scene.getDiagnostics()).toMatchObject({ activeViewCount: 0, pooledViewCount: 81 });
    expect(scene.layers.interaction).toMatchObject({ eventMode: 'none', hitArea: null });
    const reapplied = scene.applyFrame(first);
    expect(reapplied).toMatchObject({ createdViews: 0, reusedViews: 81 });
    expect(scene.layers.interaction).toMatchObject({ eventMode: 'static' });

    scene.destroy();
    scene.destroy();
    expect(fixture.stage.children).toEqual([]);
    expect(scene.getDiagnostics()).toMatchObject({
      destroyed: true,
      activeViewCount: 0,
      pooledViewCount: 0,
      destroyedViewCount: 81,
      displayObjectCount: 0
    });
    expect(() => scene.applyFrame(first)).toThrow('destroyed');
  });

  test.each([
    [4, 4],
    [4, 16],
    [16, 4],
    [16, 16]
  ])('materializes a bounded %ix%i rectangle', (rows, cols) => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: rows, baseCols: cols });
    const result = scene.applyFrame(makeFrame({ topology }));
    expect(result.materializedCount).toBe(rows * cols);
    expect(scene.getDiagnostics().activeViewCount).toBeLessThanOrEqual(256);
    scene.destroy();
  });

  test('keeps explicit holes, derives ephemeral circle voids, and rotates negative world coordinates', () => {
    const circleFixture = createFakeRuntime();
    const circleScene = BoardScene.createPixiBoardScene({ runtime: circleFixture.runtime });
    const circleKeys: string[] = [];
    for (let row = 0; row < 6; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        const dr = row - 2.5;
        const dc = col - 2.5;
        if (dr * dr + dc * dc <= 9) circleKeys.push(`${row},${col}`);
      }
    }
    const circleTopology = makeTopology({
      baseRows: 6,
      baseCols: 6,
      existingKeys: circleKeys,
      holeKeys: ['2,2']
    });
    circleScene.applyFrame(makeFrame({ topology: circleTopology }), {
      textures: new Map([['board', { texture: { id: 'circle-board-texture' } }]])
    });
    expect(circleScene.getDiagnostics()).toMatchObject({
      activeViewCount: 36,
      ephemeralVoidCount: 4,
      holeCount: 1,
      boardTextureMode: 'per-cell',
      surfaceBoardTextureCount: 0,
      cellBoardTextureCount: 31
    });
    expect(circleScene.getRenderedCell(0, 0)).toMatchObject({
      kind: 'void',
      cell: { usesBoardTexture: false }
    });
    expect(circleScene.getRenderedCell(2, 2)).toMatchObject({
      kind: 'hole',
      cell: { usesBoardTexture: false }
    });

    const rotatedFixture = createFakeRuntime();
    const rotatedScene = BoardScene.createPixiBoardScene({ runtime: rotatedFixture.runtime });
    const negativeTopology = makeTopology({
      baseRows: 4,
      baseCols: 4,
      minRow: -1,
      maxRow: 2,
      minCol: -2,
      maxCol: 1,
      holeKeys: ['0,0']
    });
    rotatedScene.applyFrame(makeFrame({
      topology: negativeTopology,
      orientation: 'rotated-180',
      cellSize: 32
    }));
    expect(rotatedScene.getRenderedCell(-1, -2)).toMatchObject({
      kind: 'playable',
      position: { x: 160, y: 160 }
    });
    expect(rotatedScene.getRenderedCell(0, 0)?.kind).toBe('hole');
  });

  test('scene/view sources create no DOM or canvas and contain no gameplay legality resolver', () => {
    const rootDir = path.resolve(__dirname, '../..');
    for (const relative of [
      'ui/pixi/cell-view.ts',
      'ui/pixi/stone-view.ts',
      'ui/pixi/hint-view.ts',
      'ui/pixi/board-scene.ts'
    ]) {
      const source = fs.readFileSync(path.join(rootDir, relative), 'utf8');
      expect(source).not.toMatch(/document\.createElement|createElement\(['"]canvas|new HTMLCanvasElement/);
      expect(source).not.toMatch(/getLegalMoves|resolveLegal|isLegalMove|NetworkMatchClient|canonicalRng|Math\.random/);
    }
  });
});
