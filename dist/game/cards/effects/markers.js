"use strict";
/**
 * @file markers.ts
 * @description Marker helpers wrapper (delegates to game/logic/cards/markers.js)
 */
const MarkersModule = require("../../logic/cards/markers");
const exports = {
    MARKER_KINDS: MarkersModule.MARKER_KINDS,
    MARKER_CATEGORIES: MarkersModule.MARKER_CATEGORIES,
    ensureMarkers: MarkersModule.ensureMarkers,
    getMarkers: MarkersModule.getMarkers,
    getMarkerCategory: MarkersModule.getMarkerCategory,
    getBombMarkerType: MarkersModule.getBombMarkerType,
    isBombCategoryMarker: MarkersModule.isBombCategoryMarker,
    isSpecialStoneMarker: MarkersModule.isSpecialStoneMarker,
    getSpecialMarkers: MarkersModule.getSpecialMarkers,
    getBombMarkers: MarkersModule.getBombMarkers,
    getBlockadeMarkers: MarkersModule.getBlockadeMarkers,
    getBlockingMarkers: MarkersModule.getBlockingMarkers,
    isFrozenCellForCard: MarkersModule.isFrozenCellForCard,
    isMeteorHoleCell: MarkersModule.isMeteorHoleCell,
    isGuardProtectedCell: MarkersModule.isGuardProtectedCell,
    findSpecialMarkerAt: MarkersModule.findSpecialMarkerAt,
    findBombMarkerAt: MarkersModule.findBombMarkerAt,
    removeMarkersAt: MarkersModule.removeMarkersAt,
    getSpecialMarkerAt: MarkersModule.getSpecialMarkerAt,
    isSpecialStoneAt: MarkersModule.isSpecialStoneAt,
    getSpecialOwnerAt: MarkersModule.getSpecialOwnerAt,
    clearStoneIdAtForCard: MarkersModule.clearStoneIdAtForCard,
    getStoneIdAtForCard: MarkersModule.getStoneIdAtForCard,
    setStoneIdAtForCard: MarkersModule.setStoneIdAtForCard,
    swapCellCoordinates: MarkersModule.swapCellCoordinates,
    addMarker: MarkersModule.addMarker,
    removeMarkerById: MarkersModule.removeMarkerById,
    applyExtendLifeWill: MarkersModule.applyExtendLifeWill,
    applyExtendLifeGod: MarkersModule.applyExtendLifeGod,
    applyCorrosionWill: MarkersModule.applyCorrosionWill
};
module.exports = exports;
//# sourceMappingURL=markers.js.map