export type NetworkDebugTraceSource =
  | 'publish_response'
  | 'stream'
  | 'state_sync'
  | 'presentation_journal'
  | 'heartbeat_recovery'
  | string;

export type NetworkDebugTraceDecision =
  | 'accepted'
  | 'deduped'
  | 'stale'
  | 'deferred'
  | 'refresh_requested'
  | 'rejected'
  | string;

export interface NetworkDebugTraceEntry {
  type: string;
  source: NetworkDebugTraceSource;
  operationId: string | null;
  stateVersion: number | null;
  visualSeq: number | null;
  boardWriter: string | null;
  playbackActive: boolean | null;
  decision: NetworkDebugTraceDecision | null;
  timestamp: number;
  accepted: boolean | null;
  reason: string | null;
}

export interface NetworkDebugTraceSnapshotEntry {
  at: number;
  source: NetworkDebugTraceSource;
  operationId: string | null;
  stateVersion: number | null;
  visualSeq: number | null;
  boardWriter: string | null;
  playbackActive: boolean | null;
  decision: NetworkDebugTraceDecision | null;
  accepted: boolean | null;
  reason: string | null;
}

export interface NetworkDebugTraceSummary {
  total: number;
  bySource: Record<string, number>;
  byBoardWriter: Record<string, number>;
}

export interface NetworkDebugTrace {
  record(source: NetworkDebugTraceSource, details?: Record<string, unknown> | null): NetworkDebugTraceEntry;
  entries(): NetworkDebugTraceEntry[];
  snapshot(): NetworkDebugTraceSnapshotEntry[];
  summary(): NetworkDebugTraceSummary;
  clear(): void;
}

interface NetworkDebugTraceOptions {
  limit?: number;
  now?: () => number;
}

function normalizeLimit(limit: unknown): number {
  const numeric = Number(limit);
  if (!Number.isFinite(numeric) || numeric <= 0) return 128;
  return Math.max(1, Math.floor(numeric));
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  return null;
}

function incrementCount(map: Record<string, number>, key: string | null): void {
  if (!key) return;
  map[key] = Number.isFinite(map[key]) ? map[key] + 1 : 1;
}

export function createNetworkDebugTrace(options?: NetworkDebugTraceOptions): NetworkDebugTrace {
  const cfg = options && typeof options === 'object' ? options : {};
  const limit = normalizeLimit(cfg.limit);
  const now = typeof cfg.now === 'function' ? cfg.now : () => Date.now();
  const entries: NetworkDebugTraceEntry[] = [];

  function record(type: NetworkDebugTraceSource, details?: Record<string, unknown> | null): NetworkDebugTraceEntry {
    const safeDetails = details && typeof details === 'object' ? details : {};
    const traceType = String(type || 'unknown');
    const timestamp = normalizeNumber(now()) ?? Date.now();
    const entry: NetworkDebugTraceEntry = {
      type: traceType,
      source: normalizeString(safeDetails.source) || traceType,
      operationId: normalizeString(safeDetails.operationId),
      stateVersion: normalizeNumber(safeDetails.stateVersion),
      visualSeq: normalizeNumber(safeDetails.visualSeq),
      boardWriter: normalizeString(safeDetails.boardWriter),
      playbackActive: normalizeBoolean(safeDetails.playbackActive),
      decision: normalizeString(safeDetails.decision),
      timestamp,
      accepted: typeof safeDetails.accepted === 'boolean' ? safeDetails.accepted : null,
      reason: normalizeString(safeDetails.reason)
    };

    entries.push(entry);
    if (entries.length > limit) {
      entries.splice(0, entries.length - limit);
    }
    return { ...entry };
  }

  function entriesSnapshot(): NetworkDebugTraceEntry[] {
    return entries.map((entry) => ({ ...entry }));
  }

  function snapshot(): NetworkDebugTraceSnapshotEntry[] {
    return entries.map((entry) => ({
      at: entry.timestamp,
      source: entry.source,
      operationId: entry.operationId,
      stateVersion: entry.stateVersion,
      visualSeq: entry.visualSeq,
      boardWriter: entry.boardWriter,
      playbackActive: entry.playbackActive,
      decision: entry.decision,
      accepted: entry.accepted,
      reason: entry.reason
    }));
  }

  function summary(): NetworkDebugTraceSummary {
    const bySource: Record<string, number> = {};
    const byBoardWriter: Record<string, number> = {};
    for (const entry of entries) {
      incrementCount(bySource, entry.source);
      incrementCount(byBoardWriter, entry.boardWriter);
    }
    return {
      total: entries.length,
      bySource,
      byBoardWriter
    };
  }

  function clear(): void {
    entries.splice(0, entries.length);
  }

  return {
    record,
    entries: entriesSnapshot,
    snapshot,
    summary,
    clear
  };
}
