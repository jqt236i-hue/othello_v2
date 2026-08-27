import * as BoardScene from '../../ui/pixi/board-scene';
import * as CellView from '../../ui/pixi/cell-view';
import * as StoneView from '../../ui/pixi/stone-view';
import * as HintView from '../../ui/pixi/hint-view';
import {
  FakeDisplayObject,
  FakeContainer,
  FakeGraphics,
  createFakeRuntime,
  makeCell,
  makeTopology,
  makeFrame,
  materializedCell,
  viewContext
} from '../helpers/pixi-board-scene-fixtures';

describe('Pixi static retained views', () => {
  test('routes cell markers and stone markers to one visual owner without duplicates', () => {
    const fixture = createFakeRuntime();
    const cellView = CellView.createPixiCellView(fixture.runtime);
    const stoneView = StoneView.createPixiStoneView(fixture.runtime);
    const markers = [
      { kind: 'special', owner: 'black', value: null, data: { type: 'ZOMBIE' } },
      { kind: 'guard', owner: 'black', value: null, data: { remainingOwnerTurns: 4 } },
      { kind: 'breeding-sprout', owner: 'black', value: true, data: { active: true } },
      { kind: 'board-bonus', owner: null, value: 12, data: {} },
      { kind: 'theory-number-cell', owner: null, value: true, data: { active: true } },
      { kind: 'poison-cell', owner: null, value: null, data: { remainingTurns: 3 } }
    ];
    const raw = makeCell('1,1', {
      stone: {
        owner: 'black',
        value: 1,
        specialType: 'ZOMBIE',
        status: { remainingOwnerTurns: 10, regenRemaining: 2 }
      },
      markers
    });
    const cell = materializedCell(raw);
    const blackTexture = { id: 'black-texture' };
    const context = viewContext({
      textures: new Map([['special-stone:ZOMBIE:black', { texture: blackTexture }]])
    });

    expect(cellView.update(cell, context)).toBe(true);
    expect(stoneView.update(cell, context)).toBe(true);
    expect(cellView.update(cell, context)).toBe(false);
    expect(stoneView.update(cell, context)).toBe(false);

    expect(cellView.getDiagnostics()).toMatchObject({
      markerCount: 2,
      renderedMarkerKinds: ['board-bonus', 'poison-cell'],
      markerLabels: ['12', '3'],
      theoryNumberStyle: true
    });
    const poisonSurface = cellView.surfaceRoot.children.find((child: any) => (
      child.label === 'pixi-cell-poison-surface'
    ));
    expect(poisonSurface).toMatchObject({ visible: true });
    expect(poisonSurface.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({ op: 'fill', style: expect.objectContaining({ color: '#6b2b91' }) })
    ]));
    const poisonCorner = cellView.markerRoot.children.find((child: any) => (
      child.label === 'pixi-marker-poison-cell-corner'
    ));
    expect(poisonCorner).toBeDefined();
    expect(poisonCorner.commands.some((command: any) => command.op === 'rect')).toBe(true);
    expect(poisonCorner.commands.some((command: any) => command.op === 'moveTo')).toBe(false);
    expect(poisonCorner.commands.some((command: any) => command.op === 'stroke')).toBe(false);
    expect(stoneView.getDiagnostics()).toMatchObject({
      owner: 'black',
      specialType: 'ZOMBIE',
      timerLabel: '10',
      badgeLabel: '2',
      statusLabels: [
        { kind: 'countdown', value: '10' },
        { kind: 'regen', value: '2' },
        { kind: 'guard', value: '4' }
      ],
      textureBacked: true,
      texturePurpose: 'special-stone:ZOMBIE:black',
      renderedMarkerKinds: ['special', 'guard', 'breeding-sprout']
    });
    const overlap = cellView.getDiagnostics().renderedMarkerKinds.filter((kind) => (
      stoneView.getDiagnostics().renderedMarkerKinds.includes(kind)
    ));
    expect(overlap).toEqual([]);
  });

  test('layers the caster-owned freeze image over an opponent special stone without replacing its own image', () => {
    const fixture = createFakeRuntime();
    const stoneView = StoneView.createPixiStoneView(fixture.runtime);
    const workTexture = { id: 'work-texture' };
    const freezeTexture = { id: 'freeze-texture' };
    const cell = materializedCell(makeCell('2,2', {
      stone: {
        owner: 'white',
        value: -1,
        specialType: 'WORK',
        status: { remainingOwnerTurns: 4 }
      },
      markers: [
        { kind: 'special', owner: 'white', value: null, data: { type: 'WORK', remainingOwnerTurns: 4 } },
        { kind: 'frozen', owner: 'black', value: null, data: { type: 'FREEZE', remainingOwnerTurns: 5 } }
      ]
    }));
    const textures = new Map([
      ['special-stone:WORK:white', { texture: workTexture }],
      ['special-stone:FREEZE:black', { texture: freezeTexture }]
    ]);

    expect(stoneView.update(cell, viewContext({ textures }))).toBe(true);

    const stoneSprite = stoneView.root.children.find((child: any) => child.label === 'pixi-stone-texture');
    const freezeOverlay = stoneView.root.children.find((child: any) => child.label === 'pixi-stone-marker-overlay');
    expect(stoneView.getDiagnostics()).toMatchObject({
      visible: true,
      specialType: 'WORK',
      textureBacked: true,
      texturePurpose: 'special-stone:WORK:white',
      renderedMarkerKinds: ['special', 'frozen'],
      statusLabels: expect.arrayContaining([{ kind: 'freeze', value: '5' }])
    });
    expect(stoneSprite).toMatchObject({ visible: true, texture: workTexture });
    expect(freezeOverlay).toMatchObject({
      visible: true,
      texture: freezeTexture,
      alpha: 0.62,
      width: 32,
      height: 32
    });
  });

  test('moves a retained stone without rebuilding its static visual', () => {
    const fixture = createFakeRuntime();
    const stoneView = StoneView.createPixiStoneView(fixture.runtime);
    const cell = materializedCell(makeCell('1,1', {
      stone: { owner: 'black', value: 1, specialType: null, status: {} }
    }));
    const initial = viewContext({ sceneX: 32, sceneY: 48 });
    const moved = viewContext({ sceneX: 96, sceneY: 112 });

    expect(stoneView.update(cell, initial)).toBe(true);
    const afterPaint = stoneView.getDiagnostics();
    expect(stoneView.update(cell, moved)).toBe(false);

    expect(stoneView.getDiagnostics()).toMatchObject({
      staticPrepareCount: afterPaint.staticPrepareCount,
      transformApplyCount: afterPaint.transformApplyCount + 1,
      position: { x: 96, y: 112 }
    });
  });

  test('renders Shinra Bansho God as one 2x2 anchor sprite and hides member stone bodies', () => {
    const fixture = createFakeRuntime();
    const anchorView = StoneView.createPixiStoneView(fixture.runtime);
    const memberView = StoneView.createPixiStoneView(fixture.runtime);
    const texture = { id: 'shinra-black' };
    const textures = new Map([
      ['special-stone:SHINRA_BANSHO_GOD:black', { texture }]
    ]);
    const makeShinra = (key: string, rowOffset: number, colOffset: number) => materializedCell(makeCell(key, {
      stone: {
        owner: 'black',
        value: 1,
        specialType: 'SHINRA_BANSHO_GOD',
        status: {
          special: {
            type: 'SHINRA_BANSHO_GOD',
            anchorRow: 2,
            anchorCol: 2,
            footprintRows: 2,
            footprintCols: 2,
            footprintRowOffset: rowOffset,
            footprintColOffset: colOffset
          }
        }
      },
      markers: [{
        kind: 'special',
        owner: 'black',
        value: null,
        data: {
          type: 'SHINRA_BANSHO_GOD',
          footprintRowOffset: rowOffset,
          footprintColOffset: colOffset
        }
      }]
    }));

    anchorView.update(makeShinra('2,2', 0, 0), viewContext({ textures }));
    memberView.update(makeShinra('2,3', 0, 1), viewContext({
      textures,
      sceneX: 128,
      stoneRevisionSignature: 'static-stone:shinra-member'
    }));

    const anchorSprite = anchorView.root.children.find((child: any) => child.label === 'pixi-stone-texture');
    const anchorAura = anchorView.root.children.find((child: any) => child.label === 'pixi-stone-aura') as FakeGraphics;
    expect(anchorView.getDiagnostics()).toMatchObject({
      visible: true,
      specialType: 'SHINRA_BANSHO_GOD',
      textureBacked: true,
      texturePurpose: 'special-stone:SHINRA_BANSHO_GOD:black',
      flipProtectionBadgeVisible: false
    });
    expect(anchorSprite).toMatchObject({
      texture,
      width: 60,
      height: 60,
      position: { x: 32, y: 32 }
    });
    expect(anchorAura.commands.filter((command) => command.op === 'fill').map((command) => command.style?.color))
      .toEqual(['#ff6a3d', '#5ed9ff', '#65df87', '#f3cf54', '#c7a2ff']);
    expect(anchorAura.commands.some((command) => (
      command.op === 'stroke' && command.style?.color === '#a9b8ff'
    ))).toBe(true);
    expect(memberView.getDiagnostics()).toMatchObject({
      visible: false,
      specialType: 'SHINRA_BANSHO_GOD',
      textureBacked: false
    });
  });

  test('renders a red scorched surface with its turn count in the top-left corner', () => {
    const fixture = createFakeRuntime();
    const cellView = CellView.createPixiCellView(fixture.runtime);
    const cell = materializedCell(makeCell('2,2', {
      markers: [
        { kind: 'scorched-cell', owner: null, value: null, data: { remainingTurns: 10 } }
      ]
    }));

    cellView.update(cell, viewContext());

    expect(cellView.getDiagnostics()).toMatchObject({
      renderedMarkerKinds: ['scorched-cell'],
      markerLabels: ['10']
    });
    const surface = cellView.surfaceRoot.children.find((child: any) => (
      child.label === 'pixi-cell-scorched-surface'
    ));
    expect(surface).toMatchObject({ visible: true });
    expect(surface.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({ op: 'fill', style: expect.objectContaining({ color: '#a71d0b' }) })
    ]));
    expect(cellView.markerRoot.children.find((child: any) => (
      child.label === 'pixi-marker-scorched-cell-corner'
    ))).toBeDefined();
  });

  test('renders a blue healing surface with its turn count in the top-left corner', () => {
    const fixture = createFakeRuntime();
    const cellView = CellView.createPixiCellView(fixture.runtime);
    const cell = materializedCell(makeCell('2,2', {
      markers: [
        { kind: 'healing-cell', owner: null, value: null, data: { remainingTurns: 8 } }
      ]
    }));

    cellView.update(cell, viewContext());

    expect(cellView.getDiagnostics()).toMatchObject({
      renderedMarkerKinds: ['healing-cell'],
      markerLabels: ['8']
    });
    const surface = cellView.surfaceRoot.children.find((child: any) => (
      child.label === 'pixi-cell-healing-surface'
    ));
    expect(surface).toMatchObject({ visible: true });
    expect(surface.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({ op: 'fill', style: expect.objectContaining({ color: '#0b4f9f' }) })
    ]));
    expect(cellView.markerRoot.children.find((child: any) => (
      child.label === 'pixi-marker-healing-cell-corner'
    ))).toBeDefined();
  });

  test('renders legal/target/preview/keyboard/direction DTOs without deriving authority', () => {
    const fixture = createFakeRuntime();
    const hintView = HintView.createPixiHintView(fixture.runtime);
    const cell = materializedCell(makeCell('2,3', {
      interaction: {
        legal: true,
        legalFree: true,
        selectable: true,
        selected: true,
        hovered: true,
        keyboardCursor: true,
        previewKinds: ['random-spawn'],
        selectionKinds: ['enemy-target'],
        directionHints: [
          { id: 'up-left', kind: 'board-expansion-will', directionKey: 'up-left' },
          { id: 'right', kind: 'board-shrink-will', directionKey: 'right' }
        ],
        directionHintIds: ['up-left', 'right']
      }
    }));
    const context = viewContext();

    expect(hintView.update(cell, context)).toBe(true);
    expect(hintView.update(cell, context)).toBe(false);
    expect(hintView.getDiagnostics()).toMatchObject({
      updateCount: 1,
      hintPaintCount: 1,
      hintInputSyncCount: 1,
      legal: true,
      selectable: true,
      selected: true,
      hovered: true,
      keyboardCursor: true,
      previewKinds: ['random-spawn'],
      selectionKinds: ['enemy-target'],
      directionKeys: ['up-left', 'right'],
      interactionLocked: false
    });
    expect(hintView.root).toBeInstanceOf(FakeContainer);
    expect(hintView.root.children.map((child: FakeDisplayObject) => child.label)).toEqual([
      'pixi-hint-foreground',
      'pixi-direction-hint:up-left',
      'pixi-direction-hint:right'
    ]);
    expect(hintView.interactionRoot.eventMode).toBe('static');
    expect(hintView.interactionRoot.cursor).toBe('pointer');
    expect(hintView.interactionRoot.position).toMatchObject({ x: 32, y: 64 });
    expect(hintView.interactionRoot.hitArea).toMatchObject({ x: 0, y: 0, width: 32, height: 32 });
    expect(hintView.interactionRoot.hitArea.contains(0, 0)).toBe(true);
    expect(hintView.interactionRoot.hitArea.contains(31.99, 31.99)).toBe(true);
    expect(hintView.interactionRoot.hitArea.contains(32, 16)).toBe(false);
  });

  test('keeps lock-only state out of retained input geometry', () => {
    const fixture = createFakeRuntime();
    const hintView = HintView.createPixiHintView(fixture.runtime);
    const unlocked = materializedCell(makeCell('2,3', {
      interaction: { legal: true, hovered: true }
    }));
    const locked = materializedCell(makeCell('2,3', {
      interaction: { legal: true, hovered: true, interactionLocked: true }
    }));
    const context = viewContext();

    expect(hintView.updateDetailed(unlocked, context)).toEqual({
      changed: true,
      painted: true,
      inputSynced: true
    });
    const foreground = hintView.root.children.find((child: FakeDisplayObject) => (
      child.label === 'pixi-hint-foreground'
    )) as FakeGraphics;
    const paintedCommands = foreground.commands.slice();
    const surfaceCommands = (hintView.surfaceRoot as FakeGraphics).commands.slice();

    expect(hintView.updateDetailed(locked, context)).toEqual({
      changed: false,
      painted: false,
      inputSynced: false
    });
    expect(foreground.commands).toEqual(paintedCommands);
    expect((hintView.surfaceRoot as FakeGraphics).commands).toEqual(surfaceCommands);
    expect(hintView.interactionRoot).toMatchObject({
      eventMode: 'static',
      cursor: 'pointer'
    });
    expect(hintView.getDiagnostics()).toMatchObject({
      updateCount: 1,
      hintPaintCount: 1,
      hintInputSyncCount: 1,
      interactionLocked: true
    });
  });

  test('renders the network pending placement as an owner-colored provisional stone', () => {
    const fixture = createFakeRuntime();
    const hintView = HintView.createPixiHintView(fixture.runtime);
    const cell = materializedCell(makeCell('2,3', {
      interaction: {
        previewKinds: ['network-pending-placement'],
        networkPendingPlacementOwner: 'black'
      }
    }));

    expect(hintView.update(cell, viewContext())).toBe(true);
    const foreground = hintView.root.children.find((child: FakeDisplayObject) => (
      child.label === 'pixi-hint-foreground'
    )) as FakeGraphics;
    expect(foreground.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({ op: 'fill', style: expect.objectContaining({ color: '#141820' }) })
    ]));
  });

  test('keeps selectable-stone surface tint behind the stone while retaining foreground cues', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 8, baseCols: 8 });
    const cells = topology.existingKeys.map((key) => makeCell(key));
    const target = cells.find((cell) => cell.key === '2,2')!;
    target.stone = { owner: 'black', value: 1, specialType: null, status: {} };
    target.interaction = {
      ...target.interaction,
      selectable: true,
      hovered: true,
      selectionKinds: ['friendly']
    };

    scene.applyFrame(makeFrame({ topology, cells }));
    const targetPosition = scene.getRenderedCell(2, 2)!.position;

    const surface = scene.layers.cell.children.find((child: FakeDisplayObject) => (
      child.label === 'pixi-cell-hint-surface'
      && child.position.x === targetPosition.x
      && child.position.y === targetPosition.y
    )) as FakeGraphics;
    const foregroundRoot = scene.layers.hint.children.find((child: FakeDisplayObject) => (
      child.label === 'pixi-hint-view'
      && child.position.x === targetPosition.x
      && child.position.y === targetPosition.y
    )) as FakeDisplayObject;
    const foreground = foregroundRoot.children.find((child: FakeDisplayObject) => (
      child.label === 'pixi-hint-foreground'
    )) as FakeGraphics;
    expect(surface.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({
        op: 'fill',
        style: expect.objectContaining({ color: '#0e7e6f', alpha: 0.38 })
      })
    ]));
    expect(scene.layers.stone.children).toHaveLength(1);
    expect(scene.root.children.indexOf(scene.layers.cell)).toBeLessThan(
      scene.root.children.indexOf(scene.layers.stone)
    );
    expect(scene.root.children.indexOf(scene.layers.stone)).toBeLessThan(
      scene.root.children.indexOf(scene.layers.hint)
    );
    expect(foreground.commands.some((command) => command.op === 'fill')).toBe(false);
  });

  test('gives Pixi hit ownership only to selectable holes and clears reset views', () => {
    const fixture = createFakeRuntime();
    const hintView = HintView.createPixiHintView(fixture.runtime);
    const inertHole = materializedCell(makeCell('2,3', { kind: 'hole' }));

    hintView.update(inertHole, viewContext());
    expect(hintView.interactionRoot).toMatchObject({ eventMode: 'none', hitArea: null });

    const selectableHole = materializedCell(makeCell('2,3', {
      kind: 'hole',
      interaction: { selectable: true }
    }));
    hintView.update(selectableHole, viewContext({ interactionRevisionSignature: 'static-interaction:hole-target' }));
    expect(hintView.interactionRoot).toMatchObject({ eventMode: 'static' });
    expect(hintView.interactionRoot.hitArea).not.toBeNull();

    const playable = materializedCell(makeCell('2,3', { interaction: { legal: true } }));
    hintView.update(playable, viewContext({ interactionRevisionSignature: 'static-interaction:playable' }));
    expect(hintView.interactionRoot).toMatchObject({ eventMode: 'static' });

    hintView.reset();
    expect(hintView.interactionRoot).toMatchObject({ eventMode: 'none', hitArea: null });
  });

  test('shows procedural normal/special fallbacks and keeps breeding sprouts as normal-stone overlays', () => {
    const fixture = createFakeRuntime();
    const stoneView = StoneView.createPixiStoneView(fixture.runtime);
    const plain = materializedCell(makeCell('0,0', {
      stone: { owner: 'black', value: 1, specialType: null, status: {} }
    }));
    stoneView.update(plain, viewContext());
    expect((stoneView.root.children.find((child: any) => (
      child.label === 'pixi-stone-shadow'
    )) as FakeGraphics).commands.filter((command) => command.op === 'ellipse')).toHaveLength(12);

    const normal = materializedCell(makeCell('0,0', {
      stone: { owner: 'white', value: -1, specialType: 'GUARD', status: { remainingOwnerTurns: 12 } }
    }));

    stoneView.update(normal, viewContext({ stoneRevisionSignature: 'static-stone:2' }));
    expect(stoneView.getDiagnostics()).toMatchObject({
      visible: true,
      owner: 'white',
      specialType: 'GUARD',
      timerLabel: '12',
      flipProtectionBadgeVisible: true,
      textureBacked: false
    });
    expect(stoneView.root.children.find((child: any) => (
      child.label === 'pixi-stone-flip-protection-badge'
    ))).toMatchObject({
      visible: true,
      text: '反',
      position: { x: 24, y: 17 }
    });
    expect(stoneView.root.children.find((child: any) => (
      child.label === 'pixi-stone-special-badge'
    ))).toMatchObject({ visible: false });

    const whiteTexture = { id: 'white-stone-texture' };
    const breedingTexture = { id: 'breeding-stone-texture' };
    const sproutTextures = new Map([
      ['white-stone', { texture: whiteTexture }],
      ['special-stone:BREEDING:white', { texture: breedingTexture }]
    ]);
    const sprout = materializedCell(makeCell('0,1', {
      stone: { owner: 'white', value: -1, specialType: null, status: {} },
      markers: [{ kind: 'breeding-sprout', owner: null, value: true, data: { active: true, type: 'BREEDING' } }]
    }));
    stoneView.update(sprout, viewContext({
      stoneRevisionSignature: 'static-stone:3',
      textures: sproutTextures
    }));
    expect(stoneView.getDiagnostics()).toMatchObject({
      visible: true,
      specialType: null,
      textureBacked: true,
      texturePurpose: 'white-stone',
      renderedMarkerKinds: ['breeding-sprout']
    });
    expect(stoneView.root.children.find((child: any) => (
      child.label === 'pixi-stone-texture'
    ))).toMatchObject({ texture: whiteTexture });
    const sproutOverlay = stoneView.root.children.find((child: any) => (
      child.label === 'pixi-stone-special-ring'
    )) as FakeGraphics;
    expect(sproutOverlay.commands.filter((command) => command.op === 'lineTo')).toHaveLength(1);
    expect(sproutOverlay.commands.filter((command) => command.op === 'circle')).toHaveLength(2);

    const breedingAnchor = materializedCell(makeCell('0,2', {
      stone: { owner: 'white', value: -1, specialType: 'BREEDING', status: { remainingOwnerTurns: 5 } },
      markers: [{
        kind: 'special', owner: 'white', value: null,
        data: { type: 'BREEDING', remainingOwnerTurns: 5 }
      }]
    }));
    stoneView.update(breedingAnchor, viewContext({
      stoneRevisionSignature: 'static-stone:4',
      textures: sproutTextures
    }));
    expect(stoneView.getDiagnostics()).toMatchObject({
      visible: true,
      specialType: 'BREEDING',
      timerLabel: '5',
      textureBacked: true,
      texturePurpose: 'special-stone:BREEDING:white',
      renderedMarkerKinds: ['special']
    });
    expect(stoneView.root.children.find((child: any) => (
      child.label === 'pixi-stone-texture'
    ))).toMatchObject({ texture: breedingTexture });

    const orphanSprout = materializedCell(makeCell('0,3', {
      markers: [{ kind: 'breeding-sprout', owner: 'white', value: true, data: { active: true } }]
    }));
    stoneView.update(orphanSprout, viewContext({ stoneRevisionSignature: 'static-stone:5' }));
    expect(stoneView.getDiagnostics()).toMatchObject({
      visible: false,
      specialType: null,
      textureBacked: false,
      renderedMarkerKinds: ['breeding-sprout']
    });

    const seedView = CellView.createPixiCellView(fixture.runtime);
    const seedTexture = { id: 'seed-texture' };
    const seed = materializedCell(makeCell('0,4', {
      markers: [{ kind: 'seed', owner: 'white', value: null, data: { remainingOwnerTurns: 2 } }]
    }));
    seedView.update(seed, viewContext({
      stoneRevisionSignature: 'static-stone:6',
      textures: new Map([['special-stone:SEED:white', { texture: seedTexture }]])
    }));
    expect(seedView.getDiagnostics()).toMatchObject({
      markerCount: 1,
      markerLabels: ['2'],
      renderedMarkerKinds: ['seed']
    });
    expect(seedView.markerRoot.children.find((child: any) => (
      child.label === 'pixi-marker-seed-texture'
    ))).toMatchObject({
      texture: seedTexture,
      visible: true,
      width: 28.8,
      height: 28.8,
      rotation: 0
    });
    expect(seedView.markerRoot.children.find((child: any) => (
      child.label === 'pixi-marker-label:seed'
    ))).toMatchObject({ text: '2' });

    const fallbackSeedView = CellView.createPixiCellView(fixture.runtime);
    fallbackSeedView.update(seed, viewContext({
      stoneRevisionSignature: 'static-stone:seed-fallback',
      textures: new Map([['special-stone:SEED:white', {
        texture: { id: 'generic-fallback-texture' },
        sourceKind: 'procedural',
        usedFallback: true
      }]])
    }));
    expect(fallbackSeedView.markerRoot.children.some((child: any) => (
      child.label === 'pixi-marker-seed-texture'
    ))).toBe(false);
    expect(fallbackSeedView.markerRoot.children.find((child: any) => (
      child.label === 'pixi-marker-seed-fallback'
    ))).toBeDefined();
  });

  test('keeps simultaneous stone status labels in deterministic slots and order', () => {
    const fixture = createFakeRuntime();
    const stoneView = StoneView.createPixiStoneView(fixture.runtime);
    const cell = materializedCell(makeCell('3,4', {
      stone: {
        owner: 'black',
        value: 1,
        specialType: 'ZOMBIE',
        status: {
          remainingOwnerTurns: 12,
          regenRemaining: 11,
          flipEvadeRemaining: 10,
          destroyEvadeRemaining: 9
        }
      },
      markers: [
        { kind: 'special', owner: 'black', value: null, data: { type: 'ZOMBIE' } },
        { kind: 'bomb', owner: 'black', value: null, data: { remainingOwnerTurns: 8 } },
        { kind: 'guard', owner: 'black', value: null, data: { remainingTurns: 7 } },
        { kind: 'poisoned', owner: 'black', value: null, data: { countdown: 6 } },
        { kind: 'scorched', owner: 'black', value: null, data: { countdown: 3 } },
        { kind: 'breeding-sprout', owner: 'black', value: true, data: { count: 5 } }
      ]
    }));

    stoneView.update(cell, viewContext());

    expect(stoneView.getDiagnostics().statusLabels).toEqual([
      { kind: 'countdown', value: '12' },
      { kind: 'regen', value: '11' },
      { kind: 'flip-evade', value: '10' },
      { kind: 'destroy-evade', value: '9' },
      { kind: 'bomb', value: '8' },
      { kind: 'guard', value: '7' },
      { kind: 'poison', value: '6' },
      { kind: 'scorch', value: '3' }
    ]);
    expect(stoneView.root.children.find((child: any) => (
      child.label === 'pixi-stone-status-labels'
    )).children.map((child: any) => child.label)).toEqual([
      'pixi-stone-status:countdown',
      'pixi-stone-status:regen',
      'pixi-stone-status:flip-evade',
      'pixi-stone-status:destroy-evade',
      'pixi-stone-status:bomb',
      'pixi-stone-status:guard',
      'pixi-stone-status:poison',
      'pixi-stone-status:scorch'
    ]);
  });

  test('renders canonical countdown, protection, regen, evasion, and poison marker shapes in fixed slots', () => {
    const fixture = createFakeRuntime();
    const stoneView = StoneView.createPixiStoneView(fixture.runtime);
    let revision = 0;
    const update = (cell: ReturnType<typeof materializedCell>) => {
      revision += 1;
      stoneView.update(cell, viewContext({ stoneRevisionSignature: `marker-contract:${revision}` }));
    };
    const statusText = (kind: string) => stoneView.root.children.find((child: any) => (
      child.label === 'pixi-stone-status-labels'
    )).children.find((child: any) => child.label === `pixi-stone-status:${kind}`);
    const fillColors = () => (stoneView.root.children.find((child: any) => (
      child.label === 'pixi-stone-special-ring'
    )) as FakeGraphics).commands
      .filter((command) => command.op === 'fill')
      .map((command) => command.style?.color);

    update(materializedCell(makeCell('1,1', {
      stone: { owner: 'black', value: 1, specialType: 'REGEN', status: { regenRemaining: 3 } },
      markers: [{
        kind: 'special', owner: 'black', value: null, data: { type: 'REGEN', regenRemaining: 3 }
      }]
    })));
    expect(stoneView.getDiagnostics().statusLabels).toEqual([{ kind: 'regen', value: '3' }]);
    expect(statusText('regen').position.x).toBeCloseTo(4.48);
    expect(statusText('regen').position.y).toBeCloseTo(16);
    expect(fillColors()).toContain('#ff3f98');

    update(materializedCell(makeCell('1,2', {
      stone: {
        owner: 'white', value: -1, specialType: 'ZOMBIE',
        status: { remainingOwnerTurns: 3, regenRemaining: 1 }
      },
      markers: [{
        kind: 'special', owner: 'white', value: null,
        data: { type: 'ZOMBIE', remainingOwnerTurns: 3, regenRemaining: 1 }
      }]
    })));
    expect(stoneView.getDiagnostics().statusLabels).toEqual([
      { kind: 'countdown', value: '3' },
      { kind: 'regen', value: '1' }
    ]);
    expect(statusText('countdown').position).toMatchObject({ x: 17, y: 27.2 });
    expect(fillColors()).toEqual(expect.arrayContaining(['#ac1c1c', '#8739d6']));

    update(materializedCell(makeCell('1,3', {
      stone: { owner: 'black', value: 1, specialType: 'TIME_STOP', status: { remainingOwnerTurns: 12 } },
      markers: [{
        kind: 'special', owner: 'black', value: null, data: { type: 'TIME_STOP', remainingOwnerTurns: 12 }
      }]
    })));
    expect(stoneView.getDiagnostics().statusLabels).toEqual([{ kind: 'countdown', value: '12' }]);
    expect(fillColors()).toContain('#ac1c1c');

    update(materializedCell(makeCell('2,1', {
      stone: {
        owner: 'black', value: 1, specialType: 'AFTERIMAGE_WILL',
        status: { remainingOwnerTurns: 6, flipEvadeRemaining: 10, destroyEvadeRemaining: 9 }
      },
      markers: [{
        kind: 'special', owner: 'black', value: null,
        data: {
          type: 'AFTERIMAGE_WILL', remainingOwnerTurns: 6,
          flipEvadeRemaining: 10, destroyEvadeRemaining: 9
        }
      }]
    })));
    expect(statusText('flip-evade').position.x).toBeCloseTo(27.52);
    expect(statusText('flip-evade').position.y).toBeCloseTo(4.48);
    expect(statusText('destroy-evade').position.x).toBeCloseTo(4.48);
    expect(statusText('destroy-evade').position.y).toBeCloseTo(27.52);
    expect(fillColors()).toEqual(expect.arrayContaining(['#5e3a86', '#972828']));

    update(materializedCell(makeCell('2,2', {
      stone: { owner: 'white', value: -1, specialType: 'GUARD', status: {} },
      markers: [{ kind: 'guard', owner: 'white', value: null, data: { remainingOwnerTurns: 4 } }]
    })));
    expect(stoneView.getDiagnostics()).toMatchObject({
      statusLabels: [{ kind: 'guard', value: '4' }],
      flipProtectionBadgeVisible: true
    });
    expect(statusText('guard').position).toMatchObject({ x: 17, y: 7 });
    expect(fillColors()).toContain('#244f8a');

    update(materializedCell(makeCell('2,3', {
      stone: { owner: 'black', value: 1, specialType: 'POISONED', status: {} },
      markers: [{ kind: 'poisoned', owner: 'black', value: null, data: { countdown: 5 } }]
    })));
    expect(stoneView.getDiagnostics().statusLabels).toEqual([{ kind: 'poison', value: '5' }]);
    expect(statusText('poison').position.x).toBeCloseTo(16);
    expect(statusText('poison').position.y).toBeCloseTo(16);
    expect(fillColors()).toContain('#6b2b91');
    const poisonSpecialBadge = stoneView.root.children.find((child: FakeDisplayObject) => (
      child.label === 'pixi-stone-special-badge'
    ));
    expect(poisonSpecialBadge).toMatchObject({ visible: false });

    update(materializedCell(makeCell('2,4', {
      stone: { owner: 'black', value: 1, specialType: null, status: {} },
      markers: [
        { kind: 'poisoned', owner: 'black', value: null, data: { countdown: 4 } },
        { kind: 'scorched', owner: 'black', value: null, data: { countdown: 3 } }
      ]
    })));
    expect(stoneView.getDiagnostics().statusLabels).toEqual([
      { kind: 'poison', value: '4' },
      { kind: 'scorch', value: '3' }
    ]);
    expect(statusText('poison').position.x).toBeCloseTo(12.48);
    expect(statusText('scorch').position.x).toBeCloseTo(19.84);
    expect(fillColors()).toEqual(expect.arrayContaining(['#6b2b91', '#bd2d0d']));
  });
});
