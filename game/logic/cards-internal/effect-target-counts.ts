type EffectTargetCountsDeps = {
    ensureMarkers?: (cardState: any) => void;
    getSpecialMarkers?: (cardState: any) => any[];
    getBombMarkers?: (cardState: any) => any[];
    getMarkerRuleClass?: (marker: any) => string | null;
    isAbsoluteProtectedCell?: (cardState: any, row: any, col: any) => boolean;
    ensureSalvationDestroyedLedger?: (cardState: any) => any;
};

export function createEffectTargetCounts(deps?: EffectTargetCountsDeps) {
    const ensureMarkers = typeof deps?.ensureMarkers === 'function'
        ? deps.ensureMarkers
        : (() => {});
    const getSpecialMarkers = typeof deps?.getSpecialMarkers === 'function'
        ? deps.getSpecialMarkers
        : (() => []);
    const getBombMarkers = typeof deps?.getBombMarkers === 'function'
        ? deps.getBombMarkers
        : (() => []);
    const getMarkerRuleClass = typeof deps?.getMarkerRuleClass === 'function'
        ? deps.getMarkerRuleClass
        : (() => null);
    const isAbsoluteProtectedCell = typeof deps?.isAbsoluteProtectedCell === 'function'
        ? deps.isAbsoluteProtectedCell
        : (() => false);
    const ensureSalvationDestroyedLedger = typeof deps?.ensureSalvationDestroyedLedger === 'function'
        ? deps.ensureSalvationDestroyedLedger
        : (() => null);

    function collectLossWillRemovals(cardState: any) {
        ensureMarkers(cardState);
        const specials = getSpecialMarkers(cardState);
        const guardedCells = new Set(
            specials
                .filter((marker: any) => (
                    marker &&
                    marker.data &&
                    marker.data.type === 'GUARD' &&
                    Number.isInteger(marker.row) &&
                    Number.isInteger(marker.col)
                ))
                .map((marker: any) => `${marker.row},${marker.col}`)
        );
        const removableSpecials = specials.filter((marker: any) => {
            if (!marker) return false;
            const ruleClass = getMarkerRuleClass(marker);
            if (ruleClass) {
                if (ruleClass !== 'true_special_stone') return false;
            } else {
                if (marker.data && marker.data.type === 'METEOR_HOLE') return false;
                if (marker.data && marker.data.type === 'ABSOLUTE_PROTECTED') return false;
            }
            if (!Number.isInteger(marker.row) || !Number.isInteger(marker.col)) return true;
            return !guardedCells.has(`${marker.row},${marker.col}`);
        });
        const bombs = getBombMarkers(cardState);
        const removableBombs = bombs.filter((marker: any) => {
            if (!marker) return false;
            if (!Number.isInteger(marker.row) || !Number.isInteger(marker.col)) return true;
            if (isAbsoluteProtectedCell(cardState, marker.row, marker.col)) return false;
            return !guardedCells.has(`${marker.row},${marker.col}`);
        });
        const removed = removableSpecials.map((marker: any) => ({
            row: marker.row,
            col: marker.col,
            owner: marker.owner || null,
            type: (marker.data && marker.data.type) || null
        })).concat(removableBombs.map((marker: any) => ({
            row: marker.row,
            col: marker.col,
            owner: marker.owner || null,
            type: (marker.data && marker.data.type) || 'TIME_BOMB'
        })));
        return {
            guardedCells,
            removableSpecials,
            removableBombs,
            removed
        };
    }

    function getLossWillRemovableCount(cardState: any) {
        const result = collectLossWillRemovals(cardState);
        return result.removed.length;
    }

    function getSalvationWillTargetCount(cardState: any, playerKey: any) {
        const ledger = ensureSalvationDestroyedLedger(cardState);
        if (!ledger) return 0;
        const list = ledger[playerKey];
        return Array.isArray(list) ? list.length : 0;
    }

    function getExecutionWillTargetCount(cardState: any, playerKey: any) {
        const ledger = ensureSalvationDestroyedLedger(cardState);
        if (!ledger) return 0;
        const list = ledger[playerKey];
        if (!Array.isArray(list)) return 0;
        return list.filter((entry: any) => entry && entry.owner === playerKey).length;
    }

    return {
        collectLossWillRemovals,
        getLossWillRemovableCount,
        getSalvationWillTargetCount,
        getExecutionWillTargetCount
    };
}
