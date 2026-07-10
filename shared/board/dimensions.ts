export interface BoardDimensionOptions {
  defaultRows: number;
  defaultCols: number;
  minRows: number;
  maxRows: number;
  minCols: number;
  maxCols: number;
}

export function createBoardDimensions(options: BoardDimensionOptions) {
  function clampBoardDimension(value: unknown, fallbackValue: unknown, minValue: number, maxValue: number): number {
    const fallback = Number.isFinite(Number(fallbackValue))
      ? Math.floor(Number(fallbackValue))
      : minValue;
    const numeric = Number.isFinite(Number(value))
      ? Math.floor(Number(value))
      : fallback;
    return Math.max(minValue, Math.min(maxValue, numeric));
  }

  function getBoardDimensionBounds(axis: string): { min: number; max: number } {
    const normalizedAxis = axis === 'col' || axis === 'cols' || axis === 'column'
      ? 'col'
      : 'row';
    if (normalizedAxis === 'col') return { min: options.minCols, max: options.maxCols };
    return { min: options.minRows, max: options.maxRows };
  }

  function normalizeBoardDimensionValue(value: unknown, fallbackValue: unknown, axis: string): number {
    const bounds = getBoardDimensionBounds(axis);
    const normalizedAxis = axis === 'col' || axis === 'cols' || axis === 'column'
      ? 'col'
      : 'row';
    const defaultValue = normalizedAxis === 'col' ? options.defaultCols : options.defaultRows;
    const fallback = Number.isFinite(Number(fallbackValue)) ? Number(fallbackValue) : defaultValue;
    return clampBoardDimension(value, fallback, bounds.min, bounds.max);
  }

  function stepBoardDimensionValue(value: unknown, direction: unknown, fallbackValue: unknown, axis: string): number {
    const normalizedDirection = Number(direction);
    const baseValue = normalizeBoardDimensionValue(value, fallbackValue, axis);
    if (!Number.isFinite(normalizedDirection) || normalizedDirection === 0) return baseValue;
    const step = normalizedDirection > 0 ? 1 : -1;
    return normalizeBoardDimensionValue(baseValue + step, baseValue, axis);
  }

  return {
    clampBoardDimension,
    getBoardDimensionBounds,
    normalizeBoardDimensionValue,
    stepBoardDimensionValue
  };
}
