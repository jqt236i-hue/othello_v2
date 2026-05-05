/**
 * @file teleport.ts
 * @description Teleport effects wrapper (delegates to game/logic/cards/teleport.js)
 */

import TeleportModule = require('../../logic/cards/teleport');

const _exports: any = {
  applyTeleportWill: TeleportModule.applyTeleportWill,
  applyCellTeleportWill: TeleportModule.applyCellTeleportWill
};

export = _exports;
