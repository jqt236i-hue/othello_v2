import type { MatchAuthoritySeatKey } from '../match-authority-types';

export function createTrapVisibilityApi(parseSeatKeyOptional: (value: unknown) => MatchAuthoritySeatKey | null) {
    const record = (value: unknown): Record<string, any> => value && typeof value === 'object' ? value as Record<string, any> : {};
    function isTrapStoneLike(value: unknown): boolean {
        const source = record(value);
        return record(source.data).type === 'TRAP' || source.type === 'TRAP';
    }
    function sanitizeOwnerOnlyTrapState(cardState: unknown, viewerSeatKey: unknown): unknown {
        if (!cardState || typeof cardState !== 'object') return cardState;
        const viewer = parseSeatKeyOptional(viewerSeatKey);
        const state = record(cardState);
        const visible = (entry: unknown) => !isTrapStoneLike(entry) || parseSeatKeyOptional(record(entry).owner) === viewer;
        if (Array.isArray(state.markers)) state.markers = state.markers.filter(visible);
        if (Array.isArray(state.specialStones)) state.specialStones = state.specialStones.filter(visible);
        return cardState;
    }
    return { sanitizeOwnerOnlyTrapState };
}
