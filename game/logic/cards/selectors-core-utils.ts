import type { CardState } from '../../../src/types';

interface SuperAttractionPoint {
    row: number;
    col: number;
}

interface SuperAttractionPathSegment {
    from: SuperAttractionPoint;
    to: SuperAttractionPoint;
    dr: number;
    dc: number;
    length: number;
}

interface SuperAttractionPathCandidate {
    variant: 'single_segment' | 'diagonal_first' | 'axis_first';
    pathCells: SuperAttractionPoint[];
    segments: SuperAttractionPathSegment[];
    waypoints: SuperAttractionPoint[];
    movedDistance: number;
}

function isBlockingMarkerType(type: string): boolean {
    return type === 'BLOCKADE' || type === 'METEOR_HOLE' || type === 'FREEZE';
}

function isBombCategoryMarker(marker: any): boolean {
    return !!(
        marker &&
        marker.kind === 'specialStone' &&
        marker.data &&
        marker.data.category === 'bomb'
    );
}

function isFrozenCell(cardState: CardState, row: number, col: number, cardUtils?: any): boolean {
    if (cardUtils && typeof cardUtils.isFrozenCell === 'function') {
        return !!cardUtils.isFrozenCell(cardState, row, col);
    }
    const cs = cardState as any;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    return markers.some((m: any) => (
        m &&
        m.kind === 'specialStone' &&
        m.row === row &&
        m.col === col &&
        m.data &&
        m.data.type === 'FREEZE'
    ));
}

function hasSeedMarkerAt(cardState: CardState, row: number, col: number): boolean {
    const cs = cardState as any;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    return markers.some((m: any) => (
        m &&
        m.kind === 'specialStone' &&
        m.row === row &&
        m.col === col &&
        m.data &&
        m.data.type === 'SEED'
    ));
}

function isBlockedCell(cardState: CardState, row: number, col: number): boolean {
    const cs = cardState as any;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    return markers.some((m: any) => (
        m &&
        m.kind === 'specialStone' &&
        m.row === row &&
        m.col === col &&
        m.data &&
        isBlockingMarkerType(m.data.type)
    ));
}

function isMeteorHoleCell(cardState: CardState, row: number, col: number): boolean {
    const cs = cardState as any;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    return markers.some((m: any) => (
        m &&
        m.kind === 'specialStone' &&
        m.row === row &&
        m.col === col &&
        m.data &&
        m.data.type === 'METEOR_HOLE'
    ));
}

function isGuardProtectedCell(cardState: CardState, row: number, col: number): boolean {
    const cs = cardState as any;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    return markers.some((m: any) => (
        m &&
        m.kind === 'specialStone' &&
        m.row === row &&
        m.col === col &&
        m.data &&
        m.data.type === 'GUARD'
    ));
}

function isAbsoluteProtectedCell(cardState: CardState, row: number, col: number): boolean {
    const cs = cardState as any;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    return markers.some((m: any) => (
        m &&
        m.kind === 'specialStone' &&
        m.row === row &&
        m.col === col &&
        m.data &&
        m.data.type === 'ABSOLUTE_PROTECTED'
    ));
}

function isPositionSwapProtectedCell(cardState: CardState, row: number, col: number): boolean {
    const cs = cardState as any;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    const marker = markers.find((m: any) => (
        m &&
        m.kind === 'specialStone' &&
        m.row === row &&
        m.col === col &&
        m.data &&
        m.data.type === 'GLUTTONOUS'
    ));
    return !!marker;
}

function normalizeStep(delta: number): number {
    if (delta === 0) return 0;
    return delta > 0 ? 1 : -1;
}

function buildSuperAttractionLinePath(from: SuperAttractionPoint, to: SuperAttractionPoint): SuperAttractionPoint[] {
    if (!from || !to) return [];
    const rowDelta = Number(to.row) - Number(from.row);
    const colDelta = Number(to.col) - Number(from.col);
    if (!Number.isInteger(rowDelta) || !Number.isInteger(colDelta)) return [];
    if (rowDelta === 0 && colDelta === 0) return [];

    const absRow = Math.abs(rowDelta);
    const absCol = Math.abs(colDelta);
    if (rowDelta !== 0 && colDelta !== 0 && absRow !== absCol) return [];

    const dr = normalizeStep(rowDelta);
    const dc = normalizeStep(colDelta);
    const steps = Math.max(absRow, absCol);
    const out: SuperAttractionPoint[] = [];
    for (let index = 1; index <= steps; index += 1) {
        out.push({
            row: from.row + dr * index,
            col: from.col + dc * index
        });
    }
    return out;
}

function buildSuperAttractionSegment(from: SuperAttractionPoint, to: SuperAttractionPoint): SuperAttractionPathSegment | null {
    if (!from || !to) return null;
    const rowDelta = Number(to.row) - Number(from.row);
    const colDelta = Number(to.col) - Number(from.col);
    if (!Number.isInteger(rowDelta) || !Number.isInteger(colDelta)) return null;
    if (rowDelta === 0 && colDelta === 0) return null;

    const absRow = Math.abs(rowDelta);
    const absCol = Math.abs(colDelta);
    if (rowDelta !== 0 && colDelta !== 0 && absRow !== absCol) return null;

    return {
        from: { row: from.row, col: from.col },
        to: { row: to.row, col: to.col },
        dr: normalizeStep(rowDelta),
        dc: normalizeStep(colDelta),
        length: Math.max(absRow, absCol)
    };
}

function appendUniquePoint(points: SuperAttractionPoint[], point: SuperAttractionPoint): void {
    if (!point) return;
    const last = points.length > 0 ? points[points.length - 1] : null;
    if (last && last.row === point.row && last.col === point.col) return;
    points.push({ row: point.row, col: point.col });
}

function buildSuperAttractionCandidate(
    variant: 'single_segment' | 'diagonal_first' | 'axis_first',
    checkpoints: SuperAttractionPoint[]
): SuperAttractionPathCandidate | null {
    if (!Array.isArray(checkpoints) || checkpoints.length < 2) return null;

    const pathCells: SuperAttractionPoint[] = [];
    const segments: SuperAttractionPathSegment[] = [];
    const waypoints: SuperAttractionPoint[] = [];
    for (let index = 1; index < checkpoints.length; index += 1) {
        const segment = buildSuperAttractionSegment(checkpoints[index - 1], checkpoints[index]);
        if (!segment) return null;
        segments.push(segment);
        const cells = buildSuperAttractionLinePath(segment.from, segment.to);
        for (const cell of cells) {
            appendUniquePoint(pathCells, cell);
        }
        waypoints.push({ row: segment.to.row, col: segment.to.col });
    }

    if (pathCells.length <= 0) return null;
    return {
        variant,
        pathCells,
        segments,
        waypoints,
        movedDistance: pathCells.length
    };
}

function getSuperAttractionPathCandidates(from: SuperAttractionPoint, to: SuperAttractionPoint): SuperAttractionPathCandidate[] {
    if (!from || !to) return [];
    if (!Number.isInteger(from.row) || !Number.isInteger(from.col) || !Number.isInteger(to.row) || !Number.isInteger(to.col)) {
        return [];
    }
    const rowDelta = to.row - from.row;
    const colDelta = to.col - from.col;
    if (rowDelta === 0 && colDelta === 0) return [];

    const absRow = Math.abs(rowDelta);
    const absCol = Math.abs(colDelta);
    if (rowDelta === 0 || colDelta === 0 || absRow === absCol) {
        const singleSegment = buildSuperAttractionCandidate('single_segment', [from, to]);
        return singleSegment ? [singleSegment] : [];
    }

    const rowStep = normalizeStep(rowDelta);
    const colStep = normalizeStep(colDelta);
    const diagonalSteps = Math.min(absRow, absCol);
    const axisSteps = Math.max(absRow, absCol) - diagonalSteps;
    const usesRowAxis = absRow > absCol;

    const diagonalPivot: SuperAttractionPoint = {
        row: from.row + rowStep * diagonalSteps,
        col: from.col + colStep * diagonalSteps
    };
    const axisPivot: SuperAttractionPoint = usesRowAxis
        ? { row: from.row + rowStep * axisSteps, col: from.col }
        : { row: from.row, col: from.col + colStep * axisSteps };

    const out: SuperAttractionPathCandidate[] = [];
    const seen = new Set<string>();
    for (const [variant, checkpoints] of [
        ['diagonal_first', [from, diagonalPivot, to]],
        ['axis_first', [from, axisPivot, to]]
    ] as Array<['diagonal_first' | 'axis_first', SuperAttractionPoint[]]>) {
        const candidate = buildSuperAttractionCandidate(variant, checkpoints);
        if (!candidate) continue;
        const key = candidate.pathCells.map((point) => `${point.row},${point.col}`).join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(candidate);
    }
    return out;
}

export = {
    isBlockingMarkerType,
    isBombCategoryMarker,
    isFrozenCell,
    hasSeedMarkerAt,
    isBlockedCell,
    isMeteorHoleCell,
    isGuardProtectedCell,
    isAbsoluteProtectedCell,
    isPositionSwapProtectedCell,
    getSuperAttractionPathCandidates
};
