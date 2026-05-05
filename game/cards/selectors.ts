declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file selectors.ts
 * @description Selector orchestrator wrapper (delegates to game/logic/cards/selectors.js)
 */
module.exports = _require("../../logic/cards/selectors");

import SelectorsModule = require('../logic/cards/selectors');

export = SelectorsModule;
