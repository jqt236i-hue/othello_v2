import type {
    MatchAuthorityAcceptedOperationEntry,
    MatchAuthorityAcceptedOperationHistoryBySeat,
    MatchAuthorityAcceptedOperationsBySeat,
    MatchAuthorityRoomState,
    MatchAuthoritySeatKey
} from '../match-authority-types';

interface MatchAuthorityOperationsDeps {
    playerKeys: readonly MatchAuthoritySeatKey[];
    acceptedOperationHistoryLimit: number;
    normalizeOperationId: (value: unknown) => string;
    normalizePlayerKey: (value: unknown) => MatchAuthoritySeatKey;
    normalizeStateVersion: (value: unknown) => number | null;
}

function asRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' ? value as Record<string, any> : {};
}

export function createMatchAuthorityOperationsApi(deps: MatchAuthorityOperationsDeps) {
    function hasRequiredOperationId(value: unknown): boolean {
        return deps.normalizeOperationId(value) !== '';
    }

    function ensureAcceptedOperationsBySeat(room: MatchAuthorityRoomState | null | undefined): MatchAuthorityAcceptedOperationsBySeat {
        const source = (room && room.lastAcceptedOperationBySeat && typeof room.lastAcceptedOperationBySeat === 'object')
            ? room.lastAcceptedOperationBySeat
            : {};
        const normalized: MatchAuthorityAcceptedOperationsBySeat = {
            black: (source.black && typeof source.black === 'object') ? source.black : null,
            white: (source.white && typeof source.white === 'object') ? source.white : null
        };
        if (room && typeof room === 'object') room.lastAcceptedOperationBySeat = normalized;
        return normalized;
    }

    function normalizeAcceptedOperationEntry(value: unknown): MatchAuthorityAcceptedOperationEntry | null {
        if (!value || typeof value !== 'object') return null;
        const source = asRecord(value);
        const operationId = deps.normalizeOperationId(source.operationId);
        if (!operationId) return null;
        const autoPassNoticeSource = asRecord(source.autoPassNotice);
        const autoPassReason = String(autoPassNoticeSource.reason || '').trim();
        const normalized: MatchAuthorityAcceptedOperationEntry = {
            operationId,
            stateVersion: deps.normalizeStateVersion(source.stateVersion),
            updatedAt: Number.isFinite(Number(source.updatedAt)) ? Number(source.updatedAt) : null
        };
        if (autoPassReason) {
            normalized.autoPassNotice = {
                playerKey: deps.normalizePlayerKey(autoPassNoticeSource.playerKey),
                reason: autoPassReason,
                ...(autoPassNoticeSource.turnReturned === true ? { turnReturned: true } : {})
            };
        }
        return normalized;
    }

    function ensureAcceptedOperationHistoryBySeat(room: MatchAuthorityRoomState | null | undefined): MatchAuthorityAcceptedOperationHistoryBySeat {
        const historySource = (room && room.acceptedOperationHistoryBySeat && typeof room.acceptedOperationHistoryBySeat === 'object')
            ? room.acceptedOperationHistoryBySeat
            : {};
        const lastAcceptedBySeat = ensureAcceptedOperationsBySeat(room);
        const normalized: MatchAuthorityAcceptedOperationHistoryBySeat = { black: [], white: [] };
        for (const seatKey of deps.playerKeys) {
            const sourceEntries = Array.isArray(historySource[seatKey]) ? historySource[seatKey] : [];
            const combined = sourceEntries.slice();
            if (combined.length === 0 && lastAcceptedBySeat[seatKey]) combined.push(lastAcceptedBySeat[seatKey]);
            const seen = new Set<string>();
            const entries: MatchAuthorityAcceptedOperationEntry[] = [];
            for (const entry of combined) {
                const normalizedEntry = normalizeAcceptedOperationEntry(entry);
                if (!normalizedEntry || seen.has(normalizedEntry.operationId)) continue;
                seen.add(normalizedEntry.operationId);
                entries.push(normalizedEntry);
            }
            normalized[seatKey] = entries.slice(-deps.acceptedOperationHistoryLimit);
            lastAcceptedBySeat[seatKey] = normalized[seatKey].length > 0
                ? normalized[seatKey][normalized[seatKey].length - 1]
                : null;
        }
        if (room && typeof room === 'object') {
            room.acceptedOperationHistoryBySeat = normalized;
            room.lastAcceptedOperationBySeat = lastAcceptedBySeat;
        }
        return normalized;
    }

    function findAcceptedOperationBySeat(
        room: MatchAuthorityRoomState | null | undefined,
        seatKey: unknown,
        operationId: unknown
    ): MatchAuthorityAcceptedOperationEntry | null {
        const normalizedSeat = deps.normalizePlayerKey(seatKey);
        const normalizedOperationId = deps.normalizeOperationId(operationId);
        if (!normalizedOperationId) return null;
        const historyBySeat = ensureAcceptedOperationHistoryBySeat(room);
        const seatHistory = Array.isArray(historyBySeat[normalizedSeat]) ? historyBySeat[normalizedSeat] : [];
        for (let index = seatHistory.length - 1; index >= 0; index -= 1) {
            if (seatHistory[index] && seatHistory[index].operationId === normalizedOperationId) return seatHistory[index];
        }
        return null;
    }

    function resolveAcceptedOperation(
        room: MatchAuthorityRoomState | null | undefined,
        seatKey: unknown,
        operationId: unknown,
        fallbackEntry?: unknown
    ): MatchAuthorityAcceptedOperationEntry | null {
        const matchedEntry = findAcceptedOperationBySeat(room, seatKey, operationId);
        if (matchedEntry) return matchedEntry;
        const normalizedOperationId = deps.normalizeOperationId(operationId);
        const normalizedFallback = normalizeAcceptedOperationEntry(fallbackEntry);
        if (!normalizedOperationId || !normalizedFallback) return null;
        return normalizedFallback.operationId === normalizedOperationId ? normalizedFallback : null;
    }

    function rememberAcceptedOperationBySeat(
        room: MatchAuthorityRoomState | null | undefined,
        seatKey: unknown,
        entry: unknown
    ): MatchAuthorityAcceptedOperationEntry | null {
        const normalizedSeat = deps.normalizePlayerKey(seatKey);
        const normalizedEntry = normalizeAcceptedOperationEntry(entry);
        if (!normalizedEntry) return null;
        const historyBySeat = ensureAcceptedOperationHistoryBySeat(room);
        const currentEntries = Array.isArray(historyBySeat[normalizedSeat]) ? historyBySeat[normalizedSeat] : [];
        const nextEntries = currentEntries.filter((one) => !one || one.operationId !== normalizedEntry.operationId);
        nextEntries.push(normalizedEntry);
        historyBySeat[normalizedSeat] = nextEntries.slice(-deps.acceptedOperationHistoryLimit);
        if (room && typeof room === 'object') {
            room.acceptedOperationHistoryBySeat = historyBySeat;
            room.lastAcceptedOperationBySeat = room.lastAcceptedOperationBySeat && typeof room.lastAcceptedOperationBySeat === 'object'
                ? room.lastAcceptedOperationBySeat
                : { black: null, white: null };
            room.lastAcceptedOperationBySeat[normalizedSeat] = historyBySeat[normalizedSeat][historyBySeat[normalizedSeat].length - 1] || null;
        }
        return historyBySeat[normalizedSeat][historyBySeat[normalizedSeat].length - 1] || null;
    }

    return {
        hasRequiredOperationId,
        ensureAcceptedOperationsBySeat,
        normalizeAcceptedOperationEntry,
        ensureAcceptedOperationHistoryBySeat,
        findAcceptedOperationBySeat,
        resolveAcceptedOperation,
        rememberAcceptedOperationBySeat
    };
}
