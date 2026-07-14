import type {
  BoardCellInteractionState,
  BoardCellVisualState,
  BoardPresentationOverlayState,
  BoardRenderModel,
  BoardRenderTopologyModel,
  BoardWorldWindow,
  MaterializedBoardCellVisualState
} from './types';

const OVERLAY_KEYS = new Set([
  'hoveredCellKey',
  'keyboardCursorKey',
  'previewCellKeys',
  'previewHints',
  'selectedCellKeys',
  'directionHints',
  'localPendingHints',
  'interactionLocked'
]);

function boardKey(row: number, col: number): string {
  return `${row},${col}`;
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

function sortedUniqueKeys(values: readonly string[] | undefined): string[] {
  return Array.from(new Set((values || []).map((value) => String(value)))).sort((a, b) => {
    const [aRow, aCol] = a.split(',').map(Number);
    const [bRow, bCol] = b.split(',').map(Number);
    return aRow - bRow || aCol - bCol;
  });
}

export function createEmptyBoardPresentationOverlayState(): BoardPresentationOverlayState {
  return deepFreeze({
    hoveredCellKey: null,
    keyboardCursorKey: null,
    previewCellKeys: [],
    previewHints: [],
    selectedCellKeys: [],
    directionHints: [],
    localPendingHints: [],
    interactionLocked: false
  });
}

export function validateBoardPresentationOverlayState(value: unknown): BoardPresentationOverlayState {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  for (const key of Object.keys(source)) {
    if (!OVERLAY_KEYS.has(key)) throw new Error(`Board overlay cannot mutate base field: ${key}`);
  }
  const normalizeKey = (input: unknown) => input == null ? null : String(input);
  const directionHints = Array.isArray(source.directionHints) ? source.directionHints.map((hint: any) => ({
    id: String(hint && hint.id || ''),
    cellKey: String(hint && hint.cellKey || ''),
    directionKey: String(hint && hint.directionKey || ''),
    kind: hint && (
      hint.kind === 'board-shrink-god'
      || hint.kind === 'board-shrink-will'
      || hint.kind === 'board-expansion-god'
      || hint.kind === 'board-expansion-will'
    ) ? hint.kind : 'generic'
  })) : [];
  const localPendingHints = Array.isArray(source.localPendingHints) ? source.localPendingHints.map((hint: any) => ({
    id: String(hint && hint.id || ''),
    cellKey: String(hint && hint.cellKey || ''),
    kind: String(hint && hint.kind || '')
  })) : [];
  const previewHints = Array.isArray(source.previewHints) ? source.previewHints.map((hint: any) => ({
    cellKey: String(hint && hint.cellKey || ''),
    kind: String(hint && hint.kind || '')
  })).filter((hint) => hint.cellKey && hint.kind) : [];
  return deepFreeze({
    hoveredCellKey: normalizeKey(source.hoveredCellKey),
    keyboardCursorKey: normalizeKey(source.keyboardCursorKey),
    previewCellKeys: sortedUniqueKeys(Array.isArray(source.previewCellKeys) ? source.previewCellKeys.map(String) : []),
    previewHints,
    selectedCellKeys: sortedUniqueKeys(Array.isArray(source.selectedCellKeys) ? source.selectedCellKeys.map(String) : []),
    directionHints,
    localPendingHints,
    interactionLocked: source.interactionLocked === true
  });
}

function withOverlayInteraction(
  cell: BoardCellVisualState,
  overlay: BoardPresentationOverlayState
): BoardCellVisualState {
  const directionHints = overlay.directionHints
    .filter((hint) => hint.cellKey === cell.key)
    .map((hint) => ({ id: hint.id, kind: hint.kind || 'generic', directionKey: hint.directionKey }));
  const directionHintIds = directionHints.map((hint) => hint.id);
  const localPendingHintIds = overlay.localPendingHints.filter((hint) => hint.cellKey === cell.key).map((hint) => hint.id);
  const previewKinds = cell.interaction.previewKinds.slice();
  for (const hint of overlay.previewHints) {
    if (hint.cellKey === cell.key && !previewKinds.includes(hint.kind)) previewKinds.push(hint.kind);
  }
  if (overlay.previewCellKeys.includes(cell.key) && !previewKinds.includes('overlay-preview')) {
    previewKinds.push('overlay-preview');
  }
  const interaction: BoardCellInteractionState = {
    ...cell.interaction,
    interactionLocked: overlay.interactionLocked,
    hovered: overlay.hoveredCellKey === cell.key,
    keyboardCursor: overlay.keyboardCursorKey === cell.key,
    previewKinds,
    selected: cell.interaction.selected || overlay.selectedCellKeys.includes(cell.key),
    directionHints,
    directionHintIds,
    localPendingHintIds
  };
  return { ...cell, interaction };
}

function signatureForCell(cell: Omit<BoardCellVisualState, 'visualSignature'>): string {
  return JSON.stringify([
    cell.key,
    cell.kind,
    cell.expansionSide,
    cell.boundaryEdges,
    cell.stone,
    cell.markers,
    cell.interaction
  ]);
}

export function createBoardRenderModel(options: {
  visualRevision?: number;
  topology: BoardRenderTopologyModel;
  cells: readonly Omit<BoardCellVisualState, 'visualSignature'>[];
  viewerContext?: BoardRenderModel['viewerContext'];
  currentPlayer?: BoardRenderModel['currentPlayer'];
  canControlCurrentTurn?: boolean;
  isHumanTurn?: boolean;
  overlay?: unknown;
}): BoardRenderModel {
  const topology = deepFreeze({
    ...options.topology,
    existingKeys: sortedUniqueKeys(options.topology.existingKeys),
    playableKeys: sortedUniqueKeys(options.topology.playableKeys),
    holeKeys: sortedUniqueKeys(options.topology.holeKeys)
  });
  const existingKeys = new Set(topology.existingKeys);
  const playableKeys = new Set(topology.playableKeys);
  const holeKeys = new Set(topology.holeKeys);
  const overlay = validateBoardPresentationOverlayState(options.overlay);
  const seen = new Set<string>();
  const cells = options.cells.map((rawCell) => {
    if (rawCell.kind !== 'playable' && rawCell.kind !== 'hole') {
      throw new Error(`BoardRenderModel cannot contain ${String((rawCell as any).kind)} cells`);
    }
    if (seen.has(rawCell.key)) throw new Error(`Duplicate board model cell: ${rawCell.key}`);
    seen.add(rawCell.key);
    if (!existingKeys.has(rawCell.key)) throw new Error(`Board model cell is not in topology: ${rawCell.key}`);
    if (rawCell.kind === 'hole' !== holeKeys.has(rawCell.key)) {
      throw new Error(`Board model hole mismatch: ${rawCell.key}`);
    }
    if (rawCell.kind === 'playable' !== playableKeys.has(rawCell.key)) {
      throw new Error(`Board model playable mismatch: ${rawCell.key}`);
    }
    const overlaid = withOverlayInteraction({ ...rawCell, visualSignature: '' }, overlay);
    const withoutSignature = { ...overlaid } as BoardCellVisualState;
    delete (withoutSignature as any).visualSignature;
    return deepFreeze({ ...overlaid, visualSignature: signatureForCell(withoutSignature as any) });
  });
  if (seen.size !== existingKeys.size) {
    const missing = topology.existingKeys.filter((key) => !seen.has(key));
    throw new Error(`Board model omitted existing cells: ${missing.slice(0, 8).join(',')}`);
  }
  return deepFreeze({
    visualRevision: Math.max(0, Math.trunc(Number(options.visualRevision) || 0)),
    topology,
    cells,
    keyboardCursorKey: overlay.keyboardCursorKey,
    viewerContext: options.viewerContext === 'white' || options.viewerContext === 'spectator' ? options.viewerContext : 'black',
    currentPlayer: options.currentPlayer === 'white'
      || (typeof options.currentPlayer === 'undefined' && options.viewerContext === 'white')
      ? 'white'
      : 'black',
    canControlCurrentTurn: typeof options.canControlCurrentTurn === 'boolean'
      ? options.canControlCurrentTurn
      : options.viewerContext !== 'spectator',
    isHumanTurn: typeof options.isHumanTurn === 'boolean'
      ? options.isHumanTurn
      : options.viewerContext !== 'spectator'
  });
}

export function materializeBoardViewport(options: {
  model: BoardRenderModel;
  visibleWindow: BoardWorldWindow;
  overscanCells?: number;
  effectGutterCells?: number;
}): readonly MaterializedBoardCellVisualState[] {
  const { model } = options;
  const windowValue = getBoardViewportMaterializationWindow(options);
  if (!windowValue) return Object.freeze([]);
  const byKey = new Map(model.cells.map((cell) => [cell.key, cell]));
  const materialized: MaterializedBoardCellVisualState[] = [];
  for (let row = windowValue.minRow; row <= windowValue.maxRow; row += 1) {
    for (let col = windowValue.minCol; col <= windowValue.maxCol; col += 1) {
      const key = boardKey(row, col);
      const existing = byKey.get(key);
      if (existing) {
        materialized.push(deepFreeze({ ...existing, ephemeral: false }));
        continue;
      }
      const renderRow = row + model.topology.renderRowOffset;
      const renderCol = col + model.topology.renderColOffset;
      materialized.push(deepFreeze({
        key,
        row,
        col,
        renderRow,
        renderCol,
        kind: 'void',
        expansionSide: null,
        boundaryEdges: { top: 'none', right: 'none', bottom: 'none', left: 'none' },
        stone: null,
        markers: [],
        interaction: {
          legal: false,
          legalFree: false,
          tabooLegal: false,
          selectable: false,
          interactionLocked: true,
          hovered: false,
          keyboardCursor: false,
          previewKinds: [],
          selected: false,
          selectionKinds: [],
          directionHints: [],
          directionHintIds: [],
          localPendingHintIds: []
        },
        visualSignature: `void:${key}`,
        ephemeral: true
      }));
    }
  }
  return Object.freeze(materialized);
}

export function getBoardViewportMaterializationWindow(options: {
  model: BoardRenderModel;
  visibleWindow: BoardWorldWindow;
  overscanCells?: number;
  effectGutterCells?: number;
}): BoardWorldWindow | null {
  const { model } = options;
  const visible = options.visibleWindow;
  if (!visible || ![
    visible.minRow,
    visible.maxRow,
    visible.minCol,
    visible.maxCol
  ].every((value) => Number.isFinite(Number(value)))) return null;
  const extra = Math.max(0, Math.trunc(Number(options.overscanCells) || 0))
    + Math.max(0, Math.min(2, Math.trunc(Number(options.effectGutterCells) || 0)));
  const windowValue = {
    minRow: Math.max(model.topology.minRow, Math.trunc(visible.minRow) - extra),
    maxRow: Math.min(model.topology.maxRow, Math.trunc(visible.maxRow) + extra),
    minCol: Math.max(model.topology.minCol, Math.trunc(visible.minCol) - extra),
    maxCol: Math.min(model.topology.maxCol, Math.trunc(visible.maxCol) + extra)
  };
  if (windowValue.minRow > windowValue.maxRow || windowValue.minCol > windowValue.maxCol) return null;
  return Object.freeze(windowValue);
}
