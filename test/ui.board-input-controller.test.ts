import BoardInputControllerModule = require('../ui/board-input-controller');

describe('board input controller', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  function createController(overrides: Record<string, unknown> = {}) {
    const actions: Array<{ row: number; col: number; directionKey?: string }> = [];
    const info: Array<{ row: number; col: number; preserveOnEmpty?: boolean }> = [];
    const hover: string[] = [];
    const cursors: Array<string | null> = [];
    const blocked: string[] = [];
    const controller = BoardInputControllerModule.createBoardInputController({
      handleCellClick: (row: number, col: number, directionKey?: string) => {
        actions.push({ row, col, ...(directionKey ? { directionKey } : {}) });
      },
      getLegalCells: () => [
        { row: 4, col: 5 },
        { row: 2, col: 5 },
        { row: 2, col: 3 },
        { row: 2, col: 3 }
      ],
      setKeyboardCursorKey: (key: string | null) => cursors.push(key),
      setHoveredCell: (row: number, col: number) => hover.push(`set:${row},${col}`),
      clearHoveredCell: () => hover.push('clear'),
      showSpecialStoneInfoAt: (row: number, col: number, options?: { preserveOnEmpty: boolean }) => {
        info.push({ row, col, ...(options ? { preserveOnEmpty: options.preserveOnEmpty } : {}) });
      },
      onBlocked: (reason: string, source: string) => blocked.push(`${reason}:${source}`),
      ...overrides
    } as any);
    controller.activate();
    return { controller, actions, info, hover, cursors, blocked };
  }

  function model(cells: any[], keyboardCursorKey: string | null = null): any {
    return {
      visualRevision: 1,
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
        existingKeys: cells.map((cell) => cell.key),
        playableKeys: cells.filter((cell) => cell.kind === 'playable').map((cell) => cell.key),
        holeKeys: cells.filter((cell) => cell.kind === 'hole').map((cell) => cell.key)
      },
      cells,
      keyboardCursorKey,
      viewerContext: 'black',
      currentPlayer: 'black',
      canControlCurrentTurn: true,
      isHumanTurn: true
    };
  }

  function cell(row: number, col: number, overrides: Record<string, unknown> = {}): any {
    return {
      key: `${row},${col}`,
      row,
      col,
      kind: 'playable',
      interaction: {
        legal: false,
        legalFree: false,
        interactionLocked: false,
        directionHints: []
      },
      ...overrides
    };
  }

  test('starts disabled and exposes an explicit bootstrap activation gate', () => {
    const handleCellClick = jest.fn();
    const showIdleStoneInfoPanel = jest.fn();
    const controller = BoardInputControllerModule.createBoardInputController({
      handleCellClick,
      showIdleStoneInfoPanel
    });

    controller.handlePointer({ type: 'pointerdown', row: 0, col: 0, pointerType: 'mouse', button: 0 });
    controller.handlePointer({ type: 'pointerup', row: 0, col: 0, pointerType: 'mouse' });
    expect(handleCellClick).not.toHaveBeenCalled();
    expect(showIdleStoneInfoPanel).not.toHaveBeenCalled();

    expect(controller.activate()).toBe(true);
    expect(showIdleStoneInfoPanel).toHaveBeenCalledTimes(1);
    controller.handlePointer({ type: 'pointerdown', row: 0, col: 0, pointerType: 'mouse', button: 0 });
    controller.handlePointer({ type: 'pointerup', row: 0, col: 0, pointerType: 'mouse' });
    expect(handleCellClick).toHaveBeenCalledWith(0, 0, undefined);

    expect(controller.deactivate()).toBe(true);
    expect(controller.getState().enabled).toBe(false);
  });

  test('mouse short press reaches the existing handleCellClick path with its direction', () => {
    const ensureOutsideCloseHandler = jest.fn();
    const { controller, actions, info } = createController({ ensureOutsideCloseHandler });

    expect(controller.handlePointer({
      type: 'pointerdown', row: 2, col: 3, pointerId: 7, pointerType: 'mouse', button: 0, clientX: 10, clientY: 20
    })).toBe(true);
    expect(controller.handlePointer({
      type: 'pointerup', row: 2, col: 3, pointerId: 7, pointerType: 'mouse', directionKey: 'up-left'
    })).toBe(true);

    expect(actions).toEqual([{ row: 2, col: 3, directionKey: 'up-left' }]);
    expect(info).toEqual([]);
    expect(ensureOutsideCloseHandler).toHaveBeenCalledTimes(1);
  });

  test('touch short press shows stone information before placement', () => {
    const order: string[] = [];
    const controller = BoardInputControllerModule.createBoardInputController({
      showSpecialStoneInfoAt: () => order.push('info'),
      handleCellClick: () => order.push('click')
    });
    controller.activate();

    controller.handlePointer({
      type: 'pointerdown', row: 1, col: 1, pointerId: 3, pointerType: 'touch', button: 0
    });
    controller.handlePointer({ type: 'pointerup', row: 1, col: 1, pointerId: 3, pointerType: 'touch' });

    expect(order).toEqual(['info', 'click']);
  });

  test('420ms long press opens information and suppresses placement', () => {
    jest.useFakeTimers();
    const preventDefault = jest.fn();
    const { controller, actions, info } = createController();

    controller.handlePointer({
      type: 'pointerdown', row: 5, col: 6, pointerId: 4, pointerType: 'pen', button: 0, clientX: 1, clientY: 2
    });
    jest.advanceTimersByTime(419);
    expect(info).toEqual([]);
    jest.advanceTimersByTime(1);
    expect(info).toEqual([{ row: 5, col: 6 }]);

    controller.handlePointer({
      type: 'pointerup', row: 5, col: 6, pointerId: 4, pointerType: 'pen', preventDefault
    });
    expect(actions).toEqual([]);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['x axis', 9, 0],
    ['y axis', 0, 9]
  ])('movement above 8px on the %s cancels a pending press', (_label, dx, dy) => {
    jest.useFakeTimers();
    const { controller, actions, info } = createController();
    controller.handlePointer({
      type: 'pointerdown', row: 1, col: 2, pointerId: 8, pointerType: 'touch', button: 0, clientX: 10, clientY: 10
    });
    controller.handlePointer({
      type: 'pointermove', row: 1, col: 2, pointerId: 8, pointerType: 'touch', clientX: 10 + Number(dx), clientY: 10 + Number(dy)
    });
    jest.advanceTimersByTime(500);
    controller.handlePointer({ type: 'pointerup', row: 1, col: 2, pointerId: 8, pointerType: 'touch' });
    expect(actions).toEqual([]);
    expect(info).toEqual([]);
  });

  test('movement at exactly 8px does not cancel the short press', () => {
    const { controller, actions } = createController();
    controller.handlePointer({
      type: 'pointerdown', row: 1, col: 2, pointerId: 8, pointerType: 'mouse', button: 0, clientX: 10, clientY: 10
    });
    controller.handlePointer({
      type: 'pointermove', row: 1, col: 2, pointerId: 8, pointerType: 'mouse', clientX: 18, clientY: 18
    });
    controller.handlePointer({ type: 'pointerup', row: 1, col: 2, pointerId: 8, pointerType: 'mouse' });
    expect(actions).toEqual([{ row: 1, col: 2 }]);
  });

  test('a lock acquired during the long-press window clears the pending press', () => {
    jest.useFakeTimers();
    let locked = false;
    const { controller, actions, info } = createController({ isInputLocked: () => locked });
    controller.handlePointer({
      type: 'pointerdown', row: 1, col: 2, pointerId: 8, pointerType: 'touch', button: 0, clientX: 10, clientY: 10
    });

    locked = true;
    jest.advanceTimersByTime(420);
    locked = false;
    controller.handlePointer({
      type: 'pointerup', row: 1, col: 2, pointerId: 8, pointerType: 'touch', clientX: 10, clientY: 10
    });

    expect(actions).toEqual([]);
    expect(info).toEqual([]);
    expect(controller.getState().activePointerId).toBeNull();
  });

  test.each(['pointerupoutside', 'pointercancel'] as const)('%s cancels without placement', (type) => {
    const { controller, actions } = createController();
    controller.handlePointer({
      type: 'pointerdown', row: 2, col: 3, pointerId: 9, pointerType: 'mouse', button: 0
    });
    controller.handlePointer({ type, row: 2, col: 3, pointerId: 9, pointerType: 'mouse' });
    controller.handlePointer({ type: 'pointerup', row: 2, col: 3, pointerId: 9, pointerType: 'mouse' });
    expect(actions).toEqual([]);
  });

  test('hover is informational for mouse and pen but not touch', () => {
    const { controller, hover, info } = createController();

    controller.handlePointer({ type: 'pointerenter', row: 3, col: 4, pointerType: 'mouse' });
    controller.handlePointer({ type: 'pointermove', row: 3, col: 5, pointerType: 'pen' });
    controller.handlePointer({ type: 'pointerleave', row: 3, col: 5, pointerType: 'pen' });
    controller.handlePointer({ type: 'pointerenter', row: 4, col: 4, pointerType: 'touch' });

    expect(hover).toEqual(['set:3,4', 'set:3,5', 'clear']);
    expect(info).toEqual([{ row: 3, col: 4, preserveOnEmpty: true }]);
  });

  test('locked input cancels pointer state while spectator keeps information read-only', () => {
    let locked = true;
    let spectator = false;
    const { controller, actions, info, blocked, cursors } = createController({
      isInputLocked: () => locked,
      isSpectator: () => spectator
    });

    expect(controller.handlePointer({
      type: 'pointerdown', row: 1, col: 1, pointerType: 'mouse', button: 0
    })).toBe(false);
    expect(controller.moveKeyboardCursor('right')).toBe(false);
    expect(cursors).toEqual([]);

    locked = false;
    spectator = true;
    controller.handlePointer({
      type: 'pointerdown', row: 1, col: 1, pointerId: 2, pointerType: 'touch', button: 0
    });
    controller.handlePointer({ type: 'pointerup', row: 1, col: 1, pointerId: 2, pointerType: 'touch' });
    expect(controller.moveKeyboardCursor('right')).toBe(false);

    expect(info).toEqual([{ row: 1, col: 1 }]);
    expect(actions).toEqual([]);
    expect(blocked).toEqual(['locked:keyboard', 'spectator:pointer', 'spectator:keyboard']);
  });

  test('recognized board keys remain consumed while playback or settlement locks input', () => {
    const preventDirectionDefault = jest.fn();
    const preventSpaceDefault = jest.fn();
    const { controller, actions, cursors } = createController({ isInputLocked: () => true });

    expect(controller.handleKeyboard({
      code: 'KeyD',
      key: 'd',
      preventDefault: preventDirectionDefault
    })).toBe(false);
    expect(controller.handleKeyboard({
      code: 'Space',
      key: ' ',
      preventDefault: preventSpaceDefault
    })).toBe(false);

    expect(preventDirectionDefault).toHaveBeenCalledTimes(1);
    expect(preventSpaceDefault).toHaveBeenCalledTimes(1);
    expect(actions).toEqual([]);
    expect(cursors).toEqual([]);
  });

  test('legal cells are deduplicated and sorted before applying the existing WASD tie-break', () => {
    const legalCells = [
      { row: 4, col: 5 },
      { row: 3, col: 4 },
      { row: 2, col: 5 },
      { row: 2, col: 3 },
      { row: 2, col: 3 }
    ];
    const { controller, cursors } = createController({ getLegalCells: () => legalCells });

    expect(controller.getSortedLegalCells()).toEqual([
      { row: 2, col: 3, key: '2,3' },
      { row: 2, col: 5, key: '2,5' },
      { row: 3, col: 4, key: '3,4' },
      { row: 4, col: 5, key: '4,5' }
    ]);
    controller.handleKeyboard({ code: 'KeyD', key: 'd' });
    controller.handleKeyboard({ code: 'KeyD', key: 'd' });
    controller.handleKeyboard({ code: 'KeyS', key: 's' });

    expect(cursors).toEqual(['2,3', '3,4', '4,5']);
  });

  test('Space places the keyboard cursor and Enter/Space activate an exact direction', () => {
    const preventDefault = jest.fn();
    const { controller, actions } = createController();

    controller.handleKeyboard({ code: 'KeyD', key: 'd' });
    expect(controller.handleKeyboard({ code: 'Space', key: ' ', preventDefault })).toBe(true);
    expect(controller.handleKeyboard({
      key: 'Enter', row: 0, col: 7, directionKey: 'right', preventDefault
    })).toBe(true);
    expect(controller.handleKeyboard({
      code: 'Space', key: ' ', row: 0, col: 0, directionKey: 'up-left', preventDefault
    })).toBe(true);

    expect(actions).toEqual([
      { row: 2, col: 3 },
      { row: 0, col: 7, directionKey: 'right' },
      { row: 0, col: 0, directionKey: 'up-left' }
    ]);
    expect(preventDefault).toHaveBeenCalledTimes(3);
  });

  test('keyboard repeat and modified board keys are left to the existing shortcut owner', () => {
    const { controller, actions, cursors } = createController();

    expect(controller.handleKeyboard({ code: 'KeyD', key: 'D', shiftKey: true })).toBe(false);
    expect(controller.handleKeyboard({ code: 'Space', key: ' ', repeat: true })).toBe(false);
    expect(controller.handleKeyboard({ key: 'Enter' })).toBe(false);

    expect(actions).toEqual([]);
    expect(cursors).toEqual([]);
  });

  test('refresh clears a cursor that is no longer legal through the overlay callback', () => {
    let legalCells = [{ row: 2, col: 3 }];
    const { controller, cursors } = createController({ getLegalCells: () => legalCells });
    controller.moveKeyboardCursor('right');
    legalCells = [{ row: 8, col: 8 }];
    controller.refreshLegalCells();
    expect(cursors).toEqual(['2,3', null]);
  });

  test('non-interactive cells never reach handleCellClick', () => {
    const { controller, actions } = createController({
      isCellInteractive: (row: number, col: number) => row === 1 && col === 1
    });
    controller.handlePointer({
      type: 'pointerdown', row: 0, col: 0, pointerType: 'mouse', button: 0
    });
    expect(controller.activateDirection(0, 0, 'up-left')).toBe(false);
    expect(actions).toEqual([]);
  });

  test('syncModel derives legal cells and hit testing from model interaction plus client rects', () => {
    const legal = cell(1, 1, { interaction: {
      legal: true, legalFree: false, interactionLocked: false, directionHints: []
    } });
    const free = cell(2, 2, { interaction: {
      legal: false, legalFree: true, interactionLocked: false, directionHints: []
    } });
    const locked = cell(3, 3, { interaction: {
      legal: true, legalFree: false, interactionLocked: true, directionHints: []
    } });
    const hole = cell(4, 4, { kind: 'hole' });
    const getCellClientRect = jest.fn((row: number, col: number) => ({
      left: col * 10,
      top: row * 10,
      right: (col + 1) * 10,
      bottom: (row + 1) * 10,
      width: 10,
      height: 10,
      layoutRevision: 4
    }));
    const { controller } = createController({ getCellClientRect });
    controller.syncModel(model([hole, locked, free, legal]));

    expect(controller.getLegalCells()).toEqual([
      { row: 1, col: 1, key: '1,1' },
      { row: 2, col: 2, key: '2,2' },
      { row: 3, col: 3, key: '3,3' }
    ]);
    expect(controller.hitTestClientPoint(15, 15)).toEqual({ row: 1, col: 1, key: '1,1' });
    expect(controller.hitTestClientPoint(35, 35)).toBeNull();
    expect(controller.hitTestClientPoint(45, 45)).toBeNull();
  });

  test('hit testing stays sparse and O(1) across large rotated topology bounds', () => {
    const target = cell(-50000, 70000, { interaction: {
      legal: true, legalFree: false, interactionLocked: false, directionHints: []
    } });
    const sparseModel = model([target]);
    sparseModel.topology = {
      ...sparseModel.topology,
      minRow: -100000,
      maxRow: 100000,
      minCol: -100000,
      maxCol: 100000,
      renderRows: 200001,
      renderCols: 200001
    };
    const revision = { value: 9 };
    const getCellClientRect = jest.fn((row: number, col: number) => {
      // 180-degree viewer orientation: larger world coordinates render first.
      const left = (sparseModel.topology.maxCol - col) * 10;
      const top = (sparseModel.topology.maxRow - row) * 10;
      return {
        left,
        top,
        right: left + 10,
        bottom: top + 10,
        width: 10,
        height: 10,
        layoutRevision: revision.value
      };
    });
    const { controller } = createController({ getCellClientRect });
    controller.syncModel(sparseModel);

    expect(controller.hitTestClientPoint(300005, 1500005)).toEqual({
      row: -50000,
      col: 70000,
      key: '-50000,70000'
    });
    expect(getCellClientRect.mock.calls.length).toBeLessThanOrEqual(4);

    getCellClientRect.mockClear();
    expect(controller.hitTestClientPoint(300015, 1500005)).toBeNull();
    expect(getCellClientRect.mock.calls.length).toBeLessThanOrEqual(3);
  });

  test('rejects a mixed layout revision so the Pixi adapter can retry next frame', () => {
    const target = cell(1, 1);
    let call = 0;
    let stable = false;
    const getCellClientRect = jest.fn((row: number, col: number) => ({
      left: col * 10,
      top: row * 10,
      right: (col + 1) * 10,
      bottom: (row + 1) * 10,
      width: 10,
      height: 10,
      layoutRevision: stable ? 2 : (++call === 1 ? 1 : 2)
    }));
    const { controller } = createController({ getCellClientRect });
    controller.syncModel(model([target]));

    expect(controller.hitTestClientPoint(15, 15)).toBeNull();
    stable = true;
    expect(controller.hitTestClientPoint(15, 15)).toEqual({ row: 1, col: 1, key: '1,1' });
  });

  test('direction focus temporarily owns the single keyboard cursor overlay path', () => {
    const navigation = cell(0, 0, { interaction: {
      legal: true, legalFree: false, interactionLocked: false, directionHints: []
    } });
    const direction = cell(0, 7, { interaction: {
      legal: false,
      legalFree: false,
      interactionLocked: false,
      directionHints: [{ id: 'right', kind: 'board-expansion-will', directionKey: 'right' }]
    } });
    const { controller, cursors } = createController();
    controller.syncModel(model([navigation, direction]));
    controller.moveKeyboardCursor('right');

    expect(controller.focusDirectionHint('0,7')).toBe(true);
    expect(controller.blurDirectionHint('0,7')).toBe(true);
    expect(cursors).toEqual(['0,0', '0,7', '0,0']);

    controller.reset();
    expect(cursors).toEqual(['0,0', '0,7', '0,0', null]);
  });
});
