"use strict";
/**
 * @file markers.ts
 * @description Marker helpers wrapper (delegates to game/logic/cards/markers.js)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
const MarkersModule = __importStar(require("../../logic/cards/markers"));
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
