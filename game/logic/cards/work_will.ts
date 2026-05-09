import { BLACK, WHITE, EMPTY, CHARGE_MAX } from '../../../shared-constants';

type PlayerKey = 'black' | 'white';
type BoardValue = number | string | null;

type Marker = {
  id?: number;
  createdSeq?: number;
  kind?: string;
  row: number;
  col: number;
  owner?: PlayerKey | string;
  data?: {
    type?: string;
    ownerColor?: PlayerKey | string;
    workStage?: number;
    remainingOwnerTurns?: number;
    [key: string]: unknown;
  };
};

type CardState = {
  markers?: Marker[];
  workAnchorPosByPlayer?: Record<PlayerKey, { row: number; col: number } | null>;
  charge?: Record<PlayerKey, number>;
  chargeGainedTotal?: Record<PlayerKey, number>;
  _nextMarkerId?: number;
  _nextCreatedSeq?: number;
  debugWorkLog?: boolean;
  [key: string]: unknown;
};

type GameState = {
  board?: BoardValue[][];
  boardExpansion?: {
    active?: boolean;
    side?: string | null;
    row?: number | null;
    owner?: BoardValue;
    cells?: Array<{ side?: string | null; row: number; col: number; owner?: BoardValue }>;
    col?: number;
  };
  [key: string]: unknown;
};

type WorkDeps = {
  removeMarkersAt?: (cardState: CardState, row: number, col: number, options?: { kind?: string; type?: string; owner?: PlayerKey }) => void;
  addMarker?: (cardState: CardState, kind: string, row: number, col: number, owner: PlayerKey, data?: Marker['data']) => unknown;
};

function ensureAnchors(cardState: CardState): Record<PlayerKey, { row: number; col: number } | null> {
  if (!cardState.workAnchorPosByPlayer) {
    cardState.workAnchorPosByPlayer = { black: null, white: null };
  }
  return cardState.workAnchorPosByPlayer;
}

function normalizeExpansionOwner(owner: BoardValue): BoardValue {
  return owner === BLACK || owner === WHITE ? owner : EMPTY;
}

function resolveBoardDims(gameState: GameState): { rows: number; cols: number } {
  const board = Array.isArray(gameState.board) ? gameState.board : null;
  const rows = board && board.length > 0 ? board.length : 8;
  const firstRow = board && Array.isArray(board[0]) ? board[0] : null;
  const cols = firstRow && firstRow.length > 0 ? firstRow.length : rows;
  return { rows, cols };
}

function isMainBoardCell(row: number, col: number, gameState: GameState): boolean {
  const dims = resolveBoardDims(gameState);
  return Number.isInteger(row) && row >= 0 && row < dims.rows && Number.isInteger(col) && col >= 0 && col < dims.cols;
}

function resolveExpansionSide(side: string | null | undefined, row: number, col: number, gameState: GameState): string | null {
  if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
  const dims = resolveBoardDims(gameState);
  if (col === -1) return 'left';
  if (col === dims.cols) return 'right';
  if (row === -1) return 'top';
  if (row === dims.rows) return 'bottom';
  return null;
}

function isExpansionCoordinate(row: number, col: number, gameState: GameState): boolean {
  if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
  const dims = resolveBoardDims(gameState);
  if (row < -1 || row > dims.rows || col < -1 || col > dims.cols) return false;
  return !isMainBoardCell(row, col, gameState);
}

function getExpansionCells(gameState: GameState): Array<{ side: string | null; row: number; col: number; owner: BoardValue }> {
  const expansion = gameState.boardExpansion;
  if (!expansion || typeof expansion !== 'object') return [];

  const cells: Array<{ side: string | null; row: number; col: number; owner: BoardValue }> = [];
  const pushCell = (source: { side?: string | null; row?: number; col?: number; owner?: BoardValue }) => {
    let row = source.row;
    let col = source.col;
    const side = source.side;
    if (!Number.isInteger(col) && side === 'left') col = -1;
    if (!Number.isInteger(col) && side === 'right') col = resolveBoardDims(gameState).cols;
    if (!Number.isInteger(row) || !Number.isInteger(col)) return;
    const resolvedRow = row;
    const resolvedCol = col;
    if (typeof resolvedRow !== 'number' || typeof resolvedCol !== 'number') return;
    if (!isExpansionCoordinate(resolvedRow, resolvedCol, gameState)) return;
    if (cells.some((cell) => cell.row === resolvedRow && cell.col === resolvedCol)) return;
    cells.push({
      side: resolveExpansionSide(side, resolvedRow, resolvedCol, gameState),
      row: resolvedRow,
      col: resolvedCol,
      owner: normalizeExpansionOwner(source.owner ?? EMPTY)
    });
  };

  if (Array.isArray(expansion.cells)) {
    for (const cell of expansion.cells) pushCell(cell);
  }
  if (cells.length === 0 && expansion.active === true) {
    pushCell({ side: expansion.side, row: expansion.row ?? undefined, col: expansion.col, owner: expansion.owner });
  }
  return cells;
}

function syncLegacyExpansionFields(expansion: NonNullable<GameState['boardExpansion']>, gameState: GameState): void {
  if (!Array.isArray(expansion.cells)) expansion.cells = [];
  const latest = expansion.cells.length > 0 ? expansion.cells[expansion.cells.length - 1] : null;
  expansion.active = !!latest;
  expansion.side = latest ? resolveExpansionSide(latest.side, latest.row, latest.col, gameState) : null;
  expansion.row = latest ? latest.row : null;
  expansion.owner = latest ? normalizeExpansionOwner(latest.owner ?? EMPTY) : EMPTY;
}

function clearExpansionCellOwner(gameState: GameState, row: number, col: number): boolean {
  if (!isExpansionCoordinate(row, col, gameState)) return false;
  const expansion = gameState.boardExpansion;
  if (!expansion) return false;
  const cells = getExpansionCells(gameState);
  if (cells.length === 0) return false;
  let changed = false;
  expansion.cells = cells.map((cell) => {
    if (cell.row === row && cell.col === col) {
      changed = changed || cell.owner !== EMPTY;
      return { ...cell, owner: EMPTY };
    }
    return { ...cell, owner: normalizeExpansionOwner(cell.owner) };
  });
  syncLegacyExpansionFields(expansion, gameState);
  return changed;
}

function getCellValue(gameState: GameState, row: number, col: number): BoardValue {
  for (const cell of getExpansionCells(gameState)) {
    if (cell.row === row && cell.col === col) return normalizeExpansionOwner(cell.owner);
  }
  if (!Array.isArray(gameState.board)) return null;
  if (!isMainBoardCell(row, col, gameState)) return null;
  return gameState.board[row]?.[col] ?? null;
}

function addChargeWithTotal(cardState: CardState, playerKey: PlayerKey, amount: number): number {
  if (!cardState.charge) cardState.charge = { black: 0, white: 0 };
  if (!cardState.chargeGainedTotal) cardState.chargeGainedTotal = { black: 0, white: 0 };
  const before = cardState.charge[playerKey] || 0;
  const after = Math.min(CHARGE_MAX || 99, before + amount);
  cardState.charge[playerKey] = after;
  const added = after - before;
  if (added > 0) cardState.chargeGainedTotal[playerKey] = (cardState.chargeGainedTotal[playerKey] || 0) + added;
  return added;
}

function defaultRemoveMarkersAt(cardState: CardState, row: number, col: number, options?: { kind?: string; type?: string; owner?: PlayerKey }): void {
  const opts = options || {};
  cardState.markers = (cardState.markers || []).filter((marker) => {
    if (!marker || marker.row !== row || marker.col !== col) return true;
    if (opts.kind && marker.kind !== opts.kind) return true;
    if (opts.type && marker.data?.type !== opts.type) return true;
    if (opts.owner && marker.owner !== opts.owner) return true;
    return false;
  });
}

function defaultAddMarker(cardState: CardState, kind: string, row: number, col: number, owner: PlayerKey, data?: Marker['data']): { placed: true } {
  if (!cardState.markers) cardState.markers = [];
  if (typeof cardState._nextMarkerId !== 'number') cardState._nextMarkerId = 1;
  if (typeof cardState._nextCreatedSeq !== 'number') cardState._nextCreatedSeq = 1;
  const id = cardState._nextMarkerId;
  const createdSeq = cardState._nextCreatedSeq;
  cardState._nextMarkerId += 1;
  cardState._nextCreatedSeq += 1;
  cardState.markers.push({
    id,
    row,
    col,
    kind,
    owner,
    createdSeq,
    data: { type: 'WORK', ownerColor: owner, workStage: 0, remainingOwnerTurns: 5, ...(data || {}) }
  });
  return { placed: true };
}

function placeWorkStone(cardState: CardState, _gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: WorkDeps = {}): { placed: true } {
  const anchors = ensureAnchors(cardState);
  const previous = anchors[playerKey];
  const removeMarkersAt = deps.removeMarkersAt || defaultRemoveMarkersAt;
  if (previous && (previous.row !== row || previous.col !== col)) {
    removeMarkersAt(cardState, previous.row, previous.col, { kind: 'specialStone', type: 'WORK', owner: playerKey });
    anchors[playerKey] = null;
  }

  const addMarker = deps.addMarker || defaultAddMarker;
  addMarker(cardState, 'specialStone', row, col, playerKey, { type: 'WORK', ownerColor: playerKey, workStage: 0, remainingOwnerTurns: 5 });
  anchors[playerKey] = { row, col };
  return { placed: true };
}

function revertAnchorStone(cardState: CardState, gameState: GameState, row: number, col: number, ownerKey: PlayerKey, reason?: string): boolean {
  const beforeCount = (cardState.markers || []).length;
  cardState.markers = (cardState.markers || []).filter((marker) => !(marker.kind === 'specialStone'
    && marker.row === row
    && marker.col === col
    && marker.owner === ownerKey
    && marker.data?.type === 'WORK'));
  const removed = (cardState.markers || []).length !== beforeCount;
  if (removed && (reason || 'duration_end') === 'duration_end') clearExpansionCellOwner(gameState, row, col);
  return removed;
}

function findWorkMarker(cardState: CardState, playerKey: PlayerKey): { marker: Marker | null; row: number | null; col: number | null } {
  const anchors = ensureAnchors(cardState);
  const anchor = anchors[playerKey];
  let row = anchor ? anchor.row : null;
  let col = anchor ? anchor.col : null;
  let marker = row !== null && col !== null
    ? (cardState.markers || []).find((candidate) => candidate.kind === 'specialStone'
      && candidate.data?.type === 'WORK'
      && candidate.owner === playerKey
      && candidate.row === row
      && candidate.col === col) || null
    : null;
  if (!marker) {
    marker = (cardState.markers || []).find((candidate) => candidate.kind === 'specialStone'
      && candidate.data?.type === 'WORK'
      && candidate.owner === playerKey) || null;
    if (marker) {
      row = marker.row;
      col = marker.col;
      anchors[playerKey] = { row, col };
    }
  }
  return { marker, row, col };
}

function processWorkEffects(cardState: CardState, gameState: GameState, playerKey: PlayerKey): {
  gained: number;
  removed: boolean;
  row: number | null;
  col: number | null;
  removedReason: string | null;
  incomeStep: number | null;
} {
  const ownerValue = playerKey === 'black' ? BLACK : WHITE;
  const anchors = ensureAnchors(cardState);
  const { marker, row, col } = findWorkMarker(cardState, playerKey);

  if (!marker || row === null || col === null) {
    return { gained: 0, removed: false, row, col, removedReason: null, incomeStep: null };
  }

  const ownerColor = marker.data?.ownerColor || marker.owner || playerKey;
  const expectedValue = ownerColor === 'black' ? BLACK : ownerColor === 'white' ? WHITE : ownerValue;
  const cellValue = getCellValue(gameState, row, col);
  if (cellValue === null || cellValue === EMPTY || cellValue !== expectedValue) {
    revertAnchorStone(cardState, gameState, row, col, playerKey, 'anchor_lost');
    anchors[playerKey] = null;
    return { gained: 0, removed: true, row, col, removedReason: 'anchor_lost', incomeStep: null };
  }

  const rawStage = typeof marker.data?.workStage === 'number' ? marker.data.workStage : 0;
  const stage = Math.max(0, Math.min(4, Math.trunc(rawStage)));
  const rawRemaining = typeof marker.data?.remainingOwnerTurns === 'number' ? marker.data.remainingOwnerTurns : 5 - stage;
  const remainingBefore = Math.max(0, Math.trunc(rawRemaining));
  if (remainingBefore <= 0) {
    revertAnchorStone(cardState, gameState, row, col, playerKey, 'duration_end');
    anchors[playerKey] = null;
    return { gained: 0, removed: true, row, col, removedReason: 'duration_end', incomeStep: null };
  }

  const gain = Math.min(CHARGE_MAX || 99, 1 << stage);
  addChargeWithTotal(cardState, playerKey, gain);
  const remainingAfter = remainingBefore - 1;
  const newStage = (stage + 1) % 5;
  for (const candidate of cardState.markers || []) {
    if (candidate.kind === 'specialStone' && candidate.data?.type === 'WORK' && candidate.owner === playerKey && candidate.row === row && candidate.col === col) {
      candidate.data.workStage = newStage;
      candidate.data.remainingOwnerTurns = remainingAfter;
      if (candidate.data.ownerColor === undefined) candidate.data.ownerColor = playerKey;
    }
  }

  const removed = remainingAfter <= 0;
  if (removed) {
    revertAnchorStone(cardState, gameState, row, col, playerKey, 'duration_end');
    anchors[playerKey] = null;
  }

  return { gained: gain, removed, row, col, removedReason: removed ? 'duration_end' : null, incomeStep: stage + 1 };
}

export = {
  placeWorkStone,
  processWorkEffects
};
