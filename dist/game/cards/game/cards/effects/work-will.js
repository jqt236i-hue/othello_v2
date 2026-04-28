"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _require = (typeof __non_webpack_require__ !== "undefined")
    ? __non_webpack_require__
    : require;
"use strict";
/**
 * @file work-will.ts
 * @description Work Will effects wrapper (delegates to game/logic/cards/work_will.js)
 */
const WorkWillModule = require("../../logic/cards/work_will");
const exports = {
    placeWorkStone: WorkWillModule.placeWorkStone,
    processWorkEffects: WorkWillModule.processWorkEffects
};
module.exports = exports;
//# sourceMappingURL=work-will.js.map