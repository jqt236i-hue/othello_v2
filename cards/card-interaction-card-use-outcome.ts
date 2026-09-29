export {};

/**
 * @file card-interaction-card-use-outcome.ts
 * @description Reads the outcome of a card use from a pipeline run result so the
 * browser card UI does not re-open a selection the headless logic has already
 * closed (e.g. 犠牲の意志 nullified the card).
 */

type OwnerKeyNormalizer = (value: any) => string | null;

type CardUseOutcomeInput = {
    playbackEvents?: any[] | null;
    nextCardState?: any;
    ownerKey?: any;
    cardId?: any;
    normalizeOwnerKey?: OwnerKeyNormalizer;
};

function defaultNormalizeOwnerKey(value: any): string | null {
    if (value === 'black' || value === 1 || value === '1') return 'black';
    if (value === 'white' || value === -1 || value === '-1') return 'white';
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'black' || normalized === 'white') return normalized;
    }
    return null;
}

function resolveNormalizer(input: CardUseOutcomeInput): OwnerKeyNormalizer {
    return typeof input.normalizeOwnerKey === 'function' ? input.normalizeOwnerKey : defaultNormalizeOwnerKey;
}

function normalizeCardId(value: any): string {
    return typeof value === 'string' ? value.trim() : '';
}

function matchesOwner(candidate: any, expectedOwnerKey: string | null, normalize: OwnerKeyNormalizer): boolean {
    if (!expectedOwnerKey) return true;
    const candidateOwner = normalize(candidate);
    if (!candidateOwner) return true;
    return candidateOwner === expectedOwnerKey;
}

function matchesCardId(candidate: any, expectedCardId: string): boolean {
    if (!expectedCardId) return true;
    const candidateId = normalizeCardId(candidate);
    if (!candidateId) return true;
    return candidateId === expectedCardId;
}

function getPlaybackEvents(input: CardUseOutcomeInput): any[] {
    return Array.isArray(input.playbackEvents) ? input.playbackEvents : [];
}

function getPresentationEvents(nextCardState: any): any[] {
    if (!nextCardState || typeof nextCardState !== 'object') return [];
    const persisted = Array.isArray(nextCardState._presentationEventsPersist)
        ? nextCardState._presentationEventsPersist
        : [];
    const live = Array.isArray(nextCardState.presentationEvents)
        ? nextCardState.presentationEvents
        : [];
    return persisted.concat(live);
}

/**
 * True when the run result records that this card use was nullified by 犠牲の意志.
 * Checks the mapped playback events first (`card_use_animation` targets), then the
 * raw `CARD_USED` presentation events kept on the next card state.
 */
export function isCardUseNullifiedBySacrificeWill(input: CardUseOutcomeInput = {}): boolean {
    const normalize = resolveNormalizer(input);
    const expectedOwnerKey = normalize(input.ownerKey);
    const expectedCardId = normalizeCardId(input.cardId);

    for (const ev of getPlaybackEvents(input)) {
        if (!ev || ev.type !== 'card_use_animation' || !Array.isArray(ev.targets)) continue;
        for (const target of ev.targets) {
            if (!target || target.nullifiedBySacrificeWill !== true) continue;
            if (!matchesCardId(target.cardId, expectedCardId)) continue;
            const targetOwner = target.owner != null ? target.owner : target.player;
            if (!matchesOwner(targetOwner, expectedOwnerKey, normalize)) continue;
            return true;
        }
    }

    for (const ev of getPresentationEvents(input.nextCardState)) {
        if (!ev || ev.type !== 'CARD_USED') continue;
        const meta = ev.meta && typeof ev.meta === 'object' ? ev.meta : null;
        if (!meta || meta.nullifiedBySacrificeWill !== true) continue;
        if (!matchesCardId(ev.cardId, expectedCardId)) continue;
        const eventOwner = meta.owner != null ? meta.owner : ev.player;
        if (!matchesOwner(eventOwner, expectedOwnerKey, normalize)) continue;
        return true;
    }

    return false;
}
