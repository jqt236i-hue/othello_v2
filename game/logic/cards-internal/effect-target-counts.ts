type EffectTargetCountsDeps = {
    ensureMarkers?: (cardState: any) => void;
    getSpecialMarkers?: (cardState: any) => any[];
    getBombMarkers?: (cardState: any) => any[];
    getMarkerRuleClass?: (marker: any) => string | null;
    canLossWillRevertMarker?: (marker: any) => boolean;
    isInviolableCell?: (cardState: any, row: any, col: any) => boolean;
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
    const canLossWillRevertMarker = typeof deps?.canLossWillRevertMarker === 'function'
        ? deps.canLossWillRevertMarker
        : ((marker: any) => {
            const ruleClass = getMarkerRuleClass(marker);
            if (ruleClass) return ruleClass === 'true_special_stone' || ruleClass === 'trap' || ruleClass === 'bomb';
            if (marker && marker.data && marker.data.type === 'METEOR_HOLE') return false;
            return true;
        });
    const isInviolableCell = typeof deps?.isInviolableCell === 'function'
        ? deps.isInviolableCell
        : (() => false);
    const ensureSalvationDestroyedLedger = typeof deps?.ensureSalvationDestroyedLedger === 'function'
        ? deps.ensureSalvationDestroyedLedger
        : (() => null);

    function isSpecialStoneEffectTarget(marker: any) {
        if (!marker) return false;
        const ruleClass = getMarkerRuleClass(marker);
        return ruleClass === 'true_special_stone' || ruleClass === 'trap' || ruleClass === 'bomb';
    }

    function collectSpecialStoneEffectTargets(cardState: any) {
        ensureMarkers(cardState);
        const seenMarkers = new Set<any>();
        const specialMarkers: any[] = [];
        const bombMarkers: any[] = [];

        for (const marker of getSpecialMarkers(cardState)) {
            if (!isSpecialStoneEffectTarget(marker) || seenMarkers.has(marker)) continue;
            seenMarkers.add(marker);
            specialMarkers.push(marker);
        }
        for (const marker of getBombMarkers(cardState)) {
            if (!isSpecialStoneEffectTarget(marker) || seenMarkers.has(marker)) continue;
            seenMarkers.add(marker);
            bombMarkers.push(marker);
        }

        const markers = specialMarkers.concat(bombMarkers);
        const cells: any[] = [];
        const cellByKey = new Map<string, any>();
        for (const marker of markers) {
            if (!Number.isInteger(marker.row) || !Number.isInteger(marker.col)) continue;
            const key = `${marker.row},${marker.col}`;
            let cell = cellByKey.get(key);
            if (!cell) {
                cell = { row: marker.row, col: marker.col, markers: [] };
                cellByKey.set(key, cell);
                cells.push(cell);
            }
            cell.markers.push(marker);
        }

        return { markers, specialMarkers, bombMarkers, cells };
    }

    function collectLossWillRemovals(cardState: any) {
        const targetCollection = collectSpecialStoneEffectTargets(cardState);
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
        const removableSpecials = targetCollection.specialMarkers.filter((marker: any) => {
            if (!marker) return false;
            if (Number.isInteger(marker.row) && Number.isInteger(marker.col) && isInviolableCell(cardState, marker.row, marker.col)) return false;
            if (!canLossWillRevertMarker(marker)) return false;
            if (!Number.isInteger(marker.row) || !Number.isInteger(marker.col)) return true;
            return !guardedCells.has(`${marker.row},${marker.col}`);
        });
        const removableBombs = targetCollection.bombMarkers.filter((marker: any) => {
            if (!marker) return false;
            if (!Number.isInteger(marker.row) || !Number.isInteger(marker.col)) return true;
            if (isInviolableCell(cardState, marker.row, marker.col)) return false;
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
        collectSpecialStoneEffectTargets,
        collectLossWillRemovals,
        getLossWillRemovableCount,
        getSalvationWillTargetCount,
        getExecutionWillTargetCount
    };
}
