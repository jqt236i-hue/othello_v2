/**
 * Serializable, runtime-portable CPU candidate scoring.
 *
 * This module deliberately has no access to gameplay state, globals, timers,
 * randomness, the DOM, ONNX, or network clients. Board topology is projected by
 * the caller into stable cell-classification key lists before crossing a
 * runtime boundary.
 */

export const CPU_CANDIDATE_SCORING_PROTOCOL_VERSION = 1 as const;

const MAX_REQUEST_ID_LENGTH = 160;
const MAX_PLAYER_KEY_LENGTH = 64;
const MAX_STATE_VERSION_STRING_LENGTH = 160;
const MAX_CANDIDATES = 512;
const MAX_FLIPS_PER_CANDIDATE = 512;
const MAX_CLASSIFIED_CELLS = 2048;
const MAX_COORDINATE_ABS = 4096;
const MAX_TIE_BOUND = 4096;

export type CpuCandidateScoringStateVersion = number | string | null;

export interface CpuCandidateScoringIdentity {
    requestId: string;
    decisionEpoch: number;
    stateVersion: CpuCandidateScoringStateVersion;
    turnNumber: number;
    playerKey: string;
}

export interface CpuCandidateScoringPosition {
    row: number;
    col: number;
}

export interface CpuCandidateScoringMove extends CpuCandidateScoringPosition {
    flips: CpuCandidateScoringPosition[];
}

export interface CpuCandidateCellClassification extends CpuCandidateScoringPosition {
    isCorner: boolean;
    isEdge: boolean;
    isXSquare: boolean;
    isCSquare: boolean;
}

export interface CpuCandidateScoringBoardShape {
    /** Existing ranker geometry used only by the deterministic tie score. */
    tieMaxR: number;
    tieMaxC: number;
    /** Shape-aware classifications projected by the canonical board helpers. */
    cornerKeys: string[];
    edgeKeys: string[];
    xSquareKeys: string[];
    cSquareKeys: string[];
}

export interface CpuCandidateScoringRequest {
    protocolVersion: typeof CPU_CANDIDATE_SCORING_PROTOCOL_VERSION;
    requestId: string;
    decisionEpoch: number;
    stateVersion: CpuCandidateScoringStateVersion;
    turnNumber: number;
    playerKey: string;
    level: number;
    boardShape: CpuCandidateScoringBoardShape;
    candidateMoves: CpuCandidateScoringMove[];
    candidateDigest: string;
    contextDigest: string;
}

export interface CpuCandidateScore extends CpuCandidateScoringPosition {
    heuristicScore: number;
    tieScore: number;
    totalScore: number;
}

export interface CpuCandidateScoringResponse {
    protocolVersion: typeof CPU_CANDIDATE_SCORING_PROTOCOL_VERSION;
    requestId: string;
    decisionEpoch: number;
    stateVersion: CpuCandidateScoringStateVersion;
    turnNumber: number;
    playerKey: string;
    level: number;
    candidateDigest: string;
    contextDigest: string;
    scores: CpuCandidateScore[];
}

export interface CpuCandidateScoringBatch {
    request: CpuCandidateScoringRequest;
    response: CpuCandidateScoringResponse;
}

export interface CreateCpuCandidateScoringRequestInput {
    requestId: string;
    decisionEpoch: number;
    stateVersion?: CpuCandidateScoringStateVersion;
    turnNumber: number;
    playerKey: string;
    level: number;
    boardShape: CpuCandidateScoringBoardShape;
    candidateMoves: CpuCandidateScoringMove[];
}

export interface CpuCandidateHeuristicInput {
    level: number;
    flipCount: number;
    isCorner: boolean;
    isEdge: boolean;
    isXSquare: boolean;
    isCSquare: boolean;
}

export interface CpuCandidateTieInput extends CpuCandidateScoringPosition {
    candidateIndex: number;
    candidateCount: number;
    tieMaxR: number;
    tieMaxC: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isBoundedString(value: unknown, maxLength: number, allowEmpty = false): value is string {
    return typeof value === 'string' && (allowEmpty || value.length > 0) && value.length <= maxLength;
}

function isSafeNonNegativeInteger(value: unknown): value is number {
    return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isBoundedCoordinate(value: unknown): value is number {
    return Number.isSafeInteger(value) && Math.abs(Number(value)) <= MAX_COORDINATE_ABS;
}

function isFiniteCoordinate(value: unknown): value is number {
    return Number.isFinite(value);
}

function normalizeZero(value: number): number {
    return Object.is(value, -0) ? 0 : value;
}

export function toCpuCandidateCellKey(row: number, col: number): string {
    return `${normalizeZero(row)},${normalizeZero(col)}`;
}

function isCellKey(value: unknown): value is string {
    if (typeof value !== 'string' || !/^-?\d+,-?\d+$/.test(value)) return false;
    const [rowText, colText] = value.split(',');
    return isBoundedCoordinate(Number(rowText)) && isBoundedCoordinate(Number(colText));
}

function compareCellKeys(a: string, b: string): number {
    const [rowA, colA] = a.split(',').map(Number);
    const [rowB, colB] = b.split(',').map(Number);
    return rowA - rowB || colA - colB;
}

function canonicalizeCellKeys(values: string[]): string[] {
    return Array.from(new Set(values)).sort(compareCellKeys);
}

function isCanonicalCellKeyArray(value: unknown): value is string[] {
    if (!Array.isArray(value) || value.length > MAX_CLASSIFIED_CELLS) return false;
    for (let index = 0; index < value.length; index += 1) {
        const key = value[index];
        if (!isCellKey(key)) return false;
        if (index > 0 && compareCellKeys(value[index - 1], key) >= 0) return false;
    }
    return true;
}

function clonePosition(value: CpuCandidateScoringPosition): CpuCandidateScoringPosition {
    return { row: normalizeZero(value.row), col: normalizeZero(value.col) };
}

function cloneMove(value: CpuCandidateScoringMove): CpuCandidateScoringMove {
    return {
        row: normalizeZero(value.row),
        col: normalizeZero(value.col),
        flips: value.flips.map(clonePosition)
    };
}

function cloneBoardShape(value: CpuCandidateScoringBoardShape): CpuCandidateScoringBoardShape {
    return {
        tieMaxR: normalizeZero(value.tieMaxR),
        tieMaxC: normalizeZero(value.tieMaxC),
        cornerKeys: value.cornerKeys.slice(),
        edgeKeys: value.edgeKeys.slice(),
        xSquareKeys: value.xSquareKeys.slice(),
        cSquareKeys: value.cSquareKeys.slice()
    };
}

function isStateVersion(value: unknown): value is CpuCandidateScoringStateVersion {
    if (value === null) return true;
    if (typeof value === 'string') return value.length > 0 && value.length <= MAX_STATE_VERSION_STRING_LENGTH;
    return isSafeNonNegativeInteger(value);
}

export function isCpuCandidateScoringIdentity(value: unknown): value is CpuCandidateScoringIdentity {
    if (!isRecord(value)) return false;
    return (
        isBoundedString(value.requestId, MAX_REQUEST_ID_LENGTH) &&
        isSafeNonNegativeInteger(value.decisionEpoch) &&
        isStateVersion(value.stateVersion) &&
        isSafeNonNegativeInteger(value.turnNumber) &&
        isBoundedString(value.playerKey, MAX_PLAYER_KEY_LENGTH)
    );
}

function isPosition(value: unknown): value is CpuCandidateScoringPosition {
    return isRecord(value) && isBoundedCoordinate(value.row) && isBoundedCoordinate(value.col);
}

function isMove(value: unknown): value is CpuCandidateScoringMove {
    if (!isRecord(value) || !isPosition(value)) return false;
    const flips = value.flips;
    return Array.isArray(flips) && flips.length <= MAX_FLIPS_PER_CANDIDATE && flips.every(isPosition);
}

export function isCpuCandidateScoringBoardShape(value: unknown): value is CpuCandidateScoringBoardShape {
    if (!isRecord(value)) return false;
    return (
        isSafeNonNegativeInteger(value.tieMaxR) && Number(value.tieMaxR) <= MAX_TIE_BOUND &&
        isSafeNonNegativeInteger(value.tieMaxC) && Number(value.tieMaxC) <= MAX_TIE_BOUND &&
        isCanonicalCellKeyArray(value.cornerKeys) &&
        isCanonicalCellKeyArray(value.edgeKeys) &&
        isCanonicalCellKeyArray(value.xSquareKeys) &&
        isCanonicalCellKeyArray(value.cSquareKeys)
    );
}

export function createCpuCandidateScoringBoardShape(
    tieMaxR: number,
    tieMaxC: number,
    classifications: CpuCandidateCellClassification[]
): CpuCandidateScoringBoardShape {
    if (!isSafeNonNegativeInteger(tieMaxR) || tieMaxR > MAX_TIE_BOUND) {
        throw new TypeError('[cpu-candidate-scoring] tieMaxR must be a bounded non-negative integer');
    }
    if (!isSafeNonNegativeInteger(tieMaxC) || tieMaxC > MAX_TIE_BOUND) {
        throw new TypeError('[cpu-candidate-scoring] tieMaxC must be a bounded non-negative integer');
    }
    if (!Array.isArray(classifications) || classifications.length > MAX_CLASSIFIED_CELLS) {
        throw new TypeError('[cpu-candidate-scoring] classifications must be a bounded array');
    }

    const cornerKeys: string[] = [];
    const edgeKeys: string[] = [];
    const xSquareKeys: string[] = [];
    const cSquareKeys: string[] = [];
    for (const cell of classifications) {
        if (
            !isPosition(cell) ||
            typeof cell.isCorner !== 'boolean' ||
            typeof cell.isEdge !== 'boolean' ||
            typeof cell.isXSquare !== 'boolean' ||
            typeof cell.isCSquare !== 'boolean'
        ) {
            throw new TypeError('[cpu-candidate-scoring] classification coordinates and flags are invalid');
        }
        const key = toCpuCandidateCellKey(cell.row, cell.col);
        if (cell.isCorner === true) cornerKeys.push(key);
        if (cell.isEdge === true) edgeKeys.push(key);
        if (cell.isXSquare === true) xSquareKeys.push(key);
        if (cell.isCSquare === true) cSquareKeys.push(key);
    }
    return {
        tieMaxR,
        tieMaxC,
        cornerKeys: canonicalizeCellKeys(cornerKeys),
        edgeKeys: canonicalizeCellKeys(edgeKeys),
        xSquareKeys: canonicalizeCellKeys(xSquareKeys),
        cSquareKeys: canonicalizeCellKeys(cSquareKeys)
    };
}

function updateFnv1a(hash: number, code: number): number {
    let next = hash ^ (code & 0xff);
    next = Math.imul(next, 0x01000193) >>> 0;
    next ^= (code >>> 8) & 0xff;
    return Math.imul(next, 0x01000193) >>> 0;
}

/** Deterministic, synchronous 64-bit-shaped digest made from two FNV-1a passes. */
export function createCpuCandidateDeterministicDigest(value: unknown): string {
    const text = JSON.stringify(value);
    if (typeof text !== 'string') {
        throw new TypeError('[cpu-candidate-scoring] digest input must be JSON-serializable');
    }
    let forward = 0x811c9dc5;
    let reverse = 0x9e3779b9;
    for (let index = 0; index < text.length; index += 1) {
        forward = updateFnv1a(forward, text.charCodeAt(index));
        reverse = updateFnv1a(reverse, text.charCodeAt(text.length - index - 1));
    }
    return `fnv1a64:${forward.toString(16).padStart(8, '0')}${reverse.toString(16).padStart(8, '0')}:${text.length}`;
}

export function createCpuCandidateDigest(candidateMoves: CpuCandidateScoringMove[]): string {
    return createCpuCandidateDeterministicDigest(candidateMoves);
}

function createContextDigestValue(input: {
    requestId: string;
    decisionEpoch: number;
    stateVersion: CpuCandidateScoringStateVersion;
    turnNumber: number;
    playerKey: string;
    level: number;
    boardShape: CpuCandidateScoringBoardShape;
    candidateDigest: string;
}): Record<string, unknown> {
    return {
        protocolVersion: CPU_CANDIDATE_SCORING_PROTOCOL_VERSION,
        requestId: input.requestId,
        decisionEpoch: input.decisionEpoch,
        stateVersion: input.stateVersion,
        turnNumber: input.turnNumber,
        playerKey: input.playerKey,
        level: input.level,
        boardShape: input.boardShape,
        candidateDigest: input.candidateDigest
    };
}

export function createCpuCandidateContextDigest(input: {
    requestId: string;
    decisionEpoch: number;
    stateVersion: CpuCandidateScoringStateVersion;
    turnNumber: number;
    playerKey: string;
    level: number;
    boardShape: CpuCandidateScoringBoardShape;
    candidateDigest: string;
}): string {
    return createCpuCandidateDeterministicDigest(createContextDigestValue(input));
}

export function createCpuCandidateScoringRequest(
    input: CreateCpuCandidateScoringRequestInput
): CpuCandidateScoringRequest {
    if (!isRecord(input)) {
        throw new TypeError('[cpu-candidate-scoring] request input must be an object');
    }
    if (!isBoundedString(input.requestId, MAX_REQUEST_ID_LENGTH)) {
        throw new TypeError('[cpu-candidate-scoring] requestId is invalid');
    }
    if (!isSafeNonNegativeInteger(input.decisionEpoch)) {
        throw new TypeError('[cpu-candidate-scoring] decisionEpoch must be a non-negative integer');
    }
    const stateVersion = typeof input.stateVersion === 'undefined' ? null : input.stateVersion;
    if (!isStateVersion(stateVersion)) {
        throw new TypeError('[cpu-candidate-scoring] stateVersion is invalid');
    }
    if (!isSafeNonNegativeInteger(input.turnNumber)) {
        throw new TypeError('[cpu-candidate-scoring] turnNumber must be a non-negative integer');
    }
    if (!isBoundedString(input.playerKey, MAX_PLAYER_KEY_LENGTH)) {
        throw new TypeError('[cpu-candidate-scoring] playerKey is invalid');
    }
    if (!Number.isFinite(input.level)) {
        throw new TypeError('[cpu-candidate-scoring] level must be finite');
    }
    if (!isCpuCandidateScoringBoardShape(input.boardShape)) {
        throw new TypeError('[cpu-candidate-scoring] boardShape is invalid or non-canonical');
    }
    if (!Array.isArray(input.candidateMoves) || input.candidateMoves.length > MAX_CANDIDATES || !input.candidateMoves.every(isMove)) {
        throw new TypeError('[cpu-candidate-scoring] candidateMoves is invalid');
    }

    const boardShape = cloneBoardShape(input.boardShape);
    const candidateMoves = input.candidateMoves.map(cloneMove);
    const candidateDigest = createCpuCandidateDigest(candidateMoves);
    const requestBase = {
        requestId: input.requestId,
        decisionEpoch: input.decisionEpoch,
        stateVersion,
        turnNumber: input.turnNumber,
        playerKey: input.playerKey,
        level: normalizeZero(input.level),
        boardShape,
        candidateDigest
    };
    return {
        protocolVersion: CPU_CANDIDATE_SCORING_PROTOCOL_VERSION,
        ...requestBase,
        candidateMoves,
        contextDigest: createCpuCandidateContextDigest(requestBase)
    };
}

export function isCpuCandidateScoringRequest(value: unknown): value is CpuCandidateScoringRequest {
    if (!isRecord(value)) return false;
    if (value.protocolVersion !== CPU_CANDIDATE_SCORING_PROTOCOL_VERSION) return false;
    if (!isBoundedString(value.requestId, MAX_REQUEST_ID_LENGTH)) return false;
    if (!isSafeNonNegativeInteger(value.decisionEpoch)) return false;
    if (!isStateVersion(value.stateVersion)) return false;
    if (!isSafeNonNegativeInteger(value.turnNumber)) return false;
    if (!isBoundedString(value.playerKey, MAX_PLAYER_KEY_LENGTH)) return false;
    if (!Number.isFinite(value.level)) return false;
    if (!isCpuCandidateScoringBoardShape(value.boardShape)) return false;
    if (!Array.isArray(value.candidateMoves) || value.candidateMoves.length > MAX_CANDIDATES || !value.candidateMoves.every(isMove)) return false;
    if (!isBoundedString(value.candidateDigest, 96) || !isBoundedString(value.contextDigest, 96)) return false;

    const candidateDigest = createCpuCandidateDigest(value.candidateMoves);
    if (candidateDigest !== value.candidateDigest) return false;
    return createCpuCandidateContextDigest({
        requestId: value.requestId,
        decisionEpoch: value.decisionEpoch,
        stateVersion: value.stateVersion,
        turnNumber: value.turnNumber,
        playerKey: value.playerKey,
        level: Number(value.level),
        boardShape: value.boardShape,
        candidateDigest
    }) === value.contextDigest;
}

export function scoreCpuCandidateHeuristic(input: CpuCandidateHeuristicInput): number {
    if (!Number.isFinite(input.level) || !isSafeNonNegativeInteger(input.flipCount)) {
        throw new TypeError('[cpu-candidate-scoring] heuristic input is invalid');
    }
    let score = input.flipCount * 100;
    if (input.isCorner) score += 10000;
    if (input.isEdge) score += 600;
    if (input.isXSquare) score -= 600;
    if (input.isCSquare) score -= 300;
    if (input.level >= 6 && input.isXSquare) score -= 1200;
    if (input.level >= 6 && input.isCSquare) score -= 700;
    if (input.level >= 5 && input.isCorner) score += 5000;
    return score;
}

export function scoreCpuCandidateTie(input: CpuCandidateTieInput): number {
    if (
        !isFiniteCoordinate(input.row) ||
        !isFiniteCoordinate(input.col) ||
        !isSafeNonNegativeInteger(input.candidateIndex) ||
        !isSafeNonNegativeInteger(input.candidateCount) ||
        input.candidateIndex >= input.candidateCount ||
        !isSafeNonNegativeInteger(input.tieMaxR) ||
        !isSafeNonNegativeInteger(input.tieMaxC)
    ) {
        throw new TypeError('[cpu-candidate-scoring] tie input is invalid');
    }
    return (
        (input.tieMaxR - input.row) * 0.001 +
        (input.tieMaxC - input.col) * 0.0001 +
        (input.candidateCount - input.candidateIndex) * 0.00001
    );
}

export function scoreCpuCandidateRequest(request: CpuCandidateScoringRequest): CpuCandidateScoringResponse {
    if (!isCpuCandidateScoringRequest(request)) {
        throw new TypeError('[cpu-candidate-scoring] request failed validation');
    }
    const cornerKeys = new Set(request.boardShape.cornerKeys);
    const edgeKeys = new Set(request.boardShape.edgeKeys);
    const xSquareKeys = new Set(request.boardShape.xSquareKeys);
    const cSquareKeys = new Set(request.boardShape.cSquareKeys);
    const scores = request.candidateMoves.map((move, candidateIndex) => {
        const key = toCpuCandidateCellKey(move.row, move.col);
        const heuristicScore = scoreCpuCandidateHeuristic({
            level: request.level,
            flipCount: move.flips.length,
            isCorner: cornerKeys.has(key),
            isEdge: edgeKeys.has(key),
            isXSquare: xSquareKeys.has(key),
            isCSquare: cSquareKeys.has(key)
        });
        const tieScore = scoreCpuCandidateTie({
            row: move.row,
            col: move.col,
            candidateIndex,
            candidateCount: request.candidateMoves.length,
            tieMaxR: request.boardShape.tieMaxR,
            tieMaxC: request.boardShape.tieMaxC
        });
        return {
            row: move.row,
            col: move.col,
            heuristicScore,
            tieScore,
            totalScore: heuristicScore + tieScore
        };
    });
    return {
        protocolVersion: CPU_CANDIDATE_SCORING_PROTOCOL_VERSION,
        requestId: request.requestId,
        decisionEpoch: request.decisionEpoch,
        stateVersion: request.stateVersion,
        turnNumber: request.turnNumber,
        playerKey: request.playerKey,
        level: request.level,
        candidateDigest: request.candidateDigest,
        contextDigest: request.contextDigest,
        scores
    };
}

function isCandidateScore(value: unknown): value is CpuCandidateScore {
    if (!isRecord(value) || !isPosition(value)) return false;
    return (
        Number.isFinite(value.heuristicScore) &&
        Number.isFinite(value.tieScore) &&
        Number.isFinite(value.totalScore) &&
        value.totalScore === Number(value.heuristicScore) + Number(value.tieScore)
    );
}

export function isCpuCandidateScoringResponse(value: unknown): value is CpuCandidateScoringResponse {
    return (
        isRecord(value) &&
        value.protocolVersion === CPU_CANDIDATE_SCORING_PROTOCOL_VERSION &&
        isBoundedString(value.requestId, MAX_REQUEST_ID_LENGTH) &&
        isSafeNonNegativeInteger(value.decisionEpoch) &&
        isStateVersion(value.stateVersion) &&
        isSafeNonNegativeInteger(value.turnNumber) &&
        isBoundedString(value.playerKey, MAX_PLAYER_KEY_LENGTH) &&
        Number.isFinite(value.level) &&
        isBoundedString(value.candidateDigest, 96) &&
        isBoundedString(value.contextDigest, 96) &&
        Array.isArray(value.scores) &&
        value.scores.length <= MAX_CANDIDATES &&
        value.scores.every(isCandidateScore)
    );
}

function sameStateVersion(a: CpuCandidateScoringStateVersion, b: CpuCandidateScoringStateVersion): boolean {
    return typeof a === typeof b && a === b;
}

export function cpuCandidateScoringRequestsMatch(
    expected: CpuCandidateScoringRequest,
    actual: unknown
): actual is CpuCandidateScoringRequest {
    if (!isCpuCandidateScoringRequest(expected) || !isCpuCandidateScoringRequest(actual)) return false;
    return (
        expected.protocolVersion === actual.protocolVersion &&
        expected.requestId === actual.requestId &&
        expected.decisionEpoch === actual.decisionEpoch &&
        sameStateVersion(expected.stateVersion, actual.stateVersion) &&
        expected.turnNumber === actual.turnNumber &&
        expected.playerKey === actual.playerKey &&
        expected.level === actual.level &&
        expected.candidateDigest === actual.candidateDigest &&
        expected.contextDigest === actual.contextDigest &&
        JSON.stringify(expected.boardShape) === JSON.stringify(actual.boardShape) &&
        JSON.stringify(expected.candidateMoves) === JSON.stringify(actual.candidateMoves)
    );
}

export function verifyCpuCandidateScoringResponse(
    request: CpuCandidateScoringRequest,
    response: unknown
): response is CpuCandidateScoringResponse {
    if (!isCpuCandidateScoringRequest(request) || !isCpuCandidateScoringResponse(response)) return false;
    if (
        response.protocolVersion !== request.protocolVersion ||
        response.requestId !== request.requestId ||
        response.decisionEpoch !== request.decisionEpoch ||
        !sameStateVersion(response.stateVersion, request.stateVersion) ||
        response.turnNumber !== request.turnNumber ||
        response.playerKey !== request.playerKey ||
        response.level !== request.level ||
        response.candidateDigest !== request.candidateDigest ||
        response.contextDigest !== request.contextDigest ||
        response.scores.length !== request.candidateMoves.length
    ) {
        return false;
    }
    for (let index = 0; index < response.scores.length; index += 1) {
        const score = response.scores[index];
        const move = request.candidateMoves[index];
        if (score.row !== move.row || score.col !== move.col) return false;
    }
    return true;
}

export function verifyCpuCandidateScoringBatch(
    expectedRequest: CpuCandidateScoringRequest,
    batch: unknown
): batch is CpuCandidateScoringBatch {
    if (!isRecord(batch)) return false;
    return (
        cpuCandidateScoringRequestsMatch(expectedRequest, batch.request) &&
        verifyCpuCandidateScoringResponse(expectedRequest, batch.response)
    );
}
