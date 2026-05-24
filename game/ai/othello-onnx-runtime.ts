declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const DEFAULT_MODEL_URL = 'data/models/othello/policy-value.onnx';
const DEFAULT_META_URL = 'data/models/othello/policy-value.onnx.meta.json';
const INPUT_DIM = 80;
const BOARD_SIZE = 8;
const BOARD_CELLS = 64;

let _ort: any = null;
try { _ort = _require('onnxruntime-web'); } catch (e) { /* optional browser dependency */ }

let _session: any = null;
let _meta: any = null;
let _inputName = 'obs';
let _policyOutputName = 'logits';
let _valueOutputName = 'value';
let _lastError: Error | null = null;
let _sourceUrl = DEFAULT_MODEL_URL;
let _metaUrl = DEFAULT_META_URL;
let _chooseMoveCalls = 0;
let _evaluatePositionCalls = 0;
let _inferenceCalls = 0;
let _inferenceTotalMs = 0;
let _inferenceMaxMs = 0;
let _config = {
  enabled: true,
  minLevel: 6,
  useValueRerank: false,
  policyWeight: 0.12,
  topK: 8,
  heuristicRerankWeight: 8.0,
  whiteSafetyMultiplier: 1.65,
  ortApi: null as any
};

function configure(config: any) {
  const next = config && typeof config === 'object' ? config : {};
  if (typeof next.enabled === 'boolean') _config.enabled = next.enabled;
  if (Number.isFinite(Number(next.minLevel))) _config.minLevel = Math.max(1, Math.floor(Number(next.minLevel)));
  if (typeof next.useValueRerank === 'boolean') _config.useValueRerank = next.useValueRerank;
  if (Number.isFinite(Number(next.policyWeight))) _config.policyWeight = Math.max(0, Number(next.policyWeight));
  if (Number.isFinite(Number(next.topK))) _config.topK = Math.max(1, Math.floor(Number(next.topK)));
  if (Number.isFinite(Number(next.heuristicRerankWeight))) _config.heuristicRerankWeight = Math.max(0, Number(next.heuristicRerankWeight));
  if (Number.isFinite(Number(next.whiteSafetyMultiplier))) _config.whiteSafetyMultiplier = Math.max(0.1, Number(next.whiteSafetyMultiplier));
  if (typeof next.sourceUrl === 'string' && next.sourceUrl.trim()) _sourceUrl = next.sourceUrl.trim();
  if (typeof next.metaUrl === 'string' && next.metaUrl.trim()) _metaUrl = next.metaUrl.trim();
  if (Object.prototype.hasOwnProperty.call(next, 'ortApi')) _config.ortApi = next.ortApi || null;
  return getStatus();
}

function resolveOrtApi(requireSession: boolean): any {
  let ortApi = _config.ortApi || _ort;
  if (ortApi && typeof ortApi.Tensor === 'function' && (!requireSession || typeof ortApi.InferenceSession === 'function')) {
    return ortApi;
  }
  return null;
}

function clearModel() {
  _session = null;
  _meta = null;
  _inputName = 'obs';
  _policyOutputName = 'logits';
  _valueOutputName = 'value';
  _lastError = null;
  _chooseMoveCalls = 0;
  _evaluatePositionCalls = 0;
  _inferenceCalls = 0;
  _inferenceTotalMs = 0;
  _inferenceMaxMs = 0;
}

function hasModel() {
  return !!_session;
}

async function loadMetaJson(url: string, fetchImpl?: any) {
  const readLocalJson = () => {
    try {
      const fs = _require('fs');
      if (fs && typeof fs.readFileSync === 'function') {
        return JSON.parse(fs.readFileSync(url, 'utf8'));
      }
    } catch (e) {
      return null;
    }
    return null;
  };
  const fetchFn = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!fetchFn) {
    return readLocalJson();
  }
  try {
    const response = await fetchFn(url, { cache: 'no-store' });
    if (!response || response.ok !== true || typeof response.json !== 'function') return null;
    const payload = await response.json();
    return payload && typeof payload === 'object' ? payload : null;
  } catch (e) {
    return readLocalJson();
  }
}

async function loadFromUrl(modelUrl?: string, metaUrl?: string, fetchImpl?: any) {
  const ortApi = resolveOrtApi(true);
  if (!ortApi) {
    _lastError = new Error('onnxruntime-web is not available');
    return false;
  }
  const targetModel = (typeof modelUrl === 'string' && modelUrl.trim()) ? modelUrl.trim() : _sourceUrl;
  const targetMeta = (typeof metaUrl === 'string' && metaUrl.trim()) ? metaUrl.trim() : _metaUrl;
  try {
    const session = await ortApi.InferenceSession.create(targetModel, { executionProviders: ['wasm'] });
    const meta = await loadMetaJson(targetMeta, fetchImpl);
    _session = session;
    _meta = meta || { inputDim: INPUT_DIM, outputDim: BOARD_CELLS };
    _inputName = (_meta && _meta.inputName) || (session.inputNames && session.inputNames[0]) || 'obs';
    _policyOutputName = (_meta && (_meta.placeOutputName || _meta.policyOutputName || _meta.outputName)) ||
      (session.outputNames && session.outputNames[0]) ||
      'logits';
    _valueOutputName = (_meta && (_meta.valueOutputName || _meta.valueOutputName)) ||
      (session.outputNames && session.outputNames[1]) ||
      'value';
    _sourceUrl = targetModel;
    _metaUrl = targetMeta;
    _lastError = null;
    return true;
  } catch (err: any) {
    _session = null;
    _lastError = err instanceof Error ? err : new Error(String(err));
    return false;
  }
}

function getCellValue(board: any, row: number, col: number): number {
  if (!Array.isArray(board) || !Array.isArray(board[row])) return 0;
  const n = Number(board[row][col]);
  return Number.isFinite(n) ? n : 0;
}

function oppositePlayerKey(playerKey: any): 'black' | 'white' {
  return playerKey === 'black' ? 'white' : 'black';
}

function insideBoard(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function getFlips(board: any, row: number, col: number, playerKey: any): Array<{ row: number; col: number }> {
  if (!insideBoard(row, col) || getCellValue(board, row, col) !== 0) return [];
  const own = playerKey === 'black' ? 1 : -1;
  const opp = -own;
  const out: Array<{ row: number; col: number }> = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const line: Array<{ row: number; col: number }> = [];
      let rr = row + dr;
      let cc = col + dc;
      while (insideBoard(rr, cc) && getCellValue(board, rr, cc) === opp) {
        line.push({ row: rr, col: cc });
        rr += dr;
        cc += dc;
      }
      if (line.length > 0 && insideBoard(rr, cc) && getCellValue(board, rr, cc) === own) {
        out.push(...line);
      }
    }
  }
  return out;
}

function applyMoveForRerank(board: any, move: any, playerKey: any) {
  if (!Array.isArray(board)) return null;
  const row = Number(move && move.row);
  const col = Number(move && move.col);
  if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
  const flips = Array.isArray(move && move.flips) && move.flips.length > 0
    ? move.flips
    : getFlips(board, row, col, playerKey);
  if (!Array.isArray(flips) || flips.length <= 0) return null;
  const next = board.map((one: any) => Array.isArray(one) ? one.slice() : []);
  const own = playerKey === 'black' ? 1 : -1;
  next[row][col] = own;
  for (const flip of flips) {
    const rr = Number(flip && flip.row);
    const cc = Number(flip && flip.col);
    if (Number.isInteger(rr) && Number.isInteger(cc) && insideBoard(rr, cc)) next[rr][cc] = own;
  }
  return next;
}

function countLegalMovesForPlayer(board: any, playerKey: any): number {
  if (!Array.isArray(board)) return 0;
  let count = 0;
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (getFlips(board, row, col, playerKey).length > 0) count += 1;
    }
  }
  return count;
}

function countDiscsForPlayer(board: any, playerKey: any) {
  const ownValue = playerKey === 'black' ? 1 : -1;
  let own = 0;
  let opp = 0;
  if (!Array.isArray(board)) return { own, opp };
  for (const row of board) {
    if (!Array.isArray(row)) continue;
    for (const cell of row) {
      if (cell === ownValue) own += 1;
      else if (cell === -ownValue) opp += 1;
    }
  }
  return { own, opp };
}

function isCornerMove(move: any): boolean {
  const row = Number(move && move.row);
  const col = Number(move && move.col);
  return (row === 0 || row === 7) && (col === 0 || col === 7);
}

function isEdgeMove(move: any): boolean {
  const row = Number(move && move.row);
  const col = Number(move && move.col);
  return !isCornerMove(move) && (row === 0 || row === 7 || col === 0 || col === 7);
}

function isXSquareMove(move: any): boolean {
  const row = Number(move && move.row);
  const col = Number(move && move.col);
  return (row === 1 || row === 6) && (col === 1 || col === 6);
}

function isCSquareMove(move: any): boolean {
  const row = Number(move && move.row);
  const col = Number(move && move.col);
  return (
    ((row === 0 || row === 7) && (col === 1 || col === 6)) ||
    ((col === 0 || col === 7) && (row === 1 || row === 6))
  );
}

function adjacentCornerForTrap(move: any): { row: number; col: number } | null {
  const row = Number(move && move.row);
  const col = Number(move && move.col);
  if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
  if (row <= 1 && col <= 1) return { row: 0, col: 0 };
  if (row <= 1 && col >= 6) return { row: 0, col: 7 };
  if (row >= 6 && col <= 1) return { row: 7, col: 0 };
  if (row >= 6 && col >= 6) return { row: 7, col: 7 };
  return null;
}

function countEmptyCells(board: any): number {
  if (!Array.isArray(board)) return BOARD_CELLS;
  let empty = 0;
  for (const row of board) {
    if (!Array.isArray(row)) continue;
    for (const cell of row) {
      if (Number(cell) === 0) empty += 1;
    }
  }
  return empty;
}

function scoreMoveSafety(board: any, move: any, playerKey: any, nextBoard?: any): number {
  let score = 0;
  if (isCornerMove(move)) score += 1.0;
  else if (isEdgeMove(move)) score += 0.24;
  if (isXSquareMove(move)) score -= 0.82;
  if (isCSquareMove(move)) score -= 0.46;
  const trapCorner = adjacentCornerForTrap(move);
  if (trapCorner && getCellValue(board, trapCorner.row, trapCorner.col) === 0) score -= 0.58;
  const flips = Array.isArray(move && move.flips) ? move.flips.length : 0;
  const emptyCells = countEmptyCells(board);
  if (emptyCells <= 14) score += Math.max(-0.32, Math.min(0.32, flips * 0.028));
  else score -= Math.min(0.18, Math.max(0, flips - 2) * 0.018);
  const resolvedNextBoard = nextBoard || applyMoveForRerank(board, move, playerKey);
  if (resolvedNextBoard) {
    const opponentKey = oppositePlayerKey(playerKey);
    const ownLegal = countLegalMovesForPlayer(resolvedNextBoard, playerKey);
    const oppLegal = countLegalMovesForPlayer(resolvedNextBoard, opponentKey);
    const discs = countDiscsForPlayer(resolvedNextBoard, playerKey);
    score += Math.max(-0.42, Math.min(0.42, (ownLegal - oppLegal) * 0.055));
    score -= Math.max(-0.28, Math.min(0.28, oppLegal * 0.026));
    const discDelta = discs.own - discs.opp;
    if (emptyCells <= 16) score += Math.max(-0.36, Math.min(0.36, discDelta / 72));
    else score -= Math.max(-0.14, Math.min(0.14, discDelta / 120));
    if (ownLegal <= 1 && oppLegal >= 5) score -= 0.45;
    if (oppLegal <= 1 && ownLegal >= 4) score += 0.34;
  }
  return score;
}

function selectPolicyCandidateMoves(candidates: any[], tensor: any) {
  const ranked = candidates
    .map((move) => {
      const idx = actionIndexFromMove(move);
      const policyScore = idx >= 0 && idx < tensor.data.length ? Number(tensor.data[idx]) : Number.NEGATIVE_INFINITY;
      return { move, policyScore: Number.isFinite(policyScore) ? policyScore : Number.NEGATIVE_INFINITY };
    })
    .filter((one) => Number.isFinite(one.policyScore));
  ranked.sort((a, b) => {
    if (b.policyScore !== a.policyScore) return b.policyScore - a.policyScore;
    const ar = Number(a.move && a.move.row);
    const br = Number(b.move && b.move.row);
    if (ar !== br) return ar - br;
    return Number(a.move && a.move.col) - Number(b.move && b.move.col);
  });
  const topK = Math.max(1, Math.min(candidates.length, _config.topK));
  const out = ranked.slice(0, topK);
  for (const move of candidates) {
    if (isCornerMove(move) && !out.some((one) => one.move === move)) {
      const idx = actionIndexFromMove(move);
      const policyScore = idx >= 0 && idx < tensor.data.length ? Number(tensor.data[idx]) : 0;
      out.push({ move, policyScore: Number.isFinite(policyScore) ? policyScore : 0 });
    }
  }
  return out.length > 0 ? out : candidates.map((move) => ({ move, policyScore: 0 }));
}

function buildInputVector(context: any): Float32Array {
  const ctx = context || {};
  const board = Array.isArray(ctx.board) ? ctx.board : [];
  const playerKey = ctx.playerKey === 'black' ? 'black' : 'white';
  const sign = playerKey === 'black' ? 1 : -1;
  const out = new Float32Array(INPUT_DIM);
  let own = 0;
  let opp = 0;
  let empty = 0;
  let ownCorners = 0;
  let oppCorners = 0;
  let ownEdges = 0;
  let oppEdges = 0;
  let idx = 0;
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const v = getCellValue(board, row, col);
      const isCorner = (row === 0 || row === 7) && (col === 0 || col === 7);
      const isEdge = !isCorner && (row === 0 || row === 7 || col === 0 || col === 7);
      if (v === sign) {
        out[idx] = 1;
        own += 1;
        if (isCorner) ownCorners += 1;
        if (isEdge) ownEdges += 1;
      } else if (v === -sign) {
        out[idx] = -1;
        opp += 1;
        if (isCorner) oppCorners += 1;
        if (isEdge) oppEdges += 1;
      } else {
        empty += 1;
      }
      idx += 1;
    }
  }
  const legalMoves = Number.isFinite(Number(ctx.legalMovesCount)) ? Number(ctx.legalMovesCount) : 0;
  const phaseOpening = empty >= 44 ? 1 : 0;
  const phaseEnd = empty < 16 ? 1 : 0;
  const phaseMid = phaseOpening || phaseEnd ? 0 : 1;
  out[64] = legalMoves / 30;
  out[65] = (own - opp) / 64;
  out[66] = own / 64;
  out[67] = opp / 64;
  out[68] = empty / 64;
  out[69] = ownCorners / 4;
  out[70] = oppCorners / 4;
  out[71] = ownEdges / 28;
  out[72] = oppEdges / 28;
  out[73] = playerKey === 'black' ? 1 : -1;
  out[74] = phaseOpening;
  out[75] = phaseMid;
  out[76] = phaseEnd;
  return out;
}

function actionIndexFromMove(move: any): number {
  const row = Number(move && move.row);
  const col = Number(move && move.col);
  if (!Number.isInteger(row) || !Number.isInteger(col)) return -1;
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return -1;
  return (row * BOARD_SIZE) + col;
}

async function runInference(context: any) {
  if (!_session) return null;
  const ortApi = resolveOrtApi(false);
  if (!ortApi) return null;
  const startedAt = Date.now();
  const x = buildInputVector(context);
  const feeds: any = {};
  feeds[_inputName] = new ortApi.Tensor('float32', x, [1, x.length]);
  try {
    return await _session.run(feeds);
  } finally {
    const elapsed = Math.max(0, Date.now() - startedAt);
    _inferenceCalls += 1;
    _inferenceTotalMs += elapsed;
    if (elapsed > _inferenceMaxMs) _inferenceMaxMs = elapsed;
  }
}

function resolveTensor(outputs: any, preferredName: string, fallbackIndex: number) {
  if (!outputs || typeof outputs !== 'object') return null;
  if (outputs[preferredName] && outputs[preferredName].data) return outputs[preferredName];
  const keys = Object.keys(outputs);
  const key = keys[fallbackIndex] || keys[0];
  return key ? outputs[key] : null;
}

async function chooseMove(candidates: any[], context: any) {
  _chooseMoveCalls += 1;
  if (!_config.enabled || !_session) return null;
  if (!Array.isArray(candidates) || candidates.length <= 0) return null;
  const level = Number.isFinite(Number(context && context.level)) ? Number(context.level) : 1;
  if (level < _config.minLevel) return null;
  try {
    const outputs = await runInference(Object.assign({}, context || {}, { candidateMoves: candidates }));
    const tensor = resolveTensor(outputs, _policyOutputName, 0);
    if (!tensor || !tensor.data) return null;
    const valueRerank = _config.useValueRerank === true && context && Array.isArray(context.board);
    let best: any = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    const rankedCandidates = selectPolicyCandidateMoves(candidates, tensor);
    for (const ranked of rankedCandidates) {
      const move = ranked.move;
      let score = Number(ranked.policyScore) * _config.policyWeight;
      let safetyScore = 0;
      if (valueRerank) {
        const playerKey = context && context.playerKey === 'black' ? 'black' : 'white';
        const nextBoard = applyMoveForRerank(context.board, move, playerKey);
        safetyScore = scoreMoveSafety(context.board, move, playerKey, nextBoard);
        if (nextBoard) {
          const nextPlayerKey = oppositePlayerKey(playerKey);
          const nextOutputs = await runInference({
            board: nextBoard,
            playerKey: nextPlayerKey,
            level,
            legalMovesCount: countLegalMovesForPlayer(nextBoard, nextPlayerKey)
          });
          const valueTensor = resolveTensor(nextOutputs, _valueOutputName, 1);
          if (valueTensor && valueTensor.data && valueTensor.data.length > 0 && Number.isFinite(Number(valueTensor.data[0]))) {
            score = -Number(valueTensor.data[0]);
          }
        }
      } else if (context && Array.isArray(context.board)) {
        const playerKey = context && context.playerKey === 'black' ? 'black' : 'white';
        safetyScore = scoreMoveSafety(context.board, move, playerKey);
      }
      const playerKey = context && context.playerKey === 'black' ? 'black' : 'white';
      const safetyMultiplier = playerKey === 'white' ? _config.whiteSafetyMultiplier : 1;
      if (_config.heuristicRerankWeight > 0) score += safetyScore * _config.heuristicRerankWeight * safetyMultiplier;
      if (!Number.isFinite(score)) continue;
      if (score > bestScore || (score === bestScore && best && (move.row < best.row || (move.row === best.row && move.col < best.col)))) {
        best = move;
        bestScore = score;
      }
    }
    return best;
  } catch (err: any) {
    _lastError = err instanceof Error ? err : new Error(String(err));
    return null;
  }
}

async function evaluatePosition(context: any) {
  _evaluatePositionCalls += 1;
  if (!_config.enabled || !_session) return null;
  try {
    const outputs = await runInference(context || {});
    const tensor = resolveTensor(outputs, _valueOutputName, 1);
    const value = tensor && tensor.data && tensor.data.length > 0 ? Number(tensor.data[0]) : NaN;
    return Number.isFinite(value) ? value : null;
  } catch (err: any) {
    _lastError = err instanceof Error ? err : new Error(String(err));
    return null;
  }
}

function getStatus() {
  return {
    enabled: _config.enabled,
    minLevel: _config.minLevel,
    useValueRerank: _config.useValueRerank === true,
    policyWeight: _config.policyWeight,
    topK: _config.topK,
    heuristicRerankWeight: _config.heuristicRerankWeight,
    whiteSafetyMultiplier: _config.whiteSafetyMultiplier,
    loaded: hasModel(),
    sourceUrl: _sourceUrl,
    metaUrl: _metaUrl,
    schemaVersion: _meta && _meta.schemaVersion ? _meta.schemaVersion : null,
    inputDim: _meta && Number.isFinite(Number(_meta.inputDim)) ? Number(_meta.inputDim) : INPUT_DIM,
    outputDim: _meta && Number.isFinite(Number(_meta.outputDim)) ? Number(_meta.outputDim) : BOARD_CELLS,
    chooseMoveCalls: _chooseMoveCalls,
    evaluatePositionCalls: _evaluatePositionCalls,
    inferenceCalls: _inferenceCalls,
    inferenceAverageMs: _inferenceCalls > 0 ? _inferenceTotalMs / _inferenceCalls : 0,
    inferenceMaxMs: _inferenceMaxMs,
    lastError: _lastError ? _lastError.message : null
  };
}

const Api = {
  DEFAULT_MODEL_URL,
  DEFAULT_META_URL,
  configure,
  clearModel,
  hasModel,
  loadFromUrl,
  chooseMove,
  evaluatePosition,
  getStatus
};

export = Api;
