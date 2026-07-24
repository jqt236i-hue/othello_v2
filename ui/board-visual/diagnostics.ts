type DiagnosticEntry = Readonly<{
  index: number;
  event: string;
  detail: unknown;
}>;

type BoardVisualDebugSource = Readonly<{
  getBackendKind: () => unknown;
  getBackendDiagnostics: () => unknown;
  getMode: () => unknown;
  getVisualFrameDigest: () => unknown;
  getRenderedCell: (row: number, col: number) => unknown;
  getCellClientRect: (row: number, col: number) => unknown;
  getDisplayObjectCounts: () => unknown;
  getTextureLeaseCounts: () => unknown;
  waitForIdle: () => Promise<void>;
}>;

function cloneForDiagnostics(value: unknown, seen = new WeakMap<object, unknown>()): unknown {
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value !== 'object') return String(value);
  const cached = seen.get(value as object);
  if (cached) return cached;
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    seen.set(value, out);
    for (const item of value) out.push(cloneForDiagnostics(item, seen));
    return Object.freeze(out);
  }
  const out: Record<string, unknown> = {};
  seen.set(value as object, out);
  const isError = value instanceof Error
    || Object.prototype.toString.call(value) === '[object Error]';
  if (isError) {
    for (const key of ['name', 'message', 'stack', 'code', 'eventType', 'stage', 'reason', 'cause']) {
      try {
        const item = (value as Record<string, unknown>)[key];
        if (item !== undefined && typeof item !== 'function' && typeof item !== 'symbol') {
          out[key] = cloneForDiagnostics(item, seen);
        }
      } catch (_error) { /* inaccessible diagnostic properties are omitted */ }
    }
  }
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    if (Object.prototype.hasOwnProperty.call(out, key)) continue;
    const item = (value as Record<string, unknown>)[key];
    if (typeof item !== 'function' && typeof item !== 'symbol') out[key] = cloneForDiagnostics(item, seen);
  }
  return Object.freeze(out);
}

function createBoardVisualDiagnostics(options?: { enabled?: boolean; capacity?: number }) {
  const enabled = options?.enabled === true;
  const capacity = Math.max(16, Math.min(2048, Math.trunc(Number(options?.capacity) || 256)));
  const entries: DiagnosticEntry[] = [];
  let index = 0;
  return Object.freeze({
    enabled,
    record(event: string, detail?: unknown) {
      if (!enabled) return;
      entries.push(Object.freeze({ index: index++, event: String(event), detail: cloneForDiagnostics(detail) }));
      if (entries.length > capacity) entries.splice(0, entries.length - capacity);
    },
    snapshot() {
      return Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));
    }
  });
}

function assertDebugSource(source: BoardVisualDebugSource): void {
  const requiredMethods: readonly (keyof BoardVisualDebugSource)[] = [
    'getBackendKind',
    'getBackendDiagnostics',
    'getMode',
    'getVisualFrameDigest',
    'getRenderedCell',
    'getCellClientRect',
    'getDisplayObjectCounts',
    'getTextureLeaseCounts',
    'waitForIdle'
  ];
  for (const method of requiredMethods) {
    if (!source || typeof source[method] !== 'function') {
      throw new Error(`Board visual diagnostics source is missing ${method}`);
    }
  }
}

function normalizeCoordinate(value: unknown): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) throw new TypeError('Board diagnostic coordinates must be finite numbers');
  return Math.trunc(numberValue);
}

function installBoardVisualDebugContract(
  root: any,
  diagnostics: ReturnType<typeof createBoardVisualDiagnostics>,
  source: BoardVisualDebugSource
) {
  if (!root || diagnostics.enabled !== true) return false;
  assertDebugSource(source);
  const contract = Object.freeze({
    getBackendKind: () => String(source.getBackendKind()),
    getBackendDiagnostics: () => cloneForDiagnostics(source.getBackendDiagnostics()),
    getDiagnosticEntries: () => cloneForDiagnostics(diagnostics.snapshot()),
    getWriterMode: () => String(source.getMode()),
    getVisualFrameDigest: () => cloneForDiagnostics(source.getVisualFrameDigest()),
    getRenderedCell: (row: number, col: number) => cloneForDiagnostics(
      source.getRenderedCell(normalizeCoordinate(row), normalizeCoordinate(col))
    ),
    getCellClientRect: (row: number, col: number) => cloneForDiagnostics(
      source.getCellClientRect(normalizeCoordinate(row), normalizeCoordinate(col))
    ),
    getDisplayObjectCounts: () => cloneForDiagnostics(source.getDisplayObjectCounts()),
    getTextureLeaseCounts: () => cloneForDiagnostics(source.getTextureLeaseCounts()),
    waitForIdle: async () => {
      await source.waitForIdle();
    }
  });
  Object.defineProperty(root, '__boardVisualDebug', {
    value: contract,
    configurable: true,
    enumerable: false,
    writable: false
  });
  return true;
}

export = {
  createBoardVisualDiagnostics,
  installBoardVisualDebugContract
};
