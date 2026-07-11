import type { GameState, PlayerKey } from '../../src/types';
import type {
    MatchAuthorityProjectionMetadata,
    MatchAuthorityPublicSnapshot,
    MatchAuthorityRoomState,
    MatchAuthoritySeatKey,
    MatchAuthorityViewer
} from '../match-authority-types';

type RecordValue = Record<string, any>;

interface MatchAuthorityProjectionDeps {
    playerKeys: readonly PlayerKey[];
    deepClone: (value: unknown) => unknown;
    now: () => number;
    parseSeatKeyOptional: (value: unknown) => MatchAuthoritySeatKey | null;
    normalizeSpectatorId: (value: unknown) => string;
    getCurrentPlayerKey: (gameState: Partial<GameState> | null | undefined) => PlayerKey;
    getOpponentKey: (playerKey: PlayerKey | null | undefined) => PlayerKey;
    isManifestStoneMarker: ((marker: unknown) => boolean) | null;
    sanitizeOwnerOnlyTrapState: (cardState: unknown, viewerSeatKey: unknown) => unknown;
    stripTransientPresentationState: (nextSnapshot: unknown) => unknown;
    computeStableHash: ((value: unknown) => string) | null;
    makeHiddenHandToken: (ownerKey: unknown, handIndex: unknown) => string;
    isHiddenHandTokenLike: (value: unknown) => boolean;
    parseHiddenHandToken: (value: unknown) => { ownerKey: MatchAuthoritySeatKey; handIndex: number } | null;
    normalizeProjectedHandIndex: (value: unknown, fallbackIndex: unknown, handLength: unknown) => number | null;
    normalizeCardCopyIdList: (values: unknown) => number[];
    normalizeHandCopyIdArray: (values: unknown, targetLength: unknown) => Array<number | null>;
    buildVisibleHandCostAdjustments: (
        cardState: Record<string, unknown>,
        ownerHandCopyIds: Array<number | null>,
        projectedOwnerHand: unknown[]
    ) => Array<Record<string, number> | null>;
}

type PublishViewerKey = MatchAuthoritySeatKey | 'spectator';

type PublishViewerArtifactsOptions = {
    canonicalHash?: string | null;
    perfCounters?: Record<string, number>;
    onViewerProjected?: (viewerKey: PublishViewerKey, snapshot: MatchAuthorityPublicSnapshot) => void;
};

type PublishViewerArtifacts = {
    canonicalHash: string | null;
    projectedSnapshots: Record<PublishViewerKey, MatchAuthorityPublicSnapshot>;
    snapshotPayloads: Partial<Record<PublishViewerKey, unknown>>;
};

function asRecord(value: unknown): RecordValue {
    return value && typeof value === 'object' ? value as RecordValue : {};
}

export function createMatchAuthorityProjectionApi(deps: MatchAuthorityProjectionDeps) {
    function getFateWillControllerKey(snapshot: unknown, turnOwnerKey: PlayerKey | null | undefined): PlayerKey | null {
        const snapshotRecord = asRecord(snapshot);
        const cardState = (snapshotRecord.cardState && typeof snapshotRecord.cardState === 'object')
            ? asRecord(snapshotRecord.cardState)
            : null;
        if (!cardState) return null;
        const controllerMap = (cardState.fateWillControllerByTurnOwner && typeof cardState.fateWillControllerByTurnOwner === 'object')
            ? asRecord(cardState.fateWillControllerByTurnOwner)
            : {};
        const owner = deps.parseSeatKeyOptional(turnOwnerKey);
        if (!owner) return null;
        return deps.parseSeatKeyOptional(controllerMap[owner]) || null;
    }

    function isFateWillControllerForCurrentTurn(snapshot: unknown, seatKey: PlayerKey | null | undefined): boolean {
        const seat = deps.parseSeatKeyOptional(seatKey);
        if (!seat) return false;
        const snapshotRecord = asRecord(snapshot);
        const gameState = (snapshotRecord.gameState && typeof snapshotRecord.gameState === 'object')
            ? snapshotRecord.gameState as Partial<GameState>
            : null;
        const currentPlayerKey = deps.getCurrentPlayerKey(gameState);
        if (seat === currentPlayerKey) return false;
        const controllerKey = getFateWillControllerKey(snapshot, currentPlayerKey);
        return controllerKey === seat;
    }

    function canViewerInspectOwnerHand(snapshot: unknown, viewerSeatKey: unknown, ownerSeatKey: unknown): boolean {
        const viewer = deps.parseSeatKeyOptional(viewerSeatKey);
        const owner = deps.parseSeatKeyOptional(ownerSeatKey);
        if (!viewer || !owner) return false;
        if (viewer === owner) return true;
        const snapshotRecord = asRecord(snapshot);
        const gameState = (snapshotRecord.gameState && typeof snapshotRecord.gameState === 'object')
            ? snapshotRecord.gameState as Partial<GameState>
            : null;
        const currentPlayerKey = deps.getCurrentPlayerKey(gameState);
        if (owner !== currentPlayerKey) return false;
        return getFateWillControllerKey(snapshot, owner) === viewer;
    }

    function isObserverWillRevealMarker(markerValue: unknown): boolean {
        const marker = asRecord(markerValue);
        const data = marker.data && typeof marker.data === 'object' ? asRecord(marker.data) : {};
        if (String(data.type || '').toUpperCase() !== 'OBSERVER_WILL') return false;
        if (deps.isManifestStoneMarker) {
            if (!deps.isManifestStoneMarker(markerValue)) return false;
        } else {
            const kind = String(marker.kind || '');
            if (kind !== 'manifestStone' && kind !== 'specialStone') return false;
        }
        const remaining = Number(data.remainingOwnerTurns);
        return !Number.isFinite(remaining) || remaining > 0;
    }

    function hasActiveObserverWillReveal(snapshot: unknown, viewerSeatKey: unknown, ownerSeatKey: unknown): boolean {
        const viewer = deps.parseSeatKeyOptional(viewerSeatKey);
        const owner = deps.parseSeatKeyOptional(ownerSeatKey);
        if (!viewer || !owner || viewer === owner) return false;
        const snapshotRecord = asRecord(snapshot);
        const cardState = (snapshotRecord.cardState && typeof snapshotRecord.cardState === 'object')
            ? asRecord(snapshotRecord.cardState)
            : null;
        const markers = cardState && Array.isArray(cardState.markers) ? cardState.markers : [];
        return markers.some((markerValue: unknown) => {
            const marker = asRecord(markerValue);
            if (deps.parseSeatKeyOptional(marker.owner) !== viewer) return false;
            return isObserverWillRevealMarker(markerValue);
        });
    }

    function projectSnapshotForViewer(
        snapshotValue: unknown,
        viewerSeatKey: PlayerKey | null | undefined,
        metadata?: MatchAuthorityProjectionMetadata
    ): MatchAuthorityPublicSnapshot {
        const shot = deps.deepClone(snapshotValue || {}) as MatchAuthorityPublicSnapshot;
        const meta = (metadata && typeof metadata === 'object') ? metadata : {};
        if (Number.isFinite(Number(meta.stateVersion))) {
            shot.stateVersion = Number(meta.stateVersion);
        }
        if (Number.isFinite(Number(meta.updatedAt))) {
            shot.updatedAt = Number(meta.updatedAt);
        }

        const cardState = (shot.cardState && typeof shot.cardState === 'object') ? asRecord(shot.cardState) : null;
        if (!cardState) return shot;

        const viewer = deps.parseSeatKeyOptional(viewerSeatKey);
        const spectatorView = String(meta.viewerRole || '').trim() === 'spectator';
        deps.sanitizeOwnerOnlyTrapState(cardState, viewer);
        const hands = (cardState.hands && typeof cardState.hands === 'object') ? asRecord(cardState.hands) : {};
        const sourceHands: Record<PlayerKey, unknown[]> = { black: [], white: [] };
        const handCopyIdsByPlayer = (cardState._handCopyIdsByPlayer && typeof cardState._handCopyIdsByPlayer === 'object')
            ? asRecord(cardState._handCopyIdsByPlayer)
            : {};
        const revealedHandCopyIdsByViewer = (cardState._revealedHandCopyIdsByViewer && typeof cardState._revealedHandCopyIdsByViewer === 'object')
            ? asRecord(cardState._revealedHandCopyIdsByViewer)
            : {};
        const revealedCopyIdsForViewer = viewer
            ? new Set(deps.normalizeCardCopyIdList(revealedHandCopyIdsByViewer[viewer]))
            : new Set();
        cardState.hands = cardState.hands && typeof cardState.hands === 'object' ? cardState.hands : {};
        const projectedHands = asRecord(cardState.hands);
        const observedHandSlotsByPlayer: Record<PlayerKey, number[]> = { black: [], white: [] };
        const handCostAdjustmentsByPlayer: Record<PlayerKey, Array<Record<string, number> | null>> = { black: [], white: [] };

        for (const ownerKey of deps.playerKeys) {
            const ownerHand = Array.isArray(hands[ownerKey])
                ? hands[ownerKey].map((cardId: unknown, handIndex: number) => (
                    deps.isHiddenHandTokenLike(cardId)
                        ? deps.makeHiddenHandToken(ownerKey, handIndex)
                        : cardId
                ))
                : [];
            const ownerHandCopyIds = deps.normalizeHandCopyIdArray(handCopyIdsByPlayer[ownerKey], ownerHand.length);
            sourceHands[ownerKey] = ownerHand;
            const observedSlots = new Set<number>();
            for (const observingSeat of deps.playerKeys) {
                if (observingSeat === ownerKey) continue;
                if (hasActiveObserverWillReveal(shot, observingSeat, ownerKey)) {
                    for (let handIndex = 0; handIndex < ownerHand.length; handIndex += 1) {
                        observedSlots.add(handIndex);
                    }
                    continue;
                }
                const observedCopyIds = new Set(deps.normalizeCardCopyIdList(revealedHandCopyIdsByViewer[observingSeat]));
                for (let handIndex = 0; handIndex < ownerHandCopyIds.length; handIndex += 1) {
                    const cardCopyId = ownerHandCopyIds[handIndex];
                    if (typeof cardCopyId === 'number' && Number.isInteger(cardCopyId) && observedCopyIds.has(cardCopyId)) {
                        observedSlots.add(handIndex);
                    }
                }
            }
            observedHandSlotsByPlayer[ownerKey] = Array.from(observedSlots).sort((a, b) => a - b);
            let projectedOwnerHand: unknown[];
            if (spectatorView || canViewerInspectOwnerHand(shot, viewer, ownerKey) || hasActiveObserverWillReveal(shot, viewer, ownerKey)) {
                projectedOwnerHand = ownerHand.slice();
            } else {
                projectedOwnerHand = ownerHand.map((cardId: unknown, handIndex: number) => {
                    const cardCopyId = ownerHandCopyIds[handIndex];
                    const shouldReveal = viewer
                        && Number.isInteger(cardCopyId)
                        && revealedCopyIdsForViewer.has(cardCopyId)
                        && !deps.isHiddenHandTokenLike(cardId);
                    return shouldReveal ? cardId : deps.makeHiddenHandToken(ownerKey, handIndex);
                });
            }
            projectedHands[ownerKey] = projectedOwnerHand;
            handCostAdjustmentsByPlayer[ownerKey] = deps.buildVisibleHandCostAdjustments(
                cardState,
                ownerHandCopyIds,
                projectedOwnerHand
            );
        }
        cardState.observedHandSlotsByPlayer = observedHandSlotsByPlayer;
        cardState.handCostAdjustmentsByPlayer = handCostAdjustmentsByPlayer;

        if (Array.isArray(cardState.discard)) {
            cardState.discard = cardState.discard.filter((cardId) => !deps.isHiddenHandTokenLike(cardId));
        }

        const selectedOwnerKey = deps.parseSeatKeyOptional(cardState.selectedCardOwnerKey);
        if (!cardState.selectedCardId) {
            cardState.selectedCardId = null;
            cardState.selectedCardOwnerKey = null;
        }
        const canViewerInspectSelectedOwnerHand = spectatorView || canViewerInspectOwnerHand(shot, viewer, selectedOwnerKey);
        if (canViewerInspectSelectedOwnerHand && deps.isHiddenHandTokenLike(cardState.selectedCardId)) {
            cardState.selectedCardId = null;
            cardState.selectedCardOwnerKey = null;
        }
        if (!canViewerInspectSelectedOwnerHand) {
            cardState.selectedCardId = null;
            cardState.selectedCardOwnerKey = null;
        }

        if (cardState.pendingEffectByPlayer && typeof cardState.pendingEffectByPlayer === 'object') {
            const pendingEffectByPlayer = asRecord(cardState.pendingEffectByPlayer);
            for (const ownerKey of deps.playerKeys) {
                const pending = asRecord(pendingEffectByPlayer[ownerKey]);
                if (!pending || pending.type !== 'CONDEMN_WILL' || !Array.isArray(pending.offers)) continue;
                const opponentKey = deps.getOpponentKey(ownerKey);
                const opponentHand = Array.isArray(sourceHands[opponentKey]) ? sourceHands[opponentKey] : [];
                const revealToViewer = spectatorView || canViewerInspectOwnerHand(shot, viewer, ownerKey);
                pending.offers = pending.offers.map((offer: unknown, idx: number) => {
                    const offerRecord = asRecord(offer);
                    const parsedToken = offerRecord.cardId ? deps.parseHiddenHandToken(offerRecord.cardId) : null;
                    const fallbackIndex = parsedToken && Number.isInteger(parsedToken.handIndex) ? parsedToken.handIndex : idx;
                    const handIndex = deps.normalizeProjectedHandIndex(
                        Number.isInteger(offerRecord.handIndex) ? offerRecord.handIndex : fallbackIndex,
                        idx,
                        opponentHand.length
                    );
                    if (revealToViewer) {
                        const visibleCardId = handIndex === null ? null : opponentHand[handIndex];
                        return {
                            handIndex,
                            cardId: visibleCardId || (handIndex === null ? null : deps.makeHiddenHandToken(opponentKey, handIndex))
                        };
                    }
                    return {
                        handIndex,
                        cardId: handIndex === null ? null : deps.makeHiddenHandToken(opponentKey, handIndex)
                    };
                });
            }
        }

        delete cardState._nextCardCopySeq;
        delete cardState._handCopyIdsByPlayer;
        delete cardState._deckCopyIdsByPlayer;
        delete cardState._discardCopyIds;
        delete cardState._revealedHandCopyIdsByViewer;
        delete cardState.cardCostOverridesByCopyId;
        delete cardState.cardCostModifiersByCopyId;

        const projectedForSeat = deps.parseSeatKeyOptional(
            Object.prototype.hasOwnProperty.call(meta, 'projectedForSeat')
                ? meta.projectedForSeat
                : viewer
        );
        shot._meta = {
            authority: 'server',
            version: Number.isFinite(Number(meta.stateVersion))
                ? Number(meta.stateVersion)
                : (Number.isFinite(Number(shot.stateVersion)) ? Number(shot.stateVersion) : null),
            projectedForSeat,
            turnStartReconciled: meta.turnStartReconciled !== false
        };
        if (meta.viewerRole === 'spectator') {
            asRecord(shot._meta).viewerRole = 'spectator';
        }

        return shot;
    }

    function normalizeViewerIdentity(value: unknown): MatchAuthorityViewer | null {
        const source = asRecord(value);
        if (String(source.role || '').trim() === 'spectator') {
            return {
                role: 'spectator',
                spectatorId: deps.normalizeSpectatorId(source.spectatorId)
            };
        }
        const seatKey = deps.parseSeatKeyOptional(source.seatKey || value);
        return seatKey ? { role: 'seat', seatKey } : null;
    }

    function getPayloadKeyForViewer(viewerValue: unknown): MatchAuthoritySeatKey | 'spectator' {
        const viewer = normalizeViewerIdentity(viewerValue);
        return viewer && viewer.role === 'seat' ? viewer.seatKey : 'spectator';
    }

    function cloneSnapshotHashSource(snapshotValue: unknown): unknown {
        const shot = deps.deepClone(snapshotValue || {}) as RecordValue;
        if (shot && typeof shot === 'object' && shot._meta && typeof shot._meta === 'object') {
            const meta = asRecord(shot._meta);
            delete meta.projectedSnapshotHash;
            delete meta.authoritativeStateHash;
        }
        return shot;
    }

    function computeAuthoritativeStateHash(snapshotValue: unknown): string | null {
        return deps.computeStableHash ? deps.computeStableHash(cloneSnapshotHashSource(snapshotValue)) : null;
    }

    function computeProjectedSnapshotHash(snapshotValue: unknown): string | null {
        return deps.computeStableHash ? deps.computeStableHash(cloneSnapshotHashSource(snapshotValue)) : null;
    }

    function buildPublicSnapshotForViewer(
        room: MatchAuthorityRoomState | null | undefined,
        viewerValue: unknown
    ): MatchAuthorityPublicSnapshot {
        const viewer = normalizeViewerIdentity(viewerValue);
        const viewerSeatKey = viewer && viewer.role === 'seat' ? viewer.seatKey : null;
        const shot = projectSnapshotForViewer(room && room.snapshot ? room.snapshot : {}, viewerSeatKey, {
            stateVersion: room ? room.stateVersion : 0,
            updatedAt: room ? room.updatedAt : deps.now(),
            projectedForSeat: viewerSeatKey,
            viewerRole: viewer && viewer.role === 'spectator' ? 'spectator' : null,
            turnStartReconciled: true
        });
        deps.stripTransientPresentationState(shot);
        const projectedSnapshotHash = computeProjectedSnapshotHash(shot);
        if (!shot._meta || typeof shot._meta !== 'object') {
            shot._meta = {};
        }
        asRecord(shot._meta).projectedSnapshotHash = projectedSnapshotHash;
        return shot;
    }

    function buildPublicSnapshot(
        room: MatchAuthorityRoomState | null | undefined,
        viewerSeatKey: PlayerKey | null | undefined
    ): MatchAuthorityPublicSnapshot {
        const shot = projectSnapshotForViewer(room && room.snapshot ? room.snapshot : {}, viewerSeatKey || null, {
            stateVersion: room ? room.stateVersion : 0,
            updatedAt: room ? room.updatedAt : deps.now(),
            projectedForSeat: viewerSeatKey || null,
            turnStartReconciled: true
        });
        deps.stripTransientPresentationState(shot);
        const projectedSnapshotHash = computeProjectedSnapshotHash(shot);
        if (!shot._meta || typeof shot._meta !== 'object') {
            shot._meta = {};
        }
        asRecord(shot._meta).projectedSnapshotHash = projectedSnapshotHash;
        return shot;
    }

    function buildPublishViewerArtifacts(
        room: MatchAuthorityRoomState | null | undefined,
        options?: PublishViewerArtifactsOptions
    ): PublishViewerArtifacts {
        const opts = options && typeof options === 'object' ? options : {};
        const perfCounters = opts.perfCounters && typeof opts.perfCounters === 'object'
            ? opts.perfCounters
            : null;
        const viewerSpecs: Array<{ key: PublishViewerKey; viewer: MatchAuthorityViewer }> = [
            { key: 'black', viewer: { role: 'seat', seatKey: 'black' } },
            { key: 'white', viewer: { role: 'seat', seatKey: 'white' } },
            { key: 'spectator', viewer: { role: 'spectator', spectatorId: '' } }
        ];
        const projectedSnapshots = {} as Record<PublishViewerKey, MatchAuthorityPublicSnapshot>;
        for (const spec of viewerSpecs) {
            const snapshot = buildPublicSnapshotForViewer(room, spec.viewer);
            projectedSnapshots[spec.key] = snapshot;
            if (perfCounters) {
                const counterKey = `viewerProjection${spec.key === 'spectator' ? 'Spectator' : spec.key[0].toUpperCase() + spec.key.slice(1)}`;
                perfCounters[counterKey] = Number(perfCounters[counterKey] || 0) + 1;
            }
            if (typeof opts.onViewerProjected === 'function') opts.onViewerProjected(spec.key, snapshot);
        }
        return {
            canonicalHash: Object.prototype.hasOwnProperty.call(opts, 'canonicalHash')
                ? (opts.canonicalHash || null)
                : computeAuthoritativeStateHash(room && room.snapshot ? room.snapshot : {}),
            projectedSnapshots,
            snapshotPayloads: {}
        };
    }

    return {
        getFateWillControllerKey,
        isFateWillControllerForCurrentTurn,
        canViewerInspectOwnerHand,
        projectSnapshotForViewer,
        normalizeViewerIdentity,
        getPayloadKeyForViewer,
        computeAuthoritativeStateHash,
        computeProjectedSnapshotHash,
        buildPublishViewerArtifacts,
        buildPublicSnapshotForViewer,
        buildPublicSnapshot
    };
}
