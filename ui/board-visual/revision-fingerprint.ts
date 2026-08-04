import type {
  BoardCellVisualState,
  BoardRenderModel,
  BoardRenderTopologyModel
} from './types';

export type BoardRenderModelRevisionFingerprints = Readonly<{
  visual: string;
  interaction: string;
}>;

type FingerprintModelInput = Pick<
  BoardRenderModel,
  | 'boardDigest'
  | 'inputEpoch'
  | 'topology'
  | 'cells'
  | 'keyboardCursorKey'
  | 'viewerContext'
  | 'currentPlayer'
  | 'canControlCurrentTurn'
  | 'isHumanTurn'
>;

export function stableDescriptorString(value: unknown, ancestors = new Set<object>()): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'number:NaN';
    if (value === Infinity) return 'number:Infinity';
    if (value === -Infinity) return 'number:-Infinity';
    if (Object.is(value, -0)) return 'number:-0';
    return `number:${value}`;
  }
  if (typeof value === 'bigint') return `bigint:${value.toString()}`;
  if (typeof value === 'function' || typeof value === 'symbol') {
    throw new Error('Board visual frame descriptors must not contain functions or symbols');
  }
  const objectValue = value as object;
  if (ancestors.has(objectValue)) throw new Error('Board visual frame descriptors must not contain cycles');
  ancestors.add(objectValue);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((entry) => stableDescriptorString(entry, ancestors)).join(',')}]`;
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableDescriptorString(record[key], ancestors)}`).join(',')}}`;
  } finally {
    ancestors.delete(objectValue);
  }
}

function compareCellKeys(left: BoardCellVisualState, right: BoardCellVisualState): number {
  const leftKey = String(left?.key || '');
  const rightKey = String(right?.key || '');
  const [leftRow, leftCol] = leftKey.split(',').map(Number);
  const [rightRow, rightCol] = rightKey.split(',').map(Number);
  if ([leftRow, leftCol, rightRow, rightCol].every(Number.isFinite)) {
    return leftRow - rightRow || leftCol - rightCol;
  }
  return leftKey.localeCompare(rightKey);
}

function interactionTopology(topology: BoardRenderTopologyModel): Record<string, unknown> {
  return {
    baseShape: topology.baseShape,
    baseRows: topology.baseRows,
    baseCols: topology.baseCols,
    minRow: topology.minRow,
    maxRow: topology.maxRow,
    minCol: topology.minCol,
    maxCol: topology.maxCol,
    renderRowOffset: topology.renderRowOffset,
    renderColOffset: topology.renderColOffset,
    renderRows: topology.renderRows,
    renderCols: topology.renderCols,
    baseKeys: topology.baseKeys,
    existingKeys: topology.existingKeys,
    playableKeys: topology.playableKeys,
    holeKeys: topology.holeKeys
  };
}

function exactStringSequence(parts: readonly string[]): string {
  return parts.map((part) => `${part.length}:${part}`).join('');
}

export function createBoardRenderModelRevisionFingerprints(
  model: FingerprintModelInput,
  options: Readonly<{ orderedCells?: readonly BoardCellVisualState[] }> = {}
): BoardRenderModelRevisionFingerprints {
  const topology = model.topology;
  const cells = options.orderedCells
    ? options.orderedCells
    : Array.from(model.cells || []).sort(compareCellKeys);
  const visualCellParts: string[] = [];
  const interactionCellParts: string[] = [];
  for (const cell of cells) {
    const key = String(cell?.key || '');
    const visualSignature = typeof cell?.visualSignature === 'string'
      ? cell.visualSignature
      : stableDescriptorString(cell);
    const expansionSide = String(cell?.expansionSide || '');
    const hintInputSignature = typeof cell?.hintInputSignature === 'string'
      ? cell.hintInputSignature
      : '';
    visualCellParts.push(key, visualSignature);
    interactionCellParts.push(key, expansionSide, hintInputSignature);
  }
  const sharedContext = {
    boardDigest: model.boardDigest,
    inputEpoch: model.inputEpoch,
    viewerContext: model.viewerContext,
    currentPlayer: model.currentPlayer,
    canControlCurrentTurn: model.canControlCurrentTurn,
    isHumanTurn: model.isHumanTurn
  };
  const visualHeader = stableDescriptorString({
      ...sharedContext,
      topology: {
        ...topology,
        baseKeys: topology.baseKeys,
        existingKeys: topology.existingKeys,
        playableKeys: topology.playableKeys,
        holeKeys: topology.holeKeys
      },
      keyboardCursorKey: model.keyboardCursorKey
    });
  const interactionHeader = stableDescriptorString({
      ...sharedContext,
      topology: interactionTopology(topology)
    });
  return Object.freeze({
    visual: `board-model-visual.v2:${exactStringSequence([visualHeader, ...visualCellParts])}`,
    interaction: `board-model-interaction.v2:${exactStringSequence([interactionHeader, ...interactionCellParts])}`
  });
}
