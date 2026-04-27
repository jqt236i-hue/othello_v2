/**
 * @file regen.js
 * @description Regen Will effects wrapper (delegates to game/logic/cards/regen.js)
 */

'use strict';

const RegenModule = require('../../logic/cards/regen');

module.exports = {
    applyRegenWill: RegenModule.applyRegenWill,
    applyRegenAfterFlips: RegenModule.applyRegenAfterFlips
};
