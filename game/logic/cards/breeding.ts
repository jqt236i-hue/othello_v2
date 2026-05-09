declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const BreedingModule = _require('../../../../game/logic/cards/breeding.js');

module.exports = BreedingModule;

export = BreedingModule;
