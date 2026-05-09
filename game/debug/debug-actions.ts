declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const DebugActionsModule = _require('../../../game/debug/debug-actions.js');

module.exports = DebugActionsModule;

export = DebugActionsModule;
