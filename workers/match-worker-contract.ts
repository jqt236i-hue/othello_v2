import type {
    MatchRoomDurableObjectConstructor,
    MatchWorkerEntrypoint
} from './match-worker-types';

const REQUIRED_ROOM_METHODS = [
    'fetch',
    'handleInternalCreate',
    'handleJoin',
    'handleLeave',
    'handleHandSkin',
    'handlePublish',
    'handleState',
    'handleStream',
    'handleChat',
    'handleLeaderboardSubmit',
    'handleLeaderboardList'
] as const;

export function assertMatchWorkerEntrypoint(value: MatchWorkerEntrypoint): MatchWorkerEntrypoint {
    if (!value || typeof value.fetch !== 'function') {
        throw new TypeError('match Worker entrypoint must expose fetch(request, env)');
    }
    return value;
}

export function assertMatchRoomDurableObjectConstructor(
    value: MatchRoomDurableObjectConstructor
): MatchRoomDurableObjectConstructor {
    const prototype = value && value.prototype;
    const missing = REQUIRED_ROOM_METHODS.filter((method) => typeof prototype[method] !== 'function');
    if (missing.length > 0) {
        throw new TypeError(`MatchRoomDurableObject missing methods: ${missing.join(', ')}`);
    }
    return value;
}
