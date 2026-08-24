interface Position {
    row: number;
    col: number;
}

interface RandomSource {
    random(): number;
}

interface SelectOptions {
    forbiddenCells?: unknown;
}

function normalizePosition(value: unknown): Position | null {
    if (!value || typeof value !== 'object') return null;
    const row = Number((value as Position).row);
    const col = Number((value as Position).col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
    return { row, col };
}

function getChebyshevDistance(from: Position, to: Position): number {
    return Math.max(Math.abs(from.row - to.row), Math.abs(from.col - to.col));
}

function resolveRandomIndex(randomSource: RandomSource, length: number): number {
    if (!Number.isInteger(length) || length <= 0) return 0;
    const raw = Math.floor(Number(randomSource.random()) * length);
    if (!Number.isFinite(raw)) return 0;
    return Math.max(0, Math.min(length - 1, raw));
}

function buildForbiddenSet(cells: unknown): Set<string> {
    const out = new Set<string>();
    if (!Array.isArray(cells)) return out;
    for (const cell of cells) {
        const pos = normalizePosition(cell);
        if (!pos) continue;
        out.add(`${pos.row},${pos.col}`);
    }
    return out;
}

function selectNearestEmptyEvasionDestination(
    originInput: unknown,
    candidateInput: unknown,
    randomSource: RandomSource,
    options: SelectOptions = {}
): Position | null {
    const origin = normalizePosition(originInput);
    if (!origin) return null;
    if (!Array.isArray(candidateInput)) return null;
    if (!randomSource || typeof randomSource.random !== 'function') {
        throw new Error('CardEvasionDestination requires an injected deterministic PRNG.');
    }

    const forbidden = buildForbiddenSet(options.forbiddenCells);
    const seen = new Set<string>();
    let minDistance = Number.POSITIVE_INFINITY;
    let nearest: Position[] = [];

    for (const candidateValue of candidateInput) {
        const candidate = normalizePosition(candidateValue);
        if (!candidate) continue;
        const key = `${candidate.row},${candidate.col}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (candidate.row === origin.row && candidate.col === origin.col) continue;
        if (forbidden.has(key)) continue;

        const distance = getChebyshevDistance(origin, candidate);
        if (distance < minDistance) {
            minDistance = distance;
            nearest = [candidate];
            continue;
        }
        if (distance === minDistance) {
            nearest.push(candidate);
        }
    }

    if (!nearest.length) return null;
    return nearest[resolveRandomIndex(randomSource, nearest.length)] || nearest[0] || null;
}

const CardEvasionDestination = {
    selectNearestEmptyEvasionDestination
};

export = CardEvasionDestination;
