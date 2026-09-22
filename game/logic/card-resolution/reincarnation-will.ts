import CardResolutionBoardView = require('./board-view-access');
import TheorySpawn = require('./theory-incarnation-spawn');

const TYPE = 'REINCARNATION_WILL';

function isReincarnatableMarker(marker: any, registry: any): boolean {
    return !!marker && registry.isTargetableSpecialStone(marker.data?.type, marker.data) === true;
}

function buildReincarnationEntries(deps: any, ownerKey: any, excludedTypes: string[]): any[] {
    return deps.SpecialStoneMarkerFactory.buildTheoryIncarnationSpawnTable(deps.CARD_DEFS, {
        ...deps, ownerKey
    }).filter((entry: any) => !excludedTypes.includes(String(entry.markerData.type).toUpperCase()));
}

function getReincarnationTargets(cardState: any, gameState: any, playerKey: any, deps: any): any[] {
    if (!cardState || !gameState || !['black', 'white'].includes(playerKey)) return [];
    const view = CardResolutionBoardView.createCardResolutionBoardView(cardState, gameState);
    const ownerValue = playerKey === 'white' ? deps.WHITE : deps.BLACK;
    const registry = deps.SpecialStoneRegistry;
    const markers = deps.getMarkers(cardState);
    const targets: any[] = [];
    for (const marker of markers) {
        if (!isReincarnatableMarker(marker, registry) || marker.owner !== playerKey) continue;
        const { row, col } = marker;
        if (!view.isPlayable(row, col) || view.get(row, col) !== ownerValue) continue;
        if (deps.isInviolableCell(cardState, row, col)) continue;
        if (!registry.isTargetableSpecialStone(marker.data.type, marker.data)) continue;
        if (targets.some((target) => target.row === row && target.col === col)) continue;
        const types = markers.filter((item: any) => item.row === row && item.col === col && isReincarnatableMarker(item, registry))
            .map((item: any) => String(item.data.type).toUpperCase());
        if (buildReincarnationEntries(deps, playerKey, types).length) targets.push({ row, col });
    }
    return targets;
}

function applyReincarnationWill(cardState: any, gameState: any, playerKey: any, row: number, col: number, prng: any, deps: any): any {
    const pending = deps.readCardPendingEffect(cardState, playerKey);
    if (!pending || pending.type !== TYPE || pending.stage !== 'selectTarget') return { applied: false, reason: 'not_pending' };
    if (!getReincarnationTargets(cardState, gameState, playerKey, deps).some((target) => target.row === row && target.col === col)) {
        return { applied: false, reason: 'invalid_target' };
    }
    const originals = deps.getMarkers(cardState).filter((marker: any) => marker.row === row && marker.col === col && isReincarnatableMarker(marker, deps.SpecialStoneRegistry));
    const entries = buildReincarnationEntries(deps, playerKey, originals.map((marker: any) => String(marker.data.type).toUpperCase()));
    const selected = deps.sampleRandomPositions(entries, 1, prng)[0];
    if (!selected) return { applied: false, reason: 'no_candidate' };
    const color = playerKey === 'white' ? deps.WHITE : deps.BLACK;
    const before = { color, ...deps.getCellVisualPresentationMeta(cardState, row, col) };
    const data = TheorySpawn.prepareSpawnMarkerData(cardState, {
        ...selected.markerData, sourceType: TYPE
    }, playerKey);
    // Replacing the body is not a loss/destruction. Independent auras and cell statuses remain.
    for (const marker of originals) deps.removeMarkerById(cardState, marker.id);
    deps.addMarker(cardState, deps.MARKER_KINDS.SPECIAL_STONE, row, col, playerKey, data, { emitStatusApplied: false });
    const after = { color, ...deps.getCellVisualPresentationMeta(cardState, row, col) };
    // Preview order is presentation only; the authoritative draw above is the single outcome.
    const previews = deps.sampleRandomPositions(entries, entries.length, prng).map((entry: any) => ({
        ...after, special: entry.markerData.type,
        timer: entry.markerData.remainingOwnerTurns ?? entry.markerData.remainingTurns ?? null,
        flipEvadeRemaining: entry.markerData.flipEvadeRemaining ?? null,
        destroyEvadeRemaining: entry.markerData.destroyEvadeRemaining ?? null
    }));
    deps.emitPresentationEvent(cardState, {
        type: 'STATUS_APPLIED', row, col, cause: TYPE, reason: 'reincarnation_will',
        ownerBefore: playerKey, ownerAfter: playerKey,
        meta: { ...after, cause: TYPE, reason: 'reincarnation_will', reincarnationRoulette: { before, after, previews } }
    });
    deps.clearCardPendingEffect(cardState, playerKey);
    return { applied: true, row, col, type: data.type, sourceCardType: selected.cardType, before, after };
}

export = { buildReincarnationEntries, getReincarnationTargets, applyReincarnationWill };
