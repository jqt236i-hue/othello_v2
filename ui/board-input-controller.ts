import type { BoardClientRect, BoardRenderModel } from './board-visual/types';

type BoardInputDirection = 'up' | 'down' | 'left' | 'right';
type BoardInputBlockReason =
  | 'locked'
  | 'spectator'
  | 'stale-model'
  | 'invalid-direction'
  | 'direction-click-through';
type BoardInputSource = 'pointer' | 'keyboard' | 'direction';
type BoardInputPointerEventType =
  | 'pointerdown'
  | 'pointerenter'
  | 'pointermove'
  | 'pointerup'
  | 'pointerupoutside'
  | 'pointercancel'
  | 'pointerleave';

interface BoardInputCell {
  row: number;
  col: number;
  key?: string;
}

interface BoardInputPointerEvent {
  type: BoardInputPointerEventType;
  row: number;
  col: number;
  pointerId?: number;
  pointerType?: string;
  button?: number;
  clientX?: number;
  clientY?: number;
  directionKey?: string | null;
  hintId?: string | null;
  preventDefault?: () => void;
}

interface BoardInputKeyboardEvent {
  code?: string;
  key?: string;
  repeat?: boolean;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  isComposing?: boolean;
  defaultPrevented?: boolean;
  row?: number;
  col?: number;
  directionKey?: string | null;
  hintId?: string | null;
  modelCommitId?: number;
  boardDigest?: string;
  preventDefault?: () => void;
}

interface BoardInputControllerOptions {
  handleCellClick: (row: number, col: number, directionKey?: string) => unknown;
  getLegalCells?: () => readonly BoardInputCell[];
  setKeyboardCursorKey?: (cellKey: string | null) => void;
  isInputLocked?: () => boolean;
  isSpectator?: () => boolean;
  isCellInteractive?: (row: number, col: number) => boolean;
  getCellClientRect?: (row: number, col: number) => BoardClientRect | null;
  onBlocked?: (reason: BoardInputBlockReason, source: BoardInputSource) => void;
  setHoveredCell?: (row: number, col: number) => void;
  clearHoveredCell?: () => void;
  now?: () => number;
}

type ActivePress = {
  pointerId: number;
  row: number;
  col: number;
  pointerType: string;
  startX: number;
  startY: number;
  directionKey?: string;
  hintId?: string;
  modelCommitId?: number;
  boardDigest?: string;
};

type RecentDirectionActivation = {
  row: number;
  col: number;
  expiresAt: number;
};

type HitTestProjection = {
  readonly modelIdentity: string;
  readonly layoutRevision: number;
  readonly anchor: BoardInputCell;
  readonly anchorRect: BoardClientRect;
  readonly rowPixels: number | null;
  readonly colPixels: number | null;
  readonly rectByKey: Map<string, BoardClientRect>;
  readonly affine: boolean;
};

const DEFAULT_PRESS_MOVE_CANCEL_PX = 8;
const DIRECTION_CLICK_THROUGH_GUARD_MS = 500;

function toCellKey(row: number, col: number): string {
  return `${row},${col}`;
}

function normalizeDirectionKey(value: unknown): string | undefined {
  const normalized = String(value == null ? '' : value).trim();
  return normalized || undefined;
}

function normalizeHintId(value: unknown): string | undefined {
  const normalized = String(value == null ? '' : value).trim();
  return normalized || undefined;
}

function normalizePointerId(value: unknown): number {
  const pointerId = Number(value);
  return Number.isFinite(pointerId) ? pointerId : 1;
}

function normalizeCoordinate(value: unknown): number {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : 0;
}

function containsClientPoint(rect: BoardClientRect, x: number, y: number): boolean {
  return x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom;
}

function sameClientRect(left: BoardClientRect, right: BoardClientRect): boolean {
  return left.layoutRevision === right.layoutRevision
    && left.left === right.left
    && left.top === right.top
    && left.right === right.right
    && left.bottom === right.bottom
    && left.width === right.width
    && left.height === right.height;
}

function resolveKeyboardDirection(code: string): BoardInputDirection | null {
  if (code === 'KeyW') return 'up';
  if (code === 'KeyS') return 'down';
  if (code === 'KeyA') return 'left';
  if (code === 'KeyD') return 'right';
  return null;
}

function isSpaceKey(event: BoardInputKeyboardEvent): boolean {
  return event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar';
}

function normalizeLegalCells(cells: readonly BoardInputCell[]): BoardInputCell[] {
  const byKey = new Map<string, BoardInputCell>();
  for (const candidate of cells) {
    const row = Number(candidate && candidate.row);
    const col = Number(candidate && candidate.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) continue;
    const key = toCellKey(row, col);
    if (!byKey.has(key)) byKey.set(key, Object.freeze({ row, col, key }));
  }
  return Array.from(byKey.values()).sort((left, right) => (
    (left.row - right.row) || (left.col - right.col)
  ));
}

function chooseDirectionalLegalCell(
  cells: readonly BoardInputCell[],
  current: BoardInputCell,
  direction: BoardInputDirection
): BoardInputCell | null {
  const candidates = cells.filter((cell) => {
    if (direction === 'up') return cell.row < current.row;
    if (direction === 'down') return cell.row > current.row;
    if (direction === 'left') return cell.col < current.col;
    return cell.col > current.col;
  });
  if (candidates.length === 0) return null;
  const score = (cell: BoardInputCell): readonly [number, number, number, number] => {
    if (direction === 'up' || direction === 'down') {
      return [Math.abs(cell.row - current.row), Math.abs(cell.col - current.col), cell.row, cell.col];
    }
    return [Math.abs(cell.col - current.col), Math.abs(cell.row - current.row), cell.row, cell.col];
  };
  return candidates.slice().sort((left, right) => {
    const leftScore = score(left);
    const rightScore = score(right);
    return (leftScore[0] - rightScore[0])
      || (leftScore[1] - rightScore[1])
      || (leftScore[2] - rightScore[2])
      || (leftScore[3] - rightScore[3]);
  })[0] || null;
}

function createBoardInputController(options: BoardInputControllerOptions) {
  if (!options || typeof options.handleCellClick !== 'function') {
    throw new Error('BoardInputController requires handleCellClick');
  }

  const moveCancelPx = DEFAULT_PRESS_MOVE_CANCEL_PX;
  let activePress: ActivePress | null = null;
  let hoveredCellKey: string | null = null;
  let keyboardCursorKey: string | null = null;
  let directionFocusCellKey: string | null = null;
  let lastOverlayCursorKey: string | null = null;
  let currentModel: BoardRenderModel | null = null;
  let currentCellByKey = new Map<string, BoardRenderModel['cells'][number]>();
  let currentSortedLegalCells: readonly BoardInputCell[] = Object.freeze([]);
  let currentHitCells: readonly BoardInputCell[] = Object.freeze([]);
  let currentInteractiveKeys = new Set<string>();
  let currentHitByKey = new Map<string, Readonly<BoardInputCell>>();
  let hitAnchor: BoardInputCell | null = null;
  let hitRowReference: BoardInputCell | null = null;
  let hitColReference: BoardInputCell | null = null;
  let hitModelIdentity = '';
  let hitProjection: HitTestProjection | null = null;
  let hitTestCount = 0;
  let hitProjectionBuildCount = 0;
  let hitGeometryReadCount = 0;
  let hitFallbackCellVisitCount = 0;
  let recentDirectionActivation: RecentDirectionActivation | null = null;
  let enabled = false;
  let destroyed = false;

  const readNow = (): number => {
    try {
      const value = Number(options.now?.());
      if (Number.isFinite(value)) return value;
    } catch (_error) { /* fall back to the browser clock */ }
    return Date.now();
  };

  const clearRecentDirectionActivation = (): void => {
    recentDirectionActivation = null;
  };

  const isDirectionClickThrough = (row: number, col: number): boolean => {
    const recent = recentDirectionActivation;
    if (!recent) return false;
    if (readNow() > recent.expiresAt) {
      clearRecentDirectionActivation();
      return false;
    }
    return recent.row === row && recent.col === col;
  };

  const rememberDirectionActivation = (row: number, col: number): void => {
    recentDirectionActivation = {
      row,
      col,
      expiresAt: readNow() + DIRECTION_CLICK_THROUGH_GUARD_MS
    };
  };

  const isLocked = (): boolean => {
    if (!enabled || destroyed) return true;
    return options.isInputLocked?.() === true;
  };

  const isSpectator = (): boolean => {
    if (options.isSpectator) return options.isSpectator() === true;
    return currentModel?.viewerContext === 'spectator';
  };

  const isInputEligibleCell = (cell: BoardRenderModel['cells'][number]): boolean => (
    cell.kind === 'playable'
    // Causal Replay deliberately targets an existing hole.  A hole remains
    // non-interactive unless the canonical render model marks it selectable.
    || (cell.kind === 'hole' && cell.interaction.selectable === true)
  );

  const isInteractive = (row: number, col: number): boolean => {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    if (options.isCellInteractive) return options.isCellInteractive(row, col) === true;
    if (!currentModel) return true;
    const cell = currentCellByKey.get(toCellKey(row, col));
    return !!(cell && isInputEligibleCell(cell) && cell.interaction.interactionLocked !== true);
  };

  const notifyBlocked = (reason: BoardInputBlockReason, source: BoardInputSource): void => {
    try {
      options.onBlocked?.(reason, source);
    } catch (_error) { /* UI-only notification */ }
  };

  const currentModelIdentity = (): Readonly<{
    modelCommitId?: number;
    boardDigest?: string;
  }> => Object.freeze(currentModel ? {
    modelCommitId: Number(currentModel.modelCommitId),
    boardDigest: String(currentModel.boardDigest || '')
  } : {});

  const matchesCurrentModel = (expected?: Readonly<{
    modelCommitId?: number;
    boardDigest?: string;
  }>): boolean => {
    if (!expected || !currentModel) return true;
    if (
      Number.isFinite(Number(expected.modelCommitId))
      && Number(expected.modelCommitId) !== Number(currentModel.modelCommitId)
    ) {
      return false;
    }
    const expectedDigest = String(expected.boardDigest || '');
    return !expectedDigest || expectedDigest === String(currentModel.boardDigest || '');
  };

  const matchesCurrentDirectionHint = (
    row: number,
    col: number,
    directionKey: string,
    hintId?: string
  ): boolean => {
    if (!currentModel) return true;
    const cell = currentCellByKey.get(toCellKey(row, col));
    if (!cell || !Array.isArray(cell.interaction.directionHints)) return false;
    return cell.interaction.directionHints.some((hint) => (
      normalizeDirectionKey(hint && hint.directionKey) === directionKey
      && (!hintId || String(hint && hint.id || '') === hintId)
    ));
  };

  const clearPress = (): void => {
    activePress = null;
  };

  const clearHover = (): void => {
    if (hoveredCellKey == null) return;
    hoveredCellKey = null;
    options.clearHoveredCell?.();
  };

  const emitOverlayCursor = (): void => {
    const effectiveKey = directionFocusCellKey || keyboardCursorKey;
    if (lastOverlayCursorKey === effectiveKey) return;
    lastOverlayCursorKey = effectiveKey;
    options.setKeyboardCursorKey?.(effectiveKey);
  };

  const updateKeyboardCursor = (nextKey: string | null): void => {
    if (keyboardCursorKey === nextKey) return;
    keyboardCursorKey = nextKey;
    emitOverlayCursor();
  };

  const readLegalCells = (): BoardInputCell[] => {
    let cells: readonly BoardInputCell[] = [];
    if (currentModel) {
      return currentSortedLegalCells.slice();
    } else {
      cells = options.getLegalCells?.() || [];
    }
    return normalizeLegalCells(cells);
  };

  const blockAction = (source: BoardInputSource): BoardInputBlockReason | null => {
    if (isLocked()) return 'locked';
    if (isSpectator()) return 'spectator';
    return null;
  };

  const dispatchCellAction = (
    row: number,
    col: number,
    directionKey: string | undefined,
    source: BoardInputSource,
    expectedModel?: Readonly<{ modelCommitId?: number; boardDigest?: string }>,
    hintId?: string
  ): boolean => {
    const blocked = blockAction(source);
    if (blocked) {
      notifyBlocked(blocked, source);
      return false;
    }
    if (isDirectionClickThrough(row, col)) {
      notifyBlocked('direction-click-through', source);
      return false;
    }
    if (!matchesCurrentModel(expectedModel)) {
      notifyBlocked('stale-model', source);
      return false;
    }
    if (!isInteractive(row, col)) return false;
    if (directionKey && !matchesCurrentDirectionHint(row, col, directionKey, hintId)) {
      notifyBlocked('invalid-direction', source);
      return false;
    }
    options.handleCellClick(row, col, directionKey);
    if (directionKey) rememberDirectionActivation(row, col);
    return true;
  };

  const moveKeyboardCursor = (direction: BoardInputDirection): boolean => {
    const blocked = blockAction('keyboard');
    if (blocked) {
      notifyBlocked(blocked, 'keyboard');
      return false;
    }
    const cells = readLegalCells();
    if (cells.length === 0) {
      updateKeyboardCursor(null);
      return false;
    }
    const current = keyboardCursorKey
      ? cells.find((cell) => cell.key === keyboardCursorKey) || null
      : null;
    const next = current
      ? chooseDirectionalLegalCell(cells, current, direction) || current
      : cells[0];
    updateKeyboardCursor(next.key || toCellKey(next.row, next.col));
    return true;
  };

  const placeKeyboardCursor = (): boolean => {
    const blocked = blockAction('keyboard');
    if (blocked) {
      notifyBlocked(blocked, 'keyboard');
      return false;
    }
    const cells = readLegalCells();
    const current = keyboardCursorKey
      ? cells.find((cell) => cell.key === keyboardCursorKey) || null
      : null;
    if (!current) return false;
    return dispatchCellAction(current.row, current.col, undefined, 'keyboard');
  };

  const activateDirection = (
    row: number,
    col: number,
    directionKey: string,
    hintId?: string,
    expectedModel?: Readonly<{ modelCommitId?: number; boardDigest?: string }>
  ): boolean => {
    const normalized = normalizeDirectionKey(directionKey);
    if (!normalized) return false;
    return dispatchCellAction(
      row,
      col,
      normalized,
      'direction',
      expectedModel || currentModelIdentity(),
      normalizeHintId(hintId)
    );
  };

  const resetHitTestState = (): void => {
    currentHitCells = Object.freeze([]);
    currentInteractiveKeys = new Set();
    currentHitByKey = new Map();
    hitAnchor = null;
    hitRowReference = null;
    hitColReference = null;
    hitModelIdentity = '';
    hitProjection = null;
  };

  const readHitRect = (cell: BoardInputCell): BoardClientRect | null => {
    hitGeometryReadCount += 1;
    return options.getCellClientRect!(cell.row, cell.col);
  };

  const syncModel = (model: BoardRenderModel): void => {
    if (destroyed) return;
    currentModel = model;
    const nextHitModelIdentity = [
      Number(model.modelCommitId),
      String(model.boardDigest || ''),
      String(model.inputEpoch || '')
    ].join('\u0000');
    const rebuildHitContract = hitModelIdentity !== nextHitModelIdentity;
    const nextCellByKey = new Map<string, BoardRenderModel['cells'][number]>();
    const legalCells: BoardInputCell[] = [];
    const nextHitCells: BoardInputCell[] | null = rebuildHitContract ? [] : null;
    const nextInteractiveKeys = rebuildHitContract ? new Set<string>() : null;
    const nextHitByKey = rebuildHitContract
      ? new Map<string, Readonly<BoardInputCell>>()
      : null;
    for (const cell of model.cells) {
      nextCellByKey.set(cell.key, cell);
      if (cell.kind === 'playable' && (
        cell.interaction.legal === true || cell.interaction.legalFree === true
      )) {
        legalCells.push({ row: cell.row, col: cell.col, key: cell.key });
      }
      if (!rebuildHitContract) continue;
      // Locking is transient presentation state and is intentionally excluded
      // from the model identity. Keep eligible target coordinates in the
      // retained hit contract so an unlock-only frame can become interactive
      // without rebuilding geometry; isLocked()/isInteractive() remain the
      // live gates.
      if (!isInputEligibleCell(cell)) continue;
      const coordinateKey = toCellKey(cell.row, cell.col);
      const hitCell = Object.freeze({ row: cell.row, col: cell.col, key: cell.key });
      nextHitCells!.push(hitCell);
      nextInteractiveKeys!.add(coordinateKey);
      nextHitByKey!.set(coordinateKey, hitCell);
    }
    currentCellByKey = nextCellByKey;
    currentSortedLegalCells = Object.freeze(normalizeLegalCells(legalCells));

    if (rebuildHitContract) {
      currentHitCells = Object.freeze(nextHitCells!);
      currentInteractiveKeys = nextInteractiveKeys!;
      currentHitByKey = nextHitByKey!;
      hitAnchor = currentHitCells[0] || null;
      hitRowReference = hitAnchor
        ? currentHitCells.find((cell) => cell.col === hitAnchor!.col && cell.row !== hitAnchor!.row) || null
        : null;
      hitColReference = hitAnchor
        ? currentHitCells.find((cell) => cell.row === hitAnchor!.row && cell.col !== hitAnchor!.col) || null
        : null;
      hitModelIdentity = nextHitModelIdentity;
      hitProjection = null;
    }
    if (!directionFocusCellKey && keyboardCursorKey == null && model.keyboardCursorKey) {
      keyboardCursorKey = String(model.keyboardCursorKey);
      lastOverlayCursorKey = keyboardCursorKey;
    }
    if (directionFocusCellKey) {
      const focused = model.cells.find((cell) => cell.key === directionFocusCellKey);
      if (!focused || focused.interaction.directionHints.length === 0) {
        directionFocusCellKey = null;
        emitOverlayCursor();
      }
    }
    if (keyboardCursorKey) {
      const legalCells = readLegalCells();
      if (!legalCells.some((cell) => cell.key === keyboardCursorKey)) updateKeyboardCursor(null);
    }
    if (activePress && !isInteractive(activePress.row, activePress.col)) clearPress();
    if (hoveredCellKey) {
      const [row, col] = hoveredCellKey.split(',').map(Number);
      if (!isInteractive(row, col)) clearHover();
    }
  };

  const focusDirectionHint = (cellKey: string): boolean => {
    if (destroyed || isLocked()) return false;
    const normalized = String(cellKey || '').trim();
    if (!normalized || !currentModel) return false;
    const cell = currentModel.cells.find((candidate) => candidate.key === normalized);
    if (!cell || cell.interaction.directionHints.length === 0 || !isInteractive(cell.row, cell.col)) return false;
    directionFocusCellKey = normalized;
    emitOverlayCursor();
    return true;
  };

  const blurDirectionHint = (cellKey: string): boolean => {
    if (directionFocusCellKey !== String(cellKey || '').trim()) return false;
    directionFocusCellKey = null;
    emitOverlayCursor();
    return true;
  };

  const hitTestClientPoint = (clientX: number, clientY: number): BoardInputCell | null => {
    if (destroyed || !currentModel || typeof options.getCellClientRect !== 'function') return null;
    const x = Number(clientX);
    const y = Number(clientY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    hitTestCount += 1;
    const anchor = hitAnchor;
    if (!anchor) return null;
    const anchorRect = readHitRect(anchor);
    if (!anchorRect) return null;

    let projection = hitProjection;
    if (
      !projection
      || projection.modelIdentity !== hitModelIdentity
      || !sameClientRect(projection.anchorRect, anchorRect)
    ) {
      const rectByKey = new Map<string, BoardClientRect>();
      rectByKey.set(toCellKey(anchor.row, anchor.col), anchorRect);
      let rowPixels: number | null = null;
      let colPixels: number | null = null;
      if (hitRowReference && hitColReference) {
        const rowRect = readHitRect(hitRowReference);
        const colRect = readHitRect(hitColReference);
        if (
          !rowRect
          || !colRect
          || rowRect.layoutRevision !== anchorRect.layoutRevision
          || colRect.layoutRevision !== anchorRect.layoutRevision
        ) {
          hitProjection = null;
          return null;
        }
        rectByKey.set(toCellKey(hitRowReference.row, hitRowReference.col), rowRect);
        rectByKey.set(toCellKey(hitColReference.row, hitColReference.col), colRect);
        const nextRowPixels = (
          (rowRect.top + rowRect.height / 2) - (anchorRect.top + anchorRect.height / 2)
        ) / (hitRowReference.row - anchor.row);
        const nextColPixels = (
          (colRect.left + colRect.width / 2) - (anchorRect.left + anchorRect.width / 2)
        ) / (hitColReference.col - anchor.col);
        if (Number.isFinite(nextRowPixels) && nextRowPixels !== 0) rowPixels = nextRowPixels;
        if (Number.isFinite(nextColPixels) && nextColPixels !== 0) colPixels = nextColPixels;
      }
      const verification = readHitRect(anchor);
      if (!verification || !sameClientRect(anchorRect, verification)) {
        hitProjection = null;
        return null;
      }
      projection = {
        modelIdentity: hitModelIdentity,
        layoutRevision: anchorRect.layoutRevision,
        anchor,
        anchorRect,
        rowPixels,
        colPixels,
        rectByKey,
        affine: rowPixels !== null && colPixels !== null
      };
      hitProjection = projection;
      hitProjectionBuildCount += 1;
    }

    if (projection.affine && projection.rowPixels !== null && projection.colPixels !== null) {
      const row = anchor.row + Math.round(
        (y - (projection.anchorRect.top + projection.anchorRect.height / 2)) / projection.rowPixels
      );
      const col = anchor.col + Math.round(
        (x - (projection.anchorRect.left + projection.anchorRect.width / 2)) / projection.colPixels
      );
      const key = toCellKey(row, col);
      const hit = currentHitByKey.get(key);
      if (!hit || !currentInteractiveKeys.has(key) || !isInteractive(row, col)) return null;
      let rect = projection.rectByKey.get(key) || null;
      if (!rect) {
        rect = readHitRect(hit);
        if (!rect || rect.layoutRevision !== projection.layoutRevision) {
          hitProjection = null;
          return null;
        }
        projection.rectByKey.set(key, rect);
      }
      return containsClientPoint(rect, x, y) ? hit : null;
    }

    for (const cell of currentHitCells) {
      hitFallbackCellVisitCount += 1;
      if (!isInteractive(cell.row, cell.col)) continue;
      const key = toCellKey(cell.row, cell.col);
      let rect = projection.rectByKey.get(key) || null;
      if (!rect) {
        rect = readHitRect(cell);
        if (!rect || rect.layoutRevision !== projection.layoutRevision) {
          hitProjection = null;
          return null;
        }
        projection.rectByKey.set(key, rect);
      }
      if (containsClientPoint(rect, x, y)) return currentHitByKey.get(key) || null;
    }
    return null;
  };

  const handlePointer = (event: BoardInputPointerEvent): boolean => {
    if (destroyed || !event) return false;
    const row = Number(event.row);
    const col = Number(event.col);
    const pointerId = normalizePointerId(event.pointerId);
    const pointerType = String(event.pointerType || 'mouse').toLowerCase();
    const isTouch = pointerType === 'touch';
    const isHoverPointer = !isTouch;

    if (event.type === 'pointerdown') {
      clearPress();
      if (Number(event.button ?? 0) !== 0 || isLocked() || !isInteractive(row, col)) return false;
      if (isDirectionClickThrough(row, col)) {
        notifyBlocked('direction-click-through', 'pointer');
        return false;
      }
      const press: ActivePress = {
        pointerId,
        row,
        col,
        pointerType,
        startX: normalizeCoordinate(event.clientX),
        startY: normalizeCoordinate(event.clientY),
        directionKey: normalizeDirectionKey(event.directionKey),
        hintId: normalizeHintId(event.hintId),
        ...currentModelIdentity()
      };
      activePress = press;
      return true;
    }

    if (event.type === 'pointerenter') {
      if (!isHoverPointer || isLocked() || !isInteractive(row, col)) return false;
      hoveredCellKey = toCellKey(row, col);
      options.setHoveredCell?.(row, col);
      return true;
    }

    if (event.type === 'pointermove') {
      if (isLocked()) {
        clearPress();
        clearHover();
        return false;
      }
      if (isHoverPointer && isInteractive(row, col)) {
        hoveredCellKey = toCellKey(row, col);
        options.setHoveredCell?.(row, col);
      }
      const press = activePress;
      if (!press || press.pointerId !== pointerId) return isHoverPointer;
      const dx = Math.abs(normalizeCoordinate(event.clientX) - press.startX);
      const dy = Math.abs(normalizeCoordinate(event.clientY) - press.startY);
      if (dx > moveCancelPx || dy > moveCancelPx) clearPress();
      return true;
    }

    if (event.type === 'pointerup') {
      const press = activePress;
      if (!press || press.pointerId !== pointerId) return false;
      const directionKey = normalizeDirectionKey(event.directionKey) || press.directionKey;
      const hintId = normalizeHintId(event.hintId) || press.hintId;
      clearPress();
      if (isLocked()) return false;
      return dispatchCellAction(
        press.row,
        press.col,
        directionKey,
        'pointer',
        press,
        hintId
      );
    }

    if (event.type === 'pointerupoutside' || event.type === 'pointercancel') {
      if (activePress && activePress.pointerId === pointerId) clearPress();
      return false;
    }

    if (event.type === 'pointerleave') {
      if (isHoverPointer) clearHover();
      if (activePress && activePress.pointerId === pointerId) clearPress();
      return false;
    }

    return false;
  };

  const handleKeyboard = (event: BoardInputKeyboardEvent): boolean => {
    if (!event || event.defaultPrevented || event.isComposing) return false;
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return false;
    const direction = resolveKeyboardDirection(String(event.code || ''));
    if (direction) {
      const handled = moveKeyboardCursor(direction);
      if (handled || isLocked() || isSpectator()) event.preventDefault?.();
      return handled;
    }
    const directionKey = normalizeDirectionKey(event.directionKey);
    if ((event.key === 'Enter' || isSpaceKey(event)) && directionKey) {
      if (event.repeat || !Number.isInteger(event.row) || !Number.isInteger(event.col)) return false;
      const handled = activateDirection(
        Number(event.row),
        Number(event.col),
        directionKey,
        normalizeHintId(event.hintId),
        {
          modelCommitId: event.modelCommitId,
          boardDigest: event.boardDigest
        }
      );
      if (handled || isLocked() || isSpectator()) event.preventDefault?.();
      return handled;
    }
    if (isSpaceKey(event)) {
      if (event.repeat) return false;
      const handled = placeKeyboardCursor();
      if (handled || isLocked() || isSpectator()) event.preventDefault?.();
      return handled;
    }
    return false;
  };

  return {
    activate(): boolean {
      if (destroyed || enabled) return false;
      enabled = true;
      return true;
    },
    deactivate(): boolean {
      if (!enabled) return false;
      enabled = false;
      clearPress();
      clearHover();
      clearRecentDirectionActivation();
      return true;
    },
    handlePointer,
    handleKeyboard,
    hitTestClientPoint,
    syncModel,
    focusDirectionHint,
    blurDirectionHint,
    moveKeyboardCursor,
    placeKeyboardCursor,
    activateCell(row: number, col: number, directionKey?: string): boolean {
      return dispatchCellAction(row, col, normalizeDirectionKey(directionKey), 'pointer');
    },
    activateDirection,
    getLegalCells(): readonly BoardInputCell[] {
      return Object.freeze(readLegalCells());
    },
    getSortedLegalCells(): readonly BoardInputCell[] {
      return Object.freeze(readLegalCells());
    },
    refreshLegalCells(): void {
      if (!keyboardCursorKey) return;
      const cells = readLegalCells();
      if (!cells.some((cell) => cell.key === keyboardCursorKey)) updateKeyboardCursor(null);
    },
    syncInputState(): void {
      if (!isLocked()) return;
      clearPress();
      clearHover();
    },
    clearKeyboardCursor(): void {
      updateKeyboardCursor(null);
    },
    getState() {
      return Object.freeze({
        activePointerId: activePress?.pointerId ?? null,
        hoveredCellKey,
        keyboardCursorKey,
        directionFocusCellKey,
        enabled,
        locked: isLocked(),
        spectator: isSpectator()
      });
    },
    getPerformanceDiagnostics() {
      return Object.freeze({
        hitTestCount,
        hitProjectionBuildCount,
        hitGeometryReadCount,
        hitFallbackCellVisitCount,
        hitCellCount: currentHitCells.length,
        hitProjectionCached: hitProjection !== null,
        hitProjectionAffine: hitProjection?.affine === true
      });
    },
    reset(): void {
      clearPress();
      clearHover();
      directionFocusCellKey = null;
      if (keyboardCursorKey !== null) updateKeyboardCursor(null);
      else emitOverlayCursor();
      currentModel = null;
      currentCellByKey = new Map();
      currentSortedLegalCells = Object.freeze([]);
      resetHitTestState();
      clearRecentDirectionActivation();
    },
    destroy(): void {
      if (destroyed) return;
      enabled = false;
      clearPress();
      clearHover();
      directionFocusCellKey = null;
      if (keyboardCursorKey !== null) updateKeyboardCursor(null);
      else emitOverlayCursor();
      currentModel = null;
      currentCellByKey = new Map();
      currentSortedLegalCells = Object.freeze([]);
      resetHitTestState();
      clearRecentDirectionActivation();
      destroyed = true;
    }
  };
}

export = {
  createBoardInputController
};
