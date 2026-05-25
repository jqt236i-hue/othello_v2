import type { CardState } from '../../../src/types';

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

export = {
    isBlockingMarkerType,
    isBombCategoryMarker,
    isFrozenCell,
    hasSeedMarkerAt,
    isBlockedCell,
    isMeteorHoleCell,
    isGuardProtectedCell,
    isAbsoluteProtectedCell,
    isPositionSwapProtectedCell
};
