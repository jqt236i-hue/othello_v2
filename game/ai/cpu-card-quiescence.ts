/**
 * Runtime-portable DTO and executor for the advisory CPU card-quiescence search.
 *
 * This module owns no mutable game state, RNG, card choice, action application,
 * presentation, or network behavior. It validates and clones the bounded inputs
 * needed to run the existing pure lookahead policy in a Dedicated Worker.
 */

export const CPU_CARD_QUIESCENCE_PROTOCOL_VERSION = 2 as const;

const MAX_REQUEST_ID_LENGTH = 160;
const MAX_PLAYER_KEY_LENGTH = 16;
const MAX_STATE_VERSION_LENGTH = 160;
const MAX_BOARD_ROWS = 64;
const MAX_BOARD_COLUMNS = 64;
const MAX_MOVES = 4096;
const MAX_FLIPS_PER_MOVE = 4096;
const MAX_SHAPE_KEYS = 8192;
const MAX_BONUS_ENTRIES = 8192;
const MAX_COORDINATE_ABS = 4096;
const MAX_SEARCH_LIMIT = 10_000_000;

export type CpuCardQuiescenceStateVersion = string | number | null;

export interface CpuCardQuiescencePosition {
    row: number;
    col: number;
}

export type CpuCardQuiescenceFlip = CpuCardQuiescencePosition | [number, number];

export interface CpuCardQuiescenceMove extends CpuCardQuiescencePosition {
    flips: CpuCardQuiescenceFlip[];
}

export interface CpuCardQuiescenceBoardShape {
    minRow: number;
    maxRow: number;
    minCol: number;
    maxCol: number;
    baseKeys: string[];
    playableKeys: string[];
    meteorHoleKeys: string[];
    expansionCells: Array<{ side: string; row: number; col: number; owner: number }>;
    expansionOwnerByKey: Record<string, number>;
    standard8x8: boolean;
}

export interface CpuCardQuiescenceSearchOptions {
    depth: number;
    maxBranch: number;
    nodeBudget: number;
    maxTimeMs: number;
    endgameSolveEmpties: number;
    endgameDepth: number;
    endgameNodeBudget: number;
    endgameMaxTimeMs: number;
}

export interface CpuCardQuiescenceRequest {
    protocolVersion: typeof CPU_CARD_QUIESCENCE_PROTOCOL_VERSION;
    requestId: string;
    decisionEpoch: number;
    stateVersion: CpuCardQuiescenceStateVersion;
    turnNumber: number | null;
    playerKey: string;
    level: number;
    playerValue: 1 | -1;
    board: number[][];
    boardShape: CpuCardQuiescenceBoardShape | null;
    legalMoves: CpuCardQuiescenceMove[];
    search: CpuCardQuiescenceSearchOptions;
    boardBonusByCell: Record<string, number> | null;
    boardBonusConsumedByCell: Record<string, boolean | number> | null;
    priorScoreByCell: Record<string, number> | null;
    priorWeight: number | null;
    searchWeight: number | null;
    /** 持ち石ルール有効時だけ持つ黒白の残り持ち石（01-rulebook.md §7.3）。 */
    stoneSupply?: { black: number; white: number };
    inputDigest: string;
}

export interface CpuCardQuiescenceResponse {
    protocolVersion: typeof CPU_CARD_QUIESCENCE_PROTOCOL_VERSION;
    requestId: string;
    decisionEpoch: number;
    stateVersion: CpuCardQuiescenceStateVersion;
    turnNumber: number | null;
    playerKey: string;
    level: number;
    inputDigest: string;
    bestMove: CpuCardQuiescenceMove | null;
}

export interface CpuCardQuiescenceBatch {
    request: CpuCardQuiescenceRequest;
    response: CpuCardQuiescenceResponse;
}

export interface CreateCpuCardQuiescenceRequestInput {
    requestId: unknown;
    decisionEpoch: unknown;
    stateVersion?: unknown;
    turnNumber?: unknown;
    playerKey: unknown;
    level: unknown;
    playerValue: unknown;
    board: unknown;
    boardShape?: unknown;
    legalMoves: unknown;
    search: unknown;
    boardBonusByCell?: unknown;
    boardBonusConsumedByCell?: unknown;
    priorScoreByCell?: unknown;
    priorWeight?: unknown;
    searchWeight?: unknown;
    stoneSupply?: unknown;
}

export type CpuCardQuiescenceLookahead = (
    legalMoves: CpuCardQuiescenceMove[],
    options: Record<string, any>
) => CpuCardQuiescenceMove | null;

export class CpuCardQuiescenceProtocolError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CpuCardQuiescenceProtocolError';
    }
}

function fail(message: string): never {
    throw new CpuCardQuiescenceProtocolError(message);
}

function isRecord(value: unknown): value is Record<string, any> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readBoundedString(value: unknown, label: string, maxLength: number): string {
    if (typeof value !== 'string' || value.length <= 0 || value.length > maxLength) {
        fail(`${label} must be a bounded non-empty string`);
    }
    return value;
}

function readSafeNonNegativeInteger(value: unknown, label: string, nullable = false): number | null {
    if (nullable && (value === null || typeof value === 'undefined')) return null;
    if (!Number.isSafeInteger(value) || Number(value) < 0) fail(`${label} must be a non-negative safe integer`);
    return Number(value);
}

function readStateVersion(value: unknown): CpuCardQuiescenceStateVersion {
    if (value === null || typeof value === 'undefined') return null;
    if (Number.isSafeInteger(value) && Number(value) >= 0) return Number(value);
    if (typeof value === 'string' && value.length > 0 && value.length <= MAX_STATE_VERSION_LENGTH) return value;
    return fail('stateVersion is invalid');
}

function readCoordinate(value: unknown, label: string): number {
    if (!Number.isSafeInteger(value) || Math.abs(Number(value)) > MAX_COORDINATE_ABS) {
        fail(`${label} must be a bounded integer`);
    }
    return Object.is(value, -0) ? 0 : Number(value);
}

function readOwner(value: unknown, label: string): -1 | 0 | 1 {
    if (value !== -1 && value !== 0 && value !== 1) {
        fail(`${label} must be -1, 0, or 1`);
    }
    return value;
}

function readPlayerValue(value: unknown): -1 | 1 {
    if (value !== -1 && value !== 1) fail('playerValue must be -1 or 1');
    return value;
}

function readPosition(value: unknown, label: string): CpuCardQuiescencePosition {
    if (!isRecord(value)) fail(`${label} must be an object`);
    return {
        row: readCoordinate(value.row, `${label}.row`),
        col: readCoordinate(value.col, `${label}.col`)
    };
}

function readFlip(value: unknown, label: string): CpuCardQuiescenceFlip {
    if (Array.isArray(value)) {
        if (value.length !== 2) fail(`${label} tuple must contain row and col`);
        return [
            readCoordinate(value[0], `${label}[0]`),
            readCoordinate(value[1], `${label}[1]`)
        ];
    }
    return readPosition(value, label);
}

function readMove(value: unknown, label: string): CpuCardQuiescenceMove {
    if (!isRecord(value) || !Array.isArray(value.flips) || value.flips.length > MAX_FLIPS_PER_MOVE) {
        fail(`${label} must contain a bounded flips array`);
    }
    const position = readPosition(value, label);
    return {
        ...position,
        flips: value.flips.map((flip, index) => readFlip(flip, `${label}.flips[${index}]`))
    };
}

function readMoves(value: unknown): CpuCardQuiescenceMove[] {
    if (!Array.isArray(value) || value.length <= 0 || value.length > MAX_MOVES) {
        fail('legalMoves must be a non-empty bounded array');
    }
    return value.map((move, index) => readMove(move, `legalMoves[${index}]`));
}

function readBoard(value: unknown): number[][] {
    if (!Array.isArray(value) || value.length <= 0 || value.length > MAX_BOARD_ROWS) {
        fail('board must be a non-empty bounded matrix');
    }
    return value.map((row, rowIndex) => {
        if (!Array.isArray(row) || row.length <= 0 || row.length > MAX_BOARD_COLUMNS) {
            fail(`board[${rowIndex}] must be a non-empty bounded row`);
        }
        return row.map((cell, colIndex) => (
            readOwner(cell, `board[${rowIndex}][${colIndex}]`)
        ));
    });
}

function compareCoordinateKeys(a: string, b: string): number {
    const [ar, ac] = a.split(',').map(Number);
    const [br, bc] = b.split(',').map(Number);
    return ar - br || ac - bc;
}

function readCoordinateKey(value: unknown, label: string): string {
    if (typeof value !== 'string' || !/^-?\d+,-?\d+$/.test(value)) fail(`${label} must be a coordinate key`);
    const [row, col] = value.split(',').map(Number);
    readCoordinate(row, `${label}.row`);
    readCoordinate(col, `${label}.col`);
    return `${Object.is(row, -0) ? 0 : row},${Object.is(col, -0) ? 0 : col}`;
}

function readCoordinateKeys(value: unknown, label: string): string[] {
    if (!Array.isArray(value) || value.length > MAX_SHAPE_KEYS) fail(`${label} must be a bounded array`);
    return Array.from(new Set(value.map((entry, index) => readCoordinateKey(entry, `${label}[${index}]`))))
        .sort(compareCoordinateKeys);
}

function readNumberMap(value: unknown, label: string, allowBoolean = false): Record<string, number | boolean> | null {
    if (value === null || typeof value === 'undefined') return null;
    if (!isRecord(value)) fail(`${label} must be an object or null`);
    const entries = Object.entries(value);
    if (entries.length > MAX_BONUS_ENTRIES) fail(`${label} has too many entries`);
    const out: Record<string, number | boolean> = {};
    entries
        .map(([key, item]) => [readCoordinateKey(key, `${label} key`), item] as const)
        .sort(([a], [b]) => compareCoordinateKeys(a, b))
        .forEach(([key, item]) => {
            if (allowBoolean && typeof item === 'boolean') {
                out[key] = item;
                return;
            }
            const number = Number(item);
            if (!Number.isFinite(number) || Math.abs(number) > 1_000_000) fail(`${label}.${key} must be finite`);
            out[key] = Object.is(number, -0) ? 0 : number;
        });
    return out;
}

function readOwnerMap(value: unknown, label: string): Record<string, number> {
    if (!isRecord(value)) fail(`${label} must be an object`);
    const entries = Object.entries(value);
    if (entries.length > MAX_BONUS_ENTRIES) fail(`${label} has too many entries`);
    const out: Record<string, number> = {};
    entries
        .map(([key, item]) => [readCoordinateKey(key, `${label} key`), item] as const)
        .sort(([a], [b]) => compareCoordinateKeys(a, b))
        .forEach(([key, item]) => {
            out[key] = readOwner(item, `${label}.${key}`);
        });
    return out;
}

function readBoardShape(value: unknown): CpuCardQuiescenceBoardShape | null {
    if (value === null || typeof value === 'undefined') return null;
    if (!isRecord(value)) fail('boardShape must be an object or null');
    const expansionCells = Array.isArray(value.expansionCells) ? value.expansionCells : [];
    if (expansionCells.length > MAX_SHAPE_KEYS) fail('boardShape has too many expansion cells');
    return {
        minRow: readCoordinate(value.minRow, 'boardShape.minRow'),
        maxRow: readCoordinate(value.maxRow, 'boardShape.maxRow'),
        minCol: readCoordinate(value.minCol, 'boardShape.minCol'),
        maxCol: readCoordinate(value.maxCol, 'boardShape.maxCol'),
        baseKeys: readCoordinateKeys(value.baseKeys, 'boardShape.baseKeys'),
        playableKeys: readCoordinateKeys(value.playableKeys, 'boardShape.playableKeys'),
        meteorHoleKeys: readCoordinateKeys(value.meteorHoleKeys, 'boardShape.meteorHoleKeys'),
        expansionCells: expansionCells.map((cell, index) => {
            if (!isRecord(cell)) fail(`boardShape.expansionCells[${index}] must be an object`);
            return {
                side: readBoundedString(cell.side, `boardShape.expansionCells[${index}].side`, 32),
                row: readCoordinate(cell.row, `boardShape.expansionCells[${index}].row`),
                col: readCoordinate(cell.col, `boardShape.expansionCells[${index}].col`),
                owner: readOwner(cell.owner, `boardShape.expansionCells[${index}].owner`)
            };
        }),
        expansionOwnerByKey: readOwnerMap(value.expansionOwnerByKey || {}, 'boardShape.expansionOwnerByKey'),
        standard8x8: value.standard8x8 === true
    };
}

function collectReadonlyCoordinateKeys(value: unknown, label: string): unknown[] {
    if (Array.isArray(value)) {
        const length = value.length;
        if (!Number.isSafeInteger(length) || length < 0 || length > MAX_SHAPE_KEYS) {
            fail(`${label} must be a bounded dense array`);
        }
        const out: unknown[] = [];
        for (let index = 0; index < length; index += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(value, index);
            if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
                fail(`${label} must be a bounded dense array`);
            }
            out.push(descriptor.value);
        }
        return out;
    }
    if (
        value
        && typeof value === 'object'
        && typeof (value as { values?: unknown }).values === 'function'
        && typeof (value as { has?: unknown }).has === 'function'
    ) {
        const size = (value as { size?: unknown }).size;
        if (!Number.isSafeInteger(size) || Number(size) < 0 || Number(size) > MAX_SHAPE_KEYS) {
            fail(`${label} set must have a bounded size`);
        }
        const iterator = (
            (value as { values: () => Iterator<unknown> }).values()
        );
        if (!iterator || typeof iterator.next !== 'function') {
            fail(`${label} set must expose a valid values iterator`);
        }
        const out: unknown[] = [];
        for (let index = 0; index <= Number(size); index += 1) {
            const step = iterator.next();
            if (!step || typeof step !== 'object') {
                fail(`${label} iterator returned an invalid step`);
            }
            if (step.done) {
                if (out.length !== Number(size)) {
                    fail(`${label} iterator size does not match`);
                }
                return out;
            }
            if (index === Number(size)) {
                fail(`${label} iterator exceeds its bounded size`);
            }
            out.push(step.value);
        }
    }
    return fail(`${label} must be an array or readonly set`);
}

export function serializeCpuCardQuiescenceBoardShape(value: unknown): CpuCardQuiescenceBoardShape | null {
    if (value === null || typeof value === 'undefined') return null;
    if (!isRecord(value)) fail('board shape source must be an object or null');
    return readBoardShape({
        ...value,
        baseKeys: collectReadonlyCoordinateKeys(value.baseKeys, 'boardShape.baseKeys'),
        playableKeys: collectReadonlyCoordinateKeys(value.playableKeys, 'boardShape.playableKeys'),
        meteorHoleKeys: collectReadonlyCoordinateKeys(value.meteorHoleKeys, 'boardShape.meteorHoleKeys')
    });
}

function readSearchLimit(value: unknown, label: string, minimum = 0): number {
    if (!Number.isFinite(value)) fail(`${label} must be finite`);
    const number = Math.floor(Number(value));
    if (number < minimum || number > MAX_SEARCH_LIMIT) fail(`${label} is out of range`);
    return number;
}

function readOptionalFiniteWeight(value: unknown, label: string): number | null {
    if (value === null || typeof value === 'undefined') return null;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > 1_000_000) {
        fail(`${label} must be a bounded non-negative number or null`);
    }
    return Object.is(number, -0) ? 0 : number;
}

function readStoneSupply(value: unknown): { black: number; white: number } | null {
    if (value === null || typeof value === 'undefined') return null;
    if (!isRecord(value)) fail('stoneSupply must be an object or null');
    return {
        black: readSafeNonNegativeInteger(value.black, 'stoneSupply.black') as number,
        white: readSafeNonNegativeInteger(value.white, 'stoneSupply.white') as number
    };
}

function readSearchOptions(value: unknown): CpuCardQuiescenceSearchOptions {
    if (!isRecord(value)) fail('search must be an object');
    return {
        depth: readSearchLimit(value.depth, 'search.depth', 1),
        maxBranch: readSearchLimit(value.maxBranch, 'search.maxBranch', 1),
        nodeBudget: readSearchLimit(value.nodeBudget, 'search.nodeBudget', 1),
        maxTimeMs: readSearchLimit(value.maxTimeMs, 'search.maxTimeMs', 1),
        endgameSolveEmpties: readSearchLimit(value.endgameSolveEmpties, 'search.endgameSolveEmpties', 1),
        endgameDepth: readSearchLimit(value.endgameDepth, 'search.endgameDepth', 1),
        endgameNodeBudget: readSearchLimit(value.endgameNodeBudget, 'search.endgameNodeBudget', 1),
        endgameMaxTimeMs: readSearchLimit(value.endgameMaxTimeMs, 'search.endgameMaxTimeMs', 1)
    };
}

function hashString(value: string): string {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

function requestDigestInput(request: Omit<CpuCardQuiescenceRequest, 'inputDigest'>): string {
    return hashString(JSON.stringify(request));
}

function normalizeRequestInput(value: Record<string, any>): Omit<CpuCardQuiescenceRequest, 'inputDigest'> {
    const decisionEpoch = readSafeNonNegativeInteger(value.decisionEpoch, 'decisionEpoch') as number;
    const turnNumber = readSafeNonNegativeInteger(value.turnNumber, 'turnNumber', true);
    const level = readSearchLimit(value.level, 'level', 1);
    const playerValue = readPlayerValue(value.playerValue);
    const boardShape = readBoardShape(value.boardShape);
    const stoneSupply = readStoneSupply(value.stoneSupply);
    return {
        protocolVersion: CPU_CARD_QUIESCENCE_PROTOCOL_VERSION,
        requestId: readBoundedString(value.requestId, 'requestId', MAX_REQUEST_ID_LENGTH),
        decisionEpoch,
        stateVersion: readStateVersion(value.stateVersion),
        turnNumber,
        playerKey: readBoundedString(value.playerKey, 'playerKey', MAX_PLAYER_KEY_LENGTH),
        level,
        playerValue,
        board: readBoard(value.board),
        boardShape,
        legalMoves: readMoves(value.legalMoves),
        search: readSearchOptions(value.search),
        boardBonusByCell: readNumberMap(value.boardBonusByCell, 'boardBonusByCell') as Record<string, number> | null,
        boardBonusConsumedByCell: readNumberMap(value.boardBonusConsumedByCell, 'boardBonusConsumedByCell', true),
        priorScoreByCell: readNumberMap(value.priorScoreByCell, 'priorScoreByCell') as Record<string, number> | null,
        priorWeight: readOptionalFiniteWeight(value.priorWeight, 'priorWeight'),
        searchWeight: readOptionalFiniteWeight(value.searchWeight, 'searchWeight'),
        // 持ち石ルール無効時は項目自体を持たず、要求・digest を従来と同一に保つ。
        ...(stoneSupply ? { stoneSupply } : {})
    };
}

export function createCpuCardQuiescenceRequest(input: CreateCpuCardQuiescenceRequestInput): CpuCardQuiescenceRequest {
    if (!isRecord(input)) fail('card-quiescence request input must be an object');
    const normalized = normalizeRequestInput(input);
    return Object.freeze({
        ...normalized,
        inputDigest: requestDigestInput(normalized)
    });
}

export function parseCpuCardQuiescenceRequest(value: unknown): CpuCardQuiescenceRequest {
    if (!isRecord(value) || value.protocolVersion !== CPU_CARD_QUIESCENCE_PROTOCOL_VERSION) {
        fail('unsupported card-quiescence request');
    }
    const normalized = normalizeRequestInput(value);
    const inputDigest = readBoundedString(value.inputDigest, 'inputDigest', 32);
    if (requestDigestInput(normalized) !== inputDigest) fail('card-quiescence request digest mismatch');
    return Object.freeze({ ...normalized, inputDigest });
}

function normalizeResponse(value: Record<string, any>): CpuCardQuiescenceResponse {
    const bestMove = value.bestMove === null ? null : readMove(value.bestMove, 'bestMove');
    return {
        protocolVersion: CPU_CARD_QUIESCENCE_PROTOCOL_VERSION,
        requestId: readBoundedString(value.requestId, 'requestId', MAX_REQUEST_ID_LENGTH),
        decisionEpoch: readSafeNonNegativeInteger(value.decisionEpoch, 'decisionEpoch') as number,
        stateVersion: readStateVersion(value.stateVersion),
        turnNumber: readSafeNonNegativeInteger(value.turnNumber, 'turnNumber', true),
        playerKey: readBoundedString(value.playerKey, 'playerKey', MAX_PLAYER_KEY_LENGTH),
        level: readSearchLimit(value.level, 'level', 1),
        inputDigest: readBoundedString(value.inputDigest, 'inputDigest', 32),
        bestMove
    };
}

export function parseCpuCardQuiescenceResponse(value: unknown): CpuCardQuiescenceResponse {
    if (!isRecord(value) || value.protocolVersion !== CPU_CARD_QUIESCENCE_PROTOCOL_VERSION) {
        fail('unsupported card-quiescence response');
    }
    return Object.freeze(normalizeResponse(value));
}

function sameMove(a: CpuCardQuiescenceMove, b: CpuCardQuiescenceMove): boolean {
    if (a.row !== b.row || a.col !== b.col || a.flips.length !== b.flips.length) return false;
    const coordinates = (flip: CpuCardQuiescenceFlip): [number, number] => (
        Array.isArray(flip) ? [flip[0], flip[1]] : [flip.row, flip.col]
    );
    return a.flips.every((flip, index) => {
        const [row, col] = coordinates(flip);
        const [otherRow, otherCol] = coordinates(b.flips[index]);
        return row === otherRow && col === otherCol;
    });
}

export function verifyCpuCardQuiescenceResponse(
    request: CpuCardQuiescenceRequest,
    responseInput: unknown
): responseInput is CpuCardQuiescenceResponse {
    let response: CpuCardQuiescenceResponse;
    try {
        response = parseCpuCardQuiescenceResponse(responseInput);
    } catch (_error) {
        return false;
    }
    if (
        response.requestId !== request.requestId
        || response.decisionEpoch !== request.decisionEpoch
        || response.stateVersion !== request.stateVersion
        || response.turnNumber !== request.turnNumber
        || response.playerKey !== request.playerKey
        || response.level !== request.level
        || response.inputDigest !== request.inputDigest
    ) return false;
    return response.bestMove === null || request.legalMoves.some((move) => sameMove(move, response.bestMove!));
}

export function executeCpuCardQuiescenceRequest(
    requestInput: unknown,
    chooseMoveByLookahead: CpuCardQuiescenceLookahead
): CpuCardQuiescenceResponse {
    const request = parseCpuCardQuiescenceRequest(requestInput);
    if (typeof chooseMoveByLookahead !== 'function') fail('card-quiescence lookahead is unavailable');
    const board = request.board.map((row) => row.slice());
    const legalMoves = request.legalMoves.map((move) => ({
        row: move.row,
        col: move.col,
        flips: move.flips.map((flip) => (
            Array.isArray(flip)
                ? { row: flip[0], col: flip[1] }
                : { row: flip.row, col: flip.col }
        ))
    }));
    const scoreMove = request.priorScoreByCell
        ? (move: CpuCardQuiescenceMove) => Number(request.priorScoreByCell![`${move.row},${move.col}`] || 0)
        : undefined;
    const bestMove = chooseMoveByLookahead(legalMoves, {
        board,
        boardShape: request.boardShape,
        playerValue: request.playerValue,
        level: request.level,
        ...request.search,
        ...(scoreMove ? { scoreMove } : {}),
        ...(request.priorWeight !== null ? { priorWeight: request.priorWeight } : {}),
        ...(request.searchWeight !== null ? { searchWeight: request.searchWeight } : {}),
        boardBonusByCell: request.boardBonusByCell,
        boardBonusConsumedByCell: request.boardBonusConsumedByCell,
        ...(request.stoneSupply ? { stoneSupply: request.stoneSupply } : {})
    });
    const response = parseCpuCardQuiescenceResponse({
        protocolVersion: CPU_CARD_QUIESCENCE_PROTOCOL_VERSION,
        requestId: request.requestId,
        decisionEpoch: request.decisionEpoch,
        stateVersion: request.stateVersion,
        turnNumber: request.turnNumber,
        playerKey: request.playerKey,
        level: request.level,
        inputDigest: request.inputDigest,
        bestMove: bestMove || null
    });
    if (!verifyCpuCardQuiescenceResponse(request, response)) {
        fail('card-quiescence lookahead returned a move outside the request');
    }
    return response;
}
