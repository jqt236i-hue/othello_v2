/**
 * @file clone.ts
 * @description Clone effects wrapper (delegates to game/logic/cards/clone.js)
 */

import CloneModule = require('../../logic/cards/clone');

const _exports: any = {
  applyCloneWill: CloneModule.applyCloneWill
};

export = _exports;
