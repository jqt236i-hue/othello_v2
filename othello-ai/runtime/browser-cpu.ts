import Engine = require('./engine');

type RuntimeStatus = {
  loaded: boolean;
  valueLoaded: boolean;
};

type BrowserCpuContext = {
  board?: unknown;
  playerKey?: unknown;
  models?: Record<string, unknown>;
  [key: string]: unknown;
};

const status: RuntimeStatus = {
  loaded: false,
  valueLoaded: false
};

function getStatus(): RuntimeStatus {
  return {
    loaded: status.loaded,
    valueLoaded: status.valueLoaded
  };
}

function setStatus(nextStatus: unknown): RuntimeStatus {
  if (!nextStatus || typeof nextStatus !== 'object') return getStatus();
  const record = nextStatus as Partial<RuntimeStatus>;
  status.loaded = record.loaded === true;
  status.valueLoaded = record.valueLoaded === true;
  return getStatus();
}

function chooseMove(legalMoves: Array<{ row: number; col: number; flips?: unknown[] }>, context: BrowserCpuContext | null | undefined) {
  const models = context && context.models && typeof context.models === 'object'
    ? context.models
    : {};
  return Engine.chooseEngineMove(legalMoves, context || {}, models);
}

export = {
  getStatus,
  setStatus,
  chooseMove
};
