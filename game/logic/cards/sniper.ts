declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const SniperModule = _require('../../../../game/logic/cards/sniper.js');

module.exports = SniperModule;

export = SniperModule;
