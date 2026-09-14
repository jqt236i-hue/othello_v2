/** Invocation-owned client state. Domain views share storage with the legacy flat facade. */
export interface NetworkClientStateOptions {
    serverUrl: string;
    turnLimitSeconds: number;
    resultState: { lastResultVersionShown: number | null; resultShownForUnversioned: boolean };
}

function stateView<T extends object, K extends keyof T>(source: T, keys: readonly K[]): Pick<T, K> {
    const view = {} as Pick<T, K>;
    for (const key of keys) Object.defineProperty(view, key, {
        enumerable: true,
        get: () => source[key],
        set: (value: T[K]) => { source[key] = value; }
    });
    return Object.preventExtensions(view);
}

export function createNetworkClientState(options: NetworkClientStateOptions) {
    const session = {
        active: false,
        roomId: '',
        viewerRole: 'seat',
        spectatorId: '',
        spectatorToken: '',
        spectatorName: '',
        seatKey: 'black',
        seatToken: '',
        roomSeats: { black: false, white: false },
        seatNames: { black: '', white: '' },
        seatHandSkins: { black: '', white: '' },
        roomDeck: null,
        roomBoardConfig: null,
        networkDebugEnabled: false,
        networkAutoEnabled: false,
        statusWriter: null as any,
        roomStateListener: null as any,
        chatListener: null as any,
        rematchRequestListener: null as any,
        chatHistory: [] as any[],
        turnTimer: {
            limitSeconds: options.turnLimitSeconds,
            active: false,
            turnSeatKey: 'black',
            turnStartedAt: null as any,
            turnDeadlineAt: null as any
        },
        turnTimerListener: null as any,
        turnTimerTickHandle: 0,
        turnTimerSyncRequestedDeadline: null as any,
        serverTimeOffsetMs: 0,
        lastAutoPassNoticeSignature: ''
    };
    const connection = {
        serverUrl: options.serverUrl,
        streamTransport: 'sse',
        eventSource: null as any,
        lastStreamActivityAt: 0,
        lastStreamEventId: '',
        streamWatchdogTimerId: 0,
        reconnectTimerId: null,
        reconnectAttempt: 0,
        heartbeatResyncInFlight: false,
        reconnectRecoveryTimerId: null as any,
        reconnectRecoveryPending: false,
        networkRecoverySyncInFlight: false
    };
    const publishing = {
        publishChain: Promise.resolve() as any,
        publishTracker: {
            nextSequence: 0,
            operations: []
        }
    };
    const authority = {
        stateVersion: null as any,
        appliedStateVersion: null as any,
        authoritativeMatchState: {
            authoritativeTurnIndex: null as any,
            stateVersion: null as any,
            authority: null as any,
            projectedForSeat: null as any,
            turnStartReconciled: false,
            projectedSnapshotHash: null as any,
            lastAppliedProjectedSnapshotHash: null as any
        }
    };
    const presentation = {
        lastResultVersionShown: options.resultState.lastResultVersionShown,
        resultShownForUnversioned: options.resultState.resultShownForUnversioned,
        lastVisualSeq: 0,
        lastVisualVersion: null as any,
        pendingForceSyncPlaybackVersion: null as any,
        pendingForceSyncPlaybackSource: '',
        pendingForceSyncPlaybackSignature: '',
        lastStateSyncRecoveredPlaybackSignature: '',
        localPresentationState: {
            preservedQueues: null,
            lastPlaybackEvents: [],
            busy: false,
            playbackSuppressed: false
        }
    };
    const diagnostics = {
        networkTelemetry: {
            counts: {} as any,
            recentEvents: [] as any[]
        }
    };
    const state = {} as typeof session & typeof connection & typeof publishing & typeof authority & typeof presentation & typeof diagnostics;
    for (const domain of [session, connection, publishing, authority, presentation, diagnostics]) {
        for (const key of Object.keys(domain)) Object.defineProperty(state, key, {
            enumerable: true,
            get: () => Reflect.get(domain, key),
            set: (value: unknown) => { Reflect.set(domain, key, value); }
        });
    }
    const reconnection = stateView(state, ["serverUrl","eventSource","lastStreamActivityAt","lastStreamEventId","streamWatchdogTimerId","reconnectTimerId","reconnectAttempt","heartbeatResyncInFlight","reconnectRecoveryTimerId","reconnectRecoveryPending","networkRecoverySyncInFlight","stateVersion"] as const);
    const stream = stateView(state, ['active', 'serverUrl', 'streamTransport', 'roomId', 'viewerRole', 'spectatorId', 'spectatorToken', 'seatKey', 'seatToken', 'eventSource', 'lastStreamEventId', 'reconnectAttempt'] as const);
    return { state, session, connection, publishing, authority, presentation, diagnostics, reconnection, stream };
}

export type NetworkReconnectState = ReturnType<typeof createNetworkClientState>['reconnection'];
export type NetworkStreamState = ReturnType<typeof createNetworkClientState>['stream'];
