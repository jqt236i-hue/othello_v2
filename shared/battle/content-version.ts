import Hash = require('../state-hash');
import Constants = require('../../shared-constants');

/** Presentation edits do not change saved rules. New/unknown fields remain hashed.
 * Array order is significant: default decks and random candidate order depend on it. */
export const BATTLE_PRESENTATION_CARD_FIELDS = Object.freeze(['name', 'desc', 'display_type_ja', 'card_face_art_path']);
export function computeBattleContentVersion(definitions: readonly Record<string, unknown>[]): string {
    return Hash.computeStableHash(definitions.map(definition => Object.fromEntries(
        Object.entries(definition).filter(([key]) => !BATTLE_PRESENTATION_CARD_FIELDS.includes(key))
    )));
}
/** enabled:false excludes an initial deck, not a card generated during play. */
export function getBattleRuntimeCardDefinitions(): Record<string, any>[] {
    if (!Array.isArray(Constants.CARD_DEFS) || !Constants.CARD_DEFS.length) throw new Error('Battle card definitions are unavailable');
    return Constants.CARD_DEFS.map((card: any) => ({ ...card }));
}
export const BATTLE_CONTENT_VERSION = computeBattleContentVersion(getBattleRuntimeCardDefinitions());

/** Only this inspected legacy full-catalog digest is eligible for identifier migration.
 * Never infer compatibility from a current/dynamically calculated legacy digest. */
export const BATTLE_LEGACY_CONTENT_VERSIONS: Readonly<Record<string, string>> = Object.freeze({
    'fnv1a32:f89cfb79': 'fnv1a32:068d90fd'
});
