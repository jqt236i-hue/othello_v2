import type { Lv10Observation, Lv10Player } from './cpu-lv10-position';
import type { Lv10SearchResult } from './cpu-lv10-search';

export type Lv10AdvisorRequest = {
    observation: Lv10Observation;
    publicRecipes?: Partial<Record<Lv10Player, readonly string[]>>;
};

// The transport accepts public observations, never an authoritative snapshot.
// Final legality and freshness remain the responsibility of the game thread.
export function parseLv10AdvisorRequest(value: any): Lv10AdvisorRequest {
    const obs = value?.observation;
    if (!obs || obs.schema !== 'cpu_lv10_observation.v1' || !['black', 'white'].includes(obs.player)
        || !obs.gameState || !obs.cardState || JSON.stringify(value).length > 540000) {
        throw new Error('Invalid Lv10 advisor request');
    }
    const cs = obs.cardState;
    if (cs.decks || cs.deck || cs.prngState || cs._defaultRandomSource || cs._handCopyIdsByPlayer
        || obs.gameState.prngState || value.prngState) throw new Error('Private state in Lv10 advisor request');
    for (const recipe of Object.values(value.publicRecipes || {})) {
        if (!Array.isArray(recipe) || recipe.length > 512 || recipe.some(id => typeof id !== 'string' || id.length > 100)) {
            throw new Error('Invalid Lv10 public recipe');
        }
    }
    return value;
}

export function parseLv10AdvisorResult(value: any): Lv10SearchResult {
    if (!value || typeof value.version !== 'string' || !Number.isInteger(value.transitions)
        || value.transitions < 0 || value.transitions > 4096 || !Array.isArray(value.continuation)
        || value.continuation.length > 16 || JSON.stringify(value).length > 24000
        || (value.action !== null && (!value.action || !['place', 'pass', 'use_card', 'destroy_hand_card'].includes(value.action.type)))) {
        throw new Error('Invalid Lv10 advisor result');
    }
    return value;
}
