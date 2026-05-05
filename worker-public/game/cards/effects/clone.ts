/**
 * @file clone.ts
 * @description Clone/Split effects wrapper (delegates to game/logic/cards/clone.js)
 */

import CloneModule = require('../../logic/cards/clone');

const effectExports: any = {
  applyCloneWill: CloneModule.applyCloneWill
};

export = effectExports;
