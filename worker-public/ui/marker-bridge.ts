/**
 * @file marker-bridge.ts
 * @description UI-side adapter to derive legacy specialStones/bombs from markers.
 */

import type { CardState } from '../src/types';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface MarkersAdapter {
  markersToSpecialStones?: (markers: unknown[]) => unknown[];
  markersToBombs?: (markers: unknown[]) => unknown[];
}

declare const MarkersAdapter: MarkersAdapter | undefined;

function ensureLegacyMarkers(cardState: CardState | null | undefined): void {
  if (!cardState || !Array.isArray(cardState.markers)) return;
  if (typeof MarkersAdapter === 'undefined' || !MarkersAdapter) return;
  if (typeof MarkersAdapter.markersToSpecialStones === 'function') {
    (cardState as CardState & { specialStones?: unknown[] }).specialStones = MarkersAdapter.markersToSpecialStones(cardState.markers);
  }
  if (typeof MarkersAdapter.markersToBombs === 'function') {
    (cardState as CardState & { bombs?: unknown[] }).bombs = MarkersAdapter.markersToBombs(cardState.markers);
  }
}

if (typeof window !== 'undefined') {
  (window as Window & { ensureLegacyMarkers?: typeof ensureLegacyMarkers }).ensureLegacyMarkers = ensureLegacyMarkers;
}

export = {
  ensureLegacyMarkers
};
