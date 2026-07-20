const BoardVisualModel = require('../ui/board-visual/model');
const BoardVisualModelBuilder = require('../ui/board-visual/model-builder');

function createTopology(existingKeys: string[], holeKeys: string[] = [], bounds = {
  minRow: 0, maxRow: 9, minCol: 0, maxCol: 9
}) {
  const holes = new Set(holeKeys);
  return {
    baseRows: 10,
    baseCols: 10,
    ...bounds,
    renderRowOffset: bounds.minRow < 0 ? -bounds.minRow : 0,
    renderColOffset: bounds.minCol < 0 ? -bounds.minCol : 0,
    renderRows: bounds.maxRow - bounds.minRow + 1,
    renderCols: bounds.maxCol - bounds.minCol + 1,
    existingKeys,
    playableKeys: existingKeys.filter((key) => !holes.has(key)),
    holeKeys
  };
}

function createCell(key: string, hole = false) {
  const [row, col] = key.split(',').map(Number);
  return {
    key,
    row,
    col,
    renderRow: row,
    renderCol: col,
    kind: hole ? 'hole' : 'playable',
    expansionSide: null,
    boundaryEdges: { top: 'none', right: 'none', bottom: 'none', left: 'none' },
    stone: null,
    markers: [],
    interaction: {
      legal: false,
      legalFree: false,
      tabooLegal: false,
      selectable: false,
      interactionLocked: false,
      hovered: false,
      keyboardCursor: false,
      previewKinds: [],
      selected: false,
      selectionKinds: [],
      directionHints: [],
      directionHintIds: [],
      localPendingHintIds: []
    }
  };
}

describe('BoardRenderModel sparse projection', () => {
  test('circle 10 keeps 80 semantic cells and materializes 20 ephemeral voids only for the view', () => {
    const keys: string[] = [];
    const counts = [4, 8, 8, 10, 10, 10, 10, 8, 8, 4];
    counts.forEach((count, row) => {
      const start = (10 - count) / 2;
      for (let col = start; col < start + count; col += 1) keys.push(`${row},${col}`);
    });
    const model = BoardVisualModel.createBoardRenderModel({
      topology: createTopology(keys),
      cells: keys.map((key) => createCell(key))
    });

    expect(model.cells).toHaveLength(80);
    expect(model.cells.some((cell: any) => cell.kind === 'void')).toBe(false);
    const view = BoardVisualModel.materializeBoardViewport({
      model,
      visibleWindow: { minRow: 0, maxRow: 9, minCol: 0, maxCol: 9 }
    });
    expect(view).toHaveLength(100);
    expect(view.filter((cell: any) => cell.kind === 'void')).toHaveLength(20);
    expect(view.filter((cell: any) => cell.kind === 'void').every((cell: any) => cell.ephemeral)).toBe(true);
  });

  test('explicit hole remains a semantic tombstone and never becomes void', () => {
    const keys = ['0,0', '0,1'];
    const model = BoardVisualModel.createBoardRenderModel({
      topology: createTopology(keys, ['0,1'], { minRow: 0, maxRow: 0, minCol: 0, maxCol: 1 }),
      cells: [createCell('0,0'), createCell('0,1', true)]
    });
    const view = BoardVisualModel.materializeBoardViewport({
      model,
      visibleWindow: { minRow: 0, maxRow: 0, minCol: 0, maxCol: 1 }
    });
    expect(view.map((cell: any) => cell.kind)).toEqual(['playable', 'hole']);
  });

  test('overlay can change presentation-only interaction and rejects canonical fields', () => {
    const raw = createCell('0,0');
    const model = BoardVisualModel.createBoardRenderModel({
      topology: createTopology(['0,0'], [], { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 }),
      cells: [raw],
      overlay: {
        hoveredCellKey: '0,0',
        previewCellKeys: [],
        previewHints: [{ cellKey: '0,0', kind: 'random-spawn' }],
        selectedCellKeys: ['0,0'],
        interactionLocked: true
      }
    });
    expect(model.cells[0].interaction).toMatchObject({ hovered: true, interactionLocked: true, selected: true });
    expect(model.cells[0].interaction.previewKinds).toEqual(['random-spawn']);
    expect(raw.interaction.hovered).toBe(false);
    expect(raw.interaction.selected).toBe(false);
    expect(raw.interaction.previewKinds).toEqual([]);
    expect(() => BoardVisualModel.validateBoardPresentationOverlayState({ stone: { owner: 'white' } })).toThrow(/cannot mutate base field/i);
    expect(() => BoardVisualModel.validateBoardPresentationOverlayState({ topology: {} })).toThrow(/cannot mutate base field/i);
  });

  test('derives independent surface, stone, and interaction signatures while preserving the aggregate signature', () => {
    const topology = createTopology(['0,0'], [], { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 });
    const project = (cell: any, overlay?: any) => BoardVisualModel.createBoardRenderModel({
      topology,
      cells: [cell],
      overlay
    }).cells[0];
    const base = project(createCell('0,0'));

    const interactionCell = createCell('0,0');
    interactionCell.interaction.legal = true;
    const interactionChanged = project(interactionCell);
    expect(interactionChanged.interactionSignature).not.toBe(base.interactionSignature);
    expect(interactionChanged.surfaceSignature).toBe(base.surfaceSignature);
    expect(interactionChanged.stoneSignature).toBe(base.stoneSignature);

    const localPendingChanged = project(createCell('0,0'), {
      localPendingHints: [{ id: 'pending:a', cellKey: '0,0', kind: 'selection' }]
    });
    expect(localPendingChanged.interactionSignature).toBe(base.interactionSignature);
    expect(localPendingChanged.visualSignature).not.toBe(base.visualSignature);

    const stoneCell: any = createCell('0,0');
    stoneCell.stone = { owner: 'black', value: 1, specialType: null, status: {} };
    const stoneChanged = project(stoneCell);
    expect(stoneChanged.stoneSignature).not.toBe(base.stoneSignature);
    expect(stoneChanged.surfaceSignature).toBe(base.surfaceSignature);
    expect(stoneChanged.interactionSignature).toBe(base.interactionSignature);

    const surfaceCell: any = createCell('0,0');
    surfaceCell.markers = [{ kind: 'board-bonus', owner: null, value: 3, data: {} }];
    const surfaceChanged = project(surfaceCell);
    expect(surfaceChanged.surfaceSignature).not.toBe(base.surfaceSignature);
    expect(surfaceChanged.stoneSignature).toBe(base.stoneSignature);
    expect(surfaceChanged.interactionSignature).toBe(base.interactionSignature);

    expect(new Set([
      base.visualSignature,
      interactionChanged.visualSignature,
      stoneChanged.visualSignature,
      surfaceChanged.visualSignature
    ])).toHaveProperty('size', 4);
  });

  test('far expansion does not create a dense void model or unbounded narrow materialization', () => {
    const keys = ['0,0', '256,256'];
    const model = BoardVisualModel.createBoardRenderModel({
      topology: createTopology(keys, [], { minRow: 0, maxRow: 256, minCol: 0, maxCol: 256 }),
      cells: keys.map((key) => {
        const cell = createCell(key);
        cell.renderRow = cell.row;
        cell.renderCol = cell.col;
        return cell;
      })
    });
    const view = BoardVisualModel.materializeBoardViewport({
      model,
      visibleWindow: { minRow: 100, maxRow: 102, minCol: 100, maxCol: 102 },
      overscanCells: 1,
      effectGutterCells: 2
    });
    expect(model.cells).toHaveLength(2);
    expect(view).toHaveLength(81);
    expect(model.topology).not.toHaveProperty('voidKeys');
    expect(BoardVisualModel.getBoardViewportMaterializationWindow({
      model,
      visibleWindow: { minRow: 100, maxRow: 102, minCol: 100, maxCol: 102 },
      overscanCells: 1,
      effectGutterCells: 99
    })).toEqual({ minRow: 97, maxRow: 105, minCol: 97, maxCol: 105 });
  });

  test('derives DOM compatibility state only from the semantic model', () => {
    const cell: any = createCell('0,0');
    cell.stone = {
      owner: 'white',
      value: -1,
      specialType: 'ZOMBIE',
      status: { destroyEvadeRemaining: 2 }
    };
    cell.markers = [
      {
        kind: 'special',
        owner: 'white',
        value: null,
        data: {
          type: 'ZOMBIE', owner: -1, remainingOwnerTurns: 3,
          regenRemaining: 2, flipEvadeRemaining: 0, destroyEvadeRemaining: 2
        }
      },
      { kind: 'guard', owner: 'white', value: null, data: { owner: -1, remainingOwnerTurns: 4 } },
      { kind: 'breeding-sprout', owner: null, value: true, data: { active: true } },
      { kind: 'board-bonus', owner: null, value: 6, data: {} },
      { kind: 'theory-number-cell', owner: null, value: true, data: { active: true } }
    ];
    cell.interaction.selectable = true;
    cell.interaction.selected = true;
    cell.interaction.keyboardCursor = true;
    cell.interaction.selectionKinds = ['friendly', 'extend-life'];
    cell.interaction.previewKinds = ['random-spawn', 'super-attraction-path'];
    const model = BoardVisualModel.createBoardRenderModel({
      topology: createTopology(['0,0'], [], { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 }),
      cells: [cell],
      viewerContext: 'white',
      overlay: { keyboardCursorKey: '0,0' }
    });

    const compatibility = BoardVisualModelBuilder.buildDomCompatibilityRenderState(model);

    expect(BoardVisualModelBuilder.getDomCompatibilityPayload).toBeUndefined();
    expect(compatibility.cellState[0][0]).toMatchObject({
      value: -1,
      isRandomSpawnPreview: true,
      isSelectedTargetHighlighted: true,
      isSuperAttractionPathPreview: true,
      isSelectableFriendly: true,
      isExtendLifeTarget: true,
      isKeyboardCursor: true,
      breedingSprout: true,
      boardBonus: 6,
      theoryNumberCell: true,
      special: { type: 'ZOMBIE', owner: -1, remainingOwnerTurns: 3 },
      guard: { owner: -1, remainingOwnerTurns: 4 },
      destroyEvadeRemaining: 2
    });
    expect(compatibility.renderProjection.gameState.currentPlayer).toBe(-1);
    expect(compatibility.renderProjection.gameState.board).toHaveLength(10);
    expect(compatibility.renderProjection.gameState.board[0][0]).toBe(-1);
    expect(compatibility.renderProjection.cardState.breedingSproutByOwner.white).toEqual([{ row: 0, col: 0 }]);
    expect(compatibility.renderProjection.cardState.boardBonusByCell['0,0']).toBe(6);
    expect(compatibility.renderProjection.cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'specialStone', row: 0, col: 0, data: expect.objectContaining({ type: 'ZOMBIE' }) }),
      expect.objectContaining({ kind: 'specialStone', row: 0, col: 0, data: expect.objectContaining({ type: 'GUARD' }) })
    ]));
    expect(JSON.stringify(model)).not.toContain('boardExpansion');
  });
});
