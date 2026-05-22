import type { MatchAuthorityPublicApi } from './match-authority-types';

const REQUIRED_MATCH_AUTHORITY_PUBLIC_FUNCTIONS: Array<keyof MatchAuthorityPublicApi> = [
    'normalizePublishMeta',
    'buildPublishResponsePayload',
    'buildRoomPayload',
    'createBufferedSseEventRecord',
    'appendBufferedSseEvent',
    'getBufferedSseReplayEvents'
];

export function assertMatchAuthorityPublicApi<T extends MatchAuthorityPublicApi>(value: T): T {
    const missing = REQUIRED_MATCH_AUTHORITY_PUBLIC_FUNCTIONS.filter((key) => typeof value[key] !== 'function');
    if (missing.length > 0) {
        throw new TypeError(`match-authority missing public API functions: ${missing.join(', ')}`);
    }
    return value;
}
