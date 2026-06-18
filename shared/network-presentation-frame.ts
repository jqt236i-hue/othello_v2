interface NetworkPresentationFrame {
  roomId: string | null;
  visualSeq: number;
  stateVersionFrom: number;
  stateVersionTo: number;
  operationId: string | null;
  actorSeatKey: 'black' | 'white' | null;
  actionType: string | null;
  playbackEvents: unknown[];
  effectLogs: string[];
  playbackDiagnostics: unknown | null;
  projectedSnapshotHash: string | null;
  snapshotAfter: unknown | null;
  createdAt: number;
}

function toFiniteInteger(value: unknown, fieldName: string): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    throw new Error(`${fieldName}_required`);
  }
  return Math.trunc(numberValue);
}

function normalizeSeatKey(value: unknown): 'black' | 'white' | null {
  if (value === 'black' || value === 1 || value === '1' || value === '+1') return 'black';
  if (value === 'white' || value === -1 || value === '-1') return 'white';
  return null;
}

function normalizeStringOrNull(value: unknown): string | null {
  const text = value == null ? '' : String(value).trim();
  return text ? text : null;
}

function normalizePresentationFrame(value: unknown): NetworkPresentationFrame {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const visualSeq = toFiniteInteger(source.visualSeq, 'visualSeq');
  const stateVersionFrom = toFiniteInteger(source.stateVersionFrom, 'stateVersionFrom');
  const stateVersionTo = toFiniteInteger(source.stateVersionTo, 'stateVersionTo');
  if (stateVersionTo <= stateVersionFrom) {
    throw new Error('stateVersionTo_must_advance');
  }
  return {
    roomId: normalizeStringOrNull(source.roomId),
    visualSeq,
    stateVersionFrom,
    stateVersionTo,
    operationId: normalizeStringOrNull(source.operationId),
    actorSeatKey: normalizeSeatKey(source.actorSeatKey),
    actionType: normalizeStringOrNull(source.actionType),
    playbackEvents: Array.isArray(source.playbackEvents) ? source.playbackEvents.slice() : [],
    effectLogs: Array.isArray(source.effectLogs) ? source.effectLogs.map((item) => String(item)) : [],
    playbackDiagnostics: source.playbackDiagnostics || null,
    projectedSnapshotHash: normalizeStringOrNull(source.projectedSnapshotHash),
    snapshotAfter: source.snapshotAfter || null,
    createdAt: Number.isFinite(Number(source.createdAt)) ? Number(source.createdAt) : Date.now()
  };
}

function collectFramesAfter(values: unknown, afterVisualSeq: unknown): NetworkPresentationFrame[] {
  const minSeq = Number.isFinite(Number(afterVisualSeq)) ? Math.trunc(Number(afterVisualSeq)) : 0;
  const frames = Array.isArray(values) ? values : [];
  const bySeq = new Map<number, NetworkPresentationFrame>();
  for (const value of frames) {
    const frame = normalizePresentationFrame(value);
    if (frame.visualSeq <= minSeq) continue;
    if (!bySeq.has(frame.visualSeq)) bySeq.set(frame.visualSeq, frame);
  }
  return Array.from(bySeq.values()).sort((a, b) => a.visualSeq - b.visualSeq);
}

export = {
  normalizePresentationFrame,
  collectFramesAfter
};
