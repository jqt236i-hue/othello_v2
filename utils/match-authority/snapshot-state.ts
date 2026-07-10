interface MatchAuthoritySnapshotStateDeps {
    playerKeys: readonly string[];
}

function asRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' ? value as Record<string, any> : {};
}

export function createMatchAuthoritySnapshotStateApi(deps: MatchAuthoritySnapshotStateDeps) {
    function stripTransientPresentationState(nextSnapshot: unknown): unknown {
        const snapshot = asRecord(nextSnapshot);
        const cardState = (snapshot.cardState && typeof snapshot.cardState === 'object')
            ? asRecord(snapshot.cardState)
            : null;
        if (cardState) {
            cardState.presentationEvents = [];
            cardState._presentationEventsPersist = [];
            delete cardState._currentActionMeta;
        }
        if (snapshot.gameState && typeof snapshot.gameState === 'object') {
            delete asRecord(snapshot.gameState).__resultShown;
        }
        return nextSnapshot;
    }

    function stripTransientChargeDeltaState(nextSnapshot: unknown): unknown {
        const snapshot = asRecord(nextSnapshot);
        const cardState = (snapshot.cardState && typeof snapshot.cardState === 'object')
            ? asRecord(snapshot.cardState)
            : null;
        if (cardState) cardState.chargeDeltaEvents = [];
        return nextSnapshot;
    }

    function normalizeChargeValue(value: unknown): number {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : 0;
    }

    function restoreMissingChargeDeltaEvents(previousSnapshot: unknown, nextSnapshot: unknown): unknown {
        const previousSnapshotRecord = asRecord(previousSnapshot);
        const nextSnapshotRecord = asRecord(nextSnapshot);
        const previousCardState = (previousSnapshotRecord.cardState && typeof previousSnapshotRecord.cardState === 'object')
            ? asRecord(previousSnapshotRecord.cardState)
            : null;
        const nextCardState = (nextSnapshotRecord.cardState && typeof nextSnapshotRecord.cardState === 'object')
            ? asRecord(nextSnapshotRecord.cardState)
            : null;
        if (!previousCardState || !nextCardState) return nextSnapshot;
        if (Array.isArray(nextCardState.chargeDeltaEvents) && nextCardState.chargeDeltaEvents.length > 0) return nextSnapshot;

        const previousCharge = (previousCardState.charge && typeof previousCardState.charge === 'object')
            ? asRecord(previousCardState.charge)
            : null;
        const nextCharge = (nextCardState.charge && typeof nextCardState.charge === 'object')
            ? asRecord(nextCardState.charge)
            : null;
        if (!previousCharge || !nextCharge) return nextSnapshot;

        const events: Array<{ seq: number; player: string; before: number; after: number; delta: number; reason: string }> = [];
        let seq = 1;
        for (const playerKey of deps.playerKeys) {
            const before = normalizeChargeValue(previousCharge[playerKey]);
            const after = normalizeChargeValue(nextCharge[playerKey]);
            const delta = after - before;
            if (delta === 0) continue;
            const direction = delta > 0 ? 1 : -1;
            const steps = Math.abs(delta);
            let cursor = before;
            for (let step = 0; step < steps; step += 1) {
                const next = cursor + direction;
                events.push({
                    seq,
                    player: playerKey,
                    before: cursor,
                    after: next,
                    delta: direction,
                    reason: 'network_snapshot_charge_sync'
                });
                seq += 1;
                cursor = next;
            }
        }
        nextCardState.chargeDeltaEvents = events;
        return nextSnapshot;
    }

    return {
        stripTransientPresentationState,
        stripTransientChargeDeltaState,
        restoreMissingChargeDeltaEvents
    };
}
