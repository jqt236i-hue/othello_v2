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
  addChargeWithTotal?: (cardState: CardState, playerKey: PlayerKey, amount: number, meta?: any) => number;
};

type WorkEffectEntry = {
  gained: number;
  removed: boolean;
  row: number;
  col: number;
  removedReason: string | null;
  incomeStep: number | null;
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

function isWorkMarkerForPlayer(marker: Marker | null | undefined, playerKey: PlayerKey): marker is Marker {
  return !!(marker
    && marker.kind === 'specialStone'
    && marker.data?.type === 'WORK'
    && marker.owner === playerKey
    && Number.isInteger(marker.row)
    && Number.isInteger(marker.col));
}

function getWorkMarkers(cardState: CardState, playerKey: PlayerKey): Marker[] {
  return (cardState.markers || []).filter((marker) => isWorkMarkerForPlayer(marker, playerKey));
}

function syncPrimaryAnchor(cardState: CardState, playerKey: PlayerKey): void {
  const anchors = ensureAnchors(cardState);
  const current = anchors[playerKey];
  if (current && (cardState.markers || []).some((marker) => (
    isWorkMarkerForPlayer(marker, playerKey) &&
    marker.row === current.row &&
    marker.col === current.col
  ))) {
    return;
  }
  const marker = getWorkMarkers(cardState, playerKey)[0] || null;
  anchors[playerKey] = marker ? { row: marker.row, col: marker.col } : null;
}

function isFrozenAtTurnStart(cardState: CardState, row: number, col: number): boolean {
  const frozenCells = (cardState as any)._frozenCellsActiveAtTurnStart;
  return !!(frozenCells && typeof frozenCells.has === 'function' && frozenCells.has(`${row},${col}`));
}

function processWorkEffects(cardState: CardState, gameState: GameState, playerKey: PlayerKey, deps: WorkDeps = {}): {
  gained: number;
  removed: boolean;
  row: number | null;
  col: number | null;
  removedReason: string | null;
  incomeStep: number | null;
  entries: WorkEffectEntry[];
} {
  const ownerValue = playerKey === 'black' ? BLACK : WHITE;
  const entries: WorkEffectEntry[] = [];
  const markers = getWorkMarkers(cardState, playerKey);

  if (!markers.length) {
    syncPrimaryAnchor(cardState, playerKey);
    return { gained: 0, removed: false, row: null, col: null, removedReason: null, incomeStep: null, entries };
  }

  for (const marker of markers) {
    const row = marker.row;
    const col = marker.col;
    if (isFrozenAtTurnStart(cardState, row, col)) continue;

    const ownerColor = marker.data?.ownerColor || marker.owner || playerKey;
    const expectedValue = ownerColor === 'black' ? BLACK : ownerColor === 'white' ? WHITE : ownerValue;
    const cellValue = getCellValue(gameState, row, col);
    if (cellValue === null || cellValue === EMPTY || cellValue !== expectedValue) {
      revertAnchorStone(cardState, gameState, row, col, playerKey, 'anchor_lost');
      entries.push({ gained: 0, removed: true, row, col, removedReason: 'anchor_lost', incomeStep: null });
      continue;
    }

    const rawStage = typeof marker.data?.workStage === 'number' ? marker.data.workStage : 0;
    const stage = Math.max(0, Math.min(4, Math.trunc(rawStage)));
    const rawRemaining = typeof marker.data?.remainingOwnerTurns === 'number' ? marker.data.remainingOwnerTurns : 5 - stage;
    const remainingBefore = Math.max(0, Math.trunc(rawRemaining));
    if (remainingBefore <= 0) {
      revertAnchorStone(cardState, gameState, row, col, playerKey, 'duration_end');
      entries.push({ gained: 0, removed: true, row, col, removedReason: 'duration_end', incomeStep: null });
      continue;
    }

    const gain = Math.min(CHARGE_MAX || 99, 1 << stage);
    const chargeHelper = typeof deps.addChargeWithTotal === 'function'
      ? deps.addChargeWithTotal
      : addChargeWithTotal;
    const actualGain = chargeHelper(cardState, playerKey, gain, {
      sourceType: 'work_gain'
    });
    const normalizedActualGain = Number.isFinite(Number(actualGain)) ? Number(actualGain) : gain;
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
    }
    entries.push({
      gained: normalizedActualGain,
      removed,
      row,
      col,
      removedReason: removed ? 'duration_end' : null,
      incomeStep: stage + 1
    });
  }

  syncPrimaryAnchor(cardState, playerKey);

  const primaryEntry = entries.find((entry) => entry.gained > 0)
    || entries.find((entry) => entry.removed)
    || null;
  const totalGained = entries.reduce((sum, entry) => sum + (Number.isFinite(Number(entry.gained)) ? Number(entry.gained) : 0), 0);
  const removed = entries.some((entry) => entry.removed);

  return {
    gained: totalGained,
    removed,
    row: primaryEntry ? primaryEntry.row : null,
    col: primaryEntry ? primaryEntry.col : null,
    removedReason: primaryEntry ? primaryEntry.removedReason : null,
    incomeStep: primaryEntry ? primaryEntry.incomeStep : null,
    entries
  };
}

export = {
  placeWorkStone,
  processWorkEffects
};
