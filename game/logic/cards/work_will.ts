import { BLACK, WHITE, EMPTY, CHARGE_MAX } from '../../../shared-constants';
import * as ExpansionFallback from '../cards-internal/expansion-fallback';

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

const normalizeExpansionOwner = (owner: BoardValue): BoardValue => ExpansionFallback.normalizeExpansionOwner(owner as any) as BoardValue;
const isMainBoardCell = ExpansionFallback.isMainBoardCell as unknown as (row: number, col: number, gameState: GameState) => boolean;
const isExpansionCoordinate = ExpansionFallback.isExpansionCoordinate as unknown as (row: number, col: number, gameState: GameState) => boolean;
const getExpansionCells = ExpansionFallback.getExpansionCells as unknown as (gameState: GameState) => Array<{ side: string | null; row: number; col: number; owner: BoardValue }>;
const getFallbackCellValue = ExpansionFallback.getCellValue as unknown as (gameState: GameState, row: number, col: number) => BoardValue;
const setFallbackCellValue = ExpansionFallback.setCellValue as unknown as (gameState: GameState, row: number, col: number, value: BoardValue) => boolean;

function clearExpansionCellOwner(gameState: GameState, row: number, col: number): boolean {
  if (!isExpansionCoordinate(row, col, gameState)) return false;
  const before = getFallbackCellValue(gameState, row, col);
  if (before === null || before === EMPTY) return false;
  return setFallbackCellValue(gameState, row, col, EMPTY);
}

function getCellValue(gameState: GameState, row: number, col: number): BoardValue {
  return getFallbackCellValue(gameState, row, col);
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
