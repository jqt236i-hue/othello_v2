// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

import type { CardState, GameState, PlayerKey } from '../../src/types';

/**
 * @file policy-table-runtime.js
 * @description Runtime loader/query helper for policy-table models.
 */

(() => {


const POLICY_TABLE_MODEL_SCHEMA_VERSION = 'policy_table.v2';
const DEFAULT_MODEL_URL = 'data/models/policy-table.json';
const MODEL_HEURISTIC_WEIGHT = 1;
let SharedBoardUtils = null;
try {
    if (typeof require === 'function') {
        SharedBoardUtils = require('../../shared/shared-board-utils');
    }
} catch (e) { /* ignore */ }
if (!SharedBoardUtils) {
    try {
        if (typeof globalThis !== 'undefined' && globalThis.SharedBoardUtils) {
            SharedBoardUtils = globalThis.SharedBoardUtils;
        }
    } catch (e) { /* ignore */ }
}

let OthelloCore = null;
try {
    if (typeof require === 'function') {
        OthelloCore = require('../../shared/othello-core');
    }
} catch (e) { /* ignore */ }
if (!OthelloCore) {
    try {
        if (typeof globalThis !== 'undefined' && globalThis.OthelloCore) {
            OthelloCore = globalThis.OthelloCore;
        }
    } catch (e) { /* ignore */ }
}

let _model = null;
let _config = {
    enabled: true,
    minLevel: 6
};
let _lastError = null;
let _sourceUrl = DEFAULT_MODEL_URL;
let _nodeZlib = null;

const POSITION_WEIGHTS = [
    [120, -20, 20, 5, 5, 20, -20, 120],
    [-20, -40, -5, -5, -5, -5, -40, -20],
    [20, -5, 15, 3, 3, 15, -5, 20],
    [5, -5, 3, 3, 3, 3, -5, 5],
    [5, -5, 3, 3, 3, 3, -5, 5],
    [20, -5, 15, 3, 3, 15, -5, 20],
    [-20, -40, -5, -5, -5, -5, -40, -20],
    [120, -20, 20, 5, 5, 20, -20, 120]
];

function toCellChar(v) {
    if (v === 1) return 'B';
    if (v === -1) return 'W';
    return '.';
}

function encodeBoard(board) {
    if (SharedBoardUtils && typeof SharedBoardUtils.encodeBoard === 'function') {
        return SharedBoardUtils.encodeBoard(board);
    }
    if (!Array.isArray(board)) return '';
    return board
        .map((row) => Array.isArray(row) ? row.map((v) => toCellChar(v)).join('') : '')
        .join('/');
}

function encodeBoardRaw(board) {
    if (!Array.isArray(board)) return '';
    return board
        .map((row) => Array.isArray(row) ? row.map((v) => toCellChar(v)).join('') : '')
        .join('/');
}

function transformCoord(row, col, size, t) {
    if (SharedBoardUtils && typeof SharedBoardUtils.transformCoord === 'function') {
        return SharedBoardUtils.transformCoord(row, col, size, t);
    }
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
    if (SharedBoardUtils && typeof SharedBoardUtils.canonicalizeBoard === 'function') {
        return SharedBoardUtils.canonicalizeBoard(board);
    }
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

function canonicalizeBoardRaw(board) {
    const raw = encodeBoardRaw(board);
    if (!raw) return { boardKey: raw, transformId: 0 };
    const decoded = decodeBoard(raw);
    let best = null;
    let bestT = 0;
    for (let t = 0; t < 8; t++) {
        const encoded = encodeBoardRaw(transformBoard(decoded, t));
        if (best === null || encoded < best) {
            best = encoded;
            bestT = t;
        }
    }
    return { boardKey: best || raw, transformId: bestT };
}

function isRawStandard8x8(board) {
    if (!Array.isArray(board) || board.length !== 8) return false;
    for (const row of board) {
        if (!Array.isArray(row) || row.length !== 8) return false;
    }
    return true;
}

function shouldPreferRaw8x8Keys(context, board) {
    return !!(context && context.preferRaw8x8Keys) && isRawStandard8x8(board);
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

function cellType(row, col, boardOrSize) {
    if (SharedBoardUtils && typeof SharedBoardUtils.getCellType === 'function') {
        if (Array.isArray(boardOrSize)) return SharedBoardUtils.getCellType(row, col, boardOrSize);
        const n = Number.isFinite(boardOrSize) && boardOrSize > 0 ? boardOrSize : 8;
        return SharedBoardUtils.getCellType(row, col, n, n);
    }
    const n = Number.isFinite(boardOrSize) && boardOrSize > 0 ? boardOrSize : 8;
    if ((row === 0 || row === n - 1) && (col === 0 || col === n - 1)) return 'corner';
    if ((row === 1 || row === n - 2) && (col === 1 || col === n - 2)) return 'x';
    const nearTB = (row === 0 || row === n - 1) && (col === 1 || col === n - 2);
    const nearLR = (col === 0 || col === n - 1) && (row === 1 || row === n - 2);
    if (nearTB || nearLR) return 'c';
    if (row === 0 || row === n - 1 || col === 0 || col === n - 1) return 'edge';
    return 'inner';
}

function makeAbstractActionKeyFromMove(move, boardShapeOrSize) {
    if (!move || !Number.isFinite(move.row) || !Number.isFinite(move.col)) return 'place_cat:unknown';
    return `place_cat:${cellType(move.row, move.col, boardShapeOrSize)}`;
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
    const pending = pendingType || '-';
    const legalMoves = Number.isFinite(legalMovesCount) ? legalMovesCount : 0;
    const boardKey = typeof board === 'string' ? board : '';
    const empties = Array.isArray(board) ? countEmpties(board) : countEmptiesInBoardKey(boardKey);
    const phase = empties >= 44 ? 'opening' : (empties >= 16 ? 'mid' : 'end');
    const mobilityBucket = toBucket(legalMoves, [0, 2, 4, 6, 10, 20]);
    const discDiff = Array.isArray(board) ? countDiscsFor(board, playerKey) : discDiffFromPlayer(boardKey, playerKey);
    const cornerDiff = Array.isArray(board) ? countCornersFor(board, playerKey) : cornerDiffFromPlayer(boardKey, playerKey);
    const discBucket = toBucket(discDiff, [-20, -10, -4, 0, 4, 10, 20]);
    const cornerBucket = toBucket(cornerDiff, [-4, -2, -1, 0, 1, 2, 4]);
    return `${playerKey}|${pending}|${phase}|mob:${mobilityBucket}|disc:${discBucket}|corner:${cornerBucket}`;
}

function makeAbstractStateKeyRaw(playerKey, board, pendingType, legalMovesCount) {
    const pending = pendingType || '-';
    const legalMoves = Number.isFinite(legalMovesCount) ? legalMovesCount : 0;
    const boardKey = typeof board === 'string' ? board : encodeBoardRaw(board);
    const empties = countEmptiesInBoardKey(boardKey);
    const phase = empties >= 44 ? 'opening' : (empties >= 16 ? 'mid' : 'end');
    const mobilityBucket = toBucket(legalMoves, [0, 2, 4, 6, 10, 20]);
    const discBucket = toBucket(discDiffFromPlayer(boardKey, playerKey), [-20, -10, -4, 0, 4, 10, 20]);
    const cornerBucket = toBucket(cornerDiffFromPlayer(boardKey, playerKey), [-4, -2, -1, 0, 1, 2, 4]);
    return `${playerKey}|${pending}|${phase}|mob:${mobilityBucket}|disc:${discBucket}|corner:${cornerBucket}`;
}

function makeActionKeyFromMoveWithTransform(move, transformId, boardOrSize) {
    if (!move || !Number.isFinite(move.row) || !Number.isFinite(move.col)) return '';
    if (Array.isArray(boardOrSize) && SharedBoardUtils && typeof SharedBoardUtils.makeCanonicalActionKey === 'function') {
        return SharedBoardUtils.makeCanonicalActionKey(move, boardOrSize, transformId);
    }
    const size = Number.isFinite(boardOrSize) ? boardOrSize : 8;
    const p = transformCoord(move.row, move.col, size, transformId);
    return `place:${p.row}:${p.col}`;
}

function cloneBoard(board) {
    if (SharedBoardUtils && typeof SharedBoardUtils.cloneBoard === 'function') {
        return SharedBoardUtils.cloneBoard(board);
    }
    if (!Array.isArray(board)) return [];
    return board.map((row) => Array.isArray(row) ? row.slice() : []);
}

function applyMoveToBoard(board, move, playerKey) {
    const out = cloneBoard(board);
    if (!move || !Number.isFinite(move.row) || !Number.isFinite(move.col)) return out;
    const own = playerKey === 'black' ? 1 : -1;
    if (SharedBoardUtils && typeof SharedBoardUtils.setCellValue === 'function') {
        SharedBoardUtils.setCellValue(out, move.row, move.col, own);
    } else if (Array.isArray(out[move.row])) {
        out[move.row][move.col] = own;
    }
    const flips = Array.isArray(move.flips) ? move.flips : [];
    for (const f of flips) {
        if (!f || !Number.isFinite(f.row) || !Number.isFinite(f.col)) continue;
        if (SharedBoardUtils && typeof SharedBoardUtils.setCellValue === 'function') {
            SharedBoardUtils.setCellValue(out, f.row, f.col, own);
        } else if (Array.isArray(out[f.row])) {
            out[f.row][f.col] = own;
        }
    }
    return out;
}

function getFlipsBasic(board, row, col, playerValue) {
    if (OthelloCore && typeof OthelloCore.getFlipsBasic === 'function') {
        return OthelloCore.getFlipsBasic(board, row, col, playerValue);
    }
    if (SharedBoardUtils && typeof SharedBoardUtils.getFlipsBasic === 'function') {
        return SharedBoardUtils.getFlipsBasic(board, row, col, playerValue);
    }
    return [];
}

function getLegalMovesBasic(board, playerValue) {
    if (OthelloCore && typeof OthelloCore.getLegalMovesBasic === 'function') {
        return OthelloCore.getLegalMovesBasic(board, playerValue);
    }
    if (SharedBoardUtils && typeof SharedBoardUtils.getLegalMovesBasic === 'function') {
        return SharedBoardUtils.getLegalMovesBasic(board, playerValue);
    }
    const moves = [];
    if (!Array.isArray(board)) return moves;
    for (let r = 0; r < board.length; r++) {
        const row = board[r];
        if (!Array.isArray(row)) continue;
        for (let c = 0; c < row.length; c++) {
            if (row[c] !== 0) continue;
            const flips = getFlipsBasic(board, r, c, playerValue);
            if (flips.length > 0) moves.push({ row: r, col: c, flips });
        }
    }
    return moves;
}

function countDiscsFor(board, playerKey) {
    const own = playerKey === 'black' ? 1 : -1;
    const opp = -own;
    let ownCount = 0;
    let oppCount = 0;
    if (SharedBoardUtils && typeof SharedBoardUtils.collectBoardCoordinates === 'function' && typeof SharedBoardUtils.getCellValue === 'function') {
        for (const cell of SharedBoardUtils.collectBoardCoordinates(board)) {
            const v = SharedBoardUtils.getCellValue(board, cell.row, cell.col);
            if (v === own) ownCount++;
            else if (v === opp) oppCount++;
        }
        return ownCount - oppCount;
    }
    for (let r = 0; r < board.length; r++) {
        for (let c = 0; c < board[r].length; c++) {
            const v = board[r][c];
            if (v === own) ownCount++;
            else if (v === opp) oppCount++;
        }
    }
    return ownCount - oppCount;
}

function countCornersFor(board, playerKey) {
    if (SharedBoardUtils && typeof SharedBoardUtils.countCornerControl === 'function') {
        const playerValue = playerKey === 'black' ? 1 : -1;
        const control = SharedBoardUtils.countCornerControl(board, playerValue);
        return Number(control.ownCorners || 0) - Number(control.oppCorners || 0);
    }
    if (!Array.isArray(board) || !board.length) return 0;
    const own = playerKey === 'black' ? 1 : -1;
    const opp = -own;
    const n = board.length;
    const corners = [[0, 0], [0, n - 1], [n - 1, 0], [n - 1, n - 1]];
    let ownCount = 0;
    let oppCount = 0;
    for (const p of corners) {
        const v = board[p[0]][p[1]];
        if (v === own) ownCount++;
        else if (v === opp) oppCount++;
    }
    return ownCount - oppCount;
}

function countEmpties(board) {
    if (SharedBoardUtils && typeof SharedBoardUtils.countBoardEmpties === 'function') {
        return SharedBoardUtils.countBoardEmpties(board);
    }
    if (!Array.isArray(board)) return 0;
    let empties = 0;
    for (let r = 0; r < board.length; r++) {
        for (let c = 0; c < board[r].length; c++) {
            if (board[r][c] === 0) empties++;
        }
    }
    return empties;
}

function positionalScoreForMove(move) {
    if (!move || !Number.isFinite(move.row) || !Number.isFinite(move.col)) return -99999;
    return (POSITION_WEIGHTS[move.row] && Number.isFinite(POSITION_WEIGHTS[move.row][move.col]))
        ? POSITION_WEIGHTS[move.row][move.col]
        : 0;
}

function estimateMoveHeuristic(move, context) {
    const flips = Array.isArray(move && move.flips) ? move.flips.length : 0;
    const board = Array.isArray(context && context.board) ? context.board : [];
    const playerKey = context && context.playerKey === 'black' ? 'black' : 'white';
    const after = applyMoveToBoard(board, move, playerKey);
    const empties = countEmpties(after);
    const discWeight = empties <= 12 ? 18 : (empties <= 24 ? 8 : 2);
    const discDiff = countDiscsFor(after, playerKey);
    const cornerDiff = countCornersFor(after, playerKey);
    const opponentValue = playerKey === 'black' ? -1 : 1;
    const opponentMoves = getLegalMovesBasic(after, opponentValue);
    let opponentThreat = 0;
    let givesCorner = false;
    for (const oppMove of opponentMoves) {
        const pressure = ((Array.isArray(oppMove.flips) ? oppMove.flips.length : 0) * 80) + (positionalScoreForMove(oppMove) * 8);
        if (pressure > opponentThreat) opponentThreat = pressure;
        const rr = Number.isFinite(oppMove.row) ? oppMove.row : -1;
        const cc = Number.isFinite(oppMove.col) ? oppMove.col : -1;
        if (SharedBoardUtils && typeof SharedBoardUtils.isCorner === 'function') {
            if (SharedBoardUtils.isCorner(rr, cc, after)) givesCorner = true;
        } else {
            const n = Array.isArray(after) ? after.length : 8;
            if ((rr === 0 || rr === n - 1) && (cc === 0 || cc === n - 1)) givesCorner = true;
        }
    }
    const row = Number.isFinite(move && move.row) ? move.row : 0;
    const col = Number.isFinite(move && move.col) ? move.col : 0;
    const tie = (7 - row) * 0.001 + (7 - col) * 0.0001;
    return (
        (flips * 60) +
        (positionalScoreForMove(move) * 8) +
        (discDiff * discWeight) +
        (cornerDiff * 300) +
        (opponentMoves.length * -45) +
        (opponentThreat * -6) +
        (givesCorner ? -1800 : 0) +
        tie
    );
}

function isValidModel(model) {
    if (!model || typeof model !== 'object') return false;
    if (model.schemaVersion !== 'policy_table.v1' && model.schemaVersion !== POLICY_TABLE_MODEL_SCHEMA_VERSION) return false;
    if (!model.states || typeof model.states !== 'object') return false;
    return true;
}

function isRedirectManifest(payload) {
    return !!(payload &&
        typeof payload === 'object' &&
        payload.assetType === 'policy_table.redirect.v1' &&
        typeof payload.url === 'string' &&
        payload.url.trim());
}

function resolveAssetUrl(baseUrl, nextUrl) {
    const raw = typeof nextUrl === 'string' ? nextUrl.trim() : '';
    if (!raw) return '';
    if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('/')) return raw;
    try {
        if (typeof URL === 'function' && typeof baseUrl === 'string' && /^(https?:)?\/\//i.test(baseUrl)) {
            return new URL(raw, baseUrl).toString();
        }
    } catch (e) { /* ignore */ }
    return raw;
}

function getNodeZlib() {
    if (_nodeZlib !== null) return _nodeZlib;
    try {
        if (typeof require === 'function') {
            _nodeZlib = require('zlib');
            return _nodeZlib;
        }
    } catch (e) { /* ignore */ }
    _nodeZlib = false;
    return _nodeZlib;
}

async function gunzipBytes(arrayBuffer) {
    if (typeof DecompressionStream === 'function') {
        const stream = new Blob([arrayBuffer]).stream().pipeThrough(new DecompressionStream('gzip'));
        return await new Response(stream).text();
    }
    const zlib = getNodeZlib();
    if (zlib && typeof zlib.gunzipSync === 'function') {
        return zlib.gunzipSync(Buffer.from(arrayBuffer)).toString('utf8');
    }
    throw new Error('gzip decompression is not available');
}

async function readPolicyTablePayload(response, sourceUrl, fetchImpl) {
    const payload = await response.json();
    if (!isRedirectManifest(payload)) return payload;

    const compression = typeof payload.compression === 'string' ? payload.compression.trim().toLowerCase() : '';
    const redirectUrl = resolveAssetUrl(sourceUrl, payload.url);
    if (!redirectUrl) throw new Error('policy table redirect is missing url');
    if (compression !== 'gzip') throw new Error(`unsupported policy table compression: ${compression || 'unknown'}`);

    const redirectResponse = await fetchImpl(redirectUrl, { cache: 'no-store' });
    if (!redirectResponse || !redirectResponse.ok) {
        throw new Error(`redirect fetch failed: ${redirectResponse ? redirectResponse.status : 'no_response'}`);
    }
    const compressedBytes = await redirectResponse.arrayBuffer();
    const jsonText = await gunzipBytes(compressedBytes);
    return JSON.parse(jsonText);
}

function getStateEntryForModel(model, playerKey, board, pendingType, legalMovesCount, context) {
    if (!model || !model.states) return null;
    const schema = model.schemaVersion;
    const preferRaw8x8Keys = shouldPreferRaw8x8Keys(context, board);
    const canonical = preferRaw8x8Keys ? canonicalizeBoardRaw(board) : canonicalizeBoard(board);
    const rawBoardKey = preferRaw8x8Keys ? encodeBoardRaw(board) : encodeBoard(board);
    if (schema === 'policy_table.v1') {
        const key = makeStateKey(playerKey, preferRaw8x8Keys ? rawBoardKey : board, pendingType, legalMovesCount);
        return model.states[key] ? { entry: model.states[key], abstract: false, keyMode: 'raw' } : null;
    }
    const canonicalKey = makeStateKey(playerKey, canonical.boardKey, pendingType, legalMovesCount);
    if (model.states[canonicalKey]) return { entry: model.states[canonicalKey], abstract: false, keyMode: 'canonical' };
    // Backward-compatible fallback: allow non-canonical key in v2 payloads.
    const rawKey = makeStateKey(playerKey, preferRaw8x8Keys ? rawBoardKey : board, pendingType, legalMovesCount);
    if (model.states[rawKey]) return { entry: model.states[rawKey], abstract: false, keyMode: 'raw' };
    if (model.abstractStates && typeof model.abstractStates === 'object') {
        const abstractKey = preferRaw8x8Keys
            ? makeAbstractStateKeyRaw(playerKey, rawBoardKey, pendingType, legalMovesCount)
            : makeAbstractStateKey(playerKey, board, pendingType, legalMovesCount);
        if (model.abstractStates[abstractKey]) return { entry: model.abstractStates[abstractKey], abstract: true, keyMode: 'abstract' };
    }
    return null;
}

function getStateEntry(playerKey, board, pendingType, legalMovesCount, context) {
    return getStateEntryForModel(_model, playerKey, board, pendingType, legalMovesCount, context);
}

function setModel(model, options) {
    if (!isValidModel(model)) {
        _lastError = new Error(`invalid model schema (expected ${POLICY_TABLE_MODEL_SCHEMA_VERSION})`);
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
        const model = await readPolicyTablePayload(response, target, f);
        const ok = setModel(model, { url: target });
        if (!ok && !_lastError) _lastError = new Error('invalid model');
        return ok;
    } catch (err) {
        _lastError = err instanceof Error ? err : new Error(String(err));
        return false;
    }
}

function chooseMoveFromModel(model, candidateMoves, context) {
    if (!isValidModel(model)) return null;
    if (!Array.isArray(candidateMoves) || candidateMoves.length === 0) return null;

    const ctx = context || {};
    const playerKey = ctx.playerKey === 'black' ? 'black' : 'white';
    const legalMovesCount = Number.isFinite(ctx.legalMovesCount) ? ctx.legalMovesCount : candidateMoves.length;
    const schema = model.schemaVersion;
    const preferRaw8x8Keys = shouldPreferRaw8x8Keys(ctx, ctx.board);
    const canonical = schema === 'policy_table.v1'
        ? { boardKey: preferRaw8x8Keys ? encodeBoardRaw(ctx.board) : encodeBoard(ctx.board), transformId: 0 }
        : (preferRaw8x8Keys ? canonicalizeBoardRaw(ctx.board) : canonicalizeBoard(ctx.board));
    const stateMeta = getStateEntryForModel(model, playerKey, ctx.board, ctx.pendingType || null, legalMovesCount, ctx);
    if (!stateMeta || !stateMeta.entry || !stateMeta.entry.actions || typeof stateMeta.entry.actions !== 'object') return null;
    const boardSize = Array.isArray(ctx.board) ? ctx.board : 8;

    let bestMove = null;
    let bestScore = -Infinity;

    for (const move of candidateMoves) {
        let actionKey = (schema === 'policy_table.v1' || stateMeta.keyMode === 'raw')
            ? makeActionKeyFromMove(move)
            : makeActionKeyFromMoveWithTransform(move, canonical.transformId, preferRaw8x8Keys ? 8 : boardSize);
        if (stateMeta.abstract) {
            actionKey = makeAbstractActionKeyFromMove(move, preferRaw8x8Keys ? 8 : boardSize);
        }
        const stat = stateMeta.entry.actions[actionKey];
        if (!stat) continue;

        const visits = Number.isFinite(stat.visits) ? stat.visits : 0;
        const avgOutcome = Number.isFinite(stat.avgOutcome) ? stat.avgOutcome : 0;
        const isBestAction = stateMeta.entry.bestAction === actionKey ? 1 : 0;
        const bestBonus = stateMeta.abstract ? 50 : 100;
        const baseScore = (isBestAction * bestBonus) + (Math.log1p(Math.max(0, visits)) * 15) + (avgOutcome * 80);
        const heuristicScore = estimateMoveHeuristic(move, {
            board: ctx.board,
            playerKey
        });
        const score = baseScore + (heuristicScore * MODEL_HEURISTIC_WEIGHT);
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }

    return bestMove;
}

function chooseMove(candidateMoves, context) {
    if (!_config.enabled) return null;
    if (!hasModel()) return null;
    const ctx = context || {};
    const level = Number.isFinite(ctx.level) ? ctx.level : 1;
    if (level < _config.minLevel) return null;
    return chooseMoveFromModel(_model, candidateMoves, ctx);
}

function getActionScoreFromModel(model, move, context) {
    if (!isValidModel(model)) return null;
    if (!move) return null;

    const ctx = context || {};
    const playerKey = ctx.playerKey === 'black' ? 'black' : 'white';
    const legalMovesCount = Number.isFinite(ctx.legalMovesCount) ? ctx.legalMovesCount : 0;
    const schema = model.schemaVersion;
    const preferRaw8x8Keys = shouldPreferRaw8x8Keys(ctx, ctx.board);
    const canonical = schema === 'policy_table.v1'
        ? { boardKey: preferRaw8x8Keys ? encodeBoardRaw(ctx.board) : encodeBoard(ctx.board), transformId: 0 }
        : (preferRaw8x8Keys ? canonicalizeBoardRaw(ctx.board) : canonicalizeBoard(ctx.board));
    const stateMeta = getStateEntryForModel(model, playerKey, ctx.board, ctx.pendingType || null, legalMovesCount, ctx);
    if (!stateMeta || !stateMeta.entry || !stateMeta.entry.actions || typeof stateMeta.entry.actions !== 'object') return null;

    const boardSize = Array.isArray(ctx.board) ? ctx.board : 8;
    let actionKey = (schema === 'policy_table.v1' || stateMeta.keyMode === 'raw')
        ? makeActionKeyFromMove(move)
        : makeActionKeyFromMoveWithTransform(move, canonical.transformId, preferRaw8x8Keys ? 8 : boardSize);
    if (stateMeta.abstract) {
        actionKey = makeAbstractActionKeyFromMove(move, preferRaw8x8Keys ? 8 : boardSize);
    }
    const stat = stateMeta.entry.actions[actionKey];
    if (!stat) return null;

    const visits = Number.isFinite(stat.visits) ? stat.visits : 0;
    const avgOutcome = Number.isFinite(stat.avgOutcome) ? stat.avgOutcome : 0;
    const bestBonus = stateMeta.entry.bestAction === actionKey
        ? (stateMeta.abstract ? 50 : 100)
        : 0;
    const heuristicScore = estimateMoveHeuristic(move, {
        board: ctx.board,
        playerKey
    });
    return bestBonus + (Math.log1p(Math.max(0, visits)) * 15) + (avgOutcome * 80) + (heuristicScore * MODEL_HEURISTIC_WEIGHT);
}

function getActionScore(move, context) {
    if (!_config.enabled) return null;
    if (!hasModel()) return null;
    const ctx = context || {};
    const level = Number.isFinite(ctx.level) ? ctx.level : 1;
    if (level < _config.minLevel) return null;
    return getActionScoreFromModel(_model, move, ctx);
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
    const stateMeta = getStateEntry(playerKey, ctx.board, ctx.pendingType || null, legalMovesCount, ctx);
    if (!stateMeta || !stateMeta.entry || !stateMeta.entry.actions || typeof stateMeta.entry.actions !== 'object') return null;
    const stat = stateMeta.entry.actions[actionKey];
    if (!stat) return null;
    const visits = Number.isFinite(stat.visits) ? stat.visits : 0;
    const avgOutcome = Number.isFinite(stat.avgOutcome) ? stat.avgOutcome : 0;
    const bestBonus = stateMeta.entry.bestAction === actionKey ? (stateMeta.abstract ? 50 : 100) : 0;
    return bestBonus + (Math.log1p(Math.max(0, visits)) * 15) + (avgOutcome * 80);
}

const Api = {
    MODEL_SCHEMA_VERSION: POLICY_TABLE_MODEL_SCHEMA_VERSION,
    DEFAULT_MODEL_URL,
    configure,
    getStatus,
    setModel,
    clearModel,
    hasModel,
    loadFromUrl,
    chooseMove,
    chooseMoveFromModel,
    getActionScore,
    getActionScoreFromModel,
    getActionScoreForKey,
    makeStateKey,
    makeActionKeyFromMove,
    canonicalizeBoard,
    encodeBoard
};



})();

export = Api;
