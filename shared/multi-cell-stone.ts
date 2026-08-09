export const SHINRA_BANSHO_GOD_TYPE = 'SHINRA_BANSHO_GOD';
export const SQUARE_2X2_FOOTPRINT = 'square_2x2.v1';

export interface MultiCellStoneFootprintCell {
    row: number;
    col: number;
    role: 'anchor' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export interface MultiCellStoneInspectionAccess {
    black: number;
    white: number;
    hasPlayableCell: (row: number, col: number) => boolean;
    getCellOwner: (row: number, col: number) => unknown;
}

function normalizeType(value: unknown): string {
    return String(value || '').trim().toUpperCase();
}

function markerOwnerValue(marker: any, access: MultiCellStoneInspectionAccess): number | null {
    if (marker && (marker.owner === 'black' || marker.owner === access.black)) return access.black;
    if (marker && (marker.owner === 'white' || marker.owner === access.white)) return access.white;
    return null;
}

export function isMultiCellSpecialStoneMarker(marker: any): boolean {
    return normalizeType(marker && marker.data && marker.data.type) === SHINRA_BANSHO_GOD_TYPE;
}

export function getSpecialStoneFootprint(
    marker: any
): ReadonlyArray<Readonly<MultiCellStoneFootprintCell>> {
    if (!marker || typeof marker !== 'object' || Array.isArray(marker)) return Object.freeze([]);
    const row = marker.row;
    const col = marker.col;
    if (!Number.isInteger(row) || !Number.isInteger(col)) return Object.freeze([]);
    const footprint = String(marker && marker.data && marker.data.footprint || '');
    if (
        !isMultiCellSpecialStoneMarker(marker)
        || (footprint && footprint !== SQUARE_2X2_FOOTPRINT)
    ) {
        return Object.freeze([
            Object.freeze({ row, col, role: 'anchor' as const })
        ]);
    }
    return Object.freeze([
        Object.freeze({ row, col, role: 'anchor' as const }),
        Object.freeze({ row, col: col + 1, role: 'top-right' as const }),
        Object.freeze({ row: row + 1, col, role: 'bottom-left' as const }),
        Object.freeze({ row: row + 1, col: col + 1, role: 'bottom-right' as const })
    ]);
}

export function markerOccupiesCell(marker: any, row: unknown, col: unknown): boolean {
    const targetRow = Number(row);
    const targetCol = Number(col);
    if (!Number.isInteger(targetRow) || !Number.isInteger(targetCol)) return false;
    return getSpecialStoneFootprint(marker).some((cell) => (
        cell.row === targetRow && cell.col === targetCol
    ));
}

export function inspectMultiCellSpecialStoneGroups(
    cardState: unknown,
    access: MultiCellStoneInspectionAccess
): string[] {
    const markers = cardState
        && typeof cardState === 'object'
        && !Array.isArray(cardState)
        && Array.isArray((cardState as any).markers)
        ? (cardState as any).markers
        : [];
    const errors: string[] = [];
    const occupiedByGroup = new Map<string, number>();

    markers.forEach((marker: any, index: number) => {
        if (!isMultiCellSpecialStoneMarker(marker)) return;
        if (!marker || marker.kind !== 'specialStone') {
            errors.push(`cardState.markers[${index}] ${SHINRA_BANSHO_GOD_TYPE} must be a specialStone marker`);
            return;
        }
        if (
            !marker.data
            || String(marker.data.footprint || '') !== SQUARE_2X2_FOOTPRINT
        ) {
            errors.push(`cardState.markers[${index}] ${SHINRA_BANSHO_GOD_TYPE} requires ${SQUARE_2X2_FOOTPRINT}`);
            return;
        }
        if (!Number.isInteger(marker.row) || !Number.isInteger(marker.col)) {
            errors.push(`cardState.markers[${index}] ${SHINRA_BANSHO_GOD_TYPE} needs exact integer row/col`);
            return;
        }
        const ownerValue = markerOwnerValue(marker, access);
        if (ownerValue === null) {
            errors.push(`cardState.markers[${index}] ${SHINRA_BANSHO_GOD_TYPE} has invalid owner`);
            return;
        }
        const footprint = getSpecialStoneFootprint(marker);
        if (footprint.length !== 4) {
            errors.push(`cardState.markers[${index}] ${SHINRA_BANSHO_GOD_TYPE} has an invalid footprint`);
            return;
        }
        for (const cell of footprint) {
            const key = `${cell.row},${cell.col}`;
            if (!access.hasPlayableCell(cell.row, cell.col)) {
                errors.push(`${SHINRA_BANSHO_GOD_TYPE} footprint cell ${key} must be playable`);
                continue;
            }
            if (access.getCellOwner(cell.row, cell.col) !== ownerValue) {
                errors.push(`${SHINRA_BANSHO_GOD_TYPE} footprint cell ${key} must match marker owner`);
            }
            const previousIndex = occupiedByGroup.get(key);
            if (previousIndex !== undefined && previousIndex !== index) {
                errors.push(`${SHINRA_BANSHO_GOD_TYPE} footprint cell ${key} overlaps another group`);
            } else {
                occupiedByGroup.set(key, index);
            }
        }
    });

    return errors;
}
