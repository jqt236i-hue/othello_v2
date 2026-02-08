/**
 * @file policy-table-runtime.js
 * @description Runtime loader/query helper for policy-table models.
 */

'use strict';

const MODEL_SCHEMA_VERSION = 'policy_table.v2';
const DEFAULT_MODEL_URL = 'data/models/policy-table.json';

let _model = null;
let _config = {
    enabled: true,
    minLevel: 4
};
let _lastError = null;
let _sourceUrl = DEFAULT_MODEL_URL;

function toCellChar(v) {
    if (v === 1) return 'B';
    if (v === -1) return 'W';
    return '.';
}

function encodeBoard(board) {
    if (!Array.isArray(board)) return '';
    return board
        .map((row) => Array.isArray(row) ? row.map((v) => toCellChar(v)).join('') : '')
        .join('/');
}

function transformCoord(row, col, size, t) {
    if (t === 0) return { row, col };
    if (t === 1) return { row: col, col: size - 1 - row };
    if (t === 2) return { row: size - 1 - row, col: size - 1 - col };
    if (t === 3) return { row: size - 1 - col, col: row };
    if (t === 4) return { row, col: size - 1 - col };
    if (t === 5) return { row: size - 1 - col, col: size - 1 - row };
    if (t === 6) return { row: size - 1 - row, col };
    if (t === 7) return { row: col, col: row };
    return { row, col };
}

function decodeBoard(boardStr) {
    if (!boardStr || typeof boardStr !== 'string') return [];
    return boardStr.split('/').map((row) => row.split(''));
}

function transformBoard(board, t) {
    if (!Array.isArray(board) || !board.length) return [];
    const size = board.length;
    const out = Array.from({ length: size }, () => Array.from({ length: size }, () => '.'));
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const next = transformCoord(r, c, size, t);
            out[next.row][next.col] = board[r][c];
        }
    }
    return out;
}

function canonicalizeBoard(board) {
    const raw = encodeBoard(board);
    if (!raw) return { boardKey: raw, transformId: 0 };
    const decoded = decodeBoard(raw);
    let best = null;
    let bestT = 0;
    for (let t = 0; t < 8; t++) {
        const encoded = encodeBoard(transformBoard(decoded, t));
        if (best === null || encoded < best) {
            best = encoded;
            bestT = t;
        }
    }
    return { boardKey: best || raw, transformId: bestT };
}

function makeStateKey(playerKey, board, pendingType, legalMovesCount) {
    const pending = pendingType || '-';
    const legalMoves = Number.isFinite(legalMovesCount) ? legalMovesCount : 0;
    const boardKey = (typeof board === 'string') ? board : encodeBoard(board);
    return `${playerKey}|${boardKey}|${pending}|${legalMoves}`;
}

function makeActionKeyFromMove(move) {
    if (!move || !Number.isFinite(move.row) || !Number.isFinite(move.col)) return '';
    return `place:${move.row}:${move.col}`;
}

function cellType(row, col, size) {
    const n = Number.isFinite(size) && size > 0 ? size : 8;
    if ((row === 0 || row === n - 1) && (col === 0 || col === n - 1)) return 'corner';
    if ((row === 1 || row === n - 2) && (col === 1 || col === n - 2)) return 'x';
    const nearTB = (row === 0 || row === n - 1) && (col === 1 || col === n - 2);
    const nearLR = (col === 0 || col === n - 1) && (row === 1 || row === n - 2);
    if (nearTB || nearLR) return 'c';
    if (row === 0 || row === n - 1 || col === 0 || col === n - 1) return 'edge';
    return 'inner';
}

function makeAbstractActionKeyFromMove(move, boardSize) {
    if (!move || !Number.isFinite(move.row) || !Number.isFinite(move.col)) return 'place_cat:unknown';
    return `place_cat:${cellType(move.row, move.col, boardSize)}`;
}

function countEmptiesInBoardKey(boardKey) {
    if (typeof boardKey !== 'string' || !boardKey) return 0;
    let count = 0;
    for (let i = 0; i < boardKey.length; i++) if (boardKey[i] === '.') count++;
    return count;
}

function discDiffFromPlayer(boardKey, playerKey) {
    if (typeof boardKey !== 'string') return 0;
    let b = 0;
    let w = 0;
    for (let i = 0; i < boardKey.length; i++) {
        if (boardKey[i] === 'B') b++;
        if (boardKey[i] === 'W') w++;
    }
    return playerKey === 'black' ? (b - w) : (w - b);
}

function cornerDiffFromPlayer(boardKey, playerKey) {
    const rows = typeof boardKey === 'string' ? boardKey.split('/') : [];
    if (!rows.length) return 0;
    const size = rows.length;
    const own = playerKey === 'black' ? 'B' : 'W';
    const opp = own === 'B' ? 'W' : 'B';
    const corners = [
        [0, 0],
        [0, size - 1],
        [size - 1, 0],
        [size - 1, size - 1]
    ];
    let ownCount = 0;
    let oppCount = 0;
    for (const p of corners) {
        const ch = rows[p[0]][p[1]];
        if (ch === own) ownCount++;
        else if (ch === opp) oppCount++;
    }
    return ownCount - oppCount;
}

function toBucket(value, steps) {
    for (let i = 0; i < steps.length; i++) {
        if (value <= steps[i]) return String(steps[i]);
    }
    return `>${steps[steps.length - 1]}`;
}

function makeAbstractStateKey(playerKey, board, pendingType, legalMovesCount) {
    const canonical = canonicalizeBoard(board);
    const boardKey = canonical.boardKey || '';
    const pending = pendingType || '-';
    const legalMoves = Number.isFinite(legalMovesCount) ? legalMovesCount : 0;
    const empties = countEmptiesInBoardKey(boardKey);
    const phase = empties >= 44 ? 'opening' : (empties >= 16 ? 'mid' : 'end');
    const mobilityBucket = toBucket(legalMoves, [0, 2, 4, 6, 10, 20]);
    const discBucket = toBucket(discDiffFromPlayer(boardKey, playerKey), [-20, -10, -4, 0, 4, 10, 20]);
    const cornerBucket = toBucket(cornerDiffFromPlayer(boardKey, playerKey), [-4, -2, -1, 0, 1, 2, 4]);
    return `${playerKey}|${pending}|${phase}|mob:${mobilityBucket}|disc:${discBucket}|corner:${cornerBucket}`;
}

function makeActionKeyFromMoveWithTransform(move, transformId, boardSize) {
    if (!move || !Number.isFinite(move.row) || !Number.isFinite(move.col)) return '';
    const size = Number.isFinite(boardSize) ? boardSize : 8;
    const p = transformCoord(move.row, move.col, size, transformId);
    return `place:${p.row}:${p.col}`;
}

function isValidModel(model) {
    if (!model || typeof model !== 'object') return false;
    if (model.schemaVersion !== 'policy_table.v1' && model.schemaVersion !== MODEL_SCHEMA_VERSION) return false;
    if (!model.states || typeof model.states !== 'object') return false;
    return true;
}

function getStateEntry(playerKey, board, pendingType, legalMovesCount) {
    if (!_model || !_model.states) return null;
    const schema = _model.schemaVersion;
    if (schema === 'policy_table.v1') {
        const key = makeStateKey(playerKey, board, pendingType, legalMovesCount);
        return _model.states[key] ? { entry: _model.states[key], abstract: false } : null;
    }
    const canonicalKey = makeStateKey(playerKey, canonicalizeBoard(board).boardKey, pendingType, legalMovesCount);
    if (_model.states[canonicalKey]) return { entry: _model.states[canonicalKey], abstract: false };
    // Backward-compatible fallback: allow non-canonical key in v2 payloads.
    const rawKey = makeStateKey(playerKey, board, pendingType, legalMovesCount);
    if (_model.states[rawKey]) return { entry: _model.states[rawKey], abstract: false };
    if (_model.abstractStates && typeof _model.abstractStates === 'object') {
        const abstractKey = makeAbstractStateKey(playerKey, board, pendingType, legalMovesCount);
        if (_model.abstractStates[abstractKey]) return { entry: _model.abstractStates[abstractKey], abstract: true };
    }
    return null;
}

function setModel(model, options) {
    if (!isValidModel(model)) {
        _lastError = new Error(`invalid model schema (expected ${MODEL_SCHEMA_VERSION})`);
        return false;
    }
    _model = model;
    _lastError = null;
    if (options && typeof options.url === 'string' && options.url.trim()) {
        _sourceUrl = options.url.trim();
    }
    return true;
}

function clearModel() {
    _model = null;
    _lastError = null;
}

function hasModel() {
    return !!(_model && _model.states);
}

function getStatus() {
    return {
        enabled: _config.enabled === true,
        minLevel: _config.minLevel,
        loaded: hasModel(),
        schemaVersion: hasModel() ? _model.schemaVersion : null,
        statesCount: hasModel() ? Object.keys(_model.states).length : 0,
        sourceUrl: _sourceUrl,
        lastError: _lastError ? _lastError.message : null
    };
}

function configure(config) {
    if (!config || typeof config !== 'object') return getStatus();
    if (typeof config.enabled === 'boolean') _config.enabled = config.enabled;
    if (Number.isFinite(config.minLevel)) _config.minLevel = Math.max(1, Math.floor(config.minLevel));
    if (typeof config.sourceUrl === 'string' && config.sourceUrl.trim()) _sourceUrl = config.sourceUrl.trim();
    return getStatus();
}

async function loadFromUrl(url, fetchImpl) {
    const target = (typeof url === 'string' && url.trim()) ? url.trim() : _sourceUrl;
    const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
    if (!f) {
        _lastError = new Error('fetch is not available');
        return false;
    }
    try {
        const response = await f(target, { cache: 'no-store' });
        if (!response || !response.ok) {
            _lastError = new Error(`model fetch failed: ${response ? response.status : 'no_response'}`);
            return false;
        }
        const model = await response.json();
        const ok = setModel(model, { url: target });
        if (!ok && !_lastError) _lastError = new Error('invalid model');
        return ok;
    } catch (err) {
        _lastError = err instanceof Error ? err : new Error(String(err));
        return false;
    }
}

function chooseMove(candidateMoves, context) {
    if (!_config.enabled) return null;
    if (!hasModel()) return null;
    if (!Array.isArray(candidateMoves) || candidateMoves.length === 0) return null;

    const ctx = context || {};
    const level = Number.isFinite(ctx.level) ? ctx.level : 1;
    if (level < _config.minLevel) return null;

    const playerKey = ctx.playerKey === 'black' ? 'black' : 'white';
    const legalMovesCount = Number.isFinite(ctx.legalMovesCount) ? ctx.legalMovesCount : candidateMoves.length;
    const schema = _model.schemaVersion;
    const canonical = schema === 'policy_table.v1' ? { boardKey: encodeBoard(ctx.board), transformId: 0 } : canonicalizeBoard(ctx.board);
    const stateMeta = getStateEntry(playerKey, ctx.board, ctx.pendingType || null, legalMovesCount);
    if (!stateMeta || !stateMeta.entry || !stateMeta.entry.actions || typeof stateMeta.entry.actions !== 'object') return null;
    if (stateMeta.abstract) return null;
    const boardSize = Array.isArray(ctx.board) ? ctx.board.length : 8;

    let bestMove = null;
    let bestScore = -Infinity;

    for (const move of candidateMoves) {
        let actionKey = schema === 'policy_table.v1'
            ? makeActionKeyFromMove(move)
            : makeActionKeyFromMoveWithTransform(move, canonical.transformId, boardSize);
        if (stateMeta.abstract) {
            actionKey = makeAbstractActionKeyFromMove(move, boardSize);
        }
        const stat = stateMeta.entry.actions[actionKey];
        if (!stat) continue;

        const visits = Number.isFinite(stat.visits) ? stat.visits : 0;
        const avgOutcome = Number.isFinite(stat.avgOutcome) ? stat.avgOutcome : 0;
        const isBestAction = stateMeta.entry.bestAction === actionKey ? 1 : 0;
        const score = (isBestAction * 1_000_000) + (visits * 1_000) + avgOutcome;
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }

    return bestMove;
}

function getActionScore(move, context) {
    if (!_config.enabled) return null;
    if (!hasModel()) return null;
    if (!move) return null;

    const ctx = context || {};
    const level = Number.isFinite(ctx.level) ? ctx.level : 1;
    if (level < _config.minLevel) return null;

    const playerKey = ctx.playerKey === 'black' ? 'black' : 'white';
    const legalMovesCount = Number.isFinite(ctx.legalMovesCount) ? ctx.legalMovesCount : 0;
    const schema = _model.schemaVersion;
    const canonical = schema === 'policy_table.v1' ? { boardKey: encodeBoard(ctx.board), transformId: 0 } : canonicalizeBoard(ctx.board);
    const stateMeta = getStateEntry(playerKey, ctx.board, ctx.pendingType || null, legalMovesCount);
    if (!stateMeta || !stateMeta.entry || !stateMeta.entry.actions || typeof stateMeta.entry.actions !== 'object') return null;
    if (stateMeta.abstract) return null;

    const boardSize = Array.isArray(ctx.board) ? ctx.board.length : 8;
    let actionKey = schema === 'policy_table.v1'
        ? makeActionKeyFromMove(move)
        : makeActionKeyFromMoveWithTransform(move, canonical.transformId, boardSize);
    if (stateMeta.abstract) {
        actionKey = makeAbstractActionKeyFromMove(move, boardSize);
    }
    const stat = stateMeta.entry.actions[actionKey];
    if (!stat) return null;

    const visits = Number.isFinite(stat.visits) ? stat.visits : 0;
    const avgOutcome = Number.isFinite(stat.avgOutcome) ? stat.avgOutcome : 0;
    const bestBonus = stateMeta.entry.bestAction === actionKey ? 1_000_000 : 0;
    return bestBonus + (visits * 1_000) + avgOutcome;
}

function getActionScoreForKey(actionKey, context) {
    if (!_config.enabled) return null;
    if (!hasModel()) return null;
    if (!actionKey || typeof actionKey !== 'string') return null;

    const ctx = context || {};
    const level = Number.isFinite(ctx.level) ? ctx.level : 1;
    if (level < _config.minLevel) return null;

    const playerKey = ctx.playerKey === 'black' ? 'black' : 'white';
    const legalMovesCount = Number.isFinite(ctx.legalMovesCount) ? ctx.legalMovesCount : 0;
    const stateMeta = getStateEntry(playerKey, ctx.board, ctx.pendingType || null, legalMovesCount);
    if (!stateMeta || !stateMeta.entry || !stateMeta.entry.actions || typeof stateMeta.entry.actions !== 'object') return null;
    const stat = stateMeta.entry.actions[actionKey];
    if (!stat) return null;
    const visits = Number.isFinite(stat.visits) ? stat.visits : 0;
    const avgOutcome = Number.isFinite(stat.avgOutcome) ? stat.avgOutcome : 0;
    const bestBonus = stateMeta.entry.bestAction === actionKey ? 1_000_000 : 0;
    return bestBonus + (visits * 1_000) + avgOutcome;
}

const Api = {
    MODEL_SCHEMA_VERSION,
    DEFAULT_MODEL_URL,
    configure,
    getStatus,
    setModel,
    clearModel,
    hasModel,
    loadFromUrl,
    chooseMove,
    getActionScore,
    getActionScoreForKey,
    makeStateKey,
    makeActionKeyFromMove,
    canonicalizeBoard,
    encodeBoard
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Api;
}

try {
    if (typeof globalThis !== 'undefined') {
        globalThis.CpuPolicyTableRuntime = Api;
    }
} catch (e) { /* ignore */ }
