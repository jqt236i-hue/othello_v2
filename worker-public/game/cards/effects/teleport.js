/**
 * @file teleport.js
 * @description Teleport effects wrapper (delegates to game/logic/cards/teleport.js)
 */

'use strict';

const TeleportModule = require('../../logic/cards/teleport');

module.exports = {
    applyTeleportWill: TeleportModule.applyTeleportWill,
    applyCellTeleportWill: TeleportModule.applyCellTeleportWill
};
