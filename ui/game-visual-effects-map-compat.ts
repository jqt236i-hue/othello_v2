'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const VisualEffectsMap: any = _require('../game/visual-effects-map');
const GlobalPublication: any = _require('./visual-effects-map-global-publication');

if (GlobalPublication && typeof GlobalPublication.publishGameVisualEffectsMap === 'function') {
  GlobalPublication.publishGameVisualEffectsMap(VisualEffectsMap);
}

export = VisualEffectsMap;
