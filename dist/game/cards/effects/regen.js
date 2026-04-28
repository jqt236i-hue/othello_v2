"use strict";
/**
 * @file regen.ts
 * @description Regen Will effects wrapper (delegates to game/logic/cards/regen.js)
 */
const RegenModule = require("../../logic/cards/regen");
const exports = {
    applyRegenWill: RegenModule.applyRegenWill,
    applyRegenAfterFlips: RegenModule.applyRegenAfterFlips
};
module.exports = exports;
//# sourceMappingURL=regen.js.map