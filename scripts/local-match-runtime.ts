const Core = require('../game/logic/core');
const CardLogic = require('../game/logic/cards');
const TurnPipeline = require('../game/turn/turn_pipeline');
const TurnPipelinePhases = require('../game/turn/turn_pipeline_phases');
const SeededPRNG = require('../game/schema/prng');
const deepClone = require('../utils/deepClone');
const MatchAuthority = require('../utils/match-authority');
const MatchRuntimeCore = require('../utils/match-runtime-core');
const LocalMatchServer = require('./local-match-server');

function makeInitialSnapshot(seed: number, options: any) {
    if (LocalMatchServer && typeof LocalMatchServer.makeInitialSnapshot === 'function') {
        return LocalMatchServer.makeInitialSnapshot(seed, options);
    }
    const gameState = Core.createGameState(options && options.boardConfig);
    const prng = SeededPRNG.createPRNG(seed);
    const cardState = CardLogic.createCardState(prng, options || {});
    TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', [], prng);
    return { gameState, cardState, stateVersion: 0, updatedAt: Date.now() };
}

function createRoom(options: any) {
    const opts = (options && typeof options === 'object') ? options : {};
    const seed = Number.isFinite(Number(opts.seed)) ? Math.trunc(Number(opts.seed)) : Date.now();
    const initialOptions = LocalMatchServer && typeof LocalMatchServer.buildInitialDeckSnapshotOptions === 'function'
        ? LocalMatchServer.buildInitialDeckSnapshotOptions(opts)
        : {};
    const snapshot = makeInitialSnapshot(seed, initialOptions);
    return {
        roomId: String(opts.roomId || 'LOCAL').trim().toUpperCase() || 'LOCAL',
        seed,
        snapshot,
        authoritativeStateHash: MatchAuthority.computeAuthoritativeStateHash(snapshot),
        stateVersion: 0,
        seats: { black: true, white: true },
        seatNames: { black: 'black', white: 'white' },
        seatHandSkins: { black: '', white: '' },
        seatTokens: { black: 'local_black_token', white: 'local_white_token' },
        roomDeck: null,
        roomBoardConfig: initialOptions.boardConfig || MatchAuthority.normalizeRoomBoardConfig(null),
        networkDebugEnabled: opts.networkDebugEnabled === true,
        publishResponseMode: MatchAuthority.normalizePublishResponseMode(opts.publishResponseMode),
        turnTimer: { limitSeconds: 120, active: false, turnSeatKey: 'black', turnStartedAt: null, turnDeadlineAt: null },
        lastAcceptedOperationBySeat: { black: null, white: null },
        acceptedOperationHistoryBySeat: { black: [], white: [] },
        eventSeq: 0,
        sseEventBuffer: [],
        authorityLog: [],
        chatMessages: [],
        chatSeq: 0,
        updatedAt: Date.now()
    };
}

function normalizePlayerKey(value: any) {
    return MatchAuthority.normalizePlayerKey(value, 'black');
}

function normalizeBaseVersion(value: any) {
    return Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : null;
}

function buildPayload(room: any, viewerSeatKey: any, options: any) {
    const opts = (options && typeof options === 'object') ? options : {};
    if (MatchAuthority.shouldUseAckOnlyPublishResponse(room, opts)) {
        return MatchAuthority.buildPublishAckPayloadFromRoom(room, Object.assign({
            presentationCursor: {
                visualSeq: Number.isFinite(Number(room.visualSeq)) ? Number(room.visualSeq) : 0,
                stateVersion: Number.isFinite(Number(room.stateVersion)) ? Number(room.stateVersion) : 0
            },
            serverTime: Date.now()
        }, opts));
    }
    return MatchAuthority.buildPublishPayloadFromRoom(room, Object.assign({
        snapshot: Object.prototype.hasOwnProperty.call(opts, 'snapshot')
            ? opts.snapshot
            : MatchAuthority.buildPublicSnapshot(room, viewerSeatKey),
        roomDeck: room.roomDeck,
        roomBoardConfig: room.roomBoardConfig,
        networkDebugEnabled: room.networkDebugEnabled === true,
        turnTimer: room.turnTimer || null,
        playbackEvents: [],
        effectLogs: [],
        serverTime: Date.now()
    }, opts));
}

function createRuntime(options: any) {
    const room = createRoom(options);

    function applyCommand(bodyValue: any) {
        const body = (bodyValue && typeof bodyValue === 'object') ? bodyValue : {};
        const seatKey = normalizePlayerKey(body.seatKey || body.playerKey || body.actor);
        const playerKey = normalizePlayerKey(body.playerKey || body.actor || seatKey);
        const operationId = MatchAuthority.normalizeOperationId(body.operationId);
        const actionType = String(body.actionType || (body.action && (body.action.type || body.action.actionType)) || '').trim() || null;
        const baseVersion = normalizeBaseVersion(body.baseVersion);

        if (!MatchAuthority.hasRequiredOperationId(operationId)) {
            return buildPayload(room, seatKey, MatchAuthority.buildPublishResponseOptions({
                ok: false,
                rejectedReason: 'OPERATION_ID_REQUIRED',
                publishKind: 'rejected',
                operationId,
                actionType,
                receivedBaseVersion: baseVersion,
                authoritativeStateVersion: room.stateVersion
            }));
        }

        const previousAccepted = MatchAuthority.resolveAcceptedOperation(room, seatKey, operationId, null);
        if (previousAccepted) {
            return buildPayload(room, seatKey, MatchAuthority.buildPublishResponseOptions({
                ok: true,
                idempotentReplay: true,
                publishKind: 'idempotent_replay',
                operationId,
                actionType,
                receivedBaseVersion: baseVersion,
                authoritativeStateVersion: room.stateVersion,
                replayedStateVersion: previousAccepted.stateVersion
            }));
        }

        if (baseVersion === null || baseVersion !== room.stateVersion) {
            const rejectedReason = MatchAuthority.classifyVersionRejectionReason(baseVersion, room.stateVersion);
            return buildPayload(room, seatKey, MatchAuthority.buildPublishResponseOptions({
                ok: false,
                rejectedReason,
                publishKind: 'rejected',
                operationId,
                actionType,
                receivedBaseVersion: baseVersion,
                authoritativeStateVersion: room.stateVersion
            }));
        }

        const expectedPlayerKey = MatchAuthority.getCurrentPlayerKey(room.snapshot && room.snapshot.gameState);
        if (playerKey !== expectedPlayerKey && !MatchAuthority.isFateWillControllerForCurrentTurn(room.snapshot, playerKey)) {
            return buildPayload(room, seatKey, MatchAuthority.buildPublishResponseOptions({
                ok: false,
                rejectedReason: 'OUT_OF_TURN',
                publishKind: 'rejected',
                operationId,
                actionType,
                receivedBaseVersion: baseVersion,
                authoritativeStateVersion: room.stateVersion
            }));
        }

        const previousSnapshotForChargeDelta = deepClone(room.snapshot);
        const stateHashBefore = MatchAuthority.computeAuthoritativeStateHash(room.snapshot);
        const commandResult = MatchRuntimeCore.applyCommandToSnapshot(room, body, playerKey, {
            TurnPipeline,
            applyCommandPublishToSnapshot: LocalMatchServer.applyCommandPublishToSnapshot
        });
        if (!commandResult || commandResult.ok !== true) {
            return buildPayload(room, seatKey, MatchAuthority.buildPublishResponseOptions({
                ok: false,
                rejectedReason: (commandResult && commandResult.rejectedReason) || 'COMMAND_REJECTED',
                errorMessage: commandResult && commandResult.errorMessage ? commandResult.errorMessage : null,
                publishKind: 'rejected',
                operationId,
                actionType,
                receivedBaseVersion: baseVersion,
                authoritativeStateVersion: room.stateVersion
            }));
        }

        room.stateVersion += 1;
        commandResult.snapshot.stateVersion = room.stateVersion;
        commandResult.snapshot.updatedAt = Date.now();
        const boardContractInspection = MatchAuthority.normalizeSnapshotBoardContract(commandResult.snapshot, {
            allowLegacy: true,
            requireFullSnapshot: true
        });
        if (!boardContractInspection || boardContractInspection.ok !== true) {
            room.stateVersion -= 1;
            return buildPayload(room, seatKey, MatchAuthority.buildPublishResponseOptions({
                ok: false,
                rejectedReason: 'INVALID_BOARD_CONTRACT',
                publishKind: 'rejected',
                operationId,
                actionType,
                receivedBaseVersion: baseVersion,
                authoritativeStateVersion: room.stateVersion
            }));
        }
        room.snapshot = commandResult.snapshot;
        room.updatedAt = commandResult.snapshot.updatedAt;
        room.authoritativeStateHash = MatchAuthority.computeAuthoritativeStateHash(room.snapshot);
        MatchAuthority.rememberAcceptedOperationBySeat(room, seatKey, {
            operationId,
            stateVersion: room.stateVersion,
            updatedAt: room.updatedAt
        });
        MatchAuthority.appendAuthorityLog(room, {
            kind: 'publish_accepted',
            operationId,
            actionType: actionType || (commandResult.action && commandResult.action.type) || null,
            baseVersion,
            committedVersion: room.stateVersion,
            stateHashBefore,
            stateHashAfter: room.authoritativeStateHash,
            pendingEffectId: commandResult.pendingEffectId || null,
            dedupeOutcome: 'accepted'
        });

        const publicSnapshot = MatchAuthority.buildPublicSnapshot(room, seatKey);
        if (typeof MatchAuthority.restoreMissingChargeDeltaEvents === 'function') {
            MatchAuthority.restoreMissingChargeDeltaEvents(previousSnapshotForChargeDelta, publicSnapshot);
        }
        return buildPayload(room, seatKey, MatchAuthority.buildPublishResponseOptions({
            ok: true,
            snapshot: publicSnapshot,
            playbackEvents: commandResult.playbackEvents || [],
            effectLogs: commandResult.effectLogs || [],
            playbackDiagnostics: commandResult.playbackDiagnostics || null,
            publishKind: 'accepted',
            operationId,
            actionType,
            receivedBaseVersion: baseVersion,
            authoritativeStateVersion: room.stateVersion
        }));
    }

    return {
        getRoom: () => room,
        getSnapshot: () => room.snapshot,
        applyCommand
    };
}

export = {
    createRuntime
};
