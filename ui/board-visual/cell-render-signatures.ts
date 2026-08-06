import type {
  BoardMarkerVisualState,
  BoardStoneVisualState,
  MaterializedBoardCellVisualState
} from './types';

type CellRenderSignatureInput = Readonly<{
  kind: MaterializedBoardCellVisualState['kind'];
  expansionSide: MaterializedBoardCellVisualState['expansionSide'];
  boundaryEdges: MaterializedBoardCellVisualState['boundaryEdges'];
  stone: BoardStoneVisualState | null;
  markers: readonly BoardMarkerVisualState[];
}>;

const CELL_MARKER_KINDS = new Set([
  'board-bonus',
  'blockade',
  'seed',
  'poison-cell',
  'scorched-cell',
  'healing-cell'
]);

function normalizedMarkerKind(kind: unknown): string {
  return String(kind || '').trim().toLowerCase().replace(/_/g, '-');
}

function isMeteorHoleMarker(marker: BoardMarkerVisualState): boolean {
  if (normalizedMarkerKind(marker?.kind) !== 'blockade') return false;
  const data = marker?.data && typeof marker.data === 'object' ? marker.data : {};
  return String(data.type || '').trim().toUpperCase() === 'METEOR_HOLE';
}

export function isBoardFrameHoleMarker(marker: BoardMarkerVisualState): boolean {
  if (!isMeteorHoleMarker(marker)) return false;
  const data = marker?.data && typeof marker.data === 'object' ? marker.data : {};
  return String(data.visualVariant || '').trim().toUpperCase() === 'BOARD_FRAME';
}

function boardFrameInnerBoundaryEdges(marker: BoardMarkerVisualState): readonly string[] {
  const raw = marker?.data?.innerBoundaryMask;
  const values = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
  const allowed = new Set(['top', 'right', 'bottom', 'left']);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const edge = String(value || '').trim().toLowerCase();
    if (!allowed.has(edge) || seen.has(edge)) continue;
    seen.add(edge);
    result.push(edge);
  }
  return result;
}

export function isBoardCellMarkerVisual(
  cell: CellRenderSignatureInput,
  marker: BoardMarkerVisualState
): boolean {
  if (!cell || cell.kind === 'void' || !CELL_MARKER_KINDS.has(marker.kind)) return false;
  // A METEOR_HOLE is represented by the cell's opaque hole surface. Rendering
  // its generic blockade marker on top creates the stray colored dot seen on
  // an otherwise black hole.
  if (cell.kind === 'hole' && isMeteorHoleMarker(marker)) return false;
  if (marker.kind === 'seed' && !!cell.stone) return false;
  return true;
}

export function hasBoardCellMarkerVisual(cell: CellRenderSignatureInput): boolean {
  for (const marker of cell.markers) {
    if (isBoardCellMarkerVisual(cell, marker)) return true;
  }
  return false;
}

export function createBoardCellBaseSurfaceSignature(cell: CellRenderSignatureInput): string {
  const baseMarkers: unknown[] = [];
  for (const marker of cell.markers) {
    if (marker.kind === 'poison-cell'
      || marker.kind === 'scorched-cell'
      || marker.kind === 'healing-cell'
      || marker.kind === 'theory-number-cell') {
      baseMarkers.push(marker.kind);
      continue;
    }
    if (cell.kind === 'hole' && isBoardFrameHoleMarker(marker)) {
      baseMarkers.push([
        'board-frame-hole',
        marker.data?.type,
        marker.data?.visualVariant,
        boardFrameInnerBoundaryEdges(marker)
      ]);
    }
  }
  return JSON.stringify([
    cell.kind,
    cell.expansionSide,
    cell.boundaryEdges,
    baseMarkers
  ]);
}

export function createBoardCellMarkerSignature(cell: CellRenderSignatureInput): string {
  const markers: BoardMarkerVisualState[] = [];
  for (const marker of cell.markers) {
    if (isBoardCellMarkerVisual(cell, marker)) markers.push(marker);
  }
  return JSON.stringify(markers);
}
