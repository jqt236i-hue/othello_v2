import type MatchAuthorityModule = require('./match-authority');
import type {
    MatchAuthorityRoomState,
    MatchAuthorityPublishPayloadFromRoomOptions,
    MatchAuthorityPublishResponsePayload
} from './match-authority-types';

export interface MatchPublishPayloadOptions extends MatchAuthorityPublishPayloadFromRoomOptions {
    ok?: boolean;
}

export interface MatchPublishPayloadPorts<Room extends MatchAuthorityRoomState | null | undefined> {
    authority: Pick<typeof MatchAuthorityModule, 'shouldUseAckOnlyPublishResponse' | 'buildPublishAckPayloadFromRoom' | 'normalizeEffectLogMessages' | 'toDebugPlaybackDiagnostics' | 'buildPublishPayloadFromRoom'>;
    buildPresentationCursor(room: Room): unknown;
    toPublicSnapshot(room: Room, viewerSeatKey: unknown): unknown;
    toPublicRoomDeck(room: Room): unknown;
    toPublicRoomBoardConfig(room: Room): unknown;
    toPublicNetworkDebugEnabled(room: Room): boolean;
    toPublicNetworkAutoEnabled(room: Room): boolean;
    toPublicTurnTimer(room: Room, serverTime: number): unknown;
    buildPresentationFrames(room: Room, viewerSeatKey: unknown, options: MatchPublishPayloadOptions): unknown;
    decoratePayload(payload: MatchAuthorityPublishResponsePayload, room: Room): MatchAuthorityPublishResponsePayload;
    /** The local server historically decorates ACKs; the Worker keeps them minimal. */
    decorateAcknowledgement: boolean;
}

/** Shared wire assembly. Projection and environment-specific decoration stay explicit ports. */
export function createMatchPublishPayloadBuilder<Room extends MatchAuthorityRoomState | null | undefined>(
    ports: MatchPublishPayloadPorts<Room>
) {
    // Worker catalog preload must finish before its authority module is evaluated.
    const MatchAuthority = ports.authority;
    return function buildPublishPayload(room: Room, viewerSeatKey: unknown, options: MatchPublishPayloadOptions = {}) {
        const serverTime = Number.isFinite(Number(options.serverTime)) ? Number(options.serverTime) : Date.now();
        const presentationCursor = ports.buildPresentationCursor(room);
        if (MatchAuthority.shouldUseAckOnlyPublishResponse(room, options)) {
            const acknowledgement = MatchAuthority.buildPublishAckPayloadFromRoom(room, {
                ok: true,
                stateVersion: room && Number.isFinite(Number(room.stateVersion)) ? Number(room.stateVersion) : null,
                presentationCursor,
                serverTime,
                idempotentReplay: options.idempotentReplay === true,
                publishMeta: options.publishMeta || null
            });
            return ports.decorateAcknowledgement ? ports.decoratePayload(acknowledgement, room) : acknowledgement;
        }
        const networkDebugEnabled = ports.toPublicNetworkDebugEnabled(room);
        const snapshot = Object.prototype.hasOwnProperty.call(options, 'snapshot')
            ? options.snapshot : ports.toPublicSnapshot(room, viewerSeatKey);
        const payloadOptions: MatchAuthorityPublishPayloadFromRoomOptions = {
            ok: options.ok === true,
            snapshot,
            roomDeck: ports.toPublicRoomDeck(room),
            roomBoardConfig: ports.toPublicRoomBoardConfig(room),
            networkDebugEnabled,
            networkAutoEnabled: ports.toPublicNetworkAutoEnabled(room),
            turnTimer: ports.toPublicTurnTimer(room, serverTime),
            playbackEvents: Array.isArray(options.playbackEvents) ? options.playbackEvents : [],
            effectLogs: MatchAuthority.normalizeEffectLogMessages(options.effectLogs),
            presentationCursor,
            presentationFrames: ports.buildPresentationFrames(room, viewerSeatKey, options),
            serverTime,
            idempotentReplay: options.idempotentReplay === true,
            publishMeta: options.publishMeta || null
        };
        for (const key of ['rejectedReason', 'errorMessage', 'autoPassNotice'] as const) {
            if (Object.prototype.hasOwnProperty.call(options, key)) payloadOptions[key] = options[key] || null;
        }
        if (Object.prototype.hasOwnProperty.call(options, 'playbackDiagnostics')) {
            payloadOptions.playbackDiagnostics = MatchAuthority.toDebugPlaybackDiagnostics(options.playbackDiagnostics, networkDebugEnabled);
        }
        return ports.decoratePayload(MatchAuthority.buildPublishPayloadFromRoom(room, payloadOptions), room);
    };
}
