const CaptureSource = require('./logic/cards-internal/capture-source');
const SpecialStoneRegistry = require('../shared/special-stone-registry');

const CPU_TEMPT_MIN_SOURCE_COST = 16;

type TemptValueConfig = {
    cardLogic?: any;
    cardState?: any;
    playerKey?: any;
    minSourceCost?: any;
};

function normalizeTarget(target: any): any | null {
    if (!target) return null;
    const row = Number(target.row);
    const col = Number(target.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
    return { row, col };
}

function getMarkerType(marker: any): string {
    return String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
}

function getMarkers(cardState: any): any[] {
    return Array.isArray(cardState && cardState.markers) ? cardState.markers : [];
}

function getMarkersAt(cardState: any, row: number, col: number): any[] {
    return getMarkers(cardState).filter((marker) => marker && marker.row === row && marker.col === col);
}

function blocksTemptMarker(marker: any): boolean {
    const type = getMarkerType(marker);
    if (!type) return false;
    if (type === 'GUARD' || type === 'ABSOLUTE_PROTECTED') return true;
    return !!(
        SpecialStoneRegistry &&
        typeof SpecialStoneRegistry.blocksTempt === 'function' &&
        SpecialStoneRegistry.blocksTempt(type, marker && marker.data)
    );
}

function isTemptTargetableMarker(marker: any): boolean {
    const type = getMarkerType(marker);
    if (!type) return false;
    return !!(
        SpecialStoneRegistry &&
        typeof SpecialStoneRegistry.isTemptTargetableStoneEffect === 'function' &&
        SpecialStoneRegistry.isTemptTargetableStoneEffect(type, marker && marker.data)
    );
}

function resolveSourceInfo(marker: any, cardLogic: any): any | null {
    if (cardLogic && typeof cardLogic.resolveCaptureSourceInfo === 'function') {
        const info = cardLogic.resolveCaptureSourceInfo(marker);
        if (info) return info;
    }
    if (CaptureSource && typeof CaptureSource.resolveCaptureSourceInfo === 'function') {
        const info = CaptureSource.resolveCaptureSourceInfo(marker);
        if (info) return info;
    }
    const data = marker && marker.data && typeof marker.data === 'object' ? marker.data : null;
    if (data && typeof data.sourceCardId === 'string' && data.sourceCardId) {
        return { sourceCardId: data.sourceCardId };
    }
    return null;
}

function resolveSourceCost(marker: any, config: TemptValueConfig): number {
    const cfg = (config && typeof config === 'object') ? config : {};
    const cardLogic = cfg.cardLogic;
    const sourceInfo = resolveSourceInfo(marker, cardLogic);
    const sourceCardId = sourceInfo && typeof sourceInfo.sourceCardId === 'string'
        ? sourceInfo.sourceCardId
        : '';
    if (sourceCardId && cardLogic && typeof cardLogic.getCardCost === 'function') {
        const cost = Number(cardLogic.getCardCost(sourceCardId));
        if (Number.isFinite(cost)) return Math.max(0, Math.floor(cost));
    }
    const sourceDef = sourceInfo && sourceInfo.sourceCardDef && typeof sourceInfo.sourceCardDef === 'object'
        ? sourceInfo.sourceCardDef
        : null;
    const defCost = Number(sourceDef && sourceDef.cost);
    if (Number.isFinite(defCost)) return Math.max(0, Math.floor(defCost));
    const markerCost = Number(marker && marker.data && marker.data.sourceCardCost);
    return Number.isFinite(markerCost) ? Math.max(0, Math.floor(markerCost)) : 0;
}

function getMinSourceCost(config: TemptValueConfig): number {
    const raw = Number(config && config.minSourceCost);
    return Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : CPU_TEMPT_MIN_SOURCE_COST;
}

function isHighValueTemptTargetForCpu(playerKey: any, target: any, config: TemptValueConfig): boolean {
    const point = normalizeTarget(target);
    if (!point) return false;
    const cfg = (config && typeof config === 'object') ? config : {};
    const cardState = cfg.cardState;
    const opponentKey = playerKey === 'black' ? 'white' : 'black';
    const markersAtCell = getMarkersAt(cardState, point.row, point.col);
    if (markersAtCell.some(blocksTemptMarker)) return false;
    const minSourceCost = getMinSourceCost(cfg);
    return markersAtCell.some((marker) => (
        marker &&
        marker.owner === opponentKey &&
        isTemptTargetableMarker(marker) &&
        resolveSourceCost(marker, cfg) >= minSourceCost
    ));
}

function filterHighValueTemptTargetsForCpu(playerKey: any, targets: any[], config: TemptValueConfig): any[] {
    return Array.isArray(targets)
        ? targets.filter((target) => isHighValueTemptTargetForCpu(playerKey, target, config))
        : [];
}

function countHighValueTemptTargetsForCpu(playerKey: any, targets: any[], config: TemptValueConfig): number {
    return filterHighValueTemptTargetsForCpu(playerKey, targets, config).length;
}

export = {
    CPU_TEMPT_MIN_SOURCE_COST,
    countHighValueTemptTargetsForCpu,
    filterHighValueTemptTargetsForCpu,
    isHighValueTemptTargetForCpu,
    resolveSourceCost
};
