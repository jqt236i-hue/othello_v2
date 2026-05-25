function requirePolicyTableRuntimeModuleOrNull(id: string): any {
    try {
        return require(id);
    } catch (e) {
        return null;
    }
}

const SharedBoardUtils: any = requirePolicyTableRuntimeModuleOrNull('../../shared/shared-board-utils');

const MODEL_SCHEMA_VERSION = 'policy_table.v2';
const LEGACY_MODEL_SCHEMA_VERSION = 'policy_table.v1';
const DEFAULT_MODEL_URL = 'data/models/policy-table.json';

type PolicyActionStat = { visits?: number; avgOutcome?: number };
type PolicyState = {
    bestAction?: string;
    actions?: Record<string, PolicyActionStat>;
};
type PolicyModel = {
    schemaVersion?: string;
    states?: Record<string, PolicyState>;
    abstractStates?: Record<string, PolicyState>;
};

let _config = {
    enabled: true,
    minLevel: 4,
    sourceUrl: DEFAULT_MODEL_URL
};
let _model: PolicyModel | null = null;
let _lastError: Error | null = null;

function normalizePlayerKey(playerKey: any): 'black' | 'white' {
    return playerKey === 'black' ? 'black' : 'white';
}

function encodeBoardFallback(board: any): string {
    if (!Array.isArray(board)) return '';
    const rows: string[] = [];
    for (let r = 0; r < board.length; r += 1) {
        const row = Array.isArray(board[r]) ? board[r] : [];
        const rowValues: string[] = [];
        for (let c = 0; c < row.length; c += 1) {
            rowValues.push(String(Number(row[c]) || 0));
        }
        rows.push(rowValues.join(','));
    }
    return rows.join(';');
}

function canonicalizeBoard(board: any): { boardKey: string; transformId: number } {
    if (SharedBoardUtils && typeof SharedBoardUtils.canonicalizeBoard === 'function') {
        return SharedBoardUtils.canonicalizeBoard(board);
    }
    return { boardKey: encodeBoardFallback(board), transformId: 0 };
}

function transformCoord(row: number, col: number, size: number, transformId: number) {
    if (transformId === 0) return { row, col };
    if (transformId === 1) return { row: col, col: size - 1 - row };
    if (transformId === 2) return { row: size - 1 - row, col: size - 1 - col };
    if (transformId === 3) return { row: size - 1 - col, col: row };
    if (transformId === 4) return { row, col: size - 1 - col };
    if (transformId === 5) return { row: size - 1 - col, col: size - 1 - row };
    if (transformId === 6) return { row: size - 1 - row, col };
    if (transformId === 7) return { row: col, col: row };
    return { row, col };
}

function cellType(row: number, col: number, boardOrSize: any): string {
    if (SharedBoardUtils && typeof SharedBoardUtils.getCellType === 'function') {
        if (Array.isArray(boardOrSize)) return SharedBoardUtils.getCellType(row, col, boardOrSize);
        const n = Number.isFinite(Number(boardOrSize)) && Number(boardOrSize) > 0 ? Number(boardOrSize) : 8;
        return SharedBoardUtils.getCellType(row, col, n, n);
    }
    const n = Number.isFinite(Number(boardOrSize)) && Number(boardOrSize) > 0 ? Number(boardOrSize) : 8;
    if ((row === 0 || row === n - 1) && (col === 0 || col === n - 1)) return 'corner';
    if (row === 0 || row === n - 1 || col === 0 || col === n - 1) return 'edge';
    return 'inner';
}

function resolveBoardSize(board: any): number {
    if (Array.isArray(board) && board.length > 0) return board.length;
    return 8;
}

function isCorner(row: number, col: number, board: any): boolean {
    return cellType(row, col, board) === 'corner';
}

function isEdge(row: number, col: number, board: any): boolean {
    return cellType(row, col, board) === 'edge';
}

function makeCanonicalActionKey(move: any, board: any, transformId: number): string {
    if (!move || !Number.isFinite(Number(move.row)) || !Number.isFinite(Number(move.col))) {
        return '';
    }
    if (SharedBoardUtils && typeof SharedBoardUtils.makeCanonicalActionKey === 'function') {
        try {
            return SharedBoardUtils.makeCanonicalActionKey(move, board, transformId);
        } catch (e) {
            // Fallback below
        }
    }
    const size = resolveBoardSize(board);
    const mapped = transformCoord(Number(move.row), Number(move.col), size, transformId);
    return `place:${mapped.row}:${mapped.col}`;
}

function makePolicyActionKey(move: any): string {
    if (!move || !Number.isFinite(Number(move.row)) || !Number.isFinite(Number(move.col))) return '';
    return `place:${Number(move.row)}:${Number(move.col)}`;
}

function makePolicyAbstractActionKey(move: any, board: any): string {
    const row = Number(move && move.row);
    const col = Number(move && move.col);
    if (!Number.isFinite(row) || !Number.isFinite(col)) return 'place_cat:unknown';
    return `place_cat:${cellType(row, col, board)}`;
}

function getBoardCellValue(board: any, row: number, col: number): number {
    if (!Array.isArray(board)) return 0;
    if (row < 0 || col < 0 || row >= board.length) return 0;
    const rowArr = Array.isArray(board[row]) ? board[row] : [];
    if (col >= rowArr.length) return 0;
    return Number(rowArr[col]) || 0;
}

function countEmpties(board: any): number {
    if (!Array.isArray(board)) return 0;
    let empties = 0;
    for (let r = 0; r < board.length; r += 1) {
        const row = Array.isArray(board[r]) ? board[r] : [];
        for (let c = 0; c < row.length; c += 1) {
            if ((Number(row[c]) || 0) === 0) empties += 1;
        }
    }
    return empties;
}

function countDiscDiffOnBoard(board: any, playerKey: 'black' | 'white'): number {
    const own = playerKey === 'black' ? 1 : -1;
    const opp = -own;
    let ownCount = 0;
    let oppCount = 0;
    if (!Array.isArray(board)) return 0;
    for (let r = 0; r < board.length; r += 1) {
        const row = Array.isArray(board[r]) ? board[r] : [];
        for (let c = 0; c < row.length; c += 1) {
            const cell = Number(row[c]) || 0;
            if (cell === own) ownCount += 1;
            else if (cell === opp) oppCount += 1;
        }
    }
    return ownCount - oppCount;
}

function countCorners(board: any, playerKey: 'black' | 'white'): number {
    if (!Array.isArray(board) || board.length <= 0) return 0;
    const own = playerKey === 'black' ? 1 : -1;
    const opp = -own;
    const size = board.length;
    const corners = [
        getBoardCellValue(board, 0, 0),
        getBoardCellValue(board, 0, size - 1),
        getBoardCellValue(board, size - 1, 0),
        getBoardCellValue(board, size - 1, size - 1)
    ];
    let ownCount = 0;
    let oppCount = 0;
    for (const one of corners) {
        if (one === own) ownCount += 1;
        else if (one === opp) oppCount += 1;
    }
    return ownCount - oppCount;
}

function toBucket(value: number, steps: number[]): string {
    for (let i = 0; i < steps.length; i += 1) {
        if (value <= steps[i]) return String(steps[i]);
    }
    return `>${steps[steps.length - 1]}`;
}

function makePolicyAbstractStateKey(playerKey: 'black' | 'white', board: any, pendingType: any, legalMovesCount: any): string {
    const pending = pendingType || '-';
    const legal = Number.isFinite(Number(legalMovesCount)) ? Number(legalMovesCount) : 0;
    const empties = countEmpties(board);
    const phase = empties >= 44 ? 'opening' : (empties >= 16 ? 'mid' : 'end');
    const mobility = toBucket(legal, [0, 2, 4, 6, 10, 20]);
    const disc = toBucket(countDiscDiffOnBoard(board, playerKey), [-20, -10, -4, 0, 4, 10, 20]);
    const corner = toBucket(countCorners(board, playerKey), [-4, -2, -1, 0, 1, 2, 4]);
    return `${playerKey}|${pending}|${phase}|mob:${mobility}|disc:${disc}|corner:${corner}`;
}

function createRawBoard8x8(board: any): any {
    if (!Array.isArray(board) || board.length < 8) return null;
    const raw: number[][] = Array.from({ length: 8 }, () => Array(8).fill(0));
    for (let r = 0; r < 8; r += 1) {
        for (let c = 0; c < 8; c += 1) {
            raw[r][c] = getBoardCellValue(board, r, c);
        }
    }
    return raw;
}

function makeStateKey(playerKey: any, boardOrKey: any, pendingType: any, legalMovesCount: any): string {
    const normalizedPlayer = normalizePlayerKey(playerKey);
    const boardKey = typeof boardOrKey === 'string'
        ? boardOrKey
        : canonicalizeBoard(boardOrKey).boardKey;
    const pending = pendingType || '-';
    const legal = Number.isFinite(Number(legalMovesCount)) ? Number(legalMovesCount) : 0;
    return `${normalizedPlayer}|${boardKey}|${pending}|${legal}`;
}

function resolvePolicyState(model: any, context: any) {
    if (!model || typeof model !== 'object' || !model.states || typeof model.states !== 'object') {
        return { state: null, canonical: { boardKey: '', transformId: 0 }, isAbstract: false, actionBoard: null };
    }
    const playerKey = normalizePlayerKey(context && context.playerKey);
    const board = context && context.board;
    const canonical = canonicalizeBoard(board);
    const pendingType = context && context.pendingType ? context.pendingType : '-';
    const legalMovesCount = Number.isFinite(Number(context && context.legalMovesCount))
        ? Number(context.legalMovesCount)
        : 0;

    const canonicalStateKey = makeStateKey(playerKey, canonical.boardKey, pendingType, legalMovesCount);
    const canonicalState = model.states[canonicalStateKey];
    if (canonicalState && canonicalState.actions) {
        return { state: canonicalState, canonical, isAbstract: false, actionBoard: board };
    }

    if (context && context.preferRaw8x8Keys) {
        const raw = createRawBoard8x8(board);
        if (raw) {
            const rawCanonical = canonicalizeBoard(raw);
            const rawStateKey = makeStateKey(playerKey, rawCanonical.boardKey, pendingType, legalMovesCount);
            const rawState = model.states[rawStateKey];
            if (rawState && rawState.actions) {
                return { state: rawState, canonical: rawCanonical, isAbstract: false, actionBoard: raw };
            }
        }
    }

    if (model.abstractStates && typeof model.abstractStates === 'object') {
        const abstractKey = makePolicyAbstractStateKey(playerKey, board, pendingType, legalMovesCount);
        const state = model.abstractStates[abstractKey];
        if (state && state.actions) return { state, canonical, isAbstract: true, actionBoard: board };
    }

    return { state: null, canonical, isAbstract: false, actionBoard: board };
}

function computePlacementScore(state: PolicyState, actionKeys: string[], move: any, board: any, isAbstract: boolean): number | null {
    if (!state || !state.actions || !Array.isArray(actionKeys) || actionKeys.length <= 0) return null;
    let matchedKey = '';
    let stat: PolicyActionStat | null = null;
    for (const oneKey of actionKeys) {
        if (!oneKey) continue;
        const oneStat = state.actions[oneKey];
        if (oneStat) {
            matchedKey = oneKey;
            stat = oneStat;
            break;
        }
    }
    if (!stat) return null;
    const visits = Number.isFinite(Number(stat.visits)) ? Number(stat.visits) : 0;
    const avgOutcome = Number.isFinite(Number(stat.avgOutcome)) ? Number(stat.avgOutcome) : 0;
    const bestAction = typeof state.bestAction === 'string' ? state.bestAction : '';
    const bestBonus = (bestAction === matchedKey || actionKeys.includes(bestAction)) ? (isAbstract ? 50 : 100) : 0;
    const visitBonus = Math.log1p(Math.max(0, visits)) * 15;
    const outcomeBonus = avgOutcome * 80;
    const row = Number(move && move.row);
    const col = Number(move && move.col);
    const cornerBonus = isCorner(row, col, board) ? 0.001 : 0;
    const edgeBonus = (!isCorner(row, col, board) && isEdge(row, col, board)) ? 0.0005 : 0;
    return bestBonus + visitBonus + outcomeBonus + cornerBonus + edgeBonus;
}

function compareMoves(a: any, b: any, board: any): number {
    const aCorner = isCorner(Number(a && a.row), Number(a && a.col), board) ? 1 : 0;
    const bCorner = isCorner(Number(b && b.row), Number(b && b.col), board) ? 1 : 0;
    if (aCorner !== bCorner) return bCorner - aCorner;
    const aEdge = isEdge(Number(a && a.row), Number(a && a.col), board) ? 1 : 0;
    const bEdge = isEdge(Number(b && b.row), Number(b && b.col), board) ? 1 : 0;
    if (aEdge !== bEdge) return bEdge - aEdge;
    const aRow = Number(a && a.row);
    const bRow = Number(b && b.row);
    if (aRow !== bRow) return aRow - bRow;
    const aCol = Number(a && a.col);
    const bCol = Number(b && b.col);
    return aCol - bCol;
}

function chooseMoveFromModel(model: any, candidates: any[], context: any) {
    if (!Array.isArray(candidates) || candidates.length <= 0) return null;
    const resolved = resolvePolicyState(model, context || {});
    if (!resolved.state) return null;
    let bestMove: any = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const move of candidates) {
        const actionKeys = resolved.isAbstract
            ? [makePolicyAbstractActionKey(move, context && context.board)]
            : [
                makeCanonicalActionKey(move, resolved.actionBoard || (context && context.board), resolved.canonical.transformId),
                makePolicyActionKey(move)
            ];
        const score = computePlacementScore(resolved.state, actionKeys, move, context && context.board, resolved.isAbstract);
        if (!Number.isFinite(score)) continue;
        const numericScore = Number(score);
        if (numericScore > bestScore) {
            bestScore = numericScore;
            bestMove = move;
            continue;
        }
        if (numericScore === bestScore && bestMove && compareMoves(move, bestMove, context && context.board) < 0) {
            bestMove = move;
        }
    }

    return bestMove;
}

function chooseMove(candidates: any[], context: any) {
    if (!_config.enabled || !_model) return null;
    const level = Number.isFinite(Number(context && context.level)) ? Number(context.level) : 1;
    if (level < _config.minLevel) return null;
    return chooseMoveFromModel(_model, candidates, context);
}

function getActionScoreFromModel(model: any, move: any, context: any): number | null {
    const resolved = resolvePolicyState(model, context || {});
    if (!resolved.state) return null;
    const actionKeys = resolved.isAbstract
        ? [makePolicyAbstractActionKey(move, context && context.board)]
        : [
            makeCanonicalActionKey(move, resolved.actionBoard || (context && context.board), resolved.canonical.transformId),
            makePolicyActionKey(move)
        ];
    const score = computePlacementScore(resolved.state, actionKeys, move, context && context.board, resolved.isAbstract);
    return Number.isFinite(score) ? Number(score) : null;
}

function getActionScore(move: any, context: any): number | null {
    if (!_model || !_config.enabled) return null;
    const level = Number.isFinite(Number(context && context.level)) ? Number(context.level) : 1;
    if (level < _config.minLevel) return null;
    return getActionScoreFromModel(_model, move, context);
}

function getActionScoreForKey(actionKey: any, context: any): number | null {
    if (!_model || !_config.enabled || typeof actionKey !== 'string' || !actionKey) return null;
    const level = Number.isFinite(Number(context && context.level)) ? Number(context.level) : 1;
    if (level < _config.minLevel) return null;
    const resolved = resolvePolicyState(_model, context || {});
    if (!resolved.state || !resolved.state.actions) return null;
    const stat = resolved.state.actions[actionKey];
    if (!stat) return null;
    const visits = Number.isFinite(Number(stat.visits)) ? Number(stat.visits) : 0;
    const avgOutcome = Number.isFinite(Number(stat.avgOutcome)) ? Number(stat.avgOutcome) : 0;
    const bestBonus = resolved.state.bestAction === actionKey ? 1000000 : 0;
    return bestBonus + (visits * 1000) + avgOutcome;
}

function configure(config: any) {
    const next = (config && typeof config === 'object') ? config : {};
    if (typeof next.enabled === 'boolean') _config.enabled = next.enabled;
    if (Number.isFinite(Number(next.minLevel))) _config.minLevel = Math.max(1, Math.trunc(Number(next.minLevel)));
    if (typeof next.sourceUrl === 'string' && next.sourceUrl.trim()) _config.sourceUrl = next.sourceUrl.trim();
    return getStatus();
}

function clearModel() {
    _model = null;
    _lastError = null;
}

function hasModel() {
    return !!(_model && _model.states);
}

function setModel(model: any) {
    if (!model || typeof model !== 'object') return false;
    const schema = String(model.schemaVersion || '');
    if (schema !== MODEL_SCHEMA_VERSION && schema !== LEGACY_MODEL_SCHEMA_VERSION) {
        _model = null;
        return false;
    }
    if (!model.states || typeof model.states !== 'object') {
        _model = null;
        return false;
    }
    _model = model;
    _lastError = null;
    return true;
}

async function loadFromUrl(url: string, fetchImpl?: any) {
    const targetUrl = (typeof url === 'string' && url.trim()) ? url.trim() : _config.sourceUrl;
    const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
    if (!f) {
        _lastError = new Error('fetch is not available');
        return false;
    }
    try {
        const response = await f(targetUrl, { cache: 'no-store' });
        if (!response || response.ok !== true) return false;
        const payload = await response.json();

        // Manifest redirect with gzip payload support.
        if (payload && payload.assetType === 'policy_table.redirect.v1') {
            if (payload.compression !== 'gzip' || typeof payload.url !== 'string') return false;
            const compressedResponse = await f(payload.url, { cache: 'no-store' });
            if (!compressedResponse || compressedResponse.ok !== true || typeof compressedResponse.arrayBuffer !== 'function') return false;
            if (typeof Buffer === 'undefined') return false;
            let zlib: any;
            try {
                zlib = require('zlib');
            } catch (e) {
                return false;
            }
            const compressed = Buffer.from(await compressedResponse.arrayBuffer());
            const uncompressed = zlib.gunzipSync(compressed);
            const parsed = JSON.parse(uncompressed.toString('utf8'));
            return setModel(parsed);
        }

        return setModel(payload);
    } catch (error) {
        _lastError = error instanceof Error ? error : new Error(String(error));
        return false;
    }
}

function getStatus() {
    return {
        enabled: _config.enabled,
        minLevel: _config.minLevel,
        sourceUrl: _config.sourceUrl,
        loaded: hasModel(),
        schemaVersion: _model && _model.schemaVersion ? _model.schemaVersion : null,
        lastError: _lastError ? _lastError.message : null
    };
}

const Api = {
    MODEL_SCHEMA_VERSION,
    DEFAULT_MODEL_URL,
    configure,
    clearModel,
    hasModel,
    setModel,
    loadFromUrl,
    getStatus,
    makeStateKey,
    canonicalizeBoard,
    chooseMove,
    chooseMoveFromModel,
    getActionScoreFromModel,
    getActionScore,
    getActionScoreForKey
};

export = Api;
