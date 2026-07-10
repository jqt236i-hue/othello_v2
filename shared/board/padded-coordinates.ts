export interface PaddedCellCoord {
  row: number;
  col: number;
}

export interface PaddedCoordinateBounds {
  min: number;
  max: number;
}

function getSize(bounds: PaddedCoordinateBounds): number {
  return (bounds.max - bounds.min) + 1;
}

export function isPaddedBoardCoordinate(row: number, col: number, bounds: PaddedCoordinateBounds): boolean {
  return (
    Number.isInteger(row)
    && Number.isInteger(col)
    && row >= bounds.min
    && row <= bounds.max
    && col >= bounds.min
    && col <= bounds.max
  );
}

export function toPaddedBoardIndex(row: number, col: number, bounds: PaddedCoordinateBounds): number {
  if (!isPaddedBoardCoordinate(row, col, bounds)) return -1;
  const size = getSize(bounds);
  return ((row - bounds.min) * size) + (col - bounds.min);
}

export function fromPaddedBoardIndex(index: number, bounds: PaddedCoordinateBounds): PaddedCellCoord | null {
  const size = getSize(bounds);
  if (!Number.isInteger(index) || index < 0 || index >= (size * size)) return null;
  const rowOffset = Math.floor(index / size);
  const colOffset = index % size;
  return { row: bounds.min + rowOffset, col: bounds.min + colOffset };
}
